const S = AdminShell.boot({ menu: "layout", title: "页面布局管理" });
if (S) (function(){
Theme.apply(Theme.current());

let activeTab = "text";
let gridCols = 3;
let selectedTheme = null;

const SEG = [["text", "文字信息"], ["features", "功能管理"], ["layout", "布局"], ["theme", "颜色主题"]];
const TONES = [["grad", "渐变"], ["soft", "柔和"], ["warn", "警示"], ["dark", "深色"]];

// 功能管理：当前展示位与可选素材
let featSurface = "tab";
let featData = [];
let picker = null; // { index, kind: "icon" | "grad" }

const EMOJIS = ["📊", "💰", "🔥", "🎯", "📝", "📚", "✨", "👤", "🎨", "🛡️", "ℹ️", "🏃", "🍜", "🛍️", "🎮", "🏠", "💊", "📦", "⭐", "❤️", "🔔", "📷", "🌙", "⚙️", "🏆", "📌", "💬", "🧘"];
const ICON_NAMES = ["home", "users", "wallet", "user", "plus", "search", "send", "more", "menu", "like", "comment", "share", "camera", "edit", "trash", "check", "close", "bell", "book", "memo", "flame", "target", "calendar", "chart", "pie", "lock", "logout", "refresh", "shield", "layers", "palette", "sliders", "sparkles", "image", "info", "clock", "medal", "pin", "moon"];
const GRADS = [
  "linear-gradient(135deg,#f2994a,#ef5e47)",
  "linear-gradient(135deg,#f76f8e,#b23a6e)",
  "linear-gradient(135deg,#56ccf2,#2f80ed)",
  "linear-gradient(135deg,#9b6cf7,#5f3dcf)",
  "linear-gradient(135deg,#48c6c0,#1f8a8a)",
  "linear-gradient(135deg,#f2c94c,#f2994a)",
  "linear-gradient(135deg,#43e97b,#38f9d7)",
  "linear-gradient(135deg,#4facfe,#00f2fe)",
  "linear-gradient(135deg,#fa709a,#fee140)",
  "linear-gradient(135deg,#a18cd1,#fbc2eb)",
];
// 小标题分组：[分组名, [键...]]
const TITLE_GROUPS = [
  ["首页", ["home.quick", "home.moments", "home.tasks"]],
  ["资产页", ["assets.trend", "assets.cat", "assets.recent"]],
  ["健身页", ["fitness.today", "fitness.days", "fitness.calendar"]],
  ["好友与动态", ["page.friends", "friend.moments", "page.addFriend", "addFriend.result", "addFriend.recommend"]],
  ["页面顶栏标题", ["page.accounting", "page.fitness", "page.tasks", "page.memo", "page.bookshelf", "page.moments", "page.profile", "page.assets", "page.my", "page.theme"]],
];

const isEmojiSurface = () => featSurface === "home" || featSurface === "my";

function frame() {
  S.content.innerHTML = `
    <div class="banner-bar warn layout-banner">${UI.icon("info", 16)}<span>本页配置保存后立即同步到用户端</span></div>
    <div class="seg layout-seg">${SEG.map(([k, name]) => `<button data-seg="${k}" class="${k === activeTab ? "on" : ""}">${name}</button>`).join("")}</div>
    <div id="layout-body"></div>`;

  const body = S.content.querySelector("#layout-body");
  if (activeTab === "text") renderText(body);
  else if (activeTab === "features") { featData = Store.listSurface(featSurface); renderFeatures(body); }
  else if (activeTab === "layout") renderLayout(body);
  else renderTheme(body);

  S.content.querySelectorAll("[data-seg]").forEach(b => b.addEventListener("click", () => {
    activeTab = b.dataset.seg;
    picker = null;
    frame();
  }));
}

function bannerRow(b) {
  return `<div class="banner-row" data-id="${UI.esc(b.id)}">
    <input class="input" data-btext placeholder="横幅文案" value="${UI.esc(b.text)}">
    <select class="select" data-btone>
      ${TONES.map(([v, n]) => `<option value="${v}" ${b.tone === v ? "selected" : ""}>${n}</option>`).join("")}
    </select>
    <button class="icon-btn" data-del title="删除">${UI.icon("trash", 18)}</button>
  </div>`;
}

function renderText(body) {
  const st = Store.getSettings();
  const tabs = Store.listSurface("tab");
  const titles = Store.getTitles();

  body.innerHTML = `
    <div class="card">
      <div class="field"><label>App 名称</label><input class="input" id="f-appname" placeholder="例如：以我" value="${UI.esc(st.appName)}"></div>
      <div class="field"><label>首页问候语</label><input class="input" id="f-greeting" placeholder="例如：你好，{nickname}，新的一天也要做自己" value="${UI.esc(st.homeGreeting)}"><div class="hint">支持 {nickname} 占位，显示时替换为用户昵称</div></div>
      <div class="field"><label>底部 Tab 文字</label>
        <div class="grid-4 tl-grid">
          ${tabs.map(t => `<div><div class="tl-label txt-xs txt-3">${UI.esc(t.key)}</div><input class="input" data-tabname="${UI.esc(t.key)}" value="${UI.esc(t.name)}"></div>`).join("")}
        </div>
        <div class="hint">Tab 的顺序、图标与显隐请到「功能管理」面板调整</div>
      </div>
      <div class="field"><label>横幅管理</label>
        <div id="banner-list">${(st.banners || []).map(b => bannerRow(b)).join("")}</div>
        <button class="btn sm ghost" id="add-banner">${UI.icon("plus", 15)} 添加横幅</button>
      </div>
      <button class="btn primary block" id="save-text">保存文字配置</button>
    </div>

    <div class="card mt-16">
      <div class="set-title">页面小标题</div>
      <div class="hint">用户端各页面内的小标题与顶栏标题，留空则恢复默认文案</div>
      ${TITLE_GROUPS.map(([gname, keys]) => `
        <div class="title-group">
          <div class="title-group-name">${UI.esc(gname)}</div>
          <div class="grid-2 tl-grid">
            ${keys.map(k => `<div>
              <div class="tl-label txt-xs txt-3">${UI.esc(Store.TITLE_DEFS[k] || k)}</div>
              <input class="input" data-title="${UI.esc(k)}" value="${UI.esc(titles[k] || "")}">
            </div>`).join("")}
          </div>
        </div>`).join("")}
      <button class="btn primary block mt-8" id="save-titles">保存小标题</button>
    </div>`;

  body.querySelector("#banner-list").addEventListener("click", e => {
    const del = e.target.closest("[data-del]");
    if (del) del.closest(".banner-row").remove();
  });
  body.querySelector("#add-banner").onclick = () => {
    const list = body.querySelector("#banner-list");
    list.insertAdjacentHTML("beforeend", bannerRow({ id: UI.uid(), text: "", tone: "grad" }));
  };
  body.querySelector("#save-text").onclick = () => {
    const appName = body.querySelector("#f-appname").value.trim();
    const homeGreeting = body.querySelector("#f-greeting").value;
    const banners = [...body.querySelectorAll("#banner-list .banner-row")].map(row => ({
      id: row.dataset.id,
      text: row.querySelector("[data-btext]").value.trim(),
      tone: row.querySelector("[data-btone]").value,
    }));
    // Tab 文字写入功能目录（与「功能管理」共用一份数据）
    let err = null;
    body.querySelectorAll("[data-tabname]").forEach(inp => {
      const r = Store.updateCatalogItem(inp.dataset.tabname, { name: inp.value.trim() });
      if (!r.ok && !err) err = r.msg;
    });
    if (err) { UI.toast(err, "error"); return; }
    Store.saveSettings({ appName, homeGreeting, banners });
    UI.toast("已保存，用户端立即生效", "success");
  };
  body.querySelector("#save-titles").onclick = () => {
    const patch = {};
    body.querySelectorAll("[data-title]").forEach(inp => { patch[inp.dataset.title] = inp.value; });
    Store.saveTitles(patch);
    UI.toast("小标题已保存，用户端立即生效", "success");
  };
}

/* ---------- 功能管理 ---------- */
function renderFeatures(body) {
  const emoji = isEmojiSurface();
  const surfaces = Object.keys(Store.SURFACE_NAMES);

  body.innerHTML = `
    <div class="seg layout-seg" id="feat-seg">
      ${surfaces.map(k => `<button data-surface="${k}" class="${k === featSurface ? "on" : ""}">${UI.esc(Store.SURFACE_NAMES[k])}</button>`).join("")}
    </div>
    <div class="card">
      <div class="hint mb-8">拖动 ☰ 或使用 ▲▼ 调整顺序；关掉开关可隐藏该功能。图标与配色点右侧按钮修改。</div>
      <div class="feat-list" id="feat-list">
        ${featData.map((f, i) => featRow(f, i, emoji)).join("")}
      </div>
      <div id="feat-picker"></div>
      <div class="feat-actions mt-8">
        <button class="btn primary" id="save-features">保存功能配置</button>
        <button class="btn ghost danger" id="reset-features">恢复默认</button>
      </div>
    </div>`;

  body.querySelectorAll("[data-surface]").forEach(b => b.addEventListener("click", () => {
    featSurface = b.dataset.surface;
    featData = Store.listSurface(featSurface);
    picker = null;
    renderFeatures(body);
  }));

  const list = body.querySelector("#feat-list");
  const pickerBox = body.querySelector("#feat-picker");

  const syncName = () => {
    list.querySelectorAll(".feat-row").forEach((row, i) => {
      const inp = row.querySelector("[data-name]");
      if (inp && featData[i]) featData[i].name = inp.value.trim();
    });
  };

  list.addEventListener("input", e => {
    const row = e.target.closest(".feat-row");
    if (!row) return;
    const i = [...list.querySelectorAll(".feat-row")].indexOf(row);
    if (i < 0) return;
    if (e.target.matches("[data-name]")) featData[i].name = e.target.value.trim();
  });
  list.addEventListener("change", e => {
    const row = e.target.closest(".feat-row");
    if (!row) return;
    const i = [...list.querySelectorAll(".feat-row")].indexOf(row);
    if (i < 0) return;
    if (e.target.matches("[data-vis]")) featData[i].visible = e.target.checked;
  });
  list.addEventListener("click", e => {
    const row = e.target.closest(".feat-row");
    if (!row) return;
    const rows = [...list.querySelectorAll(".feat-row")];
    const i = rows.indexOf(row);
    if (i < 0) return;
    if (e.target.closest("[data-up]")) { syncName(); if (i > 0) { const t = featData[i - 1]; featData[i - 1] = featData[i]; featData[i] = t; renderFeatures(body); return; } }
    if (e.target.closest("[data-down]")) { syncName(); if (i < featData.length - 1) { const t = featData[i + 1]; featData[i + 1] = featData[i]; featData[i] = t; renderFeatures(body); return; } }
    if (e.target.closest("[data-pick-ico]")) { syncName(); picker = { index: i, kind: "icon" }; openPicker(pickerBox); return; }
    if (e.target.closest("[data-pick-g]")) { syncName(); picker = { index: i, kind: "grad" }; openPicker(pickerBox); return; }
  });

  // 原生拖拽排序
  let dragFrom = null;
  list.addEventListener("dragstart", e => {
    const row = e.target.closest(".feat-row");
    if (!row || !e.target.closest("[data-drag]")) { e.preventDefault(); return; }
    dragFrom = [...list.querySelectorAll(".feat-row")].indexOf(row);
    row.classList.add("dragging");
  });
  list.addEventListener("dragover", e => {
    e.preventDefault();
    const row = e.target.closest(".feat-row");
    if (!row) return;
    list.querySelectorAll(".feat-row").forEach(r => r.classList.toggle("over", r === row));
  });
  list.addEventListener("drop", e => {
    e.preventDefault();
    const row = e.target.closest(".feat-row");
    if (!row || dragFrom === null) return;
    const rows = [...list.querySelectorAll(".feat-row")];
    const to = rows.indexOf(row);
    if (to < 0 || to === dragFrom) return;
    syncName();
    const [moved] = featData.splice(dragFrom, 1);
    featData.splice(to, 0, moved);
    renderFeatures(body);
  });
  list.addEventListener("dragend", () => { dragFrom = null; });

  function openPicker(box) {
    const f = featData[picker.index];
    if (!f) return;
    if (picker.kind === "icon") {
      const opts = isEmojiSurface()
        ? EMOJIS.map(v => `<button class="ico-pick ${f.e === v ? "on" : ""}" data-val="${v}">${v}</button>`).join("")
        : ICON_NAMES.map(v => `<button class="ico-pick ${f.ico === v ? "on" : ""}" data-val="${v}">${UI.icon(v, 20)}</button>`).join("");
      box.innerHTML = `<div class="picker-box"><div class="picker-head">选择图标<span class="txt-xs txt-3">　${UI.esc(f.name)}</span><button class="icon-btn" data-picker-close aria-label="关闭">${UI.icon("close", 16)}</button></div><div class="ico-pick-grid">${opts}</div></div>`;
    } else {
      const opts = GRADS.map(v => `<button class="grad-pick ${f.g === v ? "on" : ""}" data-val="${v}" style="background:${v}"></button>`).join("");
      box.innerHTML = `<div class="picker-box"><div class="picker-head">选择配色<span class="txt-xs txt-3">　${UI.esc(f.name)}</span><button class="icon-btn" data-picker-close aria-label="关闭">${UI.icon("close", 16)}</button></div><div class="grad-pick-grid">${opts}<button class="grad-pick none ${!f.g ? "on" : ""}" data-val="">无</button></div></div>`;
    }
    box.querySelector("[data-picker-close]").onclick = () => { picker = null; box.innerHTML = ""; };
    box.querySelectorAll("[data-val]").forEach(b => b.onclick = () => {
      const v = b.dataset.val;
      if (picker.kind === "icon") { if (isEmojiSurface()) featData[picker.index].e = v; else featData[picker.index].ico = v; }
      else featData[picker.index].g = v;
      picker = null;
      renderFeatures(body);
    });
  }

  body.querySelector("#save-features").onclick = () => {
    syncName();
    if (featSurface === "tab" && featData.filter(f => f.visible !== false).length < 2) {
      UI.toast("底部 Tab 至少保留 2 个功能", "error");
      return;
    }
    let err = null;
    featData.forEach(f => {
      const r = Store.updateCatalogItem(f.key, { name: f.name, e: f.e, ico: f.ico, g: f.g });
      if (!r.ok && !err) err = r.msg;
    });
    if (err) { UI.toast(err, "error"); return; }
    const r = Store.setSurface(featSurface, featData.map(f => f.key));
    if (!r.ok) { UI.toast(r.msg, "error"); return; }
    featData.forEach(f => Store.setFeatureVisible(featSurface, f.key, f.visible !== false));
    UI.toast("功能配置已保存，用户端立即生效", "success");
  };

  body.querySelector("#reset-features").onclick = async () => {
    const ok = await UI.confirm("恢复默认", "将把所有功能名称、图标、配色、顺序与显隐恢复为默认，确定继续？", { okText: "恢复", danger: true });
    if (!ok) return;
    Store.resetFeatures();
    picker = null;
    featData = Store.listSurface(featSurface);
    renderFeatures(body);
    UI.toast("已恢复默认功能配置", "success");
  };
}

function featRow(f, i, emoji) {
  const icoHtml = emoji
    ? `<span class="feat-ico" style="background:${f.g || "var(--card-2)"}">${UI.esc(f.e || "•")}</span>`
    : `<span class="feat-ico svg">${UI.icon(f.ico, 20)}</span>`;
  return `
    <div class="feat-row" data-key="${UI.esc(f.key)}" draggable="true">
      <span class="feat-drag" data-drag title="拖动排序">${UI.icon("menu", 16)}</span>
      ${icoHtml}
      <input class="input feat-name" data-name value="${UI.esc(f.name)}" maxlength="8">
      <button class="icon-btn" data-up title="上移">${UI.icon("chevron-left", 16)}</button>
      <button class="icon-btn" data-down title="下移">${UI.icon("chevron-right", 16)}</button>
      ${emoji ? `<button class="btn sm ghost" data-pick-g>配色</button>` : ""}
      <button class="btn sm ghost" data-pick-ico>图标</button>
      <label class="switch"><input type="checkbox" data-vis ${f.visible !== false ? "checked" : ""}><span class="track"></span></label>
    </div>`;
}


function renderLayout(body) {
  const st = Store.getSettings();
  const M = st.homeModules || {};
  gridCols = st.gridCols === 4 ? 4 : 3;
  const items = [
    ["banner", "首页横幅", "顶部欢迎横幅"],
    ["stats", "首页统计卡", "总资产 / 今日支出 / 连续打卡"],
    ["moments", "好友动态模块", "首页好友动态列表"],
    ["tasks", "今日任务模块", "首页待办任务"],
  ];

  body.innerHTML = `
    <div class="list">
      ${items.map(([k, t, sub]) => `
        <div class="set-row">
          <div class="set-main"><div class="set-title">${t}</div><div class="set-sub">${sub}</div></div>
          <label class="switch"><input type="checkbox" data-mod="${k}" ${M[k] ? "checked" : ""}><span class="track"></span></label>
        </div>`).join("")}
    </div>
    <div class="card mt-16">
      <div class="field"><label>快捷宫格列数</label>
        <div class="seg">
          <button data-col="3" class="${gridCols === 3 ? "on" : ""}">3 列</button>
          <button data-col="4" class="${gridCols === 4 ? "on" : ""}">4 列</button>
        </div>
      </div>
      <button class="btn primary block mt-8" id="save-layout">保存布局</button>
    </div>`;

  const colBtns = body.querySelectorAll("[data-col]");
  colBtns.forEach(b => b.addEventListener("click", () => {
    gridCols = Number(b.dataset.col);
    colBtns.forEach(x => x.classList.toggle("on", x === b));
  }));
  body.querySelector("#save-layout").onclick = () => {
    const homeModules = {};
    body.querySelectorAll("[data-mod]").forEach(i => homeModules[i.dataset.mod] = i.checked);
    Store.saveSettings({ homeModules, gridCols });
    UI.toast("已保存，用户端立即生效", "success");
  };
}

function renderTheme(body) {
  const st = Store.getSettings();
  selectedTheme = st.defaultTheme;
  body.innerHTML = `
    <div class="theme-grid grid-2">
      ${Theme.THEMES.map(t => `
        <div class="theme-card ${selectedTheme === t.id ? "on" : ""}" data-theme="${t.id}">
          <div class="theme-swatch" style="background:linear-gradient(135deg, ${t.swatch.join(", ")})"></div>
          <div class="theme-name bold">${UI.esc(t.name)} ${t.dark ? `<span class="tag gray sm">深色</span>` : ""}</div>
          <div class="txt-2 txt-xs mt-8">${UI.esc(t.desc)}</div>
          <div class="theme-check">${UI.icon("check", 15)}</div>
        </div>`).join("")}
    </div>
    <div class="mt-16"><button class="btn primary block" id="save-theme">保存为默认主题</button></div>`;

  body.querySelectorAll("[data-theme]").forEach(c => c.addEventListener("click", () => {
    selectedTheme = c.dataset.theme;
    Theme.apply(selectedTheme);
    body.querySelectorAll("[data-theme]").forEach(x => x.classList.toggle("on", x === c));
  }));
  body.querySelector("#save-theme").onclick = () => {
    Store.saveSettings({ defaultTheme: selectedTheme });
    UI.toast("已设为用户端默认主题", "success");
  };
}

frame();})();
