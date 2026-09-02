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

  function settingsWarningText(missingIds, recovery) {
    var messages = [];

    if (missingIds && missingIds.length) {
      messages.push(copy.get(
        missingIds.length === 1 ?
          'storybookMissingLibraryIdSingle' :
          'storybookMissingLibraryIdMultiple',
        { ids: missingIds.join(', ') }
      ));
    }

    if (recovery && recovery.needsRecovery) {
      if (recovery.type === 'unsupported-version') {
        messages.push(copy.get('storybookPreferencesUnsupported', { version: recovery.version }));
      } else {
        messages.push(copy.get('storybookPreferencesMalformed'));
      }
      messages.push(copy.get(
        recovery.confirmingReset ?
          'storybookResetConfirmPrompt' :
          'storybookRecoveryResetRequired'
      ));
    }

    return messages.join(' ');
  }

  function toggleDisabled(control, disabled) {
    if (!control) { return; }
    control.disabled = disabled;
  }

  function focusWhenReady(control) {
    if (!control) { return; }
    if (global.setTimeout) {
      global.setTimeout(function () {
        control.focus();
      }, 0);
      return;
    }
    control.focus();
  }

  function renderHome(model) {
    var container = byId('storybook-doors');
    var editButton = byId('storybook-edit-libraries');
    var emptyState = byId('storybook-empty-state');
    var firstDoor = null;
    var hasLibraries;
    var hint = byId('storybook-home-hint');
    var libraries = model && model.libraries ? model.libraries : [];
    var greeting = model && model.childName ?
      copy.get('storybookGreeting', { child: model.childName }) :
      copy.get('storybookGreetingWithoutName');
    var reducedMotion = !!(model && model.reducedMotion);
    var strip;

    byId('storybook-greeting').textContent = greeting;
    container.innerHTML = '';
    container.scrollLeft = 0;
    strip = document.createElement('div');
    strip.className = 'storybook-door-strip';
    container.appendChild(strip);
    hasLibraries = libraries.length > 0;

    libraries.forEach(function (library) {
      var door = document.createElement('button');
      door.className = 'storybook-door focusable';
      door.setAttribute('data-focusable', '');
      door.setAttribute('data-library-id', library.id);
      door.setAttribute(
        'aria-label',
        copy.get('storybookDoorAriaLabel', { library: library.name })
      );
      door.textContent = library.name;
      door.addEventListener('focus', function () {
        if (global.MovieDeckAnimations && global.MovieDeckAnimations.focusStorybookDoor) {
          global.MovieDeckAnimations.focusStorybookDoor(door, reducedMotion);
        }
      });
      door.addEventListener('click', function () {
        callbacks.onOpenLibrary(library.id);
      });
      if (!firstDoor) { firstDoor = door; }
      strip.appendChild(door);
    });

    if (hint) { hint.style.display = hasLibraries ? '' : 'none'; }
    if (emptyState) {
      emptyState.textContent = hasLibraries ? '' : copy.get('storybookNoSelectedLibraries');
      emptyState.style.display = hasLibraries ? 'none' : 'block';
    }
    document.body.classList.toggle(
      'storybook-reduced-motion',
      reducedMotion
    );
    if (global.MovieDeckAnimations) {
      global.MovieDeckAnimations.animateStorybookHome(reducedMotion);
    }
    if (firstDoor) { focusWhenReady(firstDoor); }
    else if (editButton) { focusWhenReady(editButton); }
  }

  function renderSettings(libraries, preferences, missingIds, recovery) {
    var container = byId('storybook-library-options');
    var childName = byId('storybook-child-name');
    var reducedMotion = byId('storybook-reduced-motion');
    var resetButton = byId('storybook-reset');
    var saveButton = byId('storybook-save');
    var settingsError = byId('storybook-settings-error');
    var settingsWarning = byId('storybook-settings-warning');
    var locked = !!(recovery && recovery.needsRecovery);

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
      checkbox.disabled = locked;
      text.textContent = itemName(library);
      label.className = 'library-option';
      label.appendChild(checkbox);
      label.appendChild(text);
      container.appendChild(label);
    });

    childName.value = preferences.childName;
    reducedMotion.checked = preferences.reducedMotion;
    toggleDisabled(childName, locked);
    toggleDisabled(reducedMotion, locked);
    toggleDisabled(saveButton, locked);

    if (settingsWarning) {
      settingsWarning.textContent = settingsWarningText(missingIds, recovery);
      settingsWarning.style.display = settingsWarning.textContent ? 'block' : 'none';
    }

    if (settingsError) {
      settingsError.textContent = '';
    }

    if (resetButton) {
      resetButton.disabled = !locked;
      resetButton.style.display = locked ? 'inline-block' : 'none';
      resetButton.textContent = copy.get(
        locked && recovery.confirmingReset ?
          'storybookResetConfirmButton' :
          'storybookResetButton'
      );
    }
  }

  function saveSettings() {
    var preferences;

    if (byId('storybook-save').disabled) { return; }
    preferences = {
      enabled: true,
      childName: byId('storybook-child-name').value,
      libraryIds: selectedLibraryIds(),
      reducedMotion: byId('storybook-reduced-motion').checked
    };
    byId('storybook-settings-error').textContent = '';
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
        callbacks.onModeChange(button.getAttribute('data-mode'), button.id);
      });
    });
    byId('storybook-settings-button').addEventListener('click', function () {
      callbacks.onOpenSettings('storybook-settings-button');
    });
    byId('storybook-edit-libraries').addEventListener('click', function () {
      callbacks.onOpenSettings('storybook-edit-libraries');
    });
    byId('storybook-save').addEventListener('click', saveSettings);
    byId('storybook-cancel').addEventListener('click', callbacks.onCancelSettings);
    if (byId('storybook-reset')) {
      byId('storybook-reset').addEventListener('click', function () {
        callbacks.onResetSettingsRecovery();
      });
    }
  }

  global.RawiStorybookView = {
    init: init,
    renderHome: renderHome,
    renderSettings: renderSettings,
    setMode: setMode
  };
}(window));
