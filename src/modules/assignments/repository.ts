import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';

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
  fileKey: string | null;
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
    let query = `select id, institution_id as "institutionId", section_id as "sectionId", subject_id as "subjectId", title, description, due_date as "dueDate", created_by_membership_id as "createdByMembershipId", created_at as "createdAt" from assignment where 1=1`;
    const params: any[] = [];

    if (filters.sectionId) {
      params.push(filters.sectionId);
      query += ` and section_id = $${params.length}`;
    } else if (filters.allowedSectionIds) {
      if (filters.allowedSectionIds.length === 0) return [];
      params.push(filters.allowedSectionIds);
      query += ` and section_id = any($${params.length})`;
    }

    query += ` order by created_at desc`;
    const { rows } = await client.query(query, params);
    return rows;
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

  async submitAssignment(
    client: PoolClient,
    institutionId: string,
    assignmentId: string,
    studentId: string,
    fileKey?: string
  ): Promise<AssignmentSubmission> {
    const { rows } = await client.query(
      `insert into assignment_submission (institution_id, assignment_id, student_id, file_key, status)
       values ($1, $2, $3, $4, 'submitted')
       on conflict (assignment_id, student_id) do update
         set file_key = excluded.file_key, submitted_at = now(), status = 'submitted'
       returning id, institution_id as "institutionId", assignment_id as "assignmentId", student_id as "studentId", file_key as "fileKey", submitted_at as "submittedAt", status`,
      [institutionId, assignmentId, studentId, fileKey ?? null]
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
