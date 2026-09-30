/* ============================================================
   以我APP · 通用 UI 工具（图标/Toast/弹窗/格式化/头像）
   ============================================================ */
window.UI = (() => {
  /* ---------- 内联 SVG 图标集 ---------- */
  const PATH = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V21h5v-6h4v6h5V9.8"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    wallet: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/><path d="M16 15h2"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    like: '<path d="M19.5 12.57 12 20l-7.5-7.43A5 5 0 1 1 12 6.01a5 5 0 1 1 7.5 6.56Z"/>',
    comment: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    memo: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16v-4"/><path d="M12 16V8"/><path d="M17 16v-7"/>',
    pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10Z"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    layers: '<path d="m12 2 10 6-10 6L2 8Z"/><path d="m2 13 10 6 10-6"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".8"/><circle cx="17.5" cy="10.5" r=".8"/><circle cx="8.5" cy="7.5" r=".8"/><circle cx="6.5" cy="12.5" r=".8"/><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 1 2-4h2a4 4 0 0 0 4-4c0-4.5-4.5-8-10-8Z"/>',
    sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
    sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9Z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L7 20"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    medal: '<circle cx="12" cy="8" r="6"/><path d="m8.2 13.9-1.5 8 5.3-3 5.3 3-1.5-8"/>',
    pin: '<path d="M9 4h6l1 7 3 3H5l3-3Z"/><path d="M12 14v7"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  };

  function icon(name, size = 20, color = "currentColor") {
    const d = PATH[name] || PATH.info;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  }

  /* ---------- Toast ---------- */
  let toastWrap = null;
  function toast(msg, type = "info", ms = 2200) {
    if (!toastWrap) {
      toastWrap = document.createElement("div");
      toastWrap.className = "toast-wrap";
      document.body.appendChild(toastWrap);
    }
    const icons = { success: "✓", error: "✕", warn: "!", info: "i" };
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-ico">${icons[type] || "i"}</span><span>${esc(msg)}</span>`;
    toastWrap.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 260);
    }, ms);
  }

  /* ---------- 弹层 ---------- */
  function maskEl() {
    const m = document.createElement("div");
    m.className = "mask";
    document.body.appendChild(m);
    return m;
  }

  /** sheet(html) -> { el, close }  底部弹层 */
  function sheet(html) {
    const m = maskEl();
    const card = document.createElement("div");
    card.className = "sheet";
    card.innerHTML = `<div class="sheet-bar"></div>${html}`;
    m.appendChild(card);
    const close = () => m.remove();
    m.addEventListener("click", e => { if (e.target === m) close(); });
    return { el: card, close };
  }

  /** dialog({title,body,btns}) -> { el, close } 居中弹窗（confirm 封装） */
  function dialog({ title = "", body = "", btns = [{ text: "知道了", primary: true }], onBtn } = {}) {
    const m = maskEl();
    m.classList.add("modal-center");
    const card = document.createElement("div");
    card.className = "modal-card";
    card.innerHTML = `
      <div class="sheet-head"><h3>${esc(title)}</h3>
        <button class="icon-btn" data-close>${icon("close", 18)}</button></div>
      <div class="modal-body">${body}</div>
      <div class="sheet-actions"></div>`;
    const actBox = card.querySelector(".sheet-actions");
    btns.forEach(b => {
      const btn = document.createElement("button");
      btn.className = `btn ${b.primary ? (b.danger ? "danger" : "primary") : "ghost"} ${b.block ? "block" : ""}`;
      btn.textContent = b.text;
      btn.onclick = () => {
        m.remove();
        if (onBtn) onBtn(b.value !== undefined ? b.value : b.text);
      };
      actBox.appendChild(btn);
    });
    card.querySelector("[data-close]").onclick = () => m.remove();
    m.appendChild(card);
    m.addEventListener("click", e => { if (e.target === m) m.remove(); });
    return { el: card, close: () => m.remove() };
  }

  function confirm(title, desc, opts = {}) {
    return new Promise(resolve => {
      dialog({
        title,
        body: desc ? `<p class="txt-2 txt-sm">${esc(desc)}</p>` : "",
        btns: [
          { text: opts.cancelText || "取消", primary: false, value: false },
          { text: opts.okText || "确定", primary: true, danger: opts.danger, value: true },
        ],
        onBtn: v => resolve(v),
        onCloseOverride: undefined,
      });
      // 遮罩点击关闭视为取消
      const mask = document.querySelector(".mask:last-of-type");
      if (mask) mask.addEventListener("click", e => {
        if (e.target === mask) { mask.remove(); resolve(false); }
      });
    });
  }

  /** 简单输入框 sheet，返回 Promise<string|null> */
  function promptInput({ title = "请输入", placeholder = "", value = "", type = "text", max = 60 }) {
    return new Promise(resolve => {
      const s = sheet(`<div class="sheet-head"><h3>${esc(title)}</h3>
          <button class="icon-btn" data-close>${icon("close", 18)}</button></div>
        <input class="input" type="${type}" placeholder="${esc(placeholder)}" value="${esc(value)}" maxlength="${max}">
        <div class="sheet-actions">
          <button class="btn ghost" data-no>取消</button>
          <button class="btn primary" data-ok>保存</button>
        </div>`);
      const input = s.el.querySelector("input");
      s.el.querySelector("[data-ok]").onclick = () => { const v = input.value.trim(); s.close(); resolve(v); };
      s.el.querySelector("[data-no]").onclick = s.el.querySelector("[data-close]").onclick = () => { s.close(); resolve(null); };
      setTimeout(() => { input.focus(); input.select && value && input.select(); }, 120);
    });
  }

  /* ---------- 格式化 ---------- */
  function fmtMoney(n) {
    const sign = n < 0 ? "-" : "";
    return `${sign}¥${Math.abs(n).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function fmtWan(n) {
    if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
    return String(Math.round(n));
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dayStr(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtDate(ts, withYear = false) {
    const d = new Date(ts);
    const pre = withYear ? `${d.getFullYear()}-` : "";
    return `${pre}${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtDateTime(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "刚刚";
    if (min < 60) return `${min}分钟前`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}小时前`;
    const day = Math.floor(h / 24);
    if (day === 1) return "昨天";
    if (day < 7) return `${day}天前`;
    return fmtDate(ts);
  }

  /* ---------- 头像 ---------- */
  const AVATAR_GRADS = [
    "linear-gradient(135deg,#f2994a,#ef5e47)",
    "linear-gradient(135deg,#56ccf2,#2f80ed)",
    "linear-gradient(135deg,#a1e657,#43a047)",
    "linear-gradient(135deg,#f76f8e,#b23a6e)",
    "linear-gradient(135deg,#9b6cf7,#5f3dcf)",
    "linear-gradient(135deg,#f2c94c,#f2994a)",
    "linear-gradient(135deg,#48c6c0,#1f8a8a)",
    "linear-gradient(135deg,#8e9eab,#5c6b7a)",
  ];
  function avatarEl(user, size = "md") {
    const a = user && user.avatarEmoji;
    const c = (user && user.avatarColor) || 0;
    const s = size || "md";
    return `<span class="avatar ${s}" style="background:${AVATAR_GRADS[c % AVATAR_GRADS.length]}">${a || esc((user && user.nickname || "?").slice(0, 1))}</span>`;
  }

  /* ---------- 杂项 ---------- */
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function emptyBox(emoji = "🍃", title = "这里空空如也", sub = "") {
    return `<div class="empty"><div class="empty-icon">${emoji}</div>
      <div class="empty-title">${esc(title)}</div>
      ${sub ? `<div class="empty-sub">${esc(sub)}</div>` : ""}</div>`;
  }
  function debounce(fn, wait = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }
  function countUp(el, target, fmtFn, dur = 700) {
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / dur, 1);
      const v = target * (1 - Math.pow(1 - p, 3));
      el.textContent = fmtFn ? fmtFn(v) : Math.round(v);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function reflow() { /* 占位 */ }

  return {
    icon, toast, sheet, dialog, confirm, promptInput,
    fmtMoney, fmtWan, dayStr, fmtDate, fmtDateTime, fmtTime, timeAgo,
    avatarEl, esc, uid, emptyBox, debounce, countUp,
  };
})();