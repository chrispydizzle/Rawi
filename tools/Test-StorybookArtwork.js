/* Run through agent-browser eval -b (base64) on the local Storybook preview.
 * Exercises the real renderer and stylesheet; reload the preview afterward.
 */
(async function () {
  'use strict';

  if (new URL(location.href).searchParams.get('preview') !== 'storybook') {
    throw new Error('Open the local ?preview=storybook route first.');
  }

  await Promise.all(Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(function (link) {
    return new Promise(function (resolve, reject) {
      var url = new URL(link.href);
      var timeout = setTimeout(function () { reject(new Error('Stylesheet refresh timed out')); }, 5000);
      link.onload = function () { clearTimeout(timeout); resolve(); };
      link.onerror = function () { clearTimeout(timeout); reject(new Error('Stylesheet refresh failed')); };
      url.searchParams.set('artwork-check', Date.now());
      link.href = url.href;
    });
  }));

  var view = window.RawiStorybookView;
  var results = [];
  var failures = [];
  var surfaces = [
    { name: 'resume', screen: 'storybook-screen', prefix: 'storybook-resume-card', width: 420, height: 280 },
    { name: 'menu', screen: 'storybook-screen', prefix: 'storybook-menu-card', width: 320, height: 200 },
    { name: 'favorite', screen: 'storybook-screen', prefix: 'storybook-favorite-card', width: 320, height: 200 },
    { name: 'library/category', screen: 'storybook-library-screen', prefix: 'storybook-library-card', width: 260, height: 260 },
    { name: 'details', screen: 'storybook-details-screen', prefix: 'storybook-details-artwork', width: 540, height: 760 },
    { name: 'magic', screen: 'storybook-magic-pick-screen', prefix: 'storybook-details-artwork', width: 540, height: 760 }
  ];
  var shapes = [
    { name: 'portrait', width: 800, height: 1200 },
    { name: 'square', width: 1000, height: 1000 },
    { name: 'landscape', width: 1600, height: 900 },
    { name: 'small', width: 80, height: 60 }
  ];

  function near(a, b) { return Math.abs(a - b) < 1; }

  function model(url) {
    return {
      id: 'artwork-check', title: 'Artwork proportions', artworkUrl: url,
      accentClass: 'storybook-accent-periwinkle', minutesLabel: '12 min',
      progressPercent: 20, resumeLabel: 'Resume', primaryActionLabel: 'Start story',
      secondaryActionLabel: 'Pick again', overview: 'Full artwork without distortion.',
      reason: 'Artwork regression', showRestart: true
    };
  }

  function render(surface, card) {
    document.querySelectorAll('.screen').forEach(function (screen) {
      screen.classList.toggle('is-active', screen.id === surface.screen);
    });
    if (surface.screen === 'storybook-screen') {
      view.renderHome({
        resume: card, littleMenu: [card], favorites: [card], libraries: [],
        categories: [], reducedMotion: true
      });
    } else if (surface.screen === 'storybook-library-screen') {
      view.renderLibrary({ title: 'Artwork', libraryId: 'artwork', cards: [card] });
    } else if (surface.name === 'details') {
      view.renderDetails(card);
    } else {
      view.renderMagicPick(card);
    }
    return document.getElementById(surface.screen);
  }

  function loaded(image) {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () {
        reject(new Error('Artwork load timed out'));
      }, 5000);
      function finish() { clearTimeout(timeout); resolve(); }
      if (image.complete) { finish(); return; }
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
    });
  }

  for (var surface of surfaces) {
    for (var shape of shapes) {
      var canvas = document.createElement('canvas');
      canvas.width = shape.width;
      canvas.height = shape.height;
      var context = canvas.getContext('2d');
      context.fillStyle = '#657db9';
      context.fillRect(0, 0, shape.width, shape.height);
      context.fillStyle = '#f2cf7c';
      context.beginPath();
      context.arc(shape.width / 2, shape.height / 2, Math.min(shape.width, shape.height) / 5, 0, 2 * Math.PI);
      context.fill();
      var screen = render(surface, model(canvas.toDataURL()));
      var image = screen.querySelector('.' + surface.prefix + '-image');
      await loaded(image);
      var frame = image.parentNode.getBoundingClientRect();
      var rect = image.getBoundingClientRect();
      var fit = getComputedStyle(image).objectFit;
      var fullImage = Math.abs(rect.width / rect.height - shape.width / shape.height) < 0.002 ||
        fit === 'contain';
      var contained = rect.width > 0 && rect.height > 0 &&
        rect.left >= frame.left - 1 && rect.right <= frame.right + 1 &&
        rect.top >= frame.top - 1 && rect.bottom <= frame.bottom + 1;
      var centered = near(rect.left + rect.width / 2, frame.left + frame.width / 2) &&
        near(rect.top + rect.height / 2, frame.top + frame.height / 2);
      var stableFrame = near(frame.width, surface.width) && near(frame.height, surface.height);
      var result = {
        surface: surface.name, shape: shape.name,
        natural: [image.naturalWidth, image.naturalHeight],
        rendered: [rect.width, rect.height], frame: [frame.width, frame.height],
        fullImage: fullImage, contained: contained, centered: centered, stableFrame: stableFrame
      };
      results.push(result);
      if (!image.naturalWidth || !fullImage || !contained || !centered || !stableFrame) {
        failures.push(result);
      }
    }

    for (var url of ['', 'data:image/png;base64,broken']) {
      var fallbackScreen = render(surface, model(url));
      var broken = fallbackScreen.querySelector('.' + surface.prefix + '-image');
      if (broken) { await loaded(broken); }
      var fallback = fallbackScreen.querySelector('.' + surface.prefix + '-fallback');
      if (!fallback || fallback.textContent !== 'Artwork proportions' ||
          getComputedStyle(fallback).display === 'none' ||
          (broken && getComputedStyle(broken).display !== 'none')) {
        failures.push({ surface: surface.name, fallback: url || 'missing' });
      }
    }
  }
  if (failures.length) {
    throw new Error(JSON.stringify({ failures: failures }));
  }
  return { passed: results.length, fallbacks: surfaces.length * 2, measurements: results };
}());
