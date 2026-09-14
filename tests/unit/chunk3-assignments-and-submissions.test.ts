import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignmentsManifest } from '../../src/modules/assignments/manifest';
import { assignmentRepository, getAssignmentSubmissionStoragePath } from '../../src/modules/assignments/repository';

describe('Chunk 3: Academic Assignments & Submissions Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Assignments Manifest Route Validation (Sections 19, 20, 21, 22)', () => {
    it('validates assignment creation schema with instructions, maxMarks, status, and allowLateSubmissions', () => {
      const createRoute = assignmentsManifest.routes.find((r) => r.method === 'POST' && r.path === '');
      const validator = createRoute?.validation?.body;
      expect(validator).toBeDefined();

      const validPayload = {
        sectionId: '11111111-1111-1111-1111-111111111111',
        subjectId: '22222222-2222-2222-2222-222222222222',
        title: 'Midterm Physics Lab Deliverable',
        description: 'Prepare lab report with calculated friction coefficients',
        instructions: 'Include step-by-step calculations and plot diagrams on graph paper.',
        dueDate: '2026-10-15T23:59:59.000Z',
        maxMarks: 100,
        status: 'published',
        allowLateSubmissions: true,
      };

      const result = validator?.safeParse(validPayload);
      expect(result?.success).toBe(true);
      if (result?.success) {
        expect(result.data.title).toBe('Midterm Physics Lab Deliverable');
        expect(result.data.instructions).toBe('Include step-by-step calculations and plot diagrams on graph paper.');
        expect(result.data.maxMarks).toBe(100);
        expect(result.data.status).toBe('published');
        expect(result.data.allowLateSubmissions).toBe(true);
      }
    });

    it('rejects invalid assignment status during creation', () => {
      const createRoute = assignmentsManifest.routes.find((r) => r.method === 'POST' && r.path === '');
      const validator = createRoute?.validation?.body;

      const invalidPayload = {
        sectionId: '11111111-1111-1111-1111-111111111111',
        subjectId: '22222222-2222-2222-2222-222222222222',
        title: 'Invalid Assignment Status',
        status: 'archived_invalid_status',
      };

      const result = validator?.safeParse(invalidPayload);
      expect(result?.success).toBe(false);
    });

    it('validates student submission schema with detached metadata and notes', () => {
      const submitRoute = assignmentsManifest.routes.find((r) => r.method === 'POST' && r.path === '/:id/submit');
      const validator = submitRoute?.validation?.body;
      expect(validator).toBeDefined();

      const validPayload = {
        fileKey: '/institutions/inst-1/assignments/asgn-1/submissions/st-1/lab_solution.pdf',
        fileName: 'lab_solution.pdf',
        fileSize: 1048576,
        mimeType: 'application/pdf',
        submissionNotes: 'All questions solved with clear diagrams.',
      };

      const result = validator?.safeParse(validPayload);
      expect(result?.success).toBe(true);
      if (result?.success) {
        expect(result.data.fileName).toBe('lab_solution.pdf');
        expect(result.data.fileSize).toBe(1048576);
        expect(result.data.mimeType).toBe('application/pdf');
      }
    });

    it('validates teacher reopen schema requiring a non-empty reason', () => {
      const reopenRoute = assignmentsManifest.routes.find(
        (r) => r.method === 'POST' && r.path === '/:id/submissions/:submissionId/reopen'
      );
      const validator = reopenRoute?.validation?.body;
      expect(validator).toBeDefined();

      // Empty reason should fail
      const emptyResult = validator?.safeParse({ reason: '' });
      expect(emptyResult?.success).toBe(false);

      // Valid reason should succeed
      const validResult = validator?.safeParse({
        reason: 'Page 3 is unreadable due to blur. Please re-upload with clear lighting.',
      });
      expect(validResult?.success).toBe(true);
    });

    it('validates grading submission schema accepting numerical marks and letter grade', () => {
      const gradeRoute = assignmentsManifest.routes.find((r) => r.method === 'POST' && r.path === '/grade');
      const validator = gradeRoute?.validation?.body;
      expect(validator).toBeDefined();

      const validPayload = {
        submissionId: '33333333-3333-3333-3333-333333333333',
        grade: 'A+',
        marksObtained: 95,
        feedback: 'Excellent work and neat graph plots.',
      };

      const result = validator?.safeParse(validPayload);
      expect(result?.success).toBe(true);
      if (result?.success) {
        expect(result.data.marksObtained).toBe(95);
        expect(result.data.grade).toBe('A+');
      }
    });
  });

  describe('Detached Storage Path Construction (Section 48)', () => {
    it('generates canonical detached storage path without raw binary storage in db', () => {
      const path = getAssignmentSubmissionStoragePath(
        'inst-xyz-10',
        'asgn-77',
        'student-42',
        'my homework! (v1).pdf'
      );
      expect(path).toBe('/institutions/inst-xyz-10/assignments/asgn-77/submissions/student-42/my_homework___v1_.pdf');
    });
  });

  describe('Assignment Creation & Default Values (Sections 19, 51)', () => {
    it('creates assignment with default published status, 100 maxMarks, and logs audit', async () => {
      const validAsgnId = '11111111-1111-1111-1111-111111111111';
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('insert into assignment')) {
          return Promise.resolve({
            rows: [
              {
                id: validAsgnId,
                institutionId: 'inst-1',
                sectionId: 'sec-1',
                subjectId: 'sub-1',
                title: 'Math Assignment 1',
                description: null,
                instructions: null,
                dueDate: null,
                maxMarks: 100,
                status: 'published',
                allowLateSubmissions: false,
                createdByMembershipId: 'teacher-1',
                createdAt: '2026-09-15T00:00:00.000Z',
              },
            ],
          });
        }
        if (sql.includes('insert into audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('select s.user_id')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const assignment = await assignmentRepository.create(client, 'inst-1', 'teacher-1', {
        sectionId: 'sec-1',
        subjectId: 'sub-1',
        title: 'Math Assignment 1',
      });

      expect(assignment.id).toBe(validAsgnId);
      expect(assignment.maxMarks).toBe(100);
      expect(assignment.status).toBe('published');

      // Verify audit was logged
      const auditCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('insert into audit_log')
      );
      expect(auditCalls).toHaveLength(1);
      const [sql, params] = auditCalls[0];
      expect(params[0]).toBe('inst-1');
      expect(params[1]).toBe('teacher-1');
      expect(params[2]).toBe('create');
      expect(params[3]).toBe('assignment');
      expect(params[4]).toBe(validAsgnId);
    });

    it('rejects assignment creation when title exceeds content limits', async () => {
      const client = { query: vi.fn() } as any;
      const excessivelyLongTitle = 'A'.repeat(500);

      await expect(
        assignmentRepository.create(client, 'inst-1', 'teacher-1', {
          sectionId: 'sec-1',
          subjectId: 'sub-1',
          title: excessivelyLongTitle,
        })
      ).rejects.toThrow(/exceeds maximum length/i);
    });
  });

  describe('Student Assignment Visibility & Draft Hiding (Section 19)', () => {
    it('applies draft filter when excludeDrafts is true', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const client = { query: mockQuery } as any;

      await assignmentRepository.list(client, 'inst-1', {
        excludeDrafts: true,
      });

      const queryCall = mockQuery.mock.calls[0];
      const sql = queryCall[0];
      expect(sql).toContain("coalesce(a.status, 'published') != 'draft'");
    });
  });

  describe('Submission Locking & Reopen Lifecycle (Sections 20, 21)', () => {
    it('rejects duplicate student submission when status is already submitted (submission locking)', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from assignment where id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'asgn-1',
                status: 'published',
                dueDate: null,
                allowLateSubmissions: true,
                title: 'History Essay',
                sectionId: 'sec-1',
                subjectId: 'sub-1',
                createdByMembershipId: 'teacher-1',
              },
            ],
          });
        }
        if (sql.includes('from assignment_submission')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sub-10',
                status: 'submitted',
                submitted_at: '2026-09-10T10:00:00Z',
                reopen_reason: null,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      await expect(
        assignmentRepository.submitAssignment(client, 'inst-1', 'asgn-1', 'student-1', {
          fileName: 'revised_essay.pdf',
        })
      ).rejects.toThrow('SUBMISSION_LOCKED');
    });

    it('rejects student submission when status is marked', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from assignment where id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'asgn-1',
                status: 'published',
                dueDate: null,
                allowLateSubmissions: true,
                title: 'History Essay',
                sectionId: 'sec-1',
                subjectId: 'sub-1',
                createdByMembershipId: 'teacher-1',
              },
            ],
          });
        }
        if (sql.includes('from assignment_submission')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sub-10',
                status: 'marked',
                submitted_at: '2026-09-10T10:00:00Z',
                reopen_reason: null,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      await expect(
        assignmentRepository.submitAssignment(client, 'inst-1', 'asgn-1', 'student-1', {
          fileName: 'revised_essay.pdf',
        })
      ).rejects.toThrow('SUBMISSION_LOCKED');
    });

    it('permits resubmission when existing submission has been reopened by teacher', async () => {
      const validSubId = '22222222-2222-2222-2222-222222222222';
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from assignment where id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'asgn-1',
                status: 'published',
                dueDate: null,
                allowLateSubmissions: true,
                title: 'History Essay',
                sectionId: 'sec-1',
                subjectId: 'sub-1',
                createdByMembershipId: 'teacher-1',
              },
            ],
          });
        }
        if (sql.includes('from assignment_submission') && sql.includes('reopen_reason')) {
          return Promise.resolve({
            rows: [
              {
                id: validSubId,
                status: 'reopened',
                submitted_at: '2026-09-10T10:00:00Z',
                reopen_reason: 'Please upload scanned copy of handwritten pages',
              },
            ],
          });
        }
        if (sql.includes('insert into assignment_submission')) {
          return Promise.resolve({
            rows: [
              {
                id: validSubId,
                institutionId: 'inst-1',
                assignmentId: 'asgn-1',
                studentId: 'student-1',
                fileName: 'resubmitted_essay.pdf',
                status: 'submitted',
                isLate: false,
                reopenedAt: null,
                reopenReason: null,
              },
            ],
          });
        }
        if (sql.includes('insert into audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('select name from student')) {
          return Promise.resolve({ rows: [{ name: 'Rahim' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const sub = await assignmentRepository.submitAssignment(client, 'inst-1', 'asgn-1', 'student-1', {
        fileName: 'resubmitted_essay.pdf',
      });

      expect(sub.status).toBe('submitted');
      expect(sub.fileName).toBe('resubmitted_essay.pdf');

      // Check audit action was 'resubmit'
      const auditCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('insert into audit_log')
      );
      expect(auditCalls).toHaveLength(1);
      const [sql, auditParams] = auditCalls[0];
      expect(auditParams[2]).toBe('resubmit');
    });

    it('enforces deadline check: throws DEADLINE_PASSED when past due and allowLateSubmissions is false', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from assignment where id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'asgn-past',
                status: 'published',
                dueDate: '2020-01-01T00:00:00Z', // In the past!
                allowLateSubmissions: false,
                title: 'Strict Deadline Exam',
                sectionId: 'sec-1',
                subjectId: 'sub-1',
                createdByMembershipId: 'teacher-1',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      await expect(
        assignmentRepository.submitAssignment(client, 'inst-1', 'asgn-past', 'student-1', {
          fileName: 'late_exam.pdf',
        })
      ).rejects.toThrow('DEADLINE_PASSED');
    });

    it('permits late submission and flags is_late = true when allowLateSubmissions is true', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('from assignment where id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'asgn-past-allowed',
                status: 'published',
                dueDate: '2020-01-01T00:00:00Z', // In the past
                allowLateSubmissions: true, // But allowed!
                title: 'Flexible Deadline Project',
                sectionId: 'sec-1',
                subjectId: 'sub-1',
                createdByMembershipId: 'teacher-1',
              },
            ],
          });
        }
        if (sql.includes('from assignment_submission') && sql.includes('reopen_reason')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('insert into assignment_submission')) {
          // Verify isLate is passed as true ($10)
          expect(params?.[9]).toBe(true);
          return Promise.resolve({
            rows: [
              {
                id: 'sub-late-1',
                institutionId: 'inst-1',
                assignmentId: 'asgn-past-allowed',
                studentId: 'student-1',
                status: 'submitted',
                isLate: true,
              },
            ],
          });
        }
        if (sql.includes('insert into audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('select name from student')) {
          return Promise.resolve({ rows: [{ name: 'Rahim' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const sub = await assignmentRepository.submitAssignment(client, 'inst-1', 'asgn-past-allowed', 'student-1', {
        fileName: 'late_project.pdf',
      });

      expect(sub.status).toBe('submitted');
      expect(sub.isLate).toBe(true);
    });

    it('teacher can reopen submission with mandatory audit logging and reason', async () => {
      const validSubId = '33333333-3333-3333-3333-333333333333';
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('select s.id, s.assignment_id as "assignmentId"')) {
          return Promise.resolve({
            rows: [
              {
                id: validSubId,
                assignmentId: 'asgn-1',
                studentId: 'st-1',
                status: 'submitted',
                assignmentTitle: 'Physics Lab',
              },
            ],
          });
        }
        if (sql.includes('update assignment_submission') && sql.includes('reopened')) {
          return Promise.resolve({
            rows: [
              {
                id: validSubId,
                institutionId: 'inst-1',
                assignmentId: 'asgn-1',
                studentId: 'st-1',
                status: 'reopened',
                reopenedAt: '2026-09-15T02:00:00Z',
                reopenReason: 'Re-upload pages 3-4 with better contrast',
              },
            ],
          });
        }
        if (sql.includes('insert into audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('select user_id from student')) {
          return Promise.resolve({ rows: [{ user_id: 'user-st-1' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const reopened = await assignmentRepository.reopenSubmission(
        client,
        'inst-1',
        'asgn-1',
        validSubId,
        'teacher-mem-1',
        'Re-upload pages 3-4 with better contrast'
      );

      expect(reopened.status).toBe('reopened');
      expect(reopened.reopenReason).toBe('Re-upload pages 3-4 with better contrast');

      // Verify audit log
      const auditCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('insert into audit_log')
      );
      expect(auditCalls).toHaveLength(1);
      const [sql, auditParams] = auditCalls[0];
      expect(auditParams[0]).toBe('inst-1');
      expect(auditParams[1]).toBe('teacher-mem-1');
      expect(auditParams[2]).toBe('reopen_submission');
      expect(auditParams[3]).toBe('assignment_submission');
      expect(auditParams[4]).toBe(validSubId);
      expect(auditParams[5]).toBe(JSON.stringify({ status: 'submitted' }));
      expect(auditParams[7]).toBe('Re-upload pages 3-4 with better contrast');
    });
  });

  describe('Grading Workflow & Mark Recording (Section 22)', () => {
    it('grades submission, transitions status to marked, records marksObtained, and logs audit', async () => {
      const validSubId = '44444444-4444-4444-4444-444444444444';
      const validGradeId = '55555555-5555-5555-5555-555555555555';

      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('update assignment_submission') && sql.includes('marked')) {
          return Promise.resolve({
            rows: [
              {
                id: validSubId,
                assignmentId: 'asgn-1',
                studentId: 'st-1',
                status: 'marked',
                marksObtained: 92,
              },
            ],
          });
        }
        if (sql.includes('insert into assignment_grade')) {
          return Promise.resolve({
            rows: [
              {
                id: validGradeId,
                institutionId: 'inst-1',
                submissionId: validSubId,
                grade: 'A',
                marksObtained: 92,
                feedback: 'Great lab methodology and conclusions.',
                createdAt: '2026-09-15T02:00:00Z',
              },
            ],
          });
        }
        if (sql.includes('insert into audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('select s.id, a.title, a.section_id')) {
          return Promise.resolve({
            rows: [
              {
                id: validSubId,
                title: 'Chemistry Lab',
                sectionId: 'sec-1',
                studentUserId: 'u-st-1',
              },
            ],
          });
        }
        if (sql.includes('select g.user_id from student_guardian sg')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const grade = await assignmentRepository.gradeSubmission(
        client,
        'inst-1',
        validSubId,
        'teacher-mem-1',
        {
          grade: 'A',
          marksObtained: 92,
          feedback: 'Great lab methodology and conclusions.',
        }
      );

      expect(grade.grade).toBe('A');
      expect(grade.marksObtained).toBe(92);
      expect(grade.feedback).toBe('Great lab methodology and conclusions.');

      // Verify audit was logged with action 'grade'
      const auditCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('insert into audit_log')
      );
      expect(auditCalls).toHaveLength(1);
      const [sql, auditParams] = auditCalls[0];
      expect(auditParams[0]).toBe('inst-1');
      expect(auditParams[1]).toBe('teacher-mem-1');
      expect(auditParams[2]).toBe('grade');
      expect(auditParams[3]).toBe('assignment_submission');
      expect(auditParams[4]).toBe(validSubId);
    });
  });
});
