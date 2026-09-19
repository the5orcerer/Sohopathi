import { Router, Request, Response, NextFunction } from 'express';
import { PoolClient } from 'pg';
import { pool, withTenantContext } from '../db';
import { authenticate, loadContext, requirePermission, withDb } from '../permissions/middleware';
import { validateRequest } from '../validation/middleware';
import { ModuleManifest } from './types';
import { logger } from '../logger';

export const registeredManifests: ModuleManifest[] = [];

/**
 * Synchronizes module manifest definitions (module, permissions, widgets) with PostgreSQL.
 * Used during database migrations, initialization, and seeding.
 */
export async function syncModuleCatalog(manifest: ModuleManifest, client: PoolClient): Promise<void> {
  // 1. Upsert module
  const {
    rows: [moduleRow],
  } = await client.query(
    `insert into module (key, name, version) values ($1, $2, $3)
     on conflict (key) do update set version = excluded.version, name = excluded.name
     returning id`,
    [manifest.id, manifest.name, manifest.version]
  );

  // 2. Upsert permissions
  for (const p of manifest.permissions) {
    await client.query(
      `insert into permission (key, module_id, description, scope_options)
       values ($1, $2, $3, $4)
       on conflict (key) do update set description = excluded.description,
                                        scope_options = excluded.scope_options`,
      [p.key, moduleRow.id, p.description, p.scopeOptions]
    );
  }

  // 3. Upsert widgets
  for (const w of manifest.widgets || []) {
    const widgetKey = w.id || (w as any).key;
    if (!widgetKey) continue;
    await client.query(
      `insert into widget (key, module_id, required_permissions, default_size, data_source, renderer)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (module_id, key) do update
         set required_permissions = excluded.required_permissions,
             default_size = excluded.default_size,
             data_source = excluded.data_source,
             renderer = excluded.renderer`,
      [
        widgetKey,
        moduleRow.id,
        w.requiredPermissions || [],
        JSON.stringify(w.defaultSize || { width: 2, height: 2 }),
        w.dataSource || '',
        w.renderer || '',
      ]
    );
  }
}

export async function syncAllRegisteredModules(client: PoolClient): Promise<void> {
  for (const manifest of registeredManifests) {
    await syncModuleCatalog(manifest, client);
  }
}

/**
 * Registers module routes into the Express router in-memory without blocking database queries.
 * Ensures instant cold starts (<5ms) for serverless environments.
 */
export function registerModule(manifest: ModuleManifest, router: Router): void {
  // Mount routes
  for (const route of manifest.routes) {
    const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    let fullPath: string;

    if (route.path.startsWith('/api/')) {
      fullPath = route.path;
    } else {
      const basePath = `/api/${manifest.id}`;
      fullPath = route.path ? (route.path.startsWith('/') ? `${basePath}${route.path}` : `${basePath}/${route.path}`) : basePath;
    }

    const middlewareStack: any[] = [];

    if (!route.skipAuth) {
      middlewareStack.push(authenticate);
    }

    if (!route.skipContext) {
      middlewareStack.push(loadContext);
    }

    if (route.validation) {
      middlewareStack.push(validateRequest(route.validation));
    }

    if (route.requiredPermission) {
      middlewareStack.push(requirePermission(route.requiredPermission, route.scopeCheck));
    }

    if (route.skipContext) {
      middlewareStack.push(async (req: Request, res: Response, next: NextFunction) => {
        try {
          await withTenantContext(null, (client) => route.handler(req, res, client));
        } catch (err) {
          next(err);
        }
      });
    } else {
      middlewareStack.push(withDb(route.handler));
    }

    router[method](fullPath, ...middlewareStack);
  }

  if (!registeredManifests.some((m) => m.id === manifest.id)) {
    registeredManifests.push(manifest);
  }
  logger.info(
    `[module-registry] mounted "${manifest.id}" v${manifest.version} — ${manifest.routes.length} routes, ${manifest.widgets.length} widgets`
  );
}

