(function (global) {
  'use strict';

  var copy = global.RawiCopy;
  var callbacks = {};
  var homeRenderToken = 0;

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

  function focusNow(control) {
    if (!control || typeof control.focus !== 'function') { return; }
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

  function createCategoryButton(model) {
    var button = document.createElement('button');
    var title = document.createElement('span');
    var subtitle = document.createElement('span');

    button.id = 'storybook-category-' + model.key;
    button.className = 'storybook-category-button focusable ' + (model.accentClass || 'storybook-accent-sea');
    button.setAttribute('data-category-key', model.key);
    button.setAttribute('data-focusable', '');
    button.setAttribute('aria-label', copy.get('storybookCategoryAriaLabel', { category: model.title }));

    title.className = 'storybook-category-title';
    title.textContent = model.title;
    subtitle.className = 'storybook-category-subtitle';
    subtitle.textContent = model.caption;

    button.appendChild(title);
    button.appendChild(subtitle);
    button.addEventListener('click', function () {
      if (callbacks.onOpenCategory) {
        callbacks.onOpenCategory(model.key);
      }
    });
    return button;
  }

  function renderHome(model) {
    var resumeSection = byId('storybook-resume-section');
    var resumeSlot = byId('storybook-resume-slot');
    var littleMenuSection = byId('storybook-little-menu-section');
    var littleMenu = byId('storybook-little-menu');
    var favoritesSection = byId('storybook-favorites-section');
    var favorites = byId('storybook-favorites');
    var categorySection = byId('storybook-categories-section');
    var categories = byId('storybook-categories');
    var magicPickHomeSection = byId('storybook-magic-pick-home-section');
    var magicPickButton = byId('storybook-magic-pick-button');
    var container = byId('storybook-doors');
    var editButton = byId('storybook-edit-libraries');
    var emptyState = byId('storybook-empty-state');
    var hint = byId('storybook-home-hint');
    var firstChoice = null;
    var libraries = model && model.libraries ? model.libraries : [];
    var menuCards = model && model.littleMenu ? model.littleMenu : [];
    var favoriteCards = model && model.favorites ? model.favorites : [];
    var resumeCard = model && model.resume ? model.resume : null;
    var childName = model && model.childName ? model.childName : '';
    var reducedMotion = !!(model && model.reducedMotion);
    var focusTarget = null;
    var renderToken = homeRenderToken + 1;
    var categoryButtons = model && model.categories ? model.categories : [];
    var scroller;
    var strip;

    homeRenderToken = renderToken;

    byId('storybook-greeting').textContent = childName ?
      copy.get('storybookGreeting', { child: childName }) :
      copy.get('storybookGreetingWithoutName');
    byId('storybook-resume-title').textContent = sectionTitle(
      'storybookContinueTitle',
      'storybookContinueTitleWithoutName',
      childName
    );
    byId('storybook-little-menu-title').textContent = copy.get('storybookLittleMenuTitle');
    byId('storybook-favorites-title').textContent = sectionTitle(
      'storybookFavoritesTitle',
      'storybookFavoritesTitleWithoutName',
      childName
    );
    byId('storybook-categories-title').textContent = copy.get('storybookCategoriesTitle');

    resumeSlot.innerHTML = '';
    littleMenu.innerHTML = '';
    favorites.innerHTML = '';
    categories.innerHTML = '';
    container.innerHTML = '';
    container.scrollLeft = 0;

    if (resumeCard) {
      firstChoice = createStoryCard(resumeCard, 'storybook-resume-card', 'resume');
      resumeSlot.appendChild(firstChoice);
      resumeSection.style.display = 'block';
    } else {
      resumeSection.style.display = 'none';
    }

    menuCards.forEach(function (item) {
      var card = createStoryCard(item, 'storybook-menu-card', 'menu');
      if (!firstChoice) { firstChoice = card; }
      littleMenu.appendChild(card);
    });
    littleMenuSection.style.display = menuCards.length ? 'block' : 'none';

    favoriteCards.forEach(function (item) {
      var card = createStoryCard(item, 'storybook-favorite-card', 'favorite');
      if (!firstChoice) { firstChoice = card; }
      favorites.appendChild(card);
    });
    favoritesSection.style.display = favoriteCards.length ? 'block' : 'none';

    categoryButtons.forEach(function (category) {
      var button = createCategoryButton(category);
      if (!firstChoice) { firstChoice = button; }
      categories.appendChild(button);
    });
    categorySection.style.display = categoryButtons.length ? 'block' : 'none';
    if (!firstChoice && categoryButtons.length) {
      firstChoice = categories.firstChild;
    }

    if (magicPickHomeSection) {
      magicPickHomeSection.style.display = model && model.showMagicPick ? 'block' : 'none';
    }
    if (!firstChoice && magicPickButton && model && model.showMagicPick) {
      firstChoice = magicPickButton;
    }

    scroller = document.createElement('div');
    scroller.className = 'storybook-door-scroller';
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
    if (model && model.preferredFocusId && byId(model.preferredFocusId)) {
      focusTarget = byId(model.preferredFocusId);
    } else if (firstChoice) {
      focusTarget = firstChoice;
    } else if (editButton) {
      focusTarget = editButton;
    }

    if (global.MovieDeckAnimations && global.MovieDeckAnimations.animateStorybookHome) {
      global.MovieDeckAnimations.animateStorybookHome(reducedMotion, function () {
        if (homeRenderToken !== renderToken) { return; }
        focusNow(focusTarget);
      });
      return;
    }

    if (homeRenderToken === renderToken) {
      focusNow(focusTarget);
    }
  }

  function renderLibrary(model) {
    var container = byId('storybook-library-cards');
    var emptyState = byId('storybook-library-empty');
    var firstCard = null;
    var cards = model && model.cards ? model.cards : [];
    var title = model && model.title ? model.title : '';

    byId('storybook-library-title').textContent = title;
    byId('storybook-library-count').textContent = copy.get('libraryCaption', { count: cards.length });
    container.innerHTML = '';

    cards.forEach(function (cardModel) {
      var card = createStoryCard(cardModel, 'storybook-library-card', 'library');
      card.id = 'storybook-library-card-' + cardModel.id;
      if (!firstCard) { firstCard = card; }
      container.appendChild(card);
    });

    emptyState.textContent = cards.length ? '' : copy.get('storybookLibraryEmpty', { library: title });
    emptyState.style.display = cards.length ? 'none' : 'block';

    if (model && model.preferredFocusId && byId(model.preferredFocusId)) {
      focusWhenReady(byId(model.preferredFocusId));
    } else if (firstCard) {
      focusWhenReady(firstCard);
    } else {
      focusWhenReady(byId('storybook-library-back'));
    }
  }

  function renderDetails(model) {
    var art = byId('storybook-details-art');
    var progress = byId('storybook-details-progress');
    var fill = progress.firstChild;

    art.className = 'storybook-details-art ' + (model.accentClass || 'storybook-accent-periwinkle');
    art.innerHTML = '';
    art.appendChild(createArtwork({
      accentClass: model.accentClass,
      artworkUrl: model.artworkUrl,
      title: model.title
    }, 'storybook-details-artwork'));

    byId('storybook-details-title').textContent = model.title;
    byId('storybook-details-meta').textContent = model.minutesLabel;
    byId('storybook-details-overview').textContent = model.overview;
    byId('storybook-details-resume').textContent = model.resumeLabel;
    byId('storybook-details-play').textContent = model.primaryActionLabel;
    byId('storybook-details-restart').style.display = model.showRestart ? 'inline-block' : 'none';
    progress.style.display = model.progressPercent > 0 ? 'block' : 'none';
    fill.style.width = model.progressPercent + '%';
    focusWhenReady(byId('storybook-details-play'));
  }

  function renderMagicPick(model) {
    var art = byId('storybook-magic-pick-art');

    art.className = 'storybook-details-art ' + (model.accentClass || 'storybook-accent-sea');
    art.innerHTML = '';
    if (model.empty) {
      art.style.display = 'none';
    } else {
      art.style.display = 'block';
      art.appendChild(createArtwork({
        accentClass: model.accentClass,
        artworkUrl: model.artworkUrl,
        title: model.title
      }, 'storybook-details-artwork'));
    }

    byId('storybook-magic-pick-title').textContent = model.title;
    byId('storybook-magic-pick-reason').textContent = model.reason;
    byId('storybook-magic-pick-meta').textContent = model.minutesLabel || '';
    byId('storybook-magic-pick-overview').textContent = model.overview;
    byId('storybook-magic-pick-primary').textContent = model.primaryActionLabel;
    byId('storybook-magic-pick-secondary').textContent = model.secondaryActionLabel;
    focusWhenReady(byId('storybook-magic-pick-primary'));
  }

  function renderEnding(model) {
    byId('storybook-ending-title').textContent = model.childName ?
      copy.get('storybookEndingTitle', { child: model.childName }) :
      copy.get('storybookEndingTitleWithoutName');
    byId('storybook-ending-body').textContent = copy.get('storybookEndingBody', { title: model.title });
    focusWhenReady(byId('storybook-ending-all-done'));
  }

  function parsedIntegerValue(id) {
    var raw = String(byId(id).value || '').trim();
    var parsed = parseInt(raw, 10);
    if (!raw || isNaN(parsed)) {
      return null;
    }
    return parsed;
  }

  function showSettingsValidationError(messageKey, focusId) {
    byId('storybook-settings-error').textContent = copy.get(messageKey);
    focusWhenReady(byId(focusId));
  }

  function renderSettings(libraries, preferences, missingIds, recovery) {
    var container = byId('storybook-library-options');
    var childName = byId('storybook-child-name');
    var reducedMotion = byId('storybook-reduced-motion');
    var soundsEnabled = byId('storybook-sounds-enabled');
    var resetButton = byId('storybook-reset');
    var saveButton = byId('storybook-save');
    var settingsError = byId('storybook-settings-error');
    var settingsWarning = byId('storybook-settings-warning');
    var hasLibraryChoices = false;
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
      checkbox.id = 'storybook-library-input-' + checkbox.value;
      label.setAttribute('for', checkbox.id);
      text.textContent = itemName(library);
      label.className = 'library-option';
      label.appendChild(checkbox);
      label.appendChild(text);
      container.appendChild(label);
    });
    hasLibraryChoices = !!container.children.length;

    childName.value = preferences.childName;
    reducedMotion.checked = preferences.reducedMotion;
    soundsEnabled.checked = preferences.soundsEnabled === true;
    byId('storybook-category-tag-singDance').value = preferences.categoryTags.singDance;
    byId('storybook-category-tag-bedtime').value = preferences.categoryTags.bedtime;
    byId('storybook-category-tag-animals').value = preferences.categoryTags.animals;
    byId('storybook-category-tag-learning').value = preferences.categoryTags.learning;
    byId('storybook-category-tag-movement').value = preferences.categoryTags.movement;
    byId('storybook-duration-labels-enabled').checked = preferences.durationLabels.enabled;
    byId('storybook-duration-quick-max').value = String(preferences.durationLabels.quickMaxMinutes);
    byId('storybook-duration-cozy-max').value = String(preferences.durationLabels.cozyMaxMinutes);
    byId('storybook-recent-history-days').value = String(preferences.recentHistoryDays);

    toggleDisabled(childName, locked);
    toggleDisabled(reducedMotion, locked);
    toggleDisabled(soundsEnabled, locked);
    toggleDisabled(byId('storybook-category-tag-singDance'), locked);
    toggleDisabled(byId('storybook-category-tag-bedtime'), locked);
    toggleDisabled(byId('storybook-category-tag-animals'), locked);
    toggleDisabled(byId('storybook-category-tag-learning'), locked);
    toggleDisabled(byId('storybook-category-tag-movement'), locked);
    toggleDisabled(byId('storybook-duration-labels-enabled'), locked);
    toggleDisabled(byId('storybook-duration-quick-max'), locked);
    toggleDisabled(byId('storybook-duration-cozy-max'), locked);
    toggleDisabled(byId('storybook-recent-history-days'), locked);
    toggleDisabled(saveButton, locked || !hasLibraryChoices);

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
    var quickMaxMinutes;
    var cozyMaxMinutes;
    var recentHistoryDays;
    var quickInvalid;
    var cozyInvalid;

    if (byId('storybook-save').disabled) { return; }
    quickMaxMinutes = parsedIntegerValue('storybook-duration-quick-max');
    cozyMaxMinutes = parsedIntegerValue('storybook-duration-cozy-max');
    recentHistoryDays = parsedIntegerValue('storybook-recent-history-days');
    byId('storybook-settings-error').textContent = '';
    quickInvalid = quickMaxMinutes === null || quickMaxMinutes < 1 || quickMaxMinutes > 240;
    cozyInvalid = cozyMaxMinutes === null || cozyMaxMinutes > 240 ||
      (quickMaxMinutes !== null && cozyMaxMinutes !== null && cozyMaxMinutes < quickMaxMinutes);
    if (quickInvalid || cozyInvalid) {
      showSettingsValidationError(
        'storybookDurationThresholdError',
        quickInvalid ? 'storybook-duration-quick-max' : 'storybook-duration-cozy-max'
      );
      return;
    }
    if (recentHistoryDays === null || recentHistoryDays < 0 || recentHistoryDays > 365) {
      showSettingsValidationError('storybookRecentHistoryDaysError', 'storybook-recent-history-days');
      return;
    }
    preferences = {
      enabled: true,
      childName: byId('storybook-child-name').value,
      libraryIds: selectedLibraryIds(),
      categoryTags: {
        singDance: byId('storybook-category-tag-singDance').value,
        bedtime: byId('storybook-category-tag-bedtime').value,
        animals: byId('storybook-category-tag-animals').value,
        learning: byId('storybook-category-tag-learning').value,
        movement: byId('storybook-category-tag-movement').value
      },
      durationLabels: {
        enabled: byId('storybook-duration-labels-enabled').checked,
        quickMaxMinutes: quickMaxMinutes,
        cozyMaxMinutes: cozyMaxMinutes
      },
      recentHistoryDays: recentHistoryDays,
      reducedMotion: byId('storybook-reduced-motion').checked,
      soundsEnabled: byId('storybook-sounds-enabled').checked
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
        callbacks.onModeChange(button.getAttribute('data-mode'), button.id);
      });
    });
    byId('storybook-settings-button').addEventListener('click', function () {
      callbacks.onOpenSettings('storybook-settings-button');
    });
    byId('storybook-edit-libraries').addEventListener('click', function () {
      callbacks.onOpenSettings('storybook-edit-libraries');
    });
    byId('storybook-details-back').addEventListener('click', callbacks.onCloseStorybookDetails);
    byId('storybook-details-play').addEventListener('click', function () {
      callbacks.onStartStorybookPlayback(false);
    });
    byId('storybook-details-restart').addEventListener('click', function () {
      callbacks.onStartStorybookPlayback(true);
    });
    byId('storybook-magic-pick-button').addEventListener('click', callbacks.onOpenMagicPick);
    byId('storybook-magic-pick-back').addEventListener('click', callbacks.onCloseMagicPick);
    byId('storybook-magic-pick-primary').addEventListener('click', callbacks.onMagicPickPrimary);
    byId('storybook-magic-pick-secondary').addEventListener('click', callbacks.onMagicPickSecondary);
    byId('storybook-ending-all-done').addEventListener('click', function () {
      callbacks.onStorybookEndingAction('done');
    });
    byId('storybook-ending-pick-another').addEventListener('click', function () {
      callbacks.onStorybookEndingAction('pick');
    });
    byId('storybook-library-back').addEventListener('click', callbacks.onCloseStorybookLibrary);
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
    renderDetails: renderDetails,
    renderEnding: renderEnding,
    renderHome: renderHome,
    renderLibrary: renderLibrary,
    renderMagicPick: renderMagicPick,
    renderSettings: renderSettings,
    setMode: setMode
  };
}(window));
