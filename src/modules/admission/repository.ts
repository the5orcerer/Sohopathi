import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { provisionStudentUserAccount } from '../core/repository';
import { dispatchNotificationAndTask } from '../core/notification-task-service';

export interface AdmissionApplication {
  id: string;
  institutionId: string;
  applicationNo: string;
  academicYearId?: string;
  academicYearLabel?: string;
  classId?: string;
  className?: string;
  applicantName: string;
  dateOfBirth?: string;
  gender?: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  guardianRelation?: string;
  address?: string;
  previousSchool?: string;
  status: 'submitted' | 'under_review' | 'shortlisted' | 'admitted' | 'rejected';
  applicationFee: number;
  feeStatus: 'unpaid' | 'paid' | 'waived';
  notes?: string;
  reviewedByMembershipId?: string;
  reviewerName?: string;
  admittedStudentId?: string;
  createdAt: string;
  updatedAt: string;
}

export const admissionRepository = {
  async listApplications(
    client: PoolClient,
    institutionId: string,
    filters?: {
      status?: string;
      classId?: string;
      academicYearId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ applications: AdmissionApplication[]; total: number }> {
    let baseQuery = `
      from admission_application a
      left join class c on c.id = a.class_id
      left join academic_year ay on ay.id = a.academic_year_id
      left join membership rm on rm.id = a.reviewed_by_membership_id
      left join profile rp on rp.id = rm.user_id
      where a.institution_id = $1
    `;
    const params: any[] = [institutionId];

    if (filters?.status && filters.status !== 'all') {
      params.push(filters.status);
      baseQuery += ` and a.status = $${params.length}`;
    }
    if (filters?.classId) {
      params.push(filters.classId);
      baseQuery += ` and a.class_id = $${params.length}`;
    }
    if (filters?.academicYearId) {
      params.push(filters.academicYearId);
      baseQuery += ` and a.academic_year_id = $${params.length}`;
    }
    if (filters?.search) {
      params.push(`%${filters.search.trim().toLowerCase()}%`);
      baseQuery += ` and (
        lower(a.applicant_name) like $${params.length}
        or lower(a.application_no) like $${params.length}
        or lower(a.guardian_name) like $${params.length}
        or lower(a.guardian_phone) like $${params.length}
      )`;
    }

    const { rows: countRows } = await client.query(`select count(*)::int as total ${baseQuery}`, params);
    const total = countRows[0]?.total || 0;

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    params.push(limit, offset);

    const query = `
      select
        a.id,
        a.institution_id as "institutionId",
        a.application_no as "applicationNo",
        a.academic_year_id as "academicYearId",
        ay.label as "academicYearLabel",
        a.class_id as "classId",
        c.name as "className",
        a.applicant_name as "applicantName",
        a.date_of_birth as "dateOfBirth",
        a.gender,
        a.guardian_name as "guardianName",
        a.guardian_phone as "guardianPhone",
        a.guardian_email as "guardianEmail",
        a.guardian_relation as "guardianRelation",
        a.address,
        a.previous_school as "previousSchool",
        a.status,
        a.application_fee::float as "applicationFee",
        a.fee_status as "feeStatus",
        a.notes,
        a.reviewed_by_membership_id as "reviewedByMembershipId",
        rp.name as "reviewerName",
        a.admitted_student_id as "admittedStudentId",
        a.created_at as "createdAt",
        a.updated_at as "updatedAt"
      ${baseQuery}
      order by a.created_at desc
      limit $${params.length - 1} offset $${params.length}
    `;

    const { rows } = await client.query(query, params);
    return { applications: rows, total };
  },

  async getStats(client: PoolClient, institutionId: string): Promise<any> {
    const { rows: statusRows } = await client.query(
      `select 
         count(*)::int as total,
         count(*) filter (where status = 'submitted')::int as submitted,
         count(*) filter (where status = 'under_review')::int as under_review,
         count(*) filter (where status = 'shortlisted')::int as shortlisted,
         count(*) filter (where status = 'admitted')::int as admitted,
         count(*) filter (where status = 'rejected')::int as rejected,
         coalesce(sum(application_fee) filter (where fee_status = 'paid'), 0)::float as total_fees_collected
       from admission_application
       where institution_id = $1`,
      [institutionId]
    );

    const { rows: classBreakdown } = await client.query(
      `select 
         coalesce(c.name, 'Unassigned') as "className",
         count(*)::int as count
       from admission_application a
       left join class c on c.id = a.class_id
       where a.institution_id = $1
       group by c.name, c.sort_order
       order by c.sort_order asc nulls last, count desc`,
      [institutionId]
    );

    return {
      summary: statusRows[0] || {
        total: 0,
        submitted: 0,
        under_review: 0,
        shortlisted: 0,
        admitted: 0,
        rejected: 0,
        total_fees_collected: 0,
      },
      classBreakdown,
    };
  },

  async getApplicationById(client: PoolClient, institutionId: string, id: string): Promise<AdmissionApplication | null> {
    const { rows } = await client.query(
      `select
        a.id,
        a.institution_id as "institutionId",
        a.application_no as "applicationNo",
        a.academic_year_id as "academicYearId",
        ay.label as "academicYearLabel",
        a.class_id as "classId",
        c.name as "className",
        a.applicant_name as "applicantName",
        a.date_of_birth as "dateOfBirth",
        a.gender,
        a.guardian_name as "guardianName",
        a.guardian_phone as "guardianPhone",
        a.guardian_email as "guardianEmail",
        a.guardian_relation as "guardianRelation",
        a.address,
        a.previous_school as "previousSchool",
        a.status,
        a.application_fee::float as "applicationFee",
        a.fee_status as "feeStatus",
        a.notes,
        a.reviewed_by_membership_id as "reviewedByMembershipId",
        rp.name as "reviewerName",
        a.admitted_student_id as "admittedStudentId",
        a.created_at as "createdAt",
        a.updated_at as "updatedAt"
      from admission_application a
      left join class c on c.id = a.class_id
      left join academic_year ay on ay.id = a.academic_year_id
      left join membership rm on rm.id = a.reviewed_by_membership_id
      left join profile rp on rp.id = rm.user_id
      where a.id = $1 and a.institution_id = $2`,
      [id, institutionId]
    );
    return rows[0] || null;
  },

  async createApplication(
    client: PoolClient,
    institutionId: string,
    data: {
      applicationNo?: string;
      academicYearId?: string;
      classId?: string;
      applicantName: string;
      dateOfBirth?: string;
      gender?: string;
      guardianName: string;
      guardianPhone: string;
      guardianEmail?: string;
      guardianRelation?: string;
      address?: string;
      previousSchool?: string;
      applicationFee?: number;
      feeStatus?: string;
      notes?: string;
    },
    actorMembershipId?: string
  ): Promise<AdmissionApplication> {
    let appNo = data.applicationNo?.trim();
    if (!appNo) {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      appNo = `APP-${year}-${rand}`;
    }

    let ayId = data.academicYearId;
    if (!ayId) {
      const { rows: ayRows } = await client.query(
        `select id from academic_year where institution_id = $1 and is_current = true limit 1`,
        [institutionId]
      );
      if (ayRows.length > 0) ayId = ayRows[0].id;
    }

    const { rows } = await client.query(
      `insert into admission_application (
        institution_id, application_no, academic_year_id, class_id,
        applicant_name, date_of_birth, gender, guardian_name, guardian_phone, guardian_email,
        guardian_relation, address, previous_school, application_fee, fee_status, notes, status
      ) values (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9, $10,
        coalesce($11, 'Parent'), $12, $13, coalesce($14, 0), coalesce($15, 'unpaid'), $16, 'submitted'
      )
      returning
        id,
        institution_id as "institutionId",
        application_no as "applicationNo",
        academic_year_id as "academicYearId",
        class_id as "classId",
        applicant_name as "applicantName",
        date_of_birth as "dateOfBirth",
        gender,
        guardian_name as "guardianName",
        guardian_phone as "guardianPhone",
        guardian_email as "guardianEmail",
        guardian_relation as "guardianRelation",
        address,
        previous_school as "previousSchool",
        status,
        application_fee::float as "applicationFee",
        fee_status as "feeStatus",
        notes,
        created_at as "createdAt",
        updated_at as "updatedAt"`,
      [
        institutionId,
        appNo,
        ayId || null,
        data.classId || null,
        data.applicantName.trim(),
        data.dateOfBirth || null,
        data.gender || null,
        data.guardianName.trim(),
        data.guardianPhone.trim(),
        data.guardianEmail?.trim() || null,
        data.guardianRelation?.trim() || 'Parent',
        data.address?.trim() || null,
        data.previousSchool?.trim() || null,
        data.applicationFee ?? 0,
        data.feeStatus || 'unpaid',
        data.notes?.trim() || null,
      ]
    );

    const created = rows[0];
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'create',
      entityType: 'admission_application',
      entityId: created.id,
      after: created,
    });

    return created;
  },

  async updateApplication(
    client: PoolClient,
    institutionId: string,
    id: string,
    data: {
      status?: 'submitted' | 'under_review' | 'shortlisted' | 'admitted' | 'rejected';
      feeStatus?: 'unpaid' | 'paid' | 'waived';
      notes?: string;
      classId?: string;
    },
    actorMembershipId?: string
  ): Promise<AdmissionApplication> {
    const { rows } = await client.query(
      `update admission_application set
         status = coalesce($1, status),
         fee_status = coalesce($2, fee_status),
         notes = coalesce($3, notes),
         class_id = coalesce($4, class_id),
         reviewed_by_membership_id = coalesce($5, reviewed_by_membership_id),
         updated_at = now()
       where id = $6 and institution_id = $7
       returning id`,
      [
        data.status || null,
        data.feeStatus || null,
        data.notes !== undefined ? data.notes : null,
        data.classId || null,
        actorMembershipId || null,
        id,
        institutionId,
      ]
    );

    if (rows.length === 0) throw new Error('Application not found');
    const updated = (await admissionRepository.getApplicationById(client, institutionId, id))!;

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update',
      entityType: 'admission_application',
      entityId: id,
      after: updated,
    });

    return updated;
  },

  async admitAndEnroll(
    client: PoolClient,
    institutionId: string,
    applicationId: string,
    data: {
      sectionId: string;
      admissionNo?: string;
      rollNo?: string;
      academicYearId?: string;
    },
    actorMembershipId?: string
  ): Promise<{ student: any; username: string; defaultPassword: string; application: AdmissionApplication }> {
    const app = await admissionRepository.getApplicationById(client, institutionId, applicationId);
    if (!app) throw new Error('Admission application not found');
    if (!app.classId) throw new Error('Application must be assigned to a class before enrollment');

    const admNo = data.admissionNo?.trim() || `ADM-${new Date().getFullYear()}-${app.applicationNo.replace(/[^0-9]/g, '').slice(-4) || '001'}`;

    // 1. Auto-provision student user account with default password changeme
    const { userId, username } = await provisionStudentUserAccount(
      client,
      institutionId,
      app.applicantName,
      admNo
    );

    // 2. Insert Student record
    const { rows: sRows } = await client.query(
      `insert into student (institution_id, user_id, admission_no, name, date_of_birth, gender, status)
       values ($1, $2, $3, $4, $5, $6, 'active')
       on conflict (institution_id, admission_no) do update
       set name = excluded.name, user_id = excluded.user_id, status = 'active'
       returning id, institution_id as "institutionId", user_id as "userId", admission_no as "admissionNo", name, date_of_birth as "dateOfBirth", gender, status, created_at as "createdAt"`,
      [
        institutionId,
        userId,
        admNo,
        app.applicantName,
        app.dateOfBirth || null,
        app.gender || null,
      ]
    );
    const student = { ...sRows[0], username };

    // 3. Resolve Academic Year
    let ayId = data.academicYearId || app.academicYearId;
    if (!ayId) {
      const { rows: ayRows } = await client.query(
        `select id from academic_year where institution_id = $1 and is_current = true limit 1`,
        [institutionId]
      );
      if (ayRows.length > 0) ayId = ayRows[0].id;
    }

    // 4. Enroll in section
    if (ayId && app.classId && data.sectionId) {
      await client.query(
        `insert into enrollment (institution_id, student_id, academic_year_id, class_id, section_id, roll_no, status)
         values ($1, $2, $3, $4, $5, $6, 'active')
         on conflict (student_id, academic_year_id) do update
         set class_id = excluded.class_id, section_id = excluded.section_id, roll_no = excluded.roll_no`,
        [institutionId, student.id, ayId, app.classId, data.sectionId, data.rollNo || null]
      );
    }

    // 5. Guardian link
    if (app.guardianName) {
      const { rows: gRows } = await client.query(
        `insert into guardian (institution_id, name, phone)
         values ($1, $2, $3)
         returning id`,
        [institutionId, app.guardianName, app.guardianPhone || null]
      );
      await client.query(
        `insert into student_guardian (institution_id, student_id, guardian_id, relation_type, is_primary)
         values ($1, $2, $3, $4, true)
         on conflict do nothing`,
        [institutionId, student.id, gRows[0].id, app.guardianRelation || 'Parent']
      );
    }

    // 6. Update admission application status to admitted
    await client.query(
      `update admission_application
       set status = 'admitted', admitted_student_id = $1, reviewed_by_membership_id = $2, updated_at = now()
       where id = $3 and institution_id = $4`,
      [student.id, actorMembershipId || null, applicationId, institutionId]
    );

    const updatedApp = (await admissionRepository.getApplicationById(client, institutionId, applicationId))!;

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'admit_student',
      entityType: 'admission_application',
      entityId: applicationId,
      after: { studentId: student.id, username, admissionNo: admNo },
    });

    try {
      const { rows: memRows } = await client.query(
        `select id from membership where user_id = $1 and institution_id = $2 limit 1`,
        [userId, institutionId]
      );
      const studentMembershipId = memRows[0]?.id;

      await dispatchNotificationAndTask({
        client,
        institutionId,
        creatorMembershipId: actorMembershipId,
        recipientMembershipIds: studentMembershipId ? [studentMembershipId] : [],
        recipientUserIds: studentMembershipId ? [] : [userId],
        title: 'Welcome to the Institution - Admission Approved',
        body: `Congratulations ${app.applicantName}! Your admission has been approved (Admission No: ${admNo}). Your login username is: ${username}`,
        type: 'admission',
        priority: 'high',
        createTask: false,
        metadata: {
          applicationId,
          studentId: student.id,
          admissionNo: admNo,
          username,
        },
      });
    } catch {
      // Non-blocking notification dispatch
    }

    return {
      student,
      username,
      defaultPassword: 'changeme',
      application: updatedApp,
    };
  },

  async deleteApplication(client: PoolClient, institutionId: string, id: string, actorMembershipId?: string): Promise<void> {
    await client.query(`delete from admission_application where id = $1 and institution_id = $2`, [id, institutionId]);
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'delete',
      entityType: 'admission_application',
      entityId: id,
    });
  },
};
