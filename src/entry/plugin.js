/**
 * draw.hmi editor plugin entry (hmi-plugin.js): loaded by draw.io as the
 * plugin "hmi" (see preconfig.js) or from Extras > Plugins.
 */
(function()
{
	var root = (typeof globalThis !== 'undefined') ? globalThis : window;
	var Hmi = root.Hmi;

	// Wraps draw.io's rendering before any diagram is shown, and takes the
	// hmi* embed messages before draw.io's own message handler is installed
	Hmi.Compat.install();
	Hmi.Compat.installMessageListener();

	if (typeof Draw === 'undefined' || typeof Draw.loadPlugin !== 'function')
	{
		if (root.console != null)
		{
			console.error('HMI: hmi-plugin.js must be loaded as a draw.io plugin');
		}

		return;
	}

	Draw.loadPlugin(function(ui)
	{
		Hmi.Plugin.install(ui);
	});
})();
