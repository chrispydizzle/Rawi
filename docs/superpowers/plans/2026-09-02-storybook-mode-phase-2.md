# Storybook Mode Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the shared Storybook Phase 2 experience for the Samsung Tizen app: true Story Doors, resume and favorites on Storybook home, Storybook-only library/details/ending screens, deterministic preview coverage, and signed package-only validation without changing Adult Mode behavior.

**Architecture:** Keep Jellyfin authentication, catalogue loading, playback negotiation, Samsung AVPlay, browser-video fallback, and progress reporting shared. Introduce one focused pure Storybook catalogue resolver that derives selected libraries, the resumable item, favorites, and safe-pruning decisions from the already-loaded catalogue; then let `app.js` map those results into Storybook screen models consumed by an expanded `storybook-view.js` home/library/details/ending renderer.

**Tech Stack:** ES5-compatible JavaScript, HTML5, CSS3, GSAP 3, Jellyfin HTTP API, Samsung Tizen 3.0 web runtime, `localStorage`, optional `tizen.preference`, Node.js built-in `assert` and `vm` test harness, PowerShell 5.1/7, signed Tizen widget packaging via `tools\Deploy-Rawi.ps1`.

## Global Constraints

- Preserve app ID `JfMovieTV1.MovieDeck`, package ID `JfMovieTV1`, and existing `moviedeck.*` keys.
- All runtime JavaScript must remain ES5-compatible for Samsung Tizen 3.0: no `const`, `let`, arrow functions, classes, optional chaining, or new runtime dependencies.
- Adult Mode layout, copy, navigation, authentication, and playback behavior remain unchanged except for the new Adult-details favorite toggle required for Storybook curation.
- Preserve the shared player/auth/progress reporting and never duplicate AVPlay logic.
- Version 1 Storybook preferences are a supported automatic migration to version 2; malformed or unknown versions still use the existing explicit recovery flow.
- Do not overwrite storage during restore; persist version 2 only on a later explicit save, favorite toggle, or pruning change.
- Track per-library load success/completeness; favorite pruning is allowed only when `/Views` succeeds and every relevant library video request succeeds.
- Reuse normalized catalogue objects and current library groups; do not add duplicate Jellyfin calls for Storybook-only derivation.
- Storybook CSS must stay scoped under `body.mode-storybook` or Storybook-only screen selectors; do not globally restyle Adult Mode selectors.
- Recurring motion must affect at most three visible elements and use transforms/opacity only; reduced motion must remain static.
- All user-facing copy must route through `window.RawiCopy`, with sparse local overrides continuing to work.
- Remote-only operation and hidden-screen focus ordering must be tested; the fake DOM must refuse focus on inactive screens, and async tests must register with and be awaited by `RawiTest.registerAsync`.
- TDD proof must demonstrate RED against forbidden behavior, not merely missing files; cross-realm normalization belongs in tests, never production code.
- Do not deploy to a physical TV from this plan. Final release validation is signed package-only through `.\tools\Deploy-Rawi.ps1 -PackageOnly`, and that step is the single `0.1.11 -> 0.1.12` version bump.

---

## Planned File Structure

| File | Responsibility |
|---|---|
| `MovieDeck\js\storybook-preferences.js` | Versioned Storybook preference defaults, v1→v2 migration, normalization, recovery, and persistence |
| `MovieDeck\js\storybook-model.js` | Existing pure library-resolution and reduced-motion helpers consumed by the new catalogue resolver |
| `MovieDeck\js\storybook-catalogue.js` | New pure catalogue derivation for selected libraries, resumable item, favorites, item lookup, and safe-pruning decisions |
| `MovieDeck\js\storybook-view.js` | Storybook home, library, details, ending, settings rendering, and Storybook-specific callbacks/focus management |
| `MovieDeck\js\app.js` | Shared orchestration: load-state tracking, screen routing, Storybook view-model assembly, shared-player return paths, preview routing, and safe preference saves |
| `MovieDeck\js\copy.js` | Complete default copy for home, favorites, library, details, ending, preview guidance, and Adult-details favorite toggles |
| `MovieDeck\js\preview-fixtures.js` | Deterministic Storybook preview catalogue, preferences, preview artwork, and routed screen scenarios without Jellyfin |
| `MovieDeck\css\storybook.css` | Scoped Whimsical Watercolor styling for Storybook home/library/details/ending layouts and cards |
| `MovieDeck\index.html` | Storybook home structure plus dedicated Storybook library/details/ending screens and the Adult-details favorite button |
| `MovieDeck\tests\run-tests.js` | Test runner file list and async-wait behavior |
| `MovieDeck\tests\storybook-preferences.test.js` | v1 migration, v2 normalization, unsupported-version recovery, and non-overwriting restore checks |
| `MovieDeck\tests\storybook-catalogue.test.js` | Pure catalogue derivation, selected-library resume, favorites resolution, and pruning safety |
| `MovieDeck\tests\storybook-view.test.js` | Storybook renderer home/library/details/ending DOM, copy, callback, and focus behavior |
| `MovieDeck\tests\storybook-app.test.js` | App-level routing, shared player behavior, preview routing, safe pruning, completion flow, and remote-first focus behavior |
| `MovieDeck\tests\copy.test.js` | Default copy presence for all new Storybook Phase 2 keys |
| `tools\Start-RawiPreview.ps1` | Storybook preview URL helpers for home/library/details/ending browser acceptance |
| `README.md` | Storybook Phase 2 behavior, deterministic preview commands, favorite flow, and package-only validation notes |
| `MovieDeck\config.xml` | Final version bump to `0.1.12` via `Deploy-Rawi.ps1 -PackageOnly` only |
| `MovieDeck\js\api.js` | Final `CLIENT_VERSION` bump to `0.1.12` via `Deploy-Rawi.ps1 -PackageOnly` only |

---

### Task 1: Preference and Catalogue Foundation

**Files:**
- Create: `MovieDeck\js\storybook-catalogue.js`
- Create: `MovieDeck\tests\storybook-catalogue.test.js`
- Modify: `MovieDeck\index.html:219-223`
- Modify: `MovieDeck\js\storybook-preferences.js:4-125`
- Modify: `MovieDeck\tests\storybook-preferences.test.js:8-149`
- Modify: `MovieDeck\tests\run-tests.js:6-15,48-90`

**Interfaces:**
- Produces: `window.RawiStorybookPreferences.restore() -> { version: 2, enabled: boolean, lastMode: 'adult'|'storybook', childName: string, libraryIds: string[], favoriteItemIds: string[], reducedMotion: boolean }`
- Produces: `window.RawiStorybookPreferences.save(preferences) -> same normalized version-2 object`
- Produces: `window.RawiStorybookCatalogue.resolve(options) -> { selectedLibraries: Array<{id: string, name: string, videos: Object[]}>, missingLibraryIds: string[], resumeItem: Object|null, favoriteItems: Object[], favoriteIdsToPrune: string[], canPruneFavorites: boolean, itemById: Object, libraryIdByItemId: Object }`
- Consumes: `window.RawiStorybookModel.resolveLibraries(libraries, selectedIds)`
- Consumes: `libraryLoadState = { viewsSucceeded: boolean, requestedLibraryIds: string[], videoRequests: { [libraryId: string]: { complete: boolean, succeeded: boolean } } }`

- [ ] **Step 1: Replace every existing version-1 preference assertion with version-2 expectations, then add v1 migration REDs**

In `MovieDeck\tests\storybook-preferences.test.js`, replace `defaultPreferences()`, `supportedVersionNormalizesMissingOptionalFieldsWithoutRecovery()`, `validPreferencesAreNormalized()`, `resetWritesVersionedDefaultsAfterRecovery()`, and `saveWritesNormalizedVersionedData()` with these exact blocks so Task 1 can actually go GREEN after the runtime change:

```javascript
function defaultPreferences() {
  return {
    version: 2,
    enabled: false,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    favoriteItemIds: [],
    reducedMotion: false
  };
}

(function supportedVersionNormalizesMissingOptionalFieldsWithoutRecovery() {
  var harness = loadPreferences(JSON.stringify({
    version: 2,
    enabled: true
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 2,
    enabled: true,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    favoriteItemIds: [],
    reducedMotion: false
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function validPreferencesAreNormalized() {
  var harness = loadPreferences(JSON.stringify({
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['pixar', 'pixar', 42],
    favoriteItemIds: ['bluey', 'bluey', 9],
    reducedMotion: true,
    ignored: 'value'
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['pixar'],
    favoriteItemIds: ['bluey'],
    reducedMotion: true
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function resetWritesVersionedDefaultsAfterRecovery() {
  var harness = loadPreferences('{broken');
  var result;

  harness.api.restore();
  result = harness.api.reset();

  assert.deepStrictEqual(clone(result), defaultPreferences());
  assert.strictEqual(harness.saved().key, 'rawi.storybook.preferences');
  assert.deepStrictEqual(JSON.parse(harness.saved().value), defaultPreferences());
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
}());

(function saveWritesNormalizedVersionedData() {
  var harness = loadPreferences(null);
  var result = harness.api.save({
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['one', 'one', 5],
    favoriteItemIds: ['story-1', 'story-1', 8],
    reducedMotion: false
  });

  assert.deepStrictEqual(clone(result), {
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['one'],
    favoriteItemIds: ['story-1'],
    reducedMotion: false
  });
  assert.strictEqual(harness.saved().key, 'rawi.storybook.preferences');
  assert.deepStrictEqual(
    JSON.parse(harness.saved().value),
    clone(result)
  );
  assert.deepStrictEqual(
    clone(harness.api.getRestoreStatus()),
    {
      needsRecovery: false,
      type: 'ok'
    }
  );
}());
```

Leave `missingPreferencesUseSafeDefaults()` and `unsupportedVersionRequiresRecoveryWithoutOverwritingStorage()` in place; their existing calls to `defaultPreferences()` now resolve to the version-2 object above. Then append these migration regressions immediately below `missingPreferencesUseSafeDefaults()`:

```javascript
(function migratesVersion1PreferencesWithoutRecoveryOrImmediateRewrite() {
  var harness = loadPreferences(JSON.stringify({
    version: 1,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['pixar', 'pixar', 7],
    favoriteItemIds: ['bluey', 'bluey', 9],
    reducedMotion: true
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['pixar'],
    favoriteItemIds: ['bluey'],
    reducedMotion: true
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function migratesLegacyFavoritesFieldIntoFavoriteItemIds() {
  var harness = loadPreferences(JSON.stringify({
    version: 1,
    enabled: true,
    favorites: ['dance', 'dance', 3]
  }));

  assert.deepStrictEqual(
    clone(harness.api.restore().favoriteItemIds),
    ['dance']
  );
  assert.strictEqual(harness.saved(), null);
}());
```

- [ ] **Step 2: Run the preference test first to prove the current runtime still emits version 1 and rejects supported version 1 data**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js storybook-preferences.test.js
```

Expected RED output: `storybook-preferences.test.js` fails because the current implementation still returns `version: 1`, omits `favoriteItemIds`, and treats supported version-1 data as `unsupported-version` recovery instead of migrating it to version 2.

- [ ] **Step 3: Add the pure catalogue tests and runner entry before implementation**

Update `MovieDeck\tests\run-tests.js` so the new file is part of the default suite:

```javascript
var DEFAULT_TEST_FILES = [
  'animations.test.js',
  'storage.test.js',
  'run-tests-runner.test.js',
  'storybook-app.test.js',
  'storybook-preferences.test.js',
  'storybook-model.test.js',
  'storybook-catalogue.test.js',
  'storybook-view.test.js',
  'copy.test.js'
];
```

Create `MovieDeck\tests\storybook-catalogue.test.js`:

```javascript
'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var modelWindow = load('js/storybook-model.js', { window: {} });
var catalogue = load('js/storybook-catalogue.js', {
  window: {
    RawiStorybookModel: modelWindow.RawiStorybookModel
  }
}).RawiStorybookCatalogue;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

(function picksTheNewestResumableItemFromSelectedLibrariesOnly() {
  var result = catalogue.resolve({
    accessibleLibraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'grownups', Name: 'Grownups' }
    ],
    groups: [
      {
        id: 'kids',
        name: 'Kids',
        videos: [{ Id: 'story-1', Name: 'First Story' }]
      },
      {
        id: 'grownups',
        name: 'Grownups',
        videos: [{ Id: 'movie-9', Name: 'Late Movie' }]
      }
    ],
    preferences: {
      libraryIds: ['kids'],
      favoriteItemIds: ['story-1', 'missing-favorite']
    },
    resumeItems: [
      { Id: 'movie-9', UserData: { PlaybackPositionTicks: 300000000 } },
      { Id: 'story-1', UserData: { PlaybackPositionTicks: 600000000 } }
    ],
    libraryLoadState: {
      viewsSucceeded: true,
      requestedLibraryIds: ['kids', 'grownups'],
      videoRequests: {
        kids: { complete: true, succeeded: true },
        grownups: { complete: true, succeeded: true }
      }
    }
  });

  assert.strictEqual(result.resumeItem.Id, 'story-1');
  assert.deepStrictEqual(
    clone(result.favoriteItems.map(function (item) { return item.Id; })),
    ['story-1']
  );
  assert.deepStrictEqual(clone(result.favoriteIdsToPrune), ['missing-favorite']);
  assert.strictEqual(result.canPruneFavorites, true);
}());

(function toleratedLibraryFailuresBlockFavoritePruning() {
  var result = catalogue.resolve({
    accessibleLibraries: [
      { Id: 'kids', Name: 'Kids' },
      { Id: 'songs', Name: 'Songs' }
    ],
    groups: [
      {
        id: 'kids',
        name: 'Kids',
        videos: [{ Id: 'story-1', Name: 'First Story' }]
      },
      {
        id: 'songs',
        name: 'Songs',
        videos: []
      }
    ],
    preferences: {
      libraryIds: ['kids'],
      favoriteItemIds: ['missing-favorite']
    },
    resumeItems: [],
    libraryLoadState: {
      viewsSucceeded: true,
      requestedLibraryIds: ['kids', 'songs'],
      videoRequests: {
        kids: { complete: true, succeeded: true },
        songs: { complete: true, succeeded: false }
      }
    }
  });

  assert.strictEqual(result.canPruneFavorites, false);
  assert.deepStrictEqual(clone(result.favoriteIdsToPrune), []);
}());
```

- [ ] **Step 4: Implement version-2 preferences and the new pure catalogue resolver**

Replace the normalization/version handling in `MovieDeck\js\storybook-preferences.js` with this version-2 logic:

```javascript
var VERSION = 2;

function normalizeIds(values) {
  var result = [];
  var seen = {};
  var list = Array.isArray(values) ? values : [];
  var i;
  var id;

  for (i = 0; i < list.length; i += 1) {
    id = list[i];
    if (typeof id !== 'string' || !id || seen[id]) { continue; }
    seen[id] = true;
    result.push(id);
  }

  return result;
}

function defaults() {
  return {
    version: VERSION,
    enabled: false,
    lastMode: 'adult',
    childName: '',
    libraryIds: [],
    favoriteItemIds: [],
    reducedMotion: false
  };
}

function normalize(input) {
  var source = input || {};

  return {
    version: VERSION,
    enabled: source.enabled === true,
    lastMode: source.lastMode === 'storybook' ? 'storybook' : 'adult',
    childName: typeof source.childName === 'string' ? source.childName.trim() : '',
    libraryIds: normalizeIds(source.libraryIds),
    favoriteItemIds: normalizeIds(
      source.favoriteItemIds !== undefined ? source.favoriteItemIds : source.favorites
    ),
    reducedMotion: source.reducedMotion === true
  };
}

function restore() {
  var stored = storage.get(KEY);
  var parsed;

  if (!stored) {
    restoreStatus({ needsRecovery: false, type: 'ok' });
    return defaults();
  }

  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    restoreStatus({ needsRecovery: true, type: 'malformed' });
    return defaults();
  }

  if (!parsed || parsed.version === undefined || parsed.version === null) {
    restoreStatus({ needsRecovery: true, type: 'malformed' });
    return defaults();
  }

  if (parsed.version === 1) {
    restoreStatus({ needsRecovery: false, type: 'ok' });
    return normalize(parsed);
  }

  if (parsed.version !== VERSION) {
    restoreStatus({
      needsRecovery: true,
      type: 'unsupported-version',
      version: parsed.version
    });
    return defaults();
  }

  restoreStatus({ needsRecovery: false, type: 'ok' });
  return normalize(parsed);
}
```

Create `MovieDeck\js\storybook-catalogue.js`:

```javascript
(function (global) {
  'use strict';

  var model = global.RawiStorybookModel;

  function itemId(item) {
    if (!item) { return ''; }
    if (item.Id !== undefined && item.Id !== null) { return String(item.Id); }
    if (item.id !== undefined && item.id !== null) { return String(item.id); }
    return '';
  }

  function groupId(group) {
    if (!group) { return ''; }
    if (group.id !== undefined && group.id !== null) { return String(group.id); }
    if (group.Id !== undefined && group.Id !== null) { return String(group.Id); }
    return '';
  }

  function requestedLibrariesSucceeded(loadState) {
    var state = loadState || {};
    var requestedIds = state.requestedLibraryIds || [];
    var requests = state.videoRequests || {};
    var i;
    var libraryId;
    var requestState;

    if (state.viewsSucceeded !== true) { return false; }

    for (i = 0; i < requestedIds.length; i += 1) {
      libraryId = String(requestedIds[i]);
      requestState = requests[libraryId];
      if (!requestState || requestState.complete !== true || requestState.succeeded !== true) {
        return false;
      }
    }

    return true;
  }

  function buildIndex(groups) {
    var itemById = {};
    var libraryIdByItemId = {};
    var list = groups || [];
    var i;
    var j;
    var group;
    var videos;
    var item;
    var libraryId;
    var key;

    for (i = 0; i < list.length; i += 1) {
      group = list[i];
      libraryId = groupId(group);
      videos = group && group.videos ? group.videos : [];
      for (j = 0; j < videos.length; j += 1) {
        item = videos[j];
        key = itemId(item);
        if (!key) { continue; }
        itemById[key] = item;
        libraryIdByItemId[key] = libraryId;
      }
    }

    return {
      itemById: itemById,
      libraryIdByItemId: libraryIdByItemId
    };
  }

  function resolve(options) {
    var input = options || {};
    var preferences = input.preferences || {};
    var resolution = model.resolveLibraries(
      input.accessibleLibraries || [],
      preferences.libraryIds || []
    );
    var selectedMap = {};
    var selectedLibraries = [];
    var favoriteItems = [];
    var favoriteIdsToPrune = [];
    var resumeItem = null;
    var index = buildIndex(input.groups || []);
    var resumeItems = input.resumeItems || [];
    var favoriteIds = preferences.favoriteItemIds || [];
    var groups = input.groups || [];
    var i;
    var key;
    var libraryId;
    var item;

    for (i = 0; i < resolution.selected.length; i += 1) {
      selectedMap[itemId(resolution.selected[i])] = true;
    }

    for (i = 0; i < groups.length; i += 1) {
      item = groups[i];
      if (selectedMap[groupId(item)]) {
        selectedLibraries.push(item);
      }
    }

    for (i = 0; i < resumeItems.length; i += 1) {
      key = itemId(resumeItems[i]);
      libraryId = index.libraryIdByItemId[key];
      if (key && selectedMap[libraryId]) {
        resumeItem = index.itemById[key] || resumeItems[i];
        break;
      }
    }

    for (i = 0; i < favoriteIds.length; i += 1) {
      key = String(favoriteIds[i] || '');
      if (!key) { continue; }
      item = index.itemById[key];
      if (!item) {
        favoriteIdsToPrune.push(key);
        continue;
      }
      libraryId = index.libraryIdByItemId[key];
      if (selectedMap[libraryId]) {
        favoriteItems.push(item);
      }
    }

    if (!requestedLibrariesSucceeded(input.libraryLoadState)) {
      favoriteIdsToPrune = [];
    }

    return {
      canPruneFavorites: requestedLibrariesSucceeded(input.libraryLoadState),
      favoriteIdsToPrune: favoriteIdsToPrune,
      favoriteItems: favoriteItems,
      itemById: index.itemById,
      libraryIdByItemId: index.libraryIdByItemId,
      missingLibraryIds: resolution.missingIds,
      resumeItem: resumeItem,
      selectedLibraries: selectedLibraries
    };
  }

  global.RawiStorybookCatalogue = {
    resolve: resolve
  };
}(window));
```

- [ ] **Step 5: Load the new runtime module before `app.js`**

Insert this new script tag in `MovieDeck\index.html` between `storybook-model.js` and `vendor\gsap.min.js`:

```html
<script src="js/storybook-catalogue.js"></script>
```

- [ ] **Step 6: Re-run only the foundation tests and confirm GREEN**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js storybook-preferences.test.js storybook-catalogue.test.js
```

Expected GREEN output:

```text
All Rawi tests passed.
```

- [ ] **Step 7: Commit the foundation as one reviewable unit**

```powershell
git add MovieDeck\index.html MovieDeck\js\storybook-preferences.js MovieDeck\js\storybook-catalogue.js MovieDeck\tests\run-tests.js MovieDeck\tests\storybook-preferences.test.js MovieDeck\tests\storybook-catalogue.test.js
git commit -m "feat: add storybook catalogue foundation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

**Validation evidence for the remaining prune-safety finding:** the added `storybook-catalogue.test.js` regression now proves that a missing selected library forces `canPruneFavorites === false` and leaves `favoriteIdsToPrune` empty even when the remaining libraries report successful `/Views` and video-request completion. The full suite and `git diff --check` both passed after the fix.

**Validation evidence for the final settings-save regression:** `app.js` now preserves `storybookState.favoriteItemIds` when saving Storybook settings, and the new `storybook-app.test.js` regression seeds version-2 preferences with favorites, changes child/library/reduced-motion settings, and confirms the saved normalized preferences still contain the favorite IDs. The targeted `storybook-app.test.js` + `storybook-preferences.test.js` run, the full suite, and `git diff --check` all passed.

---

### Task 2: Storybook Home Resume and Favorites

**Files:**
- Modify: `MovieDeck\index.html:92-130`
- Modify: `MovieDeck\js\copy.js:58-98`
- Modify: `MovieDeck\js\storybook-view.js:7-239`
- Modify: `MovieDeck\js\app.js:8-71,242-409,426-520,777-804`
- Modify: `MovieDeck\css\storybook.css:11-192`
- Modify: `MovieDeck\tests\copy.test.js:6-80`
- Modify: `MovieDeck\tests\storybook-view.test.js:159-467`
- Modify: `MovieDeck\tests\storybook-app.test.js:1-1255,1255-1696`

**Interfaces:**
- Consumes: `RawiStorybookCatalogue.resolve({ preferences, accessibleLibraries, groups, resumeItems, libraryLoadState })`
- Produces: `RawiStorybookView.renderHome({ childName: string, preferredFocusId?: string, reducedMotion: boolean, resume: StorybookCardModel|null, favorites: StorybookCardModel[], libraries: StorybookDoorModel[] })`
- Produces callback: `options.onOpenStorybookItem(itemId, source)` where `source` is `'resume'` or `'favorite'`
- Produces internal app helpers: `saveStorybookState(overrides)`, `buildStorybookCatalogue()`, `storybookCardModel(item)`, `storybookDoorModel(group)`, `previewStorybookState(fixture)`, `previewLibraryLoadState()`

- [ ] **Step 1: Add full home-copy coverage and wire both harnesses so REDs fail on missing behavior, not missing plumbing**

Append this copy coverage to `MovieDeck\tests\copy.test.js`:

```javascript
(function exposesStorybookHomePhase2CopyDefaults() {
  assert.strictEqual(
    copy.get('storybookContinueTitle', { child: 'Nova' }),
    "Continue Nova's Story"
  );
  assert.strictEqual(
    copy.get('storybookContinueTitleWithoutName'),
    'Continue the story'
  );
  assert.strictEqual(
    copy.get('storybookFavoritesTitle', { child: 'Nova' }),
    "Nova's Favorites"
  );
  assert.strictEqual(copy.get('storybookFavoritesTitleWithoutName'), 'Favorites');
  assert.strictEqual(copy.get('storybookDoorsTitle'), 'Story Doors');
  assert.strictEqual(
    copy.get('storybookHomeHint'),
    'Pick a favorite or open a story door.'
  );
  assert.strictEqual(
    copy.get('storybookItemAriaLabel', { title: 'Bluey' }),
    'Open Bluey'
  );
  assert.strictEqual(
    copy.get('storybookResumeProgress', { time: '6m' }),
    'Resume from 6m'
  );
}());
```

In `MovieDeck\tests\storybook-view.test.js`, expand `loadViewHarness()` before `var buttons = { ... }` with `var openItems = [];`, then add the new home nodes, copy stubs, and callback wiring shown below. Keep the existing door tests; the renderer implementation in Step 4 will tolerate both the old `{ name }` fixture shape and the new `{ title, subtitle }` door models so the Phase 1 preview stays working while this task lands.

```javascript
var openItems = [];
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

if (key === 'libraryCaption') { return values.count + ' titles'; }
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
if (key === 'storybookResumeProgress') { return 'Resume from ' + values.time; }

window.RawiStorybookView.init({
  onCancelSettings: function () {},
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
```

Add `openItems: openItems` to the harness return object, then append this new regression below `rendersStoryDoorsAndBindsOpenCallbacks()`:

```javascript
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
```

At the top of `MovieDeck\tests\storybook-app.test.js`, add `var load = global.RawiTest.loadBrowserScript;`. Then inside `loadAppHarness(options)`, load the real Task 1 model/catalogue modules and extend the existing fake DOM, copy stubs, and versioned preference helpers exactly as follows:

```javascript
var modelWindow = load('js/storybook-model.js', { window: {} });
var catalogueWindow = load('js/storybook-catalogue.js', {
  window: {
    RawiStorybookModel: modelWindow.RawiStorybookModel
  }
});
```

Insert these new Storybook home nodes in `buildDom(document)` between `storybook-home-hint` and `storybook-doors`:

```javascript
var storybookResumeSection = append(storybookScreen, 'section', 'storybook-resume-section', '');
append(storybookResumeSection, 'h2', 'storybook-resume-title', '');
append(storybookResumeSection, 'div', 'storybook-resume-slot', '');
var storybookFavoritesSection = append(storybookScreen, 'section', 'storybook-favorites-section', '');
append(storybookFavoritesSection, 'h2', 'storybook-favorites-title', '');
append(storybookFavoritesSection, 'div', 'storybook-favorites', '');
```

Extend `copyMap` with the exact new keys and placeholders:

```javascript
storybookContinueTitle: "Continue {child}'s Story",
storybookContinueTitleWithoutName: 'Continue the story',
storybookDoorsTitle: 'Story Doors',
storybookFavoritesTitle: "{child}'s Favorites",
storybookFavoritesTitleWithoutName: 'Favorites',
storybookHomeHint: 'Pick a favorite or open a story door.',
storybookItemAriaLabel: 'Open {title}',
storybookResumeProgress: 'Resume from {time}',
```

Replace the preference defaults/normalizer inside the app harness with the version-2 shape so existing saved-state checks stay meaningful instead of failing on harness drift:

```javascript
var currentPreferences = JSON.parse(JSON.stringify(options.preferences || {
  version: 2,
  enabled: false,
  lastMode: 'adult',
  childName: '',
  libraryIds: [],
  favoriteItemIds: [],
  reducedMotion: false
}));

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
```

Replace the inline `RawiStorybookModel` stub in that same harness with the real model and add the catalogue global beside it:

```javascript
RawiStorybookModel: modelWindow.RawiStorybookModel,
RawiStorybookCatalogue: catalogueWindow.RawiStorybookCatalogue,
```

Replace the saved-state expectations in these existing tests so they now assert the real version-2 shape:

```javascript
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
```

```javascript
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
```

Then append this integration regression so the RED is about the missing home behavior itself, not about absent harness IDs or globals:

```javascript
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
```

- [ ] **Step 2: Run the focused Storybook home tests and confirm the failures are behavior-based**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected RED output: assertions that `storybook-resume-card`, `storybook-resume-title`, `storybook-favorites-title`, or the first-focus target are still wrong because Storybook home only renders doors today. There should be no harness-plumbing failures such as missing globals, missing DOM IDs, or copy-key placeholders.

- [ ] **Step 3: Replace the Storybook home markup while preserving the existing top bar and visible mode toggle**

Replace the current `#storybook-screen` section in `MovieDeck\index.html` with this full structure so the existing `storybook-topbar` stays intact and the Adult/Storybook toggle remains visible:

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
  <div class="storybook-page storybook-home-page">
    <div class="storybook-copy">
      <h1 id="storybook-greeting"></h1>
      <p id="storybook-home-hint" data-copy="storybookHomeHint">Pick a favorite or open a story door.</p>
    </div>

    <section id="storybook-resume-section" class="storybook-section">
      <h2 id="storybook-resume-title" class="storybook-section-title"></h2>
      <div id="storybook-resume-slot"></div>
    </section>

    <section id="storybook-favorites-section" class="storybook-section">
      <h2 id="storybook-favorites-title" class="storybook-section-title"></h2>
      <div id="storybook-favorites" class="storybook-card-strip"></div>
    </section>

    <section id="storybook-doors-section" class="storybook-section">
      <h2 class="storybook-section-title" data-copy="storybookDoorsTitle">Story Doors</h2>
      <div id="storybook-doors" class="storybook-doors"></div>
    </section>

    <p id="storybook-empty-state"
       class="storybook-empty-state"
       role="status"
       aria-live="polite"></p>
    <button id="storybook-edit-libraries"
            class="storybook-edit focusable"
            data-focusable
            data-copy="storybookEditLibrariesButton">Choose libraries</button>
  </div>
</section>
```

Add these defaults to `MovieDeck\js\copy.js` near the existing Storybook strings:

```javascript
storybookContinueTitle: "Continue {child}'s Story",
storybookContinueTitleWithoutName: 'Continue the story',
storybookFavoritesTitle: "{child}'s Favorites",
storybookFavoritesTitleWithoutName: 'Favorites',
storybookDoorsTitle: 'Story Doors',
storybookHomeHint: 'Pick a favorite or open a story door.',
storybookItemAriaLabel: 'Open {title}',
storybookResumeProgress: 'Resume from {time}',
```

- [ ] **Step 4: Expand `storybook-view.js` so home renders one resume card, a favorites strip, and the first available focus target**

Add these helpers above `renderHome()` in `MovieDeck\js\storybook-view.js`:

```javascript
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
```

Then replace `renderHome()` with this implementation. The `library.title || library.name` adapter is intentional: it keeps the existing Phase 1 preview fixture and direct renderer tests alive until Task 7 rewires preview data more richly.

```javascript
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
  container.scrollLeft = 0;

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

  strip = document.createElement('div');
  strip.className = 'storybook-door-strip';
  container.appendChild(strip);

  libraries.forEach(function (library) {
    var door = document.createElement('button');
    var label = document.createElement('span');
    var subtitle = document.createElement('span');
    var libraryTitle = library.title || library.name || copy.get('untitled');
    door.id = 'storybook-door-' + library.id;
    door.className = 'storybook-door focusable ' + (library.accentClass || 'storybook-accent-periwinkle');
    door.setAttribute('data-focusable', '');
    door.setAttribute('data-library-id', library.id);
    door.setAttribute('aria-label', copy.get('storybookDoorAriaLabel', { library: libraryTitle }));
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

  document.body.classList.toggle('storybook-reduced-motion', reducedMotion);
  if (global.MovieDeckAnimations) {
    global.MovieDeckAnimations.animateStorybookHome(reducedMotion);
  }

  if (model && model.preferredFocusId && byId(model.preferredFocusId)) {
    focusWhenReady(byId(model.preferredFocusId));
  } else if (firstChoice) {
    focusWhenReady(firstChoice);
  } else if (editButton) {
    focusWhenReady(editButton);
  }
}
```

- [ ] **Step 5: Add the scoped Storybook home layout and card styling**

Append these selectors to `MovieDeck\css\storybook.css`:

```css
.storybook-page {
  bottom: 0;
  left: 0;
  overflow-y: auto;
  padding: 150px 82px 56px;
  position: absolute;
  right: 0;
  top: 0;
  z-index: 2;
}
.storybook-home-page {
  padding-top: 150px;
}
.storybook-section {
  margin-top: 28px;
  position: relative;
}
.storybook-section-title {
  color: var(--storybook-gold);
  font-size: 18px;
  letter-spacing: .18em;
  margin: 0 0 14px;
  text-transform: uppercase;
}
.storybook-card-strip {
  display: flex;
  gap: 22px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.storybook-resume-card,
.storybook-favorite-card {
  background: rgba(11, 23, 51, .82);
  border: 2px solid rgba(255,255,255,.16);
  border-radius: 32px;
  color: var(--storybook-ink);
  overflow: hidden;
  padding: 0;
  text-align: left;
}
.storybook-resume-card {
  display: flex;
  min-height: 280px;
  width: 100%;
}
.storybook-favorite-card {
  flex: 0 0 320px;
  min-height: 300px;
}
.storybook-resume-card-art,
.storybook-resume-card-image,
.storybook-resume-card-fallback {
  height: 280px;
  width: 420px;
}
.storybook-favorite-card-art,
.storybook-favorite-card-image,
.storybook-favorite-card-fallback {
  height: 200px;
  width: 320px;
}
.storybook-resume-card-fallback,
.storybook-favorite-card-fallback {
  align-items: flex-end;
  color: var(--storybook-ink);
  display: flex;
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 28px;
  justify-content: flex-start;
  line-height: 1.05;
  padding: 22px;
}
.storybook-resume-card-copy,
.storybook-favorite-card-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: 26px 28px;
}
.storybook-card-title {
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 34px;
  line-height: 1.12;
  margin: 0 0 10px;
}
.storybook-card-meta,
.storybook-card-resume {
  color: var(--storybook-muted);
  margin: 0 0 10px;
}
.storybook-card-progress {
  background: rgba(255,255,255,.18);
  border-radius: 999px;
  height: 10px;
  overflow: hidden;
}
.storybook-card-progress span {
  background: var(--storybook-gold);
  display: block;
  height: 100%;
}
.storybook-door-title,
.storybook-door-subtitle {
  display: block;
}
.storybook-door-title {
  line-height: 1.12;
}
.storybook-door-subtitle {
  color: rgba(255,248,223,.76);
  font-size: 15px;
  letter-spacing: .12em;
  margin-top: 14px;
  text-transform: uppercase;
}
.storybook-accent-periwinkle {
  background: linear-gradient(#8297cf, #536da8);
}
.storybook-accent-sea {
  background: linear-gradient(#72aaa5, #3f7779);
}
.storybook-accent-coral {
  background: linear-gradient(#c88283, #8f596f);
}
```

- [ ] **Step 6: Wire the new catalogue/view-model helpers in `app.js` without adding new Jellyfin calls, and keep preview compatible in the interim**

Add the new shared state near the top of `MovieDeck\js\app.js`:

```javascript
var storybookCatalogue = global.RawiStorybookCatalogue;
var currentLibraryLoadState = {
  viewsSucceeded: false,
  requestedLibraryIds: [],
  videoRequests: {}
};
var currentStorybookCatalogue = null;
```

Add these helpers above `renderStorybookHome()`:

```javascript
function copyIds(values) {
  return Array.isArray(values) ? values.slice() : [];
}

function saveStorybookState(overrides) {
  overrides = overrides || {};
  storybookState = storybookPreferences.save({
    enabled: overrides.enabled !== undefined ? overrides.enabled : storybookState.enabled,
    lastMode: overrides.lastMode || storybookState.lastMode,
    childName: overrides.childName !== undefined ? overrides.childName : storybookState.childName,
    libraryIds: overrides.libraryIds !== undefined ? copyIds(overrides.libraryIds) : copyIds(storybookState.libraryIds),
    favoriteItemIds: overrides.favoriteItemIds !== undefined ? copyIds(overrides.favoriteItemIds) : copyIds(storybookState.favoriteItemIds),
    reducedMotion: overrides.reducedMotion !== undefined ? overrides.reducedMotion : storybookState.reducedMotion
  });
  storybookRestoreStatus = storybookPreferences.getRestoreStatus ?
    storybookPreferences.getRestoreStatus() :
    { needsRecovery: false, type: 'ok' };
  return storybookState;
}

function imageUrl(item, type, width, height) {
  var previewKey = type === 'Backdrop' ? 'PreviewBackdropUrl' : 'PreviewImageUrl';
  var previewUrl = value(item, previewKey, previewKey.charAt(0).toLowerCase() + previewKey.slice(1));
  if (previewUrl) { return previewUrl; }
  return api.imageUrl(item, type, width, height);
}

function storybookAccentClass(key) {
  var accents = ['storybook-accent-periwinkle', 'storybook-accent-sea', 'storybook-accent-coral'];
  var text = String(key || 'storybook');
  var total = 0;
  var i;

  for (i = 0; i < text.length; i += 1) {
    total += text.charCodeAt(i);
  }

  return accents[total % accents.length];
}

function buildStorybookCatalogue() {
  currentStorybookCatalogue = storybookCatalogue.resolve({
    accessibleLibraries: availableLibraries,
    groups: currentGroups,
    libraryLoadState: currentLibraryLoadState,
    preferences: storybookState,
    resumeItems: currentResume
  });
  return currentStorybookCatalogue;
}

function storybookCardModel(item) {
  var ticks = value(item, 'RunTimeTicks', 'runTimeTicks') || 0;

  return {
    accentClass: storybookAccentClass(itemId(item)),
    ariaLabel: copy.get('storybookItemAriaLabel', { title: name(item) }),
    artworkUrl: imageUrl(item, 'Primary', 560, 560) || imageUrl(item, 'Backdrop', 960, 540),
    id: itemId(item),
    minutesLabel: ticks ? copy.get('runtimeMinutes', { minutes: Math.round(ticks / 600000000) }) : '',
    progressPercent: playbackPercent(item),
    resumeLabel: resumeTicks(item) > 0 ? copy.get('storybookResumeProgress', { time: runtimeFromTicks(resumeTicks(item)) }) : '',
    title: name(item)
  };
}

function storybookDoorModel(group) {
  return {
    accentClass: storybookAccentClass(group.id),
    artworkUrl: '',
    id: group.id,
    name: group.name,
    subtitle: copy.get('libraryCaption', { count: group.videos.length }),
    title: group.name
  };
}

function previewStorybookState(fixture) {
  var preferences = fixture && fixture.preferences ? fixture.preferences : {};
  return {
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: typeof preferences.childName === 'string' ? preferences.childName : 'Nova',
    libraryIds: Array.isArray(preferences.libraryIds) ? preferences.libraryIds.slice() : previewLibraryIds(),
    favoriteItemIds: Array.isArray(preferences.favoriteItemIds) ? preferences.favoriteItemIds.slice() : [],
    reducedMotion: preferences.reducedMotion === true
  };
}

function previewLibraryLoadState() {
  var requests = {};
  var ids = previewLibraryIds();
  ids.forEach(function (id) {
    requests[id] = { complete: true, succeeded: true };
  });
  return {
    viewsSucceeded: true,
    requestedLibraryIds: ids,
    videoRequests: requests
  };
}
```

Replace `renderStorybookHome()` with this catalogue-backed version:

```javascript
function renderStorybookHome(preferredFocusId) {
  var catalogue = buildStorybookCatalogue();

  storybookView.renderHome({
    childName: storybookState.childName,
    favorites: catalogue.favoriteItems.map(function (item) {
      return storybookCardModel(item);
    }),
    libraries: catalogue.selectedLibraries.map(function (group) {
      return storybookDoorModel(group);
    }),
    preferredFocusId: preferredFocusId,
    reducedMotion: isStorybookReducedMotion(),
    resume: catalogue.resumeItem ? storybookCardModel(catalogue.resumeItem) : null
  });
}
```

Track library-load completeness inside `openLibrary()` when `/Views` succeeds:

```javascript
currentLibraryLoadState = {
  viewsSucceeded: false,
  requestedLibraryIds: [],
  videoRequests: {}
};

libraryGroups = api.getLibraries().then(function (libraries) {
  libraries = libraries || [];
  availableLibraries = libraries;
  availableLibrariesLoading = false;
  availableLibrariesReady = true;
  availableLibrariesFailed = false;
  currentLibraryLoadState.viewsSucceeded = true;
  currentLibraryLoadState.requestedLibraryIds = libraries.map(function (library) {
    return itemId(library);
  });
  return Promise.all(libraries.map(function (library) {
    var libraryId = itemId(library);
    currentLibraryLoadState.videoRequests[libraryId] = {
      complete: false,
      succeeded: false
    };
    return api.getVideos(libraryId).then(function (videos) {
      currentLibraryLoadState.videoRequests[libraryId] = {
        complete: true,
        succeeded: true
      };
      return { id: libraryId, name: name(library), videos: videos };
    }).catch(function () {
      currentLibraryLoadState.videoRequests[libraryId] = {
        complete: true,
        succeeded: false
      };
      return { id: libraryId, name: name(library), videos: [] };
    });
  }));
}).catch(function () {
  availableLibraries = [];
  availableLibrariesLoading = false;
  availableLibrariesReady = false;
  availableLibrariesFailed = true;
  currentLibraryLoadState = {
    viewsSucceeded: false,
    requestedLibraryIds: [],
    videoRequests: {}
  };
  return api.getVideos().then(function (videos) {
    return [{ name: copy.get('allVideos'), videos: videos }];
  });
});
```

Update `applyMode()` and `saveStorybookSettings()` to preserve `favoriteItemIds` via `saveStorybookState(...)`, and replace the preview bootstrap with the shared home renderer so the old preview fixture keeps working after this task:

```javascript
function applyMode(mode, controlId) {
  var nextMode = mode === 'storybook' ? 'storybook' : 'adult';
  if (nextMode === 'storybook' && !storybookState.libraryIds.length) {
    if (!openStorybookSettings(controlId, { activateStorybookOnSave: true })) { return; }
    showToast(copy.get('storybookSetupRequired'));
    return;
  }
  storybookState.lastMode = nextMode;
  storybookState.enabled = storybookState.enabled || nextMode === 'storybook';
  saveStorybookState({
    enabled: storybookState.enabled,
    favoriteItemIds: storybookState.favoriteItemIds,
    lastMode: nextMode
  });
  storybookResetConfirming = false;
  storybookView.setMode(nextMode);
  openLibrary();
}

function saveStorybookSettings(nextPreferences) {
  if (storybookRestoreStatus && storybookRestoreStatus.needsRecovery) { return; }
  saveStorybookState({
    enabled: true,
    favoriteItemIds: storybookState.favoriteItemIds,
    lastMode: storybookSettingsIntent.activateStorybookOnSave ? 'storybook' : storybookSettingsIntent.modeOnOpen,
    childName: nextPreferences.childName,
    libraryIds: nextPreferences.libraryIds,
    reducedMotion: nextPreferences.reducedMotion
  });
  storybookResetConfirming = false;
  setStorybookSettingsIntent();
  storybookView.setMode(storybookState.lastMode);
  showToast(copy.get('storybookSettingsSaved'));
  openLibrary();
}

function startStorybookPreview() {
  var fixture = global.RawiPreviewFixtures.storybook;

  previewStorybookFixture = fixture;
  api.user = fixture.user;
  updateProfile();
  availableLibraries = fixture.libraries || [];
  availableLibrariesReady = true;
  availableLibrariesFailed = false;
  availableLibrariesLoading = false;
  currentGroups = previewGroups();
  currentLatest = fixture.latest || [];
  currentResume = fixture.resume || [];
  currentLibraryLoadState = previewLibraryLoadState();
  storybookRestoreStatus = {
    needsRecovery: false,
    type: 'ok'
  };
  storybookResetConfirming = false;
  storybookState = previewStorybookState(fixture);
  storybookView.setMode('storybook');
  showScreen('storybook-screen');
  renderStorybookHome();
}
```

Register the new Storybook-item callback in `init()`:

```javascript
storybookView.init({
  onCancelSettings: cancelStorybookSettings,
  onModeChange: applyMode,
  onOpenLibrary: openStorybookLibrary,
  onOpenSettings: openStorybookSettings,
  onOpenStorybookItem: function (itemId) {
    if (!currentStorybookCatalogue || !currentStorybookCatalogue.itemById[itemId]) { return; }
    openDetails(currentStorybookCatalogue.itemById[itemId]);
  },
  onResetSettingsRecovery: resetStorybookSettingsRecovery,
  onPreferencesChange: saveStorybookSettings
});
```

- [ ] **Step 7: Run the Storybook home tests again and confirm GREEN**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected GREEN output:

```text
All Rawi tests passed.
```

- [ ] **Step 8: Commit the home-resume/favorites slice**

```powershell
git add MovieDeck\index.html MovieDeck\js\copy.js MovieDeck\js\storybook-view.js MovieDeck\js\app.js MovieDeck\css\storybook.css MovieDeck\tests\copy.test.js MovieDeck\tests\storybook-view.test.js MovieDeck\tests\storybook-app.test.js
git commit -m "feat: add storybook home resume and favorites" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

**Validation evidence for the Task 2 home-door overflow regression:** `storybook-view.js` now wraps Story Doors in a dedicated `.storybook-door-scroller` so horizontal overflow remains clamped while the outer watercolor layout stays vertically visible, preserving `MovieDeckAnimations.focusStorybookDoor` scroll semantics on Tizen-safe `overflow: hidden`. The added `animations.test.js` regression simulates an overflowed Storybook home, focuses a later door, and proves the scroller `scrollLeft` changes enough to bring the focused door inside the 72px overscan bounds. Targeted `animations.test.js` + `storybook-view.test.js` + `storybook-app.test.js`, the full suite, `node -c` syntax checks, and `git diff --check` all passed.

---

### Task 3: True Story Door Library Pages

**Files:**
- Modify: `MovieDeck\index.html:92-163`
- Modify: `MovieDeck\js\copy.js:63-98`
- Modify: `MovieDeck\js\storybook-view.js:79-239`
- Modify: `MovieDeck\js\app.js:34-35,315-399,729-740,776-804`
- Modify: `MovieDeck\css\storybook.css:75-192`
- Modify: `MovieDeck\tests\copy.test.js:6-96`
- Modify: `MovieDeck\tests\storybook-view.test.js:159-467`
- Modify: `MovieDeck\tests\storybook-app.test.js:331-744,1255-1656`

**Interfaces:**
- Consumes: `storybookDoorModel(group)` and `storybookCardModel(item)` from Task 2
- Produces: `RawiStorybookView.renderLibrary({ libraryId: string, preferredFocusId?: string, title: string, cards: StorybookCardModel[] })`
- Produces callback: `options.onCloseStorybookLibrary()`
- Produces callback: `options.onOpenStorybookItem(itemId, 'library')`
- Removes: legacy `storybookLibraryOpen` browse-screen bridge state/back branch once `storybook-library-screen` owns Story Door navigation

- [ ] **Step 1: Replace every Phase 1 Story Door bridge test with library-screen truths, and add copy coverage**

Append this copy coverage to `MovieDeck\tests\copy.test.js`:

```javascript
(function exposesStorybookLibraryCopyDefaults() {
  assert.strictEqual(copy.get('storybookLibraryBackButton'), '← Storybook');
  assert.strictEqual(
    copy.get('storybookLibraryEmpty', { library: 'Kids' }),
    'No stories are available in Kids right now.'
  );
}());
```

In `MovieDeck\tests\storybook-view.test.js`, extend `loadViewHarness()` with the dedicated library-page nodes and callback tracking:

```javascript
var closeLibraryCount = 0;
buttons.libraryAdult = append(document, document.body, 'button', 'storybook-library-adult-mode-button');
buttons.libraryBack = append(document, document.body, 'button', 'storybook-library-back');
buttons.libraryCards = append(document, document.body, 'div', 'storybook-library-cards');
buttons.libraryCount = append(document, document.body, 'p', 'storybook-library-count');
buttons.libraryEmpty = append(document, document.body, 'p', 'storybook-library-empty');
buttons.libraryStorybook = append(document, document.body, 'button', 'storybook-library-storybook-mode-button');
buttons.libraryTitle = append(document, document.body, 'h1', 'storybook-library-title');
buttons.libraryAdult.setAttribute('data-mode', 'adult');
buttons.libraryStorybook.setAttribute('data-mode', 'storybook');
document.modeButtons = [
  buttons.adult,
  buttons.storybook,
  buttons.libraryAdult,
  buttons.libraryStorybook
];

if (key === 'storybookLibraryBackButton') { return '← Storybook'; }
if (key === 'storybookLibraryEmpty') {
  return 'No stories are available in ' + values.library + ' right now.';
}

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
```

Add `closeLibraryCount: function () { return closeLibraryCount; }` to the harness return object, then append these renderer regressions:

```javascript
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
```

In the app harness `buildDom(document)` inside `MovieDeck\tests\storybook-app.test.js`, add the dedicated library screen and extend the copy stubs:

```javascript
var storybookLibraryScreen = append(document.body, 'section', 'storybook-library-screen', 'screen');
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
```

```javascript
storybookLibraryBackButton: '← Storybook',
storybookLibraryEmpty: 'No stories are available in {library} right now.',
```

Then replace the three existing Phase 1 bridge tests with these exact app regressions:

```javascript
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
```

- [ ] **Step 2: Run the library-screen tests and capture the remaining bridge failures**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected RED output: Story Doors still activate `browse-screen`, and the empty-door tests still see Adult-style browse/error behavior instead of the dedicated `storybook-library-screen` with a truthful empty-library message.

- [ ] **Step 3: Add the dedicated Storybook library screen and copy**

Insert this new section in `MovieDeck\index.html` after `#storybook-screen` and before the Adult `#details-screen`:

```html
<section id="storybook-library-screen"
         class="screen storybook-screen storybook-library-screen"
         aria-labelledby="storybook-library-title">
  <div class="storybook-sky" aria-hidden="true">
    <span class="storybook-moon"></span>
    <span class="storybook-star star-one">✦</span>
    <span class="storybook-star star-two">✧</span>
    <span class="storybook-star star-three">✦</span>
  </div>
  <header class="storybook-topbar">
    <div class="storybook-wordmark"><i>/</i> <span data-copy="appName">Rawi</span></div>
    <div class="mode-toggle" role="group" aria-label="Display mode">
      <button id="storybook-library-adult-mode-button"
              class="mode-option focusable"
              data-focusable
              data-mode="adult"
              data-copy="modeAdult">Adult</button>
      <button id="storybook-library-storybook-mode-button"
              class="mode-option focusable"
              data-focusable
              data-mode="storybook"
              data-copy="modeStorybook">Storybook</button>
    </div>
  </header>
  <div class="storybook-page storybook-library-page">
    <button id="storybook-library-back"
            class="storybook-edit focusable"
            data-focusable
            data-copy="storybookLibraryBackButton">← Storybook</button>
    <h1 id="storybook-library-title"></h1>
    <p id="storybook-library-count" class="storybook-library-count"></p>
    <div id="storybook-library-cards" class="storybook-library-cards"></div>
    <p id="storybook-library-empty" class="storybook-empty-state" role="status" aria-live="polite"></p>
  </div>
</section>
```

Add the supporting copy in `MovieDeck\js\copy.js`:

```javascript
storybookLibraryBackButton: '← Storybook',
storybookLibraryEmpty: 'No stories are available in {library} right now.',
```

- [ ] **Step 4: Implement `renderLibrary()`, route Story Doors into it, and delete the obsolete browse-screen bridge**

Add `renderLibrary()` to `MovieDeck\js\storybook-view.js`:

```javascript
function renderLibrary(model) {
  var container = byId('storybook-library-cards');
  var emptyState = byId('storybook-library-empty');
  var firstCard = null;
  var cards = model && model.cards ? model.cards : [];

  byId('storybook-library-title').textContent = model && model.title ? model.title : '';
  byId('storybook-library-count').textContent = copy.get('libraryCaption', { count: cards.length });
  container.innerHTML = '';

  cards.forEach(function (cardModel) {
    var card = createStoryCard(cardModel, 'storybook-library-card', 'library');
    card.id = 'storybook-library-card-' + cardModel.id;
    if (!firstCard) { firstCard = card; }
    container.appendChild(card);
  });

  emptyState.textContent = cards.length ? '' : copy.get('storybookLibraryEmpty', { library: model.title });
  emptyState.style.display = cards.length ? 'none' : 'block';

  if (model && model.preferredFocusId && byId(model.preferredFocusId)) {
    focusWhenReady(byId(model.preferredFocusId));
  } else if (firstCard) {
    focusWhenReady(firstCard);
  } else {
    focusWhenReady(byId('storybook-library-back'));
  }
}
```

Wire the new button in `init()`:

```javascript
byId('storybook-library-back').addEventListener('click', callbacks.onCloseStorybookLibrary);
```

Replace the final export with this complete object so Task 3 ships the new renderer on the public surface immediately:

```javascript
global.RawiStorybookView = {
  init: init,
  renderHome: renderHome,
  renderLibrary: renderLibrary,
  renderSettings: renderSettings,
  setMode: setMode
};
```

Then update `MovieDeck\js\app.js` to replace the bridge behavior. This dedicated state replaces the old `var storybookLibraryOpen = false;` boolean entirely:

```javascript
var storybookLibraryState = {
  libraryId: '',
  returnFocusId: ''
};

function selectedStorybookLibrary(libraryId) {
  var catalogue = currentStorybookCatalogue || buildStorybookCatalogue();
  var libraries = catalogue.selectedLibraries;
  var i;

  for (i = 0; i < libraries.length; i += 1) {
    if (String(libraries[i].id) === String(libraryId)) {
      return libraries[i];
    }
  }

  return null;
}

function openStorybookLibrary(libraryId, preferredFocusId) {
  var library = selectedStorybookLibrary(libraryId);
  if (!library) { return; }

  storybookLibraryState = {
    libraryId: libraryId,
    returnFocusId: 'storybook-door-' + libraryId
  };

  showScreen('storybook-library-screen');
  storybookView.renderLibrary({
    cards: library.videos.map(function (item) {
      return storybookCardModel(item);
    }),
    libraryId: libraryId,
    preferredFocusId: preferredFocusId,
    title: library.name
  });
}

function closeStorybookLibrary() {
  showScreen('storybook-screen');
  renderStorybookHome(storybookLibraryState.returnFocusId);
}
```

Delete this obsolete reset from `openLibrary()` once the dedicated Storybook library screen exists:

```javascript
storybookLibraryOpen = false;
```

Replace the old Storybook-specific `browse-screen` back branch with this full `handleBack()` implementation, then keep the `init()` wiring aligned with the dedicated screen:

```javascript
function handleBack() {
  if (activeScreen === 'player-screen') { showScreen('details-screen', 'play-button'); return; }
  if (activeScreen === 'storybook-settings-screen') {
    cancelStorybookSettings();
    return;
  }
  if (activeScreen === 'storybook-library-screen') {
    closeStorybookLibrary();
    return;
  }
  if (activeScreen === 'details-screen') { showScreen('browse-screen'); if (selectedCard) { selectedCard.focus(); } return; }
  if (activeScreen === 'quick-screen') { clearInterval(quickTimer); showScreen('setup-screen', 'server-url'); return; }
  if (activeScreen === 'browse-screen' && global.tizen && global.tizen.application) { global.tizen.application.getCurrentApplication().exit(); }
}
```

```javascript
storybookView.init({
  onCancelSettings: cancelStorybookSettings,
  onCloseStorybookLibrary: closeStorybookLibrary,
  onModeChange: applyMode,
  onOpenLibrary: openStorybookLibrary,
  onOpenSettings: openStorybookSettings,
  onOpenStorybookItem: function (itemId, source) {
    if (!currentStorybookCatalogue || !currentStorybookCatalogue.itemById[itemId]) { return; }
    openDetails(currentStorybookCatalogue.itemById[itemId], source);
  },
  onResetSettingsRecovery: resetStorybookSettingsRecovery,
  onPreferencesChange: saveStorybookSettings
});
```

- [ ] **Step 5: Add the scoped library-page styling**

Append these selectors to `MovieDeck\css\storybook.css`:

```css
.storybook-library-page {
  padding-top: 160px;
}
.storybook-library-page h1 {
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 58px;
  margin: 0 0 10px;
}
.storybook-library-count {
  color: var(--storybook-muted);
  font-size: 20px;
  margin: 0 0 24px;
}
.storybook-library-cards {
  display: grid;
  gap: 22px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.storybook-library-card {
  align-items: stretch;
  background: rgba(10, 20, 44, .78);
  border: 2px solid rgba(255,255,255,.16);
  border-radius: 32px;
  display: flex;
  min-height: 260px;
  overflow: hidden;
  padding: 0;
  position: relative;
  text-align: left;
}
.storybook-library-card-art,
.storybook-library-card-image,
.storybook-library-card-fallback {
  height: 260px;
  width: 260px;
}
.storybook-library-card-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: 26px 28px;
}
.storybook-library-card:focus {
  box-shadow: 0 0 0 6px var(--storybook-gold), 0 24px 55px rgba(4,9,22,.5);
  outline: 0;
  transform: translateY(-4px);
}
```

- [ ] **Step 6: Re-run the library-page tests and confirm GREEN**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected GREEN output:

```text
All Rawi tests passed.
```

- [ ] **Step 7: Commit the real Story Door library page transition**

```powershell
git add MovieDeck\index.html MovieDeck\js\copy.js MovieDeck\js\storybook-view.js MovieDeck\js\app.js MovieDeck\css\storybook.css MovieDeck\tests\copy.test.js MovieDeck\tests\storybook-view.test.js MovieDeck\tests\storybook-app.test.js
git commit -m "feat: add storybook library pages" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Adult Favorites and Safe Pruning

**Files:**
- Modify: `MovieDeck\index.html:149-162`
- Modify: `MovieDeck\js\copy.js:70-110`
- Modify: `MovieDeck\js\app.js:517-677,749-755`
- Modify: `MovieDeck\tests\copy.test.js:6-112`
- Modify: `MovieDeck\tests\storybook-app.test.js:426-744,1218-1656`

**Interfaces:**
- Consumes: `storybookState.favoriteItemIds`
- Consumes: `RawiStorybookCatalogue.resolve(...).favoriteIdsToPrune` and `.canPruneFavorites`
- Produces internal app helpers: `updateFavoriteButton(item)`, `toggleStorybookFavorite()`, `maybePruneStorybookFavorites(catalogue)`
- Produces persisted version-2 state updates only on explicit save/toggle/prune

- [ ] **Step 1: Add REDs for Adult-details toggling and no-prune-on-partial-refresh**

Append these copy assertions to `MovieDeck\tests\copy.test.js`:

```javascript
(function exposesStorybookFavoriteToggleCopyDefaults() {
  assert.strictEqual(copy.get('storybookFavoriteAddButton'), 'Add to Storybook favorites');
  assert.strictEqual(copy.get('storybookFavoriteRemoveButton'), 'Remove from Storybook favorites');
  assert.strictEqual(
    copy.get('storybookFavoriteAddedToast', { title: 'First Story' }),
    'Added First Story to Storybook favorites.'
  );
  assert.strictEqual(
    copy.get('storybookFavoriteRemovedToast', { title: 'First Story' }),
    'Removed First Story from Storybook favorites.'
  );
}());
```

Add the Adult-details favorite button to the app test DOM builder in `MovieDeck\tests\storybook-app.test.js`:

```javascript
focusable(append(detailsScreen, 'button', 'favorite-button', ''));
```

Extend the app harness copy map with the new button and toast strings:

```javascript
storybookFavoriteAddButton: 'Add to Storybook favorites',
storybookFavoriteRemoveButton: 'Remove from Storybook favorites',
storybookFavoriteAddedToast: 'Added {title} to Storybook favorites.',
storybookFavoriteRemovedToast: 'Removed {title} from Storybook favorites.',
```

Then append these regressions:

```javascript
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
    harness.document.getElementById('hero-open').click();

    assert.strictEqual(
      harness.document.getElementById('favorite-button').textContent,
      'Add to Storybook favorites'
    );
    assert.strictEqual(
      harness.document.getElementById('favorite-button').getAttribute('aria-pressed'),
      'false'
    );

    harness.document.getElementById('favorite-button').click();

    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.savedState().favoriteItemIds)),
      ['story-1']
    );
    assert.strictEqual(
      harness.document.getElementById('favorite-button').textContent,
      'Remove from Storybook favorites'
    );
    assert.strictEqual(
      harness.document.getElementById('favorite-button').getAttribute('aria-pressed'),
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
    harness.document.getElementById('hero-open').click();

    assert.strictEqual(
      harness.document.getElementById('favorite-button').textContent,
      'Remove from Storybook favorites'
    );
    assert.strictEqual(
      harness.document.getElementById('favorite-button').getAttribute('aria-pressed'),
      'true'
    );

    harness.document.getElementById('favorite-button').click();

    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(harness.savedState().favoriteItemIds)),
      []
    );
    assert.strictEqual(
      harness.document.getElementById('favorite-button').textContent,
      'Add to Storybook favorites'
    );
    assert.strictEqual(
      harness.document.getElementById('favorite-button').getAttribute('aria-pressed'),
      'false'
    );
    assert.strictEqual(harness.currentPreferences().lastMode, 'adult');
    assert.strictEqual(harness.screenActive('details-screen'), true);
    assert.strictEqual(harness.screenActive('storybook-screen'), false);
    assert.strictEqual(harness.toastText(), 'Removed First Story from Storybook favorites.');
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
```

- [ ] **Step 2: Run the app tests and verify the current app neither toggles nor safely prunes favorites**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-app.test.js
```

Expected RED output: the new `favorite-button` behavior is absent, `savedState().favoriteItemIds` is `[]` or `null`, and pruning either never happens or would be impossible to distinguish from partial-failure behavior.

- [ ] **Step 3: Add the Adult-details toggle control and copy**

Insert this new button beside the existing Play/Restart buttons inside `.details-actions` in `MovieDeck\index.html`:

```html
<button id="favorite-button"
        class="button button-secondary focusable"
        data-focusable
        aria-pressed="false"
        data-copy="storybookFavoriteAddButton">Add to Storybook favorites</button>
```

Add these defaults to `MovieDeck\js\copy.js`:

```javascript
storybookFavoriteAddButton: 'Add to Storybook favorites',
storybookFavoriteRemoveButton: 'Remove from Storybook favorites',
storybookFavoriteAddedToast: 'Added {title} to Storybook favorites.',
storybookFavoriteRemovedToast: 'Removed {title} from Storybook favorites.',
```

- [ ] **Step 4: Implement favorite toggling and safe pruning in `app.js`**

Add these helpers near the existing details code in `MovieDeck\js\app.js`:

```javascript
function favoriteIds() {
  return copyIds(storybookState.favoriteItemIds);
}

function isStorybookFavorite(item) {
  var id = itemId(item);
  return favoriteIds().indexOf(id) !== -1;
}

function updateFavoriteButton(item) {
  var button = byId('favorite-button');
  var active = !!(item && isStorybookFavorite(item));
  if (!button) { return; }
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.textContent = copy.get(active ? 'storybookFavoriteRemoveButton' : 'storybookFavoriteAddButton');
}

function toggleStorybookFavorite() {
  var id;
  var ids;
  var index;

  if (!selectedItem) { return; }
  id = itemId(selectedItem);
  if (!id) { return; }

  ids = favoriteIds();
  index = ids.indexOf(id);
  if (index === -1) {
    ids.push(id);
    saveStorybookState({ favoriteItemIds: ids });
    updateFavoriteButton(selectedItem);
    showToast(copy.get('storybookFavoriteAddedToast', { title: name(selectedItem) }));
    return;
  }

  ids.splice(index, 1);
  saveStorybookState({ favoriteItemIds: ids });
  updateFavoriteButton(selectedItem);
  showToast(copy.get('storybookFavoriteRemovedToast', { title: name(selectedItem) }));
}

function maybePruneStorybookFavorites(catalogue) {
  var ids;

  if (!catalogue || !catalogue.canPruneFavorites || !catalogue.favoriteIdsToPrune.length) {
    return;
  }

  ids = favoriteIds().filter(function (id) {
    return catalogue.favoriteIdsToPrune.indexOf(String(id)) === -1;
  });

  saveStorybookState({ favoriteItemIds: ids });
}
```

Call the pruning helper inside `openLibrary()` immediately after assigning `currentGroups` / `currentResume` / `currentLatest` and before rendering either mode:

```javascript
currentResume = groups[0];
currentLatest = groups[1];
currentGroups = groups[2];
maybePruneStorybookFavorites(buildStorybookCatalogue());
```

Update `openDetails(item)` so the Adult details button reflects the current item state:

```javascript
updateFavoriteButton(item);
showScreen('details-screen', 'play-button');
```

Register the click handler in `registerEvents()`:

```javascript
byId('favorite-button').addEventListener('click', toggleStorybookFavorite);
```

- [ ] **Step 5: Re-run the favorite-toggle and pruning regressions**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-app.test.js
```

Expected GREEN output:

```text
All Rawi tests passed.
```

- [ ] **Step 6: Commit the curation controls and pruning safety**

```powershell
git add MovieDeck\index.html MovieDeck\js\copy.js MovieDeck\js\app.js MovieDeck\tests\copy.test.js MovieDeck\tests\storybook-app.test.js
git commit -m "feat: add storybook favorites curation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Storybook Details and Shared Playback Routing

**Files:**
- Modify: `MovieDeck\index.html:131-202`
- Modify: `MovieDeck\js\copy.js:78-118`
- Modify: `MovieDeck\js\storybook-view.js:79-239`
- Modify: `MovieDeck\js\app.js:33-35,640-804`
- Modify: `MovieDeck\css\storybook.css:75-192`
- Modify: `MovieDeck\tests\copy.test.js:6-128`
- Modify: `MovieDeck\tests\storybook-view.test.js:159-467`
- Modify: `MovieDeck\tests\storybook-app.test.js:331-744,1255-1696`

**Interfaces:**
- Consumes: `currentStorybookCatalogue.itemById[itemId]`
- Produces: `RawiStorybookView.renderDetails({ accentClass: string, artworkUrl: string, minutesLabel: string, overview: string, progressPercent: number, resumeLabel: string, primaryActionLabel: string, showRestart: boolean, title: string })`
- Produces callbacks: `options.onCloseStorybookDetails()` and `options.onStartStorybookPlayback(fromBeginning)`
- Produces internal playback helpers: `capturePlayerReturnState()`, `returnFromPlayback(completed, error)`, and `playerReturnState = { focusId: string, mode: 'adult'|'storybook', screenId: string }`
- Omits: any separate `backdropUrl` details contract; Phase 2 details only render the scoped artwork slot in this layout
- Preserves: `MovieDeckPlayer.play(item, fromBeginning)` as the only playback entry point, with Adult playback errors unchanged

- [ ] **Step 1: Add full details copy coverage, complete harness DOM/copy plumbing, and remote/back/error REDs**

Append this copy coverage to `MovieDeck\tests\copy.test.js`:

```javascript
(function exposesStorybookDetailsCopyDefaults() {
  assert.strictEqual(copy.get('storybookDetailsBackButton'), '← Storybook');
  assert.strictEqual(copy.get('storybookDetailsKicker'), 'Story time');
  assert.strictEqual(copy.get('storybookStartButton'), 'Start story');
  assert.strictEqual(
    copy.get('storybookResumeButton', { time: '6m' }),
    'Resume from 6m'
  );
}());
```

In `MovieDeck\tests\storybook-view.test.js`, extend `loadViewHarness()` with the full Storybook-details DOM, progress child node, copy stubs, and callback capture:

```javascript
var closeDetailsCount = 0;
var playbackStarts = [];
buttons.detailsAdult = append(document, document.body, 'button', 'storybook-details-adult-mode-button');
buttons.detailsArt = append(document, document.body, 'div', 'storybook-details-art');
buttons.detailsBack = append(document, document.body, 'button', 'storybook-details-back');
buttons.detailsKicker = append(document, document.body, 'p', 'storybook-details-kicker');
buttons.detailsMeta = append(document, document.body, 'p', 'storybook-details-meta');
buttons.detailsOverview = append(document, document.body, 'p', 'storybook-details-overview');
buttons.detailsPlay = append(document, document.body, 'button', 'storybook-details-play');
buttons.detailsProgress = append(document, document.body, 'div', 'storybook-details-progress');
append(document, buttons.detailsProgress, 'span', '');
buttons.detailsRestart = append(document, document.body, 'button', 'storybook-details-restart');
buttons.detailsResume = append(document, document.body, 'p', 'storybook-details-resume');
buttons.detailsStorybook = append(document, document.body, 'button', 'storybook-details-storybook-mode-button');
buttons.detailsTitle = append(document, document.body, 'h1', 'storybook-details-title');
buttons.detailsAdult.setAttribute('data-mode', 'adult');
buttons.detailsStorybook.setAttribute('data-mode', 'storybook');
document.modeButtons = [
  buttons.adult,
  buttons.storybook,
  buttons.libraryAdult,
  buttons.libraryStorybook,
  buttons.detailsAdult,
  buttons.detailsStorybook
];

if (key === 'restartButton') { return 'Start from beginning'; }
if (key === 'storybookDetailsBackButton') { return '← Storybook'; }
if (key === 'storybookDetailsKicker') { return 'Story time'; }
if (key === 'storybookStartButton') { return 'Start story'; }
if (key === 'storybookResumeButton') { return 'Resume from ' + values.time; }

window.RawiStorybookView.init({
  onCancelSettings: function () {},
  onCloseStorybookDetails: function () {
    closeDetailsCount += 1;
  },
  onCloseStorybookLibrary: function () {},
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
  },
  onStartStorybookPlayback: function (fromBeginning) {
    playbackStarts.push(fromBeginning);
  }
});
```

Add `closeDetailsCount: function () { return closeDetailsCount; }` and `playbackStarts: function () { return playbackStarts.slice(); }` to the harness return object, then append this renderer regression:

```javascript
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
```

In the app harness inside `MovieDeck\tests\storybook-app.test.js`, add the full Storybook-details screen DOM, extend the copy map, and make player state observable:

```javascript
var storybookDetailsScreen = append(document.body, 'section', 'storybook-details-screen', 'screen');
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
```

```javascript
storybookDetailsBackButton: '← Storybook',
storybookDetailsKicker: 'Story time',
storybookStartButton: 'Start story',
storybookResumeButton: 'Resume from {time}',
```

```javascript
var playerCallbacks = {};
var playCalls = [];
var stopCalls = [];
var isPlayingState = false;

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
```

Expose them from the harness return block:

```javascript
playCalls: function () {
  return JSON.parse(JSON.stringify(playCalls));
},
playerCallbacks: function () {
  return playerCallbacks;
},
setPlayerPlaying: function (value) {
  isPlayingState = value === true;
},
stopCalls: function () {
  return JSON.parse(JSON.stringify(stopCalls));
},
```

Then append these regressions. Use the remote back key (`keyCode: 10009`) so Storybook details are proven usable without pointer-only navigation:

```javascript
asyncTest('storybookHomeItemsOpenStorybookDetailsInsteadOfAdultDetails', function () {
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
```

- [ ] **Step 2: Run the details-routing tests and capture the current Adult-details leak**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected RED output: Storybook home and library cards still route into the Adult `details-screen`, the remote back key cannot restore the exact prior Storybook focus target, and playback errors still hard-return to Adult details when `player.isPlaying() === false`.

- [ ] **Step 3: Add the dedicated Storybook details screen and copy**

Insert this new section in `MovieDeck\index.html` before the Adult `#details-screen`:

```html
<section id="storybook-details-screen"
         class="screen storybook-screen storybook-details-screen"
         aria-labelledby="storybook-details-title">
  <div class="storybook-sky" aria-hidden="true">
    <span class="storybook-moon"></span>
    <span class="storybook-star star-one">✦</span>
    <span class="storybook-star star-two">✧</span>
    <span class="storybook-star star-three">✦</span>
  </div>
  <header class="storybook-topbar">
    <div class="storybook-wordmark"><i>/</i> <span data-copy="appName">Rawi</span></div>
    <div class="mode-toggle" role="group" aria-label="Display mode">
      <button id="storybook-details-adult-mode-button"
              class="mode-option focusable"
              data-focusable
              data-mode="adult"
              data-copy="modeAdult">Adult</button>
      <button id="storybook-details-storybook-mode-button"
              class="mode-option focusable"
              data-focusable
              data-mode="storybook"
              data-copy="modeStorybook">Storybook</button>
    </div>
  </header>
  <div class="storybook-page storybook-details-page">
    <button id="storybook-details-back"
            class="storybook-edit focusable"
            data-focusable
            data-copy="storybookDetailsBackButton">← Storybook</button>
    <article class="storybook-details-card">
      <div id="storybook-details-art" class="storybook-details-art"></div>
      <div class="storybook-details-copy">
        <p id="storybook-details-kicker" class="storybook-section-title" data-copy="storybookDetailsKicker">Story time</p>
        <h1 id="storybook-details-title"></h1>
        <p id="storybook-details-meta" class="storybook-library-count"></p>
        <div id="storybook-details-progress" class="storybook-card-progress"><span></span></div>
        <p id="storybook-details-resume" class="storybook-card-resume"></p>
        <p id="storybook-details-overview" class="storybook-details-overview"></p>
        <div class="storybook-details-actions">
          <button id="storybook-details-play" class="button button-primary focusable" data-focusable></button>
          <button id="storybook-details-restart" class="button button-secondary focusable" data-focusable data-copy="restartButton">Start from beginning</button>
        </div>
      </div>
    </article>
  </div>
</section>
```

Add these copy defaults to `MovieDeck\js\copy.js`:

```javascript
storybookDetailsBackButton: '← Storybook',
storybookDetailsKicker: 'Story time',
storybookStartButton: 'Start story',
storybookResumeButton: 'Resume from {time}',
```

- [ ] **Step 4: Implement Storybook-details rendering, exact back/focus restoration, and one shared playback-return/error path**

Add `renderDetails()` to `MovieDeck\js\storybook-view.js`:

```javascript
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
```

Add the new callbacks in `init()`:

```javascript
byId('storybook-details-back').addEventListener('click', callbacks.onCloseStorybookDetails);
byId('storybook-details-play').addEventListener('click', function () {
  callbacks.onStartStorybookPlayback(false);
});
byId('storybook-details-restart').addEventListener('click', function () {
  callbacks.onStartStorybookPlayback(true);
});
```

Replace the final export with this complete object so Task 5 does not leave `renderDetails()` off the public API:

```javascript
global.RawiStorybookView = {
  init: init,
  renderDetails: renderDetails,
  renderHome: renderHome,
  renderLibrary: renderLibrary,
  renderSettings: renderSettings,
  setMode: setMode
};
```

Add Storybook-details state and routing to `MovieDeck\js\app.js`:

```javascript
var storybookDetailsState = {
  focusId: '',
  libraryId: '',
  source: 'home'
};
var playerReturnState = {
  focusId: 'play-button',
  mode: 'adult',
  screenId: 'details-screen'
};
var pendingPlaybackError = null;

function storybookDetailsModel(item) {
  return {
    accentClass: storybookAccentClass(itemId(item)),
    artworkUrl: imageUrl(item, 'Primary', 760, 760) || imageUrl(item, 'Backdrop', 1280, 720),

    minutesLabel: runtime(item),
    overview: value(item, 'Overview', 'overview') || copy.get('noSynopsis'),
    primaryActionLabel: resumeTicks(item) > 0 ?
      copy.get('storybookResumeButton', { time: runtimeFromTicks(resumeTicks(item)) }) :
      copy.get('storybookStartButton'),
    progressPercent: playbackPercent(item),
    resumeLabel: resumeTicks(item) > 0 ?
      copy.get('storybookResumeProgress', { time: runtimeFromTicks(resumeTicks(item)) }) :
      '',
    showRestart: resumeTicks(item) > 0,
    title: name(item)
  };
}

function openStorybookDetails(item, source) {
  var id = itemId(item);
  selectedItem = item;
  storybookDetailsState = {
    focusId: source === 'library' ? 'storybook-library-card-' + id : 'storybook-' + source + '-card-' + id,
    libraryId: currentStorybookCatalogue && currentStorybookCatalogue.libraryIdByItemId[id] ?
      currentStorybookCatalogue.libraryIdByItemId[id] : '',
    source: source
  };
  if (source === 'resume') {
    storybookDetailsState.focusId = 'storybook-resume-card';
  }
  showScreen('storybook-details-screen');
  storybookView.renderDetails(storybookDetailsModel(item));
}

function closeStorybookDetails() {
  if (storybookDetailsState.source === 'library') {
    openStorybookLibrary(storybookDetailsState.libraryId, storybookDetailsState.focusId);
    return;
  }
  showScreen('storybook-screen');
  renderStorybookHome(storybookDetailsState.focusId);
}

function capturePlayerReturnState() {
  if (activeScreen === 'storybook-details-screen') {
    playerReturnState = {
      focusId: 'storybook-details-play',
      mode: 'storybook',
      screenId: 'storybook-details-screen'
    };
    return;
  }

  playerReturnState = {
    focusId: 'play-button',
    mode: 'adult',
    screenId: 'details-screen'
  };
}

function returnFromPlayback(completed, error) {
  if (playerReturnState.mode === 'storybook') {
    showScreen('storybook-details-screen');
    storybookView.renderDetails(storybookDetailsModel(selectedItem));
  } else {
    showScreen('details-screen', 'play-button');
  }

  if (error) {
    showToast(describeError(error, copy.get('playbackFailed')));
    return;
  }

  if (completed && playerReturnState.mode === 'adult') {
    showToast(copy.get('finishedToast', { title: name(selectedItem) }));
  }
}
```

Update the existing Storybook item callback registration to use the new screen instead of `openDetails(...)`:

```javascript
onOpenStorybookItem: function (itemId, source) {
  if (!currentStorybookCatalogue || !currentStorybookCatalogue.itemById[itemId]) { return; }
  openStorybookDetails(currentStorybookCatalogue.itemById[itemId], source);
},
onCloseStorybookDetails: closeStorybookDetails,
onStartStorybookPlayback: startPlayback,
```

Then update `startPlayback()`, `playerStopped()`, `handleBack()`, and the player error callback so both the active-stop path and the `player.isPlaying() === false` callback path return to the right details screen:

```javascript
function startPlayback(fromBeginning) {
  if (!selectedItem) { return; }
  capturePlayerReturnState();
  pendingPlaybackError = null;
  showScreen('player-screen');
  player.play(selectedItem, fromBeginning);
}

function playerStopped(completed) {
  var playbackError = pendingPlaybackError;
  pendingPlaybackError = null;
  returnFromPlayback(completed, playbackError);
}
```

```javascript
if (activeScreen === 'player-screen') { returnFromPlayback(false, null); return; }
if (activeScreen === 'storybook-details-screen') { closeStorybookDetails(); return; }
```

```javascript
player.init({
  onStop: playerStopped,
  onError: function (error) {
    if (player.isPlaying()) {
      pendingPlaybackError = error;
      player.stop(false);
      return;
    }
    returnFromPlayback(false, error);
  }
});
```

- [ ] **Step 5: Add scoped Storybook-details styling**

Append these selectors to `MovieDeck\css\storybook.css`:

```css
.storybook-details-page {
  padding-top: 150px;
}
.storybook-details-card {
  align-items: center;
  display: flex;
  gap: 42px;
}
.storybook-details-art {
  border-radius: 34px;
  overflow: hidden;
  width: 540px;
}
.storybook-details-artwork-art,
.storybook-details-artwork-image,
.storybook-details-artwork-fallback {
  height: 760px;
  width: 540px;
}
.storybook-details-copy {
  max-width: 760px;
}
.storybook-details-copy h1 {
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 60px;
  line-height: 1.12;
  margin: 0 0 14px;
}
.storybook-details-overview {
  color: var(--storybook-ink);
  line-height: 1.5;
  margin: 20px 0 0;
}
.storybook-details-actions {
  display: flex;
  gap: 16px;
  margin-top: 26px;
}
```

- [ ] **Step 6: Re-run the details tests and confirm GREEN**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected GREEN output:

```text
All Rawi tests passed.
```

- [ ] **Step 7: Commit Storybook details and shared-player routing**

```powershell
git add MovieDeck\index.html MovieDeck\js\copy.js MovieDeck\js\storybook-view.js MovieDeck\js\app.js MovieDeck\css\storybook.css MovieDeck\tests\copy.test.js MovieDeck\tests\storybook-view.test.js MovieDeck\tests\storybook-app.test.js
git commit -m "feat: add storybook details routing" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Gentle Ending Screen

**Files:**
- Modify: `MovieDeck\index.html:163-202`
- Modify: `MovieDeck\js\copy.js:82-126`
- Modify: `MovieDeck\js\storybook-view.js:79-239`
- Modify: `MovieDeck\js\app.js:677-804`
- Modify: `MovieDeck\css\storybook.css:120-192`
- Modify: `MovieDeck\tests\copy.test.js:6-156`
- Modify: `MovieDeck\tests\storybook-view.test.js:159-467`
- Modify: `MovieDeck\tests\storybook-app.test.js:331-744,1255-1696`

**Interfaces:**
- Consumes: `playerReturnState.mode` and `returnFromPlayback(completed, error)` from Task 5
- Produces: `RawiStorybookView.renderEnding({ childName: string, title: string })`
- Produces callback: `options.onStorybookEndingAction(action)` where `action` is `'done'` or `'pick'`
- Finalizes: one shared `showScreen()` reduced-motion gate for `storybook-screen`, `storybook-library-screen`, `storybook-details-screen`, and `storybook-ending-screen`, while keeping `storybook-settings-screen` entry behavior explicit
- Preserves: Adult completion behavior exactly as `details-screen` + `finishedToast`

- [ ] **Step 1: Add ending-copy coverage plus REDs for completed Storybook playback and browser/Tizen ending semantics**

Append this copy coverage to `MovieDeck\tests\copy.test.js`:

```javascript
(function exposesStorybookEndingCopyDefaults() {
  assert.strictEqual(
    copy.get('storybookEndingTitle', { child: 'Nova' }),
    'All done, Nova.'
  );
  assert.strictEqual(copy.get('storybookEndingTitleWithoutName'), 'All done.');
  assert.strictEqual(
    copy.get('storybookEndingBody', { title: 'First Story' }),
    'That was First Story. Would you like to pick another story?'
  );
  assert.strictEqual(copy.get('storybookEndingPrimaryButton'), 'All done');
  assert.strictEqual(copy.get('storybookEndingSecondaryButton'), 'Pick another');
}());
```

Extend the view test harness DOM in `MovieDeck\tests\storybook-view.test.js` by adding `var endingActions = [];` beside the Task 5 playback helpers, then capture ending actions:

```javascript
var endingActions = [];
buttons.endingTitle = append(document, document.body, 'h1', 'storybook-ending-title');
buttons.endingBody = append(document, document.body, 'p', 'storybook-ending-body');
buttons.endingPrimary = append(document, document.body, 'button', 'storybook-ending-all-done');
buttons.endingSecondary = append(document, document.body, 'button', 'storybook-ending-pick-another');

if (key === 'storybookEndingTitle') { return 'All done, ' + values.child + '.'; }
if (key === 'storybookEndingTitleWithoutName') { return 'All done.'; }
if (key === 'storybookEndingBody') {
  return 'That was ' + values.title + '. Would you like to pick another story?';
}
if (key === 'storybookEndingPrimaryButton') { return 'All done'; }
if (key === 'storybookEndingSecondaryButton') { return 'Pick another'; }

window.RawiStorybookView.init({
  onCancelSettings: function () {},
  onCloseStorybookDetails: function () {},
  onCloseStorybookLibrary: function () {},
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
  },
  onStartStorybookPlayback: function (fromBeginning) {
    playbackStarts.push(fromBeginning);
  },
  onStorybookEndingAction: function (action) {
    endingActions.push(action);
  }
});
```

Add `endingActions: function () { return endingActions.slice(); }` to the harness return object, then append this renderer test:

```javascript
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
```

Add these screen nodes and copy stubs to the app harness `buildDom(document)` in `MovieDeck\tests\storybook-app.test.js`:

```javascript
var storybookEndingScreen = append(document.body, 'section', 'storybook-ending-screen', 'screen');
append(storybookEndingScreen, 'h1', 'storybook-ending-title', '');
append(storybookEndingScreen, 'p', 'storybook-ending-body', '');
focusable(append(storybookEndingScreen, 'button', 'storybook-ending-all-done', ''));
focusable(append(storybookEndingScreen, 'button', 'storybook-ending-pick-another', ''));
```

```javascript
storybookEndingTitle: 'All done, {child}.',
storybookEndingTitleWithoutName: 'All done.',
storybookEndingBody: 'That was {title}. Would you like to pick another story?',
storybookEndingPrimaryButton: 'All done',
storybookEndingSecondaryButton: 'Pick another',
```

Inside `loadAppHarness(options)`, after `window.localStorage = localStorage;`, add the system reduced-motion stub so the shared screen-entry gate is exercised through `showScreen()` instead of only through saved preferences:

```javascript
window.matchMedia = function (query) {
  return {
    matches: query === '(prefers-reduced-motion: reduce)' && options.prefersReducedMotion === true
  };
};
```

Then append these app regressions:

```javascript
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
```

- [ ] **Step 2: Run the completion-flow tests and capture the current Adult toast leak**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected RED output: completed Storybook playback still falls back through Task 5's `returnFromPlayback(...)` to `storybook-details-screen` or an Adult-style toast because there is no ending screen yet, and the new reduced-motion regression still sees `screenEntries()` include `storybook-library-screen`, `storybook-details-screen`, or `storybook-ending-screen` because `showScreen()` currently suppresses `animations.enterScreen(...)` only for `storybook-screen`.

- [ ] **Step 3: Add the ending screen markup and copy**

Insert this new screen in `MovieDeck\index.html` after the Storybook details screen. Do not add a `storybook-topbar` or any `[data-mode]` buttons here; the ending and player screens must stay toggle-free:

```html
<section id="storybook-ending-screen"
         class="screen storybook-screen storybook-ending-screen"
         aria-labelledby="storybook-ending-title">
  <div class="storybook-sky" aria-hidden="true">
    <span class="storybook-moon"></span>
    <span class="storybook-star star-one">✦</span>
    <span class="storybook-star star-two">✧</span>
    <span class="storybook-star star-three">✦</span>
  </div>
  <div class="storybook-page storybook-ending-page">
    <div class="storybook-ending-card">
      <h1 id="storybook-ending-title"></h1>
      <p id="storybook-ending-body"></p>
      <div class="storybook-details-actions">
        <button id="storybook-ending-all-done" class="button button-primary focusable" data-focusable data-copy="storybookEndingPrimaryButton">All done</button>
        <button id="storybook-ending-pick-another" class="button button-secondary focusable" data-focusable data-copy="storybookEndingSecondaryButton">Pick another</button>
      </div>
    </div>
  </div>
</section>
```

Add these copy defaults in `MovieDeck\js\copy.js`:

```javascript
storybookEndingTitle: 'All done, {child}.',
storybookEndingTitleWithoutName: 'All done.',
storybookEndingBody: 'That was {title}. Would you like to pick another story?',
storybookEndingPrimaryButton: 'All done',
storybookEndingSecondaryButton: 'Pick another',
```

- [ ] **Step 4: Implement the ending renderer and route completed Storybook playback into the shared return helper**

Add `renderEnding()` to `MovieDeck\js\storybook-view.js`:

```javascript
function renderEnding(model) {
  byId('storybook-ending-title').textContent = model.childName ?
    copy.get('storybookEndingTitle', { child: model.childName }) :
    copy.get('storybookEndingTitleWithoutName');
  byId('storybook-ending-body').textContent = copy.get('storybookEndingBody', { title: model.title });
  focusWhenReady(byId('storybook-ending-all-done'));
}
```

Register the new buttons in `init()`:

```javascript
byId('storybook-ending-all-done').addEventListener('click', function () {
  callbacks.onStorybookEndingAction('done');
});
byId('storybook-ending-pick-another').addEventListener('click', function () {
  callbacks.onStorybookEndingAction('pick');
});
```

Replace the final export with this complete object so the ending renderer is available as soon as Task 6 lands:

```javascript
global.RawiStorybookView = {
  init: init,
  renderDetails: renderDetails,
  renderEnding: renderEnding,
  renderHome: renderHome,
  renderLibrary: renderLibrary,
  renderSettings: renderSettings,
  setMode: setMode
};
```

Update `MovieDeck\js\app.js`. Replace the current home-only `showScreen()` reduced-motion guard with this shared ES5 helper before applying the ending routing changes:

```javascript
var STORYBOOK_PRESENTATION_SCREENS = {
  'storybook-screen': true,
  'storybook-library-screen': true,
  'storybook-details-screen': true,
  'storybook-ending-screen': true
};

function shouldAnimateScreenEntry(id) {
  if (id === 'storybook-settings-screen') {
    return true;
  }
  if (STORYBOOK_PRESENTATION_SCREENS[id]) {
    return !isStorybookReducedMotion();
  }
  return true;
}

function showScreen(id, focusId) {
  if (activeScreen === 'storybook-screen' &&
      id !== 'storybook-screen' &&
      animations.stopStorybookHome) {
    animations.stopStorybookHome();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (screen) {
    screen.classList.toggle('is-active', screen.id === id);
  });
  activeScreen = id;
  if (animations.enterScreen && shouldAnimateScreenEntry(id)) {
    animations.enterScreen(byId(id));
  }
  if (focusId) { focusScreenTarget(focusId); }
}

function showStorybookEnding() {
  showScreen('storybook-ending-screen');
  storybookView.renderEnding({
    childName: storybookState.childName,
    title: name(selectedItem)
  });
}

function handleStorybookEndingAction(action) {
  if (action === 'done' && global.tizen && global.tizen.application && global.tizen.application.getCurrentApplication) {
    global.tizen.application.getCurrentApplication().exit();
    return;
  }

  showScreen('storybook-screen');
  renderStorybookHome();
}

function returnFromPlayback(completed, error) {
  if (error) {
    if (playerReturnState.mode === 'storybook') {
      showScreen('storybook-details-screen');
      storybookView.renderDetails(storybookDetailsModel(selectedItem));
    } else {
      showScreen('details-screen', 'play-button');
    }
    showToast(describeError(error, copy.get('playbackFailed')));
    return;
  }

  if (playerReturnState.mode === 'storybook') {
    if (completed) {
      showStorybookEnding();
      return;
    }
    showScreen('storybook-details-screen');
    storybookView.renderDetails(storybookDetailsModel(selectedItem));
    return;
  }

  showScreen('details-screen', 'play-button');
  if (completed) { showToast(copy.get('finishedToast', { title: name(selectedItem) })); }
}
```

Handle the back button on the ending screen like **Pick another**:

```javascript
if (activeScreen === 'storybook-ending-screen') {
  handleStorybookEndingAction('pick');
  return;
}
```

Register the callback in `init()`:

```javascript
onStorybookEndingAction: handleStorybookEndingAction,
```

- [ ] **Step 5: Add scoped ending-screen styling**

Append these selectors to `MovieDeck\css\storybook.css`:

```css
.storybook-ending-page {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 100%;
}
.storybook-ending-card {
  background: rgba(11, 23, 51, .86);
  border: 2px solid rgba(255,255,255,.16);
  border-radius: 40px;
  box-shadow: 0 28px 70px rgba(4,9,22,.35);
  max-width: 860px;
  padding: 54px 60px;
  text-align: center;
}
.storybook-ending-card h1 {
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 58px;
  margin: 0 0 18px;
}
.storybook-ending-card p {
  color: var(--storybook-ink);
  line-height: 1.45;
  margin: 0 0 30px;
}
```

- [ ] **Step 6: Re-run the completion tests and confirm GREEN**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected GREEN output:

```text
All Rawi tests passed.
```

- [ ] **Step 7: Commit the gentle-ending behavior**

```powershell
git add MovieDeck\index.html MovieDeck\js\copy.js MovieDeck\js\storybook-view.js MovieDeck\js\app.js MovieDeck\css\storybook.css MovieDeck\tests\copy.test.js MovieDeck\tests\storybook-view.test.js MovieDeck\tests\storybook-app.test.js
git commit -m "feat: add storybook ending screen" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Deterministic Preview, Documentation, and Signed Package-Only Validation

**Files:**
- Modify: `MovieDeck\js\preview-fixtures.js:1-38`
- Modify: `MovieDeck\js\app.js:33-68,359-387,776-804`
- Modify: `tools\Start-RawiPreview.ps1:1-133`
- Modify: `README.md:31-58,70-93,131-160`
- Modify: `MovieDeck\tests\storybook-model.test.js:1-47`
- Modify: `MovieDeck\tests\storybook-app.test.js:750-889,1255-1656`
- Final release bump only: `MovieDeck\config.xml`, `MovieDeck\js\api.js` via `tools\Deploy-Rawi.ps1 -PackageOnly`

**Interfaces:**
- Produces preview query contract: `?preview=storybook&storybookScreen=home|library|details|ending&storybookLibraryId=<id>&storybookItemId=<id>`
- Produces preview launcher contract: `.\tools\Start-RawiPreview.ps1 -StorybookMock [-StorybookScreen home|library|details|ending] [-StorybookLibraryId <id>] [-StorybookItemId <id>]`
- Consumes: `RawiPreviewFixtures.storybook.preferences`, `.resume`, `.groups`, `.libraries`
- Preserves: zero Jellyfin traffic in preview mode and no visible production-only completion control

- [ ] **Step 1: Add REDs for routed Storybook preview states without Jellyfin**

Replace the minimal fixture expectations in `MovieDeck\tests\storybook-model.test.js` with this richer preview check:

```javascript
(function exposesDeterministicStorybookPreviewFixture() {
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(previewFixtures.storybook.preferences)),
    {
      version: 2,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['pixar', 'songs', 'lessons'],
      favoriteItemIds: ['dance', 'colors'],
      reducedMotion: false
    }
  );
  assert.strictEqual(previewFixtures.storybook.resume[0].Id, 'bluey');
  assert.strictEqual(previewFixtures.storybook.groups.length, 4);
}());
```

Append these preview-route regressions to `MovieDeck\tests\storybook-app.test.js`:

```javascript
asyncTest('previewRoutesCanOpenHomeLibraryDetailsAndEndingWithoutJellyfin', function () {
  var fixture = {
    storybook: {
      user: { Id: 'preview-user', Name: 'Parent' },
      preferences: {
        version: 2,
        enabled: true,
        lastMode: 'storybook',
        childName: 'Nova',
        libraryIds: ['pixar', 'songs', 'lessons'],
        favoriteItemIds: ['dance', 'colors'],
        reducedMotion: false
      },
      libraries: [
        { Id: 'pixar', Name: 'Disney Pixar' },
        { Id: 'songs', Name: 'Sing & Dance' },
        { Id: 'lessons', Name: 'Little Lessons' },
        { Id: 'grownups', Name: 'Grownups' }
      ],
      resume: [
        {
          Id: 'bluey',
          Name: "Bluey's Big Adventure",
          RunTimeTicks: 16800000000,
          UserData: { PlaybackPositionTicks: 3600000000, PlayedPercentage: 21 }
        }
      ],
      groups: [
        {
          id: 'pixar',
          name: 'Disney Pixar',
          videos: [{ Id: 'bluey', Name: "Bluey's Big Adventure", RunTimeTicks: 16800000000, UserData: { PlaybackPositionTicks: 3600000000, PlayedPercentage: 21 } }]
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
        },
        {
          id: 'grownups',
          name: 'Grownups',
          videos: [{ Id: 'late', Name: 'Late Night Movie', RunTimeTicks: 9600000000 }]
        }
      ]
    }
  };
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
    assert.strictEqual(homeHarness.document.getElementById('storybook-resume-card').getAttribute('data-item-id'), 'bluey');
    assert.strictEqual(homeHarness.document.getElementById('storybook-favorites').children.length, 2);

    assert.strictEqual(libraryHarness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(libraryHarness.document.getElementById('storybook-library-title').textContent, 'Sing & Dance');

    assert.strictEqual(detailsHarness.screenActive('storybook-details-screen'), true);
    assert.strictEqual(detailsHarness.document.getElementById('storybook-details-title').textContent, "Bluey's Big Adventure");

    assert.strictEqual(endingHarness.screenActive('storybook-ending-screen'), true);
    assert.strictEqual(endingHarness.document.getElementById('storybook-ending-title').textContent, 'All done, Nova.');

    assert.deepStrictEqual(homeHarness.apiCalls(), {
      getLatest: 0,
      getLibraries: 0,
      getResume: 0,
      getVideos: 0,
      restore: 0
    });
  });
});
```

- [ ] **Step 2: Run the preview-state tests and capture the missing routed preview behavior**

Run:

```powershell
node .\MovieDeck\tests\run-tests.js storybook-model.test.js storybook-app.test.js
```

Expected RED output: the preview fixture is still minimal, and `storybookScreen=library|details|ending` either does nothing or lands on the wrong screen.

- [ ] **Step 3: Expand the deterministic preview fixture and preview routing in `app.js`**

Replace `MovieDeck\js\preview-fixtures.js` with this richer fixture:

```javascript
(function (global) {
  'use strict';

  global.RawiPreviewFixtures = {
    storybook: {
      user: { Id: 'preview-user', Name: 'Parent' },
      preferences: {
        version: 2,
        enabled: true,
        lastMode: 'storybook',
        childName: 'Nova',
        libraryIds: ['pixar', 'songs', 'lessons'],
        favoriteItemIds: ['dance', 'colors'],
        reducedMotion: false
      },
      libraries: [
        { Id: 'pixar', Name: 'Disney Pixar' },
        { Id: 'songs', Name: 'Sing & Dance' },
        { Id: 'lessons', Name: 'Little Lessons' },
        { Id: 'grownups', Name: 'Grownups' }
      ],
      resume: [
        {
          Id: 'bluey',
          Name: "Bluey's Big Adventure",
          Overview: 'Bluey follows a moonlit map through the backyard.',
          PreviewBackdropUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='%23172543'/><circle cx='6.2' cy='1.8' r='1.2' fill='%23f2cf7c'/></svg>",
          PreviewImageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='%23657db9'/><rect x='1' y='4.2' width='6' height='2.2' fill='%23fff8df'/></svg>",
          RunTimeTicks: 16800000000,
          UserData: { PlaybackPositionTicks: 3600000000, PlayedPercentage: 21 }
        }
      ],
      groups: [
        {
          id: 'pixar',
          name: 'Disney Pixar',
          videos: [
            {
              Id: 'bluey',
              Name: "Bluey's Big Adventure",
              Overview: 'Bluey follows a moonlit map through the backyard.',
              PreviewBackdropUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='%23172543'/><circle cx='6.2' cy='1.8' r='1.2' fill='%23f2cf7c'/></svg>",
              PreviewImageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='%23657db9'/><rect x='1' y='4.2' width='6' height='2.2' fill='%23fff8df'/></svg>",
              RunTimeTicks: 16800000000,
              UserData: { PlaybackPositionTicks: 3600000000, PlayedPercentage: 21 }
            }
          ]
        },
        {
          id: 'songs',
          name: 'Sing & Dance',
          videos: [
            { Id: 'dance', Name: 'Dance With Me', RunTimeTicks: 7200000000 }
          ]
        },
        {
          id: 'lessons',
          name: 'Little Lessons',
          videos: [
            { Id: 'colors', Name: 'The Color Garden', RunTimeTicks: 5400000000 }
          ]
        },
        {
          id: 'grownups',
          name: 'Grownups',
          videos: [
            { Id: 'late', Name: 'Late Night Movie', RunTimeTicks: 9600000000 }
          ]
        }
      ]
    }
  };
}(window));
```

Update `startStorybookPreview()` in `MovieDeck\js\app.js` so it consumes the richer fixture without saving it immediately:

```javascript
function previewStorybookState(fixture) {
  var preferences = fixture && fixture.preferences ? fixture.preferences : {};
  return {
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: typeof preferences.childName === 'string' ? preferences.childName : 'Nova',
    libraryIds: Array.isArray(preferences.libraryIds) ? preferences.libraryIds.slice() : previewLibraryIds(),
    favoriteItemIds: Array.isArray(preferences.favoriteItemIds) ? preferences.favoriteItemIds.slice() : [],
    reducedMotion: preferences.reducedMotion === true
  };
}

function previewLibraryLoadState() {
  var requests = {};
  var ids = previewLibraryIds();
  ids.forEach(function (id) {
    requests[id] = { complete: true, succeeded: true };
  });
  return {
    viewsSucceeded: true,
    requestedLibraryIds: ids,
    videoRequests: requests
  };
}

function previewItemById(id) {
  var catalogue = buildStorybookCatalogue();
  return catalogue.itemById[id] || catalogue.resumeItem || null;
}

function storybookPreviewScreen() {
  var value = queryValue('storybookScreen');
  if (value === 'library' || value === 'details' || value === 'ending') {
    return value;
  }
  return 'home';
}

function applyStorybookPreviewRoute() {
  var screen = storybookPreviewScreen();
  var libraryId = queryValue('storybookLibraryId') || storybookState.libraryIds[0] || '';
  var item = previewItemById(queryValue('storybookItemId'));

  if (screen === 'library') {
    openStorybookLibrary(libraryId);
    return;
  }
  if (screen === 'details' && item) {
    openStorybookDetails(item, 'resume');
    return;
  }
  if (screen === 'ending' && item) {
    selectedItem = item;
    showStorybookEnding();
    return;
  }

  showScreen('storybook-screen');
  renderStorybookHome();
}

function startStorybookPreview() {
  var fixture = global.RawiPreviewFixtures.storybook;

  previewStorybookFixture = fixture;
  api.user = fixture.user;
  updateProfile();
  availableLibraries = fixture.libraries || [];
  availableLibrariesReady = true;
  availableLibrariesFailed = false;
  availableLibrariesLoading = false;
  currentGroups = previewGroups();
  currentLatest = fixture.latest || [];
  currentResume = fixture.resume || [];
  currentLibraryLoadState = previewLibraryLoadState();
  storybookRestoreStatus = { needsRecovery: false, type: 'ok' };
  storybookResetConfirming = false;
  storybookState = previewStorybookState(fixture);
  storybookView.setMode('storybook');
  applyStorybookPreviewRoute();
}
```

- [ ] **Step 4: Extend the preview launcher and README for browser acceptance**

Update `tools\Start-RawiPreview.ps1` to accept routed Storybook preview states:

```powershell
param(
    [Parameter(Mandatory = $false)]
    [int]$Port = 4173,

    [Parameter(Mandatory = $false)]
    [switch]$StorybookMock,

    [Parameter(Mandatory = $false)]
    [ValidateSet('home', 'library', 'details', 'ending')]
    [string]$StorybookScreen = 'home',

    [Parameter(Mandatory = $false)]
    [string]$StorybookLibraryId,

    [Parameter(Mandatory = $false)]
    [string]$StorybookItemId,

    [Parameter(Mandatory = $false)]
    [switch]$Stop
)

$url = "http://127.0.0.1:$Port/"
if ($StorybookMock) {
    $query = @('preview=storybook')
    if ($StorybookScreen -and $StorybookScreen -ne 'home') {
        $query += 'storybookScreen=' + [uri]::EscapeDataString($StorybookScreen)
    }
    if ($StorybookLibraryId) {
        $query += 'storybookLibraryId=' + [uri]::EscapeDataString($StorybookLibraryId)
    }
    if ($StorybookItemId) {
        $query += 'storybookItemId=' + [uri]::EscapeDataString($StorybookItemId)
    }
    $url += '?' + ($query -join '&')
}
```

Update the Storybook section of `README.md` with this exact Phase 2 guidance:

````markdown
### Storybook Phase 2 preview routes

```powershell
.\tools\Start-RawiPreview.ps1 -StorybookMock
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen library -StorybookLibraryId songs
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen details -StorybookItemId bluey
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen ending -StorybookItemId bluey
```

Use Adult Mode details to add or remove Storybook favorites. In a browser preview,
**All done** returns to Storybook home because the browser does not expose the
Tizen app-exit API. On TV, **All done** exits the app.
````

- [ ] **Step 5: Run the full automated suite, then browser-preview acceptance, then the single signed package-only release validation**

Run the full suite first:

```powershell
node .\MovieDeck\tests\run-tests.js
```

Expected GREEN output:

```text
All Rawi tests passed.
```

Start each routed preview state and manually verify the visible screen, focus target, and no-Jellyfin behavior:

```powershell
.\tools\Start-RawiPreview.ps1 -StorybookMock
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen library -StorybookLibraryId songs
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen details -StorybookItemId bluey
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen ending -StorybookItemId bluey
.\tools\Start-RawiPreview.ps1 -Stop
```

Expected browser acceptance:

1. Home shows **Continue Nova's Story**, **Nova's Favorites**, and only selected Story Doors.
2. Library route opens the simplified Storybook page, not Adult shelves.
3. Details route opens Storybook-only details with resume/restart.
4. Ending route shows **All done** and **Pick another** with no countdown and no autoplay.
5. DevTools/network shows no Jellyfin requests in preview mode.

**Package inspection entries for Phase 2 runtime assets**

| Package entry | What it must prove |
|---|---|
| `config.xml` | version `0.1.12`, app ID `JfMovieTV1.MovieDeck`, package ID `JfMovieTV1` |
| `js/api.js` | `CLIENT_VERSION` advanced to `0.1.12` |
| `index.html` | Storybook library/details/ending screens are wired |
| `js/storybook-catalogue.js` | new runtime catalogue resolver is packaged |
| `js/storybook-view.js` | Storybook home/library/details/ending renderer is packaged |
| `js/app.js` | Storybook routing and shared-player return logic is packaged |
| `js/preview-fixtures.js` | deterministic preview scenarios are packaged |
| `css/storybook.css` | scoped Storybook Phase 2 styles are packaged |

Run the one release packaging command only after everything else is green:

```powershell
.\tools\Deploy-Rawi.ps1 -PackageOnly
```

Expected GREEN output includes both of these lines:

```text
Packaging Rawi 0.1.12...
Package ready: C:\Code\Rawi\dist\Rawi.wgt
```

Then inspect the package contents and version metadata:

```powershell
powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('C:\Code\Rawi\dist\Rawi.wgt'); try { $required = @('config.xml','index.html','css/storybook.css','js/storybook-catalogue.js','js/storybook-view.js','js/app.js','js/preview-fixtures.js','js/api.js'); foreach ($entry in $required) { if (-not ($zip.Entries | Where-Object FullName -eq $entry)) { throw ('Missing package entry: ' + $entry) } Write-Host ('OK ' + $entry) } $configReader = New-Object System.IO.StreamReader(($zip.GetEntry('config.xml')).Open()); try { $configText = $configReader.ReadToEnd() } finally { $configReader.Dispose() } if ($configText -notmatch 'version=\"0\.1\.12\"') { throw 'Expected config.xml version 0.1.12.' } if ($configText -notmatch 'id=\"JfMovieTV1\.MovieDeck\" package=\"JfMovieTV1\"') { throw 'Application/package ID changed.' } $apiReader = New-Object System.IO.StreamReader(($zip.GetEntry('js/api.js')).Open()); try { $apiText = $apiReader.ReadToEnd() } finally { $apiReader.Dispose() } if ($apiText -notmatch \"var CLIENT_VERSION = '0\.1\.12';\") { throw 'Expected CLIENT_VERSION 0.1.12.' } } finally { $zip.Dispose() }"
```

Expected GREEN output starts with these exact package-entry confirmations and ends without errors:

```text
OK config.xml
OK index.html
OK css/storybook.css
OK js/storybook-catalogue.js
```

- [ ] **Step 6: Commit the preview/docs/release-validation slice, including the version bump produced by the packaging script**

```powershell
git add README.md MovieDeck\config.xml MovieDeck\index.html MovieDeck\js\api.js MovieDeck\js\app.js MovieDeck\js\preview-fixtures.js MovieDeck\js\storybook-view.js MovieDeck\js\copy.js MovieDeck\css\storybook.css MovieDeck\tests\storybook-model.test.js MovieDeck\tests\storybook-app.test.js tools\Start-RawiPreview.ps1
git commit -m "feat: complete storybook phase 2" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Phase 2 Completion Gate

| Required Phase 2 behavior | Task(s) | Proof |
|---|---|---|
| Story Doors open true simplified Storybook library pages instead of Adult shelves, including empty-library cases | 3 | `opensStoryDoorOnStorybookLibraryScreenAndBackRestoresStorybookHome`, `opensEmptyStoryDoorWithExistingNoVideosRecoveryState`, `clearsStaleHeroStateWhenOpeningAnEmptyStoryDoorAfterSelectingAnAdultItem`, browser `-StorybookScreen library` preview |
| Continue Nova's Story shows the single most-recent resumable item from selected libraries with runtime minutes, visible progress, resume position, and a Storybook-details route | 2, 5 | `rendersStorybookHomeResumeAndFavoritesFromSelectedLibrariesOnly`, `storybookHomeItemsOpenStorybookDetailsInsteadOfAdultDetails`, `storybookDetailsBackKeyRestoresHomeFavoriteFocus` |
| Nova's Favorites persist in versioned preferences, display only resolved/selected items, and ignore missing items until a fully successful refresh | 1, 2, 4 | `migratesVersion1PreferencesWithoutRecoveryOrImmediateRewrite`, `adultDetailsCanToggleStorybookFavoritesAndStorybookHomeShowsThem`, `doesNotPruneFavoritesAfterToleratedLibraryFailures`, `prunesMissingFavoritesAfterFullySuccessfulCatalogueRefresh` |
| Storybook details use a separate simplified screen, restore the exact prior Storybook focus target on Back, and keep Adult details separate | 5 | `rendersStorybookDetailsWithResumeAndRestart`, `storybookHomeItemsOpenStorybookDetailsInsteadOfAdultDetails`, `storybookLibraryDetailsBackKeyRestoresPriorLibraryCardFocus` |
| Storybook completion shows a gentle ending screen with **All done** and **Pick another**, no countdown, and no autoplay | 6 | `storybookCompletionShowsEndingScreenWithoutToastOrAutoplay`, `storybookEndingBackKeyActsLikePickAnother`, browser `-StorybookScreen ending` preview |
| Shared player/auth/progress logic remains single-sourced, and Storybook playback errors return to Storybook details while Adult errors stay unchanged | 5, 6 | `playCalls()` assertions prove Storybook still uses `MovieDeckPlayer.play(item, fromBeginning)`, `storybookPlaybackErrorWhilePlayerActiveReturnsToStorybookDetails`, `storybookPlaybackErrorCallbackStillReturnsToStorybookDetailsWhenPlayerAlreadyStopped`, `adultPlaybackErrorsStillReturnToAdultDetails` |
| Deterministic `?preview=storybook` stays working through the intermediate home refactor and covers home/library/details/ending without Jellyfin by the end | 2, 7 | `previewRoutesCanOpenHomeLibraryDetailsAndEndingWithoutJellyfin`, preview launcher commands |
| Adult Mode layout/copy/navigation/auth/playback remain unchanged | 2-6 | existing full-suite Adult regressions plus `adultCompletionStillReturnsToAdultDetailsAndShowsToast` |
| Signed package-only release validation increments once to `0.1.12` and preserves IDs | 7 | `.\tools\Deploy-Rawi.ps1 -PackageOnly` plus package-inspection command |

## Explicitly Deferred to Later Phases

- **Phase 3:** Tonight's Little Menu.
- **Phase 3:** Magic Pick and its confirmation card.
- **Phase 3:** Friendly duration labels beyond the current `runtimeMinutes` minute count.
- **Phase 3:** Jellyfin tag categories and category-driven discovery.
- **Phase 4:** Quiet-time filters.
- **Phase 4:** Subtle sound cues.
- **Phase 4:** Additional configurable library-presentation treatments beyond deterministic accent selection and existing copy settings.

## Self-Review

- **Spec coverage:** Every requested Phase 2 deliverable maps to a task and a proof path, and `copy.test.js` now explicitly covers each new Task 2/3/4/5/6 key—including the add/remove favorite toast strings with populated placeholders—plus the placeholder-bearing home, library, details, and ending copy branches.
- **Final placeholder/interface self-review:** I re-checked for deferred-work markers, vague follow-up wording, cross-task shorthand, and steps that mention a change without showing the exact code or command; the last unused details field (`backdropUrl`) is now removed from Task 5's interfaces/tests/rendering, and no unresolved placeholders remain.
- **Type/interface consistency:** `favoriteItemIds` stays the only version-2 favorite field; the Storybook mode toggles use one shared `data-mode` contract with unique home/library/details button IDs; `RawiStorybookCatalogue.resolve(...)`, `renderHome(...)`, `renderLibrary(...)`, `renderDetails(...)`, `renderEnding(...)`, `previewStorybookState(...)`, `previewLibraryLoadState()`, and `returnFromPlayback(completed, error)` keep one consistent property/signature set; the shared reduced-motion gate now names all four Storybook presentation screens while leaving settings explicit; and each renderer task updates the full `global.RawiStorybookView` export object so later steps never call an undefined method.
- **Task independence:** Each task still ends with its own focused RED/GREEN loop; Task 2 includes interim preview/data-shape adapters so preview is not broken mid-phase, Task 3 now deletes the obsolete `storybookLibraryOpen` browse-screen bridge in the same task that introduces the dedicated library page, and Task 6 adds the shared presentation-screen reduced-motion gate only once all four Storybook presentation screens exist.
- **Exact current-code assumptions:** This revision is grounded in today's repo state: `MovieDeck\index.html` currently has only `#storybook-screen` plus the Adult `#details-screen`; `MovieDeck\tests\storybook-preferences.test.js` still expects version 1/no `favoriteItemIds`; and `MovieDeck\tests\storybook-app.test.js` currently lacks the Storybook home/library/details/ending harness nodes and still contains version-1-shaped saved-state assertions. The plan now names every required replacement explicitly so the intended REDs stay behavior-based.
