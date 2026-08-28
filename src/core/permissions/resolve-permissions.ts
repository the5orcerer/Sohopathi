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

  const { rows: memberRows } = await client.query(
    `select m.id as membership_id, m.role_id, coalesce(r.name, 'Member') as role_name
     from membership m
     left join role r on r.id = m.role_id
     where m.user_id = $1 and m.institution_id = $2 and m.status = 'active'`,
    [userId, resolvedInstId]
  );

  if (memberRows.length === 0) return null;

  const membershipId = memberRows[0].membership_id;
  const roleId = memberRows[0].role_id;
  const roleName = memberRows[0].role_name || 'Member';

  // 1. Fetch direct role permissions OR inherited template role permissions
  const { rows: permRows } = await client.query(
    `select p.key as permission_key, rp.scope
     from role_permission rp
     join permission p on p.id = rp.permission_id
     where rp.role_id = $1
        or rp.role_id in (
          select id from role
          where lower(name) = lower($2) and institution_id is null
        )`,
    [roleId, roleName]
  );

  const permissions = new Map<string, string>();
  for (const row of permRows) {
    permissions.set(row.permission_key, row.scope || 'institution');
  }

  // 2. If the user is an Administrator / Owner / Principal, ensure all system permissions are granted
  const isSuperAdmin =
    roleName.toLowerCase().includes('admin') ||
    roleName.toLowerCase().includes('owner') ||
    roleName.toLowerCase().includes('principal');

  if (isSuperAdmin && permissions.size === 0) {
    const { rows: allPerms } = await client.query(
      `select key, case when 'institution' = any(scope_options) then 'institution' else scope_options[1] end as scope from permission`
    );
    for (const p of allPerms) {
      permissions.set(p.key, p.scope || 'institution');
    }
  }

  return {
    userId,
    institutionId: resolvedInstId,
    membershipId,
    roleId,
    roleName,
    permissions,
  };
}
