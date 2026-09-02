'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var model = load('js/storybook-model.js', { window: {} }).RawiStorybookModel;
var previewFixtures = load('js/preview-fixtures.js', { window: {} }).RawiPreviewFixtures;

(function exposesDeterministicStorybookPreviewFixture() {
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(previewFixtures.storybook.user)),
    { Id: 'preview-user', Name: 'Parent' }
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(previewFixtures.storybook.libraries.map(function (library) {
      return library.Id;
    }))),
    ['pixar', 'songs', 'lessons']
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(previewFixtures.storybook.groups.map(function (group) {
      return group.id;
    }))),
    ['pixar', 'songs', 'lessons']
  );
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
