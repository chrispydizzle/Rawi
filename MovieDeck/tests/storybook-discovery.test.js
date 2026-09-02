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
