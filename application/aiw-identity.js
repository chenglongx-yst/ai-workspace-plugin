/* AI-Workspace Identity Token SDK (Vanilla JS)
 * Usage: <script src="./aiw-identity.js"></script>
 *        await window.aiworkspace.identity.ready();
 *        const result = await window.aiworkspace.identity.getToken();
 */
(function (global) {
  'use strict';

  var PREFIX = 'aiw:identity';
  var T_READY = PREFIX + ':ready';
  var T_INIT = PREFIX + ':init';
  var T_REQUEST = PREFIX + ':request';
  var T_RESPONSE = PREFIX + ':response';

  function IdentityError(message) {
    var e = new Error(message);
    e.name = 'IdentityError';
    return e;
  }

  function AiwIdentityClient(opts) {
    opts = opts || {};
    var self = this;
    this._token = '';
    this._tokenReady = false;
    this._tokenWaiters = [];
    this._pending = {};
    this._counter = 0;
    this._handshakeTimeoutMs = opts.handshakeTimeoutMs || 8000;
    this._host = opts.host || global.parent;

    (opts.self || global).addEventListener('message', function (e) {
      self._onMessage(e);
    });

    this._host.postMessage({ type: T_READY }, '*');
  }

  AiwIdentityClient.prototype.ready = function () {
    var self = this;
    if (this._tokenReady) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var to = setTimeout(function () {
        reject(IdentityError('identity handshake timeout'));
      }, self._handshakeTimeoutMs);
      self._tokenWaiters.push(function () {
        clearTimeout(to);
        resolve();
      });
    });
  };

  AiwIdentityClient.prototype.getToken = function () {
    return this._call('getToken');
  };

  AiwIdentityClient.prototype.getModelsToken = function () {
    return this._call('getModelsToken');
  };

  AiwIdentityClient.prototype._nextId = function () {
    this._counter += 1;
    return 'idt-' + Date.now().toString(36) + '-' + this._counter;
  };

  AiwIdentityClient.prototype._call = function (method, payload) {
    var self = this;
    return this.ready().then(function () {
      var requestId = self._nextId();
      return new Promise(function (resolve, reject) {
        self._pending[requestId] = { resolve: resolve, reject: reject };
        self._host.postMessage(
          {
            type: T_REQUEST,
            requestId: requestId,
            bridgeToken: self._token,
            method: method,
            payload: payload || {},
          },
          '*'
        );
      });
    });
  };

  AiwIdentityClient.prototype._onMessage = function (e) {
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
      if (data.success) entry.resolve(data.data);
      else entry.reject(IdentityError(data.error || 'identity request failed'));
    }
  };

  function createIdentityClient(opts) {
    var client = new AiwIdentityClient(opts);
    global.aiworkspace = global.aiworkspace || {};
    global.aiworkspace.identity = client;
    return client;
  }

  createIdentityClient();

  global.AiwIdentity = { Client: AiwIdentityClient, create: createIdentityClient };
})(typeof window !== 'undefined' ? window : this);
