'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultPreferences() {
  return {
    version: 2,
    enabled: false,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    favoriteItemIds: [],
    reducedMotion: false
  };
}

function loadPreferences(stored) {
  var saved = null;
  var window = load('js/storybook-preferences.js', {
    window: {
      RawiStorage: {
        get: function () { return stored; },
        set: function (key, value) { saved = { key: key, value: value }; }
      }
    }
  });
  return { api: window.RawiStorybookPreferences, saved: function () { return saved; } };
}

(function missingPreferencesUseSafeDefaults() {
  var harness = loadPreferences(null);
  var result = harness.api.restore();
  assert.deepStrictEqual(clone(result), defaultPreferences());
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
}());

(function migratesVersion1PreferencesWithoutRecoveryOrImmediateRewrite() {
  var harness = loadPreferences(JSON.stringify({
    version: 1,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['pixar', 'pixar', 7],
    favoriteItemIds: ['bluey', 'bluey', 9],
    reducedMotion: true
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['pixar'],
    favoriteItemIds: ['bluey'],
    reducedMotion: true
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function migratesLegacyFavoritesFieldIntoFavoriteItemIds() {
  var harness = loadPreferences(JSON.stringify({
    version: 1,
    enabled: true,
    favorites: ['dance', 'dance', 3]
  }));

  assert.deepStrictEqual(
    clone(harness.api.restore().favoriteItemIds),
    ['dance']
  );
  assert.strictEqual(harness.saved(), null);
}());

(function supportedVersionNormalizesMissingOptionalFieldsWithoutRecovery() {
  var harness = loadPreferences(JSON.stringify({
    version: 2,
    enabled: true
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 2,
    enabled: true,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    favoriteItemIds: [],
    reducedMotion: false
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function validPreferencesAreNormalized() {
  var harness = loadPreferences(JSON.stringify({
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['pixar', 'pixar', 42],
    favoriteItemIds: ['bluey', 'bluey', 9],
    reducedMotion: true,
    ignored: 'value'
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['pixar'],
    favoriteItemIds: ['bluey'],
    reducedMotion: true
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function malformedPreferencesRequireRecoveryWithoutOverwritingStorage() {
  var harness = loadPreferences('{not valid json');
  assert.deepStrictEqual(clone(harness.api.restore()), defaultPreferences());
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: true,
    type: 'malformed'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function unsupportedVersionRequiresRecoveryWithoutOverwritingStorage() {
  var harness = loadPreferences(JSON.stringify({ version: 99, enabled: true }));
  assert.strictEqual(harness.api.restore().enabled, false);
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: true,
    type: 'unsupported-version',
    version: 99
  });
  assert.strictEqual(harness.saved(), null);
}());

(function resetWritesVersionedDefaultsAfterRecovery() {
  var harness = loadPreferences('{broken');
  var result;

  harness.api.restore();
  result = harness.api.reset();

  assert.deepStrictEqual(clone(result), defaultPreferences());
  assert.strictEqual(harness.saved().key, 'rawi.storybook.preferences');
  assert.deepStrictEqual(JSON.parse(harness.saved().value), defaultPreferences());
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
}());

(function saveWritesNormalizedVersionedData() {
  var harness = loadPreferences(null);
  var result = harness.api.save({
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['one', 'one', 5],
    favoriteItemIds: ['story-1', 'story-1', 8],
    reducedMotion: false
  });

  assert.deepStrictEqual(clone(result), {
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['one'],
    favoriteItemIds: ['story-1'],
    reducedMotion: false
  });
  assert.strictEqual(harness.saved().key, 'rawi.storybook.preferences');
  assert.deepStrictEqual(
    JSON.parse(harness.saved().value),
    clone(result)
  );
  assert.deepStrictEqual(
    clone(harness.api.getRestoreStatus()),
    {
      needsRecovery: false,
      type: 'ok'
    }
  );
}());
