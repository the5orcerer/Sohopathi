import { execSync } from 'child_process';
import path from 'path';

export const rootDir = path.resolve(__dirname, '..');

export type ComposeCommand = 'docker compose' | 'docker-compose' | null;

export function isDockerAvailable(): boolean {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    execSync('docker ps', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function getComposeCommand(): ComposeCommand {
  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return 'docker compose';
  } catch {
    try {
      execSync('docker-compose --version', { stdio: 'ignore' });
      return 'docker-compose';
    } catch {
      return null;
    }
  }
}

export function startContainers(): void {
  const composeCmd = getComposeCommand();
  if (composeCmd) {
    execSync(`${composeCmd} -f db/docker-compose.yml up -d --remove-orphans`, { cwd: rootDir, stdio: 'inherit' });
    return;
  }

  // Native Docker fallback when compose plugin is not installed
  console.log('ℹ️  Docker Compose plugin not detected. Using direct Docker container management...');
  try {
    execSync('docker network create biddyapith_net >/dev/null 2>&1 || true', { stdio: 'ignore' });

    // 1. PostgreSQL container
    const pgRunning = execSync('docker ps -q -f name=^/biddyapith_postgres$', { encoding: 'utf8' }).trim();
    if (!pgRunning) {
      const pgExists = execSync('docker ps -a -q -f name=^/biddyapith_postgres$', { encoding: 'utf8' }).trim();
      if (pgExists) {
        console.log('📦 Starting existing biddyapith_postgres container...');
        execSync('docker start biddyapith_postgres', { stdio: 'inherit' });
      } else {
        console.log('📦 Creating and starting biddyapith_postgres container...');
        execSync(
          `docker run -d --name biddyapith_postgres --restart unless-stopped -p 5433:5432 ` +
          `-e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=biddyapith_dev ` +
          `-v biddyapith_pgdata:/var/lib/postgresql/data ` +
          `postgres:16-alpine`,
          { stdio: 'inherit' }
        );
      }
    } else {
      console.log('📦 biddyapith_postgres is already running.');
    }

    // 2. MinIO S3 container
    const s3Running = execSync('docker ps -q -f name=^/biddyapith_s3$', { encoding: 'utf8' }).trim();
    if (!s3Running) {
      const s3Exists = execSync('docker ps -a -q -f name=^/biddyapith_s3$', { encoding: 'utf8' }).trim();
      if (s3Exists) {
        console.log('📦 Starting existing biddyapith_s3 container...');
        execSync('docker start biddyapith_s3', { stdio: 'inherit' });
      } else {
        console.log('📦 Creating and starting biddyapith_s3 container...');
        execSync(
          `docker run -d --name biddyapith_s3 --restart unless-stopped -p 9000:9000 -p 9001:9001 ` +
          `-e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin ` +
          `-v biddyapith_s3data:/data ` +
          `minio/minio:latest server /data --console-address ":9001"`,
          { stdio: 'inherit' }
        );
      }
    } else {
      console.log('📦 biddyapith_s3 is already running.');
    }
  } catch (err: any) {
    console.error('Failed to start containers with native Docker:', err.message);
    throw err;
  }
}

export function stopContainers(removeVolumes = false): void {
  const composeCmd = getComposeCommand();
  if (composeCmd) {
    const flags = removeVolumes ? 'down -v --remove-orphans' : 'down';
    execSync(`${composeCmd} -f db/docker-compose.yml ${flags}`, { cwd: rootDir, stdio: 'inherit' });
    return;
  }

  // Native Docker fallback
  console.log('🛑 Stopping containers with native Docker...');
  execSync('docker stop biddyapith_postgres biddyapith_s3 >/dev/null 2>&1 || true', { stdio: 'ignore' });
  if (removeVolumes) {
    execSync('docker rm -f biddyapith_postgres biddyapith_s3 >/dev/null 2>&1 || true', { stdio: 'ignore' });
    execSync('docker volume rm -f biddyapith_pgdata biddyapith_s3data >/dev/null 2>&1 || true', { stdio: 'ignore' });
  }
}

export function cleanContainers(isFresh = false): void {
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
    console.log('🧹 Removing old docker volumes for fresh state...');
    stopContainers(true);
  }
}

// CLI Execution
if (
  require.main === module ||
  (process.argv[1] && (process.argv[1].endsWith('db-control.ts') || process.argv[1].endsWith('db-control.js')))
) {
  const action = process.argv[2] || 'up';
  if (action === 'up') {
    console.log('🚀 Starting Biddyapith local development containers...');
    startContainers();
    console.log('✅ Local containers running.');
  } else if (action === 'down') {
    console.log('🛑 Stopping Biddyapith local development containers...');
    stopContainers(process.argv.includes('--clean') || process.argv.includes('-v'));
    console.log('✅ Local containers stopped.');
  } else {
    console.error(`Unknown action: ${action}. Use 'up' or 'down'.`);
    process.exit(1);
  }
}
