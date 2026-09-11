# Biddyapith Platform — Setup and Usage Guide

This guide provides comprehensive instructions for installing, configuring, running, and developing the **Biddyapith** educational platform in a local environment with complete production parity.

---

## 1. Architecture Overview

Biddyapith is an institutional management and academic SaaS platform built with:
- **Backend API**: Node.js & Express with TypeScript, modular plug-in architecture, Row-Level Security (RLS), and cryptographic JWT authentication.
- **Frontend Portal**: React 18, TypeScript, Tailwind CSS, Vite with instant Hot Module Replacement (HMR).
- **Home Landing Page**: React 18, TypeScript, Vite with instant HMR.
- **Local Database**: PostgreSQL 16 on port `5433:5432` (`biddyapith_dev`).
- **Local Object Storage**: MinIO S3 on port `9000` (S3 API) & `9001` (Web Console), bucket `biddyapith-local`.
- **Domain Router**: Reverse-proxies HTTP traffic by domain name in development and serves static bundles in production.

```mermaid
graph TD
    Client["Browser / Client"] --> Router["Express Gateway (Port 3000)"]
    Router -->|"www.biddyapith.local / /"| HomeApp["Home Landing Page (Vite :5174)"]
    Router -->|"app.biddyapith.local / /app"| PortalApp["Frontend Portal (Vite :5173)"]
    Router -->|"api.biddyapith.local / /api"| CoreAPI["Backend API Modules (:3000)"]
    Router -->|"api.biddyapith.local/docs / /docs"| SwaggerUI["Swagger OpenAPI UI"]
    CoreAPI --> LocalPG["Local PostgreSQL 16 (:5433)"]
    CoreAPI --> LocalS3["Local MinIO S3 (:9000)"]
```

---

## 2. Prerequisites

Ensure the following tools are installed on your host machine:
- **Docker Engine / Docker Desktop** (running on Linux, macOS, or Windows)
- **Node.js** v18 or higher (v20+ recommended)
- **npm** v9 or higher

---

## 3. 1-Click Automated Installation

The installer sets up the entire platform automatically:
1. Validates Docker Engine and cleans up old or conflicting containers (such as legacy `edu_postgres`, `biddyapith_postgres`, and `biddyapith_s3`).
2. Configures `.env` for local development while safely backing up any existing cloud production credentials to `.env.production`.
3. Installs dependencies across the root project, frontend portal, and home landing page.
4. Boots local PostgreSQL on port `5433` and MinIO S3 on ports `9000` & `9001`.
5. Applies canonical database schema (`db/schema.sql`) and rich seed data (`db/seed.sql`).

### Running the Installer

#### On Linux / macOS:
```bash
./setup.sh
# or:
npm run setup
```

#### On Windows (Command Prompt or PowerShell):
```cmd
setup.bat
:: or:
npm run setup
```

#### Clean Reset (Pristine Database Re-seed):
```bash
npm run setup:fresh
```

---

## 4. Local Vanity Domains Setup (`/etc/hosts`)

To enable local vanity domain routing (`*.biddyapith.local`), map the local domains in your system hosts file:

```text
127.0.0.1 www.biddyapith.local app.biddyapith.local api.biddyapith.local biddyapith.local
```

### Automated Setup Helper:
- **Linux / macOS**:
  ```bash
  sudo npm run setup:hosts
  ```
- **Windows**:
  Run Command Prompt as **Administrator**:
  ```cmd
  echo 127.0.0.1 www.biddyapith.local app.biddyapith.local api.biddyapith.local biddyapith.local >> %SystemRoot%\System32\drivers\etc\hosts
  ```

---

## 5. Starting the Development Suite (Live HMR)

You **never** need to run `npm run build` or `npm run preview` to preview UI changes!

Start all services concurrently with live Hot Module Replacement:
```bash
npm run dev
```

### What this starts:
1. **Backend Server**: Running with `tsx watch` on port `3000` (auto-reloads on file edits).
2. **Frontend Portal**: Running with Vite on port `5173` (instant HMR).
3. **Home Landing Page**: Running with Vite on port `5174` (instant HMR).
4. **Reverse Proxy**: Express on port `3000` reverse-proxies requests directly to the Vite dev servers.

---

## 6. URLs & Access Endpoints

| Service / App | Vanity Domain URL | Fallback `localhost` URL | Purpose |
| :--- | :--- | :--- | :--- |
| **Home Landing Page** | `http://www.biddyapith.local:3000` | `http://localhost:3000` | Public landing, branding, and admissions info |
| **Application Portal** | `http://app.biddyapith.local:3000` | `http://localhost:3000/app` | School management portal (Admin/Teacher/Student) |
| **Backend API & Swagger** | `http://api.biddyapith.local:3000/docs` | `http://localhost:3000/docs` | Interactive Swagger UI API documentation |
| **MinIO S3 Console** | — | `http://localhost:9001` | Local S3 Web Bucket Explorer |

---

## 7. Login Credentials & Accounts

### A. Swagger UI API Documentation
- **URL**: `http://localhost:3000/docs` (or `http://api.biddyapith.local:3000/docs`)
- **Username**: `admin`
- **Password**: `biddyapith_docs_secret_2024`

### B. MinIO Local Object Storage
- **URL**: `http://localhost:9001`
- **Access Key**: `minioadmin`
- **Secret Key**: `minioadmin`
- **Default Storage Bucket**: `biddyapith-local`

### C. Pre-Seeded Institutional Demo Accounts
All accounts belong to the demo institution **Dhaka Model International Academy** (`dhakamodel`):

| Role | Login Identifier | Password | Subdomain / Institution Code |
| :--- | :--- | :--- | :--- |
| **Institution Admin** | `admin@biddyapith.tech`<br/>*(or username: `admin`)* | `password123` | `dhakamodel` |
| **Teacher** | `teacher@biddyapith.tech`<br/>*(or username: `teacher`)* | `password123` | `dhakamodel` |
| **Student** | `student@biddyapith.tech`<br/>*(or username: `student`)* | `password123` | `dhakamodel` |

> [!NOTE]
> All authentication uses **standard RFC 7519 HMAC-SHA256 cryptographic JWTs** and real database password hashes (`profile.password_hash`). There are no mock token strings; authentication behaves identically between development and production.

---

## 8. Database & Container Controls

| Action | Command | Description |
| :--- | :--- | :--- |
| **Start Local DB & S3** | `npm run db:up` | Boots PostgreSQL (`5433`) and MinIO (`9000/9001`) |
| **Stop Local DB & S3** | `npm run db:down` | Stops local containers |
| **Idempotent DB Sync** | `npm run db:init` | Applies `db/schema.sql` and `db/seed.sql` without data loss |
| **Pristine DB Reset** | `npm run db:fresh` | Drops schemas and rebuilds database from schema and seed |

---

## 9. Development vs. Production Configuration

### Local Development (`NODE_ENV=development` in `.env`)
- Connects to local PostgreSQL at `postgresql://postgres:postgres@localhost:5433/biddyapith_dev`.
- Connects to local MinIO at `http://127.0.0.1:9000`.
- Express proxies HTTP requests directly to Vite servers on ports 5173/5174 for instant HMR.
- Cloud calls are disabled.

### Production Mode (`NODE_ENV=production` in `.env`)
- Local development proxies are bypassed.
- Express serves compiled production static bundles from `home/dist` and `frontend/dist`.
- Hits production cloud services (Aiven PostgreSQL, Cloudflare R2, Supabase Auth).
- Cloud production credentials are safely preserved in `.env.production`.

---

## 10. Automated Tests & Production Build

### Running Test Suite:
Tests run strictly against the local database on port `5433` and never touch production:
```bash
npm test
```
*Expected: 12 test files passed, 46 tests passed (0 failures).*

### Compiling Production Bundles:
```bash
npm run build
```
*Builds the backend TypeScript compiler (`dist/server.js`), the home landing page (`home/dist/`), and the frontend portal (`frontend/dist/`).*

