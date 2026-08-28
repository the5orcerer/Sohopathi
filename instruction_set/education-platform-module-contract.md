# Education Platform — Module Contract Specification

This document defines the interface every feature module (Attendance, Marks,
Assignments, Finance, Library, Transport, Hostel, Messaging, ...) must
implement to register itself with the platform core. It complements
`education-platform-erd.mermaid`, which defines the canonical schema these
modules read and write.

The core principle: **a module ships a manifest, and the platform derives
everything else** — routes get auth middleware, widgets get permission
filtering, events get wired up — without the module author hand-rolling any
of it.

**Two different kinds of "adding a module" — don't conflate them:**

| | Requires code? | Requires a deploy? | Who does it |
|---|---|---|---|
| Building a module that doesn't exist yet (e.g. Transport, first time) | Yes | Yes, once | Engineering |
| Turning an existing module on for an institution, wiring it to roles | No | No | Institution admin, via settings |
| Adding a genuinely new capability to an existing module (e.g. live GPS tracking added to Transport later) | Yes, but isolated to that module's folder | Yes, but doesn't touch other modules | Engineering |

Everything below assumes the module has already been built. The whole point
of the manifest is that *step two* — an institution deciding who gets to see
what — never requires engineering involvement.

---

## 1. Module manifest shape

```typescript
interface ModuleManifest {
  id: string;                 // "assignments" — stable, unique, lowercase
  name: string;                // "Assignments"
  version: string;             // semver
  dependsOn: string[];         // other module ids this one requires, e.g. ["identity", "academic"]

  permissions: PermissionDefinition[];
  entities: EntityDefinition[];
  routes: RouteDefinition[];
  events: {
    publishes: string[];
    subscribes: string[];
  };
  widgets: WidgetDefinition[];
  storage?: StoragePathTemplate[];
}

interface PermissionDefinition {
  key: string;                 // "assignments.create" — module-prefixed, dot-namespaced
  description: string;
  scopeOptions: Scope[];       // which scopes this permission can be granted at
}

type Scope = "institution" | "assigned_sections" | "self";

interface EntityDefinition {
  table: string;                // physical table name
  tenantScoped: boolean;         // true => table carries institution_id and is subject to RLS
  migrationPath: string;         // path to the module's own migration files
}

interface RouteDefinition {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;                  // mounted under /api/{module.id}/...
  requiredPermission: string;    // must match a key in this module's permissions[]
  scopeCheck?: Scope;            // defaults to the permission's narrowest scopeOption if omitted
}

interface WidgetDefinition {
  id: string;
  requiredPermissions: string[]; // widget is offered only if user holds ALL of these
  defaultSize: { width: number; height: number };
  dataSource: string;            // API route (or named query) the widget reads from
  renderer: string;              // frontend component key
}

interface StoragePathTemplate {
  bucket: string;                  // "primary" — a logical name, not a provider (see §8)
  pattern: string;                 // e.g. "institutions/{institution_id}/assignments/{assignment_id}/{file}"
}
```

A manifest is the **entire surface area** a module exposes to the platform.
Nothing about auth, dashboard eligibility, or tenant isolation is written by
the module itself — it's declared, and the core enforces it.

---

## 2. Registration lifecycle

1. Module ships its manifest plus migrations, route handlers, and widget
   frontend components.
2. The module registry loads the manifest at boot (or via an admin
   registration flow for hot-added modules).
3. **Permissions**: each `PermissionDefinition` is upserted into the global
   `permission` table, keyed by `key`. Idempotent — re-registering a module
   never duplicates permissions.
4. **Widgets**: each `WidgetDefinition` is upserted into the global `widget`
   table, linked to the module.
5. **Routes**: mounted under `/api/{module.id}/...`. The route middleware
   reads `requiredPermission` (and `scopeCheck`) straight from the manifest
   and enforces it — the module's own handler code never checks permissions
   itself.
6. **Events**: the event bus auto-subscribes this module's handlers to
   everything in `subscribes`, and validates that everything the module
   emits is declared in `publishes` (undeclared events are rejected in
   development, logged in production).
7. **Dashboard availability**: nothing extra happens here — because widgets
   are already in the global `widget` table with their `requiredPermissions`,
   the dashboard engine picks them up automatically the next time it computes
   a user's available widgets (see §4).
8. **Institution enablement**: a module being *registered* platform-wide
   doesn't mean every institution sees it. An `institution_module` join row
   (`institution_id`, `module_id`, `enabled`) gates that — Institution B never
   touching Transport doesn't cost Institution A anything, and vice versa.

---

## 3. Enforcement points (why modules can't skip auth)

| Concern | Where it's enforced | Module author's responsibility |
|---|---|---|
| "Can this user call this route?" | Route middleware, derived from `RouteDefinition.requiredPermission` | None — declare it in the manifest |
| "Is this row inside the caller's institution?" | Postgres RLS policy templated from `EntityDefinition.tenantScoped` | None — mark the table `tenantScoped: true` |
| "Should this widget appear on this user's dashboard?" | Dashboard engine, joining `widget.required_permissions` against the resolved permission set | None — declare it in `widgets[]` |
| "Is this event allowed to be published?" | Event bus, validated against `events.publishes` | Emit only declared event types |

This is what makes the six architectural principles enforceable rather than
aspirational: a module *cannot* expose a route without a permission check,
because the platform — not the module — is what wires the check in.

---

## 4. Dashboard resolution algorithm (for reference)

```
resolvedPermissions = union(
  role_permission rows for the user's role in this institution
)

availableWidgets = SELECT * FROM widget
                    WHERE required_permissions ⊆ resolvedPermissions
                      AND module_id IN (institution's enabled modules)

layout = COALESCE(
  user's saved DASHBOARD_LAYOUT rows,
  role-level default layout,
  institution-level default layout,
  platform default layout
)

dashboard = layout ∩ availableWidgets   -- a saved widget the user no longer
                                          -- has permission for is dropped,
                                          -- not errored on
```

---

## 5. Worked example: the Assignments module

This is the module from §11 of the architecture doc, expressed as a concrete
manifest.

```json
{
  "id": "assignments",
  "name": "Assignments",
  "version": "1.0.0",
  "dependsOn": ["identity", "academic"],
  "permissions": [
    { "key": "assignments.read",   "scopeOptions": ["institution", "assigned_sections", "self"], "description": "View assignments" },
    { "key": "assignments.create", "scopeOptions": ["assigned_sections"], "description": "Create assignments for a section" },
    { "key": "assignments.update", "scopeOptions": ["assigned_sections", "self"], "description": "Edit an assignment" },
    { "key": "assignments.delete", "scopeOptions": ["assigned_sections"], "description": "Delete an assignment" },
    { "key": "assignments.submit", "scopeOptions": ["self"], "description": "Submit work for an assignment" },
    { "key": "assignments.grade",  "scopeOptions": ["assigned_sections"], "description": "Grade a submission" }
  ],
  "entities": [
    { "table": "assignment",             "tenantScoped": true, "migrationPath": "modules/assignments/migrations" },
    { "table": "assignment_attachment",  "tenantScoped": true, "migrationPath": "modules/assignments/migrations" },
    { "table": "assignment_submission",  "tenantScoped": true, "migrationPath": "modules/assignments/migrations" },
    { "table": "assignment_grade",       "tenantScoped": true, "migrationPath": "modules/assignments/migrations" }
  ],
  "routes": [
    { "method": "GET",  "path": "/api/assignments",             "requiredPermission": "assignments.read" },
    { "method": "POST", "path": "/api/assignments",              "requiredPermission": "assignments.create" },
    { "method": "PATCH","path": "/api/assignments/:id",           "requiredPermission": "assignments.update" },
    { "method": "DELETE","path": "/api/assignments/:id",          "requiredPermission": "assignments.delete" },
    { "method": "POST", "path": "/api/assignments/:id/submit",    "requiredPermission": "assignments.submit" },
    { "method": "POST", "path": "/api/assignments/:id/grade",     "requiredPermission": "assignments.grade" }
  ],
  "events": {
    "publishes": ["assignment.created", "assignment.submitted", "assignment.graded"],
    "subscribes": []
  },
  "widgets": [
    { "id": "assignment_list",       "requiredPermissions": ["assignments.read"],   "defaultSize": {"width": 4, "height": 2}, "dataSource": "/api/assignments", "renderer": "AssignmentList" },
    { "id": "pending_assignments",   "requiredPermissions": ["assignments.submit"], "defaultSize": {"width": 4, "height": 2}, "dataSource": "/api/assignments?status=pending", "renderer": "PendingAssignments" },
    { "id": "assignment_statistics", "requiredPermissions": ["assignments.grade"],  "defaultSize": {"width": 6, "height": 3}, "dataSource": "/api/assignments/stats", "renderer": "AssignmentStatistics" }
  ],
  "storage": [
    { "bucket": "primary", "pattern": "institutions/{institution_id}/assignments/{assignment_id}/{file}" }
  ]
}
```

Once this manifest is registered:

- A **teacher** membership holding `assignments.create` + `assignments.grade`
  (scope `assigned_sections`) automatically sees `AssignmentList` and
  `AssignmentStatistics` on their dashboard.
- A **student** membership holding `assignments.read` + `assignments.submit`
  (scope `self`) automatically sees `AssignmentList` and
  `PendingAssignments`.
- Neither dashboard required a single hardcoded `if role === "teacher"`
  branch anywhere in the frontend or backend.

---

## 6. Worked example: the Transport module

A second module, deliberately unrelated to academics, to show the pattern
generalizes — vehicles, routes, drivers, live location.

```json
{
  "id": "transport",
  "name": "Transport",
  "version": "1.0.0",
  "dependsOn": ["identity", "academic"],
  "permissions": [
    { "key": "transport.read",           "scopeOptions": ["institution", "assigned_routes", "self"], "description": "View routes and vehicle info" },
    { "key": "transport.manage",         "scopeOptions": ["institution"], "description": "Create/edit routes, vehicles, stops" },
    { "key": "transport.assign_driver",  "scopeOptions": ["institution"], "description": "Assign a driver to a vehicle/route" },
    { "key": "transport.track",          "scopeOptions": ["assigned_routes", "self"], "description": "View live vehicle location" }
  ],
  "entities": [
    { "table": "vehicle",                     "tenantScoped": true, "migrationPath": "modules/transport/migrations" },
    { "table": "route",                       "tenantScoped": true, "migrationPath": "modules/transport/migrations" },
    { "table": "stop",                        "tenantScoped": true, "migrationPath": "modules/transport/migrations" },
    { "table": "route_stop",                  "tenantScoped": true, "migrationPath": "modules/transport/migrations" },
    { "table": "driver",                      "tenantScoped": true, "migrationPath": "modules/transport/migrations" },
    { "table": "student_transport_assignment","tenantScoped": true, "migrationPath": "modules/transport/migrations" }
  ],
  "routes": [
    { "method": "GET",  "path": "/api/transport/routes",              "requiredPermission": "transport.read" },
    { "method": "POST", "path": "/api/transport/routes",               "requiredPermission": "transport.manage" },
    { "method": "POST", "path": "/api/transport/routes/:id/driver",    "requiredPermission": "transport.assign_driver" },
    { "method": "GET",  "path": "/api/transport/my-route",             "requiredPermission": "transport.read", "scopeCheck": "self" },
    { "method": "POST", "path": "/api/transport/vehicles/:id/location","requiredPermission": "transport.track" }
  ],
  "events": {
    "publishes": ["transport.route_created", "transport.vehicle_location_updated"],
    "subscribes": ["enrollment.created"]
  },
  "widgets": [
    { "id": "fleet_overview", "requiredPermissions": ["transport.manage"], "defaultSize": {"width": 6, "height": 3}, "dataSource": "/api/transport/routes", "renderer": "FleetOverview" },
    { "id": "my_route",       "requiredPermissions": ["transport.read"],   "defaultSize": {"width": 4, "height": 2}, "dataSource": "/api/transport/my-route", "renderer": "MyRoute" }
  ],
  "storage": [
    { "bucket": "primary", "pattern": "institutions/{institution_id}/transport/vehicles/{vehicle_id}/{file}" }
  ]
}
```

Note it **subscribes** to `enrollment.created` — when a student's enrollment
event fires (from the Academic module), Transport can react (e.g. prompt the
office to assign a bus stop) without Academic knowing Transport exists. That
one-way dependency is what keeps modules from becoming a tangle: Transport
knows about Academic's events, Academic never imports anything from
Transport.

**What an institution that doesn't run buses does:** nothing. The module is
registered platform-wide but never enabled for them (`institution_module.enabled
= false`), so it costs them nothing and appears nowhere in their UI.

---

## 7. Scoping permissions beyond auto-derived assignments

`scope: assigned_sections` for a teacher is derivable from `class_subject_teacher`
— they're scoped to whatever they actually teach. But your Assistant Teacher
example (an admin hand-picking which sections someone can *monitor*, not
teach) isn't derived from anything — it needs its own source of truth:

```sql
CREATE TABLE membership_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES membership(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('section','class','campus')),
  scope_id UUID NOT NULL
);
```

Permission resolution for any `scope = assigned_sections` (or `assigned_routes`,
etc.) checks, in order: does a domain table already answer "what is this
membership assigned to" (`class_subject_teacher` for teaching, `driver` for
transport) — if not, fall back to `membership_scope`. This keeps the common
case (a teacher's own sections) automatic, while still letting an admin grant
ad-hoc scope for roles that don't map to an existing assignment table.

---

## 8. Storage abstraction

Every module declares storage paths against a **logical** bucket name
(`"primary"`), never a provider. The manifest doesn't know or care whether
that resolves to R2, S3, Supabase Storage, or MinIO — that's resolved once,
centrally, by a `StorageAdapter`:

```typescript
interface StorageAdapter {
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getSignedUploadUrl(key: string, ttl: number): Promise<string>;
  getSignedDownloadUrl(key: string, ttl: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
```

Full rationale, the upload flow, and the provider-migration story are in
`education-platform-portability.md` — this manifest field is the only place
a module needs to think about storage at all.

---

## 9. Platform-core DDL (the tables no module owns)

These are the tables the module contract itself depends on — they ship with
the core, not with any module, and every module's `EntityDefinition.tenantScoped`
tables get their `institution_id` FK validated against `institution.id`.

```sql
-- Global identity
CREATE TABLE "user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT,
  password_hash TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE module (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,           -- "assignments"
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

-- Which institutions have which modules turned on (§2.8)
CREATE TABLE institution_module (
  institution_id UUID NOT NULL REFERENCES institution(id),
  module_id UUID NOT NULL REFERENCES module(id),
  enabled BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (institution_id, module_id)
);

-- Global permission catalog (populated by module registration, not by hand)
CREATE TABLE permission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,           -- "assignments.create"
  module_id UUID NOT NULL REFERENCES module(id),
  description TEXT,
  scope_options TEXT[] NOT NULL
);

CREATE TABLE widget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  module_id UUID NOT NULL REFERENCES module(id),
  required_permissions TEXT[] NOT NULL,
  default_size JSONB NOT NULL,
  data_source TEXT NOT NULL,
  renderer TEXT NOT NULL,
  UNIQUE (module_id, key)
);

-- Tenancy
CREATE TABLE institution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  branding JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institution(id),  -- NULL = platform-default role
  name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE role_permission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES role(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permission(id),
  scope TEXT NOT NULL,                -- must be one of permission.scope_options
  UNIQUE (role_id, permission_id)
);

CREATE TABLE membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id),
  institution_id UUID NOT NULL REFERENCES institution(id),
  role_id UUID NOT NULL REFERENCES role(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, institution_id)
);

-- Ad-hoc scope grants that aren't derivable from a domain table (§7)
CREATE TABLE membership_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES membership(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('section','class','campus')),
  scope_id UUID NOT NULL
);

-- Dashboard layout, layered platform -> institution -> role -> user
CREATE TABLE dashboard_layout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('platform','institution','role','user')),
  scope_id UUID,                      -- NULL only when scope_type = 'platform'
  widget_id UUID NOT NULL REFERENCES widget(id),
  x INT NOT NULL, y INT NOT NULL, width INT NOT NULL, height INT NOT NULL
);

-- Event log / outbox, tenant-scoped
CREATE TABLE event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institution(id),
  type TEXT NOT NULL,                 -- "assignment.submitted"
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institution(id),
  actor_membership_id UUID REFERENCES membership(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row-Level Security, applied to every tenantScoped table
ALTER TABLE membership ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON membership
  USING (institution_id = current_setting('app.current_institution_id')::UUID);
-- The same policy shape is applied to every table a module marks tenantScoped: true.
```

A module's own tables (`assignment`, `attendance`, `mark`, `vehicle`, ...) live
in that module's migrations, not here — this file only contains the tables the
*contract itself* needs to exist before any module can register.

---

## 10. Checklist for adding a new module

- [ ] Manifest declares every permission the module needs, with correct `scopeOptions`
- [ ] Every table the module owns is marked `tenantScoped` unless it's genuinely global
- [ ] Every route lists a `requiredPermission` that exists in this module's own `permissions[]`
- [ ] Every widget's `requiredPermissions` is the minimal set — over-restrictive widgets just won't render, but over-permissive ones leak UI
- [ ] Every emitted event type appears in `events.publishes`
- [ ] Storage paths use the logical `"primary"` bucket name, never a provider name, and are always scoped by `{institution_id}` first
- [ ] `dependsOn` lists every other module this one calls into directly
- [ ] If a scope this module uses isn't derivable from one of its own tables, it falls back to `membership_scope` rather than inventing a parallel mechanism

If a module satisfies this checklist, an institution can enable it and wire
it to roles without a single change to platform-core code — which is the
whole point.
