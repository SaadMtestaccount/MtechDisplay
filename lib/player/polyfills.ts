/**
 * lib/player/polyfills.ts — the ES5 polyfill source inlined into <head> by the root layout
 * (docs/CONTRACTS.md §20). Fills the few newer JavaScript features old TV browsers lack (LG webOS,
 * Samsung Tizen, old Android WebViews). Inline on purpose: Next places the layout's <head> after
 * its own async chunks, so an external script could lose the race — an inline script runs during
 * parsing, before any async chunk can execute. Plain ES5 inside the string: it must parse on the
 * very engines it is helping.
 */
export const POLYFILLS_JS = `(function () {
  if (typeof globalThis === 'undefined') {
    try {
      Object.defineProperty(Object.prototype, '__msignGlobalThis__', {
        get: function () { return this },
        configurable: true
      });
      __msignGlobalThis__.globalThis = __msignGlobalThis__;
      delete Object.prototype.__msignGlobalThis__;
    } catch (e) {
      window.globalThis = window;
    }
  }
  var g = globalThis;
  if (typeof g.queueMicrotask !== 'function') {
    g.queueMicrotask = function (cb) { Promise.resolve().then(cb); };
  }
  if (!Array.prototype.at) {
    Array.prototype.at = function (n) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      return n < 0 || n >= this.length ? undefined : this[n];
    };
  }
  if (!String.prototype.at) {
    String.prototype.at = function (n) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      return n < 0 || n >= this.length ? undefined : this.charAt(n);
    };
  }
  if (!Array.prototype.flat) {
    Array.prototype.flat = function (depth) {
      depth = depth === undefined ? 1 : depth;
      var out = [];
      (function walk(arr, d) {
        for (var i = 0; i < arr.length; i++) {
          var v = arr[i];
          if (Array.isArray(v) && d > 0) walk(v, d - 1);
          else out.push(v);
        }
      })(this, depth);
      return out;
    };
  }
  if (!Array.prototype.flatMap) {
    Array.prototype.flatMap = function (fn, thisArg) {
      return Array.prototype.map.call(this, fn, thisArg).flat(1);
    };
  }
  if (!Object.fromEntries) {
    Object.fromEntries = function (iterable) {
      var out = {};
      var arr = Array.from(iterable);
      for (var i = 0; i < arr.length; i++) out[arr[i][0]] = arr[i][1];
      return out;
    };
  }
  if (!Object.hasOwn) {
    Object.hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(Object(o), k); };
  }
  if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (search, replacement) {
      if (search instanceof RegExp) return this.replace(search, replacement);
      return this.split(search).join(replacement);
    };
  }
  if (!Promise.allSettled) {
    Promise.allSettled = function (promises) {
      return Promise.all(Array.from(promises, function (p) {
        return Promise.resolve(p).then(
          function (value) { return { status: 'fulfilled', value: value }; },
          function (reason) { return { status: 'rejected', reason: reason }; }
        );
      }));
    };
  }
  if (!Promise.any) {
    Promise.any = function (promises) {
      return new Promise(function (resolve, reject) {
        var arr = Array.from(promises);
        var left = arr.length;
        var errors = [];
        if (left === 0) { reject(new Error('No promises')); return; }
        arr.forEach(function (p, i) {
          Promise.resolve(p).then(resolve, function (e) {
            errors[i] = e;
            if (--left === 0) reject(errors[0]);
          });
        });
      });
    };
  }
  if (typeof g.structuredClone !== 'function') {
    g.structuredClone = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
  }
  if (typeof Element !== 'undefined' && !Element.prototype.replaceChildren) {
    Element.prototype.replaceChildren = function () {
      while (this.lastChild) this.removeChild(this.lastChild);
      for (var i = 0; i < arguments.length; i++) this.appendChild(arguments[i]);
    };
  }
})();`
