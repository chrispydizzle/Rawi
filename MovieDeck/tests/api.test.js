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
