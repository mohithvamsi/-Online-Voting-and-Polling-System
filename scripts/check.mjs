import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.git'].includes(entry.name)) return [];
    const item = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(item) : /\.(js|mjs)$/.test(item) ? [item] : [];
  });
}
const files = walk(root);
for (const file of files) {
  const checked = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (checked.status !== 0) process.exit(1);
}
console.log(`Syntax checks passed for ${files.length} JavaScript files.`);
