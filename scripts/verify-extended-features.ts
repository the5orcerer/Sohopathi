import { pool } from '../src/core/db';
import { dispatchNotificationAndTask } from '../src/modules/core/notification-task-service';
import { attendanceRepository } from '../src/modules/attendance/repository';
import { assignmentRepository } from '../src/modules/assignments/repository';
import { coreRepository } from '../src/modules/core/repository';

async function verifyAll() {
  const client = await pool.connect();

  console.log('\n======================================================');
  console.log('🚀 STARTING SOHOPATHI EXTENDED SYSTEM VERIFICATION');
  console.log('======================================================\n');

  try {
    // 1. Fetch default institution
    const { rows: instRows } = await client.query(`SELECT id, name FROM institution LIMIT 1`);
    if (instRows.length === 0) throw new Error('No institution found in database');
    const institutionId = instRows[0].id;
    console.log(`[1] Active Institution: "${instRows[0].name}" (${institutionId})`);

    // 2. Fetch academic year, class, section, teacher, student
    const { rows: ayRows } = await client.query(
      `SELECT id FROM academic_year WHERE institution_id = $1 LIMIT 1`,
      [institutionId]
    );
    const academicYearId = ayRows[0]?.id;

    const { rows: secRows } = await client.query(
      `SELECT s.id as section_id, s.class_id, c.name as class_name, s.name as section_name 
       FROM section s JOIN class c ON c.id = s.class_id 
       WHERE s.institution_id = $1 LIMIT 1`,
      [institutionId]
    );
    const section = secRows[0];

    const { rows: memberRows } = await client.query(
      `SELECT m.id as membership_id, m.user_id, coalesce(p.name, 'Staff') as name, r.name as role_name 
       FROM membership m 
       LEFT JOIN profile p ON p.id = m.user_id 
       JOIN role r ON r.id = m.role_id 
       WHERE m.institution_id = $1 AND m.status = 'active'`,
      [institutionId]
    );
    const admin = memberRows.find((m) => m.role_name === 'admin') || memberRows[0];
    const teacher = memberRows.find((m) => m.role_name === 'teacher') || memberRows[0];
    const studentMember = memberRows.find((m) => m.role_name === 'student' || m.role_name === 'guardian') || memberRows[0];

    console.log(`[2] Found Test Actors:`);
    console.log(`    - Admin: ${admin.name} (Membership: ${admin.membership_id})`);
    console.log(`    - Teacher: ${teacher.name} (Membership: ${teacher.membership_id})`);
    console.log(`    - Student: ${studentMember.name} (Membership: ${studentMember.membership_id})`);

    // 3. Test Institution Settings: Sensitive Signatures & Official Assets
    console.log(`\n[3] Testing Institution Settings: Official Document Signatures & Seal...`);
    await coreRepository.updateInstitutionSettings(
      client,
      institutionId,
      {
        settings: {
          principalSignatureUrl: 'https://biddyapith.org/assets/signatures/principal.png',
          officialSealUrl: 'https://biddyapith.org/assets/seals/official_seal.png',
          examControllerSignatureUrl: 'https://biddyapith.org/assets/signatures/exam_controller.png',
          institutionAffiliationNo: 'AFF-BISE-DHAKA-2026-904',
        },
      },
      admin.membership_id
    );
    const instData = await coreRepository.getInstitutionSettings(client, institutionId);
    if (instData.settings?.principalSignatureUrl !== 'https://biddyapith.org/assets/signatures/principal.png') {
      throw new Error('Official signatures verification failed');
    }
    console.log('    ✓ Official signatures & seal saved and secured in institution settings.');

    // 4. Test Template Engine with Mandatory Biddyapith Footer Watermark
    console.log(`\n[4] Testing Template Rendering with Watermark & Signatures...`);
    const tmpl = await coreRepository.createTemplate(client, institutionId, {
      name: 'Official Term Report',
      type: 'marksheet',
      content: '<h1>Report Card for {{student.name}}</h1><p>Seal: {{institution.officialSeal}}</p>',
      description: 'Test template',
    });
    const renderedResult = await coreRepository.renderTemplate(
      client,
      institutionId,
      tmpl.id
    );
    if (!renderedResult.rendered.includes('biddyapith-footer-watermark')) {
      throw new Error('Biddyapith footer watermark missing from rendered template');
    }
    if (!renderedResult.rendered.includes('https://biddyapith.org/assets/seals/official_seal.png')) {
      throw new Error('Official seal not injected into template');
    }
    console.log('    ✓ Template rendered with official seal and permanent Biddyapith footer watermark.');
    await coreRepository.deleteTemplate(client, institutionId, tmpl.id);

    // 5. Test Examinations: Class Test vs Term Exam Creation & Room Seating Allocation
    console.log(`\n[5] Testing Examination Architecture: Class Test & Term Exam...`);
    // Create Class Test
    const classTest = await attendanceRepository.createExam(client, institutionId, {
      academicYearId,
      name: 'Class 9B Bangla 1st Paper Assessment',
      term: 'Class Test 1',
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      examType: 'class_test',
      classId: section.class_id,
      sectionId: section.section_id,
      syllabusRemarks: 'Chapters 1 to 5 - Poetry and Comprehension',
      examControllerMembershipId: admin.membership_id,
    });
    console.log(`    ✓ Created Class Test: "${classTest.name}" (Type: ${classTest.examType})`);

    // Create Room Seating Assignments
    console.log(`    - Allocating examination halls and seat ranges...`);
    await attendanceRepository.createExamRoom(client, institutionId, {
      examId: classTest.id,
      roomNumber: 'Room 704 (Academic Building 3F)',
      startRoll: 1,
      endRoll: 30,
      guardMembershipIds: [teacher.membership_id],
    });
    await attendanceRepository.createExamRoom(client, institutionId, {
      examId: classTest.id,
      roomNumber: 'Room 408 (Science Wing 2F)',
      startRoll: 31,
      endRoll: 60,
      guardMembershipIds: [admin.membership_id],
    });
    const allocatedRooms = await attendanceRepository.listExamRooms(client, institutionId, classTest.id);
    if (allocatedRooms.length !== 2) throw new Error('Exam room allocation verification failed');
    console.log(`    ✓ Allocated 2 Rooms: Room 704 (Rolls 1-30) & Room 408 (Rolls 31-60).`);

    // 6. Test Exam Papers & Missing Marks Tracking
    console.log(`\n[6] Testing Exam Paper & Missing Marks / Progress Tracker...`);
    const { rows: subRows } = await client.query(
      `SELECT id FROM subject WHERE institution_id = $1 LIMIT 1`,
      [institutionId]
    );
    const subjectId = subRows[0]?.id;

    const paper = await attendanceRepository.createExamPaper(client, institutionId, {
      examId: classTest.id,
      subjectId,
      maxMarks: 50,
      passMarks: 20,
      examDate: '2026-10-05',
      startTime: '10:00:00',
      endTime: '11:30:00',
      teacherMembershipId: teacher.membership_id,
      syllabus: 'Chapters 1 to 5',
    });
    console.log(`    ✓ Scheduled Exam Paper assigned to Teacher (${teacher.name})`);

    const progress = await attendanceRepository.getExamProgress(client, institutionId, classTest.id);
    console.log(`    ✓ Exam Progress: ${progress.totalEligibleStudents} eligible, ${progress.papers.length} paper(s) tracked.`);

    // 7. Test Universal "Notify & Create Task" for Pending Teachers
    console.log(`\n[7] Testing Universal Task & Notification Dispatch for Pending Marks...`);
    const notifyResult = await attendanceRepository.notifyPendingTeachers(
      client,
      institutionId,
      classTest.id,
      admin.membership_id
    );
    console.log(`    ✓ Dispatched pending marks reminder (${notifyResult.notifiedCount} notifications/tasks created)`);

    // 8. Test Exam Publishing & Marks Entry Lock
    console.log(`\n[8] Testing Exam Publishing & Marks Entry Locking...`);
    const published = await attendanceRepository.publishExam(client, institutionId, classTest.id, admin.membership_id);
    if (!published.success) throw new Error('Publishing exam failed');
    console.log(`    ✓ Exam published successfully. Result release notifications sent: ${published.studentNotificationCount}`);

    // Try recording marks as non-controller teacher after publish -> must throw error
    let lockEnforced = false;
    try {
      await attendanceRepository.recordMarks(
        client,
        institutionId,
        '00000000-0000-0000-0000-000000000001', // regular non-controller membership
        [{ examId: classTest.id, studentId: studentMember.membership_id, subjectId, marksObtained: 45, maxMarks: 50 }]
      );
    } catch (err: any) {
      if (err.message.includes('already published')) {
        lockEnforced = true;
      }
    }
    if (!lockEnforced) throw new Error('Locking marks entry upon publish failed to prevent teacher edits');
    console.log('    ✓ Verified: Marks entry is strictly locked against regular teachers once exam is published.');

    // 9. Test Assignments: Photo Submission & Remind Pending Students
    console.log(`\n[9] Testing Assignments: Photo Submissions & Pending Reminders...`);
    const assignment = await assignmentRepository.create(client, institutionId, admin.membership_id, {
      sectionId: section.section_id,
      subjectId,
      title: 'Trigonometry Problem Set Ch. 8',
      description: 'Upload handwritten solutions with diagrams.',
      dueDate: '2026-10-10',
    });

    const studentRec = await client.query(
      `SELECT id FROM student WHERE institution_id = $1 LIMIT 1`,
      [institutionId]
    );
    const studentId = studentRec.rows[0]?.id;

    if (studentId) {
      // Student photo submission
      const sub = await assignmentRepository.submitAssignment(
        client,
        institutionId,
        assignment.id,
        studentId,
        {
          fileKey: 'trig_hw_page1.jpg',
          fileUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
          submissionNotes: 'All 15 problems solved by hand on graph paper.',
        }
      );
      console.log(`    ✓ Submitted handwritten homework photo: "${sub.fileKey}" with notes.`);

      // Teacher grade submission
      await assignmentRepository.gradeSubmission(client, institutionId, sub.id, teacher.membership_id, {
        grade: 'A+',
        feedback: 'Excellent proofs on problems 7 and 12.',
      });
      console.log(`    ✓ Graded submission with A+ and teacher feedback.`);
    }

    // Remind pending students for assignment
    const remindAsgn = await assignmentRepository.remindPendingStudents(
      client,
      institutionId,
      assignment.id,
      admin.membership_id
    );
    console.log(`    ✓ Assignment Reminders: ${remindAsgn.message} (${remindAsgn.notifiedCount} students)`);

    // 10. Test Requests: Remind Manager & Dispatch Task
    console.log(`\n[10] Testing Requests: Remind Manager with Notification & Task...`);
    const testReq = await coreRepository.createRequest(
      client,
      institutionId,
      {
        category: 'leave',
        title: 'Medical Leave for Eye Surgery',
        description: 'Requesting 2 days leave for medical appointment and rest.',
        startDate: '2026-10-11',
        endDate: '2026-10-12',
      },
      {
        membershipId: teacher.membership_id,
        userId: teacher.user_id,
        roleName: 'teacher',
      }
    );
    console.log(`    ✓ Created Request "${testReq.title}" by Teacher.`);

    // Dispatch reminder to manager
    await dispatchNotificationAndTask({
      client,
      institutionId,
      recipientMembershipIds: [admin.membership_id],
      creatorMembershipId: teacher.membership_id,
      title: `Reminder: Action Required for Leave Request "${testReq.title}"`,
      body: `Teacher has sent a reminder regarding pending request: Medical Leave.`,
      type: 'request',
      priority: 'high',
      createTask: true,
      metadata: { requestId: testReq.id },
    });
    console.log(`    ✓ Dispatched high-priority reminder notification and task to Manager.`);

    // Clean up test records
    await client.query(`DELETE FROM exam_room_assignment WHERE exam_id = $1`, [classTest.id]);
    await client.query(`DELETE FROM exam_paper WHERE exam_id = $1`, [classTest.id]);
    await client.query(`DELETE FROM exam WHERE id = $1`, [classTest.id]);
    await client.query(`DELETE FROM assignment_submission WHERE assignment_id = $1`, [assignment.id]);
    await client.query(`DELETE FROM assignment WHERE id = $1`, [assignment.id]);
    await client.query(`DELETE FROM member_request WHERE id = $1`, [testReq.id]);
    await client.query(`DELETE FROM user_task WHERE institution_id = $1 AND (title LIKE '%Class 9B Bangla%' OR title LIKE '%Medical Leave%' OR title LIKE '%Physics%')`, [institutionId]);
    await client.query(`DELETE FROM notification WHERE institution_id = $1 AND (title LIKE '%Class 9B Bangla%' OR title LIKE '%Medical Leave%' OR title LIKE '%Physics%')`, [institutionId]);

    console.log('\n======================================================');
    console.log('✅ ALL EXTENDED FEATURES VERIFIED SUCCESSFULLY!');
    console.log('======================================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

verifyAll().catch((err) => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
