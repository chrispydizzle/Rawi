'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;

function memoryStorage() {
  var values = {};
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem: function (key, value) { values[key] = String(value); },
    removeItem: function (key) { delete values[key]; }
  };
}

(function localStorageIsAuthoritative() {
  var local = memoryStorage();
  local.setItem('key', 'local');
  var preferenceReads = 0;
  var window = load('js/storage.js', {
    localStorage: local,
    window: {
      tizen: {
        preference: {
          exists: function () { preferenceReads += 1; return true; },
          getValue: function () { return 'preference'; }
        }
      }
    }
  });

  assert.strictEqual(window.RawiStorage.get('key'), 'local');
  assert.strictEqual(preferenceReads, 0);
}());

(function preferenceValueMirrorsToLocalStorage() {
  var local = memoryStorage();
  var window = load('js/storage.js', {
    localStorage: local,
    window: {
      tizen: {
        preference: {
          exists: function () { return true; },
          getValue: function () { return 'from-tv'; },
          setValue: function () {}
        }
      }
    }
  });

  assert.strictEqual(window.RawiStorage.get('key'), 'from-tv');
  assert.strictEqual(local.getItem('key'), 'from-tv');
}());

(function optionalPreferenceFailureDoesNotLoseLocalValue() {
  var local = memoryStorage();
  var window = load('js/storage.js', {
    localStorage: local,
    window: {
      tizen: {
        preference: {
          setValue: function () { throw new Error('unavailable'); },
          exists: function () { throw new Error('unavailable'); }
        }
      }
    }
  });

  window.RawiStorage.set('key', 'saved');
  assert.strictEqual(local.getItem('key'), 'saved');
  window.RawiStorage.remove('key');
  assert.strictEqual(local.getItem('key'), null);
}());
