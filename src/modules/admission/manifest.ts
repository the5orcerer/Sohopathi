import { ModuleManifest } from '../../core/registry/types';
import {
  listApplications,
  getAdmissionStats,
  getApplicationDetail,
  createApplication,
  updateApplication,
  admitStudent,
  deleteApplication,
} from './routes';
import { z } from 'zod';

export const admissionManifest: ModuleManifest = {
  id: 'admissions',
  name: 'Admissions & Inquiries',
  version: '1.0.0',
  dependsOn: ['core'],

  permissions: [
    { key: 'admissions.read', description: 'View admission applications and metrics', scopeOptions: ['institution', 'assigned_sections', 'self'] },
    { key: 'admissions.write', description: 'Submit and update admission applications', scopeOptions: ['institution'] },
    { key: 'admissions.approve', description: 'Approve admission applications and enroll students', scopeOptions: ['institution'] },
  ],

  routes: [
    { method: 'GET', path: '', requiredPermission: 'admissions.read', handler: listApplications },
    { method: 'GET', path: '/stats', requiredPermission: 'admissions.read', handler: getAdmissionStats },
    { method: 'GET', path: '/:id', requiredPermission: 'admissions.read', handler: getApplicationDetail },
    {
      method: 'POST',
      path: '',
      requiredPermission: 'admissions.write',
      validation: {
        body: z.object({
          applicantName: z.string().min(1),
          guardianName: z.string().min(1),
          guardianPhone: z.string().min(1),
          classId: z.string().optional(),
          academicYearId: z.string().optional(),
          dateOfBirth: z.string().optional(),
          gender: z.string().optional(),
          guardianEmail: z.string().optional(),
          guardianRelation: z.string().optional(),
          address: z.string().optional(),
          previousSchool: z.string().optional(),
          applicationFee: z.number().optional(),
          feeStatus: z.string().optional(),
          notes: z.string().optional(),
        }),
      },
      handler: createApplication,
    },
    {
      method: 'PATCH',
      path: '/:id',
      requiredPermission: 'admissions.write',
      validation: {
        body: z.object({
          status: z.enum(['submitted', 'under_review', 'shortlisted', 'admitted', 'rejected']).optional(),
          feeStatus: z.enum(['unpaid', 'paid', 'waived']).optional(),
          notes: z.string().optional(),
          classId: z.string().optional(),
        }),
      },
      handler: updateApplication,
    },
    {
      method: 'POST',
      path: '/:id/admit',
      requiredPermission: 'admissions.approve',
      validation: {
        body: z.object({
          sectionId: z.string().min(1),
          admissionNo: z.string().optional(),
          rollNo: z.string().optional(),
          academicYearId: z.string().optional(),
        }),
      },
      handler: admitStudent,
    },
    { method: 'DELETE', path: '/:id', requiredPermission: 'admissions.write', handler: deleteApplication },
  ],

  widgets: [
    {
      id: 'recent_admissions',
      requiredPermissions: ['admissions.read'],
      defaultSize: { width: 6, height: 4 },
      dataSource: '/api/admissions?limit=5',
      renderer: 'RecentAdmissions',
    },
    {
      id: 'admission_stats',
      requiredPermissions: ['admissions.read'],
      defaultSize: { width: 6, height: 3 },
      dataSource: '/api/admissions/stats',
      renderer: 'AdmissionStatsWidget',
    },
  ],

  navItem: { label: 'Admissions', path: '/admissions', requiredPermission: 'admissions.read', sortOrder: 1.5 },

  events: {
    publishes: ['admission.submitted', 'admission.admitted'],
    subscribes: [],
  },
};
