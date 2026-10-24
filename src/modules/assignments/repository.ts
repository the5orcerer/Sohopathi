import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { dispatchNotificationAndTask } from '../core/notification-task-service';
import { assertContentLength, CONTENT_LIMITS } from '../../core/validation/content-limits';
import { appCache } from '../../core/cache';

export interface Assignment {
  id: string;
  institutionId: string;
  sectionId: string;
  subjectId: string;
  title: string;
  description: string | null;
  instructions?: string | null;
  dueDate: string | null;
  maxMarks?: number;
  status?: 'draft' | 'published' | 'closed';
  allowLateSubmissions?: boolean;
  createdByMembershipId: string | null;
  createdAt: string;
  totalSubmissions?: number;
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
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  submissionNotes?: string | null;
  submittedAt: string;
  status: 'not_submitted' | 'submitted' | 'marked' | 'reopened';
  marksObtained?: number | null;
  isLate?: boolean;
  reopenedAt?: string | null;
  reopenedByMembershipId?: string | null;
  reopenReason?: string | null;
  grade?: string | null;
  feedback?: string | null;
  gradedAt?: string | null;
}

export function getAssignmentSubmissionStoragePath(
  institutionId: string,
  assignmentId: string,
  studentId: string,
  fileName: string
): string {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `/institutions/${institutionId}/assignments/${assignmentId}/submissions/${studentId}/${sanitizedFileName}`;
}

export const assignmentRepository = {
  async create(
    client: PoolClient,
    institutionId: string,
    createdByMembershipId: string,
    data: {
      sectionId: string;
      subjectId: string;
      title: string;
      description?: string;
      instructions?: string;
      dueDate?: string;
      maxMarks?: number;
      status?: 'draft' | 'published' | 'closed';
      allowLateSubmissions?: boolean;
    }
  ): Promise<Assignment> {
    assertContentLength(data.title, 'title', CONTENT_LIMITS.TITLE_MAX);
    if (data.description) {
      assertContentLength(data.description, 'description', CONTENT_LIMITS.DESCRIPTION_MAX);
    }
    if (data.instructions) {
      assertContentLength(data.instructions, 'instructions', CONTENT_LIMITS.DESCRIPTION_MAX);
    }

    const assignmentStatus = data.status || 'published';
    const maxMarks = data.maxMarks ?? 100;
    const allowLate = data.allowLateSubmissions ?? false;

    const { rows } = await client.query(
      `insert into assignment (
         institution_id, section_id, subject_id, title, description, instructions, due_date, max_marks, status, allow_late_submissions, created_by_membership_id
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id, institution_id as "institutionId", section_id as "sectionId", subject_id as "subjectId",
                 title, description, instructions, due_date as "dueDate", max_marks as "maxMarks",
                 status, allow_late_submissions as "allowLateSubmissions", created_by_membership_id as "createdByMembershipId", created_at as "createdAt"`,
      [
        institutionId,
        data.sectionId,
        data.subjectId,
        data.title,
        data.description ?? null,
        data.instructions ?? null,
        data.dueDate ?? null,
        maxMarks,
        assignmentStatus,
        allowLate,
        createdByMembershipId,
      ]
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

    if (assignmentStatus === 'published') {
      try {
        const { rows: enrollRows } = await client.query(
          `select e.student_id, s.user_id from enrollment e
           join student s on s.id = e.student_id
           where e.section_id = $1 and e.status = 'active'`,
          [data.sectionId]
        );
        for (const enroll of enrollRows) {
          if (enroll.user_id) {
            await dispatchNotificationAndTask({
              client,
              institutionId,
              recipientUserIds: [enroll.user_id],
              creatorMembershipId: createdByMembershipId,
              title: `New Assignment: ${data.title}`,
              body: `A new assignment has been posted for your class. Deadline: ${data.dueDate || 'No due date'}.`,
              priority: 'medium',
              createTask: true,
              metadata: {
                entityType: 'assignment',
                entityId: assignment.id,
                link: `/assignments?assignmentId=${assignment.id}`,
              },
            });
          }
        }
      } catch (e) {
        // Notification dispatch failure should not block assignment creation
      }
    }

    appCache.del(`stats:assignments:${institutionId}`);

    return assignment;
  },

  async list(
    client: PoolClient,
    institutionId: string,
    filters: {
      sectionId?: string;
      status?: string;
      studentId?: string;
      allowedSectionIds?: string[];
      excludeDrafts?: boolean;
    }
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
        a.instructions,
        a.due_date as "dueDate",
        coalesce(a.max_marks, 100) as "maxMarks",
        coalesce(a.status, 'published') as "status",
        coalesce(a.allow_late_submissions, false) as "allowLateSubmissions",
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
        coalesce(asub.status, 'not_submitted') as "submissionStatus",
        asub.submitted_at as "submittedAt",
        asub.is_late as "isLate",
        asub.reopened_at as "reopenedAt",
        asub.reopen_reason as "reopenReason",
        asub.file_key as "submissionFileKey",
        asub.file_url as "submissionFileUrl",
        asub.file_name as "submissionFileName",
        asub.submission_notes as "submissionNotes",
        ag.grade as "grade",
        ag.feedback as "feedback",
        coalesce(asub.marks_obtained, ag.marks_obtained) as "marksObtained"
      from assignment a
      left join section sec on sec.id = a.section_id
      left join class cls on cls.id = sec.class_id
      left join subject sub on sub.id = a.subject_id
      left join assignment_submission asub on asub.assignment_id = a.id and asub.student_id = $${studentIdx}
      left join assignment_grade ag on ag.submission_id = asub.id
      where a.institution_id = $1
        and coalesce(a.status, 'published') != 'draft'
      `;
    } else {
      query += `
      from assignment a
      left join section sec on sec.id = a.section_id
      left join class cls on cls.id = sec.class_id
      left join subject sub on sub.id = a.subject_id
      where a.institution_id = $1
      `;
      if (filters.excludeDrafts) {
        query += ` and coalesce(a.status, 'published') != 'draft'`;
      }
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
      query += ` and (asub.id is null or asub.status in ('not_submitted', 'reopened'))`;
    } else if (filters.status && ['draft', 'published', 'closed'].includes(filters.status)) {
      params.push(filters.status);
      query += ` and coalesce(a.status, 'published') = $${params.length}`;
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
       union
       select 1 from membership_scope ms
       where ms.membership_id = $1 and ms.scope_type in ('institution', 'section')
       limit 1`,
      [teacherMembershipId, submissionId]
    );
    return rows.length > 0;
  },

  async update(
    client: PoolClient,
    institutionId: string,
    assignmentId: string,
    data: {
      title?: string;
      description?: string;
      instructions?: string;
      dueDate?: string;
      maxMarks?: number;
      status?: 'draft' | 'published' | 'closed';
      allowLateSubmissions?: boolean;
    },
    actorMembershipId?: string
  ): Promise<Assignment> {
    if (data.title) {
      assertContentLength(data.title, 'title', CONTENT_LIMITS.TITLE_MAX);
    }
    if (data.description) {
      assertContentLength(data.description, 'description', CONTENT_LIMITS.DESCRIPTION_MAX);
    }
    if (data.instructions) {
      assertContentLength(data.instructions, 'instructions', CONTENT_LIMITS.DESCRIPTION_MAX);
    }

    const { rows } = await client.query(
      `update assignment
       set title = coalesce($1, title),
           description = coalesce($2, description),
           instructions = coalesce($3, instructions),
           due_date = coalesce($4, due_date),
           max_marks = coalesce($5, max_marks),
           status = coalesce($6, status),
           allow_late_submissions = coalesce($7, allow_late_submissions)
       where id = $8 and institution_id = $9
       returning id, institution_id as "institutionId", section_id as "sectionId", subject_id as "subjectId",
                 title, description, instructions, due_date as "dueDate", max_marks as "maxMarks",
                 status, allow_late_submissions as "allowLateSubmissions", created_by_membership_id as "createdByMembershipId", created_at as "createdAt"`,
      [
        data.title ?? null,
        data.description ?? null,
        data.instructions ?? null,
        data.dueDate ?? null,
        data.maxMarks ?? null,
        data.status ?? null,
        data.allowLateSubmissions ?? null,
        assignmentId,
        institutionId,
      ]
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
    await client.query(`delete from assignment where id = $1 and institution_id = $2`, [assignmentId, institutionId]);
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
         asub.file_name as "fileName",
         asub.file_size as "fileSize",
         asub.mime_type as "mimeType",
         asub.submission_notes as "submissionNotes",
         asub.submitted_at as "submittedAt",
         asub.status,
         asub.is_late as "isLate",
         asub.reopened_at as "reopenedAt",
         asub.reopened_by_membership_id as "reopenedByMembershipId",
         asub.reopen_reason as "reopenReason",
         coalesce(asub.marks_obtained, ag.marks_obtained) as "marksObtained",
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
    options?: {
      fileKey?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      submissionNotes?: string;
    }
  ): Promise<AssignmentSubmission> {
    if (options?.submissionNotes) {
      assertContentLength(options.submissionNotes, 'submissionNotes', CONTENT_LIMITS.REASON_MAX);
    }

    // 1. Fetch assignment details
    const { rows: asgnRows } = await client.query(
      `select id, status, due_date as "dueDate", allow_late_submissions as "allowLateSubmissions",
              title, section_id as "sectionId", subject_id as "subjectId", created_by_membership_id as "createdByMembershipId"
       from assignment where id = $1 and institution_id = $2`,
      [assignmentId, institutionId]
    );
    if (asgnRows.length === 0) {
      throw new Error('Assignment not found');
    }
    const assignment = asgnRows[0];

    if (assignment.status === 'draft') {
      throw new Error('Cannot submit work for draft assignment');
    }

    // 2. Deadline & late submission handling
    let isLate = false;
    if (assignment.dueDate) {
      const now = new Date();
      const due = new Date(assignment.dueDate);
      if (now > due) {
        if (!assignment.allowLateSubmissions) {
          throw new Error('DEADLINE_PASSED: Submission deadline has passed and late submissions are not allowed.');
        }
        isLate = true;
      }
    }

    // 3. Check for existing submission to enforce locking (Blueprint Section 20)
    const { rows: priorRows } = await client.query(
      `select id, status, submitted_at, reopen_reason
       from assignment_submission
       where assignment_id = $1 and student_id = $2`,
      [assignmentId, studentId]
    );

    if (priorRows.length > 0) {
      const prior = priorRows[0];
      if (prior.status === 'submitted' || prior.status === 'marked' || prior.status === 'graded') {
        throw new Error('SUBMISSION_LOCKED: Assignment submission is locked. It can only be modified if reopened by a teacher.');
      }
      // If status is 'reopened', student is permitted to resubmit!
    }

    // 4. Detached storage path formatting
    let fileKey = options?.fileKey ?? null;
    if (!fileKey && options?.fileName) {
      fileKey = getAssignmentSubmissionStoragePath(institutionId, assignmentId, studentId, options.fileName);
    }

    // 5. Upsert submission
    const { rows } = await client.query(
      `insert into assignment_submission (
         institution_id, assignment_id, student_id, file_key, file_url, file_name, file_size, mime_type,
         submission_notes, status, is_late, submitted_at, reopened_at, reopen_reason
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted', $10, now(), null, null)
       on conflict (assignment_id, student_id) do update set
         file_key = coalesce(excluded.file_key, assignment_submission.file_key),
         file_url = coalesce(excluded.file_url, assignment_submission.file_url),
         file_name = coalesce(excluded.file_name, assignment_submission.file_name),
         file_size = coalesce(excluded.file_size, assignment_submission.file_size),
         mime_type = coalesce(excluded.mime_type, assignment_submission.mime_type),
         submission_notes = coalesce(excluded.submission_notes, assignment_submission.submission_notes),
         status = 'submitted',
         is_late = excluded.is_late,
         submitted_at = now()
       returning id, institution_id as "institutionId", assignment_id as "assignmentId", student_id as "studentId",
                 file_key as "fileKey", file_url as "fileUrl", file_name as "fileName", file_size as "fileSize",
                 mime_type as "mimeType", submission_notes as "submissionNotes", submitted_at as "submittedAt",
                 status, is_late as "isLate", reopened_at as "reopenedAt", reopen_reason as "reopenReason"`,
      [
        institutionId,
        assignmentId,
        studentId,
        fileKey,
        options?.fileUrl ?? null,
        options?.fileName ?? null,
        options?.fileSize ?? null,
        options?.mimeType ?? null,
        options?.submissionNotes ?? null,
        isLate,
      ]
    );
    const sub = rows[0];

    await logAudit(client, {
      institutionId,
      action: priorRows.length > 0 ? 'resubmit' : 'submit',
      entityType: 'assignment_submission',
      entityId: sub.id,
      after: sub,
      reason: isLate ? 'Submitted after deadline' : undefined,
    });

    // Notify teacher of submission
    if (assignment.createdByMembershipId) {
      try {
        const { rows: stRows } = await client.query(`select name from student where id = $1`, [studentId]);
        const stName = stRows[0]?.name || 'A student';
        await dispatchNotificationAndTask({
          client,
          institutionId,
          recipientMembershipIds: [assignment.createdByMembershipId],
          title: `Assignment Submission: ${assignment.title}`,
          body: `${stName} submitted work for "${assignment.title}". Status: Submitted (Locked).${isLate ? ' (Late Submission)' : ''}`,
          priority: 'low',
          createTask: false,
          metadata: {
            entityType: 'assignment_submission',
            entityId: sub.id,
            assignmentId,
          },
        });
      } catch (e) {
        // Ignore notification failure
      }
    }

    appCache.del(`stats:assignments:${institutionId}`);

    return sub;
  },

  async reopenSubmission(
    client: PoolClient,
    institutionId: string,
    assignmentId: string,
    submissionId: string,
    teacherMembershipId: string,
    reason: string
  ): Promise<AssignmentSubmission> {
    assertContentLength(reason, 'reason', CONTENT_LIMITS.REASON_MAX);

    // Fetch submission and assignment info
    const { rows: subRows } = await client.query(
      `select s.id, s.assignment_id as "assignmentId", s.student_id as "studentId", s.status, a.title as "assignmentTitle"
       from assignment_submission s
       join assignment a on a.id = s.assignment_id
       where s.id = $1 and s.institution_id = $2`,
      [submissionId, institutionId]
    );
    if (subRows.length === 0) {
      throw new Error('Submission not found');
    }
    const prior = subRows[0];

    const { rows } = await client.query(
      `update assignment_submission
       set status = 'reopened',
           reopened_at = now(),
           reopened_by_membership_id = $1,
           reopen_reason = $2
       where id = $3 and institution_id = $4
       returning id, institution_id as "institutionId", assignment_id as "assignmentId", student_id as "studentId",
                 file_key as "fileKey", file_url as "fileUrl", file_name as "fileName", file_size as "fileSize",
                 mime_type as "mimeType", submission_notes as "submissionNotes", submitted_at as "submittedAt",
                 status, is_late as "isLate", reopened_at as "reopenedAt", reopen_reason as "reopenReason",
                 marks_obtained as "marksObtained"`,
      [teacherMembershipId, reason, submissionId, institutionId]
    );
    const reopened = rows[0];

    await logAudit(client, {
      institutionId,
      actorMembershipId: teacherMembershipId,
      action: 'reopen_submission',
      entityType: 'assignment_submission',
      entityId: submissionId,
      before: { status: prior.status },
      after: { status: 'reopened', reopenReason: reason },
      reason,
    });

    // Notify student about reopened submission
    try {
      const { rows: stRows } = await client.query(`select user_id from student where id = $1`, [prior.studentId]);
      if (stRows[0]?.user_id) {
        await dispatchNotificationAndTask({
          client,
          institutionId,
          recipientUserIds: [stRows[0].user_id],
          creatorMembershipId: teacherMembershipId,
          title: `Assignment Reopened: ${prior.assignmentTitle}`,
          body: `Your teacher has reopened your submission for revision. Reason: ${reason}. Please submit updated work.`,
          priority: 'high',
          createTask: true,
          metadata: {
            entityType: 'assignment',
            entityId: assignmentId,
            link: `/assignments?assignmentId=${assignmentId}`,
          },
        });
      }
    } catch (e) {
      // Ignore notification dispatch failure
    }

    return reopened;
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
           where asub.assignment_id = $3 and asub.student_id = s.id and asub.status in ('submitted', 'marked', 'graded')
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
    data: { grade?: string; feedback?: string; marksObtained?: number }
  ): Promise<any> {
    if (data.feedback) {
      assertContentLength(data.feedback, 'feedback', CONTENT_LIMITS.DESCRIPTION_MAX);
    }

    // 1. Update assignment_submission status to 'marked' and record marks_obtained
    const { rows: subRows } = await client.query(
      `update assignment_submission
       set status = 'marked',
           marks_obtained = coalesce($1, marks_obtained)
       where id = $2 and institution_id = $3
       returning id, assignment_id as "assignmentId", student_id as "studentId", status, marks_obtained as "marksObtained"`,
      [data.marksObtained ?? null, submissionId, institutionId]
    );
    if (subRows.length === 0) {
      throw new Error('Submission not found');
    }
    const submission = subRows[0];

    // 2. Upsert assignment_grade
    const { rows } = await client.query(
      `insert into assignment_grade (institution_id, submission_id, grade, feedback, marks_obtained, graded_by_membership_id)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (submission_id) do update
         set grade = coalesce(excluded.grade, assignment_grade.grade),
             feedback = coalesce(excluded.feedback, assignment_grade.feedback),
             marks_obtained = coalesce(excluded.marks_obtained, assignment_grade.marks_obtained),
             graded_by_membership_id = excluded.graded_by_membership_id
       returning id, institution_id as "institutionId", submission_id as "submissionId", grade, feedback, marks_obtained as "marksObtained", graded_by_membership_id as "gradedByMembershipId"`,
      [institutionId, submissionId, data.grade ?? null, data.feedback ?? null, data.marksObtained ?? null, gradedByMembershipId]
    );
    const gradeRecord = rows[0];

    await logAudit(client, {
      institutionId,
      actorMembershipId: gradedByMembershipId,
      action: 'grade',
      entityType: 'assignment_submission',
      entityId: submissionId,
      after: { ...gradeRecord, status: 'marked' },
    });

    // 3. Notify student and guardian
    try {
      const { rows: asgnRows } = await client.query(`select title from assignment where id = $1`, [submission.assignmentId]);
      const asgnTitle = asgnRows[0]?.title || 'Assignment';
      const { rows: stRows } = await client.query(`select user_id from student where id = $1`, [submission.studentId]);
      if (stRows[0]?.user_id) {
        await dispatchNotificationAndTask({
          client,
          institutionId,
          recipientUserIds: [stRows[0].user_id],
          creatorMembershipId: gradedByMembershipId,
          title: `Assignment Evaluated: ${asgnTitle}`,
          body: `Your submission for "${asgnTitle}" has been graded. Marks: ${data.marksObtained ?? '—'}, Grade: ${data.grade ?? 'Evaluated'}. Feedback: ${data.feedback || 'None'}`,
          priority: 'medium',
          createTask: false,
          metadata: {
            entityType: 'assignment_submission',
            entityId: submissionId,
            assignmentId: submission.assignmentId,
          },
        });
      }
    } catch (e) {
      // Ignore notification failure
    }

    appCache.del(`stats:assignments:${institutionId}`);

    return gradeRecord;
  },

  async getStats(client: PoolClient, institutionId: string): Promise<any> {
    const cacheKey = `stats:assignments:${institutionId}`;
    const cached = appCache.get<any>(cacheKey);
    if (cached) return cached;

    const { rows } = await client.query(
      `select count(*)::int as "totalAssignments",
              (select count(*)::int from assignment_submission) as "totalSubmissions",
              (select count(*)::int from assignment_grade) as "totalGraded"
       from assignment`,
      []
    );
    const result = rows[0] ?? { totalAssignments: 0, totalSubmissions: 0, totalGraded: 0 };
    appCache.set(cacheKey, result, 30);
    return result;
  },
};
