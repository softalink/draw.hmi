/**
 * draw.hmi bundle prefix: the Hmi namespace and the base path of the
 * plugin's files (the folder of this script: lib/, templates/, images/).
 */
(function()
{
	var root = (typeof globalThis !== 'undefined') ? globalThis : window;
	var Hmi = root.Hmi = root.Hmi || {};

	Hmi.bundled = true;
	Hmi.version = '__HMI_VERSION__';

	if (Hmi.basePath == null)
	{
		try
		{
			var script = (typeof document !== 'undefined') ? document.currentScript : null;

			if (script != null && script.src)
			{
				Hmi.basePath = script.src.substring(0, script.src.lastIndexOf('/') + 1);
			}
		}
		catch (e)
		{
			// ignore
		}
	}

	if (Hmi.basePath == null)
	{
		Hmi.basePath = 'plugins/draw.hmi/';
	}
})();
