(function (global) {
  'use strict';

  var defaults = {
    documentTitle: 'Rawi',
    appName: 'Rawi',
    setupKicker: 'La Casita de Posada',
    setupNote: 'This TV will display a Quick Connect code.',
    serverLabel: 'Host',
    serverPlaceholder: 'http://192.168.1.10:8096',
    connectButton: 'Connect',
    quickKicker: 'Authorize this screen',
    quickTitle: 'Enter this code<br>in Jellyfin',
    quickInstructions: 'Open Jellyfin on another device, then go to<br><strong>Settings → Quick Connect</strong>.',
    quickWaiting: 'Waiting for approval',
    changeServerButton: 'Change server',
    browseAriaLabel: 'Movie library',
    selectedLabel: 'Selected',
    chooseVideo: 'Choose a video',
    modeAdult: 'Adult',
    modeStorybook: 'Storybook',
    refreshAriaLabel: 'Refresh library',
    storybookSettingsButton: 'Storybook settings',
    heroEyebrow: 'Tonight’s selection',
    heroTitle: 'Your movies are ready.',
    heroOverview: 'Choose a poster below to see it on the big screen.',
    heroOpenButton: 'View film',
    selectedIndexLabel: 'SELECTED',
    browseLoading: 'Opening the library',
    detailsAriaLabel: 'Movie details',
    detailsBackButton: '← Library',
    detailsKicker: 'Feature presentation',
    playButton: '▶ Play',
    restartButton: 'Start from beginning',
    playerAriaLabel: 'Video player',
    playerPreparing: 'Preparing the film…',
    playerHints: '◀◀ 30s  •  OK Pause  •  30s ▶▶',
    untitled: 'Untitled',
    runtimeMinutes: '{minutes} min',
    noSynopsis: 'No synopsis is available for this film.',
    quickConnectDisabled: 'Quick Connect is disabled or this session has expired.',
    quickConnectUnavailable: 'That Jellyfin address does not expose Quick Connect.',
    quickConnectMissingCode: 'Jellyfin did not return a Quick Connect code.',
    connectionFailed: 'Could not reach that Jellyfin server.',
    quickApproved: 'Approved. Opening your library…',
    quickConnectStopped: 'Quick Connect stopped. Try again.',
    defaultProfileName: 'Jellyfin',
    shelfItemCount: '{count} films',
    allVideos: 'All videos',
    continueWatchingTitle: 'Continue watching',
    continueWatchingCaption: 'Pick up where you left off',
    recentlyAddedTitle: 'Recently added',
    recentlyAddedCaption: 'Fresh from your library',
    libraryCaption: '{count} titles, A–Z',
    noVideos: 'No videos are visible to this Jellyfin user.',
    sessionExpired: 'Your saved session expired. Connect again to authorize this TV.',
    libraryLoadFailed: 'The library could not be loaded.',
    storybookSettingsTitle: 'Set up Storybook Mode',
    storybookSettingsIntro: 'Choose the libraries that belong in Storybook Mode.',
    storybookChildNameLabel: "Child's name",
    storybookLibrariesLabel: 'Visible libraries',
    storybookReducedMotionLabel: 'Use less motion',
    storybookGreeting: 'What should we watch tonight, {child}?',
    storybookGreetingWithoutName: 'What should we watch tonight?',
    storybookContinueTitle: "Continue {child}'s Story",
    storybookContinueTitleWithoutName: 'Continue the story',
    storybookFavoritesTitle: "{child}'s Favorites",
    storybookFavoritesTitleWithoutName: 'Favorites',
    storybookFavoriteAddButton: 'Add to Storybook favorites',
    storybookFavoriteRemoveButton: 'Remove from Storybook favorites',
    storybookFavoriteAddedToast: 'Added {title} to Storybook favorites.',
    storybookFavoriteRemovedToast: 'Removed {title} from Storybook favorites.',
    storybookDoorsTitle: 'Story Doors',
    storybookHomeHint: 'Pick a favorite or open a story door.',
    storybookItemAriaLabel: 'Open {title}',
    storybookLibraryBackButton: '← Storybook',
    storybookLibraryEmpty: 'No stories are available in {library} right now.',
    storybookDetailsBackButton: '← Storybook',
    storybookDetailsKicker: 'Story time',
    storybookStartButton: 'Start story',
    storybookResumeButton: 'Resume from {time}',
    storybookResumeProgress: 'Resume from {time}',
    storybookEndingTitle: 'All done, {child}.',
    storybookEndingTitleWithoutName: 'All done.',
    storybookEndingBody: 'That was {title}. Would you like to pick another story?',
    storybookEndingPrimaryButton: 'All done',
    storybookEndingSecondaryButton: 'Pick another',
    storybookDoorAriaLabel: 'Open {library}',
    storybookNoSelectedLibraries: 'No Storybook libraries are available.',
    storybookEditLibrariesButton: 'Choose libraries',
    storybookSaveButton: 'Save Storybook settings',
    storybookCancelButton: 'Cancel',
    storybookNoLibraries: 'Choose at least one library for Storybook Mode.',
    storybookMissingLibrary: 'A previously selected library is no longer available.',
    storybookMissingLibraryIdSingle: 'A previously selected Storybook library ID is no longer available: {ids}.',
    storybookMissingLibraryIdMultiple: 'Previously selected Storybook library IDs are no longer available: {ids}.',
    storybookPreferencesMalformed: 'Saved Storybook settings could not be read.',
    storybookPreferencesUnsupported: 'Saved Storybook settings use unsupported version {version}.',
    storybookRecoveryResetRequired: 'Reset Storybook settings before saving new Storybook options.',
    storybookResetButton: 'Reset Storybook settings',
    storybookResetConfirmButton: 'Confirm reset',
    storybookResetConfirmPrompt: 'Select Confirm reset to clear the saved Storybook settings.',
    storybookSettingsSaved: 'Storybook settings saved.',
    storybookSetupRequired: 'Choose Storybook libraries before opening this mode.',
    storybookFriendlyRuntime: '{minutes} • {label}',
    storybookDurationQuickStory: 'Quick story',
    storybookDurationCozyEpisode: 'Cozy episode',
    storybookDurationBigMovie: 'Big movie',
    storybookCategoriesTitle: 'Pick a kind of story',
    storybookCategoryAriaLabel: 'Open {category}',
    storybookCategorySingDance: 'Sing & Dance',
    storybookCategoryBedtime: 'Bedtime Stories',
    storybookCategoryAnimals: 'Animal Friends',
    storybookCategoryLearning: 'Little Lessons',
    storybookCategoryMovement: 'Move Around',
    storybookLittleMenuTitle: "Tonight's Little Menu",
    storybookMagicPickButton: 'Magic Pick',
    storybookMagicPickTitle: 'Magic Pick',
    storybookMagicPickOpenButton: 'Tell me about this story',
    storybookMagicPickAgainButton: 'Pick again',
    storybookMagicPickBackButton: '← Storybook',
    storybookMagicReasonUnwatched: 'A new story to discover.',
    storybookMagicReasonFavorite: 'A favorite with a little extra sparkle.',
    storybookMagicReasonDifferentCategory: 'Something a little different from last time.',
    storybookMagicReasonAnyStory: 'A cozy surprise from your Story Doors.',
    storybookMagicPickEmptyTitle: 'No Magic Pick right now',
    storybookMagicPickEmptyBody: 'Everything in the selected Storybook libraries was finished recently. Try a Story Door instead.',
    storybookMagicPickEmptyPrimaryButton: 'Open Story Doors',
    storybookMagicPickEmptySecondaryButton: 'Back to Storybook',
    posterAlt: '{title} poster',
    resumeButton: '▶ Resume at {time}',
    finishedToast: 'Finished {title}',
    signOutConfirm: 'Press the profile button again to sign out.',
    signedOut: 'Signed out. Connect again when you are ready.',
    playbackFailed: 'This film could not be played.',
    playbackError: 'Playback error',
    buffering: 'Buffering…',
    playing: 'Playing',
    paused: 'Paused',
    seekBack: 'Back 30 seconds',
    seekForward: 'Forward 30 seconds',
    samsungPlayerError: 'Samsung player error: {error}',
    browserPlaybackError: 'This browser could not play the selected stream.',
    jellyfinHttpError: 'Jellyfin returned {status}',
    jellyfinSessionError: 'Jellyfin did not return a user session.',
    noMediaSource: 'No playable media source was returned.',
    noCompatibleStream: 'Jellyfin could not build a compatible stream.'
  };

  var overrides = global.RawiCopyOverrides || {};

  function replace(template, values) {
    var result = template;
    Object.keys(values || {}).forEach(function (key) {
      result = result.replace(new RegExp('\\{' + key + '\\}', 'g'), String(values[key]));
    });
    return result;
  }

  function get(key, values) {
    var template = Object.prototype.hasOwnProperty.call(overrides, key) &&
      typeof overrides[key] === 'string' ? overrides[key] : defaults[key];
    return replace(template !== undefined ? template : key, values);
  }

  function apply(root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-copy]'), function (node) {
      node.textContent = get(node.getAttribute('data-copy'));
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-copy-html]'), function (node) {
      node.innerHTML = get(node.getAttribute('data-copy-html'));
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-copy-placeholder]'), function (node) {
      node.setAttribute('placeholder', get(node.getAttribute('data-copy-placeholder')));
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-copy-aria-label]'), function (node) {
      node.setAttribute('aria-label', get(node.getAttribute('data-copy-aria-label')));
    });
    document.title = get('documentTitle');
  }

  global.RawiCopy = {
    apply: apply,
    defaults: defaults,
    get: get
  };
}(window));
