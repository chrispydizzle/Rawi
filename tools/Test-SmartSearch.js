/* Run with agent-browser eval on a fresh ?preview=storybook page. */
(async function () {
  'use strict';
  function assert(condition, message) {
    if (!condition) { throw new Error(message); }
  }
  function byId(id) { return document.getElementById(id); }
  function active(id) { return byId(id).classList.contains('is-active'); }
  function assertVisibleButton(id) {
    var button = byId(id);
    var rect = button.getBoundingClientRect();
    var toggle = button.parentNode.querySelector('.mode-toggle');
    var toggleRect = toggle && toggle.getBoundingClientRect();
    assert(!toggleRect || rect.right <= toggleRect.left || rect.left >= toggleRect.right ||
      rect.bottom <= toggleRect.top || rect.top >= toggleRect.bottom,
      id + ' must not overlap the mode toggle');
    assert(rect.width > 0 && rect.height > 0 && rect.left >= 0 &&
      rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      id + ' must be inside the viewport');
    [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]].forEach(function (point) {
      var hit = document.elementFromPoint(rect.left + rect.width * point[0], rect.top + rect.height * point[1]);
      assert(hit === button || button.contains(hit), id + ' must not be covered by another control');
    });
  }
  function key(letter) {
    return Array.prototype.filter.call(byId('search-keyboard').children, function (button) {
      return button.getAttribute('data-letter') === letter;
    })[0];
  }
  function type(query) {
    query.split('').forEach(function (letter) {
      assert(key(letter) && !key(letter).disabled, 'Expected available letter: ' + letter);
      key(letter).click();
      assert(document.activeElement && !document.activeElement.disabled, 'Focus must remain on an available control');
    });
  }
  async function waitFor(predicate) {
    var deadline = Date.now() + 5000;
    while (!predicate()) {
      if (Date.now() > deadline) { throw new Error('Screen did not become ready'); }
      await new Promise(function (resolve) { setTimeout(resolve, 20); });
    }
  }
  assert(active('storybook-screen'), 'Open a fresh Storybook preview first');
  assertVisibleButton('storybook-search-button');
  byId('storybook-search-button').focus();
  assertVisibleButton('storybook-search-button');
  byId('storybook-search-button').click();
  assert(active('search-screen'), 'Kid search opens');
  type('blue');
  assert(byId('search-results').children.length > 0, 'Partial kid title matches');
  var kidCard = byId('search-results').firstChild;
  assert(kidCard.classList.contains('storybook-menu-card'), 'Kid result uses Storybook artwork');
  kidCard.click();
  await waitFor(function () { return active('storybook-details-screen'); });
  byId('storybook-details-back').click();
  await waitFor(function () { return document.activeElement === kidCard; });
  assert(byId('search-query').textContent === 'blue', 'Kid query survives details');
  byId('search-back').click();
  await waitFor(function () { return document.activeElement === byId('storybook-search-button'); });

  var fixture = window.RawiPreviewFixtures.storybook;
  var videos = [];
  for (var i = 0; i < 105; i += 1) {
    videos.push({ Id: 'search-browser-' + i, Name: 'Search Fixture ' + i });
  }
  fixture.libraries.push({ Id: 'search-browser-adult', Name: 'Search test library' });
  fixture.groups.push({ id: 'search-browser-adult', name: 'Search test library', videos: videos });
  byId('storybook-home-adult-mode-button').click();
  await waitFor(function () { return active('browse-screen') && !byId('search-button').disabled; });
  var titleRect = byId('selection-title').parentNode.getBoundingClientRect();
  var actionRect = byId('search-button').getBoundingClientRect();
  assert(titleRect.right < actionRect.left, 'Search does not overlap selected title');
  assertVisibleButton('search-button');
  byId('search-button').focus();
  assertVisibleButton('search-button');
  byId('search-button').click();
  type('fixture');
  assert(byId('search-count').textContent === '105 matching titles', 'All matches counted');
  assert(byId('search-results').children.length === 30, 'Initial result page');
  assert(!key(' ').disabled && key('a').disabled, 'Only valid continuations enabled');
  while (!byId('search-more').disabled) { byId('search-more').click(); }
  assert(byId('search-results').children.length === 105, 'Every result is accessible');
  var lastCard = byId('search-results').lastChild;
  lastCard.focus();
  lastCard.click();
  byId('details-back').click();
  assert(active('search-screen') && document.activeElement === lastCard, 'Adult details returns to result');
  byId('search-clear').click();
  assert(byId('search-query').textContent === 'Choose a letter', 'Clear broadens query');
  assert(byId('search-results').parentNode.scrollTop === 0, 'Broadening query resets results scroll');
  type('fixture');
  var focused = document.activeElement;
  var rect = focused.getBoundingClientRect();
  assert(rect.top >= 0 && rect.bottom <= innerHeight, 'Keyboard focus stays visible');
  assert(!performance.getEntriesByType('resource').some(function (entry) {
    return /\/Users\/|\/Items\/|\/Sessions\//.test(entry.name);
  }), 'Mock search never contacts Jellyfin');
  byId('search-back').click();
  byId('storybook-mode-button').click();
  await waitFor(function () { return active('storybook-screen'); });
  byId('storybook-search-button').click();
  assert(!Array.prototype.some.call(byId('search-results').children, function (card) {
    return /^search-browser-/.test(card.getAttribute('data-item-id'));
  }), 'Adult-only search fixtures never appear in kid search');
  return { passed: true, modes: ['Adult', 'Storybook'], partialMatches: 105, allResultsReachable: true };
}());
