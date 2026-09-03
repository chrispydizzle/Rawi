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
  var lastFocusAt = -FOCUS_THROTTLE_MS;
  var createAudio;
  var now;
  var warn;

  function reportFailure(cueName, error) {
    disabledByCue[cueName] = true;
    if (activeCue === cueName) { activeCue = ''; }
    if (warnedByCue[cueName]) { return; }
    warnedByCue[cueName] = true;
    warn('Storybook sound "' + cueName + '" was disabled for this session.', error);
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
    if (!activeCue) { return; }
    stopCue(activeCue);
    activeCue = '';
  }

  function init(options) {
    var settings = options || {};
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
      activeCue = cueName;
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(function (error) {
          reportFailure(cueName, error);
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
