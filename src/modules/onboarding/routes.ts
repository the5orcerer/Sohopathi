import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { logger } from '../../core/logger';

export async function onboardInstitution(req: Request, res: Response, client: PoolClient) {
  try {
    const {
      name,
      subdomain,
      adminName = req.body.ownerName || 'Principal Admin',
      adminEmail = req.body.ownerEmail,
      adminUsername = req.body.username || 'admin',
      branding,
    } = req.body;

    if (!name || !subdomain || !adminEmail) {
      return res.status(400).json({ error: 'name, subdomain, and adminEmail are required' });
    }

    const cleanSubdomain = subdomain.trim().toLowerCase();

    // 1. Create institution
    const { rows: instRows } = await client.query(
      `insert into institution (name, subdomain, branding, status)
       values ($1, $2, $3, 'active')
       returning id, name, subdomain`,
      [name, cleanSubdomain, branding ? JSON.stringify(branding) : null]
    );
    const institutionId = instRows[0].id;

    // Set transaction context to the newly created institution ID so RLS policies pass
    await client.query(`SET LOCAL app.current_institution_id = '${institutionId}'`);

    // 2. Enable all active modules for the new institution
    await client.query(
      `insert into institution_module (institution_id, module_id, enabled)
       select $1, id, true from module
       on conflict (institution_id, module_id) do update set enabled = true`,
      [institutionId]
    );

    // 3. Clone template roles (institution_id is null) into institution-owned roles
    const { rows: templateRoles } = await client.query(
      `select id, name from role where institution_id is null`
    );

    let adminRoleId: string | null = null;

    for (const tRole of templateRoles) {
      const { rows: newRoleRows } = await client.query(
        `insert into role (institution_id, name, is_system)
         values ($1, $2, false)
         returning id`,
        [institutionId, tRole.name]
      );
      const newRoleId = newRoleRows[0].id;

      if (tRole.name === 'Admin' || tRole.name === 'Institution Admin') {
        adminRoleId = newRoleId;
      }

      // Copy template role permissions into institution role
      await client.query(
        `insert into role_permission (institution_id, role_id, permission_id, scope)
         select $1, $2, permission_id, scope
         from role_permission
         where role_id = $3
         on conflict (role_id, permission_id) do nothing`,
        [institutionId, newRoleId, tRole.id]
      );
    }

    if (!adminRoleId) {
      const { rows: fallbackRows } = await client.query(
        `insert into role (institution_id, name, is_system) values ($1, 'Institution Admin', false) returning id`,
        [institutionId]
      );
      adminRoleId = fallbackRows[0].id;
    }

    // Ensure the new Institution Admin role has full grants across all enabled permissions
    await client.query(
      `insert into role_permission (institution_id, role_id, permission_id, scope)
       select $1, $2, p.id,
              case when 'institution' = any(p.scope_options) then 'institution' else p.scope_options[1] end
       from permission p
       on conflict (role_id, permission_id) do nothing`,
      [institutionId, adminRoleId]
    );

    // 4. Create or Resolve Admin user & profile
    let userId: string;

    const { rows: authRows } = await client.query(
      `select id from auth.users where lower(email) = lower($1)`,
      [adminEmail]
    );

    if (authRows.length > 0) {
      userId = authRows[0].id;
    } else {
      const { rows: newAuthRows } = await client.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values (gen_random_uuid(), $1, $2)
         returning id`,
        [adminEmail.trim().toLowerCase(), JSON.stringify({ name: adminName })]
      );
      userId = newAuthRows[0].id;
    }

    const cleanEmail = adminEmail.trim().toLowerCase();
    // Create or update profile
    await client.query(
      `insert into profile (id, name, email, must_change_password)
       values ($1, $2, $3, false)
       on conflict (id) do update 
       set name = excluded.name, 
           email = coalesce(excluded.email, profile.email)`,
      [userId, adminName, cleanEmail]
    );

    // 5. Create initial Admin membership with login_username = 'admin'
    const loginUsername = (adminUsername || 'admin').trim().toLowerCase();
    const { rows: memberRows } = await client.query(
      `insert into membership (user_id, institution_id, role_id, login_username, status, invite_status)
       values ($1, $2, $3, $4, 'active', 'active')
       on conflict (user_id, institution_id) do update 
       set role_id = excluded.role_id,
       login_username = excluded.login_username,
       status = 'active'
       returning id`,
      [userId, institutionId, adminRoleId, loginUsername]
    );
    const ownerMembershipId = memberRows[0].id;

    // 6. Log audit event
    await logAudit(client, {
      institutionId,
      actorMembershipId: ownerMembershipId,
      action: 'provision_institution',
      entityType: 'institution',
      entityId: institutionId,
      after: { name, subdomain: cleanSubdomain, adminEmail, adminName, loginUsername },
    });

    res.status(201).json({
      institutionId,
      institutionUuid: institutionId,
      subdomain: cleanSubdomain,
      institutionName: name,
      username: loginUsername,
      adminEmail,
      adminName,
      ownerMembershipId,
      ownerUserId: userId,
    });
  } catch (err: any) {
    logger.error(err, 'Error in onboardInstitution');
    res.status(500).json({ error: err.message || 'Onboarding failed', code: 'ONBOARDING_ERROR' });
  }
}

export async function listInstitutions(req: Request, res: Response, client: PoolClient) {
  try {
    const { rows } = await client.query(`
      select 
        i.id,
        i.name,
        i.subdomain,
        i.branding,
        i.status,
        i.created_at as "createdAt",
        (select count(*) from membership m where m.institution_id = i.id) as "memberCount",
        (select count(*) from student s where s.institution_id = i.id) as "studentCount"
      from institution i
      order by i.created_at desc
    `);
    res.json(rows);
  } catch (err: any) {
    logger.error(err, 'Error in listInstitutions');
    res.status(500).json({ error: 'Failed to list institutions' });
  }
}
