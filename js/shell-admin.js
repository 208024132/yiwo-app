/* ============================================================
   以我APP · 管理后台外壳（侧边栏 + 顶栏 + 登录守卫）
   菜单可见性取决于当前管理员的权限（权限取决于后台功能）。
   ============================================================ */
window.AdminShell = (() => {
  const MENUS = [
    { key: "dashboard", label: "数据总览", icon: "chart", href: "dashboard.html", perm: null },
    { key: "users", label: "用户管理", icon: "users", href: "users.html", perm: "users" },
    { key: "layout", label: "页面布局管理", icon: "palette", href: "layout.html", perm: "layout" },
    { key: "admins", label: "管理员管理", icon: "shield", href: "admins.html", perm: "admins" },
    { key: "my", label: "我的", icon: "user", href: "my.html", perm: null },
  ];

  /** boot({ menu: 'dashboard', title: '数据总览' }) */
  function boot({ menu = "dashboard", title = "" } = {}) {
    const admin = Store.currentAdmin();
    if (!admin) { location.replace("index.html"); return null; }

    // 首次登录强制改密：未改密前只能停留在「我的」页，其余后台页面一律跳回「我的」
    if (admin.mustChangePwd && menu !== "my") {
      location.replace("my.html");
      return null;
    }

    // 路由守卫：当前页面所需权限若当前管理员没有，退回数据总览（防止直接输入网址越权）
    const cur = MENUS.find(m => m.key === menu);
    if (cur && cur.perm && !Store.hasPerm(admin, cur.perm)) {
      location.replace("dashboard.html?denied=" + encodeURIComponent(cur.perm));
      return null;
    }

    document.body.classList.add("admin-body");
    const app = document.getElementById("admin-app");
    app.classList.add("admin-layout");

    const visible = MENUS.filter(m => !m.perm || Store.hasPerm(admin, m.perm));
    const side = document.createElement("aside");
    side.className = "admin-side";
    side.innerHTML = `
      <div class="admin-logo">
        <div class="logo-mark">以</div>
        <div>
          <div class="logo-name">以我 · 管理台</div>
          <div class="logo-sub">Yiwo Console</div>
        </div>
      </div>
      <nav class="admin-nav">
        ${visible.map(m => `
          <a class="nav-item ${menu === m.key ? "on" : ""}" href="${m.href}">
            <span class="tab-icon">${UI.icon(m.icon, 20)}</span><span>${UI.esc(m.label)}</span>
          </a>`).join("")}
      </nav>
      <button class="admin-side-user" data-exit title="退出登录">
        ${UI.avatarEl({ avatarEmoji: "🛡️", avatarColor: 4 }, "sm")}
        <div class="side-user-info" style="min-width:0">
          <div class="ellipsis bold txt-sm">${UI.esc(admin.name)}</div>
          <div class="txt-xs txt-3 ellipsis">${UI.esc(admin.role || "管理员")}</div>
        </div>
        <span class="li-arrow">${UI.icon("logout", 16)}</span>
      </button>`;
    app.appendChild(side);

    const main = document.createElement("div");
    main.className = "admin-main";
    main.innerHTML = `
      <div class="admin-top">
        <button class="icon-btn admin-menu-btn" data-menu title="导航菜单" aria-label="打开导航菜单">${UI.icon("menu", 20)}</button>
        <h1>${UI.esc(title)}</h1>
        <span class="tag gray admin-dept" title="${UI.esc(admin.dept || "")}">${UI.esc(admin.dept || "")}</span>
        <a class="icon-btn" href="../index.html" title="预览用户端">${UI.icon("home", 18)}</a>
      </div>
      <div class="admin-content" id="admin-content"></div>`;
    app.appendChild(main);

    // 移动端抽屉导航：遮罩 + 开关
    const mask = document.createElement("div");
    mask.className = "admin-mask";
    document.body.appendChild(mask);
    const setNav = (open) => {
      side.classList.toggle("open", open);
      mask.classList.toggle("show", open);
      document.body.classList.toggle("nav-open", open);
    };
    main.querySelector("[data-menu]").addEventListener("click", () => setNav(!side.classList.contains("open")));
    mask.addEventListener("click", () => setNav(false));
    side.querySelectorAll(".nav-item").forEach(n => n.addEventListener("click", () => setNav(false)));

    side.querySelector("[data-exit]").onclick = () => {
      Store.logout();
      location.href = "index.html";
    };

    return { admin, content: main.querySelector("#admin-content") };
  }

  return { boot, MENUS };
})();
