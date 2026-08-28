import { Router, Request, Response } from 'express';
import { withTenantContext } from '../db';
import { authenticate } from '../permissions/middleware';
import { randomUUID } from 'crypto';

export const authRouter = Router();

// 1. List Institutions
authRouter.get('/institutions', async (req: Request, res: Response) => {
  try {
    const result = await withTenantContext(null, async (client) => {
      const { rows } = await client.query(`
        select id, name, subdomain, status, created_at
        from institution
        where status = 'active'
        order by name asc
      `);
      return rows;
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list institutions' });
  }
});

// 1b. Onboard / Provision Institution Route
authRouter.post('/onboard', async (req: Request, res: Response) => {
  try {
    const { onboardInstitution } = await import('../../modules/onboarding/routes');
    await withTenantContext(null, async (client) => {
      await onboardInstitution(req, res, client);
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Provisioning failed' });
    }
  }
});

// 2. Institution-Scoped Login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { institutionCode, username, email, password, institutionId } = req.body;

  try {
    const sessionData = await withTenantContext(null, async (client) => {
      let instId = institutionId;

      // If institutionCode or subdomain was passed, resolve institution ID
      if (!instId && institutionCode) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(institutionCode);
        const { rows: instRows } = await client.query(
          isUuid
            ? `select id, name, subdomain from institution where id = $1`
            : `select id, name, subdomain from institution where lower(subdomain) = lower($1) or lower(name) = lower($1)`,
          [institutionCode]
        );

        if (instRows.length === 0) {
          throw new Error('Institution not found. Please check your Institution Code.');
        }
        instId = instRows[0].id;
      }

      let userRow: any = null;
      let memberRow: any = null;

      // Authenticate via username + institutionId OR via email
      if (instId && (username || email)) {
        const identifier = (username || email).trim();
        // Find membership by login_username or auth email within institution
        const { rows: matches } = await client.query(
          `select m.id as membership_id, m.institution_id, m.user_id, m.role_id, m.login_username,
                  p.id as profile_id, p.name, coalesce(u.email, '') as email, p.phone, p.avatar_url, p.must_change_password,
                  i.name as institution_name, i.subdomain as institution_subdomain,
                  coalesce(r.name, 'Member') as role_name
           from membership m
           join profile p on p.id = m.user_id
           left join auth.users u on u.id = p.id
           join institution i on i.id = m.institution_id
           left join role r on r.id = m.role_id
           where m.institution_id = $1
             and (lower(m.login_username) = lower($2) or lower(coalesce(u.email, '')) = lower($2))
           limit 1`,
          [instId, identifier]
        );

        if (matches.length > 0) {
          memberRow = matches[0];
          userRow = {
            id: memberRow.profile_id,
            name: memberRow.name,
            email: memberRow.email,
            phone: memberRow.phone,
            avatarUrl: memberRow.avatar_url,
            mustChangePassword: memberRow.must_change_password ?? false,
          };
        }
      } else if (email) {
        const { rows: profiles } = await client.query(
          `select p.id, p.name, coalesce(u.email, '') as email, p.phone, p.avatar_url, p.must_change_password
           from profile p
           join auth.users u on u.id = p.id
           where lower(u.email) = lower($1)`,
          [email.trim()]
        );
        if (profiles.length > 0) {
          userRow = {
            ...profiles[0],
            mustChangePassword: profiles[0].must_change_password ?? false,
          };
        }
      }

      if (!userRow) {
        throw new Error('Invalid credentials or user not found for this institution.');
      }

      // Fetch all memberships for this user
      const { rows: memberships } = await client.query(
        `select m.id, m.institution_id, m.role_id, m.login_username,
                i.name as institution_name, i.subdomain as institution_subdomain,
                coalesce(r.name, 'Member') as role_name
         from membership m
         join institution i on i.id = m.institution_id
         left join role r on r.id = m.role_id
         where m.user_id = $1`,
        [userRow.id]
      );

      if (memberships.length === 0) {
        throw new Error('User has no active institution memberships');
      }

      const active = memberRow
        ? {
            id: memberRow.membership_id,
            institutionId: memberRow.institution_id,
            institutionName: memberRow.institution_name,
            institutionSubdomain: memberRow.institution_subdomain,
            username: memberRow.login_username,
            roleId: memberRow.role_id,
            roleName: memberRow.role_name || 'Member',
          }
        : {
            id: memberships[0].id,
            institutionId: memberships[0].institution_id,
            institutionName: memberships[0].institution_name,
            institutionSubdomain: memberships[0].institution_subdomain,
            username: memberships[0].login_username,
            roleId: memberships[0].role_id,
            roleName: memberships[0].role_name || 'Member',
          };

      const token = `mock-token-${userRow.id}`;

      return {
        token,
        user: {
          id: userRow.id,
          name: userRow.name,
          email: userRow.email,
          phone: userRow.phone,
          avatarUrl: userRow.avatar_url,
        },
        activeMembership: active,
        memberships: memberships.map((m: any) => ({
          id: m.id,
          institutionId: m.institution_id,
          institutionName: m.institution_name,
          institutionSubdomain: m.institution_subdomain,
          username: m.login_username,
          roleId: m.role_id,
          roleName: m.role_name,
        })),
        mustChangePassword: !!userRow.mustChangePassword,
      };
    });

    res.json(sessionData);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Authentication failed' });
  }
});

// 3. Forced First-Login Password Change
authRouter.post('/change-password', authenticate, async (req: Request, res: Response) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await withTenantContext(null, async (client) => {
      await client.query(
        `update profile set must_change_password = false, password_hash = $1 where id = $2`,
        [newPassword, userId]
      );
    });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update password' });
  }
});

// 3b. Self-Profile Update (Authenticated User)
authRouter.patch('/profile', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { name, phone, avatarUrl, password } = req.body;

  try {
    const updated = await withTenantContext(null, async (client) => {
      let query = `update profile set updated_at = now()`;
      const params: any[] = [];

      if (name && name.trim()) {
        params.push(name.trim());
        query += `, name = $${params.length}`;
      }
      if (phone !== undefined) {
        params.push(phone ? phone.trim() : null);
        query += `, phone = $${params.length}`;
      }
      if (avatarUrl !== undefined) {
        params.push(avatarUrl ? avatarUrl.trim() : null);
        query += `, avatar_url = $${params.length}`;
      }
      if (password && password.length >= 6) {
        params.push(password);
        query += `, password_hash = $${params.length}, must_change_password = false`;
      }

      params.push(userId);
      query += ` where id = $${params.length} returning id, name, phone, avatar_url as "avatarUrl", must_change_password as "mustChangePassword"`;

      const { rows } = await client.query(query, params);
      return rows[0];
    });

    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update profile' });
  }
});

// 4. Sign Up (Single Tenant or Profile creation)
authRouter.post('/signup', async (req: Request, res: Response) => {
  const { email, name, phone, roleName, username, institutionId } = req.body;

  if (!email || !name) {
    res.status(400).json({ error: 'Email and name are required' });
    return;
  }

  try {
    const result = await withTenantContext(null, async (client) => {
      // Find or create institution
      let targetInstId = institutionId;
      if (!targetInstId) {
        const { rows: insts } = await client.query(`select id, name, subdomain from institution limit 1`);
        if (insts.length === 0) {
          const newInstId = randomUUID();
          await client.query(
            `insert into institution (id, name, subdomain, status) values ($1, $2, $3, 'active')`,
            [newInstId, 'Dhaka Model International Academy', 'dhakamodel']
          );
          targetInstId = newInstId;
        } else {
          targetInstId = insts[0].id;
        }
      }

      // Upsert profile
      const { rows: profileRows } = await client.query(
        `insert into profile (id, email, name, phone, must_change_password)
         values ($1, $2, $3, $4, false)
         on conflict (id) do update set name = excluded.name, phone = coalesce(excluded.phone, profile.phone)
         returning id, name, email, phone, avatar_url, must_change_password`,
        [randomUUID(), email.trim(), name.trim(), phone?.trim() || null]
      );
      const user = profileRows[0];

      // Find role
      const { rows: roleRows } = await client.query(
        `select id, name from role
         where (institution_id = $1 or institution_id is null)
           and lower(name) = lower($2)
         order by institution_id nulls last
         limit 1`,
        [targetInstId, roleName || 'Student / Guardian']
      );

      const roleId = roleRows.length > 0 ? roleRows[0].id : null;
      const resolvedRoleName = roleRows.length > 0 ? roleRows[0].name : (roleName || 'Member');
      const loginHandle = username || email.split('@')[0];

      // Insert membership
      const { rows: memberRows } = await client.query(
        `insert into membership (id, institution_id, user_id, role_id, login_username, invite_status)
         values ($1, $2, $3, $4, $5, 'active')
         on conflict (institution_id, user_id) do update
           set role_id = coalesce(excluded.role_id, membership.role_id),
               login_username = coalesce(excluded.login_username, membership.login_username)
         returning id, institution_id, role_id, login_username`,
        [randomUUID(), targetInstId, user.id, roleId, loginHandle]
      );
      const membership = memberRows[0];

      const { rows: instDetail } = await client.query(
        `select name, subdomain from institution where id = $1`,
        [targetInstId]
      );

      const token = `mock-token-${user.id}`;

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatar_url,
        },
        activeMembership: {
          id: membership.id,
          institutionId: membership.institution_id,
          institutionName: instDetail[0]?.name || 'Institution',
          institutionSubdomain: instDetail[0]?.subdomain || 'school',
          username: membership.login_username,
          roleId: membership.role_id,
          roleName: resolvedRoleName,
        },
        memberships: [
          {
            id: membership.id,
            institutionId: membership.institution_id,
            institutionName: instDetail[0]?.name || 'Institution',
            institutionSubdomain: instDetail[0]?.subdomain || 'school',
            username: membership.login_username,
            roleId: membership.role_id,
            roleName: resolvedRoleName,
          },
        ],
        mustChangePassword: false,
      };
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create account' });
  }
});
