import { Request, Response } from 'express';
import { getApp } from '../src/app';

export default async function handler(req: Request, res: Response) {
  const app = await getApp();
  app(req, res);
}
