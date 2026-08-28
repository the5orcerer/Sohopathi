import { ModuleManifest } from '../../core/registry/types';
import * as routes from './routes';
import { z } from 'zod';

export const assignmentsManifest: ModuleManifest = {
  id: 'assignments',
  name: 'Assignments',
  version: '1.0.0',
  dependsOn: ['core'],

  permissions: [
    { key: 'assignments.read', description: 'View assignments', scopeOptions: ['institution', 'assigned_sections', 'self'] },
    { key: 'assignments.create', description: 'Create assignments', scopeOptions: ['assigned_sections'] },
    { key: 'assignments.update', description: 'Edit an assignment', scopeOptions: ['assigned_sections', 'self'] },
    { key: 'assignments.delete', description: 'Delete an assignment', scopeOptions: ['assigned_sections'] },
    { key: 'assignments.submit', description: 'Submit work', scopeOptions: ['self'] },
    { key: 'assignments.grade', description: 'Grade a submission', scopeOptions: ['assigned_sections'] },
  ],

  routes: [
    { method: 'GET', path: '', requiredPermission: 'assignments.read', handler: routes.listAssignments },
    { method: 'GET', path: '/stats', requiredPermission: 'assignments.grade', handler: routes.getAssignmentStats },
    {
      method: 'POST',
      path: '',
      requiredPermission: 'assignments.create',
      validation: {
        body: z.object({
          sectionId: z.string().uuid(),
          subjectId: z.string().uuid(),
          title: z.string().min(1),
          description: z.string().optional(),
          dueDate: z.string().optional(),
        }),
      },
      handler: routes.createAssignment,
    },
    { method: 'PATCH', path: '/:id', requiredPermission: 'assignments.update', handler: routes.updateAssignment },
    { method: 'DELETE', path: '/:id', requiredPermission: 'assignments.delete', handler: routes.deleteAssignment },
    {
      method: 'POST',
      path: '/:id/attachments/presigned-url',
      requiredPermission: 'assignments.create',
      validation: {
        body: z.object({
          fileName: z.string().min(1),
          contentType: z.string().optional(),
        }),
      },
      handler: routes.requestUploadPresignedUrl,
    },
    {
      method: 'POST',
      path: '/:id/attachments',
      requiredPermission: 'assignments.create',
      validation: {
        body: z.object({
          fileKey: z.string().min(1),
          fileName: z.string().min(1),
        }),
      },
      handler: routes.addAttachment,
    },
    {
      method: 'POST',
      path: '/:id/submit',
      requiredPermission: 'assignments.submit',
      handler: routes.submitAssignment,
    },
    {
      method: 'POST',
      path: '/grade',
      requiredPermission: 'assignments.grade',
      validation: {
        body: z.object({
          submissionId: z.string().uuid(),
          grade: z.string().min(1),
          feedback: z.string().optional(),
        }),
      },
      handler: routes.gradeSubmission,
    },
  ],

  widgets: [
    {
      id: 'assignment_list',
      requiredPermissions: ['assignments.read'],
      defaultSize: { width: 4, height: 2 },
      dataSource: '/api/assignments',
      renderer: 'AssignmentList',
    },
    {
      id: 'pending_assignments',
      requiredPermissions: ['assignments.submit'],
      defaultSize: { width: 4, height: 2 },
      dataSource: '/api/assignments?status=pending',
      renderer: 'PendingAssignments',
    },
    {
      id: 'assignment_statistics',
      requiredPermissions: ['assignments.grade'],
      defaultSize: { width: 6, height: 3 },
      dataSource: '/api/assignments/stats',
      renderer: 'AssignmentStatistics',
    },
  ],

  navItem: { label: 'Assignments', path: '/assignments', requiredPermission: 'assignments.read', sortOrder: 5 },

  events: {
    publishes: ['assignment.created', 'assignment.submitted', 'assignment.graded'],
    subscribes: [],
  },

  storage: [
    { bucket: 'primary', pattern: 'institutions/{institution_id}/assignments/{assignment_id}/{file}' },
  ],
};
