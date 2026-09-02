'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var copy = load('js/copy.js', { window: {} }).RawiCopy;

(function fallsBackToTheKeyWhenNoDefaultExists() {
  assert.strictEqual(copy.get('missingCopyKey'), 'missingCopyKey');
}());

(function resolvesSingleMissingLibraryIdWarningCopy() {
  assert.strictEqual(
    copy.get('storybookMissingLibraryIdSingle', { ids: 'kids-door' }),
    'A previously selected Storybook library ID is no longer available: kids-door.'
  );
}());

(function resolvesMultipleMissingLibraryIdWarningCopy() {
  assert.strictEqual(
    copy.get('storybookMissingLibraryIdMultiple', { ids: 'kids-door, songs-door' }),
    'Previously selected Storybook library IDs are no longer available: kids-door, songs-door.'
  );
}());

(function resolvesUnsupportedPreferenceVersionCopy() {
  assert.strictEqual(
    copy.get('storybookPreferencesUnsupported', { version: 99 }),
    'Saved Storybook settings use unsupported version 99.'
  );
}());

(function exposesResetConfirmationCopyDefaults() {
  assert.strictEqual(
    copy.get('storybookResetConfirmPrompt'),
    'Select Confirm reset to clear the saved Storybook settings.'
  );
  assert.strictEqual(
    copy.get('storybookResetConfirmButton'),
    'Confirm reset'
  );
}());
