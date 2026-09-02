(function (global) {
  'use strict';

  var KEY = 'rawi.storybook.preferences';
  var VERSION = 1;
  var storage = global.RawiStorage;
  var lastRestoreStatus = {
    needsRecovery: false,
    type: 'ok'
  };

  function defaults() {
    return {
      version: VERSION,
      enabled: false,
      lastMode: 'adult',
      childName: '',
      libraryIds: [],
      reducedMotion: false
    };
  }

  function restoreStatus(status) {
    lastRestoreStatus = status;
  }

  function cloneStatus() {
    var copy = {
      needsRecovery: lastRestoreStatus.needsRecovery === true,
      type: lastRestoreStatus.type || 'ok'
    };

    if (lastRestoreStatus.version !== undefined) {
      copy.version = lastRestoreStatus.version;
    }

    return copy;
  }

  function normalize(input) {
    var source = input || {};
    var libraryIds = [];
    var seen = {};
    var ids = Array.isArray(source.libraryIds) ? source.libraryIds : [];
    var i;
    var id;

    for (i = 0; i < ids.length; i += 1) {
      id = ids[i];
      if (typeof id !== 'string' || !id || seen[id]) { continue; }
      seen[id] = true;
      libraryIds.push(id);
    }

    return {
      version: VERSION,
      enabled: source.enabled === true,
      lastMode: source.lastMode === 'storybook' ? 'storybook' : 'adult',
      childName: typeof source.childName === 'string' ? source.childName.trim() : '',
      libraryIds: libraryIds,
      reducedMotion: source.reducedMotion === true
    };
  }

  function restore() {
    var stored = storage.get(KEY);
    var parsed;

    if (!stored) {
      restoreStatus({
        needsRecovery: false,
        type: 'ok'
      });
      return defaults();
    }

    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      restoreStatus({
        needsRecovery: true,
        type: 'malformed'
      });
      return defaults();
    }

    if (!parsed || parsed.version === undefined || parsed.version === null) {
      restoreStatus({
        needsRecovery: true,
        type: 'malformed'
      });
      return defaults();
    }

    if (parsed.version !== VERSION) {
      restoreStatus({
        needsRecovery: true,
        type: 'unsupported-version',
        version: parsed.version
      });
      return defaults();
    }

    restoreStatus({
      needsRecovery: false,
      type: 'ok'
    });
    return normalize(parsed);
  }

  function save(preferences) {
    var normalized = normalize(preferences);
    storage.set(KEY, JSON.stringify(normalized));
    restoreStatus({
      needsRecovery: false,
      type: 'ok'
    });
    return normalized;
  }

  function reset() {
    return save(defaults());
  }

  global.RawiStorybookPreferences = {
    defaults: defaults,
    getRestoreStatus: cloneStatus,
    reset: reset,
    restore: restore,
    save: save
  };
}(window));
