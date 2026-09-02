'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultPreferences() {
  return {
    version: 1,
    enabled: false,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
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

(function supportedVersionNormalizesMissingOptionalFieldsWithoutRecovery() {
  var harness = loadPreferences(JSON.stringify({
    version: 1,
    enabled: true
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 1,
    enabled: true,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    reducedMotion: false
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
}());

(function validPreferencesAreNormalized() {
  var harness = loadPreferences(JSON.stringify({
    version: 1,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['pixar', 'pixar', 42],
    reducedMotion: true,
    ignored: 'value'
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 1,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['pixar'],
    reducedMotion: true
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
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
    childName: 'Nova',
    libraryIds: ['one'],
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
