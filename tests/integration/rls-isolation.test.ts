import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootApp } from '../../src/app';
import { pool, withTenantContext } from '../../src/core/db';
import http from 'http';
import { randomUUID } from 'crypto';

describe('Cross-Tenant RLS Isolation Test', () => {
  let server: http.Server;
  let baseUrl: string;

  let instAId: string;
  let ownerAId: string;

  let instBId: string;
  let ownerBId: string;

  beforeAll(async () => {
    const app = await bootApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    const randA = randomUUID().substring(0, 8);
    const randB = randomUUID().substring(0, 8);

    // 1. Onboard Institution A
    const resA = await fetch(`${baseUrl}/api/onboarding/institutions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Academy A ${randA}`,
        subdomain: `academy-a-${randA}`,
        ownerEmail: `admin-${randA}@academy-a.com`,
        ownerName: 'Admin A',
      }),
    });
    const bodyA = (await resA.json()) as any;
    if (resA.status !== 201) {
      console.error('Onboarding A failed:', bodyA);
    }
    expect(resA.status).toBe(201);
    instAId = bodyA.institutionId;
    ownerAId = bodyA.ownerUserId;

    // 2. Onboard Institution B
    const resB = await fetch(`${baseUrl}/api/onboarding/institutions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Academy B ${randB}`,
        subdomain: `academy-b-${randB}`,
        ownerEmail: `admin-${randB}@academy-b.com`,
        ownerName: 'Admin B',
      }),
    });
    const bodyB = (await resB.json()) as any;
    if (resB.status !== 201) {
      console.error('Onboarding B failed:', bodyB);
    }
    expect(resB.status).toBe(201);
    instBId = bodyB.institutionId;
    ownerBId = bodyB.ownerUserId;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('provisions two distinct institutions (A and B)', () => {
    expect(instAId).toBeDefined();
    expect(instBId).toBeDefined();
    expect(instAId).not.toBe(instBId);
  });

  it('creates student record in A, and asserts zero rows returned when running query under B tenant context', async () => {
    // Insert student in Institution A
    let studentAId: string = '';
    await withTenantContext(instAId, async (client) => {
      const { rows } = await client.query(
        `insert into student (institution_id, admission_no, name)
         values ($1, 'ADM-A-001', 'Alice A')
         returning id`,
        [instAId]
      );
      studentAId = rows[0].id;
    });
    expect(studentAId).toBeTruthy();

    // Query student table under Institution B tenant context
    await withTenantContext(instBId, async (client) => {
      const { rows } = await client.query(`select * from student where admission_no = 'ADM-A-001'`);
      expect(rows.length).toBe(0);

      const { rows: allStudents } = await client.query(`select * from student`);
      const foundA = allStudents.find((s) => s.id === studentAId);
      expect(foundA).toBeUndefined();
    });
  });

  it('attempts a direct cross-tenant update and delete and asserts 0 rows modified', async () => {
    // Insert student in Institution A
    let studentAId: string = '';
    await withTenantContext(instAId, async (client) => {
      const { rows } = await client.query(
        `insert into student (institution_id, admission_no, name)
         values ($1, 'ADM-A-002', 'Bob A')
         returning id`,
        [instAId]
      );
      studentAId = rows[0].id;
    });

    // Attempt to update Bob A while running under Institution B context
    await withTenantContext(instBId, async (client) => {
      const updateRes = await client.query(
        `update student set name = 'Hacked Name' where id = $1`,
        [studentAId]
      );
      expect(updateRes.rowCount).toBe(0);

      const deleteRes = await client.query(
        `delete from student where id = $1`,
        [studentAId]
      );
      expect(deleteRes.rowCount).toBe(0);
    });

    // Verify Bob A's name is unchanged in Institution A context
    await withTenantContext(instAId, async (client) => {
      const { rows } = await client.query(`select name from student where id = $1`, [studentAId]);
      expect(rows[0].name).toBe('Bob A');
    });
  });
});
