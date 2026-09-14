import { describe, it, expect, vi, beforeEach } from 'vitest';
import { examsManifest } from '../../src/modules/exams/manifest';
import { examRepository, calculateGradeAndGPA } from '../../src/modules/exams/repository';

describe('Chunk 4: Examination Lifecycle, Grading Systems, Room Allocation & Marks Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Manifest Route Validation (Sections 3, 8, 10, 16)', () => {
    it('validates exam creation schema with examType, gradingSystem, and syllabusRemarks', () => {
      const createRoute = examsManifest.routes.find((r) => r.method === 'POST' && r.path === '');
      const validator = createRoute?.validation?.body;
      expect(validator).toBeDefined();

      const validPayload = {
        academicYearId: '11111111-1111-1111-1111-111111111111',
        name: 'Annual Term Examination 2026',
        term: 'Final Term',
        startDate: '2026-11-01',
        endDate: '2026-11-15',
        examType: 'term',
        gradingSystem: 'standard_gpa',
        syllabusRemarks: 'Covers chapters 1 to 12 as per the syllabus guidelines.',
        classId: '22222222-2222-2222-2222-222222222222',
      };

      const result = validator?.safeParse(validPayload);
      expect(result?.success).toBe(true);
      if (result?.success) {
        expect(result.data.name).toBe('Annual Term Examination 2026');
        expect(result.data.examType).toBe('term');
        expect(result.data.gradingSystem).toBe('standard_gpa');
      }
    });

    it('rejects exam creation when name is missing or empty', () => {
      const createRoute = examsManifest.routes.find((r) => r.method === 'POST' && r.path === '');
      const validator = createRoute?.validation?.body;

      const result = validator?.safeParse({
        academicYearId: '11111111-1111-1111-1111-111111111111',
        name: '',
      });
      expect(result?.success).toBe(false);
    });

    it('validates exam room creation schema with capacity, guards, and roll ranges', () => {
      const createRoomRoute = examsManifest.routes.find((r) => r.method === 'POST' && r.path === '/:id/rooms');
      const validator = createRoomRoute?.validation?.body;
      expect(validator).toBeDefined();

      const validRoom = {
        roomNumber: 'Auditorium Block A - Hall 101',
        capacity: 50,
        guardMembershipIds: [
          '33333333-3333-3333-3333-333333333333',
          '44444444-4444-4444-4444-444444444444',
        ],
        building: 'Main Academic Building',
        floor: '1',
      };

      const result = validator?.safeParse(validRoom);
      expect(result?.success).toBe(true);
      if (result?.success) {
        expect(result.data.roomNumber).toBe('Auditorium Block A - Hall 101');
        expect(result.data.capacity).toBe(50);
        expect(result.data.guardMembershipIds).toHaveLength(2);
      }
    });

    it('validates marks recording batch schema with component breakdown', () => {
      const recordMarksRoute = examsManifest.routes.find((r) => r.method === 'POST' && r.path === '/marks');
      const validator = recordMarksRoute?.validation?.body;
      expect(validator).toBeDefined();

      const validMarksBatch = {
        marks: [
          {
            examId: '11111111-1111-1111-1111-111111111111',
            subjectId: '22222222-2222-2222-2222-222222222222',
            studentId: '33333333-3333-3333-3333-333333333333',
            theoryMarks: 50,
            practicalMarks: 25,
            vivaMarks: 10,
            mcqMarks: 10,
            maxMarks: 100,
            remarks: 'Exceptional answers in practical section',
          },
          {
            examId: '11111111-1111-1111-1111-111111111111',
            subjectId: '22222222-2222-2222-2222-222222222222',
            studentId: '44444444-4444-4444-4444-444444444444',
            isAbsent: true,
            maxMarks: 100,
          },
        ],
      };

      const result = validator?.safeParse(validMarksBatch);
      expect(result?.success).toBe(true);
      if (result?.success) {
        expect(result.data.marks).toHaveLength(2);
        expect(result.data.marks[0].theoryMarks).toBe(50);
        expect(result.data.marks[1].isAbsent).toBe(true);
      }
    });

    it('validates reopen exam schema requiring a non-empty audit reason', () => {
      const reopenRoute = examsManifest.routes.find((r) => r.method === 'POST' && r.path === '/:id/reopen');
      const validator = reopenRoute?.validation?.body;
      expect(validator).toBeDefined();

      // Empty reason must fail
      const emptyResult = validator?.safeParse({ reason: '' });
      expect(emptyResult?.success).toBe(false);

      // Whitespace reason must fail
      const whitespaceResult = validator?.safeParse({ reason: '   ' });
      expect(whitespaceResult?.success).toBe(false);

      // Valid reason must succeed
      const validResult = validator?.safeParse({
        reason: 'Board of Examiners ordered re-evaluation of Physics Section B answer sheets.',
      });
      expect(validResult?.success).toBe(true);
    });
  });

  describe('Grading System & Component Calculation (Sections 14, 15)', () => {
    it('calculates standard scale letter grades and GPAs correctly', () => {
      // Standard scale: >=80 => A+ (5.0), >=70 => A (4.0), >=60 => A- (3.5), >=50 => B (3.0), >=40 => C (2.0), >=33 => D (1.0), <33 => F (0.0)
      expect(calculateGradeAndGPA(95, 100)).toEqual({ grade: 'A+', letterGrade: 'A+', gpa: 5.0 });
      expect(calculateGradeAndGPA(80, 100)).toEqual({ grade: 'A+', letterGrade: 'A+', gpa: 5.0 });
      expect(calculateGradeAndGPA(75, 100)).toEqual({ grade: 'A', letterGrade: 'A', gpa: 4.0 });
      expect(calculateGradeAndGPA(65, 100)).toEqual({ grade: 'A-', letterGrade: 'A-', gpa: 3.5 });
      expect(calculateGradeAndGPA(55, 100)).toEqual({ grade: 'B', letterGrade: 'B', gpa: 3.0 });
      expect(calculateGradeAndGPA(45, 100)).toEqual({ grade: 'C', letterGrade: 'C', gpa: 2.0 });
      expect(calculateGradeAndGPA(35, 100)).toEqual({ grade: 'D', letterGrade: 'D', gpa: 1.0 });
      expect(calculateGradeAndGPA(30, 100)).toEqual({ grade: 'F', letterGrade: 'F', gpa: 0.0 });
    });

    it('scales percentages accurately for papers with arbitrary maxMarks (e.g. 50 or 75)', () => {
      // 40 out of 50 is 80% => A+ (5.0)
      expect(calculateGradeAndGPA(40, 50)).toEqual({ grade: 'A+', letterGrade: 'A+', gpa: 5.0 });
      // 30 out of 50 is 60% => A- (3.5)
      expect(calculateGradeAndGPA(30, 50)).toEqual({ grade: 'A-', letterGrade: 'A-', gpa: 3.5 });
      // 15 out of 50 is 30% => F (0.0)
      expect(calculateGradeAndGPA(15, 50)).toEqual({ grade: 'F', letterGrade: 'F', gpa: 0.0 });
    });

    it('assigns grade ABS and 0.0 GPA when student is marked absent', () => {
      const result = calculateGradeAndGPA(undefined, 100, true, false);
      expect(result.letterGrade).toBe('ABS');
      expect(result.gpa).toBe(0.0);
    });

    it('assigns grade EX and null GPA when student is marked exempt', () => {
      const result = calculateGradeAndGPA(undefined, 100, false, true);
      expect(result.letterGrade).toBe('EX');
      expect(result.gpa).toBeNull();
    });
  });

  describe('Exam Creation & Content Limit Validation (Sections 3, 51)', () => {
    it('creates exam with default status and records audit log', async () => {
      const mockExamId = '11111111-1111-1111-1111-111111111111';
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('insert into exam')) {
          return Promise.resolve({
            rows: [
              {
                id: mockExamId,
                institutionId: 'inst-1',
                academicYearId: 'ay-1',
                name: 'Midterm Exam 2026',
                term: 'First Term',
                startDate: '2026-05-01',
                endDate: '2026-05-10',
                status: 'draft',
                examType: 'term',
                examControllerMembershipId: 'ctrl-1',
                classId: 'cls-1',
                sectionId: null,
                description: null,
                instructions: null,
                gradingSystem: 'standard_gpa',
                syllabusRemarks: null,
                isPublished: false,
                createdAt: '2026-09-15T00:00:00.000Z',
                updatedAt: '2026-09-15T00:00:00.000Z',
              },
            ],
          });
        }
        if (sql.includes('insert into audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const created = await examRepository.createExam(client, 'inst-1', 'ctrl-1', {
        academicYearId: 'ay-1',
        name: 'Midterm Exam 2026',
        term: 'First Term',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
        examControllerMembershipId: 'ctrl-1',
        classId: 'cls-1',
      });

      expect(created.id).toBe(mockExamId);
      expect(created.name).toBe('Midterm Exam 2026');
      expect(created.status).toBe('draft');
      expect(created.isPublished).toBe(false);

      // Verify audit was logged
      const auditCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('insert into audit_log')
      );
      expect(auditCalls).toHaveLength(1);
      const [sql, params] = auditCalls[0];
      expect(params[0]).toBe('inst-1');
      expect(params[1]).toBe('ctrl-1');
      expect(params[2]).toBe('create');
      expect(params[3]).toBe('exam');
      expect(params[4]).toBe(mockExamId);
    });

    it('rejects exam creation when name exceeds maximum length', async () => {
      const client = { query: vi.fn() } as any;
      const excessivelyLongName = 'E'.repeat(300);

      await expect(
        examRepository.createExam(client, 'inst-1', 'ctrl-1', {
          academicYearId: 'ay-1',
          name: excessivelyLongName,
        })
      ).rejects.toThrow(/exceeds maximum length/i);
    });

    it('rejects exam creation when description exceeds maximum length', async () => {
      const client = { query: vi.fn() } as any;
      const excessivelyLongDescription = 'D'.repeat(12000);

      await expect(
        examRepository.createExam(client, 'inst-1', 'ctrl-1', {
          academicYearId: 'ay-1',
          name: 'Regular Exam',
          description: excessivelyLongDescription,
        })
      ).rejects.toThrow(/exceeds maximum length/i);
    });
  });

  describe('Candidate Snapshotting Engine (Sections 3, 5)', () => {
    it('snapshots active student records into exam_candidate and returns candidate count', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('select e.class_id')) {
          return Promise.resolve({
            rows: [{ classId: 'cls-1', sectionId: null }],
          });
        }
        if (sql.includes('from student s')) {
          return Promise.resolve({
            rows: [
              { student_id: 'st-1', roll_number: '01' },
              { student_id: 'st-2', roll_number: '02' },
              { student_id: 'st-3', roll_number: '03' },
            ],
          });
        }
        if (sql.includes('insert into exam_candidate')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const result = await examRepository.snapshotCandidates(client, 'inst-1', 'exam-1', {
        classId: 'cls-1',
      });

      expect(result.success).toBe(true);
      expect(result.candidateCount).toBe(3);

      // Verify that insert into exam_candidate was called with all 3 candidates
      const insertCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('insert into exam_candidate')
      );
      expect(insertCalls).toHaveLength(3);
      expect(insertCalls[0][1]).toEqual(['inst-1', 'exam-1', 'st-1', '01']);
    });
  });

  describe('Exam Room Allocation & Conflict Engine (Sections 8, 9)', () => {
    it('rejects room allocation when assigned candidate count exceeds capacity', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('guard_membership_ids &&')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      // Passing 50 students when capacity is 30
      await expect(
        examRepository.createExamRoom(client, 'inst-1', 'exam-1', {
          roomNumber: 'Room 201',
          capacity: 30,
          studentIds: Array.from({ length: 50 }, (_, i) => `st-${i}`),
          guardMembershipIds: ['teacher-1'],
        })
      ).rejects.toThrow('CAPACITY_EXCEEDED');
    });

    it('rejects room allocation when an invigilator guard is already double-booked in another room', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('guard_membership_ids &&')) {
          // Another room already has teacher-1 assigned as invigilator
          return Promise.resolve({
            rows: [
              {
                room_number: 'Room 101',
                guard_id: 'teacher-1',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      await expect(
        examRepository.createExamRoom(client, 'inst-1', 'exam-1', {
          roomNumber: 'Room 102',
          capacity: 40,
          guardMembershipIds: ['teacher-1'], // Duplicate guard!
        })
      ).rejects.toThrow('GUARD_CONFLICT: One or more selected invigilators/guards are already scheduled in Room Room 101.');
    });

    it('creates room allocation successfully when guards are available and capacity is respected', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('guard_membership_ids &&')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('insert into exam_room')) {
          return Promise.resolve({
            rows: [
              {
                id: 'room-202',
                institutionId: 'inst-1',
                examId: 'exam-1',
                roomNumber: 'Room 202',
                building: 'Science Building',
                floor: '2',
                capacity: 50,
                guardMembershipIds: ['teacher-1', 'teacher-2'],
                remarks: null,
                createdAt: '2026-09-15T00:00:00.000Z',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const room = await examRepository.createExamRoom(client, 'inst-1', 'exam-1', {
        roomNumber: 'Room 202',
        building: 'Science Building',
        floor: '2',
        capacity: 50,
        guardMembershipIds: ['teacher-1', 'teacher-2'],
      });

      expect(room.id).toBe('room-202');
      expect(room.capacity).toBe(50);
      expect(room.guardMembershipIds).toEqual(['teacher-1', 'teacher-2']);
    });
  });

  describe('Marks Recording, Lock State & Boundary Checks (Sections 10, 16, 17)', () => {
    it('rejects marks recording when exam is published and locked', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from exam where id =')) {
          return Promise.resolve({
            rows: [{ status: 'published', is_published: true }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      await expect(
        examRepository.recordMarksBatch(client, 'inst-1', 'teacher-1', [
          {
            examId: 'exam-1',
            subjectId: 'sub-1',
            studentId: 'st-1',
            marksObtained: 85,
            maxMarks: 100,
          },
        ])
      ).rejects.toThrow('EXAM_LOCKED: Cannot modify marks for a published examination. Results must be reopened by an Exam Controller.');
    });

    it('rejects marks when marksObtained exceeds maxMarks', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from exam where id =')) {
          return Promise.resolve({
            rows: [{ status: 'running', is_published: false }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      await expect(
        examRepository.recordMarksBatch(client, 'inst-1', 'teacher-1', [
          {
            examId: 'exam-1',
            subjectId: 'sub-1',
            studentId: 'st-1',
            marksObtained: 105,
            maxMarks: 100,
          },
        ])
      ).rejects.toThrow('Marks obtained (105) cannot exceed maximum marks (100).');
    });

    it('rejects negative component marks', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from exam where id =')) {
          return Promise.resolve({
            rows: [{ status: 'running', is_published: false }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      await expect(
        examRepository.recordMarksBatch(client, 'inst-1', 'teacher-1', [
          {
            examId: 'exam-1',
            subjectId: 'sub-1',
            studentId: 'st-1',
            theoryMarks: -5,
            maxMarks: 100,
          },
        ])
      ).rejects.toThrow('Component marks cannot be negative.');
    });

    it('sums component marks, calculates GPA/grade, and logs audit on record', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from exam where id =')) {
          return Promise.resolve({
            rows: [{ status: 'running', is_published: false }],
          });
        }
        if (sql.includes('select id, marks_obtained, status from mark')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('insert into mark')) {
          return Promise.resolve({
            rows: [
              {
                id: 'mark-1',
                institution_id: 'inst-1',
                exam_id: 'exam-1',
                subject_id: 'sub-1',
                student_id: 'st-1',
                marks_obtained: 85,
                max_marks: 100,
                grade: 'A+',
                gpa: 5.0,
                letter_grade: 'A+',
                theory_marks: 45,
                practical_marks: 20,
                viva_marks: 10,
                mcq_marks: 10,
                attendance_marks: 0,
                grace_marks: 0,
                is_absent: false,
                is_exempt: false,
                status: 'entered',
                reopen_reason: null,
                remarks: 'Well written',
                created_at: '2026-09-15T00:00:00.000Z',
              },
            ],
          });
        }
        if (sql.includes('insert into audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const result = await examRepository.recordMarksBatch(client, 'inst-1', 'teacher-1', [
        {
          examId: 'exam-1',
          subjectId: 'sub-1',
          studentId: 'st-1',
          theoryMarks: 45,
          practicalMarks: 20,
          vivaMarks: 10,
          mcqMarks: 10,
          maxMarks: 100,
          remarks: 'Well written',
        },
      ]);

      expect(result.recordedCount).toBe(1);

      // Verify audit was logged for mark recording
      const auditCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('insert into audit_log')
      );
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0][1][2]).toBe('create_marks');
      expect(auditCalls[0][1][3]).toBe('mark');
    });
  });

  describe('Exam Publication & Reopening Workflow (Sections 10, 16, 51)', () => {
    const validExamUuid = '11111111-1111-1111-1111-111111111111';

    it('publishes exam, locks all marks, and records publication audit log', async () => {
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from exam e')) {
          return Promise.resolve({
            rows: [
              {
                id: validExamUuid,
                name: 'Final Term Exam',
                isPublished: false,
                status: 'running',
              },
            ],
          });
        }
        if (sql.includes('update exam')) {
          return Promise.resolve({
            rows: [
              {
                id: validExamUuid,
                name: 'Final Term Exam',
                isPublished: true,
                status: 'published',
              },
            ],
          });
        }
        if (sql.includes("update mark set status = 'locked'")) {
          return Promise.resolve({ rowCount: 150 });
        }
        if (sql.includes('insert into audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const result = await examRepository.publishExam(client, 'inst-1', validExamUuid, 'ctrl-1');

      expect(result.success).toBe(true);
      expect(result.isPublished).toBe(true);

      // Verify mark lock query was executed
      const lockCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes("update mark set status = 'locked'")
      );
      expect(lockCalls).toHaveLength(1);

      // Verify audit log
      const auditCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('insert into audit_log')
      );
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0][1][2]).toBe('publish_results');
      expect(auditCalls[0][1][3]).toBe('exam');
      expect(auditCalls[0][1][4]).toBe(validExamUuid);
    });

    it('rejects reopening exam if reason is empty or whitespace', async () => {
      const client = { query: vi.fn() } as any;

      await expect(
        examRepository.reopenExam(client, 'inst-1', validExamUuid, 'ctrl-1', '')
      ).rejects.toThrow('REASON_REQUIRED: A valid reason is mandatory to reopen an examination session.');

      await expect(
        examRepository.reopenExam(client, 'inst-1', validExamUuid, 'ctrl-1', '    ')
      ).rejects.toThrow('REASON_REQUIRED: A valid reason is mandatory to reopen an examination session.');
    });

    it('reopens exam, sets marks status to reopened, records reopen_reason and logs audit', async () => {
      const reopenReason = 'Principal approval granted for Mathematics scrutiny request #8812';
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from exam e')) {
          return Promise.resolve({
            rows: [
              {
                id: validExamUuid,
                name: 'Final Term Exam',
                isPublished: true,
                status: 'published',
              },
            ],
          });
        }
        if (sql.includes('update exam')) {
          return Promise.resolve({
            rows: [
              {
                id: validExamUuid,
                name: 'Final Term Exam',
                isPublished: false,
                status: 'reopened',
              },
            ],
          });
        }
        if (sql.includes('update mark')) {
          return Promise.resolve({ rowCount: 150 });
        }
        if (sql.includes('insert into audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const client = { query: mockQuery } as any;

      const result = await examRepository.reopenExam(client, 'inst-1', validExamUuid, 'ctrl-1', reopenReason);

      expect(result.success).toBe(true);

      // Verify mark unlock query with reason
      const unlockCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('update mark')
      );
      expect(unlockCalls).toHaveLength(1);
      expect(unlockCalls[0][1]).toEqual([reopenReason, validExamUuid, 'inst-1']);

      // Verify audit log with reason
      const auditCalls = mockQuery.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('insert into audit_log')
      );
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0][1][2]).toBe('reopen_results');
      expect(auditCalls[0][1][3]).toBe('exam');
      expect(auditCalls[0][1][4]).toBe(validExamUuid);
      expect(JSON.parse(auditCalls[0][1][6])).toEqual({ status: 'reopened', reason: reopenReason });
    });
  });
});
