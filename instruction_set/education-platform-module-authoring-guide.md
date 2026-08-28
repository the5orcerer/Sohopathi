# Education Platform — Module Authoring Guide

Step-by-step guide to writing a new module and wiring it in, using a full
worked example: **Notices** — simpler than Assignments or Transport, so the
pattern is easy to see without extra noise. By the end, an institution admin
can enable Notices, wire it to roles, and it appears in nav + dashboard —
with zero further code.

---

## 0. Folder structure for a module

```
src/modules/notices/
  manifest.ts        -- the ModuleManifest object
  migration.sql       -- this module's own tables
  repository.ts        -- DB access
  routes.ts             -- route handlers
  service.ts             -- business logic (thin here; grows with complexity)
```

Frontend:

```
frontend/src/modules/notices/
  NoticeBoard.tsx      -- the widget component
  NoticesPage.tsx       -- the full nav page (list/create/publish)
```

---

## 1. Write the migration

```sql
-- src/modules/notices/migration.sql
-- (this module's table already exists in the canonical schema for
-- illustration — a genuinely new module would introduce new tables here)

create table if not exists public.notice_read_receipt (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  notice_id uuid not null references public.notice(id) on delete cascade,
  membership_id uuid not null references public.membership(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (notice_id, membership_id)
);

alter table public.notice_read_receipt enable row level security;
create policy tenant_isolation on public.notice_read_receipt
  using (institution_id = public.current_institution_id());

create index idx_notice_read_receipt_institution_id
  on public.notice_read_receipt (institution_id);
```

Run this once against your Supabase project (SQL editor, or your own
migration runner — see portability doc §2). This is the *only* step that
touches the database directly; everything else below is application code.

---

## 2. Write the repository

```typescript
// src/modules/notices/repository.ts
import { PoolClient } from 'pg';

export interface Notice {
  id: string;
  title: string;
  body: string;
  audienceScope: string;
  publishedAt: string;
}

export const noticeRepository = {
  async list(client: PoolClient): Promise<Notice[]> {
    const { rows } = await client.query(
      `select id, title, body, audience_scope as "audienceScope", published_at as "publishedAt"
       from notice order by published_at desc limit 50`
    );
    return rows;
  },

  async create(
    client: PoolClient,
    institutionId: string,
    publishedByMembershipId: string,
    data: { title: string; body: string; audienceScope: string }
  ): Promise<Notice> {
    const { rows } = await client.query(
      `insert into notice (institution_id, title, body, audience_scope, published_by_membership_id)
       values ($1, $2, $3, $4, $5)
       returning id, title, body, audience_scope as "audienceScope", published_at as "publishedAt"`,
      [institutionId, data.title, data.body, data.audienceScope, publishedByMembershipId]
    );
    return rows[0];
  },

  async markRead(client: PoolClient, institutionId: string, noticeId: string, membershipId: string) {
    await client.query(
      `insert into notice_read_receipt (institution_id, notice_id, membership_id)
       values ($1, $2, $3) on conflict do nothing`,
      [institutionId, noticeId, membershipId]
    );
  },
};
```

Notice this file never checks permissions and never knows what a "teacher"
or "admin" is — that's the middleware's job, not the repository's. The
repository only ever runs *after* permission + scope have already passed.

---

## 3. Write the route handlers

```typescript
// src/modules/notices/routes.ts
import { Request, Response } from 'express';
import { noticeRepository } from './repository';

export async function listNotices(req: Request, res: Response, client: import('pg').PoolClient) {
  const notices = await noticeRepository.list(client);
  res.json(notices);
}

export async function createNotice(req: Request, res: Response, client: import('pg').PoolClient) {
  const { title, body, audienceScope } = req.body;
  const notice = await noticeRepository.create(
    client,
    req.ctx!.institutionId,
    req.ctx!.membershipId,
    { title, body, audienceScope: audienceScope ?? 'institution' }
  );
  res.status(201).json(notice);
}

export async function markNoticeRead(req: Request, res: Response, client: import('pg').PoolClient) {
  await noticeRepository.markRead(client, req.ctx!.institutionId, req.params.id, req.ctx!.membershipId);
  res.status(204).send();
}
```

---

## 4. Write the manifest

This is the file that ties everything above into the platform.

```typescript
// src/modules/notices/manifest.ts
import { ModuleManifest } from '../../core/registry/types';
import { listNotices, createNotice, markNoticeRead } from './routes';

export const noticesManifest: ModuleManifest = {
  id: 'notices',
  name: 'Notices',
  version: '1.0.0',
  dependsOn: ['identity'],

  permissions: [
    { key: 'notices.read', description: 'View notices', scopeOptions: ['institution'] },
    { key: 'notices.write', description: 'Publish notices', scopeOptions: ['institution'] },
  ],

  routes: [
    { method: 'GET', path: '', requiredPermission: 'notices.read', handler: listNotices },
    { method: 'POST', path: '', requiredPermission: 'notices.write', handler: createNotice },
    { method: 'POST', path: '/:id/read', requiredPermission: 'notices.read', handler: markNoticeRead },
  ],

  widgets: [
    {
      id: 'notice_board',
      requiredPermissions: ['notices.read'],
      defaultSize: { width: 4, height: 3 },
      dataSource: '/api/notices',
      renderer: 'NoticeBoard',
    },
  ],

  events: {
    publishes: ['notice.published'],
    subscribes: [],
  },
};
```

---

## 5. Register it — the one line that wires backend

```typescript
// app.ts
import { noticesManifest } from './modules/notices/manifest';

await registerModule(noticesManifest, router);
```

That's the entire backend integration. On the next boot:

- `notices.read` and `notices.write` exist in the global `permission` table
- `notice_board` exists in the global `widget` table
- `GET /api/notices`, `POST /api/notices`, `POST /api/notices/:id/read` are
  live, each already wrapped in auth + permission + scope + tenant-context
  middleware, because `registerModule` generated that chain from the
  manifest (see backend-core doc §5, §7)

No other file in the codebase was touched.

---

## 6. Enable it for an institution

Pure data — either a one-time script or an admin UI action:

```sql
insert into institution_module (institution_id, module_id, enabled)
select '<institution-uuid>', id, true from module where key = 'notices';
```

Then wire it into roles — again pure data, normally done through an admin
settings UI, not SQL:

```sql
insert into role_permission (institution_id, role_id, permission_id, scope)
select '<institution-uuid>', '<role-uuid>', id, 'institution'
from permission where key = 'notices.read';
```

Every membership under that role now resolves `notices.read` the next time
they load their dashboard.

---

## 7. Frontend: the widget component

```tsx
// frontend/src/modules/notices/NoticeBoard.tsx
import { useEffect, useState } from 'react';
import { apiClient } from '../../core/api-client';

interface Notice {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

export function NoticeBoard({ dataSource }: { dataSource: string }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    apiClient.get<Notice[]>(dataSource).then(setNotices);
  }, [dataSource]);

  return (
    <div className="notice-board">
      {notices.map((n) => (
        <div key={n.id} className="notice-item">
          <strong>{n.title}</strong>
          <p>{n.body}</p>
        </div>
      ))}
    </div>
  );
}
```

The component takes `dataSource` as a prop — it doesn't hardcode the API
path, because that path comes from the widget row the backend already
resolved (frontend-integration doc §3). This is what lets the same
`NoticeBoard` component work identically regardless of which institution or
role is viewing it.

## 8. Frontend: register the component

```typescript
// frontend/src/core/widget-registry.ts
import { NoticeBoard } from '../modules/notices/NoticeBoard';
// ...other imports

export const WIDGET_REGISTRY = {
  // ...existing entries
  NoticeBoard,
};
```

One line added. The dashboard grid (frontend-integration doc §3) picks it up
automatically the next time a user with `notices.read` loads their
dashboard — no route, no page-level wiring needed just for the widget to
render.

## 9. Frontend: register the nav item (if this module also needs a full page)

```typescript
// frontend/src/core/nav-items.ts
export const NAV_ITEMS = [
  // ...existing entries
  { label: 'Notices', path: '/notices', requiredPermission: 'notices.read' },
];
```

```tsx
// frontend/src/app-routes.tsx
<Route path="/notices" element={
  <ProtectedRoute requiredPermission="notices.read">
    <NoticesPage />
  </ProtectedRoute>
} />
```

`NoticesPage` is ordinary application code — a list view, a create form
gated on `notices.write` client-side (with the real enforcement still
happening server-side on `POST /api/notices`). Nothing special about it
compared to any other CRUD page in the app.

---

## 10. Checklist — what you touch vs. what you never touch

**Files you create/edit for a new module:**
- `modules/<name>/migration.sql`
- `modules/<name>/repository.ts`
- `modules/<name>/routes.ts`
- `modules/<name>/manifest.ts`
- one `registerModule(...)` line in `app.ts`
- frontend: the widget component(s) + one line in `WIDGET_REGISTRY`
- frontend: nav item + route, if the module has a full page

**Files you never touch:**
- `core/registry/module-registry.ts`
- `core/permissions/middleware.ts`
- `core/auth/*`, `core/storage/*`
- any other module's files
- the dashboard grid / nav filtering logic
- the platform-core DDL (`institution`, `membership`, `role`, `permission`,
  `widget`, ... — see schema doc §0–4)

If a change to add a feature requires touching something in the second list,
that's the signal the feature isn't actually module-shaped yet — go back to
the manifest and figure out what's missing from it, rather than reaching
into core.
