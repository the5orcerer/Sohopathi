import express, { Request, Response, Router } from 'express';
import path from 'path';
import fs from 'fs';
import { errorHandler } from './core/errors';
import { pool, ensureTenantRLS } from './core/db';
import { registerModule } from './core/registry/module-registry';
import { onboardingManifest } from './modules/onboarding/manifest';
import { systemManifest } from './modules/system/manifest';
import { coreManifest } from './modules/core/manifest';
import { attendanceManifest } from './modules/attendance/manifest';
import { noticesManifest } from './modules/notices/manifest';
import { assignmentsManifest } from './modules/assignments/manifest';
import { admissionManifest } from './modules/admission/manifest';
import { authRouter } from './core/auth/auth-routes';

function enableCors(app: express.Application) {
  app.use((req: Request, res: Response, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-institution-id');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
}

function mountStorage(app: express.Application) {
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
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
    const targetFile = path.join(uploadsDir, key);
    const targetDir = path.dirname(targetFile);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(targetFile, req.body as Buffer);
    res.status(200).json({ status: 'ok', key, downloadUrl: `/storage-uploads/${key}` });
  });
}

export function createApp(): express.Application {
  const app = express();
  enableCors(app);
  mountStorage(app);
  app.use(express.json());

  const router = Router();

  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(router);
  app.use(errorHandler);

  return app;
}

export async function bootApp(): Promise<express.Application> {
  const app = express();
  enableCors(app);
  mountStorage(app);
  app.use(express.json());

  const router = Router();

  // Ensure FORCE RLS on tenant tables if DB connection is available
  try {
    const dbClient = await pool.connect();
    try {
      await ensureTenantRLS(dbClient);
    } finally {
      dbClient.release();
    }
  } catch (err: any) {
    // Log warning if offline/unreachable during early boot
    console.warn('Database connection unavailable during early boot:', err.message);
  }

  // Public unauthenticated health check
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Public unauthenticated auth routes
  app.use('/api/auth', authRouter);

  // Register Core & Soft-Launch Active Modules
  await registerModule(onboardingManifest, router);
  await registerModule(systemManifest, router);
  await registerModule(coreManifest, router);
  await registerModule(attendanceManifest, router);
  await registerModule(noticesManifest, router);
  await registerModule(assignmentsManifest, router);
  await registerModule(admissionManifest, router);

  app.use(router);

  // Serve production frontend build if dist directory exists
  const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/storage-uploads')) {
        return next();
      }
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}

let cachedAppPromise: Promise<express.Application> | null = null;

/**
 * Singleton app loader for serverless environments (Vercel, Netlify, AWS Lambda).
 * Ensures app initialization and module registration happens once per cold start.
 */
export async function getApp(): Promise<express.Application> {
  if (!cachedAppPromise) {
    cachedAppPromise = bootApp();
  }
  return cachedAppPromise;
}
