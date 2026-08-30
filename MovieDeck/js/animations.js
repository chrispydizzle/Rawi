(function (global) {
  'use strict';

  var gsap = global.gsap;
  var scrollMotion = null;
  var scrollTween = null;

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
    animateSelection: animateSelection,
    animateShelves: animateShelves,
    enterScreen: enterScreen,
    focusCard: focusCard
  };
}(window));
