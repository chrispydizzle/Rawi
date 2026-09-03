'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultPreferences() {
  return {
    version: 4,
    enabled: false,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    favoriteItemIds: [],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'animals',
      learning: 'learning',
      movement: 'movement'
    },
    durationLabels: {
      enabled: true,
      quickMaxMinutes: 12,
      cozyMaxMinutes: 30
    },
    recentHistoryDays: 14,
    reducedMotion: false,
    soundsEnabled: true
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

function assertMalformedPreferencesRequireRecovery(stored) {
  var harness = loadPreferences(stored);

  assert.deepStrictEqual(clone(harness.api.restore()), defaultPreferences());
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: true,
    type: 'malformed'
  });
  assert.strictEqual(harness.saved(), null);
  assert.strictEqual(harness.rawStored(), stored);
}

function assertRecoveryWriteBarrier(stored) {
  var harness = loadPreferences(stored);
  var result;

  harness.api.restore();
  result = harness.api.save({
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['kids'],
    favoriteItemIds: ['story-1'],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'animals',
      learning: 'learning',
      movement: ''
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 20
    },
    recentHistoryDays: 5,
    reducedMotion: true,
    soundsEnabled: true
  });

  assert.strictEqual(result, null);
  assert.strictEqual(harness.saved(), null);
  assert.strictEqual(harness.rawStored(), stored);
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: true,
    type: 'malformed'
  });
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
    version: 4,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['pixar'],
    favoriteItemIds: ['bluey'],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'animals',
      learning: 'learning',
      movement: 'movement'
    },
    durationLabels: {
      enabled: true,
      quickMaxMinutes: 12,
      cozyMaxMinutes: 30
    },
    recentHistoryDays: 14,
    reducedMotion: true,
    soundsEnabled: true
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function migratesVersion2PreferencesWithoutRecoveryOrImmediateRewrite() {
  var harness = loadPreferences(JSON.stringify({
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['kids', 'kids', 3],
    favoriteItemIds: ['story-1', 'story-1', 4],
    reducedMotion: true
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 4,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['kids'],
    favoriteItemIds: ['story-1'],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'animals',
      learning: 'learning',
      movement: 'movement'
    },
    durationLabels: {
      enabled: true,
      quickMaxMinutes: 12,
      cozyMaxMinutes: 30
    },
    recentHistoryDays: 14,
    reducedMotion: true,
    soundsEnabled: true
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function migratesVersion3PreferencesWithoutRecoveryOrImmediateRewrite() {
  var harness = loadPreferences(JSON.stringify({
    version: 3,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['kids'],
    favoriteItemIds: ['story-1'],
    categoryTags: {
      singDance: 'songs',
      bedtime: 'sleep',
      animals: 'zoo',
      learning: 'school',
      movement: 'move'
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 19
    },
    recentHistoryDays: 21,
    reducedMotion: true
  }));
  var result = harness.api.restore();

  assert.strictEqual(result.version, 4);
  assert.strictEqual(result.soundsEnabled, true);
  assert.deepStrictEqual(clone(result.categoryTags), {
    singDance: 'songs',
    bedtime: 'sleep',
    animals: 'zoo',
    learning: 'school',
    movement: 'move'
  });
  assert.deepStrictEqual(clone(result.durationLabels), {
    enabled: false,
    quickMaxMinutes: 9,
    cozyMaxMinutes: 19
  });
  assert.strictEqual(result.recentHistoryDays, 21);
  assert.strictEqual(result.reducedMotion, true);
  assert.strictEqual(harness.saved(), null);
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
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
    version: 4,
    enabled: true
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 4,
    enabled: true,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    favoriteItemIds: [],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'animals',
      learning: 'learning',
      movement: 'movement'
    },
    durationLabels: {
      enabled: true,
      quickMaxMinutes: 12,
      cozyMaxMinutes: 30
    },
    recentHistoryDays: 14,
    reducedMotion: false,
    soundsEnabled: true
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function validPreferencesAreNormalized() {
  var harness = loadPreferences(JSON.stringify({
    version: 4,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['pixar', 'pixar', 42],
    favoriteItemIds: ['bluey', 'bluey', 9],
    categoryTags: {
      singDance: ' songs ',
      bedtime: '',
      animals: ' animals ',
      learning: 'learning',
      movement: 'move-it'
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: '10',
      cozyMaxMinutes: '25'
    },
    recentHistoryDays: '3',
    reducedMotion: true,
    soundsEnabled: false,
    ignored: 'value'
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 4,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['pixar'],
    favoriteItemIds: ['bluey'],
    categoryTags: {
      singDance: 'songs',
      bedtime: '',
      animals: 'animals',
      learning: 'learning',
      movement: 'move-it'
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 10,
      cozyMaxMinutes: 25
    },
    recentHistoryDays: 3,
    reducedMotion: true,
    soundsEnabled: false
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

(function emptyStringPreferencesRequireRecoveryWithoutOverwritingStorage() {
  assertMalformedPreferencesRequireRecovery('');
}());

(function whitespaceOnlyPreferencesRequireRecoveryWithoutOverwritingStorage() {
  assertMalformedPreferencesRequireRecovery('  \n\t  ');
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
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'animals',
      learning: 'learning',
      movement: ''
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 20
    },
    recentHistoryDays: 5,
    reducedMotion: true,
    soundsEnabled: true
  });

  assert.strictEqual(result, null);
  assert.strictEqual(harness.saved(), null);
  assert.strictEqual(harness.rawStored(), corrupt);
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: true,
    type: 'malformed'
  });
}());

(function emptyStringPreferencesBlockNonResetWritesWhileRecoveryIsRequired() {
  assertRecoveryWriteBarrier('');
}());

(function whitespaceOnlyPreferencesBlockNonResetWritesWhileRecoveryIsRequired() {
  assertRecoveryWriteBarrier('  \n\t  ');
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
    childName: ' Nova ',
    libraryIds: ['one', 'one', 5],
    favoriteItemIds: ['story-1', 'story-1', 8],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'zoo',
      learning: 'learning',
      movement: ''
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 20
    },
    recentHistoryDays: 5,
    reducedMotion: false,
    soundsEnabled: false
  });

  assert.deepStrictEqual(clone(result), {
    version: 4,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['one'],
    favoriteItemIds: ['story-1'],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'zoo',
      learning: 'learning',
      movement: ''
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 20
    },
    recentHistoryDays: 5,
    reducedMotion: false,
    soundsEnabled: false
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
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'zoo',
      learning: 'learning',
      movement: ''
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 20
    },
    recentHistoryDays: 5,
    reducedMotion: false
  });

  assert.deepStrictEqual(clone(result), {
    version: 4,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['one'],
    favoriteItemIds: ['story-1'],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'zoo',
      learning: 'learning',
      movement: ''
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 20
    },
    recentHistoryDays: 5,
    reducedMotion: false,
    soundsEnabled: true
  });
  assert.strictEqual(harness.saved().key, 'rawi.storybook.preferences');
  assert.deepStrictEqual(JSON.parse(harness.saved().value), clone(result));
  assert.deepStrictEqual(
    clone(harness.api.getRestoreStatus()),
    {
      needsRecovery: false,
      type: 'ok'
    }
  );
}());
