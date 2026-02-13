// electron/login-preload.js
// Stealth preload for OAuth login windows.
// Runs BEFORE any page JavaScript in the page's own context
// (contextIsolation is false on login windows).

(() => {
  // 1. navigator.plugins — Chrome has PDF plugins, Electron has none
  try {
    const pluginData = [
      { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
      { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: '', length: 1 },
      { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: '', length: 1 },
      { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: '', length: 1 },
      { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: '', length: 1 },
    ];
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const arr = pluginData.map(p => {
          const plugin = Object.create(Plugin.prototype);
          for (const [k, v] of Object.entries(p)) {
            Object.defineProperty(plugin, k, { value: v, enumerable: true });
          }
          return plugin;
        });
        const plugins = Object.create(PluginArray.prototype);
        arr.forEach((p, i) => { plugins[i] = p; });
        Object.defineProperty(plugins, 'length', { value: arr.length });
        plugins.item = (i) => plugins[i] || null;
        plugins.namedItem = (name) => arr.find(p => p.name === name) || null;
        plugins.refresh = () => {};
        return plugins;
      },
    });
  } catch (e) {}

  // 2. navigator.webdriver — must be undefined, not false
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  } catch (e) {}

  // 3. window.chrome — must exist with specific sub-properties
  try {
    if (!window.chrome) window.chrome = {};
    window.chrome.runtime = window.chrome.runtime || {
      connect: () => {},
      sendMessage: () => {},
    };
    window.chrome.loadTimes = function() {
      return {
        commitLoadTime: performance.timing.responseStart / 1000,
        connectionInfo: 'h2',
        finishDocumentLoadTime: performance.timing.domContentLoadedEventEnd / 1000,
        finishLoadTime: performance.timing.loadEventEnd / 1000,
        firstPaintAfterLoadTime: 0,
        firstPaintTime: performance.timing.domContentLoadedEventStart / 1000,
        navigationType: 'Other',
        npnNegotiatedProtocol: 'h2',
        requestTime: performance.timing.requestStart / 1000,
        startLoadTime: performance.timing.navigationStart / 1000,
        wasAlternateProtocolAvailable: false,
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true,
      };
    };
    window.chrome.csi = function() {
      return {
        onloadT: performance.timing.domContentLoadedEventEnd,
        pageT: (Date.now() - performance.timing.navigationStart) / 1000,
        startE: performance.timing.navigationStart,
        tran: 15,
      };
    };
  } catch (e) {}

  // 4. navigator.languages — must not be empty
  try {
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  } catch (e) {}

  // 5. navigator.connection — missing in Electron
  try {
    if (!navigator.connection) {
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false,
          onchange: null,
        }),
      });
    }
  } catch (e) {}

  // 6. navigator.userAgentData — Client Hints JS API (mirrors HTTP headers)
  try {
    Object.defineProperty(navigator, 'userAgentData', {
      get: () => ({
        brands: [
          { brand: 'Google Chrome', version: '131' },
          { brand: 'Chromium', version: '131' },
          { brand: 'Not_A Brand', version: '24' },
        ],
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: () => Promise.resolve({
          brands: [
            { brand: 'Google Chrome', version: '131' },
            { brand: 'Chromium', version: '131' },
            { brand: 'Not_A Brand', version: '24' },
          ],
          mobile: false,
          platform: 'Windows',
          platformVersion: '15.0.0',
          architecture: 'x86',
          bitness: '64',
          model: '',
          uaFullVersion: '131.0.6778.86',
          fullVersionList: [
            { brand: 'Google Chrome', version: '131.0.6778.86' },
            { brand: 'Chromium', version: '131.0.6778.86' },
            { brand: 'Not_A Brand', version: '24.0.0.0' },
          ],
        }),
        toJSON: () => ({
          brands: [
            { brand: 'Google Chrome', version: '131' },
            { brand: 'Chromium', version: '131' },
            { brand: 'Not_A Brand', version: '24' },
          ],
          mobile: false,
          platform: 'Windows',
        }),
      }),
    });
  } catch (e) {}

  // 7. Remove Electron globals
  try {
    delete window.process;
    delete window.require;
    delete window.module;
    delete window.exports;
    delete window.__dirname;
    delete window.__filename;
    delete window.Buffer;
    delete window.global;
  } catch (e) {}

  // 8. Hardware fingerprints
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  } catch (e) {}

  // 9. Permissions API — Electron returns differently
  try {
    const origQuery = navigator.permissions && navigator.permissions.query && navigator.permissions.query.bind(navigator.permissions);
    if (origQuery) {
      navigator.permissions.query = (params) => {
        if (params.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission, onchange: null });
        }
        return origQuery(params).catch(() => ({ state: 'prompt', onchange: null }));
      };
    }
  } catch (e) {}

  // 10. WebGL spoofing
  try {
    if (typeof WebGLRenderingContext !== 'undefined') {
      const getParam = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(p) {
        if (p === 37445) return 'Google Inc. (NVIDIA)';
        if (p === 37446) return 'ANGLE (NVIDIA GeForce GTX 1660 Ti)';
        return getParam.call(this, p);
      };
    }
  } catch (e) {}

  // 11. Make patched functions look native (prevents toString detection)
  try {
    const origToString = Function.prototype.toString;
    const nativeFns = new Set([
      navigator.permissions && navigator.permissions.query,
      window.chrome && window.chrome.loadTimes,
      window.chrome && window.chrome.csi,
    ].filter(Boolean));

    Function.prototype.toString = function() {
      if (nativeFns.has(this)) {
        return 'function ' + (this.name || '') + '() { [native code] }';
      }
      return origToString.call(this);
    };
  } catch (e) {}

  console.log('[CHROMADON] Login stealth preload applied');
})();
