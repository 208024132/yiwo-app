/* 资产页：余额总览 + 近 7 日支出折线 + 支出分类环形 + 最近记录 */

UserShell.boot({ tab: "assets", title: "资产" });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("assets-body");
  const CATS = Store.CATS;
  const PALETTE = ["#f2994a", "#56ccf2", "#9b6cf7", "#f76f8e", "#48c6c0", "#f2c94c", "#8e9eab", "#a1e657"];

  const catName = key => { const c = CATS.find(x => x.key === key); return c ? c.name : String(key); };
  const catEmoji = key => { const c = CATS.find(x => x.key === key); return c ? c.e : "📦"; };

  /* ---------- 总资产卡片 ---------- */
  const typeMeta = key => Store.WALLET_TYPES.find(t => t.key === key) || { e: "👛", name: "其他" };
  const money = n => Number(n || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let folded = false;
  try { folded = localStorage.getItem("yiwo_assets_fold") === "1"; } catch (e) { /* 忽略隐私模式 */ }

  function renderWalletCard() {
    const card = body.querySelector("#asset-card");
    if (!card) return;
    const ws = Store.walletSummary(u.id);
    card.innerHTML = `
      <div class="ac-head">
        <span class="ac-title">💰 总资产</span>
        <button class="ac-fold" data-fold aria-label="${folded ? "展开资产卡" : "折叠资产卡"}" aria-expanded="${!folded}">${UI.icon("chevron-down", 18)}</button>
      </div>
      <div class="ac-total num">¥${money(ws.total)}</div>
      <div class="ac-net">
        <span class="ac-net-l">净资产（总资产 − 负债）</span>
        <span class="ac-net-v num ${ws.net < 0 ? "neg" : ""}">¥${money(ws.net)}</span>
      </div>
      <div class="ac-split">
        <div class="ac-box"><span class="ac-box-l">可流动</span><span class="ac-box-v num">¥${money(ws.liquid)}</span></div>
        <div class="ac-box"><span class="ac-box-l">不可流动</span><span class="ac-box-v num">¥${money(ws.frozen)}</span></div>
      </div>
      <div class="ac-hint">${ws.count} 个账户 · ${ws.debts.length} 项负债 · 点击可编辑</div>
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

      <div class="ac-debt">
        <div class="ac-debt-h">
          <span class="ac-debt-title">负债</span>
          <span class="ac-debt-total num">¥${money(ws.debt)}</span>
        </div>
        ${ws.debts.length ? `
        <div class="ac-chips">
          ${ws.debts.map(d => `
            <div class="ac-chip ac-chip-debt" data-did="${d.id}" role="button" tabindex="0" aria-label="编辑负债 ${UI.esc(d.name)}">
              <span class="ac-x" data-ddel="${d.id}" aria-label="删除负债">${UI.icon("close", 12)}</span>
              <span class="ac-chip-ico">💳</span>
              <span class="ac-chip-name ellipsis">${UI.esc(d.name)}</span>
              <span class="ac-chip-val num">${money(d.amount)}</span>
            </div>`).join("")}
        </div>` : `<div class="ac-hint ac-hint-debt">还没有负债记录</div>`}
        <button class="ac-add ac-add-debt" data-add-debt>+ 添加负债</button>
      </div>
    `;

    card.classList.toggle("folded", folded);
    card.querySelector("[data-fold]").onclick = () => {
      folded = !folded;
      try { localStorage.setItem("yiwo_assets_fold", folded ? "1" : "0"); } catch (e) { /* 忽略 */ }
      card.classList.toggle("folded", folded);
      const btn = card.querySelector("[data-fold]");
      if (btn) { btn.setAttribute("aria-expanded", String(!folded)); btn.setAttribute("aria-label", folded ? "展开资产卡" : "折叠资产卡"); }
    };

    card.querySelectorAll(".ac-chip[data-id]").forEach(chip => {
      chip.onclick = e => { if (e.target.closest(".ac-x")) return; openWalletSheet(chip.dataset.id); };
      chip.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWalletSheet(chip.dataset.id); }
      };
    });
    card.querySelectorAll(".ac-x[data-del]").forEach(x => {
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

    card.querySelectorAll(".ac-chip[data-did]").forEach(chip => {
      chip.onclick = e => { if (e.target.closest(".ac-x")) return; openDebtSheet(chip.dataset.did); };
      chip.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDebtSheet(chip.dataset.did); }
      };
    });
    card.querySelectorAll(".ac-x[data-ddel]").forEach(x => {
      x.onclick = async e => {
        e.stopPropagation();
        const id = x.dataset.ddel;
        const item = Store.listDebts(u.id).find(d => d.id === id);
        const ok = await UI.confirm("删除这条负债？", `「${item ? item.name : "该负债"}」将从负债模块中移除。`, { okText: "删除", danger: true });
        if (!ok) return;
        const removed = Store.delDebt(u.id, id);
        renderWalletCard();
        if (!removed) return;
        UI.toastAction("负债已删除", {
          label: "撤销",
          onAct: () => { Store.restoreDebt(u.id, removed); renderWalletCard(); UI.toast("已恢复负债", "success"); },
        });
      };
    });
    card.querySelector("[data-add-debt]").onclick = () => openDebtSheet(null);
  }

  function openDebtSheet(id) {
    const editing = id ? Store.listDebts(u.id).find(d => d.id === id) : null;
    const s = UI.sheet(`
      <div class="sheet-head"><h3>${editing ? "编辑负债" : "添加负债"}</h3><button class="icon-btn" data-close aria-label="关闭">${UI.icon("close", 18)}</button></div>
      <div class="field"><label>负债名称</label><input class="input" type="text" maxlength="12" placeholder="如：信用卡 / 花呗" value="${editing ? UI.esc(editing.name) : ""}" data-name></div>
      <div class="field"><label>欠款金额</label><input class="input" type="number" step="0.01" inputmode="decimal" placeholder="0.00" value="${editing ? editing.amount : ""}" data-amt></div>
      <div class="sheet-actions"><button class="btn primary block" data-save>保存</button></div>
    `);
    s.el.querySelector("[data-close]").onclick = s.close;
    const nameInput = s.el.querySelector("[data-name]");
    const amtInput = s.el.querySelector("[data-amt]");
    s.el.querySelector("[data-save]").onclick = () => {
      const name = nameInput.value.trim();
      if (!name) { UI.toast("请输入负债名称", "warn"); return; }
      const amount = Number(amtInput.value) || 0;
      if (editing) Store.updateDebt(u.id, editing.id, { name, amount });
      else Store.addDebt(u.id, { name, amount });
      s.close();
      UI.toast(editing ? "负债已更新" : "负债已添加", "success");
      renderWalletCard();
    };
    setTimeout(() => nameInput.focus(), 150);
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

  /* ---------- 快速记一笔 ---------- */
  let qeType = "out";
  let qeCat = "food";
  const qeCats = () => qeType === "out" ? CATS.filter(c => c.key !== "income") : [CATS.find(c => c.key === "income")];

  function renderQeCats() {
    const wrap = body.querySelector("[data-qe-cats]");
    if (!wrap) return;
    const list = qeCats();
    if (!list.some(c => c.key === qeCat)) qeCat = list[0].key;
    wrap.innerHTML = list.map(c => `
      <button class="qe-cat ${c.key === qeCat ? "on" : ""}" type="button" data-cat="${c.key}">
        <span class="qe-cat-e">${c.e}</span><span class="qe-cat-n">${c.name}</span>
      </button>`).join("");
    wrap.querySelectorAll(".qe-cat").forEach(b => {
      b.onclick = () => {
        qeCat = b.dataset.cat;
        wrap.querySelectorAll(".qe-cat").forEach(x => x.classList.toggle("on", x === b));
      };
    });
  }

  function bindQuickEntry(wallets, debts) {
    const seg = body.querySelector(".seg-qe");
    if (!seg) return;
    const catWrap = body.querySelector("[data-qe-cats]");
    const debtWrap = body.querySelector("[data-qe-debt-wrap]");
    const amt = body.querySelector("[data-qe-amt]");
    const acc = body.querySelector("[data-qe-acc]");
    const debt = body.querySelector("[data-qe-debt]");
    const saveBtn = body.querySelector("[data-qe-save]");
    if (!amt || !saveBtn) return;

    // 依据类型切换：支出/收入显示分类，还债显示负债选择
    function syncType() {
      const isRepay = qeType === "repay";
      if (catWrap) catWrap.style.display = isRepay ? "none" : "";
      if (debtWrap) debtWrap.style.display = isRepay ? "" : "none";
      saveBtn.textContent = isRepay ? "还债" : "记账";
      if (isRepay) {
        if (acc && !acc.value && wallets[0]) acc.value = wallets[0].id; // 还债必须选付款账户
        if (debt && debts.length) amt.placeholder = debts[0].amount.toFixed(2);
      } else {
        renderQeCats();
      }
    }

    seg.querySelectorAll("button").forEach(b => {
      b.onclick = () => {
        qeType = b.dataset.type;
        seg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
        syncType();
      };
    });

    if (debt) {
      debt.onchange = () => {
        const d = debts.find(x => x.id === debt.value);
        if (d) amt.placeholder = d.amount.toFixed(2);
      };
    }

    const save = () => {
      const v = Number(amt.value);
      if (!v || v <= 0) { UI.toast("请输入有效金额", "warn"); amt.focus(); return; }
      if (qeType === "repay") {
        const r = Store.repayDebt(u.id, {
          debtId: debt ? debt.value : "",
          accId: acc ? acc.value : "",
          amount: v, date: UI.dayStr(0),
        });
        if (!r.ok) { UI.toast(r.msg, "warn"); return; }
        UI.toast("已还债 ¥" + v.toFixed(2), "success");
        amt.value = "";
        renderAll();
        return;
      }
      Store.addRecord(u.id, { type: qeType, cat: qeCat, amount: v, note: "", date: UI.dayStr(0), accId: acc && acc.value ? acc.value : null });
      UI.toast("已记一笔" + (qeType === "out" ? "支出" : "收入"), "success");
      amt.value = "";
      renderAll();
    };
    saveBtn.onclick = save;
    amt.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); save(); } };

    syncType();
  }

  /* ---------- 整页渲染 ---------- */
  function renderAll() {
    const summary = Store.getSummary(u.id);
    const wallets = Store.listWallets(u.id);

    // 支出分类：前 5 项 + 其余合并为「其他」
    const top5 = summary.byCat.slice(0, 5);
    const rest = summary.byCat.slice(5);
    const donutItems = top5.map((it, i) => ({ label: catName(it.cat), value: it.amount, color: PALETTE[i % PALETTE.length] }));
    if (rest.length) {
      const restTotal = rest.reduce((s, it) => s + it.amount, 0);
      donutItems.push({ label: "其他", value: restTotal, color: PALETTE[6] });
    }

    const debts = Store.listDebts(u.id);
    const canRepay = wallets.length > 0 && debts.length > 0;
    if (qeType === "repay" && !canRepay) qeType = "out";
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
      <section class="asset-card fade-in" id="asset-card"></section>

      <section class="card qe-card fade-in" id="quick-entry">
        <div class="qe-title">⚡ 快速记一笔</div>
        <div class="seg seg-qe">
          <button type="button" data-type="out" class="${qeType === "out" ? "on" : ""}">支出</button>
          <button type="button" data-type="in" class="${qeType === "in" ? "on" : ""}">收入</button>
          ${canRepay ? `<button type="button" data-type="repay" class="${qeType === "repay" ? "on" : ""}">还债</button>` : ""}
        </div>
        <div class="qe-cats" data-qe-cats></div>
        ${canRepay ? `
        <div class="qe-debt" data-qe-debt-wrap>
          <select class="input qe-acc" data-qe-debt aria-label="选择要还的负债">
            ${debts.map(d => `<option value="${d.id}">${UI.esc(d.name)}（欠 ¥${money(d.amount)}）</option>`).join("")}
          </select>
        </div>` : ""}
        <div class="qe-row">
          <div class="qe-amount">
            <span class="qe-yen">¥</span>
            <input class="qe-input" type="number" step="0.01" inputmode="decimal" placeholder="0.00" data-qe-amt aria-label="金额">
          </div>
          <button class="btn primary qe-save" type="button" data-qe-save>记账</button>
        </div>
        ${wallets.length ? `
        <select class="input qe-acc" data-qe-acc aria-label="关联账户">
          <option value="">不关联账户</option>
          ${wallets.map(a => `<option value="${a.id}">${UI.esc(a.name)}（¥${a.balance.toFixed(2)}）</option>`).join("")}
        </select>` : ""}
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
          const isRepay = r.type === "repay";
          const ico = isRepay ? "💳" : catEmoji(r.cat);
          const label = r.note || (isRepay ? "还债" : catName(r.cat));
          return `
          <div class="rec-item">
            <span class="rec-ico">${ico}</span>
            <div class="rec-main">
              <div class="rec-note ellipsis">${UI.esc(label)}</div>
              <div class="rec-date">${UI.fmtDate(r.t)}</div>
            </div>
            <span class="rec-amt ${isIn ? "in" : "out"} num">${isIn ? "+" : "-"}${UI.fmtMoney(r.amount)}</span>
          </div>`;
        }).join("") : UI.emptyBox("💸", "还没有记账", "用上方「快速记一笔」开始记录")}
      </section>

      <button class="btn primary block mt-16 fade-in" id="go-accounting">详细记账</button>
    `;

    // 总资产账户卡片
    renderWalletCard();

    // 近 7 日支出折线
    const lineCanvas = body.querySelector(".chart-box canvas");
    if (lineCanvas) Charts.line(lineCanvas, summary.trend.map(t => t.day), summary.trend.map(t => t.amount));

    // 支出分类环形
    const donutCanvas = body.querySelector(".donut-canvas canvas");
    if (donutCanvas && donutItems.length) Charts.donut(donutCanvas, donutItems, { centerLabel: "支出" });

    bindQuickEntry(wallets, debts);
    body.querySelector("#go-accounting").onclick = () => { location.href = "accounting.html"; };
  }

  renderAll();
})();