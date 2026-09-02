'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var model = load('js/storybook-model.js', { window: {} }).RawiStorybookModel;
var previewFixtures = load('js/preview-fixtures.js', { window: {} }).RawiPreviewFixtures;

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
