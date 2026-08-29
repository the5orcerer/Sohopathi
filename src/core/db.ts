import { Pool, PoolClient } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let rlsInitialized = false;

export async function ensureTenantRLS(client: PoolClient, force = false): Promise<void> {
  if (rlsInitialized && !force) return;

  // Use advisory lock to prevent concurrent test runners from running DDL simultaneously
  await client.query(`SELECT pg_advisory_xact_lock(748291);`);

  const isCloudDb = env.DATABASE_URL.includes('supabase.co') || env.DATABASE_URL.includes('pooler.supabase.com');

  if (!isCloudDb) {
    await client.query(`
      do $$
      begin
        begin
          create role app_user with login password 'password' nosuperuser nobypassrls;
        exception
          when others then null;
        end;
        begin
          grant usage, create on schema auth to app_user;
          grant all on all tables in schema auth to app_user;
          grant all on all sequences in schema auth to app_user;
          grant all on all functions in schema auth to app_user;
          alter default privileges in schema auth grant all on tables to app_user;
          alter default privileges in schema auth grant all on sequences to app_user;
          alter default privileges in schema auth grant all on functions to app_user;

          grant usage, create on schema public to app_user;
          grant all on all tables in schema public to app_user;
          grant all on all sequences in schema public to app_user;
          grant all on all functions in schema public to app_user;
          alter default privileges in schema public grant all on tables to app_user;
          alter default privileges in schema public grant all on sequences to app_user;
          alter default privileges in schema public grant all on functions to app_user;
        exception
          when others then null;
        end;
      end $$;
    `);
  }

  await client.query(`
    -- Update institution tenant isolation policy to allow creation / lookup when current_institution_id is NULL
    drop policy if exists tenant_isolation on public.institution;
    create policy tenant_isolation on public.institution
      using (id = public.current_institution_id() or public.current_institution_id() is null)
      with check (true);

    -- Allow backend profile management
    drop policy if exists own_profile on public.profile;
    drop policy if exists all_profile on public.profile;
    create policy all_profile on public.profile using (true) with check (true);

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
  `);

  const standardTenantTables = [
    'institution_module','campus','academic_year','membership',
    'membership_scope','event','audit_log','student','guardian','student_guardian',
    'class','section','subject','class_subject_teacher','enrollment','attendance',
    'exam','mark','notice','notice_read_receipt','assignment','assignment_attachment',
    'assignment_submission','assignment_grade',
    'custom_field_definition','class_schedule','exam_paper',
    'notification','user_task','institution_setting','admission_application'
  ];

  const allTenantTables = [
    ...standardTenantTables,
    'institution','role','role_permission','dashboard_layout'
  ];

  for (const t of allTenantTables) {
    await client.query(`alter table public.${t} force row level security;`);
  }

  for (const t of standardTenantTables) {
    // Ensure standard tenant policy exists for standard tables with institution_id
    await client.query(`
      do $$
      begin
        if not exists (
          select 1 from pg_policies where schemaname = 'public' and tablename = '${t}' and policyname = 'tenant_isolation'
        ) then
          create policy tenant_isolation on public.${t} using (institution_id = public.current_institution_id());
        end if;
      exception
        when others then null;
      end $$;
    `);
  }

  // Ensure custom tenant policies for special tables
  await client.query(`
    do $$
    begin
      drop policy if exists tenant_isolation on public.institution;
      create policy tenant_isolation on public.institution
        using (id = public.current_institution_id() or public.current_institution_id() is null)
        with check (true);

      drop policy if exists tenant_isolation on public.role;
      create policy tenant_isolation on public.role
        using (institution_id = public.current_institution_id() or institution_id is null);

      drop policy if exists tenant_isolation on public.role_permission;
      create policy tenant_isolation on public.role_permission
        using (institution_id = public.current_institution_id() or institution_id is null);

      drop policy if exists tenant_isolation on public.dashboard_layout;
      create policy tenant_isolation on public.dashboard_layout
        using (institution_id = public.current_institution_id() or institution_id is null);
    exception
      when others then null;
    end $$;
  `);

  rlsInitialized = true;
}

/**
 * Runs `fn` inside a transaction with tenant context set for Postgres RLS.
 */
export async function withTenantContext<T>(
  institutionId: string | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const isCloudDb = env.DATABASE_URL.includes('supabase.co') || env.DATABASE_URL.includes('pooler.supabase.com');
    if (!isCloudDb) {
      try {
        await client.query(`SET LOCAL ROLE app_user`);
      } catch {}
    }
    if (institutionId) {
      if (!UUID_REGEX.test(institutionId)) {
        throw new Error(`Invalid institutionId format: ${institutionId}`);
      }
      // SET LOCAL is transaction-scoped — safe with transaction poolers
      await client.query(`SET LOCAL app.current_institution_id = '${institutionId}'`);
    } else {
      await client.query(`SET LOCAL app.current_institution_id = ''`);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
