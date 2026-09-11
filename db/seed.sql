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
  ('transport.manage', 'transport', 'Manage transport fleet and route stops', array['institution'])
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

