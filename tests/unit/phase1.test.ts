import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootApp } from '../../src/app';
import http from 'http';

describe('Phase 1 - Core infrastructure', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = await bootApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /health returns 200 and status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET /api/me without token returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/me`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('missing token');
  });
});
