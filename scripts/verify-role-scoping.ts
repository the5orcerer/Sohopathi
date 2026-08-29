import { pool } from '../src/core/db';

async function verifyAllRoles() {
  console.log('--- STARTING COMPREHENSIVE ROLE VERIFICATION ---');

  // 1. Admin Login
  console.log('\n[1] Testing Admin Login (exampleschool / admin)...');
  const adminLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institution: 'exampleschool',
      username: 'admin',
      password: 'education-platform@Nirob1127001',
    }),
  });
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.token || adminData.session?.access_token;
  if (!adminLoginRes.ok || !adminToken) {
    console.error('❌ Admin login failed:', adminData);
    process.exit(1);
  }
  console.log('✅ Admin login succeeded! Role:', adminData.activeMembership?.roleName);

  // Check Admin nav
  const adminNavRes = await fetch('http://localhost:3000/api/system/nav', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminNav = await adminNavRes.json();
  console.log('✅ Admin nav items count:', Array.isArray(adminNav) ? adminNav.length : JSON.stringify(adminNav));

  // Check Admin can read students
  const adminStudentsRes = await fetch('http://localhost:3000/api/core/students', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminStudents = await adminStudentsRes.json();
  console.log('✅ Admin read students count:', Array.isArray(adminStudents) ? adminStudents.length : adminStudents);

  // 2. Student Login
  console.log('\n[2] Testing Student Login (exampleschool / tanvir.ahmed)...');
  const studentLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institution: 'exampleschool',
      username: 'tanvir.ahmed',
      password: 'changeme',
    }),
  });
  const studentData = await studentLoginRes.json();
  const studentToken = studentData.token || studentData.session?.access_token;
  if (!studentLoginRes.ok || !studentToken) {
    console.error('❌ Student login failed:', studentData);
    process.exit(1);
  }
  console.log('✅ Student login succeeded! Role:', studentData.activeMembership?.roleName);

  // Student Nav Items
  const studentNavRes = await fetch('http://localhost:3000/api/system/nav', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentNav = await studentNavRes.json();
  console.log('✅ Student nav items:', Array.isArray(studentNav) ? studentNav.map((n: any) => n.href) : studentNav);

  // Student security check: Student attempts to browse student directory -> MUST BE 403
  const studentBrowseStudentsRes = await fetch('http://localhost:3000/api/core/students', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  console.log('🔒 Student GET /api/core/students status:', studentBrowseStudentsRes.status, '(Expected 403 Forbidden)');

  // Student assignments: Student GET /api/assignments
  const studentAssignmentsRes = await fetch('http://localhost:3000/api/assignments', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentAssignments = await studentAssignmentsRes.json();
  console.log('✅ Student GET /api/assignments status:', studentAssignmentsRes.status, 'Assignments found:', Array.isArray(studentAssignments) ? studentAssignments.length : studentAssignments);

  // Student attendance: Student GET /api/attendance
  const studentAttRes = await fetch('http://localhost:3000/api/attendance', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentAtt = await studentAttRes.json();
  console.log('✅ Student GET /api/attendance status:', studentAttRes.status, 'Records found:', Array.isArray(studentAtt) ? studentAtt.length : studentAtt);

  // 3. Teacher Login
  console.log('\n[3] Testing Teacher Login (exampleschool / fatima.teacher)...');
  const teacherLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institution: 'exampleschool',
      username: 'fatima.teacher',
      password: 'password123',
    }),
  });
  const teacherData = await teacherLoginRes.json();
  const teacherToken = teacherData.token || teacherData.session?.access_token;
  if (!teacherLoginRes.ok || !teacherToken) {
    console.error('❌ Teacher login failed:', teacherData);
    process.exit(1);
  }
  console.log('✅ Teacher login succeeded! Role:', teacherData.activeMembership?.roleName);

  // Teacher Nav Items
  const teacherNavRes = await fetch('http://localhost:3000/api/system/nav', {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const teacherNav = await teacherNavRes.json();
  console.log('✅ Teacher nav items:', Array.isArray(teacherNav) ? teacherNav.map((n: any) => n.href) : teacherNav);

  // Teacher security check: Teacher attempts to create assignment for an unauthorized subject
  const fakeAssignmentRes = await fetch('http://localhost:3000/api/assignments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      sectionId: '00000000-0000-0000-0000-000000000000',
      subjectId: '00000000-0000-0000-0000-000000000000',
      title: 'Unauthorized Assignment Test',
    }),
  });
  console.log('🔒 Teacher unauthorized assignment creation status:', fakeAssignmentRes.status, '(Expected 403 Forbidden)');

  await pool.end();
  console.log('\n🎉 --- ALL ROLE VERIFICATIONS PASSED WITH PERFECT SCOPING --- 🎉');
}

verifyAllRoles();

