# Education Platform — Backend Core Implementation

Reference implementation of everything the module contract depends on:
AuthProvider, StorageAdapter, permission resolution, the request pipeline
(tenant context → auth → permission → scope → RLS), and the module registry
engine that turns a manifest into a running set of routes/permissions/widgets.

**Stack assumed**: Node.js + TypeScript, Express, `pg` for direct Postgres
access (via Supabase's connection string), `@supabase/supabase-js` only for
auth, `@aws-sdk/client-s3` for storage. Swap Express for Fastify/Hono if you
prefer — the pattern doesn't change.

```
src/
  core/
    db.ts                 -- pg Pool, transaction helper with SET LOCAL
    auth/
      auth-provider.ts     -- interface
      supabase-auth-provider.ts
    storage/
      storage-adapter.ts    -- interface
      s3-storage-adapter.ts
    permissions/
      resolve-permissions.ts
      middleware.ts
    registry/
      module-registry.ts    -- loads manifests, upserts catalog, mounts routes
      types.ts               -- ModuleManifest etc (from module contract doc)
  modules/
    core/            (identity/academic — ships with the platform)
    assignments/
    transport/
  app.ts             -- Express app, wires everything together
```

---

## 1. Database access — connection + tenant context

```typescript
// core/db.ts
import { Pool, PoolClient } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Supabase's Postgres connection string today
  max: 10,
});

/**
 * Runs `fn` inside a transaction with the tenant context set for RLS.
 * institutionId is null for routes that are genuinely cross-tenant
 * (platform admin operations) — those should use a service-role connection
 * instead of this helper, or explicitly opt out with allowNoTenant.
 */
export async function withTenantContext<T>(
  institutionId: string | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (institutionId) {
      // SET LOCAL is transaction-scoped — safe with Supabase's pooler in
      // transaction mode as long as everything happens inside this one tx.
      await client.query(`SET LOCAL app.current_institution_id = '${institutionId}'`);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

> Note: string-interpolating `institutionId` into `SET LOCAL` is safe here
> only because it's always a UUID you generated/validated server-side
> (from the resolved membership, never straight from client input) — `SET`
> doesn't support parameterized queries. Validate it's a UUID before this
> call if there's any doubt.

---

## 2. Repository layer (example: Student)

```typescript
// modules/core/repositories/student-repository.ts
import { PoolClient } from 'pg';

export interface Student {
  id: string;
  institutionId: string;
  admissionNo: string;
  name: string;
  dateOfBirth: string | null;
  status: string;
}

export interface StudentRepository {
  findById(client: PoolClient, id: string): Promise<Student | null>;
  findBySection(client: PoolClient, sectionId: string): Promise<Student[]>;
  create(client: PoolClient, data: Omit<Student, 'id'>): Promise<Student>;
}

export const studentRepository: StudentRepository = {
  async findById(client, id) {
    const { rows } = await client.query(
      `select * from student where id = $1`,
      [id]
    ); // RLS (tenant_isolation) already restricts this to the current institution
    return rows[0] ?? null;
  },

  async findBySection(client, sectionId) {
    const { rows } = await client.query(
      `select s.* from student s
       join enrollment e on e.student_id = s.id
       where e.section_id = $1 and e.status = 'active'`,
      [sectionId]
    );
    return rows;
  },

  async create(client, data) {
    const { rows } = await client.query(
      `insert into student (institution_id, admission_no, name, date_of_birth, status)
       values ($1, $2, $3, $4, $5) returning *`,
      [data.institutionId, data.admissionNo, data.name, data.dateOfBirth, data.status]
    );
    return rows[0];
  },
};
```

Every repository follows this shape: plain SQL, no Supabase SDK, RLS doing
tenant filtering for free once `withTenantContext` has run.

---

## 3. AuthProvider

```typescript
// core/auth/auth-provider.ts
export interface AuthProvider {
  verifyToken(token: string): Promise<{ userId: string } | null>;
}
```

```typescript
// core/auth/supabase-auth-provider.ts
import { createClient } from '@supabase/supabase-js';
import { AuthProvider } from './auth-provider';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role: backend verifies tokens server-side
);

export const supabaseAuthProvider: AuthProvider = {
  async verifyToken(token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id };
  },
};
```

This is the **only file** that imports `@supabase/supabase-js`. Every route
handler depends on `AuthProvider`, never on this file directly — migrating
auth providers later means writing a new file here and swapping the import
in `app.ts`.

---

## 4. Permission resolution

```typescript
// core/permissions/resolve-permissions.ts
import { PoolClient } from 'pg';

export interface ResolvedContext {
  userId: string;
  institutionId: string;
  membershipId: string;
  roleId: string;
  permissions: Map<string, string>; // permission key -> granted scope
}

/**
 * Given a verified userId and the institution they're currently acting in,
 * resolve their membership + role + granted permissions. This runs on a
 * service-role connection (not tenant-scoped yet — we're figuring out
 * WHICH tenant this request is for) or the very first query of the request
 * before SET LOCAL is issued.
 */
export async function resolveContext(
  client: PoolClient,
  userId: string,
  institutionId: string
): Promise<ResolvedContext | null> {
  const { rows } = await client.query(
    `select m.id as membership_id, m.role_id,
            p.key as permission_key, rp.scope
     from membership m
     join role_permission rp on rp.role_id = m.role_id
     join permission p on p.id = rp.permission_id
     join institution_module im
       on im.institution_id = m.institution_id
      and im.module_id = p.module_id
      and im.enabled = true
     where m.user_id = $1 and m.institution_id = $2 and m.status = 'active'`,
    [userId, institutionId]
  );

  if (rows.length === 0) return null;

  const permissions = new Map<string, string>();
  for (const row of rows) permissions.set(row.permission_key, row.scope);

  return {
    userId,
    institutionId,
    membershipId: rows[0].membership_id,
    roleId: rows[0].role_id,
    permissions,
  };
}
```

Note the join through `institution_module` — a permission the module
registered is irrelevant if the institution hasn't enabled that module
(§2.8 / §9 of the module contract). A disabled module effectively grants
nothing, even if a role still lists its permissions.

---

## 5. Request pipeline middleware

```typescript
// core/permissions/middleware.ts
import { Request, Response, NextFunction } from 'express';
import { pool, withTenantContext } from '../db';
import { supabaseAuthProvider } from '../auth/supabase-auth-provider';
import { resolveContext, ResolvedContext } from './resolve-permissions';

declare global {
  namespace Express {
    interface Request {
      ctx?: ResolvedContext;
    }
  }
}

// 1. Authentication
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'missing token' });

  const result = await supabaseAuthProvider.verifyToken(token);
  if (!result) return res.status(401).json({ error: 'invalid token' });

  (req as any).userId = result.userId;
  next();
}

// 2. Resolve institution + role + permissions for this request
export async function loadContext(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId as string;
  const institutionId = req.headers['x-institution-id'] as string; // set by frontend after institution switch
  if (!institutionId) return res.status(400).json({ error: 'missing institution context' });

  const client = await pool.connect();
  try {
    const ctx = await resolveContext(client, userId, institutionId);
    if (!ctx) return res.status(403).json({ error: 'no active membership in this institution' });
    req.ctx = ctx;
    next();
  } finally {
    client.release();
  }
}

// 3. Permission + scope check — this is what a RouteDefinition compiles into
export function requirePermission(permissionKey: string, requiredScope?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const grantedScope = req.ctx?.permissions.get(permissionKey);
    if (!grantedScope) return res.status(403).json({ error: `missing permission: ${permissionKey}` });
    // narrower scopes are subsets: 'self' ⊂ 'assigned_sections' ⊂ 'institution'
    // exact matching here for simplicity; widen with a scope-rank table if needed
    if (requiredScope && grantedScope !== requiredScope && grantedScope !== 'institution') {
      return res.status(403).json({ error: `insufficient scope for ${permissionKey}` });
    }
    (req as any).grantedScope = grantedScope;
    next();
  };
}

// 4. Wrap the actual handler in tenant-scoped DB access (RLS kicks in here)
export function withDb(
  handler: (req: Request, res: Response, client: import('pg').PoolClient) => Promise<void>
) {
  return async (req: Request, res: Response) => {
    await withTenantContext(req.ctx!.institutionId, (client) => handler(req, res, client));
  };
}
```

A route ends up looking like this — every piece above composes:

```typescript
router.get(
  '/api/assignments',
  authenticate,
  loadContext,
  requirePermission('assignments.read'),
  withDb(async (req, res, client) => {
    const { rows } = await client.query('select * from assignment');
    res.json(rows);
  })
);
```

This is exactly what the module registry (§7 below) generates automatically
from a `RouteDefinition` — you never hand-write this composition per route
once the registry exists.

---

## 6. StorageAdapter (R2, S3-compatible)

```typescript
// core/storage/storage-adapter.ts
export interface StorageAdapter {
  getSignedUploadUrl(key: string, contentType: string, ttlSeconds?: number): Promise<string>;
  getSignedDownloadUrl(key: string, ttlSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
```

```typescript
// core/storage/s3-storage-adapter.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageAdapter } from './storage-adapter';

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.STORAGE_ENDPOINT, // R2 endpoint today; any S3-compatible endpoint later
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.STORAGE_BUCKET!;

export const s3StorageAdapter: StorageAdapter = {
  async getSignedUploadUrl(key, contentType, ttlSeconds = 300) {
    const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
    return getSignedUrl(client, cmd, { expiresIn: ttlSeconds });
  },

  async getSignedDownloadUrl(key, ttlSeconds = 300) {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(client, cmd, { expiresIn: ttlSeconds });
  },

  async deleteObject(key) {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  },
};
```

Moving to real AWS S3, MinIO, or anywhere else S3-compatible: change
`STORAGE_ENDPOINT` + credentials. Nothing else in the codebase changes,
because nothing else imports `@aws-sdk/client-s3` directly — only this file.

### Key generation helper (implements the manifest's `storage[].pattern`)

```typescript
// core/storage/build-key.ts
export function buildStorageKey(pattern: string, params: Record<string, string>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, name) => {
    const value = params[name];
    if (!value) throw new Error(`missing storage key param: ${name}`);
    return value;
  });
}

// usage:
// buildStorageKey(
//   "institutions/{institution_id}/assignments/{assignment_id}/{file}",
//   { institution_id: ctx.institutionId, assignment_id: assignmentId, file: fileName }
// )
// => "institutions/f2c1.../assignments/a91b.../report.pdf"
```

Keys are always built server-side from `institution_id` on the resolved
request context — never accepted as a raw path from the client — which is
what keeps one institution unable to construct a key inside another's
prefix.

---

## 7. Module registry engine

This is the piece that makes a manifest self-sufficient — register a module,
and its permissions/widgets/routes exist without further wiring.

```typescript
// core/registry/types.ts
export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  dependsOn: string[];
  permissions: { key: string; description: string; scopeOptions: string[] }[];
  routes: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    requiredPermission: string;
    scopeCheck?: string;
    handler: import('express').RequestHandler;
  }[];
  widgets: {
    id: string;
    requiredPermissions: string[];
    defaultSize: { width: number; height: number };
    dataSource: string;
    renderer: string;
  }[];
  events?: { publishes: string[]; subscribes: string[] };
}
```

```typescript
// core/registry/module-registry.ts
import { Router } from 'express';
import { pool } from '../db';
import { authenticate, loadContext, requirePermission, withDb } from '../permissions/middleware';
import { ModuleManifest } from './types';

export async function registerModule(manifest: ModuleManifest, router: Router) {
  const client = await pool.connect();
  try {
    // 1. Upsert the module row
    const { rows: [moduleRow] } = await client.query(
      `insert into module (key, name, version) values ($1, $2, $3)
       on conflict (key) do update set version = excluded.version
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
    for (const w of manifest.widgets) {
      await client.query(
        `insert into widget (key, module_id, required_permissions, default_size, data_source, renderer)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (module_id, key) do update
           set required_permissions = excluded.required_permissions,
               default_size = excluded.default_size,
               data_source = excluded.data_source,
               renderer = excluded.renderer`,
        [w.id, moduleRow.id, w.requiredPermissions, JSON.stringify(w.defaultSize), w.dataSource, w.renderer]
      );
    }
  } finally {
    client.release();
  }

  // 4. Mount routes — this is where a RouteDefinition becomes the actual
  //    middleware chain from §5, generated rather than hand-written
  for (const route of manifest.routes) {
    const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete';
    router[method](
      `/api/${manifest.id}${route.path}`,
      authenticate,
      loadContext,
      requirePermission(route.requiredPermission, route.scopeCheck),
      withDb(async (req, res, client) => route.handler(req, res, undefined as any))
      // (simplified here — in practice pass `client` through to the handler
      // via req, since Express handlers don't take a third positional arg)
    );
  }

  console.log(`[module-registry] registered "${manifest.id}" v${manifest.version} — ${manifest.routes.length} routes, ${manifest.widgets.length} widgets`);
}
```

```typescript
// app.ts
import express from 'express';
import { Router } from 'express';
import { registerModule } from './core/registry/module-registry';
import { assignmentsManifest } from './modules/assignments/manifest';
import { transportManifest } from './modules/transport/manifest';

async function main() {
  const app = express();
  app.use(express.json());
  const router = Router();

  await registerModule(assignmentsManifest, router);
  await registerModule(transportManifest, router);
  // adding a new module later is exactly one line here — see the module
  // authoring guide for the full worked example

  app.use(router);
  app.listen(process.env.PORT ?? 3000);
}

main();
```

This is the concrete version of the registration lifecycle from the module
contract (§2): steps 3–5 (permissions, widgets, routes) all happen inside
`registerModule`, driven entirely by the manifest object.
