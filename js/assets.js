/* 资产页：余额总览 + 近 7 日支出折线 + 支出分类环形 + 最近记录 */

UserShell.boot({ tab: "assets", title: "资产" });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("assets-body");
  const summary = Store.getSummary(u.id);
  const CATS = Store.CATS;
  const PALETTE = ["#f2994a", "#56ccf2", "#9b6cf7", "#f76f8e", "#48c6c0", "#f2c94c", "#8e9eab", "#a1e657"];

  const catName = key => { const c = CATS.find(x => x.key === key); return c ? c.name : String(key); };
  const catEmoji = key => { const c = CATS.find(x => x.key === key); return c ? c.e : "📦"; };

  // 支出分类：前 5 项 + 其余合并为「其他」
  const top5 = summary.byCat.slice(0, 5);
  const rest = summary.byCat.slice(5);
  const donutItems = top5.map((it, i) => ({ label: catName(it.cat), value: it.amount, color: PALETTE[i % PALETTE.length] }));
  if (rest.length) {
    const restTotal = rest.reduce((s, it) => s + it.amount, 0);
    donutItems.push({ label: "其他", value: restTotal, color: PALETTE[6] });
  }

  const recent = Store.listRecords(u.id).slice(0, 5);

  const catBlock = summary.byCat.length
    ? `
      <div class="donut-wrap">
        <div class="donut-canvas"><canvas data-h="160"></canvas></div>
        <div class="legend">
          ${donutItems.map(it => `
            <div class="lg-item">
              <span class="lg-dot" style="background:${it.color}"></span>
              <span class="lg-name ellipsis">${UI.esc(it.label)}</span>
              <span class="lg-amt num">${UI.fmtMoney(it.value)}</span>
            </div>`).join("")}
        </div>
      </div>`
    : UI.emptyBox("📊", "暂无支出记录", "记一笔，看看钱都花到哪儿了");

  body.innerHTML = `
    <section class="hello-card fade-in">
      <div class="balance-label">总资产（元）</div>
      <div class="balance-val num" data-balance>${UI.fmtMoney(summary.balance)}</div>
      <div class="balance-sub">
        <span class="bs-item">收入 +${UI.fmtMoney(summary.income)}</span>
        <span class="bs-item">支出 -${UI.fmtMoney(summary.expense)}</span>
      </div>
    </section>

    <section class="section-title"><h2>近 7 日支出</h2></section>
    <section class="card fade-in">
      <div class="chart-box"><canvas></canvas></div>
    </section>

    <section class="section-title"><h2>支出分类</h2></section>
    <section class="card fade-in">${catBlock}</section>

    <section class="section-title"><h2>最近记录</h2></section>
    <section class="card fade-in">
      ${recent.length ? recent.map(r => {
        const isIn = r.type === "in";
        return `
        <div class="rec-item">
          <span class="rec-ico">${catEmoji(r.cat)}</span>
          <div class="rec-main">
            <div class="rec-note ellipsis">${UI.esc(r.note || catName(r.cat))}</div>
            <div class="rec-date">${UI.fmtDate(r.t)}</div>
          </div>
          <span class="rec-amt ${isIn ? "in" : "out"} num">${isIn ? "+" : "-"}${UI.fmtMoney(r.amount)}</span>
        </div>`;
      }).join("") : UI.emptyBox("💸", "还没有记账", "点下方「记一笔」开始记录生活")}
    </section>

    <button class="btn primary block mt-16 fade-in" id="go-accounting">记一笔</button>
  `;

  // 总资产数字滚动
  const bal = body.querySelector("[data-balance]");
  if (bal) UI.countUp(bal, summary.balance, UI.fmtMoney, 900);

  // 近 7 日支出折线
  const lineCanvas = body.querySelector(".chart-box canvas");
  if (lineCanvas) Charts.line(lineCanvas, summary.trend.map(t => t.day), summary.trend.map(t => t.amount));

  // 支出分类环形
  const donutCanvas = body.querySelector(".donut-canvas canvas");
  if (donutCanvas && donutItems.length) Charts.donut(donutCanvas, donutItems, { centerLabel: "支出" });

  body.querySelector("#go-accounting").onclick = () => { location.href = "accounting.html"; };
})();