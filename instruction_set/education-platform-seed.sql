-- ============================================================================
-- EDUCATION PLATFORM — SEED DATA (optional)
-- Run AFTER education-platform-schema.sql. Registers the "core", "assignments"
-- and "transport" modules with their permissions/widgets (normally your
-- module registry engine does this at boot — see backend-core doc §4 — this
-- is a hand-written equivalent so you have something to develop against
-- immediately without writing the registry first).
-- ============================================================================

-- ---- Modules ----
insert into public.module (key, name, version) values
  ('core', 'Core / Academic', '1.0.0'),
  ('assignments', 'Assignments', '1.0.0'),
  ('transport', 'Transport', '1.0.0');

-- ---- Permissions ----
with m as (select id, key from public.module)
insert into public.permission (key, module_id, description, scope_options)
select p.key, m.id, p.description, p.scope_options
from (values
  ('students.read',      'core', 'View student records',              array['institution','assigned_sections','self']),
  ('attendance.read',    'core', 'View attendance',                    array['institution','assigned_sections','self']),
  ('attendance.create',  'core', 'Take attendance',                    array['assigned_sections']),
  ('marks.read',         'core', 'View marks',                         array['institution','assigned_sections','self']),
  ('marks.create',       'core', 'Enter marks',                        array['assigned_sections']),
  ('marks.approve',      'core', 'Approve marks before publishing',    array['institution']),
  ('notices.read',       'core', 'View notices',                       array['institution']),
  ('notices.write',      'core', 'Publish notices',                    array['institution']),
  ('finance.read',       'core', 'View fee/payment records',           array['institution','self']),

  ('assignments.read',   'assignments', 'View assignments',            array['institution','assigned_sections','self']),
  ('assignments.create', 'assignments', 'Create assignments',          array['assigned_sections']),
  ('assignments.update', 'assignments', 'Edit an assignment',          array['assigned_sections','self']),
  ('assignments.delete', 'assignments', 'Delete an assignment',        array['assigned_sections']),
  ('assignments.submit', 'assignments', 'Submit work',                 array['self']),
  ('assignments.grade',  'assignments', 'Grade a submission',          array['assigned_sections']),

  ('transport.read',          'transport', 'View routes/vehicle info',   array['institution','assigned_routes','self']),
  ('transport.manage',        'transport', 'Manage routes/vehicles',     array['institution']),
  ('transport.assign_driver', 'transport', 'Assign driver to vehicle',   array['institution']),
  ('transport.track',         'transport', 'View live vehicle location', array['assigned_routes','self'])
) as p(key, module_key, description, scope_options)
join m on m.key = p.module_key;

-- ---- Widgets ----
with m as (select id, key from public.module)
insert into public.widget (key, module_id, required_permissions, default_size, data_source, renderer)
select w.key, m.id, w.required_permissions, w.default_size, w.data_source, w.renderer
from (values
  ('attendance_summary',    'core', array['attendance.read'],     '{"width":4,"height":2}'::jsonb, '/api/attendance/summary',           'AttendanceSummary'),
  ('notice_board',          'core', array['notices.read'],        '{"width":4,"height":3}'::jsonb, '/api/notices',                       'NoticeBoard'),

  ('assignment_list',       'assignments', array['assignments.read'],   '{"width":4,"height":2}'::jsonb, '/api/assignments',                  'AssignmentList'),
  ('pending_assignments',   'assignments', array['assignments.submit'], '{"width":4,"height":2}'::jsonb, '/api/assignments?status=pending',   'PendingAssignments'),
  ('assignment_statistics', 'assignments', array['assignments.grade'],  '{"width":6,"height":3}'::jsonb, '/api/assignments/stats',            'AssignmentStatistics'),

  ('fleet_overview',        'transport', array['transport.manage'],    '{"width":6,"height":3}'::jsonb, '/api/transport/routes',             'FleetOverview'),
  ('my_route',              'transport', array['transport.read'],      '{"width":4,"height":2}'::jsonb, '/api/transport/my-route',           'MyRoute')
) as w(key, module_key, required_permissions, default_size, data_source, renderer)
join m on m.key = w.module_key;

-- ---- Platform-default roles (institution_id NULL — templates every
--      institution can see; when an institution is created, clone these
--      into institution-owned rows so they can be edited independently) ----
insert into public.role (institution_id, name, is_system) values
  (null, 'Institution Admin', true),
  (null, 'Teacher', true),
  (null, 'Student', true),
  (null, 'Guardian', true);

with r as (select id, name from public.role where institution_id is null),
     p as (select id, key from public.permission)
insert into public.role_permission (institution_id, role_id, permission_id, scope)
select null, r.id, p.id, g.scope
from (values
  ('Institution Admin', 'students.read',     'institution'),
  ('Institution Admin', 'attendance.read',   'institution'),
  ('Institution Admin', 'marks.read',        'institution'),
  ('Institution Admin', 'marks.approve',     'institution'),
  ('Institution Admin', 'notices.write',     'institution'),
  ('Institution Admin', 'finance.read',      'institution'),
  ('Institution Admin', 'assignments.read',  'institution'),
  ('Institution Admin', 'transport.manage',  'institution'),

  ('Teacher', 'students.read',      'assigned_sections'),
  ('Teacher', 'attendance.read',    'assigned_sections'),
  ('Teacher', 'attendance.create',  'assigned_sections'),
  ('Teacher', 'marks.read',         'assigned_sections'),
  ('Teacher', 'marks.create',       'assigned_sections'),
  ('Teacher', 'notices.read',       'institution'),
  ('Teacher', 'assignments.read',   'assigned_sections'),
  ('Teacher', 'assignments.create', 'assigned_sections'),
  ('Teacher', 'assignments.grade',  'assigned_sections'),

  ('Student', 'attendance.read',   'self'),
  ('Student', 'marks.read',        'self'),
  ('Student', 'notices.read',      'institution'),
  ('Student', 'assignments.read',  'self'),
  ('Student', 'assignments.submit','self'),
  ('Student', 'finance.read',      'self'),
  ('Student', 'transport.read',    'self'),

  ('Guardian', 'attendance.read', 'self'),
  ('Guardian', 'marks.read',      'self'),
  ('Guardian', 'notices.read',    'institution'),
  ('Guardian', 'finance.read',    'self'),
  ('Guardian', 'transport.read',  'self')
) as g(role_name, permission_key, scope)
join r on r.name = g.role_name
join p on p.key = g.permission_key;

-- NOTE: role_permission.institution_id is NOT NULL in the schema, but these
-- rows use NULL because they belong to platform-default roles. If you kept
-- the schema exactly as given, either (a) relax that NOT NULL to allow
-- platform-template permission rows, matching the `role` table's own
-- nullability, or (b) skip seeding role_permission for template roles here
-- and only populate it when an institution clones a template into its own
-- role. Option (b) is cleaner long-term — see backend-core doc §4 for the
-- "clone template roles on institution creation" flow.
