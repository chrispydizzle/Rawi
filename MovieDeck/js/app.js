(function (global) {
  'use strict';

  var api = global.MovieDeckApi;
  var animations = global.MovieDeckAnimations;
  var copy = global.RawiCopy;
  var player = global.MovieDeckPlayer;
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
  var availableLibraries = [];
  var availableLibrariesReady = false;
  var availableLibrariesFailed = false;
  var availableLibrariesLoading = false;
  var currentGroups = [];
  var currentLatest = [];
  var currentResume = [];
  var defaultServer = 'http://192.168.1.2:8096';
  var previousScreen = 'browse-screen';
  var previewStorybookFixture = null;
  var storybookLibraryOpen = false;
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
    if (!(id === 'storybook-screen' && storybookState.lastMode === 'storybook' && isStorybookReducedMotion())) {
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

  function currentStorybookGroups() {
    return currentGroups.filter(function (group) {
      return storybookState.libraryIds.indexOf(String(group.id)) !== -1;
    });
  }

  function renderStorybookHome() {
    storybookView.renderHome({
      childName: storybookState.childName,
      libraries: currentStorybookGroups(),
      reducedMotion: isStorybookReducedMotion()
    });
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
    availableLibraries = fixture.libraries;
    availableLibrariesReady = true;
    availableLibrariesFailed = false;
    availableLibrariesLoading = false;
    currentGroups = fixture.groups;
    currentLatest = [];
    currentResume = [];
    storybookState = storybookPreferences.defaults();
    storybookState.enabled = true;
    storybookState.lastMode = 'storybook';
    storybookState.childName = 'Nova';
    storybookState.libraryIds = previewLibraryIds();
    storybookView.setMode('storybook');
    showScreen('storybook-screen');
    storybookView.renderHome({
      childName: storybookState.childName,
      libraries: previewGroups(),
      reducedMotion: false
    });
  }

  function openStorybookLibrary(libraryId) {
    storybookLibraryOpen = true;
    showScreen('browse-screen');
    renderAdultGroups(currentGroups.filter(function (group) {
      return group.id === libraryId;
    }), false);
  }

  function openLibrary() {
    updateProfile();
    storybookLibraryOpen = false;
    showScreen('browse-screen');
    byId('browse-loading').style.display = 'block';
    byId('browse-error').style.display = 'none';
    byId('shelves').innerHTML = '';
    currentGroups = [];
    currentLatest = [];
    currentResume = [];
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
        return Promise.all(libraries.map(function (library) {
          return api.getVideos(itemId(library)).then(function (videos) {
            return { id: itemId(library), name: name(library), videos: videos };
          }).catch(function () {
            return { id: itemId(library), name: name(library), videos: [] };
          });
        }));
      }).then(function (groups) {
        return groups.filter(function (group) { return group.videos.length > 0; });
      }).catch(function () {
        availableLibraries = [];
        availableLibrariesLoading = false;
        availableLibrariesReady = false;
        availableLibrariesFailed = true;
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
    if (nextMode === 'storybook' && !storybookState.libraryIds.length) {
      if (!openStorybookSettings(controlId, { activateStorybookOnSave: true })) { return; }
      showToast(copy.get('storybookSetupRequired'));
      return;
    }
    storybookState.lastMode = nextMode;
    storybookState.enabled = storybookState.enabled || nextMode === 'storybook';
    storybookState = storybookPreferences.save(storybookState);
    storybookView.setMode(nextMode);
    openLibrary();
  }

  function openStorybookSettings(controlId, options) {
    var message = storybookSettingsGateMessage();
    var panel;
    var resolution;

    if (message) {
      showToast(message);
      return false;
    }

    setStorybookSettingsIntent(options);
    resolution = storybookModel.resolveLibraries(
      availableLibraries,
      storybookState.libraryIds
    );
    previousScreen = activeScreen === 'storybook-settings-screen' ?
      previousScreen : activeScreen;
    rememberStorybookSettingsFocus(controlId);
    storybookView.renderSettings(
      availableLibraries,
      storybookState,
      resolution.missingIds
    );
    panel = storybookSettingsPanel();
    if (panel) { panel.scrollTop = 0; }
    showScreen('storybook-settings-screen', 'storybook-child-name');
    return true;
  }

  function saveStorybookSettings(nextPreferences) {
    storybookState = storybookPreferences.save({
      enabled: true,
      lastMode: storybookSettingsIntent.activateStorybookOnSave ? 'storybook' : storybookSettingsIntent.modeOnOpen,
      childName: nextPreferences.childName,
      libraryIds: nextPreferences.libraryIds,
      reducedMotion: nextPreferences.reducedMotion
    });
    setStorybookSettingsIntent();
    storybookView.setMode(storybookState.lastMode);
    showToast(copy.get('storybookSettingsSaved'));
    openLibrary();
  }

  function cancelStorybookSettings() {
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
    showScreen('details-screen', 'play-button');
  }

  function runtimeFromTicks(ticksValue) {
    var minutes = Math.floor(ticksValue / 600000000);
    var hours = Math.floor(minutes / 60);
    minutes %= 60;
    return hours ? hours + 'h ' + minutes + 'm' : minutes + 'm';
  }

  function startPlayback(fromBeginning) {
    if (!selectedItem) { return; }
    showScreen('player-screen');
    player.play(selectedItem, fromBeginning);
  }

  function playerStopped(completed) {
    showScreen('details-screen', 'play-button');
    if (completed) { showToast(copy.get('finishedToast', { title: name(selectedItem) })); }
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
    if (activeScreen === 'player-screen') { showScreen('details-screen', 'play-button'); return; }
    if (activeScreen === 'storybook-settings-screen') {
      cancelStorybookSettings();
      return;
    }
    if (activeScreen === 'details-screen') { showScreen('browse-screen'); if (selectedCard) { selectedCard.focus(); } return; }
    if (activeScreen === 'quick-screen') { clearInterval(quickTimer); showScreen('setup-screen', 'server-url'); return; }
    if (activeScreen === 'browse-screen' && storybookLibraryOpen) {
      storybookLibraryOpen = false;
      showScreen('storybook-screen');
      renderStorybookHome();
      return;
    }
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

    document.addEventListener('keydown', function (event) {
      var code = event.keyCode;
      if (player.isPlaying()) { event.preventDefault(); player.handleKey(code); return; }
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
      onModeChange: applyMode,
      onOpenLibrary: openStorybookLibrary,
      onOpenSettings: openStorybookSettings,
      onPreferencesChange: saveStorybookSettings
    });
    storybookView.setMode(storybookState.lastMode);
    copy.apply(document);
    registerEvents();
    player.init({
      onStop: playerStopped,
      onError: function (error) {
        if (player.isPlaying()) { player.stop(false); }
        else { showScreen('details-screen', 'play-button'); }
        showToast(describeError(error, copy.get('playbackFailed')));
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
