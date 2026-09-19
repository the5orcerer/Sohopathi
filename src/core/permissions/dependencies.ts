/**
 * Canonical Permission Dependencies & Scope Hierarchy Engine
 * Ensures hierarchical integrity, eliminates access errors when child permissions
 * are granted without parents, and provides multi-tiered scope verification.
 */

/**
 * Canonical Permission Dependencies, Aliases & Scope Hierarchy Engine
 * Ensures hierarchical integrity, eliminates access errors when child permissions
 * are granted without parents, maps canonical resource.action notation,
 * and provides multi-tiered scope verification.
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

  // Attendance & Employee Attendance
  'attendance.create': ['attendance.read'],
  'attendance.write': ['attendance.read'],
  'attendance.update': ['attendance.read'],
  'attendance.employee.read': ['attendance.read'],
  'attendance.employee.create': ['attendance.employee.read', 'attendance.read'],
  'employee.attendance.read': ['attendance.read'],
  'employee.attendance.write': ['employee.attendance.read', 'attendance.read'],
  'employee.attendance.update': ['employee.attendance.read'],
  'employee.attendance.self.write': ['employee.attendance.read'],

  // Examination & Marks
  'exams.manage': ['classes.manage'],
  'marks.create': ['marks.read'],
  'marks.approve': ['marks.read', 'marks.create'],
  'exam.create': ['exam.read', 'classes.manage'],
  'exam.update': ['exam.read'],
  'exam.delete': ['exam.read'],
  'exam.publish': ['exam.read', 'exam.marks.read'],
  'exam.marks.read': ['exam.read'],
  'exam.marks.write': ['exam.marks.read', 'exam.read'],
  'exam.marks.update': ['exam.marks.write', 'exam.marks.read'],
  'exam.result.publish': ['exam.marks.read', 'exam.publish'],
  'exam.result.reopen': ['exam.marks.read', 'exam.publish'],

  // Assignments & Submissions
  'assignments.create': ['assignments.read', 'assignments.submission.read'],
  'assignments.update': ['assignments.read'],
  'assignments.delete': ['assignments.read'],
  'assignments.grade': ['assignments.read', 'assignments.submission.read'],
  'assignments.submit': ['assignments.read'],
  'assignments.submission.read': ['assignments.read'],
  'assignment.create': ['assignment.read'],
  'assignment.update': ['assignment.read'],
  'assignment.delete': ['assignment.read'],
  'assignment.submission.read': ['assignment.read'],
  'assignment.submission.create': ['assignment.read'],
  'assignment.submission.update': ['assignment.submission.create'],
  'assignment.mark.write': ['assignment.submission.read'],

  // Notices
  'notices.write': ['notices.read'],

  // Admissions
  'admissions.write': ['admissions.read'],
  'admissions.approve': ['admissions.read', 'admissions.write'],

  // Transport Fleet
  'transport.manage': ['transport.read'],

  // Document Templates
  'templates.manage': ['templates.read'],
  'template.create': ['template.read'],
  'template.update': ['template.read'],
  'template.delete': ['template.read'],
  'template.publish': ['template.read'],

  // Finance & Invoices
  'invoice.create': ['invoice.read'],
  'invoice.update': ['invoice.read'],
  'invoice.delete': ['invoice.read'],
  'invoice.payment.create': ['invoice.read'],
  'invoice.payment.read': ['invoice.read'],
  'invoice.refund': ['invoice.payment.read'],
  'invoice.report': ['invoice.read'],
};

/**
 * Bidirectional aliases between canonical resource.action keys and legacy platform keys
 */
export const PERMISSION_ALIASES: Record<string, string[]> = {
  // Examinations
  'exam.create': ['exams.manage'],
  'exam.read': ['exams.manage'],
  'exam.update': ['exams.manage'],
  'exam.delete': ['exams.manage'],
  'exam.publish': ['marks.approve', 'exams.manage'],
  'exam.marks.read': ['marks.read', 'exams.manage'],
  'exam.marks.write': ['marks.create', 'exams.manage'],
  'exam.marks.update': ['marks.create', 'exams.manage'],
  'exam.result.publish': ['marks.approve', 'exams.manage'],
  'exam.result.reopen': ['marks.approve', 'exams.manage'],
  'exam.room.manage': ['exams.manage'],
  'exam.candidate.manage': ['exams.manage'],
  'exams.manage': ['exam.create', 'exam.read', 'exam.update', 'exam.delete', 'exam.publish', 'exam.marks.read', 'exam.marks.write', 'exam.room.manage', 'exam.candidate.manage'],
  'marks.create': ['exam.marks.write', 'exam.marks.update'],
  'marks.read': ['exam.marks.read'],
  'marks.approve': ['exam.result.publish', 'exam.publish'],

  // Attendance
  'attendance.write': ['attendance.create'],
  'attendance.update': ['attendance.create'],
  'attendance.create': ['attendance.write', 'attendance.update'],
  'employee.attendance.read': ['attendance.employee.read'],
  'employee.attendance.write': ['attendance.employee.create'],
  'employee.attendance.update': ['attendance.employee.create'],
  'attendance.employee.read': ['employee.attendance.read'],
  'attendance.employee.create': ['employee.attendance.write', 'employee.attendance.update'],

  // Assignments
  'assignment.create': ['assignments.create'],
  'assignment.read': ['assignments.read'],
  'assignment.update': ['assignments.update'],
  'assignment.delete': ['assignments.delete'],
  'assignment.submission.read': ['assignments.read', 'assignments.grade', 'assignments.submission.read'],
  'assignments.submission.read': ['assignment.submission.read', 'assignments.grade', 'assignments.create'],
  'assignment.submission.write': ['assignments.submit'],
  'assignment.submission.create': ['assignments.submit'],
  'assignment.submission.update': ['assignments.submit'],
  'assignment.submission.reopen': ['assignments.submission.reopen', 'assignments.create'],
  'assignments.submission.reopen': ['assignment.submission.reopen', 'assignments.create'],
  'assignment.mark.write': ['assignments.grade'],
  'assignments.create': ['assignment.create', 'assignments.submission.reopen', 'assignments.submission.read'],
  'assignments.read': ['assignment.read'],
  'assignments.update': ['assignment.update'],
  'assignments.delete': ['assignment.delete'],
  'assignments.submit': ['assignment.submission.create', 'assignment.submission.write'],
  'assignments.grade': ['assignment.mark.write', 'assignment.submission.read', 'assignments.submission.read'],

  // Finance & Invoices
  'invoice.create': ['finance.write'],
  'invoice.read': ['finance.read'],
  'invoice.update': ['finance.write'],
  'invoice.delete': ['finance.write'],
  'invoice.payment.create': ['finance.payment'],
  'invoice.payment.read': ['finance.read', 'finance.payment'],
  'invoice.report': ['finance.reports', 'finance.read'],
  'finance.read': ['invoice.read'],
  'finance.write': ['invoice.create', 'invoice.update', 'invoice.delete'],
  'finance.payment': ['invoice.payment.create', 'invoice.payment.read'],
  'finance.reports': ['invoice.report'],

  // Templates & Documents
  'template.create': ['templates.manage'],
  'template.read': ['templates.read'],
  'template.update': ['templates.manage'],
  'template.delete': ['templates.manage'],
  'template.publish': ['templates.manage'],
  'templates.read': ['template.read'],
  'templates.manage': ['template.create', 'template.read', 'template.update', 'template.delete', 'template.publish'],
};

/**
 * Multi-tier Scope Hierarchy according to Blueprint Specification:
 * Institution > Campus > Academic Year > Class > Section > Subject > Assigned Students > Self
 */
export const SCOPE_HIERARCHY: Record<string, number> = {
  institution: 100,
  campus: 90,
  academic_year: 80,
  class: 70,
  section: 60,
  assigned_sections: 60,
  assigned_routes: 60,
  subject: 50,
  assigned_students: 40,
  self: 10,
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
 * Recursively resolves and expands prerequisite permissions and canonical aliases.
 * If a user possesses an action permission (e.g. `students.write`), this ensures all
 * prerequisite permissions (e.g. `students.read`) are present with at least the same scope.
 */
export function resolvePermissionDependencies(
  permissions: Map<string, string>
): Map<string, string> {
  const result = new Map<string, string>(permissions);

  // 1. Expand aliases
  for (const [key, scope] of Array.from(result.entries())) {
    const aliases = PERMISSION_ALIASES[key];
    if (aliases) {
      for (const alias of aliases) {
        if (!result.has(alias)) {
          result.set(alias, scope);
        } else {
          const existingScope = result.get(alias)!;
          const currentWeight = SCOPE_HIERARCHY[scope] || 0;
          const existingWeight = SCOPE_HIERARCHY[existingScope] || 0;
          if (currentWeight > existingWeight) {
            result.set(alias, scope);
          }
        }
      }
    }
  }

  // 2. Expand prerequisites iteratively
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

