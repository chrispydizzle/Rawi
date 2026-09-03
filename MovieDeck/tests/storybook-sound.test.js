'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var registerAsync = global.RawiTest.registerAsync;

function loadSound(options) {
  var created = [];
  var warnings = [];
  var nowMs = 1000;

  function FakeAudio(src) {
    this.src = src;
    this.preload = '';
    this.volume = 1;
    this.currentTime = 0;
    this.pauseCalls = 0;
    this.playCalls = 0;
    this.listeners = {};
    created.push(this);
  }

  FakeAudio.prototype.addEventListener = function (name, callback) {
    this.listeners[name] = callback;
  };
  FakeAudio.prototype.load = function () {};
  FakeAudio.prototype.pause = function () {
    this.pauseCalls += 1;
  };
  FakeAudio.prototype.play = function () {
    this.playCalls += 1;
    return Promise.resolve();
  };

  var window = load('js/storybook-sound.js', { window: {} });
  window.RawiStorybookSound.init({
    createAudio: (options && options.createAudio) || function (src) { return new FakeAudio(src); },
    now: function () { return nowMs; },
    warn: function (message) { warnings.push(message); }
  });

  return {
    api: window.RawiStorybookSound,
    advance: function (ms) { nowMs += ms; },
    created: created,
    warnings: warnings
  };
}

(function preloadsEveryCueWithFixedVolume() {
  var harness = loadSound();
  assert.deepStrictEqual(harness.created.map(function (audio) { return audio.src; }), [
    'audio/storybook-focus.wav',
    'audio/storybook-confirm.wav',
    'audio/storybook-back.wav',
    'audio/storybook-magic.wav'
  ]);
  assert.deepStrictEqual(harness.created.map(function (audio) { return audio.volume; }), [
    0.10, 0.16, 0.12, 0.18
  ]);
  assert.deepStrictEqual(harness.created.map(function (audio) { return audio.preload; }), [
    'auto', 'auto', 'auto', 'auto'
  ]);
}());

(function playsOneCueAtATimeAndStopsWhenDisabled() {
  var harness = loadSound();
  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('confirm'), true);
  assert.strictEqual(harness.created[1].playCalls, 1);
  assert.strictEqual(harness.api.play('back'), true);
  assert.strictEqual(harness.created[1].pauseCalls, 1);
  assert.strictEqual(harness.created[2].playCalls, 1);
  harness.created[2].currentTime = 2;
  harness.api.setEnabled(false);
  assert.strictEqual(harness.created[2].pauseCalls, 1);
  assert.strictEqual(harness.created[2].currentTime, 0);
  assert.strictEqual(harness.api.play('magic'), false);
}());

(function throttlesRapidFocusButAllowsLaterFocus() {
  var harness = loadSound();
  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('focus'), true);
  harness.advance(50);
  assert.strictEqual(harness.api.play('focus'), false);
  harness.advance(40);
  assert.strictEqual(harness.api.play('focus'), true);
  assert.strictEqual(harness.created[0].playCalls, 2);
}());

registerAsync('rejected play warns once and disables only that cue', function () {
  var rejectingAudio;
  var harness = loadSound({
    createAudio: function (src) {
      var audio = {
        src: src,
        preload: '',
        volume: 1,
        currentTime: 0,
        addEventListener: function () {},
        load: function () {},
        pause: function () {},
        play: function () {
          if (src.indexOf('magic') !== -1) {
            return Promise.reject(new Error('blocked'));
          }
          return Promise.resolve();
        }
      };
      if (src.indexOf('magic') !== -1) { rejectingAudio = audio; }
      return audio;
    }
  });

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('magic'), true);
  return Promise.resolve().then(function () {
    assert.strictEqual(harness.warnings.length, 1);
    assert.strictEqual(harness.api.play('magic'), false);
    assert.strictEqual(harness.api.play('confirm'), true);
    assert(rejectingAudio);
  });
});

(function unavailableAudioWarnsOncePerCueAndKeepsTheModuleSafe() {
  var harness = loadSound({
    createAudio: function () {
      throw new Error('Audio unavailable');
    }
  });

  harness.api.setEnabled(true);
  assert.strictEqual(harness.warnings.length, 4);
  assert.strictEqual(harness.api.play('focus'), false);
  assert.strictEqual(harness.api.play('confirm'), false);
  assert.strictEqual(harness.warnings.length, 4);
}());

(function synchronousPlayFailureDisablesOnlyTheFailingCue() {
  var harness = loadSound({
    createAudio: function (src) {
      return {
        src: src,
        preload: '',
        volume: 1,
        currentTime: 0,
        addEventListener: function () {},
        load: function () {},
        pause: function () {},
        play: function () {
          if (src.indexOf('confirm') !== -1) {
            throw new Error('decode failed');
          }
          return Promise.resolve();
        }
      };
    }
  });

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('confirm'), false);
  assert.strictEqual(harness.api.play('confirm'), false);
  assert.strictEqual(harness.warnings.length, 1);
  assert.strictEqual(harness.api.play('magic'), true);
}());

(function pauseFailureDisablesTheOldCueWithoutBlockingTheNewCue() {
  var harness = loadSound({
    createAudio: function (src) {
      return {
        src: src,
        preload: '',
        volume: 1,
        currentTime: 0,
        addEventListener: function () {},
        load: function () {},
        pause: function () {
          if (src.indexOf('back') !== -1) {
            throw new Error('pause failed');
          }
        },
        play: function () { return Promise.resolve(); }
      };
    }
  });

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('back'), true);
  assert.strictEqual(harness.api.play('magic'), true);
  assert.strictEqual(harness.warnings.length, 1);
  assert.strictEqual(harness.api.play('back'), false);
}());
