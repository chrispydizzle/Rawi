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
  if (selector === '[data-mode]') { return this.modeButtons.slice(); }
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

function loadViewHarness() {
  var document = new FakeDocument();
  var animationCalls = [];
  var closeLibraryCount = 0;
  var focusDoorCalls = [];
  var modeCalls = [];
  var openLibraries = [];
  var openItems = [];
  var openSettingsCount = 0;
  var resetCount = 0;
  var buttons = {
    adult: append(document, document.body, 'button', 'storybook-home-adult-mode-button'),
    cancel: append(document, document.body, 'button', 'storybook-cancel'),
    childName: append(document, document.body, 'input', 'storybook-child-name'),
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

  buttons.adult.setAttribute('data-mode', 'adult');
  buttons.libraryAdult.setAttribute('data-mode', 'adult');
  buttons.libraryStorybook.setAttribute('data-mode', 'storybook');
  buttons.storybook.setAttribute('data-mode', 'storybook');
  document.modeButtons = [
    buttons.adult,
    buttons.storybook,
    buttons.libraryAdult,
    buttons.libraryStorybook
  ];

  var window = load('js/storybook-view.js', {
    document: document,
    window: {
      MovieDeckAnimations: {
        animateStorybookHome: function (reducedMotion) {
          animationCalls.push(reducedMotion);
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
          return key;
        }
      }
    }
  });

  window.RawiStorybookView.init({
    onCancelSettings: function () {},
    onCloseStorybookLibrary: function () {
      closeLibraryCount += 1;
    },
    onModeChange: function (mode, id) {
      modeCalls.push({ id: id, mode: mode });
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
    onPreferencesChange: function () {},
    onResetSettingsRecovery: function () {
      resetCount += 1;
    }
  });

  return {
    animationCalls: animationCalls,
    buttons: buttons,
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
    openLibraries: openLibraries,
    openItems: openItems,
    openSettingsCount: function () { return openSettingsCount; },
    resetCount: function () { return resetCount; },
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

(function rendersResumeAndFavoritesBeforeStoryDoors() {
  var harness = loadViewHarness();
  var favoriteCards;

  harness.view.renderHome({
    childName: 'Nova',
    reducedMotion: false,
    resume: {
      accentClass: 'storybook-accent-periwinkle',
      ariaLabel: 'Open Bluey',
      artworkUrl: '',
      id: 'bluey',
      minutesLabel: '28 min',
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
        minutesLabel: '12 min',
        progressPercent: 0,
        resumeLabel: '',
        title: 'Dance With Me'
      }
    ],
    libraries: [
      {
        accentClass: 'storybook-accent-coral',
        artworkUrl: '',
        id: 'kids',
        subtitle: '1 story',
        title: 'Kids'
      }
    ]
  });

  favoriteCards = harness.buttons.favorites.children;

  assert.strictEqual(harness.buttons.resumeSection.style.display, 'block');
  assert.strictEqual(harness.buttons.favoriteSection.style.display, 'block');
  assert.strictEqual(harness.buttons.resumeTitle.textContent, "Continue Nova's Story");
  assert.strictEqual(harness.buttons.favoriteTitle.textContent, "Nova's Favorites");
  assert.strictEqual(harness.document.activeElement.id, 'storybook-resume-card');
  assert.strictEqual(favoriteCards.length, 1);
  assert.strictEqual(favoriteCards[0].getAttribute('data-item-id'), 'dance');

  harness.document.getElementById('storybook-resume-card').click();
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(harness.openItems)),
    [{ id: 'bluey', source: 'resume' }]
  );
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
    {
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: false
    },
    ['missing-one'],
    null
  );
  assert.strictEqual(
    harness.buttons.settingsWarning.textContent,
    'A previously selected Storybook library ID is no longer available: missing-one.'
  );

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    {
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: false
    },
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
    {
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: false
    },
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
  harness.buttons.reset.click();
  assert.strictEqual(harness.resetCount(), 1);

  harness.view.renderSettings(
    [{ Id: 'kids', Name: 'Kids' }],
    {
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: false
    },
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
    {
      childName: 'Nova',
      libraryIds: ['kids'],
      reducedMotion: false
    },
    [],
    null
  );
  assert.strictEqual(harness.buttons.settingsWarning.textContent, '');
  assert.strictEqual(harness.buttons.childName.disabled, false);
  assert.strictEqual(harness.buttons.reducedMotion.disabled, false);
  assert.strictEqual(harness.buttons.save.disabled, false);
  assert.strictEqual(harness.buttons.reset.disabled, true);
  assert.strictEqual(harness.buttons.reset.style.display, 'none');
}());
