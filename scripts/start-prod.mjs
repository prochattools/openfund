#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const processes = [];
let shuttingDown = false;

const baseEnv = { ...process.env };
if (!baseEnv.NEW_RELIC_LICENSE_KEY?.trim()) {
  delete baseEnv.NODE_OPTIONS;
}

const startProcess = ({ name, command, args, env }) => {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: { ...baseEnv, ...env },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    const reason =
      signal ? `${name} exited after receiving ${signal}` : `${name} exited with code ${code ?? 0}`;
    console.log(reason);
    shutdown(code ?? (signal ? 1 : 0));
  });

  child.on('error', (error) => {
    console.error(`${name} failed to start`, error);
    shutdown(1);
  });

  processes.push(child);
};

const shutdown = (code = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  processes.forEach((child) => {
    if (child.killed) {
      return;
    }
    child.kill('SIGTERM');
  });
  // Give children a brief moment to exit cleanly before forcing shutdown.
  setTimeout(() => {
    process.exit(code);
  }, 500);
};

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

const apiEntry = path.join(projectRoot, 'dist', 'server', 'index.js');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const port = process.env.PORT ?? '3000';

startProcess({
  name: 'api',
  command: process.execPath,
  args: [apiEntry],
});

startProcess({
  name: 'web',
  command: process.execPath,
  args: [nextBin, 'start', '-p', port],
});
