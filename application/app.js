(() => {
  const API_BASE = "http://127.0.0.1:18765";

  const ICON_SVG = {
    system_cache:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4z" fill="#fff" opacity=".95"/><path d="M7 10h4v4H7zm6 0h4v2h-4z" fill="#2563eb"/><rect x="3" y="5" width="18" height="14" rx="2" stroke="#fff" stroke-width="1.5" fill="none"/></svg>',
    temp_files:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#fff"/><path d="M14 3v5h5" stroke="#ea580c" stroke-width="1.4" fill="none"/><path d="M8 13h8M8 16h6" stroke="#ea580c" stroke-width="1.5" stroke-linecap="round"/></svg>',
    downloads:
      '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="#fff" opacity=".9"/><path d="M12 6v8m0 0 3.5-3.5M12 14 8.5 10.5" stroke="#15803d" stroke-width="2" stroke-linecap="round"/><path d="M7 17h10" stroke="#15803d" stroke-width="2" stroke-linecap="round"/></svg>',
    log_files:
      '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" fill="#fff"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#7c3aed" stroke-width="1.6" stroke-linecap="round"/></svg>',
    recycle_bin:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M9 4h6l1 2h4v2H4V6h4l1-2z" fill="#fff"/><path d="M7 8h10l-1 12H8L7 8z" fill="#fff" opacity=".95"/><path d="M10 11v6m4-6v6" stroke="#a16207" stroke-width="1.6" stroke-linecap="round"/></svg>',
    other_junk:
      '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="8" width="16" height="12" rx="2" fill="#fff"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="#db2777" stroke-width="1.6"/><circle cx="9" cy="14" r="1.2" fill="#db2777"/><circle cx="12" cy="14" r="1.2" fill="#db2777"/><circle cx="15" cy="14" r="1.2" fill="#db2777"/></svg>',
  };

  const state = {
    categories: [],
    selected: new Set(),
    disk: null,
    freeableBytes: 0,
    junkBytes: 0,
    scanning: false,
    deepToken: null,
    modalMode: null, // "safe" | "deep"
    pendingSafeIds: [],
  };

  let toastTimer = null;
  const $ = (id) => document.getElementById(id);

  function fmtGB(bytes) {
    const gb = Number(bytes || 0) / 1024 ** 3;
    return gb >= 10 ? gb.toFixed(1) : gb.toFixed(2);
  }

  function fmtSize(bytes) {
    const b = Number(bytes || 0);
    if (b >= 1024 ** 3) return `${fmtGB(b)} GB`;
    if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${b} B`;
  }

  function fmtCount(n) {
    return Number(n || 0).toLocaleString("zh-CN");
  }

  function showToast(message, kind = "") {
    const el = $("toast");
    if (!el) return;
    el.textContent = message;
    el.className = `toast ${kind}`.trim();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
  }

  function setBusy(on, text) {
    const el = $("busy");
    if (!el) return;
    el.classList.toggle("hidden", !on);
    if (text) $("busy-text").textContent = text;
  }

  function closeModal() {
    $("modal").classList.add("hidden");
    state.modalMode = null;
    state.pendingSafeIds = [];
    state.deepToken = null;
  }

  function openModal({ title, warn, actionsHtml, mode }) {
    $("modal-title").textContent = title;
    $("modal-warn").textContent = warn || "";
    $("modal-actions").innerHTML = actionsHtml || "";
    state.modalMode = mode;
    $("modal").classList.remove("hidden");
  }

  async function api(path, options = {}) {
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
      });
    } catch (err) {
      throw new Error(`无法连接清理服务 (${API_BASE})，请确认插件已启用。${err.message || ""}`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.detail || data.message || res.statusText;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return data;
  }

  function setStatus(text, kind = "") {
    const el = $("scan-status");
    el.innerHTML = `<span class="status-text">${text}</span>`;
    el.className = `status-line ${kind}`.trim();
  }

  function setHint(text) {
    const el = $("scan-hint");
    if (el) el.textContent = text;
  }

  function selectedCleanableIds() {
    return [...state.selected].filter((id) => {
      const cat = state.categories.find((c) => c.id === id);
      return cat && String(cat.risk).toLowerCase() === "safe";
    });
  }

  function selectedBytes() {
    return state.categories
      .filter((c) => state.selected.has(c.id) && String(c.risk).toLowerCase() === "safe")
      .reduce((sum, c) => sum + Number(c.bytes || 0), 0);
  }

  function updateDonut(freePct) {
    const arc = $("donut-arc");
    if (!arc) return;
    const c = 2 * Math.PI * 15.5;
    const pct = Math.max(0, Math.min(100, Number(freePct) || 0));
    const filled = (pct / 100) * c;
    arc.style.strokeDasharray = `${filled} ${c}`;
  }

  function updateButtons() {
    const bytes = selectedBytes();
    const has = bytes > 0 && !state.scanning;
    $("btn-one-click").disabled = !has;
    $("btn-clean-now").disabled = !has;
    $("btn-deep").disabled = state.scanning;
    const label = $("btn-clean-label");
    if (label) label.textContent = bytes > 0 ? `立即清理 ${fmtGB(bytes)} GB` : "立即清理";
    $("freeable-gb").textContent = fmtGB(state.freeableBytes);
  }

  function iconHtml(id) {
    return ICON_SVG[id] || ICON_SVG.other_junk;
  }

  function isTruthy(v) {
    return v === true || v === "True" || v === "true" || v === 1 || v === "1";
  }

  function render() {
    const disk = state.disk || {};
    $("disk-total").textContent = `${disk.totalGB ?? "—"} GB`;
    $("disk-used-text").textContent = `已用 ${disk.usedGB ?? "—"} GB`;
    $("disk-used-bar").style.width = `${Math.min(100, Number(disk.usedPercent || 0))}%`;
    $("disk-free").textContent = `${disk.freeGB ?? "—"} GB`;
    const freePct = disk.totalGB
      ? (Number(disk.freeGB) / Number(disk.totalGB)) * 100
      : 0;
    $("disk-free-pct").textContent = `${freePct.toFixed(1)}% 可用`;
    updateDonut(freePct);

    $("junk-gb").textContent = `${fmtGB(state.freeableBytes)} GB`;
    const junkPct = disk.totalBytes
      ? ((state.freeableBytes / Number(disk.totalBytes)) * 100).toFixed(1)
      : "—";
    $("junk-pct").textContent = `占用 ${junkPct}%`;

    $("cat-icons").innerHTML = state.categories
      .map(
        (c) => `
      <div class="cat-icon">
        <div class="cat-badge c-${c.id}">${iconHtml(c.id)}</div>
        <div class="name">${c.name}</div>
        <div class="size">${fmtSize(c.bytes)}</div>
      </div>`
      )
      .join("");

    $("cat-list").innerHTML = state.categories
      .map((c) => {
        const checked = state.selected.has(c.id) ? "checked" : "";
        const disabled = String(c.risk).toLowerCase() !== "safe" ? "disabled" : "";
        const paths = (c.paths || []).map((p) => `<div>${p}</div>`).join("");
        return `
        <div class="cat-row" data-id="${c.id}">
          <div class="ico c-${c.id}">${iconHtml(c.id)}</div>
          <div>
            <div class="title">${c.name}</div>
            <div class="desc">${c.description || ""}</div>
            <div class="meta">共 ${fmtCount(c.itemCount)} 项${String(c.risk).toLowerCase() === "cautious" ? " · 默认不清理" : ""}</div>
          </div>
          <div class="size">${fmtSize(c.bytes)}</div>
          <input class="check" type="checkbox" data-id="${c.id}" ${checked} ${disabled} />
          <div class="cat-paths">${paths || "无路径详情"}</div>
        </div>`;
      })
      .join("");

    updateButtons();
  }

  async function runScan() {
    state.scanning = true;
    updateButtons();
    setBusy(true, "正在扫描 C 盘…");
    setStatus("正在扫描…", "warn");
    setHint("正在分析 C 盘垃圾文件，请稍候…");
    try {
      const data = await api("/api/scan", { method: "POST", body: "{}" });
      state.categories = data.categories || [];
      state.disk = data.disk || null;
      state.freeableBytes = Number(data.freeableBytes || 0);
      state.junkBytes = Number(data.junkBytes || 0);
      state.selected = new Set(
        state.categories
          .filter((c) => isTruthy(c.selectedDefault) && String(c.risk).toLowerCase() === "safe")
          .map((c) => c.id)
      );
      // fallback: if nothing selected but safe categories exist, select all safe with bytes>0
      if (state.selected.size === 0) {
        state.categories
          .filter((c) => String(c.risk).toLowerCase() === "safe" && Number(c.bytes) > 0)
          .forEach((c) => state.selected.add(c.id));
      }
      setStatus("垃圾扫描完成", "ok");
      setHint(`扫描完成，发现可清理垃圾 ${fmtGB(state.freeableBytes)} GB`);
      render();
    } catch (err) {
      setStatus("扫描失败", "err");
      setHint(err.message);
      showToast(err.message, "err");
    } finally {
      state.scanning = false;
      setBusy(false);
      updateButtons();
    }
  }

  function requestSafeClean() {
    if (state.scanning) {
      showToast("正在处理中，请稍候", "err");
      return;
    }
    const ids = selectedCleanableIds();
    if (!ids.length) {
      showToast("请先勾选可清理的垃圾分类", "err");
      setHint("未选择可清理项。下载/其他垃圾默认不可一键清理。");
      return;
    }
    const bytes = selectedBytes();
    const names = state.categories
      .filter((c) => ids.includes(c.id))
      .map((c) => `<li>${c.name} · ${fmtSize(c.bytes)}</li>`)
      .join("");
    state.pendingSafeIds = ids;
    openModal({
      title: "确认安全清理",
      warn: `将永久删除以下已选垃圾（约 ${fmtGB(bytes)} GB），不会进入回收站。`,
      actionsHtml: names,
      mode: "safe",
    });
  }

  async function executeSafeClean(ids) {
    state.scanning = true;
    updateButtons();
    setBusy(true, "正在安全清理…");
    setStatus("正在清理…", "warn");
    setHint("正在安全清理已选垃圾…");
    showToast("开始清理…");
    try {
      const result = await api("/api/clean/safe", {
        method: "POST",
        body: JSON.stringify({ categoryIds: ids, confirm: true }),
      });
      setStatus("清理完成", "ok");
      setHint(`约释放 ${fmtGB(result.freedBytes)} GB`);
      showToast(`清理完成，约释放 ${fmtGB(result.freedBytes)} GB`, "ok");
      await runScan();
    } catch (err) {
      setStatus("清理失败", "err");
      setHint(err.message);
      showToast(err.message, "err");
      state.scanning = false;
      setBusy(false);
      updateButtons();
    }
  }

  async function openDeepModal() {
    if (state.scanning) {
      showToast("正在处理中，请稍候", "err");
      return;
    }
    setBusy(true, "准备深度清理预览…");
    try {
      const data = await api("/api/clean/deep/preview", {
        method: "POST",
        body: JSON.stringify({ items: ["update_cache", "winsxs", "hibernate"] }),
      });
      state.deepToken = data.confirmToken;
      openModal({
        title: "确认深度清理",
        warn: (data.warnings || []).join(" "),
        actionsHtml: (data.preview?.actions || [])
          .map((a) => `<li>${a.label} · ${fmtSize(a.bytes)}</li>`)
          .join(""),
        mode: "deep",
      });
    } catch (err) {
      setStatus("深度清理预览失败", "err");
      setHint(err.message);
      showToast(err.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function executeDeepClean() {
    if (!state.deepToken) {
      showToast("确认已失效，请重新打开深度清理", "err");
      return;
    }
    const token = state.deepToken;
    state.scanning = true;
    updateButtons();
    setBusy(true, "正在深度清理…");
    try {
      const result = await api("/api/clean/deep", {
        method: "POST",
        body: JSON.stringify({ confirmToken: token, confirm: true }),
      });
      setStatus("深度清理完成", "ok");
      setHint(`约释放 ${fmtGB(result.freedBytes)} GB`);
      showToast(`深度清理完成，约释放 ${fmtGB(result.freedBytes)} GB`, "ok");
      await runScan();
    } catch (err) {
      setStatus("深度清理失败", "err");
      setHint(err.message);
      showToast(err.message, "err");
      state.scanning = false;
      setBusy(false);
      updateButtons();
    }
  }

  async function onModalOk() {
    const mode = state.modalMode;
    const ids = state.pendingSafeIds.slice();
    const token = state.deepToken;
    closeModal();
    if (mode === "safe") await executeSafeClean(ids);
    else if (mode === "deep") {
      state.deepToken = token;
      await executeDeepClean();
    }
  }

  $("cat-list").addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("input.check[data-id]")) {
      const id = t.getAttribute("data-id");
      if (t.checked) state.selected.add(id);
      else state.selected.delete(id);
      updateButtons();
    }
  });

  // click on row checkbox area + buttons (capture to avoid iframe quirks)
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, input.check");
    if (!t) return;
    if (t.id === "btn-one-click" || t.id === "btn-clean-now") {
      e.preventDefault();
      requestSafeClean();
    } else if (t.id === "btn-deep") {
      e.preventDefault();
      openDeepModal();
    } else if (t.id === "btn-rescan") {
      e.preventDefault();
      runScan();
    } else if (t.id === "btn-expand") {
      e.preventDefault();
      document.querySelectorAll(".cat-row").forEach((row) => row.classList.add("expanded"));
    } else if (t.id === "modal-cancel") {
      e.preventDefault();
      closeModal();
    } else if (t.id === "modal-ok") {
      e.preventDefault();
      onModalOk();
    }
  });

  runScan();
})();
