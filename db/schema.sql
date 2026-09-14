-- ============================================================================
-- BIDDYAPITH CANONICAL PRODUCTION & LOCAL SCHEMA
-- Consolidated schema supporting Multi-Tenancy, Row-Level Security (RLS),
-- Modular RBAC, and granular operational domain models.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 0. SCHEMAS & HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_institution_id()
returns uuid language sql stable as $$
  select nullif(current_setting('app.current_institution_id', true), '')::uuid;
$$;

-- ----------------------------------------------------------------------------
-- 1. IDENTITY & PROFILES
-- ----------------------------------------------------------------------------

create table if not exists public.profile (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  avatar_url text,
  status text not null default 'active',
  must_change_password boolean not null default false,
  password_hash text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profile_updated_at on public.profile;
create trigger trg_profile_updated_at
  before update on public.profile
  for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profile (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 2. PLATFORM CATALOG (MODULES & PERMISSIONS)
-- ----------------------------------------------------------------------------

create table if not exists public.module (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  version text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.permission (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  module_id uuid not null references public.module(id) on delete cascade,
  description text,
  scope_options text[] not null default '{}'
);

create table if not exists public.widget (
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
-- 3. TENANCY, ROLES & MEMBERSHIP
-- ----------------------------------------------------------------------------

create table if not exists public.institution (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subdomain text unique not null,
  institute_code text unique,
  branding jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.institution_module (
  institution_id uuid not null references public.institution(id) on delete cascade,
  module_id uuid not null references public.module(id) on delete cascade,
  enabled boolean not null default true,
  primary key (institution_id, module_id)
);

create table if not exists public.campus (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  name text not null,
  address text
);

create table if not exists public.academic_year (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  label text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false
);

create table if not exists public.role (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institution(id) on delete cascade,
  name text not null,
  is_system boolean not null default false
);

create table if not exists public.role_permission (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institution(id) on delete cascade,
  role_id uuid not null references public.role(id) on delete cascade,
  permission_id uuid not null references public.permission(id) on delete cascade,
  scope text not null,
  unique (role_id, permission_id)
);

create table if not exists public.membership (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile(id) on delete cascade,
  institution_id uuid not null references public.institution(id) on delete cascade,
  role_id uuid not null references public.role(id),
  login_username text,
  invite_status text not null default 'active',
  status text not null default 'active',
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, institution_id)
);

create unique index if not exists idx_membership_inst_username
  on public.membership (institution_id, lower(login_username))
  where login_username is not null;

create table if not exists public.membership_scope (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  membership_id uuid not null references public.membership(id) on delete cascade,
  scope_type text not null check (scope_type in ('section', 'class', 'campus')),
  scope_id uuid not null
);

-- ----------------------------------------------------------------------------
-- 4. DASHBOARD, SYSTEM & LOGS
-- ----------------------------------------------------------------------------

create table if not exists public.dashboard_layout (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institution(id) on delete cascade,
  scope_type text not null check (scope_type in ('platform', 'institution', 'role', 'user')),
  scope_id uuid,
  widget_id uuid not null references public.widget(id) on delete cascade,
  x int not null,
  y int not null,
  width int not null,
  height int not null
);

create table if not exists public.event (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  actor_membership_id uuid references public.membership(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. ACADEMIC CORE (STUDENTS, CLASSES, SECTIONS)
-- ----------------------------------------------------------------------------

create table if not exists public.student (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  user_id uuid references public.profile(id),
  admission_no text not null,
  name text not null,
  date_of_birth date,
  gender text,
  status text not null default 'active',
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (institution_id, admission_no)
);

create table if not exists public.guardian (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  user_id uuid references public.profile(id),
  name text not null,
  phone text
);

create table if not exists public.student_guardian (
  institution_id uuid not null references public.institution(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  guardian_id uuid not null references public.guardian(id) on delete cascade,
  relation_type text,
  is_primary boolean not null default true,
  primary key (student_id, guardian_id)
);

create table if not exists public.class (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  academic_year_id uuid not null references public.academic_year(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table if not exists public.section (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  class_id uuid not null references public.class(id) on delete cascade,
  name text not null,
  capacity int
);

create table if not exists public.subject (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  name text not null,
  code text
);

create table if not exists public.class_subject_teacher (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  section_id uuid not null references public.section(id) on delete cascade,
  subject_id uuid not null references public.subject(id) on delete cascade,
  teacher_membership_id uuid not null references public.membership(id) on delete cascade
);

create table if not exists public.enrollment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  academic_year_id uuid not null references public.academic_year(id) on delete cascade,
  class_id uuid not null references public.class(id) on delete cascade,
  section_id uuid not null references public.section(id) on delete cascade,
  roll_no text,
  status text not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique (student_id, academic_year_id)
);

-- ----------------------------------------------------------------------------
-- 6. TIMETABLE & CLASS SCHEDULES
-- ----------------------------------------------------------------------------

create table if not exists public.class_schedule (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  section_id uuid not null references public.section(id) on delete cascade,
  subject_id uuid not null references public.subject(id) on delete cascade,
  teacher_membership_id uuid references public.membership(id) on delete set null,
  day_of_week text not null,
  start_time text not null,
  end_time text not null,
  room_no text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. ATTENDANCE & MARKS
-- ----------------------------------------------------------------------------

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  section_id uuid not null references public.section(id) on delete cascade,
  date date not null,
  status text not null,
  recorded_by_membership_id uuid references public.membership(id),
  session_type text not null default 'daily',
  period_number int not null default 1,
  subject_id uuid references public.subject(id) on delete set null,
  remarks text,
  unique (student_id, date, session_type, period_number)
);

create table if not exists public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  membership_id uuid not null references public.membership(id) on delete cascade,
  date date not null default current_date,
  status text not null default 'present',
  check_in_time text,
  check_out_time text,
  notes text,
  recorded_by_membership_id uuid references public.membership(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, membership_id, date)
);

create table if not exists public.exam (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  academic_year_id uuid not null references public.academic_year(id) on delete cascade,
  name text not null,
  term text,
  start_date date,
  end_date date,
  is_published boolean not null default false
);

create table if not exists public.exam_paper (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  exam_id uuid not null references public.exam(id) on delete cascade,
  subject_id uuid not null references public.subject(id) on delete cascade,
  exam_date date,
  start_time text,
  end_time text,
  room_no text,
  max_marks numeric not null default 100,
  pass_marks numeric not null default 40,
  theory_weight numeric default 70,
  practical_weight numeric default 30,
  viva_weight numeric default 0,
  created_at timestamptz not null default now(),
  unique (exam_id, subject_id)
);

create table if not exists public.mark (
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

-- ----------------------------------------------------------------------------
-- 8. NOTICES, TASKS & NOTIFICATIONS
-- ----------------------------------------------------------------------------

create table if not exists public.notice (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  title text not null,
  body text not null,
  audience_scope text not null default 'institution',
  published_by_membership_id uuid references public.membership(id),
  published_at timestamptz not null default now()
);

create table if not exists public.notice_read_receipt (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  notice_id uuid not null references public.notice(id) on delete cascade,
  membership_id uuid not null references public.membership(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (notice_id, membership_id)
);

create table if not exists public.notification (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  recipient_user_id uuid references public.profile(id) on delete cascade,
  recipient_membership_id uuid references public.membership(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'general',
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_task (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  creator_membership_id uuid references public.membership(id) on delete set null,
  assignee_membership_id uuid not null references public.membership(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium',
  due_date date,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9. FEES, INVOICES & PAYMENTS
-- ----------------------------------------------------------------------------

create table if not exists public.fee_invoice (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  academic_year_id uuid references public.academic_year(id) on delete set null,
  title text not null default 'Tuition Fee',
  amount numeric not null,
  due_date date not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.payment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  invoice_id uuid not null references public.fee_invoice(id) on delete cascade,
  amount numeric not null,
  payment_date date not null default current_date,
  method text,
  status text not null default 'completed'
);

-- ----------------------------------------------------------------------------
-- 10. ASSIGNMENTS & SUBMISSIONS
-- ----------------------------------------------------------------------------

create table if not exists public.assignment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  section_id uuid not null references public.section(id) on delete cascade,
  subject_id uuid not null references public.subject(id) on delete cascade,
  title text not null,
  description text,
  instructions text,
  due_date timestamptz,
  max_marks numeric not null default 100,
  status text not null default 'published' check (status in ('draft', 'published', 'closed')),
  allow_late_submissions boolean not null default false,
  created_by_membership_id uuid references public.membership(id),
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_attachment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  assignment_id uuid not null references public.assignment(id) on delete cascade,
  file_key text not null,
  file_name text not null
);

create table if not exists public.assignment_submission (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  assignment_id uuid not null references public.assignment(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  file_key text,
  file_url text,
  file_name text,
  file_size bigint,
  mime_type text,
  submission_notes text,
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('not_submitted', 'submitted', 'marked', 'reopened')),
  marks_obtained numeric,
  is_late boolean not null default false,
  reopened_at timestamptz,
  reopened_by_membership_id uuid references public.membership(id),
  reopen_reason text,
  unique (assignment_id, student_id)
);

create table if not exists public.assignment_grade (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  submission_id uuid not null references public.assignment_submission(id) on delete cascade unique,
  grade text,
  feedback text,
  marks_obtained numeric,
  graded_by_membership_id uuid references public.membership(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 11. TRANSPORT
-- ----------------------------------------------------------------------------

create table if not exists public.vehicle (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  registration_no text not null,
  capacity int
);

create table if not exists public.transport_driver (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  user_id uuid references public.profile(id),
  name text not null,
  license_no text
);

create table if not exists public.transport_route (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  name text not null,
  vehicle_id uuid references public.vehicle(id),
  driver_id uuid references public.transport_driver(id)
);

create table if not exists public.transport_stop (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  name text not null,
  latitude numeric,
  longitude numeric
);

create table if not exists public.transport_route_stop (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  route_id uuid not null references public.transport_route(id) on delete cascade,
  stop_id uuid not null references public.transport_stop(id) on delete cascade,
  sequence int not null
);

create table if not exists public.student_transport_assignment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  route_id uuid not null references public.transport_route(id) on delete cascade,
  stop_id uuid not null references public.transport_stop(id)
);

-- ----------------------------------------------------------------------------
-- 12. CUSTOM FIELDS, INSTITUTION SETTINGS, ADMISSIONS & SALES LEADS
-- ----------------------------------------------------------------------------

create table if not exists public.custom_field_definition (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  entity_type text not null,
  label text not null,
  field_key text not null,
  field_type text not null default 'text',
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (institution_id, entity_type, field_key)
);

create table if not exists public.institution_setting (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade unique,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.admission_application (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  application_no text not null,
  academic_year_id uuid references public.academic_year(id) on delete set null,
  class_id uuid references public.class(id) on delete set null,
  applicant_name text not null,
  date_of_birth date,
  gender text,
  guardian_name text not null,
  guardian_phone text not null,
  guardian_email text,
  guardian_relation text default 'Parent',
  address text,
  previous_school text,
  status text not null default 'submitted',
  application_fee numeric default 0,
  fee_status text default 'unpaid',
  notes text,
  reviewed_by_membership_id uuid references public.membership(id) on delete set null,
  admitted_student_id uuid references public.student(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, application_no)
);

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution_name text not null,
  email text not null,
  phone text not null,
  role text,
  student_count text,
  selected_plan text,
  message text,
  source text default 'website_landing',
  created_at timestamptz default now()
);

create table if not exists public.template (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institution(id) on delete cascade,
  type text not null check (type in ('tc', 'marksheet', 'certificate', 'testimonial', 'admit_card', 'id_card')),
  name text not null,
  description text,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_template_updated_at on public.template;
create trigger trg_template_updated_at
  before update on public.template
  for each row execute procedure public.set_updated_at();

create index if not exists idx_template_inst_type on public.template (institution_id, type);

-- ----------------------------------------------------------------------------
-- 13. INDEXES
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
  tenant_tables text[] := array[
    'institution_module','campus','academic_year','role_permission','membership',
    'membership_scope','event','audit_log','student','guardian','student_guardian',
    'class','section','subject','class_subject_teacher','enrollment','attendance',
    'exam','exam_paper','mark','notice','notice_read_receipt','fee_invoice','payment',
    'assignment','assignment_attachment','assignment_submission','assignment_grade',
    'vehicle','transport_driver','transport_route','transport_stop','transport_route_stop',
    'student_transport_assignment','class_schedule','employee_attendance',
    'custom_field_definition','notification','user_task','institution_setting',
    'admission_application','template'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('create index if not exists idx_%s_institution_id on public.%I (institution_id);', t, t);
  end loop;
end $$;

create index if not exists idx_membership_user_id on public.membership (user_id);
create index if not exists idx_dashboard_layout_scope on public.dashboard_layout (scope_type, scope_id);
create index if not exists idx_enrollment_student on public.enrollment (student_id);
create index if not exists idx_attendance_date on public.attendance (institution_id, date);
create index if not exists idx_employee_attendance_date on public.employee_attendance (institution_id, date);

-- ----------------------------------------------------------------------------
-- 14. ROW-LEVEL SECURITY & APP USER ROLE
-- ----------------------------------------------------------------------------

do $$
begin
  begin
    create role app_user with login password 'password' nosuperuser nobypassrls;
  exception
    when duplicate_object then null;
  end;
end $$;

grant all on schema public to app_user;
grant all on all tables in schema public to app_user;
grant all on all sequences in schema public to app_user;
grant all on all functions in schema public to app_user;

grant usage on schema auth to app_user;
grant all on all tables in schema auth to app_user;

do $$
declare
  t text;
  tenant_tables text[] := array[
    'institution_module','campus','academic_year','membership',
    'membership_scope','event','audit_log','student','guardian','student_guardian',
    'class','section','subject','class_subject_teacher','enrollment','attendance',
    'exam','exam_paper','mark','notice','notice_read_receipt','fee_invoice','payment',
    'assignment','assignment_attachment','assignment_submission','assignment_grade',
    'vehicle','transport_driver','transport_route','transport_stop','transport_route_stop',
    'student_transport_assignment','class_schedule','employee_attendance',
    'custom_field_definition','notification','user_task','institution_setting',
    'admission_application','template'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('drop policy if exists tenant_isolation on public.%I;', t);
    execute format(
      'create policy tenant_isolation on public.%I using (institution_id = public.current_institution_id());',
      t
    );
  end loop;
end $$;

alter table public.role_permission enable row level security;
alter table public.role_permission force row level security;
drop policy if exists tenant_isolation on public.role_permission;
create policy tenant_isolation on public.role_permission
  using (institution_id = public.current_institution_id() or institution_id is null);

alter table public.institution enable row level security;
alter table public.institution force row level security;
drop policy if exists tenant_isolation on public.institution;
create policy tenant_isolation on public.institution
  using (id = public.current_institution_id() or public.current_institution_id() is null)
  with check (true);

alter table public.role enable row level security;
alter table public.role force row level security;
drop policy if exists tenant_isolation on public.role;
create policy tenant_isolation on public.role
  using (institution_id = public.current_institution_id() or institution_id is null);

alter table public.dashboard_layout enable row level security;
alter table public.dashboard_layout force row level security;
drop policy if exists tenant_isolation on public.dashboard_layout;
create policy tenant_isolation on public.dashboard_layout
  using (institution_id = public.current_institution_id() or institution_id is null);

alter table public.profile enable row level security;
drop policy if exists own_profile on public.profile;
drop policy if exists all_profile on public.profile;
create policy all_profile on public.profile using (true) with check (true);

alter table public.module enable row level security;
drop policy if exists read_all on public.module;
create policy read_all on public.module for select using (true);

alter table public.permission enable row level security;
drop policy if exists read_all on public.permission;
create policy read_all on public.permission for select using (true);

alter table public.widget enable row level security;
drop policy if exists read_all on public.widget;
create policy read_all on public.widget for select using (true);

