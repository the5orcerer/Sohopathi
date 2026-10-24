import { PoolClient } from 'pg';
import { appCache } from '../cache';
import { resolvePermissionDependencies } from './dependencies';

export interface ResolvedContext {
  userId: string;
  institutionId: string;
  membershipId: string;
  roleId: string;
  roleName: string;
  permissions: Map<string, string>; // permission key -> scope
}

export function invalidateContextCache(userId?: string, institutionId?: string): void {
  if (userId && institutionId) {
    appCache.del(`ctx:${userId}:${institutionId}`);
  } else {
    appCache.invalidatePrefix('ctx:');
  }
}

export function getCachedContext(userId: string, institutionId: string): ResolvedContext | null {
  if (!institutionId || !userId) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(institutionId);
  let resolvedInstId = institutionId;
  if (!isUuid) {
    const cachedInstId = appCache.get<string>(`inst:sub:${institutionId.toLowerCase()}`);
    if (!cachedInstId) return null;
    resolvedInstId = cachedInstId;
  }
  const cacheKey = `ctx:${userId}:${resolvedInstId}`;
  return appCache.get<ResolvedContext>(cacheKey);
}

export async function resolveContext(
  client: PoolClient,
  userId: string,
  institutionId: string
): Promise<ResolvedContext | null> {
  if (!institutionId || !userId) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(institutionId);
  let resolvedInstId = institutionId;

  if (!isUuid) {
    const cachedInstId = appCache.get<string>(`inst:sub:${institutionId.toLowerCase()}`);
    if (cachedInstId) {
      resolvedInstId = cachedInstId;
    } else {
      const { rows: instRows } = await client.query(
        `select id from institution where lower(subdomain) = lower($1) or lower(name) = lower($1)`,
        [institutionId]
      );
      if (instRows.length === 0) return null;
      resolvedInstId = instRows[0].id;
      appCache.set(`inst:sub:${institutionId.toLowerCase()}`, resolvedInstId, 300);
    }
  }

  const cacheKey = `ctx:${userId}:${resolvedInstId}`;
  const shouldCache = process.env.NODE_ENV !== 'test';
  if (shouldCache) {
    const cached = appCache.get<ResolvedContext>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    await client.query('BEGIN');
    // Set tenant context for this connection so RLS allows reading membership and role_permission
    await client.query(`SET LOCAL app.current_institution_id = '${resolvedInstId}'`);

    const { rows: memberRows } = await client.query(
      `select m.id as membership_id, m.role_id, coalesce(r.name, 'Member') as role_name
       from membership m
       left join role r on r.id = m.role_id
       where m.user_id = $1 and m.institution_id = $2 and m.status = 'active'`,
      [userId, resolvedInstId]
    );

    if (memberRows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const membershipId = memberRows[0].membership_id;
    const roleId = memberRows[0].role_id;
    const roleName = memberRows[0].role_name || 'Member';

    // Fetch granted permissions where the parent module is enabled for this institution
    const { rows: permRows } = await client.query(
      `select p.key as permission_key, rp.scope
       from membership m
       join role_permission rp on rp.role_id = m.role_id
       join permission p on p.id = rp.permission_id
       join institution_module im
         on im.institution_id = m.institution_id
        and im.module_id = p.module_id
        and im.enabled = true
       where m.id = $1 and m.status = 'active'
       union
       select p.key as permission_key, rp.scope
       from membership m
       join role r on r.id = m.role_id
       join role tr on lower(tr.name) = lower(r.name) and tr.institution_id is null
       join role_permission rp on rp.role_id = tr.id
       join permission p on p.id = rp.permission_id
       join institution_module im
         on im.institution_id = m.institution_id
        and im.module_id = p.module_id
        and im.enabled = true
       where m.id = $1 and m.status = 'active'`,
      [membershipId]
    );

    const rawPermissions = new Map<string, string>();
    for (const row of permRows) {
      rawPermissions.set(row.permission_key, row.scope || 'institution');
    }
    await client.query('COMMIT');

    const permissions = resolvePermissionDependencies(rawPermissions);

    const result: ResolvedContext = {
      userId,
      institutionId: resolvedInstId,
      membershipId,
      roleId,
      roleName,
      permissions,
    };

    if (shouldCache) {
      appCache.set(cacheKey, result, 60);
    }

    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  }
}
