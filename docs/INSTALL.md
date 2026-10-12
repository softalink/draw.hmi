# Installing draw.hmi

draw.hmi runs in an **unmodified** draw.io. It is a draw.io plugin (`hmi-plugin.js`) plus a small loader snippet for `js/PreConfig.js`. Two draw.io targets are supported:

| Target | Editor | Live data and object scripts |
| --- | --- | --- |
| Self-hosted draw.io (web) | yes | yes, with a CSP that allows them |
| draw.io Desktop (a build that includes the plugin) | yes | no: the Desktop CSP blocks them |

app.diagrams.net and the stock draw.io Desktop downloads are not supported: they only load plugins that ship with draw.io.

The Grafana panel and editor app are described in [grafana/README.md](../grafana/README.md).

## The plugin folder

`npm run build` writes `dist/draw.hmi/`, and a release has the same files in `draw.hmi-<version>.zip`:

| File | Purpose |
| --- | --- |
| `hmi-plugin.js` | The editor plugin, which includes the runtime |
| `hmi-runtime.js` | The runtime for draw.io's viewer (`js/viewer.min.js` or `js/viewer-static.min.js`) |
| `hmi-run.html` | The Run Screen page (viewer + runtime, without the editor) |
| `preconfig.js` | The loader snippet for `js/PreConfig.js` |
| `lib/` | Lazy-loaded libraries (echarts, mqtt.js) |
| `templates/`, `images/` | The HMI templates and the sidebar icon |
| `VERSION.json` | The draw.hmi version and the draw.io version it was tested with |

Copy the folder to `<draw.io webapp>/plugins/draw.hmi/`. The plugin finds its other files next to `hmi-plugin.js`.

## Self-hosted draw.io

1. Copy `draw.hmi/` to `plugins/draw.hmi/` in the webapp.
2. Append `plugins/draw.hmi/preconfig.js` to `js/PreConfig.js`. draw.io loads `js/PreConfig.js` before the app on every self-hosted domain. The snippet registers the plugin as `hmi`, because draw.io only loads `?p=` plugins from its registry.
3. Open `index.html?p=hmi`. To load the plugin on every page, also add `window.DRAWIO_HMI_AUTOLOAD = true;` to `js/PreConfig.js` before the snippet. `?hmi=run#...` opens the Run Screen in the full app.

### Content security policy

draw.io's web app sets no CSP itself, but your server or image may. HMI screens need:

- `connect-src` for the live data endpoints (`ws:`/`wss:` for MQTT over WebSocket and WebSocket sources, `https:` for HTTP polling and SSE). Restrict it to your servers.
- `worker-src blob:` (or `child-src blob:`) for object scripts, which run in a Blob worker.

See [HARDENING.md](HARDENING.md) for the plugin's own restrictions (`DRAWIO_CONFIG.hmi.allowedEndpoints`, script policy).

### Docker (jgraph/drawio)

[`examples/self-hosted`](../examples/self-hosted) builds the official `jgraph/drawio` image with the plugin:

```sh
npm install && npm run build
docker compose -f examples/self-hosted/docker-compose.yml up --build
# http://localhost:8080/
```

The image's entrypoint rewrites `js/PreConfig.js` from the `DRAWIO_*` variables on every start, so the example's entrypoint appends the snippet afterwards. The image's default CSP blocks live data and object scripts; the compose file sets `DRAWIO_CSP_HEADER` to allow them. Its quotes are escaped (`\'self\'`) because the image writes the value into a JavaScript string.

## draw.io Desktop

draw.io Desktop (32.x) loads only plugins inside the app (`./plugins/...`) and ignores `?p=`. To use draw.hmi, build draw.io Desktop with the plugin added:

```sh
git clone --recursive --branch v32.4.1 https://github.com/jgraph/drawio-desktop.git
cd drawio-desktop
node ../draw.hmi/scripts/add-to-desktop.mjs .     # copies dist/draw.hmi, appends the loader
npm install && npm start                          # then package it as drawio-desktop's README describes
```

`scripts/add-to-desktop.mjs` copies `dist/draw.hmi` to `drawio/src/main/webapp/plugins/draw.hmi`, and appends `window.DRAWIO_HMI_AUTOLOAD = true;` and the snippet to `drawio/src/main/webapp/js/PreConfig.js`. On Desktop the snippet adds the plugin to the settings' plugin list, which is how Desktop loads plugins. Without autoload, enable it once with **Extras > Plugins > Add > hmi**.

Limits on Desktop: draw.io Desktop's CSP (set by `js/diagramly/ElectronApp.js` at start-up) allows connections only to the app itself and Google Fonts, and no Blob workers (`child-src 'self'`). A plugin cannot relax it, so live sources do not connect and object scripts do not run. Editing, simulation, bindings, links, animations and the Run Screen work. This was checked with a drawio-desktop v32.4.1 build (Electron 44) under Xvfb; the Desktop build is not part of CI.

## Updating draw.io

`upstream/drawio.json` pins the draw.io release that the tests run against. The plugin only uses draw.io's public globals, and wraps a few functions at runtime (`src/compat/HmiCompat.js`). If one of them is missing in another draw.io version, the plugin logs a warning, `Hmi.Compat.report` names the patch, and only that feature is lost. `test/contract/drawio-api.test.js` checks all of them.

To try another release:

```sh
npm run build:webapp -- --drawio 32.5.0
npm run test:contract && npm run test:e2e
node scripts/bump-drawio.mjs 32.5.0     # updates upstream/drawio.json (version, URL, sha256)
```

A weekly workflow (`.github/workflows/drawio-bump.yml`) does this for each new draw.io release and opens a pull request with the test results.
