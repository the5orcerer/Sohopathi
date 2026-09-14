import { pool } from '../src/core/db';
import { pino } from 'pino';

const logger = pino({ level: 'info' });

export async function runMigration() {
  logger.info('🚀 Starting Database Migration: Academic Pipeline, Rooms, Manager Hierarchy & Role Cleanup...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create classroom table
    logger.info('1. Ensuring public.classroom table exists...');
    await client.query(`
      create table if not exists public.classroom (
        id uuid primary key default gen_random_uuid(),
        institution_id uuid not null references public.institution(id) on delete cascade,
        room_number text not null,
        name text,
        building text,
        floor text,
        capacity int default 40,
        facilities text[] default '{}',
        status text not null default 'available',
        created_at timestamptz not null default now()
      );

      create unique index if not exists idx_classroom_inst_room on public.classroom (institution_id, lower(room_number));
      create index if not exists idx_classroom_inst on public.classroom (institution_id);
    `);

    // 2. Create schedule_substitution table
    logger.info('2. Ensuring public.schedule_substitution table exists...');
    await client.query(`
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
    `);

    // 3. Create member_request table
    logger.info('3. Ensuring public.member_request table exists...');
    await client.query(`
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
    `);

    // 4. Alter existing tables for manager hierarchy and room links
    logger.info('4. Adding manager hierarchy and room link columns...');
    await client.query(`
      alter table public.section
        add column if not exists class_teacher_membership_id uuid references public.membership(id) on delete set null;

      alter table public.membership
        add column if not exists manager_membership_id uuid references public.membership(id) on delete set null;

      alter table public.class_schedule
        add column if not exists room_id uuid references public.classroom(id) on delete set null;

      -- Grant app_user permissions on new tables
      grant all on all tables in schema public to app_user;
      grant all on all sequences in schema public to app_user;

      alter table public.classroom enable row level security;
      alter table public.classroom force row level security;
      drop policy if exists tenant_isolation on public.classroom;
      create policy tenant_isolation on public.classroom using (institution_id = public.current_institution_id());

      alter table public.schedule_substitution enable row level security;
      alter table public.schedule_substitution force row level security;
      drop policy if exists tenant_isolation on public.schedule_substitution;
      create policy tenant_isolation on public.schedule_substitution using (institution_id = public.current_institution_id());

      alter table public.member_request enable row level security;
      alter table public.member_request force row level security;
      drop policy if exists tenant_isolation on public.member_request;
      create policy tenant_isolation on public.member_request using (institution_id = public.current_institution_id());
    `);

    // 5. Deduplicate and Unify Roles
    logger.info('5. Deduplicating roles and unifying Student / Guardian...');
    
    // First, ensure system roles exist (institution_id is null)
    // Canonical system roles: 'Institution Admin', 'Teacher', 'Guardian' (unifying Student & Guardian as requested)
    await client.query(`
      insert into public.role (institution_id, name, is_system)
      values 
        (null, 'Institution Admin', true),
        (null, 'Teacher', true),
        (null, 'Guardian', true)
      on conflict do nothing;
    `);

    // Find the canonical system role IDs
    const { rows: sysRoles } = await client.query(`
      select id, lower(name) as name_lower from public.role where institution_id is null
    `);
    const sysRoleMap = new Map<string, string>();
    sysRoles.forEach((r) => sysRoleMap.set(r.name_lower, r.id));

    const canonicalAdminId = sysRoleMap.get('institution admin');
    const canonicalTeacherId = sysRoleMap.get('teacher');
    const canonicalGuardianId = sysRoleMap.get('guardian');

    logger.info({ canonicalAdminId, canonicalTeacherId, canonicalGuardianId }, 'Resolved canonical system roles');

    // Update memberships pointing to custom duplicate roles or 'Student' role
    // Any membership that has role 'student' or 'guardian' -> map to canonical Guardian role
    // Any membership that has role 'teacher' with is_system=false -> map to canonical Teacher role
    // Any membership that has role 'institution admin' with is_system=false -> map to canonical Institution Admin role

    if (canonicalGuardianId) {
      await client.query(`
        update public.membership
        set role_id = $1
        where role_id in (
          select id from public.role
          where lower(name) in ('student', 'guardian') and id <> $1
        )
      `, [canonicalGuardianId]);
    }

    if (canonicalTeacherId) {
      await client.query(`
        update public.membership
        set role_id = $1
        where role_id in (
          select id from public.role
          where lower(name) = 'teacher' and id <> $1
        )
      `, [canonicalTeacherId]);
    }

    if (canonicalAdminId) {
      await client.query(`
        update public.membership
        set role_id = $1
        where role_id in (
          select id from public.role
          where lower(name) in ('institution admin', 'admin') and id <> $1
        )
      `, [canonicalAdminId]);
    }

    // Now delete duplicate custom roles whose names match canonical system roles
    await client.query(`
      delete from public.role_permission
      where role_id in (
        select id from public.role
        where lower(name) in ('institution admin', 'admin', 'teacher', 'student', 'guardian')
          and institution_id is not null
      );

      delete from public.role
      where lower(name) in ('institution admin', 'admin', 'teacher', 'student', 'guardian')
        and institution_id is not null;
    `);

    // Also delete any dangling global Student role if exists, since Student and Guardian are unified to Guardian
    if (canonicalGuardianId) {
      await client.query(`
        delete from public.role_permission
        where role_id in (
          select id from public.role
          where lower(name) = 'student' and institution_id is null
        );

        delete from public.role
        where lower(name) = 'student' and institution_id is null;
      `);
    }

    // Ensure unique constraint on role (institution_id, name)
    logger.info('Creating unique index on role (institution_id, name)...');
    await client.query(`
      create unique index if not exists idx_role_institution_name_unique
      on public.role (coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
    `);

    // 6. Register New Permissions
    logger.info('6. Registering new permissions (reports.read, requests.*, classrooms.manage)...');
    await client.query(`
      with m as (select id from public.module where key = 'core')
      insert into public.permission (key, module_id, description, scope_options)
      select p.key, m.id, p.description, p.scope_options
      from (values
        ('reports.read', 'View institution analytics, attendance, and academic reports', array['institution', 'assigned_sections']),
        ('requests.create', 'Submit leave, break, or schedule change requests to manager', array['institution', 'assigned_sections', 'self']),
        ('requests.manage', 'Review and approve team and student requests', array['institution', 'assigned_sections']),
        ('classrooms.manage', 'Manage physical classrooms, capacities, and facilities', array['institution'])
      ) as p(key, description, scope_options)
      cross join m
      on conflict (key) do update set description = excluded.description, scope_options = excluded.scope_options;
    `);

    // 7. Grant permissions to canonical system roles
    logger.info('7. Granting permissions to canonical system roles...');
    
    // Institution Admin grants
    const adminGrants = [
      { key: 'reports.read', scope: 'institution' },
      { key: 'requests.create', scope: 'institution' },
      { key: 'requests.manage', scope: 'institution' },
      { key: 'classrooms.manage', scope: 'institution' },
      { key: 'schedules.manage', scope: 'institution' },
      { key: 'roles.manage', scope: 'institution' },
      { key: 'memberships.manage', scope: 'institution' },
      { key: 'settings.manage', scope: 'institution' },
    ];
    for (const g of adminGrants) {
      await client.query(`
        insert into public.role_permission (institution_id, role_id, permission_id, scope)
        select null, r.id, p.id, $2
        from public.role r
        cross join public.permission p
        where r.institution_id is null and lower(r.name) = 'institution admin' and p.key = $1
        on conflict (role_id, permission_id) do update set scope = excluded.scope;
      `, [g.key, g.scope]);
    }

    // Teacher grants
    const teacherGrants = [
      { key: 'reports.read', scope: 'assigned_sections' },
      { key: 'requests.create', scope: 'self' },
      { key: 'requests.manage', scope: 'assigned_sections' },
      { key: 'schedules.read', scope: 'assigned_sections' },
      { key: 'attendance.read', scope: 'assigned_sections' },
      { key: 'attendance.create', scope: 'assigned_sections' },
      { key: 'marks.read', scope: 'assigned_sections' },
      { key: 'marks.create', scope: 'assigned_sections' },
      { key: 'assignments.read', scope: 'assigned_sections' },
      { key: 'assignments.create', scope: 'assigned_sections' },
      { key: 'assignments.update', scope: 'assigned_sections' },
      { key: 'assignments.grade', scope: 'assigned_sections' },
      { key: 'tasks.read', scope: 'self' },
      { key: 'notices.read', scope: 'institution' },
    ];
    for (const g of teacherGrants) {
      await client.query(`
        insert into public.role_permission (institution_id, role_id, permission_id, scope)
        select null, r.id, p.id, $2
        from public.role r
        cross join public.permission p
        where r.institution_id is null and lower(r.name) = 'teacher' and p.key = $1
        on conflict (role_id, permission_id) do update set scope = excluded.scope;
      `, [g.key, g.scope]);
    }

    // Guardian (unified Student / Guardian) grants - strictly self scope
    const guardianGrants = [
      { key: 'requests.create', scope: 'self' },
      { key: 'schedules.read', scope: 'self' },
      { key: 'attendance.read', scope: 'self' },
      { key: 'marks.read', scope: 'self' },
      { key: 'assignments.read', scope: 'self' },
      { key: 'assignments.submit', scope: 'self' },
      { key: 'notices.read', scope: 'institution' },
    ];
    for (const g of guardianGrants) {
      await client.query(`
        insert into public.role_permission (institution_id, role_id, permission_id, scope)
        select null, r.id, p.id, $2
        from public.role r
        cross join public.permission p
        where r.institution_id is null and lower(r.name) = 'guardian' and p.key = $1
        on conflict (role_id, permission_id) do update set scope = excluded.scope;
      `, [g.key, g.scope]);
    }

    // Remove any accidental administrative / directory permissions from Guardian role
    await client.query(`
      delete from public.role_permission
      where role_id in (select id from public.role where lower(name) = 'guardian')
        and permission_id in (
          select id from public.permission where key in (
            'students.write', 'admissions.read', 'admissions.write',
            'classes.manage', 'sections.manage', 'roles.manage', 'memberships.manage',
            'reports.read', 'audit_logs.read', 'requests.manage', 'classrooms.manage'
          )
        );
    `);

    // 8. Seed sample classrooms for demo institutions (e.g. Room 4022)
    const { rows: institutions } = await client.query(`select id, name from public.institution`);
    for (const inst of institutions) {
      await client.query(`
        insert into public.classroom (institution_id, room_number, name, building, floor, capacity, facilities, status)
        values
          ($1, '4022', 'Smart Classroom 4022', 'Academic Complex', '4th Floor', 45, array['Projector', 'Air Conditioned', 'Whiteboard'], 'available'),
          ($1, '101', 'General Lecture Hall 101', 'Main Building', '1st Floor', 50, array['Whiteboard', 'Sound System'], 'available'),
          ($1, '204', 'Science Laboratory', 'Science Block', '2nd Floor', 35, array['Lab Equipment', 'Sink', 'Projector'], 'available'),
          ($1, '305', 'Computer Center', 'Tech Wing', '3rd Floor', 40, array['Computers', 'High Speed LAN', 'AC'], 'available')
        on conflict (institution_id, lower(room_number)) do update
        set name = excluded.name, building = excluded.building, capacity = excluded.capacity;
      `, [inst.id]);

      // Link classroom 4022 and 101 to existing schedules if they have room_no
      await client.query(`
        update public.class_schedule cs
        set room_id = c.id
        from public.classroom c
        where c.institution_id = cs.institution_id
          and lower(c.room_number) = lower(cs.room_no)
          and cs.institution_id = $1
      `, [inst.id]);
    }

    await client.query('COMMIT');
    logger.info('🎉 Database migration & role deduplication completed successfully!');
  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error({ err }, '❌ Migration failed');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => {
      logger.info('Finished');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
