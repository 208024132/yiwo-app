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

  /* ---------- 总资产卡片 ---------- */
  const typeMeta = key => Store.WALLET_TYPES.find(t => t.key === key) || { e: "👛", name: "其他" };
  const money = n => Number(n || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function renderWalletCard() {
    const card = body.querySelector("#asset-card");
    if (!card) return;
    const ws = Store.walletSummary(u.id);
    card.innerHTML = `
      <div class="ac-title">💰 总资产</div>
      <div class="ac-total num">¥${money(ws.total)}</div>
      <div class="ac-split">
        <div class="ac-box"><span class="ac-box-l">可流动</span><span class="ac-box-v num">¥${money(ws.liquid)}</span></div>
        <div class="ac-box"><span class="ac-box-l">不可流动</span><span class="ac-box-v num">¥${money(ws.frozen)}</span></div>
      </div>
      <div class="ac-hint">${ws.count} 个账户 · 点击账户可编辑</div>
      ${ws.groups.map(g => `
        <div class="ac-group">
          <div class="ac-group-h">${g.name}<span class="ac-cnt">${g.items.length}</span></div>
          <div class="ac-chips">
            ${g.items.map(a => `
              <div class="ac-chip" data-id="${a.id}" role="button" tabindex="0" aria-label="编辑账户 ${UI.esc(a.name)}">
                <span class="ac-x" data-del="${a.id}" aria-label="删除账户">${UI.icon("close", 12)}</span>
                <span class="ac-chip-ico">${typeMeta(a.type).e}</span>
                <span class="ac-chip-name ellipsis">${UI.esc(a.name)}</span>
                <span class="ac-chip-val num">${money(a.balance)}</span>
              </div>`).join("")}
          </div>
        </div>`).join("")}
      <button class="ac-add" data-add>+ 添加账户</button>
    `;

    card.querySelectorAll(".ac-chip").forEach(chip => {
      chip.onclick = e => { if (e.target.closest(".ac-x")) return; openWalletSheet(chip.dataset.id); };
      chip.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWalletSheet(chip.dataset.id); }
      };
    });
    card.querySelectorAll(".ac-x").forEach(x => {
      x.onclick = async e => {
        e.stopPropagation();
        const id = x.dataset.del;
        const acc = Store.listWallets(u.id).find(a => a.id === id);
        const ok = await UI.confirm("删除这个账户？", `「${acc ? acc.name : "该账户"}」将从总资产中移除。`, { okText: "删除", danger: true });
        if (!ok) return;
        const removed = Store.delWallet(u.id, id);
        renderWalletCard();
        if (!removed) return;
        UI.toastAction("账户已删除", {
          label: "撤销",
          onAct: () => { Store.restoreWallet(u.id, removed); renderWalletCard(); UI.toast("已恢复账户", "success"); },
        });
      };
    });
    card.querySelector("[data-add]").onclick = () => openWalletSheet(null);
  }

  function openWalletSheet(id) {
    const editing = id ? Store.listWallets(u.id).find(a => a.id === id) : null;
    let type = editing ? editing.type : "bank";
    let liquid = editing ? editing.liquid : true;

    const s = UI.sheet(`
      <div class="sheet-head"><h3>${editing ? "编辑账户" : "添加账户"}</h3><button class="icon-btn" data-close aria-label="关闭">${UI.icon("close", 18)}</button></div>
      <div class="field"><label>账户名称</label><input class="input" type="text" maxlength="12" placeholder="如：招商银行" value="${editing ? UI.esc(editing.name) : ""}" data-name></div>
      <div class="field"><label>类型</label>
        <div class="seg seg-wtype">
          ${Store.WALLET_TYPES.map(t => `<button data-wtype="${t.key}" class="${t.key === type ? "on" : ""}">${t.e} ${t.name}</button>`).join("")}
        </div>
      </div>
      <div class="field"><label>资金性质</label>
        <div class="seg seg-liquid">
          <button data-liquid="1" class="${liquid ? "on" : ""}">可流动</button>
          <button data-liquid="0" class="${!liquid ? "on" : ""}">不可流动</button>
        </div>
      </div>
      <div class="field"><label>余额</label><input class="input" type="number" step="0.01" inputmode="decimal" placeholder="0.00" value="${editing ? editing.balance : ""}" data-bal></div>
      <div class="sheet-actions"><button class="btn primary block" data-save>保存</button></div>
    `);
    s.el.querySelector("[data-close]").onclick = s.close;

    const segType = s.el.querySelector(".seg-wtype");
    const segLiq = s.el.querySelector(".seg-liquid");
    segType.querySelectorAll("button").forEach(b => {
      b.onclick = () => { type = b.dataset.wtype; segType.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); };
    });
    segLiq.querySelectorAll("button").forEach(b => {
      b.onclick = () => { liquid = b.dataset.liquid === "1"; segLiq.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); };
    });

    const nameInput = s.el.querySelector("[data-name]");
    const balInput = s.el.querySelector("[data-bal]");
    s.el.querySelector("[data-save]").onclick = () => {
      const name = nameInput.value.trim();
      if (!name) { UI.toast("请输入账户名称", "warn"); return; }
      const balance = Number(balInput.value) || 0;
      if (editing) Store.updateWallet(u.id, editing.id, { name, type, liquid, balance });
      else Store.addWallet(u.id, { name, type, liquid, balance });
      s.close();
      UI.toast(editing ? "账户已更新" : "账户已添加", "success");
      renderWalletCard();
    };
    setTimeout(() => nameInput.focus(), 150);
  }

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
    <section class="asset-card fade-in" id="asset-card"></section>

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

  // 总资产账户卡片
  renderWalletCard();

  // 近 7 日支出折线
  const lineCanvas = body.querySelector(".chart-box canvas");
  if (lineCanvas) Charts.line(lineCanvas, summary.trend.map(t => t.day), summary.trend.map(t => t.amount));

  // 支出分类环形
  const donutCanvas = body.querySelector(".donut-canvas canvas");
  if (donutCanvas && donutItems.length) Charts.donut(donutCanvas, donutItems, { centerLabel: "支出" });

  body.querySelector("#go-accounting").onclick = () => { location.href = "accounting.html"; };
})();