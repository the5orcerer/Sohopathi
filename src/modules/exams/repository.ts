import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { dispatchNotificationAndTask } from '../core/notification-task-service';
import { assertContentLength, CONTENT_LIMITS } from '../../core/validation/content-limits';

export interface Exam {
  id: string;
  institutionId: string;
  academicYearId: string;
  name: string;
  term: string | null;
  startDate: string | null;
  endDate: string | null;
  isPublished: boolean;
  status: 'draft' | 'scheduled' | 'running' | 'marks_collection' | 'under_review' | 'ready_to_publish' | 'published' | 'reopened' | 'archived';
  examType: string;
  examControllerMembershipId: string | null;
  classId: string | null;
  sectionId: string | null;
  description: string | null;
  instructions: string | null;
  gradingSystem: string;
  syllabusRemarks: string | null;
  paperCount?: number;
  candidateCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExamCandidate {
  id: string;
  institutionId: string;
  examId: string;
  studentId: string;
  studentName?: string;
  admissionNo?: string;
  rollNumber?: string;
  className?: string;
  sectionName?: string;
  status: 'eligible' | 'registered' | 'withheld' | 'exempted' | 'absent';
  createdAt: string;
}

export interface ExamPaper {
  id: string;
  institutionId: string;
  examId: string;
  subjectId: string;
  subjectName?: string;
  teacherMembershipId: string | null;
  teacherName?: string | null;
  examDate: string | null;
  startTime: string | null;
  endTime: string | null;
  roomNo: string | null;
  maxMarks: number;
  passMarks: number;
  theoryWeight: number;
  practicalWeight: number;
  vivaWeight: number;
  syllabus: string | null;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface ExamRoom {
  id: string;
  institutionId: string;
  examId: string;
  roomNumber: string;
  building: string | null;
  floor: string | null;
  capacity: number;
  guardMembershipIds: string[];
  guardNames?: string[];
  studentCount?: number;
  createdAt: string;
}

export interface Mark {
  id: string;
  institutionId: string;
  examId: string;
  studentId: string;
  studentName?: string;
  admissionNo?: string;
  rollNumber?: string;
  subjectId: string;
  subjectName?: string;
  marksObtained: number | null;
  maxMarks: number;
  grade: string | null;
  status: 'draft' | 'entered' | 'locked' | 'reopened';
  theoryMarks?: number | null;
  practicalMarks?: number | null;
  vivaMarks?: number | null;
  mcqMarks?: number | null;
  attendanceMarks?: number | null;
  graceMarks?: number | null;
  isAbsent: boolean;
  isExempt: boolean;
  gpa?: number | null;
  letterGrade?: string | null;
  remarks?: string | null;
  reopenReason?: string | null;
  recordedByMembershipId: string | null;
}

export function calculateGradeAndGPA(marksObtained: number | null, maxMarks: number, isAbsent = false, isExempt = false): { grade: string; letterGrade: string; gpa: number | null } {
  if (isAbsent) {
    return { grade: 'F', letterGrade: 'ABS', gpa: 0 };
  }
  if (isExempt) {
    return { grade: 'EX', letterGrade: 'EX', gpa: null };
  }
  if (marksObtained === null || maxMarks <= 0) {
    return { grade: 'F', letterGrade: 'N/A', gpa: 0 };
  }

  const percentage = (marksObtained / maxMarks) * 100;
  if (percentage >= 80) return { grade: 'A+', letterGrade: 'A+', gpa: 5.0 };
  if (percentage >= 70) return { grade: 'A', letterGrade: 'A', gpa: 4.0 };
  if (percentage >= 60) return { grade: 'A-', letterGrade: 'A-', gpa: 3.5 };
  if (percentage >= 50) return { grade: 'B', letterGrade: 'B', gpa: 3.0 };
  if (percentage >= 40) return { grade: 'C', letterGrade: 'C', gpa: 2.0 };
  if (percentage >= 33) return { grade: 'D', letterGrade: 'D', gpa: 1.0 };
  return { grade: 'F', letterGrade: 'F', gpa: 0 };
}

export const examRepository = {
  // ==========================================
  // 1. EXAMINATIONS
  // ==========================================
  async createExam(
    client: PoolClient,
    institutionId: string,
    actorMembershipId: string,
    data: {
      academicYearId: string;
      name: string;
      term?: string;
      startDate?: string;
      endDate?: string;
      examType?: string;
      examControllerMembershipId?: string | null;
      classId?: string | null;
      sectionId?: string | null;
      description?: string | null;
      instructions?: string | null;
      gradingSystem?: string;
      syllabusRemarks?: string | null;
      eligibleStudentIds?: string[] | null;
    }
  ): Promise<Exam> {
    assertContentLength(data.name, 'name', CONTENT_LIMITS.TITLE_MAX);
    if (data.description) assertContentLength(data.description, 'description', CONTENT_LIMITS.DESCRIPTION_MAX);
    if (data.instructions) assertContentLength(data.instructions, 'instructions', CONTENT_LIMITS.DESCRIPTION_MAX);
    if (data.syllabusRemarks) assertContentLength(data.syllabusRemarks, 'syllabusRemarks', CONTENT_LIMITS.DESCRIPTION_MAX);

    const examType = data.examType || 'term';
    const gradingSystem = data.gradingSystem || 'gpa';

    const { rows } = await client.query(
      `insert into exam (
         institution_id, academic_year_id, name, term, start_date, end_date,
         status, exam_type, exam_controller_membership_id, class_id, section_id,
         description, instructions, grading_system, syllabus_remarks
       ) values ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, $12, $13, $14)
       returning id, institution_id as "institutionId", academic_year_id as "academicYearId",
                 name, term, start_date as "startDate", end_date as "endDate",
                 is_published as "isPublished", status, exam_type as "examType",
                 exam_controller_membership_id as "examControllerMembershipId",
                 class_id as "classId", section_id as "sectionId", description, instructions,
                 grading_system as "gradingSystem", syllabus_remarks as "syllabusRemarks",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        institutionId,
        data.academicYearId,
        data.name.trim(),
        data.term ?? null,
        data.startDate ?? null,
        data.endDate ?? null,
        examType,
        data.examControllerMembershipId ?? null,
        data.classId ?? null,
        data.sectionId ?? null,
        data.description ?? null,
        data.instructions ?? null,
        gradingSystem,
        data.syllabusRemarks ?? null,
      ]
    );
    const exam = rows[0];

    // If explicit eligible students provided on creation, snapshot them
    if (data.eligibleStudentIds && data.eligibleStudentIds.length > 0) {
      await this.snapshotCandidates(client, institutionId, exam.id, {
        studentIds: data.eligibleStudentIds,
      });
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'create',
      entityType: 'exam',
      entityId: exam.id,
      after: exam,
    });

    return exam;
  },

  async updateExam(
    client: PoolClient,
    institutionId: string,
    examId: string,
    actorMembershipId: string,
    data: {
      name?: string;
      term?: string;
      startDate?: string;
      endDate?: string;
      isPublished?: boolean;
      status?: Exam['status'];
      examType?: string;
      examControllerMembershipId?: string | null;
      classId?: string | null;
      sectionId?: string | null;
      description?: string | null;
      instructions?: string | null;
      gradingSystem?: string;
      syllabusRemarks?: string | null;
      eligibleStudentIds?: string[] | null;
    }
  ): Promise<Exam> {
    if (data.name) assertContentLength(data.name, 'name', CONTENT_LIMITS.TITLE_MAX);
    if (data.description) assertContentLength(data.description, 'description', CONTENT_LIMITS.DESCRIPTION_MAX);
    if (data.instructions) assertContentLength(data.instructions, 'instructions', CONTENT_LIMITS.DESCRIPTION_MAX);
    if (data.syllabusRemarks) assertContentLength(data.syllabusRemarks, 'syllabusRemarks', CONTENT_LIMITS.DESCRIPTION_MAX);

    const { rows } = await client.query(
      `update exam
       set name = coalesce($1, name),
           term = coalesce($2, term),
           start_date = coalesce($3, start_date),
           end_date = coalesce($4, end_date),
           is_published = coalesce($5, is_published),
           status = coalesce($6, status),
           exam_type = coalesce($7, exam_type),
           exam_controller_membership_id = coalesce($8, exam_controller_membership_id),
           class_id = coalesce($9, class_id),
           section_id = coalesce($10, section_id),
           description = coalesce($11, description),
           instructions = coalesce($12, instructions),
           grading_system = coalesce($13, grading_system),
           syllabus_remarks = coalesce($14, syllabus_remarks),
           updated_at = now()
       where id = $15 and institution_id = $16
       returning id, institution_id as "institutionId", academic_year_id as "academicYearId",
                 name, term, start_date as "startDate", end_date as "endDate",
                 is_published as "isPublished", status, exam_type as "examType",
                 exam_controller_membership_id as "examControllerMembershipId",
                 class_id as "classId", section_id as "sectionId", description, instructions,
                 grading_system as "gradingSystem", syllabus_remarks as "syllabusRemarks",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.name?.trim() ?? null,
        data.term ?? null,
        data.startDate ?? null,
        data.endDate ?? null,
        data.isPublished ?? null,
        data.status ?? null,
        data.examType ?? null,
        data.examControllerMembershipId ?? null,
        data.classId ?? null,
        data.sectionId ?? null,
        data.description ?? null,
        data.instructions ?? null,
        data.gradingSystem ?? null,
        data.syllabusRemarks ?? null,
        examId,
        institutionId,
      ]
    );

    if (rows.length === 0) throw new Error('Exam not found');
    const updated = rows[0];

    if (data.eligibleStudentIds) {
      await this.snapshotCandidates(client, institutionId, examId, {
        studentIds: data.eligibleStudentIds,
      });
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update',
      entityType: 'exam',
      entityId: examId,
      after: updated,
    });

    return updated;
  },

  async deleteExam(client: PoolClient, institutionId: string, examId: string, actorMembershipId?: string): Promise<void> {
    await client.query(`delete from exam where id = $1 and institution_id = $2`, [examId, institutionId]);
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'delete',
      entityType: 'exam',
      entityId: examId,
    });
  },

  async listExams(
    client: PoolClient,
    institutionId: string,
    filters?: {
      academicYearId?: string;
      classId?: string;
      sectionId?: string;
      status?: string;
    }
  ): Promise<Exam[]> {
    let query = `
      select 
        e.id,
        e.institution_id as "institutionId",
        e.academic_year_id as "academicYearId",
        coalesce(ay.label, ay.name, '') as "academicYearLabel",
        e.name,
        e.term,
        e.start_date as "startDate",
        e.end_date as "endDate",
        e.is_published as "isPublished",
        coalesce(e.status, case when e.is_published then 'published' else 'draft' end) as "status",
        coalesce(e.exam_type, 'term') as "examType",
        e.exam_controller_membership_id as "examControllerMembershipId",
        coalesce(p.name, 'Unassigned') as "examControllerName",
        e.class_id as "classId",
        cls.name as "className",
        e.section_id as "sectionId",
        sec.name as "sectionName",
        e.description,
        e.instructions,
        coalesce(e.grading_system, 'gpa') as "gradingSystem",
        e.syllabus_remarks as "syllabusRemarks",
        (select count(*)::int from exam_paper ep where ep.exam_id = e.id) as "paperCount",
        (select count(*)::int from exam_candidate ec where ec.exam_id = e.id) as "candidateCount",
        e.created_at as "createdAt",
        e.updated_at as "updatedAt"
      from exam e
      left join academic_year ay on ay.id = e.academic_year_id
      left join class cls on cls.id = e.class_id
      left join section sec on sec.id = e.section_id
      left join membership m on m.id = e.exam_controller_membership_id
      left join profile p on p.id = m.user_id
      where e.institution_id = $1
    `;

    const params: any[] = [institutionId];
    if (filters?.academicYearId) {
      params.push(filters.academicYearId);
      query += ` and e.academic_year_id = $${params.length}`;
    }
    if (filters?.classId) {
      params.push(filters.classId);
      query += ` and e.class_id = $${params.length}`;
    }
    if (filters?.sectionId) {
      params.push(filters.sectionId);
      query += ` and e.section_id = $${params.length}`;
    }
    if (filters?.status) {
      params.push(filters.status);
      query += ` and e.status = $${params.length}`;
    }

    query += ` order by e.start_date desc nulls last, e.created_at desc`;

    const { rows } = await client.query(query, params);
    return rows;
  },

  async getExamById(client: PoolClient, institutionId: string, examId: string): Promise<Exam | null> {
    const exams = await this.listExams(client, institutionId);
    return exams.find((e) => e.id === examId) || null;
  },

  // ==========================================
  // 2. CANDIDATE SNAPSHOTTING (Blueprint Section 3 & 5)
  // ==========================================
  async snapshotCandidates(
    client: PoolClient,
    institutionId: string,
    examId: string,
    options: {
      classId?: string;
      sectionId?: string;
      gender?: string;
      rollRangeStart?: number;
      rollRangeEnd?: number;
      studentIds?: string[];
    }
  ): Promise<{ success: boolean; candidateCount: number }> {
    let eligibleQuery = `
      select distinct s.id as student_id, e.roll_no as roll_number
      from student s
      left join enrollment e on e.student_id = s.id and e.status = 'active'
      left join section sec on sec.id = e.section_id
      where s.institution_id = $1
    `;
    const params: any[] = [institutionId];

    if (options.studentIds && options.studentIds.length > 0) {
      params.push(options.studentIds);
      eligibleQuery += ` and s.id = any($${params.length})`;
    } else {
      if (options.sectionId) {
        params.push(options.sectionId);
        eligibleQuery += ` and e.section_id = $${params.length}`;
      } else if (options.classId) {
        params.push(options.classId);
        eligibleQuery += ` and sec.class_id = $${params.length}`;
      }
      if (options.gender) {
        params.push(options.gender.toLowerCase());
        eligibleQuery += ` and lower(s.gender) = $${params.length}`;
      }
      if (options.rollRangeStart !== undefined && options.rollRangeEnd !== undefined) {
        params.push(options.rollRangeStart);
        params.push(options.rollRangeEnd);
        eligibleQuery += ` and e.roll_no ~ '^[0-9]+$' and e.roll_no::int between $${params.length - 1} and $${params.length}`;
      }
    }

    const { rows: eligibleStudents } = await client.query(eligibleQuery, params);

    for (const st of eligibleStudents) {
      await client.query(
        `insert into exam_candidate (institution_id, exam_id, student_id, roll_number, status)
         values ($1, $2, $3, $4, 'eligible')
         on conflict (exam_id, student_id) do update set
           roll_number = coalesce(excluded.roll_number, exam_candidate.roll_number)`,
        [institutionId, examId, st.student_id, st.roll_number || null]
      );
    }

    await logAudit(client, {
      institutionId,
      action: 'snapshot_candidates',
      entityType: 'exam',
      entityId: examId,
      after: { snapshottedCount: eligibleStudents.length },
    });

    return { success: true, candidateCount: eligibleStudents.length };
  },

  async listCandidates(client: PoolClient, institutionId: string, examId: string): Promise<ExamCandidate[]> {
    const { rows } = await client.query(
      `select 
         ec.id,
         ec.institution_id as "institutionId",
         ec.exam_id as "examId",
         ec.student_id as "studentId",
         coalesce(p.name, s.name) as "studentName",
         s.admission_no as "admissionNo",
         coalesce(ec.roll_number, e.roll_no) as "rollNumber",
         cls.name as "className",
         sec.name as "sectionName",
         ec.status,
         ec.created_at as "createdAt"
       from exam_candidate ec
       join student s on s.id = ec.student_id
       left join profile p on p.id = s.user_id
       left join enrollment e on e.student_id = s.id and e.status = 'active'
       left join section sec on sec.id = e.section_id
       left join class cls on cls.id = sec.class_id
       where ec.institution_id = $1 and ec.exam_id = $2
       order by ec.roll_number asc nulls last, ec.created_at asc`,
      [institutionId, examId]
    );
    return rows;
  },

  // ==========================================
  // 3. EXAM PAPERS & SESSIONS (Blueprint Section 3 & 6)
  // ==========================================
  async createExamPaper(
    client: PoolClient,
    institutionId: string,
    examId: string,
    data: {
      subjectId: string;
      teacherMembershipId?: string | null;
      examDate?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      roomNo?: string | null;
      maxMarks?: number;
      passMarks?: number;
      theoryWeight?: number;
      practicalWeight?: number;
      vivaWeight?: number;
      syllabus?: string | null;
    }
  ): Promise<ExamPaper> {
    const maxMarks = data.maxMarks ?? 100;
    const passMarks = data.passMarks ?? 40;
    if (passMarks > maxMarks) {
      throw new Error('Pass marks cannot exceed maximum marks.');
    }

    const { rows } = await client.query(
      `insert into exam_paper (
         institution_id, exam_id, subject_id, teacher_membership_id,
         exam_date, start_time, end_time, room_no, max_marks, pass_marks,
         theory_weight, practical_weight, viva_weight, syllabus, status
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'scheduled')
       on conflict (exam_id, subject_id) do update set
         teacher_membership_id = coalesce(excluded.teacher_membership_id, exam_paper.teacher_membership_id),
         exam_date = coalesce(excluded.exam_date, exam_paper.exam_date),
         start_time = coalesce(excluded.start_time, exam_paper.start_time),
         end_time = coalesce(excluded.end_time, exam_paper.end_time),
         room_no = coalesce(excluded.room_no, exam_paper.room_no),
         max_marks = excluded.max_marks,
         pass_marks = excluded.pass_marks,
         theory_weight = excluded.theory_weight,
         practical_weight = excluded.practical_weight,
         viva_weight = excluded.viva_weight,
         syllabus = coalesce(excluded.syllabus, exam_paper.syllabus)
       returning id, institution_id as "institutionId", exam_id as "examId", subject_id as "subjectId",
                 teacher_membership_id as "teacherMembershipId", exam_date as "examDate",
                 start_time as "startTime", end_time as "endTime", room_no as "roomNo",
                 max_marks as "maxMarks", pass_marks as "passMarks", theory_weight as "theoryWeight",
                 practical_weight as "practicalWeight", viva_weight as "vivaWeight",
                 syllabus, status, created_at as "createdAt"`,
      [
        institutionId,
        examId,
        data.subjectId,
        data.teacherMembershipId ?? null,
        data.examDate ?? null,
        data.startTime ?? null,
        data.endTime ?? null,
        data.roomNo ?? null,
        maxMarks,
        passMarks,
        data.theoryWeight ?? 70,
        data.practicalWeight ?? 30,
        data.vivaWeight ?? 0,
        data.syllabus ?? null,
      ]
    );

    return rows[0];
  },

  async listExamPapers(client: PoolClient, institutionId: string, examId: string): Promise<ExamPaper[]> {
    const { rows } = await client.query(
      `select 
         ep.id,
         ep.institution_id as "institutionId",
         ep.exam_id as "examId",
         ep.subject_id as "subjectId",
         sub.name as "subjectName",
         ep.teacher_membership_id as "teacherMembershipId",
         coalesce(p.name, 'Unassigned') as "teacherName",
         ep.exam_date as "examDate",
         ep.start_time as "startTime",
         ep.end_time as "endTime",
         ep.room_no as "roomNo",
         ep.max_marks as "maxMarks",
         ep.pass_marks as "passMarks",
         ep.theory_weight as "theoryWeight",
         ep.practical_weight as "practicalWeight",
         ep.viva_weight as "vivaWeight",
         ep.syllabus,
         ep.status,
         ep.created_at as "createdAt"
       from exam_paper ep
       join subject sub on sub.id = ep.subject_id
       left join membership m on m.id = ep.teacher_membership_id
       left join profile p on p.id = m.user_id
       where ep.institution_id = $1 and ep.exam_id = $2
       order by ep.exam_date asc nulls last, ep.start_time asc nulls last`,
      [institutionId, examId]
    );
    return rows;
  },

  async deleteExamPaper(client: PoolClient, institutionId: string, examId: string, paperId: string): Promise<void> {
    await client.query(`delete from exam_paper where id = $1 and exam_id = $2 and institution_id = $3`, [paperId, examId, institutionId]);
  },

  // ==========================================
  // 4. EXAM ROOMS & GUARDS CONFLICT ENGINE (Blueprint Section 7)
  // ==========================================
  async createExamRoom(
    client: PoolClient,
    institutionId: string,
    examId: string,
    data: {
      roomNumber: string;
      building?: string | null;
      floor?: string | null;
      capacity?: number | null;
      guardMembershipIds?: string[];
      studentIds?: string[];
    }
  ): Promise<ExamRoom> {
    const capacity = data.capacity && data.capacity > 0 ? data.capacity : 40;
    const guards = data.guardMembershipIds || [];

    // 1. Guard Conflict Engine: verify no guard is already assigned to another room for this exam
    if (guards.length > 0) {
      const { rows: conflictingGuards } = await client.query(
        `select er.room_number, unnest(er.guard_membership_ids) as guard_id
         from exam_room er
         where er.institution_id = $1 and er.exam_id = $2 and er.guard_membership_ids && $3`,
        [institutionId, examId, guards]
      );
      if (conflictingGuards.length > 0) {
        throw new Error(
          `GUARD_CONFLICT: One or more selected invigilators/guards are already scheduled in Room ${conflictingGuards[0].room_number}.`
        );
      }
    }

    // 2. Capacity Check
    if (data.studentIds && data.studentIds.length > capacity) {
      throw new Error(
        `CAPACITY_EXCEEDED: Room capacity is ${capacity} students, but ${data.studentIds.length} candidates were assigned.`
      );
    }

    // 3. Insert Room
    const { rows } = await client.query(
      `insert into exam_room (institution_id, exam_id, room_number, building, floor, capacity, guard_membership_ids)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, institution_id as "institutionId", exam_id as "examId",
                 room_number as "roomNumber", building, floor, capacity,
                 guard_membership_ids as "guardMembershipIds", created_at as "createdAt"`,
      [institutionId, examId, data.roomNumber.trim(), data.building ?? null, data.floor ?? null, capacity, guards]
    );
    const room = rows[0];

    // 4. Allocate candidates
    if (data.studentIds && data.studentIds.length > 0) {
      for (const stId of data.studentIds) {
        await client.query(
          `insert into exam_room_candidate (exam_room_id, student_id)
           values ($1, $2)
           on conflict (exam_room_id, student_id) do nothing`,
          [room.id, stId]
        );
      }
    }

    return room;
  },

  async listExamRooms(client: PoolClient, institutionId: string, examId: string): Promise<ExamRoom[]> {
    const { rows } = await client.query(
      `select 
         er.id,
         er.institution_id as "institutionId",
         er.exam_id as "examId",
         er.room_number as "roomNumber",
         er.building,
         er.floor,
         er.capacity,
         er.guard_membership_ids as "guardMembershipIds",
         (select count(*)::int from exam_room_candidate erc where erc.exam_room_id = er.id) as "studentCount",
         er.created_at as "createdAt"
       from exam_room er
       where er.institution_id = $1 and er.exam_id = $2
       order by er.room_number asc`,
      [institutionId, examId]
    );

    // Populate guard names
    for (const room of rows) {
      if (room.guardMembershipIds && room.guardMembershipIds.length > 0) {
        const { rows: guardRows } = await client.query(
          `select coalesce(p.name, 'Teacher') as name
           from membership m
           join profile p on p.id = m.user_id
           where m.id = any($1)`,
          [room.guardMembershipIds]
        );
        room.guardNames = guardRows.map((g) => g.name);
      } else {
        room.guardNames = [];
      }
    }

    return rows;
  },

  async deleteExamRoom(client: PoolClient, institutionId: string, examId: string, roomId: string): Promise<void> {
    await client.query(`delete from exam_room where id = $1 and exam_id = $2 and institution_id = $3`, [roomId, examId, institutionId]);
  },

  // ==========================================
  // 5. MARKS ENTRY, SCOPING & STATE MACHINE (Blueprint Sections 9 & 10)
  // ==========================================
  async isSubjectTeacherForPaper(
    client: PoolClient,
    teacherMembershipId: string,
    examId: string,
    subjectId: string
  ): Promise<boolean> {
    const { rows } = await client.query(
      `select 1 from exam_paper ep
       where ep.exam_id = $1 and ep.subject_id = $2 and ep.teacher_membership_id = $3
       union
       select 1 from exam e
       where e.id = $1 and e.exam_controller_membership_id = $3
       union
       select 1 from membership_scope ms
       where ms.membership_id = $3 and ms.scope_type in ('institution', 'class')
       limit 1`,
      [examId, subjectId, teacherMembershipId]
    );
    return rows.length > 0;
  },

  async recordMarksBatch(
    client: PoolClient,
    institutionId: string,
    actorMembershipId: string,
    marks: Array<{
      examId: string;
      studentId: string;
      subjectId: string;
      marksObtained?: number | null;
      maxMarks: number;
      theoryMarks?: number | null;
      practicalMarks?: number | null;
      vivaMarks?: number | null;
      mcqMarks?: number | null;
      attendanceMarks?: number | null;
      graceMarks?: number | null;
      isAbsent?: boolean;
      isExempt?: boolean;
      remarks?: string | null;
    }>
  ): Promise<{ recordedCount: number }> {
    if (marks.length === 0) return { recordedCount: 0 };

    const firstExamId = marks[0].examId;
    const { rows: examRows } = await client.query(
      `select status, is_published from exam where id = $1 and institution_id = $2`,
      [firstExamId, institutionId]
    );
    if (examRows.length === 0) throw new Error('Exam not found');
    if (examRows[0].status === 'published' || examRows[0].is_published) {
      throw new Error('EXAM_LOCKED: Cannot modify marks for a published examination. Results must be reopened by an Exam Controller.');
    }

    for (const m of marks) {
      if (m.remarks) assertContentLength(m.remarks, 'remarks', CONTENT_LIMITS.REASON_MAX);

      // Verify boundary
      if (m.marksObtained !== undefined && m.marksObtained !== null) {
        if (m.marksObtained < 0) throw new Error('Marks cannot be negative.');
        if (m.marksObtained > m.maxMarks) {
          throw new Error(`Marks obtained (${m.marksObtained}) cannot exceed maximum marks (${m.maxMarks}).`);
        }
      }
      if (
        (m.theoryMarks !== undefined && m.theoryMarks !== null && m.theoryMarks < 0) ||
        (m.practicalMarks !== undefined && m.practicalMarks !== null && m.practicalMarks < 0) ||
        (m.vivaMarks !== undefined && m.vivaMarks !== null && m.vivaMarks < 0) ||
        (m.mcqMarks !== undefined && m.mcqMarks !== null && m.mcqMarks < 0) ||
        (m.attendanceMarks !== undefined && m.attendanceMarks !== null && m.attendanceMarks < 0) ||
        (m.graceMarks !== undefined && m.graceMarks !== null && m.graceMarks < 0)
      ) {
        throw new Error('Component marks cannot be negative.');
      }

      // Calculate total marks if components provided
      let totalMarks = m.marksObtained;
      if (m.theoryMarks !== undefined || m.practicalMarks !== undefined || m.mcqMarks !== undefined) {
        totalMarks =
          (m.theoryMarks || 0) +
          (m.practicalMarks || 0) +
          (m.vivaMarks || 0) +
          (m.mcqMarks || 0) +
          (m.attendanceMarks || 0) +
          (m.graceMarks || 0);
        if (totalMarks > m.maxMarks) {
          throw new Error(`Sum of component marks (${totalMarks}) cannot exceed maximum marks (${m.maxMarks}).`);
        }
      }

      const { grade, letterGrade, gpa } = calculateGradeAndGPA(totalMarks ?? null, m.maxMarks, m.isAbsent, m.isExempt);

      const { rows: priorMarkRows } = await client.query(
        `select id, marks_obtained, status from mark where exam_id = $1 and student_id = $2 and subject_id = $3`,
        [m.examId, m.studentId, m.subjectId]
      );

      const { rows: insertedRows } = await client.query(
        `insert into mark (
           institution_id, exam_id, student_id, subject_id, marks_obtained, max_marks,
           grade, letter_grade, gpa, recorded_by_membership_id, status, theory_marks,
           practical_marks, viva_marks, mcq_marks, attendance_marks, grace_marks,
           is_absent, is_exempt, remarks, updated_at
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'entered', $11, $12, $13, $14, $15, $16, $17, $18, $19, now()
         )
         on conflict (exam_id, student_id, subject_id) do update set
           marks_obtained = excluded.marks_obtained,
           max_marks = excluded.max_marks,
           grade = excluded.grade,
           letter_grade = excluded.letter_grade,
           gpa = excluded.gpa,
           recorded_by_membership_id = excluded.recorded_by_membership_id,
           status = 'entered',
           theory_marks = excluded.theory_marks,
           practical_marks = excluded.practical_marks,
           viva_marks = excluded.viva_marks,
           mcq_marks = excluded.mcq_marks,
           attendance_marks = excluded.attendance_marks,
           grace_marks = excluded.grace_marks,
           is_absent = excluded.is_absent,
           is_exempt = excluded.is_exempt,
           remarks = excluded.remarks,
           updated_at = now()
         returning id`,
        [
          institutionId,
          m.examId,
          m.studentId,
          m.subjectId,
          totalMarks ?? null,
          m.maxMarks,
          grade,
          letterGrade,
          gpa,
          actorMembershipId,
          m.theoryMarks ?? null,
          m.practicalMarks ?? null,
          m.vivaMarks ?? null,
          m.mcqMarks ?? null,
          m.attendanceMarks ?? null,
          m.graceMarks ?? null,
          m.isAbsent ?? false,
          m.isExempt ?? false,
          m.remarks ?? null,
        ]
      );

      // Audit log on mark entry / edit
      await logAudit(client, {
        institutionId,
        actorMembershipId,
        action: priorMarkRows.length > 0 ? 'update_marks' : 'create_marks',
        entityType: 'mark',
        entityId: insertedRows[0].id,
        before: priorMarkRows.length > 0 ? { marksObtained: priorMarkRows[0].marks_obtained, status: priorMarkRows[0].status } : undefined,
        after: { marksObtained: totalMarks, grade, letterGrade, gpa, status: 'entered' },
        reason: m.remarks ?? undefined,
      });
    }

    return { recordedCount: marks.length };
  },

  async fetchMarks(
    client: PoolClient,
    institutionId: string,
    filters: { examId?: string; studentId?: string; subjectId?: string }
  ): Promise<Mark[]> {
    let query = `
      select 
        m.id,
        m.institution_id as "institutionId",
        m.exam_id as "examId",
        m.student_id as "studentId",
        coalesce(p.name, s.name) as "studentName",
        s.admission_no as "admissionNo",
        e.roll_no as "rollNumber",
        m.subject_id as "subjectId",
        sub.name as "subjectName",
        m.marks_obtained as "marksObtained",
        m.max_marks as "maxMarks",
        m.grade,
        coalesce(m.status, 'entered') as "status",
        m.theory_marks as "theoryMarks",
        m.practical_marks as "practicalMarks",
        m.viva_marks as "vivaMarks",
        m.mcq_marks as "mcqMarks",
        m.attendance_marks as "attendanceMarks",
        m.grace_marks as "graceMarks",
        coalesce(m.is_absent, false) as "isAbsent",
        coalesce(m.is_exempt, false) as "isExempt",
        m.gpa,
        m.letter_grade as "letterGrade",
        m.remarks,
        m.reopen_reason as "reopenReason",
        m.recorded_by_membership_id as "recordedByMembershipId"
      from mark m
      join student s on s.id = m.student_id
      left join profile p on p.id = s.user_id
      left join subject sub on sub.id = m.subject_id
      left join exam ex on ex.id = m.exam_id
      left join enrollment e on e.student_id = s.id and e.section_id = ex.section_id and e.status = 'active'
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

    query += ` order by e.roll_no asc nulls last, s.name asc`;

    const { rows } = await client.query(query, params);
    return rows;
  },

  // ==========================================
  // 6. PROGRESS MATRIX & MONITORING (Blueprint Section 11 & 12)
  // ==========================================
  async getExamProgress(client: PoolClient, institutionId: string, examId: string): Promise<any> {
    const exam = await this.getExamById(client, institutionId, examId);
    if (!exam) throw new Error('Exam not found');

    const papers = await this.listExamPapers(client, institutionId, examId);
    const candidates = await this.listCandidates(client, institutionId, examId);
    const totalEligible = candidates.length;

    const paperProgressList: any[] = [];
    let totalEnteredAcrossAll = 0;
    const totalPossibleMarks = papers.length * totalEligible;

    for (const paper of papers) {
      const { rows: enteredRows } = await client.query(
        `select student_id from mark where exam_id = $1 and subject_id = $2 and marks_obtained is not null`,
        [examId, paper.subjectId]
      );
      const enteredStudentIds = new Set(enteredRows.map((r) => r.student_id));
      const missingStudents = candidates
        .filter((c) => !enteredStudentIds.has(c.studentId))
        .map((c) => ({
          studentId: c.studentId,
          name: c.studentName || 'Student',
          rollNumber: c.rollNumber,
        }));

      const enteredMarks = enteredRows.length;
      totalEnteredAcrossAll += enteredMarks;

      paperProgressList.push({
        paperId: paper.id,
        subjectName: paper.subjectName || 'Subject',
        teacherName: paper.teacherName,
        teacherMembershipId: paper.teacherMembershipId,
        totalEligible,
        enteredMarks,
        missingCount: missingStudents.length,
        missingStudents,
        isComplete: missingStudents.length === 0,
      });
    }

    const overallCompletionPercentage =
      totalPossibleMarks > 0 ? Math.round((totalEnteredAcrossAll / totalPossibleMarks) * 100) : 0;

    return {
      examId,
      examName: exam.name,
      isPublished: exam.isPublished,
      status: exam.status,
      totalEligibleStudents: totalEligible,
      overallCompletionPercentage,
      papers: paperProgressList,
    };
  },

  async notifyPendingTeachers(
    client: PoolClient,
    institutionId: string,
    examId: string,
    actorMembershipId: string
  ): Promise<{ notifiedCount: number; tasksCreated: number; message: string }> {
    const progress = await this.getExamProgress(client, institutionId, examId);
    let notifiedCount = 0;
    let tasksCreated = 0;

    for (const p of progress.papers) {
      if (!p.isComplete && p.teacherMembershipId) {
        try {
          await dispatchNotificationAndTask({
            client,
            institutionId,
            recipientMembershipIds: [p.teacherMembershipId],
            creatorMembershipId: actorMembershipId,
            title: `Pending Marks: ${progress.examName} (${p.subjectName})`,
            body: `You have ${p.missingCount} pending mark entries for ${p.subjectName} in ${progress.examName}. Please finalize marks promptly.`,
            priority: 'high',
            createTask: true,
            metadata: {
              entityType: 'exam',
              entityId: examId,
              subjectId: p.paperId,
              link: `/examinations?examId=${examId}&subjectId=${p.paperId}`,
            },
          });
          notifiedCount++;
          tasksCreated++;
        } catch (e) {
          // ignore notification failure
        }
      }
    }

    return {
      notifiedCount,
      tasksCreated,
      message: `Dispatched ${tasksCreated} reminder tasks to teachers with incomplete mark submissions.`,
    };
  },

  // ==========================================
  // 7. RESULT PUBLICATION & REOPEN (Blueprint Section 13 & 14)
  // ==========================================
  async publishExam(
    client: PoolClient,
    institutionId: string,
    examId: string,
    actorMembershipId: string
  ): Promise<{ success: boolean; message: string; isPublished: boolean }> {
    const exam = await this.getExamById(client, institutionId, examId);
    if (!exam) throw new Error('Exam not found');

    // Transition exam status to 'published' and set is_published = true
    await client.query(
      `update exam
       set status = 'published', is_published = true, updated_at = now()
       where id = $1 and institution_id = $2`,
      [examId, institutionId]
    );

    // Lock all marks
    await client.query(
      `update mark set status = 'locked', updated_at = now() where exam_id = $1 and institution_id = $2`,
      [examId, institutionId]
    );

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'publish_results',
      entityType: 'exam',
      entityId: examId,
      before: { status: exam.status, isPublished: exam.isPublished },
      after: { status: 'published', isPublished: true },
    });

    return {
      success: true,
      message: `Results for ${exam.name} have been finalized and published. Marks are now locked.`,
      isPublished: true,
    };
  },

  async reopenExam(
    client: PoolClient,
    institutionId: string,
    examId: string,
    actorMembershipId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    if (!reason || !reason.trim()) {
      throw new Error('REASON_REQUIRED: A valid reason is mandatory to reopen an examination session.');
    }
    assertContentLength(reason, 'reason', CONTENT_LIMITS.REASON_MAX);

    const exam = await this.getExamById(client, institutionId, examId);
    if (!exam) throw new Error('Exam not found');

    await client.query(
      `update exam
       set status = 'reopened', is_published = false, updated_at = now()
       where id = $1 and institution_id = $2`,
      [examId, institutionId]
    );

    await client.query(
      `update mark
       set status = 'reopened', reopen_reason = $1, updated_at = now()
       where exam_id = $2 and institution_id = $3`,
      [reason, examId, institutionId]
    );

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'reopen_results',
      entityType: 'exam',
      entityId: examId,
      before: { status: exam.status },
      after: { status: 'reopened', reason },
      reason,
    });

    return {
      success: true,
      message: `Results for ${exam.name} reopened for correction. Reason: ${reason}`,
    };
  },
};
