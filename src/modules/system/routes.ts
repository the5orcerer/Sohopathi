import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { registeredManifests } from '../../core/registry/module-registry';
import { WidgetDefinition, NavItemDefinition } from '../../core/registry/types';

export async function getMe(req: Request, res: Response, client: PoolClient) {
  const { rows: userRows } = await client.query(
    `select p.id, p.name, p.phone, p.avatar_url, coalesce(u.email, '') as email
     from profile p
     left join auth.users u on u.id = p.id
     where p.id = $1`,
    [req.ctx!.userId]
  );

  const { rows: instRows } = await client.query(
    `select id, name, subdomain, branding, status
     from institution
     where id = $1`,
    [req.ctx!.institutionId]
  );

  const user = userRows[0] || { id: req.ctx!.userId, name: 'User' };
  const institution = instRows[0] || { id: req.ctx!.institutionId, name: 'Institution', subdomain: 'school' };

  res.json({
    user,
    institution,
    membership: {
      id: req.ctx!.membershipId,
      institutionId: req.ctx!.institutionId,
      roleId: req.ctx!.roleId,
      roleName: req.ctx!.roleName,
    },
    permissions: Array.from(req.ctx!.permissions.keys()),
  });
}

export async function getNav(req: Request, res: Response) {
  const allNavItems: NavItemDefinition[] = [];
  for (const manifest of registeredManifests) {
    if (manifest.navItem) {
      if (Array.isArray(manifest.navItem)) {
        allNavItems.push(...manifest.navItem);
      } else {
        allNavItems.push(manifest.navItem);
      }
    }
  }

  // Filter navigation items by user's resolved permissions or admin role
  const isSuperAdmin =
    req.ctx?.roleName?.toLowerCase().includes('admin') ||
    req.ctx?.roleName?.toLowerCase().includes('principal') ||
    req.ctx?.roleName?.toLowerCase().includes('owner');

  const authorizedNavItems = allNavItems.filter((item) =>
    !item.requiredPermission ||
    isSuperAdmin ||
    req.ctx?.permissions.has(item.requiredPermission)
  );

  // Sort nav items by sortOrder
  authorizedNavItems.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

  res.json(authorizedNavItems);
}

export async function getDashboard(req: Request, res: Response, client: PoolClient) {
  // Collect all widgets across registered modules
  const allWidgets: WidgetDefinition[] = [];
  for (const manifest of registeredManifests) {
    allWidgets.push(...manifest.widgets);
  }

  // Filter widgets by user's permissions
  const activeWidgets = allWidgets.filter((w) =>
    w.requiredPermissions.every((perm) => req.ctx!.permissions.has(perm))
  );

  // Check for custom dashboard layout in database
  const { rows: layoutRows } = await client.query(
    `select dl.x, dl.y, dl.width, dl.height, w.key as widget_key
     from dashboard_layout dl
     join widget w on w.id = dl.widget_id
     where (dl.scope_type = 'user' and dl.scope_id = $1)
        or (dl.scope_type = 'role' and dl.scope_id = $2)
        or (dl.scope_type = 'institution' and dl.institution_id = $3)
     order by case dl.scope_type when 'user' then 1 when 'role' then 2 else 3 end`,
    [req.ctx!.userId, req.ctx!.roleId, req.ctx!.institutionId]
  );

  const customLayoutMap: Record<string, { x: number; y: number; width: number; height: number }> = {};
  for (const row of layoutRows) {
    if (!customLayoutMap[row.widget_key]) {
      customLayoutMap[row.widget_key] = {
        x: row.x,
        y: row.y,
        width: row.width,
        height: row.height,
      };
    }
  }

  let currentX = 0;
  let currentY = 0;

  const resultWidgets = activeWidgets.map((w) => {
    const layout = customLayoutMap[w.id] ?? {
      x: currentX,
      y: currentY,
      width: w.defaultSize.width,
      height: w.defaultSize.height,
    };

    if (!customLayoutMap[w.id]) {
      currentX += w.defaultSize.width;
      if (currentX >= 12) {
        currentX = 0;
        currentY += 2;
      }
    }

    return {
      id: w.id,
      module: w.id.split('_')[0],
      renderer: w.renderer,
      dataSource: w.dataSource,
      layout,
    };
  });

  res.json({
    widgets: resultWidgets,
  });
}
