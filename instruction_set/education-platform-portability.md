# Education Platform — Portability & Migration Strategy

Supabase is the right call at your current scale: managed Postgres, auth,
storage, and RLS in one box, no ops burden. The risk isn't using it — it's
letting its SDKs leak into application code so deeply that leaving it later
means a rewrite instead of a swap. This document is the discipline that keeps
that door open.

The rule underneath everything below: **nothing above the adapter layer
should know which provider is underneath it.**

---

## 1. Layered architecture

```
Route handler
     │
     ├──► Service (business logic)
     │        │
     │        ├──► Repository (DB access)  ──► Postgres (via any connection string)
     │        ├──► AuthProvider              ──► Supabase Auth today, anything tomorrow
     │        └──► StorageAdapter            ──► R2 today, S3/MinIO/anything tomorrow
     │
     └──► Route middleware (permission + scope check, derived from module manifest)
```

Nothing below a Repository, AuthProvider, or StorageAdapter interface is
allowed to be imported directly by a route handler or service. That single
discipline is what makes every migration below a config change instead of an
engineering project.

---

## 2. Repository layer (database access)

**Don't do this** — a Supabase client call scattered through business logic:

```typescript
// route handler
const { data } = await supabase.from('student').select('*').eq('institution_id', instId);
```

**Do this instead** — a repository interface, one implementation per backend:

```typescript
interface StudentRepository {
  findById(id: string): Promise<Student | null>;
  findByInstitution(institutionId: string): Promise<Student[]>;
  create(data: NewStudent): Promise<Student>;
  update(id: string, data: Partial<Student>): Promise<Student>;
}

// Implementation today: plain pg / Drizzle / Prisma against Supabase's
// connection string. Supabase IS Postgres — this implementation has nothing
// Supabase-specific in it at all.
class PgStudentRepository implements StudentRepository {
  constructor(private db: DbClient) {}
  async findById(id: string) {
    return this.db.query('SELECT * FROM student WHERE id = $1', [id]);
  }
  // ...
}
```

Because the implementation is plain SQL over a connection string, moving from
Supabase's managed Postgres to a self-hosted instance on a VPS is **a
connection-string change**, not a rewrite. This is true as long as you avoid
Supabase-only Postgres extensions you don't actually need.

**Migrations**: keep them as plain `.sql` files (or Drizzle/Prisma migration
files) in your own repo, run via your own migration runner against whatever
`DATABASE_URL` you point at. Don't drive schema changes through the Supabase
dashboard — that history lives in Supabase's UI, not in your codebase, and
doesn't travel with you.

**RLS**: keep using it. Row-Level Security is plain Postgres, not a Supabase
feature — it works identically on a VPS, on RDS, anywhere Postgres runs. It's
one of the few things here you don't need to abstract at all.

---

## 3. Auth abstraction

This is the highest-lock-in surface if you call `supabase.auth.*` directly
from route handlers.

```typescript
interface AuthProvider {
  verifySession(token: string): Promise<{ userId: string } | null>;
  createSession(userId: string): Promise<{ token: string; expiresAt: Date }>;
  invalidateSession(token: string): Promise<void>;
}

class SupabaseAuthProvider implements AuthProvider {
  // wraps supabase.auth.* — this is the ONLY file in the codebase
  // that imports the Supabase auth client
}
```

Every route handler depends on `AuthProvider`, never on `supabase.auth`
directly. Migrating to Auth0, a self-hosted solution, or your own JWT issuer
later means writing `SelfHostedAuthProvider`, not touching every route.

---

## 4. Storage abstraction (R2 today, anything S3-compatible tomorrow)

R2, S3, Supabase Storage, and MinIO all speak the same S3-compatible API.
Write against the generic client, never a provider SDK:

```typescript
interface StorageAdapter {
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getSignedUploadUrl(key: string, ttl: number): Promise<string>;
  getSignedDownloadUrl(key: string, ttl: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

// Implementation: @aws-sdk/client-s3, pointed at R2's endpoint.
// Swapping to real S3, or a self-hosted MinIO, later means changing
// the endpoint + credentials passed into this one class — nothing else.
class S3CompatibleStorageAdapter implements StorageAdapter {
  constructor(private client: S3Client, private bucket: string) {}
  // ...
}
```

### Key structure ("automatic sorting")

Object storage has no real folders, but consistent key prefixes behave like
them for listing purposes:

```
institutions/{institution_id}/{module}/{entity_id}/{filename}
```

- List everything for institution 12 → prefix `institutions/12/`
- List one module's files → prefix `institutions/12/assignments/`
- List one entity's files → prefix `institutions/12/assignments/{assignment_id}/`

Keys are always generated **server-side** from the module manifest's
`storage[].pattern` (see the module contract, §8) — never accepted from the
client. That's what keeps the layout deterministic and keeps one institution
from ever being able to construct a key that lands inside another's prefix.

### Upload flow (keeps file bytes out of your backend entirely)

```
1. Client asks backend: "I want to upload a file for assignment X"
2. Backend checks permission + scope (route middleware, from the manifest)
3. Backend decides the exact key: institutions/12/assignments/X/{file}
4. Backend calls StorageAdapter.getSignedUploadUrl(key, ttl) and returns it
5. Client uploads directly to the bucket using that URL
6. Client notifies backend "upload done"
7. Backend writes the metadata row (assignment_attachment: key, filename,
   size, content_type, uploaded_by) — Postgres stays the source of truth for
   what exists and who can see it; the bucket only ever stores bytes.
```

This flow is identical regardless of which S3-compatible provider sits
behind `StorageAdapter` — migrating buckets never touches this sequence.

---

## 5. Supabase-specific traps to avoid

| Trap | Why it locks you in | What to do instead |
|---|---|---|
| Calling `supabase.from(...)` in route handlers/services | Every call site needs rewriting to migrate | Repository layer (§2) |
| Calling `supabase.auth.*` in route handlers | Same | AuthProvider (§3) |
| Using the `@supabase/storage-js` SDK directly | Same | S3-compatible `StorageAdapter` against R2/Supabase Storage's S3 endpoint (§4) |
| Supabase Edge Functions as your only backend runtime | Runtime-specific, not portable | Keep business logic in a normal Node/Bun/Deno backend you can run anywhere; Edge Functions only for genuinely edge-specific work if at all |
| Supabase Realtime subscriptions wired straight into frontend components | Frontend becomes provider-aware | Put realtime behind your own event/notification layer (already planned per the architecture doc's Events → Notifications flow) |
| Driving schema changes from the Supabase dashboard | Schema history lives outside your repo | Plain migration files, run via your own tooling (§2) |

Row-Level Security and the underlying Postgres engine are **not** traps —
they're standard Postgres and travel with you for free.

---

## 6. What migrating actually looks like later

If the discipline above is followed, "move from Supabase to a VPS" is:

1. Stand up Postgres on the VPS, run your existing migration files against it.
2. Point `DATABASE_URL` at the new instance.
3. Write `SelfHostedAuthProvider` (or point at whatever auth service you
   chose), swap it in via dependency injection.
4. Point `S3CompatibleStorageAdapter` at the new bucket's endpoint/credentials
   (R2, MinIO, S3 — same client, different config).
5. Deploy.

No route handler, service, or business-logic file changes, because none of
them ever knew Supabase existed in the first place.
