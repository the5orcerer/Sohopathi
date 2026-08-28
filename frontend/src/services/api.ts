import type {
  DashboardPayload,
  NavItem,
  Session,
  ApiLog,
  PermissionDefinition,
  Role,
  RolePermissionGrant,
  Member,
  AcademicYear,
  ClassItem,
  SectionItem,
  SubjectItem,
  TeacherAssignment,
  StudentItem,
  EnrollmentItem,
  AttendanceSheetItem,
  AttendanceSummaryData,
  ExamItem,
  ExamPaperItem,
  MarkItem,
  Notice,
  InstitutionItem,
  ClassScheduleItem,
  CustomFieldDefinition,
  AuditLogEntry,
  StudentAcademicHistory,
  Assignment,
  AssignmentStatisticsData,
  NotificationItem,
  UserTaskItem,
  InstitutionSettingsData,
  AcademicMigrationSummary,
} from '../types';

let currentToken = 'mock-token-admin-1';
let currentInstitutionId = 'f2c10000-0000-0000-0000-000000000001';

type LogListener = (logs: ApiLog[]) => void;
const apiLogs: ApiLog[] = [];
const logListeners: Set<LogListener> = new Set();

export function subscribeApiLogs(listener: LogListener) {
  logListeners.add(listener);
  listener([...apiLogs]);
  return () => {
    logListeners.delete(listener);
  };
}

function recordLog(log: ApiLog) {
  apiLogs.unshift(log);
  if (apiLogs.length > 50) apiLogs.pop();
  logListeners.forEach((l) => l([...apiLogs]));
}

export function setApiAuth(token: string, institutionId: string) {
  currentToken = token;
  currentInstitutionId = institutionId;
}

export function getApiAuth() {
  return { token: currentToken, institutionId: currentInstitutionId };
}

export async function fetchWithAuth<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const startTime = Date.now();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${currentToken}`,
    'x-institution-id': currentInstitutionId,
    ...(options.headers as Record<string, string>),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const durationMs = Date.now() - startTime;

    if (res.ok) {
      const data = res.status === 204 ? ({} as T) : await res.json();
      recordLog({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        method: options.method || 'GET',
        url,
        status: res.status,
        headers,
        responsePayload: data,
        durationMs,
      });
      return data as T;
    } else {
      const err = await res.json().catch(() => ({ error: `Request failed with HTTP ${res.status}` }));
      recordLog({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        method: options.method || 'GET',
        url,
        status: res.status,
        headers,
        responsePayload: err,
        durationMs,
      });
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  } catch (error: any) {
    if (!error.message?.startsWith('HTTP') && !error.message?.includes('Request failed')) {
      recordLog({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        method: options.method || 'GET',
        url,
        status: 0,
        headers,
        responsePayload: { error: error.message },
        durationMs: Date.now() - startTime,
      });
    }
    throw error;
  }
}

// User Self-Service Profile Update
export async function updateSelfProfile(data: {
  name?: string;
  phone?: string;
  avatarUrl?: string;
  password?: string;
}): Promise<{ success: boolean; user: any }> {
  return fetchWithAuth<{ success: boolean; user: any }>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Session & Navigation
export async function fetchSession(): Promise<Session> {
  return fetchWithAuth<Session>('/api/system/me');
}

export async function fetchNavItems(): Promise<NavItem[]> {
  try {
    return await fetchWithAuth<NavItem[]>('/api/system/nav');
  } catch {
    return await fetchWithAuth<NavItem[]>('/api/nav');
  }
}
export const fetchNav = fetchNavItems;

export async function fetchDashboardLayout(): Promise<DashboardPayload> {
  try {
    return await fetchWithAuth<DashboardPayload>('/api/system/dashboard');
  } catch {
    return await fetchWithAuth<DashboardPayload>('/api/dashboard');
  }
}
export const fetchDashboard = fetchDashboardLayout;

export async function provisionInstitution(data: {
  name: string;
  subdomain: string;
  adminName: string;
  adminEmail: string;
  adminUsername?: string;
  adminPassword?: string;
  branding?: any;
}): Promise<any> {
  try {
    return await fetchWithAuth('/api/onboarding/institutions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch {
    return await fetchWithAuth('/api/auth/onboard', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export async function saveDashboardLayout(payload: DashboardPayload): Promise<void> {
  return fetchWithAuth('/api/system/dashboard', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchWidgetData<T = any>(dataSource: string): Promise<T> {
  return fetchWithAuth<T>(dataSource);
}

// Institutions & Roles
export async function fetchInstitutions(): Promise<InstitutionItem[]> {
  return fetchWithAuth<InstitutionItem[]>('/api/system/institutions');
}

export async function fetchPermissions(): Promise<PermissionDefinition[]> {
  return fetchWithAuth<PermissionDefinition[]>('/api/core/permissions');
}

export async function fetchRoles(): Promise<Role[]> {
  return fetchWithAuth<Role[]>('/api/core/roles');
}

export async function createRole(data: { name: string; templateRoleId?: string }): Promise<Role> {
  return fetchWithAuth<Role>('/api/core/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchRolePermissions(roleId: string): Promise<RolePermissionGrant[]> {
  return fetchWithAuth<RolePermissionGrant[]>(`/api/core/roles/${roleId}/permissions`);
}

export async function updateRolePermissions(
  roleId: string,
  permissions: Array<{ permissionKey: string; scope: string }>
): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/core/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  });
}

// Members / Staff
export async function fetchMembers(): Promise<Member[]> {
  return fetchWithAuth<Member[]>('/api/core/members');
}

export async function inviteMember(data: {
  name: string;
  email: string;
  roleId: string;
  phone?: string;
  username?: string;
  temporaryPassword?: string;
  customFields?: Record<string, any>;
}): Promise<Member> {
  return fetchWithAuth<Member>('/api/core/members/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMember(
  memberId: string,
  data: { name?: string; phone?: string; email?: string; username?: string; roleId?: string; status?: string; customFields?: Record<string, any> }
): Promise<Member> {
  return fetchWithAuth<Member>(`/api/core/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteMember(memberId: string): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/core/members/${memberId}`, {
    method: 'DELETE',
  });
}

export async function bulkDeleteMembers(memberIds: string[]): Promise<{ success: boolean; count: number }> {
  return fetchWithAuth<{ success: boolean; count: number }>('/api/core/members/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ memberIds }),
  });
}

// Academic Core
export async function fetchAcademicYears(): Promise<AcademicYear[]> {
  return fetchWithAuth<AcademicYear[]>('/api/core/academic-years');
}

export async function createAcademicYear(data: {
  label: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}): Promise<AcademicYear> {
  return fetchWithAuth<AcademicYear>('/api/core/academic-years', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchClasses(): Promise<ClassItem[]> {
  return fetchWithAuth<ClassItem[]>('/api/core/classes');
}

export async function createClass(data: {
  academicYearId: string;
  name: string;
  sortOrder?: number;
}): Promise<ClassItem> {
  return fetchWithAuth<ClassItem>('/api/core/classes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchSections(classId?: string): Promise<SectionItem[]> {
  const url = classId ? `/api/core/sections?classId=${classId}` : '/api/core/sections';
  return fetchWithAuth<SectionItem[]>(url);
}

export async function createSection(data: {
  classId: string;
  name: string;
  capacity?: number;
}): Promise<SectionItem> {
  return fetchWithAuth<SectionItem>('/api/core/sections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchSubjects(): Promise<SubjectItem[]> {
  return fetchWithAuth<SubjectItem[]>('/api/core/subjects');
}

export async function createSubject(data: {
  name: string;
  code?: string;
}): Promise<SubjectItem> {
  return fetchWithAuth<SubjectItem>('/api/core/subjects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchTeachers(): Promise<Array<{ membershipId: string; name: string; email: string }>> {
  return fetchWithAuth<Array<{ membershipId: string; name: string; email: string }>>('/api/core/teachers');
}

export async function fetchTeacherAssignments(): Promise<TeacherAssignment[]> {
  return fetchWithAuth<TeacherAssignment[]>('/api/core/teacher-assignments');
}

export async function assignTeacher(data: {
  sectionId: string;
  subjectId: string;
  teacherMembershipId: string;
}): Promise<TeacherAssignment> {
  return fetchWithAuth<TeacherAssignment>('/api/core/teacher-assignments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Class Timetable & Schedules
export async function fetchSchedules(filters?: { sectionId?: string; dayOfWeek?: string }): Promise<ClassScheduleItem[]> {
  const params = new URLSearchParams();
  if (filters?.sectionId) params.set('sectionId', filters.sectionId);
  if (filters?.dayOfWeek) params.set('dayOfWeek', filters.dayOfWeek);
  const qs = params.toString();
  return fetchWithAuth<ClassScheduleItem[]>(`/api/core/schedules${qs ? `?${qs}` : ''}`);
}

export async function createSchedule(data: {
  sectionId: string;
  subjectId: string;
  teacherMembershipId?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomNo?: string;
}): Promise<ClassScheduleItem> {
  return fetchWithAuth<ClassScheduleItem>('/api/core/schedules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSchedule(
  scheduleId: string,
  data: {
    subjectId?: string;
    teacherMembershipId?: string;
    dayOfWeek?: string;
    startTime?: string;
    endTime?: string;
    roomNo?: string;
  }
): Promise<ClassScheduleItem> {
  return fetchWithAuth<ClassScheduleItem>(`/api/core/schedules/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSchedule(scheduleId: string): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/core/schedules/${scheduleId}`, {
    method: 'DELETE',
  });
}

// Dynamic Custom Fields (Lattice HR / Notion style)
export async function fetchCustomFields(entityType?: string): Promise<CustomFieldDefinition[]> {
  const url = entityType ? `/api/core/custom-fields?entityType=${entityType}` : '/api/core/custom-fields';
  return fetchWithAuth<CustomFieldDefinition[]>(url);
}

export async function createCustomField(data: {
  entityType: 'student' | 'member' | 'class' | 'section';
  label: string;
  fieldKey?: string;
  fieldType?: string;
  options?: string[];
  isRequired?: boolean;
  sortOrder?: number;
}): Promise<CustomFieldDefinition> {
  return fetchWithAuth<CustomFieldDefinition>('/api/core/custom-fields', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteCustomField(fieldId: string): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/core/custom-fields/${fieldId}`, {
    method: 'DELETE',
  });
}

// Activity Log & Audit Trail
export async function fetchAuditLogs(filters?: {
  action?: string;
  entityType?: string;
  actorMembershipId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.action) params.set('action', filters.action);
  if (filters?.entityType) params.set('entityType', filters.entityType);
  if (filters?.actorMembershipId) params.set('actorMembershipId', filters.actorMembershipId);
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.set('dateTo', filters.dateTo);
  if (filters?.limit) params.set('limit', filters.limit.toString());
  if (filters?.offset) params.set('offset', filters.offset.toString());
  const qs = params.toString();
  return fetchWithAuth<{ logs: AuditLogEntry[]; total: number }>(`/api/core/audit-logs${qs ? `?${qs}` : ''}`);
}

// Students & Enrollments
export async function fetchStudents(filters?: { classId?: string; sectionId?: string; status?: string }): Promise<StudentItem[]> {
  const params = new URLSearchParams();
  if (filters?.classId) params.set('classId', filters.classId);
  if (filters?.sectionId) params.set('sectionId', filters.sectionId);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return fetchWithAuth<StudentItem[]>(`/api/core/students${qs ? `?${qs}` : ''}`);
}

export async function createStudent(data: {
  admissionNo: string;
  name: string;
  gender?: string;
  dateOfBirth?: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  rollNo?: string;
  customFields?: Record<string, any>;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
}): Promise<StudentItem> {
  return fetchWithAuth<StudentItem>('/api/core/students', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStudent(
  studentId: string,
  data: {
    admissionNo?: string;
    name?: string;
    dateOfBirth?: string;
    gender?: string;
    status?: string;
    classId?: string;
    sectionId?: string;
    rollNo?: string;
    customFields?: Record<string, any>;
    guardianName?: string;
    guardianPhone?: string;
    guardianRelation?: string;
  }
): Promise<StudentItem> {
  return fetchWithAuth<StudentItem>(`/api/core/students/${studentId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteStudent(studentId: string): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/core/students/${studentId}`, {
    method: 'DELETE',
  });
}

export async function bulkDeleteStudents(studentIds: string[]): Promise<{ success: boolean; count: number }> {
  return fetchWithAuth<{ success: boolean; count: number }>('/api/core/students/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ studentIds }),
  });
}

export async function fetchStudentAcademicHistory(studentId: string): Promise<StudentAcademicHistory> {
  return fetchWithAuth<StudentAcademicHistory>(`/api/core/students/${studentId}/academic-history`);
}

export async function bulkImportStudents(students: Array<{
  admissionNo: string;
  name: string;
  gender?: string;
  dateOfBirth?: string;
  classId: string;
  sectionId: string;
  rollNo?: string;
  customFields?: Record<string, any>;
}>): Promise<{ success: boolean; count: number }> {
  return fetchWithAuth<{ success: boolean; count: number }>('/api/core/students/bulk-import', {
    method: 'POST',
    body: JSON.stringify({ students }),
  });
}

export async function fetchEnrollments(sectionId?: string): Promise<EnrollmentItem[]> {
  const url = sectionId ? `/api/core/enrollments?sectionId=${sectionId}` : '/api/core/enrollments';
  return fetchWithAuth<EnrollmentItem[]>(url);
}

// Attendance
export async function fetchAttendanceSheet(sectionId: string, date: string): Promise<AttendanceSheetItem[]> {
  return fetchWithAuth<AttendanceSheetItem[]>(`/api/attendance/sheet?sectionId=${sectionId}&date=${date}`);
}

export async function markAttendanceBatch(records: Array<{
  studentId: string;
  sectionId: string;
  date: string;
  status: string;
}>): Promise<any> {
  return fetchWithAuth('/api/attendance', {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
}

export async function fetchAttendanceSummary(): Promise<AttendanceSummaryData[]> {
  return fetchWithAuth<AttendanceSummaryData[]>('/api/attendance/summary');
}

// Examinations & Papers
export async function fetchExams(academicYearId?: string): Promise<ExamItem[]> {
  const url = academicYearId ? `/api/attendance/exams?academicYearId=${academicYearId}` : '/api/attendance/exams';
  return fetchWithAuth<ExamItem[]>(url);
}

export async function createExam(data: {
  academicYearId: string;
  name: string;
  term?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ExamItem> {
  return fetchWithAuth<ExamItem>('/api/attendance/exams', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExam(
  examId: string,
  data: { name?: string; term?: string; startDate?: string; endDate?: string; isPublished?: boolean }
): Promise<ExamItem> {
  return fetchWithAuth<ExamItem>(`/api/attendance/exams/${examId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteExam(examId: string): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/attendance/exams/${examId}`, {
    method: 'DELETE',
  });
}

export async function fetchExamPapers(examId: string): Promise<ExamPaperItem[]> {
  return fetchWithAuth<ExamPaperItem[]>(`/api/attendance/exams/${examId}/papers`);
}

export async function createExamPaper(
  examId: string,
  data: {
    subjectId: string;
    examDate?: string;
    startTime?: string;
    endTime?: string;
    roomNo?: string;
    maxMarks?: number;
    passMarks?: number;
    theoryWeight?: number;
    practicalWeight?: number;
    vivaWeight?: number;
  }
): Promise<ExamPaperItem> {
  return fetchWithAuth<ExamPaperItem>(`/api/attendance/exams/${examId}/papers`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteExamPaper(examId: string, paperId: string): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/attendance/exams/${examId}/papers/${paperId}`, {
    method: 'DELETE',
  });
}

// Marks & Scoring
export async function fetchMarks(filters?: { examId?: string; studentId?: string; subjectId?: string }): Promise<MarkItem[]> {
  const params = new URLSearchParams();
  if (filters?.examId) params.set('examId', filters.examId);
  if (filters?.studentId) params.set('studentId', filters.studentId);
  if (filters?.subjectId) params.set('subjectId', filters.subjectId);
  const qs = params.toString();
  return fetchWithAuth<MarkItem[]>(`/api/attendance/marks${qs ? `?${qs}` : ''}`);
}

export async function recordMarks(marks: Array<{
  examId: string;
  studentId: string;
  subjectId: string;
  marksObtained?: number;
  maxMarks: number;
  grade?: string;
}>): Promise<any> {
  return fetchWithAuth('/api/attendance/marks', {
    method: 'POST',
    body: JSON.stringify({ marks }),
  });
}

// Assignments & Submissions
export async function fetchAssignments(filters?: { sectionId?: string; status?: string }): Promise<Assignment[]> {
  const params = new URLSearchParams();
  if (filters?.sectionId) params.set('sectionId', filters.sectionId);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return fetchWithAuth<Assignment[]>(`/api/assignments${qs ? `?${qs}` : ''}`);
}

export async function createAssignment(data: {
  sectionId: string;
  subjectId: string;
  title: string;
  description?: string;
  dueDate?: string;
}): Promise<Assignment> {
  return fetchWithAuth<Assignment>('/api/assignments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAssignment(
  id: string,
  data: { title?: string; description?: string; dueDate?: string }
): Promise<Assignment> {
  return fetchWithAuth<Assignment>(`/api/assignments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAssignment(id: string): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/assignments/${id}`, {
    method: 'DELETE',
  });
}

export async function submitAssignment(assignmentId: string, data: { fileKey?: string }): Promise<any> {
  return fetchWithAuth(`/api/assignments/${assignmentId}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function gradeSubmission(submissionId: string, data: { grade: string; feedback?: string }): Promise<any> {
  return fetchWithAuth(`/api/assignments/submissions/${submissionId}/grade`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchAssignmentStats(): Promise<AssignmentStatisticsData> {
  return fetchWithAuth<AssignmentStatisticsData>('/api/assignments/stats');
}

// Notices
export async function fetchNotices(): Promise<Notice[]> {
  return fetchWithAuth<Notice[]>('/api/notices');
}

export async function createNotice(data: {
  title: string;
  body: string;
  audienceScope?: string;
}): Promise<Notice> {
  return fetchWithAuth<Notice>('/api/notices', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// In-App & Push Notifications
export async function fetchNotifications(limit = 30): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  return fetchWithAuth<{ notifications: NotificationItem[]; unreadCount: number }>(`/api/core/notifications?limit=${limit}`);
}

export async function markNotificationAsRead(id: string): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/core/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>('/api/core/notifications/read-all', {
    method: 'POST',
  });
}

// Staff Task Management
export async function fetchTasks(filter: 'my_tasks' | 'assigned_by_me' | 'all' = 'all'): Promise<UserTaskItem[]> {
  return fetchWithAuth<UserTaskItem[]>(`/api/core/tasks?filter=${filter}`);
}

export async function createTask(data: {
  assigneeMembershipId: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
}): Promise<UserTaskItem> {
  return fetchWithAuth<UserTaskItem>('/api/core/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTaskStatus(
  taskId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
): Promise<UserTaskItem> {
  return fetchWithAuth<UserTaskItem>(`/api/core/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteTask(taskId: string): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/core/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

// Institution Settings
export async function fetchInstitutionSettings(): Promise<InstitutionSettingsData> {
  return fetchWithAuth<InstitutionSettingsData>('/api/core/institution/settings');
}

export async function updateInstitutionSettings(data: {
  name?: string;
  subdomain?: string;
  branding?: any;
  settings?: Record<string, any>;
}): Promise<InstitutionSettingsData> {
  return fetchWithAuth<InstitutionSettingsData>('/api/core/institution/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// 1-Click Academic Data Migration & Bulk Importer
export async function unifiedAcademicMigration(records: Array<{
  academicYear?: string;
  className: string;
  sectionName: string;
  admissionNo?: string;
  rollNo?: string;
  studentName: string;
  dateOfBirth?: string;
  gender?: string;
  guardianName?: string;
  guardianPhone?: string;
}>): Promise<AcademicMigrationSummary> {
  return fetchWithAuth<AcademicMigrationSummary>('/api/core/academic/unified-import', {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
}

// Client-Side CSV Export Helper Utility
export function exportToCsv(filename: string, rows: Record<string, any>[], customHeaders?: Array<{ key: string; label: string }>) {
  if (!rows || rows.length === 0) return;

  const headers = customHeaders || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const headerLine = headers.map((h) => `"${h.label.replace(/"/g, '""')}"`).join(',');

  const csvLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h.key];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headerLine, ...csvLines].join('\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  link.setAttribute('download', `${filename.endsWith('.csv') ? filename : `${filename}.csv`}`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

