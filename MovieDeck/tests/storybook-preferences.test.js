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
  var storedValue = stored;
  var window = load('js/storybook-preferences.js', {
    window: {
      RawiStorage: {
        get: function () { return storedValue; },
        set: function (key, value) {
          storedValue = value;
          saved = { key: key, value: value };
        }
      }
    }
  });
  return {
    api: window.RawiStorybookPreferences,
    rawStored: function () { return storedValue; },
    saved: function () { return saved; }
  };
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

(function blocksNonResetWritesWhileRecoveryIsRequired() {
  var corrupt = '{not valid json';
  var harness = loadPreferences(corrupt);
  var result;

  harness.api.restore();
  result = harness.api.save({
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['kids'],
    favoriteItemIds: ['story-1'],
    reducedMotion: true
  });

  assert.strictEqual(result, null);
  assert.strictEqual(harness.saved(), null);
  assert.strictEqual(harness.rawStored(), corrupt);
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: true,
    type: 'malformed'
  });
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

(function confirmedResetAllowsNormalWritesAgain() {
  var corrupt = JSON.stringify({ version: 99, enabled: true });
  var harness = loadPreferences(corrupt);
  var result;

  harness.api.restore();
  assert.strictEqual(harness.api.save({ enabled: true }), null);
  assert.strictEqual(harness.rawStored(), corrupt);

  harness.api.reset();
  result = harness.api.save({
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
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
  assert.deepStrictEqual(
    JSON.parse(harness.rawStored()),
    clone(result)
  );
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
