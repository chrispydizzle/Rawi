'use strict';

var assert = global.RawiTest.assert;
var search = global.RawiTest.loadBrowserScript('js/smart-search.js').RawiSmartSearch;

function plain(value) { return JSON.parse(JSON.stringify(value)); }

(function partialTitlesAndEveryOccurrenceSupplyNextLetters() {
  var index = search.createIndex([
    { Id: '1', Name: 'Banana' },
    { Id: '2', Name: 'An Alpine Story' },
    { id: '3', name: 'An Adventure' },
    { Id: '1', Name: 'Banana' }
  ]);
  var result = search.search(index, 'AN');
  assert.deepStrictEqual(plain(result.items).map(function (item) { return item.Id || item.id; }), ['1', '2', '3']);
  assert.deepStrictEqual(plain(result.letters), [' ', 'a']);
  assert.deepStrictEqual(plain(search.search(index, 'ana').letters), ['n']);
  assert.strictEqual(search.search(index, 'missing').items.length, 0);
  assert.strictEqual(search.search(index, 'banana').letters.length, 0);
}());

(function everyOfferedLetterKeepsAtLeastOneMatch() {
  var index = search.createIndex([
    { Id: '1', Name: 'Wall-E 2' },
    { Id: '2', Name: 'WALL-E: A Story' },
    { Id: '3', Name: 'Caf\u00e9 \uD83D\uDC31' }
  ]);
  ['', 'wall', 'wall-e', 'caf', 'caf\u00e9 '].forEach(function (query) {
    search.search(index, query).letters.forEach(function (letter) {
      assert.ok(search.search(index, query + letter).items.length > 0, query + letter);
    });
  });
  assert.deepStrictEqual(plain(search.search(index, 'wall-e').letters), [' ', ':']);
  assert.deepStrictEqual(plain(search.search(index, 'caf\u00e9 ').letters), ['\uD83D\uDC31']);
  assert.deepStrictEqual(plain(search.characters('a\uD83D\uDC31')), ['a', '\uD83D\uDC31']);
}());

(function noResultCapAndIdentitySafeDeduplication() {
  var items = [];
  for (var i = 0; i < 205; i += 1) {
    items.push({ Id: String(i), Name: 'Story ' + i });
  }
  items.push({ Id: '__proto__', Name: 'Story special' });
  var index = search.createIndex(items.concat(items));
  assert.strictEqual(index.length, 206);
  assert.strictEqual(search.search(index, 'story').items.length, 206);
}());
