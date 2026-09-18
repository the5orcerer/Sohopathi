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

export async function getNav(req: Request, res: Response, client?: PoolClient) {
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

  // Load institution feature settings if client & institutionId available
  let settings: Record<string, any> = {};
  if (client && req.ctx?.institutionId) {
    try {
      const { rows } = await client.query(
        `select settings from institution_setting where institution_id = $1`,
        [req.ctx.institutionId]
      );
      if (rows.length > 0 && rows[0].settings) {
        settings = rows[0].settings;
      }
    } catch {}
  }

  const featureLimitations = settings.featureLimitations || {};
  const userRole = (req.ctx?.roleName || '').trim();

  // Helper to check if a feature is allowed
  const isFeatureAllowed = (featureKey: string, legacyToggleKey?: string): boolean => {
    // Check master legacy toggle if present
    if (legacyToggleKey && settings[legacyToggleKey] === false) {
      return false;
    }
    const limitConfig = featureLimitations[featureKey];
    if (limitConfig) {
      if (limitConfig.enabled === false) return false;
      if (Array.isArray(limitConfig.allowedRoles) && limitConfig.allowedRoles.length > 0) {
        return limitConfig.allowedRoles.some(
          (r: string) => r.toLowerCase() === userRole.toLowerCase()
        );
      }
    }
    return true;
  };

  // Filter navigation items by user's resolved permissions and feature limitation
  const authorizedNavItems = allNavItems.filter((item) => {
    if (!item.requiredPermission) return true;
    if (!req.ctx?.permissions.has(item.requiredPermission)) return false;

    // Feature Limitation checks
    if (item.path === '/examinations' && !isFeatureAllowed('examinations', 'enableExaminations')) return false;
    if (item.path === '/assignments' && !isFeatureAllowed('assignments', 'enableAssignments')) return false;
    if (item.path === '/billing' && !isFeatureAllowed('finance', 'enableFinance')) return false;
    if (item.path === '/transport' && !isFeatureAllowed('transport', 'enableTransport')) return false;
    if (item.path === '/timetable' && !isFeatureAllowed('timetable', 'enableTimetable')) return false;
    if (item.path === '/admissions' && !isFeatureAllowed('admissions')) return false;
    if (item.path === '/notices' && !isFeatureAllowed('notices')) return false;
    if (item.path === '/tasks' && !isFeatureAllowed('tasks')) return false;
    if (item.path === '/attendance' && !isFeatureAllowed('attendance')) return false;

    // Student Directory should NOT be visible to student/guardian or self-only scope
    if (item.path === '/students') {
      const scope = req.ctx.permissions.get(item.requiredPermission);
      const roleName = req.ctx.roleName?.toLowerCase() || '';
      if (scope === 'self' || roleName.includes('guardian') || roleName.includes('student')) {
        return false;
      }
    }
    return true;
  });

  // Sort nav items by sortOrder
  authorizedNavItems.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

  // Deduplicate items by path (in case multiple manifests register the same path)
  const seenPaths = new Set<string>();
  const deduplicatedNavItems: NavItemDefinition[] = [];
  for (const item of authorizedNavItems) {
    if (!seenPaths.has(item.path)) {
      seenPaths.add(item.path);
      deduplicatedNavItems.push(item);
    }
  }

  res.json(deduplicatedNavItems);
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
