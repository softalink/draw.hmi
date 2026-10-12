#!/usr/bin/env node
// Downloads the pinned draw.io release (upstream/drawio.json) and unpacks it
// into .cache/drawio/<version>/ (the webapp: index.html, js/, ...).
//
// Usage: node scripts/fetch-drawio.mjs [version]
//   With a version, fetches that release instead (no checksum check), for
//   trying a newer draw.io; scripts/bump-drawio.mjs updates the pin.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function pinned() {
  return JSON.parse(fs.readFileSync(path.join(root, 'upstream/drawio.json'), 'utf8'));
}

export function webappDir(version) {
  return path.join(root, '.cache/drawio', version);
}

export async function fetchDrawio(version) {
  const pin = pinned();
  const v = version || pin.version;
  const url = version && version !== pin.version ? `https://github.com/jgraph/drawio/releases/download/v${v}/draw.war` : pin.url;
  const dir = webappDir(v);

  if (fs.existsSync(path.join(dir, 'index.html'))) {
    return dir;
  }

  const war = path.join(root, '.cache', `draw-${v}.war`);
  fs.mkdirSync(path.dirname(war), { recursive: true });

  if (!fs.existsSync(war)) {
    console.log(`Downloading draw.io ${v}`);
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`${url}: HTTP ${res.status}`);
    }

    fs.writeFileSync(war + '.part', Buffer.from(await res.arrayBuffer()));
    fs.renameSync(war + '.part', war);
  }

  if (v === pin.version && pin.sha256) {
    const sum = crypto.createHash('sha256').update(fs.readFileSync(war)).digest('hex');

    if (sum !== pin.sha256) {
      fs.rmSync(war);
      throw new Error(`Checksum mismatch for ${war}: ${sum}`);
    }
  }

  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-q', war, '-d', dir]);
  console.log(`draw.io ${v} in ${path.relative(root, dir)}`);

  return dir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fetchDrawio(process.argv[2]).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
