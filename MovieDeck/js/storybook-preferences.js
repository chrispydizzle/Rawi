(function (global) {
  'use strict';

  var KEY = 'rawi.storybook.preferences';
  var VERSION = 1;
  var storage = global.RawiStorage;

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
      return defaults();
    }

    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      return defaults();
    }

    if (!parsed || parsed.version !== VERSION) {
      return defaults();
    }

    return normalize(parsed);
  }

  function save(preferences) {
    var normalized = normalize(preferences);
    storage.set(KEY, JSON.stringify(normalized));
    return normalized;
  }

  global.RawiStorybookPreferences = {
    defaults: defaults,
    restore: restore,
    save: save
  };
}(window));
