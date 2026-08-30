import { Request, Response, NextFunction } from 'express';
import { PoolClient } from 'pg';
import { pool, withTenantContext } from '../db';
import { supabaseAuthProvider } from '../auth/supabase-auth-provider';
import { resolveContext, ResolvedContext } from './resolve-permissions';

declare global {
  namespace Express {
    interface Request {
      ctx?: ResolvedContext;
      userId?: string;
      grantedScope?: string;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: 'missing token', code: 'UNAUTHORIZED' });
  }

  const result = await supabaseAuthProvider.verifyToken(token);
  if (!result) {
    return res.status(401).json({ error: 'invalid token', code: 'UNAUTHORIZED' });
  }

  req.userId = result.userId;
  next();
}

export async function loadContext(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId;
  const institutionId = req.headers['x-institution-id'] as string;
  if (!institutionId) {
    return res.status(400).json({ error: 'missing institution context', code: 'MISSING_INSTITUTION' });
  }

  const client = await pool.connect();
  try {
    const ctx = await resolveContext(client, userId!, institutionId);
    if (!ctx) {
      return res.status(403).json({ error: 'no active membership in this institution', code: 'NO_MEMBERSHIP' });
    }
    req.ctx = ctx;
    next();
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

export function requirePermission(permissionKey: string, requiredScope?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!permissionKey) {
      return next();
    }

    const keys = permissionKey.split(',').map((k) => k.trim());
    let matchedKey: string | undefined;
    let grantedScope: string | undefined;

    for (const key of keys) {
      if (req.ctx?.permissions.has(key)) {
        matchedKey = key;
        grantedScope = req.ctx.permissions.get(key);
        break;
      }
    }

    if (!grantedScope) {
      return res.status(403).json({ error: `missing permission: ${permissionKey}`, code: 'FORBIDDEN' });
    }

    if (requiredScope && grantedScope !== 'institution') {
      if (grantedScope !== requiredScope) {
        return res.status(403).json({ error: `insufficient scope for ${matchedKey}`, code: 'FORBIDDEN' });
      }
    }

    req.grantedScope = grantedScope;
    next();
  };
}

export function withDb(
  handler: (req: Request, res: Response, client: PoolClient) => Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await withTenantContext(req.ctx!.institutionId, (client) => handler(req, res, client));
    } catch (err) {
      next(err);
    }
  };
}
