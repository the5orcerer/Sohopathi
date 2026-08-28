# Education Platform — Core Onboarding & Permission-Delegation Master Plan

**Target Audience**: The implementing developer / autonomous AI engineer.  
**Execution Context**: You have **complete access** to run commands in the terminal, reset/clear the database, create and run migrations, adapt the backend server, and connect the frontend directly to live API endpoints (no mockup data).

---

## 1. High-Level Vision & Soft-Launch Scope

The goal of this platform is to **construct an entire educational institution on the cloud** with a multi-tenant, permission-driven foundation. Once an institution is provisioned, day-to-day operations and organizational hierarchies are self-managed entirely through the UI without requiring engineering intervention or custom code per school.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PLATFORM ADMIN                                 │
│  • Provisions new Institution (Name, Subdomain / ID)                    │
│  • Generates initial Institution Admin credentials (Username, Temp PW)   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Hands credentials to school
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        INSTITUTION ADMIN                                │
│  • Logs in via: [Institution ID / Subdomain] + [Username] + [Password]   │
│  • Manages Roles (cloned from platform templates or custom created)      │
│  • Configures Granular Permission Matrix (Delegates fields to roles)    │
│  • Invites Employees (Teachers, Coordinators, Exam Controllers, Staff)  │
│  • Sets up Academic Structure (Years, Classes, Sections, Subjects)      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Roles & delegated permissions
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  DELEGATED EMPLOYEES & STAFF                            │
│  • Coordinator: Manages subjects, classes, onboards student rosters     │
│  • Teacher: Takes attendance, inputs marks for assigned sections        │
│  • All UI actions driven dynamically by resolved permissions            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Soft-Launch Scope Discipline

To ensure rapid, clean, and rock-solid execution, we **defer complex non-core features** (e.g., live vehicle/fleet GPS tracking, transport routes, multi-currency accounting, complex transaction engines, payroll) for future phases.

#### ✅ Included in Soft-Launch Core:
1. **Multi-Tenant Foundation & Platform Provisioning**: Institution isolation, subdomain mapping, platform-level institution provisioning.
2. **Institution-Scoped Authentication**: Login by `(Institution Subdomain, Username, Password)` + forced password reset on first login.
3. **Role-Based Access Control (RBAC) & Dynamic Permission Matrix**: Cloned system role templates, custom role builder, granular matrix editor with scopes (`institution`, `assigned_sections`, `self`).
4. **Granular "Field" Permissions**: Independent control over `subjects.manage`, `classes.manage`, `sections.manage`, `academic_years.manage`, `students.write`, `roles.manage`, `memberships.manage`, `attendance.create/read`, `marks.create/read`, `notices.read/write`.
5. **Employee Onboarding & Membership Lifecycle**: Invitation flow, profile creation, role assignment, active/inactive statuses.
6. **Academic Structure & Allocations**: Academic years, classes, sections, subjects, teacher-to-subject-section assignments.
7. **Student Registry & Enrollments**: Distinct student profiles (separated from system memberships), guardians, class/section enrollment, roll numbers.
8. **Core Daily Operations**: Live attendance recording, exam marks capture, institution notice board.
9. **Full-Stack Live Integration**: Frontend components, navbars, and widgets dynamically rendered from backend database queries (zero hardcoded mock data).

#### ⏸️ Deferred for Post-Soft-Launch:
- Transport fleet, drivers, routes, stops, and live GPS tracking.
- Complex invoice payment gateways, merchant payouts, and multi-ledger accounting.

---

## 2. Infrastructure Flexibility (Local & Production Ready)

The system must run seamlessly on **localhost** during development and deploy cleanly to **production cloud infrastructure** (hosted Postgres, Supabase Auth, Cloudflare R2 / S3) without rewriting application business logic.

```
                  ┌────────────────────────────────────────┐
                  │          Express Application           │
                  └───────┬───────────────┬──────────────┬─┘
                          │               │              │
                          ▼               ▼              ▼
                   [Database Layer]  [Auth Layer]   [Storage Layer]
                          │               │              │
     Local Dev:    Local Postgres   Local Auth /    Local Disk /
                   (Port 5432/5433) Direct DB       Express Static
                          │               │              │
    Production:    Supabase /       Supabase Auth / Cloudflare R2 /
                   AWS RDS          Hosted JWT      AWS S3
```

- **Database**: Plain PostgreSQL with standard SQL queries and standard Row-Level Security (RLS) policies using the session setting `app.current_institution_id`.
- **Authentication**: Abstracted behind an `AuthProvider` interface (`verifyToken`, `createUser`, `signIn`, etc.) supporting local database auth in development and Supabase Auth in production.
- **Storage**: Abstracted behind a `StorageAdapter` interface supporting local filesystem storage (`LocalFileStorageAdapter`) in development and S3-compatible storage (`S3CompatibleStorageAdapter`) in production.

---

## 3. Database Architecture & Complete Data Model

The implementing engineer should reset the database and execute clean migrations that establish the following relational structure:

### 3.1. Platform & Tenancy Tables
- `platform_admin`: Standalone platform operators (`id`, `email`, `password_hash`, `name`, `created_at`).
- `institution`: Tenant entities (`id` UUID, `name`, `subdomain` UNIQUE, `branding` JSONB, `status`, `created_at`).
- `profile`: User identity record (`id` UUID, `email`, `name`, `phone`, `avatar_url`, `status`, `must_change_password` BOOLEAN, `password_hash` TEXT, `created_at`, `updated_at`).
- `module`: Catalog of available system modules (`id`, `key` UNIQUE, `name`, `version`, `status`).
- `permission`: Catalog of permissions (`id`, `key` UNIQUE, `module_id`, `description`, `scope_options` TEXT[]).
- `institution_module`: Enabled modules per institution (`institution_id`, `module_id`, `enabled`).
- `role`: Roles (`id`, `institution_id` NULLABLE for templates, `name`, `is_system` BOOLEAN).
- `role_permission`: Permissions granted to a role (`id`, `institution_id` NULLABLE, `role_id`, `permission_id`, `scope`).
- `membership`: Association between a user profile and an institution (`id`, `user_id`, `institution_id`, `role_id`, `login_username` TEXT, `status`, `created_at`, UNIQUE(`institution_id`, `login_username`)).
- `membership_scope`: Ad-hoc manual scopes (`id`, `institution_id`, `membership_id`, `scope_type`, `scope_id`).

### 3.2. Academic Core Tables
- `academic_year`: School sessions (`id`, `institution_id`, `label`, `start_date`, `end_date`, `is_current` BOOLEAN).
- `class`: Grades/Classes (`id`, `institution_id`, `academic_year_id`, `name`, `sort_order`).
- `section`: Class divisions (`id`, `institution_id`, `class_id`, `name`, `capacity`).
- `subject`: Courses/Subjects (`id`, `institution_id`, `name`, `code`).
- `class_subject_teacher`: Mapping of teachers to section subjects (`id`, `institution_id`, `section_id`, `subject_id`, `teacher_membership_id`).
- `student`: Student master records (`id`, `institution_id`, `user_id` NULLABLE, `admission_no`, `name`, `date_of_birth`, `gender`, `status`, `created_at`, UNIQUE(`institution_id`, `admission_no`)).
- `guardian`: Guardian master records (`id`, `institution_id`, `user_id` NULLABLE, `name`, `phone`).
- `student_guardian`: Join table (`institution_id`, `student_id`, `guardian_id`, `relation_type`).
- `enrollment`: Student placement in a section for a specific year (`id`, `institution_id`, `student_id`, `academic_year_id`, `class_id`, `section_id`, `roll_no`, `status`, UNIQUE(`student_id`, `academic_year_id`)).

### 3.3. Daily Operations Tables
- `attendance`: Daily student attendance (`id`, `institution_id`, `student_id`, `section_id`, `date`, `status` [present, absent, late, excused], `recorded_by_membership_id`, UNIQUE(`student_id`, `date`)).
- `exam`: Exam terms (`id`, `institution_id`, `academic_year_id`, `name`, `term`).
- `mark`: Student marks (`id`, `institution_id`, `exam_id`, `student_id`, `subject_id`, `marks_obtained`, `max_marks`, `grade`, `recorded_by_membership_id`, UNIQUE(`exam_id`, `student_id`, `subject_id`)).
- `notice`: Announcements (`id`, `institution_id`, `title`, `body`, `audience_scope`, `published_by_membership_id`, `published_at`).
- `audit_log`: System audit trail (`id`, `institution_id`, `actor_membership_id`, `action`, `entity_type`, `entity_id`, `before` JSONB, `after` JSONB, `created_at`).

### 3.4. Catalog Seeding (Core & Granular Permissions)
The seed data should populate the platform catalog with granular field permissions:

```
Modules:
  - core (Core Academic & Administration)
  - attendance (Student Attendance Management)
  - marks (Exams and Marks Entry)
  - notices (Institution Notice Board)

Granular Permissions:
  - academic_years.manage  ['institution']
  - classes.manage         ['institution']
  - sections.manage        ['institution']
  - subjects.manage        ['institution']
  - teachers.assign        ['institution']
  - students.read          ['institution', 'assigned_sections', 'self']
  - students.write         ['institution']
  - roles.manage           ['institution']
  - memberships.manage     ['institution']
  - attendance.read        ['institution', 'assigned_sections', 'self']
  - attendance.create      ['assigned_sections', 'institution']
  - marks.read             ['institution', 'assigned_sections', 'self']
  - marks.create           ['assigned_sections', 'institution']
  - marks.approve          ['institution']
  - notices.read           ['institution', 'self']
  - notices.write          ['institution']

Template Roles (institution_id IS NULL):
  - Institution Admin (full permissions at 'institution' scope)
  - Teacher (students.read, attendance.read/create, marks.read/create at 'assigned_sections' scope; notices.read at 'institution' scope)
  - Student (attendance.read, marks.read at 'self' scope; notices.read at 'institution' scope)
  - Guardian (attendance.read, marks.read at 'self' scope; notices.read at 'institution' scope)
```

---

## 4. Platform Admin & Institution Provisioning Flow

```
POST /api/platform/institutions
Request Body:
{
  "name": "Northfield International School",
  "subdomain": "northfield",
  "adminName": "Principal John Doe",
  "adminEmail": "admin@northfield.edu",
  "adminUsername": "admin"
}
```

### Provisioning Step-by-Step Logic:
1. **Create Institution**: Insert record into `institution` with `subdomain = 'northfield'`.
2. **Enable Default Modules**: Insert rows into `institution_module` for all core modules.
3. **Clone Template Roles**:
   - Query all template roles (`where institution_id is null`).
   - For each template role, insert a new `role` row with `institution_id = newInstitution.id`.
   - Copy all `role_permission` rows from the template role into the new role.
   - Ensure the newly created "Institution Admin" role has full grants across all enabled permissions.
4. **Create Admin User & Profile**:
   - Generate a temporary password (or secure hash).
   - Create profile with `must_change_password = true`.
5. **Create Admin Membership**:
   - Link user profile to institution with the cloned "Institution Admin" role.
   - Set `login_username = 'admin'`.
6. **Return Provisioning Payload**:
   - Return `{ institutionId: "northfield", username: "admin", temporaryPassword: "<plain_temp_pw>" }`.

---

## 5. Institution-Scoped Authentication Flow

Users log in using **Institution Subdomain/ID**, **Username**, and **Password**.

```
POST /api/auth/login
Request Body:
{
  "institutionCode": "northfield",
  "username": "admin",
  "password": "TemporaryPassword123!"
}
```

### Authentication Logic:
1. Lookup institution by `subdomain = institutionCode`. If not found, return 401.
2. Lookup membership by `institution_id` and `login_username = username`.
3. Verify password against user's password record (or via AuthProvider).
4. Resolve user profile, active membership, role, and flat list of permissions.
5. If `must_change_password == true`, signal the frontend to render the password change dialog.
6. Return session token, user details, active membership, and resolved permissions array:

```json
{
  "token": "session-jwt-or-bearer-token",
  "user": { "id": "...", "name": "Principal John Doe", "email": "admin@northfield.edu" },
  "activeMembership": {
    "id": "...",
    "institutionId": "...",
    "institutionName": "Northfield International School",
    "institutionSubdomain": "northfield",
    "roleId": "...",
    "roleName": "Institution Admin"
  },
  "permissions": [
    "academic_years.manage",
    "classes.manage",
    "sections.manage",
    "subjects.manage",
    "students.write",
    "students.read",
    "roles.manage",
    "memberships.manage",
    "attendance.create",
    "attendance.read",
    "marks.create",
    "marks.read",
    "notices.write",
    "notices.read"
  ],
  "mustChangePassword": true
}
```

---

## 6. Granular Permission Matrix & Delegation

The Institution Admin manages roles and permission delegation via the **Permission Matrix UI**:

- **Roles Screen**:
  - Lists all institution-owned roles.
  - Allows creating custom roles (e.g., "Academic Coordinator", "Exam Controller", "Senior Teacher").
- **Permission Matrix Editor**:
  - Grid showing Roles (rows) vs Permissions (columns).
  - Admins can toggle permissions and select scope (`institution`, `assigned_sections`, `self`).
  - Example: Super admin creates role "Academic Coordinator", grants `subjects.manage` and `students.write` at `institution` scope. When the Coordinator logs in, their navigation and actions immediately update without any code change.

```
┌────────────────────────┬─────────────────┬─────────────────┬───────────────────┬───────────────────┐
│ Role Name              │ subjects.manage │ students.write  │ attendance.create │ marks.create      │
├────────────────────────┼─────────────────┼─────────────────┼───────────────────┼───────────────────┤
│ Institution Admin      │ ✓ (institution) │ ✓ (institution) │ ✓ (institution)   │ ✓ (institution)   │
│ Academic Coordinator   │ ✓ (institution) │ ✓ (institution) │ —                 │ —                 │
│ Teacher                │ —               │ —               │ ✓ (sections)      │ ✓ (sections)      │
│ Exam Controller        │ —               │ —               │ —                 │ ✓ (institution)   │
└────────────────────────┴─────────────────┴─────────────────┴───────────────────┴───────────────────┘
```

---

## 7. Separate Onboarding Surfaces: Employees vs. Students

Maintain strict separation between employee management and student rosters:

### 7.1. Employees & Staff (`membership` + `profile`)
- **Route**: `POST /api/core/members/invite` (Gated by `memberships.manage`)
- **Fields**: Name, Email, Login Username, Temporary Password, Assigned Role ID.
- **Purpose**: System operators with logins and permissions.

### 7.2. Students (`student` + `enrollment`)
- **Route**: `POST /api/core/students` & `POST /api/core/students/bulk-import` (Gated by `students.write`)
- **Fields**: Admission No, Name, Gender, DOB, Academic Year, Class, Section, Roll No, Guardian Info.
- **Purpose**: Academic learners enrolled in classes, tracked for attendance and marks.

---

## 8. Real-Data Frontend Wiring Plan

The frontend must eliminate all mock data and communicate directly with the backend API:

1. **Authentication & Session**:
   - Login page takes Institution ID, Username, and Password.
   - Stores token and active membership in state/local storage.
   - Renders mandatory password change modal if `mustChangePassword` is true.
2. **Dynamic Navigation**:
   - Sidebar and navigation items filter automatically based on `session.permissions`.
   - "Settings / Roles & Permissions" visible only if user holds `roles.manage`.
   - "Students" visible only if user holds `students.read` or `students.write`.
   - "Attendance" visible only if user holds `attendance.read` or `attendance.create`.
   - "Marks" visible only if user holds `marks.read` or `marks.create`.
   - "Academic Config" (Classes, Sections, Subjects) visible only if user holds `classes.manage` or `subjects.manage`.
3. **Dedicated Pages**:
   - **Academic Management**: Manage Years, Classes, Sections, Subjects, and Assign Teachers.
   - **Permission Matrix**: Live role creation and checkbox/select matrix for permissions and scopes.
   - **Members Management**: Employee invite modal and active staff list.
   - **Student Directory**: Student list, single/bulk creation, section filtering.
   - **Attendance Sheet**: Mark daily attendance for sections and submit directly to DB.
   - **Marks Register**: Enter subject marks per exam term and submit directly to DB.
   - **Notices**: Publish announcements with audience scope.

---

## 9. Implementation Checklist for the Engineer

Follow these steps sequentially to implement and verify the entire system:

- [ ] **Step 1: Database Reset & Schema Creation**
  - Reset / clear database.
  - Create tables with RLS and foreign key constraints.
  - Seed catalog modules, granular permissions, and template roles.
- [ ] **Step 2: Backend Core & Middleware**
  - Ensure `withTenantContext` sets `app.current_institution_id` per request transaction.
  - Implement permission & scope check middleware.
- [ ] **Step 3: Platform Provisioning & Scoped Auth**
  - Implement `POST /api/platform/institutions` to provision tenant, clone template roles, and create initial admin.
  - Implement `POST /api/auth/login` for institution-scoped credentials.
  - Implement `POST /api/auth/change-password`.
- [ ] **Step 4: Roles & Permission Matrix API**
  - `GET /api/core/permissions` — list platform permissions.
  - `GET /api/core/roles` & `POST /api/core/roles` — manage institution roles.
  - `GET /api/core/roles/:id/permissions` & `PUT /api/core/roles/:id/permissions` — update role permissions and scopes.
- [ ] **Step 5: Academic Hierarchy & Staff API**
  - Endpoints for Academic Years, Classes, Sections, Subjects, and Teacher assignments.
  - Member invite endpoint (`POST /api/core/members/invite`).
- [ ] **Step 6: Student Management API**
  - Student creation and section enrollment endpoints (`POST /api/core/students`, `POST /api/core/enrollments`).
- [ ] **Step 7: Operations API**
  - Attendance recording and summary (`POST /api/attendance/batch`, `GET /api/attendance/summary`).
  - Marks entry and report (`POST /api/marks/batch`, `GET /api/marks`).
  - Notice board publishing (`POST /api/notices`, `GET /api/notices`).
- [ ] **Step 8: Frontend UI & Live DB Integration**
  - Update login UI to accept Institution ID, Username, and Password.
  - Build Permission Matrix page with interactive role permission toggles.
  - Build Academic Structure configuration page.
  - Build Member Invite & Student Directory pages.
  - Ensure all components display live database data and handle loading/error states cleanly.
