import { z } from 'zod';

/**
 * Canonical Content Limits Specification (Blueprint Section 36)
 * Server-side and client-side shared boundaries for user-generated text fields.
 */
export const CONTENT_LIMITS = {
  TITLE_MAX: 150,
  SHORT_DESCRIPTION_MAX: 500,
  DESCRIPTION_MAX: 10_000,
  NOTICE_BODY_MAX: 20_000,
  TASK_DESCRIPTION_MAX: 10_000,
  ASSIGNMENT_DESCRIPTION_MAX: 10_000,
  NAME_MAX: 150,
  REASON_MAX: 1_000,
  CODE_MAX: 50,
} as const;

export class ContentLimitError extends Error {
  public field: string;
  public max: number;
  public actual: number;

  constructor(field: string, max: number, actual: number) {
    super(`Field '${field}' exceeds maximum length of ${max} characters (got ${actual})`);
    this.name = 'ContentLimitError';
    this.field = field;
    this.max = max;
    this.actual = actual;
  }
}

/**
 * Enforces string length boundary. Throws ContentLimitError if exceeded.
 */
export function assertContentLength(
  value: string | undefined | null,
  field: string,
  max: number,
  required = false
): void {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new Error(`Field '${field}' is required`);
    }
    return;
  }

  const len = value.trim().length;
  if (required && len === 0) {
    throw new Error(`Field '${field}' cannot be empty`);
  }
  if (len > max) {
    throw new ContentLimitError(field, max, len);
  }
}

/**
 * Reusable Zod schemas for text fields strictly adhering to Blueprint Section 36
 */
export const ContentLimitSchemas = {
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(CONTENT_LIMITS.TITLE_MAX, `Title cannot exceed ${CONTENT_LIMITS.TITLE_MAX} characters`),

  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(CONTENT_LIMITS.NAME_MAX, `Name cannot exceed ${CONTENT_LIMITS.NAME_MAX} characters`),

  shortDescription: z
    .string()
    .trim()
    .max(
      CONTENT_LIMITS.SHORT_DESCRIPTION_MAX,
      `Short description cannot exceed ${CONTENT_LIMITS.SHORT_DESCRIPTION_MAX} characters`
    )
    .optional()
    .nullable(),

  description: z
    .string()
    .trim()
    .max(
      CONTENT_LIMITS.DESCRIPTION_MAX,
      `Description cannot exceed ${CONTENT_LIMITS.DESCRIPTION_MAX} characters`
    )
    .optional()
    .nullable(),

  noticeBody: z
    .string()
    .trim()
    .min(1, 'Notice body is required')
    .max(
      CONTENT_LIMITS.NOTICE_BODY_MAX,
      `Notice body cannot exceed ${CONTENT_LIMITS.NOTICE_BODY_MAX} characters`
    ),

  taskDescription: z
    .string()
    .trim()
    .max(
      CONTENT_LIMITS.TASK_DESCRIPTION_MAX,
      `Task description cannot exceed ${CONTENT_LIMITS.TASK_DESCRIPTION_MAX} characters`
    )
    .optional()
    .nullable(),

  assignmentDescription: z
    .string()
    .trim()
    .max(
      CONTENT_LIMITS.ASSIGNMENT_DESCRIPTION_MAX,
      `Assignment description cannot exceed ${CONTENT_LIMITS.ASSIGNMENT_DESCRIPTION_MAX} characters`
    )
    .optional()
    .nullable(),

  reason: z
    .string()
    .trim()
    .max(
      CONTENT_LIMITS.REASON_MAX,
      `Reason cannot exceed ${CONTENT_LIMITS.REASON_MAX} characters`
    )
    .optional()
    .nullable(),
};

