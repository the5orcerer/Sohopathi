import { describe, it, expect } from 'vitest';
import { coreManifest } from '../../src/modules/core/manifest';

describe('Impersonation and Reports Manifest', () => {
  it('declares users.impersonate permission in core manifest', () => {
    const perm = coreManifest.permissions.find((p) => p.key === 'users.impersonate');
    expect(perm).toBeDefined();
    expect(perm?.scopeOptions).toContain('institution');
    expect(perm?.description).toContain('Impersonate');
  });

  it('registers dedicated Reports navItem in core manifest', () => {
    const navItems = coreManifest.navItem as any[];
    expect(Array.isArray(navItems)).toBe(true);
    const reportsNav = navItems.find((n) => n.path === '/reports');
    expect(reportsNav).toBeDefined();
    expect(reportsNav?.label).toBe('Reports');
    expect(reportsNav?.requiredPermission).toBe('students.read');
  });
});
