// Starts the API server (port 3000, restarts on change) and the Vite dev server (port 5173) together. With
// FAKE_TRELLO=1 (npm run dev:fake-trello) the server gets demo boards instead of Trello (scripts/fake-trello.js).
import { spawn } from 'node:child_process';

const run = (cmd, args, env) => spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...env } });
const fake = process.env.FAKE_TRELLO === '1' ? ['--import', './scripts/fake-trello.js'] : [];
const procs = [
  // Links the server prints (setup, invites) should open the Vite dev server, which forwards them.
  run(process.execPath, [...fake, '--watch-path=server', '--watch-path=src/lib/permissions.js', 'server/index.js'], { APP_URL: process.env.APP_URL || 'http://localhost:5173' }),
  run(process.execPath, ['node_modules/vite/bin/vite.js']),
];
const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', code => { if (code) stop(); });
