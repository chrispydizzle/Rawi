# Storybook Mode Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted Adult/Storybook mode toggle, parent-selected Jellyfin libraries, and the approved Whimsical Watercolor Storybook shell without changing Adult Mode behavior.

**Architecture:** Authentication, Jellyfin queries, playback, and normalized item data remain shared. A new versioned Storybook preference module owns mode and library selection, a pure Storybook model derives visible libraries, and a dedicated Storybook renderer owns mode-specific DOM and styling beneath a scoped `mode-storybook` class.

**Tech Stack:** ES5-compatible JavaScript, HTML5, CSS3, GSAP 3, Jellyfin HTTP API, Samsung Tizen 3.0 web runtime, `localStorage`, optional `tizen.preference`, Node.js built-in `assert` and `vm` for tests.

## Global Constraints

- Preserve application ID `JfMovieTV1.MovieDeck`, package ID `JfMovieTV1`, and existing `moviedeck.*` session keys.
- Keep runtime JavaScript compatible with the Samsung Tizen 3.0 browser; do not add `const`, `let`, arrow functions, classes, optional chaining, or new runtime dependencies.
- Adult Mode must retain its current layout, copy, navigation, authentication, and playback behavior.
- Storybook Mode is parent-guided curation, not a parental-security boundary; Jellyfin permissions remain authoritative.
- The mode toggle is visible and unrestricted on browsing and details screens, but unavailable during playback.
- Storybook Mode must never automatically start another video.
- Scope Storybook CSS under `body.mode-storybook` or `.storybook-screen`; do not globally restyle Adult Mode selectors.
- Recurring Storybook motion must affect no more than three visible elements and use only transforms or opacity.
- Respect both `prefers-reduced-motion` and the Storybook `reducedMotion` preference.
- Do not commit `MovieDeck/config/copy-overrides.js`; it contains installation-specific personalization and is intentionally ignored.
- The current worktree contains approved but uncommitted runtime-badge and copy-override work. Preserve it exactly. Before using an isolated worktree, checkpoint those approved changes on the current branch; otherwise execute this plan inline in the current checkout.
- Do not deploy to the physical TV until the package-only validation and browser-preview acceptance checks pass.

---

## Planned File Structure

| File | Responsibility |
|---|---|
| `MovieDeck/js/storage.js` | Shared `localStorage` and Tizen Preference API access |
| `MovieDeck/js/storybook-preferences.js` | Versioned Storybook defaults, normalization, restore, and save |
| `MovieDeck/js/storybook-model.js` | Pure derivation of selected and missing Storybook libraries |
| `MovieDeck/js/storybook-view.js` | Storybook home, settings panel, focus behavior, and mode shell |
| `MovieDeck/js/preview-fixtures.js` | Deterministic local Storybook preview data |
| `MovieDeck/css/storybook.css` | Whimsical Watercolor tokens and mode-scoped presentation |
| `MovieDeck/tests/run-tests.js` | Dependency-free Node test runner |
| `MovieDeck/tests/storage.test.js` | Storage fallback and error behavior |
| `MovieDeck/tests/storybook-preferences.test.js` | Preference defaults, migration, and persistence |
| `MovieDeck/tests/storybook-model.test.js` | Selected-library filtering and missing-library derivation |
| `MovieDeck/tests/copy.test.js` | Copy fallback and Storybook placeholder coverage |
| `MovieDeck/index.html` | Mode toggle, Storybook screen, and settings DOM |
| `MovieDeck/js/api.js` | Consume shared storage rather than private duplicate helpers |
| `MovieDeck/js/copy.js` | Add complete Storybook Phase 1 copy defaults |
| `MovieDeck/js/animations.js` | Add bounded Storybook entrance and door motion |
| `MovieDeck/js/app.js` | Orchestrate mode state and shared catalogue loading |
| `MovieDeck/css/app.css` | Adult-safe toggle and settings-panel primitives |
| `tools/Start-RawiPreview.ps1` | Add deterministic `-StorybookMock` preview option |
| `README.md` | Document Storybook setup, mock preview, and curation boundary |

---

### Task 1: Shared Storage Boundary

**Files:**
- Create: `MovieDeck/js/storage.js`
- Create: `MovieDeck/tests/run-tests.js`
- Create: `MovieDeck/tests/storage.test.js`
- Modify: `MovieDeck/index.html:108-116`
- Modify: `MovieDeck/js/api.js:1-101`

**Interfaces:**
- Produces: `window.RawiStorage.get(key) -> string|null`
- Produces: `window.RawiStorage.set(key, value) -> void`
- Produces: `window.RawiStorage.remove(key) -> void`
- Consumes: browser `localStorage`
- Consumes: optional `window.tizen.preference`

- [ ] **Step 1: Write the storage tests**

Create `MovieDeck/tests/run-tests.js`:

```javascript
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function loadBrowserScript(relativePath, additions) {
  var values = additions || {};
  var context = {
    console: console,
    window: values.window || {},
    localStorage: values.localStorage,
    document: values.document
  };
  context.window.window = context.window;
  context.window.localStorage = context.localStorage;
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'),
    context,
    { filename: relativePath }
  );
  return context.window;
}

global.RawiTest = {
  assert: require('assert'),
  loadBrowserScript: loadBrowserScript
};

[
  'storage.test.js',
  'storybook-preferences.test.js',
  'storybook-model.test.js',
  'copy.test.js'
].forEach(function (file) {
  var fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) { require(fullPath); }
});

console.log('All Rawi tests passed.');
```

Create `MovieDeck/tests/storage.test.js`:

```javascript
'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;

function memoryStorage() {
  var values = {};
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem: function (key, value) { values[key] = String(value); },
    removeItem: function (key) { delete values[key]; }
  };
}

(function localStorageIsAuthoritative() {
  var local = memoryStorage();
  local.setItem('key', 'local');
  var preferenceReads = 0;
  var window = load('js/storage.js', {
    localStorage: local,
    window: {
      tizen: {
        preference: {
          exists: function () { preferenceReads += 1; return true; },
          getValue: function () { return 'preference'; }
        }
      }
    }
  });

  assert.strictEqual(window.RawiStorage.get('key'), 'local');
  assert.strictEqual(preferenceReads, 0);
}());

(function preferenceValueMirrorsToLocalStorage() {
  var local = memoryStorage();
  var window = load('js/storage.js', {
    localStorage: local,
    window: {
      tizen: {
        preference: {
          exists: function () { return true; },
          getValue: function () { return 'from-tv'; },
          setValue: function () {}
        }
      }
    }
  });

  assert.strictEqual(window.RawiStorage.get('key'), 'from-tv');
  assert.strictEqual(local.getItem('key'), 'from-tv');
}());

(function optionalPreferenceFailureDoesNotLoseLocalValue() {
  var local = memoryStorage();
  var window = load('js/storage.js', {
    localStorage: local,
    window: {
      tizen: {
        preference: {
          setValue: function () { throw new Error('unavailable'); },
          exists: function () { throw new Error('unavailable'); }
        }
      }
    }
  });

  window.RawiStorage.set('key', 'saved');
  assert.strictEqual(local.getItem('key'), 'saved');
  window.RawiStorage.remove('key');
  assert.strictEqual(local.getItem('key'), null);
}());
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js
```

Expected: failure while loading `js/storage.js` because the file does not exist.

- [ ] **Step 3: Implement shared storage**

Create `MovieDeck/js/storage.js`:

```javascript
(function (global) {
  'use strict';

  function preferenceAvailable() {
    return !!(global.tizen && global.tizen.preference);
  }

  function get(key) {
    var stored = global.localStorage.getItem(key);
    if (stored !== null) { return stored; }
    if (!preferenceAvailable()) { return null; }
    try {
      if (!global.tizen.preference.exists(key)) { return null; }
      stored = String(global.tizen.preference.getValue(key));
      global.localStorage.setItem(key, stored);
      return stored;
    } catch (error) {
      return null;
    }
  }

  function set(key, stored) {
    global.localStorage.setItem(key, stored);
    if (!preferenceAvailable()) { return; }
    try {
      global.tizen.preference.setValue(key, stored);
    } catch (error) {
      // localStorage remains authoritative when the optional TV store fails.
    }
  }

  function remove(key) {
    global.localStorage.removeItem(key);
    if (!preferenceAvailable()) { return; }
    try {
      if (global.tizen.preference.exists(key)) {
        global.tizen.preference.remove(key);
      }
    } catch (error) {
      // The optional TV store may be unavailable on older firmware.
    }
  }

  global.RawiStorage = {
    get: get,
    remove: remove,
    set: set
  };
}(window));
```

In `MovieDeck/index.html`, load storage before the API:

```html
<script src="config/copy-overrides.js"></script>
<script src="js/copy.js"></script>
<script src="js/storage.js"></script>
<script src="js/vendor/gsap.min.js"></script>
<script src="js/animations.js"></script>
<script src="js/api.js"></script>
```

In `MovieDeck/js/api.js`, add:

```javascript
var storage = global.RawiStorage;
```

Delete `preferenceAvailable`, `storedValue`, `storeValue`, and
`removeStoredValue`. Replace their call sites exactly:

```javascript
var id = storage.get(DEVICE_ID_KEY);
storage.set(DEVICE_ID_KEY, id);
var session = JSON.parse(storage.get(STORAGE_KEY));
storage.remove(STORAGE_KEY);
storage.set(STORAGE_KEY, JSON.stringify({
  server: this.server,
  token: this.token,
  user: this.user
}));
```

- [ ] **Step 4: Run storage and syntax checks**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js
Get-ChildItem .\MovieDeck\js\*.js | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Expected: `All Rawi tests passed.` and no syntax errors.

- [ ] **Step 5: Commit the storage boundary**

```powershell
git add MovieDeck\index.html MovieDeck\js\api.js MovieDeck\js\storage.js MovieDeck\tests
git commit -m "refactor: share Tizen preference storage" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Versioned Storybook Preferences and Library Model

**Files:**
- Create: `MovieDeck/js/storybook-preferences.js`
- Create: `MovieDeck/js/storybook-model.js`
- Create: `MovieDeck/tests/storybook-preferences.test.js`
- Create: `MovieDeck/tests/storybook-model.test.js`
- Modify: `MovieDeck/index.html:108-116`

**Interfaces:**
- Consumes: `RawiStorage.get/set/remove`
- Produces: `RawiStorybookPreferences.defaults() -> preference object`
- Produces: `RawiStorybookPreferences.restore() -> preference object`
- Produces: `RawiStorybookPreferences.save(preferences) -> normalized preference object`
- Produces: `RawiStorybookModel.resolveLibraries(libraries, selectedIds) -> {selected, missingIds}`
- Produces: `RawiStorybookModel.isReducedMotion(preferences, mediaQueryMatches) -> boolean`

- [ ] **Step 1: Write failing preference tests**

Create `MovieDeck/tests/storybook-preferences.test.js`:

```javascript
'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;

function loadPreferences(stored) {
  var saved = null;
  var window = load('js/storybook-preferences.js', {
    window: {
      RawiStorage: {
        get: function () { return stored; },
        set: function (key, value) { saved = { key: key, value: value }; }
      }
    }
  });
  return { api: window.RawiStorybookPreferences, saved: function () { return saved; } };
}

(function missingPreferencesUseSafeDefaults() {
  var result = loadPreferences(null).api.restore();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
    version: 1,
    enabled: false,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    reducedMotion: false
  });
}());

(function validPreferencesAreNormalized() {
  var result = loadPreferences(JSON.stringify({
    version: 1,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['pixar', 'pixar', 42],
    reducedMotion: true,
    ignored: 'value'
  })).api.restore();

  assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
    version: 1,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['pixar'],
    reducedMotion: true
  });
}());

(function unsupportedVersionUsesDefaultsWithoutOverwritingStorage() {
  var harness = loadPreferences(JSON.stringify({ version: 99, enabled: true }));
  assert.strictEqual(harness.api.restore().enabled, false);
  assert.strictEqual(harness.saved(), null);
}());

(function saveWritesNormalizedVersionedData() {
  var harness = loadPreferences(null);
  var result = harness.api.save({
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['one'],
    reducedMotion: false
  });
  assert.strictEqual(harness.saved().key, 'rawi.storybook.preferences');
  assert.deepStrictEqual(JSON.parse(harness.saved().value), result);
}());
```

Create `MovieDeck/tests/storybook-model.test.js`:

```javascript
'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var model = load('js/storybook-model.js', { window: {} }).RawiStorybookModel;

(function resolvesSelectedLibrariesInServerOrder() {
  var result = model.resolveLibraries([
    { Id: 'a', Name: 'Alpha' },
    { Id: 'b', Name: 'Beta' },
    { Id: 'c', Name: 'Gamma' }
  ], ['c', 'a']);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(result.selected.map(function (item) { return item.Id; }))),
    ['a', 'c']
  );
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.missingIds)), []);
}());

(function identifiesInaccessibleSavedLibraries() {
  var result = model.resolveLibraries([{ Id: 'a' }], ['a', 'missing']);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(result.missingIds)),
    ['missing']
  );
}());

(function reducedMotionUsesEitherSource() {
  assert.strictEqual(model.isReducedMotion({ reducedMotion: false }, true), true);
  assert.strictEqual(model.isReducedMotion({ reducedMotion: true }, false), true);
  assert.strictEqual(model.isReducedMotion({ reducedMotion: false }, false), false);
}());
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js
```

Expected: failure because `storybook-preferences.js` or
`storybook-model.js` does not exist.

- [ ] **Step 3: Implement Storybook preferences**

Create `MovieDeck/js/storybook-preferences.js`:

```javascript
(function (global) {
  'use strict';

  var KEY = 'rawi.storybook.preferences';
  var VERSION = 1;
  var storage = global.RawiStorage;

  function defaults() {
    return {
      version: VERSION,
      enabled: false,
      lastMode: 'adult',
      childName: '',
      libraryIds: [],
      reducedMotion: false
    };
  }

  function normalize(input) {
    var source = input || {};
    var seen = {};
    var libraryIds = [];
    (Array.isArray(source.libraryIds) ? source.libraryIds : []).forEach(function (id) {
      if (typeof id !== 'string' || !id || seen[id]) { return; }
      seen[id] = true;
      libraryIds.push(id);
    });
    return {
      version: VERSION,
      enabled: source.enabled === true,
      lastMode: source.lastMode === 'storybook' ? 'storybook' : 'adult',
      childName: typeof source.childName === 'string' ? source.childName.trim() : '',
      libraryIds: libraryIds,
      reducedMotion: source.reducedMotion === true
    };
  }

  function restore() {
    var stored = storage.get(KEY);
    var parsed;
    if (!stored) { return defaults(); }
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      return defaults();
    }
    if (!parsed || parsed.version !== VERSION) { return defaults(); }
    return normalize(parsed);
  }

  function save(preferences) {
    var normalized = normalize(preferences);
    storage.set(KEY, JSON.stringify(normalized));
    return normalized;
  }

  global.RawiStorybookPreferences = {
    defaults: defaults,
    restore: restore,
    save: save
  };
}(window));
```

- [ ] **Step 4: Implement pure Storybook model**

Create `MovieDeck/js/storybook-model.js`:

```javascript
(function (global) {
  'use strict';

  function idOf(item) {
    if (!item) { return ''; }
    return item.Id !== undefined ? item.Id : item.id;
  }

  function resolveLibraries(libraries, selectedIds) {
    var selectedMap = {};
    var availableMap = {};
    var selected = [];
    var missingIds = [];

    (selectedIds || []).forEach(function (id) { selectedMap[id] = true; });
    (libraries || []).forEach(function (library) {
      var id = idOf(library);
      availableMap[id] = true;
      if (selectedMap[id]) { selected.push(library); }
    });
    (selectedIds || []).forEach(function (id) {
      if (!availableMap[id]) { missingIds.push(id); }
    });
    return { selected: selected, missingIds: missingIds };
  }

  function isReducedMotion(preferences, mediaQueryMatches) {
    return !!(preferences && preferences.reducedMotion) || !!mediaQueryMatches;
  }

  global.RawiStorybookModel = {
    isReducedMotion: isReducedMotion,
    resolveLibraries: resolveLibraries
  };
}(window));
```

Load the modules in `MovieDeck/index.html` after `storage.js` and before
`app.js`:

```html
<script src="js/storybook-preferences.js"></script>
<script src="js/storybook-model.js"></script>
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js
```

Expected: `All Rawi tests passed.`

- [ ] **Step 6: Commit preferences and model**

```powershell
git add MovieDeck\index.html MovieDeck\js\storybook-preferences.js MovieDeck\js\storybook-model.js MovieDeck\tests
git commit -m "feat: add Storybook preferences and library model" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Mode Toggle and Parent Library Settings

**Files:**
- Create: `MovieDeck/js/storybook-view.js`
- Modify: `MovieDeck/index.html:43-105`
- Modify: `MovieDeck/js/app.js:1-420`
- Modify: `MovieDeck/js/copy.js:4-76`
- Modify: `MovieDeck/css/app.css:105-180`

**Interfaces:**
- Consumes: `RawiStorybookPreferences.restore/save`
- Consumes: `RawiStorybookModel.resolveLibraries`
- Consumes: `ApiClient.getLibraries()`
- Produces: `RawiStorybookView.init(options)`
- Produces callback: `options.onModeChange(mode)`
- Produces callback: `options.onPreferencesChange(preferences)`
- Produces: `RawiStorybookView.renderSettings(libraries, preferences, missingIds)`
- Produces: `RawiStorybookView.setMode(mode)`

- [ ] **Step 1: Add Storybook copy defaults**

Append these exact keys to the `defaults` object in `MovieDeck/js/copy.js`:

```javascript
modeAdult: 'Adult',
modeStorybook: 'Storybook',
storybookSettingsButton: 'Storybook settings',
storybookSettingsTitle: 'Set up Storybook Mode',
storybookSettingsIntro: 'Choose the libraries that belong in Storybook Mode.',
storybookChildNameLabel: "Child's name",
storybookLibrariesLabel: 'Visible libraries',
storybookReducedMotionLabel: 'Use less motion',
storybookSaveButton: 'Save Storybook settings',
storybookCancelButton: 'Cancel',
storybookNoLibraries: 'Choose at least one library for Storybook Mode.',
storybookMissingLibrary: 'A previously selected library is no longer available.',
storybookSettingsSaved: 'Storybook settings saved.',
storybookSetupRequired: 'Choose Storybook libraries before opening this mode.'
```

- [ ] **Step 2: Add mode and settings markup**

Inside `.topbar-actions` in `MovieDeck/index.html`, before the clock, add:

```html
<div id="mode-toggle" class="mode-toggle" role="group" aria-label="Display mode">
  <button id="adult-mode-button"
          class="mode-option focusable"
          data-focusable
          data-mode="adult"
          data-copy="modeAdult">Adult</button>
  <button id="storybook-mode-button"
          class="mode-option focusable"
          data-focusable
          data-mode="storybook"
          data-copy="modeStorybook">Storybook</button>
</div>
```

Add the same visible toggle near `details-back` on `details-screen`, using
unique IDs but the same `data-mode` values:

```html
<div class="details-mode-toggle mode-toggle" role="group" aria-label="Display mode">
  <button id="details-adult-mode-button"
          class="mode-option focusable"
          data-focusable
          data-mode="adult"
          data-copy="modeAdult">Adult</button>
  <button id="details-storybook-mode-button"
          class="mode-option focusable"
          data-focusable
          data-mode="storybook"
          data-copy="modeStorybook">Storybook</button>
</div>
```

Add the Storybook settings button after the profile button:

```html
<button id="storybook-settings-button"
        class="icon-button focusable"
        data-focusable
        data-copy-aria-label="storybookSettingsButton"
        aria-label="Storybook settings">✦</button>
```

Add this screen before `player-screen`:

```html
<section id="storybook-settings-screen"
         class="screen settings-screen"
         aria-labelledby="storybook-settings-title">
  <div class="settings-panel">
    <p class="kicker" data-copy="modeStorybook">Storybook</p>
    <h1 id="storybook-settings-title" data-copy="storybookSettingsTitle">Set up Storybook Mode</h1>
    <p data-copy="storybookSettingsIntro">Choose the libraries that belong in Storybook Mode.</p>
    <label for="storybook-child-name" data-copy="storybookChildNameLabel">Child's name</label>
    <input id="storybook-child-name" class="focusable" data-focusable type="text" maxlength="30">
    <fieldset>
      <legend data-copy="storybookLibrariesLabel">Visible libraries</legend>
      <div id="storybook-library-options"></div>
    </fieldset>
    <label class="settings-check">
      <input id="storybook-reduced-motion" class="focusable" data-focusable type="checkbox">
      <span data-copy="storybookReducedMotionLabel">Use less motion</span>
    </label>
    <p id="storybook-settings-error" class="inline-error" role="alert"></p>
    <div class="settings-actions">
      <button id="storybook-save"
              class="button button-primary focusable"
              data-focusable
              data-copy="storybookSaveButton">Save Storybook settings</button>
      <button id="storybook-cancel"
              class="button button-secondary focusable"
              data-focusable
              data-copy="storybookCancelButton">Cancel</button>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Implement the settings and mode view**

Create `MovieDeck/js/storybook-view.js`:

```javascript
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
```

Load it before `app.js`:

```html
<script src="js/storybook-view.js"></script>
<script src="js/app.js"></script>
```

- [ ] **Step 4: Add Adult-safe control styling**

Append to `MovieDeck/css/app.css`:

```css
.mode-toggle {
  background: rgba(255,255,255,.08);
  border-radius: 24px;
  display: flex;
  padding: 3px;
}
.mode-option {
  background: transparent;
  border: 0;
  border-radius: 20px;
  color: #98a7b2;
  font-size: 15px;
  font-weight: 800;
  padding: 9px 14px;
}
.mode-option.is-active { background: #efa451; color: #17202a; }
.details-mode-toggle { position: absolute; right: 65px; top: 38px; z-index: 3; }
.settings-screen { background: #09131d; }
.settings-panel {
  left: 50%;
  max-height: 900px;
  overflow-y: auto;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 1180px;
}
.settings-panel h1 { font-size: 58px; margin: 0 0 16px; }
.settings-panel > label, .settings-panel legend {
  display: block;
  font-size: 18px;
  font-weight: 800;
  margin: 28px 0 12px;
}
.settings-panel input[type="text"] {
  background: #f6f7f8;
  border-radius: 4px;
  color: #15212a;
  padding: 14px 18px;
  width: 520px;
}
.settings-panel fieldset { border: 0; margin: 0; padding: 0; }
#storybook-library-options { display: flex; flex-wrap: wrap; gap: 14px; }
.library-option {
  align-items: center;
  background: rgba(255,255,255,.08);
  border-radius: 6px;
  display: flex;
  min-width: 300px;
  padding: 14px 18px;
}
.library-option input { height: 24px; margin-right: 12px; width: 24px; }
.settings-check { align-items: center; display: flex !important; }
.settings-check input { height: 24px; margin-right: 12px; width: 24px; }
.settings-actions { display: flex; gap: 16px; margin-top: 30px; }
```

- [ ] **Step 5: Wire mode state in `app.js`**

At the top of `MovieDeck/js/app.js`, add:

```javascript
var storybookModel = global.RawiStorybookModel;
var storybookPreferences = global.RawiStorybookPreferences;
var storybookView = global.RawiStorybookView;
var storybookState = storybookPreferences.restore();
var availableLibraries = [];
var previousScreen = 'browse-screen';
```

Add these functions before `registerEvents`:

```javascript
function applyMode(mode) {
  var nextMode = mode === 'storybook' ? 'storybook' : 'adult';
  if (nextMode === 'storybook' && !storybookState.libraryIds.length) {
    text('toast', copy.get('storybookSetupRequired'));
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
  showScreen(previousScreen, 'storybook-settings-button');
}
```

Initialize the view at the start of `init()`:

```javascript
storybookView.init({
  onCancelSettings: cancelStorybookSettings,
  onModeChange: applyMode,
  onOpenSettings: openStorybookSettings,
  onPreferencesChange: saveStorybookSettings
});
storybookView.setMode(storybookState.lastMode);
```

Change library loading so `availableLibraries` is always retained:

```javascript
var libraryGroups = api.getLibraries().then(function (libraries) {
  availableLibraries = libraries;
  return Promise.all(libraries.map(function (library) {
    return api.getVideos(itemId(library)).then(function (videos) {
      return { id: itemId(library), name: name(library), videos: videos };
    }).catch(function () {
      return { id: itemId(library), name: name(library), videos: [] };
    });
  }));
});
```

Extend `handleBack()`:

```javascript
if (activeScreen === 'storybook-settings-screen') {
  cancelStorybookSettings();
  return;
}
```

- [ ] **Step 6: Verify mode/settings behavior locally**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js
.\tools\Start-RawiPreview.ps1
```

Expected browser behavior:

1. Adult Mode renders exactly as before.
2. Selecting Storybook with no saved libraries opens settings.
3. Saving no libraries shows the configured validation message.
4. Saving selected libraries returns to browsing.
5. Reloading restores the last mode and selected library IDs.
6. Back exits settings without changing saved preferences.

- [ ] **Step 7: Commit mode and settings**

```powershell
git add MovieDeck\index.html MovieDeck\css\app.css MovieDeck\js\app.js MovieDeck\js\copy.js MovieDeck\js\storybook-view.js
git commit -m "feat: add Storybook mode settings" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Whimsical Watercolor Storybook Shell

**Files:**
- Create: `MovieDeck/css/storybook.css`
- Modify: `MovieDeck/index.html:43-74`
- Modify: `MovieDeck/js/storybook-view.js`
- Modify: `MovieDeck/js/app.js:180-270`
- Modify: `MovieDeck/js/copy.js`
- Modify: `MovieDeck/js/animations.js`

**Interfaces:**
- Consumes: resolved selected libraries from `RawiStorybookModel`
- Consumes: library groups shaped as `{id, name, videos}`
- Produces: `RawiStorybookView.renderHome({childName, libraries})`
- Produces callback: `options.onOpenLibrary(libraryId)`
- Produces: `MovieDeckAnimations.animateStorybookHome(reducedMotion)`

- [ ] **Step 1: Add Phase 1 Storybook home copy**

Add to `MovieDeck/js/copy.js`:

```javascript
storybookGreeting: 'What should we watch tonight, {child}?',
storybookGreetingWithoutName: 'What should we watch tonight?',
storybookHomeHint: 'Pick a story door.',
storybookDoorAriaLabel: 'Open {library}',
storybookNoSelectedLibraries: 'No Storybook libraries are available.',
storybookEditLibrariesButton: 'Choose libraries'
```

- [ ] **Step 2: Add Storybook screen markup and stylesheet**

Add to `MovieDeck/index.html` after `browse-screen`:

```html
<section id="storybook-screen"
         class="screen storybook-screen"
         aria-labelledby="storybook-greeting">
  <div class="storybook-sky" aria-hidden="true">
    <span class="storybook-moon"></span>
    <span class="storybook-star star-one">✦</span>
    <span class="storybook-star star-two">✧</span>
    <span class="storybook-star star-three">✦</span>
  </div>
  <header class="storybook-topbar">
    <div class="storybook-wordmark"><i>/</i> <span data-copy="appName">Rawi</span></div>
    <div class="mode-toggle" role="group" aria-label="Display mode">
      <button id="storybook-home-adult-mode-button"
              class="mode-option focusable"
              data-focusable
              data-mode="adult"
              data-copy="modeAdult">Adult</button>
      <button id="storybook-home-storybook-mode-button"
              class="mode-option focusable"
              data-focusable
              data-mode="storybook"
              data-copy="modeStorybook">Storybook</button>
    </div>
  </header>
  <div class="storybook-copy">
    <h1 id="storybook-greeting"></h1>
    <p data-copy="storybookHomeHint">Pick a story door.</p>
  </div>
  <div id="storybook-doors" class="storybook-doors"></div>
  <button id="storybook-edit-libraries"
          class="storybook-edit focusable"
          data-focusable
          data-copy="storybookEditLibrariesButton">Choose libraries</button>
</section>
```

Load the stylesheet after `app.css`:

```html
<link rel="stylesheet" href="css/app.css">
<link rel="stylesheet" href="css/storybook.css">
```

- [ ] **Step 3: Implement the scoped Storybook design**

Create `MovieDeck/css/storybook.css`:

```css
body.mode-storybook {
  --storybook-ink: #fff8df;
  --storybook-muted: #bbc7df;
  --storybook-gold: #f2cf7c;
  --storybook-indigo: #172543;
  --storybook-periwinkle: #657db9;
  --storybook-sea: #4f8987;
  --storybook-coral: #a96578;
}

.storybook-screen {
  background:
    radial-gradient(circle at 78% 12%, rgba(248,210,124,.23), transparent 18%),
    radial-gradient(circle at 15% 86%, rgba(129,191,187,.17), transparent 28%),
    linear-gradient(145deg, #202c58 0%, var(--storybook-indigo) 46%, #101b35 100%);
  color: var(--storybook-ink);
}
.storybook-screen::before {
  background: rgba(255,255,255,.045);
  border-radius: 49% 51% 47% 53% / 62% 44% 56% 38%;
  content: "";
  height: 760px;
  left: -140px;
  position: absolute;
  top: 300px;
  transform: rotate(-8deg);
  width: 1420px;
}
.storybook-sky { inset: 0; pointer-events: none; position: absolute; }
.storybook-moon {
  background: var(--storybook-gold);
  border-radius: 50%;
  box-shadow: 0 0 70px rgba(243,206,120,.27);
  height: 155px;
  position: absolute;
  right: 115px;
  top: 74px;
  width: 155px;
}
.storybook-moon::after {
  background: #1e2a50;
  border-radius: 50%;
  content: "";
  height: 145px;
  left: -28px;
  position: absolute;
  top: -20px;
  width: 145px;
}
.storybook-star { color: var(--storybook-gold); position: absolute; }
.star-one { font-size: 32px; right: 325px; top: 92px; }
.star-two { font-size: 22px; right: 70px; top: 270px; }
.star-three { font-size: 20px; left: 52%; top: 125px; }
.storybook-topbar {
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 38px 68px;
  position: relative;
  z-index: 3;
}
.storybook-wordmark {
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 29px;
  font-weight: 900;
  transform: rotate(-3deg);
}
.storybook-wordmark i { color: var(--storybook-gold); font-style: normal; }
.storybook-copy {
  left: 95px;
  position: absolute;
  top: 175px;
  z-index: 2;
}
.storybook-copy h1 {
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 62px;
  line-height: 1.16;
  margin: 0 0 12px;
  max-width: 1100px;
  transform: rotate(-1.5deg);
}
.storybook-copy p { color: var(--storybook-muted); font-size: 22px; }
.storybook-doors {
  align-items: flex-end;
  bottom: 125px;
  display: flex;
  gap: 45px;
  left: 95px;
  position: absolute;
  z-index: 2;
}
.storybook-door {
  align-items: flex-end;
  border: 6px solid rgba(255,255,255,.18);
  box-shadow: 0 18px 45px rgba(4,9,22,.32), inset 0 -60px 60px rgba(0,0,0,.18);
  display: flex;
  flex: 0 0 270px;
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 28px;
  font-weight: 900;
  height: 390px;
  justify-content: center;
  padding: 0 24px 45px;
  position: relative;
  text-align: center;
}
.storybook-door::after {
  background: var(--storybook-gold);
  border-radius: 50%;
  content: "";
  height: 13px;
  position: absolute;
  right: 30px;
  top: 210px;
  width: 13px;
}
.storybook-door:nth-child(3n+1) {
  background: linear-gradient(#8297cf, #536da8);
  border-radius: 53% 47% 24px 30px / 41% 45% 22px 25px;
  transform: rotate(2deg) translateY(-16px);
}
.storybook-door:nth-child(3n+2) {
  background: linear-gradient(#72aaa5, #3f7779);
  border-radius: 47% 53% 30px 22px / 45% 40% 24px 22px;
  transform: rotate(-2deg) translateY(16px);
}
.storybook-door:nth-child(3n) {
  background: linear-gradient(#c88283, #8f596f);
  border-radius: 56% 44% 22px 32px / 38% 48% 22px 25px;
  transform: rotate(3deg) translateY(-8px);
}
.storybook-door:focus {
  box-shadow: 0 0 0 7px var(--storybook-gold), 0 24px 55px rgba(4,9,22,.5);
  outline: 0;
}
.storybook-edit {
  background: rgba(113,151,197,.3);
  border: 2px solid rgba(255,255,255,.22);
  border-radius: 30px 18px 28px 20px;
  bottom: 40px;
  color: var(--storybook-ink);
  font-size: 17px;
  font-weight: 900;
  padding: 13px 20px;
  position: absolute;
  right: 55px;
  z-index: 3;
}
body.mode-storybook.storybook-reduced-motion .storybook-door {
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .storybook-door { animation: none !important; }
}
```

- [ ] **Step 4: Render Story Doors**

Extend `MovieDeck/js/storybook-view.js`:

```javascript
function renderHome(model) {
  var container = byId('storybook-doors');
  var greeting = model.childName ?
    copy.get('storybookGreeting', { child: model.childName }) :
    copy.get('storybookGreetingWithoutName');
  byId('storybook-greeting').textContent = greeting;
  container.innerHTML = '';

  model.libraries.slice(0, 5).forEach(function (library) {
    var door = document.createElement('button');
    door.className = 'storybook-door focusable';
    door.setAttribute('data-focusable', '');
    door.setAttribute('data-library-id', library.id);
    door.setAttribute(
      'aria-label',
      copy.get('storybookDoorAriaLabel', { library: library.name })
    );
    door.textContent = library.name;
    door.addEventListener('click', function () {
      callbacks.onOpenLibrary(library.id);
    });
    container.appendChild(door);
  });

  document.body.classList.toggle(
    'storybook-reduced-motion',
    model.reducedMotion
  );
  if (global.MovieDeckAnimations) {
    global.MovieDeckAnimations.animateStorybookHome(model.reducedMotion);
  }
  if (container.firstChild) { container.firstChild.focus(); }
}
```

Export it:

```javascript
global.RawiStorybookView = {
  init: init,
  renderHome: renderHome,
  renderSettings: renderSettings,
  setMode: setMode
};
```

Bind the settings shortcut in `init()`:

```javascript
byId('storybook-edit-libraries').addEventListener(
  'click',
  callbacks.onOpenSettings
);
```

- [ ] **Step 5: Add bounded Storybook animation**

Add to `MovieDeck/js/animations.js`:

```javascript
function animateStorybookHome(forceReducedMotion) {
  var doors = document.querySelectorAll('#storybook-doors .storybook-door');
  if (forceReducedMotion || prefersReducedMotion() || !doors.length) { return; }
  gsap.killTweensOf(doors);
  gsap.fromTo(doors, {
    autoAlpha: 0,
    y: 28
  }, {
    autoAlpha: 1,
    clearProps: 'opacity,visibility',
    duration: 0.45,
    ease: 'back.out(1.05)',
    stagger: 0.08,
    y: 0
  });
  Array.prototype.slice.call(doors, 0, 3).forEach(function (door, index) {
    gsap.to(door, {
      duration: 4.2 + index * 0.35,
      ease: 'sine.inOut',
      repeat: -1,
      y: index % 2 ? 7 : -7,
      yoyo: true
    });
  });
}
```

Export `animateStorybookHome` from `MovieDeckAnimations`.

- [ ] **Step 6: Route Storybook mode through the dedicated renderer**

In `openLibrary()` keep loading the shared groups, then branch only after data
has resolved:

```javascript
var resolution = storybookModel.resolveLibraries(
  availableLibraries,
  storybookState.libraryIds
);
var selectedMap = {};
resolution.selected.forEach(function (library) {
  selectedMap[itemId(library)] = true;
});

if (storybookState.lastMode === 'storybook') {
  var storybookGroups = groups[2].filter(function (group) {
    return selectedMap[group.id];
  });
  storybookView.renderHome({
    childName: storybookState.childName,
    libraries: storybookGroups,
    reducedMotion: storybookModel.isReducedMotion(
      storybookState,
      global.matchMedia &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  });
  showScreen('storybook-screen');
  return;
}
```

Add `onOpenLibrary` to `storybookView.init`. For Phase 1, opening a Story Door
returns to the existing Adult shelf renderer with only that library group:

```javascript
var storybookLibraryOpen = false;

function openStorybookLibrary(libraryId) {
  storybookLibraryOpen = true;
  renderAdultGroups(currentGroups.filter(function (group) {
    return group.id === libraryId;
  }));
  showScreen('browse-screen');
}
```

Extract the existing Adult definitions/render loop into
`renderAdultGroups(groups)` without changing its output. Retain
`currentGroups` as the most recently loaded library groups.

Before the existing browse-screen exit branch in `handleBack()`, add:

```javascript
if (activeScreen === 'browse-screen' && storybookLibraryOpen) {
  storybookLibraryOpen = false;
  storybookView.renderHome({
    childName: storybookState.childName,
    libraries: currentGroups.filter(function (group) {
      return storybookState.libraryIds.indexOf(group.id) !== -1;
    }),
    reducedMotion: storybookModel.isReducedMotion(
      storybookState,
      global.matchMedia &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  });
  showScreen('storybook-screen');
  return;
}
```

- [ ] **Step 7: Verify Storybook shell behavior**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js
.\tools\Start-RawiPreview.ps1
```

Expected:

1. Adult Mode remains pixel-equivalent before switching.
2. Storybook Mode shows only saved libraries.
3. The greeting uses the saved child name.
4. No more than three doors bob.
5. Reduced motion produces a static Storybook screen.
6. Opening a Story Door exposes only that library in the existing shelf view.
7. Returning and choosing Storybook restores the Storybook home.

- [ ] **Step 8: Commit Whimsical Watercolor shell**

```powershell
git add MovieDeck\index.html MovieDeck\css\storybook.css MovieDeck\js\animations.js MovieDeck\js\app.js MovieDeck\js\copy.js MovieDeck\js\storybook-view.js
git commit -m "feat: add Whimsical Watercolor Storybook home" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Deterministic Storybook Preview

**Files:**
- Create: `MovieDeck/js/preview-fixtures.js`
- Modify: `MovieDeck/index.html`
- Modify: `MovieDeck/js/app.js`
- Modify: `tools/Start-RawiPreview.ps1`
- Modify: `MovieDeck/tests/storybook-model.test.js`

**Interfaces:**
- Produces: `RawiPreviewFixtures.storybook -> {user, libraries, groups}`
- Consumes query parameter: `preview=storybook`
- Produces PowerShell option: `Start-RawiPreview.ps1 -StorybookMock`

- [ ] **Step 1: Add deterministic fixture**

Create `MovieDeck/js/preview-fixtures.js`:

```javascript
(function (global) {
  'use strict';

  global.RawiPreviewFixtures = {
    storybook: {
      user: { Id: 'preview-user', Name: 'Parent' },
      libraries: [
        { Id: 'pixar', Name: 'Disney Pixar' },
        { Id: 'songs', Name: 'Sing & Dance' },
        { Id: 'lessons', Name: 'Little Lessons' }
      ],
      groups: [
        {
          id: 'pixar',
          name: 'Disney Pixar',
          videos: [
            {
              Id: 'bluey',
              Name: "Bluey's Big Adventure",
              ProductionYear: 2024,
              RunTimeTicks: 16800000000,
              UserData: { PlaybackPositionTicks: 3600000000, PlayedPercentage: 21 }
            }
          ]
        },
        {
          id: 'songs',
          name: 'Sing & Dance',
          videos: [{ Id: 'dance', Name: 'Dance With Me', RunTimeTicks: 7200000000 }]
        },
        {
          id: 'lessons',
          name: 'Little Lessons',
          videos: [{ Id: 'colors', Name: 'The Color Garden', RunTimeTicks: 5400000000 }]
        }
      ]
    }
  };
}(window));
```

Load it before `app.js`.

- [ ] **Step 2: Add preview-mode detection**

Add to `MovieDeck/js/app.js`:

```javascript
function queryValue(name) {
  var match = new RegExp('[?&]' + name + '=([^&]+)').exec(global.location.search);
  return match ? decodeURIComponent(match[1]) : '';
}

function startStorybookPreview() {
  var fixture = global.RawiPreviewFixtures.storybook;
  api.user = fixture.user;
  availableLibraries = fixture.libraries;
  currentGroups = fixture.groups;
  storybookState = storybookPreferences.defaults();
  storybookState.enabled = true;
  storybookState.lastMode = 'storybook';
  storybookState.childName = 'Nova';
  storybookState.libraryIds = fixture.libraries.map(function (library) {
    return library.Id;
  });
  storybookView.setMode('storybook');
  storybookView.renderHome({
    childName: storybookState.childName,
    libraries: fixture.groups,
    reducedMotion: false
  });
  showScreen('storybook-screen');
}
```

At the end of `init()`:

```javascript
if (queryValue('preview') === 'storybook') {
  startStorybookPreview();
} else if (api.restore()) {
  openLibrary();
} else {
  showScreen('setup-screen', 'server-url');
}
```

The preview branch must execute before any Jellyfin network request.

- [ ] **Step 3: Add PowerShell preview option**

Add to the parameter block in `tools/Start-RawiPreview.ps1`:

```powershell
[Parameter(Mandatory = $false)]
[switch]$StorybookMock
```

Replace URL construction with:

```powershell
$url = "http://127.0.0.1:$Port/"
if ($StorybookMock) {
    $url += '?preview=storybook'
}
```

Update the displayed instructions:

```powershell
Write-Output "Rawi preview: $url"
Write-Output "Storybook mock: .\tools\Start-RawiPreview.ps1 -StorybookMock"
```

- [ ] **Step 4: Verify mock preview without Jellyfin**

Stop any existing preview and run:

```powershell
.\tools\Start-RawiPreview.ps1 -Stop
.\tools\Start-RawiPreview.ps1 -StorybookMock
```

Expected:

- URL ends with `?preview=storybook`.
- Storybook home renders without Quick Connect.
- The greeting contains `Nova`.
- Exactly three Story Doors appear.
- Reloading reproduces the same fixture.
- No request is made to the configured Jellyfin server.

- [ ] **Step 5: Commit deterministic preview**

```powershell
git add MovieDeck\index.html MovieDeck\js\app.js MovieDeck\js\preview-fixtures.js tools\Start-RawiPreview.ps1 MovieDeck\tests
git commit -m "test: add deterministic Storybook preview" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Phase 1 Documentation and Release Validation

**Files:**
- Modify: `README.md`
- Modify: `MovieDeck/config.xml`
- Modify: `MovieDeck/js/api.js`
- Verify: `dist/Rawi.wgt`

**Interfaces:**
- Consumes: all Phase 1 modules and preview commands
- Produces: signed package containing Storybook assets
- Does not install or launch the package

- [ ] **Step 1: Document Storybook Phase 1**

Add a `## Storybook Mode` section to `README.md` containing:

```markdown
## Storybook Mode

Storybook Mode is a parent-guided preschool interface over selected Jellyfin
libraries. Adult Mode remains available through the visible top-bar toggle.

### Configure Storybook Mode

1. Open Adult Mode.
2. Select **Storybook settings**.
3. Enter the child's display name.
4. Select one or more visible Jellyfin libraries.
5. Optionally enable reduced motion.
6. Save, then select **Storybook** in the mode toggle.

Storybook selection is curation, not access control. Configure the Jellyfin
user's library permissions to enforce actual content restrictions.

### Preview without Jellyfin

```powershell
.\tools\Start-RawiPreview.ps1 -StorybookMock
```

The deterministic preview opens directly into Whimsical Watercolor Storybook
Mode with local fixture data. It does not authenticate or contact Jellyfin.
```

Update the repository tree and feature list for:

- `storybook.css`
- `storage.js`
- `storybook-preferences.js`
- `storybook-model.js`
- `storybook-view.js`
- `preview-fixtures.js`
- `tests/`

- [ ] **Step 2: Run all local checks**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js
Get-ChildItem .\MovieDeck\js\*.js, .\MovieDeck\config\*.js | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
git diff --check
```

Expected: all tests pass, all JavaScript parses, and no new whitespace errors
outside the unchanged vendored GSAP file.

- [ ] **Step 3: Run browser acceptance checks**

Run:

```powershell
.\tools\Start-RawiPreview.ps1 -Stop
.\tools\Start-RawiPreview.ps1 -StorybookMock
```

Verify at 1920x1080:

1. Greeting, moon, stars, and Story Doors remain overscan-safe.
2. Focus is visible on every door and settings control.
3. Arrow navigation reaches the mode toggle and all settings controls.
4. Only three doors have recurring motion.
5. Reduced motion stops recurring motion.
6. Switching back to Adult Mode restores the existing layout.
7. Browser console contains no errors.

- [ ] **Step 4: Increment the package version once**

Do not edit versions manually. Run the existing deployment helper in
package-only mode:

```powershell
.\tools\Deploy-Rawi.ps1 -PackageOnly
```

Expected:

- `MovieDeck/config.xml` patch version increments once.
- `MovieDeck/js/api.js` `CLIENT_VERSION` matches it.
- `dist\Rawi.wgt` is created.
- Nothing is installed or launched on the TV.

- [ ] **Step 5: Inspect the widget contents**

Run:

```powershell
$entries = tar -tf .\dist\Rawi.wgt
$required = @(
  'css/storybook.css',
  'js/storage.js',
  'js/storybook-preferences.js',
  'js/storybook-model.js',
  'js/storybook-view.js',
  'js/preview-fixtures.js'
)
$missing = $required | Where-Object { $entries -notcontains $_ }
if ($missing) {
    throw "Rawi.wgt is missing: $($missing -join ', ')"
}
```

Expected: no missing entries.

- [ ] **Step 6: Commit Phase 1 release**

```powershell
git add README.md MovieDeck\config.xml MovieDeck\js\api.js
git commit -m "docs: document Storybook Mode foundation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 7: Stop preview and report TV validation as pending**

Run:

```powershell
.\tools\Start-RawiPreview.ps1 -Stop
git status --short
```

Expected:

- Preview server is stopped.
- Only intentionally ignored package/signature artifacts remain.
- Physical-TV deployment is explicitly deferred until the user requests it.

---

## Phase 1 Completion Gate

Phase 1 is complete only when:

1. Adult Mode remains behaviorally and visually unchanged.
2. The visible mode toggle persists across reloads.
3. Storybook Mode cannot open until at least one library is selected.
4. Storybook Mode displays only selected, currently accessible libraries.
5. Inaccessible saved library IDs are reported in settings.
6. The Whimsical Watercolor home matches the approved asymmetrical,
   picture-book direction.
7. No more than three visible elements animate continuously.
8. Reduced motion produces a static Storybook home.
9. The deterministic Storybook preview works without Jellyfin.
10. The signed widget includes every Storybook asset.
11. No package is installed or launched during Phase 1 validation.

## Deferred Plans

Create separate implementation plans after Phase 1 is validated on the target
TV:

- **Phase 2:** Continue Nova's Story, Nova's Favorites, Storybook details, and
  the gentle ending screen.
- **Phase 3:** Tonight's Little Menu, Magic Pick, friendly duration labels, and
  Jellyfin tag categories.
- **Phase 4:** Quiet-time filters, optional sound cues, and additional
  watercolor treatments.
