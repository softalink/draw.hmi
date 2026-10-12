#!/usr/bin/env node
// Runs the e2e tests (test/e2e/*.e2e.js except perf) against dist/webapp,
// one file at a time. Build first: npm run build:webapp
// Usage: node scripts/run-e2e.mjs [file ...]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { root } from './fetch-drawio.mjs';

const dir = path.join(root, 'test/e2e');
let files = process.argv.slice(2);

if (files.length == 0) {
  files = fs.readdirSync(dir).filter((f) => f.endsWith('.e2e.js') && f != 'perf.e2e.js').sort()
    .map((f) => path.join(dir, f));
}

if (!fs.existsSync(path.join(root, 'dist/webapp/plugins/draw.hmi/hmi-plugin.js')) && !process.env.HMI_WEBAPP) {
  console.error('dist/webapp is missing: run npm run build:webapp');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
