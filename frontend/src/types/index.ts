export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  username?: string;
}

export interface ActiveMembership {
  id: string;
  membershipId?: string;
  institutionId: string;
  institutionName?: string;
  institutionSubdomain?: string;
  username?: string;
  roleId?: string;
  roleName?: string;
  role?: string;
}

export interface Session {
  token: string;
  user: User;
  activeMembership: ActiveMembership;
  permissions: string[];
}

export interface NavItem {
  label: string;
  path: string;
  requiredPermission: string;
  sortOrder?: number;
  icon?: string;
}

export interface DashboardWidget {
  id: string;
  renderer: string;
  dataSource: string;
  layout: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    w?: number;
    h?: number;
  };
  defaultSize?: {
    width: number;
    height: number;
  };
  requiredPermissions?: string[];
}

export interface DashboardPayload {
  widgets: DashboardWidget[];
}

export interface WidgetProps {
  dataSource: string;
  id?: string;
  title?: string;
}

// Institution & RBAC
export interface InstitutionItem {
  id: string;
  name: string;
  subdomain: string;
  branding?: any;
  status: string;
  createdAt?: string;
  memberCount?: number;
  studentCount?: number;
}

export interface PermissionDefinition {
  id: string;
  key: string;
  moduleKey: string;
  moduleName: string;
  description: string;
  scopeOptions: string[];
}

export interface Role {
  id: string;
  institutionId: string | null;
  name: string;
  isSystem: boolean;
  memberCount?: number;
}

export interface RolePermissionGrant {
  permissionKey: string;
  scope: string;
  description?: string;
}

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  username: string | null;
  roleId: string;
  roleName: string;
  status: string;
  inviteStatus: string;
  customFields?: Record<string, any>;
  createdAt: string;
}

// Academic Core
export interface AcademicYear {
  id: string;
  institutionId: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface ClassItem {
  id: string;
  institutionId: string;
  academicYearId: string;
  academicYearLabel?: string;
  name: string;
  sortOrder: number;
  sectionCount?: number;
}

export interface SectionItem {
  id: string;
  institutionId: string;
  classId: string;
  className?: string;
  name: string;
  capacity: number | null;
  studentCount?: number;
  classTeacherMembershipId?: string | null;
  classTeacherName?: string | null;
}

export interface SubjectItem {
  id: string;
  institutionId: string;
  name: string;
  code: string | null;
}

export interface TeacherAssignment {
  id: string;
  institutionId: string;
  sectionId: string;
  sectionName?: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherMembershipId: string;
  teacherName?: string;
}

export interface StudentItem {
  id: string;
  institutionId: string;
  userId: string | null;
  admissionNo: string;
  name: string;
  dateOfBirth: string | null;
  gender: string | null;
  status: string;
  createdAt: string;
  className?: string;
  sectionName?: string;
  classId?: string;
  sectionId?: string;
  rollNo?: string;
  rollNumber?: string;
  customFields?: Record<string, any>;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
}

export interface EnrollmentItem {
  id: string;
  institutionId: string;
  studentId: string;
  studentName?: string;
  admissionNo?: string;
  academicYearId: string;
  classId: string;
  className?: string;
  sectionId: string;
  sectionName?: string;
  rollNo: string | null;
  status: string;
  enrolledAt: string;
}

// Class Schedule & Timetable
export interface ClassScheduleItem {
  id: string;
  institutionId: string;
  sectionId: string;
  sectionName?: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherMembershipId: string | null;
  teacherName?: string | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomNo: string | null;
  createdAt: string;
}

// Dynamic Custom Fields (Lattice HR / Notion style)
export interface CustomFieldDefinition {
  id: string;
  institutionId: string;
  entityType: 'student' | 'member' | 'class' | 'section';
  label: string;
  fieldKey: string;
  name?: string;
  fieldType: 'text' | 'number' | 'select' | 'date' | 'boolean' | 'tag';
  options: string[];
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
}

// Notifications & Push Alerts
export interface NotificationItem {
  id: string;
  institutionId: string;
  recipientUserId?: string | null;
  recipientMembershipId?: string | null;
  title: string;
  body: string;
  type: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

// User Tasks & Academic Work Orders
export interface UserTaskItem {
  id: string;
  institutionId: string;
  creatorMembershipId: string | null;
  assigneeMembershipId: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  creatorName?: string | null;
  assigneeName?: string | null;
  assigneeRole?: string | null;
  assigneeMembershipIds?: string[];
  assigneeNames?: string[];
}

// Institution Settings & Feature Controls
export interface InstitutionSettingsData {
  institution: {
    id: string;
    name: string;
    subdomain: string;
    instituteCode?: string;
    branding: any;
    status: string;
    createdAt: string;
  };
  settings: {
    address?: string;
    contactPhone?: string;
    contactEmail?: string;
    website?: string;
    currency?: string;
    timezone?: string;
    academicYearName?: string;
    attendanceThreshold?: number;
    instituteCode?: string;
    enableExaminations?: boolean;
    enableAssignments?: boolean;
    enableTransport?: boolean;
    enableFinance?: boolean;
    enableTimetable?: boolean;
    notificationSmsEnabled?: boolean;
    featureLimitations?: Record<string, { enabled: boolean; allowedRoles?: string[] }>;
    principalSignatureUrl?: string;
    officialSealUrl?: string;
    examControllerSignatureUrl?: string;
    institutionAffiliationNo?: string;
    officialWatermarkText?: string;
    [key: string]: any;
  };
}

// Academic Migration Summary
export interface AcademicMigrationSummary {
  total: number;
  classesCreated: number;
  sectionsCreated: number;
  studentsCreated: number;
  enrollmentsCreated: number;
}

// Audit Log / Activity Log
export interface AuditLogEntry {
  id: string;
  institutionId: string;
  actorMembershipId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  createdAt: string;
}

// Student 360 Academic History
export interface StudentAcademicHistory {
  student: StudentItem;
  enrollments: Array<{
    id: string;
    academicYearLabel: string;
    className: string;
    sectionName: string;
    rollNo: string | null;
    status: string;
    enrolledAt: string;
  }>;
  attendanceStats: {
    totalDays: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    attendanceRate: number;
    recentRecords: Array<{
      date: string;
      status: string;
    }>;
  };
  examMarks: Array<{
    examName: string;
    term: string | null;
    subjectName: string;
    marksObtained: number | null;
    maxMarks: number;
    grade: string | null;
  }>;
  guardians: Array<{
    id: string;
    name: string;
    phone: string | null;
    relation: string | null;
    isPrimary: boolean;
  }>;
}

// Operations: Attendance, Marks, Notices
export interface AttendanceSheetItem {
  studentId: string;
  admissionNo: string;
  name: string;
  rollNo: string | null;
  status: 'present' | 'absent' | 'late' | 'excused' | null;
  attendanceId: string | null;
}

export interface EmployeeAttendanceItem {
  membershipId: string;
  name: string;
  email: string;
  phone?: string;
  roleId: string;
  roleName: string;
  attendanceId?: string | null;
  status: 'present' | 'absent' | 'late' | 'on_leave' | 'half_day' | 'unmarked';
  checkInTime?: string | null;
  checkOutTime?: string | null;
  notes?: string | null;
  date: string;
  recordedAt?: string;
}

export interface EmployeeAttendanceSummaryData {
  date: string;
  totalStaff: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  onLeaveToday: number;
  halfDayToday: number;
  unmarkedToday: number;
  attendanceRate: number;
}

export interface AttendanceSummaryData {
  sectionId?: string;
  date?: string;
  totalStudents: number;
  presentCount?: number;
  absentCount?: number;
  lateCount?: number;
  excusedCount?: number;
  presentToday?: number;
  absentToday?: number;
  lateToday?: number;
  attendanceRate?: number;
  recentClassRecords?: {
    id: string;
    className: string;
    sectionName: string;
    presentCount: number;
    totalCount: number;
    date: string;
  }[];
}

export interface ExamItem {
  id: string;
  institutionId: string;
  academicYearId: string;
  academicYearLabel?: string;
  name: string;
  term: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isPublished?: boolean;
  paperCount?: number;
  examType?: 'term' | 'class_test';
  examControllerMembershipId?: string | null;
  examControllerName?: string | null;
  classId?: string | null;
  className?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  syllabusRemarks?: string | null;
  eligibleStudentIds?: string[] | null;
}

export interface ExamPaperItem {
  id: string;
  institutionId: string;
  examId: string;
  examName?: string;
  subjectId: string;
  subjectName?: string;
  teacherMembershipId?: string | null;
  teacherName?: string | null;
  syllabus?: string | null;
  examDate: string | null;
  startTime: string | null;
  endTime: string | null;
  roomNo: string | null;
  maxMarks: number;
  passMarks: number;
  theoryWeight: number;
  practicalWeight: number;
  vivaWeight: number;
  createdAt: string;
}

export interface ExamRoomItem {
  id: string;
  institutionId: string;
  examId: string;
  classroomId?: string | null;
  roomNumber: string;
  capacity?: number | null;
  guardMembershipIds?: string[];
  guardNames?: string[];
  rollRangeStart?: number | null;
  rollRangeEnd?: number | null;
  studentIds?: string[];
  studentCount?: number;
  remarks?: string | null;
}

export interface ExamPaperProgress {
  paperId: string;
  subjectName: string;
  teacherName?: string | null;
  teacherMembershipId?: string | null;
  totalEligible: number;
  enteredMarks: number;
  missingCount: number;
  missingStudents: { studentId: string; name: string; rollNumber?: string }[];
  isComplete: boolean;
}

export interface ExamProgressData {
  examId: string;
  examName: string;
  isPublished: boolean;
  totalEligibleStudents: number;
  overallCompletionPercentage: number;
  papers: ExamPaperProgress[];
}

export interface OfficialSignatureSettings {
  principalSignatureUrl?: string;
  officialSealUrl?: string;
  examControllerSignatureUrl?: string;
  institutionAffiliationNo?: string;
  signatureLocked?: boolean;
}

export interface MarkItem {
  id: string;
  institutionId: string;
  examId: string;
  studentId: string;
  studentName?: string;
  admissionNo?: string;
  subjectId: string;
  subjectName?: string;
  marksObtained: number | null;
  maxMarks: number;
  grade: string | null;
  remarks?: string | null;
  isRechecked?: boolean;
  recheckedByMembershipId?: string | null;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  audienceScope?: string;
  targetRoles?: string[];
  targetClassIds?: string[];
  targetSectionIds?: string[];
  audienceFilters?: Record<string, any>;
  publishedAt?: string;
  createdAt?: string;
  isRead?: boolean;
  priority?: 'normal' | 'high' | 'urgent';
}

// Assignments
export interface Assignment {
  id: string;
  institutionId?: string;
  sectionId?: string;
  subjectId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  subjectName?: string;
  className?: string;
  sectionName?: string;
  totalSubmissions?: number;
  status?: 'pending' | 'submitted' | 'graded' | 'active';
  score?: number;
  maxScore?: number;
  createdAt?: string;
}

export interface AssignmentSubmissionItem {
  id: string;
  institutionId: string;
  assignmentId: string;
  studentId: string;
  studentName?: string;
  admissionNo?: string;
  rollNumber?: string;
  sectionName?: string;
  className?: string;
  fileKey: string | null;
  fileUrl?: string | null;
  submissionNotes?: string | null;
  submittedAt: string;
  status: string;
  grade?: string | null;
  feedback?: string | null;
  gradedAt?: string | null;
}

export interface AssignmentStatisticsData {
  totalAssignments: number;
  totalSubmissions: number;
  totalGraded?: number;
  gradedCount?: number;
  pendingGradingCount?: number;
  averageScore?: number;
  sectionPerformances?: {
    sectionName: string;
    completionRate: number;
    avgScore: number;
  }[];
}

export interface RouteItem {
  id: string;
  name: string;
  vehicleRegistration?: string;
  vehicleCapacity?: number;
  driverName?: string;
  driverPhone?: string;
  studentCount?: number;
  status?: string;
}

export interface MyRouteData {
  routeName: string;
  vehicleRegistration: string;
  driverName: string;
  driverPhone: string;
  pickupTime: string;
  dropTime: string;
  stopName: string;
}

export interface FinanceSummaryData {
  totalBilled: number;
  totalCollected: number;
  totalPending: number;
  totalDisbursements?: number;
  collectionRate: number;
  recentTransactions?: {
    id: string;
    studentName: string;
    amount: number;
    date: string;
    method: string;
  }[];
  monthlyCollection?: Array<{ month: string; amount: number }>;
}

export interface ClassPerformanceItem {
  id: string;
  className: string;
  sectionName?: string;
  score: number;
}

export interface ClassPerformanceData {
  classes: ClassPerformanceItem[];
}

export interface SystemAlertItem {
  id: string;
  label: string;
  count: number;
  severity: 'danger' | 'warning' | 'info' | 'success';
}

export interface SystemAlertsData {
  alerts: SystemAlertItem[];
}

// src/types/index.ts - AdmissionApplicationItem সম্পূর্ণ আপডেট

export interface AdmissionApplicationItem {
  id: string;
  applicationNo: string;
  
  // Student Information
  studentName: string;
  applicantName?: string;
  gender?: string;
  dateOfBirth?: string;
  previousSchool?: string;
  
  // Guardian Information
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  guardianRelation?: string;
  
  // Academic Information
  className?: string;
  classId?: string;
  academicYearId?: string;
  sectionId?: string;
  rollNo?: string;
  
  // Status & Tracking
  status: 'submitted' | 'under_review' | 'shortlisted' | 'admitted' | 'rejected';
  feeStatus?: 'paid' | 'unpaid' | 'waived' | 'pending';
  applicationFee?: number;
  notes?: string;
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  admittedAt?: string;
  rejectedAt?: string;
  
  // Review/Admission Metadata
  reviewedBy?: string;
  reviewedByMembershipId?: string;
  reviewerName?: string;
  admittedBy?: string;
  admittedStudentId?: string;
  rejectionReason?: string;
  
  // Address
  address?: string;
  
  // Documents & Custom Fields
  documents?: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  customFields?: Record<string, any>;
}

export interface CreateAdmissionPayload {
  studentName: string;
  applicantName?: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  guardianRelation?: string;
  gender?: string;
  dateOfBirth?: string;
  className?: string;
  classId?: string;
  academicYearId?: string;
  previousSchool?: string;
  address?: string;
  applicationFee?: number;
  feeStatus?: 'paid' | 'unpaid' | 'waived' | 'pending';
  notes?: string;
  customFields?: Record<string, any>;
}

export interface UpdateAdmissionPayload {
  studentName?: string;
  applicantName?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelation?: string;
  gender?: string;
  dateOfBirth?: string;
  className?: string;
  classId?: string;
  previousSchool?: string;
  status?: 'submitted' | 'under_review' | 'shortlisted' | 'admitted' | 'rejected';
  feeStatus?: 'paid' | 'unpaid' | 'waived' | 'pending';
  applicationFee?: number;
  notes?: string;
  rejectionReason?: string;
  customFields?: Record<string, any>;
}

export interface AdmitStudentPayload {
  classId: string;
  sectionId?: string;
  rollNo?: string;
  admissionNo?: string;
  academicYearId?: string;
  generateCredentials?: boolean;
}

export interface AdmissionStatsData {
  summary: {
    total: number;
    submitted: number;
    under_review: number;
    shortlisted: number;
    admitted: number;
    rejected: number;
    total_fees_collected: number;
  };
}

export interface InvoiceItem {
  label: string;
  amount: number;
  description?: string;
}

export interface PaymentRecord {
  id: string;
  institutionId: string;
  invoiceId: string;
  receiptNumber: string;
  amount: number;
  paymentDate: string;
  method: string;
  transactionId?: string | null;
  notes?: string | null;
  recordedByName?: string | null;
  recordedByRole?: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  institutionId?: string;
  invoiceNumber?: string;
  recipientType?: 'student' | 'employee' | 'institution';
  studentId?: string | null;
  studentName?: string | null;
  studentRollNo?: string | null;
  className?: string | null;
  sectionName?: string | null;
  employeeMembershipId?: string | null;
  employeeName?: string | null;
  employeeRole?: string | null;
  category?: string;
  title: string;
  description?: string | null;
  totalAmount?: number;
  amount?: number; // legacy compatibility fallback
  discountAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  dueDate?: string;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'unpaid';
  items?: InvoiceItem[];
  notes?: string | null;
  paidAt?: string;
  createdAt?: string;
  payments?: PaymentRecord[];
}

export interface ReceiptData {
  payment: PaymentRecord;
  invoice: Invoice;
  institution: {
    id: string;
    name: string;
    instituteCode?: string;
    address?: string;
    contactEmail?: string;
    contactPhone?: string;
    currency?: string;
    branding?: any;
    principalSignatureUrl?: string;
    officialSealUrl?: string;
    officialWatermarkText?: string;
  };
}

export interface Persona {
  id: string;
  label: string;
  roleName: string;
  description: string;
  token: string;
  user: User;
  activeMembership: ActiveMembership;
  permissions: string[];
}

export interface ApiLog {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  headers: Record<string, string>;
  responsePayload: any;
  durationMs: number;
}


// Physical Classroom
export interface ClassroomItem {
  id: string;
  institutionId: string;
  roomNumber: string;
  name: string | null;
  building: string | null;
  floor: string | null;
  capacity: number;
  facilities: string[];
  status: string;
  createdAt: string;
}

// Period Substitutions
export interface ScheduleSubstitutionItem {
  id: string;
  scheduleId: string;
  date: string;
  substituteTeacherMembershipId: string | null;
  substituteTeacherName?: string | null;
  status: "normal" | "substitute" | "cancelled";
  reason: string | null;
  recordedByMembershipId?: string | null;
  createdAt: string;
}

// Member Requests
export interface MemberRequestItem {
  id: string;
  institutionId: string;
  requesterMembershipId: string;
  requesterName?: string;
  requesterRole?: string;
  requesterStudentId?: string | null;
  requesterStudentName?: string | null;
  managerMembershipId: string;
  targetManagerMembershipId?: string;
  managerName?: string;
  targetManagerName?: string;
  category: "leave" | "break" | "schedule_change" | "resource" | "general";
  requestType?: "leave" | "break" | "schedule_change" | "resource" | "general";
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewerNotes: string | null;
  managerRemarks?: string | null;
  reviewedAt: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Class Overview Telemetry
export interface ClassOverviewData {
  classId: string;
  className: string;
  totalStudents: number;
  sections: Array<{
    id: string;
    name: string;
    capacity: number;
    classTeacherMembershipId?: string | null;
    classTeacherName?: string | null;
    studentCount: number;
  }>;
  todayAttendance: {
    totalStudents: number;
    marked: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
  };
  currentPeriod: {
    id: string;
    sectionId: string;
    sectionName: string;
    subjectId: string;
    subjectName: string;
    teacherMembershipId: string | null;
    teacherName: string | null;
    startTime: string;
    endTime: string;
    roomNumber: string;
    isOngoing: boolean;
    subStatus?: string | null;
    subReason?: string | null;
    substituteTeacherName?: string | null;
  } | null;
  nextPeriod: {
    id: string;
    sectionId: string;
    sectionName: string;
    subjectId: string;
    subjectName: string;
    teacherMembershipId: string | null;
    teacherName: string | null;
    startTime: string;
    endTime: string;
    roomNumber: string;
  } | null;
  todaySchedules: any[];
  assignedTeachers: Array<{
    teacherName: string;
    subjectName: string;
    sectionName: string;
  }>;
}

// Live Dashboard Period Telemetry
export interface LivePeriodData {
  role: "student" | "teacher" | "admin";
  studentName?: string;
  className?: string;
  sectionName?: string;
  currentPeriod: any | null;
  nextPeriod: any | null;
  todaySchedule: any[];
  runningNow?: any[];
  activeClassroomsCount?: number;
}
