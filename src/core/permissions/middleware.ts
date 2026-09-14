import { Request, Response, NextFunction } from 'express';
import { PoolClient } from 'pg';
import * as Sentry from '@sentry/node';
import { pool, withTenantContext } from '../db';
import { supabaseAuthProvider } from '../auth/supabase-auth-provider';
import { resolveContext, ResolvedContext } from './resolve-permissions';
import { extractTenantFromRequest } from '../tenant-utils';
import { hasSufficientScope } from './dependencies';

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
  Sentry.setUser({ id: result.userId });
  next();
}

export async function loadContext(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId;
  const institutionId =
    (req.headers['x-institution-id'] as string) ||
    (req.headers['x-institution-subdomain'] as string) ||
    extractTenantFromRequest(req);
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
    Sentry.setTag('institution_id', ctx.institutionId);
    Sentry.setTag('role_id', ctx.roleId);
    next();
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

import { getFeatureForPermission, isFeatureAvailable, requireFeature } from './feature-guard';

export { requireFeature };

export function requirePermission(permissionKey: string, requiredScope?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!permissionKey) {
      return next();
    }

    const keys = permissionKey.split(',').map((k) => k.trim());

    // 1. Two-tier verification: Feature availability check must precede permission evaluation (Blueprint Section 41)
    const institutionId = req.ctx?.institutionId;
    if (institutionId) {
      for (const key of keys) {
        const featureKey = getFeatureForPermission(key);
        if (featureKey) {
          const client = await pool.connect();
          try {
            const check = await isFeatureAvailable(
              client,
              institutionId,
              featureKey,
              req.ctx?.roleName,
              req.ctx?.userId
            );
            if (!check.available) {
              return res.status(403).json({
                error: check.reason || `Feature '${featureKey}' is disabled for this institution`,
                code: 'FEATURE_DISABLED',
              });
            }
          } finally {
            client.release();
          }
          break;
        }
      }
    }

    // 2. Permission evaluation
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

    // 3. Multi-tier scope evaluation
    if (requiredScope && !hasSufficientScope(grantedScope, requiredScope)) {
      return res.status(403).json({ error: `insufficient scope for ${matchedKey}`, code: 'FORBIDDEN' });
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
