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

function createScroller(clientWidth, scrollWidth, scrollLeft, rect) {
  return {
    clientWidth: clientWidth,
    getBoundingClientRect: function () {
      return rect;
    },
    scrollLeft: scrollLeft,
    scrollWidth: scrollWidth
  };
}

function createDoorTrack(scroller) {
  return {
    parentNode: scroller,
    style: {}
  };
}

function createFocusableDoor(track, rect) {
  return {
    getBoundingClientRect: function () {
      return rect;
    },
    parentNode: track
  };
}

function shiftDoorRect(rect, distance) {
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left - distance,
    right: rect.right - distance,
    top: rect.top,
    width: rect.width
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
      return {
        kill: function () {
          recorder.killedTweens = (recorder.killedTweens || 0) + 1;
        }
      };
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

(function stopsStorybookDoorTweensWhenLeavingStorybookHome() {
  var doors = [createDoor(), createDoor()];
  var harness = loadAnimationsHarness(false, doors);

  harness.animations.animateStorybookHome(false);
  harness.animations.stopStorybookHome();

  assert.strictEqual(harness.gsap.killTargets.length, 1);
  assert.strictEqual(harness.gsap.killTargets[0].length, 2);
  assert.strictEqual(harness.gsap.setCalls.length, 2);
  assert.strictEqual(harness.gsap.setCalls[1].target.length, 2);
  assert.strictEqual(
    harness.gsap.setCalls[1].vars.clearProps,
    'opacity,visibility,transform'
  );
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

(function keepsFocusedStoryDoorsVisibleWithHorizontalTransformMotion() {
  var scroller = createScroller(1400, 2210, 0, {
    left: 90,
    right: 1490
  });
  var track = createDoorTrack(scroller);
  var door = createFocusableDoor(track, {
    left: 1685,
    right: 1955,
    width: 270,
    height: 390
  });
  var harness = loadAnimationsHarness(false, []);

  harness.animations.focusStorybookDoor(door, false);

  assert.strictEqual(harness.gsap.toCalls.length, 1);
  assert.strictEqual(harness.gsap.toCalls[0].vars.position, 537);
  harness.gsap.toCalls[0].target.position = 537;
  harness.gsap.toCalls[0].vars.onUpdate();
  assert.strictEqual(track.style.transform, 'translate3d(-537px, 0, 0)');
  harness.gsap.toCalls[0].vars.onComplete();
  assert.strictEqual(track.style.transform, 'none');
  assert.strictEqual(scroller.scrollLeft, 537);
}());

(function jumpsFocusedStoryDoorsIntoViewWhenReducedMotionIsRequested() {
  var scroller = createScroller(1400, 2210, 0, {
    left: 90,
    right: 1490
  });
  var track = createDoorTrack(scroller);
  var door = createFocusableDoor(track, {
    left: 1685,
    right: 1955,
    width: 270,
    height: 390
  });
  var harness = loadAnimationsHarness(false, []);

  harness.animations.focusStorybookDoor(door, true);

  assert.strictEqual(harness.gsap.toCalls.length, 0);
  assert.strictEqual(track.style.transform, 'none');
  assert.strictEqual(scroller.scrollLeft, 537);
}());

(function keepsOverflowedStoryDoorsWithinOverscanBoundsAfterFocus() {
  var scroller = createScroller(1240, 2520, 0, {
    left: 120,
    right: 1360
  });
  var track = createDoorTrack(scroller);
  var doorRect = {
    left: 1828,
    right: 2098,
    width: 270,
    height: 390,
    top: 500,
    bottom: 890
  };
  var door = createFocusableDoor(track, doorRect);
  var harness = loadAnimationsHarness(false, []);
  var focusedRect;

  harness.animations.focusStorybookDoor(door, false);

  assert.strictEqual(harness.gsap.toCalls.length, 1);
  assert.strictEqual(harness.gsap.toCalls[0].vars.position, 810);
  harness.gsap.toCalls[0].vars.onComplete();
  assert.strictEqual(scroller.scrollLeft, 810);
  focusedRect = shiftDoorRect(doorRect, scroller.scrollLeft);
  assert(focusedRect.left >= 192, 'expected left within overscan, got ' + focusedRect.left);
  assert(focusedRect.right <= 1288, 'expected right within overscan, got ' + focusedRect.right);
}());
