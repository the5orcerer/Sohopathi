import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { attendanceRepository } from './repository';

export async function getAttendanceSummary(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  const sectionId = req.query.sectionId as string | undefined;
  const date = req.query.date as string | undefined;

  let allowedSectionIds: string[] | undefined;

  if (grantedScope === 'self') {
    const studentId = await attendanceRepository.getStudentIdForUser(client, req.ctx!.userId);
    if (studentId) {
      const { rows: enrollRows } = await client.query(
        `select section_id from enrollment where student_id = $1 and status = 'active'`,
        [studentId]
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

  const summary = await attendanceRepository.getAttendanceSummary(client, req.ctx!.institutionId, {
    sectionId,
    date,
    allowedSectionIds,
  });
  res.json(summary);
}

export async function getAttendanceSheet(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  const sectionId = req.query.sectionId as string;
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const sessionType = (req.query.sessionType as string) || 'daily';
  const periodNumber = req.query.periodNumber ? parseInt(req.query.periodNumber as string, 10) : 1;

  if (!sectionId) {
    return res.status(400).json({ error: 'sectionId query parameter is required', code: 'VALIDATION_ERROR' });
  }

  if (grantedScope === 'assigned_sections') {
    const allowedSectionIds = await attendanceRepository.getTeacherAssignedSectionIds(client, req.ctx!.membershipId);
    if (!allowedSectionIds.includes(sectionId)) {
      return res.status(403).json({ error: 'insufficient scope for requested section', code: 'FORBIDDEN' });
    }
  }

  const sheet = await attendanceRepository.getAttendanceSheet(
    client,
    req.ctx!.institutionId,
    sectionId,
    date,
    sessionType,
    periodNumber
  );
  res.json(sheet);
}

export async function listAttendance(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  let sectionId = req.query.sectionId as string | undefined;
  const date = req.query.date as string | undefined;
  let studentId = req.query.studentId as string | undefined;
  const sessionType = req.query.sessionType as string | undefined;
  const periodNumber = req.query.periodNumber ? parseInt(req.query.periodNumber as string, 10) : undefined;
  const subjectId = req.query.subjectId as string | undefined;

  let allowedSectionIds: string[] | undefined;

  if (grantedScope === 'assigned_sections') {
    allowedSectionIds = await attendanceRepository.getTeacherAssignedSectionIds(client, req.ctx!.membershipId);
    if (sectionId && !allowedSectionIds.includes(sectionId)) {
      return res.status(403).json({ error: 'insufficient scope for requested section', code: 'FORBIDDEN' });
    }
  } else if (grantedScope === 'self') {
    const selfStudentId = await attendanceRepository.getStudentIdForUser(client, req.ctx!.userId);
    if (!selfStudentId) {
      return res.json([]);
    }
    studentId = selfStudentId;
  }

  const records = await attendanceRepository.listAttendance(client, req.ctx!.institutionId, {
    sectionId,
    date,
    studentId,
    sessionType,
    periodNumber,
    subjectId,
    allowedSectionIds,
  });
  res.json(records);
}

export async function markAttendance(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  const { records } = req.body; // array of { studentId, sectionId, date, status, sessionType, periodNumber, subjectId, remarks, reason }

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records must be a non-empty array', code: 'VALIDATION_ERROR' });
  }

  if (grantedScope === 'assigned_sections') {
    const allowedSectionIds = await attendanceRepository.getTeacherAssignedSectionIds(client, req.ctx!.membershipId);
    for (const r of records) {
      if (!allowedSectionIds.includes(r.sectionId)) {
        return res.status(403).json({ error: `insufficient scope for section ${r.sectionId}`, code: 'FORBIDDEN' });
      }
      if (r.subjectId) {
        const isAssigned = await attendanceRepository.isTeacherAssignedToSubjectSection(
          client,
          req.ctx!.membershipId,
          r.sectionId,
          r.subjectId
        );
        if (!isAssigned) {
          return res.status(403).json({
            error: `Teacher is not assigned to teach subject ${r.subjectId} in section ${r.sectionId}`,
            code: 'FORBIDDEN',
          });
        }
      }
    }
  }

  const results = await attendanceRepository.markAttendance(
    client,
    req.ctx!.institutionId,
    req.ctx!.membershipId,
    records
  );
  res.status(201).json(results);
}

export async function listExams(req: Request, res: Response, client: PoolClient) {
  const academicYearId = req.query.academicYearId as string | undefined;
  const exams = await attendanceRepository.listExams(client, req.ctx!.institutionId, academicYearId);
  res.json(exams);
}

export async function createExam(req: Request, res: Response, client: PoolClient) {
  const exam = await attendanceRepository.createExam(client, req.ctx!.institutionId, req.body, req.ctx?.membershipId);
  res.status(201).json(exam);
}

export async function updateExam(req: Request, res: Response, client: PoolClient) {
  const exam = await attendanceRepository.updateExam(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.json(exam);
}

export async function deleteExam(req: Request, res: Response, client: PoolClient) {
  await attendanceRepository.deleteExam(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.json({ success: true });
}

export async function listExamPapers(req: Request, res: Response, client: PoolClient) {
  const examId = req.params.id || (req.query.examId as string);
  if (!examId) return res.status(400).json({ error: 'examId is required' });
  const papers = await attendanceRepository.listExamPapers(client, req.ctx!.institutionId, examId);
  res.json(papers);
}

export async function createExamPaper(req: Request, res: Response, client: PoolClient) {
  const examId = req.params.id || req.body.examId;
  const paper = await attendanceRepository.createExamPaper(
    client,
    req.ctx!.institutionId,
    { ...req.body, examId },
    req.ctx?.membershipId
  );
  res.status(201).json(paper);
}

export async function deleteExamPaper(req: Request, res: Response, client: PoolClient) {
  await attendanceRepository.deleteExamPaper(client, req.ctx!.institutionId, req.params.paperId, req.ctx?.membershipId);
  res.json({ success: true });
}

export async function listExamRooms(req: Request, res: Response, client: PoolClient) {
  const rooms = await attendanceRepository.listExamRooms(client, req.ctx!.institutionId, req.params.id);
  res.json(rooms);
}

export async function createExamRoom(req: Request, res: Response, client: PoolClient) {
  const room = await attendanceRepository.createExamRoom(
    client,
    req.ctx!.institutionId,
    { ...req.body, examId: req.params.id },
    req.ctx?.membershipId
  );
  res.status(201).json(room);
}

export async function deleteExamRoom(req: Request, res: Response, client: PoolClient) {
  await attendanceRepository.deleteExamRoom(client, req.ctx!.institutionId, req.params.roomId, req.ctx?.membershipId);
  res.json({ success: true });
}

export async function getExamProgress(req: Request, res: Response, client: PoolClient) {
  const progress = await attendanceRepository.getExamProgress(client, req.ctx!.institutionId, req.params.id);
  res.json(progress);
}

export async function notifyPendingTeachers(req: Request, res: Response, client: PoolClient) {
  const result = await attendanceRepository.notifyPendingTeachers(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.json(result);
}

export async function publishExam(req: Request, res: Response, client: PoolClient) {
  const result = await attendanceRepository.publishExam(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.json(result);
}

export async function listMarks(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  let studentId = req.query.studentId as string | undefined;
  const examId = req.query.examId as string | undefined;
  const subjectId = req.query.subjectId as string | undefined;

  let allowedSectionIds: string[] | undefined;

  if (grantedScope === 'self') {
    const selfStudentId = await attendanceRepository.getStudentIdForUser(client, req.ctx!.userId);
    if (!selfStudentId) {
      return res.json([]);
    }
    studentId = selfStudentId;
  } else if (grantedScope === 'assigned_sections') {
    allowedSectionIds = await attendanceRepository.getTeacherAssignedSectionIds(client, req.ctx!.membershipId);
  }

  const marks = await attendanceRepository.listMarks(client, req.ctx!.institutionId, {
    examId,
    studentId,
    subjectId,
    allowedSectionIds,
  });
  res.json(marks);
}

export async function recordMarks(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  const { marks } = req.body;
  if (!Array.isArray(marks) || marks.length === 0) {
    return res.status(400).json({ error: 'marks must be a non-empty array', code: 'VALIDATION_ERROR' });
  }

  if (grantedScope === 'assigned_sections') {
    for (const m of marks) {
      const isAllowed = await attendanceRepository.isTeacherAllowedForStudentSubject(
        client,
        req.ctx!.membershipId,
        m.studentId,
        m.subjectId
      );
      if (!isAllowed) {
        return res.status(403).json({
          error: `Teacher is not assigned to teach subject ${m.subjectId} for student ${m.studentId}`,
          code: 'FORBIDDEN',
        });
      }
    }
  }

  const results = await attendanceRepository.recordMarks(
    client,
    req.ctx!.institutionId,
    req.ctx!.membershipId,
    marks
  );
  res.status(201).json(results);
}

// --- Employee Attendance Handlers ---
export async function listEmployeeAttendance(req: Request, res: Response, client: PoolClient) {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const roleId = req.query.roleId as string | undefined;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

  let membershipId: string | undefined;
  if (req.grantedScope === 'self') {
    membershipId = req.ctx!.membershipId;
  }

  const result = await attendanceRepository.listEmployeeAttendance(client, req.ctx!.institutionId, {
    date,
    roleId,
    status,
    search,
    limit,
    offset,
    membershipId,
  });
  res.json(result);
}

export async function markEmployeeAttendance(req: Request, res: Response, client: PoolClient) {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records must be a non-empty array', code: 'VALIDATION_ERROR' });
  }

  if (req.grantedScope === 'self') {
    for (const r of records) {
      if (r.membershipId !== req.ctx?.membershipId) {
        return res.status(403).json({ error: 'Self scope users can only mark their own attendance', code: 'FORBIDDEN' });
      }
    }
  }

  const results = await attendanceRepository.markEmployeeAttendanceBatch(
    client,
    req.ctx!.institutionId,
    req.ctx?.membershipId,
    records
  );
  res.status(200).json({ success: true, count: results.length, records: results });
}

export async function getEmployeeAttendanceSummary(req: Request, res: Response, client: PoolClient) {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const summary = await attendanceRepository.getEmployeeAttendanceSummary(
    client,
    req.ctx!.institutionId,
    date
  );
  res.json(summary);
}

