import { describe, it, expect } from 'vitest';
import {
  resolvePermissionDependencies,
  hasSufficientScope,
  PERMISSION_DEPENDENCIES,
} from '../../src/core/permissions/dependencies';

describe('Permission Dependencies & Scope Hierarchy', () => {
  it('resolves direct and transitive permission prerequisites', () => {
    // When a role assigns 'marks.approve'
    const initialPermissions = new Map<string, string>([
      ['marks.approve', 'institution'],
    ]);
    const resolved = resolvePermissionDependencies(initialPermissions);

    // marks.approve depends on marks.read and marks.create
    expect(resolved.has('marks.approve')).toBe(true);
    expect(resolved.has('marks.create')).toBe(true);
    expect(resolved.has('marks.read')).toBe(true);
    expect(resolved.get('marks.read')).toBe('institution');
  });

  it('resolves templates.manage to templates.read', () => {
    const initial = new Map<string, string>([
      ['templates.manage', 'institution'],
    ]);
    const resolved = resolvePermissionDependencies(initial);

    expect(resolved.has('templates.manage')).toBe(true);
    expect(resolved.has('templates.read')).toBe(true);
    expect(resolved.get('templates.read')).toBe('institution');
  });

  it('resolves multi-level transitive dependencies', () => {
    // sections.manage -> classes.manage -> academic_years.manage
    const initial = new Map<string, string>([
      ['sections.manage', 'institution'],
    ]);
    const resolved = resolvePermissionDependencies(initial);

    expect(resolved.has('sections.manage')).toBe(true);
    expect(resolved.has('classes.manage')).toBe(true);
    expect(resolved.has('academic_years.manage')).toBe(true);
  });

  it('correctly evaluates scope hierarchy', () => {
    expect(hasSufficientScope('institution', 'institution')).toBe(true);
    expect(hasSufficientScope('institution', 'assigned_sections')).toBe(true);
    expect(hasSufficientScope('institution', 'self')).toBe(true);

    expect(hasSufficientScope('assigned_sections', 'institution')).toBe(false);
    expect(hasSufficientScope('assigned_sections', 'self')).toBe(true);

    expect(hasSufficientScope('self', 'institution')).toBe(false);
    expect(hasSufficientScope('self', 'self')).toBe(true);
  });

  it('keeps the broader scope when promoting an auto-resolved permission', () => {
    const initial = new Map<string, string>([
      ['students.read', 'self'],
      ['students.write', 'institution'],
    ]);
    const resolved = resolvePermissionDependencies(initial);

    // students.read should be elevated to 'institution' because students.write is 'institution'
    expect(resolved.get('students.read')).toBe('institution');
  });
});

