/* 记账页：按日查看与分类记一笔（近 7 天可切换） */

UserShell.boot({ tab: null, title: Store.getTitle("page.accounting"), back: "assets.html", hideTab: true });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("accounting-body");
  // 分类 = 内置分类 + 用户自定义（自定义收支理由）
  const catsOf = t => Store.listCats(u.id, t === "in" ? "in" : "out");
  const catOf = (key, t) => Store.catInfo(u.id, key, t === "in" ? "in" : "out");

  let dateOffset = 0; // -6 .. 0

  function curDate() { return UI.dayStr(dateOffset); }

  function render() {
    const date = curDate();
    const recs = Store.listRecords(u.id).filter(r => r.date === date);
    const outSum = recs.filter(r => r.type === "out").reduce((s, r) => s + r.amount, 0);
    const inSum = recs.filter(r => r.type === "in").reduce((s, r) => s + r.amount, 0);
    const dateLabel = date === UI.dayStr(0) ? "今天" : date;

    body.innerHTML = `
      <section class="date-bar card fade-in">
        <button class="icon-btn date-arrow" data-step="-1" ${dateOffset <= -6 ? "disabled" : ""} aria-label="前一天">${UI.icon("chevron-left", 20)}</button>
        <div class="date-mid">
          <div class="date-txt bold">${UI.esc(dateLabel)}</div>
          <div class="date-sum txt-xs txt-3">支出 ¥${outSum.toFixed(2)} · 收入 ¥${inSum.toFixed(2)}</div>
        </div>
        <button class="icon-btn date-arrow" data-step="1" ${dateOffset >= 0 ? "disabled" : ""} aria-label="后一天">${UI.icon("chevron-right", 20)}</button>
      </section>

      <section class="card fade-in mt-12">
        ${recs.length ? recs.map(r => {
          const isIn = r.type === "in";
          const c = r.type === "repay" ? { e: "💳", name: "还债" } : catOf(r.cat, r.type);
          const acc = r.accId ? Store.listWallets(u.id).find(a => a.id === r.accId) : null;
          return `
          <div class="rec-row">
            <span class="rec-ico">${c.e}</span>
            <div class="rec-main">
              <div class="rec-note ellipsis">${UI.esc(r.note || c.name)}</div>
              <div class="rec-time txt-xs txt-3">${UI.fmtTime(r.t)} · ${UI.esc(c.name)}${acc ? " · " + UI.esc(acc.name) : ""}</div>
            </div>
            <span class="rec-amt ${isIn ? "in" : "out"} num">${isIn ? "+" : "-"}¥${r.amount.toFixed(2)}</span>
            <button class="icon-btn rec-del" data-id="${r.id}" aria-label="删除">${UI.icon("trash", 18)}</button>
          </div>`;
        }).join("") : UI.emptyBox("🧾", "这一天还没有记录", "点右下角 + 记一笔")}
      </section>
    `;

    body.querySelectorAll(".date-arrow").forEach(btn => {
      btn.onclick = () => {
        const step = Number(btn.dataset.step);
        dateOffset = Math.max(-6, Math.min(0, dateOffset + step));
        render();
      };
    });

    body.querySelectorAll(".rec-del").forEach(btn => {
      btn.onclick = async () => {
        const ok = await UI.confirm("删除这条记录？", "删除后短时间内可以点「撤销」找回。", { okText: "删除", danger: true });
        if (!ok) return;
        const removed = Store.delRecord(u.id, btn.dataset.id);
        render();
        if (!removed) { UI.toast("删除失败", "error"); return; }
        UI.toastAction("记录已删除", {
          label: "撤销",
          onAct: () => { Store.restoreRecord(u.id, removed); render(); UI.toast("已恢复", "success"); },
        });
      };
    });
  }

  /* 记一笔弹层 */
  function openSheet() {
    let type = "out";
    let cat = catsOf("out")[0].key;
    const wallets = Store.listWallets(u.id);

    const s = UI.sheet(`
      <div class="sheet-head"><h3>记一笔</h3><button class="icon-btn" data-close aria-label="关闭">${UI.icon("close", 18)}</button></div>
      <div class="seg seg-type">
        <button data-type="out" class="on">支出</button>
        <button data-type="in">收入</button>
      </div>
      <div class="cat-grid grid-4 mt-12"></div>
      <div class="field mt-16"><label>金额</label><input class="input" type="number" step="0.01" placeholder="0.00" inputmode="decimal" data-amount></div>
      <div class="field"><label>账户</label>
        <select class="input" data-acc>
          <option value="">不关联账户</option>
          ${wallets.map(a => `<option value="${a.id}">${UI.esc(a.name)}（¥${a.balance.toFixed(2)}）</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>备注</label><input class="input" type="text" placeholder="写点什么…" maxlength="30" data-note></div>
      <div class="sheet-actions"><button class="btn primary block" data-save>保存</button></div>
    `);

    const catGrid = s.el.querySelector(".cat-grid");
    const amountInput = s.el.querySelector("[data-amount]");
    const accSel = s.el.querySelector("[data-acc]");
    const noteInput = s.el.querySelector("[data-note]");
    const segBtns = s.el.querySelectorAll(".seg-type button");

    function renderCats() {
      const list = catsOf(type);
      catGrid.innerHTML = list.map(c => `
        <button class="cat-cell ${c.key === cat ? "on" : ""}" data-cat="${c.key}">
          <span class="cat-e">${c.e}</span>
          <span class="cat-n">${c.name}</span>
        </button>`).join("");
      catGrid.querySelectorAll(".cat-cell").forEach(cell => {
        cell.onclick = () => {
          cat = cell.dataset.cat;
          catGrid.querySelectorAll(".cat-cell").forEach(x => x.classList.toggle("on", x.dataset.cat === cat));
        };
      });
    }

    segBtns.forEach(btn => {
      btn.onclick = () => {
        type = btn.dataset.type;
        segBtns.forEach(b => b.classList.toggle("on", b === btn));
        cat = catsOf(type)[0].key;
        renderCats();
      };
    });

    s.el.querySelector("[data-close]").onclick = s.close;

    s.el.querySelector("[data-save]").onclick = () => {
      const amt = Number(amountInput.value);
      if (!amt || amt <= 0) { UI.toast("请输入有效金额", "warn"); return; }
      Store.addRecord(u.id, { type, cat, amount: amt, note: noteInput.value.trim(), date: curDate(), accId: accSel.value || null });
      s.close();
      UI.toast("记账成功");
      render();
    };

    renderCats();
    setTimeout(() => amountInput.focus(), 150);
  }

  // 悬浮 + 按钮
  const fab = document.createElement("button");
  fab.className = "fab-add";
  fab.setAttribute("aria-label", "记一笔");
  fab.innerHTML = UI.icon("plus", 26);
  fab.onclick = openSheet;
  document.body.appendChild(fab);

  render();
})();