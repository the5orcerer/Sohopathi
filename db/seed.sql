-- ============================================================================
-- BIDDYAPITH SEED DATA
-- Populates active modules, permissions, default roles, demo institutions,
-- real demo users with passwords, academic structure, and initial data.
-- ============================================================================

-- 1. Modules
insert into public.module (key, name, version) values
  ('system', 'System / Dashboard', '1.0.0'),
  ('core', 'Core / Academic & Administration', '1.0.0'),
  ('attendance', 'Attendance & Marks', '1.0.0'),
  ('notices', 'Notices & Circulars', '1.0.0'),
  ('assignments', 'Assignments & Homework', '1.0.0'),
  ('admissions', 'Admissions & Inquiries', '1.0.0'),
  ('transport', 'Transport & Fleet', '1.0.0')
on conflict (key) do update set name = excluded.name;

-- 2. Permissions
with m as (select id, key from public.module)
insert into public.permission (key, module_id, description, scope_options)
select p.key, m.id, p.description, p.scope_options
from (values
  ('institution.manage', 'core', 'Manage institution settings and campuses', array['institution']),
  ('roles.manage', 'core', 'Create roles and manage permission matrix', array['institution']),
  ('memberships.manage', 'core', 'Invite employees and manage staff', array['institution']),
  ('academic_years.manage', 'core', 'Configure academic years and sessions', array['institution']),
  ('classes.manage', 'core', 'Manage classes, grades, and levels', array['institution']),
  ('sections.manage', 'core', 'Manage section divisions and capacities', array['institution']),
  ('subjects.manage', 'core', 'Manage curriculum subjects and course codes', array['institution']),
  ('teachers.assign', 'core', 'Assign teachers to subjects and class sections', array['institution']),
  ('schedules.manage', 'core', 'Configure class timetables and period slots', array['institution']),
  ('schedules.read', 'core', 'View class schedules and timetables', array['institution', 'assigned_sections', 'self']),
  ('custom_fields.manage', 'core', 'Configure dynamic custom fields for students and staff', array['institution']),
  ('audit_logs.read', 'core', 'View administrative activity logs and changelogs', array['institution']),
  ('tasks.manage', 'core', 'Assign and manage staff tasks and work orders', array['institution', 'assigned_sections']),
  ('tasks.read', 'core', 'View and complete assigned tasks', array['institution', 'assigned_sections', 'self']),
  ('settings.manage', 'core', 'Configure institution profile, branding, and feature toggles', array['institution']),
  ('students.read', 'core', 'View student directory and profiles', array['institution', 'assigned_sections', 'self']),
  ('students.write', 'core', 'Create, enroll, and edit student records', array['institution']),
  ('users.impersonate', 'core', 'Impersonate institutional members for support and administration', array['institution']),

  ('attendance.read', 'attendance', 'View student attendance records', array['institution', 'assigned_sections', 'self']),
  ('attendance.create', 'attendance', 'Record daily attendance for sections', array['assigned_sections', 'institution']),
  ('attendance.employee.read', 'attendance', 'View staff and employee attendance records', array['institution', 'self']),
  ('attendance.employee.create', 'attendance', 'Record daily staff and employee attendance', array['institution']),
  ('exams.manage', 'attendance', 'Create and configure examination sessions and paper schedules', array['institution']),
  ('marks.read', 'attendance', 'View student examination marks and grades', array['institution', 'assigned_sections', 'self']),
  ('marks.create', 'attendance', 'Enter marks for examinations', array['assigned_sections', 'institution']),
  ('marks.approve', 'attendance', 'Approve and publish term exam marks', array['institution']),

  ('assignments.read', 'assignments', 'View assignments and submissions', array['institution', 'assigned_sections', 'self']),
  ('assignments.create', 'assignments', 'Create assignments and homework', array['assigned_sections', 'institution']),
  ('assignments.update', 'assignments', 'Edit assignments and attachments', array['assigned_sections', 'self']),
  ('assignments.delete', 'assignments', 'Delete assignments', array['assigned_sections', 'institution']),
  ('assignments.submit', 'assignments', 'Submit assignment deliverables', array['self']),
  ('assignments.grade', 'assignments', 'Grade student submissions and provide feedback', array['assigned_sections', 'institution']),

  ('notices.read', 'notices', 'View campus notices and circulars', array['institution', 'self']),
  ('notices.write', 'notices', 'Publish and manage campus announcements', array['institution']),

  ('admissions.read', 'admissions', 'View admission applications and metrics', array['institution', 'assigned_sections', 'self']),
  ('admissions.write', 'admissions', 'Submit and update admission applications', array['institution']),
  ('admissions.approve', 'admissions', 'Approve admission applications and enroll students', array['institution']),

  ('transport.read', 'transport', 'View routes and transport vehicle information', array['institution', 'assigned_routes', 'self']),
  ('transport.manage', 'transport', 'Manage transport fleet and route stops', array['institution']),

  ('templates.read', 'core', 'View document templates and generated certificates', array['institution', 'assigned_sections', 'self']),
  ('templates.manage', 'core', 'Create and edit document certificates and print templates', array['institution'])
) as p(key, module_key, description, scope_options)
join m on m.key = p.module_key
on conflict (key) do update set description = excluded.description, scope_options = excluded.scope_options;

-- 3. Platform Template Roles
insert into public.role (institution_id, name, is_system) values
  (null, 'Institution Admin', true),
  (null, 'Teacher', true),
  (null, 'Student', true),
  (null, 'Guardian', true)
on conflict do nothing;

-- 4. Template Role Permissions
with r as (select id, name from public.role where institution_id is null),
     p as (select id, key from public.permission)
insert into public.role_permission (institution_id, role_id, permission_id, scope)
select null, r.id, p.id, g.scope
from (values
  ('Institution Admin', 'institution.manage', 'institution'),
  ('Institution Admin', 'roles.manage', 'institution'),
  ('Institution Admin', 'memberships.manage', 'institution'),
  ('Institution Admin', 'academic_years.manage', 'institution'),
  ('Institution Admin', 'classes.manage', 'institution'),
  ('Institution Admin', 'sections.manage', 'institution'),
  ('Institution Admin', 'subjects.manage', 'institution'),
  ('Institution Admin', 'teachers.assign', 'institution'),
  ('Institution Admin', 'schedules.manage', 'institution'),
  ('Institution Admin', 'schedules.read', 'institution'),
  ('Institution Admin', 'tasks.manage', 'institution'),
  ('Institution Admin', 'tasks.read', 'institution'),
  ('Institution Admin', 'settings.manage', 'institution'),
  ('Institution Admin', 'custom_fields.manage', 'institution'),
  ('Institution Admin', 'audit_logs.read', 'institution'),
  ('Institution Admin', 'students.read', 'institution'),
  ('Institution Admin', 'students.write', 'institution'),
  ('Institution Admin', 'users.impersonate', 'institution'),
  ('Institution Admin', 'attendance.read', 'institution'),
  ('Institution Admin', 'attendance.create', 'institution'),
  ('Institution Admin', 'attendance.employee.read', 'institution'),
  ('Institution Admin', 'attendance.employee.create', 'institution'),
  ('Institution Admin', 'exams.manage', 'institution'),
  ('Institution Admin', 'marks.read', 'institution'),
  ('Institution Admin', 'marks.create', 'institution'),
  ('Institution Admin', 'marks.approve', 'institution'),
  ('Institution Admin', 'assignments.read', 'institution'),
  ('Institution Admin', 'assignments.create', 'institution'),
  ('Institution Admin', 'assignments.update', 'institution'),
  ('Institution Admin', 'assignments.delete', 'institution'),
  ('Institution Admin', 'assignments.grade', 'institution'),
  ('Institution Admin', 'notices.read', 'institution'),
  ('Institution Admin', 'notices.write', 'institution'),
  ('Institution Admin', 'admissions.read', 'institution'),
  ('Institution Admin', 'admissions.write', 'institution'),
  ('Institution Admin', 'admissions.approve', 'institution'),
  ('Institution Admin', 'templates.read', 'institution'),
  ('Institution Admin', 'templates.manage', 'institution'),

  ('Teacher', 'students.read', 'assigned_sections'),
  ('Teacher', 'templates.read', 'assigned_sections'),
  ('Teacher', 'schedules.read', 'assigned_sections'),
  ('Teacher', 'tasks.read', 'self'),
  ('Teacher', 'attendance.read', 'assigned_sections'),
  ('Teacher', 'attendance.create', 'assigned_sections'),
  ('Teacher', 'marks.read', 'assigned_sections'),
  ('Teacher', 'marks.create', 'assigned_sections'),
  ('Teacher', 'assignments.read', 'assigned_sections'),
  ('Teacher', 'assignments.create', 'assigned_sections'),
  ('Teacher', 'assignments.update', 'assigned_sections'),
  ('Teacher', 'assignments.grade', 'assigned_sections'),
  ('Teacher', 'notices.read', 'institution'),

  ('Student', 'students.read', 'self'),
  ('Student', 'schedules.read', 'self'),
  ('Student', 'attendance.read', 'self'),
  ('Student', 'marks.read', 'self'),
  ('Student', 'assignments.read', 'self'),
  ('Student', 'assignments.submit', 'self'),
  ('Student', 'notices.read', 'institution'),

  ('Guardian', 'students.read', 'self'),
  ('Guardian', 'schedules.read', 'self'),
  ('Guardian', 'attendance.read', 'self'),
  ('Guardian', 'marks.read', 'self'),
  ('Guardian', 'assignments.read', 'self'),
  ('Guardian', 'notices.read', 'institution')
) as g(role_name, permission_key, scope)
join r on r.name = g.role_name
join p on p.key = g.permission_key
on conflict (role_id, permission_id) do update set scope = excluded.scope;

-- 5. Demo Institution (Dhaka Model International Academy)
insert into public.institution (id, name, subdomain, branding)
values ('f2c10000-0000-0000-0000-000000000001', 'Dhaka Model International Academy', 'dhakamodel', '{"primaryColor":"#4f46e5","accentColor":"#f59e0b"}'::jsonb)
on conflict (id) do update set name = excluded.name, subdomain = excluded.subdomain;

insert into public.institution_module (institution_id, module_id, enabled)
select 'f2c10000-0000-0000-0000-000000000001', id, true from public.module
on conflict (institution_id, module_id) do update set enabled = true;

-- Clone Roles into Demo Institution
insert into public.role (institution_id, name, is_system) values
  ('f2c10000-0000-0000-0000-000000000001', 'Institution Admin', true),
  ('f2c10000-0000-0000-0000-000000000001', 'Academic Coordinator', false),
  ('f2c10000-0000-0000-0000-000000000001', 'Teacher', true),
  ('f2c10000-0000-0000-0000-000000000001', 'Student', true),
  ('f2c10000-0000-0000-0000-000000000001', 'Guardian', true)
on conflict do nothing;

-- Grant permissions to institution roles
with ir as (select id, name from public.role where institution_id = 'f2c10000-0000-0000-0000-000000000001'),
     p as (select id, key from public.permission)
insert into public.role_permission (institution_id, role_id, permission_id, scope)
select 'f2c10000-0000-0000-0000-000000000001', ir.id, p.id, g.scope
from (values
  ('Institution Admin', 'institution.manage', 'institution'),
  ('Institution Admin', 'roles.manage', 'institution'),
  ('Institution Admin', 'memberships.manage', 'institution'),
  ('Institution Admin', 'academic_years.manage', 'institution'),
  ('Institution Admin', 'classes.manage', 'institution'),
  ('Institution Admin', 'sections.manage', 'institution'),
  ('Institution Admin', 'subjects.manage', 'institution'),
  ('Institution Admin', 'teachers.assign', 'institution'),
  ('Institution Admin', 'schedules.manage', 'institution'),
  ('Institution Admin', 'schedules.read', 'institution'),
  ('Institution Admin', 'tasks.manage', 'institution'),
  ('Institution Admin', 'tasks.read', 'institution'),
  ('Institution Admin', 'settings.manage', 'institution'),
  ('Institution Admin', 'custom_fields.manage', 'institution'),
  ('Institution Admin', 'audit_logs.read', 'institution'),
  ('Institution Admin', 'students.read', 'institution'),
  ('Institution Admin', 'students.write', 'institution'),
  ('Institution Admin', 'users.impersonate', 'institution'),
  ('Institution Admin', 'attendance.read', 'institution'),
  ('Institution Admin', 'attendance.create', 'institution'),
  ('Institution Admin', 'attendance.employee.read', 'institution'),
  ('Institution Admin', 'attendance.employee.create', 'institution'),
  ('Institution Admin', 'exams.manage', 'institution'),
  ('Institution Admin', 'marks.read', 'institution'),
  ('Institution Admin', 'marks.create', 'institution'),
  ('Institution Admin', 'marks.approve', 'institution'),
  ('Institution Admin', 'assignments.read', 'institution'),
  ('Institution Admin', 'assignments.create', 'institution'),
  ('Institution Admin', 'assignments.update', 'institution'),
  ('Institution Admin', 'assignments.delete', 'institution'),
  ('Institution Admin', 'assignments.grade', 'institution'),
  ('Institution Admin', 'notices.read', 'institution'),
  ('Institution Admin', 'notices.write', 'institution'),
  ('Institution Admin', 'admissions.read', 'institution'),
  ('Institution Admin', 'admissions.write', 'institution'),
  ('Institution Admin', 'admissions.approve', 'institution'),

  ('Academic Coordinator', 'academic_years.manage', 'institution'),
  ('Academic Coordinator', 'classes.manage', 'institution'),
  ('Academic Coordinator', 'sections.manage', 'institution'),
  ('Academic Coordinator', 'subjects.manage', 'institution'),
  ('Academic Coordinator', 'teachers.assign', 'institution'),
  ('Academic Coordinator', 'students.read', 'institution'),
  ('Academic Coordinator', 'students.write', 'institution'),
  ('Academic Coordinator', 'notices.read', 'institution'),

  ('Teacher', 'students.read', 'assigned_sections'),
  ('Teacher', 'schedules.read', 'assigned_sections'),
  ('Teacher', 'tasks.read', 'self'),
  ('Teacher', 'attendance.read', 'assigned_sections'),
  ('Teacher', 'attendance.create', 'assigned_sections'),
  ('Teacher', 'marks.read', 'assigned_sections'),
  ('Teacher', 'marks.create', 'assigned_sections'),
  ('Teacher', 'assignments.read', 'assigned_sections'),
  ('Teacher', 'assignments.create', 'assigned_sections'),
  ('Teacher', 'assignments.update', 'assigned_sections'),
  ('Teacher', 'assignments.grade', 'assigned_sections'),
  ('Teacher', 'notices.read', 'institution'),

  ('Student', 'students.read', 'self'),
  ('Student', 'schedules.read', 'self'),
  ('Student', 'attendance.read', 'self'),
  ('Student', 'marks.read', 'self'),
  ('Student', 'assignments.read', 'self'),
  ('Student', 'assignments.submit', 'self'),
  ('Student', 'notices.read', 'institution'),

  ('Guardian', 'students.read', 'self'),
  ('Guardian', 'schedules.read', 'self'),
  ('Guardian', 'attendance.read', 'self'),
  ('Guardian', 'marks.read', 'self'),
  ('Guardian', 'assignments.read', 'self'),
  ('Guardian', 'notices.read', 'institution')
) as g(role_name, permission_key, scope)
join ir on ir.name = g.role_name
join p on p.key = g.permission_key
on conflict (role_id, permission_id) do update set scope = excluded.scope;

-- 6. Demo User Accounts (Real accounts with passwords for production-parity auth)
-- Admin
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000001', 'admin@biddyapith.tech', '{"name":"Dr. Shahriar Hossain"}')
on conflict (id) do update set email = excluded.email, raw_user_meta_data = excluded.raw_user_meta_data;

insert into public.profile (id, name, email, phone, must_change_password, password_hash)
values ('00000000-0000-0000-0000-000000000001', 'Dr. Shahriar Hossain', 'admin@biddyapith.tech', '+880 1700-000001', false, 'password123')
on conflict (id) do update set name = excluded.name, email = excluded.email, password_hash = excluded.password_hash;

insert into public.membership (user_id, institution_id, role_id, login_username, status, invite_status)
values (
  '00000000-0000-0000-0000-000000000001',
  'f2c10000-0000-0000-0000-000000000001',
  (select id from public.role where institution_id = 'f2c10000-0000-0000-0000-000000000001' and name = 'Institution Admin'),
  'admin',
  'active',
  'active'
) on conflict (user_id, institution_id) do update set login_username = 'admin';

-- Teacher
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000002', 'teacher@biddyapith.tech', '{"name":"Rafiqul Islam"}')
on conflict (id) do update set email = excluded.email, raw_user_meta_data = excluded.raw_user_meta_data;

insert into public.profile (id, name, email, phone, must_change_password, password_hash)
values ('00000000-0000-0000-0000-000000000002', 'Rafiqul Islam', 'teacher@biddyapith.tech', '+880 1700-000002', false, 'password123')
on conflict (id) do update set name = excluded.name, email = excluded.email, password_hash = excluded.password_hash;

insert into public.membership (user_id, institution_id, role_id, login_username, status, invite_status)
values (
  '00000000-0000-0000-0000-000000000002',
  'f2c10000-0000-0000-0000-000000000001',
  (select id from public.role where institution_id = 'f2c10000-0000-0000-0000-000000000001' and name = 'Teacher'),
  'teacher',
  'active',
  'active'
) on conflict (user_id, institution_id) do update set login_username = 'teacher';

-- Student
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000003', 'student@biddyapith.tech', '{"name":"Tahmid Rahman"}')
on conflict (id) do update set email = excluded.email, raw_user_meta_data = excluded.raw_user_meta_data;

insert into public.profile (id, name, email, phone, must_change_password, password_hash)
values ('00000000-0000-0000-0000-000000000003', 'Tahmid Rahman', 'student@biddyapith.tech', '+880 1700-000003', false, 'password123')
on conflict (id) do update set name = excluded.name, email = excluded.email, password_hash = excluded.password_hash;

insert into public.membership (user_id, institution_id, role_id, login_username, status, invite_status)
values (
  '00000000-0000-0000-0000-000000000003',
  'f2c10000-0000-0000-0000-000000000001',
  (select id from public.role where institution_id = 'f2c10000-0000-0000-0000-000000000001' and name = 'Student'),
  'student',
  'active',
  'active'
) on conflict (user_id, institution_id) do update set login_username = 'student';

-- 7. Academic Structure
insert into public.campus (institution_id, name, address)
values ('f2c10000-0000-0000-0000-000000000001', 'Main Campus - Dhanmondi', 'Road 27, Dhanmondi, Dhaka')
on conflict do nothing;

insert into public.academic_year (id, institution_id, label, start_date, end_date, is_current)
values ('10000000-0000-0000-0000-000000000001', 'f2c10000-0000-0000-0000-000000000001', '2026-2027', '2026-01-01', '2026-12-31', true)
on conflict (id) do nothing;

insert into public.class (id, institution_id, academic_year_id, name, sort_order)
values
  ('20000000-0000-0000-0000-000000000001', 'f2c10000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Grade 10', 10),
  ('20000000-0000-0000-0000-000000000002', 'f2c10000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Grade 9', 9)
on conflict (id) do nothing;

insert into public.section (id, institution_id, class_id, name, capacity)
values
  ('30000000-0000-0000-0000-000000000001', 'f2c10000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Section A - Science', 45),
  ('30000000-0000-0000-0000-000000000002', 'f2c10000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Section B - Commerce', 40)
on conflict (id) do nothing;

insert into public.subject (id, institution_id, name, code)
values
  ('40000000-0000-0000-0000-000000000001', 'f2c10000-0000-0000-0000-000000000001', 'Physics', 'PHY-101'),
  ('40000000-0000-0000-0000-000000000002', 'f2c10000-0000-0000-0000-000000000001', 'Higher Mathematics', 'MATH-102'),
  ('40000000-0000-0000-0000-000000000003', 'f2c10000-0000-0000-0000-000000000001', 'English Literature', 'ENG-103')
on conflict (id) do nothing;

-- Teacher assignment
insert into public.class_subject_teacher (institution_id, section_id, subject_id, teacher_membership_id)
values (
  'f2c10000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000002')
) on conflict do nothing;

-- Student record
insert into public.student (id, institution_id, user_id, admission_no, name, date_of_birth, gender, status)
values ('50000000-0000-0000-0000-000000000001', 'f2c10000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'ADM-2026-001', 'Tahmid Rahman', '2010-05-14', 'Male', 'active')
on conflict (institution_id, admission_no) do update set name = excluded.name;

insert into public.student (id, institution_id, user_id, admission_no, name, date_of_birth, gender, status)
values ('50000000-0000-0000-0000-000000000002', 'f2c10000-0000-0000-0000-000000000001', null, 'ADM-2026-002', 'Amina Akter', '2010-08-22', 'Female', 'active')
on conflict (institution_id, admission_no) do update set name = excluded.name;

-- Enrollments
insert into public.enrollment (institution_id, student_id, academic_year_id, class_id, section_id, roll_no, status)
values
  ('f2c10000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '01', 'active'),
  ('f2c10000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '02', 'active')
on conflict (student_id, academic_year_id) do nothing;

-- Exam & Marks
insert into public.exam (id, institution_id, academic_year_id, name, term)
values ('e0000000-0000-0000-0000-000000000001', 'f2c10000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Mid-Term Examination 2026', 'Term 1')
on conflict (id) do nothing;

insert into public.mark (institution_id, exam_id, student_id, subject_id, marks_obtained, max_marks, grade, recorded_by_membership_id)
values (
  'f2c10000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  88,
  100,
  'A+',
  (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000002')
) on conflict (exam_id, student_id, subject_id) do nothing;

-- Attendance
insert into public.attendance (institution_id, student_id, section_id, date, status, recorded_by_membership_id)
values
  ('f2c10000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date, 'present', (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000002')),
  ('f2c10000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', current_date, 'present', (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000002'))
on conflict (student_id, date) do nothing;

-- Notices
insert into public.notice (institution_id, title, body, audience_scope, published_by_membership_id)
values
  ('f2c10000-0000-0000-0000-000000000001', 'Welcome to Biddyapith Academic Session 2026-2027', 'Classes have commenced for all grades. Students are advised to collect their curriculum schedules from their respective section coordinators.', 'institution', (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000001')),
  ('f2c10000-0000-0000-0000-000000000001', 'Science Fair Abstract Submission Deadline', 'All Grade 9 and 10 students must submit their project abstracts by the upcoming Thursday.', 'institution', (select id from public.membership where user_id = '00000000-0000-0000-0000-000000000001'))
on conflict do nothing;

-- Document & Certificate Templates
insert into public.template (id, institution_id, type, name, description, content, metadata)
values
  (
    '70000000-0000-0000-0000-000000000001',
    'f2c10000-0000-0000-0000-000000000001',
    'tc',
    'Official Transfer Certificate (TC)',
    'Standard government and board compliant school leaving transfer certificate with complete student academic records.',
    '<div class="doc-container tc-document" style="font-family: ''Times New Roman'', Georgia, serif; max-width: 800px; margin: 0 auto; padding: 40px; border: 4px double #1e293b; background: #ffffff; color: #0f172a;">
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px;">
    <h1 style="margin: 0; font-size: 26px; text-transform: uppercase; letter-spacing: 1.5px; color: #1e3a8a;">{{institution.name}}</h1>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">Affiliated with Board of Intermediate and Secondary Education &bull; Code: DMIA-2026</p>
    <div style="margin-top: 15px; display: inline-block; padding: 4px 18px; background: #0f172a; color: #ffffff; font-weight: bold; font-size: 15px; letter-spacing: 2px; text-transform: uppercase;">
      Transfer Certificate
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 20px;">
    <div><strong>TC Book No:</strong> TC-2026/{{student.classId}}</div>
    <div><strong>Certificate Sl No:</strong> {{certificateNo}}</div>
    <div><strong>Issue Date:</strong> {{issueDate}}</div>
  </div>

  <div style="font-size: 14.5px; line-height: 2.2; text-align: justify;">
    This is to certify that <strong>{{student.name}}</strong>, Admission Number <strong>{{student.admissionNo}}</strong>, 
    Roll Number <strong>{{student.rollNo}}</strong>, son/daughter of <strong>{{student.guardianName}}</strong>, was a bona fide student 
    of this institution. According to school records, the student''s Date of Birth is <strong>{{student.dateOfBirth}}</strong>.
    <br/>
    The student was enrolled in <strong>Class {{student.className}}</strong>, Section <strong>{{student.sectionName}}</strong> during the academic session 
    <strong>{{academicYear}}</strong>. All institutional dues, library books, and laboratory equipment have been satisfactorily cleared up to date.
    <br/>
    <strong>General Conduct & Character:</strong> {{conductRemarks}}
    <br/>
    <strong>Reason for Leaving School:</strong> {{reasonForLeaving}}
    <br/>
    We wish the student outstanding success and progress in all future educational pursuits.
  </div>

  <div style="margin-top: 70px; display: flex; justify-content: space-between; text-align: center; font-size: 13px;">
    <div style="width: 200px; border-top: 1px dashed #475569; padding-top: 6px;">
      Class Teacher
    </div>
    <div style="width: 140px; height: 140px; border: 2px dashed #94a3b8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #64748b; margin-top: -30px;">
      Official School Seal
    </div>
    <div style="width: 200px; border-top: 1px dashed #475569; padding-top: 6px;">
      Headmaster / Principal
    </div>
  </div>
</div>',
    '{"orientation":"portrait","variables":["student.name","student.admissionNo","student.rollNo","student.className","student.sectionName","student.guardianName","student.dateOfBirth","certificateNo","issueDate","academicYear","conductRemarks","reasonForLeaving"]}'::jsonb
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    'f2c10000-0000-0000-0000-000000000001',
    'marksheet',
    'Academic Marksheet & Progress Transcript',
    'Official academic examination marksheet with subject breakdowns, grades, GPA, and term progress summary.',
    '<div class="doc-container marksheet-document" style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 850px; margin: 0 auto; padding: 35px; border: 2px solid #cbd5e1; background: #ffffff; color: #1e293b;">
  <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 24px; color: #1e40af; font-weight: 800;">{{institution.name}}</h1>
    <p style="margin: 3px 0 0; font-size: 13px; color: #64748b;">Annual Academic Performance & Progress Transcript</p>
    <div style="margin-top: 10px; font-weight: 700; font-size: 15px; color: #0f172a;">{{examName}} &bull; Session {{academicYear}}</div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; padding: 14px 18px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 13.5px;">
    <div><strong>Student Name:</strong> {{student.name}}</div>
    <div><strong>Admission No:</strong> {{student.admissionNo}}</div>
    <div><strong>Class & Section:</strong> {{student.className}} ({{student.sectionName}})</div>
    <div><strong>Roll Number:</strong> {{student.rollNo}}</div>
    <div><strong>Guardian Name:</strong> {{student.guardianName}}</div>
    <div><strong>Attendance Record:</strong> 96% Present</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
    <thead>
      <tr style="background: #1e40af; color: #ffffff; text-align: left;">
        <th style="padding: 10px; border: 1px solid #1e40af;">Subject</th>
        <th style="padding: 10px; border: 1px solid #1e40af; text-align: center;">Full Marks</th>
        <th style="padding: 10px; border: 1px solid #1e40af; text-align: center;">Obtained</th>
        <th style="padding: 10px; border: 1px solid #1e40af; text-align: center;">Grade</th>
        <th style="padding: 10px; border: 1px solid #1e40af; text-align: center;">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600;">Mathematics</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">100</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">88</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: bold;">A+</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Passed</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600;">English Language</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">100</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">84</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: bold;">A+</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Passed</td>
      </tr>
      <tr>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600;">General Science</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">100</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">79</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; color: #2563eb; font-weight: bold;">A</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Passed</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600;">Bengali / Literature</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">100</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">82</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: bold;">A+</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Passed</td>
      </tr>
      <tr>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600;">Social Studies</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">100</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">86</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: bold;">A+</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Passed</td>
      </tr>
    </tbody>
    <tfoot>
      <tr style="background: #eff6ff; font-weight: bold;">
        <td style="padding: 10px; border: 1px solid #cbd5e1;">Grand Total / Cumulative GPA</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">500</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #1d4ed8;">419 (83.8%)</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a;">GPA 4.90</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a;">PROMOTED</td>
      </tr>
    </tfoot>
  </table>

  <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px; margin-bottom: 40px;">
    <strong>Teacher Remarks:</strong> Outstanding academic enthusiasm, sharp problem-solving instincts, and disciplined study habits throughout the semester.
  </div>

  <div style="display: flex; justify-content: space-between; text-align: center; font-size: 12.5px; padding-top: 20px;">
    <div style="width: 180px; border-top: 1px solid #64748b; padding-top: 5px;">Controller of Examinations</div>
    <div style="width: 180px; border-top: 1px solid #64748b; padding-top: 5px;">Class Teacher</div>
    <div style="width: 180px; border-top: 1px solid #64748b; padding-top: 5px;">Principal Signature</div>
  </div>
</div>',
    '{"orientation":"portrait","variables":["student.name","student.admissionNo","student.rollNo","student.className","student.sectionName","student.guardianName","examName","academicYear","issueDate"]}'::jsonb
  ),
  (
    '70000000-0000-0000-0000-000000000003',
    'f2c10000-0000-0000-0000-000000000001',
    'testimonial',
    'Student Character Testimonial',
    'Formal institutional character certificate certifying moral character, discipline, and extracurricular contributions.',
    '<div class="doc-container testimonial-document" style="font-family: Georgia, serif; max-width: 820px; margin: 0 auto; padding: 45px; border: 6px double #334155; background: #fffcf8; color: #0f172a; position: relative;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="margin: 0; font-size: 28px; text-transform: uppercase; color: #0f172a; letter-spacing: 2px;">{{institution.name}}</h1>
    <p style="margin: 5px 0 0; font-style: italic; color: #475569; font-size: 14px;">Excellence in Academic Guidance & Character Formation</p>
    <div style="margin: 20px auto 0; width: 280px; height: 3px; background: linear-gradient(90deg, transparent, #0f172a, transparent);"></div>
    <h2 style="font-size: 20px; margin: 18px 0 0; text-transform: uppercase; letter-spacing: 3px; color: #b45309;">Testimonial</h2>
  </div>

  <div style="font-size: 15px; line-height: 2.3; text-align: justify; margin: 30px 0;">
    This is to certify that <strong>{{student.name}}</strong>, daughter/son of <strong>{{student.guardianName}}</strong>, 
    bearing Admission Number <strong>{{student.admissionNo}}</strong> and Class Roll <strong>{{student.rollNo}}</strong>, has been a regular student 
    of <strong>Class {{student.className}}</strong>, Section <strong>{{student.sectionName}}</strong> at this institution during the academic period 
    <strong>{{academicYear}}</strong>.
    <br/>
    To the best of our knowledge and institutional observation, the student bears exemplary moral conduct, sincere scholastic diligence, 
    and respectful behavior toward peers and faculty members alike. The student took active part in institutional co-curricular initiatives 
    and has not taken part in any activity subversive of law or school discipline.
    <br/>
    We wish the student every success, health, and distinction in future academic and personal life.
  </div>

  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px; font-size: 13px;">
    <div>
      <div><strong>Issue Date:</strong> {{issueDate}}</div>
      <div><strong>Institutional Seal:</strong> Affixed</div>
    </div>
    <div style="text-align: center; width: 220px; border-top: 1px solid #0f172a; padding-top: 6px;">
      <strong>Principal / Head of Institution</strong><br/>
      {{institution.name}}
    </div>
  </div>
</div>',
    '{"orientation":"portrait","variables":["student.name","student.admissionNo","student.rollNo","student.className","student.sectionName","student.guardianName","academicYear","issueDate"]}'::jsonb
  ),
  (
    '70000000-0000-0000-0000-000000000004',
    'f2c10000-0000-0000-0000-000000000001',
    'admit_card',
    'Examination Hall Admit Card',
    'Official examination admit card and hall ticket with student photo box, exam schedule, and candidate guidelines.',
    '<div class="doc-container admit-card-document" style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 30px; border: 2px solid #0f172a; background: #ffffff; color: #0f172a;">
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 18px;">
    <div>
      <h2 style="margin: 0; font-size: 22px; color: #1e3a8a; font-weight: 800;">{{institution.name}}</h2>
      <p style="margin: 2px 0 0; font-size: 12.5px; color: #475569;">Official Examination Hall Ticket & Admit Card</p>
      <div style="margin-top: 6px; font-weight: 700; font-size: 14px; color: #b45309;">{{examName}} &bull; Session {{academicYear}}</div>
    </div>
    <div style="width: 100px; height: 110px; border: 2px dashed #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #64748b; text-align: center;">
      Student Photo
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; font-size: 13.5px; margin-bottom: 20px; background: #f8fafc; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 6px;">
    <div><strong>Candidate Name:</strong> {{student.name}}</div>
    <div><strong>Roll Number:</strong> {{student.rollNo}}</div>
    <div><strong>Admission ID:</strong> {{student.admissionNo}}</div>
    <div><strong>Class & Section:</strong> {{student.className}} - {{student.sectionName}}</div>
    <div><strong>Exam Center:</strong> Main Campus Hall A</div>
    <div><strong>Reporting Time:</strong> 09:30 AM</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12.5px;">
    <thead>
      <tr style="background: #1e293b; color: #ffffff;">
        <th style="padding: 8px; border: 1px solid #1e293b; text-align: left;">Date</th>
        <th style="padding: 8px; border: 1px solid #1e293b; text-align: left;">Paper / Subject</th>
        <th style="padding: 8px; border: 1px solid #1e293b; text-align: center;">Time</th>
        <th style="padding: 8px; border: 1px solid #1e293b; text-align: center;">Invigilator Sign</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">Day 1</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 600;">Mathematics (Paper I)</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">10:00 AM - 01:00 PM</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;"></td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 8px; border: 1px solid #cbd5e1;">Day 2</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 600;">English Language</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">10:00 AM - 01:00 PM</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;"></td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">Day 3</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 600;">General Science</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">10:00 AM - 01:00 PM</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;"></td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 8px; border: 1px solid #cbd5e1;">Day 4</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 600;">Social Studies</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">10:00 AM - 01:00 PM</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;"></td>
      </tr>
    </tbody>
  </table>

  <div style="font-size: 11.5px; color: #475569; margin-bottom: 30px;">
    <strong>Candidate Instructions:</strong> Electronic gadgets, mobile phones, or smartwatches are strictly prohibited in the exam hall. Candidates must arrive at least 30 minutes prior to exam start.
  </div>

  <div style="display: flex; justify-content: space-between; text-align: center; font-size: 12.5px;">
    <div style="width: 180px; border-top: 1px solid #0f172a; padding-top: 4px;">Candidate Signature</div>
    <div style="width: 180px; border-top: 1px solid #0f172a; padding-top: 4px;">Controller of Examinations</div>
  </div>
</div>',
    '{"orientation":"portrait","variables":["student.name","student.admissionNo","student.rollNo","student.className","student.sectionName","examName","academicYear"]}'::jsonb
  ),
  (
    '70000000-0000-0000-0000-000000000005',
    'f2c10000-0000-0000-0000-000000000001',
    'id_card',
    'Printable Student Identity Card',
    'Compact portrait institutional ID badge with photo frame, barcode placeholder, and emergency contact.',
    '<div class="doc-container id-card-document" style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; width: 320px; margin: 0 auto; border: 2px solid #2563eb; border-radius: 12px; overflow: hidden; background: #ffffff; color: #0f172a; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
  <div style="background: #1e40af; color: #ffffff; text-align: center; padding: 14px 10px;">
    <h3 style="margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase;">{{institution.name}}</h3>
    <div style="font-size: 10px; opacity: 0.85; margin-top: 2px;">STUDENT IDENTITY CARD</div>
  </div>

  <div style="padding: 16px; text-align: center;">
    <div style="width: 90px; height: 100px; margin: 0 auto 12px; border: 2px solid #cbd5e1; border-radius: 8px; background: #f8fafc; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #94a3b8;">
      PHOTO
    </div>

    <h4 style="margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #1e3a8a;">{{student.name}}</h4>
    <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 12px;">Roll: {{student.rollNo}} &bull; Class {{student.className}} ({{student.sectionName}})</div>

    <div style="text-align: left; font-size: 11.5px; line-height: 1.8; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px;">
      <div><strong>ID No:</strong> {{student.admissionNo}}</div>
      <div><strong>Guardian:</strong> {{student.guardianName}}</div>
      <div><strong>Emergency Phone:</strong> {{student.guardianPhone}}</div>
      <div><strong>Academic Session:</strong> {{academicYear}}</div>
    </div>

    <div style="border-top: 1px dashed #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
      <span>Valid: 2026-2027</span>
      <span style="border-bottom: 1px solid #64748b; padding-bottom: 1px;">Principal Signature</span>
    </div>
  </div>
</div>',
    '{"orientation":"portrait","variables":["student.name","student.admissionNo","student.rollNo","student.className","student.sectionName","student.guardianName","student.guardianPhone","academicYear"]}'::jsonb
  )
on conflict (id) do update set name = excluded.name, content = excluded.content, metadata = excluded.metadata;


