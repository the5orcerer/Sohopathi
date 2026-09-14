import { ModuleManifest } from '../../core/registry/types';
import * as routes from './routes';
import { z } from 'zod';

export const attendanceManifest: ModuleManifest = {
  id: 'attendance',
  name: 'Attendance & Marks',
  version: '1.0.0',
  dependsOn: ['core'],

  permissions: [
    { key: 'attendance.read', description: 'View attendance records', scopeOptions: ['institution', 'assigned_sections', 'self'] },
    { key: 'attendance.create', description: 'Take attendance for assigned sections', scopeOptions: ['assigned_sections', 'institution'] },
    { key: 'attendance.employee.read', description: 'View employee and staff attendance records', scopeOptions: ['institution', 'self'] },
    { key: 'attendance.employee.create', description: 'Record and manage daily employee attendance', scopeOptions: ['institution', 'self'] },
    { key: 'exams.manage', description: 'Create and configure examination sessions and paper schedules', scopeOptions: ['institution'] },
    { key: 'marks.read', description: 'View student marks', scopeOptions: ['institution', 'assigned_sections', 'self'] },
    { key: 'marks.create', description: 'Enter marks for assigned sections', scopeOptions: ['assigned_sections', 'institution'] },
    { key: 'marks.approve', description: 'Approve marks before publishing', scopeOptions: ['institution'] },
  ],

  routes: [
    { method: 'GET', path: '/summary', requiredPermission: 'attendance.read', handler: routes.getAttendanceSummary },
    { method: 'GET', path: '/sheet', requiredPermission: 'attendance.read', handler: routes.getAttendanceSheet },
    { method: 'GET', path: '', requiredPermission: 'attendance.read', handler: routes.listAttendance },
    {
      method: 'POST',
      path: '',
      requiredPermission: 'attendance.create',
      validation: {
        body: z.object({
          records: z.array(
            z.object({
              studentId: z.string().uuid(),
              sectionId: z.string().uuid(),
              date: z.string(),
              status: z.string(),
              sessionType: z.string().optional(),
              periodNumber: z.number().int().min(1).optional(),
              subjectId: z.string().uuid().optional().nullable(),
              remarks: z.string().optional().nullable(),
              reason: z.string().optional().nullable(),
            })
          ),
        }),
      },
      handler: routes.markAttendance,
    },

    // Employee Attendance
    { method: 'GET', path: '/employees', requiredPermission: 'attendance.employee.read', handler: routes.listEmployeeAttendance },
    {
      method: 'POST',
      path: '/employees',
      requiredPermission: 'attendance.employee.create',
      validation: {
        body: z.object({
          records: z.array(
            z.object({
              membershipId: z.string().uuid(),
              date: z.string(),
              status: z.string(),
              checkInTime: z.string().optional(),
              checkOutTime: z.string().optional(),
              notes: z.string().optional(),
              reason: z.string().optional().nullable(),
            })
          ),
        }),
      },
      handler: routes.markEmployeeAttendance,
    },
    { method: 'GET', path: '/employees/summary', requiredPermission: 'attendance.employee.read', handler: routes.getEmployeeAttendanceSummary },

    // Examinations
    { method: 'GET', path: '/exams', requiredPermission: 'marks.read', handler: routes.listExams },
    {
      method: 'POST',
      path: '/exams',
      requiredPermission: 'exams.manage',
      validation: {
        body: z.object({
          academicYearId: z.string().uuid(),
          name: z.string().min(1),
          term: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          examType: z.enum(['term', 'class_test']).optional(),
          examControllerMembershipId: z.string().uuid().optional().nullable(),
          classId: z.string().uuid().optional().nullable(),
          sectionId: z.string().uuid().optional().nullable(),
          syllabusRemarks: z.string().optional().nullable(),
          eligibleStudentIds: z.array(z.string().uuid()).optional().nullable(),
        }),
      },
      handler: routes.createExam,
    },
    {
      method: 'PATCH',
      path: '/exams/:id',
      requiredPermission: 'exams.manage',
      handler: routes.updateExam,
    },
    {
      method: 'DELETE',
      path: '/exams/:id',
      requiredPermission: 'exams.manage',
      handler: routes.deleteExam,
    },
    { method: 'GET', path: '/exams/:id/progress', requiredPermission: 'marks.read', handler: routes.getExamProgress },
    { method: 'POST', path: '/exams/:id/notify-pending', requiredPermission: 'exams.manage', handler: routes.notifyPendingTeachers },
    { method: 'POST', path: '/exams/:id/publish', requiredPermission: 'exams.manage', handler: routes.publishExam },
    { method: 'GET', path: '/exams/:id/rooms', requiredPermission: 'marks.read', handler: routes.listExamRooms },
    {
      method: 'POST',
      path: '/exams/:id/rooms',
      requiredPermission: 'exams.manage',
      handler: routes.createExamRoom,
    },
    {
      method: 'DELETE',
      path: '/exams/:id/rooms/:roomId',
      requiredPermission: 'exams.manage',
      handler: routes.deleteExamRoom,
    },
    { method: 'GET', path: '/exams/:id/papers', requiredPermission: 'marks.read', handler: routes.listExamPapers },
    {
      method: 'POST',
      path: '/exams/:id/papers',
      requiredPermission: 'exams.manage',
      validation: {
        body: z.object({
          subjectId: z.string().uuid(),
          examDate: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          roomNo: z.string().optional(),
          maxMarks: z.number().optional(),
          passMarks: z.number().optional(),
          theoryWeight: z.number().optional(),
          practicalWeight: z.number().optional(),
          vivaWeight: z.number().optional(),
          teacherMembershipId: z.string().uuid().optional().nullable(),
          syllabus: z.string().optional().nullable(),
        }),
      },
      handler: routes.createExamPaper,
    },
    {
      method: 'DELETE',
      path: '/exams/:id/papers/:paperId',
      requiredPermission: 'exams.manage',
      handler: routes.deleteExamPaper,
    },

    // Marks & Scoring
    { method: 'GET', path: '/marks', requiredPermission: 'marks.read', handler: routes.listMarks },
    {
      method: 'POST',
      path: '/marks',
      requiredPermission: 'marks.create',
      validation: {
        body: z.object({
          marks: z.array(
            z.object({
              examId: z.string().uuid(),
              studentId: z.string().uuid(),
              subjectId: z.string().uuid(),
              marksObtained: z.number().optional(),
              maxMarks: z.number(),
              grade: z.string().optional(),
              remarks: z.string().optional().nullable(),
              isRechecked: z.boolean().optional(),
              recheckedByMembershipId: z.string().uuid().optional().nullable(),
            })
          ),
        }),
      },
      handler: routes.recordMarks,
    },
  ],

  widgets: [
    {
      id: 'attendance_summary',
      requiredPermissions: ['attendance.read'],
      defaultSize: { width: 4, height: 2 },
      dataSource: '/api/attendance/summary',
      renderer: 'AttendanceSummary',
    },
  ],

  navItem: [
    { label: 'Attendance', path: '/attendance', requiredPermission: 'attendance.read', sortOrder: 3 },
    { label: 'Examinations', path: '/examinations', requiredPermission: 'marks.read', sortOrder: 4 },
  ],
};
