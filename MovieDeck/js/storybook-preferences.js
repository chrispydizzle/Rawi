(function (global) {
  'use strict';

  var KEY = 'rawi.storybook.preferences';
  var VERSION = 3;
  var storage = global.RawiStorage;
  var DEFAULT_CATEGORY_TAGS = {
    singDance: 'sing-along',
    bedtime: 'bedtime',
    animals: 'animals',
    learning: 'learning',
    movement: 'movement'
  };
  var DEFAULT_DURATION_LABELS = {
    enabled: true,
    quickMaxMinutes: 12,
    cozyMaxMinutes: 30
  };
  var lastRestoreStatus = {
    needsRecovery: false,
    type: 'ok'
  };

  function normalizeIds(values) {
    var result = [];
    var seen = {};
    var list = Array.isArray(values) ? values : [];
    var i;
    var id;

    for (i = 0; i < list.length; i += 1) {
      id = list[i];
      if (typeof id !== 'string' || !id || seen[id]) { continue; }
      seen[id] = true;
      result.push(id);
    }

    return result;
  }

  function normalizeText(value, fallback) {
    if (typeof value === 'string') {
      return value.trim();
    }
    return fallback;
  }

  function normalizePositiveInt(value, fallback) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1) {
      return fallback;
    }
    return parsed;
  }

  function normalizeNonNegativeInt(value, fallback) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
      return fallback;
    }
    return parsed;
  }

  function normalizeCategoryTags(source) {
    source = source || {};
    return {
      singDance: normalizeText(source.singDance, DEFAULT_CATEGORY_TAGS.singDance),
      bedtime: normalizeText(source.bedtime, DEFAULT_CATEGORY_TAGS.bedtime),
      animals: normalizeText(source.animals, DEFAULT_CATEGORY_TAGS.animals),
      learning: normalizeText(source.learning, DEFAULT_CATEGORY_TAGS.learning),
      movement: normalizeText(source.movement, DEFAULT_CATEGORY_TAGS.movement)
    };
  }

  function normalizeDurationLabels(source) {
    var quick;
    var cozy;

    source = source || {};
    quick = normalizePositiveInt(source.quickMaxMinutes, DEFAULT_DURATION_LABELS.quickMaxMinutes);
    cozy = normalizePositiveInt(source.cozyMaxMinutes, DEFAULT_DURATION_LABELS.cozyMaxMinutes);
    if (cozy < quick) {
      cozy = quick;
    }

    return {
      enabled: source.enabled !== undefined ? source.enabled === true : DEFAULT_DURATION_LABELS.enabled,
      quickMaxMinutes: quick,
      cozyMaxMinutes: cozy
    };
  }

  function defaults() {
    return {
      version: VERSION,
      enabled: false,
      lastMode: 'adult',
      childName: '',
      libraryIds: [],
      favoriteItemIds: [],
      categoryTags: normalizeCategoryTags(),
      durationLabels: normalizeDurationLabels(),
      recentHistoryDays: 14,
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

    return {
      version: VERSION,
      enabled: source.enabled === true,
      lastMode: source.lastMode === 'storybook' ? 'storybook' : 'adult',
      childName: typeof source.childName === 'string' ? source.childName.trim() : '',
      libraryIds: normalizeIds(source.libraryIds),
      favoriteItemIds: normalizeIds(
        source.favoriteItemIds !== undefined ? source.favoriteItemIds : source.favorites
      ),
      categoryTags: normalizeCategoryTags(source.categoryTags),
      durationLabels: normalizeDurationLabels(source.durationLabels),
      recentHistoryDays: normalizeNonNegativeInt(source.recentHistoryDays, 14),
      reducedMotion: source.reducedMotion === true
    };
  }

  function restore() {
    var stored = storage.get(KEY);
    var parsed;

    if (stored === null || stored === undefined) {
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

    if (parsed.version === 1 || parsed.version === 2 || parsed.version === VERSION) {
      restoreStatus({
        needsRecovery: false,
        type: 'ok'
      });
      return normalize(parsed);
    }

    restoreStatus({
      needsRecovery: true,
      type: 'unsupported-version',
      version: parsed.version
    });
    return defaults();
  }

  function save(preferences, options) {
    var normalized = normalize(preferences);

    if (lastRestoreStatus.needsRecovery && !(options && options.allowRecoveryWrite)) {
      return null;
    }

    storage.set(KEY, JSON.stringify(normalized));
    restoreStatus({
      needsRecovery: false,
      type: 'ok'
    });
    return normalized;
  }

  function reset() {
    return save(defaults(), { allowRecoveryWrite: true });
  }

  global.RawiStorybookPreferences = {
    defaults: defaults,
    getRestoreStatus: cloneStatus,
    reset: reset,
    restore: restore,
    save: save
  };
}(window));
