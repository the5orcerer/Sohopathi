import { ModuleManifest } from '../../core/registry/types';
import * as routes from './routes';
import { z } from 'zod';

export const coreManifest: ModuleManifest = {
  id: 'core',
  name: 'Core Academic & Administration',
  version: '1.0.0',
  dependsOn: [],

  permissions: [
    { key: 'institution.manage', description: 'Manage institution settings and campuses', scopeOptions: ['institution'] },
    { key: 'roles.manage', description: 'Create roles and manage permission matrix', scopeOptions: ['institution'] },
    { key: 'memberships.manage', description: 'Invite employees and manage staff', scopeOptions: ['institution'] },
    { key: 'academic_years.manage', description: 'Configure academic years and sessions', scopeOptions: ['institution'] },
    { key: 'classes.manage', description: 'Manage classes, grades, and levels', scopeOptions: ['institution'] },
    { key: 'sections.manage', description: 'Manage section divisions and capacities', scopeOptions: ['institution'] },
    { key: 'subjects.manage', description: 'Manage curriculum subjects and course codes', scopeOptions: ['institution'] },
    { key: 'teachers.assign', description: 'Assign teachers to subjects and class sections', scopeOptions: ['institution'] },
    { key: 'schedules.manage', description: 'Configure class timetables and period slots', scopeOptions: ['institution'] },
    { key: 'schedules.read', description: 'View class schedules and timetables', scopeOptions: ['institution', 'assigned_sections', 'self'] },
    { key: 'custom_fields.manage', description: 'Configure dynamic custom fields for students and staff', scopeOptions: ['institution'] },
    { key: 'audit_logs.read', description: 'View administrative activity logs and changelogs', scopeOptions: ['institution'] },
    { key: 'tasks.manage', description: 'Assign and manage staff tasks and work orders', scopeOptions: ['institution', 'assigned_sections'] },
    { key: 'tasks.read', description: 'View and complete assigned tasks', scopeOptions: ['institution', 'assigned_sections', 'self'] },
    { key: 'settings.manage', description: 'Configure institution profile, branding, and feature toggles', scopeOptions: ['institution'] },
    { key: 'students.read', description: 'View student directory and profiles', scopeOptions: ['institution', 'assigned_sections', 'self'] },
    { key: 'students.write', description: 'Create, enroll, and edit student records', scopeOptions: ['institution'] },
  ],

  routes: [
    // Institutions
    {
      method: 'POST',
      path: '/institutions',
      requiredPermission: 'institution.manage',
      validation: {
        body: z.object({ name: z.string().min(1), subdomain: z.string().min(1), branding: z.any().optional() }),
      },
      handler: routes.createInstitution,
    },

    // Permissions & Roles
    { method: 'GET', path: '/permissions', requiredPermission: 'roles.manage', handler: routes.listPermissions },
    { method: 'GET', path: '/roles', requiredPermission: 'roles.manage', handler: routes.listRoles },
    {
      method: 'POST',
      path: '/roles',
      requiredPermission: 'roles.manage',
      validation: {
        body: z.object({
          name: z.string().min(1),
          templateRoleId: z.string().uuid().optional(),
        }),
      },
      handler: routes.createRole,
    },
    { method: 'GET', path: '/roles/:id/permissions', requiredPermission: 'roles.manage', handler: routes.getRolePermissions },
    {
      method: 'PUT',
      path: '/roles/:id/permissions',
      requiredPermission: 'roles.manage',
      validation: {
        body: z.object({
          permissions: z.array(z.object({ permissionKey: z.string(), scope: z.string() })),
        }),
      },
      handler: routes.updateRolePermissions,
    },

    // Members / Staff
    { method: 'GET', path: '/members', requiredPermission: 'memberships.manage', handler: routes.listMembers },
    {
      method: 'POST',
      path: '/members/invite',
      requiredPermission: 'memberships.manage',
      validation: {
        body: z.object({
          name: z.string().min(1),
          email: z.string().email(),
          phone: z.string().optional(),
          username: z.string().optional(),
          roleId: z.string().uuid(),
          temporaryPassword: z.string().optional(),
          customFields: z.record(z.any()).optional(),
        }),
      },
      handler: routes.inviteMember,
    },
    {
      method: 'PATCH',
      path: '/members/:id',
      requiredPermission: 'memberships.manage',
      handler: routes.updateMember,
    },
    {
      method: 'DELETE',
      path: '/members/:id',
      requiredPermission: 'memberships.manage',
      handler: routes.deleteMember,
    },
    {
      method: 'POST',
      path: '/members/bulk-delete',
      requiredPermission: 'memberships.manage',
      handler: routes.bulkDeleteMembers,
    },

    // Academic Structure
    { method: 'GET', path: '/academic-years', requiredPermission: 'academic_years.manage,schedules.read,attendance.read,marks.read,assignments.read', handler: routes.listAcademicYears },
    {
      method: 'POST',
      path: '/academic-years',
      requiredPermission: 'academic_years.manage',
      validation: {
        body: z.object({
          label: z.string().min(1),
          startDate: z.string(),
          endDate: z.string(),
          isCurrent: z.boolean().optional(),
        }),
      },
      handler: routes.createAcademicYear,
    },
    { method: 'GET', path: '/classes', requiredPermission: 'classes.manage,students.read,schedules.read,attendance.read,marks.read,assignments.read', handler: routes.listClasses },
    {
      method: 'POST',
      path: '/classes',
      requiredPermission: 'classes.manage',
      validation: {
        body: z.object({
          academicYearId: z.string().uuid(),
          name: z.string().min(1),
          sortOrder: z.number().optional(),
        }),
      },
      handler: routes.createClass,
    },
    { method: 'GET', path: '/sections', requiredPermission: 'sections.manage,classes.manage,students.read,schedules.read,attendance.read,marks.read,assignments.read', handler: routes.listSections },
    {
      method: 'POST',
      path: '/sections',
      requiredPermission: 'sections.manage',
      validation: {
        body: z.object({
          classId: z.string().uuid(),
          name: z.string().min(1),
          capacity: z.number().optional(),
        }),
      },
      handler: routes.createSection,
    },
    { method: 'GET', path: '/subjects', requiredPermission: 'subjects.manage,classes.manage,students.read,schedules.read,attendance.read,marks.read,assignments.read', handler: routes.listSubjects },
    {
      method: 'POST',
      path: '/subjects',
      requiredPermission: 'subjects.manage',
      validation: {
        body: z.object({
          name: z.string().min(1),
          code: z.string().optional(),
        }),
      },
      handler: routes.createSubject,
    },
    { method: 'GET', path: '/teachers', requiredPermission: 'teachers.assign', handler: routes.listTeachers },
    { method: 'GET', path: '/teacher-assignments', requiredPermission: 'teachers.assign', handler: routes.listClassSubjectTeachers },
    {
      method: 'POST',
      path: '/teacher-assignments',
      requiredPermission: 'teachers.assign',
      validation: {
        body: z.object({
          sectionId: z.string().uuid(),
          subjectId: z.string().uuid(),
          teacherMembershipId: z.string().uuid(),
        }),
      },
      handler: routes.assignClassSubjectTeacher,
    },

    // Class Schedules & Timetables
    { method: 'GET', path: '/schedules', requiredPermission: 'schedules.read', handler: routes.listSchedules },
    {
      method: 'POST',
      path: '/schedules',
      requiredPermission: 'schedules.manage',
      validation: {
        body: z.object({
          sectionId: z.string().uuid(),
          subjectId: z.string().uuid(),
          teacherMembershipId: z.string().uuid().optional(),
          dayOfWeek: z.string().min(1),
          startTime: z.string().min(1),
          endTime: z.string().min(1),
          roomNo: z.string().optional(),
        }),
      },
      handler: routes.createSchedule,
    },
    {
      method: 'PATCH',
      path: '/schedules/:id',
      requiredPermission: 'schedules.manage',
      handler: routes.updateSchedule,
    },
    {
      method: 'DELETE',
      path: '/schedules/:id',
      requiredPermission: 'schedules.manage',
      handler: routes.deleteSchedule,
    },

    // Dynamic Custom Fields (Lattice HR / Notion style)
    { method: 'GET', path: '/custom-fields', requiredPermission: 'custom_fields.manage', handler: routes.listCustomFields },
    {
      method: 'POST',
      path: '/custom-fields',
      requiredPermission: 'custom_fields.manage',
      validation: {
        body: z.object({
          entityType: z.enum(['student', 'member', 'class', 'section']),
          label: z.string().min(1),
          fieldKey: z.string().optional(),
          fieldType: z.enum(['text', 'number', 'select', 'date', 'boolean', 'tag']).optional(),
          options: z.array(z.string()).optional(),
          isRequired: z.boolean().optional(),
          sortOrder: z.number().optional(),
        }),
      },
      handler: routes.createCustomField,
    },
    {
      method: 'DELETE',
      path: '/custom-fields/:id',
      requiredPermission: 'custom_fields.manage',
      handler: routes.deleteCustomField,
    },

    // Audit Logs / Activity Log
    { method: 'GET', path: '/audit-logs', requiredPermission: 'audit_logs.read', handler: routes.listAuditLogs },

    // Students & Enrollments
    { method: 'GET', path: '/students', requiredPermission: 'students.read', handler: routes.listStudents },
    {
      method: 'POST',
      path: '/students',
      requiredPermission: 'students.write',
      validation: {
        body: z.object({
          admissionNo: z.string().min(1),
          name: z.string().min(1),
          dateOfBirth: z.string().optional(),
          gender: z.string().optional(),
          academicYearId: z.string().uuid().optional(),
          classId: z.string().uuid().optional(),
          sectionId: z.string().uuid().optional(),
          rollNo: z.string().optional(),
          customFields: z.record(z.any()).optional(),
          guardianName: z.string().optional(),
          guardianPhone: z.string().optional(),
          guardianRelation: z.string().optional(),
        }),
      },
      handler: routes.createStudent,
    },
    {
      method: 'PATCH',
      path: '/students/:id',
      requiredPermission: 'students.write',
      handler: routes.updateStudent,
    },
    {
      method: 'DELETE',
      path: '/students/:id',
      requiredPermission: 'students.write',
      handler: routes.deleteStudent,
    },
    {
      method: 'POST',
      path: '/students/bulk-delete',
      requiredPermission: 'students.write',
      handler: routes.bulkDeleteStudents,
    },
    {
      method: 'GET',
      path: '/students/:id/academic-history',
      requiredPermission: 'students.read',
      handler: routes.getStudentAcademicHistory,
    },
    {
      method: 'POST',
      path: '/students/bulk-import',
      requiredPermission: 'students.write',
      validation: {
        body: z.object({
          students: z.array(
            z.object({
              admissionNo: z.string().min(1),
              name: z.string().min(1),
              gender: z.string().optional(),
              dateOfBirth: z.string().optional(),
              classId: z.string().uuid(),
              sectionId: z.string().uuid(),
              rollNo: z.string().optional(),
              customFields: z.record(z.any()).optional(),
            })
          ),
        }),
      },
      handler: routes.bulkImportStudents,
    },
    { method: 'GET', path: '/enrollments', requiredPermission: 'students.read', handler: routes.listEnrollments },
    {
      method: 'POST',
      path: '/enrollments',
      requiredPermission: 'students.write',
      validation: {
        body: z.object({
          studentId: z.string().uuid(),
          academicYearId: z.string().uuid(),
          classId: z.string().uuid(),
          sectionId: z.string().uuid(),
          rollNo: z.string().optional(),
        }),
      },
      handler: routes.createEnrollment,
    },

    // In-App & Push Notifications
    { method: 'GET', path: '/notifications', requiredPermission: '', handler: routes.listNotifications },
    { method: 'PATCH', path: '/notifications/:id/read', requiredPermission: '', handler: routes.markNotificationRead },
    { method: 'POST', path: '/notifications/read-all', requiredPermission: '', handler: routes.markAllNotificationsRead },

    // Staff Task Management
    { method: 'GET', path: '/tasks', requiredPermission: 'tasks.read', handler: routes.listTasks },
    {
      method: 'POST',
      path: '/tasks',
      requiredPermission: 'tasks.manage',
      validation: {
        body: z.object({
          assigneeMembershipId: z.string().uuid(),
          title: z.string().min(1),
          description: z.string().optional(),
          priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
          dueDate: z.string().optional(),
        }),
      },
      handler: routes.createTask,
    },
    {
      method: 'PATCH',
      path: '/tasks/:id/status',
      requiredPermission: 'tasks.read',
      validation: {
        body: z.object({
          status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
        }),
      },
      handler: routes.updateTaskStatus,
    },
    { method: 'DELETE', path: '/tasks/:id', requiredPermission: 'tasks.manage', handler: routes.deleteTask },

    // Institution Settings
    { method: 'GET', path: '/institution/settings', requiredPermission: '', handler: routes.getInstitutionSettings },
    {
      method: 'PATCH',
      path: '/institution/settings',
      requiredPermission: 'settings.manage',
      handler: routes.updateInstitutionSettings,
    },

    // Unified 1-Click Academic Migration & Roster Setup
    {
      method: 'POST',
      path: '/academic/unified-import',
      requiredPermission: 'classes.manage',
      handler: routes.bulkImportAcademicRoster,
    },
  ],

  widgets: [],

  navItem: [
    { label: 'Students', path: '/students', requiredPermission: 'students.read', sortOrder: 1 },
    { label: 'Academic & Timetable', path: '/academic', requiredPermission: 'classes.manage', sortOrder: 2 },
    { label: 'Tasks', path: '/tasks', requiredPermission: 'tasks.read', sortOrder: 6 },
    { label: 'Members', path: '/members', requiredPermission: 'memberships.manage', sortOrder: 8 },
    { label: 'Permission Matrix', path: '/permission-matrix', requiredPermission: 'roles.manage', sortOrder: 9 },
    { label: 'Activity Log', path: '/activity-log', requiredPermission: 'audit_logs.read', sortOrder: 10 },
    { label: 'Settings', path: '/settings', requiredPermission: 'settings.manage', sortOrder: 11 },
  ],
};
