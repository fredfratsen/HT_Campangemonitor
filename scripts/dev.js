// Starts the API server (port 3000, restarts on change) and the Vite dev server (port 5173) together.
import { spawn } from 'node:child_process';

const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
const procs = [
  run(process.execPath, ['--watch-path=server', 'server/index.js']),
  run(process.execPath, ['node_modules/vite/bin/vite.js']),
];
const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', code => { if (code) stop(); });
