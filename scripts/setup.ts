import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Pool } from 'pg';

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

async function checkDocker(): Promise<boolean> {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    execSync('docker compose version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function cleanOldInstallations(hasDocker: boolean) {
  if (!hasDocker) return;

  console.log('🔍 Checking for old or conflicting containers...');
  const staleContainers = ['edu_postgres', 'biddyapith_postgres', 'biddyapith_s3', 'biddyapith_s3_init'];

  for (const name of staleContainers) {
    try {
      const inspectOutput = execSync(`docker ps -a -q -f name=^/${name}$`, { encoding: 'utf8' }).trim();
      if (inspectOutput) {
        if (isFresh || name === 'edu_postgres') {
          console.log(`🧹 Removing stale container: ${name}...`);
          execSync(`docker stop ${name} >/dev/null 2>&1 || true`, { stdio: 'ignore' });
          execSync(`docker rm -f ${name} >/dev/null 2>&1 || true`, { stdio: 'ignore' });
        }
      }
    } catch {}
  }

  if (isFresh) {
    console.log('🧹 Removing old docker compose volumes for fresh state...');
    runCmd('docker compose -f db/docker-compose.yml down -v --remove-orphans', rootDir, true);
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

# Local S3/R2 Object Storage (MinIO)
STORAGE_PROVIDER=s3
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
    console.log('ℹ️  Existing .env found for development. Preserving current values.');
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

async function waitForPostgres(maxAttempts = 30): Promise<boolean> {
  const dbUrl = 'postgresql://postgres:postgres@127.0.0.1:5433/biddyapith_dev';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 1500 });
      const client = await pool.connect();
      await client.query('SELECT 1;');
      client.release();
      await pool.end();
      return true;
    } catch {
      process.stdout.write('.');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

async function initializeDatabase() {
  console.log('🚀 Initializing database schema and seed data...');
  const { runDatabaseInit } = await import('../db/init');
  await runDatabaseInit({
    reset: isFresh,
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:5433/biddyapith_dev',
  });
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
  const hasDocker = await checkDocker();
  if (!hasDocker) {
    console.warn(`⚠️  Docker or Docker Compose is not running.
    If you are running a native PostgreSQL service locally, ensure it is available on port 5433
    or update DATABASE_URL in your .env accordingly.`);
  } else {
    console.log('✅ Docker & Docker Compose available.');
    await cleanOldInstallations(hasDocker);
  }

  // Step 2: Environment File Management
  logStep(2, 'Configuring Environment Settings (.env)');
  setupEnv();

  // Step 3: Install Node Dependencies
  logStep(3, 'Installing Dependencies (Root, Frontend, Home)');
  installDependencies();

  // Step 4: Boot Local Services (PostgreSQL & MinIO S3)
  if (hasDocker) {
    logStep(4, 'Starting Local Services (PostgreSQL & MinIO S3)');
    runCmd('docker compose -f db/docker-compose.yml up -d --remove-orphans', rootDir);
    process.stdout.write('⏳ Waiting for PostgreSQL container on 127.0.0.1:5433 to become ready');
    const isReady = await waitForPostgres();
    console.log('');
    if (!isReady) {
      throw new Error('Timed out waiting for PostgreSQL container to become ready on port 5433.');
    }
    console.log('✅ PostgreSQL is ready and accepting connections on port 5433.');
  }

  // Step 5: Database Migration and Seed
  logStep(5, 'Applying Canonical Schema & Seed Data');
  await initializeDatabase();

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
     • MinIO S3 Console:   http://localhost:9001 (User: minioadmin / Pass: minioadmin)

  Demo Credentials:
     • Admin:   admin@biddyapith.tech   / password123 (or username: admin)
     • Teacher: teacher@biddyapith.tech / password123 (or username: teacher)
     • Student: student@biddyapith.tech / password123 (or username: student)
`);
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err);
  process.exit(1);
});

