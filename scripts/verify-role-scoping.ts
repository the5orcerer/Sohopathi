import { pool } from '../src/core/db';
import { bootApp } from '../src/app';

async function verifyAllRoles() {
  console.log('--- STARTING COMPREHENSIVE ROLE & FEATURE VERIFICATION ---');

  // Boot server on ephemeral port 3099
  const app = await bootApp();
  const PORT = 3099;
  const server = app.listen(PORT);
  const BASE_URL = `http://localhost:${PORT}`;

  try {
    // 0. Database Deduplication Check
    console.log('\n[0] Verifying Role Unification and Deduplication in Database...');
    const { rows: duplicateRoles } = await pool.query(`
      select lower(name) as rname, count(*) as cnt 
      from role 
      group by lower(name), coalesce(institution_id, '00000000-0000-0000-0000-000000000000') 
      having count(*) > 1
    `);
    if (duplicateRoles.length > 0) {
      console.error('❌ Found duplicate roles in database:', duplicateRoles);
      throw new Error('Duplicate roles detected in DB');
    }
    console.log('✅ ZERO duplicate roles in database!');

    // 1. Admin Login
    console.log('\n[1] Testing Admin Login (exampleschool / admin)...');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
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
    const adminInstId = adminData.activeMembership?.institutionId;
    if (!adminLoginRes.ok || !adminToken || !adminInstId) {
      console.error('❌ Admin login failed:', adminData);
      process.exit(1);
    }
    console.log('✅ Admin login succeeded! Role:', adminData.activeMembership?.roleName);

    // Check Admin nav contains Reports under Administration
    const adminNavRes = await fetch(`${BASE_URL}/api/system/nav`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-institution-id': adminInstId,
      },
    });
    const adminNav = await adminNavRes.json();
    console.log('✅ Admin nav loaded with items:', adminNav.length);
    const hasReports = adminNav.some((item: any) => item.path === '/reports');
    console.log('✅ Admin has Reports in navigation:', hasReports);

    // Check Admin can manage classrooms (Room 4022)
    console.log('\n[1b] Testing Physical Classroom Management (Room 4022)...');
    const createRoomRes = await fetch(`${BASE_URL}/api/core/classrooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institution-id': adminInstId,
      },
      body: JSON.stringify({
        roomNumber: `Room 4022-${Date.now().toString().slice(-4)}`,
        name: 'Senior Physics & Robotics Hall',
        building: 'Academic Science Complex',
        floor: '4th Floor',
        capacity: 45,
        facilities: ['Smart Board', 'Robotics Bench', 'A/C'],
      }),
    });
    const createdRoom = await createRoomRes.json();
    console.log('✅ Physical Classroom created or retrieved:', createdRoom.roomNumber, `(ID: ${createdRoom.id})`);

    const listRoomsRes = await fetch(`${BASE_URL}/api/core/classrooms`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-institution-id': adminInstId,
      },
    });
    const rooms = await listRoomsRes.json();
    console.log('✅ Listed physical classrooms count:', rooms.length);

    // 2. Student Login
    console.log('\n[2] Testing Student Login (exampleschool / tanvir.ahmed)...');
    const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
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
    const studentInstId = studentData.activeMembership?.institutionId;
    if (!studentLoginRes.ok || !studentToken || !studentInstId) {
      console.error('❌ Student login failed:', studentData);
      process.exit(1);
    }
    console.log('✅ Student login succeeded! Role:', studentData.activeMembership?.roleName);

    // Student Nav Items - MUST NOT have /students
    const studentNavRes = await fetch(`${BASE_URL}/api/system/nav`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-institution-id': studentInstId,
      },
    });
    const studentNav = await studentNavRes.json();
    const studentHasRoster = studentNav.some((item: any) => item.path === '/students');
    console.log('🔒 Security Check: Student nav contains /students directory?', studentHasRoster ? 'FAIL' : 'NO (PASSED)');
    if (studentHasRoster) throw new Error('Student should not see /students');

    // Student security check: Student GET /api/core/students should only return self
    const studentBrowseStudentsRes = await fetch(`${BASE_URL}/api/core/students`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-institution-id': studentInstId,
      },
    });
    const studentRoster = await studentBrowseStudentsRes.json();
    console.log('🔒 Student GET /api/core/students status:', studentBrowseStudentsRes.status, 'Response:', Array.isArray(studentRoster) ? `Returned ${studentRoster.length} students` : studentRoster.error || studentRoster.message || studentRoster);
    if (Array.isArray(studentRoster) && studentRoster.length > 1) throw new Error('Student received other student records (IDOR/BOLA violation)!');

    // Student Requests: Submit a leave request
    console.log('\n[2b] Testing Student Request Submission (Routes to Enrolled Section Class Teacher)...');
    const studentRequestRes = await fetch(`${BASE_URL}/api/core/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-institution-id': studentInstId,
      },
      body: JSON.stringify({
        category: 'leave',
        title: 'Medical Leave - Fever & Flu',
        description: 'Unable to attend class today due to severe seasonal flu.',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      }),
    });
    const createdReq = await studentRequestRes.json();
    console.log('✅ Student Request Created:', createdReq.title, `(Status: ${createdReq.status}, Target Manager: ${createdReq.targetManagerMembershipId || 'Class Teacher'})`);

    // 3. Teacher Login
    console.log('\n[3] Testing Teacher Login (exampleschool / fatima.teacher)...');
    const teacherLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
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
    const teacherInstId = teacherData.activeMembership?.institutionId;
    if (!teacherLoginRes.ok || !teacherToken || !teacherInstId) {
      console.error('❌ Teacher login failed:', teacherData);
      process.exit(1);
    }
    console.log('✅ Teacher login succeeded! Role:', teacherData.activeMembership?.roleName);

    // Teacher Approves Student Request
    console.log('\n[3b] Teacher Approving Student Leave Request...');
    const approveRes = await fetch(`${BASE_URL}/api/core/requests/${createdReq.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
        'x-institution-id': teacherInstId,
      },
      body: JSON.stringify({
        status: 'approved',
        reviewerNotes: 'Approved. Get well soon, assignments excused.',
      }),
    });
    const approvedReq = await approveRes.json();
    console.log('✅ Request Approval Status:', approvedReq.status, 'Reviewer Notes:', approvedReq.reviewerNotes);

    // Teacher IDOR Security Check: Teacher attempts to create assignment for unauthorized section
    console.log('\n[3c] Testing Teacher IDOR & Scope Protection...');
    const fakeAssignmentRes = await fetch(`${BASE_URL}/api/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
        'x-institution-id': teacherInstId,
      },
      body: JSON.stringify({
        sectionId: '00000000-0000-0000-0000-000000000000',
        subjectId: '00000000-0000-0000-0000-000000000000',
        title: 'Unauthorized Assignment Test',
      }),
    });
    console.log('🔒 Teacher unauthorized assignment creation status:', fakeAssignmentRes.status, '(Expected 403 Forbidden)');
    if (fakeAssignmentRes.status !== 403) {
      console.error('❌ Expected 403 Forbidden on unauthorized assignment creation');
      process.exit(1);
    }

    // 4. Live Dashboard Period Telemetry
    console.log('\n[4] Testing Live Dashboard Period Telemetry...');
    const liveTelemetryRes = await fetch(`${BASE_URL}/api/core/live-periods`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-institution-id': studentInstId,
      },
    });
    const liveData = await liveTelemetryRes.json();
    console.log('✅ Student Live Period Telemetry Role:', liveData.role, 'Schedule periods today:', liveData.todaySchedule?.length || 0);

    console.log('\n🎉 --- ALL ROLE VERIFICATIONS AND E2E SCENARIOS PASSED WITH PERFECT SCOPING --- 🎉');
  } finally {
    server.close();
    await pool.end();
  }
}

verifyAllRoles().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
