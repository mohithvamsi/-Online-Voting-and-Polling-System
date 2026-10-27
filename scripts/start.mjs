// Cross-platform guided launcher. No privileged credentials are requested.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { parseEnv } from 'node:util';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Install Node.js 24 LTS or newer supported LTS from https://nodejs.org/');
  process.exit(1);
}
console.log('\nSTUDENT MANAGEMENT SYSTEM\n');
const envPath = path.join(backend, '.env');
if (!fs.existsSync(envPath)) fs.copyFileSync(path.join(backend, '.env.example'), envPath);
let config = parseEnv(fs.readFileSync(envPath, 'utf8'));
const valid = (c) => {
  try {
    const u = new URL(c.SUPABASE_URL);
    return u.protocol === 'https:' && u.pathname === '/' && !u.search && !u.hash && !u.username &&
      !u.password && !c.SUPABASE_URL.includes('YOUR_') &&
      /^sb_publishable_[A-Za-z0-9_-]+$/.test(c.SUPABASE_PUBLISHABLE_KEY || '');
  } catch { return false; }
};
if (!valid(config)) {
  console.log('One-time setup: open your Supabase project > Connect / API settings.');
  console.log('Only your project URL and PUBLISHABLE key are needed.');
  console.log('Never enter a secret key, database password, or administrator password here.\n');
  if (!process.stdin.isTTY) {
    console.error('Edit backend/.env with your own URL and publishable key, then run npm start again.');
    process.exit(1);
  }
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (!valid(config)) {
      const url = (await input.question('Supabase project URL: ')).trim().replace(/\/$/, '');
      const key = (await input.question('Supabase publishable key (sb_publishable_...): ')).trim();
      config = { PORT: '3000', NODE_ENV: 'development', SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key };
      if (!valid(config)) console.log('\nInvalid values. Use an HTTPS project URL and an sb_publishable_ key.\n');
    }
    fs.writeFileSync(envPath, Object.entries(config).map(([k,v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
    console.log('\nSaved backend/.env locally. Git ignores this file.');
  } finally { input.close(); }
}
const port = Number(config.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Fix PORT in backend/.env. It must be 1–65535.'); process.exit(1);
}
if (!fs.existsSync(path.join(backend, 'node_modules', 'express', 'package.json'))) {
  console.log('\nInstalling dependencies from the included lockfile. Internet is required.');
  // npm.cmd is a Windows shell shim; no user input is interpolated into this command.
  const installed = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm.cmd ci --no-fund'], { cwd: backend, stdio: 'inherit' })
    : spawnSync('npm', ['ci', '--no-fund'], { cwd: backend, stdio: 'inherit' });
  if (installed.error || installed.status !== 0) {
    console.error('Installation failed. Check your internet, then run npm ci inside backend.'); process.exit(1);
  }
}
console.log('\nBefore your first login:');
console.log('1. Run database/schema.sql ONCE in a fresh Supabase project.');
console.log('2. Create a confirmed email/password user in Authentication > Users.');
console.log('3. Add that Auth user UUID using database/add-admin.sql.');
console.log('See START-HERE.md for the exact steps.\n');
const child = spawn(process.execPath, ['--env-file=.env', 'server.js'], {
  cwd: backend, stdio: ['inherit', 'pipe', 'inherit']
});
let opened = false;
child.stdout.on('data', (data) => {
  process.stdout.write(data);
  if (!opened && data.toString().includes('Student Management System:')) {
    opened = true;
    const url = `http://localhost:${port}`;
    let browser;
    if (process.platform === 'win32') browser = spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], { detached: true, stdio: 'ignore' });
    else if (process.platform === 'darwin') browser = spawn('open', [url], { detached: true, stdio: 'ignore' });
    else browser = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    browser.on('error', () => console.log(`Open ${url} in your browser.`));
    browser.unref();
  }
});
child.on('error', () => { console.error('Could not start Node server.'); process.exitCode = 1; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', (code, signal) => { process.exitCode = signal ? 0 : (code || 0); });
