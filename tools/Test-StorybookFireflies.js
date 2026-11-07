/* Run with agent-browser eval on a fresh ?preview=storybook page. */
(function () {
  'use strict';
  function assert(condition, message) {
    if (!condition) { throw new Error(message); }
  }
  function layerFor(card) { return card.querySelector('.storybook-fireflies'); }
  function animationsFor(card) {
    return Array.prototype.reduce.call(layerFor(card).children, function (animations, light) {
      return animations.concat(light.getAnimations());
    }, []);
  }
  var cards = document.querySelectorAll('#storybook-screen .storybook-firefly-target');
  assert(cards.length >= 2, 'Preview needs two Storybook choices');
  var first = cards[0];
  var second = cards[1];
  first.focus();
  var layer = layerFor(first);
  assert(layer.getAttribute('aria-hidden') === 'true', 'Decoration is hidden from accessibility');
  assert(!layer.querySelector('[data-focusable], button, input, [tabindex]'), 'Decoration adds no remote stops');
  assert(getComputedStyle(layer).pointerEvents === 'none', 'Decoration never intercepts input');
  assert(getComputedStyle(first).boxShadow !== 'none', 'Standard focus outline is preserved');

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    assert(getComputedStyle(layer).display === 'none', 'System reduced motion suppresses fireflies');
    assert(animationsFor(first).length === 0, 'System reduced motion starts no firefly animation');
    return { passed: true, systemReducedMotion: true };
  }

  var animations = animationsFor(first);
  assert(animations.length === 3, 'Three fireflies animate on focus');
  var before = first.getBoundingClientRect();
  animations.forEach(function (animation) { animation.pause(); animation.currentTime = 400; });
  Array.prototype.forEach.call(layer.children, function (light) {
    var style = getComputedStyle(light);
    assert(Number(style.opacity) > 0.2, 'Fireflies visibly glow during the flourish');
    assert(style.transform !== 'none', 'Fireflies move independently of the card');
    var rect = light.getBoundingClientRect();
    var hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    assert(!layer.contains(hit), 'Firefly pixels do not capture hit testing');
  });
  var after = first.getBoundingClientRect();
  assert(before.width === after.width && before.height === after.height, 'Fireflies do not shift layout');
  animations.forEach(function (animation) { animation.finish(); });
  assert(Array.prototype.every.call(layer.children, function (light) {
    return Number(getComputedStyle(light).opacity) === 0;
  }), 'Flourish fades completely instead of looping');
  second.focus();
  assert(getComputedStyle(layer).display === 'none', 'Old card loses its fireflies immediately');
  assert(animationsFor(first).length === 0, 'Moving focus cancels old animations');
  assert(animationsFor(second).length === 3, 'New focused card gets a fresh flourish');

  var parentReduced = document.body.classList.contains('storybook-reduced-motion');
  try {
    document.body.classList.add('storybook-reduced-motion');
    assert(getComputedStyle(layerFor(second)).display === 'none', 'Parent reduced motion suppresses fireflies');
    assert(animationsFor(second).length === 0, 'Parent reduced motion cancels animations');
    document.body.classList.remove('storybook-reduced-motion');
    document.body.classList.remove('mode-storybook');
    assert(getComputedStyle(layerFor(second)).display === 'none', 'Adult mode never shows fireflies');
    assert(animationsFor(second).length === 0, 'Adult mode starts no firefly animation');
  } finally {
    document.body.classList.add('mode-storybook');
    document.body.classList.toggle('storybook-reduced-motion', parentReduced);
  }
  first.focus();
  assert(animationsFor(first).length === 3, 'Returning focus restarts the finite flourish');
  return { passed: true, fireflies: 3, finiteAnimation: true, parentReducedMotion: true, adultModeUnchanged: true };
}());
