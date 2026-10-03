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
      <a class="uc-ava" href="profile.html" aria-label="个人信息">${UI.avatarEl(u, "xl")}</a>
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
        <a class="func-item" href="${f.href}" data-key="${f.key}" draggable="false">
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

/* ---------- 长按拖动排序（跟手幽灵 + FLIP 过渡） ---------- */
function bindSort() {
  const grid = document.getElementById("func-grid");
  if (!grid) return;

  const HOLD = 240;   // 长按判定时长
  const TOL = 12;     // 长按成立前允许的手指抖动
  const items = () => [...grid.querySelectorAll(".func-item")];
  let st = null;
  let suppressClick = false;

  // 重排后让其余卡片从旧位置平滑滑到新位置（先反转、强制回流、再过渡）
  function flip(els, before, itemEl) {
    const moved = [];
    els.forEach(el => {
      if (el === itemEl) return;
      const a = before.get(el);
      if (!a) return;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      moved.push(el);
    });
    if (!moved.length) return;
    void grid.offsetWidth;                       // 强制回流，让“反转”状态被浏览器确认
    moved.forEach(el => {
      el.style.transition = "transform .22s cubic-bezier(.22,.9,.36,1)";
      el.style.transform = "";
    });
  }

  function place(x, y) {
    const item = st.item;
    const target = items().find(el => {
      if (el === item) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    if (!target) return;
    const r = target.getBoundingClientRect();
    const ref = x > r.left + r.width / 2 ? target.nextSibling : target;
    if (ref === item || (ref && ref.previousSibling === item) || (!ref && grid.lastElementChild === item)) return;

    const els = items();
    const before = new Map(els.map(el => [el, el.getBoundingClientRect()]));
    item.style.transform = "";                       // 先清掉跟手位移，量出真实布局位置
    const a = item.getBoundingClientRect();
    grid.insertBefore(item, ref);
    const b = item.getBoundingClientRect();
    st.corrX += a.left - b.left;                     // 补偿重排造成的位移，视觉上不跳动
    st.corrY += a.top - b.top;
    flip(els, before, item);
    item.style.transform = `translate(${st.dx + st.corrX}px, ${st.dy + st.corrY}px) scale(1.04)`;
  }

  function start() {
    if (!st || st.dragging) return;
    st.dragging = true;
    st.corrX = 0; st.corrY = 0; st.dx = 0; st.dy = 0;
    st.item.classList.add("dragging");
    st.item.style.transform = "translate(0px, 0px) scale(1.04)";
    try { st.item.setPointerCapture(st.pointerId); } catch (err) { /* ignore */ }
    if (navigator.vibrate) { try { navigator.vibrate(25); } catch (err) { /* ignore */ } }
  }

  function finish() {
    if (!st || !st.dragging) { if (st) st = null; return; }
    const item = st.item;
    clearTimeout(st.timer);
    item.classList.remove("dragging");
    item.style.transform = "";
    item.style.transition = "";
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 120);
    const uid = Store.currentUser() && Store.currentUser().id;
    if (uid) { Store.saveOrder(uid, items().map(i => i.dataset.key)); UI.toast("已保存排序", "success"); }
    st = null;
  }

  grid.addEventListener("dragstart", e => e.preventDefault());
  grid.addEventListener("contextmenu", e => { if (st && st.dragging) e.preventDefault(); });
  document.addEventListener("touchmove", e => { if (st && st.dragging) e.preventDefault(); }, { passive: false });

  grid.querySelectorAll(".func-item").forEach(item => {
    item.setAttribute("draggable", "false");
    item.addEventListener("click", e => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); } });
    item.addEventListener("pointerdown", e => {
      if (e.button != null && e.button !== 0) return;
      if (st) return;
      st = { item, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dragging: false };
      st.timer = setTimeout(start, HOLD);
    });
    item.addEventListener("pointermove", e => {
      if (!st || st.item !== item) return;
      if (!st.dragging) {
        if (Math.abs(e.clientX - st.startX) > TOL || Math.abs(e.clientY - st.startY) > TOL) {
          clearTimeout(st.timer);
          st = null;
        }
        return;
      }
      e.preventDefault();
      st.dx = e.clientX - st.startX;
      st.dy = e.clientY - st.startY;
      item.style.transform = `translate(${st.dx + st.corrX}px, ${st.dy + st.corrY}px) scale(1.04)`;
      place(e.clientX, e.clientY);
    });
    item.addEventListener("pointerup", finish);
    item.addEventListener("pointercancel", finish);
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