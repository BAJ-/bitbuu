import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';
import electronPath from 'electron';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: root, stdio: 'inherit' });
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
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

electron.on('exit', async () => {
  await server.close();
  process.exit(0);
});
