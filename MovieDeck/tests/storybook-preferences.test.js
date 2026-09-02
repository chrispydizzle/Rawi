'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;

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
  var result = loadPreferences(null).api.restore();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
    version: 1,
    enabled: false,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    reducedMotion: false
  });
}());

(function validPreferencesAreNormalized() {
  var result = loadPreferences(JSON.stringify({
    version: 1,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['pixar', 'pixar', 42],
    reducedMotion: true,
    ignored: 'value'
  })).api.restore();

  assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
    version: 1,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['pixar'],
    reducedMotion: true
  });
}());

(function unsupportedVersionUsesDefaultsWithoutOverwritingStorage() {
  var harness = loadPreferences(JSON.stringify({ version: 99, enabled: true }));
  assert.strictEqual(harness.api.restore().enabled, false);
  assert.strictEqual(harness.saved(), null);
}());

(function saveWritesNormalizedVersionedData() {
  var harness = loadPreferences(null);
  var result = harness.api.save({
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['one'],
    reducedMotion: false
  });
  assert.strictEqual(harness.saved().key, 'rawi.storybook.preferences');
  assert.deepStrictEqual(
    JSON.parse(harness.saved().value),
    JSON.parse(JSON.stringify(result))
  );
}());
