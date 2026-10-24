import { Request, Response, NextFunction } from 'express';
import { PoolClient } from 'pg';
import { appCache } from '../cache';
import { pool } from '../db';

export type FeatureStatus = 'enabled' | 'disabled' | 'restricted';

export interface FeatureConfig {
  enabled: boolean;
  status?: FeatureStatus;
  allowedRoles?: string[];
  allowedUsers?: string[];
  allowedScopes?: string[];
}

/**
 * Mapping between permission namespaces/prefixes and institutional feature keys
 * Ensures Blueprint Section 41: Feature Availability must precede permission evaluation.
 */
export const PERMISSION_FEATURE_MAP: Record<string, string> = {
  'exam.': 'examinations',
  'exams.': 'examinations',
  'marks.': 'examinations',
  'assignment.': 'assignments',
  'assignments.': 'assignments',
  'finance.': 'finance',
  'invoice.': 'finance',
  'fee.': 'finance',
  'discount.': 'finance',
  'attendance.': 'attendance',
  'employee.attendance.': 'attendance',
  'transport.': 'transport',
  'notices.': 'notices',
  'tasks.': 'tasks',
  'admissions.': 'admissions',
  'schedules.': 'timetable',
  'timetable.': 'timetable',
};

export function getFeatureForPermission(permissionKey: string): string | null {
  for (const [prefix, feature] of Object.entries(PERMISSION_FEATURE_MAP)) {
    if (permissionKey.startsWith(prefix)) {
      return feature;
    }
  }
  return null;
}

export function invalidateFeatureCache(institutionId?: string): void {
  if (institutionId) {
    appCache.del(`inst:features:${institutionId}`);
  } else {
    appCache.invalidatePrefix('inst:features:');
  }
}

export function evaluateFeatureConfig(
  config: FeatureConfig | undefined,
  featureKey: string,
  roleName?: string,
  userId?: string
): { available: boolean; reason?: string } {
  if (!config) {
    return { available: true };
  }

  // 1. Feature is globally disabled for this institution
  if (config.enabled === false || config.status === 'disabled') {
    return {
      available: false,
      reason: `Feature '${featureKey}' is disabled for this institution`,
    };
  }

  // 2. Feature is restricted to specific roles or users
  const isRestricted =
    config.status === 'restricted' ||
    (Array.isArray(config.allowedRoles) && config.allowedRoles.length > 0);

  if (isRestricted) {
    const isAdmin = Boolean(roleName?.toLowerCase().includes('admin'));
    const roleMatch =
      roleName &&
      config.allowedRoles &&
      config.allowedRoles.some(
        (r) => r.toLowerCase() === roleName.toLowerCase()
      );
    const userMatch = userId && config.allowedUsers && config.allowedUsers.includes(userId);

    if (!isAdmin && !roleMatch && !userMatch) {
      return {
        available: false,
        reason: `Feature '${featureKey}' is restricted to specific roles in this institution`,
      };
    }
  }

  return { available: true };
}

export function getCachedFeatureCheck(
  institutionId: string,
  featureKey: string,
  roleName?: string,
  userId?: string
): { available: boolean; reason?: string } | null {
  if (!institutionId || !featureKey) return { available: true };
  const cacheKey = `inst:features:${institutionId}`;
  const features = appCache.get<Record<string, FeatureConfig>>(cacheKey);
  if (!features) return null;
  return evaluateFeatureConfig(features[featureKey], featureKey, roleName, userId);
}

/**
 * Evaluates whether an institutional feature is available to the requesting user/role.
 * Follows Blueprint Section 40 & 41:
 *  - If Feature is OFF -> No one can access it (returns false).
 *  - If Feature is RESTRICTED -> Only allowed roles/users can access it.
 *  - If Feature is ON -> Returns true, allowing permission check to proceed.
 */
export async function isFeatureAvailable(
  client: PoolClient,
  institutionId: string,
  featureKey: string,
  roleName?: string,
  userId?: string
): Promise<{ available: boolean; reason?: string }> {
  if (!institutionId || !featureKey) {
    return { available: true };
  }

  const cacheKey = `inst:features:${institutionId}`;
  let features = appCache.get<Record<string, FeatureConfig>>(cacheKey);

  if (!features) {
    const { rows } = await client.query(
      `select settings from institution_setting where institution_id = $1 limit 1`,
      [institutionId]
    );
    const settings = rows[0]?.settings || {};
    const rawLimits = settings.featureLimitations || {};
    features = {};

    const knownFeatures = [
      'examinations',
      'assignments',
      'finance',
      'timetable',
      'transport',
      'admissions',
      'attendance',
      'notices',
      'tasks',
    ];

    for (const k of knownFeatures) {
      if (rawLimits[k]) {
        features[k] = rawLimits[k];
      } else {
        const legacyKey = `enable${k.charAt(0).toUpperCase() + k.slice(1)}`;
        const isEnabled = settings[legacyKey] ?? (k !== 'transport');
        features[k] = {
          enabled: Boolean(isEnabled),
          status: isEnabled ? 'enabled' : 'disabled',
        };
      }
    }

    appCache.set(cacheKey, features, 120);
  }

  return evaluateFeatureConfig(features[featureKey], featureKey, roleName, userId);
}

/**
 * Standalone middleware to enforce feature availability on an Express route
 */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const institutionId = req.ctx?.institutionId;
    if (!institutionId) {
      return next();
    }

    // Zero-connection fast path
    const cachedCheck = getCachedFeatureCheck(
      institutionId,
      featureKey,
      req.ctx?.roleName,
      req.ctx?.userId
    );
    if (cachedCheck !== null) {
      if (!cachedCheck.available) {
        return res.status(403).json({
          error: cachedCheck.reason || `Feature '${featureKey}' is disabled`,
          code: 'FEATURE_DISABLED',
        });
      }
      return next();
    }

    const client = await pool.connect();
    try {
      const check = await isFeatureAvailable(
        client,
        institutionId,
        featureKey,
        req.ctx?.roleName,
        req.ctx?.userId
      );
      if (!check.available) {
        return res.status(403).json({
          error: check.reason || `Feature '${featureKey}' is disabled`,
          code: 'FEATURE_DISABLED',
        });
      }
      next();
    } catch (err) {
      next(err);
    } finally {
      client.release();
    }
  };
}

