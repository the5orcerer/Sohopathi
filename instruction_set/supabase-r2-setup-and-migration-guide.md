# Supabase & Cloudflare R2 Setup and Migration Guide

This guide provides a comprehensive, step-by-step walkthrough for configuring **Supabase** (managed PostgreSQL & Auth) and **Cloudflare R2** (S3-compatible object storage), and connecting them to your Node.js backend server.

---

## 1. Why Local First, Cloud When Ready?

The application is architected with strict portability abstractions:
- **Database**: Standard SQL with PostgreSQL Row-Level Security (RLS) driven by session variable `app.current_institution_id`.
- **Authentication**: Abstracted behind an `AuthProvider` interface (`verifyToken`, `createUser`, etc.).
- **Storage**: Abstracted behind an S3-compatible `StorageAdapter` interface (`putObject`, `getSignedUploadUrl`, `getSignedDownloadUrl`).

Because of this separation, developing and testing all features on localhost gives you rapid iterations with zero cloud costs or accidental production state pollution. When you are ready to transition to cloud infrastructure, **not a single line of business logic changes** — only your `.env` configuration is updated.

---

## 2. Supabase Setup Walkthrough

### 2.1. Create a Supabase Project
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project** and choose your Organization.
3. Fill in the project details:
   - **Name**: `Sohopathi-Prod` (or your preferred name)
   - **Database Password**: Generate a strong password and save it securely in a password manager.
   - **Region**: Choose the region closest to your target users (e.g., `Southeast Asia (Singapore)` or `Central EU`).
   - **Pricing Plan**: Free tier is sufficient for testing and soft launch.
4. Click **Create new project** and wait 1–2 minutes for provisioning.

### 2.2. Obtain Database Connection Strings
1. In the Supabase project dashboard, go to **Project Settings** (gear icon) → **Database**.
2. Scroll to the **Connection strings** section.
3. Select the **URI** tab.
4. You will see two connection modes:
   - **Direct connection** (Port `5432`): Best for long-running servers and migrations.
   - **Connection pooler (Supavisor)** (Port `6543`, Mode: `Transaction`): Recommended for production workloads and serverless deployments.
5. Copy the connection string and replace `[YOUR-PASSWORD]` with your database password:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

### 2.3. Configure Supabase Authentication
1. Go to **Authentication** → **Providers** in the sidebar.
2. Ensure **Email** is enabled.
3. (Optional for Development / Staging): Under **Authentication** → **Email Templates**, you can disable email confirmation if you want invited accounts to be active immediately upon creation:
   - Go to **Authentication** → **URL Configuration**.
   - Under **Site URL**, set `http://localhost:5173` (or your production frontend URL).
   - Under **Redirect URLs**, add `http://localhost:5173/**` and `https://your-domain.com/**`.

### 2.4. Obtain API Keys
1. Go to **Project Settings** → **API**.
2. Under **Project API keys**, locate:
   - **Project URL**: `https://[PROJECT-REF].supabase.co`
   - **anon (public)** key: Used on clients / public endpoints.
   - **service_role (secret)** key: Used **only** by your backend server for platform admin operations and bypassing RLS during tenant provisioning.
   > ⚠️ **Security Warning**: Never expose `service_role` in frontend code, client bundles, or public git repositories.

### 2.5. Run Schema Migrations
1. Go to the **SQL Editor** in the Supabase Dashboard.
2. Click **New query**.
3. Paste your consolidated database schema SQL script (creating `institution`, `profile`, `role`, `permission`, `membership`, academic tables, RLS policies, etc.).
4. Click **Run** to execute the script and create all tables, indexes, and RLS policies.
5. Next, run the catalog seed script to populate modules, permissions, and default role templates.

---

## 3. Cloudflare R2 Object Storage Setup Walkthrough

Cloudflare R2 provides zero-egress-fee S3-compatible object storage for files, attachments, student documents, and notices.

### 3.1. Enable R2 & Create a Bucket
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the sidebar, select **R2 Object Storage**.
3. Click **Create bucket**.
4. Set a bucket name (e.g., `sohopathi-media` or `sohopathi-uploads`).
5. Choose **Automatic** or a specific geographic location (e.g., `APAC` or `WNAM`).
6. Click **Create Bucket**.

### 3.2. Generate S3 API Credentials
1. Go to **R2 Object Storage** → **Manage R2 API Tokens** (on the right side of the overview page).
2. Click **Create API Token**.
3. Configure the token:
   - **Token Name**: `Sohopathi-Backend-Token`
   - **Permissions**: `Object Read & Write`
   - **Bucket Scope**: Select **Apply to specific buckets only** and pick your newly created bucket (or choose all buckets).
   - **TTL**: Keep unlimited or set according to your security policy.
4. Click **Create API Token**.
5. Copy the following values immediately (they will not be shown again):
   - **Access Key ID**
   - **Secret Access Key**
   - **Jurisdiction-specific Endpoint / S3 API URL**: Format is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

### 3.3. Configure Bucket CORS (Cross-Origin Resource Sharing)
For direct browser uploads using presigned URLs, configure CORS on the bucket:
1. Go to your R2 Bucket → **Settings** tab.
2. Scroll to **CORS Policy** and click **Add CORS Policy** (or edit existing).
3. Paste the following JSON policy:
   ```json
   [
     {
       "AllowedOrigins": [
         "http://localhost:5173",
         "http://localhost:3000",
         "https://app.yourdomain.com"
       ],
       "AllowedMethods": [
         "GET",
         "PUT",
         "POST",
         "HEAD"
       ],
       "AllowedHeaders": [
         "*"
       ],
       "ExposeHeaders": [
         "ETag"
       ],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. Click **Save**.

### 3.4. (Optional) Public Bucket Access & Custom Domain
If you want avatars and public notice attachments to be readable via public URLs without presigning every request:
1. Under bucket **Settings** → **Public Access**, enable **R2.dev subdomain** (for development/testing) or connect a **Custom Domain** (e.g., `cdn.yourdomain.com`).
2. Save the public base URL for your environment configuration.

---

## 4. Connecting Your Node.js Server to Supabase & R2

### 4.1. Environment Configuration (`.env`)

Update your local backend `.env` file with the cloud credentials:

```env
# Server Port
PORT=3000
NODE_ENV=production

# Supabase PostgreSQL Connection
# Note: Use transaction pooler (port 6543) for application traffic
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require

# Supabase Auth & Admin API
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...[YOUR_SERVICE_ROLE_KEY]

# Cloudflare R2 Storage (S3-Compatible)
STORAGE_ENDPOINT=https://[CLOUDFLARE_ACCOUNT_ID].r2.cloudflarestorage.com
STORAGE_ACCESS_KEY_ID=[R2_ACCESS_KEY_ID]
STORAGE_SECRET_ACCESS_KEY=[R2_SECRET_ACCESS_KEY]
STORAGE_BUCKET=sohopathi-media
STORAGE_PUBLIC_URL=https://pub-[HASH].r2.dev
```

---

## 5. Verification & Testing Procedure

To verify your connection to cloud services:

### 5.1. Verify Database & RLS
Run a quick connectivity check:
```bash
node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT current_database(), now();')
  .then(res => { console.log('✅ Connected to Supabase DB:', res.rows[0]); pool.end(); })
  .catch(err => { console.error('❌ DB Connection Error:', err); pool.end(); });
"
```

### 5.2. Verify R2 Storage Adapter
Test bucket operations using `@aws-sdk/client-s3`:
```bash
node -e "
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY
  }
});
s3.send(new ListObjectsV2Command({ Bucket: process.env.STORAGE_BUCKET }))
  .then(res => console.log('✅ Connected to Cloudflare R2. Object count:', res.KeyCount))
  .catch(err => console.error('❌ R2 Connection Error:', err));
"
```

---

## 6. Common Pitfalls & Troubleshooting

1. **Transaction Pooler & `SET LOCAL`**:
   - `SET LOCAL app.current_institution_id = '...'` requires being inside a `BEGIN ... COMMIT` transaction.
   - When using Supabase's transaction pooler (port `6543`), the connection is returned to the pool after the transaction commits, ensuring session variables do not leak between different tenant requests.
2. **PostgreSQL SSL Errors**:
   - If you see `self-signed certificate in certificate chain` or `SSL connection required`, ensure your `pg.Pool` configuration includes:
     ```typescript
     ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
     ```
3. **R2 Signature Mismatches**:
   - Ensure the `region` in your `S3Client` configuration is set to `'auto'`.
4. **CORS Errors on Direct Browser Uploads**:
   - If frontend direct PUT requests fail with CORS errors, verify that `AllowedOrigins` in the Cloudflare R2 bucket CORS settings includes your exact frontend origin (including port).

