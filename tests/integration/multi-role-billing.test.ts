import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootApp } from '../../src/app';
import { pool, ensureTenantRLS, withTenantContext } from '../../src/core/db';
import { syncModuleCatalog } from '../../src/core/registry/module-registry';
import { financeManifest } from '../../src/modules/finance/manifest';
import { noticesManifest } from '../../src/modules/notices/manifest';
import http from 'http';
import { randomUUID } from 'crypto';

describe('Integration Tests: Multi-Role Billing, Tasks & Scopes', () => {
  let server: http.Server;
  let baseUrl: string;

  let instId: string;
  let adminUserId: string;
  let adminToken: string;
  let teacherToken: string;
  let teacherMembershipId: string;
  let studentToken: string;
  let studentMembershipId: string;
  let studentId: string;
  let rand: string;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await ensureTenantRLS(client);
      await syncModuleCatalog(financeManifest, client);
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

    rand = randomUUID().substring(0, 8);

    // Onboard test institution
    const res = await fetch(`${baseUrl}/api/onboarding/institutions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Enterprise Academy ${rand}`,
        subdomain: `ent-academy-${rand}`,
        ownerEmail: `principal-${rand}@ent.com`,
        ownerName: 'Principal Rahman',
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    instId = body.institutionId;
    adminUserId = body.ownerUserId;
    adminToken = `mock-token-${adminUserId}`;

    // Create Teacher & Student memberships for multi-role testing
    await withTenantContext(pool, instId, async (tClient) => {
      // Get teacher role
      let { rows: tRoles } = await tClient.query(
        `select id from role where (institution_id = $1 or institution_id is null) and lower(name) = 'teacher' order by institution_id nulls last limit 1`,
        [instId]
      );
      if (!tRoles[0]?.id) {
        const { rows: createdRoles } = await tClient.query(
          `insert into role (institution_id, name, is_system) values ($1, 'Teacher', true) returning id`,
          [instId]
        );
        tRoles = createdRoles;
      }
      const teacherRoleId = tRoles[0]?.id;

      // Create Teacher user & membership
      const tUserId = randomUUID();
      await tClient.query(
        `insert into auth.users (id, email, raw_user_meta_data, aud, role)
         values ($1, $2, $3, 'authenticated', 'authenticated')`,
        [tUserId, `teacher-${rand}@ent.com`, JSON.stringify({ name: 'Dr. Anisur Teacher' })]
      );
      await tClient.query(
        `insert into profile (id, name, email) values ($1, $2, $3) on conflict (id) do update set name = excluded.name, email = excluded.email`,
        [tUserId, 'Dr. Anisur Teacher', `teacher-${rand}@ent.com`]
      );
      const { rows: tMemRows } = await tClient.query(
        `insert into membership (id, institution_id, user_id, role_id, status)
         values ($1, $2, $3, $4, 'active') returning id`,
        [randomUUID(), instId, tUserId, teacherRoleId]
      );
      teacherMembershipId = tMemRows[0].id;
      teacherToken = `mock-token-${tUserId}`;

      // Create Academic Year, Class & Section
      const ayId = randomUUID();
      await tClient.query(
        `insert into academic_year (id, institution_id, label, start_date, end_date, is_current)
         values ($1, $2, '2026', '2026-01-01', '2026-12-31', true)`,
        [ayId, instId]
      );

      const classId = randomUUID();
      await tClient.query(
        `insert into class (id, institution_id, academic_year_id, name) values ($1, $2, $3, 'Class 10')`,
        [classId, instId, ayId]
      );
      const sectionId = randomUUID();
      await tClient.query(
        `insert into section (id, institution_id, class_id, name) values ($1, $2, $3, 'A')`,
        [sectionId, instId, classId]
      );

      // Create Student
      studentId = randomUUID();
      await tClient.query(
        `insert into student (id, institution_id, name, admission_no, guardian_name, guardian_phone)
         values ($1, $2, 'Shakib Al Hasan Jr', $3, 'Al Hasan', '01711111111')`,
        [studentId, instId, `ADM-${rand}`]
      );

      // Student user & membership
      const sUserId = randomUUID();
      await tClient.query(
        `insert into auth.users (id, email, raw_user_meta_data, aud, role)
         values ($1, $2, $3, 'authenticated', 'authenticated')`,
        [sUserId, `student-${rand}@ent.com`, JSON.stringify({ name: 'Shakib Al Hasan Jr' })]
      );
      await tClient.query(
        `insert into profile (id, name, email) values ($1, $2, $3) on conflict (id) do update set name = excluded.name, email = excluded.email`,
        [sUserId, 'Shakib Al Hasan Jr', `student-${rand}@ent.com`]
      );
      const { rows: sRoles } = await tClient.query(
        `select id from role where institution_id = $1 and lower(name) = 'student'`,
        [instId]
      );
      const studentRoleId = sRoles[0]?.id;
      const { rows: sMemRows } = await tClient.query(
        `insert into membership (id, institution_id, user_id, role_id, status)
         values ($1, $2, $3, $4, 'active') returning id`,
        [randomUUID(), instId, sUserId, studentRoleId]
      );
      studentMembershipId = sMemRows[0].id;
      studentToken = `mock-token-${sUserId}`;
    });
  }, 35000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('allows Institution Admin to issue fee invoice and record payment with official receipt', async () => {
    // 1. Issue Invoice
    const createRes = await fetch(`${baseUrl}/api/finance/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institution-id': instId,
      },
      body: JSON.stringify({
        recipientType: 'student',
        studentId,
        category: 'Tuition Fee',
        title: 'October 2026 Tuition and Lab Charges',
        totalAmount: 4000,
        discountAmount: 500,
        dueDate: '2026-10-15',
        items: [
          { label: 'Monthly Tuition', amount: 3500 },
          { label: 'Science Laboratory', amount: 500 },
        ],
      }),
    });

    expect(createRes.status).toBe(201);
    const invoice = (await createRes.json()) as any;
    expect(invoice.id).toBeDefined();
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4,5}$/);
    expect(invoice.totalAmount).toBe(4000);
    expect(invoice.discountAmount).toBe(500);
    expect(invoice.dueAmount).toBe(3500);
    expect(invoice.status).toBe('pending');

    // 2. Record Payment against Invoice
    const payRes = await fetch(`${baseUrl}/api/finance/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institution-id': instId,
      },
      body: JSON.stringify({
        amount: 3500,
        method: 'bKash',
        transactionId: 'TRX-BKASH-998822',
        notes: 'Online mobile banking deposit',
      }),
    });

    expect(payRes.status).toBe(201);
    const payBody = (await payRes.json()) as any;
    expect(payBody.payment.receiptNumber).toMatch(/^RCP-\d{4}-\d{4,5}$/);
    expect(payBody.invoice.status).toBe('paid');
    expect(payBody.invoice.dueAmount).toBe(0);

    // 3. Fetch Official Printable Receipt
    const receiptRes = await fetch(`${baseUrl}/api/finance/receipts/${payBody.payment.id}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-institution-id': instId,
      },
    });

    expect(receiptRes.status).toBe(200);
    const receiptData = (await receiptRes.json()) as any;
    expect(receiptData.payment.receiptNumber).toBe(payBody.payment.receiptNumber);
    expect(receiptData.payment.method).toBe('bKash');
    expect(receiptData.invoice.id).toBe(invoice.id);
    expect(receiptData.institution.id).toBe(instId);
  });

  it('prevents Student from creating fee invoices (permission denial)', async () => {
    const res = await fetch(`${baseUrl}/api/finance/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-institution-id': instId,
      },
      body: JSON.stringify({
        recipientType: 'student',
        category: 'Tuition Fee',
        title: 'Unauthorized Invoice Attempt',
        totalAmount: 5000,
        dueDate: '2026-10-20',
      }),
    });

    expect(res.status).toBe(403);
  });

  it('allows Admin to configure EIIN Institute Code and Feature Limitations', async () => {
    const patchRes = await fetch(`${baseUrl}/api/core/institution/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institution-id': instId,
      },
      body: JSON.stringify({
        instituteCode: `EIIN-${rand}`,
        settings: {
          featureLimitations: {
            transport: { enabled: false },
            examinations: { enabled: true, allowedRoles: ['Teacher', 'Institution Admin'] },
          },
        },
      }),
    });

    expect(patchRes.status).toBe(200);
    const getRes = await fetch(`${baseUrl}/api/core/institution/settings`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-institution-id': instId,
      },
    });

    const getBody = (await getRes.json()) as any;
    expect(getBody.institution.instituteCode).toBe(`EIIN-${rand}`);
    expect(getBody.settings.featureLimitations.transport.enabled).toBe(false);
  });

  it('supports multi-assignee task distribution across staff members', async () => {
    const taskRes = await fetch(`${baseUrl}/api/core/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institution-id': instId,
      },
      body: JSON.stringify({
        assigneeMembershipIds: [teacherMembershipId],
        title: 'Verify Class 10 Midterm Paper Submissions',
        description: 'Complete marks entry and review re-check requests.',
        priority: 'urgent',
        dueDate: '2026-10-30',
      }),
    });

    expect(taskRes.status).toBe(201);
    const task = (await taskRes.json()) as any;
    expect(task.title).toBe('Verify Class 10 Midterm Paper Submissions');
    expect(task.assigneeMembershipId).toBe(teacherMembershipId);
  });
});
