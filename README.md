# draw.hmi

HMI/SCADA screens for [draw.io](https://github.com/jgraph/drawio): live tags, bindings, InTouch-style animation links, alarms, scripts, faceplates and a runtime. It runs:

- **in draw.io**, as a plugin of an unmodified self-hosted draw.io or a draw.io Desktop build, and
- **in Grafana**, as a panel plugin that runs screens on Grafana data, with the draw.io editor in an app plugin.

draw.io itself is not changed: the plugin uses its public globals and wraps a few functions at runtime ([`src/compat/HmiCompat.js`](src/compat/HmiCompat.js)). The draw.io release the tests run against is pinned in [`upstream/drawio.json`](upstream/drawio.json) (currently 32.4.1), and a weekly workflow tries each new release.

## Quick start

```sh
npm install
npm run build:webapp            # dist/draw.hmi (the plugin) and dist/webapp (draw.io 32.4.1 with it)
npx http-server dist/webapp -p 8080 -c-1
# http://localhost:8080/?p=hmi
```

Or with the official Docker image: `docker compose -f examples/self-hosted/docker-compose.yml up --build` (after `npm run build`).

Installation on your own draw.io, draw.io Desktop and the content security policy: [docs/INSTALL.md](docs/INSTALL.md). Using it: [docs/USER_GUIDE.md](docs/USER_GUIDE.md). Grafana: [grafana/README.md](grafana/README.md).

## What is built

| Output | What it is |
| --- | --- |
| `dist/draw.hmi/hmi-plugin.js` | The editor plugin (`?p=hmi`), with the runtime |
| `dist/draw.hmi/hmi-runtime.js` | The runtime for draw.io's viewer (`viewer.min.js` / `viewer-static.min.js`) |
| `dist/draw.hmi/preconfig.js` | Loader snippet for draw.io's `js/PreConfig.js` |
| `dist/webapp/` | The pinned draw.io release with the plugin installed (tests, Grafana editor) |
| `grafana/panel/dist`, `grafana/editor-app/dist` | The Grafana plugins (`npm --prefix grafana run build`) |

## Testing

```sh
npm test                        # unit tests (Node)
npm run build:webapp
npm run test:contract           # every draw.io function the plugin uses exists in the pinned release
npm run test:e2e                # Playwright end-to-end tests against dist/webapp
```

`tools/dev` has local MQTT, WebSocket, HTTP and SSE servers and a plant simulator (`npm install --prefix tools/dev && npm run dev:servers`); the unit tests use it too. The Grafana tests are described in [grafana/README.md](grafana/README.md).

## Layout

```
src/
  core/ sources/ runtime/   tags, expressions, data sources, the runtime
  ui/ sidebar/ shapes/      editor dialogs, the HMI palette, HMI shapes
  viewer/                   runtime attachment to draw.io's GraphViewer
  compat/                   the draw.io integration (patches, sidebar, templates, embed messages)
  entry/                    bundle entry points and the PreConfig loader
  lib/                      echarts and mqtt.js (lazy-loaded)
pages/hmi-run.html          the Run Screen page
templates/                  HMI templates (water treatment, tank farm, MCC, HVAC, InTouch links demo)
grafana/                    the Grafana panel and editor app plugins
examples/self-hosted/       jgraph/drawio Docker image with the plugin
scripts/                    build, fetch/bump draw.io, add to draw.io Desktop, demo generator
test/unit test/contract test/e2e
docs/                       user guide, architecture, InTouch mapping, hardening, schemas
tools/dev/                  local test servers
```

## History

draw.hmi started as a fork of draw.io (softalink/drawio, branch `claude/confident-gates-rqzs24`) that changed draw.io's core files, and a separate Grafana repository (softalink/grafana-hmi). Both are replaced by this repository.

## License

Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). draw.io is Apache-2.0 by JGraph Ltd; it is downloaded at build time and not part of this repository.
