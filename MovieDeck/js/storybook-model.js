(function (global) {
  'use strict';

  function idOf(item) {
    if (!item) { return ''; }
    if (item.Id !== undefined && item.Id !== null) {
      return String(item.Id);
    }
    if (item.id !== undefined && item.id !== null) {
      return String(item.id);
    }
    return '';
  }

  function resolveLibraries(libraries, selectedIds) {
    var selected = [];
    var missingIds = [];
    var available = {};
    var selectedMap = {};
    var list = libraries || [];
    var ids = selectedIds || [];
    var i;
    var key;
    var library;

    for (i = 0; i < ids.length; i += 1) {
      key = String(ids[i]);
      if (!key) { continue; }
      selectedMap[key] = true;
    }

    for (i = 0; i < list.length; i += 1) {
      library = list[i];
      key = idOf(library);
      if (!key) { continue; }
      available[key] = true;
      if (selectedMap[key]) {
        selected.push(library);
      }
    }

    for (i = 0; i < ids.length; i += 1) {
      key = String(ids[i]);
      if (!key || available[key]) { continue; }
      missingIds.push(ids[i]);
    }

    return {
      selected: selected,
      missingIds: missingIds
    };
  }

  function isReducedMotion(preferences, mediaQueryMatches) {
    return !!(preferences && preferences.reducedMotion) || !!mediaQueryMatches;
  }

  global.RawiStorybookModel = {
    isReducedMotion: isReducedMotion,
    resolveLibraries: resolveLibraries
  };
}(window));
