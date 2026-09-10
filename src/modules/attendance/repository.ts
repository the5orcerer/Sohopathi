import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';

export interface AttendanceRecord {
  id: string;
  institutionId: string;
  studentId: string;
  sectionId: string;
  date: string;
  status: string;
  recordedByMembershipId: string | null;
}

export interface AttendanceSheetItem {
  studentId: string;
  admissionNo: string;
  name: string;
  rollNo: string | null;
  status: string | null;
  attendanceId: string | null;
}

export interface AttendanceSummary {
  sectionId: string;
  date: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
}

export interface Exam {
  id: string;
  institutionId: string;
  academicYearId: string;
  academicYearLabel?: string;
  name: string;
  term: string | null;
  startDate: string | null;
  endDate: string | null;
  isPublished: boolean;
  paperCount?: number;
}

export interface ExamPaper {
  id: string;
  institutionId: string;
  examId: string;
  examName?: string;
  subjectId: string;
  subjectName?: string;
  examDate: string | null;
  startTime: string | null;
  endTime: string | null;
  roomNo: string | null;
  maxMarks: number;
  passMarks: number;
  theoryWeight: number;
  practicalWeight: number;
  vivaWeight: number;
  createdAt: string;
}

export interface Mark {
  id: string;
  institutionId: string;
  examId: string;
  studentId: string;
  studentName?: string;
  admissionNo?: string;
  subjectId: string;
  subjectName?: string;
  marksObtained: number | null;
  maxMarks: number;
  grade: string | null;
  recordedByMembershipId: string | null;
}

function calculateLetterGrade(percentage: number): string {
  if (percentage >= 80) return 'A+';
  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'A-';
  if (percentage >= 50) return 'B';
  if (percentage >= 40) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
}

export const attendanceRepository = {
  // Helper to get allowed section IDs for a membership when scope is 'assigned_sections'
  async getTeacherAssignedSectionIds(client: PoolClient, teacherMembershipId: string): Promise<string[]> {
    const { rows: cstRows } = await client.query(
      `select distinct section_id from class_subject_teacher where teacher_membership_id = $1`,
      [teacherMembershipId]
    );
    const { rows: scopeRows } = await client.query(
      `select scope_id as section_id from membership_scope where membership_id = $1 and scope_type = 'section'`,
      [teacherMembershipId]
    );
    const sectionIds = new Set<string>();
    cstRows.forEach((r) => sectionIds.add(r.section_id));
    scopeRows.forEach((r) => sectionIds.add(r.section_id));
    return Array.from(sectionIds);
  },

  // Helper to get student ID for a user/membership when scope is 'self'
  async getStudentIdForUser(client: PoolClient, userId: string): Promise<string | null> {
    const { rows } = await client.query(`select id from student where user_id = $1 limit 1`, [userId]);
    if (rows.length > 0) return rows[0].id;

    // Check guardian link
    const { rows: gRows } = await client.query(
      `select sg.student_id from guardian g
       join student_guardian sg on sg.guardian_id = g.id
       where g.user_id = $1 limit 1`,
      [userId]
    );
    return gRows[0]?.student_id ?? null;
  },

  // --- Attendance ---
  async markAttendance(
    client: PoolClient,
    institutionId: string,
    recordedByMembershipId: string,
    records: { studentId: string; sectionId: string; date: string; status: string }[]
  ): Promise<AttendanceRecord[]> {
    const results: AttendanceRecord[] = [];
    for (const r of records) {
      const { rows } = await client.query(
        `insert into attendance (institution_id, student_id, section_id, date, status, recorded_by_membership_id)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (student_id, date) do update set status = excluded.status, section_id = excluded.section_id, recorded_by_membership_id = excluded.recorded_by_membership_id
         returning id, institution_id as "institutionId", student_id as "studentId", section_id as "sectionId", date, status, recorded_by_membership_id as "recordedByMembershipId"`,
        [institutionId, r.studentId, r.sectionId, r.date, r.status, recordedByMembershipId]
      );
      results.push(rows[0]);
    }

    if (results.length > 0) {
      await logAudit(client, {
        institutionId,
        actorMembershipId: recordedByMembershipId,
        action: 'mark_attendance',
        entityType: 'attendance',
        entityId: results[0].id,
        after: { count: results.length },
      });
    }

    return results;
  },

  async getAttendanceSheet(
    client: PoolClient,
    institutionId: string,
    sectionId: string,
    date: string
  ): Promise<AttendanceSheetItem[]> {
    const { rows } = await client.query(
      `select 
        s.id as "studentId",
        s.admission_no as "admissionNo",
        s.name,
        e.roll_no as "rollNo",
        a.status,
        a.id as "attendanceId"
       from enrollment e
       join student s on s.id = e.student_id
       left join attendance a on a.student_id = s.id and a.date = $2
       where e.section_id = $1 and e.status = 'active'
       order by e.roll_no asc, s.name asc`,
      [sectionId, date]
    );
    return rows;
  },

  async listAttendance(
    client: PoolClient,
    institutionId: string,
    filters: { sectionId?: string; date?: string; studentId?: string; allowedSectionIds?: string[] }
  ): Promise<AttendanceRecord[]> {
    let query = `select id, institution_id as "institutionId", student_id as "studentId", section_id as "sectionId", date, status, recorded_by_membership_id as "recordedByMembershipId" from attendance where institution_id = $1`;
    const params: any[] = [institutionId];

    if (filters.sectionId) {
      params.push(filters.sectionId);
      query += ` and section_id = $${params.length}`;
    } else if (filters.allowedSectionIds) {
      if (filters.allowedSectionIds.length === 0) return [];
      params.push(filters.allowedSectionIds);
      query += ` and section_id = any($${params.length})`;
    }

    if (filters.date) {
      params.push(filters.date);
      query += ` and date = $${params.length}`;
    }

    if (filters.studentId) {
      params.push(filters.studentId);
      query += ` and student_id = $${params.length}`;
    }

    query += ` order by date desc`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async getAttendanceSummary(
    client: PoolClient,
    institutionId: string,
    filters: { sectionId?: string; date?: string; allowedSectionIds?: string[] }
  ): Promise<AttendanceSummary[]> {
    let query = `
      select section_id as "sectionId", date,
             count(*)::int as "totalStudents",
             count(*) filter (where status = 'present')::int as "presentCount",
             count(*) filter (where status = 'absent')::int as "absentCount",
             count(*) filter (where status = 'late')::int as "lateCount",
             count(*) filter (where status = 'excused')::int as "excusedCount"
      from attendance
      where institution_id = $1
    `;
    const params: any[] = [institutionId];

    if (filters.sectionId) {
      params.push(filters.sectionId);
      query += ` and section_id = $${params.length}`;
    } else if (filters.allowedSectionIds) {
      if (filters.allowedSectionIds.length === 0) return [];
      params.push(filters.allowedSectionIds);
      query += ` and section_id = any($${params.length})`;
    }

    if (filters.date) {
      params.push(filters.date);
      query += ` and date = $${params.length}`;
    }

    query += ` group by section_id, date order by date desc limit 30`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  // --- Examinations & Papers ---
  async listExams(client: PoolClient, institutionId: string, academicYearId?: string): Promise<Exam[]> {
    let query = `
      select 
        e.id, 
        e.institution_id as "institutionId", 
        e.academic_year_id as "academicYearId", 
        ay.label as "academicYearLabel",
        e.name, 
        e.term,
        e.start_date as "startDate",
        e.end_date as "endDate",
        e.is_published as "isPublished",
        (select count(*)::int from exam_paper ep where ep.exam_id = e.id) as "paperCount"
      from exam e
      left join academic_year ay on ay.id = e.academic_year_id
      where e.institution_id = $1
    `;
    const params: any[] = [institutionId];
    if (academicYearId) {
      params.push(academicYearId);
      query += ` and e.academic_year_id = $2`;
    }
    query += ` order by e.start_date desc nulls last, e.name asc`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async createExam(
    client: PoolClient,
    institutionId: string,
    data: { academicYearId: string; name: string; term?: string; startDate?: string; endDate?: string },
    actorMembershipId?: string
  ): Promise<Exam> {
    const { rows } = await client.query(
      `insert into exam (institution_id, academic_year_id, name, term, start_date, end_date, is_published)
       values ($1, $2, $3, $4, $5, $6, false)
       returning id, institution_id as "institutionId", academic_year_id as "academicYearId", name, term, start_date as "startDate", end_date as "endDate", is_published as "isPublished"`,
      [institutionId, data.academicYearId, data.name.trim(), data.term || null, data.startDate || null, data.endDate || null]
    );
    const exam = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'exam', entityId: exam.id, after: exam });
    return exam;
  },

  async updateExam(
    client: PoolClient,
    institutionId: string,
    examId: string,
    data: { name?: string; term?: string; startDate?: string; endDate?: string; isPublished?: boolean },
    actorMembershipId?: string
  ): Promise<Exam> {
    const { rows } = await client.query(
      `update exam set
         name = coalesce($1, name),
         term = coalesce($2, term),
         start_date = coalesce($3, start_date),
         end_date = coalesce($4, end_date),
         is_published = coalesce($5, is_published)
       where id = $6 and institution_id = $7
       returning id, institution_id as "institutionId", academic_year_id as "academicYearId", name, term, start_date as "startDate", end_date as "endDate", is_published as "isPublished"`,
      [data.name?.trim() || null, data.term || null, data.startDate || null, data.endDate || null, data.isPublished, examId, institutionId]
    );
    const updated = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'update', entityType: 'exam', entityId: examId, after: updated });
    return updated;
  },

  async deleteExam(client: PoolClient, institutionId: string, examId: string, actorMembershipId?: string): Promise<void> {
    await client.query(`delete from exam where id = $1 and institution_id = $2`, [examId, institutionId]);
    await logAudit(client, { institutionId, actorMembershipId, action: 'delete', entityType: 'exam', entityId: examId });
  },

  async listExamPapers(client: PoolClient, institutionId: string, examId: string): Promise<ExamPaper[]> {
    const { rows } = await client.query(
      `select 
        ep.id,
        ep.institution_id as "institutionId",
        ep.exam_id as "examId",
        e.name as "examName",
        ep.subject_id as "subjectId",
        s.name as "subjectName",
        ep.exam_date as "examDate",
        ep.start_time as "startTime",
        ep.end_time as "endTime",
        ep.room_no as "roomNo",
        ep.max_marks as "maxMarks",
        ep.pass_marks as "passMarks",
        ep.theory_weight as "theoryWeight",
        ep.practical_weight as "practicalWeight",
        ep.viva_weight as "vivaWeight",
        ep.created_at as "createdAt"
       from exam_paper ep
       join exam e on e.id = ep.exam_id
       join subject s on s.id = ep.subject_id
       where ep.institution_id = $1 and ep.exam_id = $2
       order by ep.exam_date asc nulls last, ep.start_time asc nulls last`,
      [institutionId, examId]
    );
    return rows;
  },

  async createExamPaper(
    client: PoolClient,
    institutionId: string,
    data: {
      examId: string;
      subjectId: string;
      examDate?: string;
      startTime?: string;
      endTime?: string;
      roomNo?: string;
      maxMarks?: number;
      passMarks?: number;
      theoryWeight?: number;
      practicalWeight?: number;
      vivaWeight?: number;
    },
    actorMembershipId?: string
  ): Promise<ExamPaper> {
    const { rows } = await client.query(
      `insert into exam_paper (institution_id, exam_id, subject_id, exam_date, start_time, end_time, room_no, max_marks, pass_marks, theory_weight, practical_weight, viva_weight)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (exam_id, subject_id) do update set
         exam_date = excluded.exam_date, start_time = excluded.start_time, end_time = excluded.end_time,
         room_no = excluded.room_no, max_marks = excluded.max_marks, pass_marks = excluded.pass_marks,
         theory_weight = excluded.theory_weight, practical_weight = excluded.practical_weight, viva_weight = excluded.viva_weight
       returning id, institution_id as "institutionId", exam_id as "examId", subject_id as "subjectId", exam_date as "examDate", start_time as "startTime", end_time as "endTime", room_no as "roomNo", max_marks as "maxMarks", pass_marks as "passMarks", theory_weight as "theoryWeight", practical_weight as "practicalWeight", viva_weight as "vivaWeight", created_at as "createdAt"`,
      [
        institutionId,
        data.examId,
        data.subjectId,
        data.examDate || null,
        data.startTime || null,
        data.endTime || null,
        data.roomNo || null,
        data.maxMarks ?? 100,
        data.passMarks ?? 40,
        data.theoryWeight ?? 70,
        data.practicalWeight ?? 30,
        data.vivaWeight ?? 0,
      ]
    );
    const paper = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'exam_paper', entityId: paper.id, after: paper });
    return paper;
  },

  async deleteExamPaper(client: PoolClient, institutionId: string, paperId: string, actorMembershipId?: string): Promise<void> {
    await client.query(`delete from exam_paper where id = $1 and institution_id = $2`, [paperId, institutionId]);
    await logAudit(client, { institutionId, actorMembershipId, action: 'delete', entityType: 'exam_paper', entityId: paperId });
  },

  // --- Marks Recording ---
  async isTeacherAllowedForStudentSubject(
    client: PoolClient,
    teacherMembershipId: string,
    studentId: string,
    subjectId: string
  ): Promise<boolean> {
    const { rows } = await client.query(
      `select 1
       from enrollment e
       join class_subject_teacher cst on cst.section_id = e.section_id and cst.subject_id = $3
       where e.student_id = $2 and e.status = 'active' and cst.teacher_membership_id = $1
       union
       select 1
       from membership_scope ms
       where ms.membership_id = $1 and ms.scope_type in ('institution', 'section')
       limit 1`,
      [teacherMembershipId, studentId, subjectId]
    );
    return rows.length > 0;
  },

  async listMarks(
    client: PoolClient,
    institutionId: string,
    filters: { examId?: string; studentId?: string; subjectId?: string; allowedSectionIds?: string[] }
  ): Promise<Mark[]> {
    let query = `
      select 
        m.id,
        m.institution_id as "institutionId",
        m.exam_id as "examId",
        m.student_id as "studentId",
        s.name as "studentName",
        s.admission_no as "admissionNo",
        m.subject_id as "subjectId",
        sub.name as "subjectName",
        m.marks_obtained as "marksObtained",
        m.max_marks as "maxMarks",
        m.grade,
        m.recorded_by_membership_id as "recordedByMembershipId"
      from mark m
      join student s on s.id = m.student_id
      join subject sub on sub.id = m.subject_id
      left join enrollment e on e.student_id = s.id and e.status = 'active'
      where m.institution_id = $1
    `;
    const params: any[] = [institutionId];

    if (filters.examId) {
      params.push(filters.examId);
      query += ` and m.exam_id = $${params.length}`;
    }
    if (filters.studentId) {
      params.push(filters.studentId);
      query += ` and m.student_id = $${params.length}`;
    }
    if (filters.subjectId) {
      params.push(filters.subjectId);
      query += ` and m.subject_id = $${params.length}`;
    }
    if (filters.allowedSectionIds) {
      if (filters.allowedSectionIds.length === 0) return [];
      params.push(filters.allowedSectionIds);
      query += ` and e.section_id = any($${params.length})`;
    }

    query += ` order by s.name asc`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async recordMarks(
    client: PoolClient,
    institutionId: string,
    recordedByMembershipId: string,
    marks: { examId: string; studentId: string; subjectId: string; marksObtained?: number; maxMarks: number; grade?: string }[]
  ): Promise<Mark[]> {
    const results: Mark[] = [];
    for (const m of marks) {
      let resolvedGrade = m.grade;
      if (!resolvedGrade && m.marksObtained !== undefined && m.marksObtained !== null) {
        const pct = (m.marksObtained / m.maxMarks) * 100;
        resolvedGrade = calculateLetterGrade(pct);
      }

      const { rows } = await client.query(
        `insert into mark (institution_id, exam_id, student_id, subject_id, marks_obtained, max_marks, grade, recorded_by_membership_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (exam_id, student_id, subject_id) do update
         set marks_obtained = excluded.marks_obtained, max_marks = excluded.max_marks, grade = excluded.grade, recorded_by_membership_id = excluded.recorded_by_membership_id
         returning id, institution_id as "institutionId", exam_id as "examId", student_id as "studentId", subject_id as "subjectId", marks_obtained as "marksObtained", max_marks as "maxMarks", grade, recorded_by_membership_id as "recordedByMembershipId"`,
        [institutionId, m.examId, m.studentId, m.subjectId, m.marksObtained ?? null, m.maxMarks, resolvedGrade ?? null, recordedByMembershipId]
      );
      results.push(rows[0]);
    }

    if (results.length > 0) {
      await logAudit(client, {
        institutionId,
        actorMembershipId: recordedByMembershipId,
        action: 'record_marks',
        entityType: 'mark',
        entityId: results[0].id,
        after: { count: results.length },
      });
    }

    return results;
  },

  // --- Employee & Staff Attendance ---
  async listEmployeeAttendance(
    client: PoolClient,
    institutionId: string,
    options: {
      date: string;
      roleId?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
      membershipId?: string;
    }
  ): Promise<{ employees: any[]; total: number }> {
    let whereClause = `where m.institution_id = $1 and m.status = 'active'`;
    const params: any[] = [institutionId, options.date];

    if (options.membershipId) {
      params.push(options.membershipId);
      whereClause += ` and m.id = $${params.length}`;
    }

    if (options.roleId && options.roleId !== 'all') {
      params.push(options.roleId);
      whereClause += ` and m.role_id = $${params.length}`;
    }

    if (options.search) {
      params.push(`%${options.search.trim().toLowerCase()}%`);
      whereClause += ` and (lower(p.name) like $${params.length} or lower(coalesce(p.email, '')) like $${params.length} or lower(coalesce(r.name, '')) like $${params.length})`;
    }

    if (options.status && options.status !== 'all') {
      if (options.status === 'unmarked') {
        whereClause += ` and ea.id is null`;
      } else {
        params.push(options.status);
        whereClause += ` and ea.status = $${params.length}`;
      }
    }

    const countQuery = `
      select count(*)::int as total
      from membership m
      join profile p on p.id = m.user_id
      left join role r on r.id = m.role_id
      left join employee_attendance ea on ea.membership_id = m.id and ea.date = $2 and ea.institution_id = $1
      ${whereClause}
    `;
    const { rows: countRows } = await client.query(countQuery, params);
    const total = countRows[0]?.total || 0;

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const queryParams = [...params, limit, offset];

    const dataQuery = `
      select
        m.id as "membershipId",
        p.name,
        coalesce(p.email, '') as email,
        p.phone,
        r.id as "roleId",
        coalesce(r.name, 'Staff') as "roleName",
        ea.id as "attendanceId",
        coalesce(ea.status, 'unmarked') as status,
        ea.check_in_time as "checkInTime",
        ea.check_out_time as "checkOutTime",
        ea.notes,
        coalesce(ea.date::text, $2) as date,
        ea.created_at as "recordedAt"
      from membership m
      join profile p on p.id = m.user_id
      left join role r on r.id = m.role_id
      left join employee_attendance ea on ea.membership_id = m.id and ea.date = $2 and ea.institution_id = $1
      ${whereClause}
      order by r.name asc, p.name asc
      limit $${queryParams.length - 1} offset $${queryParams.length}
    `;

    const { rows } = await client.query(dataQuery, queryParams);
    return { employees: rows, total };
  },

  async markEmployeeAttendanceBatch(
    client: PoolClient,
    institutionId: string,
    recordedByMembershipId: string | undefined,
    records: Array<{
      membershipId: string;
      date: string;
      status: string;
      checkInTime?: string;
      checkOutTime?: string;
      notes?: string;
    }>
  ): Promise<any[]> {
    const results: any[] = [];
    for (const r of records) {
      const { rows } = await client.query(
        `insert into public.employee_attendance (
           institution_id, membership_id, date, status, check_in_time, check_out_time, notes, recorded_by_membership_id, updated_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, now())
         on conflict (institution_id, membership_id, date) do update set
           status = excluded.status,
           check_in_time = coalesce(excluded.check_in_time, employee_attendance.check_in_time),
           check_out_time = coalesce(excluded.check_out_time, employee_attendance.check_out_time),
           notes = coalesce(excluded.notes, employee_attendance.notes),
           recorded_by_membership_id = excluded.recorded_by_membership_id,
           updated_at = now()
         returning id, institution_id as "institutionId", membership_id as "membershipId", date, status, check_in_time as "checkInTime", check_out_time as "checkOutTime", notes`,
        [
          institutionId,
          r.membershipId,
          r.date,
          r.status,
          r.checkInTime || null,
          r.checkOutTime || null,
          r.notes || null,
          recordedByMembershipId || null,
        ]
      );
      results.push(rows[0]);
    }

    if (results.length > 0) {
      await logAudit(client, {
        institutionId,
        actorMembershipId: recordedByMembershipId,
        action: 'mark_employee_attendance',
        entityType: 'employee_attendance',
        entityId: results[0].id,
        after: { count: results.length, date: records[0]?.date },
      });
    }

    return results;
  },

  async getEmployeeAttendanceSummary(
    client: PoolClient,
    institutionId: string,
    date: string
  ): Promise<{
    date: string;
    totalStaff: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    onLeaveToday: number;
    halfDayToday: number;
    unmarkedToday: number;
    attendanceRate: number;
  }> {
    const { rows: staffCountRows } = await client.query(
      `select count(*)::int as total from membership where institution_id = $1 and status = 'active'`,
      [institutionId]
    );
    const totalStaff = staffCountRows[0]?.total || 0;

    const { rows: statRows } = await client.query(
      `select
         count(*) filter (where status = 'present')::int as present,
         count(*) filter (where status = 'absent')::int as absent,
         count(*) filter (where status = 'late')::int as late,
         count(*) filter (where status in ('on_leave', 'leave'))::int as on_leave,
         count(*) filter (where status = 'half_day')::int as half_day
       from public.employee_attendance
       where institution_id = $1 and date = $2`,
      [institutionId, date]
    );

    const stats = statRows[0] || { present: 0, absent: 0, late: 0, on_leave: 0, half_day: 0 };
    const presentCount = stats.present || 0;
    const markedTotal = presentCount + stats.absent + stats.late + stats.on_leave + stats.half_day;
    const unmarkedToday = Math.max(0, totalStaff - markedTotal);
    const attendanceRate = totalStaff > 0 ? Math.round(((presentCount + (stats.late || 0)) / totalStaff) * 100) : 100;

    return {
      date,
      totalStaff,
      presentToday: presentCount,
      absentToday: stats.absent || 0,
      lateToday: stats.late || 0,
      onLeaveToday: stats.on_leave || 0,
      halfDayToday: stats.half_day || 0,
      unmarkedToday,
      attendanceRate,
    };
  },
};
