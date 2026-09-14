import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { assignmentRepository } from './repository';
import { attendanceRepository } from '../attendance/repository';
import { buildStorageKey } from '../../core/storage/build-key';
import { s3StorageAdapter } from '../../core/storage/s3-storage-adapter';

export async function listAssignments(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  const sectionId = req.query.sectionId as string | undefined;
  const status = req.query.status as string | undefined;

  let allowedSectionIds: string[] | undefined;
  let selfStudentId: string | null = null;

  if (grantedScope === 'self') {
    selfStudentId = await attendanceRepository.getStudentIdForUser(client, req.ctx!.userId);
    if (selfStudentId) {
      const { rows: enrollRows } = await client.query(
        `select section_id from enrollment where student_id = $1 and status = 'active'`,
        [selfStudentId]
      );
      allowedSectionIds = enrollRows.map((r) => r.section_id);
    } else {
      allowedSectionIds = [];
    }
  } else if (grantedScope === 'assigned_sections') {
    allowedSectionIds = await attendanceRepository.getTeacherAssignedSectionIds(client, req.ctx!.membershipId);
    if (sectionId && !allowedSectionIds.includes(sectionId)) {
      return res.status(403).json({ error: 'insufficient scope for requested section', code: 'FORBIDDEN' });
    }
  }

  const assignments = await assignmentRepository.list(client, req.ctx!.institutionId, {
    sectionId,
    status,
    studentId: selfStudentId || undefined,
    allowedSectionIds,
  });
  res.json(assignments);
}

export async function createAssignment(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  const { sectionId, subjectId, title, description, dueDate } = req.body;

  if (grantedScope === 'assigned_sections') {
    const isAssigned = await assignmentRepository.isTeacherAssignedToSectionAndSubject(
      client,
      req.ctx!.membershipId,
      sectionId,
      subjectId
    );
    if (!isAssigned) {
      return res.status(403).json({
        error: 'Teacher is not assigned to teach this subject in the selected section',
        code: 'FORBIDDEN',
      });
    }
  }

  const assignment = await assignmentRepository.create(client, req.ctx!.institutionId, req.ctx!.membershipId, {
    sectionId,
    subjectId,
    title,
    description,
    dueDate,
  });
  res.status(201).json(assignment);
}

export async function updateAssignment(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  if (grantedScope === 'assigned_sections') {
    const isAllowed = await assignmentRepository.isTeacherAssignment(client, req.ctx!.membershipId, req.params.id);
    if (!isAllowed) {
      return res.status(403).json({ error: 'You do not have permission to modify this assignment', code: 'FORBIDDEN' });
    }
  }
  const updated = await assignmentRepository.update(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.json(updated);
}

export async function deleteAssignment(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  if (grantedScope === 'assigned_sections') {
    const isAllowed = await assignmentRepository.isTeacherAssignment(client, req.ctx!.membershipId, req.params.id);
    if (!isAllowed) {
      return res.status(403).json({ error: 'You do not have permission to delete this assignment', code: 'FORBIDDEN' });
    }
  }
  await assignmentRepository.delete(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.status(204).send();
}

export async function requestUploadPresignedUrl(req: Request, res: Response, client: PoolClient) {
  const assignmentId = req.params.id;
  const { fileName, contentType } = req.body;

  const key = buildStorageKey('institutions/{institution_id}/assignments/{assignment_id}/{file}', {
    institution_id: req.ctx!.institutionId,
    assignment_id: assignmentId,
    file: fileName,
  });

  const uploadUrl = await s3StorageAdapter.getSignedUploadUrl(key, contentType ?? 'application/octet-stream');
  res.json({ uploadUrl, fileKey: key });
}

export async function addAttachment(req: Request, res: Response, client: PoolClient) {
  const assignmentId = req.params.id;
  const { fileKey, fileName } = req.body;
  const attachment = await assignmentRepository.addAttachment(client, req.ctx!.institutionId, assignmentId, {
    fileKey,
    fileName,
  });
  res.status(201).json(attachment);
}

export async function submitAssignment(req: Request, res: Response, client: PoolClient) {
  const assignmentId = req.params.id;
  const { fileKey, fileUrl, fileName, fileSize, mimeType, submissionNotes } = req.body;

  let studentId = req.body.studentId;
  if (req.grantedScope === 'self' || !studentId) {
    const selfStudentId = await attendanceRepository.getStudentIdForUser(client, req.ctx!.userId);
    if (!selfStudentId) {
      return res.status(400).json({ error: 'student record not found for user', code: 'STUDENT_NOT_FOUND' });
    }
    studentId = selfStudentId;
  }

  // Verify student is actually enrolled in the section for this assignment
  const { rows: enrollCheck } = await client.query(
    `select 1 from assignment a
     join enrollment e on e.section_id = a.section_id
     where a.id = $1 and a.institution_id = $2 and e.student_id = $3 and e.status = 'active' limit 1`,
    [assignmentId, req.ctx!.institutionId, studentId]
  );
  if (enrollCheck.length === 0) {
    return res.status(403).json({
      error: 'Cannot submit assignment: student is not enrolled in the assigned section',
      code: 'FORBIDDEN',
    });
  }

  try {
    const submission = await assignmentRepository.submitAssignment(
      client,
      req.ctx!.institutionId,
      assignmentId,
      studentId,
      { fileKey, fileUrl, fileName, fileSize, mimeType, submissionNotes }
    );
    res.status(201).json(submission);
  } catch (err: any) {
    if (err.message?.startsWith('SUBMISSION_LOCKED')) {
      return res.status(409).json({ error: err.message, code: 'SUBMISSION_LOCKED' });
    }
    if (err.message?.startsWith('DEADLINE_PASSED')) {
      return res.status(400).json({ error: err.message, code: 'DEADLINE_PASSED' });
    }
    if (err.message?.includes('Cannot submit work for draft')) {
      return res.status(400).json({ error: err.message, code: 'INVALID_STATE' });
    }
    throw err;
  }
}

export async function reopenSubmission(req: Request, res: Response, client: PoolClient) {
  const assignmentId = req.params.id;
  const submissionId = req.params.submissionId;
  const { reason } = req.body;
  const grantedScope = req.grantedScope;

  if (grantedScope === 'assigned_sections') {
    const isAllowed = await assignmentRepository.isTeacherSubmission(client, req.ctx!.membershipId, submissionId);
    if (!isAllowed) {
      return res.status(403).json({ error: 'You do not have permission to reopen this submission', code: 'FORBIDDEN' });
    }
  }

  const reopened = await assignmentRepository.reopenSubmission(
    client,
    req.ctx!.institutionId,
    assignmentId,
    submissionId,
    req.ctx!.membershipId,
    reason
  );
  res.json(reopened);
}

export async function listSubmissions(req: Request, res: Response, client: PoolClient) {
  const assignmentId = req.params.id;
  const grantedScope = req.grantedScope;

  if (grantedScope === 'assigned_sections') {
    const isAllowed = await assignmentRepository.isTeacherAssignment(client, req.ctx!.membershipId, assignmentId);
    if (!isAllowed) {
      return res.status(403).json({ error: 'You do not have permission to view submissions for this assignment', code: 'FORBIDDEN' });
    }
  }

  const submissions = await assignmentRepository.listSubmissions(client, req.ctx!.institutionId, assignmentId);
  res.json(submissions);
}

export async function remindPendingStudents(req: Request, res: Response, client: PoolClient) {
  const assignmentId = req.params.id;
  const grantedScope = req.grantedScope;

  if (grantedScope === 'assigned_sections') {
    const isAllowed = await assignmentRepository.isTeacherAssignment(client, req.ctx!.membershipId, assignmentId);
    if (!isAllowed) {
      return res.status(403).json({ error: 'You do not have permission to send reminders for this assignment', code: 'FORBIDDEN' });
    }
  }

  const result = await assignmentRepository.remindPendingStudents(
    client,
    req.ctx!.institutionId,
    assignmentId,
    req.ctx?.membershipId
  );
  res.json(result);
}

export async function gradeSubmission(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  const { submissionId, grade, feedback, marksObtained } = req.body;

  if (grantedScope === 'assigned_sections') {
    const isAllowed = await assignmentRepository.isTeacherSubmission(client, req.ctx!.membershipId, submissionId);
    if (!isAllowed) {
      return res.status(403).json({ error: 'You do not have permission to grade this submission', code: 'FORBIDDEN' });
    }
  }

  const result = await assignmentRepository.gradeSubmission(client, req.ctx!.institutionId, submissionId, req.ctx!.membershipId, {
    grade,
    feedback,
    marksObtained,
  });
  res.status(200).json({ success: true, ...result });
}

export async function getAssignmentStats(req: Request, res: Response, client: PoolClient) {
  const stats = await assignmentRepository.getStats(client, req.ctx!.institutionId);
  res.json(stats);
}
