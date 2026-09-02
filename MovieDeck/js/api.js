(function (global) {
  'use strict';

  var CLIENT_NAME = 'Rawi';
  var CLIENT_VERSION = '0.1.12';
  var copy = global.RawiCopy;
  var storage = global.RawiStorage;
  var STORAGE_KEY = 'moviedeck.session';
  var DEVICE_ID_KEY = 'moviedeck.deviceId';

  function value(object, pascal, camel) {
    if (!object) { return undefined; }
    return object[pascal] !== undefined ? object[pascal] : object[camel];
  }

  function normalizeServer(url) {
    var normalized = (url || '').trim();
    if (!/^https?:\/\//i.test(normalized)) { normalized = 'http://' + normalized; }
    return normalized.replace(/\/+$/, '');
  }

  function getDeviceId() {
    var id = storage.get(DEVICE_ID_KEY);
    if (!id) {
      id = 'moviedeck-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }
    storage.set(DEVICE_ID_KEY, id);
    return id;
  }

  function authorization(token) {
    var fields = [
      'Client="' + CLIENT_NAME + '"',
      'Device="Samsung MU8000"',
      'DeviceId="' + getDeviceId() + '"',
      'Version="' + CLIENT_VERSION + '"'
    ];
    if (token) { fields.push('Token="' + token + '"'); }
    return 'MediaBrowser ' + fields.join(', ');
  }

  function ApiClient() {
    this.server = '';
    this.token = '';
    this.user = null;
  }

  ApiClient.prototype.restore = function () {
    try {
      var session = JSON.parse(storage.get(STORAGE_KEY));
      if (!session || !session.server || !session.token || !session.user) { return false; }
      this.server = session.server;
      this.token = session.token;
      this.user = session.user;
      this.save();
      return true;
    } catch (error) {
      storage.remove(STORAGE_KEY);
      return false;
    }
  };

  ApiClient.prototype.save = function () {
    storage.set(STORAGE_KEY, JSON.stringify({ server: this.server, token: this.token, user: this.user }));
  };

  ApiClient.prototype.signOut = function () {
    this.token = '';
    this.user = null;
    storage.remove(STORAGE_KEY);
  };

  ApiClient.prototype.request = function (path, options) {
    options = options || {};
    var headers = options.headers || {};
    headers.Accept = 'application/json';
    headers.Authorization = authorization(this.token);
    if (options.body && typeof options.body !== 'string') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    options.headers = headers;

    return fetch(this.server + path, options).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (message) {
          var error = new Error(message || copy.get('jellyfinHttpError', { status: response.status }));
          error.status = response.status;
          throw error;
        });
      }
      if (response.status === 204) { return null; }
      return response.json();
    });
  };

  ApiClient.prototype.connect = function (server) {
    this.server = normalizeServer(server);
    return this.request('/System/Info/Public').then(function (info) {
      return value(info, 'ServerName', 'serverName') || 'Jellyfin';
    });
  };

  ApiClient.prototype.initiateQuickConnect = function () {
    return this.request('/QuickConnect/Initiate', { method: 'POST' });
  };

  ApiClient.prototype.getQuickConnectState = function (secret) {
    return this.request('/QuickConnect/Connect?Secret=' + encodeURIComponent(secret));
  };

  ApiClient.prototype.authenticateQuickConnect = function (secret) {
    var self = this;
    return this.request('/Users/AuthenticateWithQuickConnect', {
      method: 'POST',
      body: { Secret: secret }
    }).then(function (result) {
      self.token = value(result, 'AccessToken', 'accessToken');
      self.user = value(result, 'User', 'user');
      if (!self.token || !self.user) { throw new Error(copy.get('jellyfinSessionError')); }
      self.save();
      return self.user;
    });
  };

  ApiClient.prototype.userId = function () {
    return value(this.user, 'Id', 'id');
  };

  ApiClient.prototype.itemFields = function () {
    return 'Overview,Genres,PrimaryImageAspectRatio,MediaSources,MediaStreams,ProductionYear,RunTimeTicks';
  };

  ApiClient.prototype.getResume = function () {
    return this.request('/Users/' + this.userId() + '/Items/Resume?Limit=14&MediaTypes=Video&Fields=' + this.itemFields() + '&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1').then(function (result) {
      return value(result, 'Items', 'items') || [];
    });
  };

  ApiClient.prototype.getLatest = function () {
    return this.request('/Users/' + this.userId() + '/Items/Latest?Limit=14&MediaTypes=Video&Fields=' + this.itemFields() + '&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1');
  };

  ApiClient.prototype.getLibraries = function () {
    return this.request('/Users/' + this.userId() + '/Views').then(function (result) {
      return value(result, 'Items', 'items') || [];
    });
  };

  ApiClient.prototype.getVideos = function (parentId) {
    var self = this;
    var videos = [];
    var pageSize = 100;

    function getPage(startIndex) {
      var path = '/Users/' + self.userId() + '/Items?Recursive=true&MediaTypes=Video&SortBy=SortName&SortOrder=Ascending&StartIndex=' + startIndex + '&Limit=' + pageSize + '&Fields=' + self.itemFields() + '&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1';
      if (parentId) { path += '&ParentId=' + encodeURIComponent(parentId); }
      return self.request(path).then(function (result) {
        var page = value(result, 'Items', 'items') || [];
        var total = value(result, 'TotalRecordCount', 'totalRecordCount');
        videos = videos.concat(page);
        if (page.length === pageSize && (total === undefined || videos.length < total)) {
          return getPage(videos.length);
        }
        return videos;
      });
    }

    return getPage(0);
  };

  ApiClient.prototype.imageUrl = function (item, type, width, height) {
    var id = value(item, 'Id', 'id');
    var tags = value(item, 'ImageTags', 'imageTags') || {};
    var backdropTags = value(item, 'BackdropImageTags', 'backdropImageTags') || [];
    var tag = type === 'Backdrop' ? backdropTags[0] : tags[type];
    if (!id || !tag) { return ''; }
    var query = '?Tag=' + encodeURIComponent(tag) + '&Quality=92';
    if (width) { query += '&MaxWidth=' + width; }
    if (height) { query += '&MaxHeight=' + height; }
    return this.server + '/Items/' + id + '/Images/' + type + query;
  };

  ApiClient.prototype.deviceProfile = function () {
    return {
      Name: 'Samsung MU8000 Rawi',
      MaxStreamingBitrate: 80000000,
      MaxStaticBitrate: 120000000,
      MusicStreamingTranscodingBitrate: 192000,
      DirectPlayProfiles: [{
        Container: 'mp4,m4v,mkv,ts,mpegts,mov,avi',
        Type: 'Video',
        VideoCodec: 'h264,hevc,mpeg4,mpeg2video,vc1',
        AudioCodec: 'aac,ac3,eac3,mp3,dts'
      }],
      TranscodingProfiles: [{
        Container: 'ts',
        Type: 'Video',
        VideoCodec: 'h264',
        AudioCodec: 'ac3,aac',
        Protocol: 'hls',
        Context: 'Streaming',
        MaxAudioChannels: '6',
        MinSegments: 1,
        BreakOnNonKeyFrames: true
      }],
      CodecProfiles: [{
        Type: 'Video',
        Codec: 'h264',
        Conditions: [
          { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '51', IsRequired: false },
          { Condition: 'LessThanEqual', Property: 'VideoFramerate', Value: '60', IsRequired: false }
        ]
      }],
      SubtitleProfiles: []
    };
  };

  ApiClient.prototype.getPlaybackInfo = function (item, startTicks) {
    var id = value(item, 'Id', 'id');
    return this.request('/Items/' + id + '/PlaybackInfo?UserId=' + this.userId(), {
      method: 'POST',
      body: {
        UserId: this.userId(),
        StartTimeTicks: startTicks || 0,
        IsPlayback: true,
        AutoOpenLiveStream: true,
        EnableDirectPlay: true,
        EnableDirectStream: true,
        EnableTranscoding: true,
        AllowVideoStreamCopy: true,
        AllowAudioStreamCopy: true,
        MaxStreamingBitrate: 80000000,
        DeviceProfile: this.deviceProfile()
      }
    });
  };

  ApiClient.prototype.streamUrl = function (item, playbackInfo) {
    var sources = value(playbackInfo, 'MediaSources', 'mediaSources') || [];
    var source = sources[0];
    if (!source) { throw new Error(copy.get('noMediaSource')); }
    var itemId = value(item, 'Id', 'id');
    var mediaSourceId = value(source, 'Id', 'id');
    var playSessionId = value(playbackInfo, 'PlaySessionId', 'playSessionId');
    var supportsDirectPlay = value(source, 'SupportsDirectPlay', 'supportsDirectPlay');
    var relative;

    if (supportsDirectPlay) {
      relative = '/Videos/' + itemId + '/stream?Static=true&MediaSourceId=' + encodeURIComponent(mediaSourceId) + '&PlaySessionId=' + encodeURIComponent(playSessionId || '');
    } else {
      relative = value(source, 'TranscodingUrl', 'transcodingUrl') || value(source, 'DirectStreamUrl', 'directStreamUrl');
    }
    if (!relative) { throw new Error(copy.get('noCompatibleStream')); }
    var url = /^https?:\/\//i.test(relative) ? relative : this.server + relative;
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    if (!/[?&](api_key|apiKey)=/i.test(url)) { url += separator + 'api_key=' + encodeURIComponent(this.token); }
    return { url: url, source: source, playSessionId: playSessionId };
  };

  ApiClient.prototype.report = function (endpoint, body) {
    return this.request('/Sessions/Playing' + endpoint, { method: 'POST', body: body }).catch(function () {
      return null;
    });
  };

  global.MovieDeckApi = new ApiClient();
  global.MovieDeckValue = value;
}(window));
