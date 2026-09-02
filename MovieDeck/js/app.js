(function (global) {
  'use strict';

  var api = global.MovieDeckApi;
  var animations = global.MovieDeckAnimations;
  var copy = global.RawiCopy;
  var player = global.MovieDeckPlayer;
  var storybookCatalogue = global.RawiStorybookCatalogue;
  var storybookModel = global.RawiStorybookModel;
  var storybookPreferences = global.RawiStorybookPreferences;
  var storybookView = global.RawiStorybookView;
  var value = global.MovieDeckValue;

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
  var currentGroups = [];
  var currentLatest = [];
  var currentResume = [];
  var defaultServer = 'http://192.168.1.2:8096';
  var previousScreen = 'browse-screen';
  var previewStorybookFixture = null;
  var storybookLibraryState = {
    libraryId: '',
    returnFocusId: ''
  };
  var storybookDetailsState = {
    focusId: '',
    libraryId: '',
    source: 'home'
  };
  var storybookEndingState = {
    childName: '',
    title: ''
  };
  var STORYBOOK_PRESENTATION_SCREENS = {
    'storybook-screen': true,
    'storybook-library-screen': true,
    'storybook-details-screen': true,
    'storybook-ending-screen': true
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
    card.addEventListener('focus', function () { selectItem(item, card); ensureCardVisible(card); });
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
      reducedMotion: !!(state && state.reducedMotion)
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
    nextState.reducedMotion = overrides.reducedMotion !== undefined ? overrides.reducedMotion : nextState.reducedMotion;
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
      version: 3,
      enabled: true,
      lastMode: 'storybook',
      childName: typeof preferences.childName === 'string' ? preferences.childName : 'Nova',
      libraryIds: Array.isArray(preferences.libraryIds) ? preferences.libraryIds.slice() : previewLibraryIds(),
      favoriteItemIds: Array.isArray(preferences.favoriteItemIds) ? preferences.favoriteItemIds.slice() : [],
      categoryTags: copyCategoryTags(preferences.categoryTags || defaults.categoryTags),
      durationLabels: copyDurationLabels(preferences.durationLabels || defaults.durationLabels),
      recentHistoryDays: copyRecentHistoryDays(preferences.recentHistoryDays),
      reducedMotion: preferences.reducedMotion === true
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
    if (value === 'library' || value === 'details' || value === 'ending') {
      return value;
    }
    return 'home';
  }

  function applyStorybookPreviewRoute() {
    var screen = storybookPreviewScreen();
    var libraryId = queryValue('storybookLibraryId') || storybookState.libraryIds[0] || '';
    var item = previewItemById(queryValue('storybookItemId'));

    if (screen === 'library') {
      openStorybookLibrary(libraryId);
      return;
    }
    if (screen === 'details' && item) {
      openStorybookDetails(item, 'resume');
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

    storybookView.renderHome({
      childName: storybookState.childName,
      favorites: catalogue.favoriteItems.map(function (item) {
        return storybookCardModel(item);
      }),
      libraries: catalogue.selectedLibraries.map(function (group) {
        return storybookDoorModel(group);
      }),
      preferredFocusId: preferredFocusId,
      reducedMotion: isStorybookReducedMotion(),
      resume: catalogue.resumeItem ? storybookCardModel(catalogue.resumeItem) : null
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
    storybookResetConfirming = false;
    storybookState = previewStorybookState(fixture);
    storybookView.setMode('storybook');
    applyStorybookPreviewRoute();
  }

  function openStorybookLibrary(libraryId, preferredFocusId) {
    var library = selectedStorybookLibrary(libraryId);

    if (!library) { return; }

    storybookLibraryState = {
      libraryId: libraryId,
      returnFocusId: 'storybook-door-' + libraryId
    };

    showScreen('storybook-library-screen');
    storybookView.renderLibrary({
      cards: library.videos.map(function (item) {
        return storybookCardModel(item);
      }),
      libraryId: libraryId,
      preferredFocusId: preferredFocusId,
      title: library.name
    });
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
      focusId: source === 'library' ? 'storybook-library-card-' + id : 'storybook-' + source + '-card-' + id,
      libraryId: currentStorybookCatalogue && currentStorybookCatalogue.libraryIdByItemId[id] ?
        currentStorybookCatalogue.libraryIdByItemId[id] : '',
      source: source
    };
    if (source === 'resume') {
      storybookDetailsState.focusId = 'storybook-resume-card';
    }
    showScreen('storybook-details-screen');
    storybookView.renderDetails(storybookDetailsModel(item));
  }

  function closeStorybookDetails() {
    if (storybookDetailsState.source === 'library') {
      openStorybookLibrary(storybookDetailsState.libraryId, storybookDetailsState.focusId);
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

  function openLibrary() {
    updateProfile();
    showScreen('browse-screen');
    byId('browse-loading').style.display = 'block';
    byId('browse-error').style.display = 'none';
    byId('shelves').innerHTML = '';
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
      maybePruneStorybookFavorites(buildStorybookCatalogue());

      if (storybookState.lastMode === 'storybook') {
        byId('browse-loading').style.display = 'none';
        if (availableLibrariesFailed) {
          byId('browse-error').textContent = copy.get('libraryLoadFailed');
          byId('browse-error').style.display = 'block';
          focusScreenTarget('refresh-button');
          return;
        }
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
    storybookView.setMode(nextMode);
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
      reducedMotion: nextPreferences.reducedMotion
    });
    if (saveResult.blocked) {
      renderStorybookSettings();
      return;
    }
    storybookResetConfirming = false;
    setStorybookSettingsIntent();
    storybookView.setMode(storybookState.lastMode);
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
    if (!selectedItem) { return; }
    capturePlayerReturnState();
    pendingPlaybackError = null;
    showScreen('player-screen');
    player.play(selectedItem, fromBeginning);
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
    api.signOut();
    selectedItem = null;
    showScreen('setup-screen', 'server-url');
    text('setup-error', copy.get('signedOut'));
  }

  // Remote navigation
  function spatialMove(direction) {
    var current = document.activeElement;
    var nodes = Array.prototype.slice.call(document.querySelectorAll('#' + activeScreen + ' [data-focusable]:not([disabled])'));
    if (!current || nodes.indexOf(current) === -1) { if (nodes[0]) { nodes[0].focus(); } return; }
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
      best.focus();
      if (activeScreen === 'storybook-settings-screen') {
        ensureStorybookControlVisible(best);
      }
    }
  }

  function handleBack() {
    if (activeScreen === 'player-screen') { returnFromPlayback(false, null); return; }
    if (activeScreen === 'storybook-settings-screen') {
      cancelStorybookSettings();
      return;
    }
    if (activeScreen === 'storybook-ending-screen') {
      handleStorybookEndingAction('pick');
      return;
    }
    if (activeScreen === 'storybook-details-screen') { closeStorybookDetails(); return; }
    if (activeScreen === 'storybook-library-screen') {
      closeStorybookLibrary();
      return;
    }
    if (activeScreen === 'details-screen') { showScreen('browse-screen'); if (selectedCard) { selectedCard.focus(); } return; }
    if (activeScreen === 'quick-screen') { clearInterval(quickTimer); showScreen('setup-screen', 'server-url'); return; }
    if (activeScreen === 'browse-screen' && global.tizen && global.tizen.application) { global.tizen.application.getCurrentApplication().exit(); }
  }

  function registerEvents() {
    byId('connect-button').addEventListener('click', connect);
    byId('server-url').addEventListener('keydown', function (event) { if (event.keyCode === 13) { connect(); } });
    byId('change-server-button').addEventListener('click', function () { clearInterval(quickTimer); showScreen('setup-screen', 'server-url'); });
    byId('refresh-button').addEventListener('click', openLibrary);
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
    storybookView.init({
      onCancelSettings: cancelStorybookSettings,
      onCloseStorybookDetails: closeStorybookDetails,
      onCloseStorybookLibrary: closeStorybookLibrary,
      onModeChange: applyMode,
      onOpenLibrary: openStorybookLibrary,
      onOpenSettings: openStorybookSettings,
      onOpenStorybookItem: function (itemId, source) {
        if (!currentStorybookCatalogue || !currentStorybookCatalogue.itemById[itemId]) { return; }
        openStorybookDetails(currentStorybookCatalogue.itemById[itemId], source);
      },
      onStorybookEndingAction: handleStorybookEndingAction,
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
