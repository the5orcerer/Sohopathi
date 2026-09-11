import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootApp } from '../../src/app';
import { env } from '../../src/core/env';
import http from 'http';

describe('Private Swagger / OpenAPI Documentation Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  const validUsername = env.DOCS_USER || 'admin';
  const validPassword = env.DOCS_PASSWORD || 'biddyapith_docs_secret_2024';
  const validBasicAuth = `Basic ${Buffer.from(`${validUsername}:${validPassword}`).toString('base64')}`;
  const invalidBasicAuth = `Basic ${Buffer.from('wronguser:wrongpass').toString('base64')}`;

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

  it('rejects unauthenticated request to /docs with 401 and WWW-Authenticate header', async () => {
    const res = await fetch(`${baseUrl}/docs/`);
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('Basic realm="Biddyapith Private API Documentation"');
    const body = (await res.json()) as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('rejects request with invalid Basic Auth credentials to /docs with 401', async () => {
    const res = await fetch(`${baseUrl}/docs/`, {
      headers: {
        Authorization: invalidBasicAuth,
      },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Invalid documentation credentials');
  });

  it('allows access to /docs/ with valid Basic Auth credentials', async () => {
    const res = await fetch(`${baseUrl}/docs/`, {
      headers: {
        Authorization: validBasicAuth,
      },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('swagger-ui');
  });

  it('allows access to /api/docs/ with valid Basic Auth credentials', async () => {
    const res = await fetch(`${baseUrl}/api/docs/`, {
      headers: {
        Authorization: validBasicAuth,
      },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('swagger-ui');
  });

  it('rejects unauthenticated request to /docs/swagger.json with 401', async () => {
    const res = await fetch(`${baseUrl}/docs/swagger.json`);
    expect(res.status).toBe(401);
  });

  it('returns valid OpenAPI 3.0 specification at /docs/swagger.json with valid Basic Auth', async () => {
    const res = await fetch(`${baseUrl}/docs/swagger.json`, {
      headers: {
        Authorization: validBasicAuth,
      },
    });
    expect(res.status).toBe(200);
    const spec = (await res.json()) as any;

    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toContain('Biddyapith');
    expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.InstitutionId).toBeDefined();

    // Verify key path endpoints exist in specification
    expect(spec.paths['/api/auth/login']).toBeDefined();
    expect(spec.paths['/api/onboarding/institutions']).toBeDefined();
    expect(spec.paths['/api/me']).toBeDefined();
    expect(spec.paths['/api/core/students']).toBeDefined();
    expect(spec.paths['/api/core/roles']).toBeDefined();
    expect(spec.paths['/api/attendance']).toBeDefined();
    expect(spec.paths['/api/notices']).toBeDefined();
    expect(spec.paths['/api/assignments']).toBeDefined();
    expect(spec.paths['/api/admissions']).toBeDefined();
    expect(spec.paths['/api/leads']).toBeDefined();
    expect(spec.paths['/api/attendance/employees']).toBeDefined();
  });
});

