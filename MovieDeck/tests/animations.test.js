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
    setCalls: [],
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
      recorder.setCalls.push({
        target: target,
        vars: vars
      });
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
  var currentDoors = doors;
  var document = {
    querySelectorAll: function (selector) {
      assert.strictEqual(selector, '#storybook-doors .storybook-door');
      return currentDoors;
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
    gsap: gsap,
    setDoors: function (nextDoors) {
      currentDoors = nextDoors;
    }
  };
}

(function animatesOnlyTheFirstThreeStoryDoorsAfterEntrance() {
  var doors = [createDoor(), createDoor(), createDoor(), createDoor(), createDoor()];
  var harness = loadAnimationsHarness(false, doors);

  assert.strictEqual(typeof harness.animations.animateStorybookHome, 'function');
  harness.animations.animateStorybookHome(false);

  assert.deepStrictEqual(harness.gsap.killTargets, []);
  assert.strictEqual(harness.gsap.setCalls.length, 1);
  assert.strictEqual(harness.gsap.setCalls[0].target.length, 5);
  assert.strictEqual(
    harness.gsap.setCalls[0].vars.clearProps,
    'opacity,visibility,transform'
  );
  assert.strictEqual(harness.gsap.fromToCalls.length, 1);
  assert.strictEqual(harness.gsap.fromToCalls[0].target.length, 5);
  assert.strictEqual(harness.gsap.toCalls.length, 0);
  harness.gsap.fromToCalls[0].toVars.onComplete();
  assert.strictEqual(harness.gsap.toCalls.length, 3);
  assert.strictEqual(harness.gsap.toCalls[0].target, doors[0]);
  assert.strictEqual(harness.gsap.toCalls[2].target, doors[2]);
  assert.strictEqual(harness.gsap.toCalls[0].vars.delay, 0.05);
  assert.strictEqual(harness.gsap.toCalls[1].vars.delay, 0.13);
  assert.strictEqual(harness.gsap.toCalls[0].vars.repeat, -1);
  assert.strictEqual(harness.gsap.toCalls[0].vars.overwrite, true);
}());

(function keepsStorybookHomeStaticWhenReducedMotionIsForced() {
  var doors = [createDoor(), createDoor()];
  var harness = loadAnimationsHarness(false, doors);

  harness.animations.animateStorybookHome(true);

  assert.strictEqual(harness.gsap.fromToCalls.length, 0);
  assert.strictEqual(harness.gsap.toCalls.length, 0);
  assert.strictEqual(harness.gsap.setCalls.length, 1);
  assert.strictEqual(doors[0].style.opacity, '');
  assert.strictEqual(doors[0].style.visibility, '');
  assert.strictEqual(doors[0].style.transform, '');
}());

(function keepsStorybookHomeStaticWhenMediaQueryRequestsReducedMotion() {
  var doors = [createDoor(), createDoor()];
  var harness = loadAnimationsHarness(true, doors);

  harness.animations.animateStorybookHome(false);

  assert.strictEqual(harness.gsap.fromToCalls.length, 0);
  assert.strictEqual(harness.gsap.toCalls.length, 0);
  assert.strictEqual(doors[1].style.transform, '');
}());

(function clearsPreviousDoorTweensBeforeAnimatingNewDoorSet() {
  var firstDoors = [createDoor(), createDoor(), createDoor()];
  var secondDoors = [createDoor(), createDoor()];
  var harness = loadAnimationsHarness(false, firstDoors);

  harness.animations.animateStorybookHome(false);
  harness.setDoors(secondDoors);
  harness.animations.animateStorybookHome(false);

  assert.strictEqual(harness.gsap.killTargets.length, 1);
  assert.strictEqual(harness.gsap.killTargets[0].length, 3);
  assert.strictEqual(harness.gsap.setCalls.length, 3);
  assert.strictEqual(harness.gsap.setCalls[1].target.length, 3);
  assert.strictEqual(harness.gsap.setCalls[2].target.length, 2);
}());
