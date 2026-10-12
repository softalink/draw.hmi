// Module order of the two bundles (paths relative to src/). Modules define
// globals (Hmi.*) and are concatenated in this order.

export const CORE = [
  'core/HmiExpr.js',
  'core/HmiFormat.js',
  'core/HmiCondition.js',
  'core/HmiTransform.js',
  'core/HmiTagStore.js',
  'core/HmiSimulator.js',
  'core/HmiSchema.js',
  'core/HmiLinks.js',
  'core/HmiQuickScript.js',
];

export const SOURCES = [
  'sources/HmiPayload.js',
  'sources/HmiSourceManager.js',
  'sources/HmiMqttSource.js',
  'sources/HmiWsSource.js',
  'sources/HmiHttpSource.js',
  'sources/HmiSseSource.js',
  'sources/HmiHostSource.js',
];

export const RUNTIME = [
  'runtime/HmiScriptHost.js',
  'runtime/HmiModel.js',
  'runtime/HmiOverlay.js',
  'runtime/HmiLevelFill.js',
  'runtime/HmiFlow.js',
  'runtime/HmiBindingEngine.js',
  'runtime/HmiWriter.js',
  'runtime/HmiAlarms.js',
  'runtime/HmiTriggerEngine.js',
  'runtime/HmiActions.js',
  'runtime/HmiAnimator.js',
  'runtime/HmiEventDispatcher.js',
  'runtime/HmiSystem.js',
  'runtime/HmiDomWidgets.js',
  'runtime/HmiHalo.js',
  'runtime/HmiKeypad.js',
  'runtime/HmiAlarmMarkers.js',
  'runtime/HmiLinkEngine.js',
  'runtime/HmiRuntime.js',
  'runtime/HmiEmbed.js',
];

// Editor UI, in load order; the runtime bundle takes only RUNTIME_UI
export const UI = [
  'ui/HmiResources.js',
  'ui/HmiEditors.js',
  'ui/HmiHelpTexts.js',
  'ui/HmiHelpTextsScreen.js',
  'ui/HmiHelp.js',
  'ui/HmiSourcesDialog.js',
  'ui/HmiTagsDialog.js',
  'ui/HmiTagBrowser.js',
  'ui/HmiDiagnostics.js',
  'ui/HmiFormatPanel.js',
  'ui/HmiRunChrome.js',
  'ui/HmiValidator.js',
  'ui/HmiFaceplate.js',
  'ui/HmiImport.js',
  'ui/HmiLinksDialog.js',
  'ui/HmiSubstituteTags.js',
  'ui/HmiHaloDialog.js',
  'ui/HmiScreenSettings.js',
  'ui/HmiPlugin.js',
];

export const RUNTIME_UI = ['ui/HmiResources.js', 'ui/HmiDiagnostics.js', 'ui/HmiRunChrome.js', 'ui/HmiFaceplate.js'];

export const SHAPES = ['shapes/mxHmiWidgets.js', 'shapes/mxHmiTable.js', 'shapes/mxHmiCharts.js', 'shapes/mxHmiEquipment.js'];

/** The editor plugin (hmi-plugin.js). */
export const PLUGIN = [
  'entry/prefix.js',
  ...CORE,
  ...SOURCES,
  ...RUNTIME,
  ...UI,
  ...SHAPES,
  'sidebar/Sidebar-HMI.js',
  'compat/HmiCompat.js',
  'entry/plugin.js',
];

/** The runtime for draw.io's viewer (hmi-runtime.js). */
export const VIEWER = [
  'entry/prefix.js',
  ...CORE,
  ...SOURCES,
  ...RUNTIME,
  ...RUNTIME_UI,
  ...SHAPES,
  'compat/HmiCompat.js',
  'viewer/HmiViewer.js',
  'entry/runtime.js',
];
