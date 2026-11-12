import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
export function findWorkerConfig(root = 'dist') {
  const found = [];
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name === 'wrangler.json') {
        const config = JSON.parse(readFileSync(path, 'utf8'));
        if (config.name === 'hallway-tracker') found.push(path);
      }
    }
  }
  if (existsSync(root)) visit(root);
  if (found.length !== 1) throw new Error('Expected one built hallway-tracker Worker config. Run npm run build first.');
  return found[0];
}
