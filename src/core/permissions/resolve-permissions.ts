import { PoolClient } from 'pg';

export interface ResolvedContext {
  userId: string;
  institutionId: string;
  membershipId: string;
  roleId: string;
  roleName: string;
  permissions: Map<string, string>; // permission key -> scope
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
    const { rows: instRows } = await client.query(
      `select id from institution where lower(subdomain) = lower($1) or lower(name) = lower($1)`,
      [institutionId]
    );
    if (instRows.length === 0) return null;
    resolvedInstId = instRows[0].id;
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

    // 1. Fetch direct role permissions OR inherited template role permissions for enabled modules
    const { rows: permRows } = await client.query(
      `select p.key as permission_key, rp.scope
       from role_permission rp
       join permission p on p.id = rp.permission_id
       join institution_module im on im.module_id = p.module_id and im.institution_id = $1 and im.enabled = true
       where rp.role_id = $2
          or rp.role_id in (
            select id from role
            where lower(name) = lower($3) and institution_id is null
          )`,
      [resolvedInstId, roleId, roleName]
    );

    const permissions = new Map<string, string>();
    for (const row of permRows) {
      permissions.set(row.permission_key, row.scope || 'institution');
    }

    // 2. If user has an administrative role (Institution Admin, Owner, Principal, Academic Coordinator),
    // ensure full access to all registered platform permissions for enabled modules
    const isSuperAdmin =
      roleName.toLowerCase().includes('admin') ||
      roleName.toLowerCase().includes('owner') ||
      roleName.toLowerCase().includes('principal') ||
      roleName.toLowerCase().includes('headmaster') ||
      roleName.toLowerCase().includes('coordinator');

    if (isSuperAdmin) {
      const { rows: allPerms } = await client.query(
        `select p.key, case when 'institution' = any(p.scope_options) then 'institution' else coalesce(p.scope_options[1], 'institution') end as scope
         from permission p
         join institution_module im on im.module_id = p.module_id and im.institution_id = $1 and im.enabled = true`,
        [resolvedInstId]
      );
      for (const p of allPerms) {
        if (!permissions.has(p.key) || permissions.get(p.key) !== 'institution') {
          permissions.set(p.key, 'institution');
        }
      }
    }

    await client.query('COMMIT');

    return {
      userId,
      institutionId: resolvedInstId,
      membershipId,
      roleId,
      roleName,
      permissions,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  }
}
