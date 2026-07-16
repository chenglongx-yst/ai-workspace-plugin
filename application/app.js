(function () {
  'use strict';

  var identity = window.aiworkspace && window.aiworkspace.identity;
  var dialogue = window.aiworkspace && window.aiworkspace.dialogue;

  var serverStatus = document.getElementById('server-status');
  var identityStatus = document.getElementById('identity-status');
  var dialogueStatus = document.getElementById('dialogue-status');
  var pythonOutput = document.getElementById('python-output');
  var tokenOutput = document.getElementById('token-output');
  var dialogueOutput = document.getElementById('dialogue-output');
  var btnRefreshInfo = document.getElementById('btn-refresh-info');
  var btnEcho = document.getElementById('btn-echo');
  var btnToken = document.getElementById('btn-token');
  var btnSendToken = document.getElementById('btn-send-token');
  var btnSession = document.getElementById('btn-session');

  var apiBase = '';
  var lastToken = '';

  function setStatus(el, state, text) {
    el.className = 'status ' + state;
    el.textContent = text;
  }

  function showJson(el, value) {
    el.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }

  function loadServerConfig() {
    return fetch('../config/server.json')
      .then(function (res) {
        if (!res.ok) throw new Error('无法读取 config/server.json');
        return res.json();
      })
      .then(function (cfg) {
        var host = cfg.host || '127.0.0.1';
        var port = cfg.port || 18765;
        apiBase = 'http://' + host + ':' + port;
      });
  }

  function waitForPythonServer(maxAttempts) {
    var attempt = 0;
    return new Promise(function (resolve, reject) {
      function tick() {
        attempt += 1;
        fetch(apiBase + '/api/health')
          .then(function (res) {
            if (!res.ok) throw new Error('health ' + res.status);
            return res.json();
          })
          .then(resolve)
          .catch(function () {
            if (attempt >= maxAttempts) {
              reject(new Error('Python 服务未就绪。请先在产品中心卡片点击「启用」，并确认已安装 server/.venv 依赖。'));
              return;
            }
            setTimeout(tick, 500);
          });
      }
      tick();
    });
  }

  function apiFetch(path, options) {
    return fetch(apiBase + path, options).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          var message = body && body.detail ? JSON.stringify(body.detail) : res.statusText;
          throw new Error(message || 'request failed');
        }
        return body;
      });
    });
  }

  function bootPython() {
    return loadServerConfig()
      .then(function () {
        return waitForPythonServer(40);
      })
      .then(function (health) {
        setStatus(serverStatus, 'ok', 'Python 已连接 · ' + apiBase);
        showJson(pythonOutput, health);
        btnRefreshInfo.disabled = false;
        btnEcho.disabled = false;
      })
      .catch(function (err) {
        setStatus(serverStatus, 'err', err.message);
        showJson(pythonOutput, err.message);
      });
  }

  function bootIdentity() {
    if (!identity) {
      setStatus(identityStatus, 'err', 'SDK 未加载');
      return;
    }
    identity
      .ready()
      .then(function () {
        setStatus(identityStatus, 'ok', 'Identity 已就绪');
        btnToken.disabled = false;
        btnSendToken.disabled = false;
      })
      .catch(function (err) {
        setStatus(identityStatus, 'err', err.message);
      });
  }

  function bootDialogue() {
    if (!dialogue) {
      setStatus(dialogueStatus, 'err', 'SDK 未加载');
      return;
    }
    dialogue
      .ready()
      .then(function () {
        setStatus(dialogueStatus, 'ok', 'Dialogue 已就绪');
        btnSession.disabled = false;
      })
      .catch(function (err) {
        setStatus(dialogueStatus, 'err', err.message);
      });
  }

  btnRefreshInfo.addEventListener('click', function () {
    apiFetch('/api/info')
      .then(function (data) {
        showJson(pythonOutput, data);
      })
      .catch(function (err) {
        showJson(pythonOutput, err.message);
      });
  });

  btnEcho.addEventListener('click', function () {
    apiFetch('/api/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello from iframe shell · ' + new Date().toISOString() }),
    })
      .then(function (data) {
        showJson(pythonOutput, data);
      })
      .catch(function (err) {
        showJson(pythonOutput, err.message);
      });
  });

  btnToken.addEventListener('click', function () {
    identity
      .getToken()
      .then(function (result) {
        lastToken = result && result.token ? result.token : '';
        showJson(tokenOutput, {
          tokenPreview: lastToken ? lastToken.slice(0, 16) + '…' : '—',
          exp: result && result.exp,
        });
      })
      .catch(function (err) {
        showJson(tokenOutput, err.message);
      });
  });

  btnSendToken.addEventListener('click', function () {
    var run = lastToken
      ? Promise.resolve(lastToken)
      : identity.getToken().then(function (result) {
          lastToken = result && result.token ? result.token : '';
          return lastToken;
        });

    run
      .then(function (token) {
        if (!token) throw new Error('Token 为空');
        return apiFetch('/api/validate-token-header', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
        });
      })
      .then(function (data) {
        showJson(tokenOutput, { pythonValidation: data, tokenPreview: lastToken.slice(0, 16) + '…' });
      })
      .catch(function (err) {
        showJson(tokenOutput, err.message);
      });
  });

  btnSession.addEventListener('click', function () {
    dialogue
      .createSession({})
      .then(function (data) {
        showJson(dialogueOutput, data);
      })
      .catch(function (err) {
        showJson(dialogueOutput, err.message);
      });
  });

  bootPython();
  bootIdentity();
  bootDialogue();
})();
