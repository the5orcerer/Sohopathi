# Education Platform — Frontend Integration

How the UI consumes the permission/role/widget system so it never contains
role-specific branching. The frontend's job is to render whatever the backend
says is available — it holds no opinions about who "should" see what.

---

## 1. Login → session payload

On login, the backend doesn't just return a token — it returns the resolved
shape the frontend needs to render anything:

```json
{
  "token": "...",
  "user": { "id": "...", "name": "..." },
  "activeMembership": {
    "institutionId": "...",
    "roleId": "...",
    "roleName": "Teacher"
  },
  "permissions": [
    "attendance.read", "attendance.create",
    "marks.read", "marks.create",
    "assignments.read", "assignments.create", "assignments.grade"
  ]
}
```

If the user has multiple memberships (teacher at School A, coordinator at
School B — see §4 of the architecture doc), `activeMembership` is whichever
one they're currently switched into; switching institutions re-fetches this
whole payload.

`permissions` is a flat array. The frontend never re-derives it, never asks
"is this a teacher" — it only ever asks "does `permissions` include X."

---

## 2. Dashboard payload

A second call (or the same one) returns what to actually render:

```json
{
  "widgets": [
    {
      "id": "attendance_summary",
      "renderer": "AttendanceSummary",
      "dataSource": "/api/attendance/summary",
      "layout": { "x": 0, "y": 0, "width": 4, "height": 2 }
    },
    {
      "id": "assignment_list",
      "renderer": "AssignmentList",
      "dataSource": "/api/assignments",
      "layout": { "x": 4, "y": 0, "width": 4, "height": 2 }
    }
  ]
}
```

This is already filtered server-side (§4 of the module contract) — every
widget in this array is one the user is allowed to see, in their saved
layout. The frontend does no filtering of its own.

---

## 3. The widget renderer registry

The `renderer` string maps to a component via a single lookup table — this
is the **only** place a widget's ID connects to actual UI code:

```typescript
const WIDGET_REGISTRY: Record<string, React.ComponentType<WidgetProps>> = {
  AttendanceSummary,
  AssignmentList,
  PendingAssignments,
  AssignmentStatistics,
  FleetOverview,
  MyRoute,
  // every widget any module ships gets one entry here
};

function DashboardGrid({ widgets }: { widgets: DashboardWidget[] }) {
  return (
    <Grid>
      {widgets.map(w => {
        const Component = WIDGET_REGISTRY[w.renderer];
        if (!Component) return null; // renderer not shipped in this build yet — fail closed, not crash
        return (
          <GridCell key={w.id} layout={w.layout}>
            <Component dataSource={w.dataSource} />
          </GridCell>
        );
      })}
    </Grid>
  );
}
```

Adding Transport's widgets to the frontend means adding two lines to this
map and shipping the two components — nothing about the dashboard grid,
layout engine, or any other widget changes.

Each widget component fetches its own data from `dataSource` — it doesn't
need to know about scope (`assigned_sections`, `self`, etc.); the backend
route already enforces that. The frontend's job stops at "am I allowed to
see this widget at all," which the dashboard payload already answered.

---

## 4. Navigation

Nav items follow the exact same pattern as widgets rather than a separate
mechanism — each nav entry declares a `requiredPermission`, resolved against
the same `permissions` array from login:

```typescript
const NAV_ITEMS = [
  { label: "Attendance",   path: "/attendance",   requiredPermission: "attendance.read" },
  { label: "Assignments",  path: "/assignments",  requiredPermission: "assignments.read" },
  { label: "Transport",    path: "/transport",    requiredPermission: "transport.read" },
  { label: "Finance",      path: "/finance",      requiredPermission: "finance.read" },
];

const visibleNav = NAV_ITEMS.filter(item =>
  session.permissions.includes(item.requiredPermission)
);
```

Modules should ship their nav entry as part of their manifest too, the same
way they ship widgets — a `navItem` field alongside `widgets[]] in the
manifest, resolved into this same array — so a module is entirely self-
describing: register it, and it shows up in both the dashboard and the nav
with zero frontend-specific wiring beyond the renderer/route registration.

---

## 5. Route guards

Client-side route protection reads from the same `permissions` array — it is
never a second source of truth, just a convenience layer (the backend route
middleware is the actual enforcement; the frontend guard only prevents
flashing a page the API would reject anyway):

```typescript
function ProtectedRoute({ requiredPermission, children }) {
  const { permissions } = useSession();
  if (!permissions.includes(requiredPermission)) {
    return <Navigate to="/unauthorized" />;
  }
  return children;
}

<Route path="/transport" element={
  <ProtectedRoute requiredPermission="transport.read">
    <TransportPage />
  </ProtectedRoute>
} />
```

If someone's role loses a permission mid-session, the frontend guard is
stale until the next session refresh — that's fine, because the actual API
calls that page makes are still enforced server-side regardless.

---

## 6. Where session/permission state lives

One global store (React Context, Zustand, Redux — whatever you're already
using), populated once at login and re-fetched only on:

- login
- switching active institution/membership
- an explicit "refresh my permissions" trigger (e.g. after an admin changes
  your role, they can push a signal that forces your next request to
  re-resolve)

Nothing in the app should call an API to ask "can I do X" per-render — the
permission set is loaded once and checked in memory. Data access is still
always re-validated server-side per request; the frontend check is purely
about what to render, never a security boundary itself.

---

## 7. Putting it together: a teacher's session, end to end

```
Login
  → { permissions: [attendance.read, attendance.create, marks.read,
                     marks.create, assignments.read, assignments.create,
                     assignments.grade] }

Nav renders: Attendance, Marks, Assignments
  (Transport and Finance items are filtered out — teacher has neither permission)

Dashboard payload: [AttendanceSummary, AssignmentList, AssignmentStatistics]
  → WIDGET_REGISTRY resolves each renderer key to its component
  → each component fetches its own dataSource

Teacher clicks "Assignments" in nav
  → ProtectedRoute checks assignments.read — passes
  → AssignmentsPage fetches GET /api/assignments
  → backend route middleware re-checks assignments.read + scope=assigned_sections
  → returns only assignments for sections this teacher actually teaches
```

At no point does any frontend code contain the string `"teacher"`.
