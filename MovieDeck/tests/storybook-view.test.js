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
  this.attributes = {};
  this.listeners = {};
  this.classList = new FakeClassList();
  this.textContent = '';
  this.id = '';

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
  this.ownerDocument.activeElement = this;
};

FakeElement.prototype.click = function () {
  this.focus();
  this.dispatch('click', {});
};

FakeElement.prototype.setAttribute = function (name, value) {
  this.attributes[name] = value === '' ? '' : String(value);
  if (name === 'id') {
    this.id = String(value);
    this.ownerDocument.elementsById[this.id] = this;
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
  var modeCalls = [];
  var openLibraries = [];
  var openSettingsCount = 0;
  var animationCalls = [];
  var buttons = {
    adult: append(document, document.body, 'button', 'storybook-home-adult-mode-button'),
    cancel: append(document, document.body, 'button', 'storybook-cancel'),
    childName: append(document, document.body, 'input', 'storybook-child-name'),
    doors: append(document, document.body, 'div', 'storybook-doors'),
    edit: append(document, document.body, 'button', 'storybook-edit-libraries'),
    greeting: append(document, document.body, 'h1', 'storybook-greeting'),
    settings: append(document, document.body, 'button', 'storybook-settings-button'),
    settingsError: append(document, document.body, 'p', 'storybook-settings-error'),
    settingsLibraries: append(document, document.body, 'div', 'storybook-library-options'),
    reducedMotion: append(document, document.body, 'input', 'storybook-reduced-motion'),
    save: append(document, document.body, 'button', 'storybook-save'),
    storybook: append(document, document.body, 'button', 'storybook-home-storybook-mode-button')
  };

  buttons.adult.setAttribute('data-mode', 'adult');
  buttons.storybook.setAttribute('data-mode', 'storybook');
  document.modeButtons = [buttons.adult, buttons.storybook];

  var window = load('js/storybook-view.js', {
    document: document,
    window: {
      MovieDeckAnimations: {
        animateStorybookHome: function (reducedMotion) {
          animationCalls.push(reducedMotion);
        }
      },
      RawiCopy: {
        get: function (key, values) {
          if (key === 'storybookDoorAriaLabel') { return 'Open ' + values.library; }
          if (key === 'storybookGreeting') { return 'What should we watch tonight, ' + values.child + '?'; }
          if (key === 'storybookGreetingWithoutName') { return 'What should we watch tonight?'; }
          return key;
        }
      }
    }
  });

  window.RawiStorybookView.init({
    onModeChange: function (mode, id) {
      modeCalls.push({ id: id, mode: mode });
    },
    onOpenLibrary: function (libraryId) {
      openLibraries.push(libraryId);
    },
    onOpenSettings: function () {
      openSettingsCount += 1;
    }
  });

  return {
    animationCalls: animationCalls,
    buttons: buttons,
    document: document,
    modeCalls: modeCalls,
    openLibraries: openLibraries,
    openSettingsCount: function () { return openSettingsCount; },
    view: window.RawiStorybookView
  };
}

(function rendersStoryDoorsAndBindsOpenCallbacks() {
  var harness = loadViewHarness();
  var secondDoor;

  harness.view.renderHome({
    childName: 'Nova',
    libraries: [
      { id: 'kids', name: 'Kids' },
      { id: 'disney', name: 'Disney' }
    ],
    reducedMotion: true
  });

  secondDoor = harness.buttons.doors.children[1];

  assert.strictEqual(
    harness.buttons.greeting.textContent,
    'What should we watch tonight, Nova?'
  );
  assert.strictEqual(harness.buttons.doors.children.length, 2);
  assert.strictEqual(secondDoor.getAttribute('aria-label'), 'Open Disney');
  assert.strictEqual(harness.document.activeElement, harness.buttons.doors.children[0]);
  assert.strictEqual(harness.document.body.classList.contains('storybook-reduced-motion'), true);
  assert.deepStrictEqual(harness.animationCalls, [true]);

  secondDoor.click();
  assert.deepStrictEqual(harness.openLibraries, ['disney']);
}());

(function capsDoorCountAndUsesGenericGreeting() {
  var harness = loadViewHarness();

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

  harness.buttons.edit.click();
  harness.buttons.adult.click();

  assert.strictEqual(
    harness.buttons.greeting.textContent,
    'What should we watch tonight?'
  );
  assert.strictEqual(harness.buttons.doors.children.length, 5);
  assert.strictEqual(harness.openSettingsCount(), 1);
  assert.deepStrictEqual(
    harness.modeCalls,
    [{ id: 'storybook-home-adult-mode-button', mode: 'adult' }]
  );
}());
