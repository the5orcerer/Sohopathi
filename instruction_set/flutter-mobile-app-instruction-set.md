# Sohopathi Flutter Mobile Application — Comprehensive Implementation Blueprint & Action Plan

> **Target Codebase**: `mobile-app/Sohopathi-Mobile`  
> **Framework & SDK**: Flutter 3.8+ / Dart 3.8+ (Riverpod 2.6+, Dio 5.8+, GoRouter 14.8+, Freezed 2.5+, Sentry Flutter 9.28+)  
> **API Specification**: OpenAPI 3.0.3 (`/api/*` Multi-Tenant PostgreSQL RLS Architecture)  
> **Design Tokens**: Sohopathi Calm Teal (`#1E5F5B`) & Warm Amber (`#E3A008`)

---

## 1. Existing Codebase Audit & Gap Analysis

An inspection of `mobile-app/Sohopathi-Mobile` reveals that foundational architecture and several student-facing screens are already in place:

### What Is Already Implemented & Working:
- **State Management & Routing**: Riverpod 2.6 with `@riverpod` annotations, `go_router` (14.8.0) integrated with Sentry telemetry in `lib/main.dart` and `lib/app/config/routes.dart`.
- **Network Interceptors & Storage**: `AuthInterceptor` in `lib/app/network/auth_interceptor.dart` injects `Authorization: Bearer <token>` and `x-institution-id: <id>` from `SecureStorageService`.
- **Authentication**: `LoginScreen` in `lib/features/auth/presentation/screens/login_screen.dart` connected to `POST /api/auth/login`.
- **Permissions & RBAC**: `UserProfileNotifier` fetching `/api/me` with `hasPermission()` and `PermissionGuard` widget in `lib/shared/widgets/role_gurd.dart`.
- **App Drawer**: `AppDrawer` in `lib/shared/widgets/app_drawer.dart` filtering 14 navigation destinations against `userProfile.permissions`.
- **Student Screens**:
  - `StudentDashboardScreen` calling `/api/me`, `/api/attendance/summary`, `/api/notices`, and `/api/assignments`.
  - `AttendanceScreen` (Student view) rendering attendance rates and log lists.
  - `ExaminationsScreen` (Student view) rendering GPA/marks summary and report cards.

### Critical Gaps & Inconsistencies to Address:
1. **Hardcoded URLs**: `https://sohopathi-api.vercel.app` is hardcoded across multiple files (`auth_remote_data_source.dart`, `user_profile_provider.dart`, `api_client.dart`) rather than referencing a centralized environment config / `dioProvider`.
2. **Missing Teacher & Admin Views**:
   - Attendance is currently read-only (Student view); missing the **Teacher Daily Attendance Roster Taker** (`GET /api/attendance/sheet`, `POST /api/attendance`).
   - Examinations is read-only; missing **Exam Session Creator, Papers Weighting & Marks Entry Grid** (`GET/POST /api/attendance/exams`, `/papers`, `POST /api/attendance/marks`).
3. **Missing Core Platform Modules**:
   - **Admissions Pipeline** (`/api/admissions`, `/api/admissions/stats`, 1-click `/admit`).
   - **Students Directory & Dynamic Custom Fields** (`/api/core/students`, `/api/core/custom-fields`).
   - **Academic Structure & Timetables / Routines** (`/api/core/schedules`, `/api/core/classes`, `/api/core/sections`, `/api/core/subjects`).
   - **Assignments Management & File Uploads** (`/api/assignments`, local/S3 presigned URLs, grading sheet).
   - **Notices Management** (`/api/notices` create/publish, `/read` tracking).
   - **Staff Tasks** (`/api/core/tasks`, status transitions).
   - **Members Directory & RBAC Matrix** (`/api/core/members`, `/api/core/roles`).
4. **Login & Session Gaps**:
   - Missing institution list dropdown / search from `GET /api/auth/institutions`.
   - Missing forced password change modal when `mustChangePassword == true` (`POST /api/auth/change-password`).
   - Missing multi-membership switcher in the App Bar.
5. **Empty & Stray Files**:
   - `lib/app/config/app_constants.dart` (empty).
   - `lib/features/auth/presentation/screens/profile_screen.dart` (empty).
   - `lib/shared/widgets/custom_button.dart` (empty).
   - `lib/shared/widgets/error_view.dart` (empty).
   - `lib/shared/widgets/role_guard.dart` (duplicate of `role_gurd.dart`).

---

## 2. Directory Structure Blueprint (Target Architecture)

```
mobile-app/Sohopathi-Mobile/lib/
├── main.dart
├── app/
│   ├── config/
│   │   ├── app_constants.dart        # [REFILL] API URLs, Mock Tokens, Timeouts
│   │   ├── routes.dart               # [EXPAND] Register all module routes
│   │   └── theme.dart                # [ALIGN] Exact Teal & Amber tokens
│   ├── network/
│   │   ├── api_client.dart           # [STANDARDIZE] Single configured Dio provider
│   │   ├── auth_interceptor.dart     # Handles token & x-institution-id
│   │   └── error_handler.dart        # Unified API failure mapping
│   └── storage/
│       └── secure_storage_service.dart
├── core/
│   ├── error/ (failures, exceptions)
│   ├── utils/ (date_formatter, validators)
│   └── usecases/
├── shared/
│   ├── models/ (institution, user_profile, active_membership)
│   └── widgets/
│       ├── app_drawer.dart           # [EXPAND] Dynamic role drawer
│       ├── custom_button.dart        # [FILL]
│       ├── error_view.dart           # [FILL]
│       ├── role_guard.dart           # [CONSOLIDATE]
│       ├── status_badge.dart         # [NEW]
│       └── dynamic_custom_field_form.dart # [NEW]
└── features/
    ├── auth/                         # Login, Institution Picker, Force Password, Profile
    ├── dashboard/                    # Dynamic Dashboard & Student Dashboard
    ├── attendance/                   # Teacher Roster Taker & Student History
    ├── examinations/                 # Marks Entry Gradebook, Papers & Student Results
    ├── students/                     # [NEW] Directory, Custom Fields, Enrollments, Progression
    ├── academic/                     # [NEW] Classes, Sections, Subjects, Weekly Routines
    ├── assignments/                  # [NEW] Coursework feed, File upload, Grading
    ├── notices/                      # [NEW] Notice Board, Unread read tracking, Publishing
    ├── tasks/                        # [NEW] Delegated staff task list & status toggle
    ├── admissions/                   # [NEW] Admissions pipeline, Conversion metrics, 1-Click Admit
    ├── members/                      # [NEW] Staff directory, Invites, Role permissions
    └── settings/                     # [NEW] Institution Settings & Self-Profile update
```

---

## 3. Step-by-Step Implementation Instructions

---

### Step 1: Foundation Clean-Up & Network Standardization

#### 1.1 Centralize API Configuration (`lib/app/config/app_constants.dart`)
Fill `lib/app/config/app_constants.dart`:
```dart
class AppConstants {
  static const String defaultApiBaseUrl = 'https://sohopathi-api.vercel.app';
  static const String localApiBaseUrl = 'http://10.0.2.2:3000'; // Android emulator

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: defaultApiBaseUrl,
  );

  // Storage Keys
  static const String keyToken = 'token';
  static const String keyInstitutionId = 'institutionId';
  static const String keyActiveRole = 'activeRole';
  static const String keyMustChangePassword = 'mustChangePassword';

  // Dev Mock Personas
  static const String mockAdminToken = 'mock-token-admin-1';
  static const String mockTeacherToken = 'mock-token-teacher-1';
  static const String mockStudentToken = 'mock-token-student-1';
  static const String mockGuardianToken = 'mock-token-guardian-1';
}
```

#### 1.2 Refactor `ApiClient` and Remove Hardcoded Endpoints
Ensure `lib/app/network/api_client.dart` is the **only** place instantiating `Dio(BaseOptions)` using `AppConstants.apiBaseUrl`.
All data sources (`auth_remote_data_source.dart`, `user_profile_provider.dart`, `student_dashboard_remote_datasource.dart`) must inject and use `ref.watch(dioProvider)` with relative endpoint paths (e.g. `_dio.get('/api/me')` and `_dio.post('/api/auth/login')`).

#### 1.3 Consolidate UI Widgets
- Populate `lib/shared/widgets/custom_button.dart` (Primary teal buttons with loading spinners).
- Populate `lib/shared/widgets/error_view.dart` (Error state with retry CTA).
- Delete duplicate `lib/shared/widgets/role_guard.dart` or rename `role_gurd.dart` to fix the typo.

---

### Step 2: Authentication, Institution Selector & Password Policies

#### 2.1 Institution Discovery & Auto-Complete
- **Endpoint**: `GET /api/auth/institutions`
- **Model**: `InstitutionModel(id, name, subdomain, status)`
- **UI Update (`LoginScreen`)**:
  - Add institution search/dropdown that queries `/api/auth/institutions`.
  - Allow manual typing of custom subdomain (e.g. `dhakamodel`).
  - Add Quick Dev Persona Chips (`Admin`, `Teacher`, `Student`, `Guardian`) to populate mock credentials for rapid testing.

#### 2.2 Forced First-Login Password Change
- **Endpoint**: `POST /api/auth/change-password` with body `{ "newPassword": "<string min 6>" }`
- **Behavior**:
  - In `AuthNotifier`, when `mustChangePassword == true`, route user to `/change-password` or show non-dismissible modal.
  - On successful update, set `mustChangePassword = false` in `SecureStorageService` and navigate to `/dashboard`.

#### 2.3 Multi-Membership Switcher
- In `UserAccountsDrawerHeader` (`lib/shared/widgets/app_drawer.dart`), if `memberships.length > 1`:
  - Render a drop-down chip allowing the user to select another active school.
  - When selected, update `institutionId` in `SecureStorageService`, refresh `userProfileNotifierProvider`, and reload the dashboard.

---

### Step 3: Teacher Daily Attendance Roster Taker

*Complementing existing read-only student logs with the full faculty attendance module.*

#### 3.1 Data Contracts
- `GET /api/attendance/sheet?sectionId={sectionUuid}&date={YYYY-MM-DD}` -> Returns section student roster with today's recorded status.
- `POST /api/attendance` -> Body: `{ "records": [{ "studentId": "uuid", "sectionId": "uuid", "date": "YYYY-MM-DD", "status": "present"|"absent"|"late"|"excused" }] }`
- `GET /api/attendance/summary?sectionId={sectionUuid}&date={YYYY-MM-DD}` -> Percentage & counts.

#### 3.2 Implementation Steps (`lib/features/attendance/`)
1. Create `AttendanceRosterScreen` (accessible when user has `attendance.create` or `attendance.manage`):
   - Section Selector dropdown + Date Picker strip.
   - Quick Action: **"Mark All Present"** button.
   - Student Card List: Roll No, Avatar, Name, Admission No, and a 4-state segmented button:
     - `P` (Present - Green `#2F9E63`)
     - `A` (Absent - Red `#D64545`)
     - `L` (Late - Amber `#E3A008`)
     - `E` (Excused - Blue `#3B82C4`)
2. Add **Offline Draft Support**: Cache taken attendance in local state if network drops during morning roll call.
3. Save button submitting batch records to `POST /api/attendance`.

---

### Step 4: Examination Management & Marks Entry Gradebook

*Expanding `lib/features/examinations/` from student report cards to full teacher gradebook.*

#### 4.1 Data Contracts
- `GET /api/attendance/exams` & `POST /api/attendance/exams` -> Exam sessions list (`Midterm 2026`, `Final 2026`).
- `GET /api/attendance/exams/{examId}/papers` -> Papers schedule with `theoryWeight`, `practicalWeight`, `vivaWeight`, `maxMarks`, `passMarks`.
- `GET /api/attendance/marks?examId={id}&subjectId={id}&sectionId={id}` -> Mark records.
- `POST /api/attendance/marks` -> Body: `{ "marks": [{ "examId": "uuid", "studentId": "uuid", "subjectId": "uuid", "marksObtained": 88, "maxMarks": 100, "grade": "A+" }] }`

#### 4.2 Implementation Steps
1. Create `ExamsListScreen` and `ExamPapersScreen` displaying exam schedules and weight breakdowns.
2. Create `MarksEntryGradebookScreen`:
   - Filter headers: Exam Session + Section + Subject.
   - Spreadsheet-style list: Roll No, Student Name, Numeric Mark Input, Auto-computed Grade Badge.
   - Input validation: Highlight red if `marksObtained > maxMarks`.
   - Submit button dispatching batch array to `POST /api/attendance/marks`.

---

### Step 5: Students Directory, Dynamic Custom Fields & Progression

#### 5.1 Data Contracts
- `GET /api/core/students?classId=&sectionId=&status=` -> Student directory array.
- `POST /api/core/students` -> Create & auto-provision student user record.
- `GET /api/core/custom-fields?entityType=student` -> Dynamic custom fields schema (`blood_group`, `emergency_contact`, etc.).
- `GET /api/core/students/{id}/academic-history` -> Complete chronological progression history.

#### 5.2 Implementation Steps (`lib/features/students/`)
1. Create `StudentDirectoryScreen`:
   - Search bar (by name, admission no, roll no).
   - Class & Section filter chips.
   - Student Card with status pill (`active`, `graduated`, `suspended`) and direct phone call action to guardian.
2. Create `DynamicCustomFieldForm` (`lib/shared/widgets/dynamic_custom_field_form.dart`):
   - Dynamically render inputs based on `fieldType` (`text`, `number`, `select`, `date`, `boolean`, `tag`).
3. Create `StudentProfileDetailScreen`:
   - Tab 1: General & Custom Fields.
   - Tab 2: Guardian Info & Contacts.
   - Tab 3: Academic History Progression Timeline (`GET /api/core/students/{id}/academic-history`).

---

### Step 6: Coursework Assignments, File Attachments & Grading

#### 6.1 Data Contracts
- `GET /api/assignments?sectionId=&status=` -> List class assignments.
- `POST /api/assignments` -> Create assignment `{ sectionId, subjectId, title, description, dueDate }`.
- `POST /api/storage/local-upload?key={fileName}` -> Direct local binary upload.
- `POST /api/assignments/{id}/attachments/presigned-url` -> Production S3/R2 presigned upload URL.
- `POST /api/assignments/{id}/attachments` -> Link uploaded file key `{ fileName, fileKey }`.
- `POST /api/assignments/{id}/submit` -> Student submission `{ fileKey, studentId }`.
- `POST /api/assignments/grade` -> Teacher grade `{ submissionId, grade, feedback }`.

#### 6.2 Implementation Steps (`lib/features/assignments/`)
1. Create `AssignmentsListScreen`: Tabs for "Active", "Past Due", "Graded".
2. Create `CreateAssignmentModal`: Form with Section, Subject, Title, Description, Due Date, and `file_picker` attachment upload.
3. Create `StudentSubmissionModal`: Allow student to pick PDF/Images and submit.
4. Create `TeacherGradingDrawer`: Preview submitted student files, assign grade (`A+`, `95/100`), and enter feedback notes.

---

### Step 7: Notices & Institutional Broadcasts

#### 7.1 Data Contracts
- `GET /api/notices` -> Notices array with `isRead` status.
- `POST /api/notices` -> Publish notice `{ title, body, audienceScope }`.
- `POST /api/notices/{id}/read` -> Mark notice as read.

#### 7.2 Implementation Steps (`lib/features/notices/`)
1. Create `NoticesScreen`:
   - Unread indicator dot on unread notices.
   - Audience scope chips (`Institution`, `Teachers Only`, `Class 9`).
   - Tapping an item opens `NoticeDetailSheet` and fires `POST /api/notices/{id}/read`.
2. Create `PublishNoticeModal` (for staff with `notices.write` permission): Title, Body, Audience Scope picker.

---

### Step 8: Staff Tasks & Delegated Workflows

#### 8.1 Data Contracts
- `GET /api/core/tasks?filter=assigned_to_me|created_by_me|all` -> Tasks array.
- `POST /api/core/tasks` -> Create task `{ assigneeMembershipId, title, description, priority, dueDate }`.
- `PATCH /api/core/tasks/{id}/status` -> Update status `{ status: "pending"|"in_progress"|"completed"|"cancelled" }`.

#### 8.2 Implementation Steps (`lib/features/tasks/`)
1. Create `TasksScreen`:
   - Filter Tabs: "Assigned to Me", "Created by Me".
   - Priority Tag: `Urgent` (Red), `High` (Orange), `Medium` (Yellow), `Low` (Gray).
   - 1-Tap status cycle checkbox / toggle.
2. Create `CreateTaskSheet`: Member search picker, Title, Description, Priority, Due Date.

---

### Step 9: Admissions Pipeline & 1-Click Enrollment

#### 9.1 Data Contracts
- `GET /api/admissions?status=&classId=&search=` -> Applications list.
- `GET /api/admissions/stats` -> Pipeline conversion metrics.
- `POST /api/admissions` -> Submit new inquiry/application.
- `PATCH /api/admissions/{id}` -> Update status & fee status (`unpaid`, `paid`, `waived`).
- `POST /api/admissions/{id}/admit` -> 1-Click Admit & Auto-Enroll `{ sectionId, admissionNo, rollNo, academicYearId }`.

#### 9.2 Implementation Steps (`lib/features/admissions/`)
1. Create `AdmissionsPipelineScreen`:
   - Top metrics row: Inquiries, Under Review, Shortlisted, Admitted.
   - Status filtered cards with fee status chips.
2. Create `OneClickAdmitDialog`:
   - Select Class Section, assign Roll Number, and submit.
   - Automatically provisions student profile, user account, and section enrollment in a single call.

---

### Step 10: Academic Structure & Weekly Timetable Routines

#### 10.1 Data Contracts
- `GET /api/core/academic-years`, `/classes`, `/sections`, `/subjects`.
- `GET /api/core/schedules?sectionId=&dayOfWeek=` -> Period slot list.
- `POST /api/core/schedules` -> Create slot `{ sectionId, subjectId, teacherMembershipId, dayOfWeek, startTime, endTime, roomNo }`.

#### 10.2 Implementation Steps (`lib/features/academic/`)
1. Create `TimetableRoutineScreen`:
   - Day-of-week tab pills (`Sun`, `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`).
   - Period cards showing Subject, Teacher, Room (`Room 201`), and Time Range (`08:30 - 09:15`).
   - Live "Current Period" highlight based on device clock.
2. Create `AcademicStructureManagerScreen` for Admin roles to configure Classes & Sections.

---

### Step 11: Members Directory & RBAC Matrix

#### 11.1 Data Contracts
- `GET /api/core/members` -> Staff list `{ id, name, email, phone, roleName, loginUsername }`.
- `POST /api/core/members/invite` -> Invite staff `{ name, email, phone, username, roleId, temporaryPassword }`.
- `GET /api/core/roles` & `GET /api/core/roles/{id}/permissions` -> Role permission matrix.

#### 11.2 Implementation Steps (`lib/features/members/`)
1. Create `StaffDirectoryScreen`: Contact cards with 1-tap Phone Call, SMS, and Email actions.
2. Create `InviteStaffModal`: Role picker and temporary credentials generator.
3. Create `RolePermissionMatrixScreen`: Grouped permissions matrix viewer.

---

## 4. Route Registration Map (`lib/app/config/routes.dart`)

Update `routes.dart` to encompass all platform destinations with Sentry telemetry and permission guards:

| Route Path | Screen Component | Required Permission |
|---|---|---|
| `/login` | `LoginScreen` | *Public* |
| `/dashboard` | `DashboardScreen` / `StudentDashboardScreen` | `dashboard.read` |
| `/attendance` | `AttendanceScreen` (Student) / `AttendanceRosterScreen` (Teacher) | `attendance.read` / `attendance.create` |
| `/examinations` | `ExaminationsScreen` (Student) / `MarksGradebookScreen` (Staff) | `marks.read` / `marks.create` |
| `/students` | `StudentDirectoryScreen` | `students.read` |
| `/students/:id` | `StudentDetailScreen` | `students.read` |
| `/academic` | `TimetableRoutineScreen` & `AcademicStructureScreen` | `classes.manage` / `schedules.read` |
| `/assignments` | `AssignmentsListScreen` | `assignments.read` |
| `/notices` | `NoticesScreen` | `notices.read` |
| `/tasks` | `TasksScreen` | `tasks.read` |
| `/admissions` | `AdmissionsPipelineScreen` | `admissions.read` |
| `/members` | `StaffDirectoryScreen` | `memberships.manage` |
| `/permissions` | `RolePermissionMatrixScreen` | `roles.manage` |
| `/settings` | `InstitutionSettingsScreen` | `settings.manage` |
| `/profile` | `ProfileScreen` | *Authenticated* |

---

## 5. Development Verification with Mock Personas

Test each module across different roles using the built-in mock tokens:

| Persona | Token | Expected App Experience |
|---|---|---|
| **Super Admin** | `mock-token-admin-1` | Unlocked AppDrawer (all 14 items), Admissions pipeline, Staff invites, Academic setup |
| **Teacher** | `mock-token-teacher-1` | Attendance Taker, Gradebook marks entry, Assignments publisher, Class timetable |
| **Student** | `mock-token-student-1` | Simplified Student Dashboard, Attendance history, Exam report card, Routine, Homework submissions |
| **Guardian** | `mock-token-guardian-1` | Child attendance rate, Exam marks report, Notice board, Fee status |

---

## 6. Execution Priority Matrix

```
[Phase 1: Foundations]
 ├── Fix AppConstants & ApiClient BaseUrl
 ├── Fill empty widgets (custom_button, error_view, role_guard)
 └── Add Institutions Dropdown & Mock Persona Chips to Login

[Phase 2: Core Academic & Faculty Operations]
 ├── Teacher Daily Attendance Roster Taker (GET /sheet, POST /attendance)
 ├── Examination Papers Schedule & Marks Entry Gradebook (GET/POST /marks)
 └── Student Directory with Dynamic Custom Fields (GET /students, GET /custom-fields)

[Phase 3: Communication & Workflow]
 ├── Coursework Assignments, File Uploads & Teacher Grading
 ├── Notice Board & Mark-as-Read Tracking
 └── Staff Tasks Delegation & Status Cycle

[Phase 4: Institutional Pipeline & Management]
 ├── Admissions Pipeline & 1-Click Admit Dialog
 ├── Weekly Timetable Routine & Academic Structure
 └── Members Directory, Staff Invites & RBAC Matrix
```
