'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;

function createDoor() {
  return {
    style: {
      opacity: '0.5',
      transform: 'translateY(7px)',
      visibility: 'hidden'
    }
  };
}

function createGsapRecorder() {
  var recorder = {
    fromToCalls: [],
    killTargets: [],
    toCalls: []
  };

  recorder.api = {
    fromTo: function (target, fromVars, toVars) {
      recorder.fromToCalls.push({
        fromVars: fromVars,
        target: target,
        toVars: toVars
      });
    },
    killTweensOf: function (target) {
      recorder.killTargets.push(target);
    },
    set: function (target, vars) {
      Array.prototype.forEach.call(target, function (door) {
        if (vars.clearProps === 'opacity,visibility,transform') {
          door.style.opacity = '';
          door.style.visibility = '';
          door.style.transform = '';
        }
      });
    },
    to: function (target, vars) {
      recorder.toCalls.push({
        target: target,
        vars: vars
      });
    }
  };

  return recorder;
}

function loadAnimationsHarness(matchMediaMatches, doors) {
  var gsap = createGsapRecorder();
  var document = {
    querySelectorAll: function (selector) {
      assert.strictEqual(selector, '#storybook-doors .storybook-door');
      return doors;
    }
  };
  var window = load('js/animations.js', {
    document: document,
    window: {
      gsap: gsap.api,
      matchMedia: function () {
        return { matches: matchMediaMatches };
      }
    }
  });

  return {
    animations: window.MovieDeckAnimations,
    gsap: gsap
  };
}

(function animatesOnlyTheFirstThreeStoryDoors() {
  var doors = [createDoor(), createDoor(), createDoor(), createDoor(), createDoor()];
  var harness = loadAnimationsHarness(false, doors);

  assert.strictEqual(typeof harness.animations.animateStorybookHome, 'function');
  harness.animations.animateStorybookHome(false);

  assert.deepStrictEqual(harness.gsap.killTargets, [doors]);
  assert.strictEqual(harness.gsap.fromToCalls.length, 1);
  assert.strictEqual(harness.gsap.toCalls.length, 3);
  assert.strictEqual(harness.gsap.toCalls[0].target, doors[0]);
  assert.strictEqual(harness.gsap.toCalls[2].target, doors[2]);
  assert.strictEqual(harness.gsap.toCalls[0].vars.repeat, -1);
}());

(function keepsStorybookHomeStaticWhenReducedMotionIsForced() {
  var doors = [createDoor(), createDoor()];
  var harness = loadAnimationsHarness(false, doors);

  harness.animations.animateStorybookHome(true);

  assert.strictEqual(harness.gsap.fromToCalls.length, 0);
  assert.strictEqual(harness.gsap.toCalls.length, 0);
  assert.strictEqual(doors[0].style.opacity, '');
  assert.strictEqual(doors[0].style.visibility, '');
  assert.strictEqual(doors[0].style.transform, '');
}());
