/**
 * Canonical Permission Dependencies & Scope Hierarchy Engine
 * Ensures hierarchical integrity, eliminates access errors when child permissions
 * are granted without parents, and provides multi-tiered scope verification.
 */

export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  // Core & Academic
  'students.write': ['students.read'],
  'classes.manage': ['academic_years.manage'],
  'sections.manage': ['classes.manage'],
  'subjects.manage': ['classes.manage'],
  'teachers.assign': ['classes.manage', 'subjects.manage'],
  'schedules.manage': ['schedules.read', 'classes.manage'],
  'tasks.manage': ['tasks.read'],

  // Attendance & Examination
  'attendance.create': ['attendance.read'],
  'attendance.employee.read': ['attendance.read'],
  'attendance.employee.create': ['attendance.employee.read', 'attendance.read'],
  'exams.manage': ['classes.manage'],
  'marks.create': ['marks.read'],
  'marks.approve': ['marks.read', 'marks.create'],

  // Assignments
  'assignments.create': ['assignments.read'],
  'assignments.update': ['assignments.read'],
  'assignments.delete': ['assignments.read'],
  'assignments.grade': ['assignments.read'],
  'assignments.submit': ['assignments.read'],

  // Notices
  'notices.write': ['notices.read'],

  // Admissions
  'admissions.write': ['admissions.read'],
  'admissions.approve': ['admissions.read', 'admissions.write'],

  // Transport Fleet
  'transport.manage': ['transport.read'],

  // Document Templates
  'templates.manage': ['templates.read'],
};

export const SCOPE_HIERARCHY: Record<string, number> = {
  institution: 3,
  assigned_sections: 2,
  assigned_routes: 2,
  self: 1,
};

/**
 * Returns true if grantedScope is equal to or hierarchically higher than requiredScope.
 */
export function hasSufficientScope(grantedScope?: string, requiredScope?: string): boolean {
  if (!requiredScope) return true;
  if (!grantedScope) return false;
  if (grantedScope === 'institution') return true;
  if (grantedScope === requiredScope) return true;

  const grantedWeight = SCOPE_HIERARCHY[grantedScope] || 0;
  const requiredWeight = SCOPE_HIERARCHY[requiredScope] || 0;
  return grantedWeight >= requiredWeight;
}

/**
 * Recursively resolves and expands prerequisite permissions for a resolved permission map.
 * If a user possesses an action permission (e.g. `students.write`), this ensures all
 * prerequisite permissions (e.g. `students.read`) are present with at least the same scope.
 */
export function resolvePermissionDependencies(
  permissions: Map<string, string>
): Map<string, string> {
  const result = new Map<string, string>(permissions);
  let modified = true;
  let iterations = 0;

  while (modified && iterations < 10) {
    modified = false;
    iterations++;

    for (const [key, scope] of Array.from(result.entries())) {
      const prerequisites = PERMISSION_DEPENDENCIES[key];
      if (!prerequisites) continue;

      for (const prereq of prerequisites) {
        if (!result.has(prereq)) {
          result.set(prereq, scope);
          modified = true;
        } else {
          // If already present, elevate scope if current permission has higher scope
          const existingScope = result.get(prereq)!;
          const currentWeight = SCOPE_HIERARCHY[scope] || 0;
          const existingWeight = SCOPE_HIERARCHY[existingScope] || 0;
          if (currentWeight > existingWeight) {
            result.set(prereq, scope);
            modified = true;
          }
        }
      }
    }
  }

  return result;
}

