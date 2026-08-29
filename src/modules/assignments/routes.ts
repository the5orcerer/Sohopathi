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
  const { fileKey } = req.body;

  let studentId = req.body.studentId;
  if (req.grantedScope === 'self' || !studentId) {
    const selfStudentId = await attendanceRepository.getStudentIdForUser(client, req.ctx!.userId);
    if (!selfStudentId) {
      return res.status(400).json({ error: 'student record not found for user', code: 'STUDENT_NOT_FOUND' });
    }
    studentId = selfStudentId;
  }

  const submission = await assignmentRepository.submitAssignment(
    client,
    req.ctx!.institutionId,
    assignmentId,
    studentId,
    fileKey
  );
  res.status(201).json(submission);
}

export async function gradeSubmission(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  const { submissionId, grade, feedback } = req.body;

  if (grantedScope === 'assigned_sections') {
    const isAllowed = await assignmentRepository.isTeacherSubmission(client, req.ctx!.membershipId, submissionId);
    if (!isAllowed) {
      return res.status(403).json({ error: 'You do not have permission to grade this submission', code: 'FORBIDDEN' });
    }
  }

  await assignmentRepository.gradeSubmission(client, req.ctx!.institutionId, submissionId, req.ctx!.membershipId, {
    grade,
    feedback,
  });
  res.status(200).json({ success: true });
}

export async function getAssignmentStats(req: Request, res: Response, client: PoolClient) {
  const stats = await assignmentRepository.getStats(client, req.ctx!.institutionId);
  res.json(stats);
}
