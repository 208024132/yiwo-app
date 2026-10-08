/* 健身打卡：概况卡 + 今日打卡 + 近14天 + 打卡日历 */
UserShell.boot({ hideTab: true, back: "my.html", title: Store.getTitle("page.fitness") });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("fitness-body");
  const SPORTS = Store.SPORTS;

  function render() {
    const f = Store.fitnessOf(u.id);
    const days = Store.fitnessDays(u.id, 14);
    const todayCount = f.today.length;
    const weekDone = f.weekCount + (todayCount ? 1 : 0);
    // 从未打卡过：展示「怎么开始」的引导
    const neverCheckedIn = !days.some(d => d.sports.length) && todayCount === 0;

    const hero = `
      <div class="fit-hero">
        <div class="fit-hero-head">
          <span class="fit-flame">🔥</span>
          <div class="fit-head-txt">
            <div class="fit-streak">连续打卡 <b>${f.streak}</b> 天</div>
            <div class="fit-today">今日已打卡 ${todayCount} 项</div>
          </div>
          <button class="icon-btn fit-edit" data-goal aria-label="设置每周目标">${UI.icon("edit", 18)}</button>
        </div>
        <div class="fit-goal-row">
          <div class="progress fit-progress"><i style="width:${f.goalPct}%"></i></div>
          <span class="fit-goal-num num">${weekDone} / ${f.goalWeekly} 次</span>
        </div>
      </div>`;

    const sports = `
      <section class="section-title"><h2>${UI.esc(Store.getTitle("fitness.today"))}</h2></section>
      <div class="sport-grid grid-3">
        ${SPORTS.map(s => `
          <div class="sport-cell ${f.today.includes(s.key) ? "on" : ""}" data-sport="${s.key}">
            <span class="sport-e">${s.e}</span>
            <span class="sport-name">${s.name}</span>
            ${f.today.includes(s.key) ? `<span class="sport-check">✓</span>` : ""}
          </div>`).join("")}
      </div>`;

    const chart = `
      <section class="section-title"><h2>${UI.esc(Store.getTitle("fitness.days"))}</h2></section>
      <div class="card fit-chart"><canvas data-h="150" data-canvas></canvas></div>`;

    const cal = `
      <section class="section-title"><h2>${UI.esc(Store.getTitle("fitness.calendar"))}</h2></section>
      <div class="card">
        <div class="cal-grid">
          ${days.map((d, i) => `
            <div class="cal-cell ${i === days.length - 1 ? "today" : ""} ${d.sports.length ? "on" : ""}">
              <span class="cal-dot">${d.sports.length ? "✓" : ""}</span>
              <span class="cal-date">${UI.esc(d.day.slice(5))}</span>
            </div>`).join("")}
        </div>
      </div>`;

    const hint = neverCheckedIn
      ? `<div class="banner-bar soft fade-in">💡 点击下方运动项，完成今天的第一次打卡，开启健身之旅</div>`
      : "";

    body.innerHTML = hero + hint + sports + chart + cal;

    const canvas = body.querySelector("[data-canvas]");
    Charts.bars(canvas, days.map(d => d.day.slice(5)), days.map(d => d.sports.length));
  }

  function openGoal() {
    const f = Store.fitnessOf(u.id);
    const s = UI.sheet(`
      <div class="sheet-head"><h3>每周目标</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <div class="field"><label>每周健身次数（1-7 次）</label>
        <input type="number" min="1" max="7" class="input" data-n value="${f.goalWeekly}"></div>
      <div class="sheet-actions"><button class="btn primary block" data-save>保存</button></div>`);
    s.el.querySelector("[data-x]").onclick = () => s.close();
    s.el.querySelector("[data-save]").onclick = () => {
      const n = Math.round(Number(s.el.querySelector("[data-n]").value));
      if (!n || n < 1 || n > 7) { UI.toast("请输入 1-7 之间的数字", "warn"); return; }
      Store.setWeeklyGoal(u.id, n);
      s.close();
      UI.toast("每周目标已更新", "success");
      render();
    };
  }

  body.addEventListener("click", e => {
    const g = e.target.closest("[data-goal]");
    if (g) { openGoal(); return; }
    const sp = e.target.closest("[data-sport]");
    if (sp) {
      const added = Store.checkin(u.id, sp.dataset.sport);
      UI.toast(added ? "打卡成功！继续加油 🔥" : "已取消打卡", added ? "success" : "info");
      render();
    }
  });

  render();
})();