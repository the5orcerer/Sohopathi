import { execSync } from 'child_process';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');
const action = process.argv[2] || 'up';

function getComposeCommand(): string | null {
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

function runCmd(cmd: string) {
  try {
    execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
  } catch (err: any) {
    console.error(`Command failed: ${cmd}`);
    process.exit(1);
  }
}

const composeCmd = getComposeCommand();

if (action === 'up') {
  console.log('🚀 Starting Biddyapith local development containers...');
  if (composeCmd) {
    runCmd(`${composeCmd} -f db/docker-compose.yml up -d --remove-orphans`);
  } else {
    // Native Docker fallback
    try {
      execSync('docker network create biddyapith_net >/dev/null 2>&1 || true', { stdio: 'ignore' });

      // Stop existing containers if running
      execSync('docker rm -f biddyapith_postgres biddyapith_s3 >/dev/null 2>&1 || true', { stdio: 'ignore' });

      console.log('📦 Starting PostgreSQL (port 5433)...');
      execSync(
        `docker run -d --name biddyapith_postgres --network biddyapith_net -p 5433:5432 ` +
        `-e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=biddyapith_dev ` +
        `-v biddyapith_pgdata:/var/lib/postgresql/data ` +
        `postgres:16-alpine`,
        { stdio: 'inherit' }
      );

      console.log('📦 Starting MinIO S3 (ports 9000/9001)...');
      execSync(
        `docker run -d --name biddyapith_s3 --network biddyapith_net -p 9000:9000 -p 9001:9001 ` +
        `-e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin ` +
        `-v biddyapith_s3data:/data ` +
        `minio/minio:RELEASE.2024-01-18T22-51-28Z server /data --console-address ":9001"`,
        { stdio: 'inherit' }
      );
    } catch (err: any) {
      console.error('Failed to start containers with native Docker:', err.message);
      process.exit(1);
    }
  }
  console.log('✅ Local containers running.');
} else if (action === 'down') {
  console.log('🛑 Stopping Biddyapith local development containers...');
  if (composeCmd) {
    runCmd(`${composeCmd} -f db/docker-compose.yml down`);
  } else {
    try {
      execSync('docker stop biddyapith_postgres biddyapith_s3 >/dev/null 2>&1 || true', { stdio: 'ignore' });
      execSync('docker rm -f biddyapith_postgres biddyapith_s3 >/dev/null 2>&1 || true', { stdio: 'ignore' });
    } catch (err: any) {
      console.error('Failed to stop containers with native Docker:', err.message);
      process.exit(1);
    }
  }
  console.log('✅ Local containers stopped.');
} else {
  console.error(`Unknown action: ${action}. Use 'up' or 'down'.`);
  process.exit(1);
}

