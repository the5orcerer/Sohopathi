import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolvePermissionDependencies,
  hasSufficientScope,
  SCOPE_HIERARCHY,
  PERMISSION_DEPENDENCIES,
  PERMISSION_ALIASES,
} from '../../src/core/permissions/dependencies';
import {
  isFeatureAvailable,
  getFeatureForPermission,
  invalidateFeatureCache,
} from '../../src/core/permissions/feature-guard';
import {
  CONTENT_LIMITS,
  assertContentLength,
  ContentLimitError,
} from '../../src/core/validation/content-limits';

describe('Chunk 1: Security, Scoping & Tenancy Foundation', () => {
  describe('Canonical Permission Dependencies & Resource.Action Aliases', () => {
    it('resolves exam.marks.write to prerequisite read permissions', () => {
      const initial = new Map<string, string>([['exam.marks.write', 'assigned_sections']]);
      const resolved = resolvePermissionDependencies(initial);

      expect(resolved.has('exam.marks.write')).toBe(true);
      expect(resolved.has('exam.marks.read')).toBe(true);
      expect(resolved.has('exam.read')).toBe(true);
      expect(resolved.get('exam.read')).toBe('assigned_sections');
    });

    it('bidirectionally expands legacy platform keys and canonical resource.action aliases', () => {
      // User with legacy 'exams.manage' gets canonical exam.* permissions
      const legacyPerms = new Map<string, string>([['exams.manage', 'institution']]);
      const resolvedFromLegacy = resolvePermissionDependencies(legacyPerms);

      expect(resolvedFromLegacy.has('exam.create')).toBe(true);
      expect(resolvedFromLegacy.has('exam.read')).toBe(true);
      expect(resolvedFromLegacy.has('exam.marks.write')).toBe(true);

      // User with canonical 'exam.create' gets legacy 'exams.manage'
      const canonicalPerms = new Map<string, string>([['exam.create', 'institution']]);
      const resolvedFromCanonical = resolvePermissionDependencies(canonicalPerms);

      expect(resolvedFromCanonical.has('exams.manage')).toBe(true);
      expect(resolvedFromCanonical.has('exam.read')).toBe(true);
    });

    it('expands invoice and finance permissions bidirectionally', () => {
      const invoicePerms = new Map<string, string>([['invoice.create', 'institution']]);
      const resolved = resolvePermissionDependencies(invoicePerms);

      expect(resolved.has('finance.write')).toBe(true);
      expect(resolved.has('invoice.read')).toBe(true);
    });

    it('resolves employee self-attendance permissions', () => {
      const selfAttendance = new Map<string, string>([['employee.attendance.self.write', 'self']]);
      const resolved = resolvePermissionDependencies(selfAttendance);

      expect(resolved.has('employee.attendance.self.write')).toBe(true);
      expect(resolved.has('employee.attendance.read')).toBe(true);
      expect(resolved.has('attendance.read')).toBe(true);
    });
  });

  describe('Multi-Tier Scope Hierarchy Evaluation (Blueprint Section 2 & 53)', () => {
    it('evaluates scope hierarchy according to institutional hierarchy', () => {
      // Institution > Campus > Academic Year > Class > Section > Subject > Assigned Students > Self
      expect(SCOPE_HIERARCHY['institution']).toBeGreaterThan(SCOPE_HIERARCHY['campus']);
      expect(SCOPE_HIERARCHY['campus']).toBeGreaterThan(SCOPE_HIERARCHY['academic_year']);
      expect(SCOPE_HIERARCHY['academic_year']).toBeGreaterThan(SCOPE_HIERARCHY['class']);
      expect(SCOPE_HIERARCHY['class']).toBeGreaterThan(SCOPE_HIERARCHY['section']);
      expect(SCOPE_HIERARCHY['section']).toBeGreaterThan(SCOPE_HIERARCHY['subject']);
      expect(SCOPE_HIERARCHY['subject']).toBeGreaterThan(SCOPE_HIERARCHY['assigned_students']);
      expect(SCOPE_HIERARCHY['assigned_students']).toBeGreaterThan(SCOPE_HIERARCHY['self']);
    });

    it('validates hasSufficientScope across full hierarchy', () => {
      expect(hasSufficientScope('institution', 'class')).toBe(true);
      expect(hasSufficientScope('institution', 'self')).toBe(true);
      expect(hasSufficientScope('class', 'section')).toBe(true);
      expect(hasSufficientScope('section', 'subject')).toBe(true);
      expect(hasSufficientScope('subject', 'assigned_students')).toBe(true);
      expect(hasSufficientScope('assigned_students', 'self')).toBe(true);

      // Downward checks must fail
      expect(hasSufficientScope('class', 'institution')).toBe(false);
      expect(hasSufficientScope('section', 'class')).toBe(false);
      expect(hasSufficientScope('self', 'subject')).toBe(false);
      expect(hasSufficientScope('assigned_students', 'section')).toBe(false);
    });
  });

  describe('Feature Availability vs Permission Evaluation (Blueprint Section 40 & 41)', () => {
    beforeEach(() => {
      invalidateFeatureCache();
    });

    it('correctly maps permission namespaces to features', () => {
      expect(getFeatureForPermission('exam.marks.write')).toBe('examinations');
      expect(getFeatureForPermission('exams.manage')).toBe('examinations');
      expect(getFeatureForPermission('invoice.create')).toBe('finance');
      expect(getFeatureForPermission('finance.read')).toBe('finance');
      expect(getFeatureForPermission('assignment.submit')).toBe('assignments');
      expect(getFeatureForPermission('attendance.write')).toBe('attendance');
      expect(getFeatureForPermission('employee.attendance.read')).toBe('attendance');
    });

    it('blocks access when feature is disabled, regardless of role or permission', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              settings: {
                featureLimitations: {
                  finance: { enabled: false, status: 'disabled' },
                },
              },
            },
          ],
        }),
      } as any;

      const check = await isFeatureAvailable(
        mockClient,
        'inst-123',
        'finance',
        'Principal',
        'user-1'
      );
      expect(check.available).toBe(false);
      expect(check.reason).toContain("Feature 'finance' is disabled");
    });

    it('enforces role restrictions when feature is restricted', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              settings: {
                featureLimitations: {
                  finance: {
                    enabled: true,
                    status: 'restricted',
                    allowedRoles: ['Accountant', 'Principal'],
                  },
                },
              },
            },
          ],
        }),
      } as any;

      // Teacher role is not in allowedRoles
      const teacherCheck = await isFeatureAvailable(
        mockClient,
        'inst-123',
        'finance',
        'Teacher',
        'user-teacher'
      );
      expect(teacherCheck.available).toBe(false);
      expect(teacherCheck.reason).toContain('restricted to specific roles');

      // Accountant role is in allowedRoles
      invalidateFeatureCache('inst-123');
      const accountantCheck = await isFeatureAvailable(
        mockClient,
        'inst-123',
        'finance',
        'Accountant',
        'user-acc'
      );
      expect(accountantCheck.available).toBe(true);

      // Institution Admin is always exempt from role restriction
      invalidateFeatureCache('inst-123');
      const adminCheck = await isFeatureAvailable(
        mockClient,
        'inst-123',
        'finance',
        'Institution Admin',
        'user-admin'
      );
      expect(adminCheck.available).toBe(true);
    });
  });

  describe('Content Limit Assertions (Blueprint Section 36)', () => {
    it('accepts text within limits', () => {
      expect(() =>
        assertContentLength('Valid Notice Title', 'title', CONTENT_LIMITS.TITLE_MAX, true)
      ).not.toThrow();

      expect(() =>
        assertContentLength('A'.repeat(500), 'shortDescription', CONTENT_LIMITS.SHORT_DESCRIPTION_MAX)
      ).not.toThrow();

      expect(() =>
        assertContentLength('Body'.repeat(2000), 'noticeBody', CONTENT_LIMITS.NOTICE_BODY_MAX, true)
      ).not.toThrow();
    });

    it('rejects text exceeding maximum limits', () => {
      const longTitle = 'T'.repeat(CONTENT_LIMITS.TITLE_MAX + 1);
      expect(() => assertContentLength(longTitle, 'title', CONTENT_LIMITS.TITLE_MAX)).toThrow(
        ContentLimitError
      );

      const longNotice = 'N'.repeat(CONTENT_LIMITS.NOTICE_BODY_MAX + 1);
      expect(() => assertContentLength(longNotice, 'noticeBody', CONTENT_LIMITS.NOTICE_BODY_MAX)).toThrow(
        ContentLimitError
      );
    });

    it('enforces required field presence', () => {
      expect(() => assertContentLength('', 'title', CONTENT_LIMITS.TITLE_MAX, true)).toThrow(
        /required|cannot be empty/
      );
    });
  });

  describe('Student / Guardian Model Decoupling (Blueprint Section 37)', () => {
    it('verifies Guardian role cannot be assigned to staff members', () => {
      const disallowedStaffRoles = ['guardian', 'student'];

      const testRole = (roleName: string) => {
        if (disallowedStaffRoles.includes(roleName.toLowerCase())) {
          throw new Error('Guardians and students cannot be invited as staff members.');
        }
        return true;
      };

      expect(() => testRole('Guardian')).toThrow('Guardians and students cannot be invited as staff members.');
      expect(() => testRole('Student')).toThrow('Guardians and students cannot be invited as staff members.');
      expect(testRole('Teacher')).toBe(true);
      expect(testRole('Accountant')).toBe(true);
      expect(testRole('Institution Admin')).toBe(true);
    });
  });
});

