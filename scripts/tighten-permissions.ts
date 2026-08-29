import { pool } from '../src/core/db';
import { pino } from 'pino';

const logger = pino({ level: 'info' });

async function tightenPermissions() {
  logger.info('Tightening permissions on connected database...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Remove students.read and admissions.read from Student and Guardian roles
    await client.query(`
      delete from public.role_permission
      where role_id in (
        select id from public.role where lower(name) in ('student', 'guardian')
      )
      and permission_id in (
        select id from public.permission where key in ('students.read', 'students.write', 'admissions.read', 'classes.manage', 'sections.manage')
      );
    `);

    // 2. Remove admissions.read from Teacher roles
    await client.query(`
      delete from public.role_permission
      where role_id in (
        select id from public.role where lower(name) = 'teacher'
      )
      and permission_id in (
        select id from public.permission where key in ('admissions.read', 'admissions.write', 'classes.manage', 'academic_years.manage', 'roles.manage', 'memberships.manage')
      );
    `);

    // 3. Ensure Teacher role permissions are set to assigned_sections
    const teacherPermissions = [
      'students.read',
      'schedules.read',
      'attendance.read',
      'attendance.create',
      'marks.read',
      'marks.create',
      'assignments.read',
      'assignments.create',
      'assignments.update',
      'assignments.delete',
      'assignments.grade',
    ];

    for (const key of teacherPermissions) {
      await client.query(`
        insert into public.role_permission (institution_id, role_id, permission_id, scope)
        select r.institution_id, r.id, p.id, 'assigned_sections'
        from public.role r
        cross join public.permission p
        where lower(r.name) = 'teacher' and p.key = $1
        on conflict (role_id, permission_id) do update set scope = 'assigned_sections';
      `, [key]);
    }

    // 4. Ensure Student role permissions are set to self (or institution for notices)
    const studentSelfPermissions = [
      'students.read',
      'schedules.read',
      'attendance.read',
      'marks.read',
      'assignments.read',
      'assignments.submit',
    ];

    for (const key of studentSelfPermissions) {
      await client.query(`
        insert into public.role_permission (institution_id, role_id, permission_id, scope)
        select r.institution_id, r.id, p.id, 'self'
        from public.role r
        cross join public.permission p
        where lower(r.name) = 'student' and p.key = $1
        on conflict (role_id, permission_id) do update set scope = 'self';
      `, [key]);
    }

    // 5. Notices read for everyone
    await client.query(`
      insert into public.role_permission (institution_id, role_id, permission_id, scope)
      select r.institution_id, r.id, p.id, 'institution'
      from public.role r
      cross join public.permission p
      where lower(r.name) in ('student', 'guardian', 'teacher') and p.key = 'notices.read'
      on conflict (role_id, permission_id) do update set scope = 'institution';
    `);

    await client.query('COMMIT');
    logger.info('Successfully tightened and synced all role permissions.');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Failed to tighten permissions');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

tightenPermissions();

