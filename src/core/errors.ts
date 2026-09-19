import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { logger } from './logger';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }
}

export function sanitizeDatabaseError(err: any): { message: string; statusCode: number; code: string } {
  if (!err) {
    return { message: 'An unexpected error occurred', statusCode: 500, code: 'INTERNAL_SERVER_ERROR' };
  }

  // Check if it's already an AppError
  if (err instanceof AppError) {
    return {
      message: err.message,
      statusCode: err.statusCode,
      code: err.code || 'APP_ERROR',
    };
  }

  // Postgres unique_violation (code 23505)
  if (err.code === '23505' || (err.message && err.message.includes('violates unique constraint'))) {
    const constraint = (err.constraint || err.message || '').toLowerCase();
    if (constraint.includes('subdomain')) {
      return {
        message: 'This subdomain or institution identifier is already in use. Please choose a different subdomain.',
        statusCode: 409,
        code: 'DUPLICATE_SUBDOMAIN',
      };
    }
    if (constraint.includes('email')) {
      return {
        message: 'An account with this email address already exists. Please use a different email or sign in.',
        statusCode: 409,
        code: 'DUPLICATE_EMAIL',
      };
    }
    if (constraint.includes('username')) {
      return {
        message: 'This username is already taken. Please choose another username.',
        statusCode: 409,
        code: 'DUPLICATE_USERNAME',
      };
    }
    if (constraint.includes('institute_code') || constraint.includes('eiin')) {
      return {
        message: 'An institution with this EIIN or code is already registered.',
        statusCode: 409,
        code: 'DUPLICATE_INSTITUTION_CODE',
      };
    }
    return {
      message: 'A record with these unique details already exists. Please verify your input and try again.',
      statusCode: 409,
      code: 'DUPLICATE_RECORD',
    };
  }

  // Postgres foreign_key_violation (code 23503)
  if (err.code === '23503' || (err.message && err.message.includes('violates foreign key constraint'))) {
    return {
      message: 'The referenced record or entity could not be found or has been removed.',
      statusCode: 400,
      code: 'FOREIGN_KEY_VIOLATION',
    };
  }

  // Postgres not_null_violation (code 23502)
  if (err.code === '23502' || (err.message && err.message.includes('violates not-null constraint'))) {
    const col = err.column ? ` '${err.column}'` : '';
    return {
      message: `A required field${col} is missing.`,
      statusCode: 400,
      code: 'NOT_NULL_VIOLATION',
    };
  }

  // Postgres check_violation (code 23514)
  if (err.code === '23514') {
    return {
      message: 'The submitted data does not meet validation criteria.',
      statusCode: 400,
      code: 'CHECK_VIOLATION',
    };
  }

  // Query syntax / missing column / table error
  if (err.code?.startsWith('42') || (err.message && (err.message.includes('cannot be matched') || err.message.includes('does not exist')))) {
    return {
      message: 'A database query error occurred while processing the request.',
      statusCode: 500,
      code: 'DATABASE_QUERY_ERROR',
    };
  }

  // If the error message mentions SQL / internal database internals
  if (err.message && (err.message.includes('syntax error') || err.message.includes('relation "') || err.message.includes('column "'))) {
    return {
      message: 'An internal database error occurred.',
      statusCode: 500,
      code: 'INTERNAL_DATABASE_ERROR',
    };
  }

  return {
    message: err.message || 'Internal Server Error',
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
  };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  Sentry.captureException(err, {
    extra: {
      url: req.originalUrl,
      method: req.method,
      institutionId: req.ctx?.institutionId,
      userId: req.userId,
    },
  });

  logger.error(err, 'Unhandled error encountered');

  const sanitized = sanitizeDatabaseError(err);
  return res.status(sanitized.statusCode).json({
    error: sanitized.message,
    code: sanitized.code,
  });
}
