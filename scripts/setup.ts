import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Pool } from 'pg';

import { isDockerAvailable, getComposeCommand, startContainers, cleanContainers } from './db-control';

const isWindows = process.platform === 'win32';
const isFresh = process.argv.includes('--fresh') || process.argv.includes('--clean') || process.argv.includes('-f');
const rootDir = path.resolve(__dirname, '..');

function logStep(step: number, title: string) {
  console.log(`\n======================================================`);
  console.log(`[Step ${step}] ${title}`);
  console.log(`======================================================`);
}

function runCmd(cmd: string, cwd: string = rootDir, allowFail: boolean = false): string {
  try {
    return execSync(cmd, { cwd, stdio: 'inherit' })?.toString() || '';
  } catch (err: any) {
    if (!allowFail) {
      console.error(`❌ Failed to execute: ${cmd}`);
      throw err;
    }
    return '';
  }
}

function setupEnv() {
  const envPath = path.join(rootDir, '.env');
  const envExamplePath = path.join(rootDir, '.env.example');

  const defaultDevEnv = `# ============================================================================
# BIDDYAPITH LOCAL DEVELOPMENT ENVIRONMENT
# ============================================================================

NODE_ENV=development
PORT=3000

# Local PostgreSQL 16
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/biddyapith_dev
PG_MAX_POOL=10

# Cryptographic JWT Secret
JWT_SECRET=biddyapith-secure-jwt-secret-local-dev-2026

# Supabase Auth Configuration (Local Dev Fallback)
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key

# Storage Provider (local = zero-dependency filesystem in ./uploads; s3 = MinIO / AWS S3 / Cloudflare R2)
STORAGE_PROVIDER=local
STORAGE_ENDPOINT=http://127.0.0.1:9000
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin
STORAGE_BUCKET=biddyapith-local

# Documentation (Swagger UI)
DOCS_ENABLED=true
DOCS_USER=admin
DOCS_PASSWORD=biddyapith_docs_secret_2024

# Sentry (Development Disabled / Local)
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=1.0
`;

  // Always write or update .env.example
  fs.writeFileSync(envExamplePath, defaultDevEnv, 'utf8');

  if (fs.existsSync(envPath)) {
    const existingContent = fs.readFileSync(envPath, 'utf8');
    if (existingContent.includes('NODE_ENV=production')) {
      console.log('🛡️  Existing .env has NODE_ENV=production. Preserving your cloud production settings.');
      return;
    }
    // If previous .env had local MinIO configured, seamlessly switch to zero-dependency local storage
    if (existingContent.includes('STORAGE_PROVIDER=s3') && existingContent.includes('127.0.0.1:9000')) {
      console.log('📁 Configuring local storage provider (./uploads) in .env...');
      const updated = existingContent.replace(/STORAGE_PROVIDER=s3/, 'STORAGE_PROVIDER=local');
      fs.writeFileSync(envPath, updated, 'utf8');
    } else {
      console.log('ℹ️  Existing .env found for development. Preserving current values.');
    }
  } else {
    console.log('📝 Creating local development .env file from template...');
    fs.writeFileSync(envPath, defaultDevEnv, 'utf8');
  }
}

function installDependencies() {
  console.log('📦 Installing root dependencies...');
  runCmd('npm install', rootDir);

  const frontendDir = path.join(rootDir, 'frontend');
  if (fs.existsSync(frontendDir)) {
    console.log('📦 Installing frontend dependencies...');
    runCmd('npm install', frontendDir);
  }

  const homeDir = path.join(rootDir, 'home');
  if (fs.existsSync(homeDir)) {
    console.log('📦 Installing home landing page dependencies...');
    runCmd('npm install', homeDir);
  }
}

async function probePostgres(connectionString: string): Promise<boolean> {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000 });
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1;');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => {});
  }
}

interface PostgresWaitResult {
  ready: boolean;
  host: string;
  error?: string;
}

async function waitForPostgres(maxAttempts = 75): Promise<PostgresWaitResult> {
  const candidateHosts = ['127.0.0.1', 'localhost'];
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 1. Proactively check if container died or exited
    try {
      const status = execSync('docker inspect -f "{{.State.Status}}" biddyapith_postgres', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
      }).trim();
      if (status === 'exited' || status === 'dead') {
        return {
          ready: false,
          host: '127.0.0.1',
          error: `PostgreSQL container exited unexpectedly with status "${status}".`,
        };
      }
    } catch {
      // Ignore inspect failures (e.g. docker command busy)
    }

    // 2. Try candidate hosts (IPv4 loopback first, then localhost fallback)
    for (const host of candidateHosts) {
      let maintenancePool: Pool | null = null;
      try {
        // Connect to 'postgres' maintenance DB to ensure PostgreSQL daemon is accepting connections
        maintenancePool = new Pool({
          host,
          port: 5433,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres',
          connectionTimeoutMillis: 2000,
        });

        const client = await maintenancePool.connect();
        try {
          // Check if target database 'biddyapith_dev' exists, create if not
          const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'biddyapith_dev'");
          if (dbCheck.rowCount === 0) {
            await client.query('CREATE DATABASE biddyapith_dev');
          }
        } finally {
          client.release();
        }
        await maintenancePool.end().catch(() => {});
        maintenancePool = null;

        // Verify connection into 'biddyapith_dev'
        const devPool = new Pool({
          host,
          port: 5433,
          user: 'postgres',
          password: 'postgres',
          database: 'biddyapith_dev',
          connectionTimeoutMillis: 2000,
        });

        const devClient = await devPool.connect();
        try {
          await devClient.query('SELECT 1;');
          return { ready: true, host };
        } finally {
          devClient.release();
          await devPool.end().catch(() => {});
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
      } finally {
        if (maintenancePool) {
          await maintenancePool.end().catch(() => {});
        }
      }
    }

    process.stdout.write('.');
    if (attempt % 15 === 0) {
      process.stdout.write(' (still initializing database cluster, please wait...) ');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  return { ready: false, host: '127.0.0.1', error: lastError };
}

async function initializeDatabase(hasDocker: boolean, host: string = '127.0.0.1') {
  console.log('🚀 Initializing database schema and seed data...');
  const connStr = hasDocker
    ? `postgresql://postgres:postgres@${host}:5433/biddyapith_dev`
    : (process.env.DATABASE_URL || `postgresql://postgres:postgres@${host}:5433/biddyapith_dev`);

  process.env.DATABASE_URL = connStr;

  if (!hasDocker) {
    const isReachable = await probePostgres(connStr);
    if (!isReachable) {
      console.error(`\n❌ Could not connect to PostgreSQL at ${connStr}`);
      console.error('Docker daemon is not running and no native PostgreSQL service was found on port 5433.');
      console.error('\n💡 To resolve this:');
      console.error('   1. Start Docker Desktop, then rerun: setup.bat');
      console.error('   OR');
      console.error('   2. Start a local PostgreSQL service and set DATABASE_URL in your .env file.\n');
      throw new Error(`Cannot connect to database at ${connStr}`);
    }
  }

  const { runDatabaseInit } = await import('../db/init');
  await runDatabaseInit({
    reset: isFresh,
    connectionString: connStr,
  });

  const { runMigration } = await import('./migrate-academic-security');
  await runMigration();
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║               BIDDYAPITH PLATFORM INSTALLER                  ║
║         Automated Local Development Environment Setup        ║
╚══════════════════════════════════════════════════════════════╝
  Operating System: ${os.type()} (${process.platform} - ${os.arch()})
  Node Version:     ${process.version}
  Fresh Install:    ${isFresh ? 'YES (--fresh flag active)' : 'NO (idempotent sync)'}
`);

  // Step 1: Check Docker
  logStep(1, 'Checking Docker & Container Environment');
  const hasDocker = isDockerAvailable();
  const composeCmd = getComposeCommand();
  if (!hasDocker) {
    console.warn(`⚠️  Docker is not running or accessible.
    If you are running a native PostgreSQL service locally, ensure it is available on port 5433
    or update DATABASE_URL in your .env accordingly.`);
  } else {
    if (composeCmd) {
      console.log(`✅ Docker & Docker Compose available (${composeCmd}).`);
    } else {
      console.log('✅ Docker daemon available. Using native Docker fallback (no compose plugin).');
      console.log('💡 Tip: For compose support, install docker-compose-plugin (e.g. sudo dnf install docker-compose-plugin).');
    }
    cleanContainers(isFresh);
  }

  // Step 2: Environment File Management
  logStep(2, 'Configuring Environment Settings (.env)');
  setupEnv();

  // Step 3: Install Node Dependencies
  logStep(3, 'Installing Dependencies (Root, Frontend, Home)');
  installDependencies();

  // Step 4: Boot Local Services (PostgreSQL Database)
  let workingHost = '127.0.0.1';
  if (hasDocker) {
    logStep(4, 'Starting Local Database (PostgreSQL)');
    startContainers();
    process.stdout.write('⏳ Waiting for PostgreSQL container on port 5433 to become ready');
    const waitResult = await waitForPostgres(75);
    console.log('');
    if (!waitResult.ready) {
      console.error('\n❌ PostgreSQL failed to become ready within the allocated time.');
      if (waitResult.error) {
        console.error(`   Last connection error: ${waitResult.error}`);
      }
      try {
        const logs = execSync('docker logs biddyapith_postgres --tail 25', {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 5000,
        }).trim();
        if (logs) {
          console.error('\n📋 Docker Container Logs (biddyapith_postgres):');
          console.error(logs);
        }
      } catch {}
      console.error('\n💡 Troubleshooting Tips:');
      console.error('   1. If your database volume or credentials are stale/corrupted, run a clean reinstall:');
      console.error('      Windows:     setup.bat --fresh');
      console.error('      Linux/macOS: npm run setup:fresh');
      console.error('   2. Verify Docker Desktop is running and healthy.');
      console.error('   3. Check that port 5433 is not blocked by another process or firewall.\n');
      throw new Error('Timed out waiting for PostgreSQL container to become ready on port 5433.');
    }
    workingHost = waitResult.host;
    console.log(`✅ PostgreSQL is ready and accepting connections on ${workingHost}:5433.`);
  }

  // Step 5: Database Migration and Seed
  logStep(5, 'Applying Canonical Schema & Seed Data');
  await initializeDatabase(hasDocker, workingHost);

  // Step 6: Vhosts Information
  logStep(6, 'Local Virtual Hosts (biddyapith.local)');
  console.log(`
To enable local vanity domains, add the following line to your system hosts file:

  127.0.0.1 www.biddyapith.local app.biddyapith.local api.biddyapith.local biddyapith.local

Hosts file locations:
  • Linux/macOS: /etc/hosts (run: sudo npm run setup:hosts)
  • Windows:     C:\\Windows\\System32\\drivers\\etc\\hosts (run as Administrator)
`);

  // Done!
  console.log(`
══════════════════════════════════════════════════════════════
🎉 BIDDYAPITH LOCAL SETUP COMPLETED SUCCESSFULLY!
══════════════════════════════════════════════════════════════

Next Steps:
  1. Start the unified development suite (with live HMR):
     $ npm run dev

  2. Access the apps in your browser:
     • Home Landing Page:  http://www.biddyapith.local:3000  (or http://localhost:3000)
     • Application Portal: http://app.biddyapith.local:3000  (or http://localhost:3000/app)
     • Backend API & Docs: http://api.biddyapith.local:3000  (or http://localhost:3000/docs)
     • MinIO S3 Console:   http://localhost:9001 (if S3 container enabled)

  Demo Credentials:
     • Admin:   admin@biddyapith.tech   / password123 (or username: admin)
     • Teacher: teacher@biddyapith.tech / password123 (or username: teacher)
     • Student: student@biddyapith.tech / password123 (or username: student)
`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Setup failed:', err);
    process.exit(1);
  });

