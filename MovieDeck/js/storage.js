(function (global) {
  'use strict';

  function preferenceAvailable() {
    return !!(global.tizen && global.tizen.preference);
  }

  function get(key) {
    var stored = global.localStorage.getItem(key);
    if (stored !== null) { return stored; }
    if (!preferenceAvailable()) { return null; }
    try {
      if (!global.tizen.preference.exists(key)) { return null; }
      stored = String(global.tizen.preference.getValue(key));
      global.localStorage.setItem(key, stored);
      return stored;
    } catch (error) {
      return null;
    }
  }

  function set(key, stored) {
    global.localStorage.setItem(key, stored);
    if (!preferenceAvailable()) { return; }
    try {
      global.tizen.preference.setValue(key, stored);
    } catch (error) {
      // localStorage remains authoritative when the optional TV store fails.
    }
  }

  function remove(key) {
    global.localStorage.removeItem(key);
    if (!preferenceAvailable()) { return; }
    try {
      if (global.tizen.preference.exists(key)) {
        global.tizen.preference.remove(key);
      }
    } catch (error) {
      // The optional TV store may be unavailable on older firmware.
    }
  }

  global.RawiStorage = {
    get: get,
    remove: remove,
    set: set
  };
}(window));
