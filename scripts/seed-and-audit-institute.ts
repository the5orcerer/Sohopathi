import { pool, withTenantContext } from '../src/core/db';
import { bootApp } from '../src/app';
import http from 'http';

interface StepResult {
  step: string;
  status: 'SUCCESS' | 'FAILED';
  statusCode?: number;
  durationMs: number;
  details?: any;
}

const auditLog: StepResult[] = [];

async function runStep<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  process.stdout.write(`⏳ [STEP] ${name}... `);
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    process.stdout.write(`✅ (${durationMs}ms)\n`);
    auditLog.push({ step: name, status: 'SUCCESS', durationMs });
    return result;
  } catch (err: any) {
    const durationMs = Date.now() - start;
    process.stdout.write(`❌ FAILED (${durationMs}ms): ${err.message}\n`);
    auditLog.push({ step: name, status: 'FAILED', durationMs, details: err.message });
    throw err;
  }
}

async function main() {
  console.log('========================================================================');
  console.log('🏛️ SOHOPATHI / BIDDYAPITH COMPLETE END-TO-END SIMULATION & SEEDING HARNESS');
  console.log('========================================================================\n');

  const client = await pool.connect();
  let server: http.Server;
  let baseUrl: string;

  try {
    // 0. Clean prior institution with subdomain 'ideal' if exists
    await runStep('Reset existing "ideal" tenant if exists', async () => {
      await client.query(`delete from institution where subdomain = 'ideal'`);
    });

    // 1. Boot Application on Ephemeral Port
    await runStep('Boot Express Application with all modules', async () => {
      const app = await bootApp();
      const { syncAllRegisteredModules } = await import('../src/core/registry/module-registry');
      await syncAllRegisteredModules(client);
      await new Promise<void>((resolve) => {
        server = app.listen(0, () => {
          const addr = server.address() as any;
          baseUrl = `http://localhost:${addr.port}`;
          resolve();
        });
      });
    });

    console.log(`🌐 Server running at: ${baseUrl}\n`);

    // Helper for authenticated fetch
    const apiCall = async (
      endpoint: string,
      options: {
        method?: string;
        token?: string;
        institutionId?: string;
        subdomain?: string;
        body?: any;
      } = {}
    ) => {
      const { method = 'GET', token, institutionId, subdomain, body } = options;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (institutionId) headers['x-institution-id'] = institutionId;
      if (subdomain) headers['x-institution-subdomain'] = subdomain;

      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      let json: any = null;
      const text = await res.text();
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }

      return { status: res.status, ok: res.ok, data: json };
    };

    // 2. Onboard Institution "Ideal Model Academy"
    const instData = await runStep('1. Onboard Institution "Ideal Model Academy"', async () => {
      const res = await apiCall('/api/auth/onboard', {
        method: 'POST',
        body: {
          name: 'Ideal Model Academy',
          subdomain: 'ideal',
          adminEmail: 'admin@ideal.edu.bd',
          adminName: 'Principal M. A. Rahman',
          adminUsername: 'admin',
        },
      });
      if (res.status !== 201) throw new Error(`Onboarding failed (${res.status}): ${JSON.stringify(res.data)}`);
      return res.data;
    });

    const institutionId = instData.institutionId;

    // Set default password for admin to password123
    await client.query(
      `update profile set password_hash = 'password123', must_change_password = false where id = $1`,
      [instData.ownerUserId]
    );

    // 3. Authenticate as Admin
    const adminAuth = await runStep('2. Login as Principal Admin (admin / password123)', async () => {
      const res = await apiCall('/api/auth/login', {
        method: 'POST',
        body: {
          institutionCode: 'ideal',
          username: 'admin',
          password: 'password123',
        },
      });
      if (res.status !== 200) throw new Error(`Admin login failed (${res.status}): ${JSON.stringify(res.data)}`);
      return res.data;
    });

    const adminToken = adminAuth.token;

    // 4. Update Official Institution Settings (EIIN, Contact, Seals)
    await runStep('3. Configure Institution Settings, EIIN & Official Signatures', async () => {
      const res = await apiCall('/api/core/institution/settings', {
        method: 'PATCH',
        token: adminToken,
        institutionId,
        body: {
          instituteCode: 'EIIN-109823',
          settings: {
            address: 'Road 4, Dhanmondi, Dhaka-1205, Bangladesh',
            contactEmail: 'info@ideal.edu.bd',
            contactPhone: '+880 1700-112233',
            website: 'https://ideal.edu.bd',
            currency: 'BDT',
            timezone: 'Asia/Dhaka',
            principalSignatureUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300',
            officialSealUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300',
            examControllerSignatureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
            featureLimitations: {
              examinations: { enabled: true },
              finance: { enabled: true },
              timetable: { enabled: true },
              assignments: { enabled: true },
              admissions: { enabled: true },
              attendance: { enabled: true },
              notices: { enabled: true },
              tasks: { enabled: true },
            },
          },
        },
      });
      if (res.status !== 200) throw new Error(`Settings update failed (${res.status}): ${JSON.stringify(res.data)}`);
    });

    // 5. Create Custom Roles & Configure Permissions
    const { controllerRoleId, deptHeadRoleId, teacherRoleId, staffRoleId } = await runStep(
      '4. Setup Custom Roles (Exam Controller, Department Head) & Permission Matrix',
      async () => {
        // List existing roles
        const rolesRes = await apiCall('/api/core/roles', { token: adminToken, institutionId });
        const existingRoles = rolesRes.data as any[];
        const teacherRole = existingRoles.find((r) => r.name.toLowerCase() === 'teacher');
        const staffRole = existingRoles.find((r) => r.name.toLowerCase() === 'staff');

        // Create Custom Role: Exam Controller
        const cRes = await apiCall('/api/core/roles', {
          method: 'POST',
          token: adminToken,
          institutionId,
          body: { name: 'Exam Controller' },
        });
        if (cRes.status !== 201) throw new Error(`Failed to create Exam Controller role: ${JSON.stringify(cRes.data)}`);
        const cRoleId = cRes.data.id;

        // Assign Exam Controller permissions
        await apiCall(`/api/core/roles/${cRoleId}/permissions`, {
          method: 'PUT',
          token: adminToken,
          institutionId,
          body: {
            permissions: [
              { permissionKey: 'exam.read', scope: 'institution' },
              { permissionKey: 'exam.create', scope: 'institution' },
              { permissionKey: 'exam.update', scope: 'institution' },
              { permissionKey: 'exam.delete', scope: 'institution' },
              { permissionKey: 'exam.room.manage', scope: 'institution' },
              { permissionKey: 'exam.candidate.manage', scope: 'institution' },
              { permissionKey: 'exam.marks.read', scope: 'institution' },
              { permissionKey: 'exam.marks.write', scope: 'institution' },
              { permissionKey: 'exam.publish', scope: 'institution' },
              { permissionKey: 'exam.result.reopen', scope: 'institution' },
              { permissionKey: 'schedules.read', scope: 'institution' },
              { permissionKey: 'students.read', scope: 'institution' },
            ],
          },
        });

        // Create Custom Role: Department Head
        const dhRes = await apiCall('/api/core/roles', {
          method: 'POST',
          token: adminToken,
          institutionId,
          body: { name: 'Department Head' },
        });
        const dhRoleId = dhRes.data.id;

        await apiCall(`/api/core/roles/${dhRoleId}/permissions`, {
          method: 'PUT',
          token: adminToken,
          institutionId,
          body: {
            permissions: [
              { permissionKey: 'classes.manage', scope: 'institution' },
              { permissionKey: 'sections.manage', scope: 'institution' },
              { permissionKey: 'subjects.manage', scope: 'institution' },
              { permissionKey: 'teachers.assign', scope: 'institution' },
              { permissionKey: 'schedules.manage', scope: 'institution' },
              { permissionKey: 'schedules.read', scope: 'institution' },
              { permissionKey: 'students.read', scope: 'institution' },
              { permissionKey: 'assignments.read', scope: 'institution' },
            ],
          },
        });

        return {
          controllerRoleId: cRoleId,
          deptHeadRoleId: dhRoleId,
          teacherRoleId: teacherRole?.id,
          staffRoleId: staffRole?.id,
        };
      }
    );

    // 6. Invite Faculty & Staff
    const members = await runStep('5. Invite Faculty & Staff Members', async () => {
      // 1. Exam Controller
      const fRes = await apiCall('/api/core/members/invite', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          name: 'Dr. Fatima Rahman',
          email: 'fatima@ideal.edu.bd',
          username: 'controller_fatima',
          roleId: controllerRoleId,
          temporaryPassword: 'password123',
        },
      });
      if (fRes.status !== 201) throw new Error(`Invite Fatima failed: ${JSON.stringify(fRes.data)}`);

      // 2. Senior Teacher
      const t1Res = await apiCall('/api/core/members/invite', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          name: 'Mr. Anwar Hossain',
          email: 'anwar@ideal.edu.bd',
          username: 'teacher_anwar',
          roleId: teacherRoleId,
          temporaryPassword: 'password123',
        },
      });
      if (t1Res.status !== 201) throw new Error(`Invite Anwar failed: ${JSON.stringify(t1Res.data)}`);

      // 3. Class Teacher
      const t2Res = await apiCall('/api/core/members/invite', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          name: 'Ms. Nasreen Sultana',
          email: 'nasreen@ideal.edu.bd',
          username: 'teacher_nasreen',
          roleId: teacherRoleId,
          temporaryPassword: 'password123',
        },
      });
      if (t2Res.status !== 201) throw new Error(`Invite Nasreen failed: ${JSON.stringify(t2Res.data)}`);

      // 4. Staff Accountant
      const aRes = await apiCall('/api/core/members/invite', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          name: 'Mr. Mahbub Alam',
          email: 'mahbub@ideal.edu.bd',
          username: 'staff_mahbub',
          roleId: staffRoleId,
          temporaryPassword: 'password123',
        },
      });
      if (aRes.status !== 201) throw new Error(`Invite Mahbub failed: ${JSON.stringify(aRes.data)}`);

      return {
        controller: fRes.data,
        teacherAnwar: t1Res.data,
        teacherNasreen: t2Res.data,
        accountant: aRes.data,
      };
    });

    // Ensure their password hashes are set to password123
    await client.query(
      `update profile set password_hash = 'password123', must_change_password = false
       where email in ('fatima@ideal.edu.bd', 'anwar@ideal.edu.bd', 'nasreen@ideal.edu.bd', 'mahbub@ideal.edu.bd')`
    );

    // 7. Provision Academic Hierarchy: Academic Year, Classes, Sections, Subjects
    const academic = await runStep('6. Provision Academic Structure & Subjects', async () => {
      // 1. Academic Year
      const ayRes = await apiCall('/api/core/academic-years', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          label: '2026 Academic Year',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          isCurrent: true,
        },
      });
      if (ayRes.status !== 201) throw new Error(`Create AY failed: ${JSON.stringify(ayRes.data)}`);
      const academicYearId = ayRes.data.id;

      // 2. Classes
      const c9Res = await apiCall('/api/core/classes', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: { academicYearId, name: 'Grade 9', sortOrder: 9 },
      });
      const c10Res = await apiCall('/api/core/classes', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: { academicYearId, name: 'Grade 10', sortOrder: 10 },
      });
      const classGrade10Id = c10Res.data.id;

      // 3. Sections for Grade 10
      const sARes = await apiCall('/api/core/sections', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: { classId: classGrade10Id, name: 'Section A - Science', capacity: 40 },
      });
      const sBRes = await apiCall('/api/core/sections', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: { classId: classGrade10Id, name: 'Section B - Commerce', capacity: 40 },
      });
      const sectionAId = sARes.data.id;

      // 4. Subjects
      const mathRes = await apiCall('/api/core/subjects', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: { name: 'Higher Mathematics', code: 'HM-101' },
      });
      const sciRes = await apiCall('/api/core/subjects', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: { name: 'General Science', code: 'GS-102' },
      });
      const phyRes = await apiCall('/api/core/subjects', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: { name: 'Physics', code: 'PHY-103' },
      });
      const engRes = await apiCall('/api/core/subjects', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: { name: 'English Literature', code: 'ENG-104' },
      });

      // 5. Assign Teachers to Subjects in Section A
      await apiCall('/api/core/teacher-assignments', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          sectionId: sectionAId,
          subjectId: mathRes.data.id,
          teacherMembershipId: members.teacherAnwar.id,
        },
      });
      await apiCall('/api/core/teacher-assignments', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          sectionId: sectionAId,
          subjectId: phyRes.data.id,
          teacherMembershipId: members.teacherAnwar.id,
        },
      });
      await apiCall('/api/core/teacher-assignments', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          sectionId: sectionAId,
          subjectId: sciRes.data.id,
          teacherMembershipId: members.teacherNasreen.id,
        },
      });
      await apiCall('/api/core/teacher-assignments', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          sectionId: sectionAId,
          subjectId: engRes.data.id,
          teacherMembershipId: members.teacherNasreen.id,
        },
      });

      return {
        academicYearId,
        classGrade10Id,
        sectionAId,
        mathSubjectId: mathRes.data.id,
        sciSubjectId: sciRes.data.id,
        phySubjectId: phyRes.data.id,
        engSubjectId: engRes.data.id,
      };
    });

    // 8. Timetable / Schedule Creation
    await runStep('7. Configure Weekly Timetable / Routine', async () => {
      // Monday Period 1: Higher Math (08:30 - 09:15)
      await apiCall('/api/core/schedules', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          sectionId: academic.sectionAId,
          subjectId: academic.mathSubjectId,
          teacherMembershipId: members.teacherAnwar.id,
          dayOfWeek: 'Monday',
          startTime: '08:30',
          endTime: '09:15',
          roomNo: 'Room 301',
        },
      });
      // Monday Period 2: General Science (09:15 - 10:00)
      await apiCall('/api/core/schedules', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          sectionId: academic.sectionAId,
          subjectId: academic.sciSubjectId,
          teacherMembershipId: members.teacherNasreen.id,
          dayOfWeek: 'Monday',
          startTime: '09:15',
          endTime: '10:00',
          roomNo: 'Room 301',
        },
      });
      // Tuesday Period 1: Physics (08:30 - 09:15)
      await apiCall('/api/core/schedules', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          sectionId: academic.sectionAId,
          subjectId: academic.phySubjectId,
          teacherMembershipId: members.teacherAnwar.id,
          dayOfWeek: 'Tuesday',
          startTime: '08:30',
          endTime: '09:15',
          roomNo: 'Physics Lab',
        },
      });
      // Wednesday Period 1: English (08:30 - 09:15)
      await apiCall('/api/core/schedules', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          sectionId: academic.sectionAId,
          subjectId: academic.engSubjectId,
          teacherMembershipId: members.teacherNasreen.id,
          dayOfWeek: 'Wednesday',
          startTime: '08:30',
          endTime: '09:15',
          roomNo: 'Room 301',
        },
      });
    });

    // 9. Student Enrollment & Admissions Pipeline
    const students = await runStep('8. Enroll Students & Process Admissions Pipeline', async () => {
      // 1. Direct Student 1: Sadman Sakib
      const s1Res = await apiCall('/api/core/students', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          name: 'Sadman Sakib',
          admissionNo: 'ADM-2026-001',
          rollNo: '101',
          gender: 'Male',
          dateOfBirth: '2010-04-15',
          classId: academic.classGrade10Id,
          sectionId: academic.sectionAId,
          guardianName: 'Md. Sakibul Islam',
          guardianPhone: '+880 1711-100001',
          guardianRelation: 'Father',
        },
      });
      if (s1Res.status !== 201) throw new Error(`Create student 1 failed: ${JSON.stringify(s1Res.data)}`);

      // 2. Direct Student 2: Farhana Haque
      const s2Res = await apiCall('/api/core/students', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          name: 'Farhana Haque',
          admissionNo: 'ADM-2026-002',
          rollNo: '102',
          gender: 'Female',
          dateOfBirth: '2010-08-22',
          classId: academic.classGrade10Id,
          sectionId: academic.sectionAId,
          guardianName: 'Mrs. Rokeya Haque',
          guardianPhone: '+880 1711-100002',
          guardianRelation: 'Mother',
        },
      });
      if (s2Res.status !== 201) throw new Error(`Create student 2 failed: ${JSON.stringify(s2Res.data)}`);

      // 3. Admissions Pipeline: Adiba Tahsin
      const appRes = await apiCall('/api/admissions', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          applicantName: 'Adiba Tahsin',
          guardianName: 'Kamal Tahsin',
          guardianPhone: '+880 1711-100003',
          guardianEmail: 'kamal@tahsin.net',
          classId: academic.classGrade10Id,
          academicYearId: academic.academicYearId,
          gender: 'Female',
          dateOfBirth: '2010-11-05',
          applicationFee: 500,
          feeStatus: 'paid',
        },
      });
      if (appRes.status !== 201) throw new Error(`Create admission app failed: ${JSON.stringify(appRes.data)}`);
      const applicationId = appRes.data.id;

      // Status update: under_review -> shortlisted
      await apiCall(`/api/admissions/${applicationId}`, {
        method: 'PATCH',
        token: adminToken,
        institutionId,
        body: { status: 'shortlisted' },
      });

      // Approve & Admit Student into Section A
      const admitRes = await apiCall(`/api/admissions/${applicationId}/admit`, {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          sectionId: academic.sectionAId,
          admissionNo: 'ADM-2026-003',
          rollNo: '103',
        },
      });
      if (admitRes.status !== 201) throw new Error(`Admit application failed: ${JSON.stringify(admitRes.data)}`);

      return {
        student1: s1Res.data,
        student2: s2Res.data,
        student3: admitRes.data.student,
      };
    });

    // Update students' password hashes to password123
    await client.query(
      `update profile set password_hash = 'password123', must_change_password = false
       where id in ($1, $2, $3)`,
      [students.student1.userId, students.student2.userId, students.student3.userId]
    );

    // 10. Attendance: Student Roll Call & Staff Daily Attendance
    await runStep('9. Conduct Student Roll Call & Employee Attendance', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Student Roll Call for Section A
      const attRes = await apiCall('/api/attendance', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          records: [
            {
              studentId: students.student1.id,
              sectionId: academic.sectionAId,
              date: today,
              status: 'present',
              remarks: 'On time',
            },
            {
              studentId: students.student2.id,
              sectionId: academic.sectionAId,
              date: today,
              status: 'present',
              remarks: 'On time',
            },
            {
              studentId: students.student3.id,
              sectionId: academic.sectionAId,
              date: today,
              status: 'absent',
              remarks: 'Sick leave',
              reason: 'Fever',
            },
          ],
        },
      });
      if (attRes.status !== 201) throw new Error(`Student attendance failed: ${JSON.stringify(attRes.data)}`);

      // Verify attendance summary
      const sumRes = await apiCall(`/api/attendance/summary?date=${today}`, {
        token: adminToken,
        institutionId,
      });
      if (sumRes.status !== 200) throw new Error(`Attendance summary failed: ${JSON.stringify(sumRes.data)}`);

      // Employee Attendance
      const empAttRes = await apiCall('/api/attendance/employees', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          records: [
            {
              membershipId: members.teacherAnwar.id,
              date: today,
              status: 'present',
              checkInTime: '08:15:00',
              notes: 'Morning shift',
            },
            {
              membershipId: members.teacherNasreen.id,
              date: today,
              status: 'present',
              checkInTime: '08:20:00',
              notes: 'Morning shift',
            },
            {
              membershipId: members.accountant.id,
              date: today,
              status: 'present',
              checkInTime: '08:00:00',
              notes: 'Accounts desk',
            },
            {
              membershipId: members.controller.id,
              date: today,
              status: 'present',
              checkInTime: '08:25:00',
              notes: 'Exam wing',
            },
          ],
        },
      });
      if (empAttRes.status !== 200) throw new Error(`Employee attendance failed: ${JSON.stringify(empAttRes.data)}`);
    });

    // 11. Assignments Lifecycle: Creation, Submission, and Grading
    await runStep('10. Execute Assignment Lifecycle (Create, Submit, Grade)', async () => {
      // 1. Teacher Anwar logs in
      const tLogin = await apiCall('/api/auth/login', {
        method: 'POST',
        body: {
          institutionCode: 'ideal',
          username: 'teacher_anwar',
          password: 'password123',
        },
      });
      if (tLogin.status !== 200) throw new Error(`Teacher login failed: ${JSON.stringify(tLogin.data)}`);
      const teacherToken = tLogin.data.token;

      // 2. Teacher creates Assignment
      const asgnRes = await apiCall('/api/assignments', {
        method: 'POST',
        token: teacherToken,
        institutionId,
        body: {
          sectionId: academic.sectionAId,
          subjectId: academic.mathSubjectId,
          title: 'Differential Calculus & Problem Set 1',
          description: 'Solve problems 1-15 from Chapter 4 and submit your step-by-step proofs.',
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          allowLateSubmissions: true,
          maxMarks: 20,
          status: 'published',
        },
      });
      if (asgnRes.status !== 201) throw new Error(`Create assignment failed: ${JSON.stringify(asgnRes.data)}`);
      const assignmentId = asgnRes.data.id;

      // 3. Student Sadman logs in
      const sLogin = await apiCall('/api/auth/login', {
        method: 'POST',
        body: {
          institutionCode: 'ideal',
          username: students.student1.username,
          password: 'password123',
        },
      });
      if (sLogin.status !== 200) throw new Error(`Student login failed: ${JSON.stringify(sLogin.data)}`);
      const studentToken = sLogin.data.token;

      // 4. Student views assignments
      const myAsgns = await apiCall('/api/assignments', {
        token: studentToken,
        institutionId,
      });
      if (myAsgns.status !== 200) throw new Error(`List assignments failed: ${JSON.stringify(myAsgns.data)}`);

      // 5. Student submits work
      const subRes = await apiCall(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        token: studentToken,
        institutionId,
        body: {
          submissionNotes: 'Completed all 15 calculus problems with detailed intermediate algebraic steps.',
        },
      });
      if (subRes.status !== 201 && subRes.status !== 200) {
        throw new Error(`Submit assignment failed (${subRes.status}): ${JSON.stringify(subRes.data)}`);
      }
      const submissionId = subRes.data.id;

      // 6. Teacher views submissions
      const listSubs = await apiCall(`/api/assignments/${assignmentId}/submissions`, {
        token: teacherToken,
        institutionId,
      });
      if (listSubs.status !== 200) throw new Error(`List submissions failed: ${JSON.stringify(listSubs.data)}`);

      // 7. Teacher grades submission
      const gradeRes = await apiCall('/api/assignments/grade', {
        method: 'POST',
        token: teacherToken,
        institutionId,
        body: {
          submissionId,
          marksObtained: 19,
          grade: 'A+',
          feedback: 'Exceptional clarity and rigor on proof #12.',
        },
      });
      if (gradeRes.status !== 200) throw new Error(`Grade submission failed: ${JSON.stringify(gradeRes.data)}`);
    });

    // 12. Examination Lifecycle: Creation, Papers, Rooms, Marks, and Publication
    await runStep('11. Execute Examination Lifecycle (Create, Papers, Marks, Publish)', async () => {
      // 1. Controller Fatima logs in
      const cLogin = await apiCall('/api/auth/login', {
        method: 'POST',
        body: {
          institutionCode: 'ideal',
          username: 'controller_fatima',
          password: 'password123',
        },
      });
      if (cLogin.status !== 200) throw new Error(`Controller login failed: ${JSON.stringify(cLogin.data)}`);
      const controllerToken = cLogin.data.token;

      // 2. Create Exam
      const examRes = await apiCall('/api/exams', {
        method: 'POST',
        token: controllerToken,
        institutionId,
        body: {
          academicYearId: academic.academicYearId,
          name: 'First Term Examination 2026',
          term: 'First Term',
          examType: 'term',
          startDate: '2026-04-10',
          endDate: '2026-04-20',
          classId: academic.classGrade10Id,
          sectionId: academic.sectionAId,
          gradingSystem: 'gpa5',
        },
      });
      if (examRes.status !== 201) throw new Error(`Create exam failed: ${JSON.stringify(examRes.data)}`);
      const examId = examRes.data.id;

      // 3. Add Exam Paper: Higher Mathematics
      const p1Res = await apiCall(`/api/exams/${examId}/papers`, {
        method: 'POST',
        token: controllerToken,
        institutionId,
        body: {
          subjectId: academic.mathSubjectId,
          teacherMembershipId: members.teacherAnwar.id,
          examDate: '2026-04-10',
          startTime: '10:00',
          endTime: '13:00',
          maxMarks: 100,
          passMarks: 33,
          theoryWeight: 70,
          practicalWeight: 20,
          vivaWeight: 10,
        },
      });
      if (p1Res.status !== 201) throw new Error(`Create paper 1 failed: ${JSON.stringify(p1Res.data)}`);

      // 4. Add Exam Paper: General Science
      const p2Res = await apiCall(`/api/exams/${examId}/papers`, {
        method: 'POST',
        token: controllerToken,
        institutionId,
        body: {
          subjectId: academic.sciSubjectId,
          teacherMembershipId: members.teacherNasreen.id,
          examDate: '2026-04-12',
          startTime: '10:00',
          endTime: '13:00',
          maxMarks: 100,
          passMarks: 33,
          theoryWeight: 80,
          practicalWeight: 20,
        },
      });
      if (p2Res.status !== 201) throw new Error(`Create paper 2 failed: ${JSON.stringify(p2Res.data)}`);

      // 5. Add Exam Room
      const roomRes = await apiCall(`/api/exams/${examId}/rooms`, {
        method: 'POST',
        token: controllerToken,
        institutionId,
        body: {
          roomNumber: 'Auditorium Hall 1',
          capacity: 50,
          guardMembershipIds: [members.teacherAnwar.id, members.teacherNasreen.id],
        },
      });
      if (roomRes.status !== 201) throw new Error(`Create exam room failed: ${JSON.stringify(roomRes.data)}`);

      // 6. Record Marks for Higher Math
      const marksRes = await apiCall('/api/exams/marks', {
        method: 'POST',
        token: controllerToken,
        institutionId,
        body: [
          {
            examId,
            studentId: students.student1.id,
            subjectId: academic.mathSubjectId,
            marksObtained: 92,
            maxMarks: 100,
            theoryMarks: 65,
            practicalMarks: 18,
            vivaMarks: 9,
            remarks: 'Grade A+ (GPA 5.0)',
          },
          {
            examId,
            studentId: students.student2.id,
            subjectId: academic.mathSubjectId,
            marksObtained: 85,
            maxMarks: 100,
            theoryMarks: 60,
            practicalMarks: 17,
            vivaMarks: 8,
            remarks: 'Grade A+ (GPA 5.0)',
          },
          {
            examId,
            studentId: students.student3.id,
            subjectId: academic.mathSubjectId,
            marksObtained: 78,
            maxMarks: 100,
            theoryMarks: 55,
            practicalMarks: 15,
            vivaMarks: 8,
            remarks: 'Grade A (GPA 4.0)',
          },
        ],
      });
      if (marksRes.status !== 200 && marksRes.status !== 201) {
        throw new Error(`Record marks failed (${marksRes.status}): ${JSON.stringify(marksRes.data)}`);
      }

      // 7. Publish Exam Results
      const pubRes = await apiCall(`/api/exams/${examId}/publish`, {
        method: 'POST',
        token: controllerToken,
        institutionId,
      });
      if (pubRes.status !== 200) throw new Error(`Publish exam failed: ${JSON.stringify(pubRes.data)}`);
    });

    // 13. Finance & Invoicing Lifecycle
    await runStep('12. Execute Finance Lifecycle (Create Invoice, Payment, Summary)', async () => {
      // 1. Create Invoice for Sadman Sakib
      const invRes = await apiCall('/api/finance/invoices', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          studentId: students.student1.id,
          title: 'Monthly Tuition & Science Lab Fee - April 2026',
          totalAmount: 3500,
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          items: [
            { description: 'Monthly Tuition Fee', amount: 2500 },
            { description: 'Science Lab & Practical Consumables', amount: 1000 },
          ],
        },
      });
      if (invRes.status !== 201) throw new Error(`Create invoice failed: ${JSON.stringify(invRes.data)}`);
      const invoiceId = invRes.data.id;

      // 2. Record Payment
      const payRes = await apiCall(`/api/finance/invoices/${invoiceId}/payments`, {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          amount: 3500,
          paymentMethod: 'cash',
          transactionRef: 'RCPT-2026-0041',
          notes: 'Full payment cleared at accounts counter',
        },
      });
      if (payRes.status !== 201) throw new Error(`Record payment failed: ${JSON.stringify(payRes.data)}`);

      // 3. Verify Finance Summary
      const finSum = await apiCall('/api/finance/summary', {
        token: adminToken,
        institutionId,
      });
      if (finSum.status !== 200) throw new Error(`Finance summary failed: ${JSON.stringify(finSum.data)}`);
      if (finSum.data.totalCollected < 3500) {
        throw new Error(`Expected totalCollected >= 3500, got ${finSum.data.totalCollected}`);
      }
    });

    // 14. Notices, Staff Tasks & Official Document Templates
    await runStep('13. Publish Notices, Assign Staff Tasks & Render Marksheet Template', async () => {
      // 1. Publish Notice
      const notRes = await apiCall('/api/notices', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          title: 'Annual Science Fair & Innovation Day 2026',
          body: 'All Grade 9 and Grade 10 students are invited to submit science projects by April 28, 2026.',
          audienceScope: 'all',
        },
      });
      if (notRes.status !== 201) throw new Error(`Publish notice failed: ${JSON.stringify(notRes.data)}`);
      const noticeId = notRes.data.id;

      // Student marks notice as read
      const sLogin = await apiCall('/api/auth/login', {
        method: 'POST',
        body: {
          institutionCode: 'ideal',
          username: students.student1.username,
          password: 'password123',
        },
      });
      await apiCall(`/api/notices/${noticeId}/read`, {
        method: 'POST',
        token: sLogin.data.token,
        institutionId,
      });

      // 2. Create Staff Task
      const taskRes = await apiCall('/api/core/tasks', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          title: 'Calibrate science lab apparatus for Term 1 practicals',
          description: 'Ensure all microscopes and chemical balances are inspected and cleaned.',
          assigneeMembershipId: members.teacherAnwar.id,
          priority: 'high',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        },
      });
      if (taskRes.status !== 201) throw new Error(`Create task failed: ${JSON.stringify(taskRes.data)}`);
      const taskId = taskRes.data.id;

      // Anwar completes task
      const tLogin = await apiCall('/api/auth/login', {
        method: 'POST',
        body: {
          institutionCode: 'ideal',
          username: 'teacher_anwar',
          password: 'password123',
        },
      });
      await apiCall(`/api/core/tasks/${taskId}`, {
        method: 'PATCH',
        token: tLogin.data.token,
        institutionId,
        body: { status: 'completed' },
      });

      // 3. Official Document Template Creation & Rendering
      const tmplRes = await apiCall('/api/core/templates', {
        method: 'POST',
        token: adminToken,
        institutionId,
        body: {
          name: 'Official Term Marksheet & Certificate',
          type: 'marksheet',
          content: `
            <div class="official-marksheet">
              <h2>{{institution.name}}</h2>
              <p>EIIN: {{institution.eiin}} | Address: {{institution.address}}</p>
              <h3>First Term Academic Transcript 2026</h3>
              <p>Student Name: <strong>{{student.name}}</strong> | Roll: <strong>{{student.rollNo}}</strong></p>
              <p>Grade / Class: <strong>{{student.className}}</strong> | Section: <strong>{{student.sectionName}}</strong></p>
              <div class="seal-container">
                <img src="{{institution.officialSeal}}" alt="Seal" />
              </div>
            </div>
          `,
          description: 'Official terminal transcript with mandatory security watermark',
        },
      });
      if (tmplRes.status !== 201) throw new Error(`Create template failed: ${JSON.stringify(tmplRes.data)}`);
      const templateId = tmplRes.data.id;

      const renderRes = await apiCall(`/api/core/templates/${templateId}/render`, {
        method: 'POST',
        token: adminToken,
        institutionId,
      });
      if (renderRes.status !== 200) throw new Error(`Render template failed: ${JSON.stringify(renderRes.data)}`);
      if (!renderRes.data.rendered.includes('biddyapith-footer-watermark')) {
        throw new Error('Anti-tamper footer watermark missing from rendered document!');
      }
    });

    // 15. Security, Scope & Authentication Boundary Verification
    await runStep('14. Security & Role Boundary Enforcement Audit', async () => {
      // 1. Student Token Privilege Escalation Tests
      const sLogin = await apiCall('/api/auth/login', {
        method: 'POST',
        body: {
          institutionCode: 'ideal',
          username: students.student1.username,
          password: 'password123',
        },
      });
      const studentToken = sLogin.data.token;

      // Student tries to create an Exam -> Expect 403
      const sExam = await apiCall('/api/exams', {
        method: 'POST',
        token: studentToken,
        institutionId,
        body: { name: 'Hacked Exam', academicYearId: academic.academicYearId },
      });
      if (sExam.status !== 403) throw new Error(`Expected 403 for student exam creation, got ${sExam.status}`);

      // Student tries to create an Invoice -> Expect 403
      const sInv = await apiCall('/api/finance/invoices', {
        method: 'POST',
        token: studentToken,
        institutionId,
        body: { studentId: students.student1.id, amount: 100, title: 'Hacked Fee' },
      });
      if (sInv.status !== 403) throw new Error(`Expected 403 for student invoice creation, got ${sInv.status}`);

      // Student tries to create an Assignment -> Expect 403
      const sAsgn = await apiCall('/api/assignments', {
        method: 'POST',
        token: studentToken,
        institutionId,
        body: { sectionId: academic.sectionAId, subjectId: academic.mathSubjectId, title: 'Fake Homework' },
      });
      if (sAsgn.status !== 403) throw new Error(`Expected 403 for student assignment creation, got ${sAsgn.status}`);

      // Student tries to take Attendance -> Expect 403
      const sAtt = await apiCall('/api/attendance', {
        method: 'POST',
        token: studentToken,
        institutionId,
        body: { records: [{ studentId: students.student1.id, sectionId: academic.sectionAId, date: '2026-04-01', status: 'present' }] },
      });
      if (sAtt.status !== 403) throw new Error(`Expected 403 for student attendance creation, got ${sAtt.status}`);

      // 2. Unauthenticated Call -> Expect 401
      const unauth = await apiCall('/api/core/students', { institutionId });
      if (unauth.status !== 401) throw new Error(`Expected 401 for unauthenticated student directory request, got ${unauth.status}`);

      // 3. Teacher Token Scope Test: Teacher tries to delete Member or create Fee Invoice -> Expect 403
      const tLogin = await apiCall('/api/auth/login', {
        method: 'POST',
        body: {
          institutionCode: 'ideal',
          username: 'teacher_anwar',
          password: 'password123',
        },
      });
      const tDelMember = await apiCall(`/api/core/members/${members.teacherNasreen.id}`, {
        method: 'DELETE',
        token: tLogin.data.token,
        institutionId,
      });
      if (tDelMember.status !== 403) throw new Error(`Expected 403 for teacher deleting member, got ${tDelMember.status}`);

      const tInv = await apiCall('/api/finance/invoices', {
        method: 'POST',
        token: tLogin.data.token,
        institutionId,
        body: { studentId: students.student1.id, totalAmount: 100, title: 'Unauthorized Fee' },
      });
      if (tInv.status !== 403) throw new Error(`Expected 403 for teacher creating invoice, got ${tInv.status}`);
    });

    // 16. Verify Logins for All Provisioned Personas
    await runStep('15. Verify Authentication & Session Retrieval for All User Personas', async () => {
      const personas = [
        { role: 'Institution Admin', username: 'admin', pass: 'password123' },
        { role: 'Exam Controller', username: 'controller_fatima', pass: 'password123' },
        { role: 'Senior Teacher', username: 'teacher_anwar', pass: 'password123' },
        { role: 'Class Teacher', username: 'teacher_nasreen', pass: 'password123' },
        { role: 'Staff Accountant', username: 'staff_mahbub', pass: 'password123' },
        { role: 'Student (Sadman)', username: students.student1.username, pass: 'password123' },
        { role: 'Student (Farhana)', username: students.student2.username, pass: 'password123' },
        { role: 'Student (Adiba)', username: students.student3.username, pass: 'password123' },
      ];

      for (const p of personas) {
        const loginRes = await apiCall('/api/auth/login', {
          method: 'POST',
          body: {
            institutionCode: 'ideal',
            username: p.username,
            password: p.pass,
          },
        });
        if (loginRes.status !== 200) {
          throw new Error(`Login failed for ${p.role} (${p.username}): ${JSON.stringify(loginRes.data)}`);
        }
        if (!loginRes.data.token || !loginRes.data.activeMembership) {
          throw new Error(`Malformed session payload for ${p.role}`);
        }
      }
    });

    console.log('\n========================================================================');
    console.log('🎉 ALL 15 LIFECYCLE & SECURITY SIMULATION STEPS COMPLETED WITH 100% SUCCESS');
    console.log('========================================================================\n');

    console.log('📋 CREATED ENTITIES & ACCESS CREDENTIALS:');
    console.log('------------------------------------------------------------------------');
    console.log(`Institution Name : Ideal Model Academy`);
    console.log(`Institution EIIN : EIIN-109823`);
    console.log(`Institution UUID : ${institutionId}`);
    console.log(`Subdomain        : ideal`);
    console.log(`Web Portal URL   : http://ideal.localhost:3000/login (or http://localhost:3000/login)`);
    console.log('------------------------------------------------------------------------');
    console.log('PERSONAS & PASSWORDS:');
    console.log(`- Principal Admin : Username: "admin"              | Password: "password123"`);
    console.log(`- Exam Controller : Username: "controller_fatima" | Password: "password123"`);
    console.log(`- Senior Teacher  : Username: "teacher_anwar"     | Password: "password123"`);
    console.log(`- Class Teacher   : Username: "teacher_nasreen"   | Password: "password123"`);
    console.log(`- Staff Accountant: Username: "staff_mahbub"      | Password: "password123"`);
    console.log(`- Student (Sadman): Username: "${students.student1.username}" | Password: "password123"`);
    console.log(`- Student (Farhana): Username: "${students.student2.username}" | Password: "password123"`);
    console.log(`- Student (Adiba) : Username: "${students.student3.username}" | Password: "password123"`);
    console.log('------------------------------------------------------------------------\n');
  } catch (err: any) {
    console.error('\n❌ SIMULATION RUN ENCOUNTERED AN ERROR:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    if (server!) {
      server.close();
    }
    await pool.end();
  }
}

main();
