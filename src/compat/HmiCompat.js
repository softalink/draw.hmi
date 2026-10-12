/**
 * Hmi.Compat: connects the HMI plugin to an unmodified draw.io.
 *
 * The plugin used to live in a fork of draw.io with 23 edits ("hooks") in
 * the draw.io core. Each hook is replaced here by a wrapper around the
 * draw.io method, installed when the plugin or the runtime bundle loads.
 * A wrapper whose target is missing in a draw.io release is skipped with a
 * warning (Hmi.Compat.report), so only that feature is lost.
 *
 * test/contract checks every target against the pinned draw.io release.
 */
(function()
{
	var root = (typeof globalThis !== 'undefined') ? globalThis : window;
	var Hmi = root.Hmi = root.Hmi || {};

	var Compat = {};

	/**
	 * [{name, ok, reason}] for every patch that was attempted.
	 */
	Compat.report = [];

	function patch(name, check, fn)
	{
		for (var i = 0; i < Compat.report.length; i++)
		{
			if (Compat.report[i].name == name && Compat.report[i].ok)
			{
				return true;
			}
		}

		var reason = null;

		try
		{
			reason = check();

			if (reason == null)
			{
				fn();
			}
		}
		catch (e)
		{
			reason = e.message;
		}

		Compat.report.push({name: name, ok: reason == null, reason: reason});

		if (reason != null && root.console != null)
		{
			console.warn('HMI: ' + name + ' is not available with this draw.io version (' + reason + ')');
		}

		return reason == null;
	};

	function requireFn(owner, ownerName, prop)
	{
		if (typeof owner === 'undefined' || owner == null)
		{
			return ownerName + ' is missing';
		}

		return (typeof owner[prop] === 'function') ? null : ownerName + '.' + prop + ' is missing';
	};

	/**
	 * Names of the patches, with the draw.io method each one wraps. Used by
	 * the contract test.
	 */
	Compat.TARGETS = {
		label: 'Graph.prototype.getLabel',
		placeholders: 'Graph.prototype.replacePlaceholders',
		cellStyle: 'Graph.prototype.postProcessCellStyle',
		flowAnimation: 'Graph.prototype.addFlowAnimationToNode',
		levelFill: 'mxShape.prototype.paint',
		customActions: 'Graph.prototype.executeCustomActions',
		viewerSize: 'GraphViewer.prototype.addSizeHandler',
		sidebarEntries: 'Sidebar.prototype.updateEntries',
		sidebarConfiguration: 'Sidebar.prototype.configuration',
		templates: 'EditorUi.customTemplates'
	};

	//======================================================================
	// Rendering: labels, placeholders, styles (Graph.js, Editor.js hooks)
	//======================================================================

	/**
	 * Runtime labels (Hmi.Overlay.getLabel) win over the cell's value.
	 */
	function installLabel()
	{
		patch('label', function()
		{
			return requireFn(root.Graph && Graph.prototype, 'Graph.prototype', 'getLabel');
		}, function()
		{
			var getLabel = Graph.prototype.getLabel;

			Graph.prototype.getLabel = function(cell)
			{
				if (this.hmiOverlay != null)
				{
					var label = this.hmiOverlay.getLabel(cell);

					if (label != null)
					{
						return label;
					}
				}

				return getLabel.apply(this, arguments);
			};
		});
	};

	/**
	 * Resolves %tag:Name|fmt% and runtime attribute overrides before draw.io
	 * replaces the remaining placeholders. Escaped placeholders (%%name%)
	 * are left to draw.io.
	 */
	function installPlaceholders()
	{
		patch('placeholders', function()
		{
			return requireFn(root.Graph && Graph.prototype, 'Graph.prototype', 'replacePlaceholders');
		}, function()
		{
			var replacePlaceholders = Graph.prototype.replacePlaceholders;

			Graph.prototype.replacePlaceholders = function(cell, str, vars, translate)
			{
				if (this.hmiOverlay != null && str != null && typeof str === 'string' && str.indexOf('%') >= 0)
				{
					str = Compat.resolvePlaceholders(this, cell, str);
				}

				return replacePlaceholders.call(this, cell, str, vars, translate);
			};
		});
	};

	Compat.resolvePlaceholders = function(graph, cell, str)
	{
		var pattern = new RegExp(graph.placeholderPattern != null ? graph.placeholderPattern.source :
			'%(date\\{.*\\}|[^%\\{\\}"\'=;]+)%', 'g');
		var result = [];
		var last = 0;
		var match = null;

		while ((match = pattern.exec(str)) != null)
		{
			var val = match[0];

			if (val.length > 2 && val != '%label%' && val != '%tooltip%' &&
				!(match.index > last && str.charAt(match.index - 1) == '%'))
			{
				var tmp = graph.hmiOverlay.resolvePlaceholder(cell, val.substring(1, val.length - 1));

				if (tmp != null)
				{
					result.push(str.substring(last, match.index));
					result.push(String(tmp));
					last = match.index + val.length;
				}
			}
		}

		result.push(str.substring(last));

		return result.join('');
	};

	/**
	 * Merges the runtime's transient style values (Hmi.Overlay.applyStyle)
	 * after draw.io's own processing.
	 */
	function installCellStyle()
	{
		patch('cellStyle', function()
		{
			return requireFn(root.Graph && Graph.prototype, 'Graph.prototype', 'postProcessCellStyle');
		}, function()
		{
			var postProcessCellStyle = Graph.prototype.postProcessCellStyle;

			Graph.prototype.postProcessCellStyle = function(cell, style)
			{
				style = postProcessCellStyle.apply(this, arguments);

				if (this.hmiOverlay != null && style != null)
				{
					style = this.hmiOverlay.applyStyle(cell, style);
				}

				return style;
			};
		});
	};

	//======================================================================
	// Flow animation types and level fill (Graph.js hooks)
	//======================================================================

	/**
	 * Flow types other than draw.io's dashes (Graph.flowAnimationRenderers,
	 * see runtime/HmiFlow.js) and flowAnimationReverse=1.
	 */
	function installFlowAnimation()
	{
		patch('flowAnimation', function()
		{
			return requireFn(root.Graph && Graph.prototype, 'Graph.prototype', 'addFlowAnimationToNode');
		}, function()
		{
			var addFlowAnimationToNode = Graph.prototype.addFlowAnimationToNode;

			Graph.prototype.addFlowAnimationToNode = function(node, style, scale, id)
			{
				if (node != null && id != null && style != null)
				{
					if (Graph.flowAnimationRenderers != null)
					{
						var renderer = Graph.flowAnimationRenderers[
							mxUtils.getValue(style, 'flowAnimationType', 'dash')];

						if (renderer != null && renderer.call(this, node, style, scale, id) !== false)
						{
							return;
						}
					}

					if (mxUtils.getValue(style, 'flowAnimationReverse', '0') == '1')
					{
						var copy = {};

						for (var key in style)
						{
							copy[key] = style[key];
						}

						copy.flowAnimationDirection = (mxUtils.getValue(style,
							'flowAnimationDirection', 'normal') == 'reverse') ? 'normal' : 'reverse';
						style = copy;
					}
				}

				return addFlowAnimationToNode.call(this, node, style, scale, id);
			};
		});
	};

	/**
	 * Paints the level fill (mxShape.levelFillPainter, runtime/HmiLevelFill.js)
	 * over a shape whose style has hmiLevel.
	 */
	function installLevelFill()
	{
		patch('levelFill', function()
		{
			return requireFn(root.mxShape && mxShape.prototype, 'mxShape.prototype', 'paint');
		}, function()
		{
			var paint = mxShape.prototype.paint;

			mxShape.prototype.paint = function(canvas)
			{
				var count = (mxShape.levelFillPainter != null && canvas != null &&
					canvas.root != null && this.style != null && this.style.hmiLevel != null) ?
					canvas.root.childNodes.length : null;
				var result = paint.apply(this, arguments);

				if (count != null)
				{
					mxShape.levelFillPainter(this, canvas, count);
				}

				return result;
			};
		});
	};

	//======================================================================
	// Custom link actions (Editor.js hook)
	//======================================================================

	/**
	 * {"hmi": {...}} entries of draw.io custom links (data:action/json) run
	 * through Graph.customActionHandler (runtime/HmiActions.js). They are
	 * fire-and-forget, so they run when the action list starts.
	 */
	function installCustomActions()
	{
		patch('customActions', function()
		{
			return requireFn(root.Graph && Graph.prototype, 'Graph.prototype', 'executeCustomActions');
		}, function()
		{
			var executeCustomActions = Graph.prototype.executeCustomActions;

			Graph.prototype.executeCustomActions = function(actions, done, cell)
			{
				if (actions != null && actions.length != null && Graph.customActionHandler != null)
				{
					for (var i = 0; i < actions.length; i++)
					{
						if (actions[i] != null && actions[i].hmi != null)
						{
							try
							{
								Graph.customActionHandler(this, actions[i].hmi, cell);
							}
							catch (e)
							{
								if (root.console != null)
								{
									console.error('HMI action failed', e);
								}
							}
						}
					}
				}

				return executeCustomActions.apply(this, arguments);
			};
		});
	};

	//======================================================================
	// Viewer (GraphViewer.js hook)
	//======================================================================

	/**
	 * Records the ResizeObservers GraphViewer.addSizeHandler creates, so
	 * Hmi.Viewer.detach can disconnect them.
	 */
	function installViewerSize()
	{
		patch('viewerSize', function()
		{
			return requireFn(root.GraphViewer && GraphViewer.prototype, 'GraphViewer.prototype', 'addSizeHandler');
		}, function()
		{
			var addSizeHandler = GraphViewer.prototype.addSizeHandler;

			GraphViewer.prototype.addSizeHandler = function()
			{
				var viewer = this;
				var RO = root.ResizeObserver;
				var observers = viewer.hmiResizeObservers = viewer.hmiResizeObservers || [];

				if (typeof RO === 'function')
				{
					root.ResizeObserver = function(callback)
					{
						var observer = new RO(callback);
						observers.push(observer);

						return observer;
					};
				}

				try
				{
					return addSizeHandler.apply(this, arguments);
				}
				finally
				{
					if (typeof RO === 'function')
					{
						root.ResizeObserver = RO;
					}
				}
			};
		});
	};

	/**
	 * Installs the patches of the runtime (editor and viewer).
	 */
	Compat.install = function()
	{
		installLabel();
		installPlaceholders();
		installCellStyle();
		installFlowAnimation();
		installLevelFill();
		installCustomActions();

		if (typeof GraphViewer !== 'undefined')
		{
			installViewerSize();
		}

		// Shapes are part of the bundles; the empty library keeps draw.io
		// from looking for a stencil file for mxgraph.hmi.* names
		if (typeof mxStencilRegistry !== 'undefined' && mxStencilRegistry.libraries != null &&
			mxStencilRegistry.libraries['hmi'] == null)
		{
			mxStencilRegistry.libraries['hmi'] = [];
		}
	};

	//======================================================================
	// Editor: sidebar, templates (Sidebar.js, templates/index.xml)
	//======================================================================

	var SIDEBAR_CONFIG = {id: 'hmi', prefix: 'hmi', libs: ['Displays', 'Controls', 'Charts', 'Equipment', 'Pipes']};

	Compat.TEMPLATES = [
		{file: 'water_treatment', name: 'Water Treatment Plant', tags: 'Hmi;Scada;Water;Treatment;Plant;Process;Pump;Tank'},
		{file: 'tank_farm', name: 'Tank Farm', tags: 'Hmi;Scada;Tank;Farm;Storage;Level;Valve;Alarm'},
		{file: 'motor_control_center', name: 'Motor Control Center', tags: 'Hmi;Scada;Motor;Control;Center;Mcc;Starter;Faceplate'},
		{file: 'building_hvac', name: 'Building HVAC', tags: 'Hmi;Scada;Building;Hvac;Ahu;Isa101;Fan;Damper'},
		{file: 'intouch_links_demo', name: 'InTouch Animation Links', tags: 'Hmi;Scada;Intouch;Animation;Links;Touch;Blink;Window'}
	];

	/**
	 * Path of `to` relative to the directory `fromDir` (both resolved
	 * against the page).
	 */
	Compat.relativePath = function(fromDir, to)
	{
		var a = new URL(fromDir.replace(/\/?$/, '/'), root.location.href);
		var b = new URL(to, root.location.href);

		if (a.origin != b.origin)
		{
			return b.href;
		}

		var from = a.pathname.split('/').slice(0, -1);
		var target = b.pathname.split('/');
		var i = 0;

		while (i < from.length && i < target.length - 1 && from[i] == target[i])
		{
			i++;
		}

		var up = [];

		for (var j = i; j < from.length; j++)
		{
			up.push('..');
		}

		return up.concat(target.slice(i)).join('/') + b.search;
	};

	function installSidebar(ui)
	{
		patch('sidebarConfiguration', function()
		{
			return (root.Sidebar != null && Sidebar.prototype.configuration != null &&
				Sidebar.prototype.configuration.push != null) ? null : 'Sidebar.prototype.configuration is missing';
		}, function()
		{
			var config = Sidebar.prototype.configuration;

			for (var i = 0; i < config.length; i++)
			{
				if (config[i] != null && config[i].id == 'hmi')
				{
					return;
				}
			}

			config.push(SIDEBAR_CONFIG);
		});

		patch('sidebarEntries', function()
		{
			return requireFn(root.Sidebar && Sidebar.prototype, 'Sidebar.prototype', 'updateEntries');
		}, function()
		{
			var updateEntries = Sidebar.prototype.updateEntries;

			Sidebar.prototype.updateEntries = function()
			{
				var result = updateEntries.apply(this, arguments);
				Compat.addSidebarEntry(this.entries);

				return result;
			};

			if (ui.sidebar != null && ui.sidebar.entries != null)
			{
				Compat.addSidebarEntry(ui.sidebar.entries);
			}
		});

		if (ui.sidebar != null && typeof ui.sidebar.addHmiPalette === 'function')
		{
			ui.sidebar.addHmiPalette();

			// Hides the palettes again unless the HMI library is enabled
			if (typeof ui.sidebar.showEntries === 'function')
			{
				ui.sidebar.showEntries();
			}
		}
	};

	/**
	 * Adds HMI / SCADA to the "Other" group of the More Shapes dialog (the
	 * group with Process Engineering), or to the last group.
	 */
	Compat.addSidebarEntry = function(entries)
	{
		if (entries == null || entries.length == 0)
		{
			return;
		}

		var group = entries[entries.length - 1];

		for (var i = 0; i < entries.length; i++)
		{
			var list = entries[i].entries || [];

			for (var j = 0; j < list.length; j++)
			{
				if (list[j].id == 'hmi')
				{
					return;
				}

				if (list[j].id == 'pid')
				{
					group = entries[i];
				}
			}
		}

		if (group.entries != null)
		{
			var entry = {title: 'HMI / SCADA', id: 'hmi', image: Hmi.basePath + 'images/sidebar-hmi.png'};
			var index = group.entries.length;

			for (var k = 0; k < group.entries.length; k++)
			{
				if (group.entries[k].id == 'pid')
				{
					index = k + 1;
				}
			}

			group.entries.splice(index, 0, entry);
		}
	};

	function installTemplates()
	{
		patch('templates', function()
		{
			return (root.EditorUi != null && typeof TEMPLATE_PATH !== 'undefined') ? null :
				'EditorUi or TEMPLATE_PATH is missing';
		}, function()
		{
			if (!Array.isArray(EditorUi.customTemplates))
			{
				EditorUi.customTemplates = [];
			}

			for (var i = 0; i < Compat.TEMPLATES.length; i++)
			{
				var t = Compat.TEMPLATES[i];
				var xml = Hmi.basePath + 'templates/' + t.file + '.xml';
				var exists = false;

				for (var j = 0; j < EditorUi.customTemplates.length; j++)
				{
					var c = EditorUi.customTemplates[j];

					if (c != null && c.section == 'hmi' && c.title == t.name)
					{
						exists = true;
					}
				}

				if (!exists)
				{
					EditorUi.customTemplates.push({section: 'hmi', title: t.name, name: t.name, tags: t.tags,
						url: Compat.relativePath(TEMPLATE_PATH, xml),
						preview: new URL(Hmi.basePath + 'templates/' + t.file + '.png', root.location.href).href});
				}
			}
		});
	};

	/**
	 * Installs the editor patches for the given EditorUi.
	 */
	Compat.installEditor = function(ui)
	{
		Compat.install();
		installSidebar(ui);
		installTemplates();
	};

	//======================================================================
	// Embed protocol (EditorUi.js hook)
	//======================================================================

	/**
	 * hmi* messages from the embedding page, before draw.io's own handler
	 * (which would answer them with unknownMessage). Messages that arrive
	 * before the plugin is installed are queued.
	 */
	Compat.installMessageListener = function()
	{
		if (Compat.messageListener != null || typeof root.addEventListener !== 'function' ||
			typeof urlParams === 'undefined' || urlParams['embed'] != '1')
		{
			return;
		}

		Compat.messageQueue = [];
		Compat.messageListener = function(evt)
		{
			var data = evt.data;
			var source = evt.source;

			if (source == null || source === root || (source !== root.parent && source !== root.opener &&
				(Compat.ui == null || source !== Compat.ui.embedMessageSource)))
			{
				return;
			}

			if (typeof data === 'string')
			{
				if (data.indexOf('"action"') < 0 || data.indexOf('hmi') < 0)
				{
					return;
				}

				try
				{
					data = JSON.parse(data);
				}
				catch (e)
				{
					return;
				}
			}

			if (data == null || typeof data.action !== 'string' || data.action.substring(0, 3) != 'hmi')
			{
				return;
			}

			evt.stopImmediatePropagation();

			if (Compat.ui != null && Compat.ui.hmi != null)
			{
				Compat.ui.hmi.handleMessage(data);
			}
			else
			{
				Compat.messageQueue.push(data);
			}
		};

		root.addEventListener('message', Compat.messageListener, true);
	};

	/**
	 * Called when the plugin is installed: handles the queued messages.
	 */
	Compat.setEmbedUi = function(ui)
	{
		Compat.ui = ui;
		var queue = Compat.messageQueue || [];
		Compat.messageQueue = [];

		for (var i = 0; i < queue.length; i++)
		{
			if (ui.hmi != null)
			{
				ui.hmi.handleMessage(queue[i]);
			}
		}
	};

	Hmi.Compat = Compat;
})();
