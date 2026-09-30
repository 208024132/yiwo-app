/* 我的页：用户卡 + 功能宫格（长按拖动排序） + 设置列表 */

UserShell.boot({ tab: "my", title: "我的" });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("my-body");

  const FUNCS = [
    { key: "moments", name: "我的动态", e: "✨", g: "linear-gradient(135deg,#f2c94c,#f2994a)", href: "moments.html" },
    { key: "bookshelf", name: "阅读书架", e: "📚", g: "linear-gradient(135deg,#48c6c0,#1f8a8a)", href: "bookshelf.html" },
    { key: "memo", name: "备忘录", e: "📝", g: "linear-gradient(135deg,#9b6cf7,#5f3dcf)", href: "memo.html" },
    { key: "fitness", name: "健身打卡", e: "🔥", g: "linear-gradient(135deg,#f76f8e,#b23a6e)", href: "fitness.html" },
    { key: "tasks", name: "任务进度", e: "🎯", g: "linear-gradient(135deg,#56ccf2,#2f80ed)", href: "tasks.html" },
    { key: "profile", name: "个人信息", e: "👤", g: "linear-gradient(135deg,#f2994a,#ef5e47)", href: "profile.html" },
  ];

  function orderedFuncs() {
    const order = Store.getOrder(u.id);
    return order.map(k => FUNCS.find(f => f.key === k)).filter(Boolean);
  }

  const curTheme = Theme.byId(Theme.current());

  body.innerHTML = `
    <section class="card user-card fade-in">
      <span class="uc-ava">${UI.avatarEl(u, "xl")}</span>
      <div class="uc-main">
        <div class="uc-name bold">${UI.esc(u.nickname)}</div>
        <div class="uc-sign txt-sm txt-2 ellipsis">${UI.esc(u.signature || "这个人很懒，什么都没写")}</div>
        <div class="uc-id txt-xs txt-3">ID：${UI.esc(u.id)}</div>
      </div>
      <a class="icon-btn uc-edit" href="profile.html" aria-label="编辑资料">${UI.icon("edit", 20)}</a>
    </section>

    <div class="sort-tip mt-16">
      ${UI.icon("info", 14)}<span class="txt-xs txt-3">长按拖动图标可调整功能顺序</span>
    </div>

    <section class="func-grid" id="func-grid">
      ${orderedFuncs().map(f => `
        <a class="func-item" href="${f.href}" data-key="${f.key}">
          <span class="q-ico" style="background:${f.g}">${f.e}</span>
          <span class="q-name">${f.name}</span>
        </a>`).join("")}
    </section>

    <section class="list mt-16 fade-in">
      <a class="list-item tap" href="theme.html">
        <span class="li-ico">${UI.icon("palette", 20)}</span>
        <span class="li-main">
          <span class="li-title">主题皮肤</span>
          <span class="li-sub">${UI.esc(curTheme.name)}</span>
        </span>
        <span class="li-arrow">${UI.icon("chevron-right", 18)}</span>
      </a>
      <a class="list-item tap" id="about-entry">
        <span class="li-ico">${UI.icon("info", 20)}</span>
        <span class="li-main"><span class="li-title">关于以我</span></span>
        <span class="li-arrow">${UI.icon("chevron-right", 18)}</span>
      </a>
      <a class="list-item tap" id="logout-entry">
        <span class="li-ico li-ico-danger">${UI.icon("logout", 20)}</span>
        <span class="li-main">
          <span class="li-title txt-danger">退出登录</span>
        </span>
      </a>
    </section>
  `;

  bindSort();
  bindList();
})();

/* ---------- 长按拖动排序 ---------- */
function bindSort() {
  const grid = document.getElementById("func-grid");
  if (!grid) return;

  let drag = null;
  let suppressClick = false;

  document.addEventListener("pointermove", e => {
    if (!drag) return;
    if (!drag.dragging) {
      if (Math.abs(e.clientX - drag.startX) > 10 || Math.abs(e.clientY - drag.startY) > 10) {
        clearTimeout(drag.timer);
        drag = null;
      }
      return;
    }
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el && el.closest(".func-item");
    if (target && target !== drag.item) {
      const pos = drag.item.compareDocumentPosition(target);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        grid.insertBefore(drag.item, target.nextSibling);
      } else {
        grid.insertBefore(drag.item, target);
      }
    }
  });

  document.addEventListener("pointerup", () => {
    if (!drag) return;
    clearTimeout(drag.timer);
    if (drag.dragging) {
      drag.item.classList.remove("dragging");
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 80);
      const keys = [...grid.querySelectorAll(".func-item")].map(i => i.dataset.key);
      Store.saveOrder(Store.currentUser().id, keys);
      UI.toast("已保存排序");
    }
    drag = null;
  });

  grid.querySelectorAll(".func-item").forEach(item => {
    item.addEventListener("click", e => { if (suppressClick) e.preventDefault(); });
    item.addEventListener("pointerdown", e => {
      if (drag) return;
      const startX = e.clientX, startY = e.clientY;
      drag = { item, startX, startY, dragging: false, timer: null };
      drag.timer = setTimeout(() => {
        drag.dragging = true;
        item.classList.add("dragging");
        if (navigator.vibrate) { try { navigator.vibrate(30); } catch (err) { /* ignore */ } }
      }, 450);
    });
  });
}

/* ---------- 列表交互 ---------- */
function bindList() {
  const about = document.getElementById("about-entry");
  if (about) {
    about.onclick = () => {
      const s = UI.sheet(`
        <div class="sheet-head"><h3>关于以我</h3><button class="icon-btn" data-close aria-label="关闭">${UI.icon("close", 18)}</button></div>
        <div class="about-box">
          <div class="about-logo">以</div>
          <div class="about-name bold">以我 APP</div>
          <div class="about-ver txt-xs txt-3">v1.0.0</div>
        </div>
        <div class="about-rows">
          <p class="txt-sm txt-2">基于思维导图「以我 APP」设计</p>
          <p class="txt-sm txt-2">演示数据存于本地</p>
        </div>`);
      s.el.querySelector("[data-close]").onclick = s.close;
    };
  }

  const logout = document.getElementById("logout-entry");
  if (logout) {
    logout.onclick = async () => {
      const ok = await UI.confirm("退出登录", "确定要退出当前账号吗？", { okText: "退出", danger: true });
      if (!ok) return;
      Store.logout();
      location.href = "login.html";
    };
  }
}