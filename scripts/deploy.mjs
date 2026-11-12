import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { findWorkerConfig } from './worker-config.mjs';
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const id = config.d1_databases[0].database_id;
if (!id || id === '00000000-0000-4000-8000-000000000000') {
  console.error('Create a Cloudflare D1 database named hallway-tracker, then replace database_id in wrangler.jsonc with its real ID. See README.md.');
  process.exit(1);
}
const builtConfig = findWorkerConfig();
const built = JSON.parse(readFileSync(builtConfig, 'utf8'));
if (built.d1_databases?.find(d => d.binding === 'DB')?.database_id !== id) {
  throw new Error('Built database configuration differs from wrangler.jsonc. Rebuild before deploying.');
}
for (const args of [
  ['d1', 'migrations', 'apply', 'hallway-tracker', '--remote', '--config', 'wrangler.jsonc'],
  ['deploy', '--config', builtConfig],
]) {
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
