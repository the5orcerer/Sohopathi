import './instrument';
import * as Sentry from '@sentry/node';
import express, { Request, Response, Router } from 'express';
import path from 'path';
import fs from 'fs';
import { errorHandler } from './core/errors';
import { registerModule } from './core/registry/module-registry';
import { onboardingManifest } from './modules/onboarding/manifest';
import { systemManifest } from './modules/system/manifest';
import { coreManifest } from './modules/core/manifest';
import { attendanceManifest } from './modules/attendance/manifest';
import { noticesManifest } from './modules/notices/manifest';
import { assignmentsManifest } from './modules/assignments/manifest';
import { admissionManifest } from './modules/admission/manifest';
import { authRouter } from './core/auth/auth-routes';
import { mountDocs } from './docs';

function enableCors(app: express.Application) {
  app.use((req: Request, res: Response, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-institution-id, x-institution-subdomain, x-subdomain, baggage, sentry-trace, *'
    );
    res.header('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
}

function mountStorage(app: express.Application) {
  let uploadsDir: string;
  try {
    uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch {
    uploadsDir = path.join('/tmp', 'uploads');
    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
    } catch {}
  }

  // Serve static files uploaded locally
  app.use('/storage-uploads', express.static(uploadsDir));

  // Local file upload handler for development
  app.put('/api/storage/local-upload', express.raw({ type: '*/*', limit: '50mb' }), (req: Request, res: Response) => {
    const key = req.query.key as string;
    if (!key) {
      res.status(400).json({ error: 'Missing key query parameter' });
      return;
    }
    try {
      const targetFile = path.join(uploadsDir, key);
      const targetDir = path.dirname(targetFile);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetFile, req.body as Buffer);
      res.status(200).json({ status: 'ok', key, downloadUrl: `/storage-uploads/${key}` });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to write local file', message: err.message });
    }
  });
}

export function createApp(): express.Application {
  const app = express();
  enableCors(app);
  mountStorage(app);
  app.use(express.json());

  // Mount private Swagger API Documentation (Basic Auth protected)
  mountDocs(app);

  const router = Router();

  app.get(['/health', '/api/health'], (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get(['/debug-sentry', '/api/debug-sentry'], (req: Request, res: Response) => {
    throw new Error('My first Sentry error from backend!');
  });

  app.use(router);
  Sentry.setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
}

export function bootApp(): express.Application {
  const app = express();
  enableCors(app);
  mountStorage(app);
  app.use(express.json());

  // Mount private Swagger API Documentation (Basic Auth protected)
  mountDocs(app);

  const router = Router();

  // Public unauthenticated health check
  app.get(['/health', '/api/health'], (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get(['/debug-sentry', '/api/debug-sentry'], (req: Request, res: Response) => {
    throw new Error('My first Sentry error from backend!');
  });

  // Public unauthenticated auth routes
  app.use('/api/auth', authRouter);

  // Register Active Platform Modules in memory (<5ms boot time)
  registerModule(onboardingManifest, router);
  registerModule(systemManifest, router);
  registerModule(coreManifest, router);
  registerModule(attendanceManifest, router);
  registerModule(noticesManifest, router);
  registerModule(assignmentsManifest, router);
  registerModule(admissionManifest, router);

  app.use(router);

  // Serve production frontend build if dist directory exists
  const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    app.get('*', (req: Request, res: Response, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/health') ||
        req.path.startsWith('/storage-uploads') ||
        req.path.startsWith('/docs') ||
        req.path.startsWith('/debug-sentry')
      ) {
        return next();
      }
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  }

  Sentry.setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
}

let cachedApp: express.Application | null = null;

/**
 * Singleton app loader for serverless environments (Vercel, Netlify, AWS Lambda).
 * Ensures app initialization and module route mounting happens once per cold start.
 */
export async function getApp(): Promise<express.Application> {
  if (!cachedApp) {
    cachedApp = bootApp();
  }
  return cachedApp;
}

