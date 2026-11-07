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

function cueNameFromAudioSrc(src) {
  return String(src).replace('audio/storybook-', '').replace('.wav', '');
}

// Audio double whose play() promise stays pending until the element is paused,
// which is how a real element reports an interrupted cue restart.
function createCueAudioClass(created) {
  function CueAudio(src) {
    this.src = src;
    this.preload = '';
    this.volume = 1;
    this.currentTime = 0;
    this.paused = true;
    this.pauseCalls = 0;
    this.playCalls = 0;
    this.pending = [];
    this.listeners = {};
    created.push(this);
  }

  CueAudio.prototype.addEventListener = function (name, callback) {
    this.listeners[name] = callback;
  };
  CueAudio.prototype.load = function () {};
  CueAudio.prototype.play = function () {
    var entry = {};
    this.playCalls += 1;
    this.paused = false;
    entry.promise = new Promise(function (resolve, reject) {
      entry.resolve = resolve;
      entry.reject = reject;
    });
    this.pending.push(entry);
    return entry.promise;
  };
  CueAudio.prototype.pause = function () {
    var outstanding = this.pending;
    var abort = new Error('The play() request was interrupted by a call to pause().');
    abort.name = 'AbortError';
    this.pauseCalls += 1;
    this.paused = true;
    this.pending = [];
    outstanding.forEach(function (entry) { entry.reject(abort); });
  };

  return CueAudio;
}

function basePreferences(overrides) {
  var result = {
    version: 4,
    enabled: false,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    favoriteItemIds: [],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'animals',
      learning: 'learning',
      movement: 'movement'
    },
    durationLabels: {
      enabled: true,
      quickMaxMinutes: 12,
      cozyMaxMinutes: 30
    },
    recentHistoryDays: 14,
    reducedMotion: false,
    soundsEnabled: true
  };
  var source = overrides || {};

  Object.keys(source).forEach(function (key) {
    if (key === 'categoryTags' || key === 'durationLabels') { return; }
    result[key] = source[key];
  });
  if (source.categoryTags) {
    Object.keys(source.categoryTags).forEach(function (key) {
      result.categoryTags[key] = source.categoryTags[key];
    });
  }
  if (source.durationLabels) {
    Object.keys(source.durationLabels).forEach(function (key) {
      result.durationLabels[key] = source.durationLabels[key];
    });
  }
  return result;
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
  this._textContent = '';
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
  Object.defineProperty(this, 'textContent', {
    get: function () {
      return self._textContent + self.children.map(function (child) { return child.textContent; }).join('');
    },
    set: function (value) {
      self.children.forEach(function (child) { child.parentNode = null; });
      self.children = [];
      self._textContent = String(value);
    }
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

FakeElement.prototype.removeChild = function (child) {
  var index = this.children.indexOf(child);
  assert.ok(index !== -1, 'Removed child must belong to its parent');
  this.children.splice(index, 1);
  child.parentNode = null;
  return child;
};

FakeElement.prototype.contains = function (node) {
  while (node) {
    if (node === this) { return true; }
    node = node.parentNode;
  }
  return false;
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
  this.ownerDocument.dispatchEvent('focusin', { target: this });
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
  var searchScreen = append(document.body, 'section', 'search-screen', 'screen');
  var storybookScreen = append(document.body, 'section', 'storybook-screen', 'screen');
  var storybookLibraryScreen = append(document.body, 'section', 'storybook-library-screen', 'screen');
  var storybookDetailsScreen = append(document.body, 'section', 'storybook-details-screen', 'screen');
  var storybookMagicScreen = append(document.body, 'section', 'storybook-magic-pick-screen', 'screen');
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
  focusable(append(browseScreen, 'button', 'search-button', '')).disabled = true;
  focusable(append(browseScreen, 'button', 'profile-button', ''));
  focusable(append(browseScreen, 'button', 'storybook-settings-button', ''));
  focusable(append(browseScreen, 'button', 'hero-open', ''));
  append(browseScreen, 'div', 'browse-loading', '');
  append(browseScreen, 'div', 'browse-error', '');
  append(browseScreen, 'div', 'shelves', '');
  focusable(append(searchScreen, 'button', 'search-back', ''));
  var queryWrap = append(searchScreen, 'div', '', 'search-query-wrap');
  append(queryWrap, 'div', 'search-query', 'search-query');
  append(searchScreen, 'div', 'search-keyboard', '');
  focusable(append(searchScreen, 'button', 'search-delete', ''));
  focusable(append(searchScreen, 'button', 'search-clear', ''));
  var searchResultsPanel = append(searchScreen, 'div', '', '');
  append(searchResultsPanel, 'h2', 'search-count', '');
  append(searchResultsPanel, 'p', 'search-warning', '');
  append(searchResultsPanel, 'div', 'search-results', '');
  focusable(append(searchResultsPanel, 'button', 'search-more', ''));

  [storybookScreen, storybookLibraryScreen, storybookDetailsScreen, storybookMagicScreen, storybookEndingScreen].forEach(function (screen) {
    var sky = append(screen, 'div', '', 'storybook-sky');
    sky.setAttribute('aria-hidden', 'true');
    var moon = append(sky, 'span', '', 'storybook-moon');
    moon.rect = { left: 1000, top: 100, right: 1155, bottom: 255, width: 155, height: 155 };
  });

  append(storybookScreen, 'div', 'storybook-greeting', '');
  append(storybookScreen, 'p', 'storybook-home-hint', '');
  var storybookResumeSection = append(storybookScreen, 'section', 'storybook-resume-section', '');
  append(storybookResumeSection, 'h2', 'storybook-resume-title', '');
  append(storybookResumeSection, 'div', 'storybook-resume-slot', '');
  var storybookLittleMenuSection = append(storybookScreen, 'section', 'storybook-little-menu-section', '');
  append(storybookLittleMenuSection, 'h2', 'storybook-little-menu-title', '');
  append(storybookLittleMenuSection, 'div', 'storybook-little-menu', '');
  var storybookFavoritesSection = append(storybookScreen, 'section', 'storybook-favorites-section', '');
  append(storybookFavoritesSection, 'h2', 'storybook-favorites-title', '');
  append(storybookFavoritesSection, 'div', 'storybook-favorites', '');
  var storybookCategoriesSection = append(storybookScreen, 'section', 'storybook-categories-section', '');
  append(storybookCategoriesSection, 'h2', 'storybook-categories-title', '');
  append(storybookCategoriesSection, 'div', 'storybook-categories', '');
  var storybookMagicHomeSection = append(storybookScreen, 'section', 'storybook-magic-pick-home-section', '');
  focusable(append(storybookMagicHomeSection, 'button', 'storybook-magic-pick-button', ''));
  append(storybookScreen, 'div', 'storybook-doors', '');
  append(storybookScreen, 'p', 'storybook-empty-state', '');
  focusable(append(storybookScreen, 'button', 'storybook-home-adult-mode-button', '')).setAttribute('data-mode', 'adult');
  focusable(append(storybookScreen, 'button', 'storybook-home-storybook-mode-button', '')).setAttribute('data-mode', 'storybook');
  focusable(append(storybookScreen, 'button', 'storybook-edit-libraries', ''));
  focusable(append(storybookScreen, 'button', 'storybook-search-button', ''));

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

  focusable(append(storybookMagicScreen, 'button', 'storybook-magic-pick-back', ''));
  focusable(append(storybookMagicScreen, 'button', 'storybook-magic-adult-mode-button', '')).setAttribute('data-mode', 'adult');
  focusable(append(storybookMagicScreen, 'button', 'storybook-magic-storybook-mode-button', '')).setAttribute('data-mode', 'storybook');
  append(storybookMagicScreen, 'div', 'storybook-magic-pick-art', '');
  append(storybookMagicScreen, 'h1', 'storybook-magic-pick-title', '');
  append(storybookMagicScreen, 'p', 'storybook-magic-pick-reason', '');
  append(storybookMagicScreen, 'p', 'storybook-magic-pick-meta', '');
  append(storybookMagicScreen, 'p', 'storybook-magic-pick-overview', '');
  focusable(append(storybookMagicScreen, 'button', 'storybook-magic-pick-primary', ''));
  focusable(append(storybookMagicScreen, 'button', 'storybook-magic-pick-secondary', ''));

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
  focusable(append(panel, 'input', 'storybook-category-tag-singDance', '')).setAttribute('type', 'text');
  focusable(append(panel, 'input', 'storybook-category-tag-bedtime', '')).setAttribute('type', 'text');
  focusable(append(panel, 'input', 'storybook-category-tag-animals', '')).setAttribute('type', 'text');
  focusable(append(panel, 'input', 'storybook-category-tag-learning', '')).setAttribute('type', 'text');
  focusable(append(panel, 'input', 'storybook-category-tag-movement', '')).setAttribute('type', 'text');
  focusable(append(panel, 'input', 'storybook-duration-labels-enabled', '')).setAttribute('type', 'checkbox');
  focusable(append(panel, 'input', 'storybook-duration-quick-max', '')).setAttribute('type', 'number');
  focusable(append(panel, 'input', 'storybook-duration-cozy-max', '')).setAttribute('type', 'number');
  focusable(append(panel, 'input', 'storybook-recent-history-days', '')).setAttribute('type', 'number');
  focusable(append(panel, 'input', 'storybook-reduced-motion', '')).setAttribute('type', 'checkbox');
  focusable(append(panel, 'input', 'storybook-sounds-enabled', '')).setAttribute('type', 'checkbox');
  append(panel, 'p', 'storybook-settings-warning', '');
  append(panel, 'p', 'storybook-settings-error', '');
  focusable(append(panel, 'button', 'storybook-reset', ''));
  focusable(append(panel, 'button', 'storybook-save', ''));
  focusable(append(panel, 'button', 'storybook-cancel', ''));
  panel.rect = { left: 100, top: 100, right: 500, bottom: 300, width: 400, height: 200 };
  panel.clientHeight = 200;
  panel.scrollHeight = 800;
  document.getElementById('storybook-child-name').rect = { left: 140, top: 130, right: 360, bottom: 160, width: 220, height: 30 };
  document.getElementById('storybook-category-tag-singDance').rect = { left: 140, top: 220, right: 460, bottom: 252, width: 320, height: 32 };
  document.getElementById('storybook-category-tag-bedtime').rect = { left: 140, top: 270, right: 460, bottom: 302, width: 320, height: 32 };
  document.getElementById('storybook-category-tag-animals').rect = { left: 140, top: 320, right: 460, bottom: 352, width: 320, height: 32 };
  document.getElementById('storybook-category-tag-learning').rect = { left: 140, top: 370, right: 460, bottom: 402, width: 320, height: 32 };
  document.getElementById('storybook-category-tag-movement').rect = { left: 140, top: 420, right: 460, bottom: 452, width: 320, height: 32 };
  document.getElementById('storybook-duration-labels-enabled').rect = { left: 140, top: 470, right: 460, bottom: 500, width: 320, height: 30 };
  document.getElementById('storybook-duration-quick-max').rect = { left: 140, top: 520, right: 300, bottom: 552, width: 160, height: 32 };
  document.getElementById('storybook-duration-cozy-max').rect = { left: 140, top: 570, right: 300, bottom: 602, width: 160, height: 32 };
  document.getElementById('storybook-recent-history-days').rect = { left: 140, top: 620, right: 300, bottom: 652, width: 160, height: 32 };
  document.getElementById('storybook-reduced-motion').rect = { left: 140, top: 360, right: 180, bottom: 390, width: 40, height: 30 };
  document.getElementById('storybook-sounds-enabled').rect = {
    left: 140,
    top: 410,
    right: 180,
    bottom: 440,
    width: 40,
    height: 30
  };
  document.getElementById('storybook-reset').rect = { left: 140, top: 470, right: 350, bottom: 510, width: 210, height: 40 };
  document.getElementById('storybook-save').rect = { left: 380, top: 470, right: 500, bottom: 510, width: 120, height: 40 };
  document.getElementById('storybook-cancel').rect = { left: 540, top: 470, right: 660, bottom: 510, width: 120, height: 40 };

  append(playerScreen, 'div', 'toast', '');
  append(playerScreen, 'div', 'player-message', '');
}

asyncTest('smart search supports remote filtering, all result pages, details and playback return', function () {
  var videos = [];
  for (var i = 0; i < 65; i += 1) {
    videos.push({ Id: 'story-' + i, Name: 'Story ' + i });
  }
  var harness = loadAppHarness({
    libraries: [{ Id: 'movies', Name: 'Movies' }],
    videosByLibrary: { movies: videos },
    latest: [videos[0]],
    resume: [videos[0]]
  });
  var document = harness.document;
  assert.strictEqual(document.getElementById('search-button').disabled, true);
  return flush().then(function () {
    var calls = harness.apiCalls();
    document.getElementById('search-button').click();
    assert.ok(harness.screenActive('search-screen'));
    assert.strictEqual(document.getElementById('search-count').textContent, '65 matching titles');
    assert.strictEqual(document.getElementById('search-results').children.length, 30);
    var keys = document.getElementById('search-keyboard').children;
    var s = keys.filter(function (key) { return key.getAttribute('data-letter') === 's'; })[0];
    var x = keys.filter(function (key) { return key.getAttribute('data-letter') === 'x'; })[0];
    assert.strictEqual(x.disabled, true);
    x.click();
    assert.strictEqual(document.getElementById('search-query').textContent, 'Choose a letter');
    s.click();
    assert.strictEqual(document.getElementById('search-query').textContent, 's');
    assert.strictEqual(document.activeElement.getAttribute('data-letter'), 't');
    assert.strictEqual(document.activeElement.disabled, false);
    document.getElementById('search-more').click();
    assert.strictEqual(document.getElementById('search-results').children.length, 60);
    document.getElementById('search-more').click();
    assert.strictEqual(document.getElementById('search-results').children.length, 65);
    assert.strictEqual(document.getElementById('search-more').disabled, true);
    var card = document.getElementById('search-results').children[64];
    card.click();
    assert.ok(harness.screenActive('details-screen'));
    document.getElementById('play-button').click();
    assert.deepStrictEqual(harness.playCalls(), [{ id: 'story-64', fromBeginning: false }]);
    harness.setPlayerPlaying(false);
    harness.playerCallbacks().onStop(false);
    document.getElementById('details-back').click();
    assert.ok(harness.screenActive('search-screen'));
    assert.strictEqual(document.activeElement, card);
    assert.strictEqual(document.getElementById('search-query').textContent, 's');
    document.dispatchEvent('keydown', { keyCode: 8 });
    assert.strictEqual(document.getElementById('search-query').textContent, 'Choose a letter');
    document.dispatchEvent('keydown', { keyCode: 10009 });
    assert.ok(harness.screenActive('browse-screen'));
    assert.strictEqual(document.activeElement.id, 'search-button');
    document.getElementById('hero-open').click();
    assert.strictEqual(document.getElementById('details-title').textContent, 'Story 0');
    assert.deepStrictEqual(harness.apiCalls(), calls);
  });
});

asyncTest('storybook search stays within selected libraries and returns through kid details', function () {
  var harness = loadAppHarness({
    preferences: { enabled: true, lastMode: 'storybook', libraryIds: ['kids'], reducedMotion: true },
    libraries: [{ Id: 'kids', Name: 'Kids' }, { Id: 'adult', Name: 'Adult' }],
    videosByLibrary: {
      kids: [{ Id: 'kid1', Name: 'Happy Cat' }, { Id: 'kid2', Name: 'Cat Song' }],
      adult: [{ Id: 'adult1', Name: 'Cat Crime' }, { Id: 'adult2', Name: 'Zoo' }]
    },
    latest: [{ Id: 'adult2', Name: 'Zoo' }],
    resume: [{ Id: 'adult1', Name: 'Cat Crime' }]
  });
  var document = harness.document;
  return flush().then(function () {
    var calls = harness.apiCalls();
    document.getElementById('storybook-search-button').click();
    assert.ok(harness.screenActive('search-screen'));
    assert.strictEqual(document.getElementById('search-count').textContent, '2 matching titles');
    var z = document.getElementById('search-keyboard').children.filter(function (key) {
      return key.getAttribute('data-letter') === 'z';
    })[0];
    assert.strictEqual(z.disabled, true);
    var card = document.getElementById('search-results').children[0];
    assert.strictEqual(card.getAttribute('data-item-id'), 'kid1');
    assert.ok(card.classList.contains('storybook-menu-card'));
    card.click();
    assert.ok(harness.screenActive('storybook-details-screen'));
    document.getElementById('storybook-details-play').click();
    assert.deepStrictEqual(harness.playCalls(), [{ id: 'kid1', fromBeginning: false }]);
    harness.setPlayerPlaying(false);
    harness.playerCallbacks().onStop(false);
    document.getElementById('storybook-details-back').click();
    assert.ok(harness.screenActive('search-screen'));
    assert.strictEqual(document.activeElement, card);
    document.dispatchEvent('keydown', { keyCode: 10009 });
    assert.ok(harness.screenActive('storybook-screen'));
    assert.strictEqual(document.activeElement.id, 'storybook-search-button');
    assert.deepStrictEqual(harness.apiCalls(), calls);
  });
});

asyncTest('search reports partial library failures and clears its query', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'good', Name: 'Good' }, { Id: 'bad', Name: 'Bad' }],
    videosByLibrary: { good: [{ Id: '1', Name: 'AB' }, { Id: '2', Name: 'AC' }] },
    getVideosErrors: { bad: new Error('Unavailable') }
  });
  var document = harness.document;
  return flush().then(function () {
    document.getElementById('search-button').click();
    assert.ok(/Some libraries could not be loaded/.test(document.getElementById('search-warning').textContent));
    var keys = document.getElementById('search-keyboard').children;
    keys[0].click();
    keys[1].rect = { left: 100, top: 100, width: 50, height: 50, right: 150, bottom: 150 };
    keys[2].rect = { left: 200, top: 100, width: 50, height: 50, right: 250, bottom: 150 };
    keys[1].focus();
    document.dispatchEvent('keydown', { keyCode: 39 });
    assert.strictEqual(document.activeElement, keys[2]);
    keys[2].click();
    assert.strictEqual(document.getElementById('search-count').textContent, '1 matching titles');
    assert.strictEqual(document.activeElement.id, 'search-delete');
    document.getElementById('search-clear').click();
    assert.strictEqual(document.getElementById('search-count').textContent, '2 matching titles');
    assert.strictEqual(document.getElementById('search-clear').disabled, true);
    assert.strictEqual(document.activeElement.disabled, false);
  });
});

function microinteractionHarness(options) {
  options = options || {};
  return loadAppHarness({
    preferences: {
      enabled: true,
      lastMode: options.adult ? 'adult' : 'storybook',
      libraryIds: ['kids'],
      reducedMotion: options.reducedMotion === true
    },
    prefersReducedMotion: options.prefersReducedMotion === true,
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    videosByLibrary: {
      kids: [
        { Id: 'bluey', Name: 'Bluey' },
        { Id: 'bluebird', Name: 'Bluebird' },
        { Id: 'unicode', Name: 'A\uD83D\uDE00 A' }
      ]
    }
  });
}

function searchKey(document, letter) {
  return document.getElementById('search-keyboard').children.filter(function (key) {
    return key.getAttribute('data-letter') === letter;
  })[0];
}

asyncTest('the moon follows focus, dozes after inactivity and wakes without stealing the next key', function () {
  var harness = microinteractionHarness();
  var document = harness.document;
  return flush().then(function () {
    var moon = document.getElementById('storybook-screen').getElementsByClassName('storybook-moon')[0];
    var left = document.getElementById('storybook-search-button');
    var right = document.getElementById('storybook-home-storybook-mode-button');
    assert.strictEqual(moon.getElementsByClassName('storybook-moon-eye').length, 2);
    var pupil = moon.getElementsByClassName('storybook-moon-pupil')[0];
    left.rect = { left: 100, top: 300, right: 200, bottom: 350, width: 100, height: 50 };
    right.rect = { left: 1500, top: 300, right: 1600, bottom: 350, width: 100, height: 50 };
    left.focus();
    assert.ok(/^translate\(-/.test(pupil.style.transform), 'Eyes look left toward the selected control');
    right.focus();
    assert.ok(/^translate\([0-9]/.test(pupil.style.transform), 'Eyes look right toward the selected control');
    var cues = harness.soundCalls().length;
    harness.advanceTime(11999);
    assert.ok(moon.classList.contains('is-awake'));
    harness.advanceTime(1);
    assert.ok(moon.classList.contains('is-sleepy'));
    assert.strictEqual(harness.pendingMotionTimers(), 0);
    document.dispatchEvent('keydown', { keyCode: 13 });
    assert.ok(moon.classList.contains('is-awake'));
    assert.ok(!moon.classList.contains('is-sleepy'));
    assert.strictEqual(document.activeElement, right);
    assert.strictEqual(harness.pendingMotionTimers(), 1);
    assert.strictEqual(harness.soundCalls().length, cues, 'The companion adds no sound cues');
  });
});

asyncTest('moon activity stops for hidden pages, reduced motion, playback and Adult Mode', function () {
  var harness = microinteractionHarness();
  var document = harness.document;
  return flush().then(function () {
    assert.strictEqual(harness.pendingMotionTimers(), 1);
    document.hidden = true;
    document.dispatchEvent('visibilitychange');
    assert.strictEqual(harness.pendingMotionTimers(), 0);
    document.hidden = false;
    document.dispatchEvent('visibilitychange');
    assert.strictEqual(harness.pendingMotionTimers(), 1);
    harness.setSystemReducedMotion(true);
    document.dispatchEvent('keydown', { keyCode: 13 });
    assert.strictEqual(harness.pendingMotionTimers(), 0);
    harness.setSystemReducedMotion(false);
    assert.strictEqual(harness.pendingMotionTimers(), 1);
    harness.dispatchWindowEvent('pagehide');
    assert.strictEqual(harness.pendingMotionTimers(), 0);
    harness.dispatchWindowEvent('pageshow');
    assert.strictEqual(harness.pendingMotionTimers(), 1);
    document.querySelectorAll('#storybook-doors .storybook-door')[0].click();
    document.getElementById('storybook-library-cards').firstChild.click();
    document.getElementById('storybook-details-play').click();
    assert.ok(harness.screenActive('player-screen'));
    assert.strictEqual(harness.pendingMotionTimers(), 0);
    harness.setPlayerPlaying(false);
    harness.playerCallbacks().onStop(false);
    assert.strictEqual(harness.pendingMotionTimers(), 1);
    document.getElementById('storybook-details-adult-mode-button').click();
    assert.strictEqual(harness.pendingMotionTimers(), 0);
    document.dispatchEvent('keydown', { keyCode: 13 });
    harness.advanceTime(20000);
    assert.strictEqual(document.querySelectorAll('.is-awake').length, 0);
    assert.strictEqual(document.querySelectorAll('.is-sleepy').length, 0);
  });
});

asyncTest('search stamps only the new letter while queries, results and remote focus update immediately', function () {
  var harness = microinteractionHarness();
  var document = harness.document;
  return flush().then(function () {
    document.getElementById('storybook-search-button').click();
    var query = document.getElementById('search-query');
    'blue'.split('').forEach(function (letter) { searchKey(document, letter).click(); });
    assert.strictEqual(query.textContent, 'blue');
    assert.strictEqual(query.getElementsByClassName('is-stamping').length, 1);
    assert.strictEqual(query.getElementsByClassName('is-stamping')[0].textContent, 'e');
    searchKey(document, 'y').click();
    assert.strictEqual(query.textContent, 'bluey');
    assert.strictEqual(document.getElementById('search-results').children.length, 1);
    assert.strictEqual(document.activeElement.id, 'search-delete');
    document.dispatchEvent('keydown', { keyCode: 8 });
    assert.strictEqual(query.textContent, 'blue', 'Outgoing decoration is outside the live query');
    assert.strictEqual(document.getElementById('search-results').children.length, 2);
    var peel = document.querySelectorAll('.storybook-search-peel')[0];
    assert.ok(peel, 'Deleted letter peels away');
    assert.strictEqual(peel.textContent, 'y');
    assert.strictEqual(peel.getAttribute('aria-hidden'), 'true');
    searchKey(document, 'y').click();
    assert.strictEqual(document.querySelectorAll('.storybook-search-peel').length, 0);
    peel.dispatch('animationend');
    assert.strictEqual(query.getElementsByClassName('is-stamping').length, 1, 'Stale animation cannot clear the new stamp');
    query.children[query.children.length - 1].dispatch('animationend');
    assert.strictEqual(query.getElementsByClassName('is-stamping').length, 0);
    document.getElementById('search-delete').click();
    peel = document.querySelectorAll('.storybook-search-peel')[0];
    peel.dispatch('animationend');
    assert.strictEqual(document.querySelectorAll('.storybook-search-peel').length, 0);
    document.getElementById('search-results').firstChild.click();
    assert.strictEqual(query.getElementsByClassName('is-stamping').length, 0);
    document.getElementById('storybook-details-back').click();
    assert.strictEqual(query.textContent, 'blue');
    document.getElementById('search-clear').click();
    searchKey(document, '\uD83D\uDE00').click();
    document.getElementById('search-delete').click();
    assert.strictEqual(query.textContent, 'Choose a letter');
    assert.strictEqual(document.querySelectorAll('.storybook-search-peel')[0].textContent, '\uD83D\uDE00');
    document.getElementById('search-back').click();
    assert.strictEqual(document.querySelectorAll('.storybook-search-peel').length, 0);
  });
});

[
  { label: 'parent reduced motion', reducedMotion: true },
  { label: 'system reduced motion', prefersReducedMotion: true },
  { label: 'Adult Mode', adult: true }
].forEach(function (options) {
  asyncTest('moon and search effects stay static with ' + options.label, function () {
    var harness = microinteractionHarness(options);
    var document = harness.document;
    return flush().then(function () {
      assert.strictEqual(harness.pendingMotionTimers(), 0);
      document.getElementById(options.adult ? 'search-button' : 'storybook-search-button').click();
      searchKey(document, 'b').click();
      assert.strictEqual(document.getElementById('search-query').textContent, 'b');
      assert.strictEqual(document.querySelectorAll('.is-stamping').length, 0);
      document.getElementById('search-delete').click();
      assert.strictEqual(document.getElementById('search-query').textContent, 'Choose a letter');
      assert.strictEqual(document.querySelectorAll('.storybook-search-peel').length, 0);
      assert.strictEqual(document.querySelectorAll('.is-awake').length, 0);
    });
  });
});

function defaultStorybookBootstrap(overrides) {
  var result = {
    nowMs: Date.parse('2026-09-02T02:00:00.000Z'),
    storybookSessionSeed: 'app-test-launch-seed'
  };
  var source = overrides || {};

  if (source.nowMs !== undefined) {
    result.nowMs = source.nowMs;
  }
  if (source.storybookSessionSeed !== undefined) {
    result.storybookSessionSeed = source.storybookSessionSeed;
  }
  return result;
}

function loadAppHarness(options) {
  options = options || {};
  var modelWindow = load('js/storybook-model.js', { window: {} });
  var catalogueWindow = load('js/storybook-catalogue.js', {
    window: {
      RawiStorybookModel: modelWindow.RawiStorybookModel
    }
  });
  var discoveryWindow = load('js/storybook-discovery.js', { window: {} });
  var document = new FakeDocument();
  var localStorage = createStorage();
  var timers = [];
  var intervals = [];
  var motionTimers = [];
  var motionTime = 0;
  var windowListeners = {};
  var motionListeners = [];
  var motionPreference = {
    matches: options.prefersReducedMotion === true,
    addListener: function (listener) { motionListeners.push(listener); }
  };
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
  var activeStorybookHomeReady = null;
  var pendingStorybookHomeReady = [];
  var storybookDoorFocusCalls = [];
  var storybookHomeAnimationCalls = 0;
  var storybookMotionCalls = [];
  var storybookStopCalls = 0;
  var soundCalls = [];
  var soundEnabledChanges = [];
  var soundStopCalls = 0;
  var soundAudio = [];
  var soundWarnings = [];
  var realSoundWindow = options.realSound ? load('js/storybook-sound.js', {
    window: {
      Audio: createCueAudioClass(soundAudio),
      console: {
        warn: function (message) { soundWarnings.push(message); }
      }
    }
  }) : null;
  var storybookBootstrap = defaultStorybookBootstrap(options.storybookBootstrap);
  var currentPreferences = JSON.parse(JSON.stringify(basePreferences(options.preferences || {})));
  var rawStorybookStorage = Object.prototype.hasOwnProperty.call(options, 'rawStorybookStorage') ?
    options.rawStorybookStorage :
    JSON.stringify(currentPreferences);
  var librariesDeferred = options.librariesDeferred || null;
  var restoreValue = options.restoreSession !== false;
  var quickConnectApproved = false;
  var quickConnectAuthentications = 0;

  function shouldDeferStorybookHomeReady(callIndex, reducedMotion) {
    if (reducedMotion) { return false; }
    return Array.isArray(options.deferStorybookHomeReadyCalls) &&
      options.deferStorybookHomeReadyCalls.indexOf(callIndex) !== -1;
  }

  function cancelActiveStorybookHomeReady() {
    if (!activeStorybookHomeReady) { return; }
    activeStorybookHomeReady.cancelled = true;
    activeStorybookHomeReady = null;
  }

  function releaseStorybookHomeReady() {
    var entry;

    while (pendingStorybookHomeReady.length) {
      entry = pendingStorybookHomeReady.shift();
      if (entry.cancelled) { continue; }
      if (activeStorybookHomeReady === entry) {
        activeStorybookHomeReady = null;
      }
      entry.callback();
      return true;
    }

    return false;
  }

  function normalizePreferences(nextState) {
    var source = nextState || {};
    return basePreferences({
      enabled: source.enabled === true,
      lastMode: source.lastMode === 'storybook' ? 'storybook' : 'adult',
      childName: typeof source.childName === 'string' ? source.childName : '',
      libraryIds: Array.isArray(source.libraryIds) ? source.libraryIds.slice() : [],
      favoriteItemIds: Array.isArray(source.favoriteItemIds) ? source.favoriteItemIds.slice() : [],
      categoryTags: source.categoryTags || null,
      durationLabels: source.durationLabels || null,
      recentHistoryDays: source.recentHistoryDays,
      reducedMotion: source.reducedMotion === true,
      soundsEnabled: source.soundsEnabled !== undefined ? source.soundsEnabled === true : true
    });
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
    searchCount: '{count} matching titles',
    searchPlaceholder: 'Choose a letter',
    searchEmpty: 'No titles to search. Return to the library and refresh.',
    searchPartial: 'Some libraries could not be loaded. Results cover loaded titles only; refresh the library to try again.',
    signedOut: 'Signed out',
    storybookCategoriesTitle: 'Pick a kind of story',
    storybookCategoryAriaLabel: 'Open {category}',
    storybookCategorySingDance: 'Sing & Dance',
    storybookCategoryBedtime: 'Bedtime Stories',
    storybookCategoryAnimals: 'Animal Friends',
    storybookCategoryLearning: 'Little Lessons',
    storybookCategoryMovement: 'Move Around',
    storybookCategoryTagsLabel: 'Jellyfin tags for Storybook categories',
    storybookDurationSettingsLabel: 'Friendly duration labels',
    storybookDurationLabelsEnabledLabel: 'Show friendly duration labels on Storybook cards and details',
    storybookDurationQuickMaxLabel: 'Quick story up to this many minutes',
    storybookDurationCozyMaxLabel: 'Cozy episode up to this many minutes',
    storybookRecentHistoryDaysLabel: 'Hide completed stories for this many days',
    storybookSoundsEnabledLabel: 'Play gentle Storybook sounds',
    storybookDurationThresholdError: 'Quick story minutes must be 1 to 240, and Cozy episode minutes must be between Quick story minutes and 240.',
    storybookRecentHistoryDaysError: 'Recent history days must be between 0 and 365.',
    storybookLittleMenuTitle: "Tonight's Little Menu",
    storybookMagicPickButton: 'Magic Pick',
    storybookMagicPickBackButton: '← Storybook',
    storybookMagicPickEmptyBody: 'Everything in the selected Storybook libraries was finished recently. Try a Story Door instead.',
    storybookMagicPickEmptyPrimaryButton: 'Open Story Doors',
    storybookMagicPickEmptySecondaryButton: 'Back to Storybook',
    storybookMagicPickEmptyTitle: 'No Magic Pick right now',
    storybookMagicPickOpenButton: 'Tell me about this story',
    storybookMagicPickAgainButton: 'Pick again',
    storybookMagicReasonAnyStory: 'A cozy surprise from your Story Doors.',
    storybookMagicReasonDifferentCategory: 'Something a little different from last time.',
    storybookMagicReasonFavorite: 'A favorite with a little extra sparkle.',
    storybookMagicReasonUnwatched: 'A new story to discover.',
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
    storybookFriendlyRuntime: '{minutes} • {label}',
    storybookDurationQuickStory: 'Quick story',
    storybookDurationCozyEpisode: 'Cozy episode',
    storybookDurationBigMovie: 'Big movie',
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
    authenticateQuickConnect: function () {
      quickConnectAuthentications += 1;
      return Promise.resolve();
    },
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
    getQuickConnectState: function () {
      return Promise.resolve({ Authenticated: quickConnectApproved });
    },
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
      animateStorybookHome: function (reducedMotion, onReady) {
        var entry;

        storybookHomeAnimationCalls += 1;
        storybookMotionCalls.push(reducedMotion);
        cancelActiveStorybookHomeReady();
        if (typeof onReady !== 'function') { return; }
        if (!shouldDeferStorybookHomeReady(storybookHomeAnimationCalls, reducedMotion)) {
          onReady();
          return;
        }
        entry = {
          callback: onReady,
          cancelled: false
        };
        activeStorybookHomeReady = entry;
        pendingStorybookHomeReady.push(entry);
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
        cancelActiveStorybookHomeReady();
      }
    },
    matchMedia: function (query) {
      return query === '(prefers-reduced-motion: reduce)' ? motionPreference : { matches: false };
    },
    addEventListener: function (type, listener) {
      if (!windowListeners[type]) { windowListeners[type] = []; }
      windowListeners[type].push(listener);
    },
    setTimeout: function (fn, delay) {
      if (!delay) { fn(); return 0; }
      motionTimers.push({ callback: fn, due: motionTime + delay, cancelled: false });
      return motionTimers.length;
    },
    clearTimeout: function (id) {
      if (motionTimers[id - 1]) { motionTimers[id - 1].cancelled = true; }
    },
    MovieDeckApi: api,
    MovieDeckPlayer: {
      handleKey: function () {},
      init: function (options) {
        playerCallbacks = options || {};
      },
      isPlaying: function () { return isPlayingState; },
      // The real player only assigns its current stream inside the
      // getPlaybackInfo continuation, so isPlaying() stays false for the whole
      // synchronous turn. options.asyncPlayer reproduces that timing; the call
      // is still recorded synchronously either way.
      play: function (item, fromBeginning) {
        playCalls.push({ id: item.Id, fromBeginning: fromBeginning });
        if (options.asyncPlayer) {
          return Promise.resolve().then(function () { isPlayingState = true; });
        }
        if (options.asyncPlayerRejects) {
          return Promise.resolve().then(function () {
            throw new Error('Playback info failed.');
          });
        }
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
    RawiStorybookSound: {
      init: function (soundOptions) {
        if (realSoundWindow) { realSoundWindow.RawiStorybookSound.init(soundOptions); }
      },
      play: function (cueName) {
        soundCalls.push(cueName);
        if (realSoundWindow) { return realSoundWindow.RawiStorybookSound.play(cueName); }
        return true;
      },
      setEnabled: function (enabled) {
        soundEnabledChanges.push(enabled === true);
        if (realSoundWindow) { realSoundWindow.RawiStorybookSound.setEnabled(enabled); }
      },
      stop: function () {
        soundStopCalls += 1;
        if (realSoundWindow) { realSoundWindow.RawiStorybookSound.stop(); }
      }
    },
    RawiStorybookModel: modelWindow.RawiStorybookModel,
    RawiStorybookCatalogue: catalogueWindow.RawiStorybookCatalogue,
    RawiStorybookDiscovery: discoveryWindow.RawiStorybookDiscovery,
    RawiStorybookPreferences: {
      defaults: function () {
        return basePreferences();
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
        return this.save(this.defaults(), { allowRecoveryWrite: true });
      },
      save: function (nextState, options) {
        if (currentRestoreStatus.needsRecovery && !(options && options.allowRecoveryWrite)) {
          return null;
        }
        currentPreferences = normalizePreferences(nextState);
        savedState = JSON.parse(JSON.stringify(currentPreferences));
        rawStorybookStorage = JSON.stringify(currentPreferences);
        currentRestoreStatus = {
          needsRecovery: false,
          type: 'ok'
        };
        return JSON.parse(JSON.stringify(currentPreferences));
      }
    },
    __RAWI_STORYBOOK_BOOTSTRAP__: {
      nowMs: storybookBootstrap.nowMs,
      storybookSessionSeed: storybookBootstrap.storybookSessionSeed
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
  ['js/smart-search.js', 'js/storybook-view.js', 'js/app.js'].forEach(function (file) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
      context,
      { filename: file }
    );
  });
  document.dispatchEvent('DOMContentLoaded', {});

  return {
    advanceTime: function (milliseconds) {
      motionTime += milliseconds;
      motionTimers.forEach(function (timer) {
        if (!timer.cancelled && timer.due <= motionTime) {
          timer.cancelled = true;
          timer.callback();
        }
      });
    },
    pendingMotionTimers: function () {
      return motionTimers.filter(function (timer) { return !timer.cancelled; }).length;
    },
    setSystemReducedMotion: function (reduced) {
      motionPreference.matches = reduced;
      motionListeners.forEach(function (listener) { listener(motionPreference); });
    },
    dispatchWindowEvent: function (type) {
      (windowListeners[type] || []).forEach(function (listener) { listener(); });
    },
    approveQuickConnect: function () { quickConnectApproved = true; },
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
    pendingStorybookHomeReadyCount: function () {
      return pendingStorybookHomeReady.filter(function (entry) {
        return !entry.cancelled;
      }).length;
    },
    playCalls: function () {
      return JSON.parse(JSON.stringify(playCalls));
    },
    playerCallbacks: function () {
      return playerCallbacks;
    },
    playerPlaying: function () {
      return isPlayingState;
    },
    quickConnectAuthentications: function () { return quickConnectAuthentications; },
    rawStorybookStorage: function () {
      return rawStorybookStorage;
    },
    releaseStorybookHomeReady: function () {
      return releaseStorybookHomeReady();
    },
    // The Quick Connect poll runs on a real interval, so a test that wants the
    // production re-authentication path has to tick it rather than reach into
    // the app.
    runIntervals: function () {
      intervals.slice().forEach(function (fn) { fn(); });
      return intervals.length;
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
    soundCalls: function () { return soundCalls.slice(); },
    soundEnabledChanges: function () { return soundEnabledChanges.slice(); },
    soundStopCalls: function () { return soundStopCalls; },
    soundAudioByCue: function () {
      var byCue = {};
      soundAudio.forEach(function (audio) {
        byCue[cueNameFromAudioSrc(audio.src)] = audio;
      });
      return byCue;
    },
    soundUnpausedSrcs: function () {
      return soundAudio.filter(function (audio) {
        return audio.paused !== true;
      }).map(function (audio) { return audio.src; });
    },
    soundWarnings: function () { return soundWarnings.slice(); },
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
    harness.document.activeElement.getAttribute('data-item-id'),
    'colors'
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

asyncTest('previewRoutesCanOpenHomeCategoryMagicSettingsDetailsAndEndingWithoutJellyfin', function () {
  var fixture = load('js/preview-fixtures.js', { window: {} }).RawiPreviewFixtures;
  var homeHarness = loadAppHarness({
    locationSearch: '?preview=storybook',
    previewFixtures: fixture,
    restoreSession: true
  });
  var libraryHarness = loadAppHarness({
    locationSearch: '?preview=storybook&storybookScreen=library&storybookLibraryId=songs',
    previewFixtures: fixture,
    restoreSession: true
  });
  var categoryHarness = loadAppHarness({
    locationSearch: '?preview=storybook&storybookScreen=category&storybookCategoryKey=animals',
    previewFixtures: fixture,
    restoreSession: true
  });
  var magicHarness = loadAppHarness({
    locationSearch: '?preview=storybook&storybookScreen=magic',
    previewFixtures: fixture,
    restoreSession: true
  });
  var settingsHarness = loadAppHarness({
    locationSearch: '?preview=storybook&storybookScreen=settings',
    previewFixtures: fixture,
    restoreSession: true
  });
  var detailsHarness = loadAppHarness({
    locationSearch: '?preview=storybook&storybookScreen=details&storybookItemId=bluey',
    previewFixtures: fixture,
    restoreSession: true
  });
  var endingHarness = loadAppHarness({
    locationSearch: '?preview=storybook&storybookScreen=ending&storybookItemId=bluey',
    previewFixtures: fixture,
    restoreSession: true
  });

  return flush(12).then(function () {
    assert.strictEqual(homeHarness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      Array.prototype.map.call(
        homeHarness.document.getElementById('storybook-little-menu').children,
        function (node) {
          return node.getAttribute('data-item-id');
        }
      ),
      ['dance', 'colors', 'fox']
    );
    assert.deepStrictEqual(
      Array.prototype.map.call(
        homeHarness.document.getElementById('storybook-categories').children,
        function (node) {
          return node.getAttribute('data-category-key');
        }
      ),
      ['singDance', 'bedtime', 'animals', 'learning', 'movement']
    );
    assert.strictEqual(homeHarness.document.activeElement.id, 'storybook-resume-card');

    assert.strictEqual(libraryHarness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(libraryHarness.document.getElementById('storybook-library-title').textContent, 'Sing & Dance');
    assert.strictEqual(libraryHarness.document.activeElement.id, 'storybook-library-card-dance');

    assert.strictEqual(categoryHarness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(categoryHarness.document.getElementById('storybook-library-title').textContent, 'Animal Friends');

    assert.strictEqual(magicHarness.screenActive('storybook-magic-pick-screen'), true);
    assert.strictEqual(magicHarness.document.getElementById('storybook-magic-pick-title').textContent, 'Dance With Me');

    assert.strictEqual(settingsHarness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(settingsHarness.document.activeElement.id, 'storybook-child-name');
    assert.strictEqual(settingsHarness.document.getElementById('storybook-recent-history-days').value, '14');
    assert.strictEqual(
      settingsHarness.document.getElementById('storybook-sounds-enabled').checked,
      true
    );

    assert.strictEqual(detailsHarness.screenActive('storybook-details-screen'), true);
    assert.strictEqual(detailsHarness.document.activeElement.id, 'storybook-details-play');
    assert.strictEqual(endingHarness.screenActive('storybook-ending-screen'), true);
    assert.strictEqual(endingHarness.document.activeElement.id, 'storybook-ending-all-done');

    [
      homeHarness,
      libraryHarness,
      categoryHarness,
      magicHarness,
      settingsHarness,
      detailsHarness,
      endingHarness
    ].forEach(function (routeHarness) {
      assert.deepStrictEqual(routeHarness.apiCalls(), {
        getLatest: 0,
        getLibraries: 0,
        getResume: 0,
        getVideos: 0,
        restore: 0
      });
    });
  });
});

asyncTest('previewSettingsSavePreservesNonDefaultStorybookState', function () {
  var fixture = load('js/preview-fixtures.js', { window: {} }).RawiPreviewFixtures;
  var customFixture = JSON.parse(JSON.stringify(fixture));
  var harness;

  customFixture.storybook.preferences = basePreferences({
    enabled: true,
    lastMode: 'storybook',
    libraryIds: ['pixar', 'songs', 'lessons'],
    categoryTags: {
      singDance: 'songs',
      bedtime: 'sleep',
      animals: 'zoo',
      learning: 'school',
      movement: 'move'
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 8,
      cozyMaxMinutes: 18
    },
    recentHistoryDays: 21,
    soundsEnabled: false
  });
  harness = loadAppHarness({
    locationSearch: '?preview=storybook&storybookScreen=settings',
    previewFixtures: customFixture,
    restoreSession: true
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.document.getElementById('storybook-recent-history-days').value, '21');
    assert.strictEqual(harness.document.getElementById('storybook-sounds-enabled').checked, false);
    harness.document.getElementById('storybook-child-name').value = 'Nora';
    harness.document.getElementById('storybook-save').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.savedState().childName, 'Nora');
    assert.deepStrictEqual(harness.savedState().categoryTags, {
      singDance: 'songs',
      bedtime: 'sleep',
      animals: 'zoo',
      learning: 'school',
      movement: 'move'
    });
    assert.deepStrictEqual(harness.savedState().durationLabels, {
      enabled: false,
      quickMaxMinutes: 8,
      cozyMaxMinutes: 18
    });
    assert.strictEqual(harness.savedState().recentHistoryDays, 21);
    assert.strictEqual(harness.savedState().soundsEnabled, false);
    assert.deepStrictEqual(harness.apiCalls(), {
      getLatest: 0,
      getLibraries: 0,
      getResume: 0,
      getVideos: 0,
      restore: 0
    });
  });
});

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

asyncTest('previewKeepsRecoverableStorybookPreferenceCorruptionBlockedUntilConfirmedReset', function () {
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

  assert.strictEqual(harness.screenActive('storybook-screen'), true);
  harness.document.getElementById('storybook-edit-libraries').click();

  assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
  assert.strictEqual(
    harness.document.getElementById('storybook-settings-warning').textContent,
    'Saved Storybook settings could not be read. Reset Storybook settings before saving new Storybook options.'
  );
  assert.strictEqual(harness.document.getElementById('storybook-child-name').disabled, true);
  assert.strictEqual(harness.document.getElementById('storybook-save').disabled, true);
  assert.strictEqual(harness.document.getElementById('storybook-reset').disabled, false);

  harness.document.getElementById('storybook-reduced-motion').checked = true;
  harness.document.getElementById('storybook-save').click();
  assert.strictEqual(harness.savedState(), null);
  harness.document.getElementById('storybook-reset').click();

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(
      harness.document.getElementById('storybook-settings-warning').textContent,
      'Saved Storybook settings could not be read. Select Confirm reset to clear the saved Storybook settings.'
    );
    assert.strictEqual(harness.savedState(), null);

    harness.document.getElementById('storybook-reset').click();

    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.savedState())),
      basePreferences({
        enabled: false,
        lastMode: 'adult',
        childName: '',
        libraryIds: [],
        favoriteItemIds: [],
        reducedMotion: false
      })
    );
    assert.strictEqual(harness.document.getElementById('storybook-save').disabled, false);
  });
});

asyncTest('savingStorybookSettingsRetainsFavoriteItemIdsFromMigratedPreferences', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['video-1', 'video-2'],
      reducedMotion: false
    }),
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
      basePreferences({
        enabled: true,
        lastMode: 'storybook',
        childName: 'Ava',
        libraryIds: ['disney'],
        favoriteItemIds: ['video-1', 'video-2'],
        reducedMotion: true
      })
    );
  });
});

asyncTest('savingStorybookSettingsWritesAndReloadsAllPhase3Fields', function () {
  var savedState;
  var reloadHarness;
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Tags: ['animals'] }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-settings-button').click();
    harness.document.getElementById('storybook-category-tag-animals').value = 'zoo';
    harness.document.getElementById('storybook-duration-labels-enabled').checked = false;
    harness.document.getElementById('storybook-duration-quick-max').value = '10';
    harness.document.getElementById('storybook-duration-cozy-max').value = '25';
    harness.document.getElementById('storybook-recent-history-days').value = '3';
    harness.document.getElementById('storybook-save').click();
    return flush(12);
  }).then(function () {
    savedState = JSON.parse(JSON.stringify(harness.savedState()));
    assert.deepStrictEqual(savedState.categoryTags, {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'zoo',
      learning: 'learning',
      movement: 'movement'
    });
    assert.deepStrictEqual(savedState.durationLabels, {
      enabled: false,
      quickMaxMinutes: 10,
      cozyMaxMinutes: 25
    });
    assert.strictEqual(savedState.recentHistoryDays, 3);

    reloadHarness = loadAppHarness({
      libraries: [{ Id: 'kids', Name: 'Kids' }],
      preferences: savedState,
      restoreSession: true,
      videosByLibrary: {
        kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Tags: ['animals'] }]
      }
    });
    return flush(12);
  }).then(function () {
    reloadHarness.document.getElementById('storybook-settings-button').click();
    assert.strictEqual(reloadHarness.document.getElementById('storybook-category-tag-animals').value, 'zoo');
    assert.strictEqual(reloadHarness.document.getElementById('storybook-duration-quick-max').value, '10');
    assert.strictEqual(reloadHarness.document.getElementById('storybook-recent-history-days').value, '3');
  });
});

asyncTest('savingStorybookSoundSettingWritesAndReloadsUnchecked', function () {
  var savedState;
  var reloadHarness;
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      libraryIds: ['kids'],
      soundsEnabled: true
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Tags: ['animals'] }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-settings-button').click();
    assert.strictEqual(harness.document.getElementById('storybook-sounds-enabled').checked, true);
    harness.document.getElementById('storybook-sounds-enabled').checked = false;
    harness.document.getElementById('storybook-save').click();
    return flush(12);
  }).then(function () {
    savedState = JSON.parse(JSON.stringify(harness.savedState()));
    assert.strictEqual(savedState.soundsEnabled, false);

    reloadHarness = loadAppHarness({
      libraries: [{ Id: 'kids', Name: 'Kids' }],
      preferences: savedState,
      restoreSession: true,
      videosByLibrary: {
        kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Tags: ['animals'] }]
      }
    });
    return flush(12);
  }).then(function () {
    reloadHarness.document.getElementById('storybook-settings-button').click();
    assert.strictEqual(reloadHarness.document.getElementById('storybook-sounds-enabled').checked, false);
  });
});

asyncTest('modeSwitchAndFavoriteTogglePreserveExistingPhase3Settings', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      libraryIds: ['kids'],
      categoryTags: {
        singDance: 'songs',
        bedtime: 'sleep',
        animals: 'zoo',
        learning: 'school',
        movement: 'move'
      },
      durationLabels: {
        enabled: false,
        quickMaxMinutes: 9,
        cozyMaxMinutes: 19
      },
      recentHistoryDays: 2
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Tags: ['animals'] }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-mode-button').click();
    return flush(12);
  }).then(function () {
    assert.deepStrictEqual(harness.savedState().categoryTags, {
      singDance: 'songs',
      bedtime: 'sleep',
      animals: 'zoo',
      learning: 'school',
      movement: 'move'
    });
    assert.deepStrictEqual(harness.savedState().durationLabels, {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 19
    });
    assert.strictEqual(harness.savedState().recentHistoryDays, 2);

    harness.document.getElementById('storybook-home-adult-mode-button').click();
    return flush(12);
  }).then(function () {
    harness.document.getElementById('hero-open').click();
    harness.document.getElementById('favorite-button').click();
    assert.deepStrictEqual(harness.savedState().categoryTags, {
      singDance: 'songs',
      bedtime: 'sleep',
      animals: 'zoo',
      learning: 'school',
      movement: 'move'
    });
    assert.deepStrictEqual(harness.savedState().durationLabels, {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 19
    });
    assert.strictEqual(harness.savedState().recentHistoryDays, 2);
  });
});

asyncTest('pruningFavoritesPreservesNonDefaultPhase3Settings', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1', 'missing-favorite'],
      categoryTags: {
        singDance: 'songs',
        bedtime: 'sleep',
        animals: 'zoo',
        learning: 'school',
        movement: 'move'
      },
      durationLabels: {
        enabled: false,
        quickMaxMinutes: 8,
        cozyMaxMinutes: 18
      },
      recentHistoryDays: 21
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Tags: ['animals'] }]
    }
  });

  return flush(12).then(function () {
    assert.deepStrictEqual(harness.savedState(), basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      categoryTags: {
        singDance: 'songs',
        bedtime: 'sleep',
        animals: 'zoo',
        learning: 'school',
        movement: 'move'
      },
      durationLabels: {
        enabled: false,
        quickMaxMinutes: 8,
        cozyMaxMinutes: 18
      },
      recentHistoryDays: 21
    }));
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

asyncTest('recoverySettingsCanOpenWhileLibrariesAreStillLoading', function () {
  var libraries = deferred();
  var harness = loadAppHarness({
    librariesDeferred: libraries,
    rawStorybookStorage: '',
    restoreSession: true,
    restoreStatus: {
      needsRecovery: true,
      type: 'malformed'
    }
  });

  harness.document.getElementById('storybook-settings-button').click();
  assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
  assert.strictEqual(
    harness.document.getElementById('storybook-settings-warning').textContent,
    'Saved Storybook settings could not be read. Reset Storybook settings before saving new Storybook options.'
  );
  assert.strictEqual(harness.document.getElementById('storybook-save').disabled, true);
  assert.strictEqual(harness.document.activeElement.id, 'storybook-reset');
  assert.strictEqual(harness.rawStorybookStorage(), '');
  assert.strictEqual(harness.toastText(), '');

  libraries.resolve([{ Id: 'kids', Name: 'Kids' }]);
  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
  });
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
      harness.document.activeElement.getAttribute('data-item-id'),
      'video-1'
    );
    assert.strictEqual(savedState.lastMode, 'storybook');
    assert.deepStrictEqual(savedState.libraryIds, ['kids']);
    return flush(12);
  }).then(function () {
    assert.strictEqual(reloadHarness.screenActive('storybook-screen'), true);
    assert.strictEqual(
      reloadHarness.document.activeElement.getAttribute('data-item-id'),
      'video-1'
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

  return flush(12).then(function () {
    harness.document.getElementById('storybook-mode-button').click();

    assert.strictEqual(harness.toastText(), 'Choose Storybook libraries before opening this mode.');
    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-child-name');

    harness.document.getElementById('storybook-cancel').click();
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-mode-button');
  });
});

asyncTest('remoteNavigationMovesThroughEveryStorybookSettingsControlAndScrollsThePanel', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Tags: ['animals'] }]
    }
  });
  var panel = harness.document.getElementById('storybook-settings-screen').getElementsByClassName('settings-panel')[0];
  var checkboxes;
  var downOrder = [
    'storybook-library-input-kids',
    'storybook-category-tag-singDance',
    'storybook-category-tag-bedtime',
    'storybook-category-tag-animals',
    'storybook-category-tag-learning',
    'storybook-category-tag-movement',
    'storybook-duration-labels-enabled',
    'storybook-duration-quick-max',
    'storybook-duration-cozy-max',
    'storybook-recent-history-days',
    'storybook-reduced-motion',
    'storybook-sounds-enabled',
    'storybook-save'
  ];

  return flush(12).then(function () {
    harness.document.getElementById('storybook-settings-button').click();
    assert.strictEqual(harness.document.activeElement.id, 'storybook-child-name');
    checkboxes = harness.document.querySelectorAll('#storybook-library-options input[type="checkbox"]');
    checkboxes[0].rect = { left: 140, top: 180, right: 170, bottom: 210, width: 30, height: 30 };

    downOrder.forEach(function (expectedId) {
      harness.document.dispatchEvent('keydown', {
        keyCode: 40,
        preventDefault: function () {}
      });
      assert.strictEqual(harness.document.activeElement.id, expectedId);
    });
    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });
    assert.strictEqual(harness.document.activeElement.id, 'storybook-cancel');

    harness.document.dispatchEvent('keydown', {
      keyCode: 37,
      preventDefault: function () {}
    });
    assert.strictEqual(harness.document.activeElement.id, 'storybook-save');

    assert(panel.scrollTop > 0);
  });
});

asyncTest('storybookModeAttemptDuringRecoveryOpensRecoverySettingsWithoutSaving', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: false,
      lastMode: 'adult',
      childName: '',
      libraryIds: [],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    harness.document.getElementById('storybook-mode-button').click();

    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-reset');
    assert.strictEqual(
      harness.document.getElementById('storybook-settings-warning').textContent,
      'Saved Storybook settings could not be read. Reset Storybook settings before saving new Storybook options.'
    );
    assert.strictEqual(harness.savedState(), null);
    assert.strictEqual(harness.toastText(), '');
  });
});

asyncTest('keepsTheJellyfinSessionWhileRecoveringMalformedStorybookPreferences', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      version: 1,
      enabled: false,
      lastMode: 'adult',
      childName: '',
      libraryIds: [],
      reducedMotion: false
    }),
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
      basePreferences({
        enabled: false,
        lastMode: 'adult',
        childName: '',
        libraryIds: [],
        favoriteItemIds: [],
        reducedMotion: false
      })
    );
    assert.strictEqual(harness.document.getElementById('storybook-settings-warning').textContent, '');
    assert.strictEqual(harness.document.getElementById('storybook-reset').disabled, true);
    assert.strictEqual(harness.document.getElementById('storybook-save').disabled, false);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-child-name');
  });
});

asyncTest('adultModeNoOpDoesNotOverwriteRecoverableStorybookPreferences', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: false,
      lastMode: 'adult',
      childName: '',
      libraryIds: [],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    harness.document.getElementById('adult-mode-button').click();

    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(harness.screenActive('storybook-settings-screen'), false);
    assert.strictEqual(harness.savedState(), null);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.currentPreferences())),
      basePreferences({
        enabled: false,
        lastMode: 'adult',
        childName: '',
        libraryIds: [],
        favoriteItemIds: [],
        reducedMotion: false
      })
    );
  });
});

asyncTest('cancelAndBackDoNotResetRecoverableStorybookPreferences', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      version: 1,
      enabled: false,
      lastMode: 'adult',
      childName: '',
      libraryIds: [],
      reducedMotion: false
    }),
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

asyncTest('modeToggleRecoverySettingsStayReachableAcrossLibraryFailuresUntilConfirmedReset', function () {
  var rawStored = '';
  var harness = loadAppHarness({
    fallbackVideos: [{ Id: 'fallback-1', Name: 'Fallback video' }],
    getLibrariesError: new Error('enumeration failed'),
    rawStorybookStorage: rawStored,
    restoreSession: true,
    restoreStatus: {
      needsRecovery: true,
      type: 'malformed'
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    harness.document.getElementById('storybook-mode-button').click();

    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-reset');
    assert.strictEqual(
      harness.document.getElementById('storybook-settings-warning').textContent,
      'Saved Storybook settings could not be read. Reset Storybook settings before saving new Storybook options.'
    );
    assert.strictEqual(harness.document.getElementById('storybook-save').disabled, true);
    assert.strictEqual(harness.savedState(), null);
    assert.strictEqual(harness.rawStorybookStorage(), rawStored);
    assert.strictEqual(harness.toastText(), '');

    harness.document.getElementById('storybook-reset').click();
    assert.strictEqual(
      harness.document.getElementById('storybook-settings-warning').textContent,
      'Saved Storybook settings could not be read. Select Confirm reset to clear the saved Storybook settings.'
    );
    assert.strictEqual(harness.rawStorybookStorage(), rawStored);
    assert.strictEqual(harness.savedState(), null);

    harness.document.getElementById('storybook-reset').click();

    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.savedState())),
      basePreferences({
        enabled: false,
        lastMode: 'adult',
        childName: '',
        libraryIds: [],
        favoriteItemIds: [],
        reducedMotion: false
      })
    );
    assert.strictEqual(
      harness.rawStorybookStorage(),
      JSON.stringify(harness.savedState())
    );
    assert.strictEqual(harness.document.getElementById('storybook-settings-warning').textContent, '');
    assert.strictEqual(harness.document.getElementById('storybook-reset').disabled, true);
    assert.strictEqual(harness.document.getElementById('storybook-reset').style.display, 'none');
    assert.strictEqual(harness.document.getElementById('storybook-save').disabled, true);

    harness.document.getElementById('storybook-save').click();
    assert.strictEqual(
      harness.rawStorybookStorage(),
      JSON.stringify(harness.savedState())
    );

    harness.document.getElementById('storybook-cancel').click();

    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-mode-button');
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.shelfHeadings())),
      ['All videos']
    );
    assert.strictEqual(harness.toastText(), '');
  });
});

asyncTest('favoriteRecoverySettingsStayReachableAcrossLibraryFailuresAndBackRestoresDetails', function () {
  var rawStored = JSON.stringify({
    version: 99,
    enabled: true,
    lastMode: 'adult'
  });
  var harness = loadAppHarness({
    fallbackVideos: [{
      Id: 'story-1',
      Name: 'First Story',
      RunTimeTicks: 7200000000
    }],
    getLibrariesError: new Error('enumeration failed'),
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: [],
      favoriteItemIds: [],
      reducedMotion: false
    }),
    rawStorybookStorage: rawStored,
    restoreSession: true,
    restoreStatus: {
      needsRecovery: true,
      type: 'unsupported-version',
      version: 99
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('hero-open').click();
    harness.document.getElementById('favorite-button').click();

    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-reset');
    assert.strictEqual(
      harness.document.getElementById('storybook-settings-warning').textContent,
      'Saved Storybook settings use unsupported version 99. Reset Storybook settings before saving new Storybook options.'
    );
    assert.strictEqual(harness.savedState(), null);
    assert.strictEqual(harness.rawStorybookStorage(), rawStored);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.currentPreferences().favoriteItemIds)),
      []
    );
    assert.strictEqual(harness.toastText(), '');

    harness.document.dispatchEvent('keydown', {
      keyCode: 8,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('details-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'favorite-button');
    assert.strictEqual(harness.savedState(), null);
    assert.strictEqual(harness.rawStorybookStorage(), rawStored);
  });
});

asyncTest('showsRecoverableBrowseErrorWhenStorybookRestoreCannotEnumerateLibraries', function () {
  var harness = loadAppHarness({
    fallbackVideos: [{ Id: 'video-1', Name: 'Fallback video' }],
    getLibrariesError: new Error('enumeration failed'),
    preferences: basePreferences({
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      reducedMotion: true
    }),
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
      harness.document.activeElement.getAttribute('data-item-id'),
      'video-2'
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1', 'movie-9'],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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

asyncTest('adultFavoriteToggleDuringRecoveryOpensRecoverySettingsWithoutMutatingPreferences', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
    restoreSession: true,
    restoreStatus: {
      needsRecovery: true,
      type: 'unsupported-version',
      version: 99
    },
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    var favoriteButton = harness.document.getElementById('favorite-button');

    harness.document.getElementById('hero-open').click();
    assert.strictEqual(favoriteButton.textContent, 'Add to Storybook favorites');

    favoriteButton.click();

    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(
      harness.document.getElementById('storybook-settings-warning').textContent,
      'Saved Storybook settings use unsupported version 99. Reset Storybook settings before saving new Storybook options.'
    );
    assert.strictEqual(harness.savedState(), null);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.currentPreferences().favoriteItemIds)),
      []
    );
  });
});

asyncTest('adultDetailsRemovesStorybookFavoriteWithoutLeavingAdultMode', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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

asyncTest('storybookLibraryAndDetailsUseFriendlyDurationLabelsWhenEnabled', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [
        { Id: 'short', Name: 'Quick Tale', RunTimeTicks: 7200000000 },
        { Id: 'medium', Name: 'Cozy Tale', RunTimeTicks: 16800000000 },
        { Id: 'long', Name: 'Big Tale', RunTimeTicks: 24600000000 }
      ]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-door-kids').click();
    assert.strictEqual(
      harness.document.getElementById('storybook-library-card-short').getElementsByClassName('storybook-card-meta')[0].textContent,
      '12 min • Quick story'
    );
    assert.strictEqual(
      harness.document.getElementById('storybook-library-card-medium').getElementsByClassName('storybook-card-meta')[0].textContent,
      '28 min • Cozy episode'
    );
    assert.strictEqual(
      harness.document.getElementById('storybook-library-card-long').getElementsByClassName('storybook-card-meta')[0].textContent,
      '41 min • Big movie'
    );

    harness.document.getElementById('storybook-library-card-medium').click();
    assert.strictEqual(
      harness.document.getElementById('storybook-details-meta').textContent,
      '28 min • Cozy episode'
    );
  });
});

asyncTest('adultDetailsKeepMinutesOnlyWhenStorybookFriendlyDurationsAreEnabled', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'medium', Name: 'Cozy Tale', RunTimeTicks: 16800000000, Overview: 'Still adult-details minutes only.' }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('hero-open').click();
    assert.notStrictEqual(harness.document.getElementById('details-meta').textContent.indexOf('28 min'), -1);
    assert.strictEqual(harness.document.getElementById('details-meta').textContent.indexOf('Cozy episode'), -1);
  });
});

asyncTest('storybookPlaybackErrorWhilePlayerActiveReturnsToStorybookDetails', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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

asyncTest('storybookEndingPickAnotherWaitsForHomeReadyBeforeFocusingResumeCard', function () {
  var harness = loadAppHarness({
    deferStorybookHomeReadyCalls: [2],
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    harness.document.getElementById('storybook-ending-pick-another').click();

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.pendingStorybookHomeReadyCount(), 1);
    assert.notStrictEqual(
      harness.document.activeElement && harness.document.activeElement.id,
      'storybook-resume-card'
    );

    harness.releaseStorybookHomeReady();

    assert.strictEqual(harness.document.activeElement.id, 'storybook-resume-card');
  });
});

asyncTest('storybookEndingBackKeyActsLikePickAnother', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1'],
      reducedMotion: false
    }),
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

    harness.document.getElementById('storybook-magic-pick-button').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);
    assert.strictEqual(harness.screenEntries().indexOf('storybook-magic-pick-screen'), -1);

    harness.document.getElementById('storybook-magic-pick-back').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);

    harness.document.getElementById('storybook-door-kids').click();
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(harness.screenEntries().indexOf('storybook-library-screen'), -1);

    harness.document.getElementById('storybook-library-card-story-1').click();
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.strictEqual(harness.screenEntries().indexOf('storybook-details-screen'), -1);

    harness.document.getElementById('storybook-details-play').click();
    harness.playerCallbacks().onStop(true);
    assert.strictEqual(harness.screenActive('storybook-ending-screen'), true);
    assert.strictEqual(harness.screenEntries().indexOf('storybook-ending-screen'), -1);

    harness.document.getElementById('storybook-ending-pick-another').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.screenEntries().lastIndexOf('storybook-screen'), -1);

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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['missing-favorite'],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1', 'missing-favorite'],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      reducedMotion: false
    }),
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
      harness.document.activeElement.getAttribute('data-item-id'),
      'video-2'
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      version: 1,
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: true
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenEntries().indexOf('storybook-screen'), -1);
  });
});

asyncTest('animatesStorybookHomeWhenReducedMotionIsDisabled', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    assert.notStrictEqual(harness.screenEntries().indexOf('storybook-screen'), -1);
  });
});

asyncTest('switchesIntoStorybookModeAndFocusesFirstDoorWhenLibrariesAreConfigured', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' }
    ],
    preferences: basePreferences({
      version: 1,
      enabled: true,
      lastMode: 'adult',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      reducedMotion: false
    }),
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
    assert.notStrictEqual(harness.screenEntries().indexOf('storybook-screen'), -1);
    assert.strictEqual(
      harness.document.activeElement.getAttribute('data-item-id'),
      'video-2'
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
    preferences: basePreferences({
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['one', 'two', 'three', 'four', 'five', 'six'],
      reducedMotion: false
    }),
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
    harness.document.getElementById('storybook-door-one').focus();

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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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

asyncTest('storybookLibraryBackWaitsForHomeReadyBeforeRestoringOriginDoorFocus', function () {
  var harness = loadAppHarness({
    deferStorybookHomeReadyCalls: [2],
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'disney', Name: 'Disney' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids', 'disney'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
    restoreSession: true,
    videosByLibrary: {
      disney: [{ Id: 'video-2', Name: 'Second video' }],
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-door-kids').click();
    harness.document.dispatchEvent('keydown', {
      keyCode: 8,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.pendingStorybookHomeReadyCount(), 1);
    assert.notStrictEqual(
      harness.document.activeElement && harness.document.activeElement.id,
      'storybook-door-kids'
    );

    harness.releaseStorybookHomeReady();

    assert.strictEqual(harness.document.activeElement.id, 'storybook-door-kids');
  });
});

asyncTest('storybookLibraryBackRestoresOriginDoorFocusImmediatelyWhenReducedMotionIsEnabled', function () {
  var harness = loadAppHarness({
    deferStorybookHomeReadyCalls: [2],
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: true
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'video-1', Name: 'First video' }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-door-kids').click();
    harness.document.dispatchEvent('keydown', {
      keyCode: 8,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.pendingStorybookHomeReadyCount(), 0);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-door-kids');
  });
});

asyncTest('keepsStorybookDetailsEntryAnimationOffWhenReducedMotionIsEnabled', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: true
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story' }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-door-kids').click();
    harness.document.getElementById('storybook-library-card-story-1').click();

    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.strictEqual(harness.screenEntries().indexOf('storybook-details-screen'), -1);
  });
});

asyncTest('keepsStorybookLibraryEntryAnimationOffWhenReducedMotionIsEnabledAndOnOtherwise', function () {
  var reducedMotionHarness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: true
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story' }]
    }
  });
  var normalMotionHarness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      favoriteItemIds: [],
      reducedMotion: false
    }),
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
    preferences: basePreferences({
      version: 1,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: false
    }),
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

asyncTest('categoryShortcutOpensFilteredCollectionAndBackRestoresExactCategoryFocus', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'songs', Name: 'Songs' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids', 'songs']
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [
        { Id: 'animal-1', Name: 'Fox and Ferns', RunTimeTicks: 7200000000, Tags: ['animals'] },
        { Id: 'bed-1', Name: 'Sleepy Stars', RunTimeTicks: 7200000000, Tags: ['bedtime'] }
      ],
      songs: [
        { Id: 'song-1', Name: 'Dance With Me', RunTimeTicks: 7200000000, Tags: ['sing-along'] }
      ]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-category-animals').click();
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(harness.document.getElementById('storybook-library-title').textContent, 'Animal Friends');
    assert.strictEqual(harness.document.getElementById('storybook-library-cards').children.length, 1);

    harness.document.getElementById('storybook-library-card-animal-1').click();
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    harness.document.getElementById('storybook-details-back').click();
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);

    harness.document.getElementById('storybook-library-back').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-category-animals');
  });
});

asyncTest('littleMenuIsStableForTheAppSessionAndOpensDetailsWithoutPlayback', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'pixar', Name: 'Disney Pixar' },
      { Id: 'songs', Name: 'Songs' },
      { Id: 'lessons', Name: 'Lessons' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['pixar', 'songs', 'lessons']
    }),
    restoreSession: true,
    storybookBootstrap: defaultStorybookBootstrap({
      nowMs: Date.parse('2026-09-02T02:00:00.000Z'),
      storybookSessionSeed: 'little-menu-app-seed'
    }),
    resume: [
      { Id: 'bluey', Name: "Bluey's Big Adventure", UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      pixar: [
        { Id: 'bluey', Name: "Bluey's Big Adventure", RunTimeTicks: 16800000000, Tags: ['animals'], UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } },
        { Id: 'fox', Name: 'Fox and Fireflies', RunTimeTicks: 6600000000, Tags: ['animals'] }
      ],
      songs: [
        { Id: 'dance', Name: 'Dance With Me', RunTimeTicks: 7200000000, Tags: ['sing-along', 'movement'] },
        { Id: 'stretch', Name: 'Stretch and Sway', RunTimeTicks: 8400000000, Tags: ['movement'] }
      ],
      lessons: [
        { Id: 'colors', Name: 'The Color Garden', RunTimeTicks: 5400000000, Tags: ['learning'] }
      ]
    }
  });

  return flush(12).then(function () {
    var firstIds = Array.prototype.map.call(
      harness.document.getElementById('storybook-little-menu').children,
      function (node) {
        return node.getAttribute('data-item-id');
      }
    );

    harness.document.getElementById('storybook-door-pixar').click();
    harness.document.getElementById('storybook-library-back').click();

    return flush(12).then(function () {
      var secondIds = Array.prototype.map.call(
        harness.document.getElementById('storybook-little-menu').children,
        function (node) {
          return node.getAttribute('data-item-id');
        }
      );

      assert.deepStrictEqual(JSON.parse(JSON.stringify(firstIds)), ['dance', 'fox', 'colors']);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(secondIds)), ['dance', 'fox', 'colors']);

      harness.document.getElementById('storybook-menu-card-dance').click();
      assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
      assert.deepStrictEqual(harness.playCalls(), []);
    });
  });
});

asyncTest('reducedMotionSkipsEntryAnimationOnMagicPickScreenButKeepsItWhenAllowed', function () {
  var reducedMotionHarness = loadAppHarness({
    libraries: [{ Id: 'songs', Name: 'Songs' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['songs'],
      reducedMotion: true
    }),
    restoreSession: true,
    videosByLibrary: {
      songs: [{ Id: 'dance', Name: 'Dance With Me', RunTimeTicks: 7200000000, Tags: ['sing-along'] }]
    }
  });
  var motionHarness = loadAppHarness({
    libraries: [{ Id: 'songs', Name: 'Songs' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['songs'],
      reducedMotion: false
    }),
    restoreSession: true,
    videosByLibrary: {
      songs: [{ Id: 'dance', Name: 'Dance With Me', RunTimeTicks: 7200000000, Tags: ['sing-along'] }]
    }
  });

  return flush(12).then(function () {
    reducedMotionHarness.document.getElementById('storybook-magic-pick-button').click();
    motionHarness.document.getElementById('storybook-magic-pick-button').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(reducedMotionHarness.screenActive('storybook-magic-pick-screen'), true);
    assert.strictEqual(reducedMotionHarness.screenEntries().indexOf('storybook-magic-pick-screen'), -1);
    assert.strictEqual(motionHarness.screenActive('storybook-magic-pick-screen'), true);
    assert.notStrictEqual(motionHarness.screenEntries().indexOf('storybook-magic-pick-screen'), -1);
  });
});

asyncTest('magicPickOpensWithoutPlaybackAndPrimaryOpensStorybookDetailsInstead', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'songs', Name: 'Songs' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['songs'],
      favoriteItemIds: ['dance']
    }),
    restoreSession: true,
    storybookBootstrap: defaultStorybookBootstrap({
      nowMs: Date.parse('2026-09-02T02:00:00.000Z'),
      storybookSessionSeed: 'magic-pick-app-seed'
    }),
    videosByLibrary: {
      songs: [{ Id: 'dance', Name: 'Dance With Me', RunTimeTicks: 7200000000, Tags: ['sing-along'] }]
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);

    harness.document.getElementById('storybook-magic-pick-button').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);
    assert.deepStrictEqual(harness.playCalls(), []);
    assert.strictEqual(harness.document.getElementById('storybook-magic-pick-title').textContent, 'Dance With Me');
    assert.strictEqual(harness.document.activeElement.id, 'storybook-magic-pick-primary');

    harness.document.getElementById('storybook-magic-pick-primary').click();
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), false);
    assert.deepStrictEqual(harness.playCalls(), []);

    harness.document.getElementById('storybook-details-back').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-magic-pick-primary');

    harness.document.getElementById('storybook-magic-pick-secondary').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);
    assert.deepStrictEqual(harness.playCalls(), []);

    harness.document.getElementById('storybook-magic-pick-back').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-magic-pick-button');
  });
});

asyncTest('emptyMagicPickPrimaryGoesHomeFocusedOnFirstStoryDoorAndSecondaryReturnsHome', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'pixar', Name: 'Disney Pixar' },
      { Id: 'songs', Name: 'Songs' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['pixar', 'songs']
    }),
    restoreSession: true,
    videosByLibrary: {
      pixar: [{
        Id: 'sleepy',
        Name: 'Sleepy Moon',
        RunTimeTicks: 19800000000,
        UserData: { Played: true, LastPlayedDate: '2026-09-01T18:00:00.000Z' }
      }],
      songs: [{
        Id: 'stretch',
        Name: 'Stretch and Sway',
        RunTimeTicks: 8400000000,
        UserData: { Played: true, LastPlayedDate: '2026-09-01T18:00:00.000Z' }
      }]
    },
    storybookBootstrap: defaultStorybookBootstrap({
      nowMs: Date.parse('2026-09-02T02:00:00.000Z'),
      storybookSessionSeed: 'magic-pick-empty-seed'
    })
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-magic-pick-button').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);
    assert.strictEqual(harness.document.getElementById('storybook-magic-pick-title').textContent, 'No Magic Pick right now');
    assert.strictEqual(harness.document.getElementById('storybook-magic-pick-reason').textContent, '');
    assert.strictEqual(
      harness.document.getElementById('storybook-magic-pick-overview').textContent,
      'Everything in the selected Storybook libraries was finished recently. Try a Story Door instead.'
    );

    harness.document.getElementById('storybook-magic-pick-primary').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-door-pixar');

    harness.document.getElementById('storybook-magic-pick-button').click();
    harness.document.getElementById('storybook-magic-pick-secondary').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-magic-pick-button');

    harness.document.getElementById('storybook-magic-pick-button').click();
    harness.document.getElementById('storybook-magic-pick-back').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-magic-pick-button');

    assert.deepStrictEqual(harness.playCalls(), []);
  });
});

asyncTest('magicPickModeToggleIsWiredLikeOtherStorybookScreens', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'songs', Name: 'Songs' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['songs']
    }),
    restoreSession: true,
    videosByLibrary: {
      songs: [{ Id: 'dance', Name: 'Dance With Me', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-magic-pick-button').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);

    harness.document.getElementById('storybook-magic-adult-mode-button').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);
  });
});

asyncTest('successfulStorybookDpadMovementPlaysFocusButBlockedMovementDoesNot', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    harness.document.getElementById('storybook-settings-button').click();
    var before = harness.soundCalls().length;
    harness.document.dispatchEvent('keydown', {
      keyCode: 40,
      preventDefault: function () {}
    });
    assert.strictEqual(harness.soundCalls().slice(before).join(','), 'focus');
    assert.strictEqual(
      harness.document.activeElement.id,
      'storybook-library-input-kids'
    );

    before = harness.soundCalls().length;
    harness.document.getElementById('storybook-cancel').focus();
    harness.document.dispatchEvent('keydown', {
      keyCode: 40,
      preventDefault: function () {}
    });
    assert.deepStrictEqual(harness.soundCalls().slice(before), []);
    assert.strictEqual(harness.document.activeElement.id, 'storybook-cancel');
  });
});

asyncTest('storybookHomeDpadMovementPlaysOneFocusCueAndProgrammaticFocusStaysSilent', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'songs', Name: 'Songs' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids', 'songs'],
      reducedMotion: false
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }],
      songs: [{ Id: 'story-2', Name: 'Second Story', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    positionStoryDoors(harness);
    harness.document.getElementById('storybook-door-kids').focus();

    assert.strictEqual(harness.document.activeElement.id, 'storybook-door-kids');
    assert.deepStrictEqual(harness.soundCalls(), []);

    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.document.activeElement.id, 'storybook-door-songs');
    assert.deepStrictEqual(harness.soundCalls(), ['focus']);

    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.document.activeElement.id, 'storybook-door-songs');
    assert.deepStrictEqual(harness.soundCalls(), ['focus']);
  });
});

asyncTest('storybookNavigationEmitsExactlyOneSemanticCuePerAction', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    storybookBootstrap: defaultStorybookBootstrap({
      nowMs: Date.parse('2026-09-02T02:00:00.000Z'),
      storybookSessionSeed: 'storybook-sound-cue-seed'
    }),
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Tags: ['animals'] }]
    }
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), []);

    harness.document.getElementById('storybook-door-kids').click();
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);

    harness.document.getElementById('storybook-library-card-story-1').click();
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm', 'confirm']);

    harness.document.getElementById('storybook-details-back').click();
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm', 'confirm', 'back']);

    harness.document.getElementById('storybook-library-back').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm', 'confirm', 'back', 'back']);

    harness.document.getElementById('storybook-category-animals').click();
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'confirm', 'back', 'back', 'confirm']
    );

    harness.document.getElementById('storybook-library-back').click();
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'confirm', 'back', 'back', 'confirm', 'back']
    );

    harness.document.getElementById('storybook-magic-pick-button').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'confirm', 'back', 'back', 'confirm', 'back', 'magic']
    );

    harness.document.getElementById('storybook-magic-pick-secondary').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'confirm', 'back', 'back', 'confirm', 'back', 'magic', 'magic']
    );

    harness.document.getElementById('storybook-magic-pick-primary').click();
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'confirm', 'back', 'back', 'confirm', 'back', 'magic', 'magic', 'confirm']
    );

    harness.document.getElementById('storybook-details-back').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'confirm', 'back', 'back', 'confirm', 'back', 'magic', 'magic', 'confirm', 'back']
    );

    harness.document.getElementById('storybook-magic-pick-back').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      [
        'confirm', 'confirm', 'back', 'back', 'confirm', 'back',
        'magic', 'magic', 'confirm', 'back', 'back'
      ]
    );
    assert.deepStrictEqual(harness.playCalls(), []);
  });
});

asyncTest('remoteBackEmitsTheSameSingleCueAsVisibleStorybookControls', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });

  function back() {
    harness.document.dispatchEvent('keydown', {
      keyCode: 8,
      preventDefault: function () {}
    });
  }

  return flush(12).then(function () {
    harness.document.getElementById('storybook-door-kids').click();
    back();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm', 'back']);

    harness.document.getElementById('storybook-door-kids').click();
    harness.document.getElementById('storybook-library-card-story-1').click();
    back();
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    back();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'back', 'confirm', 'confirm', 'back', 'back']
    );

    harness.document.getElementById('storybook-magic-pick-button').click();
    back();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'back', 'confirm', 'confirm', 'back', 'back', 'magic', 'back']
    );

    harness.document.getElementById('storybook-settings-button').click();
    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'back', 'confirm', 'confirm', 'back', 'back', 'magic', 'back']
    );

    back();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'back', 'confirm', 'confirm', 'back', 'back', 'magic', 'back', 'back']
    );

    harness.document.getElementById('storybook-settings-button').click();
    harness.document.getElementById('storybook-cancel').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      [
        'confirm', 'back', 'confirm', 'confirm', 'back', 'back',
        'magic', 'back', 'back', 'back'
      ]
    );
  });
});

asyncTest('storybookSoundPreferenceDisabledSuppressesEveryCue', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids'],
      soundsEnabled: false
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Tags: ['animals'] }]
    }
  });

  return flush(12).then(function () {
    // Two entries: the init sync and the sync on the Storybook branch of the
    // openLibrary that init triggers.
    assert.deepStrictEqual(harness.soundEnabledChanges(), [false, false]);

    harness.document.getElementById('storybook-door-kids').click();
    harness.document.getElementById('storybook-library-card-story-1').click();
    harness.document.getElementById('storybook-details-back').click();
    harness.document.getElementById('storybook-library-back').click();
    harness.document.getElementById('storybook-magic-pick-button').click();
    harness.document.getElementById('storybook-magic-pick-back').click();
    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), []);
  });
});

asyncTest('storybookSettingsSaveTogglesSoundEngineEnablementBothWays', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    // Each save syncs once directly and once more when its openLibrary lands
    // back on Storybook home.
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true]);

    harness.document.getElementById('storybook-settings-button').click();
    harness.document.getElementById('storybook-sounds-enabled').checked = false;
    harness.document.getElementById('storybook-save').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.currentPreferences().soundsEnabled, false);
    assert.strictEqual(harness.soundEnabledChanges().slice(-1)[0], false);
    assert.deepStrictEqual(harness.soundCalls(), []);

    harness.document.getElementById('storybook-settings-button').click();
    harness.document.getElementById('storybook-sounds-enabled').checked = true;
    harness.document.getElementById('storybook-save').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.currentPreferences().soundsEnabled, true);
    assert.strictEqual(harness.soundEnabledChanges().slice(-1)[0], true);
    assert.deepStrictEqual(
      harness.soundEnabledChanges(),
      [true, true, false, false, true, true]
    );
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);
  });
});

asyncTest('adultModeActivityStaysSilentAndSwitchingToAdultStopsStorybookAudio', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'adult',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });
  var stopsBeforeAdultSwitch;

  return flush(12).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);

    harness.document.dispatchEvent('keydown', {
      keyCode: 40,
      preventDefault: function () {}
    });
    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });
    harness.document.getElementById('hero-open').click();
    assert.deepStrictEqual(harness.soundCalls(), []);

    harness.document.getElementById('details-back').click();
    harness.document.getElementById('storybook-settings-button').click();
    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);
    harness.document.dispatchEvent('keydown', {
      keyCode: 40,
      preventDefault: function () {}
    });
    assert.strictEqual(
      harness.document.activeElement.id,
      'storybook-library-input-kids'
    );
    harness.document.getElementById('storybook-save').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.currentPreferences().lastMode, 'adult');
    assert.deepStrictEqual(harness.soundCalls(), []);

    harness.document.getElementById('storybook-mode-button').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), []);

    harness.document.getElementById('storybook-door-kids').click();
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);

    stopsBeforeAdultSwitch = harness.soundStopCalls();
    harness.document.getElementById('storybook-library-adult-mode-button').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);
    assert(harness.soundStopCalls() > stopsBeforeAdultSwitch);
  });
});

asyncTest('playbackEntryAndActivePlaybackSilenceStorybookCues', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{
        Id: 'story-1',
        Name: 'First Story',
        RunTimeTicks: 7200000000,
        UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 }
      }]
    }
  });
  var stopsBeforePlay;
  var stopsBeforeRestart;

  return flush(12).then(function () {
    harness.setPlayerPlaying(true);
    harness.document.getElementById('storybook-resume-card').click();
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), []);

    harness.document.getElementById('storybook-details-back').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), []);

    harness.setPlayerPlaying(false);
    harness.document.getElementById('storybook-resume-card').click();
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);

    stopsBeforePlay = harness.soundStopCalls();
    harness.document.getElementById('storybook-details-play').click();
    assert.strictEqual(harness.screenActive('player-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);
    assert(harness.soundStopCalls() > stopsBeforePlay);
    assert.deepStrictEqual(harness.playCalls(), [{ id: 'story-1', fromBeginning: false }]);
    // This harness keeps the synchronous player double on purpose, so it pins
    // the non-thenable compatibility path: a player that is already playing
    // when play() returns is synced on the same turn.
    assert.strictEqual(harness.playerPlaying(), true);
    assert.strictEqual(harness.soundEnabledChanges().slice(-1)[0], false);

    harness.setPlayerPlaying(false);
    harness.playerCallbacks().onStop(false);
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);

    stopsBeforeRestart = harness.soundStopCalls();
    harness.document.getElementById('storybook-details-restart').click();
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);
    assert(harness.soundStopCalls() > stopsBeforeRestart);
  });
});

asyncTest('signOutStopsStorybookAudioWithoutPlayingACue', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });
  var stopsBeforeSignOut;

  return flush(12).then(function () {
    harness.document.getElementById('storybook-door-kids').click();
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);

    stopsBeforeSignOut = harness.soundStopCalls();
    harness.document.getElementById('profile-button').click();
    assert.strictEqual(harness.soundStopCalls(), stopsBeforeSignOut);

    harness.document.getElementById('profile-button').click();
    assert.strictEqual(harness.screenActive('setup-screen'), true);
    assert(harness.soundStopCalls() > stopsBeforeSignOut);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);
    // Setup mode gets the same defense in depth as playback: the engine is
    // disabled outright, not merely stopped.
    assert.strictEqual(harness.soundEnabledChanges().slice(-1)[0], false);
  });
});

asyncTest('reauthenticatingAfterSignOutRestoresAudibleStorybookCues', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids']
    }),
    realSound: true,
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });
  var cues;

  return flush(12).then(function () {
    cues = harness.soundAudioByCue();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);

    harness.document.getElementById('storybook-door-kids').click();
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);
    assert.strictEqual(cues.confirm.playCalls, 1);

    harness.document.getElementById('profile-button').click();
    harness.document.getElementById('profile-button').click();
    assert.strictEqual(harness.screenActive('setup-screen'), true);
    assert.strictEqual(harness.soundEnabledChanges().slice(-1)[0], false);

    harness.document.getElementById('connect-button').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('quick-screen'), true);

    harness.approveQuickConnect();
    harness.runIntervals();
    return flush(12);
  }).then(function () {
    // The whole point is the production re-entry path: Quick Connect approval
    // authenticates and calls openLibrary directly, with no mode toggle and no
    // settings save in between.
    assert.strictEqual(harness.quickConnectAuthentications(), 1);
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(harness.currentPreferences().lastMode, 'storybook');
    assert.strictEqual(harness.currentPreferences().soundsEnabled, true);

    harness.document.getElementById('storybook-door-kids').click();
    assert.strictEqual(harness.screenActive('storybook-library-screen'), true);
    // The routing call is recorded even while the engine is off, so the audible
    // proof is the real element starting a second time.
    assert.strictEqual(cues.confirm.playCalls, 2);
    assert.strictEqual(cues.confirm.paused, false);
    assert.deepStrictEqual(harness.soundUnpausedSrcs(), ['audio/storybook-confirm.wav']);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm', 'confirm']);
    assert.strictEqual(harness.soundEnabledChanges().indexOf(false) !== -1, true);
    assert.strictEqual(harness.soundEnabledChanges().slice(-1)[0], true);
    assert.deepStrictEqual(harness.soundWarnings(), []);
  });
});

asyncTest('storybookEndingCuesPickAnotherAndRemoteBackButStaysSilentOnEntryAndAllDone', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{
        Id: 'story-1',
        Name: 'First Story',
        RunTimeTicks: 7200000000,
        UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 }
      }]
    }
  });

  function finishAStory() {
    harness.document.getElementById('storybook-resume-card').click();
    harness.document.getElementById('storybook-details-play').click();
    harness.setPlayerPlaying(false);
    harness.playerCallbacks().onStop(true);
  }

  return flush(12).then(function () {
    finishAStory();
    assert.strictEqual(harness.screenActive('storybook-ending-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);

    harness.document.getElementById('storybook-ending-pick-another').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm', 'confirm']);

    finishAStory();
    assert.strictEqual(harness.screenActive('storybook-ending-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm', 'confirm', 'confirm']);

    harness.document.dispatchEvent('keydown', {
      keyCode: 10009,
      preventDefault: function () {}
    });
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'confirm', 'confirm', 'back']
    );

    finishAStory();
    assert.strictEqual(harness.screenActive('storybook-ending-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'confirm', 'confirm', 'back', 'confirm']
    );

    harness.document.getElementById('storybook-ending-all-done').click();
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      harness.soundCalls(),
      ['confirm', 'confirm', 'confirm', 'back', 'confirm']
    );
  });
});

asyncTest('storybookSpatialFallbackFocusFromAnInvalidCurrentTargetStaysSilent', function () {
  var harness = loadAppHarness({
    libraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'songs', Name: 'Songs' }
    ],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids', 'songs']
    }),
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }],
      songs: [{ Id: 'story-2', Name: 'Second Story', RunTimeTicks: 7200000000 }]
    }
  });

  return flush(12).then(function () {
    positionStoryDoors(harness);
    harness.document.activeElement = null;

    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });

    assert.notStrictEqual(harness.document.activeElement, null);
    assert.deepStrictEqual(harness.soundCalls(), []);

    harness.document.dispatchEvent('keydown', {
      keyCode: 39,
      preventDefault: function () {}
    });

    assert.deepStrictEqual(harness.soundCalls(), ['focus']);
  });
});

asyncTest('storybookPlaybackWithoutASelectedItemNeitherCuesNorStopsAudio', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{
        Id: 'story-1',
        Name: 'First Story',
        RunTimeTicks: 7200000000,
        UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 }
      }]
    }
  });
  var stopsBeforeNoOpPlayback;

  return flush(12).then(function () {
    harness.document.getElementById('storybook-resume-card').click();
    harness.document.getElementById('storybook-details-play').click();
    harness.setPlayerPlaying(false);
    harness.playerCallbacks().onStop(true);
    harness.document.getElementById('storybook-ending-pick-another').click();

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm', 'confirm']);

    stopsBeforeNoOpPlayback = harness.soundStopCalls();
    harness.document.getElementById('storybook-details-play').click();
    harness.document.getElementById('storybook-details-restart').click();
    harness.document.getElementById('play-button').click();
    harness.document.getElementById('restart-button').click();

    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(harness.playCalls(), [{ id: 'story-1', fromBeginning: false }]);
    assert.strictEqual(harness.soundStopCalls(), stopsBeforeNoOpPlayback);
    assert.deepStrictEqual(harness.soundCalls(), ['confirm', 'confirm']);
  });
});

asyncTest('storybookSoundEngineEnableStateFollowsModeAndPlaybackTransitions', function () {
  var harness = loadAppHarness({
    asyncPlayer: true,
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{
        Id: 'story-1',
        Name: 'First Story',
        RunTimeTicks: 7200000000,
        UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 }
      }]
    }
  });

  return flush(12).then(function () {
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true]);

    harness.document.getElementById('storybook-resume-card').click();
    harness.document.getElementById('storybook-details-play').click();
    assert.strictEqual(harness.screenActive('player-screen'), true);
    // The play call is recorded synchronously, but the player has not yet
    // reported itself as playing, so the engine must not have been synced yet.
    assert.deepStrictEqual(harness.playCalls(), [{ id: 'story-1', fromBeginning: false }]);
    assert.strictEqual(harness.playerPlaying(), false);
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true]);
    return flush(4);
  }).then(function () {
    assert.strictEqual(harness.playerPlaying(), true);
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true, false]);

    harness.setPlayerPlaying(false);
    harness.playerCallbacks().onStop(false);
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true, false, true]);

    harness.document.getElementById('storybook-details-adult-mode-button').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    // The Adult openLibrary adds no entry: only the Storybook branch syncs.
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true, false, true, false]);

    harness.document.getElementById('storybook-mode-button').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.deepStrictEqual(
      harness.soundEnabledChanges(),
      [true, true, false, true, false, true, true]
    );
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);

    harness.document.getElementById('storybook-door-kids').click();
    assert.deepStrictEqual(harness.soundCalls(), ['confirm', 'confirm']);
  });
});

asyncTest('storybookSoundEngineIsResyncedAfterAFailedPlaybackStart', function () {
  var harness = loadAppHarness({
    asyncPlayerRejects: true,
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids']
    }),
    restoreSession: true,
    resume: [
      { Id: 'story-1', Name: 'First Story', UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 } }
    ],
    videosByLibrary: {
      kids: [{
        Id: 'story-1',
        Name: 'First Story',
        RunTimeTicks: 7200000000,
        UserData: { PlaybackPositionTicks: 600000000, PlayedPercentage: 14 }
      }]
    }
  });

  return flush(12).then(function () {
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true]);

    harness.document.getElementById('storybook-resume-card').click();
    harness.document.getElementById('storybook-details-play').click();
    assert.strictEqual(harness.screenActive('player-screen'), true);
    assert.deepStrictEqual(harness.playCalls(), [{ id: 'story-1', fromBeginning: false }]);
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true]);
    return flush(12);
  }).then(function () {
    // The start failed, so playback never began and the sync must leave the
    // engine enabled. The suite runner fails on any unhandled rejection, so
    // this also pins that the rejected start promise is handled.
    assert.strictEqual(harness.playerPlaying(), false);
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true, true]);
  });
});

asyncTest('realSoundEngineStopsARerolledMagicCueBeforePlayback', function () {
  var harness = loadAppHarness({
    asyncPlayer: true,
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['kids']
    }),
    realSound: true,
    restoreSession: true,
    storybookBootstrap: defaultStorybookBootstrap({
      nowMs: Date.parse('2026-09-02T02:00:00.000Z'),
      storybookSessionSeed: 'storybook-sound-cue-seed'
    }),
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000, Tags: ['animals'] }]
    }
  });
  var cues;

  return flush(12).then(function () {
    cues = harness.soundAudioByCue();
    assert.deepStrictEqual(Object.keys(cues).sort(), ['back', 'confirm', 'focus', 'magic']);
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true]);

    harness.document.getElementById('storybook-magic-pick-button').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);
    assert.strictEqual(cues.magic.playCalls, 1);
    assert.strictEqual(cues.magic.paused, false);

    harness.document.getElementById('storybook-magic-pick-secondary').click();
    assert.strictEqual(harness.screenActive('storybook-magic-pick-screen'), true);
    assert.strictEqual(cues.magic.playCalls, 2);
    assert.strictEqual(cues.magic.pauseCalls, 1);
    return flush(12);
  }).then(function () {
    assert.deepStrictEqual(harness.soundWarnings(), []);

    harness.document.getElementById('storybook-magic-pick-primary').click();
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.strictEqual(cues.magic.pauseCalls, 2);
    assert.strictEqual(cues.magic.currentTime, 0);
    assert.strictEqual(cues.confirm.playCalls, 1);

    harness.document.getElementById('storybook-details-play').click();
    assert.strictEqual(harness.screenActive('player-screen'), true);
    assert.strictEqual(harness.playerPlaying(), false);
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true]);
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.playerPlaying(), true);
    assert.deepStrictEqual(harness.soundUnpausedSrcs(), []);
    assert.strictEqual(cues.confirm.pauseCalls, 1);
    assert.strictEqual(cues.confirm.currentTime, 0);
    assert.deepStrictEqual(harness.soundWarnings(), []);
    assert.deepStrictEqual(harness.soundCalls(), ['magic', 'magic', 'confirm']);
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true, false]);

    harness.setPlayerPlaying(false);
    harness.playerCallbacks().onStop(false);
    assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true, false, true]);

    harness.document.getElementById('storybook-details-back').click();
    assert.deepStrictEqual(harness.soundCalls(), ['magic', 'magic', 'confirm', 'back']);
    assert.strictEqual(cues.back.playCalls, 1);
    assert.deepStrictEqual(harness.soundWarnings(), []);
    return flush(12);
  }).then(function () {
    assert.deepStrictEqual(harness.soundWarnings(), []);
  });
});

asyncTest('realSoundEngineKeepsTheSettingsSaveConfirmThroughTheBrowseTransition', function () {
  var harness = loadAppHarness({
    libraries: [{ Id: 'kids', Name: 'Kids' }],
    preferences: basePreferences({
      enabled: true,
      lastMode: 'storybook',
      libraryIds: ['kids']
    }),
    realSound: true,
    restoreSession: true,
    videosByLibrary: {
      kids: [{ Id: 'story-1', Name: 'First Story', RunTimeTicks: 7200000000 }]
    }
  });
  var cues;

  return flush(12).then(function () {
    cues = harness.soundAudioByCue();
    harness.document.getElementById('storybook-settings-button').click();
    assert.strictEqual(harness.screenActive('storybook-settings-screen'), true);

    harness.document.getElementById('storybook-save').click();
    assert.strictEqual(cues.confirm.playCalls, 1);
    assert.strictEqual(cues.confirm.paused, false);
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(cues.confirm.pauseCalls, 0);
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('storybook-screen'), true);
    assert.strictEqual(cues.confirm.pauseCalls, 0);
    assert.strictEqual(cues.confirm.paused, false);
    assert.deepStrictEqual(harness.soundEnabledChanges(), [true, true, true, true]);
    assert.deepStrictEqual(harness.soundWarnings(), []);

    harness.document.getElementById('storybook-home-adult-mode-button').click();
    return flush(12);
  }).then(function () {
    assert.strictEqual(harness.screenActive('browse-screen'), true);
    assert.strictEqual(cues.confirm.pauseCalls, 1);
    assert.strictEqual(cues.confirm.paused, true);
    assert.strictEqual(cues.confirm.currentTime, 0);
    assert.deepStrictEqual(
      harness.soundEnabledChanges(),
      [true, true, true, true, false]
    );
    assert.deepStrictEqual(harness.soundCalls(), ['confirm']);
    assert.deepStrictEqual(harness.soundUnpausedSrcs(), []);
  });
});
