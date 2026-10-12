#!/usr/bin/env node
// Builds the plugin into dist/draw.hmi/ (copy that folder to
// <draw.io>/plugins/draw.hmi/) and, with --webapp, assembles a complete
// self-hosted draw.io in dist/webapp/ (the pinned draw.io release with the
// plugin installed), used by the e2e tests, the Grafana editor app and the
// Docker example.
//
// Usage: node scripts/build.mjs [--webapp] [--no-minify] [--drawio <version>]
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN, VIEWER } from './files.mjs';
import { fetchDrawio, pinned, root } from './fetch-drawio.mjs';

const args = process.argv.slice(2);
const minify = !args.includes('--no-minify');
const withWebapp = args.includes('--webapp');
const drawioArg = args.includes('--drawio') ? args[args.indexOf('--drawio') + 1] : null;

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const out = path.join(dist, 'draw.hmi');

function copy(from, to) {
  fs.cpSync(path.join(root, from), path.join(out, to), { recursive: true });
}

async function bundle(name, files) {
  // The modules are classic scripts sharing globals (Hmi.*, mxGraph), so
  // they are concatenated rather than bundled as modules; esbuild only
  // minifies and keeps top-level names.
  let code = '';

  for (const file of files) {
    code += `// ${file}\n${fs.readFileSync(path.join(src, file), 'utf8')}\n;\n`;
  }

  code = code.replace(/__HMI_VERSION__/g, pkg.version);

  const result = await esbuild.transform(code, {
    loader: 'js',
    target: 'es2017',
    minify,
    sourcemap: 'external',
    sourcefile: name.replace(/\.js$/, '.src.js'),
    legalComments: 'none',
    charset: 'utf8',
  });

  const banner = `/* draw.hmi ${pkg.version} | Apache-2.0 | https://github.com/softalink/draw.hmi */\n`;
  fs.writeFileSync(path.join(out, name), banner + result.code + `//# sourceMappingURL=${name}.map\n`);
  fs.writeFileSync(path.join(out, name + '.map'), result.map);

  return fs.statSync(path.join(out, name)).size;
}

async function buildPlugin() {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const sizes = {
    'hmi-plugin.js': await bundle('hmi-plugin.js', PLUGIN),
    'hmi-runtime.js': await bundle('hmi-runtime.js', VIEWER),
  };

  copy('src/lib', 'lib');
  fs.rmSync(path.join(out, 'lib/README.md'), { force: true });
  copy('templates', 'templates');
  copy('images', 'images');
  copy('pages/hmi-run.html', 'hmi-run.html');
  copy('src/entry/preconfig.js', 'preconfig.js');
  copy('NOTICE', 'NOTICE');
  copy('LICENSE', 'LICENSE');

  fs.writeFileSync(path.join(out, 'VERSION.json'), JSON.stringify({
    version: pkg.version,
    drawio: pinned().version,
    built: new Date().toISOString(),
  }, null, 2) + '\n');

  for (const [name, size] of Object.entries(sizes)) {
    console.log(`${name.padEnd(16)} ${(size / 1024).toFixed(0)} KB`);
  }
}

/** dist/webapp: stock draw.io + plugins/draw.hmi + the PreConfig snippet. */
async function assembleWebapp(version) {
  const drawio = await fetchDrawio(version);
  const webapp = path.join(dist, 'webapp');

  fs.rmSync(webapp, { recursive: true, force: true });
  fs.cpSync(drawio, webapp, { recursive: true, dereference: true });
  fs.cpSync(out, path.join(webapp, 'plugins/draw.hmi'), { recursive: true });

  const preConfig = path.join(webapp, 'js/PreConfig.js');
  fs.appendFileSync(preConfig, '\n' + fs.readFileSync(path.join(src, 'entry/preconfig.js'), 'utf8'));

  console.log(`webapp           ${path.relative(root, webapp)} (draw.io ${version || pinned().version})`);
}

await buildPlugin();

if (withWebapp) {
  await assembleWebapp(drawioArg);
}
