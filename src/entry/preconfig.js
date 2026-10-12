/**
 * draw.hmi: add this to js/PreConfig.js of a self-hosted draw.io, with the
 * plugin's files in plugins/draw.hmi/.
 *
 * - Registers the plugin as "hmi", so ?p=hmi loads it (and Extras > Plugins
 *   lists it in draw.io Desktop).
 * - Loads it on every page when window.DRAWIO_HMI_AUTOLOAD is true, when
 *   DRAWIO_CONFIG.hmi is set, or for ?hmi=... (?hmi=run opens the Run
 *   Screen in the full app, as a lightbox). draw.io Desktop ignores ?p and
 *   only loads the plugins of its settings, so there the plugin is added to
 *   those.
 *
 * draw.io only accepts plugins from its registry by id, and the registry is
 * created by js/app.min.js; this snippet adds the entry right after that
 * script has run, before the app starts.
 */
(function()
{
	var path = window.DRAWIO_HMI_PLUGIN_PATH || 'plugins/draw.hmi/hmi-plugin.js';
	var params = window.urlParams;
	var auto = window.DRAWIO_HMI_AUTOLOAD === true ||
		(window.DRAWIO_CONFIG != null && window.DRAWIO_CONFIG.hmi != null);

	if (params != null)
	{
		if (params['hmi'] == 'run')
		{
			params['lightbox'] = '1';
		}

		auto = auto || params['hmi'] != null;

		if (auto && params['plugins'] != '0')
		{
			var p = params['p'];

			if (p == null || p == '')
			{
				params['p'] = 'hmi';
			}
			else if (p.split(';').indexOf('hmi') < 0)
			{
				params['p'] = p + ';hmi';
			}
		}
	}

	function register()
	{
		if (typeof App !== 'undefined' && App.pluginRegistry != null)
		{
			App.pluginRegistry['hmi'] = path;
		}

		// draw.io Desktop
		if (auto && window.mxIsElectron && typeof mxSettings !== 'undefined' &&
			typeof mxSettings.getPlugins === 'function' && !mxSettings.hmiPlugins)
		{
			var getPlugins = mxSettings.getPlugins;
			mxSettings.hmiPlugins = true;

			mxSettings.getPlugins = function()
			{
				var plugins = getPlugins.apply(this, arguments) || [];

				return (plugins.indexOf(path) < 0) ? plugins.concat([path]) : plugins;
			};
		}
	};

	if (typeof window.mxscript === 'function')
	{
		var mxscript = window.mxscript;

		window.mxscript = function(src, onLoad)
		{
			if (typeof src === 'string' && /(^|\/)js\/app\.min\.js(\?.*)?$/.test(src))
			{
				var args = Array.prototype.slice.call(arguments);

				args[1] = function()
				{
					register();

					if (onLoad != null)
					{
						onLoad.apply(this, arguments);
					}
				};

				return mxscript.apply(this, args);
			}

			return mxscript.apply(this, arguments);
		};
	}

	// When the app is already loaded (dev mode, or this file loaded late)
	register();
})();
