(function (global) {
  'use strict';

  var FOCUS_THROTTLE_MS = 90;
  var DEFINITIONS = {
    focus: { src: 'audio/storybook-focus.wav', volume: 0.10 },
    confirm: { src: 'audio/storybook-confirm.wav', volume: 0.16 },
    back: { src: 'audio/storybook-back.wav', volume: 0.12 },
    magic: { src: 'audio/storybook-magic.wav', volume: 0.18 }
  };
  var CUE_NAMES = ['focus', 'confirm', 'back', 'magic'];
  var audioByCue = {};
  var disabledByCue = {};
  var warnedByCue = {};
  var enabled = false;
  var activeCue = '';
  var activeToken = 0;
  var lastPlayToken = 0;
  var lastFocusAt = -FOCUS_THROTTLE_MS;
  var createAudio;
  var now;
  var warn;

  function warnOnce(cueName, message, error) {
    if (warnedByCue[cueName]) { return; }
    warnedByCue[cueName] = true;
    warn(message, error);
  }

  function clearActiveAttempt(token) {
    if (activeToken !== token) { return; }
    activeToken = 0;
    activeCue = '';
  }

  function disableCue(cueName, error) {
    disabledByCue[cueName] = true;
    warnOnce(cueName, 'Storybook sound "' + cueName + '" was disabled for this session.', error);
  }

  function reportFailure(cueName, error) {
    if (activeCue === cueName) {
      activeToken = 0;
      activeCue = '';
    }
    disableCue(cueName, error);
  }

  // AbortError is the expected rejection when a cue is paused or restarted, and
  // NotAllowedError only means this attempt lacked a gesture, so neither one
  // may disable the cue for the rest of the session.
  function isRetryablePlayError(error) {
    var errorName = error && error.name;
    return errorName === 'AbortError' || errorName === 'NotAllowedError';
  }

  function handlePlayRejection(cueName, token, error) {
    if (isRetryablePlayError(error)) {
      if (error.name === 'NotAllowedError') {
        warnOnce(cueName, 'Storybook sound "' + cueName + '" could not start without a user gesture.', error);
      }
      return;
    }
    clearActiveAttempt(token);
    disableCue(cueName, error);
  }

  function stopCue(cueName) {
    var audio = audioByCue[cueName];
    if (!audio) { return; }
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (error) {
      reportFailure(cueName, error);
    }
  }

  function stop() {
    var cueName;
    if (!activeToken) { return; }
    cueName = activeCue;
    activeToken = 0;
    activeCue = '';
    stopCue(cueName);
  }

  function init(options) {
    var settings = options || {};

    stop();
    createAudio = settings.createAudio || function (src) { return new global.Audio(src); };
    now = settings.now || function () { return Date.now(); };
    warn = settings.warn || function (message, error) {
      if (global.console && global.console.warn) {
        global.console.warn(message, error || '');
      }
    };
    audioByCue = {};
    disabledByCue = {};
    warnedByCue = {};
    enabled = false;
    activeCue = '';
    activeToken = 0;
    lastPlayToken = 0;
    lastFocusAt = -FOCUS_THROTTLE_MS;

    CUE_NAMES.forEach(function (cueName) {
      var definition = DEFINITIONS[cueName];
      var audio;
      try {
        audio = createAudio(definition.src);
        audio.preload = 'auto';
        audio.volume = definition.volume;
        if (audio.addEventListener) {
          audio.addEventListener('error', function (error) {
            reportFailure(cueName, error);
          });
        }
        audioByCue[cueName] = audio;
        if (audio.load) { audio.load(); }
      } catch (error) {
        reportFailure(cueName, error);
      }
    });
  }

  function setEnabled(nextEnabled) {
    enabled = nextEnabled === true;
    if (!enabled) { stop(); }
  }

  function play(cueName) {
    var audio = audioByCue[cueName];
    var playResult;
    var timestamp;
    var token;

    if (!enabled || !audio || disabledByCue[cueName]) { return false; }
    if (cueName === 'focus') {
      timestamp = now();
      if (timestamp - lastFocusAt < FOCUS_THROTTLE_MS) { return false; }
      lastFocusAt = timestamp;
    }

    stop();
    try {
      audio.currentTime = 0;
      playResult = audio.play();
      lastPlayToken += 1;
      token = lastPlayToken;
      activeToken = token;
      activeCue = cueName;
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(function (error) {
          handlePlayRejection(cueName, token, error);
        });
      }
      return true;
    } catch (error) {
      reportFailure(cueName, error);
      return false;
    }
  }

  global.RawiStorybookSound = {
    init: init,
    play: play,
    setEnabled: setEnabled,
    stop: stop
  };
}(window));
