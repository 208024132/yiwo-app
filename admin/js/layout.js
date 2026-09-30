const S = AdminShell.boot({ menu: "layout", title: "页面布局管理" });
if (S) (function(){
Theme.apply(Theme.current());

let activeTab = "text";
let gridCols = 3;
let selectedTheme = null;

const SEG = [["text", "文字信息"], ["layout", "布局"], ["theme", "颜色主题"]];
const TONES = [["grad", "渐变"], ["soft", "柔和"], ["warn", "警示"], ["dark", "深色"]];

function frame() {
  S.content.innerHTML = `
    <div class="banner-bar warn layout-banner">${UI.icon("info", 16)}<span>本页配置保存后立即同步到用户端</span></div>
    <div class="seg layout-seg">${SEG.map(([k, name]) => `<button data-seg="${k}" class="${k === activeTab ? "on" : ""}">${name}</button>`).join("")}</div>
    <div id="layout-body"></div>`;

  const body = S.content.querySelector("#layout-body");
  if (activeTab === "text") renderText(body);
  else if (activeTab === "layout") renderLayout(body);
  else renderTheme(body);

  S.content.querySelectorAll("[data-seg]").forEach(b => b.addEventListener("click", () => {
    activeTab = b.dataset.seg;
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
  const names = ["首页", "好友", "资产", "我的"];
  const tabLabels = (st.tabLabels && st.tabLabels.length ? st.tabLabels : ["首页", "好友", "资产", "我的"]);

  body.innerHTML = `
    <div class="card">
      <div class="field"><label>App 名称</label><input class="input" id="f-appname" placeholder="例如：以我" value="${UI.esc(st.appName)}"></div>
      <div class="field"><label>首页问候语</label><input class="input" id="f-greeting" placeholder="例如：你好，{nickname}，新的一天也要做自己" value="${UI.esc(st.homeGreeting)}"><div class="hint">支持 {nickname} 占位，显示时替换为用户昵称</div></div>
      <div class="field"><label>底部 Tab 文字</label>
        <div class="grid-4 tl-grid">
          ${names.map((n, i) => `<div><div class="tl-label txt-xs txt-3">${n}</div><input class="input" data-tablabel="${i}" value="${UI.esc(tabLabels[i] || "")}"></div>`).join("")}
        </div>
      </div>
      <div class="field"><label>横幅管理</label>
        <div id="banner-list">${(st.banners || []).map(b => bannerRow(b)).join("")}</div>
        <button class="btn sm ghost" id="add-banner">${UI.icon("plus", 15)} 添加横幅</button>
      </div>
      <button class="btn primary block" id="save-text">保存文字配置</button>
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
    const tabLabels = [0, 1, 2, 3].map(i => body.querySelector(`[data-tablabel="${i}"]`).value.trim());
    const banners = [...body.querySelectorAll("#banner-list .banner-row")].map(row => ({
      id: row.dataset.id,
      text: row.querySelector("[data-btext]").value.trim(),
      tone: row.querySelector("[data-btone]").value,
    }));
    Store.saveSettings({ appName, homeGreeting, tabLabels, banners });
    UI.toast("已保存，用户端立即生效", "success");
  };
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
