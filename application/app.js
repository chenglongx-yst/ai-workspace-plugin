(function () {
  'use strict';

  var identity = window.aiworkspace && window.aiworkspace.identity;
  var dialogue = window.aiworkspace && window.aiworkspace.dialogue;

  var el = {
    status: document.getElementById('conn-status'),
    modelSelect: document.getElementById('model-select'),
    messages: document.getElementById('messages'),
    emptyHint: document.getElementById('empty-hint'),
    input: document.getElementById('input'),
    btnSend: document.getElementById('btn-send'),
    btnStop: document.getElementById('btn-stop'),
    btnNew: document.getElementById('btn-new-chat'),
    tabs: document.querySelectorAll('.tab'),
  };

  var state = {
    mode: 'bridge', // 'bridge' | 'direct'
    apiBase: '',
    busy: false,
    bridge: {
      sessionId: null,
      unsub: null,
      modelInfo: null,
    },
    direct: {
      modelsToken: null,
      models: [],
      history: [],
      abort: null,
    },
  };

  function setPill(stateName, text) {
    el.status.className = 'pill ' + stateName;
    el.status.textContent = text;
  }

  function setBusy(busy) {
    state.busy = busy;
    el.btnSend.disabled = busy || !canSend();
    el.btnStop.disabled = !busy;
    el.input.disabled = busy ? true : !canSend();
    el.modelSelect.disabled = busy || el.modelSelect.options.length === 0;
  }

  function canSend() {
    if (state.mode === 'bridge') return !!state.bridge.sessionId;
    return !!state.direct.modelsToken && state.direct.models.length > 0;
  }

  function clearMessages() {
    el.messages.innerHTML = '';
    el.emptyHint = document.createElement('div');
    el.emptyHint.className = 'empty-hint';
    el.emptyHint.id = 'empty-hint';
    el.emptyHint.textContent =
      state.mode === 'bridge'
        ? '对话桥模式：复用宿主 Claude/ACP 能力，支持工具与流式输出。'
        : '模型直连模式：经 Python 解密 Models Token 后调用企业网关。';
    el.messages.appendChild(el.emptyHint);
  }

  function removeEmptyHint() {
    var hint = document.getElementById('empty-hint');
    if (hint) hint.remove();
  }

  function appendMessage(role, text, opts) {
    opts = opts || {};
    removeEmptyHint();
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + role;
    if (opts.id) wrap.dataset.msgId = opts.id;

    var roleEl = document.createElement('div');
    roleEl.className = 'role';
    roleEl.textContent = role === 'user' ? '我' : role === 'assistant' ? '助手' : '系统';

    var bubble = document.createElement('div');
    bubble.className = 'bubble' + (opts.streaming ? ' streaming' : '');
    bubble.textContent = text || '';

    wrap.appendChild(roleEl);
    wrap.appendChild(bubble);
    el.messages.appendChild(wrap);
    el.messages.scrollTop = el.messages.scrollHeight;
    return { wrap: wrap, bubble: bubble };
  }

  function updateAssistantBubble(msgId, text, streaming) {
    var node = el.messages.querySelector('[data-msg-id="' + msgId + '"] .bubble');
    if (!node) {
      var created = appendMessage('assistant', text, { id: msgId, streaming: streaming });
      return created.bubble;
    }
    node.textContent = text;
    if (streaming) node.classList.add('streaming');
    else node.classList.remove('streaming');
    el.messages.scrollTop = el.messages.scrollHeight;
    return node;
  }

  function fillModelSelect(models, currentId) {
    el.modelSelect.innerHTML = '';
    if (!models || models.length === 0) {
      var opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '暂无可用模型';
      el.modelSelect.appendChild(opt);
      el.modelSelect.disabled = true;
      return;
    }
    models.forEach(function (m) {
      var id = typeof m === 'string' ? m : m.id;
      var label = typeof m === 'string' ? m : m.label || m.id;
      var o = document.createElement('option');
      o.value = id;
      o.textContent = label;
      if (currentId && id === currentId) o.selected = true;
      el.modelSelect.appendChild(o);
    });
    el.modelSelect.disabled = state.busy;
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
        state.apiBase = 'http://' + host + ':' + port;
      });
  }

  function waitForPython(maxAttempts) {
    var attempt = 0;
    return new Promise(function (resolve, reject) {
      function tick() {
        attempt += 1;
        fetch(state.apiBase + '/api/health')
          .then(function (res) {
            if (!res.ok) throw new Error('health ' + res.status);
            return res.json();
          })
          .then(resolve)
          .catch(function () {
            if (attempt >= maxAttempts) {
              reject(new Error('Python 服务未就绪，请先在产品中心启用本扩展'));
              return;
            }
            setTimeout(tick, 400);
          });
      }
      tick();
    });
  }

  // ---------- Bridge adapter ----------

  function extractContentDelta(data) {
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      if (typeof data.content === 'string') return data.content;
      if (typeof data.text === 'string') return data.text;
    }
    return '';
  }

  function bridgeEnsureSession() {
    if (!dialogue) return Promise.reject(new Error('Dialogue SDK 未加载'));
    return dialogue.ready().then(function () {
      if (state.bridge.sessionId) return { sessionId: state.bridge.sessionId };
      return dialogue.createSession({}).then(function (r) {
        state.bridge.sessionId = r.sessionId;
        if (state.bridge.unsub) {
          state.bridge.unsub();
          state.bridge.unsub = null;
        }
        state.bridge.unsub = dialogue.onStream(r.sessionId, onBridgeStream);
        return dialogue.warmup(r.sessionId).then(
          function () {
            return r;
          },
          function () {
            return r;
          }
        );
      });
    });
  }

  function bridgeRefreshModels() {
    if (!state.bridge.sessionId) return Promise.resolve();
    return dialogue.getModelInfo(state.bridge.sessionId).then(function (res) {
      var info = res && res.modelInfo;
      state.bridge.modelInfo = info;
      if (!info) {
        fillModelSelect([], null);
        return;
      }
      var models = (info.availableModels || []).map(function (m) {
        return { id: m.id, label: m.label || m.id };
      });
      fillModelSelect(models, info.currentModelId);
      el.modelSelect.disabled = state.busy || !info.canSwitch;
    });
  }

  var bridgeBuffers = {};

  function onBridgeStream(evt) {
    if (!evt || !evt.type) return;
    var msgId = evt.msgId || 'default';

    switch (evt.type) {
      case 'start':
        bridgeBuffers[msgId] = '';
        updateAssistantBubble(msgId, '', true);
        setBusy(true);
        break;
      case 'content':
        bridgeBuffers[msgId] = (bridgeBuffers[msgId] || '') + extractContentDelta(evt.data);
        updateAssistantBubble(msgId, bridgeBuffers[msgId], true);
        break;
      case 'acp_permission':
        try {
          var req = evt.data || {};
          var callId = req.toolCall && req.toolCall.toolCallId;
          var option = (req.options && req.options[0]) || { optionId: 'allow_once' };
          if (callId && state.bridge.sessionId) {
            dialogue.confirmPermission({
              sessionId: state.bridge.sessionId,
              callId: callId,
              data: option,
              msgId: evt.msgId,
            });
          }
        } catch (e) {
          /* ignore */
        }
        break;
      case 'acp_model_info':
        if (evt.data) {
          state.bridge.modelInfo = evt.data;
          var models = (evt.data.availableModels || []).map(function (m) {
            return { id: m.id, label: m.label || m.id };
          });
          fillModelSelect(models, evt.data.currentModelId);
        }
        break;
      case 'error':
        updateAssistantBubble(msgId, bridgeBuffers[msgId] || '', false);
        appendMessage('system', typeof evt.data === 'string' ? evt.data : JSON.stringify(evt.data));
        setBusy(false);
        break;
      case 'finish':
        updateAssistantBubble(msgId, bridgeBuffers[msgId] || '', false);
        setBusy(false);
        break;
      default:
        break;
    }
  }

  function bridgeSend(text) {
    return bridgeEnsureSession().then(function () {
      appendMessage('user', text);
      setBusy(true);
      return dialogue.sendMessage({ sessionId: state.bridge.sessionId, text: text });
    });
  }

  function bridgeStop() {
    if (!state.bridge.sessionId) return Promise.resolve();
    return dialogue.stopGeneration(state.bridge.sessionId).finally(function () {
      setBusy(false);
    });
  }

  function bridgeSetModel(modelId) {
    if (!state.bridge.sessionId || !modelId) return Promise.resolve();
    return dialogue.setModel(state.bridge.sessionId, modelId).then(function (res) {
      if (res && res.modelInfo) {
        state.bridge.modelInfo = res.modelInfo;
        var models = (res.modelInfo.availableModels || []).map(function (m) {
          return { id: m.id, label: m.label || m.id };
        });
        fillModelSelect(models, res.modelInfo.currentModelId);
      }
    });
  }

  function bridgeReset() {
    var close =
      state.bridge.sessionId && dialogue
        ? dialogue.closeSession(state.bridge.sessionId).catch(function () {})
        : Promise.resolve();
    if (state.bridge.unsub) {
      state.bridge.unsub();
      state.bridge.unsub = null;
    }
    state.bridge.sessionId = null;
    state.bridge.modelInfo = null;
    bridgeBuffers = {};
    return close.then(function () {
      clearMessages();
      return bridgeEnsureSession().then(function () {
        return bridgeRefreshModels();
      });
    });
  }

  // ---------- Direct adapter ----------

  function getModelsTokenFresh() {
    if (!identity) return Promise.reject(new Error('Identity SDK 未加载'));
    return identity.ready().then(function () {
      return identity.getModelsToken();
    }).then(function (result) {
      var token = result && result.token ? result.token : '';
      if (!token) throw new Error('Models Token 为空，请确认已 SSO 登录且具备 identityModels 权限');
      state.direct.modelsToken = token;
      return token;
    });
  }

  function directRefreshModels() {
    return getModelsTokenFresh()
      .then(function (token) {
        return fetch(state.apiBase + '/api/models', {
          headers: {
            'X-Identity-Models-Token': token,
            'X-Identity-Version': '1',
          },
        }).then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) {
              var detail = body && body.detail ? JSON.stringify(body.detail) : res.statusText;
              throw new Error(detail);
            }
            return body;
          });
        });
      })
      .then(function (data) {
        state.direct.models = data.models || [];
        fillModelSelect(state.direct.models, data.defaultModel || state.direct.models[0]);
      });
  }

  function parseSseChunks(buffer, onEvent) {
    var parts = buffer.split('\n\n');
    var rest = parts.pop();
    for (var i = 0; i < parts.length; i++) {
      var block = parts[i];
      var lines = block.split('\n');
      for (var j = 0; j < lines.length; j++) {
        var line = lines[j];
        if (line.indexOf('data:') !== 0) continue;
        var payload = line.slice(5).trim();
        if (!payload) continue;
        onEvent(payload);
      }
    }
    return rest;
  }

  function extractStreamDelta(payload) {
    if (payload === '[DONE]') return { done: true, text: '' };
    try {
      var obj = JSON.parse(payload);
      if (obj.error) return { done: true, text: '', error: typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error) };
      var choices = obj.choices || [];
      if (choices[0] && choices[0].delta && typeof choices[0].delta.content === 'string') {
        return { done: false, text: choices[0].delta.content };
      }
      if (choices[0] && choices[0].message && typeof choices[0].message.content === 'string') {
        return { done: true, text: choices[0].message.content };
      }
    } catch (e) {
      /* ignore non-json */
    }
    return { done: false, text: '' };
  }

  function directSend(text) {
    var model = el.modelSelect.value;
    if (!model) return Promise.reject(new Error('请先选择模型'));

    appendMessage('user', text);
    state.direct.history.push({ role: 'user', content: text });

    var msgId = 'd-' + Date.now().toString(36);
    var assembled = '';
    updateAssistantBubble(msgId, '', true);
    setBusy(true);

    var controller = new AbortController();
    state.direct.abort = controller;

    return getModelsTokenFresh()
      .then(function (token) {
        return fetch(state.apiBase + '/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Identity-Models-Token': token,
            'X-Identity-Version': '1',
          },
          body: JSON.stringify({
            model: model,
            stream: true,
            messages: state.direct.history.slice(),
          }),
          signal: controller.signal,
        });
      })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(
            function (body) {
              var detail = body && body.detail ? JSON.stringify(body.detail) : res.statusText;
              throw new Error(detail);
            },
            function () {
              throw new Error('chat failed: ' + res.status);
            }
          );
        }
        if (!res.body || !res.body.getReader) {
          throw new Error('浏览器不支持流式读取');
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buf = '';

        function pump() {
          return reader.read().then(function (result) {
            if (result.done) {
              updateAssistantBubble(msgId, assembled, false);
              if (assembled) state.direct.history.push({ role: 'assistant', content: assembled });
              setBusy(false);
              state.direct.abort = null;
              return;
            }
            buf += decoder.decode(result.value, { stream: true });
            buf = parseSseChunks(buf, function (payload) {
              var delta = extractStreamDelta(payload);
              if (delta.error) {
                appendMessage('system', delta.error);
                return;
              }
              if (delta.text) {
                assembled += delta.text;
                updateAssistantBubble(msgId, assembled, true);
              }
            });
            return pump();
          });
        }
        return pump();
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') {
          updateAssistantBubble(msgId, assembled || '（已停止）', false);
          if (assembled) state.direct.history.push({ role: 'assistant', content: assembled });
        } else {
          updateAssistantBubble(msgId, assembled, false);
          appendMessage('system', (err && err.message) || String(err));
        }
        setBusy(false);
        state.direct.abort = null;
      });
  }

  function directStop() {
    if (state.direct.abort) {
      state.direct.abort.abort();
      state.direct.abort = null;
    }
    setBusy(false);
    return Promise.resolve();
  }

  function directReset() {
    if (state.direct.abort) state.direct.abort.abort();
    state.direct.abort = null;
    state.direct.history = [];
    clearMessages();
    return Promise.resolve();
  }

  // ---------- Mode switch & UI wiring ----------

  function switchMode(mode) {
    if (mode === state.mode && !state.busy) {
      /* still refresh */
    }
    if (state.busy) return;

    state.mode = mode;
    el.tabs.forEach(function (tab) {
      var active = tab.getAttribute('data-mode') === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    clearMessages();
    setPill('warn', mode === 'bridge' ? '对话桥初始化…' : '模型直连初始化…');

    var boot =
      mode === 'bridge'
        ? bridgeEnsureSession()
            .then(function () {
              return bridgeRefreshModels();
            })
            .then(function () {
              setPill('ok', '对话桥就绪');
              el.input.disabled = false;
              el.btnSend.disabled = false;
            })
        : waitForPython(30)
            .then(function () {
              return directRefreshModels();
            })
            .then(function () {
              setPill('ok', '模型直连就绪 · ' + state.apiBase);
              el.input.disabled = false;
              el.btnSend.disabled = !canSend();
            });

    boot.catch(function (err) {
      setPill('err', err.message || String(err));
      appendMessage('system', err.message || String(err));
      el.input.disabled = true;
      el.btnSend.disabled = true;
    });
  }

  function onSend() {
    var text = (el.input.value || '').trim();
    if (!text || state.busy) return;
    el.input.value = '';
    var run = state.mode === 'bridge' ? bridgeSend(text) : directSend(text);
    run.catch(function (err) {
      appendMessage('system', err.message || String(err));
      setBusy(false);
    });
  }

  el.tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var mode = tab.getAttribute('data-mode');
      if (mode && mode !== state.mode) switchMode(mode);
    });
  });

  el.btnSend.addEventListener('click', onSend);
  el.btnStop.addEventListener('click', function () {
    if (state.mode === 'bridge') bridgeStop();
    else directStop();
  });
  el.btnNew.addEventListener('click', function () {
    if (state.busy) return;
    var reset = state.mode === 'bridge' ? bridgeReset() : directReset();
    reset.catch(function (err) {
      appendMessage('system', err.message || String(err));
    });
  });

  el.modelSelect.addEventListener('change', function () {
    if (state.mode === 'bridge') {
      bridgeSetModel(el.modelSelect.value).catch(function (err) {
        appendMessage('system', err.message || String(err));
      });
    }
  });

  el.input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });

  // Boot: load Python config (needed for direct), then start bridge tab
  loadServerConfig()
    .then(function () {
      return waitForPython(40).catch(function () {
        /* bridge tab can work without python; direct will fail later */
      });
    })
    .then(function () {
      switchMode('bridge');
    })
    .catch(function (err) {
      setPill('err', err.message || String(err));
    });
})();
