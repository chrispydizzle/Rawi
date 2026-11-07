(function (global) {
  'use strict';

  var api = global.MovieDeckApi;
  var animations = global.MovieDeckAnimations;
  var copy = global.RawiCopy;
  var player = global.MovieDeckPlayer;
  var storybookCatalogue = global.RawiStorybookCatalogue;
  var storybookDiscovery = global.RawiStorybookDiscovery;
  var storybookModel = global.RawiStorybookModel;
  var storybookPreferences = global.RawiStorybookPreferences;
  var storybookSound = global.RawiStorybookSound;
  var storybookView = global.RawiStorybookView;
  var value = global.MovieDeckValue;
  var smartSearch = global.RawiSmartSearch;

  // Application state
  var selectedItem = null;
  var selectedCard = null;
  var quickTimer = null;
  var toastTimer = null;
  var signOutTimer = null;
  var activeScreen = 'setup-screen';
  var storybookState = storybookPreferences.restore();
  var storybookRestoreStatus = storybookPreferences.getRestoreStatus ?
    storybookPreferences.getRestoreStatus() :
    { needsRecovery: false, type: 'ok' };
  var availableLibraries = [];
  var availableLibrariesReady = false;
  var availableLibrariesFailed = false;
  var availableLibrariesLoading = false;
  var currentLibraryLoadState = {
    viewsSucceeded: false,
    requestedLibraryIds: [],
    videoRequests: {}
  };
  var currentStorybookCatalogue = null;
  var currentStorybookDiscovery = null;
  var currentGroups = [];
  var currentLatest = [];
  var currentResume = [];
  var defaultServer = 'http://192.168.1.2:8096';
  var previousScreen = 'browse-screen';
  var searchIndex = [];
  var searchQuery = '';
  var searchKeys = [];
  var searchMatches = [];
  var searchResultLimit = 30;
  var searchReturnCard = null;
  var searchReturnItem = null;
  var searchIsStorybook = false;
  var detailsReturnScreen = 'browse-screen';
  var detailsReturnCard = null;
  var previewStorybookFixture = null;
  var storybookLibraryState = {
    items: [],
    kind: 'library',
    categoryKey: '',
    libraryId: '',
    returnFocusId: '',
    title: ''
  };
  var storybookDetailsState = {
    collection: null,
    focusId: '',
    source: 'home'
  };
  var storybookEndingState = {
    childName: '',
    title: ''
  };
  var storybookMagicPickState = {
    empty: false,
    result: null,
    returnFocusId: 'storybook-magic-pick-button'
  };
  var STORYBOOK_PRESENTATION_SCREENS = {
    'storybook-screen': true,
    'storybook-library-screen': true,
    'storybook-details-screen': true,
    'storybook-magic-pick-screen': true,
    'storybook-ending-screen': true
  };
  var STORYBOOK_SOUND_SCREENS = {
    'search-screen': true,
    'storybook-screen': true,
    'storybook-library-screen': true,
    'storybook-details-screen': true,
    'storybook-magic-pick-screen': true,
    'storybook-ending-screen': true,
    'storybook-settings-screen': true
  };
  var playerReturnState = {
    focusId: 'play-button',
    mode: 'adult',
    screenId: 'details-screen'
  };
  var pendingPlaybackError = null;
  var storybookResetConfirming = false;
  var storybookSettingsReturnFocusId = 'storybook-settings-button';
  var storybookSettingsIntent = {
    activateStorybookOnSave: false,
    modeOnOpen: storybookState.lastMode
  };

  // DOM and item helpers
  function byId(id) { return document.getElementById(id); }
  function text(id, content) { byId(id).textContent = content || ''; }
  function name(item) { return value(item, 'Name', 'name') || copy.get('untitled'); }
  function itemId(item) { return value(item, 'Id', 'id'); }
  function queryValue(name) {
    var search = global.location && global.location.search ? global.location.search : '';
    var match = new RegExp('[?&]' + name + '=([^&]+)').exec(search);
    return match ? decodeURIComponent(match[1]) : '';
  }
  function runtime(item) {
    var ticks = value(item, 'RunTimeTicks', 'runTimeTicks') || 0;
    return ticks ? copy.get('runtimeMinutes', { minutes: Math.round(ticks / 600000000) }) : '';
  }
  function runtimeMinutesValue(item) {
    var ticks = value(item, 'RunTimeTicks', 'runTimeTicks') || 0;
    return ticks ? Math.round(ticks / 600000000) : 0;
  }
  function storybookDurationCopyKey(minutes) {
    var labels = storybookState.durationLabels || {};

    if (!labels.enabled || !minutes) {
      return '';
    }
    if (minutes <= labels.quickMaxMinutes) {
      return 'storybookDurationQuickStory';
    }
    if (minutes <= labels.cozyMaxMinutes) {
      return 'storybookDurationCozyEpisode';
    }
    return 'storybookDurationBigMovie';
  }
  function storybookRuntime(item) {
    var minutes = runtimeMinutesValue(item);
    var labelKey = storybookDurationCopyKey(minutes);
    var minutesText;

    if (!minutes) { return ''; }
    minutesText = copy.get('runtimeMinutes', { minutes: minutes });
    if (!labelKey) {
      return minutesText;
    }
    return copy.get('storybookFriendlyRuntime', {
      label: copy.get(labelKey),
      minutes: minutesText
    });
  }
  function userData(item) { return value(item, 'UserData', 'userData') || {}; }
  function resumeTicks(item) { return value(userData(item), 'PlaybackPositionTicks', 'playbackPositionTicks') || 0; }
  function playbackPercent(item) { return value(userData(item), 'PlayedPercentage', 'playedPercentage') || 0; }
  function previewGroups() {
    return ((previewStorybookFixture && previewStorybookFixture.groups) || []).map(function (group) {
      return {
        id: group.id,
        name: group.name,
        videos: group.videos || []
      };
    });
  }
  function previewLibraryIds() {
    return ((previewStorybookFixture && previewStorybookFixture.libraries) || []).map(function (library) {
      return itemId(library);
    });
  }

  function shouldAnimateScreenEntry(id) {
    if (id === 'search-screen' && searchIsStorybook) {
      return !isStorybookReducedMotion();
    }
    if (id === 'storybook-settings-screen') {
      return true;
    }
    if (STORYBOOK_PRESENTATION_SCREENS[id]) {
      return !isStorybookReducedMotion();
    }
    return true;
  }

  // Screens and feedback
  function showScreen(id, focusId) {
    if (activeScreen === 'storybook-screen' &&
        id !== 'storybook-screen' &&
        animations.stopStorybookHome) {
      animations.stopStorybookHome();
    }
    Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (screen) {
      screen.classList.toggle('is-active', screen.id === id);
    });
    activeScreen = id;
    storybookView.setActiveScreen(byId(id), storybookState.reducedMotion);
    if (animations.enterScreen && shouldAnimateScreenEntry(id)) {
      animations.enterScreen(byId(id));
    }
    if (focusId) { focusScreenTarget(focusId); }
  }

  function storybookSettingsPanel() {
    var screen = byId('storybook-settings-screen');
    return screen ? screen.getElementsByClassName('settings-panel')[0] : null;
  }

  function ensureStorybookControlVisible(control) {
    var panel = storybookSettingsPanel();
    var panelRect;
    var controlRect;
    var maximum;
    var nextTop;
    var margin = 36;

    if (!panel || !control || panel.scrollHeight <= panel.clientHeight) { return; }
    panelRect = panel.getBoundingClientRect();
    controlRect = control.getBoundingClientRect();
    nextTop = panel.scrollTop;

    if (controlRect.top < panelRect.top + margin) {
      nextTop += controlRect.top - panelRect.top - margin;
    } else if (controlRect.bottom > panelRect.bottom - margin) {
      nextTop += controlRect.bottom - panelRect.bottom + margin;
    }

    maximum = Math.max(0, panel.scrollHeight - panel.clientHeight);
    if (nextTop < 0) { nextTop = 0; }
    if (nextTop > maximum) { nextTop = maximum; }
    if (nextTop !== panel.scrollTop) { panel.scrollTop = nextTop; }
  }

  function focusScreenTarget(focusId) {
    var target = byId(focusId);
    if (!target) { return; }
    setTimeout(function () {
      target.focus();
      if (activeScreen === 'storybook-settings-screen') {
        ensureStorybookControlVisible(target);
      }
    }, 30);
  }

  // Storybook sound gating
  function storybookSoundModeActive() {
    return !!(
      storybookState &&
      storybookState.enabled &&
      storybookState.lastMode === 'storybook' &&
      storybookState.soundsEnabled &&
      !(player.isPlaying && player.isPlaying())
    );
  }

  function storybookSoundAllowed() {
    return !!(storybookSoundModeActive() && STORYBOOK_SOUND_SCREENS[activeScreen]);
  }

  function playStorybookCue(cueName) {
    if (!storybookSoundAllowed()) { return false; }
    return storybookSound.play(cueName);
  }

  // The engine follows stored mode, preference, and player state only, so a
  // transient browse screen between a Storybook save and the Storybook home
  // cannot clip the confirmation cue that was already started. Disabling the
  // engine stops and rewinds any active cue on its own.
  function syncStorybookSoundPreference() {
    storybookSound.setEnabled(storybookSoundModeActive());
  }

  function focusSpatialTarget(target) {
    var previous = document.activeElement;
    target.focus();
    if (document.activeElement === target && previous !== target) {
      playStorybookCue('focus');
    }
  }

  function showToast(message) {
    text('toast', message);
    byId('toast').classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { byId('toast').classList.remove('is-visible'); }, 3000);
  }

  function describeError(error, fallback) {
    if (error && error.status === 401) { return copy.get('quickConnectDisabled'); }
    if (error && error.status === 404) { return copy.get('quickConnectUnavailable'); }
    return (error && error.message) || fallback;
  }

  // Authentication
  function connect() {
    var server = byId('server-url').value;
    text('setup-error', '');
    byId('connect-button').disabled = true;
    api.connect(server).then(function () {
      localStorage.setItem('moviedeck.server', api.server);
      return api.initiateQuickConnect();
    }).then(function (result) {
      var code = value(result, 'Code', 'code');
      var secret = value(result, 'Secret', 'secret');
      if (!code || !secret) { throw new Error(copy.get('quickConnectMissingCode')); }
      text('quick-code', code.split('').join(' '));
      text('quick-error', '');
      showScreen('quick-screen', 'change-server-button');
      pollQuickConnect(secret);
    }).catch(function (error) {
      text('setup-error', describeError(error, copy.get('connectionFailed')));
      byId('connect-button').disabled = false;
      byId('server-url').focus();
    });
  }

  function pollQuickConnect(secret) {
    clearInterval(quickTimer);
    quickTimer = setInterval(function () {
      api.getQuickConnectState(secret).then(function (state) {
        if (!value(state, 'Authenticated', 'authenticated')) { return; }
        clearInterval(quickTimer);
        text('quick-error', copy.get('quickApproved'));
        return api.authenticateQuickConnect(secret).then(openLibrary);
      }).catch(function (error) {
        clearInterval(quickTimer);
        text('quick-error', describeError(error, copy.get('quickConnectStopped')));
      });
    }, 3000);
  }

  function updateProfile() {
    var username = value(api.user, 'Name', 'name') || copy.get('defaultProfileName');
    text('profile-name', username);
    text('profile-initial', username.charAt(0).toUpperCase());
  }

  // Library
  function meta(item) {
    var parts = [];
    var year = value(item, 'ProductionYear', 'productionYear');
    var rating = value(item, 'OfficialRating', 'officialRating');
    if (year) { parts.push(year); }
    if (rating) { parts.push(rating); }
    if (runtime(item)) { parts.push(runtime(item)); }
    return parts.join('  •  ');
  }

  function isStorybookReducedMotion() {
    return storybookModel.isReducedMotion(
      storybookState,
      global.matchMedia &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function selectItem(item, card) {
    selectedItem = item;
    selectedCard = card || selectedCard;
    var overview = value(item, 'Overview', 'overview') || copy.get('noSynopsis');
    var backdrop = api.imageUrl(item, 'Backdrop', 1920, 1080);
    text('hero-title', name(item));
    text('selection-title', name(item));
    text('hero-meta', meta(item));
    text('hero-overview', overview);
    text('hero-number', ('0' + ((card && Number(card.getAttribute('data-index'))) || 1)).slice(-2));
    byId('hero-backdrop').style.backgroundImage = backdrop ? 'url("' + backdrop.replace(/"/g, '%22') + '")' : 'none';
    byId('hero-open').disabled = false;
    animations.animateSelection();
  }

  function clearSelection() {
    selectedItem = null;
    selectedCard = null;
    text('selection-title', copy.get('chooseVideo'));
    text('hero-title', copy.get('heroTitle'));
    text('hero-meta', '');
    text('hero-overview', copy.get('heroOverview'));
    text('hero-number', '00');
    byId('hero-backdrop').style.backgroundImage = 'none';
    byId('hero-open').disabled = true;
  }

  function cardFor(item, index) {
    var card = document.createElement('button');
    var itemRuntime = runtime(item);
    var span = document.createElement("span");
    span.className = 'card-title';
    span.textContent = name(item);
    card.appendChild(span);
    var poster = api.imageUrl(item, 'Primary', 436, 654);
    card.className = 'movie-card focusable';
    card.setAttribute('data-focusable', '');
    card.setAttribute('data-index', String(index + 1));
    card.setAttribute('aria-label', name(item) + (itemRuntime ? ', ' + itemRuntime : ''));
    if (poster) {
      var image = document.createElement('img');
      image.src = poster;
      image.alt = '';
      image.onerror = function () { this.style.display = 'none'; card.insertBefore(fallbackFor(item), card.firstChild); };
      card.appendChild(image);
    } else {
      card.appendChild(fallbackFor(item));
    }
    if (itemRuntime) {
      var runtimeBadge = document.createElement('span');
      runtimeBadge.className = 'card-runtime';
      runtimeBadge.textContent = itemRuntime;
      card.appendChild(runtimeBadge);
    }
    if (playbackPercent(item) > 0 && playbackPercent(item) < 100) {
      var progress = document.createElement('div');
      var fill = document.createElement('span');
      progress.className = 'card-progress';
      fill.style.width = playbackPercent(item) + '%';
      progress.appendChild(fill);
      card.appendChild(progress);
    }
    card.addEventListener('focus', function () {
      if (activeScreen === 'search-screen') {
        ensureSearchVisible(card, byId('search-results').parentNode);
        return;
      }
      selectItem(item, card);
      ensureCardVisible(card);
    });
    card.addEventListener('click', function () { openDetails(item); });
    return card;
  }

  function fallbackFor(item) {
    var fallback = document.createElement('div');
    fallback.className = 'card-fallback';
    fallback.textContent = name(item);
    return fallback;
  }

  function ensureCardVisible(card) {
    var rail = card.parentNode;
    var cardRect = card.getBoundingClientRect();
    if (cardRect.right > 1840) { rail.scrollLeft += cardRect.right - 1780; }
    else if (cardRect.left < 80) { rail.scrollLeft -= 120 - cardRect.left; }
  }

  function renderShelf(title, caption, items) {
    if (!items || !items.length) { return null; }
    var shelf = document.createElement('section');
    var header = document.createElement('div');
    var heading = document.createElement('h2');
    var count = document.createElement('span');
    var rail = document.createElement('div');
    shelf.className = 'shelf';
    header.className = 'shelf-header';
    heading.textContent = title;
    count.textContent = caption || copy.get('shelfItemCount', { count: items.length });
    rail.className = 'shelf-rail';
    header.appendChild(heading);
    header.appendChild(count);
    shelf.appendChild(header);
    items.forEach(function (item, index) { rail.appendChild(cardFor(item, index)); });
    shelf.appendChild(rail);
    return shelf;
  }

  function copyIds(values) {
    return Array.isArray(values) ? values.slice() : [];
  }

  function numericNowMs(value, fallback) {
    var parsed = Number(value);
    if (isNaN(parsed)) {
      return fallback;
    }
    return parsed;
  }

  function createStorybookLaunchBootstrap() {
    var injected = global.__RAWI_STORYBOOK_BOOTSTRAP__ || {};
    var fallbackNowMs = Date.now();
    var launchNowMs = injected.nowMs !== undefined ?
      numericNowMs(injected.nowMs, fallbackNowMs) :
      fallbackNowMs;

    return {
      nowMs: launchNowMs,
      storybookSessionSeed: injected.storybookSessionSeed !== undefined ?
        String(injected.storybookSessionSeed) :
        'live-' + launchNowMs.toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    };
  }

  var storybookLaunchBootstrap = createStorybookLaunchBootstrap();

  function currentStorybookNowMs() {
    if (previewStorybookFixture && previewStorybookFixture.nowMs !== undefined) {
      return numericNowMs(previewStorybookFixture.nowMs, storybookLaunchBootstrap.nowMs);
    }
    return storybookLaunchBootstrap.nowMs;
  }

  function currentStorybookSessionSeed() {
    if (previewStorybookFixture && previewStorybookFixture.sessionSeed) {
      return String(previewStorybookFixture.sessionSeed);
    }
    return storybookLaunchBootstrap.storybookSessionSeed;
  }

  function copyCategoryTags(values) {
    var defaults = storybookPreferences.defaults().categoryTags;
    var source = values || {};
    return {
      singDance: source.singDance !== undefined ? String(source.singDance) : defaults.singDance,
      bedtime: source.bedtime !== undefined ? String(source.bedtime) : defaults.bedtime,
      animals: source.animals !== undefined ? String(source.animals) : defaults.animals,
      learning: source.learning !== undefined ? String(source.learning) : defaults.learning,
      movement: source.movement !== undefined ? String(source.movement) : defaults.movement
    };
  }

  function copyDurationLabels(values) {
    var defaults = storybookPreferences.defaults().durationLabels;
    var source = values || {};
    return {
      enabled: source.enabled !== undefined ? source.enabled === true : defaults.enabled,
      quickMaxMinutes: source.quickMaxMinutes !== undefined ? Number(source.quickMaxMinutes) : defaults.quickMaxMinutes,
      cozyMaxMinutes: source.cozyMaxMinutes !== undefined ? Number(source.cozyMaxMinutes) : defaults.cozyMaxMinutes
    };
  }

  function copyRecentHistoryDays(value) {
    var defaults = storybookPreferences.defaults();
    var parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
      return defaults.recentHistoryDays;
    }
    return parsed;
  }

  function copyStorybookState(state) {
    return {
      enabled: state && state.enabled === true,
      lastMode: state && state.lastMode === 'storybook' ? 'storybook' : 'adult',
      childName: state && typeof state.childName === 'string' ? state.childName : '',
      libraryIds: copyIds(state && state.libraryIds),
      favoriteItemIds: copyIds(state && state.favoriteItemIds),
      categoryTags: copyCategoryTags(state && state.categoryTags),
      durationLabels: copyDurationLabels(state && state.durationLabels),
      recentHistoryDays: copyRecentHistoryDays(state && state.recentHistoryDays),
      reducedMotion: !!(state && state.reducedMotion),
      soundsEnabled: state && state.soundsEnabled !== undefined ?
        state.soundsEnabled === true :
        true
    };
  }

  function currentStorybookMode() {
    return storybookState && storybookState.lastMode === 'storybook' ?
      'storybook' :
      'adult';
  }

  function saveStorybookState(overrides, options) {
    var nextState;
    var saved;

    overrides = overrides || {};
    nextState = copyStorybookState(storybookState);
    nextState.enabled = overrides.enabled !== undefined ? overrides.enabled : nextState.enabled;
    nextState.lastMode = overrides.lastMode || nextState.lastMode;
    nextState.childName = overrides.childName !== undefined ? overrides.childName : nextState.childName;
    nextState.libraryIds = overrides.libraryIds !== undefined ? copyIds(overrides.libraryIds) : nextState.libraryIds;
    nextState.favoriteItemIds = overrides.favoriteItemIds !== undefined ? copyIds(overrides.favoriteItemIds) : nextState.favoriteItemIds;
    nextState.categoryTags = overrides.categoryTags !== undefined ? copyCategoryTags(overrides.categoryTags) : nextState.categoryTags;
    nextState.durationLabels = overrides.durationLabels !== undefined ? copyDurationLabels(overrides.durationLabels) : nextState.durationLabels;
    nextState.recentHistoryDays = overrides.recentHistoryDays !== undefined ? copyRecentHistoryDays(overrides.recentHistoryDays) : nextState.recentHistoryDays;
    nextState.reducedMotion = overrides.reducedMotion !== undefined ? overrides.reducedMotion : nextState.reducedMotion;
    nextState.soundsEnabled = overrides.soundsEnabled !== undefined ?
      overrides.soundsEnabled === true :
      nextState.soundsEnabled;
    saved = storybookPreferences.save(nextState, options);
    storybookRestoreStatus = storybookPreferences.getRestoreStatus ?
      storybookPreferences.getRestoreStatus() :
      storybookRestoreStatus;
    if (!saved) {
      return {
        blocked: true,
        state: storybookState
      };
    }
    storybookState = saved;
    return {
      blocked: false,
      state: storybookState
    };
  }

  function imageUrl(item, type, width, height) {
    var previewKey = type === 'Backdrop' ? 'PreviewBackdropUrl' : 'PreviewImageUrl';
    var previewUrl = value(item, previewKey, previewKey.charAt(0).toLowerCase() + previewKey.slice(1));
    if (previewUrl) { return previewUrl; }
    return api.imageUrl(item, type, width, height);
  }

  function storybookAccentClass(key) {
    var accents = ['storybook-accent-periwinkle', 'storybook-accent-sea', 'storybook-accent-coral'];
    var text = String(key || 'storybook');
    var total = 0;
    var i;

    for (i = 0; i < text.length; i += 1) {
      total += text.charCodeAt(i);
    }

    return accents[total % accents.length];
  }

  function buildStorybookCatalogue() {
    currentStorybookCatalogue = storybookCatalogue.resolve({
      accessibleLibraries: availableLibraries,
      groups: currentGroups,
      libraryLoadState: currentLibraryLoadState,
      preferences: storybookState,
      resumeItems: currentResume
    });
    return currentStorybookCatalogue;
  }

  function buildStorybookDiscovery() {
    currentStorybookDiscovery = storybookDiscovery.build({
      catalogue: buildStorybookCatalogue(),
      nowMs: currentStorybookNowMs(),
      preferences: storybookState,
      sessionSeed: currentStorybookSessionSeed()
    });
    return currentStorybookDiscovery;
  }

  function selectedStorybookCategory(categoryKey) {
    var discovery = currentStorybookDiscovery || buildStorybookDiscovery();
    var categories = discovery.categories || [];
    var i;

    for (i = 0; i < categories.length; i += 1) {
      if (categories[i].key === categoryKey) {
        return categories[i];
      }
    }
    return null;
  }

  function firstStoryDoorFocusId() {
    var catalogue = currentStorybookCatalogue || buildStorybookCatalogue();
    if (catalogue.selectedLibraries && catalogue.selectedLibraries.length) {
      return 'storybook-door-' + catalogue.selectedLibraries[0].id;
    }
    return 'storybook-edit-libraries';
  }

  function storybookMagicRandom() {
    if (previewStorybookFixture && previewStorybookFixture.magicRandom !== undefined) {
      return function () {
        return Number(previewStorybookFixture.magicRandom);
      };
    }
    if (typeof global.RawiStorybookRandom === 'function') {
      return global.RawiStorybookRandom;
    }
    return Math.random;
  }

  function storybookMagicPickModel(result) {
    var item = result && result.item;
    return {
      accentClass: item ? storybookAccentClass(itemId(item)) : 'storybook-accent-sea',
      artworkUrl: item ? (imageUrl(item, 'Primary', 760, 760) || imageUrl(item, 'Backdrop', 1280, 720)) : '',
      empty: !item,
      minutesLabel: item ? storybookRuntime(item) : '',
      overview: item ? (value(item, 'Overview', 'overview') || copy.get('noSynopsis')) : copy.get('storybookMagicPickEmptyBody'),
      primaryActionLabel: item ? copy.get('storybookMagicPickOpenButton') : copy.get('storybookMagicPickEmptyPrimaryButton'),
      reason: item ? copy.get(result && result.reason ? result.reason.copyKey : 'storybookMagicReasonAnyStory') : '',
      secondaryActionLabel: item ? copy.get('storybookMagicPickAgainButton') : copy.get('storybookMagicPickEmptySecondaryButton'),
      title: item ? name(item) : copy.get('storybookMagicPickEmptyTitle')
    };
  }

  function renderStorybookMagicPick() {
    storybookView.renderMagicPick(storybookMagicPickModel(storybookMagicPickState.result));
  }

  function openStorybookMagicPick() {
    var result = storybookDiscovery.magicPick({
      catalogue: buildStorybookCatalogue(),
      discovery: buildStorybookDiscovery(),
      nowMs: currentStorybookNowMs(),
      preferences: storybookState,
      random: storybookMagicRandom()
    });

    storybookMagicPickState = {
      empty: !result.item,
      result: result,
      returnFocusId: 'storybook-magic-pick-button'
    };
    showScreen('storybook-magic-pick-screen');
    renderStorybookMagicPick();
  }

  function closeStorybookMagicPick() {
    showScreen('storybook-screen');
    renderStorybookHome(storybookMagicPickState.returnFocusId || 'storybook-magic-pick-button');
  }

  function handleStorybookMagicPickPrimary() {
    if (!storybookMagicPickState.result || !storybookMagicPickState.result.item) {
      showScreen('storybook-screen');
      renderStorybookHome(firstStoryDoorFocusId());
      playStorybookCue('confirm');
      return;
    }
    openStorybookDetails(storybookMagicPickState.result.item, 'magic');
    playStorybookCue('confirm');
  }

  function handleStorybookMagicPickSecondary() {
    if (!storybookMagicPickState.result || !storybookMagicPickState.result.item) {
      closeStorybookMagicPick();
      playStorybookCue('back');
      return;
    }
    openStorybookMagicPick();
    playStorybookCue('magic');
  }

  function favoriteIds() {
    return copyIds(storybookState.favoriteItemIds);
  }

  function isStorybookFavorite(item) {
    var id = itemId(item);
    return favoriteIds().indexOf(id) !== -1;
  }

  function canUseStorybookFavoriteControl() {
    return storybookState.lastMode === 'adult';
  }

  function updateFavoriteButton(item) {
    var button = byId('favorite-button');
    var active = !!(item && isStorybookFavorite(item));
    var allowed = !!(item && canUseStorybookFavoriteControl());

    if (!button) { return; }
    button.style.display = allowed ? '' : 'none';
    button.disabled = !allowed;
    button.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    button.setAttribute('aria-pressed', allowed && active ? 'true' : 'false');
    button.textContent = copy.get(active ? 'storybookFavoriteRemoveButton' : 'storybookFavoriteAddButton');
  }

  function toggleStorybookFavorite() {
    var id;
    var ids;
    var index;

    if (!selectedItem || !canUseStorybookFavoriteControl()) { return; }
    if (storybookRestoreStatus && storybookRestoreStatus.needsRecovery) {
      openStorybookSettings('favorite-button');
      return;
    }
    id = itemId(selectedItem);
    if (!id) { return; }

    ids = favoriteIds();
    index = ids.indexOf(id);
    if (index === -1) {
      ids.push(id);
      saveStorybookState({ favoriteItemIds: ids });
      updateFavoriteButton(selectedItem);
      showToast(copy.get('storybookFavoriteAddedToast', { title: name(selectedItem) }));
      return;
    }

    ids.splice(index, 1);
    saveStorybookState({ favoriteItemIds: ids });
    updateFavoriteButton(selectedItem);
    showToast(copy.get('storybookFavoriteRemovedToast', { title: name(selectedItem) }));
  }

  function maybePruneStorybookFavorites(catalogue) {
    var ids;

    if (!catalogue || !catalogue.canPruneFavorites || !catalogue.favoriteIdsToPrune.length) {
      return;
    }

    ids = favoriteIds().filter(function (id) {
      return catalogue.favoriteIdsToPrune.indexOf(String(id)) === -1;
    });

    saveStorybookState({ favoriteItemIds: ids });
  }

  function storybookCardModel(item) {
    return {
      accentClass: storybookAccentClass(itemId(item)),
      ariaLabel: copy.get('storybookItemAriaLabel', { title: name(item) }),
      artworkUrl: imageUrl(item, 'Primary', 560, 560) || imageUrl(item, 'Backdrop', 960, 540),
      id: itemId(item),
      minutesLabel: storybookRuntime(item),
      progressPercent: playbackPercent(item),
      resumeLabel: resumeTicks(item) > 0 ? copy.get('storybookResumeProgress', { time: runtimeFromTicks(resumeTicks(item)) }) : '',
      title: name(item)
    };
  }

  function storybookDetailsModel(item) {
    return {
      accentClass: storybookAccentClass(itemId(item)),
      artworkUrl: imageUrl(item, 'Primary', 760, 760) || imageUrl(item, 'Backdrop', 1280, 720),
      minutesLabel: storybookRuntime(item),
      overview: value(item, 'Overview', 'overview') || copy.get('noSynopsis'),
      primaryActionLabel: resumeTicks(item) > 0 ?
        copy.get('storybookResumeButton', { time: runtimeFromTicks(resumeTicks(item)) }) :
        copy.get('storybookStartButton'),
      progressPercent: playbackPercent(item),
      resumeLabel: resumeTicks(item) > 0 ?
        copy.get('storybookResumeProgress', { time: runtimeFromTicks(resumeTicks(item)) }) :
        '',
      showRestart: resumeTicks(item) > 0,
      title: name(item)
    };
  }

  function storybookDoorModel(group) {
    return {
      accentClass: storybookAccentClass(group.id),
      artworkUrl: '',
      id: group.id,
      name: group.name,
      subtitle: copy.get('libraryCaption', { count: group.videos.length }),
      title: group.name
    };
  }

  function previewStorybookState(fixture) {
    var defaults = storybookPreferences.defaults();
    var preferences = fixture && fixture.preferences ? fixture.preferences : {};
    return {
      version: 4,
      enabled: true,
      lastMode: 'storybook',
      childName: typeof preferences.childName === 'string' ? preferences.childName : 'Nova',
      libraryIds: Array.isArray(preferences.libraryIds) ? preferences.libraryIds.slice() : previewLibraryIds(),
      favoriteItemIds: Array.isArray(preferences.favoriteItemIds) ? preferences.favoriteItemIds.slice() : [],
      categoryTags: copyCategoryTags(preferences.categoryTags || defaults.categoryTags),
      durationLabels: copyDurationLabels(preferences.durationLabels || defaults.durationLabels),
      recentHistoryDays: copyRecentHistoryDays(preferences.recentHistoryDays),
      reducedMotion: preferences.reducedMotion === true,
      soundsEnabled: preferences.soundsEnabled !== false
    };
  }

  function previewLibraryLoadState() {
    var requests = {};
    var ids = previewLibraryIds();
    ids.forEach(function (id) {
      requests[id] = { complete: true, succeeded: true };
    });
    return {
      viewsSucceeded: true,
      requestedLibraryIds: ids,
      videoRequests: requests
    };
  }

  function previewItemById(id) {
    var catalogue = buildStorybookCatalogue();
    return catalogue.itemById[id] || catalogue.resumeItem || null;
  }

  function storybookPreviewScreen() {
    var value = queryValue('storybookScreen');
    if (value === 'library' || value === 'category' || value === 'details' || value === 'magic' || value === 'settings' || value === 'ending') {
      return value;
    }
    return 'home';
  }

  function applyStorybookPreviewRoute() {
    var screen = storybookPreviewScreen();
    var libraryId = queryValue('storybookLibraryId') || storybookState.libraryIds[0] || '';
    var categoryKey = queryValue('storybookCategoryKey') || 'animals';
    var item = previewItemById(queryValue('storybookItemId'));

    if (screen === 'library') {
      openStorybookLibrary(libraryId);
      return;
    }
    if (screen === 'category') {
      openStorybookCategory(categoryKey);
      return;
    }
    if (screen === 'details' && item) {
      openStorybookDetails(item, 'resume');
      return;
    }
    if (screen === 'magic') {
      openStorybookMagicPick();
      return;
    }
    if (screen === 'settings') {
      openStorybookSettings('storybook-settings-button');
      return;
    }
    if (screen === 'ending' && item) {
      selectedItem = item;
      showStorybookEnding();
      return;
    }

    showScreen('storybook-screen');
    renderStorybookHome();
  }

  function renderStorybookHome(preferredFocusId) {
    var catalogue = buildStorybookCatalogue();
    var discovery = buildStorybookDiscovery();

    storybookView.renderHome({
      childName: storybookState.childName,
      categories: discovery.categories.map(function (category) {
        return {
          accentClass: storybookAccentClass(category.key),
          caption: copy.get('libraryCaption', { count: category.items.length }),
          key: category.key,
          title: copy.get(category.copyKey)
        };
      }),
      favorites: catalogue.favoriteItems.map(function (item) {
        return storybookCardModel(item);
      }),
      libraries: catalogue.selectedLibraries.map(function (group) {
        return storybookDoorModel(group);
      }),
      littleMenu: discovery.littleMenu.map(function (item) {
        return storybookCardModel(item);
      }),
      preferredFocusId: preferredFocusId,
      reducedMotion: isStorybookReducedMotion(),
      resume: catalogue.resumeItem ? storybookCardModel(catalogue.resumeItem) : null,
      showMagicPick: catalogue.selectedLibraries.length > 0
    });
  }

  function selectedStorybookLibrary(libraryId) {
    var catalogue = currentStorybookCatalogue || buildStorybookCatalogue();
    var libraries = catalogue.selectedLibraries;
    var i;

    for (i = 0; i < libraries.length; i += 1) {
      if (String(libraries[i].id) === String(libraryId)) {
        return libraries[i];
      }
    }

    return null;
  }

  function renderAdultGroups(groups, includeDefaultShelves) {
    var definitions = [];
    var firstCard = null;
    var shelves = byId('shelves');

    groups = groups || [];
    shelves.innerHTML = '';
    byId('browse-error').style.display = 'none';
    if (includeDefaultShelves !== false) {
      definitions.push(
        [copy.get('continueWatchingTitle'), copy.get('continueWatchingCaption'), currentResume],
        [copy.get('recentlyAddedTitle'), copy.get('recentlyAddedCaption'), currentLatest]
      );
    }
    groups.forEach(function (group) {
      definitions.push([group.name, copy.get('libraryCaption', { count: group.videos.length }), group.videos]);
    });
    definitions.forEach(function (definition) {
      var shelf = renderShelf(definition[0], definition[1], definition[2]);
      if (shelf) {
        shelves.appendChild(shelf);
        if (!firstCard) { firstCard = shelf.querySelector('.movie-card'); }
      }
    });
    byId('browse-loading').style.display = 'none';
    animations.animateShelves();
    if (!firstCard) {
      clearSelection();
      byId('browse-error').textContent = copy.get('noVideos');
      byId('browse-error').style.display = 'block';
      byId('refresh-button').focus();
      return;
    }
    firstCard.focus();
  }

  function startStorybookPreview() {
    var fixture = global.RawiPreviewFixtures.storybook;

    previewStorybookFixture = fixture;
    api.user = fixture.user;
    updateProfile();
    availableLibraries = fixture.libraries || [];
    availableLibrariesReady = true;
    availableLibrariesFailed = false;
    availableLibrariesLoading = false;
    currentGroups = previewGroups();
    currentLatest = fixture.latest || [];
    currentResume = fixture.resume || [];
    currentLibraryLoadState = previewLibraryLoadState();
    prepareSearch();
    storybookResetConfirming = false;
    storybookState = previewStorybookState(fixture);
    storybookView.setMode('storybook');
    syncStorybookSoundPreference();
    applyStorybookPreviewRoute();
  }

  function openStorybookCollection(collectionState, preferredFocusId) {
    storybookLibraryState = collectionState;
    showScreen('storybook-library-screen');
    storybookView.renderLibrary({
      cards: collectionState.items.map(function (item) {
        return storybookCardModel(item);
      }),
      preferredFocusId: preferredFocusId,
      title: collectionState.title
    });
  }

  function openStorybookLibrary(libraryId, preferredFocusId) {
    var library = selectedStorybookLibrary(libraryId);

    if (!library) { return false; }
    openStorybookCollection({
      items: library.videos,
      kind: 'library',
      categoryKey: '',
      libraryId: libraryId,
      returnFocusId: 'storybook-door-' + libraryId,
      title: library.name
    }, preferredFocusId);
    return true;
  }

  function openStorybookCategory(categoryKey, preferredFocusId) {
    var category = selectedStorybookCategory(categoryKey);

    if (!category) { return false; }
    openStorybookCollection({
      items: category.items,
      kind: 'category',
      categoryKey: categoryKey,
      libraryId: '',
      returnFocusId: 'storybook-category-' + categoryKey,
      title: copy.get(category.copyKey)
    }, preferredFocusId);
    return true;
  }

  function closeStorybookLibrary() {
    showScreen('storybook-screen');
    renderStorybookHome(storybookLibraryState.returnFocusId);
  }

  function openStorybookDetails(item, source) {
    var id = itemId(item);

    selectedItem = item;
    updateFavoriteButton(null);
    storybookDetailsState = {
      collection: activeScreen === 'storybook-library-screen' ? {
        items: storybookLibraryState.items.slice(),
        kind: storybookLibraryState.kind,
        categoryKey: storybookLibraryState.categoryKey,
        libraryId: storybookLibraryState.libraryId,
        returnFocusId: storybookLibraryState.returnFocusId,
        title: storybookLibraryState.title
      } : null,
      focusId: source === 'library' ? 'storybook-library-card-' + id : 'storybook-' + source + '-card-' + id,
      source: source
    };
    if (source === 'resume') {
      storybookDetailsState.focusId = 'storybook-resume-card';
    }
    if (source === 'magic') {
      storybookDetailsState.focusId = 'storybook-magic-pick-primary';
    }
    showScreen('storybook-details-screen');
    storybookView.renderDetails(storybookDetailsModel(item));
  }

  function closeStorybookDetails() {
    if (storybookDetailsState.source === 'search') {
      showScreen('search-screen', storybookDetailsState.focusId);
      return;
    }
    if (storybookDetailsState.source === 'library' && storybookDetailsState.collection) {
      openStorybookCollection(storybookDetailsState.collection, storybookDetailsState.focusId);
      return;
    }
    if (storybookDetailsState.source === 'magic') {
      showScreen('storybook-magic-pick-screen');
      renderStorybookMagicPick();
      return;
    }
    showScreen('storybook-screen');
    renderStorybookHome(storybookDetailsState.focusId);
  }

  function showStorybookEnding() {
    storybookEndingState = {
      childName: storybookState.childName,
      title: name(selectedItem)
    };
    playerReturnState = {
      focusId: 'play-button',
      mode: 'adult',
      screenId: 'details-screen'
    };
    showScreen('storybook-ending-screen');
    storybookView.renderEnding(storybookEndingState);
  }

  function handleStorybookEndingAction(action) {
    var application;

    if (action === 'done' &&
        global.tizen &&
        global.tizen.application &&
        global.tizen.application.getCurrentApplication) {
      application = global.tizen.application.getCurrentApplication();
      if (application && application.exit) {
        application.exit();
        return;
      }
    }

    selectedItem = null;
    showScreen('storybook-screen');
    renderStorybookHome();
  }

  // Storybook cue-routing handlers
  function handleOpenStorybookLibrary(libraryId, preferredFocusId) {
    if (openStorybookLibrary(libraryId, preferredFocusId)) { playStorybookCue('confirm'); }
  }

  function handleOpenStorybookCategory(categoryKey, preferredFocusId) {
    if (openStorybookCategory(categoryKey, preferredFocusId)) { playStorybookCue('confirm'); }
  }

  function handleOpenStorybookItemById(id, source) {
    if (!currentStorybookCatalogue || !currentStorybookCatalogue.itemById[id]) { return; }
    openStorybookDetails(currentStorybookCatalogue.itemById[id], source);
    playStorybookCue('confirm');
  }

  function handleCloseStorybookLibrary() {
    closeStorybookLibrary();
    playStorybookCue('back');
  }

  function handleCloseStorybookDetails() {
    closeStorybookDetails();
    playStorybookCue('back');
  }

  function handleOpenStorybookMagicPick() {
    openStorybookMagicPick();
    playStorybookCue('magic');
  }

  function handleCloseStorybookMagicPick() {
    closeStorybookMagicPick();
    playStorybookCue('back');
  }

  function handleStorybookEndingButtonAction(action) {
    handleStorybookEndingAction(action);
    if (action === 'pick') { playStorybookCue('confirm'); }
  }

  // Smart title search
  function ensureSearchVisible(control, container) {
    var rect = control.getBoundingClientRect();
    var bounds = container.getBoundingClientRect();
    var margin = 12;
    if (rect.top < bounds.top + margin) {
      container.scrollTop -= bounds.top + margin - rect.top;
    } else if (rect.bottom > bounds.bottom - margin) {
      container.scrollTop += rect.bottom - bounds.bottom + margin;
    }
  }

  function prepareSearch() {
    var items = currentResume.concat(currentLatest);
    currentGroups.forEach(function (group) { items = items.concat(group.videos || []); });
    searchIndex = smartSearch.createIndex(items);
    byId('search-button').disabled = false;
  }

  function focusSearchKey(preferredIndex) {
    var best = null;
    var distance = Infinity;
    searchKeys.forEach(function (key, index) {
      if (!key.disabled && Math.abs(index - preferredIndex) < distance) {
        best = key;
        distance = Math.abs(index - preferredIndex);
      }
    });
    var fallback = byId('search-delete').disabled ? byId('search-back') : byId('search-delete');
    (best || fallback).focus();
  }

  function renderSearchResults() {
    var container = byId('search-results');
    container.innerHTML = '';
    searchMatches.slice(0, searchResultLimit).forEach(function (item, index) {
      var card = searchIsStorybook ?
        storybookView.createSearchCard(storybookCardModel(item)) : cardFor(item, index);
      if (searchIsStorybook) {
        card.addEventListener('focus', function () {
          ensureSearchVisible(card, container.parentNode);
        });
      }
      container.appendChild(card);
    });
    byId('search-more').disabled = searchResultLimit >= searchMatches.length;
    byId('search-more').style.display = byId('search-more').disabled ? 'none' : 'inline-block';
  }

  function updateSearch(preferredIndex, edit) {
    var result = smartSearch.search(searchIndex, searchQuery);
    searchMatches = result.items;
    searchResultLimit = 30;
    if (searchIsStorybook) {
      storybookView.renderSearchQuery(searchQuery, edit, isStorybookReducedMotion());
    } else {
      text('search-query', searchQuery || copy.get('searchPlaceholder'));
    }
    text('search-count', copy.get('searchCount', { count: searchMatches.length }));
    searchKeys.forEach(function (key) {
      key.disabled = result.letters.indexOf(key.getAttribute('data-letter')) === -1;
    });
    byId('search-delete').disabled = !searchQuery;
    byId('search-clear').disabled = !searchQuery;
    renderSearchResults();
    byId('search-results').parentNode.scrollTop = 0;
    if (preferredIndex !== undefined) { focusSearchKey(preferredIndex); }
  }

  function openSearch() {
    searchIsStorybook = activeScreen === 'storybook-screen';
    if (searchIsStorybook) {
      var items = [];
      buildStorybookCatalogue().selectedLibraries.forEach(function (library) {
        items = items.concat(library.videos || []);
      });
      searchIndex = smartSearch.createIndex(items);
    } else {
      prepareSearch();
    }
    searchReturnCard = selectedCard;
    searchReturnItem = selectedItem;
    searchQuery = '';
    searchKeys = [];
    var container = byId('search-keyboard');
    var letters = smartSearch.search(searchIndex, '').letters;
    var alphabet = smartSearch.characters('abcdefghijklmnopqrstuvwxyz0123456789 ');
    letters.forEach(function (letter) {
      if (alphabet.indexOf(letter) === -1) { alphabet.push(letter); }
    });
    container.innerHTML = '';
    container.scrollTop = 0;
    alphabet.forEach(function (letter, index) {
      var key = document.createElement('button');
      key.className = 'search-key focusable';
      key.setAttribute('data-focusable', '');
      key.setAttribute('data-letter', letter);
      key.textContent = letter === ' ' ? copy.get('searchSpace') : letter.toUpperCase();
      key.addEventListener('click', function () {
        if (key.disabled) { return; }
        searchQuery += letter;
        updateSearch(index, 'add');
        playStorybookCue('confirm');
      });
      key.addEventListener('focus', function () { ensureSearchVisible(key, container); });
      container.appendChild(key);
      searchKeys.push(key);
    });
    var libraryIds = searchIsStorybook ? storybookState.libraryIds :
      Object.keys(currentLibraryLoadState.videoRequests);
    var partial = libraryIds.some(function (id) {
      if (!currentLibraryLoadState.videoRequests[id]) { return true; }
      return !currentLibraryLoadState.videoRequests[id].succeeded;
    });
    text('search-warning', !searchIndex.length ? copy.get('searchEmpty') :
      partial ? copy.get('searchPartial') : '');
    showScreen('search-screen');
    byId('search-back').textContent = copy.get(searchIsStorybook ? 'storybookLibraryBackButton' : 'detailsBackButton');
    updateSearch(0);
    playStorybookCue('confirm');
  }

  function deleteSearchLetter() {
    var letters = smartSearch.characters(searchQuery);
    letters.pop();
    searchQuery = letters.join('');
    updateSearch(0, 'delete');
    playStorybookCue('back');
  }

  function openLibrary() {
    updateProfile();
    showScreen('browse-screen');
    byId('browse-loading').style.display = 'block';
    byId('browse-error').style.display = 'none';
    byId('shelves').innerHTML = '';
    byId('search-button').disabled = true;
    searchIndex = [];
    currentGroups = [];
    currentLatest = [];
    currentResume = [];
    currentLibraryLoadState = {
      viewsSucceeded: false,
      requestedLibraryIds: [],
      videoRequests: {}
    };
    var libraryGroups;
    var latestPromise;
    var resumePromise;

    if (previewStorybookFixture) {
      availableLibraries = previewStorybookFixture.libraries || [];
      availableLibrariesReady = true;
      availableLibrariesFailed = false;
      availableLibrariesLoading = false;
      latestPromise = Promise.resolve(previewStorybookFixture.latest || []);
      resumePromise = Promise.resolve(previewStorybookFixture.resume || []);
      currentLibraryLoadState = previewLibraryLoadState();
      libraryGroups = Promise.resolve(previewGroups());
    } else {
      availableLibraries = [];
      availableLibrariesReady = false;
      availableLibrariesFailed = false;
      availableLibrariesLoading = true;
      latestPromise = api.getLatest().catch(function () { return []; });
      resumePromise = api.getResume().catch(function () { return []; });
      libraryGroups = api.getLibraries().then(function (libraries) {
        libraries = libraries || [];
        availableLibraries = libraries;
        availableLibrariesLoading = false;
        availableLibrariesReady = true;
        availableLibrariesFailed = false;
        currentLibraryLoadState.viewsSucceeded = true;
        currentLibraryLoadState.requestedLibraryIds = libraries.map(function (library) {
          return itemId(library);
        });
        return Promise.all(libraries.map(function (library) {
          var libraryId = itemId(library);
          currentLibraryLoadState.videoRequests[libraryId] = {
            complete: false,
            succeeded: false
          };
          return api.getVideos(libraryId).then(function (videos) {
            currentLibraryLoadState.videoRequests[libraryId] = {
              complete: true,
              succeeded: true
            };
            return { id: libraryId, name: name(library), videos: videos };
          }).catch(function () {
            currentLibraryLoadState.videoRequests[libraryId] = {
              complete: true,
              succeeded: false
            };
            return { id: libraryId, name: name(library), videos: [] };
          });
        }));
      }).catch(function () {
        availableLibraries = [];
        availableLibrariesLoading = false;
        availableLibrariesReady = false;
        availableLibrariesFailed = true;
        currentLibraryLoadState = {
          viewsSucceeded: false,
          requestedLibraryIds: [],
          videoRequests: {}
        };
        return api.getVideos().then(function (videos) {
          return [{ name: copy.get('allVideos'), videos: videos }];
        });
      });
    }

    Promise.all([
      resumePromise,
      latestPromise,
      libraryGroups
    ]).then(function (groups) {
      currentResume = groups[0];
      currentLatest = groups[1];
      currentGroups = groups[2];
      prepareSearch();
      maybePruneStorybookFavorites(buildStorybookCatalogue());

      if (storybookState.lastMode === 'storybook') {
        byId('browse-loading').style.display = 'none';
        if (availableLibrariesFailed) {
          byId('browse-error').textContent = copy.get('libraryLoadFailed');
          byId('browse-error').style.display = 'block';
          focusScreenTarget('refresh-button');
          return;
        }
        // Sign-out disables the engine outright, and re-authentication comes
        // back through here rather than through a mode toggle or a settings
        // save, so this is the only re-entry point that can restore the engine
        // from the stored mode, preference, and player state. Syncing before
        // the home renders keeps an already-started cue -- such as the settings
        // save confirmation -- running, because an enabling sync never stops
        // audio, and it cannot activate Adult mode because it only reads state.
        syncStorybookSoundPreference();
        showScreen('storybook-screen');
        renderStorybookHome();
        return;
      }
      renderAdultGroups(currentGroups);
    }).catch(function (error) {
      if (error && error.status === 401) {
        api.signOut();
        byId('browse-loading').style.display = 'none';
        byId('server-url').value = api.server || defaultServer;
        text('setup-error', copy.get('sessionExpired'));
        showScreen('setup-screen', 'connect-button');
        return;
      }
      byId('browse-loading').style.display = 'none';
      byId('browse-error').textContent = describeError(error, copy.get('libraryLoadFailed'));
      byId('browse-error').style.display = 'block';
      byId('refresh-button').focus();
    });
  }

  function storybookSettingsGateMessage() {
    if (availableLibrariesLoading) { return copy.get('browseLoading'); }
    if (availableLibrariesFailed || !availableLibrariesReady) {
      return copy.get('libraryLoadFailed');
    }
    return '';
  }

  function storybookSettingsRecovery() {
    if (!storybookRestoreStatus || !storybookRestoreStatus.needsRecovery) {
      return null;
    }

    return {
      confirmingReset: storybookResetConfirming,
      needsRecovery: true,
      type: storybookRestoreStatus.type,
      version: storybookRestoreStatus.version
    };
  }

  function storybookSettingsFocusTargetId() {
    return storybookRestoreStatus && storybookRestoreStatus.needsRecovery ?
      'storybook-reset' :
      'storybook-child-name';
  }

  function renderStorybookSettings() {
    var libraries = availableLibrariesReady ? availableLibraries : [];
    var resolution = availableLibrariesReady ?
      storybookModel.resolveLibraries(libraries, storybookState.libraryIds) :
      { missingIds: [] };

    storybookView.renderSettings(
      libraries,
      storybookState,
      resolution.missingIds,
      storybookSettingsRecovery()
    );
  }

  function rememberStorybookSettingsFocus(controlId) {
    var activeId = document.activeElement && document.activeElement.id ?
      document.activeElement.id : '';

    if (controlId && byId(controlId)) {
      storybookSettingsReturnFocusId = controlId;
      return;
    }
    if (activeId && byId(activeId)) {
      storybookSettingsReturnFocusId = activeId;
      return;
    }
    storybookSettingsReturnFocusId = previousScreen === 'details-screen' ?
      'details-storybook-mode-button' : 'storybook-settings-button';
  }

  function setStorybookSettingsIntent(options) {
    storybookSettingsIntent = {
      activateStorybookOnSave: !!(options && options.activateStorybookOnSave),
      modeOnOpen: storybookState.lastMode
    };
  }

  function applyMode(mode, controlId) {
    var nextMode = mode === 'storybook' ? 'storybook' : 'adult';
    var activeMode = currentStorybookMode();
    var saveResult;

    if (storybookRestoreStatus && storybookRestoreStatus.needsRecovery) {
      if (nextMode === activeMode) {
        storybookView.setMode(activeMode);
        return;
      }
      openStorybookSettings(controlId, { activateStorybookOnSave: nextMode === 'storybook' });
      return;
    }

    if (nextMode === 'storybook' && !storybookState.libraryIds.length) {
      if (!openStorybookSettings(controlId, { activateStorybookOnSave: true })) { return; }
      showToast(copy.get('storybookSetupRequired'));
      return;
    }

    saveResult = saveStorybookState({
      enabled: storybookState.enabled || nextMode === 'storybook',
      favoriteItemIds: storybookState.favoriteItemIds,
      lastMode: nextMode
    });

    if (saveResult.blocked) {
      if (nextMode === activeMode) {
        storybookView.setMode(activeMode);
        return;
      }
      openStorybookSettings(controlId, { activateStorybookOnSave: nextMode === 'storybook' });
      return;
    }

    storybookResetConfirming = false;
    if (nextMode === 'adult') { storybookSound.stop(); }
    storybookView.setMode(nextMode);
    syncStorybookSoundPreference();
    openLibrary();
  }

  function openStorybookSettings(controlId, options) {
    var recovery = storybookSettingsRecovery();
    var message = recovery ? '' : storybookSettingsGateMessage();
    var panel;

    if (message) {
      showToast(message);
      return false;
    }

    setStorybookSettingsIntent(options);
    previousScreen = activeScreen === 'storybook-settings-screen' ?
      previousScreen : activeScreen;
    rememberStorybookSettingsFocus(controlId);
    renderStorybookSettings();
    panel = storybookSettingsPanel();
    if (panel) { panel.scrollTop = 0; }
    showScreen('storybook-settings-screen', storybookSettingsFocusTargetId());
    return true;
  }

  function saveStorybookSettings(nextPreferences) {
    var saveResult;

    if (storybookRestoreStatus && storybookRestoreStatus.needsRecovery) { return; }
    saveResult = saveStorybookState({
      enabled: true,
      favoriteItemIds: storybookState.favoriteItemIds,
      lastMode: storybookSettingsIntent.activateStorybookOnSave ? 'storybook' : storybookSettingsIntent.modeOnOpen,
      childName: nextPreferences.childName,
      libraryIds: nextPreferences.libraryIds,
      categoryTags: nextPreferences.categoryTags,
      durationLabels: nextPreferences.durationLabels,
      recentHistoryDays: nextPreferences.recentHistoryDays,
      reducedMotion: nextPreferences.reducedMotion,
      soundsEnabled: nextPreferences.soundsEnabled
    });
    if (saveResult.blocked) {
      renderStorybookSettings();
      return;
    }
    storybookResetConfirming = false;
    setStorybookSettingsIntent();
    storybookView.setMode(storybookState.lastMode);
    syncStorybookSoundPreference();
    playStorybookCue('confirm');
    showToast(copy.get('storybookSettingsSaved'));
    openLibrary();
  }

  function resetStorybookSettingsRecovery() {
    if (!storybookRestoreStatus || !storybookRestoreStatus.needsRecovery) { return; }

    if (!storybookResetConfirming) {
      storybookResetConfirming = true;
      renderStorybookSettings();
      focusScreenTarget('storybook-reset');
      return;
    }

    storybookState = storybookPreferences.reset ?
      storybookPreferences.reset() :
      storybookPreferences.save(storybookPreferences.defaults(), { allowRecoveryWrite: true });
    storybookRestoreStatus = storybookPreferences.getRestoreStatus ?
      storybookPreferences.getRestoreStatus() :
      { needsRecovery: false, type: 'ok' };
    storybookResetConfirming = false;
    storybookView.setMode(storybookState.lastMode);
    syncStorybookSoundPreference();
    renderStorybookSettings();
    focusScreenTarget('storybook-child-name');
  }

  function cancelStorybookSettings() {
    storybookResetConfirming = false;
    setStorybookSettingsIntent();
    showScreen(previousScreen, storybookSettingsReturnFocusId);
  }

  // Details and playback
  function openDetails(item) {
    if (activeScreen === 'browse-screen' || activeScreen === 'search-screen') {
      detailsReturnScreen = activeScreen;
      detailsReturnCard = activeScreen === 'search-screen' ? document.activeElement : selectedCard;
    }
    selectedItem = item;
    var poster = api.imageUrl(item, 'Primary', 700, 1050);
    var backdrop = api.imageUrl(item, 'Backdrop', 1920, 1080);
    var genres = value(item, 'Genres', 'genres') || [];
    byId('details-poster').src = poster;
    byId('details-poster').alt = copy.get('posterAlt', { title: name(item) });
    byId('details-backdrop').style.backgroundImage = backdrop ? 'url("' + backdrop.replace(/"/g, '%22') + '")' : 'none';
    text('details-title', name(item));
    text('details-meta', meta(item));
    text('details-overview', value(item, 'Overview', 'overview') || copy.get('noSynopsis'));
    byId('details-genres').innerHTML = '';
    genres.slice(0, 4).forEach(function (genre) {
      var pill = document.createElement('span');
      pill.textContent = genre;
      byId('details-genres').appendChild(pill);
    });
    byId('play-button').textContent = resumeTicks(item) > 0 ?
      copy.get('resumeButton', { time: runtimeFromTicks(resumeTicks(item)) }) :
      copy.get('playButton');
    byId('restart-button').style.display = resumeTicks(item) > 0 ? 'inline-block' : 'none';
    updateFavoriteButton(item);
    showScreen('details-screen', 'play-button');
  }

  function runtimeFromTicks(ticksValue) {
    var minutes = Math.floor(ticksValue / 600000000);
    var hours = Math.floor(minutes / 60);
    minutes %= 60;
    return hours ? hours + 'h ' + minutes + 'm' : minutes + 'm';
  }

  function capturePlayerReturnState() {
    if (activeScreen === 'storybook-details-screen') {
      playerReturnState = {
        focusId: 'storybook-details-play',
        mode: 'storybook',
        screenId: 'storybook-details-screen'
      };
      return;
    }

    playerReturnState = {
      focusId: 'play-button',
      mode: 'adult',
      screenId: 'details-screen'
    };
  }

  function returnFromPlayback(completed, error) {
    restoreScreenAfterPlayback(completed, error);
    syncStorybookSoundPreference();
  }

  function restoreScreenAfterPlayback(completed, error) {
    if (error) {
      if (playerReturnState.mode === 'storybook') {
        showScreen('storybook-details-screen');
        storybookView.renderDetails(storybookDetailsModel(selectedItem));
      } else {
        showScreen('details-screen', 'play-button');
      }
      showToast(describeError(error, copy.get('playbackFailed')));
      return;
    }

    if (playerReturnState.mode === 'storybook') {
      if (completed) {
        showStorybookEnding();
        return;
      }
      showScreen('storybook-details-screen');
      storybookView.renderDetails(storybookDetailsModel(selectedItem));
      return;
    }

    showScreen('details-screen', 'play-button');
    if (completed) { showToast(copy.get('finishedToast', { title: name(selectedItem) })); }
  }

  function startPlayback(fromBeginning) {
    var started;
    if (!selectedItem) { return; }
    storybookSound.stop();
    capturePlayerReturnState();
    pendingPlaybackError = null;
    showScreen('player-screen');
    started = player.play(selectedItem, fromBeginning);
    // The player only reports itself as playing once its playback-info request
    // settles, so syncing on this turn would read the pre-playback state and
    // leave the engine enabled. Both outcomes sync: a fulfilled start has
    // established playback, and a handled failure has returned to a state the
    // sync should reflect.
    if (started && typeof started.then === 'function') {
      started.then(syncStorybookSoundPreference, syncStorybookSoundPreference);
      return;
    }
    syncStorybookSoundPreference();
  }

  function playerStopped(completed) {
    var playbackError = pendingPlaybackError;
    pendingPlaybackError = null;
    returnFromPlayback(completed, playbackError);
  }

  function signOut() {
    if (!signOutTimer) {
      showToast(copy.get('signOutConfirm'));
      signOutTimer = setTimeout(function () { signOutTimer = null; }, 3000);
      return;
    }
    clearTimeout(signOutTimer);
    signOutTimer = null;
    storybookSound.stop();
    api.signOut();
    storybookSound.setEnabled(false);
    selectedItem = null;
    showScreen('setup-screen', 'server-url');
    text('setup-error', copy.get('signedOut'));
  }

  // Remote navigation
  function spatialMove(direction) {
    var current = document.activeElement;
    var nodes = Array.prototype.slice.call(document.querySelectorAll('#' + activeScreen + ' [data-focusable]:not([disabled])'));
    var settingsIndex;
    var settingsNextIndex;
    if (!current || nodes.indexOf(current) === -1) { if (nodes[0]) { nodes[0].focus(); } return; }

    if (activeScreen === 'storybook-settings-screen' && (direction === 'down' || direction === 'up')) {
      settingsIndex = nodes.indexOf(current);
      settingsNextIndex = direction === 'down' ? settingsIndex + 1 : settingsIndex - 1;
      if (settingsNextIndex < 0 || settingsNextIndex >= nodes.length) { return; }
      focusSpatialTarget(nodes[settingsNextIndex]);
      ensureStorybookControlVisible(nodes[settingsNextIndex]);
      return;
    }

    var origin = current.getBoundingClientRect();
    var ox = origin.left + origin.width / 2;
    var oy = origin.top + origin.height / 2;
    var best = null;
    var bestScore = Infinity;
    nodes.forEach(function (node) {
      if (node === current || node.offsetParent === null) { return; }
      var rect = node.getBoundingClientRect();
      var dx = rect.left + rect.width / 2 - ox;
      var dy = rect.top + rect.height / 2 - oy;
      if ((direction === 'left' && dx >= -5) || (direction === 'right' && dx <= 5) || (direction === 'up' && dy >= -5) || (direction === 'down' && dy <= 5)) { return; }
      var primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
      var secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
      var score = primary + secondary * 2.4;
      if (score < bestScore) { bestScore = score; best = node; }
    });
    if (best) {
      if (activeScreen === 'browse-screen' && (direction === 'up' || direction === 'down')) {
        animations.focusCard(best);
        return;
      }
      focusSpatialTarget(best);
    }
  }

  function handleBack() {
    if (activeScreen === 'player-screen') { returnFromPlayback(false, null); return; }
    if (activeScreen === 'storybook-settings-screen') {
      cancelStorybookSettings();
      playStorybookCue('back');
      return;
    }
    if (activeScreen === 'storybook-ending-screen') {
      handleStorybookEndingAction('pick');
      playStorybookCue('back');
      return;
    }
    if (activeScreen === 'storybook-details-screen') {
      handleCloseStorybookDetails();
      return;
    }
    if (activeScreen === 'storybook-magic-pick-screen') {
      handleCloseStorybookMagicPick();
      return;
    }
    if (activeScreen === 'storybook-library-screen') {
      handleCloseStorybookLibrary();
      return;
    }
    if (activeScreen === 'search-screen') {
      if (searchIsStorybook) {
        showScreen('storybook-screen');
        renderStorybookHome('storybook-search-button');
        playStorybookCue('back');
        return;
      }
      showScreen('browse-screen', 'search-button');
      selectedCard = searchReturnCard;
      selectedItem = searchReturnItem;
      return;
    }
    if (activeScreen === 'details-screen') {
      showScreen(detailsReturnScreen);
      if (detailsReturnCard) { detailsReturnCard.focus(); }
      else if (selectedCard) { selectedCard.focus(); }
      return;
    }
    if (activeScreen === 'quick-screen') { clearInterval(quickTimer); showScreen('setup-screen', 'server-url'); return; }
    if (activeScreen === 'browse-screen' && global.tizen && global.tizen.application) { global.tizen.application.getCurrentApplication().exit(); }
  }

  function registerEvents() {
    byId('connect-button').addEventListener('click', connect);
    byId('server-url').addEventListener('keydown', function (event) { if (event.keyCode === 13) { connect(); } });
    byId('change-server-button').addEventListener('click', function () { clearInterval(quickTimer); showScreen('setup-screen', 'server-url'); });
    byId('refresh-button').addEventListener('click', openLibrary);
    byId('search-button').addEventListener('click', openSearch);
    byId('storybook-search-button').addEventListener('click', openSearch);
    byId('search-back').addEventListener('click', handleBack);
    byId('search-delete').addEventListener('click', deleteSearchLetter);
    byId('search-clear').addEventListener('click', function () {
      searchQuery = '';
      updateSearch(0);
    });
    byId('search-more').addEventListener('click', function () {
      var previousLimit = searchResultLimit;
      searchResultLimit += 30;
      renderSearchResults();
      var firstNewCard = byId('search-results').children[previousLimit];
      if (firstNewCard) { firstNewCard.focus(); }
    });
    byId('profile-button').addEventListener('click', signOut);
    byId('hero-open').addEventListener('click', function () { if (selectedItem) { openDetails(selectedItem); } });
    byId('details-back').addEventListener('click', handleBack);
    byId('play-button').addEventListener('click', function () { startPlayback(false); });
    byId('restart-button').addEventListener('click', function () { startPlayback(true); });
    byId('favorite-button').addEventListener('click', toggleStorybookFavorite);

    document.addEventListener('keydown', function (event) {
      var code = event.keyCode;
      if (activeScreen === 'player-screen' && player.isPlaying()) {
        event.preventDefault();
        player.handleKey(code);
        return;
      }
      if (code === 37) { event.preventDefault(); spatialMove('left'); }
      else if (code === 38) { event.preventDefault(); spatialMove('up'); }
      else if (code === 39) { event.preventDefault(); spatialMove('right'); }
      else if (code === 40) { event.preventDefault(); spatialMove('down'); }
      else if (code === 8 && activeScreen === 'search-screen' && searchQuery) {
        event.preventDefault();
        deleteSearchLetter();
      }
      else if (code === 10009 || code === 8) { event.preventDefault(); handleBack(); }
    });
  }

  // Initialization
  function updateClock() {
    var now = new Date();
    var hours = now.getHours();
    var minutes = ('0' + now.getMinutes()).slice(-2);
    text('clock', (hours % 12 || 12) + ':' + minutes + (hours >= 12 ? ' PM' : ' AM'));
  }

  function init() {
    storybookSound.init();
    syncStorybookSoundPreference();
    storybookView.init({
      onCancelSettings: function () {
        cancelStorybookSettings();
        playStorybookCue('back');
      },
      onCloseStorybookDetails: handleCloseStorybookDetails,
      onCloseStorybookLibrary: handleCloseStorybookLibrary,
      onModeChange: applyMode,
      onOpenCategory: handleOpenStorybookCategory,
      onOpenLibrary: handleOpenStorybookLibrary,
      onOpenSettings: openStorybookSettings,
      onOpenStorybookItem: handleOpenStorybookItemById,
      onOpenMagicPick: handleOpenStorybookMagicPick,
      onCloseMagicPick: handleCloseStorybookMagicPick,
      onMagicPickPrimary: handleStorybookMagicPickPrimary,
      onMagicPickSecondary: handleStorybookMagicPickSecondary,
      onStorybookEndingAction: handleStorybookEndingButtonAction,
      onStartStorybookPlayback: startPlayback,
      onResetSettingsRecovery: resetStorybookSettingsRecovery,
      onPreferencesChange: saveStorybookSettings
    });
    storybookView.setMode(storybookState.lastMode);
    copy.apply(document);
    registerEvents();
    player.init({
      onStop: playerStopped,
      onError: function (error) {
        if (player.isPlaying()) {
          pendingPlaybackError = error;
          player.stop(false);
          return;
        }
        returnFromPlayback(false, error);
      }
    });
    updateClock();
    setInterval(updateClock, 30000);
    byId('server-url').value = localStorage.getItem('moviedeck.server') || defaultServer;
    if (queryValue('preview') === 'storybook') {
      startStorybookPreview();
    } else if (api.restore()) {
      openLibrary();
    } else {
      showScreen('setup-screen', 'server-url');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
}(window));
