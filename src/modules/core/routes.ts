import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { coreRepository } from './repository';
import { documentsRepo } from '../documents/repository.js';

// --- Institutions ---
export async function createInstitution(req: Request, res: Response, client: PoolClient) {
  const inst = await coreRepository.createInstitution(client, req.body);
  res.status(201).json(inst);
}

// --- Permissions Catalog & Matrix ---
export async function listPermissions(req: Request, res: Response, client: PoolClient) {
  const permissions = await coreRepository.listPermissions(client);
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200');
  res.json(permissions);
}

// --- Roles ---
export async function listRoles(req: Request, res: Response, client: PoolClient) {
  const roles = await coreRepository.listRoles(client, req.ctx!.institutionId);
  res.json(roles);
}

export async function createRole(req: Request, res: Response, client: PoolClient) {
  const role = await coreRepository.createRole(client, req.ctx!.institutionId, req.body, req.ctx?.membershipId);
  res.status(201).json(role);
}

export async function getRolePermissions(req: Request, res: Response, client: PoolClient) {
  const roleId = req.params.id;
  const permissions = await coreRepository.getRolePermissions(client, roleId);
  res.json(permissions);
}

export async function updateRolePermissions(req: Request, res: Response, client: PoolClient) {
  const roleId = req.params.id;
  const { permissions } = req.body;
  await coreRepository.updateRolePermissions(
    client,
    req.ctx!.institutionId,
    roleId,
    permissions,
    req.ctx?.membershipId
  );
  res.status(200).json({ success: true });
}

// --- Members / Staff ---
export async function listMembers(req: Request, res: Response, client: PoolClient) {
  const members = await coreRepository.listMembers(client, req.ctx!.institutionId);
  res.json(members);
}

export async function inviteMember(req: Request, res: Response, client: PoolClient) {
  const member = await coreRepository.inviteMember(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(member);
}

export async function updateMember(req: Request, res: Response, client: PoolClient) {
  const member = await coreRepository.updateMember(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.json(member);
}

export async function deleteMember(req: Request, res: Response, client: PoolClient) {
  await coreRepository.deleteMember(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.json({ success: true });
}

export async function bulkDeleteMembers(req: Request, res: Response, client: PoolClient) {
  const { memberIds } = req.body;
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds must be a non-empty array' });
  }
  const count = await coreRepository.bulkDeleteMembers(client, req.ctx!.institutionId, memberIds, req.ctx?.membershipId);
  res.json({ success: true, count });
}

// --- Academic Structure ---
export async function listAcademicYears(req: Request, res: Response, client: PoolClient) {
  const years = await coreRepository.listAcademicYears(client, req.ctx!.institutionId);
  res.json(years);
}

export async function createAcademicYear(req: Request, res: Response, client: PoolClient) {
  const ay = await coreRepository.createAcademicYear(client, req.ctx!.institutionId, req.body, req.ctx?.membershipId);
  res.status(201).json(ay);
}

export async function listClasses(req: Request, res: Response, client: PoolClient) {
  const classes = await coreRepository.listClasses(client, req.ctx!.institutionId);
  res.json(classes);
}

export async function createClass(req: Request, res: Response, client: PoolClient) {
  const cls = await coreRepository.createClass(client, req.ctx!.institutionId, req.body, req.ctx?.membershipId);
  res.status(201).json(cls);
}

export async function listSections(req: Request, res: Response, client: PoolClient) {
  const classId = req.query.classId as string | undefined;
  const sections = await coreRepository.listSections(client, req.ctx!.institutionId, classId);
  res.json(sections);
}

export async function createSection(req: Request, res: Response, client: PoolClient) {
  const sec = await coreRepository.createSection(client, req.ctx!.institutionId, req.body, req.ctx?.membershipId);
  res.status(201).json(sec);
}

export async function updateSection(req: Request, res: Response, client: PoolClient) {
  const sec = await coreRepository.updateSection(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.json(sec);
}

export async function listSubjects(req: Request, res: Response, client: PoolClient) {
  const subjects = await coreRepository.listSubjects(client, req.ctx!.institutionId);
  res.json(subjects);
}

export async function createSubject(req: Request, res: Response, client: PoolClient) {
  const subj = await coreRepository.createSubject(client, req.ctx!.institutionId, req.body, req.ctx?.membershipId);
  res.status(201).json(subj);
}

export async function listTeachers(req: Request, res: Response, client: PoolClient) {
  const teachers = await coreRepository.listTeachers(client, req.ctx!.institutionId);
  res.json(teachers);
}

export async function listClassSubjectTeachers(req: Request, res: Response, client: PoolClient) {
  const assignments = await coreRepository.listClassSubjectTeachers(client, req.ctx!.institutionId);
  res.json(assignments);
}

export async function assignClassSubjectTeacher(req: Request, res: Response, client: PoolClient) {
  const assignment = await coreRepository.assignClassSubjectTeacher(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(assignment);
}

// --- Class Timetables & Schedules ---
export async function listSchedules(req: Request, res: Response, client: PoolClient) {
  const sectionId = req.query.sectionId as string | undefined;
  const dayOfWeek = req.query.dayOfWeek as string | undefined;
  const schedules = await coreRepository.listSchedules(client, req.ctx!.institutionId, {
    sectionId,
    dayOfWeek,
    grantedScope: req.grantedScope,
    userId: req.ctx?.userId,
    membershipId: req.ctx?.membershipId,
  });
  res.json(schedules);
}

export async function createSchedule(req: Request, res: Response, client: PoolClient) {
  const schedule = await coreRepository.createSchedule(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(schedule);
}

export async function updateSchedule(req: Request, res: Response, client: PoolClient) {
  const schedule = await coreRepository.updateSchedule(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.json(schedule);
}

export async function deleteSchedule(req: Request, res: Response, client: PoolClient) {
  await coreRepository.deleteSchedule(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.json({ success: true });
}

// --- Dynamic Custom Fields ---
export async function listCustomFields(req: Request, res: Response, client: PoolClient) {
  const entityType = req.query.entityType as string | undefined;
  const fields = await coreRepository.listCustomFields(client, req.ctx!.institutionId, entityType);
  res.json(fields);
}

export async function createCustomField(req: Request, res: Response, client: PoolClient) {
  const field = await coreRepository.createCustomField(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(field);
}

export async function deleteCustomField(req: Request, res: Response, client: PoolClient) {
  await coreRepository.deleteCustomField(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.json({ success: true });
}

// --- Audit Logs / Activity Log ---
export async function listAuditLogs(req: Request, res: Response, client: PoolClient) {
  const action = req.query.action as string | undefined;
  const entityType = req.query.entityType as string | undefined;
  const actorMembershipId = req.query.actorMembershipId as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

  const result = await coreRepository.listAuditLogs(client, req.ctx!.institutionId, {
    action,
    entityType,
    actorMembershipId,
    dateFrom,
    dateTo,
    limit,
    offset,
  });
  res.json(result);
}

// --- Students & Enrollments ---
export async function listStudents(req: Request, res: Response, client: PoolClient) {
  const classId = req.query.classId as string | undefined;
  const sectionId = req.query.sectionId as string | undefined;
  const status = req.query.status as string | undefined;
  const students = await coreRepository.listStudents(client, req.ctx!.institutionId, {
    classId,
    sectionId,
    status,
    grantedScope: req.grantedScope,
    userId: req.ctx?.userId,
    membershipId: req.ctx?.membershipId,
  });
  res.json(students);
}

export async function createStudent(req: Request, res: Response, client: PoolClient) {
  const student = await coreRepository.createStudent(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(student);
}

export async function updateStudent(req: Request, res: Response, client: PoolClient) {
  const student = await coreRepository.updateStudent(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.json(student);
}

export async function deleteStudent(req: Request, res: Response, client: PoolClient) {
  await coreRepository.deleteStudent(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.json({ success: true });
}

export async function bulkDeleteStudents(req: Request, res: Response, client: PoolClient) {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: 'studentIds must be a non-empty array' });
  }
  const count = await coreRepository.bulkDeleteStudents(client, req.ctx!.institutionId, studentIds, req.ctx?.membershipId);
  res.json({ success: true, count });
}

export async function getStudentAcademicHistory(req: Request, res: Response, client: PoolClient) {
  const history = await coreRepository.getStudentAcademicHistory(
    client,
    req.ctx!.institutionId,
    req.params.id,
    {
      grantedScope: req.grantedScope,
      userId: req.ctx?.userId,
      membershipId: req.ctx?.membershipId,
    }
  );
  res.json(history);
}

export async function bulkImportStudents(req: Request, res: Response, client: PoolClient) {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'students must be a non-empty array', code: 'VALIDATION_ERROR' });
  }
  const count = await coreRepository.bulkImportStudents(
    client,
    req.ctx!.institutionId,
    students,
    req.ctx?.membershipId
  );
  res.status(201).json({ success: true, count });
}

export async function listEnrollments(req: Request, res: Response, client: PoolClient) {
  const sectionId = req.query.sectionId as string | undefined;
  const enrollments = await coreRepository.listEnrollments(client, req.ctx!.institutionId, sectionId);
  res.json(enrollments);
}

export async function createEnrollment(req: Request, res: Response, client: PoolClient) {
  const enrollment = await coreRepository.createEnrollment(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(enrollment);
}

// --- Notifications Route Handlers ---
export async function listNotifications(req: Request, res: Response, client: PoolClient) {
  const limit = req.query.limit ? Number(req.query.limit) : 30;
  const result = await coreRepository.listNotifications(
    client,
    req.ctx!.institutionId,
    req.ctx!.userId,
    req.ctx!.membershipId,
    limit
  );
  res.json(result);
}

export async function markNotificationRead(req: Request, res: Response, client: PoolClient) {
  await coreRepository.markNotificationRead(client, req.ctx!.institutionId, req.params.id);
  res.json({ success: true });
}

export async function markAllNotificationsRead(req: Request, res: Response, client: PoolClient) {
  await coreRepository.markAllNotificationsRead(
    client,
    req.ctx!.institutionId,
    req.ctx!.userId,
    req.ctx!.membershipId
  );
  res.json({ success: true });
}

// --- Tasks Route Handlers ---
export async function listTasks(req: Request, res: Response, client: PoolClient) {
  const filter = (req.query.filter as any) || 'all';
  const tasks = await coreRepository.listTasks(
    client,
    req.ctx!.institutionId,
    req.ctx!.membershipId,
    filter,
    req.grantedScope
  );
  res.json(tasks);
}

export async function createTask(req: Request, res: Response, client: PoolClient) {
  const task = await coreRepository.createTask(client, req.ctx!.institutionId, {
    ...req.body,
    creatorMembershipId: req.ctx?.membershipId,
  });
  res.status(201).json(task);
}

export async function updateTaskStatus(req: Request, res: Response, client: PoolClient) {
  const { status } = req.body;
  if (!status || !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Valid status is required' });
  }
  const task = await coreRepository.updateTaskStatus(
    client,
    req.ctx!.institutionId,
    req.params.id,
    status,
    req.ctx?.membershipId
  );
  res.json(task);
}

export async function deleteTask(req: Request, res: Response, client: PoolClient) {
  await coreRepository.deleteTask(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.json({ success: true });
}

// --- Institution Settings Handlers ---
export async function getInstitutionSettings(req: Request, res: Response, client: PoolClient) {
  const settings = await coreRepository.getInstitutionSettings(client, req.ctx!.institutionId);
  res.json(settings);
}

export async function updateInstitutionSettings(req: Request, res: Response, client: PoolClient) {
  const settings = await coreRepository.updateInstitutionSettings(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.json(settings);
}

// --- Unified Academic Migration Wizard Handler ---
export async function bulkImportAcademicRoster(req: Request, res: Response, client: PoolClient) {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records must be a non-empty array' });
  }
  const summary = await coreRepository.bulkImportAcademicRoster(
    client,
    req.ctx!.institutionId,
    records,
    req.ctx?.membershipId
  );
  res.status(201).json(summary);
}

// --- Document & Certificate Templates ---
export async function listTemplates(req: Request, res: Response, client: PoolClient) {
  const type = req.query.type as string | undefined;
  const context = req.query.context as string | undefined;
  const templates = await documentsRepo.listTemplates(client, req.ctx!.institutionId, { type, context });
  res.json(templates);
}

export async function getTemplate(req: Request, res: Response, client: PoolClient) {
  const template = await documentsRepo.getTemplateById(client, req.ctx!.institutionId, req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(template);
}

export async function createTemplate(req: Request, res: Response, client: PoolClient) {
  const template = await documentsRepo.createTemplate(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(template);
}

export async function updateTemplate(req: Request, res: Response, client: PoolClient) {
  try {
    const template = await documentsRepo.updateTemplate(
      client,
      req.ctx!.institutionId,
      req.params.id,
      req.body,
      req.ctx?.membershipId
    );
    res.json(template);
  } catch (err: any) {
    if (err.message && err.message.includes('SYSTEM_TEMPLATE_READONLY')) {
      return res.status(403).json({ error: err.message, code: 'SYSTEM_TEMPLATE_READONLY' });
    }
    throw err;
  }
}

export async function deleteTemplate(req: Request, res: Response, client: PoolClient) {
  try {
    const result = await documentsRepo.deleteTemplate(
      client,
      req.ctx!.institutionId,
      req.params.id,
      req.ctx?.membershipId
    );
    res.json(result);
  } catch (err: any) {
    if (err.message && err.message.includes('SYSTEM_TEMPLATE_READONLY')) {
      return res.status(403).json({ error: err.message, code: 'SYSTEM_TEMPLATE_READONLY' });
    }
    throw err;
  }
}

export async function renderTemplate(req: Request, res: Response, client: PoolClient) {
  const { studentId, entityId, entityType, variables, saveSnapshot, title } = req.body || {};
  const rendered = await documentsRepo.renderTemplate(
    client,
    req.ctx!.institutionId,
    req.params.id,
    {
      studentId,
      entityId,
      entityType,
      variables,
      saveSnapshot,
      title,
    },
    req.ctx?.membershipId
  );
  res.json(rendered);
}




// --- Classrooms ---
export async function listClassrooms(req: Request, res: Response, client: PoolClient) {
  const rooms = await coreRepository.listClassrooms(client, req.ctx!.institutionId);
  res.json(rooms);
}

export async function createClassroom(req: Request, res: Response, client: PoolClient) {
  const room = await coreRepository.createClassroom(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(room);
}

export async function updateClassroom(req: Request, res: Response, client: PoolClient) {
  const room = await coreRepository.updateClassroom(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.json(room);
}

export async function deleteClassroom(req: Request, res: Response, client: PoolClient) {
  await coreRepository.deleteClassroom(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.json({ success: true });
}

// --- Class Overview & Live Periods ---
export async function getClassOverview(req: Request, res: Response, client: PoolClient) {
  const overview = await coreRepository.getClassOverview(client, req.ctx!.institutionId, req.params.id);
  res.json(overview);
}

export async function getLivePeriods(req: Request, res: Response, client: PoolClient) {
  const data = await coreRepository.getLivePeriods(client, req.ctx!.institutionId, {
    userId: req.ctx?.userId,
    membershipId: req.ctx?.membershipId,
    roleName: req.ctx?.roleName,
  });
  res.json(data);
}

// --- Period Substitutions & Teacher History ---
export async function recordPeriodSubstitution(req: Request, res: Response, client: PoolClient) {
  const result = await coreRepository.recordPeriodSubstitution(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(result);
}

export async function getTeacherHistory(req: Request, res: Response, client: PoolClient) {
  const history = await coreRepository.getTeacherHistory(client, req.ctx!.institutionId, req.params.id);
  res.json(history);
}

// --- Member Requests Engine ---
export async function listRequests(req: Request, res: Response, client: PoolClient) {
  const filter = (req.query.filter as any) || 'my_requests';
  const category = req.query.category as string | undefined;
  const status = req.query.status as string | undefined;
  const requests = await coreRepository.listRequests(
    client,
    req.ctx!.institutionId,
    {
      membershipId: req.ctx!.membershipId,
      userId: req.ctx?.userId,
      roleName: req.ctx?.roleName,
      filter,
    },
    { category, status }
  );
  res.json(requests);
}

export async function createRequest(req: Request, res: Response, client: PoolClient) {
  const created = await coreRepository.createRequest(
    client,
    req.ctx!.institutionId,
    req.body,
    {
      membershipId: req.ctx!.membershipId,
      userId: req.ctx?.userId,
      roleName: req.ctx?.roleName,
    }
  );
  res.status(201).json(created);
}

export async function updateRequestStatus(req: Request, res: Response, client: PoolClient) {
  const updated = await coreRepository.updateRequestStatus(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.json(updated);
}

export async function bulkUpdateRequestStatus(req: Request, res: Response, client: PoolClient) {
  const { requestIds, status, notes } = req.body;
  const count = await coreRepository.bulkUpdateRequestStatus(
    client,
    req.ctx!.institutionId,
    requestIds,
    status,
    notes,
    req.ctx?.membershipId
  );
  res.json({ success: true, count });
}

// --- Universal Bulk Operations ---
export async function bulkAssignManager(req: Request, res: Response, client: PoolClient) {
  const { membershipIds, managerMembershipId } = req.body;
  const count = await coreRepository.bulkAssignManager(
    client,
    req.ctx!.institutionId,
    membershipIds,
    managerMembershipId,
    req.ctx?.membershipId
  );
  res.json({ success: true, count });
}

export async function bulkUpdateMemberRole(req: Request, res: Response, client: PoolClient) {
  const { membershipIds, roleId } = req.body;
  const count = await coreRepository.bulkUpdateMemberRole(
    client,
    req.ctx!.institutionId,
    membershipIds,
    roleId,
    req.ctx?.membershipId
  );
  res.json({ success: true, count });
}

export async function bulkUpdateStudentStatus(req: Request, res: Response, client: PoolClient) {
  const { studentIds, status } = req.body;
  const count = await coreRepository.bulkUpdateStudentStatus(
    client,
    req.ctx!.institutionId,
    studentIds,
    status,
    req.ctx?.membershipId
  );
  res.json({ success: true, count });
}

export async function bulkTransferStudentSection(req: Request, res: Response, client: PoolClient) {
  const { studentIds, classId, sectionId } = req.body;
  const count = await coreRepository.bulkTransferStudentSection(
    client,
    req.ctx!.institutionId,
    studentIds,
    classId,
    sectionId,
    req.ctx?.membershipId
  );
  res.json({ success: true, count });
}

export async function remindManager(req: Request, res: Response, client: PoolClient) {
  const result = await coreRepository.remindManager(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.ctx?.membershipId
  );
  res.json(result);
}

export async function dispatchReminder(req: Request, res: Response, client: PoolClient) {
  const result = await coreRepository.dispatchReminder(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.json(result);
}
