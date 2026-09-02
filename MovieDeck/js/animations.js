(function (global) {
  'use strict';

  var gsap = global.gsap;
  var doorFocusMotion = null;
  var doorFocusTween = null;
  var scrollMotion = null;
  var scrollTween = null;
  var storybookDoors = [];

  if (!gsap) {
    throw new Error('GSAP must be loaded before animations.js.');
  }

  function prefersReducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function enterScreen(screen) {
    if (prefersReducedMotion()) { return; }
    gsap.killTweensOf(screen);
    gsap.fromTo(screen, {
      autoAlpha: 0
    }, {
      autoAlpha: 1,
      clearProps: 'opacity,visibility',
      duration: 0.28,
      ease: 'power2.out',
      overwrite: true
    });
  }

  function animateSelection() {
    var targets = ['#hero-title', '#hero-meta', '#hero-overview', '#hero-number'];
    if (prefersReducedMotion()) { return; }
    gsap.killTweensOf(targets);
    gsap.fromTo(targets, {
      autoAlpha: 0.35,
      y: 8
    }, {
      autoAlpha: 1,
      clearProps: 'opacity,visibility,transform',
      duration: 0.22,
      ease: 'power2.out',
      overwrite: true,
      stagger: 0.02,
      y: 0
    });
  }

  function animateShelves() {
    var shelves = document.querySelectorAll('#shelves .shelf');
    if (prefersReducedMotion() || !shelves.length) { return; }
    gsap.fromTo(shelves, {
      autoAlpha: 0,
      y: 24
    }, {
      autoAlpha: 1,
      clearProps: 'opacity,visibility,transform',
      duration: 0.45,
      ease: 'power2.out',
      stagger: 0.06,
      y: 0
    });
  }

  function resetStorybookDoors() {
    if (!storybookDoors.length) { return; }
    gsap.killTweensOf(storybookDoors);
    gsap.set(storybookDoors, {
      clearProps: 'opacity,visibility,transform'
    });
    storybookDoors = [];
  }

  function animateStorybookHome(forceReducedMotion) {
    var entranceDuration = 0.45;
    var entranceStagger = 0.08;
    var animatedDoors;
    var doors = document.querySelectorAll('#storybook-doors .storybook-door');

    resetStorybookDoors();
    if (!doors.length) { return; }
    storybookDoors = Array.prototype.slice.call(doors);
    animatedDoors = storybookDoors;
    gsap.set(storybookDoors, {
      clearProps: 'opacity,visibility,transform'
    });
    if (forceReducedMotion || prefersReducedMotion()) {
      return;
    }
    gsap.fromTo(storybookDoors, {
      autoAlpha: 0,
      y: 28
    }, {
      autoAlpha: 1,
      clearProps: 'opacity,visibility',
      duration: 0.45,
      ease: 'back.out(1.05)',
      onComplete: function () {
        if (storybookDoors !== animatedDoors) { return; }
        animatedDoors.slice(0, 3).forEach(function (door, index) {
          gsap.to(door, {
            delay: 0.05 + entranceStagger * index,
            duration: 4.2 + index * 0.35,
            ease: 'sine.inOut',
            overwrite: true,
            repeat: -1,
            y: index % 2 ? 7 : -7,
            yoyo: true
          });
        });
      },
      overwrite: true,
      stagger: 0.08,
      y: 0
    });
  }

  function stopStorybookHome() {
    settleDoorFocus();
    resetStorybookDoors();
  }

  function completeDoorFocus(motion) {
    if (doorFocusMotion !== motion) { return; }
    motion.track.style.transform = 'none';
    motion.scroller.scrollLeft = motion.position;
    doorFocusMotion = null;
    doorFocusTween = null;
  }

  function settleDoorFocus() {
    var motion = doorFocusMotion;
    if (!motion) { return; }
    if (doorFocusTween) { doorFocusTween.kill(); }
    completeDoorFocus(motion);
  }

  function focusStorybookDoor(door, forceReducedMotion) {
    var track;
    var scroller;
    var viewportRect;
    var doorRect;
    var maximum;
    var start;
    var target;
    var margin = 72;
    var motion;

    if (!door || !door.parentNode || !door.parentNode.parentNode) { return; }
    track = door.parentNode;
    scroller = track.parentNode;
    if (!scroller.getBoundingClientRect || !door.getBoundingClientRect) { return; }

    settleDoorFocus();
    viewportRect = scroller.getBoundingClientRect();
    doorRect = door.getBoundingClientRect();
    maximum = Math.max(0, (scroller.scrollWidth || 0) - (scroller.clientWidth || 0));
    start = scroller.scrollLeft || 0;
    target = start;

    if (doorRect.left < viewportRect.left + margin) {
      target += doorRect.left - viewportRect.left - margin;
    } else if (doorRect.right > viewportRect.right - margin) {
      target += doorRect.right - viewportRect.right + margin;
    }

    if (target < 0) { target = 0; }
    if (target > maximum) { target = maximum; }

    if (target === start) {
      track.style.transform = 'none';
      return;
    }

    if (forceReducedMotion || prefersReducedMotion()) {
      track.style.transform = 'none';
      scroller.scrollLeft = target;
      return;
    }

    motion = {
      position: start,
      scroller: scroller,
      start: start,
      track: track
    };
    doorFocusMotion = motion;
    doorFocusTween = gsap.to(motion, {
      duration: 0.34,
      ease: 'back.out(1.05)',
      onComplete: function () { completeDoorFocus(motion); },
      onUpdate: function () {
        motion.track.style.transform = 'translate3d(' + (motion.start - motion.position) + 'px, 0, 0)';
      },
      overwrite: true,
      position: target
    });
  }

  function completeScroll(motion) {
    if (scrollMotion !== motion) { return; }
    motion.content.style.transform = 'none';
    motion.scroller.scrollTop = motion.position;
    scrollMotion = null;
    scrollTween = null;
  }

  function settleScroll() {
    var motion = scrollMotion;
    if (!motion) { return; }
    if (scrollTween) { scrollTween.kill(); }
    completeScroll(motion);
  }

  function focusCard(card) {
    var scroller;
    var content;
    var rect;
    var maximum;
    var start;
    var target;
    var motion;

    settleScroll();
    scroller = document.getElementById('browse-screen');
    content = document.getElementById('browse-content');
    rect = card.getBoundingClientRect();
    maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    start = scroller.scrollTop;
    target = Math.max(0, Math.min(maximum, start + rect.top - 470));

    card.focus();
    scroller.scrollTop = start;

    if (prefersReducedMotion()) {
      scroller.scrollTop = target;
      return;
    }

    motion = {
      content: content,
      position: start,
      scroller: scroller,
      start: start
    };
    scrollMotion = motion;
    scrollTween = gsap.to(motion, {
      duration: 0.36,
      ease: 'back.out(1.05)',
      onComplete: function () { completeScroll(motion); },
      onUpdate: function () {
        motion.content.style.transform = 'translate3d(0, ' + (motion.start - motion.position) + 'px, 0)';
      },
      overwrite: true,
      position: target
    });
  }

  global.MovieDeckAnimations = {
    animateStorybookHome: animateStorybookHome,
    animateSelection: animateSelection,
    animateShelves: animateShelves,
    enterScreen: enterScreen,
    focusStorybookDoor: focusStorybookDoor,
    focusCard: focusCard,
    stopStorybookHome: stopStorybookHome
  };
}(window));
