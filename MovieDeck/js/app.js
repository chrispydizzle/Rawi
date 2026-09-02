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
  var defaultServer = 'http://192.168.1.2:8096';
  var previousScreen = 'browse-screen';

  // DOM and item helpers
  function byId(id) { return document.getElementById(id); }
  function text(id, content) { byId(id).textContent = content || ''; }
  function name(item) { return value(item, 'Name', 'name') || copy.get('untitled'); }
  function itemId(item) { return value(item, 'Id', 'id'); }
  function runtime(item) {
    var ticks = value(item, 'RunTimeTicks', 'runTimeTicks') || 0;
    return ticks ? copy.get('runtimeMinutes', { minutes: Math.round(ticks / 600000000) }) : '';
  }
  function userData(item) { return value(item, 'UserData', 'userData') || {}; }
  function resumeTicks(item) { return value(userData(item), 'PlaybackPositionTicks', 'playbackPositionTicks') || 0; }
  function playbackPercent(item) { return value(userData(item), 'PlayedPercentage', 'playedPercentage') || 0; }

  // Screens and feedback
  function showScreen(id, focusId) {
    Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (screen) {
      screen.classList.toggle('is-active', screen.id === id);
    });
    activeScreen = id;
    animations.enterScreen(byId(id));
    if (focusId) { setTimeout(function () { byId(focusId).focus(); }, 30); }
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

  function openLibrary() {
    updateProfile();
    showScreen('browse-screen');
    byId('browse-loading').style.display = 'block';
    byId('browse-error').style.display = 'none';
    byId('shelves').innerHTML = '';

    var libraryGroups = api.getLibraries().then(function (libraries) {
      availableLibraries = libraries;
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
      return api.getVideos().then(function (videos) {
        return [{ name: copy.get('allVideos'), videos: videos }];
      });
    });

    Promise.all([
      api.getResume().catch(function () { return []; }),
      api.getLatest().catch(function () { return []; }),
      libraryGroups
    ]).then(function (groups) {
      var definitions = [
        [copy.get('continueWatchingTitle'), copy.get('continueWatchingCaption'), groups[0]],
        [copy.get('recentlyAddedTitle'), copy.get('recentlyAddedCaption'), groups[1]]
      ];
      groups[2].forEach(function (group) {
        definitions.push([group.name, copy.get('libraryCaption', { count: group.videos.length }), group.videos]);
      });
      var firstCard = null;
      definitions.forEach(function (definition) {
        var shelf = renderShelf(definition[0], definition[1], definition[2]);
        if (shelf) {
          byId('shelves').appendChild(shelf);
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

  function applyMode(mode) {
    var nextMode = mode === 'storybook' ? 'storybook' : 'adult';
    if (nextMode === 'storybook' && !storybookState.libraryIds.length) {
      showToast(copy.get('storybookSetupRequired'));
      openStorybookSettings();
      return;
    }
    storybookState.lastMode = nextMode;
    storybookState.enabled = storybookState.enabled || nextMode === 'storybook';
    storybookState = storybookPreferences.save(storybookState);
    storybookView.setMode(nextMode);
    openLibrary();
  }

  function openStorybookSettings() {
    var resolution = storybookModel.resolveLibraries(
      availableLibraries,
      storybookState.libraryIds
    );
    previousScreen = activeScreen === 'storybook-settings-screen' ?
      'browse-screen' : activeScreen;
    storybookView.renderSettings(
      availableLibraries,
      storybookState,
      resolution.missingIds
    );
    showScreen('storybook-settings-screen', 'storybook-child-name');
  }

  function saveStorybookSettings(nextPreferences) {
    storybookState = storybookPreferences.save(nextPreferences);
    storybookView.setMode(storybookState.lastMode);
    showToast(copy.get('storybookSettingsSaved'));
    openLibrary();
  }

  function cancelStorybookSettings() {
    var focusId = previousScreen === 'details-screen' ?
      'details-back' : 'storybook-settings-button';
    showScreen(previousScreen, focusId);
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
      if (direction === 'up' || direction === 'down') { animations.focusCard(best); }
      else { best.focus(); }
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
    if (api.restore()) { openLibrary(); }
    else { showScreen('setup-screen', 'server-url'); }
  }

  document.addEventListener('DOMContentLoaded', init);
}(window));
