(function (global) {
  'use strict';

  var copy = global.RawiCopy;
  var callbacks = {};

  function byId(id) { return document.getElementById(id); }
  function itemId(item) {
    return item && item.Id !== undefined ? item.Id : item.id;
  }
  function itemName(item) {
    return item && (item.Name !== undefined ? item.Name : item.name) || copy.get('untitled');
  }

  function setMode(mode) {
    var storybook = mode === 'storybook';
    document.body.classList.toggle('mode-storybook', storybook);
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-mode]'),
      function (button) {
        var active = button.getAttribute('data-mode') === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      }
    );
  }

  function selectedLibraryIds() {
    return Array.prototype.filter.call(
      document.querySelectorAll('#storybook-library-options input[type="checkbox"]'),
      function (input) { return input.checked; }
    ).map(function (input) { return input.value; });
  }

  function renderSettings(libraries, preferences, missingIds) {
    var container = byId('storybook-library-options');
    container.innerHTML = '';
    (libraries || []).forEach(function (library) {
      var label = document.createElement('label');
      var checkbox = document.createElement('input');
      var text = document.createElement('span');
      checkbox.type = 'checkbox';
      checkbox.value = itemId(library);
      checkbox.checked = preferences.libraryIds.indexOf(checkbox.value) !== -1;
      checkbox.className = 'focusable';
      checkbox.setAttribute('data-focusable', '');
      text.textContent = itemName(library);
      label.className = 'library-option';
      label.appendChild(checkbox);
      label.appendChild(text);
      container.appendChild(label);
    });
    byId('storybook-child-name').value = preferences.childName;
    byId('storybook-reduced-motion').checked = preferences.reducedMotion;
    byId('storybook-settings-error').textContent =
      missingIds && missingIds.length ? copy.get('storybookMissingLibrary') : '';
  }

  function saveSettings() {
    var preferences = {
      enabled: true,
      lastMode: 'storybook',
      childName: byId('storybook-child-name').value,
      libraryIds: selectedLibraryIds(),
      reducedMotion: byId('storybook-reduced-motion').checked
    };
    if (!preferences.libraryIds.length) {
      byId('storybook-settings-error').textContent = copy.get('storybookNoLibraries');
      return;
    }
    callbacks.onPreferencesChange(preferences);
  }

  function init(options) {
    callbacks = options;
    Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function (button) {
      button.addEventListener('click', function () {
        callbacks.onModeChange(button.getAttribute('data-mode'));
      });
    });
    byId('storybook-settings-button').addEventListener('click', callbacks.onOpenSettings);
    byId('storybook-save').addEventListener('click', saveSettings);
    byId('storybook-cancel').addEventListener('click', callbacks.onCancelSettings);
  }

  global.RawiStorybookView = {
    init: init,
    renderSettings: renderSettings,
    setMode: setMode
  };
}(window));
