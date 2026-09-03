'use strict';

var assert = global.RawiTest.assert;
var load = global.RawiTest.loadBrowserScript;
var registerAsync = global.RawiTest.registerAsync;

function domError(name, message) {
  var error = new Error(message || name);
  error.name = name;
  return error;
}

function flushMicrotasks(times) {
  var count = times || 6;
  var promise = Promise.resolve();
  while (count > 0) {
    promise = promise.then(function () { return Promise.resolve(); });
    count -= 1;
  }
  return promise;
}

function cueNameFromSrc(src) {
  return String(src).replace('audio/storybook-', '').replace('.wav', '');
}

// Audio doubles whose pending play() promises are resolved or rejected by the
// test, so a stale attempt can outlive the attempt that replaced it.
function manualAudioFactory() {
  var factory = {
    byCue: {},
    pending: []
  };

  factory.create = function (src) {
    var audio = {
      src: src,
      preload: '',
      volume: 1,
      currentTime: 0,
      paused: true,
      pauseCalls: 0,
      playCalls: 0,
      addEventListener: function () {},
      load: function () {},
      pause: function () {
        this.pauseCalls += 1;
        this.paused = true;
      },
      play: function () {
        var entry = {};
        this.playCalls += 1;
        this.paused = false;
        entry.promise = new Promise(function (resolve, reject) {
          entry.resolve = resolve;
          entry.reject = reject;
        });
        factory.pending.push(entry);
        return entry.promise;
      }
    };
    factory.byCue[cueNameFromSrc(src)] = audio;
    return audio;
  };

  return factory;
}

function loadSound(options) {
  var settings = options || {};
  var created = [];
  var warnings = [];
  var warnedErrors = [];
  var nowMs = 1000;

  function FakeAudio(src) {
    this.src = src;
    this.preload = '';
    this.volume = 1;
    this.currentTime = 0;
    this.paused = true;
    this.pauseCalls = 0;
    this.playCalls = 0;
    this.pending = [];
    this.listeners = {};
  }

  FakeAudio.prototype.addEventListener = function (name, callback) {
    this.listeners[name] = callback;
  };
  FakeAudio.prototype.load = function () {};
  FakeAudio.prototype.play = function () {
    var entry = {};
    this.playCalls += 1;
    this.paused = false;
    entry.promise = new Promise(function (resolve, reject) {
      entry.resolve = resolve;
      entry.reject = reject;
    });
    this.pending.push(entry);
    return entry.promise;
  };
  // A real element rejects every outstanding play() promise with AbortError
  // when it is paused, which is exactly what a cue restart triggers.
  FakeAudio.prototype.pause = function () {
    this.pauseCalls += 1;
    this.paused = true;
    this.rejectPending(domError('AbortError', 'The play() request was interrupted by a call to pause().'));
  };
  FakeAudio.prototype.rejectPending = function (error) {
    var outstanding = this.pending;
    this.pending = [];
    outstanding.forEach(function (entry) { entry.reject(error); });
  };
  FakeAudio.prototype.resolvePending = function () {
    var outstanding = this.pending;
    this.pending = [];
    outstanding.forEach(function (entry) { entry.resolve(); });
  };

  function createAudio(src) {
    var audio = settings.createAudio ? settings.createAudio(src) : new FakeAudio(src);
    created.push(audio);
    return audio;
  }

  function initOptions() {
    return {
      createAudio: createAudio,
      now: function () { return nowMs; },
      warn: function (message, error) {
        warnings.push(message);
        warnedErrors.push(error);
      }
    };
  }

  var window = load('js/storybook-sound.js', { window: {} });
  window.RawiStorybookSound.init(initOptions());

  return {
    api: window.RawiStorybookSound,
    advance: function (ms) { nowMs += ms; },
    created: created,
    reinit: function () { window.RawiStorybookSound.init(initOptions()); },
    warnedErrors: warnedErrors,
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

registerAsync('rapid same-cue restart keeps the newer attempt active and stoppable', function () {
  var harness = loadSound();
  var magic;

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('magic'), true);
  assert.strictEqual(harness.api.play('magic'), true);

  magic = harness.created[3];
  assert.strictEqual(magic.playCalls, 2);
  assert.strictEqual(magic.pauseCalls, 1);

  return flushMicrotasks().then(function () {
    assert.deepStrictEqual(harness.warnings, []);

    magic.currentTime = 3;
    harness.api.stop();
    assert.strictEqual(magic.pauseCalls, 2);
    assert.strictEqual(magic.currentTime, 0);
    assert.strictEqual(magic.paused, true);
    assert.strictEqual(harness.api.play('magic'), true);
  });
});

registerAsync('a NotAllowedError warns once and leaves the cue retryable', function () {
  var harness = loadSound();
  var magic;

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('magic'), true);
  magic = harness.created[3];
  magic.rejectPending(domError('NotAllowedError', 'play() needs a user gesture'));

  return flushMicrotasks().then(function () {
    assert.strictEqual(harness.warnings.length, 1);
    assert.strictEqual(harness.api.play('magic'), true);
    assert.strictEqual(magic.playCalls, 2);
    magic.resolvePending();
    return flushMicrotasks();
  }).then(function () {
    assert.strictEqual(harness.warnings.length, 1);
    assert.strictEqual(harness.api.play('magic'), true);
    assert.strictEqual(magic.playCalls, 3);
  });
});

registerAsync('a fatal rejected play warns once and disables only that cue', function () {
  var harness = loadSound();
  var back;

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('magic'), true);
  harness.created[3].rejectPending(domError('NotSupportedError', 'unsupported source'));

  return flushMicrotasks().then(function () {
    assert.strictEqual(harness.warnings.length, 1);
    assert.strictEqual(harness.api.play('magic'), false);
    assert.strictEqual(harness.api.play('confirm'), true);
    assert.strictEqual(harness.api.play('back'), true);

    back = harness.created[2];
    back.rejectPending(new Error('blocked'));
    return flushMicrotasks();
  }).then(function () {
    assert.strictEqual(harness.warnings.length, 2);
    assert.strictEqual(harness.api.play('back'), false);
    assert.strictEqual(harness.api.play('confirm'), true);
    assert.strictEqual(harness.api.play('focus'), true);
  });
});

registerAsync('a stale fatal rejection never clears the newer active attempt', function () {
  var factory = manualAudioFactory();
  var harness = loadSound({ createAudio: factory.create });
  var magic = null;

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('magic'), true);
  assert.strictEqual(harness.api.play('magic'), true);

  magic = factory.byCue.magic;
  factory.pending[0].reject(domError('NotSupportedError', 'stale fatal rejection'));

  return flushMicrotasks().then(function () {
    magic.currentTime = 4;
    harness.api.stop();
    assert.strictEqual(magic.pauseCalls, 2);
    assert.strictEqual(magic.currentTime, 0);
    assert.strictEqual(harness.warnings.length, 1);

    factory.pending[1].reject(domError('AbortError', 'interrupted by stop()'));
    return flushMicrotasks();
  }).then(function () {
    assert.strictEqual(harness.warnings.length, 1);
    assert.strictEqual(harness.api.play('confirm'), true);
  });
});

registerAsync('a stale retryable rejection never clears or disables the newer attempt', function () {
  var factory = manualAudioFactory();
  var harness = loadSound({ createAudio: factory.create });
  var magic = null;

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('magic'), true);
  assert.strictEqual(harness.api.play('magic'), true);

  magic = factory.byCue.magic;
  factory.pending[0].reject(domError('AbortError', 'interrupted by a restart'));

  return flushMicrotasks().then(function () {
    assert.deepStrictEqual(harness.warnings, []);

    magic.currentTime = 6;
    harness.api.stop();
    assert.strictEqual(magic.pauseCalls, 2);
    assert.strictEqual(magic.currentTime, 0);
    assert.strictEqual(harness.api.play('magic'), true);
    assert.strictEqual(magic.playCalls, 3);
  });
});

(function reinitStopsTheActiveCueAndResetsDisabledWarnAndThrottleState() {
  var harness = loadSound({
    createAudio: function (src) {
      return {
        src: src,
        preload: '',
        volume: 1,
        currentTime: 0,
        paused: true,
        pauseCalls: 0,
        playCalls: 0,
        addEventListener: function () {},
        load: function () {},
        pause: function () {
          this.pauseCalls += 1;
          this.paused = true;
        },
        play: function () {
          if (src.indexOf('magic') !== -1) { throw new Error('decode failed'); }
          this.playCalls += 1;
          this.paused = false;
          return null;
        }
      };
    }
  });
  var firstFocus;

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('magic'), false);
  assert.strictEqual(harness.api.play('magic'), false);
  assert.strictEqual(harness.warnings.length, 1);
  assert.strictEqual(harness.api.play('focus'), true);
  assert.strictEqual(harness.api.play('focus'), false);

  firstFocus = harness.created[0];
  firstFocus.currentTime = 5;
  harness.reinit();

  assert.strictEqual(firstFocus.pauseCalls, 1);
  assert.strictEqual(firstFocus.currentTime, 0);
  assert.strictEqual(harness.created.length, 8);

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('focus'), true);
  assert.strictEqual(harness.created[4].playCalls, 1);
  assert.strictEqual(harness.api.play('magic'), false);
  assert.strictEqual(harness.warnings.length, 2);
}());

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

(function mediaErrorEventsDisableOnlyTheAffectedCue() {
  var harness = loadSound();

  harness.api.setEnabled(true);
  harness.created[3].listeners.error(domError('MediaError', 'asset missing'));
  assert.strictEqual(harness.warnings.length, 1);
  assert.strictEqual(harness.api.play('magic'), false);
  assert.strictEqual(harness.api.play('confirm'), true);
  assert.strictEqual(harness.warnings.length, 1);
}());

(function aMediaErrorOnTheActiveCueClearsTheActiveAttempt() {
  var harness = loadSound();

  harness.api.setEnabled(true);
  assert.strictEqual(harness.api.play('back'), true);
  harness.created[2].listeners.error(domError('MediaError', 'decode failed'));
  assert.strictEqual(harness.warnings.length, 1);
  assert.strictEqual(harness.api.play('back'), false);

  harness.api.stop();
  assert.strictEqual(harness.created[2].pauseCalls, 0);
  assert.strictEqual(harness.api.play('confirm'), true);
  assert.strictEqual(harness.warnings.length, 1);
}());
