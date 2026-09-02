(function (global) {
  'use strict';

  var DAY_MS = 24 * 60 * 60 * 1000;
  var CATEGORY_KEYS = ['singDance', 'bedtime', 'animals', 'learning', 'movement'];
  var CATEGORY_COPY_KEYS = {
    singDance: 'storybookCategorySingDance',
    bedtime: 'storybookCategoryBedtime',
    animals: 'storybookCategoryAnimals',
    learning: 'storybookCategoryLearning',
    movement: 'storybookCategoryMovement'
  };

  function value(object, pascal, camel) {
    if (!object) { return undefined; }
    return object[pascal] !== undefined ? object[pascal] : object[camel];
  }

  function itemId(item) {
    if (!item) { return ''; }
    if (item.Id !== undefined && item.Id !== null) { return String(item.Id); }
    if (item.id !== undefined && item.id !== null) { return String(item.id); }
    return '';
  }

  function userData(item) {
    return value(item, 'UserData', 'userData') || {};
  }

  function tagsOf(item) {
    var tags = value(item, 'Tags', 'tags');
    return Array.isArray(tags) ? tags : [];
  }

  function normalizeTag(tag) {
    return typeof tag === 'string' ? tag.trim().toLowerCase() : '';
  }

  function playedTimestampOf(item) {
    var candidates = [];
    var data = userData(item);
    var i;
    var parsed;

    if (data.LastPlayedDate !== undefined && data.LastPlayedDate !== null) {
      candidates.push(data.LastPlayedDate);
    }
    if (item && item.lastPlayedDate !== undefined && item.lastPlayedDate !== null) {
      candidates.push(item.lastPlayedDate);
    }

    for (i = 0; i < candidates.length; i += 1) {
      parsed = Date.parse(String(candidates[i]));
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  function recentHistoryDays(preferences) {
    var parsed = parseInt(preferences && preferences.recentHistoryDays, 10);
    if (isNaN(parsed) || parsed < 0) {
      return 14;
    }
    return parsed;
  }

  function matchCategoryKeys(item, preferences) {
    var configured = preferences && preferences.categoryTags ? preferences.categoryTags : {};
    var tags = tagsOf(item).map(normalizeTag);
    var matches = [];

    CATEGORY_KEYS.forEach(function (key) {
      var configuredTag = normalizeTag(configured[key]);
      if (configuredTag && tags.indexOf(configuredTag) !== -1) {
        matches.push(key);
      }
    });

    return matches;
  }

  function isRecentlyCompleted(item, preferences, nowMs) {
    var played = userData(item).Played === true || userData(item).played === true;
    var lastPlayedMs = playedTimestampOf(item);

    if (!played || lastPlayedMs === null) {
      return false;
    }

    return lastPlayedMs >= (nowMs - recentHistoryDays(preferences) * DAY_MS);
  }

  function stableHash(text) {
    var hash = 0;
    var i;
    var input = String(text || 'storybook');

    for (i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) % 2147483647;
    }

    return hash;
  }

  function flattenSelectedLibraries(catalogue, preferences, nowMs) {
    var libraries = catalogue && catalogue.selectedLibraries ? catalogue.selectedLibraries : [];
    var entries = [];
    var i;
    var j;
    var library;
    var videos;
    var item;
    var id;

    for (i = 0; i < libraries.length; i += 1) {
      library = libraries[i] || {};
      videos = library.videos || [];
      for (j = 0; j < videos.length; j += 1) {
        item = videos[j];
        id = itemId(item);
        if (!id) { continue; }
        entries.push({
          categoryKeys: matchCategoryKeys(item, preferences),
          index: entries.length,
          item: item,
          libraryId: String(library.id || library.Id || ''),
          playedMs: playedTimestampOf(item),
          recentCompleted: isRecentlyCompleted(item, preferences, nowMs)
        });
      }
    }

    return entries;
  }

  function recentCompletionEntries(entries) {
    return entries.filter(function (entry) {
      var played = userData(entry.item).Played === true || userData(entry.item).played === true;
      return played && entry.playedMs !== null;
    }).sort(function (left, right) {
      if (left.playedMs !== right.playedMs) {
        return right.playedMs - left.playedMs;
      }
      return left.index - right.index;
    });
  }

  function buildCategories(entries) {
    return CATEGORY_KEYS.map(function (key) {
      return {
        copyKey: CATEGORY_COPY_KEYS[key],
        items: entries.filter(function (entry) {
          return entry.categoryKeys.indexOf(key) !== -1;
        }).map(function (entry) {
          return entry.item;
        }),
        key: key
      };
    }).filter(function (category) {
      return category.items.length > 0;
    });
  }

  function littleMenuCandidates(entries, catalogue) {
    var resumeId = itemId(catalogue && catalogue.resumeItem);

    return entries.filter(function (entry) {
      var id = itemId(entry.item);
      if (!id || entry.recentCompleted) { return false; }
      if (resumeId && id === resumeId) { return false; }
      return true;
    });
  }

  function diversityScore(entry, usedLibraries, usedCategories) {
    var score = 0;
    var hasOverlap = false;

    if (!usedLibraries[entry.libraryId]) {
      score += 4;
    }
    if (!entry.categoryKeys.length) {
      score += 1;
      return score;
    }

    entry.categoryKeys.forEach(function (key) {
      if (usedCategories[key]) {
        hasOverlap = true;
      }
    });
    if (!hasOverlap) {
      score += 2;
    }
    return score;
  }

  function seededShuffle(entries, sessionSeed) {
    var result = entries.slice();
    var state = stableHash(sessionSeed) || 1;
    var i;
    var swapIndex;
    var swapValue;

    function nextRandom() {
      state = (state * 214013) % 2147483647;
      return state / 2147483647;
    }

    for (i = result.length - 1; i > 0; i -= 1) {
      swapIndex = Math.floor(nextRandom() * (i + 1));
      swapValue = result[i];
      result[i] = result[swapIndex];
      result[swapIndex] = swapValue;
    }

    return result;
  }

  function chooseLittleMenu(entries, sessionSeed, favorites) {
    var remaining = entries.slice();
    var seededOrder = {};
    var chosen = [];
    var usedLibraries = {};
    var usedCategories = {};
    var entry;

    seededShuffle(entries, sessionSeed).forEach(function (seededEntry, orderIndex) {
      seededOrder[itemId(seededEntry.item)] = orderIndex;
    });

    while (remaining.length && chosen.length < 3) {
      remaining.sort(function (left, right) {
        var leftScore = diversityScore(left, usedLibraries, usedCategories);
        var rightScore = diversityScore(right, usedLibraries, usedCategories);
        var leftId = itemId(left.item);
        var rightId = itemId(right.item);

        if (favorites[leftId]) {
          leftScore += 3;
        }
        if (favorites[rightId]) {
          rightScore += 3;
        }
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }
        if (seededOrder[leftId] !== seededOrder[rightId]) {
          return seededOrder[leftId] - seededOrder[rightId];
        }
        return left.index - right.index;
      });

      entry = remaining.shift();
      chosen.push(entry.item);
      usedLibraries[entry.libraryId] = true;
      entry.categoryKeys.forEach(function (key) {
        usedCategories[key] = true;
      });
    }

    return chosen;
  }

  function favoriteMap(preferences) {
    var map = {};
    var favorites = preferences && preferences.favoriteItemIds ? preferences.favoriteItemIds : [];

    favorites.forEach(function (id) {
      map[String(id)] = true;
    });
    return map;
  }

  function sharesCategory(left, right) {
    var i;
    for (i = 0; i < left.length; i += 1) {
      if (right.indexOf(left[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  function scoreMagicCandidate(entry, favorites, mostRecentCategoryKeys) {
    var score = 0;
    var played = userData(entry.item).Played === true || userData(entry.item).played === true;
    var reason = {
      copyKey: 'storybookMagicReasonAnyStory'
    };

    if (!played) {
      score += 8;
      reason = {
        copyKey: 'storybookMagicReasonUnwatched'
      };
    }
    if (favorites[itemId(entry.item)]) {
      score += 3;
      reason = {
        copyKey: 'storybookMagicReasonFavorite'
      };
    }
    if (mostRecentCategoryKeys.length && entry.categoryKeys.length && !sharesCategory(entry.categoryKeys, mostRecentCategoryKeys)) {
      score += 2;
      reason = {
        copyKey: 'storybookMagicReasonDifferentCategory'
      };
    }

    return {
      item: entry.item,
      reason: reason,
      score: score,
      stableIndex: entry.index
    };
  }

  function build(options) {
    var input = options || {};
    var catalogue = input.catalogue || {};
    var preferences = input.preferences || {};
    var nowMs = input.nowMs !== undefined ? input.nowMs : Date.now();
    var sessionSeed = String(input.sessionSeed !== undefined ? input.sessionSeed : 'storybook');
    var entries = flattenSelectedLibraries(catalogue, preferences, nowMs);
    var completedEntries = recentCompletionEntries(entries);

    return {
      categories: buildCategories(entries),
      littleMenu: chooseLittleMenu(
        littleMenuCandidates(entries, catalogue),
        sessionSeed,
        favoriteMap(preferences)
      ),
      mostRecentlyCompleted: completedEntries.length ? completedEntries[0].item : null,
      recentlyCompleted: completedEntries.filter(function (entry) {
        return entry.recentCompleted;
      }).map(function (entry) {
        return entry.item;
      })
    };
  }

  function magicPick(options) {
    var input = options || {};
    var catalogue = input.catalogue || {};
    var preferences = input.preferences || {};
    var nowMs = input.nowMs !== undefined ? input.nowMs : Date.now();
    var discovery = input.discovery || build({
      catalogue: catalogue,
      nowMs: nowMs,
      preferences: preferences,
      sessionSeed: 'magic'
    });
    var random = typeof input.random === 'function' ? input.random : Math.random;
    var entries = flattenSelectedLibraries(catalogue, preferences, nowMs).filter(function (entry) {
      return !entry.recentCompleted;
    });
    var favorites = favoriteMap(preferences);
    var mostRecentCategoryKeys = discovery.mostRecentlyCompleted ?
      matchCategoryKeys(discovery.mostRecentlyCompleted, preferences) :
      [];
    var scored;
    var maxScore;
    var best;
    var index;

    if (!entries.length) {
      return {
        item: null,
        reason: {
          copyKey: 'storybookMagicPickEmptyBody'
        }
      };
    }

    scored = entries.map(function (entry) {
      return scoreMagicCandidate(entry, favorites, mostRecentCategoryKeys);
    });
    maxScore = scored.reduce(function (bestScore, entry) {
      return entry.score > bestScore ? entry.score : bestScore;
    }, scored[0].score);
    best = scored.filter(function (entry) {
      return entry.score === maxScore;
    }).sort(function (left, right) {
      return left.stableIndex - right.stableIndex;
    });

    index = Math.floor(random() * best.length);
    if (index < 0) { index = 0; }
    if (index >= best.length) { index = best.length - 1; }

    return {
      item: best[index].item,
      reason: best[index].reason
    };
  }

  global.RawiStorybookDiscovery = {
    build: build,
    magicPick: magicPick
  };
}(window));
