import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootApp } from '../../src/app';
import { pool, withTenantContext } from '../../src/core/db';
import http from 'http';
import { randomUUID } from 'crypto';

describe('Institution Onboarding Flow', () => {
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

  it('POST /api/onboarding/institutions provisions tenant, modules, roles, and owner membership', async () => {
    const rand = randomUUID().substring(0, 8);
    const res = await fetch(`${baseUrl}/api/onboarding/institutions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `St Jude High School ${rand}`,
        subdomain: `stjude-${rand}`,
        ownerEmail: `principal-${rand}@stjude.edu`,
        ownerName: 'Principal Skinner',
      }),
    });

    const body = (await res.json()) as any;
    if (res.status !== 201) {
      console.log('ONBOARDING TEST ERROR DETAIL:', body);
    }
    expect(res.status).toBe(201);
    expect(body.institutionId).toBeDefined();
    expect(body.ownerMembershipId).toBeDefined();
    expect(body.ownerUserId).toBeDefined();

    const instId = body.institutionId;

    // Verify tenant data inside Postgres
    await withTenantContext(instId, async (client) => {
      // 1. Verify institution record
      const { rows: instRows } = await client.query(`select * from institution where id = $1`, [instId]);
      expect(instRows.length).toBe(1);
      expect(instRows[0].name).toBe(`St Jude High School ${rand}`);

      // 2. Verify enabled modules
      const { rows: modRows } = await client.query(`select * from institution_module where institution_id = $1 and enabled = true`, [instId]);
      expect(modRows.length).toBeGreaterThanOrEqual(6);

      // 3. Verify copied roles
      const { rows: roleRows } = await client.query(`select * from role where institution_id = $1`, [instId]);
      expect(roleRows.length).toBeGreaterThanOrEqual(4);

      // 4. Verify owner membership
      const { rows: memberRows } = await client.query(`select * from membership where id = $1`, [body.ownerMembershipId]);
      expect(memberRows.length).toBe(1);
      expect(memberRows[0].institution_id).toBe(instId);
    });

    // Verify GET /api/me works for the new owner
    const token = `mock-token-${body.ownerUserId}`;
    const meRes = await fetch(`${baseUrl}/api/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-institution-id': instId,
      },
    });

    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as any;
    expect(meBody.user.name).toBe('Principal Skinner');
    expect(meBody.membership.institutionId).toBe(instId);
    expect(meBody.permissions.length).toBeGreaterThan(0);
  });
});
