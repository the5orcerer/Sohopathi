# Education Platform — UI/UX Design Brief

**Feed this alongside**: `education-platform-frontend-integration.md` (the
API contract this UI is built against — session/dashboard/nav payload
shapes), `education-platform-module-contract.md` (widget/permission model),
and `education-platform-server-build-brief.md` (what the backend actually
exposes). This document defines what to build; those define what's
available to build it with.

**Design philosophy, stated plainly**: this is software an overworked
teacher opens between classes and an admin runs a school on. Every design
decision is judged by one question — does this make their day easier or
harder. Calm over flashy. Information dense where density helps (gradebook,
attendance), spacious where a decision is being made (settings, role
editing). Nothing decorative that doesn't also orient the user. No feature
exists to look impressive; every feature exists because someone running a
school actually needs it.

---

## 1. Design tokens

Avoid the generic AI-tool look (warm cream + terracotta, or near-black +
neon accent). This palette is a deliberate choice for this subject: a calm,
trustworthy teal (classroom-chalkboard-adjacent without being literal) with
a warm amber accent (warmth, attention, without reading as an alert color).

### Color — light mode

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#F3F5F4` | page background — cool neutral, not warm cream |
| `--surface` | `#FFFFFF` | cards, panels, table rows |
| `--border` | `#E1E5E3` | hairline dividers |
| `--text-primary` | `#1B2523` | body text |
| `--text-secondary` | `#5B6764` | supporting text, labels |
| `--text-muted` | `#8B968F` | placeholders, timestamps, hints |
| `--primary` | `#1E5F5B` | nav active state, primary buttons, links |
| `--primary-fg` | `#FFFFFF` | text/icons on primary fill |
| `--accent` | `#E3A008` | highlights, badges needing attention, warm CTAs |
| `--accent-fg` | `#3D2A00` | text on accent fill |
| `--success` | `#2F9E63` / bg `#E1F5EE` | present, submitted, paid, approved |
| `--warning` | `#E3A008` / bg `#FBEED9` | pending, due soon |
| `--danger` | `#D64545` / bg `#FBEAEA` | absent, overdue, destructive actions |
| `--info` | `#3B82C4` / bg `#E9F3FA` | neutral informational states |

### Color — dark mode

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#10171A` | page background — blue-green near-black, not pure black |
| `--surface` | `#182124` | cards, panels |
| `--border` | `#2A3437` | hairline dividers |
| `--text-primary` | `#EDEFF0` | body text |
| `--text-secondary` | `#A7B0AE` | supporting text |
| `--text-muted` | `#6E7A77` | placeholders, hints |
| `--primary` | `#4FBDB3` | brightened for dark contrast |
| `--primary-fg` | `#08201E` | text on primary fill |
| `--accent` | `#E3B15C` | slightly desaturated for dark backgrounds |
| `--accent-fg` | `#2E2005` | text on accent fill |
| `--success` | `#4CC98A` / bg `#173430` | |
| `--warning` | `#E3B15C` / bg `#332707` | |
| `--danger` | `#F07171` / bg `#3A1414` | |
| `--info` | `#5EA5DD` / bg `#122A3A` | |

Implement as CSS custom properties on `:root`, flipped via
`[data-theme="dark"]` and respecting `prefers-color-scheme` as the default
before any explicit user choice. Persist the user's explicit choice (not
just system preference) in their profile or local storage. Toggle lives in
the top bar, always reachable, never buried in settings.

**Every color decision must work in both modes** — never hardcode a hex
directly in a component; always reference the token.

### Typography

- **UI face (headings + body)**: Inter — chosen for legibility at small
  sizes and excellent tabular-figure support, both essential for
  gradebook/attendance/finance screens where numbers must align.
- **Monospace (IDs, codes, amounts in tables)**: JetBrains Mono, used
  sparingly — admission numbers, invoice IDs, roll numbers — anywhere
  visual alignment of characters matters.
- **Scale**: 12px (caption/meta) · 13px (secondary/table body) · 14px
  (body/UI default) · 16px (card headers) · 20px (page titles) · 26px
  (dashboard greeting only). Two weights: 400 regular, 500 medium. Never
  heavier — this is utility software, not a marketing page.
- Numbers in tables and stat cards always use `font-variant-numeric:
  tabular-nums`.

### Layout primitives

- **Radius**: 8px for controls/inputs, 12px for cards, 999px for
  pills/chips/badges/avatars.
- **Spacing scale**: 4 / 8 / 12 / 16 / 24 / 32px. Cards use 16px internal
  padding, page gutters 24px (16px on mobile).
- **Borders, not shadows**: 1px hairlines (`--border`) for separation.
  Reserve shadow only for genuinely floating elements — modals, dropdowns,
  toasts — never for resting cards. Flat design reads calmer at the
  information density this product needs.
- **Icon set**: a single consistent outline icon set throughout (Tabler
  Icons or Lucide — pick one, never mix). 16–20px inline, 24px max
  decorative.

### The signature element: scope chips

Every widget, nav item, and permission grant in this system carries a
**scope** (`institution`, `assigned_sections`, `self`) — that's not just a
backend concept, it should be visible everywhere in the UI as a small
pill, consistently styled:

```
[ Institution-wide ]   — neutral gray pill
[ Assigned sections ]  — teal-tinted pill (var(--primary) at low opacity)
[ Self ]                — amber-tinted pill
```

These appear on dashboard widget cards, in the role/permission editor,
and in list-view headers ("Showing: your assigned sections"). This is
deliberate: it's the one place the UI makes the permission system's logic
visible and trustworthy, rather than hiding it as invisible plumbing. A
teacher should never wonder "why can't I see that student" — the chip
already told them what they're scoped to.

---

## 2. App shell & layout

```
+-----------------------------------------------------------------+
| [Institution v]   [ Search everything...  ^K ]   Bell  Theme  MR|  <- top bar, 56px
+-----------+-------------------------------------------------------+
|           |                                                       |
| Dashboard |              main content area                        |
| Students  |        (widget grid / list view / detail)             |
| Attendance|                                                       |
| Marks     |                                                       |
| Assign.   |                                                       |
| Notices   |                                                       |
| Transport |                                                       |
| Settings  |                                                       |
|           |                                                       |
+-----------+-------------------------------------------------------+
   sidebar,
   200px, collapsible
```

- **Top bar**: institution switcher (only shown if the user has >1
  membership), global search / command palette trigger, notification bell,
  theme toggle, avatar menu (profile, switch institution, log out).
- **Sidebar**: nav items rendered from the `/api/nav` response — never
  hardcoded. Collapses to icon-only on narrower viewports; fully hidden
  behind a hamburger below 768px. Active item styled with `--primary` fill,
  matching the mockup shown above.
- **Main content**: dashboard (widget grid) on `/`, otherwise a list view
  or detail view per route. Consistent max-width with generous gutters on
  large screens — don't stretch tables edge-to-edge on a 27" monitor.

### Responsive behavior

- **Desktop-first for admin screens** (role editor, module marketplace,
  finance) — these involve wide tables and multi-column forms, genuinely
  awkward on a phone, and admins mostly use this at a desk.
- **Mobile-first for the two screens teachers actually use in a
  classroom**: quick attendance and the daily dashboard. A teacher marking
  attendance is standing in front of a class with a phone, not sitting at a
  desk with a laptop.
- Breakpoints: 768px (sidebar collapses), 1024px (widget grid drops from 3
  columns to 2), 480px (single column, dense tables switch to stacked
  cards).

---

## 3. Permission-driven rendering — implementation pattern

Every screen follows `education-platform-frontend-integration.md` exactly:

- Nav items come from `/api/nav`, filtered server-side — the sidebar
  component maps over the response, it doesn't decide what to show.
- Dashboard widgets come from `/api/dashboard` — map `renderer` key to a
  component via the `WIDGET_REGISTRY` (frontend-integration doc §3). Adding
  a widget to the UI is: build the component, add one line to the registry.
- Route guards check `permissions.includes(...)` — implement as a
  `<ProtectedRoute requiredPermission="...">` wrapper, never a scattered
  `if` per page.
- **No permission check ever lives inside a business logic component.**
  It happens once, at the route/widget boundary. A component that receives
  a `dataSource` prop and renders whatever comes back doesn't need to know
  who's allowed to see it — that was already decided before it mounted.

### Empty and locked states

- A widget the user has permission for but with no data yet: an
  invitation-style empty state — "No assignments yet — Create your first
  assignment" with a CTA, never "Nothing here."
- A whole section with zero available widgets (e.g. a brand-new
  institution with no modules enabled beyond core): a dashboard-level empty
  state pointing to Settings -> Modules, not a blank grid.
- Never show a "you don't have permission" locked/grayed-out nav item —
  if they can't access it, it isn't in the response, so it isn't rendered
  at all. Don't tease inaccessible features.

---

## 4. Cross-cutting features (every list view gets these, consistently)

Build these as one reusable "list view shell" component, not
re-implemented per screen — Students, Assignments, Notices, Transport
routes, Finance invoices all use the same shell with different columns.

### Search bar
- One search input per list view, debounced, searching the visible
  columns' obvious fields (name, ID, title).
- Plus the **global command palette** (Cmd+K / Ctrl+K) — searches across
  students, staff, notices, and navigable pages from anywhere in the app,
  not just the current list. This is the single highest-leverage feature
  for an admin managing hundreds of students — don't skip it.

### Filter bar
- Sits directly under the search bar. Filters are contextual per entity
  (e.g. Students: class, section, status; Assignments: subject, due-date
  range, status).
- Filters combine (AND), shown as removable chips once applied, with a
  visible "Clear all."
- **Saved views**: let a user save a filter combination with a name
  ("My sections", "Overdue invoices") pinned to the sidebar or a quick-
  access dropdown. This is what turns "filter every time I open this page"
  into "click a saved view."

### Import
- CSV/Excel bulk import for anything an admin would otherwise enter
  row-by-row at scale: students, staff, enrollment rosters.
- Flow: **upload -> column-mapping step (map file columns to system
  fields) -> validation preview (shows exactly which rows will succeed/fail
  and why, before committing anything) -> confirm -> results summary with a
  downloadable error report for failed rows.** Never a silent
  all-or-nothing import — a 200-row file with 3 bad rows should import the
  197 good ones and hand back a clear report on the 3, not fail the whole
  batch or silently drop them.

### Export
- Every list view: export the **current filtered view**, not just "export
  everything" — respect whatever search/filter state is active.
- Formats: CSV (data), PDF (for anything meant to be printed or shared
  as a document — report cards, attendance sheets, fee receipts).
- For report-style exports (report cards, transcripts), a preview step
  before download, not a blind file generation.

### Bulk actions
- Row selection (checkbox column) -> a contextual action bar appears above
  the table (not a separate page) — bulk grade, bulk notify guardians,
  bulk export selection, bulk status change, bulk delete.
- Any destructive bulk action gets a confirmation step naming exactly how
  many rows and what will happen — "This will delete 14 students. This
  can't be undone." Never a generic "Are you sure?"

### Notifications
- Bell icon -> dropdown grouped by module (Attendance, Assignments,
  Notices, Finance), each item deep-links to the relevant record, mark
  read individually or all-at-once.
- A dedicated notification preferences screen (which events trigger
  push/email/in-app — ties to the platform's notification architecture)
  under Settings.

### Activity / audit trail
- Admin-only screen: a filterable feed reading from `audit_log` — who
  changed what, when. Essential for schools handling sensitive student
  data; also just genuinely useful for "wait, who edited this fee amount."

### Undo, not confirm-everything
- For reversible-but-annoying-to-redo actions (archiving a student,
  removing a role grant), prefer a toast with an "Undo" action (5–8
  second window) over a blocking confirmation dialog. Reserve hard
  confirmation dialogs for genuinely destructive, hard-to-reverse actions
  (permanent delete, revoking all of someone's access).

### Autosave + save indicators
- Long forms (student profile, institution settings) autosave with a
  small, unobtrusive "Saved" / "Saving..." indicator near the field, not a
  page-level "Save" button people forget to click.
- Gradebook and attendance grids autosave per-cell on blur/toggle — a
  teacher should never lose ten minutes of marking because they didn't
  hit submit.

---

## 5. Screen inventory

| Screen | Who | Key behavior |
|---|---|---|
| Login / institution picker | everyone | if >1 membership, pick which institution to enter |
| Dashboard | everyone | widget grid per §3, drag-to-rearrange (persists to `dashboard_layout`) |
| Students (list + profile) | admin, teacher (scoped) | list shell (§4), profile has tabs: overview, guardians, attendance history, marks history, fees |
| Attendance | teacher, admin | see §6 quick-attendance grid |
| Marks / Gradebook | teacher, admin | see §6 gradebook |
| Assignments | teacher, student | teacher: create/grade; student: view/submit — same route, different capabilities per permission |
| Notices | everyone (read), admin/teacher (write) | board view + create form gated on `notices.write` |
| Transport | admin (manage), student/guardian (read own route) | fleet overview for admin, "my route" card for others |
| Finance | admin, guardian (own only) | invoice list, payment recording, guardian sees only their own |
| Settings -> Roles & permissions | admin | see §7 permission matrix editor |
| Settings -> Modules | admin | see §7 module marketplace |
| Settings -> Members | admin | invite/manage memberships, assign roles |
| Settings -> Institution profile | admin | branding, subdomain, academic year setup |
| Activity log | admin | §4 audit trail |
| Notification preferences | everyone | per-channel toggles per event type |

---

## 6. Teacher-specific features (make the daily grind fast)

### Quick attendance
The single most-used screen for a teacher — design it for speed, not
completeness:

- One screen, one section, full student roster as rows.
- Default state: everyone marked present (the common case), teacher only
  taps exceptions (absent/late/excused).
- Keyboard-navigable: arrow keys move between rows, `P`/`A`/`L`/`E` set
  status without touching the mouse — a teacher who knows the shortcuts
  should be able to mark a class of 30 in under 15 seconds.
- Large touch targets on mobile — this is the screen most likely opened on
  a phone, one-handed, mid-class.
- Autosaves per row; a small "All changes saved" indicator, not a submit
  button.

### Gradebook
- Spreadsheet-style grid: students as rows, assessments as columns.
- Tab/Enter moves to the next cell like a real spreadsheet.
- Paste support: copy a column of numbers from Excel, paste directly into
  a column of grade cells.
- Inline validation (can't exceed max marks) with immediate visual
  feedback, not a rejected-on-submit error.

### "My day" widget
A dashboard card showing, at a glance: today's class schedule, count of
ungraded submissions, unread notices addressed to them, any attendance
not yet taken today. This is the single highest-value custom widget for
the teacher role — it answers "what do I need to do right now" without
navigating anywhere.

### Bulk grading & feedback
- Grade an assignment across all submissions in one flowing view (next
  student on submit, no return-to-list-then-click-next friction).
- Canned feedback snippets a teacher can save and reuse ("Great effort,
  double-check your working in part 3") to avoid retyping common notes.

---

## 7. Admin-specific features (make running the institution legible)

### Permission matrix editor
Replace raw JSON/table editing with a visual grid: roles as rows,
permissions as columns, each cell a scope selector (none / self /
assigned_sections / institution) rather than a checkbox — this maps
directly to `role_permission`. Group permission columns by module with a
collapsible header per module, since the full list will get long as more
modules are enabled. Changing a cell here is exactly the "Day 1 / Day 2"
scenario from the architecture conversation — no code, immediate effect.

### Module marketplace
A settings screen listing every registered module (from
`institution_module`) with: name, one-line description, an on/off toggle,
and — for modules already on — a "configure default roles" shortcut into
the permission matrix filtered to that module. Disabling a module should
show a clear, specific warning about what becomes inaccessible (which
widgets, which nav items), not a generic confirmation.

### Bulk onboarding
New institution setup, and the start of each academic year, both need to
move fast:

- Institution onboarding: guided checklist widget on first login —
  create academic year -> create classes/sections -> bulk-import students
  -> bulk-import staff -> invite admin team -> enable modules. Each step
  checked off as completed, dismissible once done.
- Year-end promotion: a dedicated flow (not a hidden batch script) — pick
  the graduating academic year, review the auto-generated promotion
  mapping (Class 5 -> Class 6, etc., editable per section), confirm. Ties to
  the `promote` endpoint in the server build brief §7 Phase 2.

### Approval queues
Where the permission model has an `.approve`-type permission (e.g.
`marks.approve`), give it a dedicated queue view, not just a filter on the
main list — "12 mark sheets pending your approval" as a dashboard widget
that deep-links straight into the review flow.

---

## 8. Component architecture (maps to the widget/module system)

```
frontend/src/
  core/
    theme/               -- tokens.css (light+dark vars), ThemeToggle.tsx
    api-client.ts
    widget-registry.ts    -- per frontend-integration.md §3
    nav-items.ts
    command-palette/       -- global Cmd+K search
    list-shell/             -- SearchBar, FilterBar, BulkActionBar, ImportModal, ExportMenu
    components/              -- Button, Input, Select, Table, Modal, Toast,
                                 EmptyState, ScopeChip, MetricCard, Skeleton
  modules/
    core/
      StudentsPage.tsx, StudentProfile.tsx, ...
    attendance/
      QuickAttendanceGrid.tsx, AttendanceSummary.tsx (widget)
    marks/
      Gradebook.tsx
    assignments/
      AssignmentList.tsx (widget), PendingAssignments.tsx (widget), AssignmentsPage.tsx
    notices/
      NoticeBoard.tsx (widget), NoticesPage.tsx
    transport/
      FleetOverview.tsx (widget), MyRoute.tsx (widget)
    settings/
      PermissionMatrix.tsx, ModuleMarketplace.tsx, MembersPage.tsx
```

`core/list-shell/` is the component that implements §4 once — every module
page composes it rather than rebuilding search/filter/import/export per
screen. `core/components/ScopeChip.tsx` implements the signature element
from §1 and gets used inside widget cards, the permission matrix, and list
view headers alike.

---

## 9. Accessibility & quality floor

- WCAG AA contrast minimum in both themes — verify every token pairing,
  not just the obvious ones (muted text on tinted backgrounds is the
  usual failure point).
- Visible keyboard focus rings on every interactive element, in both
  themes (don't rely on browser defaults, which often disappear on dark
  backgrounds).
- Full keyboard operability: every action reachable via keyboard,
  especially the quick-attendance and gradebook grids (§6) where speed
  matters most.
- `prefers-reduced-motion` respected — animations become instant state
  changes for users who've set that preference.
- Loading states are skeletons shaped like the content they're replacing
  (a widget skeleton looks like that widget, not a generic spinner) —
  reduces layout shift and feels faster even at identical load time.
- Every icon-only button gets an `aria-label`; every form field gets a
  real `<label>`, not a placeholder standing in for one.

## 10. Motion — used sparingly, functionally

- Widget cards: subtle fade-in on dashboard load, staggered slightly
  (40ms per card) — orchestrated, not scattered per-element animation.
- Toasts slide in from the bottom, autodismiss with a visible countdown
  for undo-able actions.
- No animation on data that updates frequently (attendance counts, live
  tracking) beyond a brief highlight-flash — constant motion in a data-
  dense screen is fatiguing, not delightful.
- Page transitions: none beyond a fast crossfade. This is a tool people
  use for hours a day — motion should never cost time.

## 11. Explicitly avoid

- Decorative illustrations or stock photography anywhere in the product
  chrome — this is a working tool, not a marketing site.
- A generic dashboard-template look (gradient hero banners, oversized
  welcome cards) — the dashboard's job is to surface today's actionable
  information, not to greet anyone with a large hero image.
- Modal overuse — prefer inline expansion or a side panel for anything
  that isn't a genuinely blocking decision (confirmation, quick create).
  A settings change buried three modals deep is a support ticket waiting
  to happen.
- Cute empty-state illustrations that don't help the user act — an empty
  state's job is the CTA, not the mascot.
- Any UI text explaining how the system is built ("this widget requires
  the assignments.grade permission") — speak in terms of what the user can
  do, not the permission key behind it. Save that vocabulary for the
  admin-facing permission matrix, where it's the whole point.