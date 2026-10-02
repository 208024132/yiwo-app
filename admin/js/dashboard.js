const S = AdminShell.boot({ menu: "dashboard", title: "数据总览" });
if (S) (function(){
Theme.apply(Theme.current());

// 越权访问被拦截后的提示
const denied = new URLSearchParams(location.search).get("denied");
if (denied) {
  const p = Store.PERMS.find(x => x.key === denied);
  UI.toast("无权限访问：" + (p ? p.name : denied), "error");
  try { history.replaceState(null, "", "dashboard.html"); } catch (e) {}
}

const d = Store.dashboard();
const GENDER_COLORS = { "男": "#3d7fc4", "女": "#f76f8e", "保密": "#8e9eab" };

S.content.innerHTML = `
  <div class="db-stats grid-4">
    <div class="stat-card">
      <div class="stat-ico">${UI.icon("chart", 20)}</div>
      <div class="stat-label">总用户</div>
      <div class="stat-val num">${d.total}</div>
      <div class="stat-sub">全部注册用户</div>
    </div>
    <div class="stat-card">
      <div class="stat-ico">${UI.icon("users", 20)}</div>
      <div class="stat-label">今日新增</div>
      <div class="stat-val num">${d.todayNew}</div>
      <div class="stat-sub">今日注册</div>
    </div>
    <div class="stat-card">
      <div class="stat-ico">${UI.icon("wallet", 20)}</div>
      <div class="stat-label">全局资产总额</div>
      <div class="stat-val num">${UI.fmtMoney(d.totalAssets)}</div>
      <div class="stat-sub">全部用户资产净额</div>
    </div>
    <div class="stat-card">
      <div class="stat-ico">${UI.icon("comment", 20)}</div>
      <div class="stat-label">动态总数</div>
      <div class="stat-val num">${d.momentCount}</div>
      <div class="stat-sub">全部用户发布动态</div>
    </div>
  </div>

  <div class="db-grid grid-2">
    <div class="card db-panel">
      <div class="panel-head"><h3>近7日新增用户</h3></div>
      <div class="chart-box"><canvas id="c-trend" data-h="180"></canvas></div>
    </div>
    <div class="card db-panel">
      <div class="panel-head"><h3>性别分布</h3></div>
      <div class="chart-box"><canvas id="c-gender" data-h="180"></canvas></div>
    </div>
    <div class="card db-panel">
      <div class="panel-head"><h3>地区分布</h3></div>
      <div class="chart-box"><canvas id="c-region" data-h="180"></canvas></div>
    </div>
    <div class="card db-panel">
      <div class="panel-head"><h3>最近注册用户</h3></div>
      <div class="list">
        ${d.recentUsers.map(u => `
          <div class="list-item">
            ${UI.avatarEl(u, "md")}
            <div class="li-main">
              <div class="li-title ellipsis">${UI.esc(u.nickname)}</div>
              <div class="li-sub ellipsis">${UI.esc(u.account)}</div>
            </div>
            <div class="txt-xs txt-3">${UI.fmtDateTime(u.regTime)}</div>
          </div>`).join("")}
      </div>
    </div>
  </div>`;

Charts.line(S.content.querySelector("#c-trend"), d.trend.map(t => t.day), d.trend.map(t => t.count));
Charts.donut(S.content.querySelector("#c-gender"),
  d.gender.map(g => ({ label: g.name, value: g.value, color: GENDER_COLORS[g.name] || "#8e9eab" })),
  { centerLabel: "人数" });
Charts.bars(S.content.querySelector("#c-region"), d.region.map(r => r.name), d.region.map(r => r.value));})();
