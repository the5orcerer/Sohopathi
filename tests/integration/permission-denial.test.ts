import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootApp } from '../../src/app';
import { pool, withTenantContext } from '../../src/core/db';
import http from 'http';
import { randomUUID } from 'crypto';

describe('Permission Denial and Scope Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  let instId: string;
  let teacherUserId: string;
  let teacherToken: string;

  let studentUserId: string;
  let studentToken: string;

  beforeAll(async () => {
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
        name: `Scope Academy ${rand}`,
        subdomain: `scope-academy-${rand}`,
        ownerEmail: `admin-${rand}@scope.com`,
        ownerName: 'Admin Scope',
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    instId = body.institutionId;

    teacherUserId = randomUUID();
    teacherToken = `mock-token-${teacherUserId}`;

    studentUserId = randomUUID();
    studentToken = `mock-token-${studentUserId}`;

    // Setup Teacher and Student roles & memberships in instId
    await withTenantContext(instId, async (client) => {
      // Get or create Teacher role ID
      let teacherRoleId: string;
      const { rows: tRoleRows } = await client.query(`select id from role where name = 'Teacher' and (institution_id = $1 or institution_id is null) order by institution_id nulls last limit 1`, [instId]);
      if (tRoleRows.length > 0) {
        teacherRoleId = tRoleRows[0].id;
      } else {
        const { rows } = await client.query(`insert into role (institution_id, name, is_system) values ($1, 'Teacher', false) returning id`, [instId]);
        teacherRoleId = rows[0].id;
      }

      // Get or create Student role ID
      let studentRoleId: string;
      const { rows: sRoleRows } = await client.query(`select id from role where name = 'Student' and (institution_id = $1 or institution_id is null) order by institution_id nulls last limit 1`, [instId]);
      if (sRoleRows.length > 0) {
        studentRoleId = sRoleRows[0].id;
      } else {
        const { rows } = await client.query(`insert into role (institution_id, name, is_system) values ($1, 'Student', false) returning id`, [instId]);
        studentRoleId = rows[0].id;
      }

      // Ensure auth.users and profile for Teacher
      await client.query(`insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing`, [teacherUserId, `teacher-${rand}@test.com`]);
      await client.query(`insert into profile (id, name) values ($1, 'Teacher Joe') on conflict (id) do nothing`, [teacherUserId]);
      await client.query(`insert into membership (user_id, institution_id, role_id, status) values ($1, $2, $3, 'active')`, [teacherUserId, instId, teacherRoleId]);

      // Ensure auth.users and profile for Student
      await client.query(`insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing`, [studentUserId, `student-${rand}@test.com`]);
      await client.query(`insert into profile (id, name) values ($1, 'Student Bob') on conflict (id) do nothing`, [studentUserId]);
      await client.query(`insert into membership (user_id, institution_id, role_id, status) values ($1, $2, $3, 'active')`, [studentUserId, instId, studentRoleId]);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects student attempting to create an institution notice with 403 missing permission', async () => {
    const res = await fetch(`${baseUrl}/api/notices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${studentToken}`,
        'x-institution-id': instId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Unauthorized Notice',
        body: 'Testing permission denial',
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('missing permission: notices.write');
  });

  it('rejects request with missing x-institution-id header with 400', async () => {
    const res = await fetch(`${baseUrl}/api/notices`, {
      headers: {
        'Authorization': `Bearer ${teacherToken}`,
      },
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('missing institution context');
  });
});
