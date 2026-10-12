// Hosting the HMI in another application's page (Grafana panel plugin):
// several viewers in one page with keyScope 'container', Hmi.Viewer.detach,
// and the editor in an iframe (embed protocol with hmiSetHostTags).
// Run: node --test --test-concurrency=1 test/e2e/host-embed.e2e.js
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var util = require('./util.js');

var browser = null;
var web = null;

function attr(obj)
{
	return JSON.stringify(obj).replace(/&/g, '&amp;').replace(/'/g, '&apos;').replace(/</g, '&lt;');
}

// One page with a local tag and a pushbutton adding 1 on click or F2
function diagram(label)
{
	var cfg = {version: 1, sim: 'off', sources: [], triggers: [],
		tags: [{name: 'Count', type: 'number', access: 'rw', local: true, initial: 0}]};
	var links = {pushValue: {tag: 'Count', action: 'add', value: 1,
		key: {key: 'F2', ctrl: false, shift: false}}};

	return '<mxfile><diagram id="p1" name="Page-1"><mxGraphModel><root>' +
		"<object id=\"0\" hmi='" + attr(cfg) + "'><mxCell/></object><mxCell id=\"1\" parent=\"0\"/>" +
		"<object id=\"btn\" label=\"" + label + "\" hmiLinks='" + attr(links) + "'>" +
		'<mxCell style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">' +
		'<mxGeometry x="20" y="20" width="120" height="40" as="geometry"/></mxCell></object>' +
		'</root></mxGraphModel></diagram></mxfile>';
}

// A host page with draw.io's viewer (viewer.min.js, or the self-contained
// viewer-static.min.js used by the Grafana panel) and the HMI runtime
function hostPage(viewer)
{
	return '<!DOCTYPE html><html><head><meta charset="utf-8"><script>' +
		'var urlParams = {};' +
		"window.SHAPES_PATH = '/shapes'; window.STENCIL_PATH = '/stencils'; window.STYLE_PATH = '/styles';" +
		"window.IMAGE_PATH = '/images'; window.GRAPH_IMAGE_PATH = '/img'; window.mxImageBasePath = '/mxgraph/images';" +
		"window.mxBasePath = '/mxgraph/'; window.DRAW_MATH_URL = '/math4/es5';" +
		'function loadScript(src, onload) { var s = document.createElement("script"); s.src = src; s.onload = onload;' +
		' document.head.appendChild(s); }' +
		'window.onDrawioViewerLoad = function() {' +
		' loadScript("/plugins/draw.hmi/hmi-runtime.js", function() { window.hmiReady = true; });' +
		' };' +
		'loadScript("/js/' + viewer + '");' +
		'</script></head><body>' +
		'<input id="other" style="display:block">' +
		'<div id="a" style="width:300px;height:120px;border:1px solid #ccc"></div>' +
		'<div id="b" style="width:300px;height:120px;border:1px solid #ccc"></div>' +
		'</body></html>';
}

test.before(async function()
{
	util.addPage('/__test/host-viewer.html', hostPage('viewer.min.js'));
	util.addPage('/__test/host-static.html', hostPage('viewer-static.min.js'));
	util.addPage('/__test/embed-host.html', '<!DOCTYPE html><html><body style="margin:0">' +
		'<iframe id="editor" style="width:1300px;height:800px;border:0" src="/index.html?embed=1&proto=json' +
		'&p=hmi&spin=1&' + util.APP_PARAMS + '"></iframe><script>' +
		'window.received = [];' +
		'window.addEventListener("message", function(evt) {' +
		' var frame = document.getElementById("editor").contentWindow;' +
		' if (evt.source !== frame) return;' +
		' var msg = JSON.parse(evt.data); window.received.push(msg);' +
		' if (msg.event == "init") {' +
		'  frame.postMessage(JSON.stringify({action: "load", xml: window.hostXml, autosave: 1}), location.origin);' +
		' }' +
		' else if (msg.event == "hmiReady") {' +
		'  frame.postMessage(JSON.stringify({action: "hmiSetHostTags", tags: [{name: "Grafana.Temp",' +
		'   type: "number", unit: "C"}, {name: "Grafana.Run", type: "boolean"}]}), location.origin);' +
		' }' +
		'});</script></body></html>');
	web = await util.startStatic(0);
	browser = await util.launch();
});

test.after(async function()
{
	await browser.close();
	web.server.close();
});

async function viewers(page)
{
	var name = page;
	page = await browser.newPage({viewport: {width: 800, height: 600}});
	page.hmiErrors = [];
	page.on('pageerror', function(e)
	{
		page.hmiErrors.push(e.message + (process.env.HMI_STACK ? e.stack : ""));
	});

	try
	{
		await page.goto(web.url + '/__test/host-' + name + '.html');
		await page.waitForFunction(function()
		{
			return window.hmiReady === true;
		}, null, {timeout: 60000});

		// Two viewers in one page, key equivalents scoped to their container
		await page.evaluate(function(xmls)
		{
			window.va = new GraphViewer(document.getElementById('a'), mxUtils.parseXml(xmls[0]).documentElement,
				{highlight: 'none', resize: false, center: false, lightbox: false,
					hmi: {interactive: true, keyScope: 'container'}});
			window.vb = new GraphViewer(document.getElementById('b'), mxUtils.parseXml(xmls[1]).documentElement,
				{highlight: 'none', resize: false, center: false, lightbox: false,
					hmi: {interactive: true, keyScope: 'container'}});
		}, [diagram('A'), diagram('B')]);
		await page.waitForFunction(function()
		{
			return va.hmi != null && vb.hmi != null && va.hmi.isRunning() && vb.hmi.isRunning();
		}, null, {timeout: 10000});
		var count = function()
		{
			return page.evaluate(function()
			{
				return [va.hmi.getValue('Count'), vb.hmi.getValue('Count')];
			});
		};

		// Focus outside both viewers: F2 does nothing
		await page.focus('#other');
		await page.keyboard.press('F2');
		await page.waitForTimeout(300);
		assert.deepStrictEqual(await count(), [0, 0]);

		// Focus in A: only A acts
		assert.strictEqual(await page.evaluate(function()
		{
			return va.graph.container.getAttribute('tabindex');
		}), '0');
		await page.evaluate(function()
		{
			va.graph.container.focus();
		});
		await page.keyboard.press('F2');
		await page.waitForFunction(function()
		{
			return va.hmi.getValue('Count') == 1;
		}, null, {timeout: 5000});
		assert.deepStrictEqual(await count(), [1, 0]);

		// Clicking the button in B gives B the focus and the click
		var box = await page.evaluate(function()
		{
			var s = vb.graph.view.getState(vb.graph.model.getCell('btn'));
			var r = s.shape.node.getBoundingClientRect();

			return {x: r.left + r.width / 2, y: r.top + r.height / 2};
		});
		await page.mouse.click(box.x, box.y);
		await page.waitForFunction(function()
		{
			return vb.hmi.getValue('Count') == 1;
		}, null, {timeout: 5000});

		// Detach A: B keeps running, A is gone from the instances
		var after = await page.evaluate(async function()
		{
			var before = Hmi.Viewer.instances.length;
			var api = va.hmi;
			Hmi.Viewer.detach(va);
			var running = api.isRunning();
			var after = Hmi.Viewer.instances.length;

			// Size callbacks the viewer had queued run harmlessly
			await new Promise(function(r)
			{
				setTimeout(r, 500);
			});

			return {before: before, after: after, running: running,
				graph: va.graph == null || va.graph.detached === true, html: document.getElementById('a').innerHTML,
				b: vb.hmi.isRunning()};
		});
		assert.strictEqual(after.after, after.before - 1);
		assert.strictEqual(after.running, false);
		assert.strictEqual(after.graph, true);
		assert.strictEqual(after.html, '');
		assert.strictEqual(after.b, true);
		assert.deepStrictEqual(page.hmiErrors, [], 'after detaching A');

		// Detaching twice and detaching before the deferred attach are safe
		await page.evaluate(function(xml)
		{
			Hmi.Viewer.detach(va);
			var vc = new GraphViewer(document.getElementById('a'), mxUtils.parseXml(xml).documentElement,
				{highlight: 'none', resize: false, center: false, lightbox: false, hmi: {keyScope: 'container'}});
			Hmi.Viewer.detach(vc);
			window.vc = vc;
		}, diagram('C'));
		await page.waitForTimeout(600);
		assert.strictEqual(await page.evaluate(function()
		{
			return vc.hmi == null && Hmi.Viewer.instances.length == 1;
		}), true);
		assert.deepStrictEqual(page.hmiErrors, []);
	}
	finally
	{
		await page.close();
	}
}

test('viewers in a host page: key scope and detach (viewer.min.js)', async function()
{
	await viewers('viewer');
});

test('viewers in a host page: key scope and detach (viewer-static.min.js)', async function()
{
	await viewers('static');
});

test('editor in an iframe: load, host tags and autosave', async function()
{
	var page = await browser.newPage({viewport: {width: 1300, height: 800}});
	page.hmiErrors = [];
	page.on('pageerror', function(e)
	{
		page.hmiErrors.push(e.message + (process.env.HMI_STACK ? e.stack : ""));
	});

	try
	{
		await page.addInitScript(function(xml)
		{
			window.hostXml = xml;
		}, diagram('Edit me'));
		await page.goto(web.url + '/__test/embed-host.html');
		var frame = page.frames().find(function(f)
		{
			return f.url().indexOf('/index.html') >= 0;
		});
		await frame.waitForFunction(function()
		{
			return window.Hmi != null && Hmi.ui != null && Hmi.ui.hmiHostTags != null &&
				Hmi.ui.editor.graph.model.getCell('btn') != null;
		}, null, {timeout: 60000});

		// The host tags are offered next to the catalogue, not saved
		var known = await frame.evaluate(function()
		{
			return Hmi.Editors.getKnownTags(Hmi.ui);
		});
		assert.ok(known.indexOf('Grafana.Temp') >= 0 && known.indexOf('Grafana.Run') >= 0 &&
			known.indexOf('Count') >= 0, JSON.stringify(known));

		// A change is autosaved to the host, without the host tags
		await frame.evaluate(function()
		{
			var graph = Hmi.ui.editor.graph;
			graph.insertVertex(graph.getDefaultParent(), 'added', 'Added', 200, 20, 80, 40);
		});
		await page.waitForFunction(function()
		{
			return window.received.some(function(m)
			{
				return m.event == 'autosave' && m.xml != null;
			});
		}, null, {timeout: 10000});
		var saved = await page.evaluate(function()
		{
			var m = window.received.filter(function(m)
			{
				return m.event == 'autosave';
			}).pop();

			return m.xml;
		});
		assert.ok(saved.indexOf('<mxfile') == 0 || saved.indexOf('<mxGraphModel') == 0, saved.substring(0, 80));
		assert.strictEqual(saved.indexOf('Grafana.Temp'), -1);
		assert.ok(await page.evaluate(function()
		{
			return window.received.some(function(m)
			{
				return m.event == 'hmiReady';
			}) && !window.received.some(function(m)
			{
				return m.error != null;
			});
		}), 'hmiReady, no unknown messages');
		assert.deepStrictEqual(page.hmiErrors, []);
	}
	finally
	{
		await page.close();
	}
});
