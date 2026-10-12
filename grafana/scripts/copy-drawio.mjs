#!/usr/bin/env node
// Copies draw.io and draw.hmi into the two Grafana plugins, from the
// assembled webapp of the repository (../dist/webapp: the pinned stock
// draw.io release with plugins/draw.hmi installed, see npm run build:webapp
// in the repository root):
//   panel/dist/drawio/       draw.io's self-contained viewer
//                            (js/viewer-static.min.js), the HMI runtime
//                            (plugins/draw.hmi/hmi-runtime.js and its lazy
//                            libraries) and the demo template
//   editor-app/dist/editor/  the draw.io editor with the HMI plugin
//
// Usage: node scripts/copy-drawio.mjs [webapp]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || path.join(root, '../dist/webapp'));
const HMI = 'plugins/draw.hmi';

for (const file of ['js/app.min.js', 'js/viewer-static.min.js', `${HMI}/hmi-plugin.js`, `${HMI}/hmi-runtime.js`]) {
  if (!fs.existsSync(path.join(source, file))) {
    console.error(`Missing ${file} in ${source}. Run npm run build:webapp in the repository root first.`);
    process.exit(1);
  }
}

function copy(from, to) {
  fs.cpSync(path.join(source, from), to, { recursive: true });
}

// Panel: runtime only
const panel = path.join(root, 'panel/dist/drawio');
fs.rmSync(panel, { recursive: true, force: true });
copy('js/viewer-static.min.js', path.join(panel, 'js/viewer-static.min.js'));

for (const name of ['hmi-runtime.js', 'lib', 'NOTICE', 'LICENSE', 'VERSION.json']) {
  copy(`${HMI}/${name}`, path.join(panel, HMI, name));
}

copy(`${HMI}/templates/intouch_links_demo.xml`, path.join(panel, 'templates/intouch_links_demo.xml'));

// Editor: the webapp without what the editor in embed mode and the Run
// Screen do not use: server-side files, integrations, cloud and desktop
// code, the service worker, development sources and source maps
const SKIP = new Set([
  'WEB-INF',
  'META-INF',
  'connect',
  'service-worker.js',
  'js/diagramly',
  'js/grapheditor',
  'js/integrate.min.js',
  'js/embed.dev.js',
  'js/desktop',
  'js/viewer-static.min.js',
]);
const KEEP_HTML = new Set(['index.html', 'clear.html']);
const editor = path.join(root, 'editor-app/dist/editor');
fs.rmSync(editor, { recursive: true, force: true });
fs.cpSync(source, editor, {
  recursive: true,
  dereference: true,
  filter: (src) => {
    const rel = path.relative(source, src).split(path.sep).join('/');

    if (rel === '') {
      return true;
    }

    if (SKIP.has(rel) || /^workbox-.*\.js$/.test(rel) || rel.endsWith('.map')) {
      return false;
    }

    // Top-level pages other than the editor
    return rel.includes('/') || !rel.endsWith('.html') || KEEP_HTML.has(rel);
  },
});

function size(dir) {
  let total = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? size(p) : fs.statSync(p).size;
  }

  return total;
}

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(`panel/dist/drawio       ${mb(size(panel))}`);
console.log(`editor-app/dist/editor  ${mb(size(editor))}`);
