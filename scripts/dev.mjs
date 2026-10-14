import { spawn } from 'node:child_process';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

for (const file of ['.env.local', '.env']) {
  try {
    loadEnvFile(resolve(process.cwd(), file));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(executable, ['exec', 'turbo', 'dev'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error('Unable to start NearFind development workspace', error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
