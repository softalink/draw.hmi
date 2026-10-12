/**
 * Loads draw.io's viewer (js/viewer-static.min.js, with its shapes built in)
 * and the HMI runtime (plugins/draw.hmi/hmi-runtime.js) into the page once.
 * Every HMI panel of the dashboard shares them.
 */

declare global {
  interface Window {
    [key: string]: any;
  }
}

let loading: Promise<void> | null = null;

// Floating windows of the runtime (faceplates, InTouch windows); the Run
// Screen page has the same rules (hmi-run.html)
const CSS = `
div.mxWindow { position: absolute; overflow: hidden; z-index: 1; background: #fff;
  border: 1px solid #b0bec5; border-radius: 4px; box-shadow: 0 6px 18px rgba(0,0,0,0.3); }
table.mxWindow { border-collapse: collapse; table-layout: fixed; font-size: 12px; }
td.mxWindowTitle { background: #eceff1; color: #263238; font-weight: bold; text-align: center;
  white-space: nowrap; text-overflow: ellipsis; overflow: hidden; height: 18px; padding: 4px 6px;
  display: flex; justify-content: center; align-items: center; }
td.mxWindowPane { vertical-align: top; padding: 0; }
div.mxWindowPane { overflow: hidden; position: relative; }
`;

function setDefault(name: string, value: unknown) {
  if (window[name] == null) {
    window[name] = value;
  }
}

/**
 * Sets the globals the viewer bundle reads, with asset paths under base
 * (the panel plugin's drawio/ folder, ending with a slash).
 */
export function installGlobals(base: string) {
  setDefault('urlParams', {});
  setDefault('DRAWIO_BASE_URL', base.replace(/\/$/, ''));
  setDefault('SHAPES_PATH', base + 'shapes');
  setDefault('STENCIL_PATH', base + 'stencils');
  setDefault('STYLE_PATH', base + 'styles');
  setDefault('IMAGE_PATH', base + 'images');
  setDefault('GRAPH_IMAGE_PATH', base + 'img');
  setDefault('mxImageBasePath', base + 'mxgraph/images');
  setDefault('mxBasePath', base + 'mxgraph/');
  setDefault('DRAW_MATH_URL', base + 'math4/es5');
  setDefault('mxLoadResources', false);
  setDefault('mxLoadStylesheets', false);

  if (document.getElementById('hmi-panel-runtime-css') == null) {
    const style = document.createElement('style');
    style.id = 'hmi-panel-runtime-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
}

function addScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(script);
  });
}

/**
 * Loads the viewer and the runtime from base (ending with a slash).
 * Resolves when Hmi.Viewer is available.
 */
export function loadRuntime(base: string): Promise<void> {
  if (window.Hmi?.Viewer != null && window.GraphViewer != null) {
    return Promise.resolve();
  }

  if (loading != null) {
    return loading;
  }

  installGlobals(base);

  // Grafana's module loader defines a global AMD define(). The UMD
  // libraries in the viewer would register with it instead of setting
  // their globals, so it is hidden while the scripts run.
  const define = window.define;
  window.define = undefined;

  const restore = () => {
    if (window.define === undefined) {
      window.define = define;
    }
  };

  // The viewer calls this when it has loaded, instead of scanning the page
  // for .mxgraph elements; the runtime is loaded after the viewer
  const viewerLoaded = new Promise<void>((resolve) => {
    window.onDrawioViewerLoad = () => resolve();
  });

  loading = addScript(base + 'js/viewer-static.min.js')
    .then(() => viewerLoaded)
    .then(() => addScript(base + 'plugins/draw.hmi/hmi-runtime.js'))
    .then(() => {
      restore();

      if (window.Hmi?.Viewer == null || window.GraphViewer == null) {
        throw new Error('The HMI runtime did not start (Hmi.Viewer missing)');
      }
    })
    .catch((e) => {
      restore();
      loading = null;
      throw e;
    });

  return loading;
}
