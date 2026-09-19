import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { logger } from '../../core/logger';
import { sanitizeDatabaseError } from '../../core/errors';

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

    // Sync all module manifests & permissions to database catalog
    const { syncAllRegisteredModules } = await import('../../core/registry/module-registry');
    await syncAllRegisteredModules(client);

    // 2. Enable all active modules for the new institution
    await client.query(
      `insert into institution_module (institution_id, module_id, enabled)
       select $1, id, true from module
       on conflict (institution_id, module_id) do update set enabled = true`,
      [institutionId]
    );

    // 3. Provision tenant roles by copying canonical template roles
    await client.query(
      `insert into role (institution_id, name, is_system)
       select $1, name, true
       from role
       where institution_id is null
       on conflict do nothing`,
      [institutionId]
    );

    // Ensure all canonical roles exist for this tenant
    const standardRoles = ['Institution Admin', 'Teacher', 'Student', 'Staff', 'Guardian'];
    for (const rName of standardRoles) {
      await client.query(
        `insert into role (institution_id, name, is_system)
         values ($1, $2, true)
         on conflict do nothing`,
        [institutionId, rName]
      );
    }

    // Copy template role permissions to the newly created institution roles
    await client.query(
      `insert into role_permission (institution_id, role_id, permission_id, scope)
       select $1, new_r.id, rp.permission_id, rp.scope
       from role_permission rp
       join role tmpl_r on tmpl_r.id = rp.role_id and tmpl_r.institution_id is null
       join role new_r on new_r.institution_id = $1 and lower(new_r.name) = lower(tmpl_r.name)
       on conflict (role_id, permission_id) do nothing`,
      [institutionId]
    );

    // Resolve canonical Institution Admin system role for this tenant
    const { rows: adminRoleRows } = await client.query(
      `select id from role where institution_id = $1 and lower(name) in ('institution admin', 'admin') limit 1`,
      [institutionId]
    );
    let adminRoleId: string = adminRoleRows[0]?.id;
    if (!adminRoleId) {
      const { rows: fallbackRows } = await client.query(
        `insert into role (institution_id, name, is_system) values ($1, 'Institution Admin', true) returning id`,
        [institutionId]
      );
      adminRoleId = fallbackRows[0].id;
    }

    // Ensure the Institution Admin role has full grants across all enabled permissions
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
        `insert into auth.users (id, email, raw_user_meta_data, aud, role)
         values (gen_random_uuid(), $1, $2, 'authenticated', 'authenticated')
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

    // Commit before sending response so all tenant data is visible to subsequent requests
    await client.query('COMMIT');

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
    const sanitized = sanitizeDatabaseError(err);
    res.status(sanitized.statusCode).json({ error: sanitized.message, code: sanitized.code });
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
