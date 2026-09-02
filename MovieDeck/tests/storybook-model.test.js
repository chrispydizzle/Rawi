'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var model = load('js/storybook-model.js', { window: {} }).RawiStorybookModel;
var previewFixtures = load('js/preview-fixtures.js', { window: {} }).RawiPreviewFixtures;

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
