import '../src/instrument';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import { getApp } from '../src/app';

export default async function handler(req: Request, res: Response) {
  const app = await getApp();

  return new Promise<void>((resolve, reject) => {
    res.on('finish', async () => {
      await Sentry.flush(2000).catch(() => {});
      resolve();
    });
    res.on('close', async () => {
      await Sentry.flush(2000).catch(() => {});
      resolve();
    });

    try {
      app(req, res);
    } catch (err) {
      Sentry.captureException(err);
      Sentry.flush(2000).then(() => reject(err)).catch(() => reject(err));
    }
  });
}
