import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { assertContentLength, CONTENT_LIMITS } from '../../core/validation/content-limits';
import { dispatchNotificationAndTask } from '../core/notification-task-service';

export interface AttendanceRecord {
  id: string;
  institutionId: string;
  studentId: string;
  sectionId: string;
  date: string;
  status: string;
  recordedByMembershipId: string | null;
  sessionType?: string;
  periodNumber?: number;
  subjectId?: string | null;
  remarks?: string | null;
}

export interface AttendanceSheetItem {
  studentId: string;
  admissionNo: string;
  name: string;
  rollNo: string | null;
  status: string | null;
  attendanceId: string | null;
  sessionType?: string;
  periodNumber?: number;
  subjectId?: string | null;
  remarks?: string | null;
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
  examType: 'class_test' | 'term_exam';
  examControllerMembershipId?: string | null;
  examControllerName?: string | null;
  classId?: string | null;
  className?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  syllabusRemarks?: string | null;
  eligibleStudentIds?: string[] | null;
}

export interface ExamPaper {
  id: string;
  institutionId: string;
  examId: string;
  examName?: string;
  subjectId: string;
  subjectName?: string;
  teacherMembershipId?: string | null;
  teacherName?: string | null;
  syllabus?: string | null;
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

export interface ExamRoomAssignment {
  id: string;
  institutionId: string;
  examId: string;
  paperId?: string | null;
  subjectName?: string | null;
  roomNumber: string;
  classroomId?: string | null;
  guardMembershipIds?: string[];
  guardNames?: string[];
  startRoll?: number | null;
  endRoll?: number | null;
  studentIds?: string[];
  createdAt: string;
}

export interface Mark {
  id: string;
  institutionId: string;
  examId: string;
  studentId: string;
  studentName?: string;
  admissionNo?: string;
  rollNo?: string;
  subjectId: string;
  subjectName?: string;
  marksObtained: number | null;
  maxMarks: number;
  grade: string | null;
  recordedByMembershipId: string | null;
  remarks?: string | null;
  isRechecked?: boolean;
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
    records: {
      studentId: string;
      sectionId: string;
      date: string;
      status: string;
      sessionType?: string;
      periodNumber?: number;
      subjectId?: string;
      remarks?: string;
      reason?: string;
    }[]
  ): Promise<AttendanceRecord[]> {
    const results: AttendanceRecord[] = [];
    let updatedCount = 0;

    for (const r of records) {
      const sessionType = r.sessionType || 'daily';
      const periodNumber = r.periodNumber ?? 1;

      if (r.reason) {
        assertContentLength(r.reason, 'reason', CONTENT_LIMITS.REASON_MAX);
      }
      if (r.remarks) {
        assertContentLength(r.remarks, 'remarks', CONTENT_LIMITS.SHORT_DESCRIPTION_MAX);
      }

      // Check for prior record to detect edits (Blueprint Section 27: Attendance Editing)
      const { rows: priorRows } = await client.query(
        `select id, status from attendance where student_id = $1 and date = $2 and coalesce(session_type, 'daily') = $3 and coalesce(period_number, 1) = $4 limit 1`,
        [r.studentId, r.date, sessionType, periodNumber]
      );

      const isEdit = priorRows.length > 0 && priorRows[0].status !== r.status;

      let rows: any[];
      try {
        const insertRes = await client.query(
          `insert into attendance (
             institution_id, student_id, section_id, date, status, recorded_by_membership_id,
             session_type, period_number, subject_id, remarks
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           on conflict (student_id, date, session_type, period_number) do update set
             status = excluded.status,
             section_id = excluded.section_id,
             recorded_by_membership_id = excluded.recorded_by_membership_id,
             subject_id = coalesce(excluded.subject_id, attendance.subject_id),
             remarks = coalesce(excluded.remarks, attendance.remarks)
           returning id, institution_id as "institutionId", student_id as "studentId", section_id as "sectionId",
                     date, status, recorded_by_membership_id as "recordedByMembershipId",
                     session_type as "sessionType", period_number as "periodNumber", subject_id as "subjectId", remarks`,
          [
            institutionId,
            r.studentId,
            r.sectionId,
            r.date,
            r.status,
            recordedByMembershipId,
            sessionType,
            periodNumber,
            r.subjectId || null,
            r.remarks || null,
          ]
        );
        rows = insertRes.rows;
      } catch (err: any) {
        // Fallback gracefully for environments with legacy unique (student_id, date) constraint
        const fallbackRes = await client.query(
          `insert into attendance (institution_id, student_id, section_id, date, status, recorded_by_membership_id)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (student_id, date) do update set
             status = excluded.status,
             section_id = excluded.section_id,
             recorded_by_membership_id = excluded.recorded_by_membership_id
           returning id, institution_id as "institutionId", student_id as "studentId", section_id as "sectionId",
                     date, status, recorded_by_membership_id as "recordedByMembershipId"`,
          [institutionId, r.studentId, r.sectionId, r.date, r.status, recordedByMembershipId]
        );
        rows = fallbackRes.rows;
      }

      results.push(rows[0]);

      if (isEdit) {
        updatedCount++;
        await logAudit(client, {
          institutionId,
          actorMembershipId: recordedByMembershipId,
          action: 'update_attendance',
          entityType: 'attendance',
          entityId: rows[0].id,
          before: { status: priorRows[0].status },
          after: { status: r.status, reason: r.reason || 'Attendance modified' },
          reason: r.reason || 'Attendance status adjusted',
        });
      }
    }

    if (results.length > 0 && updatedCount === 0) {
      await logAudit(client, {
        institutionId,
        actorMembershipId: recordedByMembershipId,
        action: 'mark_attendance',
        entityType: 'attendance',
        entityId: results[0].id,
        after: { count: results.length, date: records[0]?.date, sessionType: records[0]?.sessionType || 'daily' },
      });
    }

    return results;
  },

  async getAttendanceSheet(
    client: PoolClient,
    institutionId: string,
    sectionId: string,
    date: string,
    sessionType = 'daily',
    periodNumber = 1
  ): Promise<AttendanceSheetItem[]> {
    const { rows } = await client.query(
      `select 
        s.id as "studentId",
        s.admission_no as "admissionNo",
        s.name,
        e.roll_no as "rollNo",
        a.status,
        a.id as "attendanceId",
        coalesce(a.session_type, $3) as "sessionType",
        coalesce(a.period_number, $4) as "periodNumber",
        a.subject_id as "subjectId",
        a.remarks
       from enrollment e
       join student s on s.id = e.student_id
       left join attendance a on a.student_id = s.id and a.date = $2 and coalesce(a.session_type, 'daily') = $3 and coalesce(a.period_number, 1) = $4
       where e.section_id = $1 and e.status = 'active'
       order by e.roll_no asc, s.name asc`,
      [sectionId, date, sessionType, periodNumber]
    );
    return rows;
  },

  async listAttendance(
    client: PoolClient,
    institutionId: string,
    filters: {
      sectionId?: string;
      date?: string;
      studentId?: string;
      allowedSectionIds?: string[];
      sessionType?: string;
      periodNumber?: number;
      subjectId?: string;
    }
  ): Promise<AttendanceRecord[]> {
    let query = `select id, institution_id as "institutionId", student_id as "studentId", section_id as "sectionId", date, status, recorded_by_membership_id as "recordedByMembershipId", session_type as "sessionType", period_number as "periodNumber", subject_id as "subjectId", remarks from attendance where institution_id = $1`;
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

    if (filters.sessionType) {
      params.push(filters.sessionType);
      query += ` and session_type = $${params.length}`;
    }

    if (filters.periodNumber !== undefined) {
      params.push(filters.periodNumber);
      query += ` and period_number = $${params.length}`;
    }

    if (filters.subjectId) {
      params.push(filters.subjectId);
      query += ` and subject_id = $${params.length}`;
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
        coalesce(e.exam_type, 'term_exam') as "examType",
        e.exam_controller_membership_id as "examControllerMembershipId",
        cp.name as "examControllerName",
        e.class_id as "classId",
        cls.name as "className",
        e.section_id as "sectionId",
        sec.name as "sectionName",
        e.syllabus_remarks as "syllabusRemarks",
        e.eligible_student_ids as "eligibleStudentIds",
        (select count(*)::int from exam_paper ep where ep.exam_id = e.id) as "paperCount"
      from exam e
      left join academic_year ay on ay.id = e.academic_year_id
      left join membership cm on cm.id = e.exam_controller_membership_id
      left join profile cp on cp.id = cm.user_id
      left join class cls on cls.id = e.class_id
      left join section sec on sec.id = e.section_id
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
    data: {
      academicYearId: string;
      name: string;
      term?: string;
      startDate?: string;
      endDate?: string;
      examType?: 'class_test' | 'term_exam';
      examControllerMembershipId?: string;
      classId?: string;
      sectionId?: string;
      syllabusRemarks?: string;
      eligibleStudentIds?: string[];
    },
    actorMembershipId?: string
  ): Promise<Exam> {
    const { rows } = await client.query(
      `insert into exam (
         institution_id, academic_year_id, name, term, start_date, end_date, is_published,
         exam_type, exam_controller_membership_id, class_id, section_id, syllabus_remarks, eligible_student_ids
       )
       values ($1, $2, $3, $4, $5, $6, false, coalesce($7, 'term_exam'), $8, $9, $10, $11, coalesce($12::uuid[], '{}'::uuid[]))
       returning 
         id, institution_id as "institutionId", academic_year_id as "academicYearId", name, term,
         start_date as "startDate", end_date as "endDate", is_published as "isPublished",
         exam_type as "examType", exam_controller_membership_id as "examControllerMembershipId",
         class_id as "classId", section_id as "sectionId", syllabus_remarks as "syllabusRemarks",
         eligible_student_ids as "eligibleStudentIds"`,
      [
        institutionId,
        data.academicYearId,
        data.name.trim(),
        data.term || null,
        data.startDate || null,
        data.endDate || null,
        data.examType || 'term_exam',
        data.examControllerMembershipId || null,
        data.classId || null,
        data.sectionId || null,
        data.syllabusRemarks || null,
        data.eligibleStudentIds || null,
      ]
    );
    const exam = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'exam', entityId: exam.id, after: exam });
    return exam;
  },

  async updateExam(
    client: PoolClient,
    institutionId: string,
    examId: string,
    data: {
      name?: string;
      term?: string;
      startDate?: string;
      endDate?: string;
      isPublished?: boolean;
      examType?: 'class_test' | 'term_exam';
      examControllerMembershipId?: string;
      classId?: string;
      sectionId?: string;
      syllabusRemarks?: string;
      eligibleStudentIds?: string[];
    },
    actorMembershipId?: string
  ): Promise<Exam> {
    const { rows } = await client.query(
      `update exam set
         name = coalesce($1, name),
         term = coalesce($2, term),
         start_date = coalesce($3, start_date),
         end_date = coalesce($4, end_date),
         is_published = coalesce($5, is_published),
         exam_type = coalesce($6, exam_type),
         exam_controller_membership_id = coalesce($7, exam_controller_membership_id),
         class_id = coalesce($8, class_id),
         section_id = coalesce($9, section_id),
         syllabus_remarks = coalesce($10, syllabus_remarks),
         eligible_student_ids = coalesce($11::uuid[], eligible_student_ids)
       where id = $12 and institution_id = $13
       returning 
         id, institution_id as "institutionId", academic_year_id as "academicYearId", name, term,
         start_date as "startDate", end_date as "endDate", is_published as "isPublished",
         exam_type as "examType", exam_controller_membership_id as "examControllerMembershipId",
         class_id as "classId", section_id as "sectionId", syllabus_remarks as "syllabusRemarks",
         eligible_student_ids as "eligibleStudentIds"`,
      [
        data.name?.trim() || null,
        data.term || null,
        data.startDate || null,
        data.endDate || null,
        data.isPublished,
        data.examType || null,
        data.examControllerMembershipId || null,
        data.classId || null,
        data.sectionId || null,
        data.syllabusRemarks || null,
        data.eligibleStudentIds || null,
        examId,
        institutionId,
      ]
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
        ep.teacher_membership_id as "teacherMembershipId",
        tp.name as "teacherName",
        ep.syllabus,
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
       left join membership tm on tm.id = ep.teacher_membership_id
       left join profile tp on tp.id = tm.user_id
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
      teacherMembershipId?: string;
      syllabus?: string;
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
      `insert into exam_paper (
         institution_id, exam_id, subject_id, teacher_membership_id, syllabus,
         exam_date, start_time, end_time, room_no, max_marks, pass_marks, theory_weight, practical_weight, viva_weight
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, 100), coalesce($11, 40), coalesce($12, 70), coalesce($13, 30), coalesce($14, 0))
       returning 
         id, institution_id as "institutionId", exam_id as "examId", subject_id as "subjectId",
         teacher_membership_id as "teacherMembershipId", syllabus,
         exam_date as "examDate", start_time as "startTime", end_time as "endTime", room_no as "roomNo",
         max_marks as "maxMarks", pass_marks as "passMarks", theory_weight as "theoryWeight",
         practical_weight as "practicalWeight", viva_weight as "vivaWeight", created_at as "createdAt"`,
      [
        institutionId,
        data.examId,
        data.subjectId,
        data.teacherMembershipId || null,
        data.syllabus || null,
        data.examDate || null,
        data.startTime || null,
        data.endTime || null,
        data.roomNo || null,
        data.maxMarks,
        data.passMarks,
        data.theoryWeight,
        data.practicalWeight,
        data.vivaWeight,
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

  // --- Exam Room & Seating Allocations ---
  async listExamRooms(client: PoolClient, institutionId: string, examId: string): Promise<ExamRoomAssignment[]> {
    const { rows } = await client.query(
      `select 
        r.id,
        r.institution_id as "institutionId",
        r.exam_id as "examId",
        r.paper_id as "paperId",
        sub.name as "subjectName",
        r.room_number as "roomNumber",
        r.classroom_id as "classroomId",
        r.guard_membership_ids as "guardMembershipIds",
        r.start_roll as "startRoll",
        r.end_roll as "endRoll",
        r.student_ids as "studentIds",
        r.created_at as "createdAt"
       from exam_room_assignment r
       left join exam_paper ep on ep.id = r.paper_id
       left join subject sub on sub.id = ep.subject_id
       where r.institution_id = $1 and r.exam_id = $2
       order by r.room_number asc`,
      [institutionId, examId]
    );

    for (const row of rows) {
      if (row.guardMembershipIds && row.guardMembershipIds.length > 0) {
        const { rows: guardRows } = await client.query(
          `select p.name from membership m join profile p on p.id = m.user_id where m.id = any($1)`,
          [row.guardMembershipIds]
        );
        row.guardNames = guardRows.map((g: any) => g.name);
      } else {
        row.guardNames = [];
      }
    }
    return rows;
  },

  async createExamRoom(
    client: PoolClient,
    institutionId: string,
    data: {
      examId: string;
      paperId?: string;
      roomNumber: string;
      classroomId?: string;
      guardMembershipIds?: string[];
      startRoll?: number;
      endRoll?: number;
      studentIds?: string[];
    },
    actorMembershipId?: string
  ): Promise<ExamRoomAssignment> {
    const { rows } = await client.query(
      `insert into exam_room_assignment (
         institution_id, exam_id, paper_id, room_number, classroom_id, guard_membership_ids, start_roll, end_roll, student_ids
       )
       values ($1, $2, $3, $4, $5, coalesce($6::uuid[], '{}'::uuid[]), $7, $8, coalesce($9::uuid[], '{}'::uuid[]))
       returning 
         id, institution_id as "institutionId", exam_id as "examId", paper_id as "paperId",
         room_number as "roomNumber", classroom_id as "classroomId", guard_membership_ids as "guardMembershipIds",
         start_roll as "startRoll", end_roll as "endRoll", student_ids as "studentIds", created_at as "createdAt"`,
      [
        institutionId,
        data.examId,
        data.paperId || null,
        data.roomNumber.trim(),
        data.classroomId || null,
        data.guardMembershipIds || [],
        data.startRoll ?? null,
        data.endRoll ?? null,
        data.studentIds || [],
      ]
    );
    const item = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'exam_room_assignment', entityId: item.id, after: item });
    return item;
  },

  async deleteExamRoom(client: PoolClient, institutionId: string, roomId: string, actorMembershipId?: string): Promise<void> {
    await client.query(`delete from exam_room_assignment where id = $1 and institution_id = $2`, [roomId, institutionId]);
    await logAudit(client, { institutionId, actorMembershipId, action: 'delete', entityType: 'exam_room_assignment', entityId: roomId });
  },

  // --- Real-time Exam Progress Tracking ---
  async getExamProgress(client: PoolClient, institutionId: string, examId: string): Promise<any> {
    const exams = await this.listExams(client, institutionId);
    const exam = exams.find((e) => e.id === examId);
    if (!exam) throw new Error('Exam not found');

    let eligibleStudents: any[] = [];
    if (exam.eligibleStudentIds && exam.eligibleStudentIds.length > 0) {
      const { rows } = await client.query(
        `select s.id, s.name, e.roll_no as "rollNo", s.admission_no as "admissionNo"
         from student s
         left join enrollment e on e.student_id = s.id and e.status = 'active'
         where s.institution_id = $1 and s.id = any($2)
         order by e.roll_no asc nulls last, s.name asc`,
        [institutionId, exam.eligibleStudentIds]
      );
      eligibleStudents = rows;
    } else if (exam.sectionId) {
      const { rows } = await client.query(
        `select s.id, s.name, e.roll_no as "rollNo", s.admission_no as "admissionNo"
         from enrollment e
         join student s on s.id = e.student_id
         where e.institution_id = $1 and e.section_id = $2 and e.status = 'active'
         order by e.roll_no asc nulls last, s.name asc`,
        [institutionId, exam.sectionId]
      );
      eligibleStudents = rows;
    } else if (exam.classId) {
      const { rows } = await client.query(
        `select s.id, s.name, e.roll_no as "rollNo", s.admission_no as "admissionNo"
         from enrollment e
         join section sec on sec.id = e.section_id
         join student s on s.id = e.student_id
         where e.institution_id = $1 and sec.class_id = $2 and e.status = 'active'
         order by e.roll_no asc nulls last, s.name asc`,
        [institutionId, exam.classId]
      );
      eligibleStudents = rows;
    } else {
      const { rows } = await client.query(
        `select distinct on (s.id) s.id, s.name, e.roll_no as "rollNo", s.admission_no as "admissionNo"
         from enrollment e
         join student s on s.id = e.student_id
         where e.institution_id = $1 and e.status = 'active'
         order by s.id, e.roll_no asc nulls last, s.name asc`,
        [institutionId]
      );
      eligibleStudents = rows;
    }

    const papers = await this.listExamPapers(client, institutionId, examId);
    const paperProgress = [];

    for (const paper of papers) {
      const { rows: markedRows } = await client.query(
        `select student_id from mark where exam_id = $1 and subject_id = $2 and marks_obtained is not null`,
        [examId, paper.subjectId]
      );
      const markedMap = new Set(markedRows.map((r) => r.student_id));

      const pendingStudents = eligibleStudents.filter((s) => !markedMap.has(s.id));
      const markedCount = eligibleStudents.length - pendingStudents.length;
      const completionRate = eligibleStudents.length > 0 ? Math.round((markedCount / eligibleStudents.length) * 100) : 0;

      paperProgress.push({
        paperId: paper.id,
        subjectId: paper.subjectId,
        subjectName: paper.subjectName,
        teacherMembershipId: paper.teacherMembershipId,
        teacherName: paper.teacherName,
        totalEligible: eligibleStudents.length,
        markedCount,
        pendingCount: pendingStudents.length,
        completionRate,
        pendingRolls: pendingStudents.map((s) => s.rollNo).filter(Boolean),
        pendingStudents: pendingStudents.map((s) => ({ id: s.id, name: s.name, rollNo: s.rollNo })),
      });
    }

    const totalEligibleTotal = paperProgress.reduce((sum, p) => sum + p.totalEligible, 0);
    const totalMarkedTotal = paperProgress.reduce((sum, p) => sum + p.markedCount, 0);
    const overallCompletionRate = totalEligibleTotal > 0 ? Math.round((totalMarkedTotal / totalEligibleTotal) * 100) : 0;

    return {
      exam,
      totalEligibleStudents: eligibleStudents.length,
      overallCompletionRate,
      papers: paperProgress,
    };
  },

  async notifyPendingTeachers(
    client: PoolClient,
    institutionId: string,
    examId: string,
    actorMembershipId?: string
  ): Promise<{ success: boolean; notifiedCount: number }> {
    const progress = await this.getExamProgress(client, institutionId, examId);
    let notifiedCount = 0;

    for (const paper of progress.papers) {
      if (paper.pendingCount > 0 && paper.teacherMembershipId) {
        await dispatchNotificationAndTask({
          client,
          institutionId,
          creatorMembershipId: actorMembershipId,
          recipientMembershipIds: [paper.teacherMembershipId],
          title: `Action Required: Submit Marks for ${paper.subjectName}`,
          body: `You have ${paper.pendingCount} students missing marks for ${paper.subjectName} (${progress.exam.name}). Missing rolls: ${paper.pendingRolls.join(', ') || 'N/A'}. Please enter marks promptly.`,
          type: 'exam_marks_reminder',
          priority: 'high',
          createTask: true,
          metadata: { examId, subjectId: paper.subjectId, paperId: paper.paperId },
        });
        notifiedCount++;
      }
    }

    return { success: true, notifiedCount };
  },

  async publishExam(
    client: PoolClient,
    institutionId: string,
    examId: string,
    actorMembershipId?: string
  ): Promise<{ success: boolean; studentNotificationCount: number }> {
    await client.query(`update exam set is_published = true where id = $1 and institution_id = $2`, [examId, institutionId]);

    const progress = await this.getExamProgress(client, institutionId, examId);
    let count = 0;

    const studentUserIds: string[] = [];
    const studentIds = progress.exam.eligibleStudentIds && progress.exam.eligibleStudentIds.length > 0
      ? progress.exam.eligibleStudentIds
      : progress.papers[0]?.pendingStudents?.map((s: any) => s.id) || [];

    if (studentIds.length > 0) {
      const { rows } = await client.query(
        `select user_id from student where institution_id = $1 and id = any($2) and user_id is not null`,
        [institutionId, studentIds]
      );
      for (const r of rows) studentUserIds.push(r.user_id);
    }

    if (studentUserIds.length > 0) {
      const res = await dispatchNotificationAndTask({
        client,
        institutionId,
        creatorMembershipId: actorMembershipId,
        recipientUserIds: studentUserIds,
        title: `Results Published: ${progress.exam.name}`,
        body: `Your examination results and marksheet for ${progress.exam.name} have been published. View your marksheet from your dashboard.`,
        type: 'exam_results',
        priority: 'high',
        createTask: false,
        metadata: { examId },
      });
      count = res.notificationsSent;
    }

    await logAudit(client, { institutionId, actorMembershipId, action: 'publish_exam', entityType: 'exam', entityId: examId });

    return { success: true, studentNotificationCount: count };
  },

  async isTeacherAssignedToSubjectSection(
    client: PoolClient,
    teacherMembershipId: string,
    sectionId: string,
    subjectId: string
  ): Promise<boolean> {
    const { rows } = await client.query(
      `select 1
       from class_subject_teacher cst
       where cst.section_id = $2 and cst.subject_id = $3 and cst.teacher_membership_id = $1
       union
       select 1
       from membership_scope ms
       where ms.membership_id = $1 and ms.scope_type in ('institution', 'section')
       limit 1`,
      [teacherMembershipId, sectionId, subjectId]
    );
    return rows.length > 0;
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
        s.roll_no as "rollNo",
        m.subject_id as "subjectId",
        sub.name as "subjectName",
        m.marks_obtained as "marksObtained",
        m.max_marks as "maxMarks",
        m.grade,
        m.recorded_by_membership_id as "recordedByMembershipId",
        m.remarks,
        m.is_rechecked as "isRechecked"
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

    query += ` order by s.roll_no asc nulls last, s.name asc`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async recordMarks(
    client: PoolClient,
    institutionId: string,
    recordedByMembershipId: string,
    marks: {
      examId: string;
      studentId: string;
      subjectId: string;
      marksObtained?: number;
      maxMarks: number;
      grade?: string;
      remarks?: string;
      isRechecked?: boolean;
    }[]
  ): Promise<Mark[]> {
    if (marks.length === 0) return [];

    // Check if exam is published
    const examId = marks[0].examId;
    const { rows: examRows } = await client.query(
      `select is_published, exam_controller_membership_id from exam where id = $1 and institution_id = $2`,
      [examId, institutionId]
    );
    if (examRows.length > 0 && examRows[0].is_published) {
      const isController = examRows[0].exam_controller_membership_id === recordedByMembershipId;
      const { rows: roleRows } = await client.query(
        `select r.name from membership m join role r on r.id = m.role_id where m.id = $1 limit 1`,
        [recordedByMembershipId]
      );
      const isAdmin = roleRows[0]?.name?.toLowerCase().includes('admin');
      if (!isController && !isAdmin) {
        throw new Error('This exam is already published. Only the Exam Controller or Institution Admin can adjust marks.');
      }
    }

    const results: Mark[] = [];
    for (const m of marks) {
      let resolvedGrade = m.grade;
      if (!resolvedGrade && m.marksObtained !== undefined && m.marksObtained !== null) {
        const pct = (m.marksObtained / m.maxMarks) * 100;
        resolvedGrade = calculateLetterGrade(pct);
      }

      const isRecheckedVal = m.isRechecked || (examRows[0]?.is_published ? true : false);
      const recheckedBy = isRecheckedVal ? recordedByMembershipId : null;

      const { rows } = await client.query(
        `insert into mark (
           institution_id, exam_id, student_id, subject_id, marks_obtained, max_marks, grade,
           recorded_by_membership_id, remarks, is_rechecked, rechecked_by_membership_id
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (exam_id, student_id, subject_id) do update
         set marks_obtained = excluded.marks_obtained,
             max_marks = excluded.max_marks,
             grade = excluded.grade,
             recorded_by_membership_id = excluded.recorded_by_membership_id,
             remarks = coalesce(excluded.remarks, mark.remarks),
             is_rechecked = case when excluded.is_rechecked then true else mark.is_rechecked end,
             rechecked_by_membership_id = coalesce(excluded.rechecked_by_membership_id, mark.rechecked_by_membership_id)
         returning 
           id, institution_id as "institutionId", exam_id as "examId", student_id as "studentId",
           subject_id as "subjectId", marks_obtained as "marksObtained", max_marks as "maxMarks",
           grade, recorded_by_membership_id as "recordedByMembershipId", remarks, is_rechecked as "isRechecked"`,
        [
          institutionId,
          m.examId,
          m.studentId,
          m.subjectId,
          m.marksObtained ?? null,
          m.maxMarks,
          resolvedGrade ?? null,
          recordedByMembershipId,
          m.remarks || null,
          isRecheckedVal,
          recheckedBy,
        ]
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
  ): Promise<any> {
    let whereClause = `where m.institution_id = $1 and m.status = 'active' and lower(coalesce(r.name, '')) not in ('student', 'guardian')`;
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
      reason?: string;
    }>
  ): Promise<any[]> {
    const results: any[] = [];
    let updatedCount = 0;

    for (const r of records) {
      if (r.notes) {
        assertContentLength(r.notes, 'notes', CONTENT_LIMITS.SHORT_DESCRIPTION_MAX);
      }
      if (r.reason) {
        assertContentLength(r.reason, 'reason', CONTENT_LIMITS.REASON_MAX);
      }

      // Check for prior record to track changes and audit logging
      const { rows: priorRows } = await client.query(
        `select id, status from public.employee_attendance where institution_id = $1 and membership_id = $2 and date = $3`,
        [institutionId, r.membershipId, r.date]
      );
      const isEdit = priorRows.length > 0 && priorRows[0].status !== r.status;

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

      if (isEdit) {
        updatedCount++;
        const editReason = r.reason || r.notes || 'Employee attendance modified';
        await logAudit(client, {
          institutionId,
          actorMembershipId: recordedByMembershipId,
          action: 'update_employee_attendance',
          entityType: 'employee_attendance',
          entityId: rows[0].id,
          before: { status: priorRows[0].status },
          after: { status: r.status, reason: editReason },
          reason: editReason,
        });
      }
    }

    if (results.length > 0 && updatedCount === 0) {
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
