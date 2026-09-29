// Starts the API server (port 3000, restarts on change) and the Vite dev server (port 5173) together.
import { spawn } from 'node:child_process';

const run = (cmd, args, env) => spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...env } });
const procs = [
  // Links the server prints (setup, invites) should open the Vite dev server, which forwards them.
  run(process.execPath, ['--watch-path=server', '--watch-path=src/lib/permissions.js', 'server/index.js'], { APP_URL: process.env.APP_URL || 'http://localhost:5173' }),
  run(process.execPath, ['node_modules/vite/bin/vite.js']),
];
const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', code => { if (code) stop(); });
