/* ============================================================
   以我APP · 用户端外壳（顶栏 + 底部悬浮 Tab）
   页面脚本中调用 UserShell.boot({...}) 后再写页面逻辑。
   ============================================================ */
window.UserShell = (() => {
  let bootedShell = null;

  // 兜底默认（配置异常或为空时使用）
  const TAB_DEFS = [
    { key: "home", label: "首页", icon: "home", href: "index.html" },
    { key: "friends", label: "好友", icon: "users", href: "friends.html" },
    { key: "assets", label: "资产", icon: "wallet", href: "assets.html" },
    { key: "my", label: "我的", icon: "user", href: "my.html" },
  ];

  // 桌面端侧边栏补充的功能模块兜底（移动端由首页/我的宫格承载）
  const MODULES = [
    { key: "accounting", name: "记账", icon: "wallet", href: "accounting.html" },
    { key: "fitness", name: "健身打卡", icon: "flame", href: "fitness.html" },
    { key: "tasks", name: "任务进度", icon: "target", href: "tasks.html" },
    { key: "memo", name: "备忘录", icon: "memo", href: "memo.html" },
    { key: "bookshelf", name: "阅读书架", icon: "book", href: "bookshelf.html" },
    { key: "moments", name: "我的动态", icon: "sparkles", href: "moments.html" },
  ];

  // 底部 Tab：读后台配置（顺序 / 文字 / 图标 / 跳转），为空则回退默认
  function tabDefs() {
    let list = [];
    try { list = Store.listFeatures("tab") || []; } catch (e) { list = []; }
    if (!list.length) return TAB_DEFS.map(t => ({ ...t }));
    return list.map(f => ({ key: f.key, label: f.name, icon: f.ico, href: f.href }));
  }

  // 侧边栏「功能」：读后台配置，为空则回退默认
  function sideModules() {
    let list = [];
    try { list = Store.listFeatures("sidenav") || []; } catch (e) { list = []; }
    if (!list.length) return MODULES.map(m => ({ ...m }));
    return list.map(f => ({ key: f.key, name: f.name, icon: f.ico, href: f.href }));
  }

  function user() { return Store.currentUser(); }

  /**
   * boot({
   *   tab: 'home'|'friends'|'assets'|'my'|null,  // null 表示无 Tab 高亮（子页面）
   *   header: { title, back: 返回href(默认history.back), right: 'avatar'|null },
   *   hideTab: true 时隐藏底部 Tab（如聊天页）
   * })
   */
  function boot({ tab = null, title = "", back = null, right = null, hideTab = false } = {}) {
    const u = user();
    if (!u) { location.replace("login.html"); return null; }

    // 后台设置的默认主题为空的本地选择兜底
    try {
      if (!localStorage.getItem("yiwo_theme")) Theme.apply(Store.getSettings().defaultTheme);
    } catch (e) { /* ignore */ }

    // 云端同步：恢复上次链接并拉取/上行，不阻塞首帧，异常静默
    if (window.CloudSync) { try { CloudSync.boot(); } catch (e) { /* ignore */ } }

    const app = document.getElementById("app");
    const tabs = tabDefs();
    const modules = sideModules();

    const headBack = back !== null
      ? `<button class="head-back" data-back aria-label="返回">${UI.icon("chevron-left", 20)}</button>`
      : "";
    const headRight = right === "avatar"
      ? `<a href="my.html" class="head-side" aria-label="我的">${UI.avatarEl(u, "sm")}</a>`
      : "";
    const header = document.createElement("header");
    header.className = "app-header";
    header.innerHTML = `${headBack}
      <div class="head-title ellipsis">${UI.esc(title || Store.getSettings().appName)}</div>${headRight}`;
    app.prepend(header);

    const backBtn = header.querySelector("[data-back]");
    if (backBtn) backBtn.onclick = () => { back ? (location.href = back) : history.length > 1 ? history.back() : (location.href = "index.html"); };

    // 未读好友申请徽标 + 未读消息红点
    const pending = Store.pendingRequests(u.id).length;
    const unreadMsgs = Store.getConversations(u.id).reduce((s, c) => s + (c.unread || 0), 0);
    const friendsBadge = pending + unreadMsgs;

    // 底部 Tab（移动端；桌面端由 CSS 隐藏）
    let tabbar = null;
    if (!hideTab) {
      tabbar = document.createElement("nav");
      tabbar.className = "tabbar";
      tabbar.innerHTML = tabs.map(t => `
        <a class="tab ${tab === t.key ? "on" : ""}" href="${t.href}">
          <span class="tab-icon">${UI.icon(t.icon, 22)}</span>${UI.esc(t.label)}
          ${t.key === "friends" && friendsBadge > 0 ? `<span class="tab-badge">${friendsBadge}</span>` : ""}
        </a>`).join("");
      document.body.appendChild(tabbar);
    } else {
      app.classList.add("no-tab-page");
    }

    // 桌面端侧边导航（≥960px 显示；即使 hideTab 也保留，移动端由 CSS 隐藏）
    let sidenav = null;
    if (!document.querySelector(".side-nav")) {
      sidenav = document.createElement("aside");
      sidenav.className = "side-nav";
      const s = Store.getSettings();
      sidenav.innerHTML = `
        <div class="sn-brand">
          <div class="sn-logo">以</div>
          <div>
            <div class="sn-name">${UI.esc(s.appName)}</div>
            <div class="sn-sub">我的生活 · 双端应用</div>
          </div>
        </div>
        <nav class="sn-items">
          ${tabs.map(t => `
            <a class="sn-item ${tab === t.key ? "on" : ""}" href="${t.href}">
              <span class="sn-ico">${UI.icon(t.icon, 20)}</span>${UI.esc(t.label)}
              ${t.key === "friends" && friendsBadge > 0 ? `<span class="sn-badge">${friendsBadge}</span>` : ""}
            </a>`).join("")}
        </nav>
        <div class="sn-group">功能</div>
        <nav class="sn-items sn-modules">
          ${modules.map(m => `
            <a class="sn-item" href="${m.href}">
              <span class="sn-ico">${UI.icon(m.icon, 20)}</span>${UI.esc(m.name)}
            </a>`).join("")}
        </nav>
        <div class="sn-user">
          ${UI.avatarEl(u, "md")}
          <div class="sn-user-info">
            <div class="sn-user-name ellipsis">${UI.esc(u.nickname)}</div>
            <div class="sn-user-sub ellipsis">${UI.esc(u.account)}</div>
          </div>
          <button class="sn-logout" data-logout title="退出登录" aria-label="退出登录">${UI.icon("logout", 18)}</button>
        </div>`;
      document.body.appendChild(sidenav);
      sidenav.querySelector("[data-logout]").onclick = async () => {
        const ok = await UI.confirm("退出登录", "确定要退出当前账号吗？");
        if (!ok) return;
        if (window.Cloud) { try { await Cloud.signOut(); } catch (e) { /* ignore */ } }
        if (window.CloudSync) { try { CloudSync.reset(); } catch (e) { /* ignore */ } }
        Store.logout();
        location.replace("login.html");
      };
    }

    bootedShell = { app, header, tabbar, hideTab };
    return bootedShell;
  }


  function tabLabel(key) {
    const t = tabDefs().find(x => x.key === key);
    return t ? t.label : key;
  }

  /** 隐藏/显示底部 Tab（用于聊天页聚焦输入等场景） */
  function setTabHidden(hidden) {
    if (bootedShell && bootedShell.tabbar) bootedShell.tabbar.style.display = hidden ? "none" : "";
  }

  return { boot, setTabHidden };
})();