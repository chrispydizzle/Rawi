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

global.RawiTest.registerAsync('video catalogue includes titles beyond the first API page', function () {
  var client = load('js/api.js', {
    window: {
      RawiCopy: { get: function (key) { return key; } },
      RawiStorage: { get: function () { return null; }, set: function () {}, remove: function () {} }
    }
  }).MovieDeckApi;
  var calls = [];
  client.user = { Id: 'viewer' };
  client.request = function (url) {
    calls.push(url);
    var start = Number(/StartIndex=(\d+)/.exec(url)[1]);
    var items = [];
    for (var i = start; i < Math.min(start + 100, 205); i += 1) {
      items.push({ Id: String(i), Name: 'Story ' + i });
    }
    return Promise.resolve({ Items: items, TotalRecordCount: 205 });
  };
  return client.getVideos('kid library').then(function (videos) {
    assert.strictEqual(videos.length, 205);
    assert.strictEqual(videos[204].Name, 'Story 204');
    assert.strictEqual(calls.length, 3);
    assert.ok(calls.every(function (url) { return url.indexOf('ParentId=kid%20library') !== -1; }));
  });
});
