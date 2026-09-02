# Storybook Mode Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Rawi Storybook Mode Phase 3 with stable guided discovery: version-3 Storybook preferences, tag-backed friendly categories, friendly duration labels, a stable Tonight's Little Menu, Magic Pick confirmation, deterministic preview routes, and package-only release validation without changing Adult Mode behavior.

**Architecture:** Keep Jellyfin authentication, catalogue loading, playback negotiation, AVPlay/browser fallback, and progress reporting shared. Add one focused pure module, `MovieDeck\js\storybook-discovery.js`, that derives recent completion, stable session menu choices, friendly category groupings, and Magic Pick scoring from the already-loaded Storybook catalogue plus version-3 preferences; then keep `MovieDeck\js\app.js` orchestration-only by preserving every v3 preference field, capturing one Storybook launch bootstrap (`nowMs` + `storybookSessionSeed`) exactly once per app launch, and mapping discovery outputs into the existing Storybook home/library/details renderer plus one new Magic Pick confirmation screen.

**Tech Stack:** ES5-compatible JavaScript, HTML5, CSS3, GSAP 3, Jellyfin HTTP API, `localStorage` / optional `tizen.preference`, Node.js built-in `assert` + `vm` harness, Windows PowerShell 5.1 / PowerShell 7, `agent-browser` CLI, signed Tizen widget packaging via `tools\Deploy-Rawi.ps1`.

## Global Constraints

- Create and use the execution worktree `C:\Code\Rawi\.worktrees\storybook-mode-phase-3`; every command below begins with `Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3` so validation cannot accidentally run against `main`.
- Preserve app ID `JfMovieTV1.MovieDeck`, package ID `JfMovieTV1`, existing `moviedeck.*` keys, `rawi.storybook.preferences`, the explicit corrupt-preference recovery flow, and the existing package scripts.
- All runtime JavaScript must remain ES5-compatible for Samsung Tizen 3.0: no `const`, `let`, arrow functions, classes, optional chaining, or new runtime dependencies.
- Adult Mode layout, copy, navigation, authentication, and playback behavior remain unchanged except that shared Jellyfin item metadata now also includes `Tags`; adult runtime copy stays minutes-only.
- Preference schema version 3 defaults are `categoryTags: { singDance:'sing-along', bedtime:'bedtime', animals:'animals', learning:'learning', movement:'movement' }`, `durationLabels: { enabled:true, quickMaxMinutes:12, cozyMaxMinutes:30 }`, and `recentHistoryDays:14`.
- Version 2 auto-migrates to version 3 in memory without writing on restore; version 1 may migrate transitively; malformed or unknown versions still require explicit reset confirmation and keep the write barrier intact.
- Every save path preserves all version-3 fields: mode toggles, settings saves, favorite toggles, pruning saves, preview saves, resets, and test harness normalizers must all round-trip the same shape.
- Friendly category labels stay copy keys (`storybookCategorySingDance`, `storybookCategoryBedtime`, `storybookCategoryAnimals`, `storybookCategoryLearning`, `storybookCategoryMovement`) while preferences store Jellyfin tag strings; categories are shortcuts, not access control.
- Add `Tags` to shared Jellyfin `itemFields()` and do not add duplicate Jellyfin requests or Storybook-only API fetches.
- Use `UserData.Played` plus `UserData.LastPlayedDate` for recent completion; pure discovery tests inject `nowMs`, deterministic app tests inject `nowMs` and `storybookSessionSeed` through an explicit pre-init bootstrap seam, and preview fixtures provide fixed `nowMs`; quiet time remains Phase 4 and must stay inactive and absent in Phase 3 logic and UI.
- Tonight's Little Menu uses one launch-captured `nowMs` and one in-memory `storybookSessionSeed` per app launch; the same captured values + catalogue + preferences must yield the same menu across rerenders and focus changes; preview uses fixed fixture `sessionSeed` and `nowMs`.
- Magic Pick never auto-plays, uses an injectable `random`, prefers unwatched items first, gives favorites a moderate bonus, prefers categories different from the most recently completed item when tags exist, and only randomizes among max-score candidates.
- Reuse the existing Storybook media cards, shared Storybook library screen, shared Storybook details screen, and shared player flow where possible; category pages reuse `renderLibrary`, and Magic Pick gets its own browsing/confirmation screen with a visible mode toggle.
- Ending and player screens still do not gain a mode toggle; Magic Pick confirmation is browsing-only and must not start playback.
- Recurring motion remains capped at three visible animated elements globally, no new recurring animation is required, and reduced-motion entry gating must explicitly cover the new Magic Pick confirmation screen.
- All user-facing copy must continue to resolve through `window.RawiCopy`; every new copy key, including transient Magic Pick reason text and settings labels, gets a default assertion.
- Async tests must register and be awaited via `RawiTest.registerAsync`; hidden-screen focus must be rejected; missing selectors must fail explicitly; stable DOM identifiers are required; preview ownership remains AppPath + port scoped and must be verified on both Windows PowerShell 5.1 and `pwsh` when available.
- Do not deploy to a physical TV from this plan. Final release validation is `.\tools\Deploy-Rawi.ps1 -PackageOnly` only, and that step is the single `0.1.12 -> 0.1.13` version bump.

---

## Planned File Structure

| File | Responsibility |
|---|---|
| `MovieDeck\js\storybook-preferences.js` | Version-3 Storybook defaults, v1/v2→v3 migration, normalization, recovery, and persistence barriers |
| `MovieDeck\js\api.js` | Shared Jellyfin metadata field list and final `CLIENT_VERSION` bump to `0.1.13` |
| `MovieDeck\js\storybook-discovery.js` | Pure Storybook discovery derivation: recent completion, stable menu, category grouping, and Magic Pick scoring |
| `MovieDeck\js\app.js` | Shared orchestration: version-3 preference preservation, launch-bootstrap ownership (`nowMs` + `storybookSessionSeed`), Storybook discovery integration, shared collection routing, Magic Pick state, preview routes, and package-only validation hooks |
| `MovieDeck\js\storybook-view.js` | Storybook home/library/details/magic/settings DOM rendering, focus restoration, and callback wiring |
| `MovieDeck\js\copy.js` | Default Storybook Phase 3 copy keys for categories, duration labels, little menu, Magic Pick, and settings |
| `MovieDeck\js\preview-fixtures.js` | Deterministic Phase 3 preview catalogue, version-3 preferences, tag metadata, recent-play history, and fixed preview `sessionSeed` / `nowMs` / `magicRandom` values |
| `MovieDeck\index.html` | Storybook home sections, Magic Pick confirmation screen, settings controls, and `storybook-discovery.js` script wiring |
| `MovieDeck\css\storybook.css` | Scoped Storybook styles for category shortcuts, little-menu cards, Magic Pick confirmation, and expanded settings layout |
| `MovieDeck\tests\run-tests.js` | Default suite ordering with new `api.test.js` and `storybook-discovery.test.js` entries |
| `MovieDeck\tests\api.test.js` | `itemFields()` regression proving `Tags` are requested without changing the rest of the shared metadata contract |
| `MovieDeck\tests\storybook-preferences.test.js` | Version-3 default shape, v1/v2 migration, recovery/write-barrier rules, and save normalization coverage |
| `MovieDeck\tests\storybook-model.test.js` | Deterministic preview-fixture shape checks for the version-3 defaults and fixed preview `sessionSeed` / `nowMs` |
| `MovieDeck\tests\storybook-discovery.test.js` | Pure recent-completion, category mapping, stable menu, and Magic Pick scoring tests with injected `nowMs` / `sessionSeed` / `random` |
| `MovieDeck\tests\storybook-view.test.js` | Storybook DOM harness updates for menu/category/magic/settings rendering, focus behavior, callback payloads, and settings validation branches |
| `MovieDeck\tests\storybook-app.test.js` | App-level save-path preservation, shared collection routing, fixed launch-bootstrap overrides, duration labels, menu stability, Magic Pick integration, reduced-motion gating, preview save paths, and deterministic preview routes |
| `MovieDeck\tests\copy.test.js` | Default-copy assertions for every new Phase 3 copy key |
| `MovieDeck\tests\start-rawi-preview.test.js` | Preview-helper ownership/reuse tests for new category/magic/settings routes on PowerShell 5.1 and `pwsh` |
| `tools\Start-RawiPreview.ps1` | Deterministic preview route options, fixed query parameters, and owned-port preview start/stop behavior |
| `README.md` | Storybook Phase 3 behavior, preview-route instructions, Magic Pick notes, and package-only validation guidance |
| `MovieDeck\config.xml` | Final helper-driven version bump to `0.1.13` only |

---

### Task 1: Preference Schema v3, Tags Metadata, and Discovery Foundation

**Files:**
- Create: `MovieDeck\js\storybook-discovery.js`
- Create: `MovieDeck\tests\api.test.js`
- Create: `MovieDeck\tests\storybook-discovery.test.js`
- Modify: `MovieDeck\index.html`
- Modify: `MovieDeck\js\api.js`
- Modify: `MovieDeck\js\app.js`
- Modify: `MovieDeck\js\preview-fixtures.js`
- Modify: `MovieDeck\js\storybook-preferences.js`
- Modify: `MovieDeck\tests\run-tests.js`
- Modify: `MovieDeck\tests\storybook-app.test.js`
- Modify: `MovieDeck\tests\storybook-model.test.js`
- Modify: `MovieDeck\tests\storybook-preferences.test.js`

**Interfaces:**
- Produces: `window.RawiStorybookPreferences.restore() -> { version: 3, enabled: boolean, lastMode: 'adult'|'storybook', childName: string, libraryIds: string[], favoriteItemIds: string[], categoryTags: { singDance: string, bedtime: string, animals: string, learning: string, movement: string }, durationLabels: { enabled: boolean, quickMaxMinutes: number, cozyMaxMinutes: number }, recentHistoryDays: number, reducedMotion: boolean }`
- Produces: `window.RawiStorybookPreferences.save(preferences, options?) -> same normalized version-3 object | null`
- Produces: `window.RawiStorybookDiscovery.build(options) -> { categories: Array<{ key: string, copyKey: string, items: Object[] }>, littleMenu: Object[], mostRecentlyCompleted: Object|null, recentlyCompleted: Object[] }`
- Produces: `window.RawiStorybookDiscovery.magicPick(options) -> { item: Object|null, reason: { copyKey: string } }`
- Produces: `window.MovieDeckApi.itemFields() -> 'Overview,Genres,PrimaryImageAspectRatio,MediaSources,MediaStreams,ProductionYear,RunTimeTicks,Tags'`
- Produces: `currentStorybookSessionSeed() -> string`
- Produces: `currentStorybookNowMs() -> number`
- Consumes: `window.__RAWI_STORYBOOK_BOOTSTRAP__?: { storybookSessionSeed: string, nowMs: number }` set before `app.js` initializes in deterministic app tests
- Consumes: `previewStorybookFixture.sessionSeed`, `previewStorybookFixture.nowMs`, and `previewStorybookFixture.magicRandom`
- Consumes: `catalogue.selectedLibraries` from `window.RawiStorybookCatalogue.resolve(...)`
- Consumes: `catalogue.resumeItem` from Phase 2 so the little-menu derivation can avoid duplicating the already-surfaced resume card

- [ ] **Step 1: Replace all version-2 preference expectations, add the `Tags` regression, and write the pure discovery REDs**

In `MovieDeck\tests\storybook-preferences.test.js`, replace the default helper with the exact version-3 shape and add an explicit v2 migration assertion:

```javascript
function defaultPreferences() {
  return {
    version: 3,
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
    reducedMotion: false
  };
}

(function migratesVersion2PreferencesWithoutRecoveryOrImmediateRewrite() {
  var harness = loadPreferences(JSON.stringify({
    version: 2,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['kids', 'kids', 3],
    favoriteItemIds: ['story-1', 'story-1', 4],
    reducedMotion: true
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 3,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['kids'],
    favoriteItemIds: ['story-1'],
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
    reducedMotion: true
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());
```

Still in `storybook-preferences.test.js`, update `validPreferencesAreNormalized()` and `saveWritesNormalizedVersionedData()` so they prove nested version-3 fields survive both restore and save:

```javascript
(function validPreferencesAreNormalized() {
  var harness = loadPreferences(JSON.stringify({
    version: 3,
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['pixar', 'pixar', 42],
    favoriteItemIds: ['bluey', 'bluey', 9],
    categoryTags: {
      singDance: ' songs ',
      bedtime: '',
      animals: ' animals ',
      learning: 'learning',
      movement: 'move-it'
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: '10',
      cozyMaxMinutes: '25'
    },
    recentHistoryDays: '3',
    reducedMotion: true,
    ignored: 'value'
  }));
  var result = harness.api.restore();

  assert.deepStrictEqual(clone(result), {
    version: 3,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['pixar'],
    favoriteItemIds: ['bluey'],
    categoryTags: {
      singDance: 'songs',
      bedtime: '',
      animals: 'animals',
      learning: 'learning',
      movement: 'move-it'
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 10,
      cozyMaxMinutes: 25
    },
    recentHistoryDays: 3,
    reducedMotion: true
  });
  assert.deepStrictEqual(clone(harness.api.getRestoreStatus()), {
    needsRecovery: false,
    type: 'ok'
  });
  assert.strictEqual(harness.saved(), null);
}());

(function saveWritesNormalizedVersionedData() {
  var harness = loadPreferences(null);
  var result = harness.api.save({
    enabled: true,
    lastMode: 'storybook',
    childName: ' Nova ',
    libraryIds: ['one', 'one', 5],
    favoriteItemIds: ['story-1', 'story-1', 8],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'zoo',
      learning: 'learning',
      movement: ''
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 20
    },
    recentHistoryDays: 5,
    reducedMotion: false
  });

  assert.deepStrictEqual(clone(result), {
    version: 3,
    enabled: true,
    lastMode: 'storybook',
    childName: 'Nova',
    libraryIds: ['one'],
    favoriteItemIds: ['story-1'],
    categoryTags: {
      singDance: 'sing-along',
      bedtime: 'bedtime',
      animals: 'zoo',
      learning: 'learning',
      movement: ''
    },
    durationLabels: {
      enabled: false,
      quickMaxMinutes: 9,
      cozyMaxMinutes: 20
    },
    recentHistoryDays: 5,
    reducedMotion: false
  });
  assert.strictEqual(harness.saved().key, 'rawi.storybook.preferences');
  assert.deepStrictEqual(JSON.parse(harness.saved().value), clone(result));
}());
```

Create `MovieDeck\tests\api.test.js` with this exact regression:

```javascript
'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var api = load('js/api.js', {
  window: {
    RawiCopy: {
      get: function (key) { return key; }
    },
    RawiStorage: {
      get: function () { return null; },
      set: function () {},
      remove: function () {}
    }
  }
}).MovieDeckApi;

(function itemFieldsIncludeTagsWithoutRemovingExistingMetadata() {
  assert.strictEqual(
    api.itemFields(),
    'Overview,Genres,PrimaryImageAspectRatio,MediaSources,MediaStreams,ProductionYear,RunTimeTicks,Tags'
  );
}());
```

Create `MovieDeck\tests\storybook-discovery.test.js` with these four pure expectations:

```javascript
'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var discovery = load('js/storybook-discovery.js', { window: {} }).RawiStorybookDiscovery;
var NOW_MS = Date.parse('2026-09-02T02:00:00.000Z');

function preferences(overrides) {
  var result = {
    favoriteItemIds: ['dance', 'colors'],
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
    recentHistoryDays: 14
  };
  var source = overrides || {};

  if (source.favoriteItemIds) {
    result.favoriteItemIds = source.favoriteItemIds.slice();
  }
  if (source.recentHistoryDays !== undefined) {
    result.recentHistoryDays = source.recentHistoryDays;
  }
  if (source.categoryTags) {
    Object.keys(source.categoryTags).forEach(function (key) {
      result.categoryTags[key] = source.categoryTags[key];
    });
  }
  return result;
}

function item(id, name, tags, userData, runTimeTicks) {
  return {
    Id: id,
    Name: name,
    Tags: tags || [],
    RunTimeTicks: runTimeTicks || 7200000000,
    UserData: userData || {}
  };
}

function catalogue() {
  return {
    resumeItem: item('bluey', "Bluey's Big Adventure", ['animals'], { PlaybackPositionTicks: 3600000000, Played: false }, 16800000000),
    favoriteItems: [
      item('dance', 'Dance With Me'),
      item('colors', 'The Color Garden')
    ],
    selectedLibraries: [
      {
        id: 'pixar',
        name: 'Disney Pixar',
        videos: [
          item('bluey', "Bluey's Big Adventure", ['animals'], { PlaybackPositionTicks: 3600000000, Played: false }, 16800000000),
          item('sleepy', 'Sleepy Moon', ['bedtime'], { Played: true, LastPlayedDate: '2026-09-01T18:00:00.000Z' }, 19800000000),
          item('fox', 'Fox and Fireflies', ['animals'], { Played: false }, 6600000000)
        ]
      },
      {
        id: 'songs',
        name: 'Sing & Dance',
        videos: [
          item('dance', 'Dance With Me', ['sing-along', 'movement'], { Played: false }, 7200000000),
          item('stretch', 'Stretch and Sway', ['movement'], { Played: false }, 8400000000)
        ]
      },
      {
        id: 'lessons',
        name: 'Little Lessons',
        videos: [
          item('colors', 'The Color Garden', ['learning'], { Played: false }, 5400000000)
        ]
      }
    ]
  };
}

function ids(items) {
  return JSON.parse(JSON.stringify((items || []).map(function (entry) {
    return entry.Id;
  })));
}

(function buildCreatesFriendlyCategoriesFromConfiguredTagValues() {
  var result = discovery.build({
    catalogue: catalogue(),
    preferences: preferences(),
    nowMs: NOW_MS,
    sessionSeed: 'storybook-phase-3-preview'
  });

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(result.categories.map(function (category) {
      return {
        copyKey: category.copyKey,
        itemIds: ids(category.items),
        key: category.key
      };
    }))),
    [
      { key: 'singDance', copyKey: 'storybookCategorySingDance', itemIds: ['dance'] },
      { key: 'bedtime', copyKey: 'storybookCategoryBedtime', itemIds: ['sleepy'] },
      { key: 'animals', copyKey: 'storybookCategoryAnimals', itemIds: ['bluey', 'fox'] },
      { key: 'learning', copyKey: 'storybookCategoryLearning', itemIds: ['colors'] },
      { key: 'movement', copyKey: 'storybookCategoryMovement', itemIds: ['dance', 'stretch'] }
    ]
  );
  assert.deepStrictEqual(ids(result.recentlyCompleted), ['sleepy']);
  assert.strictEqual(result.mostRecentlyCompleted.Id, 'sleepy');
}());

(function littleMenuStaysStablePerSessionSkipsRecentCompletionsAndPrefersVariety() {
  var first = discovery.build({
    catalogue: catalogue(),
    preferences: preferences(),
    nowMs: NOW_MS,
    sessionSeed: 'seed-one'
  });
  var second = discovery.build({
    catalogue: catalogue(),
    preferences: preferences(),
    nowMs: NOW_MS,
    sessionSeed: 'seed-one'
  });
  var third = discovery.build({
    catalogue: catalogue(),
    preferences: preferences(),
    nowMs: NOW_MS,
    sessionSeed: 'seed-two'
  });

  assert.deepStrictEqual(ids(first.littleMenu), ['dance', 'colors', 'fox']);
  assert.deepStrictEqual(ids(second.littleMenu), ids(first.littleMenu));
  assert.strictEqual(ids(first.littleMenu).indexOf('sleepy'), -1);
  assert.strictEqual(ids(first.littleMenu).indexOf('bluey'), -1);
  assert.notDeepStrictEqual(ids(third.littleMenu), ids(first.littleMenu));
}());

(function magicPickPrefersUnwatchedFavoritesAndDifferentCategoriesThenUsesRandomOnTies() {
  var baseBuild = discovery.build({
    catalogue: catalogue(),
    preferences: preferences(),
    nowMs: NOW_MS,
    sessionSeed: 'storybook-phase-3-preview'
  });
  var result = discovery.magicPick({
    catalogue: catalogue(),
    discovery: baseBuild,
    preferences: preferences(),
    nowMs: NOW_MS,
    random: function () { return 0; }
  });

  assert.strictEqual(result.item.Id, 'dance');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.reason)), {
    copyKey: 'storybookMagicReasonDifferentCategory'
  });

  result = discovery.magicPick({
    catalogue: catalogue(),
    discovery: baseBuild,
    preferences: preferences(),
    nowMs: NOW_MS,
    random: function () { return 0.99; }
  });

  assert.strictEqual(result.item.Id, 'colors');
}());

(function magicPickReturnsNullWhenEverythingEligibleWasCompletedRecently() {
  var result = discovery.magicPick({
    catalogue: {
      resumeItem: null,
      favoriteItems: [],
      selectedLibraries: [
        {
          id: 'kids',
          name: 'Kids',
          videos: [
            item('done-1', 'Done One', ['animals'], { Played: true, LastPlayedDate: '2026-09-02T00:00:00.000Z' }),
            item('done-2', 'Done Two', ['learning'], { Played: true, LastPlayedDate: '2026-09-01T20:00:00.000Z' })
          ]
        }
      ]
    },
    preferences: preferences({ favoriteItemIds: [] }),
    nowMs: NOW_MS,
    random: function () { return 0; }
  });

  assert.strictEqual(result.item, null);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.reason)), {
    copyKey: 'storybookMagicPickEmptyBody'
  });
}());
```

In `MovieDeck\tests\storybook-app.test.js`, add one helper and use it everywhere the file currently spells a version-2 preference literal so no save-path assertion is left behind on the old schema:

```javascript
function basePreferences(overrides) {
  var result = {
    version: 3,
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
```

Then replace `normalizePreferences(nextState)` with this version and use `basePreferences(...)` for every existing inline Storybook preference object and saved-state expectation in the file, including reset expectations, preview preferences, reload assertions, and recovery test fixtures:

```javascript
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
    reducedMotion: source.reducedMotion === true
  });
}
```

Still in `MovieDeck\tests\storybook-app.test.js`, add a fixed launch-bootstrap helper immediately above `loadAppHarness(options)` and feed it into the window object before `js\app.js` loads. Any app-level test that asserts exact menu IDs or exact Magic Pick choices must pass a fixed bootstrap through this seam rather than relying on live `Date.now()`:

```javascript
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
```

```javascript
// inside loadAppHarness(options)
var storybookBootstrap = defaultStorybookBootstrap(options.storybookBootstrap);
var currentPreferences = JSON.parse(JSON.stringify(basePreferences(options.preferences || {})));
var rawStorybookStorage = Object.prototype.hasOwnProperty.call(options, 'rawStorybookStorage') ?
  options.rawStorybookStorage :
  JSON.stringify(currentPreferences);
```

```javascript
// add these properties to the existing window object literal passed to load('js/app.js', ...)
__RAWI_STORYBOOK_BOOTSTRAP__: {
  nowMs: storybookBootstrap.nowMs,
  storybookSessionSeed: storybookBootstrap.storybookSessionSeed
},
RawiPreviewFixtures: options.previewFixtures || null,
```

Finally, update `MovieDeck\tests\storybook-model.test.js` so the preview fixture asserts version 3 plus fixed preview `sessionSeed` and `nowMs`:

```javascript
(function exposesDeterministicStorybookPreviewFixture() {
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(previewFixtures.storybook.preferences)),
    {
      version: 3,
      enabled: true,
      lastMode: 'storybook',
      childName: 'Nova',
      libraryIds: ['pixar', 'songs', 'lessons'],
      favoriteItemIds: ['dance', 'colors'],
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
    }
  );
  assert.strictEqual(previewFixtures.storybook.sessionSeed, 'storybook-phase-3-preview');
  assert.strictEqual(previewFixtures.storybook.nowMs, Date.parse('2026-09-02T02:00:00.000Z'));
  assert.strictEqual(previewFixtures.storybook.resume[0].Id, 'bluey');
  assert.strictEqual(previewFixtures.storybook.groups.length, 4);
}());
```

- [ ] **Step 2: Run the focused RED loop and confirm the failures come from missing version-3 behavior, missing `Tags`, and the absent discovery module**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js api.test.js storybook-preferences.test.js storybook-model.test.js storybook-discovery.test.js storybook-app.test.js
```

Expected RED output: `api.test.js` fails because `itemFields()` still omits `Tags`; `storybook-preferences.test.js`, `storybook-model.test.js`, and `storybook-app.test.js` still emit version-2 defaults or drop the new nested fields; and `storybook-discovery.test.js` fails because `js\storybook-discovery.js` does not exist yet.

- [ ] **Step 3: Implement version-3 preferences, add `Tags`, wire the preview/default constructors, and add the pure discovery module**

Replace `MovieDeck\js\storybook-preferences.js` with this exact version-3 implementation:

```javascript
(function (global) {
  'use strict';

  var KEY = 'rawi.storybook.preferences';
  var VERSION = 3;
  var storage = global.RawiStorage;
  var DEFAULT_CATEGORY_TAGS = {
    singDance: 'sing-along',
    bedtime: 'bedtime',
    animals: 'animals',
    learning: 'learning',
    movement: 'movement'
  };
  var DEFAULT_DURATION_LABELS = {
    enabled: true,
    quickMaxMinutes: 12,
    cozyMaxMinutes: 30
  };
  var lastRestoreStatus = {
    needsRecovery: false,
    type: 'ok'
  };

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

  function normalizeText(value, fallback) {
    if (typeof value === 'string') {
      return value.trim();
    }
    return fallback;
  }

  function normalizePositiveInt(value, fallback) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1) {
      return fallback;
    }
    return parsed;
  }

  function normalizeNonNegativeInt(value, fallback) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
      return fallback;
    }
    return parsed;
  }

  function normalizeCategoryTags(source) {
    source = source || {};
    return {
      singDance: normalizeText(source.singDance, DEFAULT_CATEGORY_TAGS.singDance),
      bedtime: normalizeText(source.bedtime, DEFAULT_CATEGORY_TAGS.bedtime),
      animals: normalizeText(source.animals, DEFAULT_CATEGORY_TAGS.animals),
      learning: normalizeText(source.learning, DEFAULT_CATEGORY_TAGS.learning),
      movement: normalizeText(source.movement, DEFAULT_CATEGORY_TAGS.movement)
    };
  }

  function normalizeDurationLabels(source) {
    var quick;
    var cozy;

    source = source || {};
    quick = normalizePositiveInt(source.quickMaxMinutes, DEFAULT_DURATION_LABELS.quickMaxMinutes);
    cozy = normalizePositiveInt(source.cozyMaxMinutes, DEFAULT_DURATION_LABELS.cozyMaxMinutes);
    if (cozy < quick) {
      cozy = quick;
    }

    return {
      enabled: source.enabled !== undefined ? source.enabled === true : DEFAULT_DURATION_LABELS.enabled,
      quickMaxMinutes: quick,
      cozyMaxMinutes: cozy
    };
  }

  function defaults() {
    return {
      version: VERSION,
      enabled: false,
      lastMode: 'adult',
      childName: '',
      libraryIds: [],
      favoriteItemIds: [],
      categoryTags: normalizeCategoryTags(),
      durationLabels: normalizeDurationLabels(),
      recentHistoryDays: 14,
      reducedMotion: false
    };
  }

  function restoreStatus(status) {
    lastRestoreStatus = status;
  }

  function cloneStatus() {
    var copy = {
      needsRecovery: lastRestoreStatus.needsRecovery === true,
      type: lastRestoreStatus.type || 'ok'
    };

    if (lastRestoreStatus.version !== undefined) {
      copy.version = lastRestoreStatus.version;
    }

    return copy;
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
      categoryTags: normalizeCategoryTags(source.categoryTags),
      durationLabels: normalizeDurationLabels(source.durationLabels),
      recentHistoryDays: normalizeNonNegativeInt(source.recentHistoryDays, 14),
      reducedMotion: source.reducedMotion === true
    };
  }

  function restore() {
    var stored = storage.get(KEY);
    var parsed;

    if (stored === null || stored === undefined) {
      restoreStatus({
        needsRecovery: false,
        type: 'ok'
      });
      return defaults();
    }

    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      restoreStatus({
        needsRecovery: true,
        type: 'malformed'
      });
      return defaults();
    }

    if (!parsed || parsed.version === undefined || parsed.version === null) {
      restoreStatus({
        needsRecovery: true,
        type: 'malformed'
      });
      return defaults();
    }

    if (parsed.version === 1 || parsed.version === 2 || parsed.version === VERSION) {
      restoreStatus({
        needsRecovery: false,
        type: 'ok'
      });
      return normalize(parsed);
    }

    restoreStatus({
      needsRecovery: true,
      type: 'unsupported-version',
      version: parsed.version
    });
    return defaults();
  }

  function save(preferences, options) {
    var normalized = normalize(preferences);

    if (lastRestoreStatus.needsRecovery && !(options && options.allowRecoveryWrite)) {
      return null;
    }

    storage.set(KEY, JSON.stringify(normalized));
    restoreStatus({
      needsRecovery: false,
      type: 'ok'
    });
    return normalized;
  }

  function reset() {
    return save(defaults(), { allowRecoveryWrite: true });
  }

  global.RawiStorybookPreferences = {
    defaults: defaults,
    getRestoreStatus: cloneStatus,
    reset: reset,
    restore: restore,
    save: save
  };
}(window));
```

Create `MovieDeck\js\storybook-discovery.js` with the exact pure derivation below. It is intentionally focused and self-contained so `app.js` can stay orchestration-only in later tasks:

```javascript
(function (global) {
  'use strict';

  var DAY_MS = 24 * 60 * 60 * 1000;
  var CATEGORY_KEYS = ['singDance', 'bedtime', 'animals', 'learning', 'movement'];
  var CATEGORY_COPY_KEYS = {
    singDance: 'storybookCategorySingDance',
    bedtime: 'storybookCategoryBedtime',
    animals: 'storybookCategoryAnimals',
    learning: 'storybookCategoryLearning',
    movement: 'storybookCategoryMovement'
  };

  function value(object, pascal, camel) {
    if (!object) { return undefined; }
    return object[pascal] !== undefined ? object[pascal] : object[camel];
  }

  function itemId(item) {
    if (!item) { return ''; }
    if (item.Id !== undefined && item.Id !== null) { return String(item.Id); }
    if (item.id !== undefined && item.id !== null) { return String(item.id); }
    return '';
  }

  function userData(item) {
    return value(item, 'UserData', 'userData') || {};
  }

  function tagsOf(item) {
    var tags = value(item, 'Tags', 'tags');
    return Array.isArray(tags) ? tags : [];
  }

  function normalizeTag(tag) {
    return typeof tag === 'string' ? tag.trim().toLowerCase() : '';
  }

  function playedTimestampOf(item) {
    var candidates = [];
    var data = userData(item);
    var i;
    var parsed;

    if (data.LastPlayedDate !== undefined && data.LastPlayedDate !== null) {
      candidates.push(data.LastPlayedDate);
    }
    if (item && item.lastPlayedDate !== undefined && item.lastPlayedDate !== null) {
      candidates.push(item.lastPlayedDate);
    }

    for (i = 0; i < candidates.length; i += 1) {
      parsed = Date.parse(String(candidates[i]));
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  function recentHistoryDays(preferences) {
    var parsed = parseInt(preferences && preferences.recentHistoryDays, 10);
    if (isNaN(parsed) || parsed < 0) {
      return 14;
    }
    return parsed;
  }

  function matchCategoryKeys(item, preferences) {
    var configured = preferences && preferences.categoryTags ? preferences.categoryTags : {};
    var tags = tagsOf(item).map(normalizeTag);
    var matches = [];

    CATEGORY_KEYS.forEach(function (key) {
      var configuredTag = normalizeTag(configured[key]);
      if (configuredTag && tags.indexOf(configuredTag) !== -1) {
        matches.push(key);
      }
    });

    return matches;
  }

  function isRecentlyCompleted(item, preferences, nowMs) {
    var played = userData(item).Played === true || userData(item).played === true;
    var lastPlayedMs = playedTimestampOf(item);

    if (!played || lastPlayedMs === null) {
      return false;
    }

    return lastPlayedMs >= (nowMs - recentHistoryDays(preferences) * DAY_MS);
  }

  function stableHash(text) {
    var hash = 0;
    var i;
    var input = String(text || 'storybook');

    for (i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) % 2147483647;
    }

    return hash;
  }

  function flattenSelectedLibraries(catalogue, preferences, nowMs) {
    var libraries = catalogue && catalogue.selectedLibraries ? catalogue.selectedLibraries : [];
    var entries = [];
    var i;
    var j;
    var library;
    var videos;
    var item;
    var id;

    for (i = 0; i < libraries.length; i += 1) {
      library = libraries[i] || {};
      videos = library.videos || [];
      for (j = 0; j < videos.length; j += 1) {
        item = videos[j];
        id = itemId(item);
        if (!id) { continue; }
        entries.push({
          categoryKeys: matchCategoryKeys(item, preferences),
          index: entries.length,
          item: item,
          libraryId: String(library.id || library.Id || ''),
          playedMs: playedTimestampOf(item),
          recentCompleted: isRecentlyCompleted(item, preferences, nowMs)
        });
      }
    }

    return entries;
  }

  function recentCompletionEntries(entries) {
    return entries.filter(function (entry) {
      var played = userData(entry.item).Played === true || userData(entry.item).played === true;
      return played && entry.playedMs !== null;
    }).sort(function (left, right) {
      if (left.playedMs !== right.playedMs) {
        return right.playedMs - left.playedMs;
      }
      return left.index - right.index;
    });
  }

  function buildCategories(entries) {
    return CATEGORY_KEYS.map(function (key) {
      return {
        copyKey: CATEGORY_COPY_KEYS[key],
        items: entries.filter(function (entry) {
          return entry.categoryKeys.indexOf(key) !== -1;
        }).map(function (entry) {
          return entry.item;
        }),
        key: key
      };
    }).filter(function (category) {
      return category.items.length > 0;
    });
  }

  function littleMenuCandidates(entries, catalogue) {
    var resumeId = itemId(catalogue && catalogue.resumeItem);

    return entries.filter(function (entry) {
      var id = itemId(entry.item);
      if (!id || entry.recentCompleted) { return false; }
      if (resumeId && id === resumeId) { return false; }
      return true;
    });
  }

  function diversityScore(entry, usedLibraries, usedCategories) {
    var score = 0;
    var hasOverlap = false;

    if (!usedLibraries[entry.libraryId]) {
      score += 4;
    }
    if (!entry.categoryKeys.length) {
      score += 1;
      return score;
    }

    entry.categoryKeys.forEach(function (key) {
      if (usedCategories[key]) {
        hasOverlap = true;
      }
    });
    if (!hasOverlap) {
      score += 2;
    }
    return score;
  }

  function chooseLittleMenu(entries, sessionSeed) {
    var remaining = entries.slice();
    var chosen = [];
    var usedLibraries = {};
    var usedCategories = {};
    var entry;

    while (remaining.length && chosen.length < 3) {
      remaining.sort(function (left, right) {
        var leftScore = diversityScore(left, usedLibraries, usedCategories);
        var rightScore = diversityScore(right, usedLibraries, usedCategories);
        var leftHash;
        var rightHash;

        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }

        leftHash = stableHash(sessionSeed + '|menu|' + itemId(left.item));
        rightHash = stableHash(sessionSeed + '|menu|' + itemId(right.item));
        if (leftHash !== rightHash) {
          return leftHash - rightHash;
        }

        return left.index - right.index;
      });

      entry = remaining.shift();
      chosen.push(entry.item);
      usedLibraries[entry.libraryId] = true;
      entry.categoryKeys.forEach(function (key) {
        usedCategories[key] = true;
      });
    }

    return chosen;
  }

  function favoriteMap(preferences) {
    var map = {};
    var favorites = preferences && preferences.favoriteItemIds ? preferences.favoriteItemIds : [];

    favorites.forEach(function (id) {
      map[String(id)] = true;
    });
    return map;
  }

  function sharesCategory(left, right) {
    var i;
    for (i = 0; i < left.length; i += 1) {
      if (right.indexOf(left[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  function scoreMagicCandidate(entry, favorites, mostRecentCategoryKeys) {
    var score = 0;
    var played = userData(entry.item).Played === true || userData(entry.item).played === true;
    var reason = {
      copyKey: 'storybookMagicReasonAnyStory'
    };

    if (!played) {
      score += 8;
      reason = {
        copyKey: 'storybookMagicReasonUnwatched'
      };
    }
    if (favorites[itemId(entry.item)]) {
      score += 3;
      reason = {
        copyKey: 'storybookMagicReasonFavorite'
      };
    }
    if (mostRecentCategoryKeys.length && entry.categoryKeys.length && !sharesCategory(entry.categoryKeys, mostRecentCategoryKeys)) {
      score += 2;
      reason = {
        copyKey: 'storybookMagicReasonDifferentCategory'
      };
    }

    return {
      item: entry.item,
      reason: reason,
      score: score,
      stableIndex: entry.index
    };
  }

  function build(options) {
    var input = options || {};
    var catalogue = input.catalogue || {};
    var preferences = input.preferences || {};
    var nowMs = input.nowMs !== undefined ? input.nowMs : Date.now();
    var sessionSeed = String(input.sessionSeed !== undefined ? input.sessionSeed : 'storybook');
    var entries = flattenSelectedLibraries(catalogue, preferences, nowMs);
    var completedEntries = recentCompletionEntries(entries);

    return {
      categories: buildCategories(entries),
      littleMenu: chooseLittleMenu(littleMenuCandidates(entries, catalogue), sessionSeed),
      mostRecentlyCompleted: completedEntries.length ? completedEntries[0].item : null,
      recentlyCompleted: completedEntries.filter(function (entry) {
        return entry.recentCompleted;
      }).map(function (entry) {
        return entry.item;
      })
    };
  }

  function magicPick(options) {
    var input = options || {};
    var catalogue = input.catalogue || {};
    var preferences = input.preferences || {};
    var nowMs = input.nowMs !== undefined ? input.nowMs : Date.now();
    var discovery = input.discovery || build({
      catalogue: catalogue,
      nowMs: nowMs,
      preferences: preferences,
      sessionSeed: 'magic'
    });
    var random = typeof input.random === 'function' ? input.random : Math.random;
    var entries = flattenSelectedLibraries(catalogue, preferences, nowMs).filter(function (entry) {
      return !entry.recentCompleted;
    });
    var favorites = favoriteMap(preferences);
    var mostRecentCategoryKeys = discovery.mostRecentlyCompleted ?
      matchCategoryKeys(discovery.mostRecentlyCompleted, preferences) :
      [];
    var scored;
    var maxScore;
    var best;
    var index;

    if (!entries.length) {
      return {
        item: null,
        reason: {
          copyKey: 'storybookMagicPickEmptyBody'
        }
      };
    }

    scored = entries.map(function (entry) {
      return scoreMagicCandidate(entry, favorites, mostRecentCategoryKeys);
    });
    maxScore = scored.reduce(function (bestScore, entry) {
      return entry.score > bestScore ? entry.score : bestScore;
    }, scored[0].score);
    best = scored.filter(function (entry) {
      return entry.score === maxScore;
    }).sort(function (left, right) {
      return left.stableIndex - right.stableIndex;
    });

    index = Math.floor(random() * best.length);
    if (index < 0) { index = 0; }
    if (index >= best.length) { index = best.length - 1; }

    return {
      item: best[index].item,
      reason: best[index].reason
    };
  }

  global.RawiStorybookDiscovery = {
    build: build,
    magicPick: magicPick
  };
}(window));
```

Update `MovieDeck\js\api.js`, `MovieDeck\tests\run-tests.js`, and `MovieDeck\index.html` with these exact deltas:

```javascript
// MovieDeck\js\api.js
ApiClient.prototype.itemFields = function () {
  return 'Overview,Genres,PrimaryImageAspectRatio,MediaSources,MediaStreams,ProductionYear,RunTimeTicks,Tags';
};
```

```javascript
// MovieDeck\tests\run-tests.js
var DEFAULT_TEST_FILES = [
  'api.test.js',
  'animations.test.js',
  'storage.test.js',
  'run-tests-runner.test.js',
  'storybook-app.test.js',
  'storybook-preferences.test.js',
  'storybook-model.test.js',
  'storybook-discovery.test.js',
  'storybook-catalogue.test.js',
  'storybook-view.test.js',
  'start-rawi-preview.test.js',
  'copy.test.js'
];
```

```html
<!-- MovieDeck\index.html -->
<script src="js/storybook-preferences.js"></script>
<script src="js/storybook-model.js"></script>
<script src="js/storybook-catalogue.js"></script>
<script src="js/storybook-discovery.js"></script>
<script src="js/vendor/gsap.min.js"></script>
```

In `MovieDeck\js\app.js`, inventory every constructor/save helper so later tasks cannot silently drop new fields. Add the explicit launch-bootstrap seam below before `copyStorybookState()`, then replace `copyStorybookState()` plus `previewStorybookState()` with the exact implementations below:

```javascript
function numericNowMs(value, fallback) {
  var parsed = Number(value);
  if (isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function createStorybookLaunchBootstrap() {
  var injected = global.__RAWI_STORYBOOK_BOOTSTRAP__ || {};
  var fallbackNowMs = Date.now();
  var launchNowMs = injected.nowMs !== undefined ?
    numericNowMs(injected.nowMs, fallbackNowMs) :
    fallbackNowMs;

  return {
    nowMs: launchNowMs,
    storybookSessionSeed: injected.storybookSessionSeed !== undefined ?
      String(injected.storybookSessionSeed) :
      'live-' + launchNowMs.toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  };
}

var storybookLaunchBootstrap = createStorybookLaunchBootstrap();

function currentStorybookNowMs() {
  if (previewStorybookFixture && previewStorybookFixture.nowMs !== undefined) {
    return numericNowMs(previewStorybookFixture.nowMs, storybookLaunchBootstrap.nowMs);
  }
  return storybookLaunchBootstrap.nowMs;
}

function currentStorybookSessionSeed() {
  if (previewStorybookFixture && previewStorybookFixture.sessionSeed) {
    return String(previewStorybookFixture.sessionSeed);
  }
  return storybookLaunchBootstrap.storybookSessionSeed;
}

function copyCategoryTags(values) {
  var defaults = storybookPreferences.defaults().categoryTags;
  var source = values || {};
  return {
    singDance: source.singDance !== undefined ? String(source.singDance) : defaults.singDance,
    bedtime: source.bedtime !== undefined ? String(source.bedtime) : defaults.bedtime,
    animals: source.animals !== undefined ? String(source.animals) : defaults.animals,
    learning: source.learning !== undefined ? String(source.learning) : defaults.learning,
    movement: source.movement !== undefined ? String(source.movement) : defaults.movement
  };
}

function copyDurationLabels(values) {
  var defaults = storybookPreferences.defaults().durationLabels;
  var source = values || {};
  return {
    enabled: source.enabled !== undefined ? source.enabled === true : defaults.enabled,
    quickMaxMinutes: source.quickMaxMinutes !== undefined ? Number(source.quickMaxMinutes) : defaults.quickMaxMinutes,
    cozyMaxMinutes: source.cozyMaxMinutes !== undefined ? Number(source.cozyMaxMinutes) : defaults.cozyMaxMinutes
  };
}

function copyRecentHistoryDays(value) {
  var defaults = storybookPreferences.defaults();
  var parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) {
    return defaults.recentHistoryDays;
  }
  return parsed;
}

function copyStorybookState(state) {
  return {
    enabled: state && state.enabled === true,
    lastMode: state && state.lastMode === 'storybook' ? 'storybook' : 'adult',
    childName: state && typeof state.childName === 'string' ? state.childName : '',
    libraryIds: copyIds(state && state.libraryIds),
    favoriteItemIds: copyIds(state && state.favoriteItemIds),
    categoryTags: copyCategoryTags(state && state.categoryTags),
    durationLabels: copyDurationLabels(state && state.durationLabels),
    recentHistoryDays: copyRecentHistoryDays(state && state.recentHistoryDays),
    reducedMotion: !!(state && state.reducedMotion)
  };
}

function previewStorybookState(fixture) {
  var defaults = storybookPreferences.defaults();
  var preferences = fixture && fixture.preferences ? fixture.preferences : {};
  return {
    version: 3,
    enabled: true,
    lastMode: 'storybook',
    childName: typeof preferences.childName === 'string' ? preferences.childName : 'Nova',
    libraryIds: Array.isArray(preferences.libraryIds) ? preferences.libraryIds.slice() : previewLibraryIds(),
    favoriteItemIds: Array.isArray(preferences.favoriteItemIds) ? preferences.favoriteItemIds.slice() : [],
    categoryTags: copyCategoryTags(preferences.categoryTags || defaults.categoryTags),
    durationLabels: copyDurationLabels(preferences.durationLabels || defaults.durationLabels),
    recentHistoryDays: copyRecentHistoryDays(preferences.recentHistoryDays),
    reducedMotion: preferences.reducedMotion === true
  };
}
```

Update `MovieDeck\js\preview-fixtures.js` so the foundation fixture matches version 3 and already carries the metadata Phase 3 will consume later:

```javascript
(function (global) {
  'use strict';

  global.RawiPreviewFixtures = {
    storybook: {
      sessionSeed: 'storybook-phase-3-preview',
      nowMs: Date.parse('2026-09-02T02:00:00.000Z'),
      magicRandom: 0,
      user: { Id: 'preview-user', Name: 'Parent' },
      preferences: {
        version: 3,
        enabled: true,
        lastMode: 'storybook',
        childName: 'Nova',
        libraryIds: ['pixar', 'songs', 'lessons'],
        favoriteItemIds: ['dance', 'colors'],
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
          Tags: ['animals'],
          UserData: {
            PlaybackPositionTicks: 3600000000,
            Played: false,
            PlayedPercentage: 21
          }
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
              Tags: ['animals'],
              UserData: {
                PlaybackPositionTicks: 3600000000,
                Played: false,
                PlayedPercentage: 21
              }
            },
            {
              Id: 'sleepy',
              Name: 'Sleepy Moon',
              RunTimeTicks: 19800000000,
              Tags: ['bedtime'],
              UserData: {
                Played: true,
                LastPlayedDate: '2026-09-01T18:00:00.000Z'
              }
            },
            {
              Id: 'fox',
              Name: 'Fox and Fireflies',
              RunTimeTicks: 6600000000,
              Tags: ['animals']
            }
          ]
        },
        {
          id: 'songs',
          name: 'Sing & Dance',
          videos: [
            { Id: 'dance', Name: 'Dance With Me', RunTimeTicks: 7200000000, Tags: ['sing-along', 'movement'] },
            { Id: 'stretch', Name: 'Stretch and Sway', RunTimeTicks: 8400000000, Tags: ['movement'] }
          ]
        },
        {
          id: 'lessons',
          name: 'Little Lessons',
          videos: [
            { Id: 'colors', Name: 'The Color Garden', RunTimeTicks: 5400000000, Tags: ['learning'] }
          ]
        },
        {
          id: 'grownups',
          name: 'Grownups',
          videos: [
            { Id: 'late', Name: 'Late Night Movie', RunTimeTicks: 9600000000, Tags: ['grownups'] }
          ]
        }
      ]
    }
  };
}(window));
```

- [ ] **Step 4: Run the focused GREEN suite and syntax-check the new module plus all version-3 constructors**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js api.test.js storybook-preferences.test.js storybook-model.test.js storybook-discovery.test.js storybook-app.test.js
node -c .\MovieDeck\js\storybook-preferences.js
node -c .\MovieDeck\js\storybook-discovery.js
node -c .\MovieDeck\js\app.js
node -c .\MovieDeck\tests\api.test.js
node -c .\MovieDeck\tests\storybook-discovery.test.js
git diff --check
```

Expected GREEN output: `All Rawi tests passed.` followed by clean exits from every `node -c` command and `git diff --check`.

- [ ] **Step 5: Commit the schema/API/discovery foundation slice**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
git add MovieDeck\index.html MovieDeck\js\api.js MovieDeck\js\app.js MovieDeck\js\preview-fixtures.js MovieDeck\js\storybook-discovery.js MovieDeck\js\storybook-preferences.js MovieDeck\tests\api.test.js MovieDeck\tests\run-tests.js MovieDeck\tests\storybook-app.test.js MovieDeck\tests\storybook-discovery.test.js MovieDeck\tests\storybook-model.test.js MovieDeck\tests\storybook-preferences.test.js
git commit -m "feat: add storybook phase 3 foundation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Friendly Duration Labels

**Files:**
- Modify: `MovieDeck\js\app.js`
- Modify: `MovieDeck\js\copy.js`
- Modify: `MovieDeck\tests\copy.test.js`
- Modify: `MovieDeck\tests\storybook-app.test.js`
- Modify: `MovieDeck\tests\storybook-view.test.js`

**Interfaces:**
- Consumes: `storybookState.durationLabels` from Task 1
- Produces: `storybookRuntime(item) -> string` for Storybook home/library/details only
- Produces: `storybookCardModel(item).minutesLabel -> string`
- Produces: `storybookDetailsModel(item).minutesLabel -> string`
- Preserves: Adult `runtime(item)` and `meta(item)` stay minutes-only

- [ ] **Step 1: Add copy defaults plus Storybook-only duration label assertions before changing runtime code**

Append these defaults to `MovieDeck\js\copy.js` near the other Storybook copy keys and add matching tests in `MovieDeck\tests\copy.test.js`:

```javascript
// copy.js additions
storybookFriendlyRuntime: '{minutes} • {label}',
storybookDurationQuickStory: 'Quick story',
storybookDurationCozyEpisode: 'Cozy episode',
storybookDurationBigMovie: 'Big movie',
```

```javascript
// copy.test.js additions
(function exposesStorybookFriendlyDurationCopyDefaults() {
  assert.strictEqual(
    copy.get('storybookFriendlyRuntime', { minutes: '12 min', label: 'Quick story' }),
    '12 min • Quick story'
  );
  assert.strictEqual(copy.get('storybookDurationQuickStory'), 'Quick story');
  assert.strictEqual(copy.get('storybookDurationCozyEpisode'), 'Cozy episode');
  assert.strictEqual(copy.get('storybookDurationBigMovie'), 'Big movie');
}());
```

Before any of the new `storybook-view.test.js` duration assertions run, extend the fake DOM helpers so the harness can support the card-meta lookup those tests use:

```javascript
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
```

Add this direct harness self-test next to the friendly-duration view coverage so the class lookup stays ordered and recursive:

```javascript
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
```

In `MovieDeck\tests\storybook-view.test.js`, extend the existing renderer coverage so the DOM proves the home/library/details meta field renders the composed label, not just any text:

```javascript
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
```

Add these app-level regressions to `MovieDeck\tests\storybook-app.test.js` using the `basePreferences(...)` helper from Task 1:

```javascript
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
```

- [ ] **Step 2: Run the focused RED loop and verify the current app still shows plain minute counts on Storybook cards/details**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected RED output: the new copy keys are missing, and Storybook card/detail meta text is still plain `12 min` / `28 min` / `41 min` because the runtime uses the shared minute formatter everywhere.

- [ ] **Step 3: Implement Storybook-only friendly duration composition and keep Adult Mode untouched**

In `MovieDeck\js\app.js`, leave `runtime(item)` unchanged for Adult Mode and add these exact Storybook helpers immediately below it:

```javascript
function runtimeMinutesValue(item) {
  var ticks = value(item, 'RunTimeTicks', 'runTimeTicks') || 0;
  return ticks ? Math.round(ticks / 600000000) : 0;
}

function storybookDurationCopyKey(minutes) {
  var labels = storybookState.durationLabels || {};

  if (!labels.enabled || !minutes) {
    return '';
  }
  if (minutes <= labels.quickMaxMinutes) {
    return 'storybookDurationQuickStory';
  }
  if (minutes <= labels.cozyMaxMinutes) {
    return 'storybookDurationCozyEpisode';
  }
  return 'storybookDurationBigMovie';
}

function storybookRuntime(item) {
  var minutes = runtimeMinutesValue(item);
  var labelKey = storybookDurationCopyKey(minutes);
  var minutesText;

  if (!minutes) { return ''; }
  minutesText = copy.get('runtimeMinutes', { minutes: minutes });
  if (!labelKey) {
    return minutesText;
  }
  return copy.get('storybookFriendlyRuntime', {
    label: copy.get(labelKey),
    minutes: minutesText
  });
}
```

Then update the Storybook-only model builders so they use `storybookRuntime(item)` instead of the shared Adult formatter:

```javascript
function storybookCardModel(item) {
  return {
    accentClass: storybookAccentClass(itemId(item)),
    ariaLabel: copy.get('storybookItemAriaLabel', { title: name(item) }),
    artworkUrl: imageUrl(item, 'Primary', 560, 560) || imageUrl(item, 'Backdrop', 960, 540),
    id: itemId(item),
    minutesLabel: storybookRuntime(item),
    progressPercent: playbackPercent(item),
    resumeLabel: resumeTicks(item) > 0 ? copy.get('storybookResumeProgress', { time: runtimeFromTicks(resumeTicks(item)) }) : '',
    title: name(item)
  };
}

function storybookDetailsModel(item) {
  return {
    accentClass: storybookAccentClass(itemId(item)),
    artworkUrl: imageUrl(item, 'Primary', 760, 760) || imageUrl(item, 'Backdrop', 1280, 720),
    minutesLabel: storybookRuntime(item),
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
```

- [ ] **Step 4: Run the targeted GREEN suite plus syntax checks**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
node -c .\MovieDeck\js\copy.js
node -c .\MovieDeck\js\app.js
git diff --check
```

Expected GREEN output: `All Rawi tests passed.` and clean exits from the syntax/diff checks.

- [ ] **Step 5: Commit the friendly-duration slice**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
git add MovieDeck\js\app.js MovieDeck\js\copy.js MovieDeck\tests\copy.test.js MovieDeck\tests\storybook-app.test.js MovieDeck\tests\storybook-view.test.js
git commit -m "feat: add storybook friendly duration labels" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Category Shortcuts and Filtered Storybook Collections

**Files:**
- Modify: `MovieDeck\css\storybook.css`
- Modify: `MovieDeck\index.html`
- Modify: `MovieDeck\js\app.js`
- Modify: `MovieDeck\js\copy.js`
- Modify: `MovieDeck\js\storybook-view.js`
- Modify: `MovieDeck\tests\copy.test.js`
- Modify: `MovieDeck\tests\storybook-app.test.js`
- Modify: `MovieDeck\tests\storybook-view.test.js`

**Interfaces:**
- Consumes: `window.RawiStorybookDiscovery.build(...)`
- Produces: `openStorybookCategory(categoryKey, preferredFocusId?) -> void`
- Produces: `openStorybookCollection(collectionState, preferredFocusId?) -> void`
- Produces: `renderHome(model.categories)` where each category is `{ key: string, title: string, caption: string, accentClass: string }`
- Preserves: `renderLibrary(...)` as the single Storybook collection renderer for both library doors and category shortcuts

- [ ] **Step 1: Add category copy keys, DOM harness nodes, and a focused RED proving Back/focus restoration through the shared collection screen**

Append these copy defaults to `MovieDeck\js\copy.js` and assert them in `MovieDeck\tests\copy.test.js`:

```javascript
// copy.js additions
storybookCategoriesTitle: 'Pick a kind of story',
storybookCategoryAriaLabel: 'Open {category}',
storybookCategorySingDance: 'Sing & Dance',
storybookCategoryBedtime: 'Bedtime Stories',
storybookCategoryAnimals: 'Animal Friends',
storybookCategoryLearning: 'Little Lessons',
storybookCategoryMovement: 'Move Around',
```

```javascript
// copy.test.js additions
(function exposesStorybookCategoryCopyDefaults() {
  assert.strictEqual(copy.get('storybookCategoriesTitle'), 'Pick a kind of story');
  assert.strictEqual(copy.get('storybookCategorySingDance'), 'Sing & Dance');
  assert.strictEqual(copy.get('storybookCategoryBedtime'), 'Bedtime Stories');
  assert.strictEqual(copy.get('storybookCategoryAnimals'), 'Animal Friends');
  assert.strictEqual(copy.get('storybookCategoryLearning'), 'Little Lessons');
  assert.strictEqual(copy.get('storybookCategoryMovement'), 'Move Around');
  assert.strictEqual(
    copy.get('storybookCategoryAriaLabel', { category: 'Animal Friends' }),
    'Open Animal Friends'
  );
}());
```

In `MovieDeck\tests\storybook-view.test.js`, extend the view harness with category-section nodes and callback capture so the renderer can be tested directly:

```javascript
// buttons map additions inside loadViewHarness()
categorySection: append(document, document.body, 'section', 'storybook-categories-section'),
categories: append(document, document.body, 'div', 'storybook-categories'),
categoriesTitle: append(document, document.body, 'h2', 'storybook-categories-title'),
```

```javascript
// copy stub additions inside loadViewHarness()
if (key === 'storybookCategoriesTitle') { return 'Pick a kind of story'; }
if (key === 'storybookCategoryAriaLabel') { return 'Open ' + values.category; }
if (key === 'storybookCategorySingDance') { return 'Sing & Dance'; }
if (key === 'storybookCategoryBedtime') { return 'Bedtime Stories'; }
if (key === 'storybookCategoryAnimals') { return 'Animal Friends'; }
if (key === 'storybookCategoryLearning') { return 'Little Lessons'; }
if (key === 'storybookCategoryMovement') { return 'Move Around'; }
```

```javascript
// callback additions inside loadViewHarness()
var openCategories = [];
```

```javascript
// merge this callback into the existing window.RawiStorybookView.init(...) callback object
var categoryCallbacks = {
  onOpenCategory: function (categoryKey) {
    openCategories.push(categoryKey);
  }
};
```

```javascript
// add this property to the harness return object
openCategories: function () { return openCategories.slice(); },
```

Then add this direct renderer regression:

```javascript
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
```

In `MovieDeck\tests\storybook-app.test.js`, add category nodes to `buildDom(document)`, load the new discovery module alongside the existing catalogue/model modules, and add this focused integration RED:

```javascript
// buildDom(document) additions under storybookScreen
var storybookCategoriesSection = append(storybookScreen, 'section', 'storybook-categories-section', '');
append(storybookCategoriesSection, 'h2', 'storybook-categories-title', '');
append(storybookCategoriesSection, 'div', 'storybook-categories', '');
```

```javascript
// loadAppHarness() additions near the existing model/catalogue loads
var discoveryWindow = load('js/storybook-discovery.js', { window: {} });
```

```javascript
// add this property to the existing window object literal inside loadAppHarness()
RawiStorybookDiscovery: discoveryWindow.RawiStorybookDiscovery,
```

```javascript
// copyMap additions
storybookCategoriesTitle: 'Pick a kind of story',
storybookCategoryAriaLabel: 'Open {category}',
storybookCategorySingDance: 'Sing & Dance',
storybookCategoryBedtime: 'Bedtime Stories',
storybookCategoryAnimals: 'Animal Friends',
storybookCategoryLearning: 'Little Lessons',
storybookCategoryMovement: 'Move Around',
```

```javascript
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
```

- [ ] **Step 2: Run the focused RED loop and confirm the current app still has no category UI and cannot round-trip shared collection state**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected RED output: the new category copy keys are missing, `renderHome()` never creates `#storybook-category-animals`, and the shared library/details flow still only knows about physical library doors, not category-based collections.

- [ ] **Step 3: Add category shortcuts on Storybook home and route them through a shared collection state object**

Insert this new section into `MovieDeck\index.html` immediately after the favorites section and before Story Doors:

```html
<section id="storybook-categories-section" class="storybook-section">
  <h2 id="storybook-categories-title"
      class="storybook-section-title"
      data-copy="storybookCategoriesTitle">Pick a kind of story</h2>
  <div id="storybook-categories" class="storybook-category-strip"></div>
</section>
```

Add these scoped styles to `MovieDeck\css\storybook.css` near the other home-section blocks:

```css
.storybook-category-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}
.storybook-category-button {
  background: rgba(10, 20, 44, .78);
  border: 2px solid rgba(255,255,255,.16);
  border-radius: 28px;
  color: var(--storybook-ink);
  min-width: 240px;
  padding: 18px 22px;
  text-align: left;
}
.storybook-category-button:focus {
  box-shadow: 0 0 0 6px var(--storybook-gold), 0 24px 55px rgba(4,9,22,.5);
  outline: 0;
}
.storybook-category-title,
.storybook-category-subtitle {
  display: block;
}
.storybook-category-title {
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 28px;
  line-height: 1.12;
}
.storybook-category-subtitle {
  color: var(--storybook-muted);
  margin-top: 10px;
}
```

In `MovieDeck\js\storybook-view.js`, add this helper above `renderHome()` and wire the new callback inside `init(...)`:

```javascript
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
```

Update `renderHome(model)` so it clears, shows, and focuses categories before doors when no earlier preferred target exists:

```javascript
var categorySection = byId('storybook-categories-section');
var categories = byId('storybook-categories');
var categoryButtons = model && model.categories ? model.categories : [];
categories.innerHTML = '';
categoryButtons.forEach(function (category) {
  var button = createCategoryButton(category);
  if (!firstChoice) { firstChoice = button; }
  categories.appendChild(button);
});
categorySection.style.display = categoryButtons.length ? 'block' : 'none';
if (!firstChoice && categoryButtons.length) {
  firstChoice = categories.firstChild;
}
```

In `MovieDeck\js\app.js`, convert the library-screen state into a shared collection state and consume `RawiStorybookDiscovery.build(...)` instead of deriving categories in `app.js`:

```javascript
var storybookDiscovery = global.RawiStorybookDiscovery;
var currentStorybookDiscovery = null;
var storybookLibraryState = {
  items: [],
  kind: 'library',
  categoryKey: '',
  libraryId: '',
  returnFocusId: '',
  title: ''
};
var storybookDetailsState = {
  collection: null,
  focusId: '',
  source: 'home'
};

function buildStorybookDiscovery() {
  currentStorybookDiscovery = storybookDiscovery.build({
    catalogue: buildStorybookCatalogue(),
    nowMs: currentStorybookNowMs(),
    preferences: storybookState,
    sessionSeed: currentStorybookSessionSeed()
  });
  return currentStorybookDiscovery;
}

function selectedStorybookCategory(categoryKey) {
  var discovery = currentStorybookDiscovery || buildStorybookDiscovery();
  var categories = discovery.categories || [];
  var i;

  for (i = 0; i < categories.length; i += 1) {
    if (categories[i].key === categoryKey) {
      return categories[i];
    }
  }
  return null;
}

function openStorybookCollection(collectionState, preferredFocusId) {
  storybookLibraryState = collectionState;
  showScreen('storybook-library-screen');
  storybookView.renderLibrary({
    cards: collectionState.items.map(function (item) {
      return storybookCardModel(item);
    }),
    preferredFocusId: preferredFocusId,
    title: collectionState.title
  });
}

function openStorybookLibrary(libraryId, preferredFocusId) {
  var library = selectedStorybookLibrary(libraryId);

  if (!library) { return; }
  openStorybookCollection({
    items: library.videos,
    kind: 'library',
    categoryKey: '',
    libraryId: libraryId,
    returnFocusId: 'storybook-door-' + libraryId,
    title: library.name
  }, preferredFocusId);
}

function openStorybookCategory(categoryKey, preferredFocusId) {
  var category = selectedStorybookCategory(categoryKey);

  if (!category) { return; }
  openStorybookCollection({
    items: category.items,
    kind: 'category',
    categoryKey: categoryKey,
    libraryId: '',
    returnFocusId: 'storybook-category-' + categoryKey,
    title: copy.get(category.copyKey)
  }, preferredFocusId);
}
```

Replace the `renderStorybookHome(...)`, `openStorybookDetails(...)`, and `closeStorybookDetails()` portions that currently assume only physical libraries with these exact category-aware versions:

```javascript
function renderStorybookHome(preferredFocusId) {
  var catalogue = buildStorybookCatalogue();
  var discovery = buildStorybookDiscovery();

  storybookView.renderHome({
    childName: storybookState.childName,
    categories: discovery.categories.map(function (category) {
      return {
        accentClass: storybookAccentClass(category.key),
        caption: copy.get('libraryCaption', { count: category.items.length }),
        key: category.key,
        title: copy.get(category.copyKey)
      };
    }),
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

function openStorybookDetails(item, source) {
  var id = itemId(item);

  selectedItem = item;
  updateFavoriteButton(null);
  storybookDetailsState = {
    collection: activeScreen === 'storybook-library-screen' ? {
      items: storybookLibraryState.items.slice(),
      kind: storybookLibraryState.kind,
      categoryKey: storybookLibraryState.categoryKey,
      libraryId: storybookLibraryState.libraryId,
      returnFocusId: storybookLibraryState.returnFocusId,
      title: storybookLibraryState.title
    } : null,
    focusId: source === 'library' ? 'storybook-library-card-' + id : 'storybook-' + source + '-card-' + id,
    source: source
  };
  if (source === 'resume') {
    storybookDetailsState.focusId = 'storybook-resume-card';
  }
  showScreen('storybook-details-screen');
  storybookView.renderDetails(storybookDetailsModel(item));
}

function closeStorybookDetails() {
  if (storybookDetailsState.source === 'library' && storybookDetailsState.collection) {
    openStorybookCollection(storybookDetailsState.collection, storybookDetailsState.focusId);
    return;
  }
  showScreen('storybook-screen');
  renderStorybookHome(storybookDetailsState.focusId);
}
```

And extend the `storybookView.init(...)` callback wiring to pass the new category callback through:

```javascript
// merge into the existing storybookView.init(...) callback object
var storybookViewCategoryCallbacks = {
  onOpenCategory: openStorybookCategory
};
```

- [ ] **Step 4: Run the targeted GREEN suite and confirm shared collection routing works for both doors and categories**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
node -c .\MovieDeck\js\storybook-view.js
node -c .\MovieDeck\js\app.js
git diff --check
```

Expected GREEN output: `All Rawi tests passed.` and clean syntax/diff exits.

- [ ] **Step 5: Commit the category-shortcut slice**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
git add MovieDeck\css\storybook.css MovieDeck\index.html MovieDeck\js\app.js MovieDeck\js\copy.js MovieDeck\js\storybook-view.js MovieDeck\tests\copy.test.js MovieDeck\tests\storybook-app.test.js MovieDeck\tests\storybook-view.test.js
git commit -m "feat: add storybook category shortcuts" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4: Stable Tonight's Little Menu

**Files:**
- Modify: `MovieDeck\css\storybook.css`
- Modify: `MovieDeck\index.html`
- Modify: `MovieDeck\js\app.js`
- Modify: `MovieDeck\js\copy.js`
- Modify: `MovieDeck\js\storybook-view.js`
- Modify: `MovieDeck\tests\copy.test.js`
- Modify: `MovieDeck\tests\storybook-app.test.js`
- Modify: `MovieDeck\tests\storybook-discovery.test.js`
- Modify: `MovieDeck\tests\storybook-view.test.js`

**Interfaces:**
- Consumes: `window.RawiStorybookDiscovery.build(...)`
- Produces: `renderHome(model.littleMenu)` where each card uses the existing Storybook media-card contract
- Produces: `openStorybookDetails(item, 'menu')` so Back returns to the exact menu card
- Preserves: menu stays stable for the app session because `build(...)` stays pure and the app reuses the launch-captured `nowMs` plus in-memory `storybookSessionSeed`

- [ ] **Step 1: Add the little-menu section, replace stale home test names, and assert stability/no-autoplay before changing the runtime**

Append this copy key to `MovieDeck\js\copy.js` and assert it in `MovieDeck\tests\copy.test.js`:

```javascript
storybookLittleMenuTitle: "Tonight's Little Menu",
```

```javascript
(function exposesStorybookLittleMenuCopyDefault() {
  assert.strictEqual(copy.get('storybookLittleMenuTitle'), "Tonight's Little Menu");
}());
```

In `MovieDeck\tests\storybook-view.test.js`, add menu DOM nodes to the harness and replace the stale `rendersResumeAndFavoritesBeforeStoryDoors` test with this version so the test name matches the new Phase 3 home contract:

```javascript
// buttons map additions
littleMenu: append(document, document.body, 'div', 'storybook-little-menu'),
littleMenuSection: append(document, document.body, 'section', 'storybook-little-menu-section'),
littleMenuTitle: append(document, document.body, 'h2', 'storybook-little-menu-title'),
```

```javascript
// copy stub addition
if (key === 'storybookLittleMenuTitle') { return "Tonight's Little Menu"; }
```

```javascript
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
```

In `MovieDeck\tests\storybook-app.test.js`, add this app-level RED proving the menu comes from the stable session seed and only opens details, never playback. Use direct container children plus `data-item-id` reads so the fake selector engine does not need new descendant+attribute parsing:

```javascript
// buildDom(document) additions under storybookScreen
var storybookLittleMenuSection = append(storybookScreen, 'section', 'storybook-little-menu-section', '');
append(storybookLittleMenuSection, 'h2', 'storybook-little-menu-title', '');
append(storybookLittleMenuSection, 'div', 'storybook-little-menu', '');
```

```javascript
// copyMap addition
storybookLittleMenuTitle: "Tonight's Little Menu",
```

```javascript
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

      assert.deepStrictEqual(JSON.parse(JSON.stringify(firstIds)), ['dance', 'colors', 'fox']);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(secondIds)), ['dance', 'colors', 'fox']);

      harness.document.getElementById('storybook-menu-card-dance').click();
      assert.strictEqual(harness.screenActive('storybook-details-screen'), true);
      assert.deepStrictEqual(harness.playCalls(), []);
    });
  });
});
```

- [ ] **Step 2: Run the focused RED loop and confirm Storybook home still has no little-menu section**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-discovery.test.js storybook-view.test.js storybook-app.test.js
```

Expected RED output: `storybookLittleMenuTitle` is missing, `#storybook-little-menu` does not exist, and Storybook home still jumps directly from resume/favorites/categories to Story Doors.

- [ ] **Step 3: Render the stable Tonight's Little Menu from the pure discovery output**

Insert this section into `MovieDeck\index.html` immediately after the resume section and before favorites:

```html
<section id="storybook-little-menu-section" class="storybook-section">
  <h2 id="storybook-little-menu-title"
      class="storybook-section-title"
      data-copy="storybookLittleMenuTitle">Tonight's Little Menu</h2>
  <div id="storybook-little-menu" class="storybook-card-strip"></div>
</section>
```

In `MovieDeck\css\storybook.css`, let menu cards reuse the favorite-card visual system with their own class names:

```css
.storybook-menu-card {
  background: rgba(11, 23, 51, .82);
  border: 2px solid rgba(255,255,255,.16);
  border-radius: 32px;
  color: var(--storybook-ink);
  flex: 0 0 320px;
  min-height: 300px;
  overflow: hidden;
  padding: 0;
  text-align: left;
}
.storybook-menu-card-art,
.storybook-menu-card-image,
.storybook-menu-card-fallback {
  height: 200px;
  width: 320px;
}
.storybook-menu-card-fallback {
  align-items: flex-end;
  color: var(--storybook-ink);
  display: flex;
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 28px;
  justify-content: flex-start;
  line-height: 1.05;
  padding: 22px;
}
.storybook-menu-card-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: 26px 28px;
}
```

In `MovieDeck\js\storybook-view.js`, update `renderHome(model)` so it accepts `littleMenu`, renders `storybook-menu-card-*` cards, and keeps the home focus order `preferredFocusId -> resume -> little menu -> favorites -> categories -> doors -> edit`:

```javascript
var littleMenuSection = byId('storybook-little-menu-section');
var littleMenu = byId('storybook-little-menu');
var menuCards = model && model.littleMenu ? model.littleMenu : [];
littleMenu.innerHTML = '';
menuCards.forEach(function (item) {
  var card = createStoryCard(item, 'storybook-menu-card', 'menu');
  if (!firstChoice) { firstChoice = card; }
  littleMenu.appendChild(card);
});
littleMenuSection.style.display = menuCards.length ? 'block' : 'none';
```

In `MovieDeck\js\app.js`, pass the stable little-menu cards through from `RawiStorybookDiscovery.build(...)`:

```javascript
function renderStorybookHome(preferredFocusId) {
  var catalogue = buildStorybookCatalogue();
  var discovery = buildStorybookDiscovery();

  storybookView.renderHome({
    childName: storybookState.childName,
    categories: discovery.categories.map(function (category) {
      return {
        accentClass: storybookAccentClass(category.key),
        caption: copy.get('libraryCaption', { count: category.items.length }),
        key: category.key,
        title: copy.get(category.copyKey)
      };
    }),
    favorites: catalogue.favoriteItems.map(function (item) {
      return storybookCardModel(item);
    }),
    libraries: catalogue.selectedLibraries.map(function (group) {
      return storybookDoorModel(group);
    }),
    littleMenu: discovery.littleMenu.map(function (item) {
      return storybookCardModel(item);
    }),
    preferredFocusId: preferredFocusId,
    reducedMotion: isStorybookReducedMotion(),
    resume: catalogue.resumeItem ? storybookCardModel(catalogue.resumeItem) : null
  });
}
```

No new `app.js` derivation belongs here beyond mapping the pure output. The menu stability is already owned by `storybook-discovery.js` plus the launch bootstrap seam from Task 1, so exact item-order assertions belong only in tests that pass a fixed `storybookBootstrap`.

- [ ] **Step 4: Run the targeted GREEN suite and prove menu stability survives rerender/focus changes**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-discovery.test.js storybook-view.test.js storybook-app.test.js
node -c .\MovieDeck\js\storybook-view.js
node -c .\MovieDeck\js\app.js
git diff --check
```

Expected GREEN output: `All Rawi tests passed.` and clean syntax/diff exits.

- [ ] **Step 5: Commit the little-menu slice**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
git add MovieDeck\css\storybook.css MovieDeck\index.html MovieDeck\js\app.js MovieDeck\js\copy.js MovieDeck\js\storybook-view.js MovieDeck\tests\copy.test.js MovieDeck\tests\storybook-app.test.js MovieDeck\tests\storybook-discovery.test.js MovieDeck\tests\storybook-view.test.js
git commit -m "feat: add stable storybook little menu" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5: Magic Pick Confirmation Flow

**Files:**
- Modify: `MovieDeck\css\storybook.css`
- Modify: `MovieDeck\index.html`
- Modify: `MovieDeck\js\app.js`
- Modify: `MovieDeck\js\copy.js`
- Modify: `MovieDeck\js\storybook-view.js`
- Modify: `MovieDeck\tests\copy.test.js`
- Modify: `MovieDeck\tests\storybook-app.test.js`
- Modify: `MovieDeck\tests\storybook-view.test.js`

**Interfaces:**
- Consumes: `window.RawiStorybookDiscovery.magicPick(...)`
- Produces: `renderMagicPick(model) -> void`
- Produces: `openStorybookMagicPick() -> void`
- Produces: `handleStorybookMagicPickPrimary() -> open Storybook details when item exists, else open home focused on Story Doors`
- Produces: `handleStorybookMagicPickSecondary() -> reroll when item exists, else return home`
- Preserves: Magic Pick never calls `startPlayback(...)` directly and the ending/player screens still have no mode toggle

- [ ] **Step 1: Add Magic Pick copy, harness nodes, export coverage, and a direct reduced-motion RED for the new screen before implementing it**

Append these copy keys to `MovieDeck\js\copy.js` and assert them in `MovieDeck\tests\copy.test.js`:

```javascript
storybookMagicPickButton: 'Magic Pick',
storybookMagicPickTitle: 'Magic Pick',
storybookMagicPickOpenButton: 'Tell me about this story',
storybookMagicPickAgainButton: 'Pick again',
storybookMagicPickBackButton: '← Storybook',
storybookMagicReasonUnwatched: 'A new story to discover.',
storybookMagicReasonFavorite: 'A favorite with a little extra sparkle.',
storybookMagicReasonDifferentCategory: 'Something a little different from last time.',
storybookMagicReasonAnyStory: 'A cozy surprise from your Story Doors.',
storybookMagicPickEmptyTitle: 'No Magic Pick right now',
storybookMagicPickEmptyBody: 'Everything in the selected Storybook libraries was finished recently. Try a Story Door instead.',
storybookMagicPickEmptyPrimaryButton: 'Open Story Doors',
storybookMagicPickEmptySecondaryButton: 'Back to Storybook',
```

```javascript
(function exposesStorybookMagicPickCopyDefaults() {
  assert.strictEqual(copy.get('storybookMagicPickButton'), 'Magic Pick');
  assert.strictEqual(copy.get('storybookMagicPickTitle'), 'Magic Pick');
  assert.strictEqual(copy.get('storybookMagicPickOpenButton'), 'Tell me about this story');
  assert.strictEqual(copy.get('storybookMagicPickAgainButton'), 'Pick again');
  assert.strictEqual(copy.get('storybookMagicPickBackButton'), '← Storybook');
  assert.strictEqual(copy.get('storybookMagicReasonUnwatched'), 'A new story to discover.');
  assert.strictEqual(copy.get('storybookMagicReasonFavorite'), 'A favorite with a little extra sparkle.');
  assert.strictEqual(copy.get('storybookMagicReasonDifferentCategory'), 'Something a little different from last time.');
  assert.strictEqual(copy.get('storybookMagicReasonAnyStory'), 'A cozy surprise from your Story Doors.');
  assert.strictEqual(copy.get('storybookMagicPickEmptyTitle'), 'No Magic Pick right now');
  assert.strictEqual(copy.get('storybookMagicPickEmptyBody'), 'Everything in the selected Storybook libraries was finished recently. Try a Story Door instead.');
  assert.strictEqual(copy.get('storybookMagicPickEmptyPrimaryButton'), 'Open Story Doors');
  assert.strictEqual(copy.get('storybookMagicPickEmptySecondaryButton'), 'Back to Storybook');
}());
```

In `MovieDeck\tests\storybook-view.test.js`, add the Magic Pick home section plus the full confirmation-screen DOM to the harness before any render tests run, capture a new callback surface, and add this renderer/export regression so Observation 244 is addressed explicitly:

```javascript
// add these nodes after the existing buttons map is created
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
```

```javascript
// mode-button setup additions
buttons.magicAdult.setAttribute('data-mode', 'adult');
buttons.magicStorybook.setAttribute('data-mode', 'storybook');
document.modeButtons = document.modeButtons.concat([buttons.magicAdult, buttons.magicStorybook]);
```

```javascript
// callback additions
var magicActions = [];
```

```javascript
// merge these callbacks into the existing window.RawiStorybookView.init(...) callback object
var magicCallbacks = {
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
  }
};
```

```javascript
// add this property to the harness return object
magicActions: function () { return magicActions.slice(); },
```

```javascript
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
```

In `MovieDeck\tests\storybook-app.test.js`, add a direct reduced-motion regression for the new screen instead of only broad set-membership coverage:

```javascript
// buildDom(document) additions
var storybookMagicHomeSection = append(storybookScreen, 'section', 'storybook-magic-pick-home-section', '');
focusable(append(storybookMagicHomeSection, 'button', 'storybook-magic-pick-button', ''));
var storybookMagicScreen = append(document.body, 'section', 'storybook-magic-pick-screen', 'screen');
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
```

```javascript
// copyMap additions
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
```

```javascript
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
```

- [ ] **Step 2: Run the focused RED loop and verify Magic Pick still does not exist anywhere in the UI or export surface**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected RED output: the new Magic Pick copy keys are missing, `renderMagicPick` is undefined, `#storybook-magic-pick-button` / `#storybook-magic-pick-screen` do not exist, and the reduced-motion test cannot prove entry gating for a screen the runtime has not added yet.

- [ ] **Step 3: Add the Magic Pick trigger, confirmation screen, app state, and no-autoplay callbacks**

Insert the Magic Pick trigger on Storybook home in `MovieDeck\index.html` immediately before Story Doors:

```html
<section id="storybook-magic-pick-home-section" class="storybook-section">
  <button id="storybook-magic-pick-button"
          class="storybook-edit focusable"
          data-focusable
          data-copy="storybookMagicPickButton">Magic Pick</button>
</section>
```

Then insert this dedicated confirmation screen immediately after the Storybook details screen and before the ending screen:

```html
<section id="storybook-magic-pick-screen"
         class="screen storybook-screen storybook-magic-pick-screen"
         aria-labelledby="storybook-magic-pick-title">
  <div class="storybook-sky" aria-hidden="true">
    <span class="storybook-moon"></span>
    <span class="storybook-star star-one">✦</span>
    <span class="storybook-star star-two">✧</span>
    <span class="storybook-star star-three">✦</span>
  </div>
  <header class="storybook-topbar">
    <div class="storybook-wordmark"><i>/</i> <span data-copy="appName">Rawi</span></div>
    <div class="mode-toggle" role="group" aria-label="Display mode">
      <button id="storybook-magic-adult-mode-button"
              class="mode-option focusable"
              data-focusable
              data-mode="adult"
              data-copy="modeAdult">Adult</button>
      <button id="storybook-magic-storybook-mode-button"
              class="mode-option focusable"
              data-focusable
              data-mode="storybook"
              data-copy="modeStorybook">Storybook</button>
    </div>
  </header>
  <div class="storybook-page storybook-magic-pick-page">
    <button id="storybook-magic-pick-back"
            class="storybook-edit focusable"
            data-focusable
            data-copy="storybookMagicPickBackButton">← Storybook</button>
    <article class="storybook-details-card storybook-magic-card">
      <div id="storybook-magic-pick-art" class="storybook-details-art"></div>
      <div class="storybook-details-copy">
        <p class="storybook-section-title" data-copy="storybookMagicPickTitle">Magic Pick</p>
        <h1 id="storybook-magic-pick-title"></h1>
        <p id="storybook-magic-pick-reason" class="storybook-library-count"></p>
        <p id="storybook-magic-pick-meta" class="storybook-library-count"></p>
        <p id="storybook-magic-pick-overview" class="storybook-details-overview"></p>
        <div class="storybook-details-actions">
          <button id="storybook-magic-pick-primary" class="button button-primary focusable" data-focusable></button>
          <button id="storybook-magic-pick-secondary" class="button button-secondary focusable" data-focusable></button>
        </div>
      </div>
    </article>
  </div>
</section>
```

Add the minimal scoped styling in `MovieDeck\css\storybook.css`:

```css
.storybook-magic-pick-page {
  padding-top: 150px;
}
.storybook-magic-card {
  align-items: center;
}
.storybook-magic-pick-screen .storybook-edit {
  bottom: auto;
  top: 150px;
}
```

In `MovieDeck\js\storybook-view.js`, add `renderMagicPick(model)` and wire the trigger/screen callbacks into `init(...)`, then update the export object so later callers never see `undefined`:

```javascript
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
```

```javascript
// inside init(...)
byId('storybook-magic-pick-button').addEventListener('click', callbacks.onOpenMagicPick);
byId('storybook-magic-pick-back').addEventListener('click', callbacks.onCloseMagicPick);
byId('storybook-magic-pick-primary').addEventListener('click', callbacks.onMagicPickPrimary);
byId('storybook-magic-pick-secondary').addEventListener('click', callbacks.onMagicPickSecondary);
```

```javascript
// export object
renderMagicPick: renderMagicPick,
```

In `MovieDeck\js\app.js`, add the new screen to `STORYBOOK_PRESENTATION_SCREENS`, store the current Magic Pick result, and wire the no-autoplay flow exactly like this:

```javascript
var storybookMagicPickState = {
  empty: false,
  result: null,
  returnFocusId: 'storybook-magic-pick-button'
};
var STORYBOOK_PRESENTATION_SCREENS = {
  'storybook-screen': true,
  'storybook-library-screen': true,
  'storybook-details-screen': true,
  'storybook-magic-pick-screen': true,
  'storybook-ending-screen': true
};

function firstStoryDoorFocusId() {
  var catalogue = currentStorybookCatalogue || buildStorybookCatalogue();
  if (catalogue.selectedLibraries && catalogue.selectedLibraries.length) {
    return 'storybook-door-' + catalogue.selectedLibraries[0].id;
  }
  return 'storybook-edit-libraries';
}

function storybookMagicRandom() {
  if (previewStorybookFixture && previewStorybookFixture.magicRandom !== undefined) {
    return function () {
      return Number(previewStorybookFixture.magicRandom);
    };
  }
  if (typeof global.RawiStorybookRandom === 'function') {
    return global.RawiStorybookRandom;
  }
  return Math.random;
}

function storybookMagicPickModel(result) {
  var item = result && result.item;
  return {
    accentClass: item ? storybookAccentClass(itemId(item)) : 'storybook-accent-sea',
    artworkUrl: item ? (imageUrl(item, 'Primary', 760, 760) || imageUrl(item, 'Backdrop', 1280, 720)) : '',
    empty: !item,
    minutesLabel: item ? storybookRuntime(item) : '',
    overview: item ? (value(item, 'Overview', 'overview') || copy.get('noSynopsis')) : copy.get('storybookMagicPickEmptyBody'),
    primaryActionLabel: item ? copy.get('storybookMagicPickOpenButton') : copy.get('storybookMagicPickEmptyPrimaryButton'),
    reason: copy.get(result && result.reason ? result.reason.copyKey : 'storybookMagicReasonAnyStory'),
    secondaryActionLabel: item ? copy.get('storybookMagicPickAgainButton') : copy.get('storybookMagicPickEmptySecondaryButton'),
    title: item ? name(item) : copy.get('storybookMagicPickEmptyTitle')
  };
}

function renderStorybookMagicPick() {
  storybookView.renderMagicPick(storybookMagicPickModel(storybookMagicPickState.result));
}

function openStorybookMagicPick() {
  var result = storybookDiscovery.magicPick({
    catalogue: buildStorybookCatalogue(),
    discovery: buildStorybookDiscovery(),
    nowMs: currentStorybookNowMs(),
    preferences: storybookState,
    random: storybookMagicRandom()
  });

  storybookMagicPickState = {
    empty: !result.item,
    result: result,
    returnFocusId: 'storybook-magic-pick-button'
  };
  showScreen('storybook-magic-pick-screen');
  renderStorybookMagicPick();
}

function closeStorybookMagicPick() {
  showScreen('storybook-screen');
  renderStorybookHome(storybookMagicPickState.returnFocusId || 'storybook-magic-pick-button');
}

function handleStorybookMagicPickPrimary() {
  if (!storybookMagicPickState.result || !storybookMagicPickState.result.item) {
    showScreen('storybook-screen');
    renderStorybookHome(firstStoryDoorFocusId());
    return;
  }
  openStorybookDetails(storybookMagicPickState.result.item, 'magic');
}

function handleStorybookMagicPickSecondary() {
  if (!storybookMagicPickState.result || !storybookMagicPickState.result.item) {
    closeStorybookMagicPick();
    return;
  }
  openStorybookMagicPick();
}
```

Update `openStorybookDetails(...)`, `closeStorybookDetails()`, `handleBack()`, and `storybookView.init(...)` so Magic Pick behaves like a real browsing screen with exact Back/focus restoration:

```javascript
if (source === 'magic') {
  storybookDetailsState.focusId = 'storybook-magic-pick-primary';
}
```

```javascript
function closeStorybookDetails() {
  if (storybookDetailsState.source === 'library' && storybookDetailsState.collection) {
    openStorybookCollection(storybookDetailsState.collection, storybookDetailsState.focusId);
    return;
  }
  if (storybookDetailsState.source === 'magic') {
    showScreen('storybook-magic-pick-screen');
    renderStorybookMagicPick();
    return;
  }
  showScreen('storybook-screen');
  renderStorybookHome(storybookDetailsState.focusId);
}
```

```javascript
if (activeScreen === 'storybook-magic-pick-screen') {
  closeStorybookMagicPick();
  return;
}
```

```javascript
// merge into the existing storybookView.init(...) callback object
var storybookViewMagicCallbacks = {
  onOpenMagicPick: openStorybookMagicPick,
  onCloseMagicPick: closeStorybookMagicPick,
  onMagicPickPrimary: handleStorybookMagicPickPrimary,
  onMagicPickSecondary: handleStorybookMagicPickSecondary
};
```

Finally, show or hide the home trigger in `renderHome(model)` using `model.showMagicPick` so the button appears whenever Storybook has selected libraries:

```javascript
var magicPickHomeSection = byId('storybook-magic-pick-home-section');
var magicPickButton = byId('storybook-magic-pick-button');
if (magicPickHomeSection) {
  magicPickHomeSection.style.display = model && model.showMagicPick ? 'block' : 'none';
}
if (!firstChoice && magicPickButton && model && model.showMagicPick) {
  firstChoice = magicPickButton;
}
```

And pass `showMagicPick: catalogue.selectedLibraries.length > 0` from `renderStorybookHome(...)`.

- [ ] **Step 4: Run the targeted GREEN suite and prove Magic Pick never jumps into playback**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
node -c .\MovieDeck\js\storybook-view.js
node -c .\MovieDeck\js\app.js
git diff --check
```

Expected GREEN output: `All Rawi tests passed.` The app test proof must show `screenActive('storybook-magic-pick-screen') === true`, `playCalls()` remains `[]` until the user reaches Storybook details and explicitly presses Play there, and reduced motion skips `animations.enterScreen(...)` only for the new Magic Pick screen when it is actually enabled.

- [ ] **Step 5: Commit the Magic Pick slice**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
git add MovieDeck\css\storybook.css MovieDeck\index.html MovieDeck\js\app.js MovieDeck\js\copy.js MovieDeck\js\storybook-view.js MovieDeck\tests\copy.test.js MovieDeck\tests\storybook-app.test.js MovieDeck\tests\storybook-view.test.js
git commit -m "feat: add storybook magic pick" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 6: Parent Settings for Tags, Durations, and Recent History

**Files:**
- Modify: `MovieDeck\css\storybook.css`
- Modify: `MovieDeck\index.html`
- Modify: `MovieDeck\js\app.js`
- Modify: `MovieDeck\js\copy.js`
- Modify: `MovieDeck\js\storybook-view.js`
- Modify: `MovieDeck\tests\copy.test.js`
- Modify: `MovieDeck\tests\storybook-app.test.js`
- Modify: `MovieDeck\tests\storybook-view.test.js`

**Interfaces:**
- Consumes: version-3 preference fields from Task 1
- Produces: `renderSettings(libraries, preferences, missingIds, recovery)` now fills and disables category tag inputs, duration-label inputs, and recent-history input
- Produces: `saveSettings() -> callbacks.onPreferencesChange({ enabled, childName, libraryIds, categoryTags, durationLabels, recentHistoryDays, reducedMotion })`
- Preserves: explicit corrupt-preference recovery/reset flow and write barrier from Phase 2

- [ ] **Step 1: Add the settings fields, update the view harness geometry/copy, and write save-path regressions for every remaining constructor**

Append these settings copy keys to `MovieDeck\js\copy.js` and assert them in `MovieDeck\tests\copy.test.js`:

```javascript
storybookCategoryTagsLabel: 'Jellyfin tags for Storybook categories',
storybookDurationSettingsLabel: 'Friendly duration labels',
storybookDurationLabelsEnabledLabel: 'Show friendly duration labels on Storybook cards and details',
storybookDurationQuickMaxLabel: 'Quick story up to this many minutes',
storybookDurationCozyMaxLabel: 'Cozy episode up to this many minutes',
storybookRecentHistoryDaysLabel: 'Hide completed stories for this many days',
storybookDurationThresholdError: 'Quick story minutes must be at least 1, and Cozy episode minutes must be greater than or equal to Quick story minutes.',
storybookRecentHistoryDaysError: 'Recent history days must be 0 or more.',
```

```javascript
(function exposesStorybookPhase3SettingsCopyDefaults() {
  assert.strictEqual(copy.get('storybookCategoryTagsLabel'), 'Jellyfin tags for Storybook categories');
  assert.strictEqual(copy.get('storybookDurationSettingsLabel'), 'Friendly duration labels');
  assert.strictEqual(copy.get('storybookDurationLabelsEnabledLabel'), 'Show friendly duration labels on Storybook cards and details');
  assert.strictEqual(copy.get('storybookDurationQuickMaxLabel'), 'Quick story up to this many minutes');
  assert.strictEqual(copy.get('storybookDurationCozyMaxLabel'), 'Cozy episode up to this many minutes');
  assert.strictEqual(copy.get('storybookRecentHistoryDaysLabel'), 'Hide completed stories for this many days');
  assert.strictEqual(copy.get('storybookDurationThresholdError'), 'Quick story minutes must be at least 1, and Cozy episode minutes must be greater than or equal to Quick story minutes.');
  assert.strictEqual(copy.get('storybookRecentHistoryDaysError'), 'Recent history days must be 0 or more.');
}());
```

In `MovieDeck\tests\storybook-view.test.js`, add this shared helper and use it for every settings-focused fixture in `identifiesOneOrManyMissingLibraryIdsOnlyInSettings`, `showsRecoveryResetControlsOnlyWhenNeeded`, `settingsSaveEmitsCategoryTagsDurationLabelsAndHistoryWindow`, and the new validation tests below:

```javascript
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
```

Also extend the existing `loadViewHarness()` copy stub and the `storybook-app.test.js` `copyMap` so the settings harnesses know every new label and validation string:

```javascript
// storybook-view.test.js copy stub additions
if (key === 'storybookCategoryTagsLabel') { return 'Jellyfin tags for Storybook categories'; }
if (key === 'storybookDurationSettingsLabel') { return 'Friendly duration labels'; }
if (key === 'storybookDurationLabelsEnabledLabel') { return 'Show friendly duration labels on Storybook cards and details'; }
if (key === 'storybookDurationQuickMaxLabel') { return 'Quick story up to this many minutes'; }
if (key === 'storybookDurationCozyMaxLabel') { return 'Cozy episode up to this many minutes'; }
if (key === 'storybookRecentHistoryDaysLabel') { return 'Hide completed stories for this many days'; }
if (key === 'storybookDurationThresholdError') { return 'Quick story minutes must be at least 1, and Cozy episode minutes must be greater than or equal to Quick story minutes.'; }
if (key === 'storybookRecentHistoryDaysError') { return 'Recent history days must be 0 or more.'; }
```

```javascript
// storybook-app.test.js copyMap additions
storybookCategoryTagsLabel: 'Jellyfin tags for Storybook categories',
storybookDurationSettingsLabel: 'Friendly duration labels',
storybookDurationLabelsEnabledLabel: 'Show friendly duration labels on Storybook cards and details',
storybookDurationQuickMaxLabel: 'Quick story up to this many minutes',
storybookDurationCozyMaxLabel: 'Cozy episode up to this many minutes',
storybookRecentHistoryDaysLabel: 'Hide completed stories for this many days',
storybookDurationThresholdError: 'Quick story minutes must be at least 1, and Cozy episode minutes must be greater than or equal to Quick story minutes.',
storybookRecentHistoryDaysError: 'Recent history days must be 0 or more.',
```

Carry the Task 2 fake-DOM selector support forward here so `selectedLibraryIds()` and the new settings save paths can keep using the same harness without changing `[data-mode]` behavior, then add a checked-checkbox self-test:

```javascript
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
```

In `MovieDeck\tests\storybook-view.test.js`, add the new inputs to the harness and capture the exact settings payload emitted by `saveSettings()`:

```javascript
// buttons map additions
categoryAnimalsTag: append(document, document.body, 'input', 'storybook-category-tag-animals'),
categoryBedtimeTag: append(document, document.body, 'input', 'storybook-category-tag-bedtime'),
categoryLearningTag: append(document, document.body, 'input', 'storybook-category-tag-learning'),
categoryMovementTag: append(document, document.body, 'input', 'storybook-category-tag-movement'),
categorySingDanceTag: append(document, document.body, 'input', 'storybook-category-tag-singDance'),
durationCozyMax: append(document, document.body, 'input', 'storybook-duration-cozy-max'),
durationEnabled: append(document, document.body, 'input', 'storybook-duration-labels-enabled'),
durationQuickMax: append(document, document.body, 'input', 'storybook-duration-quick-max'),
recentHistoryDays: append(document, document.body, 'input', 'storybook-recent-history-days'),
```

```javascript
// buildDom(document) additions inside storybook-app.test.js
focusable(append(panel, 'input', 'storybook-category-tag-singDance', '')).setAttribute('type', 'text');
focusable(append(panel, 'input', 'storybook-category-tag-bedtime', '')).setAttribute('type', 'text');
focusable(append(panel, 'input', 'storybook-category-tag-animals', '')).setAttribute('type', 'text');
focusable(append(panel, 'input', 'storybook-category-tag-learning', '')).setAttribute('type', 'text');
focusable(append(panel, 'input', 'storybook-category-tag-movement', '')).setAttribute('type', 'text');
focusable(append(panel, 'input', 'storybook-duration-labels-enabled', '')).setAttribute('type', 'checkbox');
focusable(append(panel, 'input', 'storybook-duration-quick-max', '')).setAttribute('type', 'number');
focusable(append(panel, 'input', 'storybook-duration-cozy-max', '')).setAttribute('type', 'number');
focusable(append(panel, 'input', 'storybook-recent-history-days', '')).setAttribute('type', 'number');
```

```javascript
// assign scroll/focus rects after the existing storybook settings rect setup
document.getElementById('storybook-category-tag-singDance').rect = { left: 140, top: 220, right: 460, bottom: 252, width: 320, height: 32 };
document.getElementById('storybook-category-tag-bedtime').rect = { left: 140, top: 270, right: 460, bottom: 302, width: 320, height: 32 };
document.getElementById('storybook-category-tag-animals').rect = { left: 140, top: 320, right: 460, bottom: 352, width: 320, height: 32 };
document.getElementById('storybook-category-tag-learning').rect = { left: 140, top: 370, right: 460, bottom: 402, width: 320, height: 32 };
document.getElementById('storybook-category-tag-movement').rect = { left: 140, top: 420, right: 460, bottom: 452, width: 320, height: 32 };
document.getElementById('storybook-duration-labels-enabled').rect = { left: 140, top: 470, right: 460, bottom: 500, width: 320, height: 30 };
document.getElementById('storybook-duration-quick-max').rect = { left: 140, top: 520, right: 300, bottom: 552, width: 160, height: 32 };
document.getElementById('storybook-duration-cozy-max').rect = { left: 140, top: 570, right: 300, bottom: 602, width: 160, height: 32 };
document.getElementById('storybook-recent-history-days').rect = { left: 140, top: 620, right: 300, bottom: 652, width: 160, height: 32 };
```

```javascript
// preference capture additions
var preferenceChanges = [];
```

```javascript
// merge this callback into the existing window.RawiStorybookView.init(...) callback object
var settingsCallbacks = {
  onPreferencesChange: function (nextPreferences) {
    preferenceChanges.push(JSON.parse(JSON.stringify(nextPreferences)));
  }
};
```

```javascript
// add this property to the harness return object
preferenceChanges: function () {
  return JSON.parse(JSON.stringify(preferenceChanges));
},
```

```javascript
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
```

Still in `MovieDeck\tests\storybook-view.test.js`, add explicit validation branches for the new numeric controls so failures are visible and focus returns to the exact offending field:

```javascript
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
    'Quick story minutes must be at least 1, and Cozy episode minutes must be greater than or equal to Quick story minutes.'
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
    'Recent history days must be 0 or more.'
  );
  assert.strictEqual(harness.document.activeElement.id, 'storybook-recent-history-days');
  assert.strictEqual(harness.preferenceChanges().length, 0);
}());
```

In `MovieDeck\tests\storybook-app.test.js`, replace every inline settings-focused fixture with `basePreferences(...)` so the whole file moves to full v3 defaults before Task 6 adds more save paths. Update the exact existing tests `keepsTheJellyfinSessionWhileRecoveringMalformedStorybookPreferences`, `adultModeNoOpDoesNotOverwriteRecoverableStorybookPreferences`, `cancelAndBackDoNotResetRecoverableStorybookPreferences`, `modeToggleRecoverySettingsStayReachableAcrossLibraryFailuresUntilConfirmedReset`, `favoriteRecoverySettingsStayReachableAcrossLibraryFailuresAndBackRestoresDetails`, `savingStorybookSettingsRetainsFavoriteItemIdsFromMigratedPreferences`, `savingAdultSettingsKeepsAdultModeAcrossReload`, and `savingStorybookSetupAfterExplicitToggleRestoresStorybookAcrossReload`, plus every reset expectation in those tests, so no settings assertion is left on the old v2 shape. Replace the stale Down-navigation coverage in `restoresInitiatingFocusAndScrollsSettingsControls` with the new exact-order regression `remoteNavigationMovesThroughEveryPhase3SettingsControlAndScrollsThePanel`.

Then add these app-level regressions so settings saves, mode toggles, favorite toggles, pruning, and remote settings navigation all stay correct with the full v3 shape:

```javascript
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

asyncTest('remoteNavigationMovesThroughEveryPhase3SettingsControlAndScrollsThePanel', function () {
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

    assert(panel.scrollTop > 0);
  });
});
```

- [ ] **Step 2: Run the focused RED loop and confirm the settings screen still cannot edit or preserve the new fields**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
```

Expected RED output: the settings copy keys and validation strings are missing, the new inputs do not exist, remote Down navigation still jumps from the child-name field straight to the pre-Phase-3 controls, `saveSettings()` still emits only child name/library IDs/reduced motion, and at least one save-path assertion still drops `categoryTags`, `durationLabels`, or `recentHistoryDays`.

- [ ] **Step 3: Add the parent-facing settings controls and preserve every version-3 field through every save path**

Insert these controls into `MovieDeck\index.html` inside the existing `#storybook-settings-screen .settings-panel`, immediately after the library checkboxes and before reduced motion:

```html
<fieldset>
  <legend data-copy="storybookCategoryTagsLabel">Jellyfin tags for Storybook categories</legend>
  <label for="storybook-category-tag-singDance" data-copy="storybookCategorySingDance">Sing & Dance</label>
  <input id="storybook-category-tag-singDance" class="focusable" data-focusable type="text" maxlength="40">
  <label for="storybook-category-tag-bedtime" data-copy="storybookCategoryBedtime">Bedtime Stories</label>
  <input id="storybook-category-tag-bedtime" class="focusable" data-focusable type="text" maxlength="40">
  <label for="storybook-category-tag-animals" data-copy="storybookCategoryAnimals">Animal Friends</label>
  <input id="storybook-category-tag-animals" class="focusable" data-focusable type="text" maxlength="40">
  <label for="storybook-category-tag-learning" data-copy="storybookCategoryLearning">Little Lessons</label>
  <input id="storybook-category-tag-learning" class="focusable" data-focusable type="text" maxlength="40">
  <label for="storybook-category-tag-movement" data-copy="storybookCategoryMovement">Move Around</label>
  <input id="storybook-category-tag-movement" class="focusable" data-focusable type="text" maxlength="40">
</fieldset>
<fieldset>
  <legend data-copy="storybookDurationSettingsLabel">Friendly duration labels</legend>
  <label class="settings-check">
    <input id="storybook-duration-labels-enabled" class="focusable" data-focusable type="checkbox">
    <span data-copy="storybookDurationLabelsEnabledLabel">Show friendly duration labels on Storybook cards and details</span>
  </label>
  <label for="storybook-duration-quick-max" data-copy="storybookDurationQuickMaxLabel">Quick story up to this many minutes</label>
  <input id="storybook-duration-quick-max" class="focusable" data-focusable type="number" min="1" max="240">
  <label for="storybook-duration-cozy-max" data-copy="storybookDurationCozyMaxLabel">Cozy episode up to this many minutes</label>
  <input id="storybook-duration-cozy-max" class="focusable" data-focusable type="number" min="1" max="240">
</fieldset>
<label for="storybook-recent-history-days" data-copy="storybookRecentHistoryDaysLabel">Hide completed stories for this many days</label>
<input id="storybook-recent-history-days" class="focusable" data-focusable type="number" min="0" max="365">
```

Add this modest layout support to `MovieDeck\css\storybook.css` so the longer panel remains usable with remote focus and scrolling:

```css
#storybook-settings-screen input[type="text"],
#storybook-settings-screen input[type="number"] {
  display: block;
  margin: 8px 0 18px;
  width: 100%;
}
#storybook-settings-screen fieldset {
  margin: 18px 0;
}
#storybook-settings-screen legend {
  margin-bottom: 10px;
}
```

In `MovieDeck\js\storybook-view.js`, give each generated library checkbox a stable ID for remote-navigation assertions, then fill, disable, validate, and save the new fields exactly like this:

```javascript
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
```

```javascript
// inside renderSettings(...), when each checkbox is created
checkbox.id = 'storybook-library-input-' + checkbox.value;
label.setAttribute('for', checkbox.id);
```

```javascript
// inside renderSettings(...)
byId('storybook-category-tag-singDance').value = preferences.categoryTags.singDance;
byId('storybook-category-tag-bedtime').value = preferences.categoryTags.bedtime;
byId('storybook-category-tag-animals').value = preferences.categoryTags.animals;
byId('storybook-category-tag-learning').value = preferences.categoryTags.learning;
byId('storybook-category-tag-movement').value = preferences.categoryTags.movement;
byId('storybook-duration-labels-enabled').checked = preferences.durationLabels.enabled;
byId('storybook-duration-quick-max').value = String(preferences.durationLabels.quickMaxMinutes);
byId('storybook-duration-cozy-max').value = String(preferences.durationLabels.cozyMaxMinutes);
byId('storybook-recent-history-days').value = String(preferences.recentHistoryDays);

toggleDisabled(byId('storybook-category-tag-singDance'), locked);
toggleDisabled(byId('storybook-category-tag-bedtime'), locked);
toggleDisabled(byId('storybook-category-tag-animals'), locked);
toggleDisabled(byId('storybook-category-tag-learning'), locked);
toggleDisabled(byId('storybook-category-tag-movement'), locked);
toggleDisabled(byId('storybook-duration-labels-enabled'), locked);
toggleDisabled(byId('storybook-duration-quick-max'), locked);
toggleDisabled(byId('storybook-duration-cozy-max'), locked);
toggleDisabled(byId('storybook-recent-history-days'), locked);
```

```javascript
// inside saveSettings()
var quickMaxMinutes = parsedIntegerValue('storybook-duration-quick-max');
var cozyMaxMinutes = parsedIntegerValue('storybook-duration-cozy-max');
var recentHistoryDays = parsedIntegerValue('storybook-recent-history-days');
byId('storybook-settings-error').textContent = '';
if (quickMaxMinutes === null || quickMaxMinutes < 1 || cozyMaxMinutes === null || cozyMaxMinutes < quickMaxMinutes) {
  showSettingsValidationError(
    'storybookDurationThresholdError',
    cozyMaxMinutes !== null && cozyMaxMinutes < quickMaxMinutes ?
      'storybook-duration-cozy-max' :
      'storybook-duration-quick-max'
  );
  return;
}
if (recentHistoryDays === null || recentHistoryDays < 0) {
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
  reducedMotion: byId('storybook-reduced-motion').checked
};
if (!preferences.libraryIds.length) {
  byId('storybook-settings-error').textContent = copy.get('storybookNoLibraries');
  return;
}
callbacks.onPreferencesChange(preferences);
```

In `MovieDeck\js\app.js`, make `saveStorybookSettings(nextPreferences)` and every remaining save call preserve the Task 1 fields explicitly:

```javascript
function saveStorybookSettings(nextPreferences) {
  var saveResult;

  if (storybookRestoreStatus && storybookRestoreStatus.needsRecovery) { return; }
  saveResult = saveStorybookState({
    enabled: true,
    favoriteItemIds: storybookState.favoriteItemIds,
    lastMode: storybookSettingsIntent.activateStorybookOnSave ? 'storybook' : storybookSettingsIntent.modeOnOpen,
    childName: nextPreferences.childName,
    libraryIds: nextPreferences.libraryIds,
    categoryTags: nextPreferences.categoryTags,
    durationLabels: nextPreferences.durationLabels,
    recentHistoryDays: nextPreferences.recentHistoryDays,
    reducedMotion: nextPreferences.reducedMotion
  });
  if (saveResult.blocked) {
    renderStorybookSettings();
    return;
  }
  storybookResetConfirming = false;
  setStorybookSettingsIntent();
  storybookView.setMode(storybookState.lastMode);
  showToast(copy.get('storybookSettingsSaved'));
  openLibrary();
}
```

```javascript
function saveStorybookState(overrides, options) {
  var nextState;
  var saved;

  overrides = overrides || {};
  nextState = copyStorybookState(storybookState);
  nextState.enabled = overrides.enabled !== undefined ? overrides.enabled : nextState.enabled;
  nextState.lastMode = overrides.lastMode || nextState.lastMode;
  nextState.childName = overrides.childName !== undefined ? overrides.childName : nextState.childName;
  nextState.libraryIds = overrides.libraryIds !== undefined ? copyIds(overrides.libraryIds) : nextState.libraryIds;
  nextState.favoriteItemIds = overrides.favoriteItemIds !== undefined ? copyIds(overrides.favoriteItemIds) : nextState.favoriteItemIds;
  nextState.categoryTags = overrides.categoryTags !== undefined ? copyCategoryTags(overrides.categoryTags) : nextState.categoryTags;
  nextState.durationLabels = overrides.durationLabels !== undefined ? copyDurationLabels(overrides.durationLabels) : nextState.durationLabels;
  nextState.recentHistoryDays = overrides.recentHistoryDays !== undefined ? copyRecentHistoryDays(overrides.recentHistoryDays) : nextState.recentHistoryDays;
  nextState.reducedMotion = overrides.reducedMotion !== undefined ? overrides.reducedMotion : nextState.reducedMotion;
  saved = storybookPreferences.save(nextState, options);

  storybookRestoreStatus = storybookPreferences.getRestoreStatus ?
    storybookPreferences.getRestoreStatus() :
    storybookRestoreStatus;
  if (!saved) {
    return {
      blocked: true,
      state: storybookState
    };
  }
  storybookState = saved;
  return {
    blocked: false,
    state: storybookState
  };
}
```

That one helper is now the single preservation point for mode toggles, favorite toggles, pruning saves, settings saves, preview saves, and resets.

- [ ] **Step 4: Run the targeted GREEN suite and verify recovery mode still locks every new field**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js copy.test.js storybook-view.test.js storybook-app.test.js
node -c .\MovieDeck\js\storybook-view.js
node -c .\MovieDeck\js\app.js
git diff --check
```

Expected GREEN output: `All Rawi tests passed.` The recovery tests must now prove the new inputs exist, are disabled during recovery, and become writable again only after the explicit reset flow clears the barrier; the remote-navigation test must walk the exact field order down through `storybook-recent-history-days`, continue to `storybook-save`, then move right to `storybook-cancel`; and the validation tests must keep focus on the offending numeric control without persisting anything.

- [ ] **Step 5: Commit the settings/save-path slice**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
git add MovieDeck\css\storybook.css MovieDeck\index.html MovieDeck\js\app.js MovieDeck\js\copy.js MovieDeck\js\storybook-view.js MovieDeck\tests\copy.test.js MovieDeck\tests\storybook-app.test.js MovieDeck\tests\storybook-view.test.js
git commit -m "feat: add storybook discovery settings" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 7: Deterministic Preview, Documentation, and Package-Only Release Validation

**Files:**
- Modify: `README.md`
- Modify: `MovieDeck\config.xml` *(helper-driven final version bump only)*
- Modify: `MovieDeck\js\api.js` *(helper-driven final version bump only)*
- Modify: `MovieDeck\js\app.js`
- Modify: `MovieDeck\js\preview-fixtures.js`
- Modify: `MovieDeck\tests\start-rawi-preview.test.js`
- Modify: `MovieDeck\tests\storybook-app.test.js`
- Modify: `MovieDeck\tests\storybook-model.test.js`
- Modify: `tools\Start-RawiPreview.ps1`

**Interfaces:**
- Consumes: `previewStorybookFixture.sessionSeed`, `previewStorybookFixture.nowMs`, and `previewStorybookFixture.magicRandom`
- Produces: `?preview=storybook&storybookScreen=category&storybookCategoryKey=animals`
- Produces: `?preview=storybook&storybookScreen=magic`
- Produces: `?preview=storybook&storybookScreen=settings`
- Produces: owned preview reuse and cleanup across the new routes on both PowerShell hosts

- [ ] **Step 1: Replace the stale preview-route test, add the preview-save regression, add helper ownership coverage for the new routes, and document the exact browser-acceptance commands up front**

In `MovieDeck\tests\storybook-app.test.js`, replace the stale preview-route test name with one that matches the new phase scope and assert the new routes directly. Keep the fake DOM assertions on direct container children here too:

```javascript
asyncTest('previewRoutesCanOpenHomeCategoryMagicSettingsDetailsAndEndingWithoutJellyfin', function () {
  var fixture = load('js/preview-fixtures.js', { window: {} }).RawiPreviewFixtures;
  var homeHarness = loadAppHarness({
    locationSearch: '?preview=storybook',
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

    assert.strictEqual(categoryHarness.screenActive('storybook-library-screen'), true);
    assert.strictEqual(categoryHarness.document.getElementById('storybook-library-title').textContent, 'Animal Friends');

    assert.strictEqual(magicHarness.screenActive('storybook-magic-pick-screen'), true);
    assert.strictEqual(magicHarness.document.getElementById('storybook-magic-pick-title').textContent, 'Dance With Me');

    assert.strictEqual(settingsHarness.screenActive('storybook-settings-screen'), true);
    assert.strictEqual(settingsHarness.document.activeElement.id, 'storybook-child-name');
    assert.strictEqual(settingsHarness.document.getElementById('storybook-recent-history-days').value, '14');

    assert.strictEqual(detailsHarness.screenActive('storybook-details-screen'), true);
    assert.strictEqual(endingHarness.screenActive('storybook-ending-screen'), true);

    [
      homeHarness,
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

asyncTest('previewSettingsSavePreservesNonDefaultPhase3StateAndUsesFixtureClock', function () {
  var fixture = load('js/preview-fixtures.js', { window: {} }).RawiPreviewFixtures;
  var customFixture = JSON.parse(JSON.stringify(fixture));
  var harness;

  customFixture.storybook.sessionSeed = 'storybook-phase-3-preview-custom';
  customFixture.storybook.nowMs = Date.parse('2026-09-02T02:00:00.000Z');
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
    recentHistoryDays: 21
  });
  harness = loadAppHarness({
    locationSearch: '?preview=storybook&storybookScreen=settings',
    previewFixtures: customFixture,
    restoreSession: true
  });

  return flush(12).then(function () {
    assert.strictEqual(harness.document.getElementById('storybook-recent-history-days').value, '21');
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
    assert.deepStrictEqual(harness.apiCalls(), {
      getLatest: 0,
      getLibraries: 0,
      getResume: 0,
      getVideos: 0,
      restore: 0
    });
  });
});
```

In `MovieDeck\tests\start-rawi-preview.test.js`, rename `testReusesOwnedPreviewForNewStorybookRoutes` to `testReusesOwnedPreviewForStorybookPhase3Routes` and extend it so the owned listener is reused for a Magic Pick route and a category route on both PowerShell hosts:

```javascript
function testReusesOwnedPreviewForStorybookPhase3Routes() {
  var workspace = makeWorkspace();
  var sharedTemp = path.join(workspace, 'shared-temp');
  var root = createPreviewCopy(workspace, 'owner-a', 'Owner A');
  var env = previewEnvironment(sharedTemp);
  var port = getFreePort();
  var listenerPid = null;

  try {
    var initial = runPreview(root, env, ['-Port', String(port), '-StorybookMock']);
    var initialState;
    var magicRoute;
    var categoryRoute;
    var stopResult;

    assert.strictEqual(initial.status, 0, hostLabel() + joinOutput(initial));
    initialState = getPreviewState(root, env);
    listenerPid = Number(initialState.ProcessId);
    assert(listenerPid, 'expected preview state metadata after starting the preview');
    assert.strictEqual(waitForProcessState(listenerPid, env, true), true);

    magicRoute = runPreview(root, env, ['-Port', String(port), '-StorybookMock', '-StorybookScreen', 'magic']);
    assert.strictEqual(magicRoute.status, 0, hostLabel() + joinOutput(magicRoute));
    assert.notStrictEqual(joinOutput(magicRoute).indexOf('storybookScreen=magic'), -1, hostLabel() + joinOutput(magicRoute));
    assert.strictEqual(Number(getPreviewState(root, env).ProcessId), listenerPid, hostLabel() + joinOutput(magicRoute));

    categoryRoute = runPreview(root, env, ['-Port', String(port), '-StorybookMock', '-StorybookScreen', 'category', '-StorybookCategoryKey', 'animals']);
    assert.strictEqual(categoryRoute.status, 0, hostLabel() + joinOutput(categoryRoute));
    assert.notStrictEqual(joinOutput(categoryRoute).indexOf('storybookScreen=category&storybookCategoryKey=animals'), -1, hostLabel() + joinOutput(categoryRoute));
    assert.strictEqual(Number(getPreviewState(root, env).ProcessId), listenerPid, hostLabel() + joinOutput(categoryRoute));

    stopResult = runPreview(root, env, ['-Port', String(port), '-Stop']);
    assert.strictEqual(stopResult.status, 0, hostLabel() + joinOutput(stopResult));
    assert.strictEqual(waitForProcessState(listenerPid, env, false), true, hostLabel() + joinOutput(stopResult));
    listenerPid = null;
  } finally {
    forceStopOwnedPreviewProcesses(root, env);
    forceStopProcess(listenerPid, env);
    deleteTree(workspace);
  }
}
```

At the bottom of the file, replace the stale registration line with:

```javascript
powerShellHosts.forEach(function (host) {
  withPowerShellHost(host, testReusesOwnedPreviewForStorybookPhase3Routes);
  withPowerShellHost(host, testRefusesDifferentAppPathOwnershipAndStopsOnlyOwnedPreview);
});
```

- [ ] **Step 2: Run the preview-specific RED loop and confirm the current helper rejects the new routes**

Run:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js storybook-model.test.js storybook-app.test.js start-rawi-preview.test.js
```

Expected RED output: the preview route test still only knows about home/library/details/ending, the preview-save regression still falls back to stale/default v3 values or live time, the helper `ValidateSet(...)` rejects `category` / `magic` / `settings`, and the owned-preview helper test cannot yet see the new query strings.

- [ ] **Step 3: Add deterministic Phase 3 preview routes and README guidance**

Update `MovieDeck\js\app.js` so preview routing accepts the new screens without touching Jellyfin:

```javascript
function storybookPreviewScreen() {
  var value = queryValue('storybookScreen');
  if (value === 'library' || value === 'category' || value === 'details' || value === 'magic' || value === 'settings' || value === 'ending') {
    return value;
  }
  return 'home';
}

function applyStorybookPreviewRoute() {
  var screen = storybookPreviewScreen();
  var libraryId = queryValue('storybookLibraryId') || storybookState.libraryIds[0] || '';
  var categoryKey = queryValue('storybookCategoryKey') || 'animals';
  var item = previewItemById(queryValue('storybookItemId'));

  if (screen === 'library') {
    openStorybookLibrary(libraryId);
    return;
  }
  if (screen === 'category') {
    openStorybookCategory(categoryKey);
    return;
  }
  if (screen === 'details' && item) {
    openStorybookDetails(item, 'resume');
    return;
  }
  if (screen === 'magic') {
    openStorybookMagicPick();
    return;
  }
  if (screen === 'settings') {
    openStorybookSettings('storybook-settings-button');
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
```

Keep preview deterministic by continuing to route every discovery call through `currentStorybookNowMs()` and `currentStorybookSessionSeed()` from Task 1. In non-preview production, those helpers return the single launch-captured values; in preview, they return `previewStorybookFixture.nowMs` and `previewStorybookFixture.sessionSeed`, so recent completion never ages during route checks.

Update `tools\Start-RawiPreview.ps1` so the helper exposes the same deterministic route surface and still owns the listener by AppPath + port only:

```powershell
[ValidateSet('home', 'library', 'category', 'details', 'magic', 'settings', 'ending')]
[string]$StorybookScreen = 'home',

[Parameter(Mandatory = $false)]
[string]$StorybookCategoryKey,
```

```powershell
if ($StorybookCategoryKey) {
    $query += 'storybookCategoryKey=' + [uri]::EscapeDataString($StorybookCategoryKey)
}
```

Update the Storybook section of `README.md` with this exact Phase 3 guidance:

````markdown
### Storybook Phase 3 preview routes

```powershell
.\tools\Start-RawiPreview.ps1 -StorybookMock
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen category -StorybookCategoryKey animals
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen magic
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen settings
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen details -StorybookItemId bluey
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen ending -StorybookItemId bluey
```

`Tonight's Little Menu` is stable for the app session, category shortcuts are tag-backed browse shortcuts rather than access control, and Magic Pick always opens a confirmation screen before playback. In preview mode, the browser proof below must show `jellyfinRequests:[]` even when `moviedeck.server` points at a configured Jellyfin origin.
````

- [ ] **Step 4: Run the full automated suite, then the real browser acceptance with a named `agent-browser` session, then the single package-only release command**

Run the full suite first:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
node .\MovieDeck\tests\run-tests.js
```

Expected GREEN output:

```text
All Rawi tests passed.
```

Start the deterministic preview on an owned, non-default port and run the exact headed browser acceptance below. This uses a named session so cleanup is provable and isolated:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
.\tools\Start-RawiPreview.ps1 -Port 4176 -StorybookMock
agent-browser --session task7-storybook-phase3 open http://127.0.0.1:4176/
agent-browser --session task7-storybook-phase3 wait --load networkidle
agent-browser --session task7-storybook-phase3 eval 'localStorage.setItem("moviedeck.server", "http://configured-jellyfin.invalid:8096"); performance.clearResourceTimings(); JSON.stringify({ configuredServer: localStorage.getItem("moviedeck.server") })'
agent-browser --session task7-storybook-phase3 open http://127.0.0.1:4176/?preview=storybook
agent-browser --session task7-storybook-phase3 wait --load networkidle
agent-browser --session task7-storybook-phase3 eval 'JSON.stringify({ jellyfinRequests: performance.getEntriesByType("resource").filter(function (entry) { return entry.name.indexOf("configured-jellyfin.invalid:8096") !== -1; }).map(function (entry) { return entry.name; }), menuIds: Array.prototype.map.call(document.getElementById("storybook-little-menu").children, function (node) { return node.getAttribute("data-item-id"); }), categoryKeys: Array.prototype.map.call(document.getElementById("storybook-categories").children, function (node) { return node.getAttribute("data-category-key"); }), active: document.activeElement && document.activeElement.id })'
agent-browser --session task7-storybook-phase3 open http://127.0.0.1:4176/?preview=storybook&storybookScreen=category&storybookCategoryKey=animals
agent-browser --session task7-storybook-phase3 wait --load networkidle
agent-browser --session task7-storybook-phase3 eval 'JSON.stringify({ title: document.getElementById("storybook-library-title").textContent, active: document.activeElement && document.activeElement.id })'
agent-browser --session task7-storybook-phase3 eval 'document.getElementById("storybook-library-back").click()'
agent-browser --session task7-storybook-phase3 wait 1000
agent-browser --session task7-storybook-phase3 eval 'JSON.stringify({ active: document.activeElement && document.activeElement.id })'
agent-browser --session task7-storybook-phase3 open http://127.0.0.1:4176/?preview=storybook&storybookScreen=magic
agent-browser --session task7-storybook-phase3 wait --load networkidle
agent-browser --session task7-storybook-phase3 eval 'JSON.stringify({ title: document.getElementById("storybook-magic-pick-title").textContent, reason: document.getElementById("storybook-magic-pick-reason").textContent, active: document.activeElement && document.activeElement.id })'
agent-browser --session task7-storybook-phase3 eval 'document.getElementById("storybook-magic-pick-primary").click()'
agent-browser --session task7-storybook-phase3 wait 1000
agent-browser --session task7-storybook-phase3 eval 'JSON.stringify({ detailsScreenActive: document.getElementById("storybook-details-screen").className.indexOf("is-active") !== -1, active: document.activeElement && document.activeElement.id })'
agent-browser --session task7-storybook-phase3 open http://127.0.0.1:4176/?preview=storybook&storybookScreen=settings
agent-browser --session task7-storybook-phase3 wait --load networkidle
agent-browser --session task7-storybook-phase3 eval 'JSON.stringify({ active: document.activeElement && document.activeElement.id, recentHistoryDays: document.getElementById("storybook-recent-history-days").value })'
agent-browser --session task7-storybook-phase3 close
agent-browser --session task7-storybook-phase3 session info --json
.\tools\Start-RawiPreview.ps1 -Port 4176 -Stop
```

Expected browser acceptance:

1. The setup `eval` prints `configuredServer:"http://configured-jellyfin.invalid:8096"`, and the first preview `eval` prints `jellyfinRequests:[]`, `menuIds:["dance","colors","fox"]`, `categoryKeys:["singDance","bedtime","animals","learning","movement"]`, and `active:"storybook-resume-card"`.
2. The category route prints `title:"Animal Friends"`, and after clicking Back plus waiting 1000 ms the follow-up `eval` prints `active:"storybook-category-animals"`.
3. The Magic Pick route prints `title:"Dance With Me"`, the reason text is one of the Magic Pick reason copy strings, and the post-click details `eval` proves `detailsScreenActive:true` with `active:"storybook-details-play"`; there is still no automatic player transition.
4. The settings route prints `active:"storybook-child-name"` and `recentHistoryDays:"14"`.
5. `agent-browser --session task7-storybook-phase3 session info --json` reports `"active": false` after `close`.
6. The preview stop command prints `Stopped Rawi preview on port 4176.` and the saved browser output already proves the routed preview made zero requests to the configured Jellyfin origin.

**Package inspection entries for Phase 3 runtime assets**

| Package entry | What it must prove |
|---|---|
| `config.xml` | version `0.1.13`, app ID `JfMovieTV1.MovieDeck`, package ID `JfMovieTV1` |
| `js/api.js` | `CLIENT_VERSION` advanced to `0.1.13` |
| `index.html` | category, little-menu, Magic Pick, and settings markup are packaged |
| `js/storybook-discovery.js` | the new pure discovery module is packaged |
| `js/storybook-view.js` | home/library/details/magic/settings renderer changes are packaged |
| `js/app.js` | launch bootstrap, category/menu/magic routing, and preview routes are packaged |
| `js/preview-fixtures.js` | deterministic version-3 preview fixture is packaged |
| `css/storybook.css` | scoped Phase 3 styles are packaged |

Run the one release packaging command only after everything else is green:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
.\tools\Deploy-Rawi.ps1 -PackageOnly
```

Expected GREEN output includes both of these lines:

```text
Packaging Rawi 0.1.13...
Package ready: C:\Code\Rawi\.worktrees\storybook-mode-phase-3\dist\Rawi.wgt
```

Then inspect the package contents and version metadata:

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('C:\Code\Rawi\.worktrees\storybook-mode-phase-3\dist\Rawi.wgt'); try { $required = @('config.xml','index.html','css/storybook.css','js/storybook-discovery.js','js/storybook-view.js','js/app.js','js/preview-fixtures.js','js/api.js'); foreach ($entry in $required) { if (-not ($zip.Entries | Where-Object FullName -eq $entry)) { throw ('Missing package entry: ' + $entry) } Write-Host ('OK ' + $entry) } $configReader = New-Object System.IO.StreamReader(($zip.GetEntry('config.xml')).Open()); try { $configText = $configReader.ReadToEnd() } finally { $configReader.Dispose() } if ($configText -notmatch 'version=\"0\.1\.13\"') { throw 'Expected config.xml version 0.1.13.' } if ($configText -notmatch 'id=\"JfMovieTV1\.MovieDeck\" package=\"JfMovieTV1\"') { throw 'Application/package ID changed.' } $apiReader = New-Object System.IO.StreamReader(($zip.GetEntry('js/api.js')).Open()); try { $apiText = $apiReader.ReadToEnd() } finally { $apiReader.Dispose() } if ($apiText -notmatch \"var CLIENT_VERSION = '0\.1\.13';\") { throw 'Expected CLIENT_VERSION 0.1.13.' } } finally { $zip.Dispose() }"
```

Expected GREEN output starts with these exact lines and ends without errors:

```text
OK config.xml
OK index.html
OK css/storybook.css
OK js/storybook-discovery.js
```

- [ ] **Step 5: Commit the preview/docs/release-validation slice, including the single helper-produced version bump**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-3
git add README.md MovieDeck\config.xml MovieDeck\js\api.js MovieDeck\js\app.js MovieDeck\js\preview-fixtures.js MovieDeck\tests\start-rawi-preview.test.js MovieDeck\tests\storybook-app.test.js MovieDeck\tests\storybook-model.test.js tools\Start-RawiPreview.ps1
git commit -m "feat: complete storybook phase 3" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Phase 3 Completion Gate

| Required Phase 3 behavior | Task(s) | Proof |
|---|---|---|
| Version-3 Storybook preferences migrate from v1/v2 in memory, preserve every nested field on every save path, and keep explicit corrupt-preference recovery | 1, 6, 7 | `migratesVersion2PreferencesWithoutRecoveryOrImmediateRewrite`, `saveWritesNormalizedVersionedData`, `savingStorybookSettingsWritesAndReloadsAllPhase3Fields`, `modeSwitchAndFavoriteTogglePreserveExistingPhase3Settings`, `pruningFavoritesPreservesNonDefaultPhase3Settings`, `previewSettingsSavePreservesNonDefaultPhase3StateAndUsesFixtureClock` |
| Shared Jellyfin metadata includes `Tags` without any extra API request layer | 1 | `api.test.js` `itemFieldsIncludeTagsWithoutRemovingExistingMetadata` |
| Friendly duration labels appear on Storybook home/library/details only and Adult details stay minutes-only | 2 | `exposesStorybookFriendlyDurationCopyDefaults`, `rendersFriendlyDurationLabelsAcrossStorybookCardsAndDetails`, `storybookLibraryAndDetailsUseFriendlyDurationLabelsWhenEnabled`, `adultDetailsKeepMinutesOnlyWhenStorybookFriendlyDurationsAreEnabled` |
| Category shortcuts map configured Jellyfin tags to child-facing labels, reuse the shared library screen, and restore exact Back/focus state | 3 | `rendersCategoryShortcutsAndBindsOpenCallbacks`, `categoryShortcutOpensFilteredCollectionAndBackRestoresExactCategoryFocus`, browser `storybookScreen=category` preview |
| Tonight's Little Menu shows up to three stable session-scoped suggestions, excludes recently completed items, prefers variety, omits the section when empty, and only opens Storybook details | 4 | `littleMenuStaysStablePerSessionSkipsRecentCompletionsAndPrefersVariety`, `rendersResumeLittleMenuAndFavoritesBeforeStoryDoors`, `littleMenuIsStableForTheAppSessionAndOpensDetailsWithoutPlayback`, browser home preview |
| Magic Pick scores eligible items correctly, never auto-plays, uses a dedicated confirmation screen with a mode toggle, rerolls on secondary, and falls back to Story Doors/home when empty | 1, 5 | `magicPickPrefersUnwatchedFavoritesAndDifferentCategoriesThenUsesRandomOnTies`, `rendersMagicPickCandidateAndExportsTheRenderer`, `reducedMotionSkipsEntryAnimationOnMagicPickScreenButKeepsItWhenAllowed`, browser `storybookScreen=magic` preview |
| Parent settings edit category tags, duration labels, and recent-history days while recovery mode still locks every control behind explicit reset | 6 | `settingsSaveEmitsCategoryTagsDurationLabelsAndHistoryWindow`, `settingsRejectsInvalidDurationThresholdsAndKeepsFocusOnCozyField`, `settingsRejectsNegativeRecentHistoryDaysAndKeepsFocusOnHistoryField`, `remoteNavigationMovesThroughEveryPhase3SettingsControlAndScrollsThePanel`, `savingStorybookSettingsWritesAndReloadsAllPhase3Fields`, recovery tests in `storybook-view.test.js` / `storybook-app.test.js`, browser `storybookScreen=settings` preview |
| Deterministic preview covers home/category/magic/settings/details/ending without Jellyfin, helper ownership stays AppPath+port-scoped on PowerShell 5.1 and `pwsh`, and the widget packages once to `0.1.13` | 7 | `previewRoutesCanOpenHomeCategoryMagicSettingsDetailsAndEndingWithoutJellyfin`, `previewSettingsSavePreservesNonDefaultPhase3StateAndUsesFixtureClock`, `testReusesOwnedPreviewForStorybookPhase3Routes`, named `agent-browser` session cleanup with `configuredServer` + `jellyfinRequests:[]`, `Deploy-Rawi.ps1 -PackageOnly`, package-inspection command |
| Quiet time stays deferred and inactive throughout Phase 3 | 1-7 | no new quiet-time preferences/UI/routes/tests; completion gate plus deferred list below |

## Explicitly Deferred to Later Phases

- **Phase 4:** Quiet-time filters and any bedtime-only runtime/category filter combinations.
- **Phase 4:** Subtle sound cues.
- **Phase 4:** Additional watercolor library treatments beyond the current deterministic accent selection.
- **Phase 4:** Any TV-only deployment or physical-TV validation beyond the existing package-only release proof.

## Self-Review

- **Spec coverage:** Task 1 covers version-3 preferences, `Tags`, and the pure discovery APIs; Task 2 covers friendly duration labels; Task 3 covers tag-backed child-friendly category shortcuts and shared collection routing; Task 4 covers the stable Tonight's Little Menu; Task 5 covers Magic Pick scoring plus the dedicated confirmation screen; Task 6 covers the parent settings and recovery/write-barrier preservation; Task 7 covers deterministic preview routes, README guidance, real browser acceptance, and the single `0.1.13` package-only release proof.
- **Placeholder review:** I re-scanned the plan for unresolved filler phrases, deferred-work wording inside active tasks, vague “handle this” instructions, and shorthand that would force an implementer to guess the next edit. The delivered plan text avoids literal banned-marker echoes, every code-changing step contains concrete code blocks, and every validation step names the exact command plus the expected RED/GREEN behavior.
- **DOM ID and interface audit:** Every newly referenced DOM ID now has a creation snippet before any test or runtime call uses it: Task 4 adds `storybook-little-menu-section` / `storybook-little-menu`; Task 5 adds `storybook-magic-pick-home-section`, `storybook-magic-pick-screen`, and every confirmation child node in both harnesses; Task 6 adds every settings input plus stable `storybook-library-input-*` checkbox IDs for remote-navigation assertions. The launch-bootstrap seam, `currentStorybookNowMs()`, and `currentStorybookSessionSeed()` are defined before later tasks consume them.
- **Harness assumptions and selector strategy:** The fake app-test selector engine does not gain unnecessary descendant+attribute parsing for new home sections. Instead, the plan switches new app-level assertions to direct container children plus stable `data-item-id` / `data-category-key` reads, while keeping the recursive `getElementsByClassName()` and the exact `#storybook-library-options input[type="checkbox"]` / `[data-mode]` selector support intact. Exact menu-order assertions only appear in harnesses that pass a fixed `storybookBootstrap`, and preview determinism comes from fixture `sessionSeed` + `nowMs`.
- **Exact test names and syntactic completeness:** The plan names every new or renamed proof explicitly: `rendersResumeLittleMenuAndFavoritesBeforeStoryDoors`, `littleMenuIsStableForTheAppSessionAndOpensDetailsWithoutPlayback`, `rendersMagicPickCandidateAndExportsTheRenderer`, `savingStorybookSettingsWritesAndReloadsAllPhase3Fields`, `pruningFavoritesPreservesNonDefaultPhase3Settings`, `remoteNavigationMovesThroughEveryPhase3SettingsControlAndScrollsThePanel`, `settingsRejectsInvalidDurationThresholdsAndKeepsFocusOnCozyField`, `settingsRejectsNegativeRecentHistoryDaysAndKeepsFocusOnHistoryField`, `previewRoutesCanOpenHomeCategoryMagicSettingsDetailsAndEndingWithoutJellyfin`, `previewSettingsSavePreservesNonDefaultPhase3StateAndUsesFixtureClock`, and `testReusesOwnedPreviewForStorybookPhase3Routes`. Former standalone callback fragments are now wrapped as complete objects or replaced with guarded function bodies.
- **Task independence and intermediate GREEN state:** Each task still ends with its own targeted RED/GREEN loop plus syntax and `git diff --check` verification, and the updated tasks remain independently buildable in order: Task 1 introduces the deterministic seams; Tasks 3–5 only consume those seams; Task 6 updates existing settings fixtures before adding new controls/tests; and Task 7 is still the only task that touches preview docs/routes and the only task that performs the package-only version bump.
