import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attendanceManifest } from '../../src/modules/attendance/manifest';
import { attendanceRepository, EmployeeAttendanceRecordInput } from '../../src/modules/attendance/repository';
import { auditLogger, logAudit } from '../../src/core/audit/audit-logger';

describe('Chunk 2: Attendance Operations & Audit Log System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Attendance Manifest Validation Schemas (Sections 23, 25, 27)', () => {
    it('validates student attendance records with multi-session, period, remarks, and reason', () => {
      const markRoute = attendanceManifest.routes.find((r) => r.method === 'POST' && r.path === '');
      const validator = markRoute?.validation?.body;
      expect(validator).toBeDefined();

      const validPayload = {
        records: [
          {
            studentId: '11111111-1111-1111-1111-111111111111',
            sectionId: '22222222-2222-2222-2222-222222222222',
            date: '2026-09-15',
            status: 'present',
            sessionType: 'period',
            periodNumber: 3,
            subjectId: '33333333-3333-3333-3333-333333333333',
            remarks: 'Arrived on time for lab',
            reason: 'Correction of previous absent entry',
          },
        ],
      };

      const result = validator?.safeParse(validPayload);
      expect(result?.success).toBe(true);
      if (result?.success) {
        expect(result.data.records[0].sessionType).toBe('period');
        expect(result.data.records[0].periodNumber).toBe(3);
        expect(result.data.records[0].reason).toBe('Correction of previous absent entry');
      }
    });

    it('validates employee attendance schema accepting audit reason', () => {
      const empPostRoute = attendanceManifest.routes.find((r) => r.method === 'POST' && r.path === '/employees');
      const validator = empPostRoute?.validation?.body;
      expect(validator).toBeDefined();

      const validPayload = {
        records: [
          {
            membershipId: '44444444-4444-4444-4444-444444444444',
            date: '2026-09-15',
            status: 'present',
            checkInTime: '08:30',
            notes: 'Biometric device sync',
            reason: 'Manual adjustment due to scanner glitch',
          },
        ],
      };

      const result = validator?.safeParse(validPayload);
      expect(result?.success).toBe(true);
      if (result?.success) {
        expect(result.data.records[0].reason).toBe('Manual adjustment due to scanner glitch');
      }
    });
  });

  describe('Multi-Session & Period Attendance Repository (Sections 23, 24)', () => {
    it('queries attendance sheet with sessionType and periodNumber', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [
          {
            studentId: 's-1',
            admissionNo: 'ADM001',
            name: 'Tanvir Hasan',
            rollNo: '1',
            status: 'present',
            attendanceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            sessionType: 'period',
            periodNumber: 2,
            subjectId: 'sub-1',
            remarks: null,
          },
        ],
      });
      const client = { query: mockQuery } as any;

      const sheet = await attendanceRepository.getAttendanceSheet(
        client,
        'inst-1',
        'sec-1',
        '2026-09-15',
        'period',
        2
      );

      expect(sheet).toHaveLength(1);
      expect(sheet[0].status).toBe('present');
      expect(sheet[0].sessionType).toBe('period');
      expect(sheet[0].periodNumber).toBe(2);

      // Verify sql query includes session_type and period_number filter
      expect(mockQuery).toHaveBeenCalled();
      const callArgs = mockQuery.mock.calls[0];
      expect(callArgs[0]).toContain("coalesce(a.session_type, 'daily') = $3");
      expect(callArgs[0]).toContain("coalesce(a.period_number, 1) = $4");
      expect(callArgs[1]).toEqual(['sec-1', '2026-09-15', 'period', 2]);
    });

    it('filters attendance records by sessionType, periodNumber, and subjectId', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            institutionId: 'inst-1',
            studentId: 's-1',
            sectionId: 'sec-1',
            date: '2026-09-15',
            status: 'present',
            sessionType: 'period',
            periodNumber: 4,
            subjectId: 'sub-9',
            remarks: 'Chemistry Lab',
            createdAt: new Date().toISOString(),
          },
        ],
      });
      const client = { query: mockQuery } as any;

      const records = await attendanceRepository.listAttendance(client, 'inst-1', {
        sectionId: 'sec-1',
        date: '2026-09-15',
        sessionType: 'period',
        periodNumber: 4,
        subjectId: 'sub-9',
      });

      expect(records).toHaveLength(1);
      expect(records[0].sessionType).toBe('period');
      expect(records[0].periodNumber).toBe(4);
      expect(records[0].subjectId).toBe('sub-9');

      const callArgs = mockQuery.mock.calls[0];
      expect(callArgs[0]).toContain('session_type = $');
      expect(callArgs[0]).toContain('period_number = $');
      expect(callArgs[0]).toContain('subject_id = $');
    });

    it('verifies teacher assignment to subject section', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ id: 'ta-1' }],
      });
      const client = { query: mockQuery } as any;

      const isAssigned = await attendanceRepository.isTeacherAssignedToSubjectSection(
        client,
        'mem-teacher',
        'sec-10a',
        'sub-math'
      );

      expect(isAssigned).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('class_subject_teacher'),
        ['mem-teacher', 'sec-10a', 'sub-math']
      );
    });
  });

  describe('Attendance Audit Trail & Edit Logging (Section 27, 38, 48)', () => {
    it('creates an audit log when student attendance status is modified', async () => {
      const validAttendanceUuid = '11111111-1111-1111-1111-111111111111';
      // Mock client queries:
      // 1. SELECT existing record (returns status: 'present')
      // 2. INSERT/UPDATE record
      // 3. INSERT into audit_log
      const mockQuery = vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: validAttendanceUuid, status: 'present' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: validAttendanceUuid,
              institutionId: 'inst-1',
              studentId: 's-1',
              sectionId: 'sec-1',
              date: '2026-09-15',
              status: 'absent',
              sessionType: 'daily',
              periodNumber: 1,
              subjectId: null,
              remarks: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const client = { query: mockQuery } as any;

      await attendanceRepository.markAttendance(
        client,
        'inst-1',
        'actor-membership-1',
        [
          {
            studentId: 's-1',
            sectionId: 'sec-1',
            date: '2026-09-15',
            status: 'absent',
            reason: 'Guardian confirmed student left early for medical appointment',
          },
        ]
      );

      // Verify audit_log query was executed
      const auditCalls = mockQuery.mock.calls.filter((c: any) =>
        typeof c[0] === 'string' && c[0].includes('insert into audit_log')
      );
      expect(auditCalls).toHaveLength(1);
      const [sql, params] = auditCalls[0];
      expect(sql).toContain('reason');
      expect(params[0]).toBe('inst-1');
      expect(params[1]).toBe('actor-membership-1');
      expect(params[2]).toBe('update_attendance');
      expect(params[3]).toBe('attendance');
      expect(params[4]).toBe(validAttendanceUuid);
      expect(params[5]).toBe(JSON.stringify({ status: 'present' }));
      expect(params[6]).toContain('absent');
      expect(params[7]).toBe('Guardian confirmed student left early for medical appointment');
    });

    it('does not log an audit update when new attendance record is inserted without prior status', async () => {
      const validAttendanceUuid = '22222222-2222-2222-2222-222222222222';
      // Mock client queries:
      // 1. SELECT existing record (returns empty)
      // 2. INSERT record
      // 3. INSERT audit_log for batch mark (action: 'mark_attendance')
      const mockQuery = vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: validAttendanceUuid,
              institutionId: 'inst-1',
              studentId: 's-2',
              sectionId: 'sec-1',
              date: '2026-09-15',
              status: 'present',
              sessionType: 'daily',
              periodNumber: 1,
              subjectId: null,
              remarks: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const client = { query: mockQuery } as any;

      await attendanceRepository.markAttendance(
        client,
        'inst-1',
        'actor-membership-1',
        [
          {
            studentId: 's-2',
            sectionId: 'sec-1',
            date: '2026-09-15',
            status: 'present',
          },
        ]
      );

      // Verify no 'update_attendance' audit call was made
      const updateAuditCalls = mockQuery.mock.calls.filter((c: any) =>
        typeof c[0] === 'string' && c[0].includes('insert into audit_log') && c[1]?.includes('update_attendance')
      );
      expect(updateAuditCalls).toHaveLength(0);
    });

    it('creates an audit log when employee attendance status is modified', async () => {
      const validEmployeeAttendanceUuid = '33333333-3333-3333-3333-333333333333';
      // Mock queries:
      // 1. SELECT existing employee attendance (status: 'late')
      // 2. INSERT/UPDATE employee attendance
      // 3. INSERT audit_log
      const mockQuery = vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: validEmployeeAttendanceUuid, status: 'late' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: validEmployeeAttendanceUuid,
              institutionId: 'inst-1',
              membershipId: 'mem-staff-1',
              date: '2026-09-15',
              status: 'present',
              checkInTime: '08:55',
              checkOutTime: null,
              notes: 'Corrected check-in timestamp',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const client = { query: mockQuery } as any;

      const records: EmployeeAttendanceRecordInput[] = [
        {
          membershipId: 'mem-staff-1',
          date: '2026-09-15',
          status: 'present',
          checkInTime: '08:55',
          notes: 'Corrected check-in timestamp',
          reason: 'Staff was present at security gate on time, card reader was offline',
        },
      ];

      await attendanceRepository.markEmployeeAttendanceBatch(
        client,
        'inst-1',
        'actor-admin',
        records
      );

      const auditCalls = mockQuery.mock.calls.filter((c: any) =>
        typeof c[0] === 'string' && c[0].includes('insert into audit_log')
      );
      expect(auditCalls).toHaveLength(1);
      const [sql, params] = auditCalls[0];
      expect(sql).toContain('reason');
      expect(params[0]).toBe('inst-1');
      expect(params[1]).toBe('actor-admin');
      expect(params[2]).toBe('update_employee_attendance');
      expect(params[3]).toBe('employee_attendance');
      expect(params[4]).toBe(validEmployeeAttendanceUuid);
      expect(params[5]).toBe(JSON.stringify({ status: 'late' }));
      expect(params[6]).toContain('present');
      expect(params[7]).toBe('Staff was present at security gate on time, card reader was offline');
    });

    it('auditLogger records reason column directly in database', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const client = { query: mockQuery } as any;

      await auditLogger.log(client, {
        institutionId: 'inst-1',
        actorMembershipId: 'actor-1',
        action: 'update',
        entityType: 'attendance',
        entityId: '11111111-1111-1111-1111-111111111111',
        before: { status: 'absent' },
        after: { status: 'present' },
        reason: 'Authorized medical note presented by guardian',
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('reason');
      expect(params).toContain('Authorized medical note presented by guardian');
    });
  });
});

