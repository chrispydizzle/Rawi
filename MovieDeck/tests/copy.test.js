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

(function exposesStorybookHomePhase2CopyDefaults() {
  assert.strictEqual(
    copy.get('storybookContinueTitle', { child: 'Nova' }),
    "Continue Nova's Story"
  );
  assert.strictEqual(
    copy.get('storybookContinueTitleWithoutName'),
    'Continue the story'
  );
  assert.strictEqual(
    copy.get('storybookFavoritesTitle', { child: 'Nova' }),
    "Nova's Favorites"
  );
  assert.strictEqual(copy.get('storybookFavoritesTitleWithoutName'), 'Favorites');
  assert.strictEqual(copy.get('storybookDoorsTitle'), 'Story Doors');
  assert.strictEqual(
    copy.get('storybookHomeHint'),
    'Pick a favorite or open a story door.'
  );
  assert.strictEqual(
    copy.get('storybookItemAriaLabel', { title: 'Bluey' }),
    'Open Bluey'
  );
  assert.strictEqual(
    copy.get('storybookResumeProgress', { time: '6m' }),
    'Resume from 6m'
  );
}());

(function exposesStorybookLibraryCopyDefaults() {
  assert.strictEqual(copy.get('storybookLibraryBackButton'), '← Storybook');
  assert.strictEqual(
    copy.get('storybookLibraryEmpty', { library: 'Kids' }),
    'No stories are available in Kids right now.'
  );
}());

(function exposesStorybookDetailsCopyDefaults() {
  assert.strictEqual(copy.get('storybookDetailsBackButton'), '← Storybook');
  assert.strictEqual(copy.get('storybookDetailsKicker'), 'Story time');
  assert.strictEqual(copy.get('storybookStartButton'), 'Start story');
  assert.strictEqual(
    copy.get('storybookResumeButton', { time: '6m' }),
    'Resume from 6m'
  );
}());

(function exposesStorybookFavoriteToggleCopyDefaults() {
  assert.strictEqual(copy.get('storybookFavoriteAddButton'), 'Add to Storybook favorites');
  assert.strictEqual(copy.get('storybookFavoriteRemoveButton'), 'Remove from Storybook favorites');
  assert.strictEqual(
    copy.get('storybookFavoriteAddedToast', { title: 'First Story' }),
    'Added First Story to Storybook favorites.'
  );
  assert.strictEqual(
    copy.get('storybookFavoriteRemovedToast', { title: 'First Story' }),
    'Removed First Story from Storybook favorites.'
  );
}());
