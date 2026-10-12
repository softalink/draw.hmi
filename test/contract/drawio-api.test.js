// Contract with draw.io: every draw.io function the plugin wraps or calls
// (Hmi.Compat.TARGETS and the extension points of the loader) exists in the
// assembled webapp, and every compat patch installs. Run against another
// draw.io release with: node scripts/build.mjs --webapp --drawio <version>
var test = require('node:test');
var assert = require('node:assert');
var util = require('../e2e/util.js');

var browser = null;
var web = null;

// Used directly (not patched) by the plugin and the PreConfig snippet
var EDITOR_API = ['Draw.loadPlugin', 'App.pluginRegistry', 'EditorUi.prototype.fileLoaded',
	'EditorUi.prototype.showDialog', 'EditorUi.prototype.getCurrentFile', 'Menus.prototype.addMenuItems',
	'Sidebar.prototype.showEntries', 'Sidebar.prototype.addPaletteFunctions',
	'Sidebar.prototype.createVertexTemplateEntry', 'Format.prototype.immediateRefresh',
	'Graph.prototype.placeholderPattern', 'Graph.sanitizeLink', 'Graph.sanitizeHtml', 'Graph.prototype.getTooltipForCell',
	'Editor.parseDiagramNode', 'mxStencilRegistry.libraries'];
var VIEWER_API = ['GraphViewer.processElements', 'GraphViewer.prototype.init', 'Graph.prototype.placeholderPattern',
	'Graph.sanitizeLink', 'Graph.sanitizeHtml', 'Graph.prototype.getTooltipForCell', 'Editor.parseDiagramNode'];

function resolve(names)
{
	return names.filter(function(name)
	{
		var parts = name.split('.');
		var obj = window;

		for (var i = 0; i < parts.length; i++)
		{
			if (obj == null)
			{
				return true;
			}

			obj = obj[parts[i]];
		}

		return obj == null;
	});
}

function hostPage(viewer)
{
	return '<!DOCTYPE html><html><head><meta charset="utf-8"><script>' +
		'var urlParams = {};' +
		'window.onDrawioViewerLoad = function() { var s = document.createElement("script");' +
		' s.src = "/plugins/draw.hmi/hmi-runtime.js"; s.onload = function() { window.hmiReady = true; };' +
		' document.head.appendChild(s); };' +
		'</script><script src="/js/' + viewer + '"></script></head><body></body></html>';
}

test.before(async function()
{
	util.addPage('/__test/contract-viewer.html', hostPage('viewer.min.js'));
	util.addPage('/__test/contract-static.html', hostPage('viewer-static.min.js'));
	web = await util.startStatic(0);
	browser = await util.launch();
});

test.after(async function()
{
	await browser.close();
	web.server.close();
});

test('editor: compat patches install and the draw.io API is present', async function()
{
	var page = await util.openEditor(browser, web.url);
	var result = await page.evaluate(function(args)
	{
		var resolve = eval('(' + args.resolve + ')');

		// GraphViewer is part of the viewer bundles, not of the app
		var targets = Object.keys(Hmi.Compat.TARGETS).filter(function(key)
		{
			return key != 'viewerSize';
		}).map(function(key)
		{
			return Hmi.Compat.TARGETS[key];
		});

		return {report: Hmi.Compat.report, targets: resolve(targets),
			api: resolve(args.api), registry: App.pluginRegistry['hmi']};
	}, {resolve: resolve.toString(), api: EDITOR_API});

	assert.deepStrictEqual(result.report.filter(function(r)
	{
		return !r.ok;
	}), []);
	assert.ok(result.report.length >= 7, 'patches reported');
	assert.deepStrictEqual(result.targets, [], 'missing compat targets');
	assert.deepStrictEqual(result.api, [], 'missing draw.io API');
	assert.strictEqual(result.registry, 'plugins/draw.hmi/hmi-plugin.js');
	assert.deepStrictEqual(page.hmiErrors, []);
	await page.close();
});

for (var viewer of ['viewer', 'static'])
{
	(function(viewer)
	{
		test('runtime on ' + viewer + ': compat patches install and the draw.io API is present', async function()
		{
			var page = await browser.newPage();
			var errors = [];
			page.on('pageerror', function(e)
			{
				errors.push(e.message);
			});
			await page.goto(web.url + '/__test/contract-' + viewer + '.html');
			await page.waitForFunction(function()
			{
				return window.hmiReady === true;
			}, null, {timeout: 30000});
			var result = await page.evaluate(function(args)
			{
				var resolve = eval('(' + args.resolve + ')');
				var editorOnly = ['sidebarEntries', 'sidebarConfiguration', 'templates'];
				var targets = Object.keys(Hmi.Compat.TARGETS).filter(function(key)
				{
					return editorOnly.indexOf(key) < 0;
				}).map(function(key)
				{
					return Hmi.Compat.TARGETS[key];
				});

				return {report: Hmi.Compat.report, targets: resolve(targets), api: resolve(args.api)};
			}, {resolve: resolve.toString(), api: VIEWER_API});

			assert.deepStrictEqual(result.report.filter(function(r)
			{
				return !r.ok;
			}), []);
			assert.deepStrictEqual(result.targets, [], 'missing compat targets');
			assert.deepStrictEqual(result.api, [], 'missing draw.io API');
			assert.deepStrictEqual(errors, []);
			await page.close();
		});
	})(viewer);
}
