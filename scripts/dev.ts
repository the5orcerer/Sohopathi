import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import { startContainers, isDockerAvailable } from './db-control';

const rootDir = path.resolve(__dirname, '..');

// Load .env
dotenv.config({ path: path.join(rootDir, '.env') });

const isProd = process.env.NODE_ENV === 'production';
const isWindows = process.platform === 'win32';

const children: ChildProcess[] = [];

function cleanup() {
  console.log('\n🛑 Shutting down development servers...');
  for (const child of children) {
    if (child && !child.killed) {
      if (isWindows && child.pid) {
        try {
          execSync(`taskkill /pid ${child.pid} /t /f`, { stdio: 'ignore' });
        } catch {}
      } else {
        child.kill('SIGTERM');
      }
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

function spawnService(name: string, command: string, args: string[], cwd: string, colorCode: string) {
  const resetColor = '\x1b[0m';
  const prefix = `${colorCode}[${name}]${resetColor} `;

  const proc = spawn(command, args, {
    cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  });

  proc.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${prefix}${line}`);
      }
    }
  });

  proc.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.error(`${prefix}${line}`);
      }
    }
  });

  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${prefix}Exited with code ${code}`);
    }
  });

  children.push(proc);
  return proc;
}

async function main() {
  if (isProd) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║             BIDDYAPITH PRODUCTION RUNNER                     ║
║   Running production bundle with cloud infrastructure        ║
╚══════════════════════════════════════════════════════════════╝
`);
    // In production, execute the compiled server directly
    const prodServer = spawn('node', ['dist/server.js'], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
    });
    prodServer.on('close', (code) => process.exit(code || 0));
    return;
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║             BIDDYAPITH UNIFIED DEV RUNNER                    ║
║   Backend, Frontend & Home Landing Page with Live HMR        ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Ensure Docker services are running if docker is available
  if (isDockerAvailable()) {
    try {
      startContainers();
      console.log('📦 Local Docker services (Postgres & MinIO) are active.');
    } catch (err: any) {
      console.warn('⚠️  Could not automatically start Docker services:', err.message);
    }
  } else {
    console.log('ℹ️  Docker not detected or managed externally. Using configured local database.');
  }

  // 1. Backend Server (Port 3000)
  spawnService('BACKEND ', 'npx', ['tsx', 'watch', 'src/server.ts'], rootDir, '\x1b[36m');

  // 2. Frontend App (Port 5173 with HMR)
  const frontendDir = path.join(rootDir, 'frontend');
  spawnService('FRONTEND', 'npx', ['vite', '--port', '5173'], frontendDir, '\x1b[32m');

  // 3. Home Landing Page (Port 5174 with HMR)
  const homeDir = path.join(rootDir, 'home');
  spawnService('HOME-PAGE', 'npx', ['vite', '--port', '5174'], homeDir, '\x1b[33m');

  console.log(`
🚀 All development environments started!
--------------------------------------------------
🌐 Home Landing Page:  http://www.biddyapith.local:3000 (or http://localhost:5174)
📱 Frontend Portal:    http://app.biddyapith.local:3000 (or http://localhost:5173)
⚡ Backend API:        http://api.biddyapith.local:3000 (or http://localhost:3000/api)
📚 API Documentation:  http://localhost:3000/docs
--------------------------------------------------
`);
}

main().catch((err) => {
  console.error('Dev runner error:', err);
  process.exit(1);
});

