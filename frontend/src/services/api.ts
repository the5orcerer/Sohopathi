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
  AdmissionApplicationItem,
  AdmissionStatsData,
  CreateAdmissionPayload,
  UpdateAdmissionPayload,
  AdmitStudentPayload,
  EmployeeAttendanceItem,
  EmployeeAttendanceSummaryData,
} from '../types';

import { getTenantSubdomain } from '../utils/tenant';

let currentToken = 'mock-token-admin-1';
let currentInstitutionId = 'f2c10000-0000-0000-0000-000000000001';
let currentSubdomain = getTenantSubdomain() || '';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function buildApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

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

export function setApiAuth(token: string, institutionId: string, subdomain?: string) {
  currentToken = token;
  currentInstitutionId = institutionId;
  if (subdomain !== undefined) {
    currentSubdomain = subdomain;
  } else if (!currentSubdomain) {
    currentSubdomain = getTenantSubdomain() || '';
  }
}

export function getApiAuth() {
  return { token: currentToken, institutionId: currentInstitutionId, subdomain: currentSubdomain };
}

export async function resolveInstitutionBySubdomain(subdomain: string): Promise<InstitutionItem | null> {
  const clean = encodeURIComponent(subdomain.trim().toLowerCase());
  try {
    const res = await fetch(buildApiUrl(`/api/auth/resolve-subdomain/${clean}`));
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to resolve institution: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`Could not resolve institution subdomain ${subdomain}:`, err);
    return null;
  }
}

interface ApiCacheEntry<T> {
  data: T;
  expiresAt: number;
}
const apiCache = new Map<string, ApiCacheEntry<any>>();

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    apiCache.clear();
  } else {
    for (const key of apiCache.keys()) {
      if (key.includes(prefix)) {
        apiCache.delete(key);
      }
    }
  }
}

export async function fetchWithAuth<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = `${currentInstitutionId}:${url}`;

  if (isGet) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }
  } else {
    // Automatically invalidate related cache keys upon mutation
    if (url.includes('/attendance')) invalidateApiCache('/attendance');
    if (url.includes('/students') || url.includes('/classes') || url.includes('/sections')) {
      invalidateApiCache('/core');
      invalidateApiCache('/academic');
    }
    if (url.includes('/roles') || url.includes('/permissions')) {
      invalidateApiCache('/roles');
      invalidateApiCache('/permissions');
    }
    if (url.includes('/admissions')) invalidateApiCache('/admissions');
    if (url.includes('/notices')) invalidateApiCache('/notices');
  }

  const fullUrl = buildApiUrl(url);
  const startTime = Date.now();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${currentToken}`,
    'x-institution-id': currentInstitutionId,
    'x-institution-subdomain': currentSubdomain || getTenantSubdomain() || '',
    ...(options.headers as Record<string, string>),
  };

  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers,
    });

    const durationMs = Date.now() - startTime;

    if (res.ok) {
      const data = res.status === 204 ? ({} as T) : await res.json();
      if (isGet) {
        // Cache idempotent GET results for 15s to keep UI snappy and DB healthy
        apiCache.set(cacheKey, { data, expiresAt: Date.now() + 15000 });
      }
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

// ============================================================
// USER SELF-SERVICE PROFILE UPDATE
// ============================================================

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

// ============================================================
// SESSION & NAVIGATION
// ============================================================

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
  // ✅ Mock Data for StatsWidget
  if (dataSource === '/api/dashboard/stats' || dataSource === '/api/stats') {
    return {
      totalStudents: 1250,
      totalTeachers: 85,
      totalClasses: 42,
      monthlyCollection: 125000,
      outstandingDue: 45000,
      previousMonthCollection: 118000,
      studentGrowth: 5.2,
      collectionGrowth: 8.5,
    } as T;
  }
  return fetchWithAuth<T>(dataSource);
}

// ============================================================
// INSTITUTIONS & ROLES
// ============================================================

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

// ============================================================
// MEMBERS / STAFF
// ============================================================

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

// ============================================================
// ACADEMIC CORE
// ============================================================

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

// ============================================================
// CLASS TIMETABLE & SCHEDULES
// ============================================================

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

// ============================================================
// DYNAMIC CUSTOM FIELDS
// ============================================================

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

// ============================================================
// ACTIVITY LOG & AUDIT TRAIL
// ============================================================

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

// ============================================================
// STUDENTS & ENROLLMENTS
// ============================================================

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

// ============================================================
// ATTENDANCE
// ============================================================

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

// Employee Attendance APIs
export async function fetchEmployeeAttendance(params: {
  date: string;
  roleId?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ employees: EmployeeAttendanceItem[]; total: number }> {
  const q = new URLSearchParams();
  if (params.date) q.set('date', params.date);
  if (params.roleId && params.roleId !== 'all') q.set('roleId', params.roleId);
  if (params.status && params.status !== 'all') q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  return fetchWithAuth<{ employees: EmployeeAttendanceItem[]; total: number }>(`/api/attendance/employees?${q.toString()}`);
}

export async function markEmployeeAttendanceBatch(records: Array<{
  membershipId: string;
  date: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
}>): Promise<any> {
  return fetchWithAuth('/api/attendance/employees', {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
}

export async function fetchEmployeeAttendanceSummary(date?: string): Promise<EmployeeAttendanceSummaryData> {
  const url = date ? `/api/attendance/employees/summary?date=${date}` : '/api/attendance/employees/summary';
  return fetchWithAuth<EmployeeAttendanceSummaryData>(url);
}

// ============================================================
// EXAMINATIONS & PAPERS
// ============================================================

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

// ============================================================
// MARKS & SCORING
// ============================================================

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

// ============================================================
// ASSIGNMENTS & SUBMISSIONS
// ============================================================

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

// ============================================================
// NOTICES
// ============================================================

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

// ============================================================
// IN-APP & PUSH NOTIFICATIONS
// ============================================================

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

// ============================================================
// STAFF TASK MANAGEMENT
// ============================================================

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

// ============================================================
// INSTITUTION SETTINGS
// ============================================================

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

// ============================================================
// 1-CLICK ACADEMIC DATA MIGRATION & BULK IMPORTER
// ============================================================

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

// ============================================================
// CLIENT-SIDE CSV EXPORT HELPER UTILITY
// ============================================================

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

// ============================================================
// ✅ ADMISSIONS & INQUIRIES - যোগ করা হয়েছে
// ============================================================

export async function fetchAdmissions(filters?: {
  status?: string;
  classId?: string;
  academicYearId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ applications: AdmissionApplicationItem[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.classId) params.set('classId', filters.classId);
  if (filters?.academicYearId) params.set('academicYearId', filters.academicYearId);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return fetchWithAuth<{ applications: AdmissionApplicationItem[]; total: number }>(`/api/admissions${qs ? `?${qs}` : ''}`);
}

export async function fetchAdmissionStats(): Promise<AdmissionStatsData> {
  return fetchWithAuth<AdmissionStatsData>('/api/admissions/stats');
}

export async function fetchAdmissionDetail(id: string): Promise<AdmissionApplicationItem> {
  return fetchWithAuth<AdmissionApplicationItem>(`/api/admissions/${id}`);
}

export async function createAdmission(data: CreateAdmissionPayload): Promise<AdmissionApplicationItem> {
  return fetchWithAuth<AdmissionApplicationItem>('/api/admissions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdmission(id: string, data: UpdateAdmissionPayload): Promise<AdmissionApplicationItem> {
  return fetchWithAuth<AdmissionApplicationItem>(`/api/admissions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function admitStudent(id: string, data: AdmitStudentPayload): Promise<{ 
  student: StudentItem; 
  username: string; 
  defaultPassword: string; 
  application: AdmissionApplicationItem 
}> {
  return fetchWithAuth<{ 
    student: StudentItem; 
    username: string; 
    defaultPassword: string; 
    application: AdmissionApplicationItem 
  }>(`/api/admissions/${id}/admit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteAdmission(id: string): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(`/api/admissions/${id}`, {
    method: 'DELETE',
  });
}