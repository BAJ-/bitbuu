import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';
import electronPath from 'electron';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: root, stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${signal ?? code}`));
    });
  });
}

await run('npx', ['tsc', '-p', 'tsconfig.main.json']);
await run('npx', ['tsc', '-p', 'tsconfig.preload.json']);

const server = await createServer({ configFile: join(root, 'vite.config.ts') });
await server.listen();
server.printUrls();

const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${server.config.server.port}`;

const electron = spawn(electronPath, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

electron.on('error', async (err) => {
  console.error(err);
  await server.close();
  process.exit(1);
});

electron.on('exit', async (code, signal) => {
  await server.close();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
