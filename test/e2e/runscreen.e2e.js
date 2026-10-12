// Run Screen tests with real mouse clicks: the lightweight runtime page
// (hmi-run.html, viewer core + HMI runtime) and the full-app lightbox mode.
// Run: node --test --test-concurrency=1 test/e2e/runscreen.e2e.js
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var util = require('./util.js');

var browser = null;
var web = null;
var mcc = fs.readFileSync(path.join(__dirname, '../../templates/motor_control_center.xml'), 'utf8');

test.before(async function()
{
	web = await util.startStatic(0);
	browser = await util.launch();
});

test.after(async function()
{
	await browser.close();
	web.server.close();
});

// Opens the Motor Control Center template in the editor and returns the
// Run Screen URL (relative to the server)
async function getRunUrl(fullApp)
{
	var editor = await util.openEditor(browser, web.url);

	var url = await editor.evaluate(async function(args)
	{
		var ui = Hmi.ui;
		ui.fileLoaded(new LocalFile(ui, args.xml, 'mcc.drawio', true));
		await new Promise(function(r)
		{
			setTimeout(r, 500);
		});

		return Hmi.Plugin.getRunUrl(ui, args.fullApp);
	}, {xml: mcc, fullApp: fullApp});
	await editor.close();

	return util.relativeUrl(url);
}

// Returns the screen position of the first cell whose events contain text
function findButton(page, apiExpr, text)
{
	return page.evaluate(function(args)
	{
		var api = eval(args.apiExpr);
		var rt = api.getRuntime();

		for (var id in rt.index.cells)
		{
			var cfg = rt.index.cells[id];

			if (JSON.stringify(cfg.events).indexOf(args.text) >= 0)
			{
				var b = rt.graph.view.getState(cfg.cell).shape.node.getBoundingClientRect();

				return {id: id, x: b.left + b.width / 2, y: b.top + b.height / 2};
			}
		}

		return null;
	}, {apiExpr: apiExpr, text: text});
}

async function runScenario(page, apiExpr, okSelector)
{
	var api = apiExpr;
	var stop = await findButton(page, api, 'Motor1.Cmd","value":false');
	assert.ok(stop != null, 'STOP button found');
	await page.mouse.click(stop.x, stop.y);
	await page.waitForSelector(okSelector, {timeout: 5000});
	await page.click(okSelector);
	await page.waitForFunction(function(apiExpr)
	{
		return eval(apiExpr).getRuntime().tags.getValue('Motor1.Cmd') === false;
	}, api, {timeout: 5000});

	var start = await findButton(page, api, 'Motor1.Cmd","value":true');
	await page.mouse.click(start.x, start.y);
	await page.waitForSelector(okSelector, {timeout: 5000});
	await page.click(okSelector);
	await page.waitForFunction(function(apiExpr)
	{
		return eval(apiExpr).getRuntime().tags.getValue('Motor1.Cmd') === true;
	}, api, {timeout: 5000});

	var detail = await findButton(page, api, '"navigate"');
	await page.mouse.click(detail.x, detail.y);
	await page.waitForFunction(function(apiExpr)
	{
		return eval(apiExpr).getRuntime().ui.currentPage.getName() == 'Motor Detail';
	}, api, {timeout: 5000});
}

async function openRuntime(url)
{
	var page = await browser.newPage({viewport: {width: 1400, height: 900}});
	page.hmiErrors = [];
	page.hmiScripts = [];
	page.on('pageerror', function(e)
	{
		page.hmiErrors.push(e.message);
	});
	page.on('request', function(r)
	{
		if (/\.js(\?|$)/.test(r.url()))
		{
			page.hmiScripts.push(r.url().replace(/^https?:\/\/[^/]+\//, '').split('?')[0]);
		}
	});
	await page.goto(web.url + url);

	return page;
}


test('lightweight runtime: buttons, confirmation and navigation', async function()
{
	var page = await openRuntime(await getRunUrl(false));
	await page.waitForFunction(function()
	{
		return window.Hmi != null && Hmi.Viewer != null && Hmi.Viewer.instances.length > 0 &&
			Hmi.Viewer.instances[0].isRunning();
	}, null, {timeout: 30000});

	// draw.io's own viewer plus the HMI runtime, not the app
	assert.ok(page.url().indexOf('/plugins/draw.hmi/hmi-run.html') >= 0);
	assert.ok(page.hmiScripts.indexOf('js/app.min.js') < 0, 'app not loaded');
	assert.ok(page.hmiScripts.indexOf('js/viewer.min.js') >= 0, 'viewer loaded');
	assert.ok(page.hmiScripts.indexOf('plugins/draw.hmi/hmi-runtime.js') >= 0, 'runtime loaded');
	await page.waitForTimeout(800);
	await runScenario(page, 'Hmi.Viewer.instances[0]', '.geHmiConfirmOk');
	assert.deepStrictEqual(page.hmiErrors, []);
	await page.close();
});

test('full-app runtime (lightbox): buttons, confirmation and navigation', async function()
{
	var page = await openRuntime(await getRunUrl(true));
	await page.waitForFunction(function()
	{
		return window.Hmi != null && Hmi.ui != null && Hmi.ui.hmi != null && Hmi.ui.hmi.isRunning();
	}, null, {timeout: 60000});
	await page.waitForTimeout(800);
	await runScenario(page, 'Hmi.ui.hmi', '.geDialog .gePrimaryBtn');
	assert.deepStrictEqual(page.hmiErrors, []);
	await page.close();
});
