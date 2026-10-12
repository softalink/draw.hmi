/**
 * draw.hmi runtime entry (hmi-runtime.js): load it after draw.io's viewer
 * (js/viewer.min.js or js/viewer-static.min.js). GraphViewer instances
 * with an "hmi" config run their screens (see viewer/HmiViewer.js).
 */
(function()
{
	var root = (typeof globalThis !== 'undefined') ? globalThis : window;
	var Hmi = root.Hmi;

	if (typeof Graph === 'undefined' || typeof GraphViewer === 'undefined')
	{
		if (root.console != null)
		{
			console.error('HMI: load draw.io\'s viewer before hmi-runtime.js');
		}

		return;
	}

	Hmi.Compat.install();
	Hmi.Viewer.install();
})();
