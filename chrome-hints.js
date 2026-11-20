// Session preload (see setupClientHints in main.js), run in every frame of
// the session: in the http(s) pages it makes the page side of the Client
// Hints match those of Chrome, as the Sec-CH-UA headers do. Otherwise
// Google refuses the sign-in as an "embedded browser": in Electron
// navigator.userAgentData lists Chromium without "Google Chrome" and
// window.chrome is empty (Chrome has app, csi and loadTimes).
// The code runs in the page's world before its scripts; the replaced
// functions read as native code, as in Chrome.
const { contextBridge } = require('electron');

if (/^https?:$/.test(location.protocol)) {
  contextBridge.executeInMainWorld({
    func: () => {
      // Functions defined here read as native code (Function.prototype.toString).
      const natives = new WeakMap();
      const toString = Function.prototype.toString;
      Function.prototype.toString = new Proxy(toString, {
        apply: (target, self, args) => (natives.has(self) ? `function ${natives.get(self)}() { [native code] }` : Reflect.apply(target, self, args)),
      });
      natives.set(Function.prototype.toString, 'toString');
      const native = (name, fn) => { natives.set(fn, name); return fn; };

      // "Google Chrome" next to "Chromium", with its version: brands
      // (version = major) and fullVersionList (full version). Same order as
      // the Sec-CH-UA header: Google Chrome, Chromium, the GREASE brand.
      const withChrome = (list) => {
        if (!Array.isArray(list) || list.some((b) => b.brand === 'Google Chrome')) return list;
        const chromium = list.find((b) => b.brand === 'Chromium');
        if (!chromium) return list;
        return [{ brand: 'Google Chrome', version: chromium.version }, chromium, ...list.filter((b) => b !== chromium)];
      };
      const proto = window.NavigatorUAData?.prototype;
      if (proto) {
        const brands = Object.getOwnPropertyDescriptor(proto, 'brands');
        if (brands?.get) {
          Object.defineProperty(proto, 'brands', {
            ...brands,
            get: native('get brands', new Proxy(brands.get, { apply: (target, self, args) => Object.freeze(withChrome(Reflect.apply(target, self, args))) })),
          });
        }
        const toJSON = proto.toJSON;
        if (toJSON) {
          proto.toJSON = native('toJSON', new Proxy(toJSON, {
            apply: (target, self, args) => {
              const v = Reflect.apply(target, self, args);
              return v && { ...v, brands: withChrome(v.brands) };
            },
          }));
        }
        const high = proto.getHighEntropyValues;
        if (high) {
          proto.getHighEntropyValues = native('getHighEntropyValues', new Proxy(high, {
            apply: (target, self, args) => Reflect.apply(target, self, args).then((v) => {
              if (v?.brands) v.brands = withChrome(v.brands);
              if (v?.fullVersionList) v.fullVersionList = withChrome(v.fullVersionList);
              return v;
            }),
          }));
        }
      }

      // window.chrome as in Chrome (in Electron it is an empty object).
      const chrome = window.chrome ?? (window.chrome = {});
      if (!chrome.app) {
        const InstallState = { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' };
        const RunningState = { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' };
        chrome.app = {
          isInstalled: false,
          InstallState,
          RunningState,
          getDetails: native('getDetails', function () { return null; }),
          getIsInstalled: native('getIsInstalled', function () { return false; }),
          installState: native('installState', function (callback) { if (typeof callback === 'function') setTimeout(() => callback(InstallState.NOT_INSTALLED)); }),
          runningState: native('runningState', function () { return RunningState.CANNOT_RUN; }),
        };
      }
      if (!chrome.csi) {
        const start = performance.timeOrigin;
        chrome.csi = native('csi', function () {
          return { startE: Math.round(start), onloadT: Math.round(start + (performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart)), pageT: performance.now(), tran: 15 };
        });
      }
      if (!chrome.loadTimes) {
        chrome.loadTimes = native('loadTimes', function () {
          const t = performance.timing;
          const nav = performance.getEntriesByType('navigation')[0];
          const protocol = nav?.nextHopProtocol ?? 'http/1.1';
          return {
            requestTime: t.navigationStart / 1000,
            startLoadTime: t.navigationStart / 1000,
            commitLoadTime: t.responseStart / 1000,
            finishDocumentLoadTime: t.domContentLoadedEventEnd / 1000,
            finishLoadTime: t.loadEventEnd / 1000,
            firstPaintTime: (performance.getEntriesByType('paint')[0]?.startTime ?? 0) / 1000 + t.navigationStart / 1000,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasFetchedViaSpdy: ['h2', 'h3'].includes(protocol),
            wasNpnNegotiated: ['h2', 'h3'].includes(protocol),
            npnNegotiatedProtocol: ['h2', 'h3'].includes(protocol) ? protocol : 'unknown',
            wasAlternateProtocolAvailable: false,
            connectionInfo: protocol,
          };
        });
      }
    },
  });
}
