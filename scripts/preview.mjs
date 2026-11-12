import { spawnSync } from 'node:child_process';
import { findWorkerConfig } from './worker-config.mjs';
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', findWorkerConfig()], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status || 0);
