/* Run with agent-browser eval on a fresh ?preview=storybook page. */
(async function () {
  'use strict';
  function assert(condition, message) {
    if (!condition) { throw new Error(message); }
  }
  function byId(id) { return document.getElementById(id); }
  function active(id) { return byId(id).classList.contains('is-active'); }
  function wait(milliseconds) {
    return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
  }
  async function waitFor(predicate) {
    var deadline = Date.now() + 5000;
    while (!predicate()) {
      if (Date.now() > deadline) { throw new Error('Screen did not become ready'); }
      await wait(20);
    }
  }
  function key(letter) {
    return Array.prototype.filter.call(byId('search-keyboard').children, function (button) {
      return button.getAttribute('data-letter') === letter;
    })[0];
  }
  function type(value) {
    value.split('').forEach(function (letter) {
      assert(key(letter) && !key(letter).disabled, 'Available search letter: ' + letter);
      key(letter).click();
      assert(document.activeElement && !document.activeElement.disabled, 'Remote focus stays enabled');
    });
  }
  function press(code) {
    document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: code, which: code, bubbles: true }));
  }
  async function setParentMotion(reduced) {
    byId('storybook-edit-libraries').click();
    await waitFor(function () { return active('storybook-settings-screen'); });
    byId('storybook-reduced-motion').checked = reduced;
    byId('storybook-save').click();
    await waitFor(function () { return active('storybook-screen'); });
  }
  function checkStaticSearch() {
    byId('storybook-search-button').click();
    type('b');
    assert(byId('search-query').textContent === 'b', 'Reduced-motion query updates');
    assert(!byId('search-query').querySelector('.is-stamping'), 'Reduced motion starts no stamp');
    assert(byId('search-query').getAnimations({ subtree: true }).length === 0, 'Reduced query has no running animations');
    press(8);
    assert(byId('search-query').textContent === 'Choose a letter', 'Reduced-motion deletion updates');
    assert(!document.querySelector('.storybook-search-peel'), 'Reduced motion starts no peel');
    byId('search-back').click();
  }

  assert(active('storybook-screen'), 'Open a fresh Storybook preview first');
  await wait(600);
  var moon = byId('storybook-screen').querySelector('.storybook-moon');
  var face = moon.querySelector('.storybook-moon-face');
  var eyes = moon.querySelector('.storybook-moon-eyes');
  var pupil = moon.querySelector('.storybook-moon-pupil');
  assert(face && moon.querySelectorAll('.storybook-moon-eye').length === 2, 'Existing moon gets a face');
  assert(moon.getAttribute('aria-hidden') === 'true', 'Companion is hidden from accessibility');
  assert(!moon.querySelector('button, input, [data-focusable], [tabindex]'), 'Companion adds no remote stops');
  assert(getComputedStyle(face).pointerEvents === 'none', 'Companion never intercepts input');

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    byId('storybook-search-button').focus();
    assert(!moon.classList.contains('is-awake'), 'System preference disables moon activity');
    assert(eyes.getAnimations().length === 0, 'System preference starts no blinking');
    assert(getComputedStyle(pupil).transform === 'none', 'System preference disables eye tracking');
    checkStaticSearch();
    return { passed: true, systemReducedMotion: true };
  }

  assert(!document.body.classList.contains('storybook-reduced-motion'), 'Start with parent reduced motion off');
  byId('storybook-search-button').focus();
  await wait(220);
  assert(moon.classList.contains('is-awake'), 'Moon wakes on focus');
  assert(getComputedStyle(pupil).transform !== 'none', 'Eyes visibly track the focused control');
  var blink = eyes.getAnimations()[0];
  assert(blink, 'Awake moon blinks');
  blink.pause();
  blink.currentTime = 7050;
  assert(new DOMMatrix(getComputedStyle(eyes).transform).d < 0.2, 'Blink actually closes the eyes');
  blink.currentTime = 0;
  blink.play();
  var focused = document.activeElement;
  await wait(12200);
  assert(moon.classList.contains('is-sleepy'), 'Moon dozes after twelve seconds');
  assert(!moon.classList.contains('is-awake') && eyes.getAnimations().length === 0, 'Sleeping moon stops blinking');
  await wait(260);
  assert(new DOMMatrix(getComputedStyle(eyes).transform).d < 0.2, 'Sleepy eyelids visibly close');
  assert(document.activeElement === focused, 'Dozing never moves remote focus');
  press(39);
  assert(moon.classList.contains('is-awake'), 'First remote press wakes the moon');
  assert(document.activeElement !== focused && !document.activeElement.disabled, 'The same press still navigates');

  byId('storybook-search-button').click();
  assert(!moon.classList.contains('is-awake'), 'Hidden moon stops when search opens');
  var query = byId('search-query');
  var initialCount = byId('search-count').textContent;
  var keyboardBounds = byId('search-keyboard').getBoundingClientRect();
  type('b');
  assert(query.textContent === 'b', 'Query updates before the stamp completes');
  assert(byId('search-count').textContent !== initialCount, 'Results update before the stamp completes');
  assert(query.getAttribute('aria-atomic') === 'true', 'Live region announces the complete query');
  var letter = query.querySelector('.is-stamping');
  var stamp = letter && letter.getAnimations()[0];
  assert(stamp, 'New letter has a real CSS stamp animation');
  stamp.pause();
  stamp.currentTime = 126;
  assert(Number(getComputedStyle(letter).opacity) > 0.9, 'Stamp becomes visible');
  assert(new DOMMatrix(getComputedStyle(letter).transform).d < 0.9, 'Stamp visibly squashes');
  assert(byId('search-keyboard').getBoundingClientRect().top === keyboardBounds.top, 'Stamp does not move the keyboard');
  stamp.finish();
  await wait(40);
  assert(!query.querySelector('.is-stamping'), 'Finished stamp is cleaned up');
  press(8);
  assert(query.textContent === 'Choose a letter', 'Backspace changes the live query immediately');
  assert(byId('search-count').textContent === initialCount, 'Backspace restores all matches immediately');
  var peel = document.querySelector('.storybook-search-peel');
  assert(peel && peel.textContent === 'b', 'Deleted letter gets a peel');
  assert(!query.contains(peel) && peel.getAttribute('aria-hidden') === 'true', 'Peel is outside the accessible query');
  assert(getComputedStyle(peel).pointerEvents === 'none', 'Peel never intercepts input');
  var peeling = peel.getAnimations()[0];
  assert(peeling, 'Peel has a real CSS animation');
  peeling.pause();
  peeling.currentTime = 120;
  var peeledStyle = getComputedStyle(peel);
  assert(Number(peeledStyle.opacity) > 0 && Number(peeledStyle.opacity) < 1, 'Peel visibly fades');
  assert(new DOMMatrix(peeledStyle.transform).f < 0, 'Peel visibly lifts');
  peeling.finish();
  await wait(40);
  assert(!document.querySelector('.storybook-search-peel'), 'Finished peel is removed');

  type('blue');
  assert(query.textContent === 'blue' && query.querySelectorAll('.is-stamping').length === 1, 'Rapid typing stamps only the latest letter');
  press(8);
  var oldPeel = document.querySelector('.storybook-search-peel');
  press(8);
  assert(document.querySelectorAll('.storybook-search-peel').length === 1, 'Rapid deletion never accumulates peels');
  type('u');
  oldPeel.dispatchEvent(new Event('animationend'));
  assert(!document.querySelector('.storybook-search-peel'), 'Typing interrupts the outgoing peel');
  assert(query.querySelector('.is-stamping'), 'Stale completion cannot cancel a new stamp');
  byId('search-results').firstChild.click();
  await waitFor(function () { return active('storybook-details-screen'); });
  assert(!query.querySelector('.is-stamping'), 'Leaving search clears the stamp');
  byId('storybook-details-back').click();
  assert(query.textContent === 'blu', 'Returning from details preserves the query');
  assert(!query.querySelector('.is-stamping'), 'Returning does not replay old stamps');
  byId('search-back').click();

  await setParentMotion(true);
  assert(!moon.classList.contains('is-awake') && eyes.getAnimations().length === 0, 'Parent preference disables the companion');
  checkStaticSearch();
  await setParentMotion(false);
  byId('storybook-home-adult-mode-button').click();
  await waitFor(function () { return active('browse-screen') && !byId('search-button').disabled; });
  assert(!document.querySelector('.storybook-moon.is-awake'), 'Adult Mode has no active companion');
  byId('search-button').click();
  type('b');
  assert(query.textContent === 'b' && query.children.length === 0, 'Adult search stays plain text');
  press(8);
  assert(!document.querySelector('.storybook-search-peel'), 'Adult deletion stays unchanged');
  byId('search-back').click();
  byId('storybook-mode-button').click();
  await waitFor(function () { return active('storybook-screen'); });
  assert(!performance.getEntriesByType('resource').some(function (entry) {
    return /\/Users\/|\/Items\/|\/Sessions\//.test(entry.name);
  }), 'Preview checks never contact Jellyfin');
  return {
    passed: true,
    sleepyMoon: true,
    visibleLetterStamps: true,
    visibleBackspacePeel: true,
    rapidRemoteInput: true,
    parentReducedMotion: true,
    adultModeUnchanged: true
  };
}());
