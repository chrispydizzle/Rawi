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

  function sectionTitle(withNameKey, withoutNameKey, childName) {
    return childName ? copy.get(withNameKey, { child: childName }) : copy.get(withoutNameKey);
  }

  function createArtwork(model, className) {
    var frame = document.createElement('div');
    var fallback = document.createElement('div');
    var image;

    frame.className = className + '-art';
    fallback.className = className + '-fallback ' + (model.accentClass || 'storybook-accent-periwinkle');
    fallback.textContent = model.title;

    if (model.artworkUrl) {
      image = document.createElement('img');
      image.className = className + '-image';
      image.src = model.artworkUrl;
      image.alt = '';
      image.onerror = function () {
        this.style.display = 'none';
        fallback.style.display = 'flex';
      };
      frame.appendChild(image);
      fallback.style.display = 'none';
    }

    frame.appendChild(fallback);
    return frame;
  }

  function createStoryCard(model, className, source) {
    var card = document.createElement('button');
    var copyBlock = document.createElement('div');
    var title = document.createElement('h3');
    var meta = document.createElement('p');
    var resume = document.createElement('p');
    var progress = document.createElement('div');
    var fill = document.createElement('span');

    card.id = source === 'resume' ? 'storybook-resume-card' : 'storybook-' + source + '-card-' + model.id;
    card.className = className + ' focusable';
    card.setAttribute('data-focusable', '');
    card.setAttribute('data-item-id', model.id);
    card.setAttribute('aria-label', model.ariaLabel || copy.get('storybookItemAriaLabel', { title: model.title }));
    card.appendChild(createArtwork(model, className));

    copyBlock.className = className + '-copy';
    title.className = 'storybook-card-title';
    title.textContent = model.title;
    copyBlock.appendChild(title);

    if (model.minutesLabel) {
      meta.className = 'storybook-card-meta';
      meta.textContent = model.minutesLabel;
      copyBlock.appendChild(meta);
    }

    if (model.progressPercent > 0) {
      progress.className = 'storybook-card-progress';
      fill.style.width = model.progressPercent + '%';
      progress.appendChild(fill);
      copyBlock.appendChild(progress);
    }

    if (model.resumeLabel) {
      resume.className = 'storybook-card-resume';
      resume.textContent = model.resumeLabel;
      copyBlock.appendChild(resume);
    }

    card.appendChild(copyBlock);
    card.addEventListener('click', function () {
      callbacks.onOpenStorybookItem(model.id, source);
    });

    return card;
  }

  function renderHome(model) {
    var resumeSection = byId('storybook-resume-section');
    var resumeSlot = byId('storybook-resume-slot');
    var favoritesSection = byId('storybook-favorites-section');
    var favorites = byId('storybook-favorites');
    var container = byId('storybook-doors');
    var editButton = byId('storybook-edit-libraries');
    var emptyState = byId('storybook-empty-state');
    var hint = byId('storybook-home-hint');
    var firstChoice = null;
    var libraries = model && model.libraries ? model.libraries : [];
    var favoriteCards = model && model.favorites ? model.favorites : [];
    var resumeCard = model && model.resume ? model.resume : null;
    var childName = model && model.childName ? model.childName : '';
    var reducedMotion = !!(model && model.reducedMotion);
    var scroller;
    var strip;

    byId('storybook-greeting').textContent = childName ?
      copy.get('storybookGreeting', { child: childName }) :
      copy.get('storybookGreetingWithoutName');
    byId('storybook-resume-title').textContent = sectionTitle(
      'storybookContinueTitle',
      'storybookContinueTitleWithoutName',
      childName
    );
    byId('storybook-favorites-title').textContent = sectionTitle(
      'storybookFavoritesTitle',
      'storybookFavoritesTitleWithoutName',
      childName
    );

    resumeSlot.innerHTML = '';
    favorites.innerHTML = '';
    container.innerHTML = '';

    if (resumeCard) {
      firstChoice = createStoryCard(resumeCard, 'storybook-resume-card', 'resume');
      resumeSlot.appendChild(firstChoice);
      resumeSection.style.display = 'block';
    } else {
      resumeSection.style.display = 'none';
    }

    favoriteCards.forEach(function (item) {
      var card = createStoryCard(item, 'storybook-favorite-card', 'favorite');
      if (!firstChoice) { firstChoice = card; }
      favorites.appendChild(card);
    });
    favoritesSection.style.display = favoriteCards.length ? 'block' : 'none';

    scroller = document.createElement('div');
    scroller.className = 'storybook-door-scroller';
    scroller.scrollLeft = 0;
    container.appendChild(scroller);

    strip = document.createElement('div');
    strip.className = 'storybook-door-strip';
    scroller.appendChild(strip);

    libraries.forEach(function (library) {
      var door = document.createElement('button');
      var label = document.createElement('span');
      var subtitle = document.createElement('span');
      var libraryTitle = library.title || library.name || copy.get('untitled');
      door.id = 'storybook-door-' + library.id;
      door.className = 'storybook-door focusable ' + (library.accentClass || 'storybook-accent-periwinkle');
      door.setAttribute('data-focusable', '');
      door.setAttribute('data-library-id', library.id);
      door.setAttribute(
        'aria-label',
        copy.get('storybookDoorAriaLabel', { library: libraryTitle })
      );
      label.className = 'storybook-door-title';
      label.textContent = libraryTitle;
      door.appendChild(label);
      subtitle.className = 'storybook-door-subtitle';
      subtitle.textContent = library.subtitle || '';
      door.appendChild(subtitle);
      door.addEventListener('focus', function () {
        if (global.MovieDeckAnimations && global.MovieDeckAnimations.focusStorybookDoor) {
          global.MovieDeckAnimations.focusStorybookDoor(door, reducedMotion);
        }
      });
      door.addEventListener('click', function () {
        callbacks.onOpenLibrary(library.id);
      });
      if (!firstChoice) { firstChoice = door; }
      strip.appendChild(door);
    });

    if (hint) {
      hint.style.display = (resumeCard || favoriteCards.length || libraries.length) ? '' : 'none';
    }
    if (emptyState) {
      emptyState.textContent = (resumeCard || favoriteCards.length || libraries.length) ? '' : copy.get('storybookNoSelectedLibraries');
      emptyState.style.display = emptyState.textContent ? 'block' : 'none';
    }
    document.body.classList.toggle(
      'storybook-reduced-motion',
      reducedMotion
    );
    if (global.MovieDeckAnimations) {
      global.MovieDeckAnimations.animateStorybookHome(reducedMotion);
    }
    if (model && model.preferredFocusId && byId(model.preferredFocusId)) {
      focusWhenReady(byId(model.preferredFocusId));
    } else if (firstChoice) {
      focusWhenReady(firstChoice);
    }
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
