import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findWorkerConfig } from '../scripts/worker-config.mjs';
test('deployment discovers the generated worker configuration instead of assuming an output path',()=>{
 const root=mkdtempSync(join(tmpdir(),'hallway-build-'));
 try{assert.throws(()=>findWorkerConfig(root));const worker=join(root,'hallway_tracker');mkdirSync(worker);const file=join(worker,'wrangler.json');writeFileSync(file,JSON.stringify({name:'hallway-tracker'}));assert.equal(findWorkerConfig(root),file);}finally{rmSync(root,{recursive:true,force:true});}
});
