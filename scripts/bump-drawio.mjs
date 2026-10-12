#!/usr/bin/env node
// Pins another draw.io release in upstream/drawio.json (version, URL and
// the sha256 of its draw.war). Without a version, pins the latest release.
//
// Usage: node scripts/bump-drawio.mjs [version]
// Prints the pinned version; exits 2 when it is already pinned.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fetchDrawio, pinned, root } from './fetch-drawio.mjs';

let version = process.argv[2];

if (!version) {
  const res = await fetch('https://api.github.com/repos/jgraph/drawio/releases/latest', {
    headers: { accept: 'application/vnd.github+json' },
  });

  if (!res.ok) {
    throw new Error(`GitHub API: HTTP ${res.status}`);
  }

  version = (await res.json()).tag_name.replace(/^v/, '');
}

if (version === pinned().version) {
  console.log(version);
  process.exit(2);
}

await fetchDrawio(version);
const war = path.join(root, '.cache', `draw-${version}.war`);
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(war)).digest('hex');
const pin = { version, url: `https://github.com/jgraph/drawio/releases/download/v${version}/draw.war`, sha256 };
fs.writeFileSync(path.join(root, 'upstream/drawio.json'), JSON.stringify(pin, null, 2) + '\n');
console.log(version);
