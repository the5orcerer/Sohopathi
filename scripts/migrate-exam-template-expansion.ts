import { pool } from '../src/core/db';
import { pino } from 'pino';

const logger = pino({ level: 'info' });

export async function runMigration() {
  logger.info('🚀 Starting Database Migration: Exam Architecture, Seating, Assignments & Document Templates...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Alter exam table
    logger.info('1. Updating public.exam table...');
    await client.query(`
      alter table public.exam add column if not exists exam_type text not null default 'term_exam';
      alter table public.exam add column if not exists exam_controller_membership_id uuid references public.membership(id) on delete set null;
      alter table public.exam add column if not exists class_id uuid references public.class(id) on delete set null;
      alter table public.exam add column if not exists section_id uuid references public.section(id) on delete set null;
      alter table public.exam add column if not exists syllabus_remarks text;
      alter table public.exam add column if not exists eligible_student_ids uuid[];
      
      create index if not exists idx_exam_controller on public.exam(institution_id, exam_controller_membership_id);
      create index if not exists idx_exam_class_sec on public.exam(institution_id, class_id, section_id);
    `);

    // 2. Alter exam_paper table
    logger.info('2. Updating public.exam_paper table...');
    await client.query(`
      alter table public.exam_paper add column if not exists teacher_membership_id uuid references public.membership(id) on delete set null;
      alter table public.exam_paper add column if not exists syllabus text;

      create index if not exists idx_exam_paper_teacher on public.exam_paper(institution_id, teacher_membership_id);
    `);

    // 3. Create exam_room_assignment table
    logger.info('3. Creating public.exam_room_assignment table...');
    await client.query(`
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

      create index if not exists idx_exam_room_inst_exam on public.exam_room_assignment(institution_id, exam_id);
    `);

    // 4. Alter mark table
    logger.info('4. Updating public.mark table...');
    await client.query(`
      alter table public.mark add column if not exists remarks text;
      alter table public.mark add column if not exists is_rechecked boolean not null default false;
      alter table public.mark add column if not exists rechecked_by_membership_id uuid references public.membership(id) on delete set null;
    `);

    // 5. Alter assignment_submission table
    logger.info('5. Updating public.assignment_submission table...');
    await client.query(`
      alter table public.assignment_submission add column if not exists submission_notes text;
      alter table public.assignment_submission add column if not exists file_url text;
    `);

    // 6. Ensure permissions in public.permission
    logger.info('6. Registering permissions in public.permission...');
    await client.query(`
      with m as (select id from public.module where key = 'core')
      insert into public.permission (key, module_id, description, scope_options)
      select p.key, m.id, p.description, p.scope_options
      from (values
        ('assignments.submission.read', 'View assignment submissions', array['institution', 'assigned_sections', 'self']),
        ('attendance.employee.read', 'View employee attendance records', array['institution', 'self']),
        ('attendance.employee.create', 'Record and manage employee attendance', array['institution', 'self']),
        ('users.impersonate', 'Impersonate institutional members for support and administration', array['institution'])
      ) as p(key, description, scope_options)
      cross join m
      on conflict (key) do update set description = excluded.description, scope_options = excluded.scope_options;
    `);

    // 7. Grant permissions to default roles:
    logger.info('7. Granting permissions to roles...');
    const grants = [
      { role: 'institution admin', key: 'assignments.submission.read', scope: 'institution' },
      { role: 'institution admin', key: 'users.impersonate', scope: 'institution' },
      { role: 'teacher', key: 'assignments.submission.read', scope: 'assigned_sections' },
      { role: 'teacher', key: 'attendance.employee.read', scope: 'self' },
      { role: 'teacher', key: 'attendance.employee.create', scope: 'self' },
      { role: 'guardian', key: 'assignments.submission.read', scope: 'self' },
    ];

    for (const g of grants) {
      await client.query(`
        insert into public.role_permission (institution_id, role_id, permission_id, scope)
        select null, r.id, p.id, $2
        from public.role r
        cross join public.permission p
        where r.institution_id is null and lower(r.name) = $3 and p.key = $1
        on conflict (role_id, permission_id) do update set scope = excluded.scope;
      `, [g.key, g.scope, g.role]);
    }

    // 8. Configure RLS and grants on app_user
    logger.info('8. Configuring RLS and granting app_user privileges...');
    await client.query(`
      grant all on public.exam_room_assignment to app_user;
      grant all on all tables in schema public to app_user;
      grant all on all sequences in schema public to app_user;

      alter table public.exam_room_assignment enable row level security;

      drop policy if exists exam_room_assignment_tenant_isolation on public.exam_room_assignment;
      create policy exam_room_assignment_tenant_isolation on public.exam_room_assignment
        for all using (
          institution_id = nullif(current_setting('app.current_institution_id', true), '')::uuid
        );
    `);

    await client.query('COMMIT');
    logger.info('✅ Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, '❌ Migration failed, rolled back!');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
