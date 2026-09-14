import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { dispatchNotificationAndTask } from '../core/notification-task-service';

export interface Assignment {
  id: string;
  institutionId: string;
  sectionId: string;
  subjectId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  createdByMembershipId: string | null;
  createdAt: string;
}

export interface AssignmentAttachment {
  id: string;
  institutionId: string;
  assignmentId: string;
  fileKey: string;
  fileName: string;
}

export interface AssignmentSubmission {
  id: string;
  institutionId: string;
  assignmentId: string;
  studentId: string;
  studentName?: string;
  rollNumber?: string;
  fileKey: string | null;
  fileUrl?: string | null;
  submissionNotes?: string | null;
  submittedAt: string;
  status: string;
  grade?: string | null;
  feedback?: string | null;
}

export const assignmentRepository = {
  async create(
    client: PoolClient,
    institutionId: string,
    createdByMembershipId: string,
    data: { sectionId: string; subjectId: string; title: string; description?: string; dueDate?: string }
  ): Promise<Assignment> {
    const { rows } = await client.query(
      `insert into assignment (institution_id, section_id, subject_id, title, description, due_date, created_by_membership_id)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, institution_id as "institutionId", section_id as "sectionId", subject_id as "subjectId", title, description, due_date as "dueDate", created_by_membership_id as "createdByMembershipId", created_at as "createdAt"`,
      [institutionId, data.sectionId, data.subjectId, data.title, data.description ?? null, data.dueDate ?? null, createdByMembershipId]
    );
    const assignment = rows[0];
    await logAudit(client, {
      institutionId,
      actorMembershipId: createdByMembershipId,
      action: 'create',
      entityType: 'assignment',
      entityId: assignment.id,
      after: assignment,
    });
    return assignment;
  },

  async list(
    client: PoolClient,
    institutionId: string,
    filters: { sectionId?: string; status?: string; studentId?: string; allowedSectionIds?: string[] }
  ): Promise<Assignment[]> {
    let query = `
      select 
        a.id,
        a.institution_id as "institutionId",
        a.section_id as "sectionId",
        sec.name as "sectionName",
        cls.name as "className",
        a.subject_id as "subjectId",
        sub.name as "subjectName",
        a.title,
        a.description,
        a.due_date as "dueDate",
        a.created_by_membership_id as "createdByMembershipId",
        a.created_at as "createdAt",
        (select count(*)::int from assignment_submission s where s.assignment_id = a.id) as "totalSubmissions"
    `;

    const params: any[] = [institutionId];

    if (filters.studentId) {
      params.push(filters.studentId);
      const studentIdx = params.length;
      query += `,
        asub.id as "submissionId",
        coalesce(asub.status, 'pending') as "submissionStatus",
        asub.submitted_at as "submittedAt",
        ag.grade as "grade",
        ag.feedback as "feedback"
      from assignment a
      left join section sec on sec.id = a.section_id
      left join class cls on cls.id = sec.class_id
      left join subject sub on sub.id = a.subject_id
      left join assignment_submission asub on asub.assignment_id = a.id and asub.student_id = $${studentIdx}
      left join assignment_grade ag on ag.submission_id = asub.id
      where a.institution_id = $1
      `;
    } else {
      query += `
      from assignment a
      left join section sec on sec.id = a.section_id
      left join class cls on cls.id = sec.class_id
      left join subject sub on sub.id = a.subject_id
      where a.institution_id = $1
      `;
    }

    if (filters.sectionId) {
      params.push(filters.sectionId);
      query += ` and a.section_id = $${params.length}`;
    } else if (filters.allowedSectionIds) {
      if (filters.allowedSectionIds.length === 0) return [];
      params.push(filters.allowedSectionIds);
      query += ` and a.section_id = any($${params.length})`;
    }

    if (filters.status === 'pending' && filters.studentId) {
      query += ` and (asub.id is null or asub.status = 'pending')`;
    }

    query += ` order by a.created_at desc`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async isTeacherAssignedToSectionAndSubject(
    client: PoolClient,
    teacherMembershipId: string,
    sectionId: string,
    subjectId: string
  ): Promise<boolean> {
    const { rows } = await client.query(
      `select 1 from class_subject_teacher
       where teacher_membership_id = $1 and section_id = $2 and subject_id = $3
       union
       select 1 from membership_scope
       where membership_id = $1 and scope_type in ('section', 'institution') and (scope_id = $2 or scope_type = 'institution')
       limit 1`,
      [teacherMembershipId, sectionId, subjectId]
    );
    return rows.length > 0;
  },

  async isTeacherAssignment(
    client: PoolClient,
    teacherMembershipId: string,
    assignmentId: string
  ): Promise<boolean> {
    const { rows } = await client.query(
      `select 1 from assignment a
       join class_subject_teacher cst on cst.section_id = a.section_id and cst.subject_id = a.subject_id
       where cst.teacher_membership_id = $1 and a.id = $2
       union
       select 1 from assignment a
       where a.created_by_membership_id = $1 and a.id = $2
       limit 1`,
      [teacherMembershipId, assignmentId]
    );
    return rows.length > 0;
  },

  async isTeacherSubmission(
    client: PoolClient,
    teacherMembershipId: string,
    submissionId: string
  ): Promise<boolean> {
    const { rows } = await client.query(
      `select 1 from assignment_submission asub
       join assignment a on a.id = asub.assignment_id
       join class_subject_teacher cst on cst.section_id = a.section_id and cst.subject_id = a.subject_id
       where cst.teacher_membership_id = $1 and asub.id = $2
       union
       select 1 from assignment_submission asub
       join assignment a on a.id = asub.assignment_id
       where a.created_by_membership_id = $1 and asub.id = $2
       limit 1`,
      [teacherMembershipId, submissionId]
    );
    return rows.length > 0;
  },

  async update(
    client: PoolClient,
    institutionId: string,
    assignmentId: string,
    data: { title?: string; description?: string; dueDate?: string },
    actorMembershipId?: string
  ): Promise<Assignment> {
    const { rows } = await client.query(
      `update assignment
       set title = coalesce($1, title),
           description = coalesce($2, description),
           due_date = coalesce($3, due_date)
       where id = $4
       returning id, institution_id as "institutionId", section_id as "sectionId", subject_id as "subjectId", title, description, due_date as "dueDate", created_by_membership_id as "createdByMembershipId", created_at as "createdAt"`,
      [data.title ?? null, data.description ?? null, data.dueDate ?? null, assignmentId]
    );
    const updated = rows[0];
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update',
      entityType: 'assignment',
      entityId: assignmentId,
      after: updated,
    });
    return updated;
  },

  async delete(client: PoolClient, institutionId: string, assignmentId: string, actorMembershipId?: string): Promise<void> {
    await client.query(`delete from assignment where id = $1`, [assignmentId]);
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'delete',
      entityType: 'assignment',
      entityId: assignmentId,
    });
  },

  async addAttachment(
    client: PoolClient,
    institutionId: string,
    assignmentId: string,
    data: { fileKey: string; fileName: string }
  ): Promise<AssignmentAttachment> {
    const { rows } = await client.query(
      `insert into assignment_attachment (institution_id, assignment_id, file_key, file_name)
       values ($1, $2, $3, $4)
       returning id, institution_id as "institutionId", assignment_id as "assignmentId", file_key as "fileKey", file_name as "fileName"`,
      [institutionId, assignmentId, data.fileKey, data.fileName]
    );
    return rows[0];
  },

  async listSubmissions(client: PoolClient, institutionId: string, assignmentId: string): Promise<AssignmentSubmission[]> {
    const { rows } = await client.query(
      `select 
         asub.id,
         asub.institution_id as "institutionId",
         asub.assignment_id as "assignmentId",
         asub.student_id as "studentId",
         coalesce(p.name, s.name) as "studentName",
         s.admission_no as "admissionNumber",
         e.roll_no as "rollNumber",
         sec.name as "sectionName",
         c.name as "className",
         asub.file_key as "fileKey",
         asub.file_url as "fileUrl",
         asub.submission_notes as "submissionNotes",
         asub.submitted_at as "submittedAt",
         asub.status,
         ag.grade,
         ag.feedback,
         ag.created_at as "gradedAt"
       from assignment_submission asub
       join student s on s.id = asub.student_id
       left join profile p on p.id = s.user_id
       left join assignment a on a.id = asub.assignment_id
       left join enrollment e on e.student_id = s.id and e.section_id = a.section_id and e.status = 'active'
       left join section sec on sec.id = a.section_id
       left join class c on c.id = sec.class_id
       left join assignment_grade ag on ag.submission_id = asub.id
       where asub.institution_id = $1 and asub.assignment_id = $2
       order by e.roll_no asc nulls last, asub.submitted_at desc`,
      [institutionId, assignmentId]
    );
    return rows;
  },

  async submitAssignment(
    client: PoolClient,
    institutionId: string,
    assignmentId: string,
    studentId: string,
    options?: { fileKey?: string; fileUrl?: string; submissionNotes?: string }
  ): Promise<AssignmentSubmission> {
    const { rows } = await client.query(
      `insert into assignment_submission (institution_id, assignment_id, student_id, file_key, file_url, submission_notes, status)
       values ($1, $2, $3, $4, $5, $6, 'submitted')
       on conflict (assignment_id, student_id) do update
         set file_key = coalesce(excluded.file_key, assignment_submission.file_key),
             file_url = coalesce(excluded.file_url, assignment_submission.file_url),
             submission_notes = coalesce(excluded.submission_notes, assignment_submission.submission_notes),
             submitted_at = now(),
             status = 'submitted'
       returning id, institution_id as "institutionId", assignment_id as "assignmentId", student_id as "studentId", file_key as "fileKey", file_url as "fileUrl", submission_notes as "submissionNotes", submitted_at as "submittedAt", status`,
      [institutionId, assignmentId, studentId, options?.fileKey ?? null, options?.fileUrl ?? null, options?.submissionNotes ?? null]
    );
    const sub = rows[0];
    await logAudit(client, {
      institutionId,
      action: 'submit',
      entityType: 'assignment_submission',
      entityId: sub.id,
      after: sub,
    });
    return sub;
  },

  async remindPendingStudents(
    client: PoolClient,
    institutionId: string,
    assignmentId: string,
    actorMembershipId?: string
  ): Promise<{ notifiedCount: number; message: string }> {
    const { rows: aRows } = await client.query(
      `select a.id, a.title, a.due_date as "dueDate", a.section_id as "sectionId", sec.name as "sectionName"
       from assignment a
       join section sec on sec.id = a.section_id
       where a.id = $1 and a.institution_id = $2`,
      [assignmentId, institutionId]
    );
    if (aRows.length === 0) {
      throw new Error('Assignment not found');
    }
    const assignment = aRows[0];

    const { rows: pendingStudents } = await client.query(
      `select s.id as "studentId", s.user_id as "userId", m.id as "membershipId", coalesce(p.name, s.name) as "studentName"
       from enrollment e
       join student s on s.id = e.student_id
       left join profile p on p.id = s.user_id
       left join membership m on m.user_id = s.user_id and m.institution_id = $1 and m.status = 'active'
       where e.section_id = $2 and e.status = 'active'
         and not exists (
           select 1 from assignment_submission asub
           where asub.assignment_id = $3 and asub.student_id = s.id and asub.status in ('submitted', 'graded')
         )`,
      [institutionId, assignment.sectionId, assignmentId]
    );

    let notifiedCount = 0;
    const dueDateStr = assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'soon';

    for (const st of pendingStudents) {
      if (st.userId || st.membershipId) {
        await dispatchNotificationAndTask({
          client,
          institutionId,
          recipientUserIds: st.userId ? [st.userId] : undefined,
          recipientMembershipIds: st.membershipId ? [st.membershipId] : undefined,
          creatorMembershipId: actorMembershipId,
          title: `Homework Reminder: ${assignment.title}`,
          body: `Your assignment "${assignment.title}" for ${assignment.sectionName} is pending submission. Due date: ${dueDateStr}. Please upload your handwritten work.`,
          type: 'warning',
          priority: 'high',
          dueDate: assignment.dueDate || undefined,
          createTask: true,
          metadata: {
            entityType: 'assignment',
            entityId: assignmentId,
            link: `/assignments?assignmentId=${assignmentId}`,
          },
        });
        notifiedCount++;
      }
    }

    return {
      notifiedCount,
      message: `Sent reminder notifications and created tasks for ${notifiedCount} student(s) with pending submissions.`,
    };
  },

  async gradeSubmission(
    client: PoolClient,
    institutionId: string,
    submissionId: string,
    gradedByMembershipId: string,
    data: { grade: string; feedback?: string }
  ): Promise<void> {
    await client.query(
      `insert into assignment_grade (institution_id, submission_id, grade, feedback, graded_by_membership_id)
       values ($1, $2, $3, $4, $5)
       on conflict (submission_id) do update set grade = excluded.grade, feedback = excluded.feedback, graded_by_membership_id = excluded.graded_by_membership_id`,
      [institutionId, submissionId, data.grade, data.feedback ?? null, gradedByMembershipId]
    );
    await client.query(`update assignment_submission set status = 'graded' where id = $1`, [submissionId]);
    await logAudit(client, {
      institutionId,
      actorMembershipId: gradedByMembershipId,
      action: 'grade',
      entityType: 'assignment_grade',
      entityId: submissionId,
      after: data,
    });
  },

  async getStats(client: PoolClient, institutionId: string): Promise<any> {
    const { rows } = await client.query(
      `select count(*)::int as "totalAssignments",
              (select count(*)::int from assignment_submission) as "totalSubmissions",
              (select count(*)::int from assignment_grade) as "totalGraded"
       from assignment`,
      []
    );
    return rows[0] ?? { totalAssignments: 0, totalSubmissions: 0, totalGraded: 0 };
  },
};
