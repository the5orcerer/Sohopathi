import { pool, ensureTenantRLS } from './db';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { env } from './env';

export async function initializeDatabase(reset?: boolean) {
  const client = await pool.connect();
  try {
    logger.info('Connecting to PostgreSQL database...');

    const isCloudDb = env.DATABASE_URL.includes('supabase.co') || env.DATABASE_URL.includes('pooler.supabase.com');
    const shouldReset = reset ?? (!isCloudDb && !process.argv.includes('--no-reset'));

    if (shouldReset && !isCloudDb) {
      logger.info('Resetting public and auth schemas for clean init...');
      await client.query(`
        drop schema if exists public cascade;
        create schema public;
        grant all on schema public to postgres;
        grant all on schema public to public;

        drop schema if exists auth cascade;
        create schema auth;
        grant all on schema auth to postgres;
        grant all on schema auth to public;
      `);
    }

    // 1. Setup extensions and auth schema (skip on Supabase cloud where auth schema is managed)
    if (!isCloudDb) {
      await client.query(`
        create extension if not exists "pgcrypto";

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
      `);
    } else {
      await client.query(`create extension if not exists "pgcrypto";`);
    }

    // 2. Read and apply canonical schema if available
    const schemaPath = path.join(__dirname, '../../instruction_set/education-platform-schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      logger.info('Applying canonical database schema...');
      await client.query(schemaSql);
    }

    // 2b. Add additional columns for onboarding & institution-scoped authentication and ensure RLS schema
    await client.query(`
      alter table public.profile 
        add column if not exists must_change_password boolean not null default false,
        add column if not exists password_hash text;

      alter table public.membership 
        add column if not exists login_username text,
        add column if not exists invite_status text not null default 'active';

      create unique index if not exists idx_membership_inst_username 
        on public.membership (institution_id, lower(login_username)) 
        where login_username is not null;
    `);

    await ensureTenantRLS(client, true);

    // 3. Upsert Active Core Modules
    logger.info('Registering platform modules...');
    await client.query(`
      insert into public.module (key, name, version) values
        ('onboarding', 'Institution Onboarding', '1.0.0'),
        ('system', 'System / Dashboard', '1.0.0'),
        ('core', 'Core / Academic & Administration', '1.0.0'),
        ('attendance', 'Attendance & Marks', '1.0.0'),
        ('notices', 'Notices & Circulars', '1.0.0'),
        ('assignments', 'Assignments & Homework', '1.0.0'),
        ('admissions', 'Admissions & Inquiries', '1.0.0')
      on conflict (key) do update set name = excluded.name;
    `);

    // 4. Upsert Granular Field Permissions
    logger.info('Registering granular field permissions...');
    const permissions = [
      ['institution.manage', 'core', 'Manage institution settings and campuses', ['institution']],
      ['roles.manage', 'core', 'Create roles and manage permission matrix', ['institution']],
      ['memberships.manage', 'core', 'Invite employees and manage staff', ['institution']],
      ['academic_years.manage', 'core', 'Configure academic years and sessions', ['institution']],
      ['classes.manage', 'core', 'Manage classes, grades, and levels', ['institution']],
      ['sections.manage', 'core', 'Manage section divisions and capacities', ['institution']],
      ['subjects.manage', 'core', 'Manage curriculum subjects and course codes', ['institution']],
      ['teachers.assign', 'core', 'Assign teachers to subjects and class sections', ['institution']],
      ['schedules.manage', 'core', 'Configure class timetables and period slots', ['institution']],
      ['schedules.read', 'core', 'View class schedules and timetables', ['institution', 'assigned_sections', 'self']],
      ['custom_fields.manage', 'core', 'Configure dynamic custom fields for students and staff', ['institution']],
      ['audit_logs.read', 'core', 'View administrative activity logs and changelogs', ['institution']],
      ['tasks.manage', 'core', 'Assign and manage staff tasks and work orders', ['institution', 'assigned_sections']],
      ['tasks.read', 'core', 'View and complete assigned tasks', ['institution', 'assigned_sections', 'self']],
      ['settings.manage', 'core', 'Configure institution profile, branding, and feature toggles', ['institution']],
      ['students.read', 'core', 'View student directory and profiles', ['institution', 'assigned_sections', 'self']],
      ['students.write', 'core', 'Create, enroll, and edit student records', ['institution']],
      ['attendance.read', 'attendance', 'View student attendance records', ['institution', 'assigned_sections', 'self']],
      ['attendance.create', 'attendance', 'Record daily attendance for sections', ['assigned_sections', 'institution']],
      ['exams.manage', 'attendance', 'Create and configure examination sessions and paper schedules', ['institution']],
      ['marks.read', 'attendance', 'View student examination marks and grades', ['institution', 'assigned_sections', 'self']],
      ['marks.create', 'attendance', 'Enter marks for examinations', ['assigned_sections', 'institution']],
      ['marks.approve', 'attendance', 'Approve and publish term exam marks', ['institution']],
      ['assignments.read', 'assignments', 'View assignments and submissions', ['institution', 'assigned_sections', 'self']],
      ['assignments.create', 'assignments', 'Create assignments and homework', ['assigned_sections', 'institution']],
      ['assignments.update', 'assignments', 'Edit assignments and attachments', ['assigned_sections', 'self']],
      ['assignments.delete', 'assignments', 'Delete assignments', ['assigned_sections', 'institution']],
      ['assignments.submit', 'assignments', 'Submit assignment deliverables', ['self']],
      ['assignments.grade', 'assignments', 'Grade student submissions and provide feedback', ['assigned_sections', 'institution']],
      ['notices.read', 'notices', 'View campus notices and circulars', ['institution', 'self']],
      ['notices.write', 'notices', 'Publish and manage campus announcements', ['institution']],
      ['admissions.read', 'admissions', 'View admission applications and pipeline metrics', ['institution', 'assigned_sections', 'self']],
      ['admissions.write', 'admissions', 'Submit, review, and update admission applications', ['institution']],
      ['admissions.approve', 'admissions', 'Approve admission applications and enroll students', ['institution']],
    ];

    for (const [key, moduleKey, desc, scopes] of permissions) {
      await client.query(
        `insert into public.permission (key, module_id, description, scope_options)
         values ($1, (select id from public.module where key = $2), $3, $4)
         on conflict (key) do update set description = excluded.description, scope_options = excluded.scope_options`,
        [key, moduleKey, desc, scopes]
      );
    }

    // 5. Platform-Default Template Roles (institution_id = NULL)
    logger.info('Seeding platform-default template roles...');
    const templateRoles = [
      'Institution Admin',
      'Teacher',
      'Student',
      'Guardian',
    ];

    for (const r of templateRoles) {
      await client.query(
        `insert into public.role (institution_id, name, is_system)
         values (null, $1, true)
         on conflict do nothing`,
        [r]
      );
    }

    // 6. Template Role Permissions Mapping
    const templateRoleGrants: Record<string, Array<{ key: string; scope: string }>> = {
      'Institution Admin': [
        { key: 'institution.manage', scope: 'institution' },
        { key: 'roles.manage', scope: 'institution' },
        { key: 'memberships.manage', scope: 'institution' },
        { key: 'academic_years.manage', scope: 'institution' },
        { key: 'classes.manage', scope: 'institution' },
        { key: 'sections.manage', scope: 'institution' },
        { key: 'subjects.manage', scope: 'institution' },
        { key: 'teachers.assign', scope: 'institution' },
        { key: 'schedules.manage', scope: 'institution' },
        { key: 'schedules.read', scope: 'institution' },
        { key: 'tasks.manage', scope: 'institution' },
        { key: 'tasks.read', scope: 'institution' },
        { key: 'settings.manage', scope: 'institution' },
        { key: 'custom_fields.manage', scope: 'institution' },
        { key: 'audit_logs.read', scope: 'institution' },
        { key: 'students.read', scope: 'institution' },
        { key: 'students.write', scope: 'institution' },
        { key: 'attendance.read', scope: 'institution' },
        { key: 'attendance.create', scope: 'institution' },
        { key: 'exams.manage', scope: 'institution' },
        { key: 'marks.read', scope: 'institution' },
        { key: 'marks.create', scope: 'institution' },
        { key: 'marks.approve', scope: 'institution' },
        { key: 'assignments.read', scope: 'institution' },
        { key: 'assignments.create', scope: 'institution' },
        { key: 'assignments.update', scope: 'institution' },
        { key: 'assignments.delete', scope: 'institution' },
        { key: 'assignments.grade', scope: 'institution' },
        { key: 'notices.read', scope: 'institution' },
        { key: 'notices.write', scope: 'institution' },
        { key: 'admissions.read', scope: 'institution' },
        { key: 'admissions.write', scope: 'institution' },
        { key: 'admissions.approve', scope: 'institution' },
      ],
      Teacher: [
        { key: 'students.read', scope: 'assigned_sections' },
        { key: 'schedules.read', scope: 'assigned_sections' },
        { key: 'tasks.read', scope: 'self' },
        { key: 'attendance.read', scope: 'assigned_sections' },
        { key: 'attendance.create', scope: 'assigned_sections' },
        { key: 'marks.read', scope: 'assigned_sections' },
        { key: 'marks.create', scope: 'assigned_sections' },
        { key: 'assignments.read', scope: 'assigned_sections' },
        { key: 'assignments.create', scope: 'assigned_sections' },
        { key: 'assignments.update', scope: 'assigned_sections' },
        { key: 'assignments.delete', scope: 'assigned_sections' },
        { key: 'assignments.grade', scope: 'assigned_sections' },
        { key: 'notices.read', scope: 'institution' },
      ],
      Student: [
        { key: 'schedules.read', scope: 'self' },
        { key: 'attendance.read', scope: 'self' },
        { key: 'marks.read', scope: 'self' },
        { key: 'assignments.read', scope: 'self' },
        { key: 'assignments.submit', scope: 'self' },
        { key: 'notices.read', scope: 'institution' },
      ],
      Guardian: [
        { key: 'schedules.read', scope: 'self' },
        { key: 'attendance.read', scope: 'self' },
        { key: 'marks.read', scope: 'self' },
        { key: 'assignments.read', scope: 'self' },
        { key: 'notices.read', scope: 'institution' },
      ],
    };

    for (const [roleName, grants] of Object.entries(templateRoleGrants)) {
      const { rows: [tRole] } = await client.query(
        `select id from public.role where institution_id is null and name = $1`,
        [roleName]
      );
      if (tRole) {
        for (const g of grants) {
          await client.query(
            `insert into public.role_permission (institution_id, role_id, permission_id, scope)
             values (null, $1, (select id from public.permission where key = $2), $3)
             on conflict (role_id, permission_id) do update set scope = excluded.scope`,
            [tRole.id, g.key, g.scope]
          );
        }
      }
    }

    // 7. Seed Initial Demo Institution
    logger.info('Provisioning initial institution and cloning roles...');
    const instId = 'f2c10000-0000-0000-0000-000000000001';
    await client.query(`
      insert into public.institution (id, name, subdomain, branding)
      values ('${instId}', 'Dhaka Model International Academy', 'dhakamodel', '{"primaryColor":"#1E5F5B","accentColor":"#E3A008"}')
      on conflict (id) do update set name = excluded.name, subdomain = excluded.subdomain;

      insert into public.institution_module (institution_id, module_id, enabled)
      select '${instId}', id, true from public.module
      on conflict (institution_id, module_id) do update set enabled = true;
    `);

    // 8. Clone Template Roles into Institution Roles + Add "Academic Coordinator"
    const institutionRolesToCreate = [
      { name: 'Institution Admin', isSystem: true },
      { name: 'Academic Coordinator', isSystem: false },
      { name: 'Teacher', isSystem: true },
      { name: 'Student', isSystem: true },
      { name: 'Guardian', isSystem: true },
    ];

    for (const r of institutionRolesToCreate) {
      await client.query(
        `insert into public.role (institution_id, name, is_system)
         values ($1, $2, $3)
         on conflict do nothing`,
        [instId, r.name, r.isSystem]
      );
    }

    // Assign grants to institution roles
    const instRoleGrants: Record<string, Array<{ key: string; scope: string }>> = {
      'Institution Admin': templateRoleGrants['Institution Admin'],
      'Academic Coordinator': [
        { key: 'academic_years.manage', scope: 'institution' },
        { key: 'classes.manage', scope: 'institution' },
        { key: 'sections.manage', scope: 'institution' },
        { key: 'subjects.manage', scope: 'institution' },
        { key: 'teachers.assign', scope: 'institution' },
        { key: 'schedules.manage', scope: 'institution' },
        { key: 'schedules.read', scope: 'institution' },
        { key: 'tasks.manage', scope: 'institution' },
        { key: 'tasks.read', scope: 'institution' },
        { key: 'settings.manage', scope: 'institution' },
        { key: 'custom_fields.manage', scope: 'institution' },
        { key: 'audit_logs.read', scope: 'institution' },
        { key: 'students.read', scope: 'institution' },
        { key: 'students.write', scope: 'institution' },
        { key: 'attendance.read', scope: 'institution' },
        { key: 'attendance.create', scope: 'institution' },
        { key: 'exams.manage', scope: 'institution' },
        { key: 'marks.read', scope: 'institution' },
        { key: 'marks.create', scope: 'institution' },
        { key: 'marks.approve', scope: 'institution' },
        { key: 'assignments.read', scope: 'institution' },
        { key: 'assignments.create', scope: 'institution' },
        { key: 'assignments.update', scope: 'institution' },
        { key: 'assignments.delete', scope: 'institution' },
        { key: 'assignments.grade', scope: 'institution' },
        { key: 'notices.read', scope: 'institution' },
        { key: 'notices.write', scope: 'institution' },
        { key: 'admissions.read', scope: 'institution' },
        { key: 'admissions.write', scope: 'institution' },
        { key: 'admissions.approve', scope: 'institution' },
      ],
      Teacher: templateRoleGrants['Teacher'],
      Student: templateRoleGrants['Student'],
      Guardian: templateRoleGrants['Guardian'],
    };

    for (const [roleName, grants] of Object.entries(instRoleGrants)) {
      const { rows: [instRole] } = await client.query(
        `select id from public.role where institution_id = $1 and name = $2`,
        [instId, roleName]
      );
      if (instRole) {
        for (const g of grants) {
          await client.query(
            `insert into public.role_permission (institution_id, role_id, permission_id, scope)
             values ($1, $2, (select id from public.permission where key = $3), $4)
             on conflict (role_id, permission_id) do update set scope = excluded.scope`,
            [instId, instRole.id, g.key, g.scope]
          );
        }
      }
    }

    // 9. Users, Profiles, and Memberships with login_username & default passwords
    const demoPersonas = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Dr. Shahriar Hossain',
        email: 'admin@dhakamodel.edu',
        username: 'admin',
        role: 'Institution Admin',
        password: 'password123',
        mustChangePassword: false,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Nusrat Jahan',
        email: 'coordinator@dhakamodel.edu',
        username: 'coordinator',
        role: 'Academic Coordinator',
        password: 'password123',
        mustChangePassword: false,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Rafiqul Islam',
        email: 'teacher@dhakamodel.edu',
        username: 'teacher',
        role: 'Teacher',
        password: 'password123',
        mustChangePassword: false,
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        name: 'Tahmid Rahman',
        email: 'student@dhakamodel.edu',
        username: 'student',
        role: 'Student',
        password: 'changeme',
        mustChangePassword: false,
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        name: 'Amina Akter',
        email: 'amina@dhakamodel.edu',
        username: 'amina.akter',
        role: 'Student',
        password: 'changeme',
        mustChangePassword: true,
      },
    ];

    for (const u of demoPersonas) {
      await client.query(`
        insert into auth.users (id, email, raw_user_meta_data)
        values ('${u.id}', '${u.email}', '{"name":"${u.name}"}')
        on conflict (id) do update set email = excluded.email, raw_user_meta_data = excluded.raw_user_meta_data;

        insert into public.profile (id, name, phone, must_change_password, password_hash)
        values ('${u.id}', '${u.name}', '+880 1700-000000', ${u.mustChangePassword}, '${u.password}')
        on conflict (id) do update set name = excluded.name, password_hash = '${u.password}', must_change_password = ${u.mustChangePassword};

        insert into public.membership (user_id, institution_id, role_id, login_username, status, invite_status)
        values (
          '${u.id}',
          '${instId}',
          (select id from public.role where institution_id = '${instId}' and name = '${u.role}'),
          '${u.username}',
          'active',
          'active'
        )
        on conflict (user_id, institution_id) do update
        set role_id = (select id from public.role where institution_id = '${instId}' and name = '${u.role}'),
            login_username = '${u.username}';
      `);
    }

    // Also add tahmid.rahman alias/username lookup support
    await client.query(`
      update public.membership set login_username = 'tahmid.rahman'
      where user_id = '00000000-0000-0000-0000-000000000004' and institution_id = '${instId}';
    `);

    // 10. Academic Structure (Campuses, Years, Classes, Sections, Subjects, Assignments)
    logger.info('Seeding academic structure and student records...');
    await client.query(`
      SET LOCAL app.current_institution_id = '${instId}';

      insert into public.campus (institution_id, name, address)
      values ('${instId}', 'Main Campus - Dhanmondi', 'Road 27, Dhanmondi, Dhaka')
      on conflict do nothing;

      insert into public.academic_year (id, institution_id, label, start_date, end_date, is_current)
      values ('10000000-0000-0000-0000-000000000001', '${instId}', '2026-2027', '2026-01-01', '2026-12-31', true)
      on conflict (id) do nothing;

      insert into public.class (id, institution_id, academic_year_id, name, sort_order)
      values
        ('20000000-0000-0000-0000-000000000001', '${instId}', '10000000-0000-0000-0000-000000000001', 'Grade 10', 10),
        ('20000000-0000-0000-0000-000000000002', '${instId}', '10000000-0000-0000-0000-000000000001', 'Grade 9', 9)
      on conflict (id) do nothing;

      insert into public.section (id, institution_id, class_id, name, capacity)
      values
        ('30000000-0000-0000-0000-000000000001', '${instId}', '20000000-0000-0000-0000-000000000001', 'Section A - Science', 45),
        ('30000000-0000-0000-0000-000000000002', '${instId}', '20000000-0000-0000-0000-000000000001', 'Section B - Commerce', 40)
      on conflict (id) do nothing;

      insert into public.subject (id, institution_id, name, code)
      values
        ('40000000-0000-0000-0000-000000000001', '${instId}', 'Physics', 'PHY-101'),
        ('40000000-0000-0000-0000-000000000002', '${instId}', 'Higher Mathematics', 'MATH-102'),
        ('40000000-0000-0000-0000-000000000003', '${instId}', 'English Literature', 'ENG-103')
      on conflict (id) do nothing;

      -- Assign teacher to Section A - Physics
      insert into public.class_subject_teacher (institution_id, section_id, subject_id, teacher_membership_id)
      values (
        '${instId}',
        '30000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000003')
      ) on conflict do nothing;

      -- Seed Student (Tahmid Rahman)
      insert into public.student (id, institution_id, user_id, admission_no, name, date_of_birth, gender, status)
      values ('50000000-0000-0000-0000-000000000001', '${instId}', '00000000-0000-0000-0000-000000000004', 'ADM-2026-001', 'Tahmid Rahman', '2010-05-14', 'Male', 'active')
      on conflict (institution_id, admission_no) do update set name = excluded.name, user_id = '00000000-0000-0000-0000-000000000004';

      -- Seed Student 2 (Amina Akter)
      insert into public.student (id, institution_id, user_id, admission_no, name, date_of_birth, gender, status)
      values ('50000000-0000-0000-0000-000000000002', '${instId}', '00000000-0000-0000-0000-000000000005', 'ADM-2026-002', 'Amina Akter', '2010-08-22', 'Female', 'active')
      on conflict (institution_id, admission_no) do update set name = excluded.name, user_id = '00000000-0000-0000-0000-000000000005';

      -- Enrollments
      insert into public.enrollment (institution_id, student_id, academic_year_id, class_id, section_id, roll_no, status)
      values
        ('${instId}', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '01', 'active'),
        ('${instId}', '50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '02', 'active')
      on conflict (student_id, academic_year_id) do nothing;

      -- Exam & Marks
      insert into public.exam (id, institution_id, academic_year_id, name, term)
      values ('e0000000-0000-0000-0000-000000000001', '${instId}', '10000000-0000-0000-0000-000000000001', 'Mid-Term Examination 2026', 'Term 1')
      on conflict (id) do nothing;

      insert into public.mark (institution_id, exam_id, student_id, subject_id, marks_obtained, max_marks, grade, recorded_by_membership_id)
      values (
        '${instId}',
        'e0000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        88,
        100,
        'A+',
        (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000003')
      ) on conflict (exam_id, student_id, subject_id) do nothing;

      -- Attendance
      insert into public.attendance (institution_id, student_id, section_id, date, status, recorded_by_membership_id)
      values
        ('${instId}', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date, 'present', (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000003')),
        ('${instId}', '50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', current_date, 'present', (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000003'))
      on conflict (student_id, date) do nothing;

      -- Notices
      insert into public.notice (institution_id, title, body, audience_scope, published_by_membership_id)
      values
        ('${instId}', 'Welcome to the New Academic Session 2026-2027', 'Classes have commenced for all grades. Students are advised to collect their curriculum schedules from their respective section coordinators.', 'institution', (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000001')),
        ('${instId}', 'Science Fair Abstract Submission Deadline', 'All Grade 9 and 10 students must submit their project abstracts by the upcoming Thursday.', 'institution', (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000002'))
      on conflict do nothing;

      -- Admissions Seed
      insert into public.admission_application (
        institution_id, application_no, academic_year_id, class_id,
        applicant_name, date_of_birth, gender, guardian_name, guardian_phone, guardian_email,
        previous_school, status, application_fee, fee_status, notes
      ) values
        ('${instId}', 'APP-2026-001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
         'Zubair Al Mahfuz', '2011-03-15', 'Male', 'Mahfuzur Rahman', '+880 1811-223344', 'mahfuz@gmail.com',
         'Dhanmondi Govt Boys High School', 'submitted', 500, 'paid', 'Transferred from previous city. Excellent academic records.'),
        ('${instId}', 'APP-2026-002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
         'Samia Faruk', '2010-09-10', 'Female', 'Faruk Ahmed', '+880 1912-334455', 'faruk.ahmed@yahoo.com',
         'Scholastica Senior Campus', 'under_review', 500, 'paid', 'Seeking admission into Science group with Higher Math.'),
        ('${instId}', 'APP-2026-003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
         'Tanvir Hassan', '2011-06-20', 'Male', 'Hassan Mahmud', '+880 1711-556677', 'hassan.m@gmail.com',
         'Viqarunnisa Noon School', 'shortlisted', 500, 'paid', 'Interview scheduled for upcoming Monday.');
    `);

    // Ensure RLS permissions for app_user
    await ensureTenantRLS(client, true);

    logger.info('Database initialized and seeded successfully with multi-tenant onboarding schema!');
  } finally {
    client.release();
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}
