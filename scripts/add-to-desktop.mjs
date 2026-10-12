#!/usr/bin/env node
// Adds draw.hmi to a jgraph/drawio-desktop checkout (with its drawio
// submodule): copies dist/draw.hmi to drawio/dist/webapp/plugins/draw.hmi
// and appends the loader (with autoload) to drawio/dist/webapp/js/PreConfig.js.
// Run npm run build first. See docs/INSTALL.md.
//
// Usage: node scripts/add-to-desktop.mjs <drawio-desktop folder>
import fs from 'node:fs';
import path from 'node:path';
import { root } from './fetch-drawio.mjs';

const desktop = process.argv[2];
const webapp = desktop && path.resolve(desktop, 'drawio/src/main/webapp');
const plugin = path.join(root, 'dist/draw.hmi');

if (!webapp || !fs.existsSync(path.join(webapp, 'js/PreConfig.js'))) {
  console.error('Usage: node scripts/add-to-desktop.mjs <drawio-desktop folder> (with the drawio submodule)');
  process.exit(1);
}

if (!fs.existsSync(path.join(plugin, 'hmi-plugin.js'))) {
  console.error('dist/draw.hmi is missing: run npm run build');
  process.exit(1);
}

const target = path.join(webapp, 'plugins/draw.hmi');
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(plugin, target, { recursive: true });

const preConfig = path.join(webapp, 'js/PreConfig.js');
const marker = '// draw.hmi loader';
let text = fs.readFileSync(preConfig, 'utf8');

if (text.includes(marker)) {
  text = text.substring(0, text.indexOf(marker));
}

text = text.replace(/\s*$/, '\n') + `${marker}\nwindow.DRAWIO_HMI_AUTOLOAD = true;\n` +
  fs.readFileSync(path.join(plugin, 'preconfig.js'), 'utf8');
fs.writeFileSync(preConfig, text);
console.log(`Added draw.hmi to ${webapp}`);
