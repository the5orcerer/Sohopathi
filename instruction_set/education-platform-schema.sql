-- ============================================================================
-- EDUCATION PLATFORM — CANONICAL SCHEMA
-- Run this once in the Supabase SQL Editor. Idempotent-ish (safe to re-run
-- on a clean project; not designed to be re-run on a populated one — use
-- proper migrations for changes after this).
--
-- Design notes:
--   - Every tenant-owned table carries institution_id directly, even join
--     tables, per the architecture doc's rule ("every tenant-owned record
--     carries institution_id"). This trades a little normalization purity
--     for simple, fast, uniform RLS.
--   - RLS uses a session variable (app.current_institution_id) set by the
--     BACKEND per request, not auth.uid()-based lookups. This is deliberate:
--     it keeps RLS decoupled from which auth provider you use, so it still
--     works if you ever move off Supabase Auth (see portability doc §3).
--   - RLS here is tenant isolation only (second line of defense). Granular
--     permission + scope checks (attendance.read vs .write, assigned_sections
--     vs institution) happen in backend route middleware BEFORE the query
--     runs — see education-platform-backend-core.md §3.
--   - auth.users / auth.uid() is used only for the `profile` table, which is
--     the one Supabase-specific seam in this schema. Everything else is
--     plain Postgres.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 0. HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- reads the institution the CURRENT REQUEST is scoped to. The backend sets
-- this once per request/transaction via: SET LOCAL app.current_institution_id = '<uuid>';
-- Returns NULL if unset, which makes every tenant_isolation policy fail
-- closed (no institution_id ever equals NULL) — safe default-deny.
create or replace function public.current_institution_id()
returns uuid
language sql stable
as $$
  select nullif(current_setting('app.current_institution_id', true), '')::uuid;
$$;

-- ----------------------------------------------------------------------------
-- 1. IDENTITY — profile wraps auth.users (the one Supabase-specific seam)
-- ----------------------------------------------------------------------------

create table public.profile (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profile_updated_at
  before update on public.profile
  for each row execute procedure public.set_updated_at();

-- auto-create a profile row whenever someone signs up via Supabase Auth
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profile (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 2. PLATFORM CATALOG — global, populated by module registration (§ module
--    registry engine in education-platform-backend-core.md), not by hand.
-- ----------------------------------------------------------------------------

create table public.module (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  version text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.permission (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,               -- "assignments.create"
  module_id uuid not null references public.module(id) on delete cascade,
  description text,
  scope_options text[] not null default '{}'
);

create table public.widget (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  module_id uuid not null references public.module(id) on delete cascade,
  required_permissions text[] not null default '{}',
  default_size jsonb not null default '{"width":4,"height":2}',
  data_source text not null,
  renderer text not null,
  unique (module_id, key)
);

-- ----------------------------------------------------------------------------
-- 3. TENANCY
-- ----------------------------------------------------------------------------

create table public.institution (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subdomain text unique not null,
  branding jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.institution_module (
  institution_id uuid not null references public.institution(id) on delete cascade,
  module_id uuid not null references public.module(id) on delete cascade,
  enabled boolean not null default true,
  primary key (institution_id, module_id)
);

create table public.campus (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  name text not null,
  address text
);

create table public.academic_year (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  label text not null,               -- "2026-2027"
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false
);

-- institution_id NULL = platform-default role (e.g. shipped templates like
-- "Teacher", "Student"), which every institution can see and clone from.
create table public.role (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institution(id) on delete cascade,
  name text not null,
  is_system boolean not null default false
);

create table public.role_permission (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institution(id) on delete cascade, -- NULL for platform-default roles, mirrors role.institution_id
  role_id uuid not null references public.role(id) on delete cascade,
  permission_id uuid not null references public.permission(id) on delete cascade,
  scope text not null,               -- must be one of permission.scope_options
  unique (role_id, permission_id)
);

create table public.membership (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile(id) on delete cascade,
  institution_id uuid not null references public.institution(id) on delete cascade,
  role_id uuid not null references public.role(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (user_id, institution_id)
);

-- ad-hoc scope grants that aren't derivable from a domain assignment table
-- (e.g. an Assistant Teacher role hand-scoped to specific sections)
create table public.membership_scope (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade, -- denormalized
  membership_id uuid not null references public.membership(id) on delete cascade,
  scope_type text not null check (scope_type in ('section', 'class', 'campus')),
  scope_id uuid not null
);

-- ----------------------------------------------------------------------------
-- 4. DASHBOARD / SYSTEM
-- ----------------------------------------------------------------------------

-- institution_id NULL = platform-default layout
create table public.dashboard_layout (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institution(id) on delete cascade,
  scope_type text not null check (scope_type in ('platform', 'institution', 'role', 'user')),
  scope_id uuid,                     -- role_id or user_id depending on scope_type; NULL for platform
  widget_id uuid not null references public.widget(id) on delete cascade,
  x int not null, y int not null, width int not null, height int not null
);

create table public.event (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  type text not null,                -- "assignment.submitted"
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  actor_membership_id uuid references public.membership(id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. ACADEMIC CORE
-- ----------------------------------------------------------------------------

create table public.student (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  user_id uuid references public.profile(id),   -- nullable: not every student has a login
  admission_no text not null,
  name text not null,
  date_of_birth date,
  gender text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (institution_id, admission_no)
);

create table public.guardian (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  user_id uuid references public.profile(id),
  name text not null,
  phone text
);

create table public.student_guardian (
  institution_id uuid not null references public.institution(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  guardian_id uuid not null references public.guardian(id) on delete cascade,
  relation_type text,
  primary key (student_id, guardian_id)
);

create table public.class (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  academic_year_id uuid not null references public.academic_year(id) on delete cascade,
  name text not null,                -- "Class 5"
  sort_order int not null default 0
);

create table public.section (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  class_id uuid not null references public.class(id) on delete cascade,
  name text not null,                -- "A"
  capacity int
);

create table public.subject (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  name text not null,
  code text
);

create table public.class_subject_teacher (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  section_id uuid not null references public.section(id) on delete cascade,
  subject_id uuid not null references public.subject(id) on delete cascade,
  teacher_membership_id uuid not null references public.membership(id) on delete cascade
);

create table public.enrollment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  academic_year_id uuid not null references public.academic_year(id) on delete cascade,
  class_id uuid not null references public.class(id) on delete cascade,
  section_id uuid not null references public.section(id) on delete cascade,
  roll_no text,
  status text not null default 'active',   -- active, completed, transferred
  enrolled_at timestamptz not null default now(),
  unique (student_id, academic_year_id)    -- one enrollment per student per year
);

-- ----------------------------------------------------------------------------
-- 6. OPERATIONAL — attendance, exams/marks, notices, finance
-- ----------------------------------------------------------------------------

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  section_id uuid not null references public.section(id) on delete cascade,
  date date not null,
  status text not null,              -- present, absent, late, excused
  recorded_by_membership_id uuid references public.membership(id),
  unique (student_id, date)
);

create table public.exam (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  academic_year_id uuid not null references public.academic_year(id) on delete cascade,
  name text not null,
  term text
);

create table public.mark (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  exam_id uuid not null references public.exam(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  subject_id uuid not null references public.subject(id) on delete cascade,
  marks_obtained numeric,
  max_marks numeric not null,
  grade text,
  recorded_by_membership_id uuid references public.membership(id),
  unique (exam_id, student_id, subject_id)
);

create table public.notice (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  title text not null,
  body text not null,
  audience_scope text not null default 'institution',
  published_by_membership_id uuid references public.membership(id),
  published_at timestamptz not null default now()
);

create table public.fee_invoice (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  academic_year_id uuid references public.academic_year(id) on delete set null,
  title text not null default 'Tuition Fee',
  amount numeric not null,
  due_date date not null,
  status text not null default 'pending',   -- pending, paid, overdue, waived
  created_at timestamptz not null default now()
);

create table public.payment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  invoice_id uuid not null references public.fee_invoice(id) on delete cascade,
  amount numeric not null,
  payment_date date not null default current_date,
  method text,
  status text not null default 'completed'
);

-- ----------------------------------------------------------------------------
-- 7. MODULE: ASSIGNMENTS (worked example, matches module contract §5)
-- ----------------------------------------------------------------------------

create table public.assignment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  section_id uuid not null references public.section(id) on delete cascade,
  subject_id uuid not null references public.subject(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  created_by_membership_id uuid references public.membership(id),
  created_at timestamptz not null default now()
);

create table public.assignment_attachment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  assignment_id uuid not null references public.assignment(id) on delete cascade,
  file_key text not null,            -- object storage key, see storage adapter
  file_name text not null
);

create table public.assignment_submission (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  assignment_id uuid not null references public.assignment(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  file_key text,
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted',
  unique (assignment_id, student_id)
);

create table public.assignment_grade (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  submission_id uuid not null references public.assignment_submission(id) on delete cascade unique,
  grade text,
  feedback text,
  graded_by_membership_id uuid references public.membership(id)
);

-- ----------------------------------------------------------------------------
-- 8. MODULE: TRANSPORT (worked example, matches module contract §6)
-- ----------------------------------------------------------------------------

create table public.vehicle (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  registration_no text not null,
  capacity int
);

create table public.transport_driver (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  user_id uuid references public.profile(id),
  name text not null,
  license_no text
);

create table public.transport_route (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  name text not null,
  vehicle_id uuid references public.vehicle(id),
  driver_id uuid references public.transport_driver(id)
);

create table public.transport_stop (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  name text not null,
  latitude numeric,
  longitude numeric
);

create table public.transport_route_stop (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  route_id uuid not null references public.transport_route(id) on delete cascade,
  stop_id uuid not null references public.transport_stop(id) on delete cascade,
  sequence int not null
);

create table public.student_transport_assignment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  route_id uuid not null references public.transport_route(id) on delete cascade,
  stop_id uuid not null references public.transport_stop(id)
);

-- ----------------------------------------------------------------------------
-- 9. INDEXES — every FK gets one; institution_id gets one on every tenant table
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
  tenant_tables text[] := array[
    'institution_module','campus','academic_year','role_permission','membership',
    'membership_scope','event','audit_log','student','guardian','student_guardian',
    'class','section','subject','class_subject_teacher','enrollment','attendance',
    'exam','mark','notice','fee_invoice','payment','assignment','assignment_attachment',
    'assignment_submission','assignment_grade','vehicle','transport_driver',
    'transport_route','transport_stop','transport_route_stop','student_transport_assignment'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('create index if not exists idx_%s_institution_id on public.%I (institution_id);', t, t);
  end loop;
end $$;

-- role_permission and dashboard_layout can additionally hold NULL
-- institution_id (platform-default rows); the generic index above still
-- covers them, this just documents why they're excluded from the NOT NULL
-- assumption baked into the loop's naming.

create index idx_membership_user_id on public.membership (user_id);
create index idx_dashboard_layout_scope on public.dashboard_layout (scope_type, scope_id);
create index idx_enrollment_student on public.enrollment (student_id);
create index idx_attendance_date on public.attendance (institution_id, date);

-- ----------------------------------------------------------------------------
-- 10. ROW-LEVEL SECURITY — tenant isolation (second line of defense; the
--     first line is permission+scope middleware in the backend, BEFORE the
--     query ever reaches Postgres — see backend-core doc §3)
-- ----------------------------------------------------------------------------

-- straightforward case: institution_id NOT NULL, single equality check
do $$
declare
  t text;
  tenant_tables text[] := array[
    'institution_module','campus','academic_year','membership',
    'membership_scope','event','audit_log','student','guardian','student_guardian',
    'class','section','subject','class_subject_teacher','enrollment','attendance',
    'exam','mark','notice','fee_invoice','payment','assignment','assignment_attachment',
    'assignment_submission','assignment_grade','vehicle','transport_driver',
    'transport_route','transport_stop','transport_route_stop','student_transport_assignment'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy tenant_isolation on public.%I using (institution_id = public.current_institution_id());',
      t
    );
  end loop;
end $$;

-- role_permission: same nullable-institution pattern as role/dashboard_layout —
-- platform-default role permissions (institution_id IS NULL) are readable by
-- everyone as templates
alter table public.role_permission enable row level security;
create policy tenant_isolation on public.role_permission
  using (institution_id = public.current_institution_id() or institution_id is null);

-- institution table itself: match on id, not institution_id
alter table public.institution enable row level security;
create policy tenant_isolation on public.institution
  using (id = public.current_institution_id());

-- role: institution-owned roles are tenant-isolated; platform-default roles
-- (institution_id IS NULL) are visible to everyone as read-only templates
alter table public.role enable row level security;
create policy tenant_isolation on public.role
  using (institution_id = public.current_institution_id() or institution_id is null);

-- dashboard_layout: same pattern as role — platform defaults are global
alter table public.dashboard_layout enable row level security;
create policy tenant_isolation on public.dashboard_layout
  using (institution_id = public.current_institution_id() or institution_id is null);

-- profile: users can always see their own profile regardless of institution
-- context (needed for login, switching institutions, etc.)
alter table public.profile enable row level security;
create policy own_profile on public.profile
  using (id = auth.uid());

-- platform catalog tables: readable by anyone (needed to build nav/dashboards),
-- writable only by the service role (module registration runs with elevated
-- privileges, never as a regular tenant request)
alter table public.module enable row level security;
create policy read_all on public.module for select using (true);

alter table public.permission enable row level security;
create policy read_all on public.permission for select using (true);

alter table public.widget enable row level security;
create policy read_all on public.widget for select using (true);

-- ============================================================================
-- Done. Your database is ready. Next: seed data below (optional but
-- recommended so you have something to develop against immediately).
-- ============================================================================
