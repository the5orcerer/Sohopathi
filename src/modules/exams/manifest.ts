import { ModuleManifest } from '../../core/registry/types';
import * as routes from './routes';
import { z } from 'zod';

export const examsManifest: ModuleManifest = {
  id: 'exams',
  name: 'Examinations',
  version: '1.0.0',
  dependsOn: ['core'],

  permissions: [
    { key: 'exam.read', description: 'View examinations and papers', scopeOptions: ['institution', 'class', 'section', 'self'] },
    { key: 'exam.create', description: 'Create examinations and papers', scopeOptions: ['institution'] },
    { key: 'exam.update', description: 'Edit examinations and papers', scopeOptions: ['institution'] },
    { key: 'exam.delete', description: 'Delete examinations and papers', scopeOptions: ['institution'] },
    { key: 'exam.room.manage', description: 'Manage examination rooms and invigilators', scopeOptions: ['institution'] },
    { key: 'exam.candidate.manage', description: 'Manage exam candidates and eligibility', scopeOptions: ['institution'] },
    { key: 'exam.marks.read', description: 'View examination marks', scopeOptions: ['institution', 'assigned_sections', 'self'] },
    { key: 'exam.marks.write', description: 'Enter examination marks', scopeOptions: ['assigned_sections', 'institution'] },
    { key: 'exam.publish', description: 'Publish examination results and lock marks', scopeOptions: ['institution'] },
    { key: 'exam.result.reopen', description: 'Reopen published exam results for re-scrutiny', scopeOptions: ['institution'] },
  ],

  routes: [
    // Standard /api/exams endpoints
    { method: 'GET', path: '', requiredPermission: 'exam.read', handler: routes.listExams },
    {
      method: 'POST',
      path: '',
      requiredPermission: 'exam.create',
      validation: {
        body: z.object({
          academicYearId: z.string().uuid(),
          name: z.string().min(1),
          term: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          examType: z.string().optional(),
          examControllerMembershipId: z.string().uuid().nullable().optional(),
          classId: z.string().uuid().nullable().optional(),
          sectionId: z.string().uuid().nullable().optional(),
          description: z.string().nullable().optional(),
          instructions: z.string().nullable().optional(),
          gradingSystem: z.string().optional(),
          syllabusRemarks: z.string().nullable().optional(),
          eligibleStudentIds: z.array(z.string()).nullable().optional(),
        }),
      },
      handler: routes.createExam,
    },
    { method: 'GET', path: '/:id', requiredPermission: 'exam.read', handler: routes.getExam },
    {
      method: 'PATCH',
      path: '/:id',
      requiredPermission: 'exam.update',
      validation: {
        body: z.object({
          name: z.string().min(1).optional(),
          term: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          isPublished: z.boolean().optional(),
          status: z.enum(['draft', 'scheduled', 'running', 'marks_collection', 'under_review', 'ready_to_publish', 'published', 'reopened', 'archived']).optional(),
          examType: z.string().optional(),
          examControllerMembershipId: z.string().uuid().nullable().optional(),
          classId: z.string().uuid().nullable().optional(),
          sectionId: z.string().uuid().nullable().optional(),
          description: z.string().nullable().optional(),
          instructions: z.string().nullable().optional(),
          gradingSystem: z.string().optional(),
          syllabusRemarks: z.string().nullable().optional(),
          eligibleStudentIds: z.array(z.string()).nullable().optional(),
        }),
      },
      handler: routes.updateExam,
    },
    { method: 'DELETE', path: '/:id', requiredPermission: 'exam.delete', handler: routes.deleteExam },

    // Candidates
    { method: 'GET', path: '/:id/candidates', requiredPermission: 'exam.read', handler: routes.listCandidates },
    {
      method: 'POST',
      path: '/:id/candidates/snapshot',
      requiredPermission: 'exam.update',
      validation: {
        body: z.object({
          classId: z.string().uuid().optional(),
          sectionId: z.string().uuid().optional(),
          gender: z.string().optional(),
          rollRangeStart: z.number().int().min(1).optional(),
          rollRangeEnd: z.number().int().min(1).optional(),
          studentIds: z.array(z.string()).optional(),
        }),
      },
      handler: routes.snapshotCandidates,
    },

    // Papers
    { method: 'GET', path: '/:id/papers', requiredPermission: 'exam.read', handler: routes.listPapers },
    {
      method: 'POST',
      path: '/:id/papers',
      requiredPermission: 'exam.create',
      validation: {
        body: z.object({
          subjectId: z.string().uuid(),
          teacherMembershipId: z.string().uuid().nullable().optional(),
          examDate: z.string().nullable().optional(),
          startTime: z.string().nullable().optional(),
          endTime: z.string().nullable().optional(),
          roomNo: z.string().nullable().optional(),
          maxMarks: z.number().min(1).optional(),
          passMarks: z.number().min(1).optional(),
          theoryWeight: z.number().min(0).optional(),
          practicalWeight: z.number().min(0).optional(),
          vivaWeight: z.number().min(0).optional(),
          syllabus: z.string().nullable().optional(),
        }),
      },
      handler: routes.createPaper,
    },
    { method: 'DELETE', path: '/:id/papers/:paperId', requiredPermission: 'exam.delete', handler: routes.deletePaper },

    // Rooms & Guards
    { method: 'GET', path: '/:id/rooms', requiredPermission: 'exam.read', handler: routes.listRooms },
    {
      method: 'POST',
      path: '/:id/rooms',
      requiredPermission: 'exam.room.manage',
      validation: {
        body: z.object({
          roomNumber: z.string().min(1),
          building: z.string().nullable().optional(),
          floor: z.string().nullable().optional(),
          capacity: z.number().int().min(1).optional(),
          guardMembershipIds: z.array(z.string()).optional(),
          studentIds: z.array(z.string()).optional(),
        }),
      },
      handler: routes.createRoom,
    },
    { method: 'DELETE', path: '/:id/rooms/:roomId', requiredPermission: 'exam.room.manage', handler: routes.deleteRoom },

    // Marks
    { method: 'GET', path: '/marks', requiredPermission: 'exam.marks.read', handler: routes.fetchMarks },
    { method: 'GET', path: '/:id/marks', requiredPermission: 'exam.marks.read', handler: routes.fetchMarks },
    {
      method: 'POST',
      path: '/marks',
      requiredPermission: 'exam.marks.write',
      validation: {
        body: z.union([
          z.array(
            z.object({
              examId: z.string().uuid(),
              studentId: z.string().uuid(),
              subjectId: z.string().uuid(),
              marksObtained: z.number().nullable().optional(),
              maxMarks: z.number().min(1),
              theoryMarks: z.number().nullable().optional(),
              practicalMarks: z.number().nullable().optional(),
              vivaMarks: z.number().nullable().optional(),
              mcqMarks: z.number().nullable().optional(),
              attendanceMarks: z.number().nullable().optional(),
              graceMarks: z.number().nullable().optional(),
              isAbsent: z.boolean().optional(),
              isExempt: z.boolean().optional(),
              remarks: z.string().nullable().optional(),
            })
          ),
          z.object({
            marks: z.array(
              z.object({
                examId: z.string().uuid(),
                studentId: z.string().uuid(),
                subjectId: z.string().uuid(),
                marksObtained: z.number().nullable().optional(),
                maxMarks: z.number().min(1),
                theoryMarks: z.number().nullable().optional(),
                practicalMarks: z.number().nullable().optional(),
                vivaMarks: z.number().nullable().optional(),
                mcqMarks: z.number().nullable().optional(),
                attendanceMarks: z.number().nullable().optional(),
                graceMarks: z.number().nullable().optional(),
                isAbsent: z.boolean().optional(),
                isExempt: z.boolean().optional(),
                remarks: z.string().nullable().optional(),
              })
            ),
          }),
        ]),
      },
      handler: routes.recordMarks,
    },

    // Progress & Reminders
    { method: 'GET', path: '/:id/progress', requiredPermission: 'exam.read', handler: routes.getExamProgress },
    { method: 'POST', path: '/:id/notify-pending', requiredPermission: 'exam.update', handler: routes.notifyPendingTeachers },

    // Publication & Reopening
    { method: 'POST', path: '/:id/publish', requiredPermission: 'exam.publish', handler: routes.publishExam },
    {
      method: 'POST',
      path: '/:id/reopen',
      requiredPermission: 'exam.result.reopen',
      validation: {
        body: z.object({
          reason: z.string().trim().min(1).max(1000),
        }),
      },
      handler: routes.reopenExam,
    },

    // =========================================================================
    // Legacy / Frontend Compatibility Aliases (`/api/attendance/exams`)
    // =========================================================================
    { method: 'GET', path: '/api/attendance/exams', requiredPermission: 'exam.read', handler: routes.listExams },
    { method: 'POST', path: '/api/attendance/exams', requiredPermission: 'exam.create', handler: routes.createExam },
    { method: 'PATCH', path: '/api/attendance/exams/:id', requiredPermission: 'exam.update', handler: routes.updateExam },
    { method: 'DELETE', path: '/api/attendance/exams/:id', requiredPermission: 'exam.delete', handler: routes.deleteExam },
    { method: 'GET', path: '/api/attendance/exams/:id/papers', requiredPermission: 'exam.read', handler: routes.listPapers },
    { method: 'POST', path: '/api/attendance/exams/:id/papers', requiredPermission: 'exam.create', handler: routes.createPaper },
    { method: 'DELETE', path: '/api/attendance/exams/:id/papers/:paperId', requiredPermission: 'exam.delete', handler: routes.deletePaper },
    { method: 'GET', path: '/api/attendance/exams/:id/rooms', requiredPermission: 'exam.read', handler: routes.listRooms },
    { method: 'POST', path: '/api/attendance/exams/:id/rooms', requiredPermission: 'exam.room.manage', handler: routes.createRoom },
    { method: 'DELETE', path: '/api/attendance/exams/:id/rooms/:roomId', requiredPermission: 'exam.room.manage', handler: routes.deleteRoom },
    { method: 'GET', path: '/api/attendance/exams/:id/progress', requiredPermission: 'exam.read', handler: routes.getExamProgress },
    { method: 'POST', path: '/api/attendance/exams/:id/notify-pending', requiredPermission: 'exam.update', handler: routes.notifyPendingTeachers },
    { method: 'POST', path: '/api/attendance/exams/:id/publish', requiredPermission: 'exam.publish', handler: routes.publishExam },
    { method: 'POST', path: '/api/attendance/exams/:id/reopen', requiredPermission: 'exam.result.reopen', handler: routes.reopenExam },
    { method: 'GET', path: '/api/attendance/marks', requiredPermission: 'exam.marks.read', handler: routes.fetchMarks },
    { method: 'POST', path: '/api/attendance/marks', requiredPermission: 'exam.marks.write', handler: routes.recordMarks },
  ],

  widgets: [
    {
      id: 'exam_overview',
      requiredPermissions: ['exam.read'],
      defaultSize: { width: 3, height: 2 },
      dataSource: '/api/exams',
      renderer: 'ExamOverviewWidget',
    },
  ],

  events: {
    publishes: ['exam.created', 'exam.updated', 'exam.published', 'exam.reopened', 'mark.entered'],
    subscribes: [],
  },
};
