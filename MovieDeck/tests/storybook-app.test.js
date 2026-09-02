'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var registerAsync = global.RawiTest.registerAsync;
var fs = require('fs');
var path = require('path');
var vm = require('vm');

function deferred() {
  var resolve;
  var reject;
  var promise = new Promise(function (res, rej) {
    resolve = res;
    reject = rej;
  });
  return { promise: promise, resolve: resolve, reject: reject };
}

function flush(times) {
  var count = times || 6;
  var promise = Promise.resolve();
  while (count > 0) {
    promise = promise.then(function () { return Promise.resolve(); });
    count -= 1;
  }
  return promise;
}

function asyncTest(name, run) {
  registerAsync(name, run);
}

function FakeClassList() {
  this.names = [];
}

FakeClassList.prototype.set = function (value) {
  this.names = value ? String(value).split(/\s+/).filter(Boolean) : [];
};

FakeClassList.prototype.toString = function () {
  return this.names.join(' ');
};

FakeClassList.prototype.contains = function (name) {
  return this.names.indexOf(name) !== -1;
};

FakeClassList.prototype.add = function (name) {
  if (!this.contains(name)) { this.names.push(name); }
};

FakeClassList.prototype.remove = function (name) {
  this.names = this.names.filter(function (entry) { return entry !== name; });
};

FakeClassList.prototype.toggle = function (name, force) {
  if (force === true) {
    this.add(name);
    return true;
  }
  if (force === false) {
    this.remove(name);
    return false;
  }
  if (this.contains(name)) {
    this.remove(name);
    return false;
  }
  this.add(name);
  return true;
};

function FakeElement(document, tagName) {
  var self = this;
  this.ownerDocument = document;
  this.tagName = String(tagName || 'div').toUpperCase();
  this.children = [];
  this.parentNode = null;
  this.attributes = {};
  this.listeners = {};
  this.style = {};
  this.classList = new FakeClassList();
  this.textContent = '';
  this._innerHTML = '';
  this.value = '';
  this.checked = false;
  this.disabled = false;
  this.scrollLeft = 0;
  this.scrollWidth = 0;
  this.clientWidth = 0;
  this.scrollTop = 0;
  this.scrollHeight = 0;
  this.clientHeight = 0;
  this.offsetParent = {};
  this.type = '';
  this.rect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  this.id = '';

  Object.defineProperty(this, 'className', {
    get: function () { return self.classList.toString(); },
    set: function (value) { self.classList.set(value); }
  });
  Object.defineProperty(this, 'firstChild', {
    get: function () { return self.children.length ? self.children[0] : null; }
  });
  Object.defineProperty(this, 'innerHTML', {
    get: function () { return self._innerHTML; },
    set: function (value) {
      self._innerHTML = String(value);
      self.children = [];
      self.textContent = '';
    }
  });
}

FakeElement.prototype.appendChild = function (child) {
  child.parentNode = this;
  this.children.push(child);
  this.ownerDocument.registerTree(child);
  return child;
};

FakeElement.prototype.insertBefore = function (child, reference) {
  var index = this.children.indexOf(reference);
  child.parentNode = this;
  if (index === -1) { this.children.push(child); }
  else { this.children.splice(index, 0, child); }
  this.ownerDocument.registerTree(child);
  return child;
};

FakeElement.prototype.addEventListener = function (type, listener) {
  if (!this.listeners[type]) { this.listeners[type] = []; }
  this.listeners[type].push(listener);
};

FakeElement.prototype.dispatch = function (type, event) {
  var listeners = this.listeners[type] || [];
  var payload = event || {};
  payload.target = payload.target || this;
  payload.preventDefault = payload.preventDefault || function () {};
  listeners.forEach(function (listener) {
    listener.call(this, payload);
  }, this);
};

FakeElement.prototype.click = function () {
  if (this.disabled) { return; }
  this.focus();
  this.dispatch('click', {});
};

function nearestScreen(node) {
  var current = node;

  while (current) {
    if (current.classList && current.classList.contains('screen')) {
      return current;
    }
    current = current.parentNode;
  }

  return null;
}

FakeElement.prototype.focus = function () {
  var screen = nearestScreen(this);

  if (this.disabled) { return; }
  if (screen && !screen.classList.contains('is-active')) { return; }
  this.ownerDocument.activeElement = this;
  this.dispatch('focus', {});
};

FakeElement.prototype.setAttribute = function (name, value) {
  this.attributes[name] = value === '' ? '' : String(value);
  if (name === 'id') {
    this.id = String(value);
    this.ownerDocument.elementsById[this.id] = this;
  } else if (name === 'class') {
    this.className = value;
  } else if (name === 'disabled') {
    this.disabled = true;
  } else if (name === 'type') {
    this.type = String(value);
  }
};

FakeElement.prototype.getAttribute = function (name) {
  if (name === 'class') { return this.className; }
  if (name === 'id') { return this.id; }
  if (name === 'type') { return this.type; }
  return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
};

FakeElement.prototype.removeAttribute = function (name) {
  delete this.attributes[name];
  if (name === 'disabled') { this.disabled = false; }
};

FakeElement.prototype.getBoundingClientRect = function () {
  return this.rect;
};

FakeElement.prototype.querySelector = function (selector) {
  var matches = this.ownerDocument.querySelectorAllFrom(this, selector);
  return matches.length ? matches[0] : null;
};

FakeElement.prototype.getElementsByClassName = function (name) {
  return this.ownerDocument.querySelectorAllFrom(this, '.' + name);
};

function FakeDocument() {
  this.elementsById = {};
  this.listeners = {};
  this.activeElement = null;
  this.body = new FakeElement(this, 'body');
}

FakeDocument.prototype.createElement = function (tagName) {
  return new FakeElement(this, tagName);
};

FakeDocument.prototype.getElementById = function (id) {
  return this.elementsById[id] || null;
};

FakeDocument.prototype.registerTree = function (node) {
  var self = this;
  if (node.id) { self.elementsById[node.id] = node; }
  node.children.forEach(function (child) { self.registerTree(child); });
};

FakeDocument.prototype.addEventListener = function (type, listener) {
  if (!this.listeners[type]) { this.listeners[type] = []; }
  this.listeners[type].push(listener);
};

FakeDocument.prototype.dispatchEvent = function (type, event) {
  var listeners = this.listeners[type] || [];
  var payload = event || {};
  payload.preventDefault = payload.preventDefault || function () {};
  listeners.forEach(function (listener) { listener(payload); });
};

FakeDocument.prototype.querySelectorAll = function (selector) {
  return this.querySelectorAllFrom(this.body, selector);
};

FakeDocument.prototype.querySelectorAllFrom = function (root, selector) {
  var nodes = collectDescendants(root);
  var screenId;
  var scopedRoot;
  var className;

  if (selector === '.screen') {
    return nodes.filter(function (node) { return node.classList.contains('screen'); });
  }
  if (selector === '[data-mode]') {
    return nodes.filter(function (node) { return node.getAttribute('data-mode') !== null; });
  }
  if (/^#[^\s]+ \[data-focusable\]:not\(\[disabled\]\)$/.test(selector)) {
    screenId = selector.split(' ')[0].slice(1);
    scopedRoot = this.getElementById(screenId);
    if (!scopedRoot) { return []; }
    return collectDescendants(scopedRoot).filter(function (node) {
      return node.getAttribute('data-focusable') !== null && !node.disabled;
    });
  }
  if (selector === '#storybook-library-options input[type="checkbox"]') {
    scopedRoot = this.getElementById('storybook-library-options');
    if (!scopedRoot) { return []; }
    return collectDescendants(scopedRoot).filter(function (node) {
      return node.tagName === 'INPUT' && node.type === 'checkbox';
    });
  }
  if (selector === '#storybook-doors .storybook-door') {
    scopedRoot = this.getElementById('storybook-doors');
    if (!scopedRoot) { return []; }
    return collectDescendants(scopedRoot).filter(function (node) {
      return node.classList.contains('storybook-door');
    });
  }
  if (selector === '#shelves .shelf') {
    scopedRoot = this.getElementById('shelves');
    if (!scopedRoot) { return []; }
    return collectDescendants(scopedRoot).filter(function (node) {
      return node.classList.contains('shelf');
    });
  }
  if (/^\.[A-Za-z0-9_-]+$/.test(selector)) {
    className = selector.slice(1);
    return nodes.filter(function (node) { return node.classList.contains(className); });
  }
  return [];
};

function collectDescendants(root) {
  var result = [];

  function visit(node) {
    node.children.forEach(function (child) {
      result.push(child);
      visit(child);
    });
  }

  visit(root);
  return result;
}

function createStorage() {
  var values = {};
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem: function (key, value) { values[key] = String(value); },
    removeItem: function (key) { delete values[key]; }
  };
}

function copyValue(item, primary, secondary) {
  if (!item) { return undefined; }
  if (item[primary] !== undefined) { return item[primary]; }
  return item[secondary];
}

function buildDom(document) {
  function append(parent, tagName, id, className) {
    var element = document.createElement(tagName);
    if (id) { element.setAttribute('id', id); }
    if (className) { element.className = className; }
    parent.appendChild(element);
    return element;
  }

  function focusable(element) {
    element.setAttribute('data-focusable', '');
    return element;
  }

  var setupScreen = append(document.body, 'section', 'setup-screen', 'screen');
  var quickScreen = append(document.body, 'section', 'quick-screen', 'screen');
  var browseScreen = append(document.body, 'section', 'browse-screen', 'screen');
  var storybookScreen = append(document.body, 'section', 'storybook-screen', 'screen');
  var storybookLibraryScreen = append(document.body, 'section', 'storybook-library-screen', 'screen');
  var storybookDetailsScreen = append(document.body, 'section', 'storybook-details-screen', 'screen');
  var storybookEndingScreen = append(document.body, 'section', 'storybook-ending-screen', 'screen');
  var detailsScreen = append(document.body, 'section', 'details-screen', 'screen');
  var settingsScreen = append(document.body, 'section', 'storybook-settings-screen', 'screen');
  var playerScreen = append(document.body, 'section', 'player-screen', 'screen');
  var panel = append(settingsScreen, 'div', '', 'settings-panel');

  append(setupScreen, 'input', 'server-url', '');
  focusable(document.getElementById('server-url'));
  append(setupScreen, 'button', 'connect-button', '');
  focusable(document.getElementById('connect-button'));
  append(setupScreen, 'div', 'setup-error', '');
  append(quickScreen, 'button', 'change-server-button', '');
  focusable(document.getElementById('change-server-button'));
  append(quickScreen, 'div', 'quick-code', '');
  append(quickScreen, 'div', 'quick-error', '');

  append(browseScreen, 'div', 'browse-content', '');
  append(browseScreen, 'div', 'hero-backdrop', '');
  append(browseScreen, 'div', 'selection-title', '');
  append(browseScreen, 'div', 'hero-title', '');
  append(browseScreen, 'div', 'hero-meta', '');
  append(browseScreen, 'div', 'hero-overview', '');
  append(browseScreen, 'div', 'hero-number', '');
  append(browseScreen, 'div', 'clock', '');
  append(browseScreen, 'div', 'profile-name', '');
  append(browseScreen, 'div', 'profile-initial', '');
  focusable(append(browseScreen, 'button', 'adult-mode-button', '')).setAttribute('data-mode', 'adult');
  focusable(append(browseScreen, 'button', 'storybook-mode-button', '')).setAttribute('data-mode', 'storybook');
  focusable(append(browseScreen, 'button', 'refresh-button', ''));
  focusable(append(browseScreen, 'button', 'profile-button', ''));
  focusable(append(browseScreen, 'button', 'storybook-settings-button', ''));
  focusable(append(browseScreen, 'button', 'hero-open', ''));
  append(browseScreen, 'div', 'browse-loading', '');
  append(browseScreen, 'div', 'browse-error', '');
  append(browseScreen, 'div', 'shelves', '');

  append(storybookScreen, 'div', 'storybook-greeting', '');
  append(storybookScreen, 'p', 'storybook-home-hint', '');
  var storybookResumeSection = append(storybookScreen, 'section', 'storybook-resume-section', '');
  append(storybookResumeSection, 'h2', 'storybook-resume-title', '');
  append(storybookResumeSection, 'div', 'storybook-resume-slot', '');
  var storybookFavoritesSection = append(storybookScreen, 'section', 'storybook-favorites-section', '');
  append(storybookFavoritesSection, 'h2', 'storybook-favorites-title', '');
  append(storybookFavoritesSection, 'div', 'storybook-favorites', '');
  append(storybookScreen, 'div', 'storybook-doors', '');
  append(storybookScreen, 'p', 'storybook-empty-state', '');
  focusable(append(storybookScreen, 'button', 'storybook-home-adult-mode-button', '')).setAttribute('data-mode', 'adult');
  focusable(append(storybookScreen, 'button', 'storybook-home-storybook-mode-button', '')).setAttribute('data-mode', 'storybook');
  focusable(append(storybookScreen, 'button', 'storybook-edit-libraries', ''));

  var storybookLibraryTopbar = append(storybookLibraryScreen, 'header', '', 'storybook-topbar');
  append(storybookLibraryTopbar, 'div', '', 'storybook-wordmark');
  var storybookLibraryModeToggle = append(storybookLibraryTopbar, 'div', '', 'mode-toggle');
  focusable(append(storybookLibraryModeToggle, 'button', 'storybook-library-adult-mode-button', '')).setAttribute('data-mode', 'adult');
  focusable(append(storybookLibraryModeToggle, 'button', 'storybook-library-storybook-mode-button', '')).setAttribute('data-mode', 'storybook');
  focusable(append(storybookLibraryScreen, 'button', 'storybook-library-back', ''));
  append(storybookLibraryScreen, 'h1', 'storybook-library-title', '');
  append(storybookLibraryScreen, 'p', 'storybook-library-count', '');
  append(storybookLibraryScreen, 'div', 'storybook-library-cards', '');
  append(storybookLibraryScreen, 'p', 'storybook-library-empty', '');

  var storybookDetailsTopbar = append(storybookDetailsScreen, 'header', '', 'storybook-topbar');
  append(storybookDetailsTopbar, 'div', '', 'storybook-wordmark');
  var storybookDetailsModeToggle = append(storybookDetailsTopbar, 'div', '', 'mode-toggle');
  focusable(append(storybookDetailsModeToggle, 'button', 'storybook-details-adult-mode-button', '')).setAttribute('data-mode', 'adult');
  focusable(append(storybookDetailsModeToggle, 'button', 'storybook-details-storybook-mode-button', '')).setAttribute('data-mode', 'storybook');
  focusable(append(storybookDetailsScreen, 'button', 'storybook-details-back', ''));
  append(storybookDetailsScreen, 'div', 'storybook-details-art', '');
  append(storybookDetailsScreen, 'p', 'storybook-details-kicker', '');
  append(storybookDetailsScreen, 'h1', 'storybook-details-title', '');
  append(storybookDetailsScreen, 'p', 'storybook-details-meta', '');
  var storybookDetailsProgress = append(storybookDetailsScreen, 'div', 'storybook-details-progress', '');
  append(storybookDetailsProgress, 'span', '', '');
  append(storybookDetailsScreen, 'p', 'storybook-details-resume', '');
  append(storybookDetailsScreen, 'p', 'storybook-details-overview', '');
  focusable(append(storybookDetailsScreen, 'button', 'storybook-details-play', ''));
  focusable(append(storybookDetailsScreen, 'button', 'storybook-details-restart', ''));

  append(storybookEndingScreen, 'h1', 'storybook-ending-title', '');
  append(storybookEndingScreen, 'p', 'storybook-ending-body', '');
  focusable(append(storybookEndingScreen, 'button', 'storybook-ending-all-done', ''));
  focusable(append(storybookEndingScreen, 'button', 'storybook-ending-pick-another', ''));

  focusable(append(detailsScreen, 'button', 'details-back', ''));
  focusable(append(detailsScreen, 'button', 'details-adult-mode-button', '')).setAttribute('data-mode', 'adult');
  focusable(append(detailsScreen, 'button', 'details-storybook-mode-button', '')).setAttribute('data-mode', 'storybook');
  focusable(append(detailsScreen, 'button', 'play-button', ''));
  focusable(append(detailsScreen, 'button', 'restart-button', ''));
  focusable(append(detailsScreen, 'button', 'favorite-button', ''));
  append(detailsScreen, 'img', 'details-poster', '');
  append(detailsScreen, 'div', 'details-backdrop', '');
  append(detailsScreen, 'div', 'details-title', '');
  append(detailsScreen, 'div', 'details-meta', '');
  append(detailsScreen, 'div', 'details-overview', '');
  append(detailsScreen, 'div', 'details-genres', '');

  append(panel, 'h1', 'storybook-settings-title', '');
  focusable(append(panel, 'input', 'storybook-child-name', '')).setAttribute('type', 'text');
  append(panel, 'div', 'storybook-library-options', '');
  focusable(append(panel, 'input', 'storybook-reduced-motion', '')).setAttribute('type', 'checkbox');
  append(panel, 'p', 'storybook-settings-warning', '');
  append(panel, 'p', 'storybook-settings-error', '');
  focusable(append(panel, 'button', 'storybook-reset', ''));
  focusable(append(panel, 'button', 'storybook-save', ''));
  focusable(append(panel, 'button', 'storybook-cancel', ''));
  panel.rect = { left: 100, top: 100, right: 500, bottom: 300, width: 400, height: 200 };
  panel.clientHeight = 200;
  panel.scrollHeight = 800;
  document.getElementById('storybook-child-name').rect = { left: 140, top: 130, right: 360, bottom: 160, width: 220, height: 30 };
  document.getElementById('storybook-reduced-motion').rect = { left: 140, top: 360, right: 180, bottom: 390, width: 40, height: 30 };
  document.getElementById('storybook-reset').rect = { left: 140, top: 470, right: 350, bottom: 510, width: 210, height: 40 };
  document.getElementById('storybook-save').rect = { left: 380, top: 470, right: 500, bottom: 510, width: 120, height: 40 };
  document.getElementById('storybook-cancel').rect = { left: 540, top: 470, right: 660, bottom: 510, width: 120, height: 40 };

  append(playerScreen, 'div', 'toast', '');
  append(playerScreen, 'div', 'player-message', '');
}

function loadAppHarness(options) {
  var modelWindow = load('js/storybook-model.js', { window: {} });
  var catalogueWindow = load('js/storybook-catalogue.js', {
    window: {
      RawiStorybookModel: modelWindow.RawiStorybookModel
    }
  });
  var document = new FakeDocument();
  var localStorage = createStorage();
  var timers = [];
  var intervals = [];
  var enteredScreens = [];
  var apiCalls = {
    getLatest: 0,
    getLibraries: 0,
    getResume: 0,
    getVideos: 0,
    restore: 0
  };
  var savedState = null;
  var currentRestoreStatus = JSON.parse(JSON.stringify(options.restoreStatus || {
    needsRecovery: false,
    type: 'ok'
  }));
  var playerCallbacks = {};
  var playCalls = [];
  var stopCalls = [];
  var isPlayingState = false;
  var storybookDoorFocusCalls = [];
  var storybookMotionCalls = [];
  var storybookStopCalls = 0;
  var currentPreferences = JSON.parse(JSON.stringify(options.preferences || {
    version: 2,
    enabled: false,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    favoriteItemIds: [],
    reducedMotion: false
  }));
  var librariesDeferred = options.librariesDeferred || null;
  var restoreValue = options.restoreSession !== false;
  function normalizePreferences(nextState) {
    return {
      version: 2,
      enabled: nextState && nextState.enabled === true,
      lastMode: nextState && nextState.lastMode === 'storybook' ? 'storybook' : 'adult',
      childName: nextState && typeof nextState.childName === 'string' ? nextState.childName : '',
      libraryIds: nextState && Array.isArray(nextState.libraryIds) ? nextState.libraryIds.slice() : [],
      favoriteItemIds: nextState && Array.isArray(nextState.favoriteItemIds) ? nextState.favoriteItemIds.slice() : [],
      reducedMotion: nextState && nextState.reducedMotion === true
    };
  }
  var copyMap = {
    allVideos: 'All videos',
    browseLoading: 'Opening the library',
    chooseVideo: 'Choose a video',
    continueWatchingCaption: 'Continue watching',
    continueWatchingTitle: 'Continue watching',
    defaultProfileName: 'Jellyfin',
    finishedToast: 'Finished {title}',
    heroOverview: 'Choose a poster below to see it on the big screen.',
    heroTitle: 'Your movies are ready.',
    libraryCaption: '{count} titles',
    libraryLoadFailed: 'The library could not be loaded.',
    modeAdult: 'Adult',
    modeStorybook: 'Storybook',
    noSynopsis: 'No synopsis',
    noVideos: 'No videos are visible to this Jellyfin user.',
    playButton: 'Play',
    posterAlt: '{title} poster',
    recentlyAddedCaption: 'Recently added',
    recentlyAddedTitle: 'Recently added',
    runtimeMinutes: '{minutes} min',
    shelfItemCount: '{count} films',
    signOutConfirm: 'Press again',
    signedOut: 'Signed out',
    storybookMissingLibrary: 'A previously selected library is no longer available.',
    storybookMissingLibraryIdMultiple: 'Previously selected Storybook library IDs are no longer available: {ids}.',
    storybookMissingLibraryIdSingle: 'A previously selected Storybook library ID is no longer available: {ids}.',
    storybookContinueTitle: "Continue {child}'s Story",
    storybookContinueTitleWithoutName: 'Continue the story',
    storybookDoorAriaLabel: 'Open {library}',
    storybookDoorsTitle: 'Story Doors',
    storybookEditLibrariesButton: 'Choose libraries',
    storybookFavoriteAddButton: 'Add to Storybook favorites',
    storybookFavoriteRemoveButton: 'Remove from Storybook favorites',
    storybookFavoriteAddedToast: 'Added {title} to Storybook favorites.',
    storybookFavoriteRemovedToast: 'Removed {title} from Storybook favorites.',
    storybookFavoritesTitle: "{child}'s Favorites",
    storybookFavoritesTitleWithoutName: 'Favorites',
    storybookGreeting: 'What should we watch tonight, {child}?',
    storybookGreetingWithoutName: 'What should we watch tonight?',
    storybookHomeHint: 'Pick a favorite or open a story door.',
    storybookDetailsBackButton: '← Storybook',
    storybookDetailsKicker: 'Story time',
    storybookEndingTitle: 'All done, {child}.',
    storybookEndingTitleWithoutName: 'All done.',
    storybookEndingBody: 'That was {title}. Would you like to pick another story?',
    storybookEndingPrimaryButton: 'All done',
    storybookEndingSecondaryButton: 'Pick another',
    storybookItemAriaLabel: 'Open {title}',
    storybookLibraryBackButton: '← Storybook',
    storybookLibraryEmpty: 'No stories are available in {library} right now.',
    storybookNoSelectedLibraries: 'No Storybook libraries are available.',
    storybookNoLibraries: 'Choose at least one library for Storybook Mode.',
    storybookPreferencesMalformed: 'Saved Storybook settings could not be read.',
    storybookPreferencesUnsupported: 'Saved Storybook settings use unsupported version {version}.',
    storybookRecoveryResetRequired: 'Reset Storybook settings before saving new Storybook options.',
    storybookResumeButton: 'Resume from {time}',
    storybookResumeProgress: 'Resume from {time}',
    storybookResetButton: 'Reset Storybook settings',
    storybookResetConfirmButton: 'Confirm reset',
    storybookResetConfirmPrompt: 'Select Confirm reset to clear the saved Storybook settings.',
    storybookSettingsSaved: 'Storybook settings saved.',
    storybookSetupRequired: 'Choose Storybook libraries before opening this mode.',
    storybookStartButton: 'Start story',
    untitled: 'Untitled'
  };
  var api = {
    user: { Name: 'Jellyfin' },
    server: 'http://example',
    authenticateQuickConnect: function () { return Promise.resolve(); },
    connect: function () { return Promise.resolve(); },
    getLatest: function () {
      apiCalls.getLatest += 1;
      return Promise.resolve(options.latest || []);
    },
    getLibraries: function () {
      apiCalls.getLibraries += 1;
      if (librariesDeferred) { return librariesDeferred.promise; }
      if (options.getLibrariesError) { return Promise.reject(options.getLibrariesError); }
      return Promise.resolve(options.libraries || []);
    },
    getQuickConnectState: function () { return Promise.resolve({ Authenticated: false }); },
    getResume: function () {
      apiCalls.getResume += 1;
      return Promise.resolve(options.resume || []);
    },
    getVideos: function (libraryId) {
      apiCalls.getVideos += 1;
      if (!libraryId) { return Promise.resolve(options.fallbackVideos || []); }
      if (options.getVideosErrors && options.getVideosErrors[libraryId]) {
        return Promise.reject(options.getVideosErrors[libraryId]);
      }
      return Promise.resolve((options.videosByLibrary && options.videosByLibrary[libraryId]) || []);
    },
    imageUrl: function () { return ''; },
    initiateQuickConnect: function () { return Promise.resolve({ Code: 'ABCD', Secret: 'secret' }); },
    restore: function () {
      apiCalls.restore += 1;
      return restoreValue;
    },
    signOut: function () {}
  };
  var window = {
    MovieDeckAnimations: {
      animateStorybookHome: function (reducedMotion) {
        storybookMotionCalls.push(reducedMotion);
      },
      animateSelection: function () {},
      animateShelves: function () {},
      enterScreen: function (node) {
        enteredScreens.push(node.id);
      },
      focusCard: function (node) { node.focus(); },
      focusStorybookDoor: function (node, reducedMotion) {
        storybookDoorFocusCalls.push({
          libraryId: node.getAttribute('data-library-id'),
          reducedMotion: reducedMotion
        });
      },
      stopStorybookHome: function () {
        storybookStopCalls += 1;
      }
    },
    matchMedia: function (query) {
      return {
        matches: query === '(prefers-reduced-motion: reduce)' &&
          options.prefersReducedMotion === true
      };
    },
    MovieDeckApi: api,
    MovieDeckPlayer: {
      handleKey: function () {},
      init: function (options) {
        playerCallbacks = options || {};
      },
      isPlaying: function () { return isPlayingState; },
      play: function (item, fromBeginning) {
        playCalls.push({ id: item.Id, fromBeginning: fromBeginning });
        isPlayingState = true;
      },
      stop: function (completed) {
        stopCalls.push(completed);
        isPlayingState = false;
      }
    },
    MovieDeckValue: copyValue,
    RawiCopy: {
      apply: function () {},
      get: function (key, values) {
        var template = copyMap[key] || key;
        Object.keys(values || {}).forEach(function (name) {
          template = template.replace(new RegExp('\\{' + name + '\\}', 'g'), String(values[name]));
        });
        return template;
      }
    },
    RawiStorybookModel: modelWindow.RawiStorybookModel,
    RawiStorybookCatalogue: catalogueWindow.RawiStorybookCatalogue,
    RawiStorybookPreferences: {
      defaults: function () {
        return {
          version: 2,
          enabled: false,
          lastMode: 'adult',
          childName: '',
          libraryIds: [],
          favoriteItemIds: [],
          reducedMotion: false
        };
      },
      getRestoreStatus: function () {
        return JSON.parse(JSON.stringify(currentRestoreStatus));
      },
      restore: function () {
        return JSON.parse(JSON.stringify(currentPreferences));
      },
      reset: function () {
        currentRestoreStatus = {
          needsRecovery: false,
          type: 'ok'
        };
        return this.save(this.defaults());
      },
      save: function (nextState) {
        currentPreferences = normalizePreferences(nextState);
        savedState = JSON.parse(JSON.stringify(currentPreferences));
        currentRestoreStatus = {
          needsRecovery: false,
          type: 'ok'
        };
        return JSON.parse(JSON.stringify(currentPreferences));
      }
    },
    RawiPreviewFixtures: options.previewFixtures || null
  };

  buildDom(document);
  document.getElementById('hero-open').disabled = true;
  document.getElementById('restart-button').style = {};
  document.getElementById('storybook-details-restart').style = {};

  window.location = { search: options.locationSearch || '' };
  window.window = window;
  window.document = document;
  window.localStorage = localStorage;

  var context = {
    console: console,
    document: document,
    localStorage: localStorage,
    clearInterval: function () {},
    clearTimeout: function () {},
    setInterval: function (fn) { intervals.push(fn); return intervals.length; },
    setTimeout: function (fn) { timers.push(fn); fn(); return timers.length; },
    window: window
  };

  vm.createContext(context);
  ['js/storybook-view.js', 'js/app.js'].forEach(function (file) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
      context,
      { filename: file }
    );
  });
  document.dispatchEvent('DOMContentLoaded', {});

  return {
    apiCalls: function () {
      return {
        getLatest: apiCalls.getLatest,
        getLibraries: apiCalls.getLibraries,
        getResume: apiCalls.getResume,
        getVideos: apiCalls.getVideos,
        restore: apiCalls.restore
      };
    },
    currentPreferences: function () {
      return JSON.parse(JSON.stringify(currentPreferences));
    },
    deferred: librariesDeferred,
    document: document,
    doorLibraryIds: function () {
      return document.querySelectorAll('#storybook-doors .storybook-door').map(function (node) {
        return node.getAttribute('data-library-id');
      });
    },
    playCalls: function () {
      return JSON.parse(JSON.stringify(playCalls));
    },
    playerCallbacks: function () {
      return playerCallbacks;
    },
    savedState: function () { return savedState; },
    screenActive: function (id) {
      return document.getElementById(id).classList.contains('is-active');
    },
    screenEntries: function () {
      return enteredScreens.slice();
    },
    setPlayerPlaying: function (value) {
      isPlayingState = value === true;
    },
    shelfHeadings: function () {
      return document.querySelectorAll('#shelves .shelf').map(function (shelf) {
        return shelf.children[0].children[0].textContent;
      });
    },
    stopCalls: function () {
      return JSON.parse(JSON.stringify(stopCalls));
    },
    storybookMotionCalls: function () {
      return storybookMotionCalls.slice();
    },
    storybookDoorFocusCalls: function () {
      return JSON.parse(JSON.stringify(storybookDoorFocusCalls));
    },
    storybookStopCalls: function () {
      return storybookStopCalls;
    },
    toastText: function () {
      return document.getElementById('toast').textContent;
    }
  };
}

function positionStoryDoors(harness) {
  var doors = harness.document.querySelectorAll('#storybook-doors .storybook-door');
  var viewport = harness.document.getElementById('storybook-doors');
  var left = 110;

  viewport.rect = {
    left: 90,
    top: 430,
    right: 1490,
    bottom: 910,
    width: 1400,
    height: 480
  };
  viewport.clientWidth = 1400;
  viewport.scrollWidth = 320 + doors.length * 315;

  doors.forEach(function (door) {
    door.rect = {
      left: left,
      top: 500,
      right: left + 270,
      bottom: 890,
      width: 270,
      height: 390
    };
    left += 315;
  });
}

(function entersDeterministicStorybookPreviewWithoutRestoringSession() {
  var harness = loadAppHarness({
    locationSearch: '?preview=storybook',
    previewFixtures: {
      storybook: {
        user: { Id: 'preview-user', Name: 'Parent' },
        libraries: [
          { Id: 'pixar', Name: 'Disney Pixar' },
          { Id: 'songs', Name: 'Sing & Dance' },
          { Id: 'lessons', Name: 'Little Lessons' }
        ],
        groups: [
          { id: 'pixar', name: 'Disney Pixar', videos: [{ Id: 'bluey', Name: "Bluey's Big Adventure" }] },
          { id: 'songs', name: 'Sing & Dance', videos: [{ Id: 'dance', Name: 'Dance With Me' }] },
          { id: 'lessons', name: 'Little Lessons', videos: [{ Id: 'colors', Name: 'The Color Garden' }] }
        ]
      }
    },
    restoreSession: true
  });

  assert.strictEqual(harness.screenActive('storybook-screen'), true);
  assert.strictEqual(
    harness.document.getElementById('storybook-greeting').textContent,
    'What should we watch tonight, Nova?'
  );
  assert.strictEqual(
    harness.document.getElementById('profile-name').textContent,
    'Parent'
  );
  assert.strictEqual(
    harness.document.getElementById('profile-initial').textContent,
    'P'
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(harness.doorLibraryIds())),
    ['pixar', 'songs', 'lessons']
  );
  assert.strictEqual(
    harness.document.activeElement.getAttribute('data-library-id'),
    'pixar'
  );
  assert.deepStrictEqual(
    harness.apiCalls(),
    {
      getLatest: 0,
      getLibraries: 0,
      getResume: 0,
      getVideos: 0,
      restore: 0
    }
  );
}());

asyncTest('switchesPreviewAdultModeWithoutContactingJellyfin', function () {
  var harness = loadAppHarness({
    locationSearch: '?preview=storybook',
    previewFixtures: {
      storybook: {
        user: { Id: 'preview-user', Name: 'Parent' },
        libraries: [
          { Id: 'pixar', Name: 'Disney Pixar' },
          { Id: 'songs', Name: 'Sing & Dance' },
          { Id: 'lessons', Name: 'Little Lessons' }
        ],
        groups: [
          { id: 'pixar', name: 'Disney Pixar', videos: [{ Id: 'bluey', Name: "Bluey's Big Adventure" }] },
          { id: 'songs', name: 'Sing & Dance', videos: [{ Id: 'dance', Name: 'Dance With Me' }] },
          { id: 'lessons', name: 'Little Lessons', videos: [{ Id: 'colors', Name: 'The Color Garden' }] }
        ]
      }
    },
    restoreSession: true
  });

  harness.document.getElementById('storybook-home-adult-mode-button').click();
  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.shelfHeadings())),
      ['Disney Pixar', 'Sing & Dance', 'Little Lessons']
    );
    assert.deepStrictEqual(
      harness.apiCalls(),
      {
        getLatest: 0,
        getLibraries: 0,
        getResume: 0,
        getVideos: 0,
        restore: 0
      }
    );
  });
});

asyncTest('savesPreviewStorybookSettingsWithoutLeavingMockMode', function () {
  var harness = loadAppHarness({
    locationSearch: '?preview=storybook',
    previewFixtures: {
      storybook: {
        user: { Id: 'preview-user', Name: 'Parent' },
        libraries: [
          { Id: 'pixar', Name: 'Disney Pixar' },
          { Id: 'songs', Name: 'Sing & Dance' },
          { Id: 'lessons', Name: 'Little Lessons' }
        ],
        groups: [
          { id: 'pixar', name: 'Disney Pixar', videos: [{ Id: 'bluey', Name: "Bluey's Big Adventure" }] },
          { id: 'songs', name: 'Sing & Dance', videos: [{ Id: 'dance', Name: 'Dance With Me' }] },
          { id: 'lessons', name: 'Little Lessons', videos: [{ Id: 'colors', Name: 'The Color Garden' }] }
        ]
      }
    },
    restoreSession: true
  });

  harness.document.getElementById('storybook-edit-libraries').click();
  harness.document.getElementById('storybook-reduced-motion').checked = true;
  harness.document.getElementById('storybook-save').click();
  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.body.classList.contains('storybook-reduced-motion'), true);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.storybookMotionCalls())),
      [false, true]
    );
    assert.deepStrictEqual(
      harness.apiCalls(),
      {
        getLatest: 0,
        getLibraries: 0,
        getResume: 0,
        getVideos: 0,
        restore: 0
      }
    );
  });
});

asyncTest('previewIgnoresRecoverableStorybookPreferenceCorruption', function () {
  var harness = loadAppHarness({
    locationSearch: '?preview=storybook',
    previewFixtures: {
      storybook: {
        user: { Id: 'preview-user', Name: 'Parent' },
        libraries: [
          { Id: 'pixar', Name: 'Disney Pixar' }
        ],
        groups: [
          { id: 'pixar', name: 'Disney Pixar', videos: [{ Id: 'bluey', Name: "Bluey's Big Adventure" }] }
        ]
      }
    },
    restoreStatus: {
      needsRecovery: true,
      type: 'malformed'
    }
  });

  harness.document.getElementById('storybook-edit-libraries').click();

  assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
  assert.strictEqual(
    harness.document.getElementById('storybook-settings-warning').textContent,
    ''
  );
  assert.strictEqual(harness.document.getElementById('storybook-child-name').disabled, false);
  assert.strictEqual(harness.document.getElementById('storybook-save').disabled, false);
  assert.strictEqual(harness.document.getElementById('storybook-reset').disabled, true);

  harness.document.getElementById('storybook-reduced-motion').checked = true;
  harness.document.getElementById('storybook-save').click();

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.savedState())),
      {
        version: 2,
        enabled: true,
        lastMode: 'storybook',
        childName: 'Nova',
        libraryIds: ['pixar'],
        favoriteItemIds: [],
        reducedMotion: true
      }
    );
  });
});

asyncTest('savingStorybookSettingsRetainsFavoriteItemIdsFromMigratedPreferences', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['video-1', 'video-2'],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      disney: [{ Id: 'video-2', Name: 'Second video' }],
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.currentPreferences().favoriteItemIds)),
      ['video-1', 'video-2']
    );

    harness.document.getElementById('storybook-edit-libraries').click();
    var checkboxes = harness.document.querySelectorAll('#storybook-library-options input[type="checkbox"]');
    harness.document.getElementById('storybook-child-name').value = 'Ava';
    checkboxes[0].checked = false;
    checkboxes[1].checked = true;
    harness.document.getElementById('storybook-reduced-motion').checked = true;
    harness.document.getElementById('storybook-save').click();
    return flush(12);
  }).then(function () {
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.savedState())),
      {
        version: 2,
        enabled: true,
        lastMode: 'storybook',
        childName: 'Ava',
        libraryIds: ['disney'],
        favoriteItemIds: ['video-1', 'video-2'],
        reducedMotion: true
      }
    );
  });
});

(function previewlessStartupStillRestoresAndLoadsLibraries() {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  assert.deepStrictEqual(
    harness.apiCalls(),
    {
      getLatest: 1,
      getLibraries: 1,
      getResume: 1,
      getVideos: 0,
      restore: 1
    }
  );
}());

asyncTest('blocksSettingsWhileLibrariesAreStillLoading', function () {
  var libraries = deferred();
  var harness = loadAppHarness({
    fallbackVideos: [],
    librariesDeferred: libraries,
    restoreSession: true
  });

  harness.document.getElementById('storybook-settings-button').click();
  assert.strictEqual(harness.toastText(), 'Opening the library');
  assert.strictEqual(harness.screenActive('browse-screen'), true);
  assert.strictEqual(harness.screenActive('storybook-settings-screen'), false);

  libraries.resolve([{ Id: 'kids', Name: 'Kids' }]);
  return flush(12);
});

asyncTest('savingAdultSettingsKeepsAdultModeAcrossReload', function () {
  var savedState;
  var reloadHarness;
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    var checkboxes;

    harness.document.getElementById('storybook-settings-button').click();
    checkboxes = harness.document.querySelectorAll('#storybook-library-options input[type="checkbox"]');
    checkboxes[0].checked = true;
    harness.document.getElementById('storybook-save').click();
    return flush(12);
  }).then(function () {
    savedState = JSON.parse(JSON.stringify(harness.savedState()));
    reloadHarness = loadAppHarness({
      libraries: [{ Id: 'kids', Name: 'Kids' }],
      preferences: savedState,
      restoreSession: true,
      videosByLibrary: {
        kids: [{ Id: 'video-1', Name: 'First video' }]
      }
    });

    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(savedState.lastMode, 'adult');
    assert.deepStrictEqual(savedState.libraryIds, ['kids']);
    return flush(12);
  }).then(function () {
    assert.strictEqual(reloadHarness.screenActive('browse-screen'), true);
    assert.strictEqual(reloadHarness.screenActive('storybook-screen'), false);
  });
});

asyncTest('savingStorybookSetupAfterExplicitToggleRestoresStorybookAcrossReload', function () {
  var savedState;
  var reloadHarness;
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    var checkboxes;

    harness.document.getElementById('storybook-mode-button').click();
    checkboxes = harness.document.querySelectorAll('#storybook-library-options input[type="checkbox"]');
    checkboxes[0].checked = true;
    harness.document.getElementById('storybook-save').click();
    return flush(12);
  }).then(function () {
    savedState = JSON.parse(JSON.stringify(harness.savedState()));
    reloadHarness = loadAppHarness({
      libraries: [{ Id: 'kids', Name: 'Kids' }],
      preferences: savedState,
      restoreSession: true,
      videosByLibrary: {
        kids: [{ Id: 'video-1', Name: 'First video' }]
      }
    });

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(
      harness.document.activeElement.getAttribute('data-library-id'),
      'kids'
    );
    assert.strictEqual(savedState.lastMode, 'storybook');
    assert.deepStrictEqual(savedState.libraryIds, ['kids']);
    return flush(12);
  }).then(function () {
    assert.strictEqual(reloadHarness.screenActive('storybook-screen'), true);
    assert.strictEqual(
      reloadHarness.document.activeElement.getAttribute('data-library-id'),
      'kids'
    );
  });
});

asyncTest('restoresInitiatingFocusAndScrollsSettingsControls', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });
  var panel = harness.document.getElementById('storybook-settings-screen').getElementsByClassName('settings-panel')[0];

  return flush(12).then(function () {
    harness.document.getElementById('storybook-mode-button').click();

    assert.strictEqual(harness.toastText(), 'Choose Storybook libraries before opening this mode.');
    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-child-name');

    harness.document.dispatchEvent('keydown', {
      keyCode: 40,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.document.activeElement.id, 'storybook-reduced-motion');
    assert(panel.scrollTop > 0);

    harness.document.getElementById('storybook-cancel').click();
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-mode-button');
  });
});

asyncTest('keepsTheJellyfinSessionWhileRecoveringMalformedStorybookPreferences', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 1,
      enabled: false,
      lastMode: 'adult',
      childName: '',
      libraryIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    restoreStatus: {
      needsRecovery: true,
      type: 'malformed'
    },
    videosByLibrary: {
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);

    harness.document.getElementById('storybook-settings-button').click();

    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-reset');
    assert.strictEqual(
      harness.document.getElementById('storybook-settings-warning').textContent,
      'Saved Storybook settings could not be read. Reset Storybook settings before saving new Storybook options.'
    );
    assert.strictEqual(harness.document.getElementById('storybook-child-name').disabled, true);
    assert.strictEqual(harness.document.getElementById('storybook-save').disabled, true);
    assert.strictEqual(harness.document.getElementById('storybook-reset').disabled, false);
    assert.strictEqual(harness.savedState(), null);

    harness.document.getElementById('storybook-reset').click();

    assert.strictEqual(
      harness.document.getElementById('storybook-settings-warning').textContent,
      'Saved Storybook settings could not be read. Select Confirm reset to clear the saved Storybook settings.'
    );
    assert.strictEqual(
      harness.document.getElementById('storybook-reset').textContent,
      'Confirm reset'
    );
    assert.strictEqual(harness.savedState(), null);

    harness.document.getElementById('storybook-reset').click();

    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.savedState())),
      {
        version: 2,
        enabled: false,
        lastMode: 'adult',
        childName: '',
        libraryIds: [],
        favoriteItemIds: [],
        reducedMotion: false
      }
    );
    assert.strictEqual(harness.document.getElementById('storybook-settings-warning').textContent, '');
    assert.strictEqual(harness.document.getElementById('storybook-reset').disabled, true);
    assert.strictEqual(harness.document.getElementById('storybook-save').disabled, false);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-child-name');
  });
});

asyncTest('cancelAndBackDoNotResetRecoverableStorybookPreferences', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 1,
      enabled: false,
      lastMode: 'adult',
      childName: '',
      libraryIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    restoreStatus: {
      needsRecovery: true,
      type: 'unsupported-version',
      version: 99
    },
    videosByLibrary: {
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-settings-button').click();
    assert.strictEqual(
      harness.document.getElementById('storybook-settings-warning').textContent,
      'Saved Storybook settings use unsupported version 99. Reset Storybook settings before saving new Storybook options.'
    );

    harness.document.getElementById('storybook-reset').click();
    harness.document.getElementById('storybook-cancel').click();

    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-settings-button');
    assert.strictEqual(harness.savedState(), null);

    harness.document.getElementById('storybook-settings-button').click();
    assert.strictEqual(
      harness.document.getElementById('storybook-reset').textContent,
      'Reset Storybook settings'
    );

    harness.document.getElementById('storybook-reset').click();
    harness.document.dispatchEvent('keydown', {
      keyCode: 8,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-settings-button');
    assert.strictEqual(harness.savedState(), null);
  });
});

asyncTest('showsRecoverableBrowseErrorWhenStorybookRestoreCannotEnumerateLibraries', function () {
  var harness = loadAppHarness({
    fallbackVideos: [{ Id: 'video-1', Name: 'Fallback video' }],
    getLibrariesError: new Error('enumeration failed'),
    preferences: {
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: false
    },
    restoreSession: true
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(harness.screenActive('storybook-screen'), false);
    assert.strictEqual(
      harness.document.getElementById('browse-error').textContent,
      'The library could not be loaded.'
    );
    assert.strictEqual(harness.document.activeElement.id, 'refresh-button');
    assert.deepStrictEqual(harness.currentPreferences().libraryIds, ['kids']);

    harness.document.getElementById('adult-mode-button').click();
    return flush(12);
  }).then(function () {
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.shelfHeadings())),
      ['All videos']
    );
    assert.deepStrictEqual(harness.savedState().libraryIds, ['kids']);
    assert.strictEqual(harness.savedState().lastMode, 'adult');
  });
});

asyncTest('rendersSavedStorybookLibrariesOnDedicatedHome', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' },
      { Id: 'grownups', Name: 'Grownups' }
    ],
    preferences: {
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      reducedMotion: true
    },
    restoreSession: true,
    videosByLibrary: {
      disney: [{ Id: 'video-2', Name: 'Second video' }],
      grownups: [{ Id: 'video-3', Name: 'Third video' }],
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.doorLibraryIds())),
      ['kids', 'disney']
    );
    assert.strictEqual(
      harness.document.getElementById('storybook-greeting').textContent,
      'What should we watch tonight, Nova?'
    );
    assert.strictEqual(harness.document.body.classList.contains('storybook-reduced-motion'), true);
    assert.strictEqual(
      harness.document.activeElement.getAttribute('data-library-id'),
      'kids'
    );
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.storybookMotionCalls())),
      [true]
    );
  });
});

asyncTest('rendersStorybookHomeResumeAndFavoritesFromSelectedLibrariesOnly', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'grownups', Name: 'Grownups' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1', 'movie-9'],
      reducedMotion: false
    },
    restoreSession: true,
    resume: [
      { Id: 'movie-9', Name: 'Late Movie', UserData: { PlaybackPositionTicks: 300000000 } },
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      grownups: [{ Id: 'movie-9', Name: 'Late Movie', RunTimeTicks: 2400000000 }],
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }]
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.getElementById('storybook-resume-card').getAttribute('data-item-id'), 'story-1');
    assert.strictEqual(harness.document.getElementById('storybook-resume-title').textContent, "Continue Nova's Story");
    assert.strictEqual(harness.document.getElementById('storybook-favorites-title').textContent, "Nova's Favorites");
    assert.strictEqual(harness.document.activeElement.id, 'storybook-resume-card');
    assert.strictEqual(harness.document.getElementById('storybook-favorites').children.length, 1);
    assert.strictEqual(harness.document.getElementById('storybook-favorites').children[0].getAttribute('data-item-id'), 'story-1');
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.doorLibraryIds())),
      ['kids']
    );
  });
});

asyncTest('adultDetailsAddsStorybookFavoriteWithoutLeavingAdultMode', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    var favoriteButton = harness.document.getElementById('favorite-button');

    harness.document.getElementById('hero-open').click();

    assert.strictEqual(
      favoriteButton.style.display,
      ''
    );
    assert.strictEqual(favoriteButton.disabled, false);
    assert.strictEqual(
      favoriteButton.textContent,
      'Add to Storybook favorites'
    );
    assert.strictEqual(
      favoriteButton.getAttribute('aria-pressed'),
      'false'
    );

    favoriteButton.click();

    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.savedState().favoriteItemIds)),
      ['story-1']
    );
    assert.strictEqual(
      favoriteButton.textContent,
      'Remove from Storybook favorites'
    );
    assert.strictEqual(
      favoriteButton.getAttribute('aria-pressed'),
      'true'
    );
    assert.strictEqual(harness.currentPreferences().lastMode, 'adult');
    assert.strictEqual(harness.screenActive('details-screen'), true);
    assert.strictEqual(harness.screenActive('storybook-screen'), false);
    assert.strictEqual(harness.toastText(), 'Added First Story to Storybook favorites.');
  });
});

asyncTest('adultDetailsRemovesStorybookFavoriteWithoutLeavingAdultMode', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    var favoriteButton = harness.document.getElementById('favorite-button');

    harness.document.getElementById('hero-open').click();

    assert.strictEqual(
      favoriteButton.style.display,
      ''
    );
    assert.strictEqual(favoriteButton.disabled, false);
    assert.strictEqual(
      favoriteButton.textContent,
      'Remove from Storybook favorites'
    );
    assert.strictEqual(
      favoriteButton.getAttribute('aria-pressed'),
      'true'
    );

    favoriteButton.click();

    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.savedState().favoriteItemIds)),
      []
    );
    assert.strictEqual(
      favoriteButton.textContent,
      'Add to Storybook favorites'
    );
    assert.strictEqual(
      favoriteButton.getAttribute('aria-pressed'),
      'false'
    );
    assert.strictEqual(harness.currentPreferences().lastMode, 'adult');
    assert.strictEqual(harness.screenActive('details-screen'), true);
    assert.strictEqual(harness.screenActive('storybook-screen'), false);
    assert.strictEqual(harness.toastText(), 'Removed First Story from Storybook favorites.');
  });
});

asyncTest('storybookHomeItemsOpenStorybookDetailsInsteadOfAdultDetails', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, UserData: { PlaybackPositionTicks: 600000000 } }
    ],
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, UserData: { PlaybackPositionTicks: 600000000 } }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-resume-card').click();

    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.strictEqual(harness.screenActive('details-screen'), false);
    assert.strictEqual(harness.document.getElementById('storybook-details-title').textContent, 'First Story');

    harness.document.getElementById('storybook-details-play').click();
    assert.deepStrictEqual(harness.playCalls(), [{ id: 'story-1', fromBeginning: false }]);
  });
});

asyncTest('storybookDetailsBackKeyRestoresHomeFavoriteFocus', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-favorite-card-story-1').click();

    harness.document.dispatchEvent('keydown', {
      keyCode: 10009,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-favorite-card-story-1');
  });
});

asyncTest('storybookLibraryDetailsBackKeyRestoresPriorLibraryCardFocus', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [
        { Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 },
        { Id: 'story-2', Name: 'Second Story', RunTimeTicks: 5400000000 }
      ]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-door-kids').click();
    harness.document.getElementById('storybook-library-card-story-2').click();

    harness.document.dispatchEvent('keydown', {
      keyCode: 10009,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-library-card-story-2');
  });
});

asyncTest('storybookPlaybackErrorWhilePlayerActiveReturnsToStorybookDetails', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      reducedMotion: false
    },
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Overview: 'A calm bedtime story.', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-resume-card').click();
    harness.document.getElementById('storybook-details-play').click();
    harness.playerCallbacks().onError({ message: 'No compatible stream.' });

    assert.deepStrictEqual(harness.stopCalls(), [false]);

    harness.playerCallbacks().onStop(false);

    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-details-play');
    assert.strictEqual(harness.toastText(), 'No compatible stream.');
  });
});

asyncTest('storybookPlaybackErrorCallbackStillReturnsToStorybookDetailsWhenPlayerAlreadyStopped', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      reducedMotion: false
    },
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Overview: 'A calm bedtime story.', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-resume-card').click();
    harness.document.getElementById('storybook-details-play').click();
    harness.setPlayerPlaying(false);
    harness.playerCallbacks().onError({ message: 'Browser refused playback.' });

    assert.deepStrictEqual(harness.stopCalls(), []);
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-details-play');
    assert.strictEqual(harness.toastText(), 'Browser refused playback.');
  });
});

asyncTest('adultPlaybackErrorsStillReturnToAdultDetails', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('hero-open').click();
    harness.document.getElementById('play-button').click();
    harness.setPlayerPlaying(false);
    harness.playerCallbacks().onError({ message: 'Browser refused playback.' });

    assert.strictEqual(harness.screenActive('details-screen'), true);
    assert.strictEqual(harness.screenActive('storybook-details-screen'), false);
    assert.strictEqual(harness.document.activeElement.id, 'play-button');
    assert.strictEqual(harness.toastText(), 'Browser refused playback.');
  });
});

asyncTest('storybookCompletionShowsEndingScreenWithoutToastOrAutoplay', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Overview: 'A calm bedtime story.', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-resume-card').click();
    harness.document.getElementById('storybook-details-play').click();
    harness.playerCallbacks().onStop(true);

    assert.strictEqual(harness.screenActive('storybook-ending-screen'), true);
    assert.strictEqual(harness.toastText(), '');
    assert.deepStrictEqual(harness.playCalls(), [{ id: 'story-1', fromBeginning: false }]);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-ending-all-done');
    assert.strictEqual(harness.document.getElementById('storybook-ending-adult-mode-button'), null);
    assert.strictEqual(harness.document.getElementById('storybook-ending-storybook-mode-button'), null);

    harness.document.getElementById('storybook-ending-pick-another').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-resume-card');
  });
});

asyncTest('storybookEndingBackKeyActsLikePickAnother', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Overview: 'A calm bedtime story.', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-resume-card').click();
    harness.document.getElementById('storybook-details-play').click();
    harness.playerCallbacks().onStop(true);

    harness.document.dispatchEvent('keydown', {
      keyCode: 10009,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-resume-card');
  });
});

asyncTest('storybookEndingAllDoneReturnsHomeWhenTizenExitIsUnavailable', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Overview: 'A calm bedtime story.', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-resume-card').click();
    harness.document.getElementById('storybook-details-play').click();
    harness.playerCallbacks().onStop(true);

    harness.document.getElementById('storybook-ending-all-done').click();

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-resume-card');
  });
});

asyncTest('reducedMotionSkipsGeneralScreenEntryAnimationOnAllStorybookPresentationScreensButNotSettings', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    prefersReducedMotion: true,
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      reducedMotion: false
    },
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Overview: 'A calm bedtime story.', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }]
    }
  });
  var baselineCount;

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    baselineCount = harness.screenEntries().length;

    harness.document.getElementById('storybook-door-kids').click();
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);

    harness.document.getElementById('storybook-library-card-story-1').click();
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);

    harness.document.getElementById('storybook-details-play').click();
    harness.playerCallbacks().onStop(true);
    assert.strictEqual(harness.screenActive('storybook-ending-screen'), true);

    harness.document.getElementById('storybook-ending-pick-another').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);

    harness.document.getElementById('storybook-edit-libraries').click();
    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);

    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.screenEntries().slice(baselineCount))),
      ['player-screen', 'storybook-settings-screen']
    );
  });
});

asyncTest('adultCompletionStillReturnsToAdultDetailsAndShowsToast', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('hero-open').click();
    harness.document.getElementById('play-button').click();
    harness.playerCallbacks().onStop(true);

    assert.strictEqual(harness.screenActive('details-screen'), true);
    assert.strictEqual(harness.toastText(), 'Finished First Story');
  });
});

asyncTest('doesNotPruneFavoritesAfterToleratedLibraryFailures', function () {
  var harness = loadAppHarness({
    getVideosErrors: {
      songs: new Error('tolerated failure')
    },
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'songs', Name: 'Songs' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['missing-favorite'],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story' }]
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.savedState(), null);
    assert.deepStrictEqual(harness.currentPreferences().favoriteItemIds, ['missing-favorite']);
  });
});

asyncTest('prunesMissingFavoritesAfterFullySuccessfulCatalogueRefresh', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1', 'missing-favorite'],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story' }]
    }
  });

  return flush(12).then(function () {
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.savedState().favoriteItemIds)),
      ['story-1']
    );
  });
});

asyncTest('keepsSelectedAccessibleLibrariesAsStoryDoorsWhenOneLibraryReturnsNoVideos', function () {
  var harness = loadAppHarness({
    getVideosErrors: {
      kids: new Error('empty result tolerated')
    },
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' }
    ],
    preferences: {
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      disney: [{ Id: 'video-2', Name: 'Second video' }]
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.doorLibraryIds())),
      ['kids', 'disney']
    );
    assert.strictEqual(
      harness.document.activeElement.getAttribute('data-library-id'),
      'kids'
    );
  });
});

asyncTest('opensEmptyStoryDoorWithExistingNoVideosRecoveryState', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' }
    ],
    latest: [{ Id: 'latest-1', Name: 'Latest film' }],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    resume: [{ Id: 'resume-1', Name: 'Resume film' }],
    videosByLibrary: {
      disney: [{ Id: 'video-2', Name: 'Second video' }],
      kids: []
    }
  });
  var kidsDoor;

  return flush(12).then(function () {
    kidsDoor = harness.document.querySelectorAll('#storybook-doors .storybook-door').filter(function (node) {
      return node.getAttribute('data-library-id') === 'kids';
    })[0];

    assert(kidsDoor, 'expected the empty accessible library to render as a Story Door');

    kidsDoor.click();

    assert.strictEqual(harness.storybookStopCalls(), 1);
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(harness.screenActive('browse-screen'), false);
    assert.strictEqual(harness.document.getElementById('storybook-library-title').textContent, 'Kids');
    assert.strictEqual(harness.document.getElementById('storybook-library-cards').children.length, 0);
    assert.strictEqual(
      harness.document.getElementById('storybook-library-empty').textContent,
      'No stories are available in Kids right now.'
    );
    assert.strictEqual(harness.document.activeElement.id, 'storybook-library-back');
  });
});

asyncTest('clearsStaleHeroStateWhenOpeningAnEmptyStoryDoorAfterSelectingAnAdultItem', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      disney: [{ Id: 'video-2', Name: 'Second video', Overview: 'A brave sequel.' }],
      kids: []
    }
  });
  var kidsDoor;

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(harness.document.getElementById('hero-title').textContent, 'Second video');
    assert.strictEqual(harness.document.getElementById('selection-title').textContent, 'Second video');
    assert.strictEqual(harness.document.getElementById('hero-open').disabled, false);

    harness.document.getElementById('storybook-mode-button').click();
    return flush(12);
  }).then(function () {
    kidsDoor = harness.document.querySelectorAll('#storybook-doors .storybook-door').filter(function (node) {
      return node.getAttribute('data-library-id') === 'kids';
    })[0];

    assert(kidsDoor, 'expected the empty accessible library to render as a Story Door');

    kidsDoor.click();

    assert.strictEqual(harness.storybookStopCalls(), 1);
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(harness.screenActive('browse-screen'), false);
    assert.strictEqual(harness.screenActive('details-screen'), false);
    assert.strictEqual(harness.document.getElementById('storybook-library-title').textContent, 'Kids');
    assert.strictEqual(harness.document.getElementById('storybook-library-cards').children.length, 0);
    assert.strictEqual(
      harness.document.getElementById('storybook-library-empty').textContent,
      'No stories are available in Kids right now.'
    );
    assert.strictEqual(harness.document.activeElement.id, 'storybook-library-back');
  });
});

asyncTest('keepsAdultHomeOmittingEmptyLibraryShelves', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' }
    ],
    preferences: {
      version: 1,
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      disney: [{ Id: 'video-2', Name: 'Second video' }],
      kids: []
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.shelfHeadings())),
      ['Disney']
    );
    assert.strictEqual(harness.document.getElementById('browse-error').style.display, 'none');
  });
});

asyncTest('keepsReducedMotionStorybookHomeStatic', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: {
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: true
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenEntries().indexOf('storybook-screen'), -1);
  });
});

asyncTest('switchesIntoStorybookModeAndFocusesFirstDoorWhenLibrariesAreConfigured', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' }
    ],
    preferences: {
      version: 1,
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      disney: [{ Id: 'video-2', Name: 'Second video' }],
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-mode-button').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(
      harness.document.activeElement.getAttribute('data-library-id'),
      'kids'
    );
  });
});

asyncTest('movesRemoteFocusAcrossSixStoryDoorsWithoutDroppingLaterSelections', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'one', Name: 'One' },
      { Id: 'two', Name: 'Two' },
      { Id: 'three', Name: 'Three' },
      { Id: 'four', Name: 'Four' },
      { Id: 'five', Name: 'Five' },
      { Id: 'six', Name: 'Six' }
    ],
    preferences: {
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['one', 'two', 'three', 'four', 'five', 'six'],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      five: [{ Id: 'video-5', Name: 'Fifth video' }],
      four: [{ Id: 'video-4', Name: 'Fourth video' }],
      one: [{ Id: 'video-1', Name: 'First video' }],
      six: [{ Id: 'video-6', Name: 'Sixth video' }],
      three: [{ Id: 'video-3', Name: 'Third video' }],
      two: [{ Id: 'video-2', Name: 'Second video' }]
    }
  });

  return flush(12).then(function () {
    positionStoryDoors(harness);

    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });
    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });
    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });
    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });
    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });

    assert.strictEqual(
      harness.document.activeElement.getAttribute('data-library-id'),
      'six'
    );
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.storybookDoorFocusCalls().map(function (call) {
        return call.libraryId;
      }))),
      ['one', 'two', 'three', 'four', 'five', 'six']
    );
  });
});

asyncTest('opensStoryDoorOnStorybookLibraryScreenAndBackRestoresStorybookHome', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' },
      { Id: 'grownups', Name: 'Grownups' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    latest: [{ Id: 'latest-1', Name: 'Latest film' }],
    resume: [{ Id: 'resume-1', Name: 'Resume film' }],
    restoreSession: true,
    videosByLibrary: {
      disney: [{ Id: 'video-2', Name: 'Second video' }],
      grownups: [{ Id: 'video-3', Name: 'Third video' }],
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-door-kids').click();

    assert.strictEqual(harness.storybookStopCalls(), 1);
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(harness.screenActive('browse-screen'), false);
    assert.strictEqual(harness.document.getElementById('storybook-library-title').textContent, 'Kids');
    assert.strictEqual(harness.document.activeElement.id, 'storybook-library-card-video-1');

    harness.document.dispatchEvent('keydown', {
      keyCode: 8,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.doorLibraryIds())),
      ['kids', 'disney']
    );
    assert.strictEqual(harness.document.activeElement.id, 'storybook-door-kids');
  });
});

asyncTest('keepsStorybookLibraryEntryAnimationOffWhenReducedMotionIsEnabledAndOnOtherwise', function () {
  var reducedMotionHarness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: true
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story' }]
    }
  });
  var normalMotionHarness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story' }]
    }
  });

  return flush(12).then(function () {
    reducedMotionHarness.document.getElementById('storybook-door-kids').click();
    normalMotionHarness.document.getElementById('storybook-door-kids').click();

    assert.strictEqual(reducedMotionHarness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(
      reducedMotionHarness.screenEntries().indexOf('storybook-library-screen'),
      -1
    );
    assert.strictEqual(normalMotionHarness.screenActive('storybook-library-screen'), true);
    assert.notStrictEqual(
      normalMotionHarness.screenEntries().indexOf('storybook-library-screen'),
      -1
    );
  });
});

asyncTest('adultBrowseBackDoesNotReopenStorybookAfterLibraryRoundTrip', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story' }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-door-kids').click();
    harness.document.dispatchEvent('keydown', {
      keyCode: 8,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('storybook-screen'), true);

    harness.document.getElementById('storybook-home-adult-mode-button').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);

    harness.document.dispatchEvent('keydown', {
      keyCode: 8,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('storybook-screen'), false);
  });
});

asyncTest('showsStorybookRecoveryStateWhenSelectedLibrariesDisappear', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'grownups', Name: 'Grownups' }
    ],
    preferences: {
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: false
    },
    restoreSession: true,
    videosByLibrary: {
      grownups: [{ Id: 'video-3', Name: 'Third video' }]
    }
  });

  return flush(12).then(function () {
    var emptyStateText;

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(harness.doorLibraryIds())), []);
    emptyStateText = harness.document.getElementById('storybook-empty-state').textContent;
    assert.strictEqual(
      emptyStateText,
      'No Storybook libraries are available.'
    );
    assert.strictEqual(emptyStateText.indexOf('kids'), -1);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-edit-libraries');

    harness.document.getElementById('storybook-edit-libraries').click();

    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(
      harness.document.getElementById('storybook-settings-warning').textContent,
      'A previously selected Storybook library ID is no longer available: kids.'
    );
  });
});
