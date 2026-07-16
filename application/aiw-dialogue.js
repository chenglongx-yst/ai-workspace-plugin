/* AI-Workspace Dialogue Bridge SDK (Vanilla JS) — trimmed from integration doc §10.1 */
(function (global) {
  'use strict';

  var PREFIX = 'aiw:dialogue';
  var T_READY = PREFIX + ':ready';
  var T_INIT = PREFIX + ':init';
  var T_REQUEST = PREFIX + ':request';
  var T_RESPONSE = PREFIX + ':response';
  var T_STREAM = PREFIX + ':stream';

  function DialogueError(message) {
    var e = new Error(message);
    e.name = 'DialogueError';
    return e;
  }

  function AiwDialogueClient(opts) {
    opts = opts || {};
    var self = this;
    this._token = '';
    this._tokenReady = false;
    this._tokenWaiters = [];
    this._pending = {};
    this._streamCbs = {};
    this._counter = 0;
    this._timeoutMs = opts.timeoutMs || 120000;
    this._handshakeTimeoutMs = opts.handshakeTimeoutMs || 8000;
    this._host = opts.host || global.parent;

    (opts.self || global).addEventListener('message', function (e) {
      self._onMessage(e);
    });
    this._host.postMessage({ type: T_READY }, '*');
  }

  AiwDialogueClient.prototype.ready = function () {
    var self = this;
    if (this._tokenReady) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var to = setTimeout(function () {
        reject(DialogueError('dialogue handshake timeout'));
      }, self._handshakeTimeoutMs);
      self._tokenWaiters.push(function () {
        clearTimeout(to);
        resolve();
      });
    });
  };

  AiwDialogueClient.prototype.createSession = function (params) {
    params = params || {};
    return this._call('createSession', {
      presetAssistantId: params.presetAssistantId,
      workspace: params.workspace,
      initialContext: params.initialContext,
    });
  };
  AiwDialogueClient.prototype.warmup = function (sessionId) {
    return this._call('warmup', { sessionId: sessionId });
  };
  AiwDialogueClient.prototype.closeSession = function (sessionId) {
    return this._call('closeSession', { sessionId: sessionId });
  };
  AiwDialogueClient.prototype.getModelInfo = function (sessionId) {
    return this._call('getModelInfo', { sessionId: sessionId });
  };

  AiwDialogueClient.prototype._nextId = function () {
    this._counter += 1;
    return 'req-' + Date.now().toString(36) + '-' + this._counter;
  };

  AiwDialogueClient.prototype._call = function (method, payload) {
    var self = this;
    return this.ready().then(function () {
      var requestId = self._nextId();
      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          delete self._pending[requestId];
          reject(DialogueError('dialogue method "' + method + '" timed out'));
        }, self._timeoutMs);
        self._pending[requestId] = { resolve: resolve, reject: reject, timer: timer };
        self._host.postMessage(
          {
            type: T_REQUEST,
            requestId: requestId,
            bridgeToken: self._token,
            method: method,
            payload: payload,
          },
          '*'
        );
      });
    });
  };

  AiwDialogueClient.prototype._onMessage = function (e) {
    var data = e && e.data;
    if (!data || typeof data.type !== 'string') return;

    if (data.type === T_INIT) {
      this._token = data.bridgeToken || '';
      this._tokenReady = true;
      var waiters = this._tokenWaiters.splice(0);
      for (var i = 0; i < waiters.length; i++) waiters[i]();
      return;
    }

    if (data.type === T_RESPONSE) {
      var entry = this._pending[data.requestId];
      if (!entry) return;
      delete this._pending[data.requestId];
      clearTimeout(entry.timer);
      if (data.success) entry.resolve(data.data);
      else entry.reject(DialogueError(data.error || 'dialogue request failed'));
    }
  };

  function createDialogueClient(opts) {
    var client = new AiwDialogueClient(opts);
    global.aiworkspace = global.aiworkspace || {};
    global.aiworkspace.dialogue = client;
    return client;
  }

  createDialogueClient();
  global.AiwDialogue = { Client: AiwDialogueClient, create: createDialogueClient };
})(typeof window !== 'undefined' ? window : this);
