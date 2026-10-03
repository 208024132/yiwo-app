/* 首页逻辑：问候 + 横幅 + 统计 + 快捷宫格 + 最近动态 + 今日任务
   各模块显隐由管理后台「页面布局管理」控制 */

// 先初始化外壳（内部包含登录守卫，未登录会跳转 login.html）
UserShell.boot({ tab: "home", title: "", right: "avatar" });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const settings = Store.getSettings();
  const body = document.getElementById("home-body");
  const M = settings.homeModules || {};

  // 快捷入口（列数由后台控制）
  const QUICKS = [
    { name: "记账", e: "💰", g: "linear-gradient(135deg,#f2994a,#ef5e47)", href: "accounting.html" },
    { name: "健身打卡", e: "🔥", g: "linear-gradient(135deg,#f76f8e,#b23a6e)", href: "fitness.html" },
    { name: "任务进度", e: "🎯", g: "linear-gradient(135deg,#56ccf2,#2f80ed)", href: "tasks.html" },
    { name: "备忘录", e: "📝", g: "linear-gradient(135deg,#9b6cf7,#5f3dcf)", href: "memo.html" },
    { name: "阅读书架", e: "📚", g: "linear-gradient(135deg,#48c6c0,#1f8a8a)", href: "bookshelf.html" },
    { name: "我的动态", e: "✨", g: "linear-gradient(135deg,#f2c94c,#f2994a)", href: "moments.html" },
  ];

  const banners = (settings.banners || []).map(b => `
    <div class="banner-bar ${b.tone || "grad"} fade-in">${UI.icon("sparkles", 16)}<span>${UI.esc(b.text)}</span></div>`).join("");

  const summary = Store.getSummary(u.id);
  const fit = Store.fitnessOf(u.id);
  const todayExpense = summary.trend.length ? summary.trend[summary.trend.length - 1].amount : 0;

  const quickCols = settings.gridCols === 4 ? "grid-4" : "grid-3";

  let html = `
    <section class="hello-card fade-in">
      <div class="hello-hi">${UI.esc((settings.homeGreeting || "你好").replace("{nickname}", u.nickname))}</div>
      <div class="hello-sub">今天是充实的一天，继续保持 🌟</div>
    </section>
    ${M.banner ? banners : ""}`;

  if (M.stats) {
    html += `
    <section class="stat-strip fade-in">
      <div class="stat-mini">
        <span class="sm-ico">${UI.icon("wallet", 16)}</span>
        <span class="sm-label">总资产</span>
        <span class="sm-val num" data-count="${summary.balance}"></span>
      </div>
      <div class="stat-mini">
        <span class="sm-ico">${UI.icon("pie", 16)}</span>
        <span class="sm-label">今日支出</span>
        <span class="sm-val num">${UI.fmtMoney(todayExpense)}</span>
      </div>
      <div class="stat-mini">
        <span class="sm-ico">${UI.icon("flame", 16)}</span>
        <span class="sm-label">连续打卡</span>
        <span class="sm-val num">${fit.streak} 天</span>
      </div>
    </section>`;
  }

  html += `
    <section class="section-title"><h2>快捷功能</h2></section>
    <section class="quick-grid ${quickCols} fade-in">
      ${QUICKS.map(q => `
        <a class="quick-item" href="${q.href}">
          <span class="q-ico" style="background:${q.g}">${q.e}</span>
          <span class="q-name">${q.name}</span>
        </a>`).join("")}
    </section>`;

  if (M.moments) {
    const feed = Store.listMoments({ uid: u.id, scope: "friends" }).slice(0, 3);
    html += `
    <section class="section-title">
      <h2>好友动态</h2>
      <a href="friends.html" class="txt-sm txt-3 flex items-center gap-6">更多 ${UI.icon("chevron-right", 14)}</a>
    </section>
    <section class="card fade-in">
      ${feed.length ? feed.map(m => {
        const au = Store.getUser(m.uid);
        const photo = m.photos && m.photos[0];
        return `
        <div class="home-moment">
          <span class="hm-ava">${UI.avatarEl(au, "md")}</span>
          <div class="hm-main">
            <div class="hm-name ellipsis">${UI.esc(m.uid ? Store.displayName(u.id, m.uid) : au.nickname)}</div>
            <div class="hm-text clamp-2">${UI.esc(m.text || "转发了动态")}</div>
            <div class="hm-time">${UI.timeAgo(m.t)}</div>
          </div>
          ${photo ? UI.photoBox(photo, "hm-photo") : ""}
        </div>`;
      }).join("") : UI.emptyBox("🍃", "还没有好友动态", "去添加好友，看看大家都在做什么")}
    </section>`;
  }

  if (M.tasks) {
    const tasks = Store.listTasks(u.id).filter(t => t.status !== "done").slice(0, 3);
    html += `
    <section class="section-title">
      <h2>今日任务</h2>
      <a href="tasks.html" class="txt-sm txt-3 flex items-center gap-6">全部 ${UI.icon("chevron-right", 14)}</a>
    </section>
    <section class="card fade-in">
      ${tasks.length ? tasks.map(t => `
        <div class="home-task">
          <span class="tag">${UI.esc(t.tag || "任务")}</span>
          <div class="ht-main">
            <div class="ht-title ellipsis">${UI.esc(t.title)}</div>
            <div class="progress mt-8"><i style="width:${t.pct}%"></i></div>
          </div>
          <span class="ht-pct num">${t.pct}%</span>
        </div>`).join("") : UI.emptyBox("🎯", "今天没有待办任务", "添加一个任务，让生活更有条理")}
    </section>`;
  }

  body.innerHTML = html;

  // 总资产数字滚动
  const cntEl = body.querySelector("[data-count]");
  if (cntEl) UI.countUp(cntEl, summary.balance, UI.fmtMoney, 800);
})();