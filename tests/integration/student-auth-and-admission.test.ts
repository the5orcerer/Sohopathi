import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootApp } from '../../src/app';
import http from 'http';
import { randomUUID } from 'crypto';

describe('Student Authentication, Provisioning & Admissions Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  let instId: string;
  let adminUserId: string;
  let adminToken: string;
  let classId: string;
  let sectionId: string;

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

    // 1. Onboard institution
    const res = await fetch(`${baseUrl}/api/onboarding/institutions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Admissions Test School ${rand}`,
        subdomain: `adm-school-${rand}`,
        ownerEmail: `admin-${rand}@admissions.com`,
        ownerName: 'Admin Admissions',
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    instId = body.institutionId;
    adminUserId = body.ownerUserId;
    adminToken = `mock-token-${adminUserId}`;

    // 2. Create Academic Year, Class and Section
    const ayRes = await fetch(`${baseUrl}/api/core/academic-years`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-institution-id': instId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        label: '2026 Academic Year',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isCurrent: true,
      }),
    });
    const ayData = (await ayRes.json()) as any;

    const classRes = await fetch(`${baseUrl}/api/core/classes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-institution-id': instId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        academicYearId: ayData.id,
        name: 'Grade 8',
        sortOrder: 8,
      }),
    });
    const classData = (await classRes.json()) as any;
    classId = classData.id;

    const secRes = await fetch(`${baseUrl}/api/core/sections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-institution-id': instId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        classId: classId,
        name: 'Section Alpha',
        capacity: 35,
      }),
    });
    const secData = (await secRes.json()) as any;
    sectionId = secData.id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('creates student via core API and auto-provisions student account with default changeme password and unique username', async () => {
    const studentRes = await fetch(`${baseUrl}/api/core/students`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-institution-id': instId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Nafis Iqbal',
        admissionNo: 'ADM-2026-901',
        dateOfBirth: '2011-05-12',
        gender: 'Male',
        classId,
        sectionId,
      }),
    });

    if (studentRes.status !== 201) {
      console.log('CREATE STUDENT ERROR:', await studentRes.text());
    }
    expect(studentRes.status).toBe(201);
    const studentData = (await studentRes.json()) as any;
    expect(studentData.name).toBe('Nafis Iqbal');
    expect(studentData.username).toBe('nafis.iqbal');

    // Attempt login with student username & default password changeme
    await new Promise((r) => setTimeout(r, 100));
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institutionCode: instId,
        username: studentData.username,
        password: 'changeme',
      }),
    });

    const loginData = (await loginRes.json()) as any;
    if (loginRes.status !== 200) {
      console.log('LOGIN RES ERROR:', loginData);
    }
    expect(loginRes.status).toBe(200);
    expect(loginData.user.name).toBe('Nafis Iqbal');
    expect(loginData.activeMembership.roleName).toBe('Student');
    expect(loginData.token).toBeDefined();

    // Verify student token has 'self' scope restrictions on listStudents
    const studentScopeRes = await fetch(`${baseUrl}/api/core/students`, {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'x-institution-id': instId,
      },
    });
    expect(studentScopeRes.status).toBe(200);
    const studentRoster = (await studentScopeRes.json()) as any[];
    // Should only see self!
    expect(studentRoster.length).toBe(1);
    expect(studentRoster[0].name).toBe('Nafis Iqbal');
  });

  it('manages admissions lifecycle: inquiry -> review -> admit & auto-provision student account', async () => {
    // 1. Create admission application
    const appRes = await fetch(`${baseUrl}/api/admissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-institution-id': instId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        applicantName: 'Samira Anjum',
        guardianName: 'Anjum Hossain',
        guardianPhone: '+8801711223344',
        guardianEmail: 'anjum@gmail.com',
        classId,
        applicationFee: 500,
        feeStatus: 'paid',
        notes: 'Top performer in previous school',
      }),
    });

    if (appRes.status !== 201) {
      console.log('APP CREATE ERROR:', await appRes.text());
    }
    expect(appRes.status).toBe(201);
    const appData = (await appRes.json()) as any;
    console.log('APP DATA CREATED:', appData);
    expect(appData.applicantName).toBe('Samira Anjum');
    expect(appData.status).toBe('submitted');
    expect(appData.applicationNo).toMatch(/^APP-/);

    // 2. Fetch admission stats
    const statsRes = await fetch(`${baseUrl}/api/admissions/stats`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-institution-id': instId,
      },
    });
    expect(statsRes.status).toBe(200);
    const stats = (await statsRes.json()) as any;
    console.log('STATS RETURNED:', stats);
    expect(stats.summary.total).toBeGreaterThanOrEqual(1);

    // 3. Update application status to shortlisted
    const updateRes = await fetch(`${baseUrl}/api/admissions/${appData.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-institution-id': instId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'shortlisted',
        notes: 'Interview passed successfully with 95% score',
      }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as any;
    expect(updated.status).toBe('shortlisted');

    // 4. Admit & auto-enroll student into Section Alpha
    const admitRes = await fetch(`${baseUrl}/api/admissions/${appData.id}/admit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-institution-id': instId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sectionId,
        rollNo: '01',
      }),
    });

    const admitData = (await admitRes.json()) as any;
    expect(admitRes.status).toBe(201);
    expect(admitData.student.name).toBe('Samira Anjum');
    expect(admitData.username).toBe('samira.anjum');
    expect(admitData.defaultPassword).toBe('changeme');
    expect(admitData.application.status).toBe('admitted');

    // 5. Verify the newly admitted student can immediately login
    await new Promise((r) => setTimeout(r, 200));
    const studentLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institutionCode: instId,
        username: admitData.username,
        password: 'changeme',
      }),
    });

    const studentSession = (await studentLoginRes.json()) as any;
    if (studentLoginRes.status !== 200) {
      console.log('ADMITTED STUDENT LOGIN ERROR:', studentSession, 'for username:', admitData.username);
    }
    expect(studentLoginRes.status).toBe(200);
    expect(studentSession.user.name).toBe('Samira Anjum');
    expect(studentSession.activeMembership.roleName).toBe('Student');
  });
});
