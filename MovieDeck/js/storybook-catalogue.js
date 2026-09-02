(function (global) {
  'use strict';

  var model = global.RawiStorybookModel;

  function itemId(item) {
    if (!item) { return ''; }
    if (item.Id !== undefined && item.Id !== null) { return String(item.Id); }
    if (item.id !== undefined && item.id !== null) { return String(item.id); }
    return '';
  }

  function groupId(group) {
    if (!group) { return ''; }
    if (group.id !== undefined && group.id !== null) { return String(group.id); }
    if (group.Id !== undefined && group.Id !== null) { return String(group.Id); }
    return '';
  }

  function playedTimestampOf(item) {
    var candidates = [];
    var userData;
    var i;
    var value;
    var parsed;
    var best = null;

    if (!item) { return null; }

    userData = item.UserData || {};
    if (userData.LastPlayedDate !== undefined && userData.LastPlayedDate !== null) {
      candidates.push(userData.LastPlayedDate);
    }
    if (item.lastPlayedDate !== undefined && item.lastPlayedDate !== null) {
      candidates.push(item.lastPlayedDate);
    }

    for (i = 0; i < candidates.length; i += 1) {
      value = candidates[i];
      if (value === '') { continue; }
      parsed = Date.parse(String(value));
      if (!isNaN(parsed) && (best === null || parsed > best)) {
        best = parsed;
      }
    }

    return best;
  }

  function requestedLibrariesSucceeded(loadState) {
    var state = loadState || {};
    var requestedIds = state.requestedLibraryIds || [];
    var requests = state.videoRequests || {};
    var i;
    var libraryId;
    var requestState;

    if (state.viewsSucceeded !== true) { return false; }

    for (i = 0; i < requestedIds.length; i += 1) {
      libraryId = String(requestedIds[i]);
      requestState = requests[libraryId];
      if (!requestState || requestState.complete !== true || requestState.succeeded !== true) {
        return false;
      }
    }

    return true;
  }

  function buildIndex(groups) {
    var itemById = {};
    var libraryIdByItemId = {};
    var list = groups || [];
    var i;
    var j;
    var group;
    var videos;
    var item;
    var libraryId;
    var key;

    for (i = 0; i < list.length; i += 1) {
      group = list[i];
      libraryId = groupId(group);
      videos = group && group.videos ? group.videos : [];
      for (j = 0; j < videos.length; j += 1) {
        item = videos[j];
        key = itemId(item);
        if (!key) { continue; }
        itemById[key] = item;
        libraryIdByItemId[key] = libraryId;
      }
    }

    return {
      itemById: itemById,
      libraryIdByItemId: libraryIdByItemId
    };
  }

  function resolve(options) {
    var input = options || {};
    var preferences = input.preferences || {};
    var resolution = model.resolveLibraries(
      input.accessibleLibraries || [],
      preferences.libraryIds || []
    );
    var selectedMap = {};
    var selectedLibraries = [];
    var favoriteItems = [];
    var favoriteIdsToPrune = [];
    var resumeItem = null;
    var resumeItemTimestamp = null;
    var resumeItemHasValidTimestamp = false;
    var index = buildIndex(input.groups || []);
    var resumeItems = input.resumeItems || [];
    var favoriteIds = preferences.favoriteItemIds || [];
    var groups = input.groups || [];
    var canPruneFavorites = requestedLibrariesSucceeded(input.libraryLoadState) &&
      resolution.missingIds.length === 0;
    var i;
    var key;
    var libraryId;
    var item;
    var currentTimestamp;
    var currentHasValidTimestamp;

    for (i = 0; i < resolution.selected.length; i += 1) {
      selectedMap[itemId(resolution.selected[i])] = true;
    }

    for (i = 0; i < groups.length; i += 1) {
      item = groups[i];
      if (selectedMap[groupId(item)]) {
        selectedLibraries.push(item);
      }
    }

    for (i = 0; i < resumeItems.length; i += 1) {
      key = itemId(resumeItems[i]);
      libraryId = index.libraryIdByItemId[key];
      if (!key || !selectedMap[libraryId]) { continue; }

      currentTimestamp = playedTimestampOf(resumeItems[i]);
      currentHasValidTimestamp = currentTimestamp !== null;
      if (resumeItem === null ||
          (currentHasValidTimestamp && !resumeItemHasValidTimestamp) ||
          (currentHasValidTimestamp && resumeItemHasValidTimestamp &&
            currentTimestamp > resumeItemTimestamp)) {
        resumeItem = index.itemById[key] || resumeItems[i];
        resumeItemTimestamp = currentTimestamp;
        resumeItemHasValidTimestamp = currentHasValidTimestamp;
      }
    }

    for (i = 0; i < favoriteIds.length; i += 1) {
      key = String(favoriteIds[i] || '');
      if (!key) { continue; }
      item = index.itemById[key];
      if (!item) {
        favoriteIdsToPrune.push(key);
        continue;
      }
      libraryId = index.libraryIdByItemId[key];
      if (selectedMap[libraryId]) {
        favoriteItems.push(item);
      }
    }

    if (!canPruneFavorites) {
      favoriteIdsToPrune = [];
    }

    return {
      canPruneFavorites: canPruneFavorites,
      favoriteIdsToPrune: favoriteIdsToPrune,
      favoriteItems: favoriteItems,
      itemById: index.itemById,
      libraryIdByItemId: index.libraryIdByItemId,
      missingLibraryIds: resolution.missingIds,
      resumeItem: resumeItem,
      selectedLibraries: selectedLibraries
    };
  }

  global.RawiStorybookCatalogue = {
    resolve: resolve
  };
}(window));
