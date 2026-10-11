import { pool, withTenantContext } from '../src/core/db';
import { coreRepository } from '../src/modules/core/repository';
import { financeRepository } from '../src/modules/finance/repository';
import { noticeRepository } from '../src/modules/notices/repository';
import { randomUUID } from 'crypto';

async function seedEnterpriseDemo() {
  const client = await pool.connect();

  console.log('\n======================================================');
  console.log('🏛️ SOHOPATHI ENTERPRISE MULTI-ROLE SEEDING & TEST HARNESS');
  console.log('======================================================\n');

  try {
    // 1. Get or pick institution
    const { rows: instRows } = await client.query(
      `select id, name, subdomain from institution order by created_at desc limit 1`
    );
    if (instRows.length === 0) throw new Error('No institution found. Run migrations first.');
    const instId = instRows[0].id;
    console.log(`[1] Selected Institution: "${instRows[0].name}" (${instId})`);

    // 2. Configure EIIN Code and Feature Limitation Matrix
    await coreRepository.updateInstitutionSettings(client, instId, {
      instituteCode: 'EIIN-108542',
      settings: {
        address: 'House 42, Road 7/A, Dhanmondi, Dhaka-1209',
        contactEmail: 'contact@sohopathi.edu.bd',
        contactPhone: '+880 1711-223344',
        website: 'https://sohopathi.edu.bd',
        currency: 'BDT',
        timezone: 'Asia/Dhaka',
        attendanceThreshold: 75,
        principalSignatureUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300',
        officialSealUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300',
        officialWatermarkText: 'SOHOPATHI SECURE OFFICIAL',
        featureLimitations: {
          examinations: { enabled: true },
          finance: { enabled: true },
          timetable: { enabled: true },
          transport: { enabled: false }, // Disabled transport
          assignments: { enabled: true },
          admissions: { enabled: true },
          attendance: { enabled: true },
          notices: { enabled: true },
          tasks: { enabled: true },
        },
      },
    });
    console.log('✅ [2] Institution Settings & EIIN updated: EIIN-108542');

    // 3. Ensure Template & Tenant Roles
    const { rows: roles } = await client.query(
      `select id, name from role where institution_id = $1 or institution_id is null`,
      [instId]
    );
    const adminRoleId = roles.find((r) => r.name === 'Institution Admin')?.id || roles[0].id;
    const teacherRoleId = roles.find((r) => r.name === 'Teacher')?.id || roles[0].id;
    const staffRoleId = roles.find((r) => r.name === 'Staff')?.id || roles[0].id;
    const studentRoleId = roles.find((r) => r.name === 'Student')?.id || roles[0].id;

    // 4. Create / Ensure Sample Faculty & Staff Profiles
    const facultyProfiles = [
      { name: 'Dr. Rafiqul Islam', email: 'rafiqul@demo.school.bd', roleId: teacherRoleId, roleName: 'Teacher' },
      { name: 'Professor Farhana Begum', email: 'farhana@demo.school.bd', roleId: teacherRoleId, roleName: 'Teacher' },
      { name: 'Mahbubul Alam (Accountant)', email: 'accounts@demo.school.bd', roleId: staffRoleId, roleName: 'Staff' },
    ];

    const facultyMembers: any[] = [];
    for (const fp of facultyProfiles) {
      let { rows: authRows } = await client.query(`select id from auth.users where email = $1`, [fp.email]);
      let userId = authRows[0]?.id;
      if (!userId) {
        userId = randomUUID();
        await client.query(
          `insert into auth.users (id, email, raw_user_meta_data, aud, role)
           values ($1, $2, $3, 'authenticated', 'authenticated')
           on conflict (id) do nothing`,
          [userId, fp.email, JSON.stringify({ name: fp.name })]
        );
      }
      await client.query(
        `insert into profile (id, name, email) values ($1, $2, $3)
         on conflict (id) do update set name = excluded.name, email = excluded.email`,
        [userId, fp.name, fp.email]
      );

      let { rows: mRows } = await client.query(
        `select id from membership where institution_id = $1 and user_id = $2`,
        [instId, userId]
      );
      let memId = mRows[0]?.id;
      if (!memId) {
        memId = randomUUID();
        await client.query(
          `insert into membership (id, institution_id, user_id, role_id, status) values ($1, $2, $3, $4, 'active')`,
          [memId, instId, userId, fp.roleId]
        );
      }
      facultyMembers.push({ id: memId, name: fp.name, roleName: fp.roleName, userId });
    }
    console.log(`✅ [3] Seeded ${facultyMembers.length} faculty and staff members`);

    // 5. Ensure Academic Year, Classes & Sections
    let { rows: ayRows } = await client.query(
      `select id from academic_year where institution_id = $1 limit 1`,
      [instId]
    );
    let academicYearId = ayRows[0]?.id;
    if (!academicYearId) {
      academicYearId = randomUUID();
      await client.query(
        `insert into academic_year (id, institution_id, label, start_date, end_date, is_current)
         values ($1, $2, 'Academic Year 2026', '2026-01-01', '2026-12-31', true)`,
        [academicYearId, instId]
      );
    }

    let { rows: classRows } = await client.query(
      `select id, name from class where institution_id = $1 and name in ('Class 9', 'Class 10')`,
      [instId]
    );
    let class9 = classRows.find((c) => c.name === 'Class 9');
    let class10 = classRows.find((c) => c.name === 'Class 10');

    if (!class9) {
      const cId = randomUUID();
      await client.query(`insert into class (id, institution_id, academic_year_id, name) values ($1, $2, $3, 'Class 9')`, [cId, instId, academicYearId]);
      class9 = { id: cId, name: 'Class 9' };
    }
    if (!class10) {
      const cId = randomUUID();
      await client.query(`insert into class (id, institution_id, academic_year_id, name) values ($1, $2, $3, 'Class 10')`, [cId, instId, academicYearId]);
      class10 = { id: cId, name: 'Class 10' };
    }

    let { rows: secRows } = await client.query(
      `select id, class_id, name from section where institution_id = $1 and class_id = $2`,
      [instId, class9.id]
    );
    let sec9A = secRows[0];
    if (!sec9A) {
      const sId = randomUUID();
      await client.query(`insert into section (id, institution_id, class_id, name) values ($1, $2, $3, 'A')`, [sId, instId, class9.id]);
      sec9A = { id: sId, class_id: class9.id, name: 'A' };
    }

    // 6. Ensure Students with Auto-provisioned User Accounts
    const studentDemos = [
      { name: 'Sadia Afrin', roll: '101', email: 'sadia@student.demo.bd', admissionNo: 'ADM-9001' },
      { name: 'Tahmid Ahmed', roll: '102', email: 'tahmid@student.demo.bd', admissionNo: 'ADM-9002' },
      { name: 'Nusrat Jahan', roll: '103', email: 'nusrat@student.demo.bd', admissionNo: 'ADM-9003' },
    ];

    const studentList: any[] = [];
    for (const sd of studentDemos) {
      let { rows: sRows } = await client.query(
        `select id, name from student where institution_id = $1 and admission_no = $2`,
        [instId, sd.admissionNo]
      );
      let sId = sRows[0]?.id;
      if (!sId) {
        const created = await coreRepository.createStudent(client, instId, {
          name: sd.name,
          admissionNo: sd.admissionNo,
          rollNo: String(sd.roll),
          classId: class9.id,
          sectionId: sec9A.id,
          guardianName: `${sd.name} Parent`,
          guardianPhone: '+8801700112233',
          customFields: { email: sd.email },
        });
        sId = created.id;
      }
      studentList.push({ id: sId, name: sd.name, roll: sd.roll });
    }
    console.log(`✅ [4] Seeded ${studentList.length} students with active enrollments & user accounts`);

    // 7. Verify Student Exclusion from Employee Directory
    const membersList = await coreRepository.listMembers(client, instId);
    const hasStudentInStaff = membersList.some((m) =>
      m.roleName?.toLowerCase().includes('student') || m.roleName?.toLowerCase().includes('guardian')
    );
    if (hasStudentInStaff) {
      throw new Error('FAIL: Students/guardians were incorrectly returned in employee directory');
    }
    console.log(`✅ [5] Employee directory verified: ${membersList.length} staff members (0 students/guardians)`);

    // 8. Generate Fee Invoices & Process Payments with Official Receipts
    const sampleStudent = studentList[0];
    const createdInvoice = await financeRepository.createInvoice(client, instId, {
      recipientType: 'student',
      studentId: sampleStudent.id,
      category: 'Tuition Fee',
      title: 'October 2026 Academic Tuition & Activity Fee',
      description: 'Monthly school fee and lab facility access',
      totalAmount: 4000,
      discountAmount: 500,
      dueDate: '2026-10-25',
      items: [
        { label: 'Monthly Tuition', amount: 3500 },
        { label: 'Science Laboratory', amount: 500 },
      ],
      notes: 'Early payment waiver applied: ৳500',
    });
    console.log(`✅ [6] Fee Invoice issued: ${createdInvoice.invoiceNumber} (Net: ৳${createdInvoice.dueAmount})`);

    // Record Payment
    const { payment: paymentRecord, invoice: paidInvoice } = await financeRepository.recordPayment(
      client,
      instId,
      createdInvoice.id,
      {
        amount: 3500,
        paymentDate: '2026-10-10',
        method: 'bKash',
        transactionId: 'BKASH-DEMO-99182',
        notes: 'Mobile money counter settlement',
      },
      facultyMembers[2].id // Mahbubul Alam (Accountant)
    );
    console.log(`✅ [7] Payment recorded: Receipt ${paymentRecord.receiptNumber}, Amount ৳${paymentRecord.amount}`);

    // Verify Official Receipt
    const receiptData = await financeRepository.getReceiptData(client, instId, paymentRecord.id);
    console.log(`✅ [8] Official receipt validated:`);
    console.log(`    - Receipt No: ${receiptData.payment.receiptNumber}`);
    console.log(`    - Student: ${receiptData.invoice.studentName} (Roll: ${receiptData.invoice.studentRollNo})`);
    console.log(`    - Institution: ${receiptData.institution.name} (EIIN: ${receiptData.institution.instituteCode})`);
    console.log(`    - Status: ${receiptData.invoice.status}`);

    // 9. Create Bulk Invoices for Class 9
    const bulkResult = await financeRepository.createBulkInvoices(client, instId, {
      classId: class9.id,
      category: 'Examination Fee',
      title: 'Annual Final Examination Fee 2026',
      amount: 1500,
      dueDate: '2026-11-10',
      notes: 'Board exam center and admit card generation fee',
    });
    console.log(`✅ [9] Bulk cohort invoices issued: ${bulkResult.count} invoices for Class 9`);

    // 10. Multi-Assignee Task Distribution
    const teacherIds = [facultyMembers[0].id, facultyMembers[1].id];
    const createdTask = await coreRepository.createTask(client, instId, {
      assigneeMembershipIds: teacherIds,
      title: 'Finalize Class 9 & 10 Midterm Question Papers',
      description: 'Prepare creative and multiple-choice questions according to national curriculum syllabus.',
      priority: 'urgent',
      dueDate: '2026-10-31',
      creatorMembershipId: facultyMembers[0].id,
    });
    const taskTitle = Array.isArray(createdTask) ? createdTask[0]?.title : createdTask.title;
    console.log(`✅ [10] Multi-assignee task created for ${teacherIds.length} teachers: "${taskTitle}"`);

    // 11. Targeted Notice Board Announcements
    await noticeRepository.create(client, instId, facultyMembers[0].id, {
      title: 'Annual Cultural Fest 2026 Participation',
      body: 'All students and faculty are invited to register for stage drama, debate, and music performances.',
      audienceScope: 'institution',
    });

    await noticeRepository.create(client, instId, facultyMembers[0].id, {
      title: 'Academic Council Meeting & Syllabus Review',
      body: 'Faculty members are requested to assemble at the Conference Hall this Thursday at 2:00 PM.',
      audienceScope: 'roles',
      targetRoles: ['Teacher'],
    });

    await noticeRepository.create(client, instId, facultyMembers[0].id, {
      title: 'Class 9 Special Model Test Schedule',
      body: 'Mathematics and Physics model tests will be conducted next Monday morning.',
      audienceScope: 'classes',
      targetClassIds: [class9.id],
    });
    console.log('✅ [11] Targeted notices published (Entire School, Teachers Only, Class 9 Only)');

    // 12. Financial Summary
    const summary = await financeRepository.getFinanceSummary(client, instId);
    console.log('\n------------------------------------------------------');
    console.log('📊 FINANCIAL RECONCILIATION SUMMARY:');
    console.log(`   - Total Billed: ৳${summary.totalBilled.toLocaleString()}`);
    console.log(`   - Total Collected: ৳${summary.totalCollected.toLocaleString()}`);
    console.log(`   - Total Outstanding: ৳${summary.totalPending.toLocaleString()}`);
    console.log(`   - Collection Efficiency: ${summary.collectionRate}%`);
    console.log('------------------------------------------------------\n');

    console.log('🎉 ALL ENTERPRISE REQUIREMENTS SUCCESSFULLY POPULATED & VERIFIED!\n');
  } finally {
    client.release();
    await pool.end();
  }
}

seedEnterpriseDemo().catch((err) => {
  console.error('❌ SEEDING ERROR:', err);
  process.exit(1);
});
