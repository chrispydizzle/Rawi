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

(function exposesStorybookEndingCopyDefaults() {
  assert.strictEqual(
    copy.get('storybookEndingTitle', { child: 'Nova' }),
    'All done, Nova.'
  );
  assert.strictEqual(copy.get('storybookEndingTitleWithoutName'), 'All done.');
  assert.strictEqual(
    copy.get('storybookEndingBody', { title: 'First Story' }),
    'That was First Story. Would you like to pick another story?'
  );
  assert.strictEqual(copy.get('storybookEndingPrimaryButton'), 'All done');
  assert.strictEqual(copy.get('storybookEndingSecondaryButton'), 'Pick another');
}());

(function exposesStorybookFriendlyDurationCopyDefaults() {
  assert.strictEqual(
    copy.get('storybookFriendlyRuntime', { minutes: '12 min', label: 'Quick story' }),
    '12 min • Quick story'
  );
  assert.strictEqual(copy.get('storybookDurationQuickStory'), 'Quick story');
  assert.strictEqual(copy.get('storybookDurationCozyEpisode'), 'Cozy episode');
  assert.strictEqual(copy.get('storybookDurationBigMovie'), 'Big movie');
}());

(function exposesStorybookCategoryCopyDefaults() {
  assert.strictEqual(copy.get('storybookCategoriesTitle'), 'Pick a kind of story');
  assert.strictEqual(copy.get('storybookCategorySingDance'), 'Sing & Dance');
  assert.strictEqual(copy.get('storybookCategoryBedtime'), 'Bedtime Stories');
  assert.strictEqual(copy.get('storybookCategoryAnimals'), 'Animal Friends');
  assert.strictEqual(copy.get('storybookCategoryLearning'), 'Little Lessons');
  assert.strictEqual(copy.get('storybookCategoryMovement'), 'Move Around');
  assert.strictEqual(
    copy.get('storybookCategoryAriaLabel', { category: 'Animal Friends' }),
    'Open Animal Friends'
  );
}());

(function exposesStorybookPhase3SettingsCopyDefaults() {
  assert.strictEqual(copy.get('storybookCategoryTagsLabel'), 'Jellyfin tags for Storybook categories');
  assert.strictEqual(copy.get('storybookDurationSettingsLabel'), 'Friendly duration labels');
  assert.strictEqual(copy.get('storybookDurationLabelsEnabledLabel'), 'Show friendly duration labels on Storybook cards and details');
  assert.strictEqual(copy.get('storybookDurationQuickMaxLabel'), 'Quick story up to this many minutes');
  assert.strictEqual(copy.get('storybookDurationCozyMaxLabel'), 'Cozy episode up to this many minutes');
  assert.strictEqual(copy.get('storybookRecentHistoryDaysLabel'), 'Hide completed stories for this many days');
  assert.strictEqual(copy.get('storybookDurationThresholdError'), 'Quick story minutes must be at least 1, and Cozy episode minutes must be greater than or equal to Quick story minutes.');
  assert.strictEqual(copy.get('storybookRecentHistoryDaysError'), 'Recent history days must be 0 or more.');
}());

(function exposesStorybookLittleMenuCopyDefault() {
  assert.strictEqual(copy.get('storybookLittleMenuTitle'), "Tonight's Little Menu");
}());

(function exposesStorybookMagicPickCopyDefaults() {
  assert.strictEqual(copy.get('storybookMagicPickButton'), 'Magic Pick');
  assert.strictEqual(copy.get('storybookMagicPickTitle'), 'Magic Pick');
  assert.strictEqual(copy.get('storybookMagicPickOpenButton'), 'Tell me about this story');
  assert.strictEqual(copy.get('storybookMagicPickAgainButton'), 'Pick again');
  assert.strictEqual(copy.get('storybookMagicPickBackButton'), '← Storybook');
  assert.strictEqual(copy.get('storybookMagicReasonUnwatched'), 'A new story to discover.');
  assert.strictEqual(copy.get('storybookMagicReasonFavorite'), 'A favorite with a little extra sparkle.');
  assert.strictEqual(copy.get('storybookMagicReasonDifferentCategory'), 'Something a little different from last time.');
  assert.strictEqual(copy.get('storybookMagicReasonAnyStory'), 'A cozy surprise from your Story Doors.');
  assert.strictEqual(copy.get('storybookMagicPickEmptyTitle'), 'No Magic Pick right now');
  assert.strictEqual(copy.get('storybookMagicPickEmptyBody'), 'Everything in the selected Storybook libraries was finished recently. Try a Story Door instead.');
  assert.strictEqual(copy.get('storybookMagicPickEmptyPrimaryButton'), 'Open Story Doors');
  assert.strictEqual(copy.get('storybookMagicPickEmptySecondaryButton'), 'Back to Storybook');
}());
