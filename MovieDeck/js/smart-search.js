(function (global) {
  'use strict';

  function characters(text) {
    return String(text).match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || [];
  }

  function createIndex(items) {
    var seen = {};
    return items.filter(function (item) {
      var id = item.Id !== undefined ? item.Id : item.id;
      if (id === undefined || id === null || seen['$' + id]) { return false; }
      seen['$' + id] = true;
      return true;
    }).map(function (item) {
      return {
        item: item,
        title: String(item.Name || item.name || '').toLowerCase()
      };
    });
  }

  function search(index, query) {
    var needle = String(query || '').toLowerCase();
    var next = {};
    var items = [];
    index.forEach(function (entry) {
      var position = needle ? entry.title.indexOf(needle) : 0;
      if (position === -1) { return; }
      items.push(entry.item);
      if (!needle) {
        characters(entry.title).forEach(function (letter) { next[letter] = true; });
        return;
      }
      while (position !== -1) {
        var letter = characters(entry.title.slice(position + needle.length))[0];
        if (letter) { next[letter] = true; }
        position = entry.title.indexOf(needle, position + 1);
      }
    });
    return { items: items, letters: Object.keys(next).sort() };
  }

  global.RawiSmartSearch = {
    characters: characters,
    createIndex: createIndex,
    search: search
  };
}(window));
