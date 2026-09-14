import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { examRepository } from './repository';

export async function listExams(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const academicYearId = req.query.academicYearId as string | undefined;
  const classId = req.query.classId as string | undefined;
  const sectionId = req.query.sectionId as string | undefined;
  const status = req.query.status as string | undefined;

  const exams = await examRepository.listExams(client, institutionId, {
    academicYearId,
    classId,
    sectionId,
    status,
  });
  res.json(exams);
}

export async function getExam(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const exam = await examRepository.getExamById(client, institutionId, req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });
  res.json(exam);
}

export async function createExam(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx!.membershipId;

  try {
    const exam = await examRepository.createExam(client, institutionId, actorMembershipId, req.body);
    res.status(201).json(exam);
  } catch (err: any) {
    if (err.name === 'ContentLimitError') {
      return res.status(400).json({ error: err.message, code: 'CONTENT_LIMIT_EXCEEDED' });
    }
    throw err;
  }
}

export async function updateExam(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx!.membershipId;

  try {
    const exam = await examRepository.updateExam(client, institutionId, req.params.id, actorMembershipId, req.body);
    res.json(exam);
  } catch (err: any) {
    if (err.message === 'Exam not found') {
      return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });
    }
    if (err.name === 'ContentLimitError') {
      return res.status(400).json({ error: err.message, code: 'CONTENT_LIMIT_EXCEEDED' });
    }
    throw err;
  }
}

export async function deleteExam(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx!.membershipId;

  await examRepository.deleteExam(client, institutionId, req.params.id, actorMembershipId);
  res.json({ success: true });
}

export async function snapshotCandidates(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const result = await examRepository.snapshotCandidates(client, institutionId, req.params.id, req.body || {});
  res.json(result);
}

export async function listCandidates(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const candidates = await examRepository.listCandidates(client, institutionId, req.params.id);
  res.json(candidates);
}

export async function listPapers(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const papers = await examRepository.listExamPapers(client, institutionId, req.params.id);
  res.json(papers);
}

export async function createPaper(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  try {
    const paper = await examRepository.createExamPaper(client, institutionId, req.params.id, req.body);
    res.status(201).json(paper);
  } catch (err: any) {
    if (err.message.includes('Pass marks cannot exceed')) {
      return res.status(400).json({ error: err.message, code: 'INVALID_MARKS' });
    }
    throw err;
  }
}

export async function deletePaper(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  await examRepository.deleteExamPaper(client, institutionId, req.params.id, req.params.paperId);
  res.json({ success: true });
}

export async function listRooms(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const rooms = await examRepository.listExamRooms(client, institutionId, req.params.id);
  res.json(rooms);
}

export async function createRoom(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  try {
    const room = await examRepository.createExamRoom(client, institutionId, req.params.id, req.body);
    res.status(201).json(room);
  } catch (err: any) {
    if (err.message.includes('GUARD_CONFLICT')) {
      return res.status(409).json({ error: err.message, code: 'GUARD_CONFLICT' });
    }
    if (err.message.includes('CAPACITY_EXCEEDED')) {
      return res.status(400).json({ error: err.message, code: 'CAPACITY_EXCEEDED' });
    }
    throw err;
  }
}

export async function deleteRoom(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  await examRepository.deleteExamRoom(client, institutionId, req.params.id, req.params.roomId);
  res.json({ success: true });
}

export async function fetchMarks(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const examId = (req.query.examId as string) || req.params.id;
  const studentId = req.query.studentId as string | undefined;
  const subjectId = req.query.subjectId as string | undefined;

  const marks = await examRepository.fetchMarks(client, institutionId, {
    examId,
    studentId,
    subjectId,
  });
  res.json(marks);
}

export async function recordMarks(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx!.membershipId;
  const marks = Array.isArray(req.body) ? req.body : req.body.marks || [];

  try {
    const result = await examRepository.recordMarksBatch(client, institutionId, actorMembershipId, marks);
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err.message.includes('EXAM_LOCKED')) {
      return res.status(409).json({ error: err.message, code: 'EXAM_LOCKED' });
    }
    if (err.message.includes('cannot exceed maximum') || err.message.includes('cannot be negative')) {
      return res.status(400).json({ error: err.message, code: 'INVALID_MARKS' });
    }
    throw err;
  }
}

export async function getExamProgress(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  try {
    const progress = await examRepository.getExamProgress(client, institutionId, req.params.id);
    res.json(progress);
  } catch (err: any) {
    if (err.message === 'Exam not found') {
      return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });
    }
    throw err;
  }
}

export async function notifyPendingTeachers(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx!.membershipId;
  const result = await examRepository.notifyPendingTeachers(client, institutionId, req.params.id, actorMembershipId);
  res.json(result);
}

export async function publishExam(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx!.membershipId;
  const result = await examRepository.publishExam(client, institutionId, req.params.id, actorMembershipId);
  res.json(result);
}

export async function reopenExam(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx!.membershipId;
  const reason = req.body.reason;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A non-empty reason is required to reopen exam results', code: 'REASON_REQUIRED' });
  }

  try {
    const result = await examRepository.reopenExam(client, institutionId, req.params.id, actorMembershipId, reason.trim());
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ContentLimitError') {
      return res.status(400).json({ error: err.message, code: 'CONTENT_LIMIT_EXCEEDED' });
    }
    throw err;
  }
}
