import { Request, Response, NextFunction } from 'express';
import { env } from '../core/env';

/**
 * Basic Authentication middleware protecting private API documentation.
 * Requires HTTP Basic Auth matching DOCS_USER and DOCS_PASSWORD from environment variables.
 */
export function docsAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!env.DOCS_ENABLED) {
    res.status(404).json({ error: 'Documentation endpoint is disabled', code: 'NOT_FOUND' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Sohopathi Private API Documentation"');
    res.status(401).json({
      error: 'Authentication required to access private API documentation',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  try {
    const base64Credentials = authHeader.substring(6);
    const decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');

    if (colonIndex === -1) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Sohopathi Private API Documentation"');
      res.status(401).json({ error: 'Invalid documentation credentials format', code: 'UNAUTHORIZED' });
      return;
    }

    const username = decoded.substring(0, colonIndex);
    const password = decoded.substring(colonIndex + 1);

    const validUser = env.DOCS_USER || 'admin';
    const validPassword = env.DOCS_PASSWORD || 'sohopathi_docs_secret_2024';

    if (username !== validUser || password !== validPassword) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Sohopathi Private API Documentation"');
      res.status(401).json({ error: 'Invalid documentation credentials', code: 'UNAUTHORIZED' });
      return;
    }

    next();
  } catch (err) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Sohopathi Private API Documentation"');
    res.status(401).json({ error: 'Failed to authenticate documentation request', code: 'UNAUTHORIZED' });
  }
}

