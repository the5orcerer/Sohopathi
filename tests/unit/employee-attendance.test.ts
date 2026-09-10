import { describe, it, expect } from 'vitest';
import { attendanceManifest } from '../../src/modules/attendance/manifest';

describe('Employee Attendance Module Manifest', () => {
  it('declares attendance.employee.read and attendance.employee.create permissions', () => {
    const permKeys = attendanceManifest.permissions.map((p) => p.key);
    expect(permKeys).toContain('attendance.employee.read');
    expect(permKeys).toContain('attendance.employee.create');

    const readPerm = attendanceManifest.permissions.find((p) => p.key === 'attendance.employee.read');
    expect(readPerm?.scopeOptions).toContain('institution');
    expect(readPerm?.scopeOptions).toContain('self');

    const createPerm = attendanceManifest.permissions.find((p) => p.key === 'attendance.employee.create');
    expect(createPerm?.scopeOptions).toContain('institution');
  });

  it('declares GET /employees, POST /employees, and GET /employees/summary routes with proper permissions', () => {
    const empGetRoute = attendanceManifest.routes.find((r) => r.method === 'GET' && r.path === '/employees');
    expect(empGetRoute).toBeDefined();
    expect(empGetRoute?.requiredPermission).toBe('attendance.employee.read');

    const empPostRoute = attendanceManifest.routes.find((r) => r.method === 'POST' && r.path === '/employees');
    expect(empPostRoute).toBeDefined();
    expect(empPostRoute?.requiredPermission).toBe('attendance.employee.create');

    const empSummaryRoute = attendanceManifest.routes.find((r) => r.method === 'GET' && r.path === '/employees/summary');
    expect(empSummaryRoute).toBeDefined();
    expect(empSummaryRoute?.requiredPermission).toBe('attendance.employee.read');
  });

  it('validates employee batch attendance schema correctly', () => {
    const empPostRoute = attendanceManifest.routes.find((r) => r.method === 'POST' && r.path === '/employees');
    const validator = empPostRoute?.validation?.body;
    expect(validator).toBeDefined();

    const validPayload = {
      records: [
        {
          membershipId: 'f2c10000-0000-0000-0000-000000000002',
          date: '2026-09-10',
          status: 'present',
          checkInTime: '08:45',
          notes: 'On time',
        },
      ],
    };

    const parsed = validator?.safeParse(validPayload);
    expect(parsed?.success).toBe(true);

    const invalidPayload = {
      records: [
        {
          membershipId: 'not-a-uuid',
          date: '2026-09-10',
          status: 'present',
        },
      ],
    };
    const invalidParsed = validator?.safeParse(invalidPayload);
    expect(invalidParsed?.success).toBe(false);
  });
});
