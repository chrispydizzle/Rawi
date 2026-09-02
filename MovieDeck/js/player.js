(function (global) {
  'use strict';

  var api = global.MovieDeckApi;
  var copy = global.RawiCopy;
  var value = global.MovieDeckValue;
  var avplay = global.webapis && global.webapis.avplay;
  var htmlPlayer;
  var current = null;
  var positionMs = 0;
  var durationMs = 0;
  var progressTimer = null;
  var controlsTimer = null;
  var lastReport = 0;
  var callbacks = {};

  function ticks(ms) { return Math.floor(ms * 10000); }
  function setText(id, text) { document.getElementById(id).textContent = text; }
  function formatTime(ms) {
    var seconds = Math.max(0, Math.floor(ms / 1000));
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    seconds %= 60;
    minutes %= 60;
    return hours ? hours + ':' + ('0' + minutes).slice(-2) + ':' + ('0' + seconds).slice(-2) : minutes + ':' + ('0' + seconds).slice(-2);
  }

  function updateControls() {
    setText('player-position', formatTime(positionMs));
    setText('player-duration', formatTime(durationMs));
    document.getElementById('player-progress').style.width = durationMs ? Math.min(100, positionMs / durationMs * 100) + '%' : '0';
  }

  function showControls(state) {
    var controls = document.getElementById('player-controls');
    controls.classList.add('is-visible');
    if (state) { setText('player-state', state); }
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(function () { controls.classList.remove('is-visible'); }, 4500);
  }

  function report(endpoint, paused) {
    if (!current) { return; }
    var sourceId = value(current.stream.source, 'Id', 'id');
    api.report(endpoint, {
      ItemId: value(current.item, 'Id', 'id'),
      MediaSourceId: sourceId,
      PlaySessionId: current.stream.playSessionId,
      PositionTicks: ticks(positionMs),
      IsPaused: !!paused,
      CanSeek: true,
      PlayMethod: value(current.stream.source, 'SupportsDirectPlay', 'supportsDirectPlay') ? 'DirectPlay' : 'Transcode'
    });
  }

  function onTime(ms) {
    positionMs = ms;
    updateControls();
    if (Date.now() - lastReport > 10000) {
      lastReport = Date.now();
      report('/Progress', false);
    }
  }

  function fail(error) {
    setText('player-message', error && error.message ? error.message : String(error));
    showControls(copy.get('playbackError'));
    if (callbacks.onError) { callbacks.onError(error); }
  }

  function prepareAvPlay(startMs) {
    avplay.open(current.stream.url);
    avplay.setDisplayRect(0, 0, 1920, 1080);
    avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
    try { avplay.setStreamingProperty('SET_MODE_4K', 'TRUE'); } catch (ignored) { /* Older firmware may choose the decoder automatically. */ }
    avplay.setListener({
      onbufferingstart: function () { setText('player-message', copy.get('buffering')); },
      onbufferingcomplete: function () { setText('player-message', ''); },
      oncurrentplaytime: onTime,
      onstreamcompleted: function () { stop(true); },
      onerror: function (eventType) { fail(new Error(copy.get('samsungPlayerError', { error: eventType }))); },
      onevent: function () { },
      onsubtitlechange: function () { },
      ondrmevent: function () { }
    });
    avplay.prepareAsync(function () {
      durationMs = avplay.getDuration() || value(current.item, 'RunTimeTicks', 'runTimeTicks') / 10000 || 0;
      if (startMs > 0 && value(current.stream.source, 'SupportsDirectPlay', 'supportsDirectPlay')) {
        try { avplay.seekTo(startMs); } catch (ignored) { /* Some direct-play formats reject an initial seek. */ }
      }
      avplay.play();
      setText('player-message', '');
      report('', false);
      showControls(copy.get('playing'));
    }, fail);
  }

  function prepareHtmlVideo(startMs) {
    htmlPlayer.style.display = 'block';
    htmlPlayer.src = current.stream.url;
    htmlPlayer.onloadedmetadata = function () {
      durationMs = htmlPlayer.duration * 1000 || 0;
      if (startMs > 0) { htmlPlayer.currentTime = startMs / 1000; }
      htmlPlayer.play();
      setText('player-message', '');
      report('', false);
      showControls(copy.get('playing'));
    };
    htmlPlayer.ontimeupdate = function () { onTime(htmlPlayer.currentTime * 1000); };
    htmlPlayer.onended = function () { stop(true); };
    htmlPlayer.onerror = function () { fail(new Error(copy.get('browserPlaybackError'))); };
  }

  function play(item, fromBeginning) {
    var userData = value(item, 'UserData', 'userData') || {};
    var resumeTicks = fromBeginning ? 0 : (value(userData, 'PlaybackPositionTicks', 'playbackPositionTicks') || 0);
    positionMs = resumeTicks / 10000;
    durationMs = value(item, 'RunTimeTicks', 'runTimeTicks') / 10000 || 0;
    setText('player-title', value(item, 'Name', 'name'));
    setText('player-message', copy.get('playerPreparing'));
    updateControls();

    return api.getPlaybackInfo(item, resumeTicks).then(function (playbackInfo) {
      current = { item: item, stream: api.streamUrl(item, playbackInfo) };
      if (avplay) { prepareAvPlay(positionMs); } else { prepareHtmlVideo(positionMs); }
    }).catch(fail);
  }

  function isPlaying() {
    return !!current;
  }

  function pause() {
    if (!current) { return; }
    if (avplay && avplay.getState() === 'PLAYING') { avplay.pause(); }
    else if (!avplay && !htmlPlayer.paused) { htmlPlayer.pause(); }
    else { return; }
    report('/Progress', true);
    showControls(copy.get('paused'));
  }

  function resume() {
    if (!current) { return; }
    if (avplay && avplay.getState() === 'PAUSED') { avplay.play(); }
    else if (!avplay && htmlPlayer.paused) { htmlPlayer.play(); }
    else { return; }
    report('/Progress', false);
    showControls(copy.get('playing'));
  }

  function togglePause() {
    if (!current) { return; }
    var isPaused = avplay ? avplay.getState() === 'PAUSED' : htmlPlayer.paused;
    if (isPaused) { resume(); } else { pause(); }
  }

  function seek(deltaMs) {
    if (!current) { return; }
    var target = Math.max(0, Math.min(durationMs - 1000, positionMs + deltaMs));
    if (avplay) { avplay.seekTo(target); }
    else { htmlPlayer.currentTime = target / 1000; }
    positionMs = target;
    updateControls();
    showControls(copy.get(deltaMs < 0 ? 'seekBack' : 'seekForward'));
  }

  function stop(completed) {
    if (!current) { return; }
    clearInterval(progressTimer);
    report('/Stopped', false);
    if (avplay) {
      try {
        var state = avplay.getState();
        if (state !== 'NONE' && state !== 'IDLE') { avplay.stop(); }
        if (avplay.getState() !== 'NONE') { avplay.close(); }
      } catch (ignored) { /* The player may already be closed after completion. */ }
    } else {
      htmlPlayer.pause();
      htmlPlayer.removeAttribute('src');
      htmlPlayer.load();
      htmlPlayer.style.display = 'none';
    }
    current = null;
    if (callbacks.onStop) { callbacks.onStop(!!completed); }
  }

  function handleKey(code) {
    if (!current) { return false; }
    if (code === 13 || code === 10252) { togglePause(); return true; }
    if (code === 19) { pause(); return true; }
    if (code === 415) { resume(); return true; }
    if (code === 37 || code === 412) { seek(-30000); return true; }
    if (code === 39 || code === 417) { seek(30000); return true; }
    if (code === 10009 || code === 8 || code === 413) { stop(false); return true; }
    showControls();
    return true;
  }

  function init(options) {
    callbacks = options || {};
    htmlPlayer = document.getElementById('html-player');
    if (global.tizen && global.tizen.tvinputdevice) {
      ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward'].forEach(function (key) {
        try { global.tizen.tvinputdevice.registerKey(key); } catch (ignored) { /* Not available in browser preview. */ }
      });
    }
  }

  global.MovieDeckPlayer = { init: init, play: play, stop: stop, handleKey: handleKey, isPlaying: isPlaying };
}(window));
