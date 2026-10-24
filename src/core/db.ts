import { Pool, PoolClient } from 'pg';
import { env } from './env';

const cleanConnectionString = env.DATABASE_URL.replace(/[\?&]sslmode=[^&]+/, '');
const isLocal = env.DATABASE_URL.includes('127.0.0.1') || env.DATABASE_URL.includes('localhost');
const isAiven = env.DATABASE_URL.includes('aivencloud.com');
const maxPool = isAiven ? Math.min(env.PG_MAX_POOL, 8) : env.PG_MAX_POOL;

export const pool = new Pool({
  connectionString: cleanConnectionString,
  max: maxPool,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  maxUses: 7500,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let rlsInitialized = false;

export async function ensureTenantRLS(client: PoolClient): Promise<void> {
  if (rlsInitialized) return;

  // Use advisory lock to prevent concurrent test runners from running DDL simultaneously
  await client.query(`SELECT pg_advisory_xact_lock(748291);`);

  await client.query(`
    do $$
    begin
      begin
        create role app_user with login password 'password' nosuperuser nobypassrls;
      exception
        when duplicate_object then null;
      end;
      begin
        grant app_user to current_user;
      exception
        when others then null;
      end;
    end $$;
    grant all on schema public to app_user;
    grant all on all tables in schema public to app_user;
    grant all on all sequences in schema public to app_user;
    grant all on all functions in schema public to app_user;

    grant usage on schema auth to app_user;
    grant all on all tables in schema auth to app_user;

    -- Update institution tenant isolation policy to allow creation / lookup when current_institution_id is NULL
    do $$
    begin
      if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'institution' and policyname = 'tenant_isolation'
      ) then
        create policy tenant_isolation on public.institution
          using (id = public.current_institution_id() or public.current_institution_id() is null)
          with check (true);
      end if;

      if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'profile' and policyname = 'all_profile'
      ) then
        create policy all_profile on public.profile using (true) with check (true);
      end if;
    exception
      when others then null;
    end $$;

    -- Ensure profile has email, status, password_hash, must_change_password, and custom_fields
    alter table public.profile add column if not exists email text;
    alter table public.profile add column if not exists status text not null default 'active';
    alter table public.profile add column if not exists must_change_password boolean not null default false;
    alter table public.profile add column if not exists password_hash text;
    alter table public.profile add column if not exists custom_fields jsonb not null default '{}'::jsonb;

    -- Ensure membership has login_username, invite_status, and custom_fields
    alter table public.membership add column if not exists login_username text;
    alter table public.membership add column if not exists invite_status text not null default 'active';
    alter table public.membership add column if not exists custom_fields jsonb not null default '{}'::jsonb;
    create index if not exists idx_membership_inst_username on public.membership (institution_id, lower(login_username)) where login_username is not null;

    -- Ensure student has custom_fields
    alter table public.student add column if not exists custom_fields jsonb not null default '{}'::jsonb;

    -- Ensure fee_invoice schema has title and timestamps
    alter table public.fee_invoice add column if not exists title text not null default 'Tuition Fee';
    alter table public.fee_invoice add column if not exists created_at timestamptz not null default now();
    do $$
    begin
      alter table public.fee_invoice alter column academic_year_id drop not null;
    exception
      when others then null;
    end $$;

    -- 1. Custom Field Definition Catalog
    create table if not exists public.custom_field_definition (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institution(id) on delete cascade,
      entity_type text not null, -- 'student', 'member', 'class', 'section'
      label text not null,
      field_key text not null,
      field_type text not null default 'text', -- 'text', 'number', 'select', 'date', 'boolean', 'tag'
      options jsonb not null default '[]'::jsonb,
      is_required boolean not null default false,
      sort_order int not null default 0,
      created_at timestamptz not null default now(),
      unique (institution_id, entity_type, field_key)
    );

    -- 2. Class Timetable & Schedule Periods
    create table if not exists public.class_schedule (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institution(id) on delete cascade,
      section_id uuid not null references public.section(id) on delete cascade,
      subject_id uuid not null references public.subject(id) on delete cascade,
      teacher_membership_id uuid references public.membership(id) on delete set null,
      day_of_week text not null, -- 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
      start_time text not null,  -- e.g. '09:00'
      end_time text not null,    -- e.g. '09:45'
      room_no text,
      created_at timestamptz not null default now()
    );

    -- 3. Exam Schedule Papers & Mark Distributions
    alter table public.exam add column if not exists start_date date;
    alter table public.exam add column if not exists end_date date;
    alter table public.exam add column if not exists is_published boolean not null default false;

    -- Fix student_guardian columns
    alter table public.student_guardian add column if not exists relation_type text;
    alter table public.student_guardian add column if not exists is_primary boolean not null default true;

    -- Fix audit_log foreign key constraint to delete set null
    alter table public.audit_log drop constraint if exists audit_log_actor_membership_id_fkey;
    do $$ begin
      alter table public.audit_log add constraint audit_log_actor_membership_id_fkey foreign key (actor_membership_id) references public.membership(id) on delete set null;
    exception
      when others then null;
    end $$;

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

    create table if not exists public.exam_room_assignment (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institution(id) on delete cascade,
      exam_id uuid not null references public.exam(id) on delete cascade,
      paper_id uuid references public.exam_paper(id) on delete set null,
      room_number text not null,
      classroom_id uuid references public.classroom(id) on delete set null,
      guard_membership_ids uuid[] default array[]::uuid[],
      start_roll int,
      end_roll int,
      student_ids uuid[] default array[]::uuid[],
      created_at timestamptz not null default now()
    );

    -- 4. In-App & Push Notifications Table
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

    -- 5. User Task Management Table
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

    -- 6. Institution Configurable Settings Table
    create table if not exists public.institution_setting (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institution(id) on delete cascade unique,
      settings jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );

    -- 7. Admission Applications Table
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

    -- 8. Notice Read Receipts Table
    create table if not exists public.notice_read_receipt (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institution(id) on delete cascade,
      notice_id uuid not null references public.notice(id) on delete cascade,
      membership_id uuid not null references public.membership(id) on delete cascade,
      read_at timestamptz not null default now(),
      unique (notice_id, membership_id)
    );

    -- 9. Employee Attendance Table
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

    -- 10. Consolidate Guardian role into Student and ensure template roles
    do $$
    declare
      v_student_role_id uuid;
      v_guardian_role_id uuid;
    begin
      -- Ensure Student template role exists
      select id into v_student_role_id from public.role where lower(name) = 'student' and institution_id is null limit 1;
      if v_student_role_id is null then
        insert into public.role (institution_id, name, is_system)
        values (null, 'Student', true)
        returning id into v_student_role_id;
      end if;

      -- Ensure Staff template role exists
      if not exists (select 1 from public.role where lower(name) = 'staff' and institution_id is null) then
        insert into public.role (institution_id, name, is_system) values (null, 'Staff', true);
      end if;

      -- Ensure Teacher template role exists
      if not exists (select 1 from public.role where lower(name) = 'teacher' and institution_id is null) then
        insert into public.role (institution_id, name, is_system) values (null, 'Teacher', true);
      end if;

      -- Ensure Institution Admin template role exists
      if not exists (select 1 from public.role where lower(name) = 'institution admin' and institution_id is null) then
        insert into public.role (institution_id, name, is_system) values (null, 'Institution Admin', true);
      end if;

      -- Migrate any memberships from Guardian to Student
      for v_guardian_role_id in select id from public.role where lower(name) = 'guardian' loop
        update public.membership set role_id = v_student_role_id where role_id = v_guardian_role_id;
        delete from public.role_permission where role_id = v_guardian_role_id;
        delete from public.role where id = v_guardian_role_id;
      end loop;

      -- Ensure Student role has standard default permissions
      if v_student_role_id is not null then
        insert into public.role_permission (institution_id, role_id, permission_id, scope)
        select null, v_student_role_id, p.id, g.scope
        from (values
          ('students.read', 'self'),
          ('schedules.read', 'self'),
          ('attendance.read', 'self'),
          ('marks.read', 'self'),
          ('assignments.read', 'self'),
          ('assignments.submit', 'self'),
          ('notices.read', 'institution'),
          ('finance.read', 'self'),
          ('finance.payment', 'self'),
          ('tasks.read', 'self'),
          ('requests.create', 'self')
        ) as g(permission_key, scope)
        join public.permission p on p.key = g.permission_key
        on conflict (role_id, permission_id) do update set scope = excluded.scope;
      end if;
    end $$;

    -- 11. Institution EIIN Code
    alter table public.institution add column if not exists institute_code text;

    -- 12. Notice Audience Scopes and Granular Target Filters
    alter table public.notice add column if not exists target_roles text[] default '{}';
    alter table public.notice add column if not exists target_class_ids uuid[] default '{}';
    alter table public.notice add column if not exists target_section_ids uuid[] default '{}';
    alter table public.notice add column if not exists audience_filters jsonb default '{}'::jsonb;

    -- 13. Fee Invoice & Invoicing Extensions
    alter table public.fee_invoice add column if not exists invoice_number text;
    alter table public.fee_invoice add column if not exists recipient_type text not null default 'student';
    alter table public.fee_invoice add column if not exists employee_membership_id uuid references public.membership(id) on delete cascade;
    alter table public.fee_invoice add column if not exists category text not null default 'tuition';
    alter table public.fee_invoice add column if not exists description text;
    alter table public.fee_invoice add column if not exists total_amount numeric not null default 0;
    alter table public.fee_invoice add column if not exists discount_amount numeric not null default 0;
    alter table public.fee_invoice add column if not exists paid_amount numeric not null default 0;
    alter table public.fee_invoice add column if not exists items jsonb not null default '[]'::jsonb;
    alter table public.fee_invoice add column if not exists notes text;
    alter table public.fee_invoice add column if not exists created_by_membership_id uuid references public.membership(id) on delete set null;
    alter table public.fee_invoice add column if not exists updated_at timestamptz not null default now();
    do $$
    begin
      alter table public.fee_invoice alter column student_id drop not null;
    exception when others then null;
    end $$;
    update public.fee_invoice set total_amount = amount where total_amount = 0 and amount is not null;

    -- 14. Payment & Receipts Extensions
    alter table public.payment add column if not exists receipt_number text;
    alter table public.payment add column if not exists transaction_id text;
    alter table public.payment add column if not exists notes text;
    alter table public.payment add column if not exists recorded_by_membership_id uuid references public.membership(id) on delete set null;
    alter table public.payment add column if not exists created_at timestamptz not null default now();

    -- 15. Finance Module & Permissions
    insert into public.module (key, name, version) values ('finance', 'Finance & Invoicing', '1.0.0')
    on conflict (key) do update set name = excluded.name;

    with m as (select id from public.module where key = 'finance')
    insert into public.permission (key, module_id, description, scope_options)
    select p.key, m.id, p.description, p.scope_options
    from m, (values
      ('finance.read', 'View fee invoices, payments, and financial summaries', array['institution', 'assigned_sections', 'self']),
      ('finance.write', 'Create and manage student invoices and salary disbursements', array['institution']),
      ('finance.payment', 'Record fee and billing payments and generate receipts', array['institution']),
      ('finance.reports', 'View ledger reconciliation, collection metrics, and exports', array['institution'])
    ) as p(key, description, scope_options)
    on conflict (key) do update set description = excluded.description, scope_options = excluded.scope_options;

    -- Grant finance permissions to Institution Admin template role
    with admin_role as (
      select id from public.role where lower(name) in ('institution admin', 'admin') and institution_id is null limit 1
    ),
    perm as (
      select id from public.permission where key in ('finance.read', 'finance.write', 'finance.payment', 'finance.reports')
    )
    insert into public.role_permission (institution_id, role_id, permission_id, scope)
    select null, admin_role.id, perm.id, 'institution'
    from admin_role, perm
    on conflict (role_id, permission_id) do nothing;

    -- Grant finance.read self to Student template role
    with student_role as (
      select id from public.role where lower(name) = 'student' and institution_id is null limit 1
    ),
    perm as (
      select id from public.permission where key = 'finance.read'
    )
    insert into public.role_permission (institution_id, role_id, permission_id, scope)
    select null, student_role.id, perm.id, 'self'
    from student_role, perm
    on conflict (role_id, permission_id) do nothing;

    -- 16. Support Student Task Assignment in user_task
    alter table public.user_task alter column assignee_membership_id drop not null;
    alter table public.user_task add column if not exists assignee_student_id uuid references public.student(id) on delete cascade;
    create index if not exists idx_user_task_assignee_student on public.user_task (institution_id, assignee_student_id);

    -- 17. Classrooms
    create table if not exists public.classroom (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institution(id) on delete cascade,
      room_number text not null,
      capacity int default 40,
      building text,
      floor int,
      created_at timestamptz not null default now(),
      unique (institution_id, room_number)
    );

    -- 18. Schedule Substitutions
    create table if not exists public.schedule_substitution (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institution(id) on delete cascade,
      schedule_id uuid references public.class_schedule(id) on delete cascade,
      date date not null,
      original_teacher_membership_id uuid references public.membership(id) on delete set null,
      substitute_teacher_membership_id uuid references public.membership(id) on delete set null,
      room_id uuid references public.classroom(id) on delete set null,
      status text not null default 'substituted' check (status in ('substituted', 'cancelled', 'rescheduled')),
      reason text,
      recorded_by_membership_id uuid references public.membership(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (institution_id, schedule_id, date)
    );
    create index if not exists idx_sched_sub_inst_date on public.schedule_substitution (institution_id, date);

    -- 19. Member Requests (Universal for Staff & Students)
    create table if not exists public.member_request (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institution(id) on delete cascade,
      requester_membership_id uuid references public.membership(id) on delete cascade,
      requester_student_id uuid references public.student(id) on delete cascade,
      manager_membership_id uuid references public.membership(id) on delete set null,
      category text not null check (category in ('leave', 'break', 'schedule_change', 'resource', 'general')),
      title text not null,
      description text,
      start_date date,
      end_date date,
      status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
      reviewer_notes text,
      reviewed_at timestamptz,
      metadata jsonb default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_member_request_inst on public.member_request (institution_id, status);
    create index if not exists idx_member_request_manager on public.member_request (manager_membership_id);

    -- 20. Document Templates & Generated Documents
    create table if not exists public.template (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid references public.institution(id) on delete cascade,
      type text not null,
      context text not null default 'custom',
      name text not null,
      description text,
      content text not null,
      version int not null default 1,
      is_system boolean not null default false,
      is_default boolean not null default false,
      is_archived boolean not null default false,
      page_size text not null default 'A4',
      orientation text not null default 'portrait',
      margins jsonb default '{"top": "20mm", "bottom": "20mm", "left": "20mm", "right": "20mm"}'::jsonb,
      metadata jsonb default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    alter table public.template drop constraint if exists template_type_check;
    alter table public.template add column if not exists context text not null default 'custom';
    alter table public.template add column if not exists version int not null default 1;
    alter table public.template add column if not exists is_system boolean not null default false;
    alter table public.template add column if not exists is_default boolean not null default false;
    alter table public.template add column if not exists is_archived boolean not null default false;
    alter table public.template add column if not exists page_size text not null default 'A4';
    alter table public.template add column if not exists orientation text not null default 'portrait';
    alter table public.template add column if not exists margins jsonb default '{"top": "20mm", "bottom": "20mm", "left": "20mm", "right": "20mm"}'::jsonb;
    create index if not exists idx_template_inst_type on public.template (institution_id, type);
    create index if not exists idx_template_inst_context on public.template (institution_id, context);

    create table if not exists public.generated_document (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institution(id) on delete cascade,
      template_id uuid references public.template(id) on delete set null,
      template_version int not null default 1,
      document_type text not null,
      title text not null,
      entity_type text,
      entity_id uuid,
      rendered_content text not null,
      variables_snapshot jsonb not null default '{}'::jsonb,
      generated_by_membership_id uuid references public.membership(id) on delete set null,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_generated_doc_inst_entity on public.generated_document (institution_id, entity_type, entity_id);
    create index if not exists idx_generated_doc_template on public.generated_document (template_id);

    -- 21. Customizable Institutional Fee Policies & Structure
    create table if not exists public.fee_policy (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institution(id) on delete cascade,
      name text not null,
      description text,
      category text not null default 'Tuition Fee',
      amount numeric not null default 0,
      billing_cycle text not null default 'monthly',
      target_audience text not null default 'all_students',
      target_class_id uuid references public.class(id) on delete set null,
      target_section_id uuid references public.section(id) on delete set null,
      target_student_ids jsonb not null default '[]'::jsonb,
      is_active boolean not null default true,
      auto_apply_on_absence boolean not null default false,
      fine_per_day numeric default 0,
      due_days_after int not null default 15,
      created_by_membership_id uuid references public.membership(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_fee_policy_inst on public.fee_policy (institution_id);
    create index if not exists idx_fee_policy_class on public.fee_policy (target_class_id);

    -- 22. Ensure All System Permissions Exist in Catalog
    with core_m as (select id from public.module where key = 'core')
    insert into public.permission (key, module_id, description, scope_options)
    select p.key, coalesce(m.id, core_m.id), p.description, p.scope_options
    from (values
      ('requests.create', 'core', 'Submit leave, break, or schedule change requests', array['institution', 'assigned_sections', 'self']),
      ('requests.manage', 'core', 'Review and approve team and student requests', array['institution', 'assigned_sections']),
      ('templates.read', 'core', 'View document templates and generated certificates', array['institution', 'assigned_sections', 'self']),
      ('templates.manage', 'core', 'Create and edit document certificates and print templates', array['institution']),
      ('reports.read', 'core', 'View consolidated institutional reports and executive analytics', array['institution', 'assigned_sections', 'self']),
      ('attendance.employee.read', 'attendance', 'View employee and staff attendance records', array['institution', 'self']),
      ('attendance.employee.create', 'attendance', 'Record and manage daily employee attendance', array['institution', 'self'])
    ) as p(key, module_key, description, scope_options)
    cross join core_m
    left join public.module m on m.key = p.module_key
    on conflict (key) do update set description = excluded.description, scope_options = excluded.scope_options;

    -- Grant requests.create (self), tasks.read (self), finance.read (self), finance.payment (self) to Student & Guardian roles
    insert into public.role_permission (institution_id, role_id, permission_id, scope)
    select r.institution_id, r.id, p.id, 'self'
    from public.role r
    cross join public.permission p
    where p.key in ('requests.create', 'tasks.read', 'finance.read', 'finance.payment')
      and lower(r.name) in ('student', 'guardian')
    on conflict (role_id, permission_id) do nothing;

    -- Grant requests.create (self) and tasks.read (self) to Teacher roles
    insert into public.role_permission (institution_id, role_id, permission_id, scope)
    select r.institution_id, r.id, p.id, 'self'
    from public.role r
    cross join public.permission p
    where p.key in ('requests.create', 'tasks.read')
      and lower(r.name) = 'teacher'
    on conflict (role_id, permission_id) do nothing;

    -- Grant employee attendance read (self) to Teacher roles
    insert into public.role_permission (institution_id, role_id, permission_id, scope)
    select r.institution_id, r.id, p.id, 'self'
    from public.role r
    cross join public.permission p
    where p.key = 'attendance.employee.read'
      and lower(r.name) = 'teacher'
    on conflict (role_id, permission_id) do nothing;

    -- Grant all new permissions to Admin roles across all institutions
    insert into public.role_permission (institution_id, role_id, permission_id, scope)
    select r.institution_id, r.id, p.id, 'institution'
    from public.role r
    cross join public.permission p
    where lower(r.name) in ('institution admin', 'admin', 'principal')
      and p.key in ('requests.create', 'requests.manage', 'templates.read', 'templates.manage', 'reports.read', 'attendance.employee.read', 'attendance.employee.create')
    on conflict (role_id, permission_id) do nothing;
  `);

  await client.query(`
    grant all on all tables in schema public to app_user;
    grant all on all sequences in schema public to app_user;

    do $$
    declare
      t text;
      tenant_tables text[] := array[
        'institution_module','campus','academic_year','membership',
        'membership_scope','event','audit_log','student','guardian','student_guardian',
        'class','section','subject','class_subject_teacher','enrollment','attendance',
        'exam','mark','notice','fee_invoice','payment','assignment','assignment_attachment',
        'assignment_submission','assignment_grade','vehicle','transport_driver',
        'transport_route','transport_stop','transport_route_stop','student_transport_assignment',
        'role_permission','institution','role','dashboard_layout',
        'custom_field_definition','class_schedule','exam_paper',
        'notification','user_task','institution_setting',
        'admission_application','notice_read_receipt','employee_attendance',
        'classroom', 'schedule_substitution', 'member_request', 'template', 'generated_document', 'exam_room_assignment',
        'fee_policy'
      ];
    begin
      foreach t in array tenant_tables loop
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
          execute format('alter table public.%I force row level security;', t);
          
          if t = 'institution' then
            if not exists (
              select 1 from pg_policies where schemaname = 'public' and tablename = 'institution' and policyname = 'tenant_isolation'
            ) then
              create policy tenant_isolation on public.institution
                using (id = public.current_institution_id() or public.current_institution_id() is null)
                with check (true);
            end if;
          elsif t in ('role', 'role_permission', 'template', 'dashboard_layout') then
            if not exists (
              select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'tenant_isolation'
            ) then
              execute format('create policy tenant_isolation on public.%I using (institution_id = public.current_institution_id() or institution_id is null) with check (true);', t);
            end if;
          else
            if not exists (
              select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'tenant_isolation'
            ) then
              execute format('create policy tenant_isolation on public.%I using (institution_id = public.current_institution_id());', t);
            end if;
          end if;
        end if;
      end loop;
    end $$;
  `);

  // 10. Performance Composite Indexes for Supabase Compact Compute
  await client.query(`
    create index if not exists idx_notification_recipient_user_unread
      on public.notification (institution_id, recipient_user_id, is_read, created_at desc);

    create index if not exists idx_notification_recipient_member_unread
      on public.notification (institution_id, recipient_membership_id, is_read, created_at desc);

    create index if not exists idx_enrollment_sec_status
      on public.enrollment (section_id, status);

    create index if not exists idx_enrollment_cls_status
      on public.enrollment (class_id, status);

    create index if not exists idx_enrollment_ay_status
      on public.enrollment (academic_year_id, status);

    create index if not exists idx_attendance_inst_sec_date
      on public.attendance (institution_id, section_id, date);

    create index if not exists idx_attendance_student_date
      on public.attendance (student_id, date);

    create index if not exists idx_fee_invoice_inst_student_status
      on public.fee_invoice (institution_id, student_id, status);

    create index if not exists idx_fee_invoice_inst_category
      on public.fee_invoice (institution_id, category, status);

    create index if not exists idx_payment_inst_date
      on public.payment (institution_id, payment_date desc);

    create index if not exists idx_class_schedule_sec_day
      on public.class_schedule (section_id, day_of_week);

    create index if not exists idx_class_schedule_teacher_day
      on public.class_schedule (teacher_membership_id, day_of_week);

    create index if not exists idx_mark_exam_student
      on public.mark (exam_id, student_id);

    create index if not exists idx_student_guardian_guardian
      on public.student_guardian (guardian_id);
  `);

  rlsInitialized = true;
}

/**
 * Maintenance retention cleanup to keep Supabase Postgres well under the 500 MB Free Tier cap.
 * Safely purges:
 *  - read notifications older than 30 days
 *  - unread notifications older than 90 days
 *  - processed events older than 7 days
 */
export async function runStorageRetentionCleanup(client: PoolClient): Promise<{ deletedNotifications: number; deletedEvents: number }> {
  try {
    const notifRes = await client.query(`
      delete from public.notification
      where (is_read = true and created_at < now() - interval '30 days')
         or (created_at < now() - interval '90 days');
    `);

    const eventRes = await client.query(`
      delete from public.event
      where (processed_at is not null and occurred_at < now() - interval '7 days')
         or (occurred_at < now() - interval '30 days');
    `);

    return {
      deletedNotifications: notifRes.rowCount || 0,
      deletedEvents: eventRes.rowCount || 0,
    };
  } catch (err) {
    return { deletedNotifications: 0, deletedEvents: 0 };
  }
}

/**
 * Runs `fn` inside a transaction with tenant context set for Postgres RLS.
 */
export async function withTenantContext<T>(
  institutionId: string | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T>;
export async function withTenantContext<T>(
  poolOrClient: Pool | PoolClient,
  institutionId: string | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T>;
export async function withTenantContext<T>(
  arg1: Pool | PoolClient | string | null,
  arg2: string | null | ((client: PoolClient) => Promise<T>),
  arg3?: (client: PoolClient) => Promise<T>
): Promise<T> {
  let targetPoolOrClient: Pool | PoolClient = pool;
  let institutionId: string | null = null;
  let fn: (client: PoolClient) => Promise<T>;

  if (typeof arg2 === 'function') {
    institutionId = arg1 as string | null;
    fn = arg2;
  } else {
    targetPoolOrClient = (arg1 as Pool | PoolClient) || pool;
    institutionId = arg2 as string | null;
    fn = arg3!;
  }

  const isClient = typeof (targetPoolOrClient as any).release === 'function' && typeof (targetPoolOrClient as any).query === 'function';
  const client: PoolClient = isClient ? (targetPoolOrClient as PoolClient) : await (targetPoolOrClient as Pool).connect();

  try {
    if (institutionId) {
      if (!UUID_REGEX.test(institutionId)) {
        throw new Error(`Invalid institutionId format: ${institutionId}`);
      }
      // Combine transaction start and tenant context into a single network roundtrip
      await client.query(`BEGIN; SET LOCAL ROLE app_user; SET LOCAL app.current_institution_id = '${institutionId}';`);
    } else {
      await client.query('BEGIN');
    }
    const result = await fn(client);
    try {
      await client.query('COMMIT');
    } catch {
      // Ignore if already committed
    }
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (!isClient) {
      client.release();
    }
  }
}

