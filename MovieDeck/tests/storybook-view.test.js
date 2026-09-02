'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;

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
  this.classList = new FakeClassList();
  this.style = {};
  this.textContent = '';
  this.id = '';
  this.checked = false;
  this.disabled = false;
  this.scrollLeft = 0;
  this.scrollWidth = 0;
  this.clientWidth = 0;

  Object.defineProperty(this, 'className', {
    get: function () { return self.classList.toString(); },
    set: function (value) { self.classList.set(value); }
  });
  Object.defineProperty(this, 'firstChild', {
    get: function () { return self.children.length ? self.children[0] : null; }
  });
  Object.defineProperty(this, 'innerHTML', {
    get: function () { return ''; },
    set: function () {
      self.children = [];
      self.textContent = '';
    }
  });
}

FakeElement.prototype.appendChild = function (child) {
  child.parentNode = this;
  this.children.push(child);
  this.ownerDocument.register(child);
  return child;
};

FakeElement.prototype.addEventListener = function (type, listener) {
  if (!this.listeners[type]) { this.listeners[type] = []; }
  this.listeners[type].push(listener);
};

FakeElement.prototype.dispatch = function (type, event) {
  var listeners = this.listeners[type] || [];
  listeners.forEach(function (listener) {
    listener.call(this, event || {});
  }, this);
};

FakeElement.prototype.focus = function () {
  if (this.disabled) { return; }
  this.ownerDocument.activeElement = this;
  this.dispatch('focus', {});
};

FakeElement.prototype.click = function () {
  if (this.disabled) { return; }
  this.focus();
  this.dispatch('click', {});
};

FakeElement.prototype.setAttribute = function (name, value) {
  this.attributes[name] = value === '' ? '' : String(value);
  if (name === 'id') {
    this.id = String(value);
    this.ownerDocument.elementsById[this.id] = this;
  } else if (name === 'disabled') {
    this.disabled = true;
  }
};

FakeElement.prototype.getAttribute = function (name) {
  if (name === 'id') { return this.id; }
  if (name === 'class') { return this.className; }
  return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
};

FakeElement.prototype.getElementsByClassName = function (className) {
  var matches = [];

  function walk(node) {
    var children = node && node.children ? node.children : [];
    var i;

    if (node && typeof node.className === 'string') {
      var tokens = (' ' + node.className + ' ').replace(/\s+/g, ' ');
      if (tokens.indexOf(' ' + className + ' ') !== -1) {
        matches.push(node);
      }
    }
    for (i = 0; i < children.length; i += 1) {
      walk(children[i]);
    }
  }

  walk(this);
  return matches;
};

function FakeDocument() {
  this.activeElement = null;
  this.body = new FakeElement(this, 'body');
  this.elementsById = {};
  this.modeButtons = [];
}

FakeDocument.prototype.createElement = function (tagName) {
  return new FakeElement(this, tagName);
};

FakeDocument.prototype.getElementById = function (id) {
  return this.elementsById[id] || null;
};

FakeDocument.prototype.querySelectorAll = function (selector) {
  if (selector === '#storybook-library-options input[type="checkbox"]') {
    var libraryOptions = this.getElementById('storybook-library-options');
    var results = [];

    function walk(node) {
      var children = node && node.children ? node.children : [];
      var i;

      if (node && node.tagName === 'INPUT' && node.type === 'checkbox') {
        results.push(node);
      }
      for (i = 0; i < children.length; i += 1) {
        walk(children[i]);
      }
    }

    walk(libraryOptions);
    return results;
  }

  if (selector === '[data-mode]') {
    return this.modeButtons.slice();
  }

  return [];
};

FakeDocument.prototype.register = function (node) {
  if (node.id) { this.elementsById[node.id] = node; }
};

function append(document, parent, tagName, id) {
  var element = document.createElement(tagName);
  if (id) { element.setAttribute('id', id); }
  parent.appendChild(element);
  return element;
}

function settingsPreferences(overrides) {
  var result = {
    childName: 'Nova',
    libraryIds: ['kids'],
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
    reducedMotion: false
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

function loadViewHarness(options) {
  options = options || {};
  var document = new FakeDocument();
  var animationCalls = [];
  var closeDetailsCount = 0;
  var closeLibraryCount = 0;
  var focusDoorCalls = [];
  var modeCalls = [];
  var openLibraries = [];
  var openItems = [];
  var openCategories = [];
  var openSettingsCount = 0;
  var endingActions = [];
  var playbackStarts = [];
  var pendingStorybookHomeReady = [];
  var resetCount = 0;
  var storybookHomeAnimationCalls = 0;
  var magicActions = [];
  var preferenceChanges = [];
  var buttons = {
    adult: append(document, document.body, 'button', 'storybook-home-adult-mode-button'),
    cancel: append(document, document.body, 'button', 'storybook-cancel'),
    categoryAnimalsTag: append(document, document.body, 'input', 'storybook-category-tag-animals'),
    categoryBedtimeTag: append(document, document.body, 'input', 'storybook-category-tag-bedtime'),
    categoryLearningTag: append(document, document.body, 'input', 'storybook-category-tag-learning'),
    categoryMovementTag: append(document, document.body, 'input', 'storybook-category-tag-movement'),
    categorySingDanceTag: append(document, document.body, 'input', 'storybook-category-tag-singDance'),
    childName: append(document, document.body, 'input', 'storybook-child-name'),
    durationCozyMax: append(document, document.body, 'input', 'storybook-duration-cozy-max'),
    durationEnabled: append(document, document.body, 'input', 'storybook-duration-labels-enabled'),
    durationQuickMax: append(document, document.body, 'input', 'storybook-duration-quick-max'),
    recentHistoryDays: append(document, document.body, 'input', 'storybook-recent-history-days'),
    detailsAdult: append(document, document.body, 'button', 'storybook-details-adult-mode-button'),
    detailsArt: append(document, document.body, 'div', 'storybook-details-art'),
    detailsBack: append(document, document.body, 'button', 'storybook-details-back'),
    detailsKicker: append(document, document.body, 'p', 'storybook-details-kicker'),
    detailsMeta: append(document, document.body, 'p', 'storybook-details-meta'),
    detailsOverview: append(document, document.body, 'p', 'storybook-details-overview'),
    detailsPlay: append(document, document.body, 'button', 'storybook-details-play'),
    detailsProgress: append(document, document.body, 'div', 'storybook-details-progress'),
    detailsRestart: append(document, document.body, 'button', 'storybook-details-restart'),
    detailsResume: append(document, document.body, 'p', 'storybook-details-resume'),
    detailsStorybook: append(document, document.body, 'button', 'storybook-details-storybook-mode-button'),
    detailsTitle: append(document, document.body, 'h1', 'storybook-details-title'),
    endingBody: append(document, document.body, 'p', 'storybook-ending-body'),
    endingPrimary: append(document, document.body, 'button', 'storybook-ending-all-done'),
    endingSecondary: append(document, document.body, 'button', 'storybook-ending-pick-another'),
    endingTitle: append(document, document.body, 'h1', 'storybook-ending-title'),
    categorySection: append(document, document.body, 'section', 'storybook-categories-section'),
    categories: append(document, document.body, 'div', 'storybook-categories'),
    categoriesTitle: append(document, document.body, 'h2', 'storybook-categories-title'),
    doors: append(document, document.body, 'div', 'storybook-doors'),
    edit: append(document, document.body, 'button', 'storybook-edit-libraries'),
    emptyState: append(document, document.body, 'p', 'storybook-empty-state'),
    favoriteSection: append(document, document.body, 'section', 'storybook-favorites-section'),
    favoriteTitle: append(document, document.body, 'h2', 'storybook-favorites-title'),
    favorites: append(document, document.body, 'div', 'storybook-favorites'),
    greeting: append(document, document.body, 'h1', 'storybook-greeting'),
    hint: append(document, document.body, 'p', 'storybook-home-hint'),
    libraryAdult: append(document, document.body, 'button', 'storybook-library-adult-mode-button'),
    libraryBack: append(document, document.body, 'button', 'storybook-library-back'),
    libraryCards: append(document, document.body, 'div', 'storybook-library-cards'),
    libraryCount: append(document, document.body, 'p', 'storybook-library-count'),
    libraryEmpty: append(document, document.body, 'p', 'storybook-library-empty'),
    libraryStorybook: append(document, document.body, 'button', 'storybook-library-storybook-mode-button'),
    libraryTitle: append(document, document.body, 'h1', 'storybook-library-title'),
    littleMenu: append(document, document.body, 'div', 'storybook-little-menu'),
    littleMenuSection: append(document, document.body, 'section', 'storybook-little-menu-section'),
    littleMenuTitle: append(document, document.body, 'h2', 'storybook-little-menu-title'),
    reset: append(document, document.body, 'button', 'storybook-reset'),
    resumeSection: append(document, document.body, 'section', 'storybook-resume-section'),
    resumeSlot: append(document, document.body, 'div', 'storybook-resume-slot'),
    resumeTitle: append(document, document.body, 'h2', 'storybook-resume-title'),
    settings: append(document, document.body, 'button', 'storybook-settings-button'),
    settingsError: append(document, document.body, 'p', 'storybook-settings-error'),
    settingsLibraries: append(document, document.body, 'div', 'storybook-library-options'),
    settingsWarning: append(document, document.body, 'p', 'storybook-settings-warning'),
    reducedMotion: append(document, document.body, 'input', 'storybook-reduced-motion'),
    save: append(document, document.body, 'button', 'storybook-save'),
    storybook: append(document, document.body, 'button', 'storybook-home-storybook-mode-button')
  };

  buttons.magicPickHomeSection = append(document, document.body, 'section', 'storybook-magic-pick-home-section');
  buttons.magicTrigger = append(document, buttons.magicPickHomeSection, 'button', 'storybook-magic-pick-button');
  buttons.magicScreen = append(document, document.body, 'section', 'storybook-magic-pick-screen');
  buttons.magicBack = append(document, buttons.magicScreen, 'button', 'storybook-magic-pick-back');
  buttons.magicAdult = append(document, buttons.magicScreen, 'button', 'storybook-magic-adult-mode-button');
  buttons.magicStorybook = append(document, buttons.magicScreen, 'button', 'storybook-magic-storybook-mode-button');
  buttons.magicArt = append(document, buttons.magicScreen, 'div', 'storybook-magic-pick-art');
  buttons.magicTitle = append(document, buttons.magicScreen, 'h1', 'storybook-magic-pick-title');
  buttons.magicReason = append(document, buttons.magicScreen, 'p', 'storybook-magic-pick-reason');
  buttons.magicMeta = append(document, buttons.magicScreen, 'p', 'storybook-magic-pick-meta');
  buttons.magicBody = append(document, buttons.magicScreen, 'p', 'storybook-magic-pick-overview');
  buttons.magicPrimary = append(document, buttons.magicScreen, 'button', 'storybook-magic-pick-primary');
  buttons.magicSecondary = append(document, buttons.magicScreen, 'button', 'storybook-magic-pick-secondary');

  buttons.adult.setAttribute('data-mode', 'adult');
  buttons.detailsAdult.setAttribute('data-mode', 'adult');
  append(document, buttons.detailsProgress, 'span', '');
  buttons.detailsStorybook.setAttribute('data-mode', 'storybook');
  buttons.libraryAdult.setAttribute('data-mode', 'adult');
  buttons.libraryStorybook.setAttribute('data-mode', 'storybook');
  buttons.storybook.setAttribute('data-mode', 'storybook');
  buttons.magicAdult.setAttribute('data-mode', 'adult');
  buttons.magicStorybook.setAttribute('data-mode', 'storybook');
  document.modeButtons = [
    buttons.adult,
    buttons.storybook,
    buttons.libraryAdult,
    buttons.libraryStorybook,
    buttons.detailsAdult,
    buttons.detailsStorybook
  ];
  document.modeButtons = document.modeButtons.concat([buttons.magicAdult, buttons.magicStorybook]);

  function shouldDeferStorybookHomeReady(callIndex) {
    return Array.isArray(options.deferStorybookHomeReadyCalls) &&
      options.deferStorybookHomeReadyCalls.indexOf(callIndex) !== -1;
  }

  var window = load('js/storybook-view.js', {
    document: document,
    window: {
      MovieDeckAnimations: {
        animateStorybookHome: function (reducedMotion, onReady) {
          storybookHomeAnimationCalls += 1;
          animationCalls.push(reducedMotion);
          if (typeof onReady === 'function') {
            if (reducedMotion || !shouldDeferStorybookHomeReady(storybookHomeAnimationCalls)) {
              onReady();
            } else {
              pendingStorybookHomeReady.push(onReady);
            }
          }
        },
        focusStorybookDoor: function (door, reducedMotion) {
          focusDoorCalls.push({
            id: door.getAttribute('data-library-id'),
            reducedMotion: reducedMotion
          });
        }
      },
      RawiCopy: {
        get: function (key, values) {
          if (key === 'libraryCaption') { return values.count + ' titles'; }
          if (key === 'storybookDoorAriaLabel') { return 'Open ' + values.library; }
          if (key === 'storybookGreeting') { return 'What should we watch tonight, ' + values.child + '?'; }
          if (key === 'storybookGreetingWithoutName') { return 'What should we watch tonight?'; }
          if (key === 'storybookContinueTitle') {
            return "Continue " + values.child + "'s Story";
          }
          if (key === 'storybookContinueTitleWithoutName') { return 'Continue the story'; }
          if (key === 'storybookFavoritesTitle') {
            return values.child + "'s Favorites";
          }
          if (key === 'storybookFavoritesTitleWithoutName') { return 'Favorites'; }
          if (key === 'storybookHomeHint') { return 'Pick a favorite or open a story door.'; }
          if (key === 'storybookItemAriaLabel') { return 'Open ' + values.title; }
          if (key === 'restartButton') { return 'Start from beginning'; }
          if (key === 'storybookDetailsBackButton') { return '← Storybook'; }
          if (key === 'storybookDetailsKicker') { return 'Story time'; }
          if (key === 'storybookStartButton') { return 'Start story'; }
          if (key === 'storybookResumeButton') { return 'Resume from ' + values.time; }
          if (key === 'storybookEndingTitle') { return 'All done, ' + values.child + '.'; }
          if (key === 'storybookEndingTitleWithoutName') { return 'All done.'; }
          if (key === 'storybookEndingBody') {
            return 'That was ' + values.title + '. Would you like to pick another story?';
          }
          if (key === 'storybookEndingPrimaryButton') { return 'All done'; }
          if (key === 'storybookEndingSecondaryButton') { return 'Pick another'; }
          if (key === 'storybookLibraryBackButton') { return '← Storybook'; }
          if (key === 'storybookLibraryEmpty') {
            return 'No stories are available in ' + values.library + ' right now.';
          }
          if (key === 'storybookResumeProgress') { return 'Resume from ' + values.time; }
          if (key === 'storybookMissingLibraryIdSingle') {
            return 'A previously selected Storybook library ID is no longer available: ' + values.ids + '.';
          }
          if (key === 'storybookMissingLibraryIdMultiple') {
            return 'Previously selected Storybook library IDs are no longer available: ' + values.ids + '.';
          }
          if (key === 'storybookNoSelectedLibraries') { return 'No Storybook libraries are available.'; }
          if (key === 'storybookPreferencesMalformed') { return 'Saved Storybook settings could not be read.'; }
          if (key === 'storybookPreferencesUnsupported') {
            return 'Saved Storybook settings use unsupported version ' + values.version + '.';
          }
          if (key === 'storybookRecoveryResetRequired') {
            return 'Reset Storybook settings before saving new Storybook options.';
          }
          if (key === 'storybookResetButton') { return 'Reset Storybook settings'; }
          if (key === 'storybookResetConfirmButton') { return 'Confirm reset'; }
          if (key === 'storybookResetConfirmPrompt') {
            return 'Select Confirm reset to clear the saved Storybook settings.';
          }
          if (key === 'storybookCategoriesTitle') { return 'Pick a kind of story'; }
          if (key === 'storybookCategoryAriaLabel') { return 'Open ' + values.category; }
          if (key === 'storybookCategorySingDance') { return 'Sing & Dance'; }
          if (key === 'storybookCategoryBedtime') { return 'Bedtime Stories'; }
          if (key === 'storybookCategoryAnimals') { return 'Animal Friends'; }
          if (key === 'storybookCategoryLearning') { return 'Little Lessons'; }
          if (key === 'storybookCategoryMovement') { return 'Move Around'; }
          if (key === 'storybookLittleMenuTitle') { return "Tonight's Little Menu"; }
          if (key === 'storybookCategoryTagsLabel') { return 'Jellyfin tags for Storybook categories'; }
          if (key === 'storybookDurationSettingsLabel') { return 'Friendly duration labels'; }
          if (key === 'storybookDurationLabelsEnabledLabel') { return 'Show friendly duration labels on Storybook cards and details'; }
          if (key === 'storybookDurationQuickMaxLabel') { return 'Quick story up to this many minutes'; }
          if (key === 'storybookDurationCozyMaxLabel') { return 'Cozy episode up to this many minutes'; }
          if (key === 'storybookRecentHistoryDaysLabel') { return 'Hide completed stories for this many days'; }
          if (key === 'storybookDurationThresholdError') { return 'Quick story minutes must be 1 to 240, and Cozy episode minutes must be between Quick story minutes and 240.'; }
          if (key === 'storybookRecentHistoryDaysError') { return 'Recent history days must be between 0 and 365.'; }
          return key;
        }
      }
    }
  });

  window.RawiStorybookView.init({
    onCancelSettings: function () {},
    onCloseStorybookDetails: function () {
      closeDetailsCount += 1;
    },
    onCloseStorybookLibrary: function () {
      closeLibraryCount += 1;
    },
    onModeChange: function (mode, id) {
      modeCalls.push({ id: id, mode: mode });
    },
    onOpenCategory: function (categoryKey) {
      openCategories.push(categoryKey);
    },
    onOpenLibrary: function (libraryId) {
      openLibraries.push(libraryId);
    },
    onOpenSettings: function () {
      openSettingsCount += 1;
    },
    onOpenStorybookItem: function (itemId, source) {
      openItems.push({ id: itemId, source: source });
    },
    onOpenMagicPick: function () {
      magicActions.push('open');
    },
    onCloseMagicPick: function () {
      magicActions.push('close');
    },
    onMagicPickPrimary: function () {
      magicActions.push('primary');
    },
    onMagicPickSecondary: function () {
      magicActions.push('secondary');
    },
    onPreferencesChange: function (nextPreferences) {
      preferenceChanges.push(JSON.parse(JSON.stringify(nextPreferences)));
    },
    onResetSettingsRecovery: function () {
      resetCount += 1;
    },
    onStartStorybookPlayback: function (fromBeginning) {
      playbackStarts.push(fromBeginning);
    },
    onStorybookEndingAction: function (action) {
      endingActions.push(action);
    }
  });

  return {
    animationCalls: animationCalls,
    buttons: buttons,
    closeDetailsCount: function () { return closeDetailsCount; },
    closeLibraryCount: function () { return closeLibraryCount; },
    document: document,
    doorButtons: function () {
      return buttons.doors.firstChild && buttons.doors.firstChild.firstChild ?
        buttons.doors.firstChild.firstChild.children :
        [];
    },
    doorScroller: function () {
      return buttons.doors.firstChild || null;
    },
    focusDoorCalls: function () {
      return JSON.parse(JSON.stringify(focusDoorCalls));
    },
    modeCalls: modeCalls,
    openCategories: function () { return openCategories.slice(); },
    openLibraries: openLibraries,
    openItems: openItems,
    openSettingsCount: function () { return openSettingsCount; },
    pendingStorybookHomeReadyCount: function () {
      return pendingStorybookHomeReady.length;
    },
    endingActions: function () { return endingActions.slice(); },
    magicActions: function () { return magicActions.slice(); },
    playbackStarts: function () { return playbackStarts.slice(); },
    releaseStorybookHomeReady: function () {
      var callback = pendingStorybookHomeReady.shift();
      if (callback) { callback(); }
    },
    resetCount: function () { return resetCount; },
    preferenceChanges: function () {
      return JSON.parse(JSON.stringify(preferenceChanges));
    },
    view: window.RawiStorybookView
  };
}

(function rendersStoryDoorsAndBindsOpenCallbacks() {
  var harness = loadViewHarness();
  var doors;
  var secondDoor;

  harness.view.renderHome({
    childName: 'Nova',
    libraries: [
      { id: 'kids', name: 'Kids' },
      { id: 'disney', name: 'Disney' }
    ],
    reducedMotion: true
  });

  doors = harness.doorButtons();
  secondDoor = doors[1];

  assert.strictEqual(
    harness.buttons.greeting.textContent,
    'What should we watch tonight, Nova?'
  );
  assert.strictEqual(doors.length, 2);
  assert.strictEqual(secondDoor.getAttribute('aria-label'), 'Open Disney');
  assert.strictEqual(harness.document.activeElement, doors[0]);
  assert.strictEqual(harness.document.body.classList.contains('storybook-reduced-motion'), true);
  assert.strictEqual(harness.doorScroller().className, 'storybook-door-scroller');
  assert.strictEqual(harness.buttons.emptyState.style.display, 'none');
  assert.strictEqual(harness.buttons.hint.style.display, '');
  assert.deepStrictEqual(harness.animationCalls, [true]);
  assert.deepStrictEqual(harness.focusDoorCalls(), [{
    id: 'kids',
    reducedMotion: true
  }]);

  secondDoor.click();
  assert.deepStrictEqual(harness.openLibraries, ['disney']);
}());

(function rendersCategoryShortcutsAndBindsOpenCallbacks() {
  var harness = loadViewHarness();
  var buttons;

  harness.view.renderHome({
    childName: 'Nova',
    categories: [
      {
        accentClass: 'storybook-accent-sea',
        caption: '2 titles',
        key: 'animals',
        title: 'Animal Friends'
      }
    ],
    libraries: [
      { id: 'kids', name: 'Kids' }
    ],
    reducedMotion: false
  });

  buttons = harness.buttons.categories.children;
  assert.strictEqual(harness.buttons.categorySection.style.display, 'block');
  assert.strictEqual(harness.buttons.categoriesTitle.textContent, 'Pick a kind of story');
  assert.strictEqual(buttons[0].id, 'storybook-category-animals');
  assert.strictEqual(buttons[0].getAttribute('aria-label'), 'Open Animal Friends');

  buttons[0].click();
  assert.deepStrictEqual(harness.openCategories(), ['animals']);
}());

(function rendersResumeLittleMenuAndFavoritesBeforeStoryDoors() {
  var harness = loadViewHarness();
  var menuCards;
  var favoriteCards;

  harness.view.renderHome({
    childName: 'Nova',
    reducedMotion: false,
    resume: {
      accentClass: 'storybook-accent-periwinkle',
      ariaLabel: 'Open Bluey',
      artworkUrl: '',
      id: 'bluey',
      minutesLabel: '28 min • Cozy episode',
      progressPercent: 21,
      resumeLabel: 'Resume from 6m',
      title: "Bluey's Big Adventure"
    },
    littleMenu: [
      {
        accentClass: 'storybook-accent-sea',
        ariaLabel: 'Open Dance With Me',
        artworkUrl: '',
        id: 'dance',
        minutesLabel: '12 min • Quick story',
        progressPercent: 0,
        resumeLabel: '',
        title: 'Dance With Me'
      }
    ],
    favorites: [
      {
        accentClass: 'storybook-accent-coral',
        ariaLabel: 'Open The Color Garden',
        artworkUrl: '',
        id: 'colors',
        minutesLabel: '9 min • Quick story',
        progressPercent: 0,
        resumeLabel: '',
        title: 'The Color Garden'
      }
    ],
    libraries: [
      {
        accentClass: 'storybook-accent-periwinkle',
        id: 'kids',
        subtitle: '3 titles',
        title: 'Kids'
      }
    ]
  });

  menuCards = harness.buttons.littleMenu.children;
  favoriteCards = harness.buttons.favorites.children;

  assert.strictEqual(harness.buttons.littleMenuSection.style.display, 'block');
  assert.strictEqual(harness.buttons.littleMenuTitle.textContent, "Tonight's Little Menu");
  assert.strictEqual(menuCards.length, 1);
  assert.strictEqual(menuCards[0].id, 'storybook-menu-card-dance');
  assert.strictEqual(favoriteCards.length, 1);

  menuCards[0].click();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(harness.openItems)), [{ id: 'dance', source: 'menu' }]);
}());

(function waitsForStorybookHomeReadinessBeforeFocusingPreferredDoor() {
  var harness = loadViewHarness({
    deferStorybookHomeReadyCalls: [1]
  });

  harness.view.renderHome({
    childName: 'Nova',
    libraries: [
      { id: 'kids', name: 'Kids' },
      { id: 'disney', name: 'Disney' }
    ],
    preferredFocusId: 'storybook-door-disney',
    reducedMotion: false
  });

  assert.strictEqual(harness.document.activeElement, null);
  assert.strictEqual(harness.pendingStorybookHomeReadyCount(), 1);

  harness.releaseStorybookHomeReady();

  assert.strictEqual(harness.document.activeElement.id, 'storybook-door-disney');
  assert.deepStrictEqual(harness.focusDoorCalls(), [{
    id: 'disney',
    reducedMotion: false
  }]);
}());

(function rendersAllStoryDoorsWithoutCapAndUsesGenericGreeting() {
  var harness = loadViewHarness();
  var doors;

  harness.view.renderHome({
    childName: '',
    libraries: [
      { id: 'one', name: 'One' },
      { id: 'two', name: 'Two' },
      { id: 'three', name: 'Three' },
      { id: 'four', name: 'Four' },
      { id: 'five', name: 'Five' },
      { id: 'six', name: 'Six' }
    ],
    reducedMotion: false
  });

  doors = harness.doorButtons();
  doors[5].focus();
  harness.buttons.edit.click();
  harness.buttons.adult.click();

  assert.strictEqual(
    harness.buttons.greeting.textContent,
    'What should we watch tonight?'
  );
  assert.strictEqual(doors.length, 6);
  assert.strictEqual(harness.openSettingsCount(), 1);
  assert.deepStrictEqual(
    harness.focusDoorCalls(),
    [
      { id: 'one', reducedMotion: false },
      { id: 'six', reducedMotion: false }
    ]
  );
  assert.deepStrictEqual(
    harness.modeCalls,
    [{ id: 'storybook-home-adult-mode-button', mode: 'adult' }]
  );
}());

(function rendersStorybookLibraryPageWithLargeCardsAndBackButton() {
  var harness = loadViewHarness();
  var cards;

  harness.view.renderLibrary({
    libraryId: 'kids',
    title: 'Kids',
    cards: [
      {
        accentClass: 'storybook-accent-periwinkle',
        ariaLabel: 'Open First Story',
        artworkUrl: '',
        id: 'story-1',
        minutesLabel: '12 min',
        progressPercent: 0,
        resumeLabel: '',
        title: 'First Story'
      },
      {
        accentClass: 'storybook-accent-sea',
        ariaLabel: 'Open Second Story',
        artworkUrl: '',
        id: 'story-2',
        minutesLabel: '18 min',
        progressPercent: 32,
        resumeLabel: 'Resume from 5m',
        title: 'Second Story'
      }
    ]
  });

  cards = harness.buttons.libraryCards.children;

  assert.strictEqual(harness.buttons.libraryTitle.textContent, 'Kids');
  assert.strictEqual(cards.length, 2);
  assert.strictEqual(harness.document.activeElement.id, 'storybook-library-card-story-1');
  cards[1].click();
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(harness.openItems)),
    [{ id: 'story-2', source: 'library' }]
  );

  harness.buttons.libraryBack.click();
  assert.strictEqual(harness.closeLibraryCount(), 1);
}());

(function rendersEmptyStorybookLibraryAndFocusesBackButton() {
  var harness = loadViewHarness();

  harness.view.renderLibrary({
    libraryId: 'kids',
    title: 'Kids',
    cards: []
  });

  assert.strictEqual(
    harness.buttons.libraryEmpty.textContent,
    'No stories are available in Kids right now.'
  );
  assert.strictEqual(harness.document.activeElement.id, 'storybook-library-back');
}());

(function storybookLibraryTopbarModeButtonsInvokeOnModeChange() {
  var harness = loadViewHarness();

  assert.strictEqual(harness.buttons.libraryAdult.getAttribute('data-mode'), 'adult');
  assert.strictEqual(harness.buttons.libraryStorybook.getAttribute('data-mode'), 'storybook');

  harness.buttons.libraryAdult.click();
  harness.buttons.libraryStorybook.click();

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(harness.modeCalls.slice(-2))),
    [
      { id: 'storybook-library-adult-mode-button', mode: 'adult' },
      { id: 'storybook-library-storybook-mode-button', mode: 'storybook' }
    ]
  );
}());

(function rendersStorybookDetailsWithResumeAndRestart() {
  var harness = loadViewHarness();

  harness.view.renderDetails({
    accentClass: 'storybook-accent-periwinkle',
    artworkUrl: '',
    minutesLabel: '28 min',
    overview: 'Bluey follows a moonlit map through the backyard.',
    progressPercent: 21,
    primaryActionLabel: 'Resume from 6m',
    resumeLabel: 'Resume from 6m',
    showRestart: true,
    title: "Bluey's Big Adventure"
  });

  assert.strictEqual(harness.buttons.detailsTitle.textContent, "Bluey's Big Adventure");
  assert.strictEqual(harness.buttons.detailsPlay.textContent, 'Resume from 6m');
  assert.strictEqual(harness.buttons.detailsRestart.style.display, 'inline-block');
  assert.strictEqual(harness.buttons.detailsProgress.style.display, 'block');
  assert.strictEqual(harness.buttons.detailsProgress.firstChild.style.width, '21%');
  assert.strictEqual(harness.document.activeElement.id, 'storybook-details-play');

  harness.buttons.detailsPlay.click();
  harness.buttons.detailsRestart.click();
  harness.buttons.detailsBack.click();

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(harness.playbackStarts())),
    [false, true]
  );
  assert.strictEqual(harness.closeDetailsCount(), 1);
}());

(function rendersGentleEndingAndFocusesAllDone() {
  var harness = loadViewHarness();

  harness.view.renderEnding({ childName: 'Nova', title: 'First Story' });

  assert.strictEqual(harness.buttons.endingTitle.textContent, 'All done, Nova.');
  assert.strictEqual(
    harness.buttons.endingBody.textContent,
    'That was First Story. Would you like to pick another story?'
  );
  assert.strictEqual(harness.document.activeElement.id, 'storybook-ending-all-done');

  harness.buttons.endingSecondary.click();
  harness.buttons.endingPrimary.click();

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(harness.endingActions())),
    ['pick', 'done']
  );
}());

(function storybookDetailsTopbarModeButtonsInvokeOnModeChange() {
  var harness = loadViewHarness();

  assert.strictEqual(harness.buttons.detailsAdult.getAttribute('data-mode'), 'adult');
  assert.strictEqual(harness.buttons.detailsStorybook.getAttribute('data-mode'), 'storybook');

  harness.buttons.detailsAdult.click();
  harness.buttons.detailsStorybook.click();

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(harness.modeCalls.slice(-2))),
    [
      { id: 'storybook-details-adult-mode-button', mode: 'adult' },
      { id: 'storybook-details-storybook-mode-button', mode: 'storybook' }
    ]
  );
}());

(function showsRecoveryMessageAndFocusesEditButtonWhenNoLibrariesAreAvailable() {
  var harness = loadViewHarness();

  harness.view.renderHome({
    childName: 'Nova',
    libraries: [],
    reducedMotion: false
  });

  assert.strictEqual(harness.buttons.hint.style.display, 'none');
  assert.strictEqual(harness.buttons.emptyState.style.display, 'block');
  assert.strictEqual(
    harness.buttons.emptyState.textContent,
    'No Storybook libraries are available.'
  );
  assert.strictEqual(harness.document.activeElement, harness.buttons.edit);
  assert.deepStrictEqual(harness.animationCalls, [false]);
}());

(function identifiesOneOrManyMissingLibraryIdsOnlyInSettings() {
  var harness = loadViewHarness();

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences({ libraryIds: ['kids'] }),
    ['missing-one'],
    null
  );
  assert.strictEqual(
    harness.buttons.settingsWarning.textContent,
    'A previously selected Storybook library ID is no longer available: missing-one.'
  );

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences({ libraryIds: ['kids'] }),
    ['missing-one', 'missing-two'],
    null
  );
  assert.strictEqual(
    harness.buttons.settingsWarning.textContent,
    'Previously selected Storybook library IDs are no longer available: missing-one, missing-two.'
  );
}());

(function showsRecoveryResetControlsOnlyWhenNeeded() {
  var harness = loadViewHarness();

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences({ libraryIds: ['kids'] }),
    [],
    {
      needsRecovery: true,
      type: 'malformed',
      confirmingReset: false
    }
  );
  assert.strictEqual(
    harness.buttons.settingsWarning.textContent,
    'Saved Storybook settings could not be read. Reset Storybook settings before saving new Storybook options.'
  );
  assert.strictEqual(harness.buttons.childName.disabled, true);
  assert.strictEqual(harness.buttons.reducedMotion.disabled, true);
  assert.strictEqual(harness.buttons.save.disabled, true);
  assert.strictEqual(harness.buttons.reset.disabled, false);
  assert.strictEqual(harness.buttons.reset.style.display, 'inline-block');
  assert.strictEqual(harness.buttons.reset.textContent, 'Reset Storybook settings');
  [
    'categorySingDanceTag',
    'categoryBedtimeTag',
    'categoryAnimalsTag',
    'categoryLearningTag',
    'categoryMovementTag',
    'durationEnabled',
    'durationQuickMax',
    'durationCozyMax',
    'recentHistoryDays'
  ].forEach(function (key) {
    assert.strictEqual(harness.buttons[key].disabled, true, key + ' should be disabled while recovery is active');
  });
  harness.buttons.reset.click();
  assert.strictEqual(harness.resetCount(), 1);

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences({ libraryIds: ['kids'] }),
    [],
    {
      needsRecovery: true,
      type: 'unsupported-version',
      version: 99,
      confirmingReset: true
    }
  );
  assert.strictEqual(
    harness.buttons.settingsWarning.textContent,
    'Saved Storybook settings use unsupported version 99. Select Confirm reset to clear the saved Storybook settings.'
  );
  assert.strictEqual(harness.buttons.reset.textContent, 'Confirm reset');

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences({ libraryIds: ['kids'] }),
    [],
    null
  );
  assert.strictEqual(harness.buttons.settingsWarning.textContent, '');
  assert.strictEqual(harness.buttons.childName.disabled, false);
  assert.strictEqual(harness.buttons.reducedMotion.disabled, false);
  assert.strictEqual(harness.buttons.save.disabled, false);
  assert.strictEqual(harness.buttons.reset.disabled, true);
  assert.strictEqual(harness.buttons.reset.style.display, 'none');
  [
    'categorySingDanceTag',
    'categoryBedtimeTag',
    'categoryAnimalsTag',
    'categoryLearningTag',
    'categoryMovementTag',
    'durationEnabled',
    'durationQuickMax',
    'durationCozyMax',
    'recentHistoryDays'
  ].forEach(function (key) {
    assert.strictEqual(harness.buttons[key].disabled, false, key + ' should be re-enabled once recovery clears');
  });

  harness.view.renderSettings(
    [],
    settingsPreferences({ libraryIds: [] }),
    [],
    null
  );
  assert.strictEqual(harness.buttons.settingsWarning.textContent, '');
  assert.strictEqual(harness.buttons.save.disabled, true);
}());

(function fakeClassLookupReturnsDescendantsInDocumentOrder() {
  var harness = loadViewHarness();
  var parent = harness.document.createElement('div');
  var first = harness.document.createElement('span');
  var nested = harness.document.createElement('span');

  parent.className = 'outer';
  first.className = 'match';
  first.id = 'first-match';
  nested.className = 'match';
  nested.id = 'nested-match';
  parent.appendChild(first);
  first.appendChild(nested);
  harness.document.body.appendChild(parent);

  assert.deepStrictEqual(
    Array.prototype.map.call(parent.getElementsByClassName('match'), function (node) {
      return node.id;
    }),
    ['first-match', 'nested-match']
  );
}());

(function querySelectorAllReturnsLabelWrappedCheckboxesInDocumentOrder() {
  var harness = loadViewHarness();
  var checkboxes;
  var selected;

  harness.view.renderSettings(
    [
      { Id: 'alpha', Name: 'Alpha' },
      { Id: 'beta', Name: 'Beta' },
      { Id: 'gamma', Name: 'Gamma' }
    ],
    settingsPreferences({ libraryIds: ['alpha', 'gamma'] }),
    [],
    null
  );
  checkboxes = harness.document.querySelectorAll(
    '#storybook-library-options input[type="checkbox"]'
  );
  selected = Array.prototype.filter.call(checkboxes, function (node) {
    return node.checked;
  }).map(function (node) {
    return node.value;
  });

  assert.deepStrictEqual(
    Array.prototype.map.call(checkboxes, function (node) {
      return node.value + ':' + String(node.checked);
    }),
    ['alpha:true', 'beta:false', 'gamma:true']
  );
  assert.deepStrictEqual(selected, ['alpha', 'gamma']);
  assert.deepStrictEqual(harness.document.querySelectorAll('[data-mode]'), harness.document.modeButtons);
}());

(function settingsSaveEmitsCategoryTagsDurationLabelsAndHistoryWindow() {
  var harness = loadViewHarness();

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences(),
    [],
    null
  );

  harness.buttons.categoryAnimalsTag.value = 'zoo';
  harness.buttons.durationEnabled.checked = false;
  harness.buttons.durationQuickMax.value = '10';
  harness.buttons.durationCozyMax.value = '25';
  harness.buttons.recentHistoryDays.value = '3';
  harness.buttons.save.click();

  assert.deepStrictEqual(harness.preferenceChanges().slice(-1)[0], {
    enabled: true,
    childName: 'Nova',
    libraryIds: ['kids'],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'zoo',
      learning: 'learning',
      movement: 'movement'
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 10,
      cozyMaxMinutes: 25
    },
    recentHistoryDays: 3,
    reducedMotion: false
  });
}());

(function settingsRejectsInvalidDurationThresholdsAndKeepsFocusOnCozyField() {
  var harness = loadViewHarness();

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences(),
    [],
    null
  );

  harness.buttons.durationQuickMax.value = '18';
  harness.buttons.durationCozyMax.value = '12';
  harness.buttons.save.click();

  assert.strictEqual(
    harness.buttons.settingsError.textContent,
    'Quick story minutes must be 1 to 240, and Cozy episode minutes must be between Quick story minutes and 240.'
  );
  assert.strictEqual(harness.document.activeElement.id, 'storybook-duration-cozy-max');
  assert.strictEqual(harness.preferenceChanges().length, 0);
}());

(function settingsRejectsQuickMaxAboveHtmlLimitAndKeepsFocusOnQuickField() {
  var harness = loadViewHarness();

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences(),
    [],
    null
  );

  harness.buttons.durationQuickMax.value = '241';
  harness.buttons.durationCozyMax.value = '241';
  harness.buttons.save.click();

  assert.strictEqual(
    harness.buttons.settingsError.textContent,
    'Quick story minutes must be 1 to 240, and Cozy episode minutes must be between Quick story minutes and 240.'
  );
  assert.strictEqual(harness.document.activeElement.id, 'storybook-duration-quick-max');
  assert.strictEqual(harness.preferenceChanges().length, 0);
}());

(function settingsRejectsCozyMaxAboveHtmlLimitAndKeepsFocusOnCozyField() {
  var harness = loadViewHarness();

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences(),
    [],
    null
  );

  harness.buttons.durationQuickMax.value = '100';
  harness.buttons.durationCozyMax.value = '241';
  harness.buttons.save.click();

  assert.strictEqual(
    harness.buttons.settingsError.textContent,
    'Quick story minutes must be 1 to 240, and Cozy episode minutes must be between Quick story minutes and 240.'
  );
  assert.strictEqual(harness.document.activeElement.id, 'storybook-duration-cozy-max');
  assert.strictEqual(harness.preferenceChanges().length, 0);
}());

(function settingsRejectsNegativeRecentHistoryDaysAndKeepsFocusOnHistoryField() {
  var harness = loadViewHarness();

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences(),
    [],
    null
  );

  harness.buttons.recentHistoryDays.value = '-1';
  harness.buttons.save.click();

  assert.strictEqual(
    harness.buttons.settingsError.textContent,
    'Recent history days must be between 0 and 365.'
  );
  assert.strictEqual(harness.document.activeElement.id, 'storybook-recent-history-days');
  assert.strictEqual(harness.preferenceChanges().length, 0);
}());

(function settingsRejectsRecentHistoryDaysAboveHtmlLimitAndKeepsFocusOnHistoryField() {
  var harness = loadViewHarness();

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    settingsPreferences(),
    [],
    null
  );

  harness.buttons.recentHistoryDays.value = '366';
  harness.buttons.save.click();

  assert.strictEqual(
    harness.buttons.settingsError.textContent,
    'Recent history days must be between 0 and 365.'
  );
  assert.strictEqual(harness.document.activeElement.id, 'storybook-recent-history-days');
  assert.strictEqual(harness.preferenceChanges().length, 0);
}());

(function rendersFriendlyDurationLabelsAcrossStorybookCardsAndDetails() {
  var harness = loadViewHarness();
  var cards;

  harness.view.renderHome({
    childName: 'Nova',
    reducedMotion: false,
    resume: {
      accentClass: 'storybook-accent-periwinkle',
      ariaLabel: 'Open Bluey',
      artworkUrl: '',
      id: 'bluey',
      minutesLabel: '28 min • Cozy episode',
      progressPercent: 21,
      resumeLabel: 'Resume from 6m',
      title: "Bluey's Big Adventure"
    },
    favorites: [
      {
        accentClass: 'storybook-accent-sea',
        ariaLabel: 'Open Dance With Me',
        artworkUrl: '',
        id: 'dance',
        minutesLabel: '12 min • Quick story',
        progressPercent: 0,
        resumeLabel: '',
        title: 'Dance With Me'
      }
    ],
    libraries: []
  });

  cards = harness.buttons.favorites.children;
  assert.strictEqual(cards[0].getElementsByClassName('storybook-card-meta')[0].textContent, '12 min • Quick story');

  harness.view.renderDetails({
    accentClass: 'storybook-accent-periwinkle',
    artworkUrl: '',
    minutesLabel: '41 min • Big movie',
    overview: 'A cozy longer story.',
    progressPercent: 0,
    primaryActionLabel: 'Start story',
    resumeLabel: '',
    showRestart: false,
    title: 'Night Sky Movie'
  });

  assert.strictEqual(harness.buttons.detailsMeta.textContent, '41 min • Big movie');
}());

(function rendersMagicPickCandidateAndExportsTheRenderer() {
  var harness = loadViewHarness();

  assert.strictEqual(typeof harness.view.renderMagicPick, 'function');
  harness.view.renderMagicPick({
    accentClass: 'storybook-accent-sea',
    artworkUrl: '',
    empty: false,
    minutesLabel: '12 min • Quick story',
    overview: 'A cozy surprise.',
    primaryActionLabel: 'Tell me about this story',
    reason: 'A favorite with a little extra sparkle.',
    secondaryActionLabel: 'Pick again',
    title: 'Dance With Me'
  });

  assert.strictEqual(harness.buttons.magicTitle.textContent, 'Dance With Me');
  assert.strictEqual(harness.buttons.magicReason.textContent, 'A favorite with a little extra sparkle.');
  assert.strictEqual(harness.buttons.magicMeta.textContent, '12 min • Quick story');
  assert.strictEqual(harness.document.activeElement.id, 'storybook-magic-pick-primary');

  harness.buttons.magicPrimary.click();
  harness.buttons.magicSecondary.click();
  harness.buttons.magicBack.click();
  assert.deepStrictEqual(harness.magicActions(), ['primary', 'secondary', 'close']);
}());
