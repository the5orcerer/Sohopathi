import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootApp } from '../../src/app';
import { pool, withTenantContext, ensureTenantRLS } from '../../src/core/db';
import { syncModuleCatalog } from '../../src/core/registry/module-registry';
import { noticesManifest } from '../../src/modules/notices/manifest';
import http from 'http';
import { randomUUID } from 'crypto';

describe('Module Disable Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  let instId: string;
  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await ensureTenantRLS(client);
      await syncModuleCatalog(noticesManifest, client);
    } finally {
      client.release();
    }

    const app = await bootApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    const rand = randomUUID().substring(0, 8);

    // Onboard institution
    const res = await fetch(`${baseUrl}/api/onboarding/institutions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Disable Test School ${rand}`,
        subdomain: `disable-school-${rand}`,
        ownerEmail: `admin-${rand}@disable.com`,
        ownerName: 'Admin Disable',
      }),
    });
    const body = (await res.json()) as any;
    instId = body.institutionId;
    adminUserId = body.ownerUserId;
    adminToken = `mock-token-${adminUserId}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('disabling notices module removes notices permissions from resolveContext and blocks notices routes', async () => {
    // 1. Verify notices routes work while enabled
    const resBefore = await fetch(`${baseUrl}/api/notices`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-institution-id': instId,
      },
    });
    expect(resBefore.status).toBe(200);

    // 2. Disable notices module in DB
    await withTenantContext(instId, async (client) => {
      await client.query(
        `update institution_module
         set enabled = false
         where institution_id = $1
           and module_id = (select id from module where key = 'notices')`,
        [instId]
      );
    });

    // 3. Request notices route again -> resolveContext filters out disabled module's permissions -> returns 403 missing permission
    const resAfter = await fetch(`${baseUrl}/api/notices`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-institution-id': instId,
      },
    });
    expect(resAfter.status).toBe(403);
    const bodyAfter = await resAfter.json();
    expect(bodyAfter.error).toContain('missing permission: notices.read');
  });
});
