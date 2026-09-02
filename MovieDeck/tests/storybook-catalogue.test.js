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
