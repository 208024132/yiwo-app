/* 资产页：余额总览 + 近 7 日支出折线 + 支出分类环形 + 最近记录 */

UserShell.boot({ tab: "assets", title: Store.getTitle("page.assets") });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("assets-body");
  const PALETTE = ["#f2994a", "#56ccf2", "#9b6cf7", "#f76f8e", "#48c6c0", "#f2c94c", "#8e9eab", "#a1e657"];

  const catName = (key, type = "out") => Store.catInfo(u.id, key, type).name;
  const catEmoji = (key, type = "out") => Store.catInfo(u.id, key, type).e;

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
  // 分类 = 内置分类 + 用户自定义（自定义收支理由）
  const qeCats = () => Store.listCats(u.id, qeType === "in" ? "in" : "out");

  function renderQeCats() {
    const wrap = body.querySelector("[data-qe-cats]");
    if (!wrap) return;
    const list = qeCats();
    if (!list.some(c => c.key === qeCat)) qeCat = list[0].key;
    wrap.innerHTML = list.map(c => `
      <button class="qe-cat ${c.key === qeCat ? "on" : ""}" type="button" draggable="false" data-cat="${c.key}">
        <span class="qe-cat-e">${c.e}</span><span class="qe-cat-n">${c.name}</span>
      </button>`).join("") + `
      <button class="qe-cat qe-cat-add" type="button" data-cat-add>
        <span class="qe-cat-e">＋</span><span class="qe-cat-n">自定义</span>
      </button>`;
    wrap.querySelectorAll(".qe-cat[data-cat]").forEach(b => {
      b.onclick = () => {
        qeCat = b.dataset.cat;
        wrap.querySelectorAll(".qe-cat[data-cat]").forEach(x => x.classList.toggle("on", x === b));
      };
    });
    wrap.querySelector("[data-cat-add]").onclick = () => openCatSheet();
    enableCatDrag(wrap);
  }

  /* 长按拖动排序分类（含自定义），顺序按用户保存 */
  function enableCatDrag(wrap) {
    if (wrap.__dragBound) return;   // 同一节点只绑定一次（内部会多次重绘 chips）
    wrap.__dragBound = true;
    const addChip = () => wrap.querySelector("[data-cat-add]");
    const chips = () => Array.prototype.slice.call(wrap.querySelectorAll(".qe-cat[data-cat]"));
    let timer = null, dragEl = null, sx = 0, sy = 0, suppress = false;

    wrap.addEventListener("click", e => {
      if (suppress) { suppress = false; e.preventDefault(); e.stopPropagation(); }
    }, true);

    wrap.addEventListener("pointerdown", e => {
      const chip = e.target.closest(".qe-cat[data-cat]");
      if (!chip || e.button) return;
      suppress = false;              // 新手势开始，清掉上一次拖拽的抑制标记
      sx = e.clientX; sy = e.clientY;
      timer = setTimeout(() => {
        timer = null;
        dragEl = chip;
        try { chip.setPointerCapture(e.pointerId); } catch (err) {}
        chip.classList.add("dragging");
        wrap.classList.add("drag-on");
        if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) {} }
      }, 300);
    });

    wrap.addEventListener("pointermove", e => {
      if (!dragEl) {
        if (timer && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { clearTimeout(timer); timer = null; }
        return;
      }
      e.preventDefault();
      const x = e.clientX;
      const target = chips().filter(c => c !== dragEl).find(c => {
        const r = c.getBoundingClientRect();
        return x < r.left + r.width / 2;
      });
      const prev = new Map(chips().map(c => [c, c.getBoundingClientRect()]));
      if (target) wrap.insertBefore(dragEl, target);
      else wrap.insertBefore(dragEl, addChip());
      // FLIP：先设反转 transform -> 强制回流 -> 再过渡到原位
      chips().forEach(c => {
        if (c === dragEl) return;
        const p = prev.get(c); if (!p) return;
        const dx = p.left - c.getBoundingClientRect().left;
        if (!dx) return;
        c.style.transition = "none";
        c.style.transform = "translateX(" + dx + "px)";
        void c.offsetWidth;
        c.style.transition = "transform .18s ease";
        c.style.transform = "";
      });
    });

    const end = e => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!dragEl) return;
      const el = dragEl;
      dragEl = null;
      suppress = true;
      setTimeout(() => { suppress = false; }, 400);
      el.classList.remove("dragging");
      wrap.classList.remove("drag-on");
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}
      chips().forEach(c => { c.style.transition = ""; c.style.transform = ""; });
      Store.saveCatOrder(u.id, qeType === "in" ? "in" : "out", chips().map(c => c.dataset.cat));
    };
    wrap.addEventListener("pointerup", end);
    wrap.addEventListener("pointercancel", end);
  }

  /* ---------- 自定义收支理由（分类）管理 ---------- */
  const CAT_EMOJI = ["🏷️", "🐱", "🐶", "🐾", "📚", "🎓", "🎁", "🎂", "💄", "👶", "🎵", "⚽", "✈️", "🚗", "💻", "💼", "🧾", "💡", "🍜", "🏠"];
  let catEditKey = null;   // 正在编辑的自定义分类 key（null 表示新增）
  let catPickedE = "🏷️";

  function openCatSheet() {
    catEditKey = null;
    catPickedE = "🏷️";
    const typeLabel = qeType === "in" ? "收入" : "支出";
    const s = UI.sheet(`
      <div class="sheet-head"><h3>自定义收支理由</h3><button class="icon-btn" data-close aria-label="关闭">${UI.icon("close", 18)}</button></div>
      <div class="field"><label>名称</label><input class="input" type="text" maxlength="6" placeholder="如：宠物 / 学习 / 副业" data-cat-name></div>
      <div class="field"><label>选择图标</label><div class="cat-emoji" data-cat-emoji></div></div>
      <div class="sheet-actions">
        <button class="btn ghost" type="button" data-cat-cancel style="display:none">取消编辑</button>
        <button class="btn primary" type="button" data-cat-save>添加</button>
      </div>
      <div class="cat-manage-t">已自定义 · ${typeLabel}（<span data-cat-count>0</span>）</div>
      <div class="cat-manage" data-cat-list></div>
    `);
    s.el.querySelector("[data-close]").onclick = s.close;

    const nameInput = s.el.querySelector("[data-cat-name]");
    const emojiWrap = s.el.querySelector("[data-cat-emoji]");
    const saveBtn = s.el.querySelector("[data-cat-save]");
    const cancelBtn = s.el.querySelector("[data-cat-cancel]");
    const listWrap = s.el.querySelector("[data-cat-list]");
    const countEl = s.el.querySelector("[data-cat-count]");

    emojiWrap.innerHTML = CAT_EMOJI.map(e => `<button type="button" class="cat-emoji-b" data-e="${e}">${e}</button>`).join("");
    const paintEmoji = () => emojiWrap.querySelectorAll(".cat-emoji-b").forEach(b => b.classList.toggle("on", b.dataset.e === catPickedE));
    emojiWrap.querySelectorAll(".cat-emoji-b").forEach(b => {
      b.onclick = () => { catPickedE = b.dataset.e; paintEmoji(); };
    });
    paintEmoji();

    function renderList() {
      const list = Store.customCats(u.id, qeType === "in" ? "in" : "out");
      countEl.textContent = list.length;
      if (!list.length) {
        listWrap.innerHTML = `<div class="cat-manage-empty">还没有自定义分类，在上方添加一个吧</div>`;
        return;
      }
      listWrap.innerHTML = list.map(c => `
        <div class="cat-manage-row">
          <span class="cat-manage-e">${c.e}</span>
          <span class="cat-manage-n ellipsis">${UI.esc(c.name)}</span>
          <button class="icon-btn" type="button" data-edit="${c.key}" aria-label="编辑 ${UI.esc(c.name)}">${UI.icon("edit", 16)}</button>
          <button class="icon-btn" type="button" data-del="${c.key}" aria-label="删除 ${UI.esc(c.name)}">${UI.icon("trash", 16)}</button>
        </div>`).join("");
      listWrap.querySelectorAll("[data-edit]").forEach(b => {
        b.onclick = () => {
          const c = Store.customCats(u.id).find(x => x.key === b.dataset.edit);
          if (!c) return;
          catEditKey = c.key;
          catPickedE = c.e;
          nameInput.value = c.name;
          saveBtn.textContent = "保存修改";
          cancelBtn.style.display = "";
          paintEmoji();
          nameInput.focus();
        };
      });
      listWrap.querySelectorAll("[data-del]").forEach(b => {
        b.onclick = async () => {
          const c = Store.customCats(u.id).find(x => x.key === b.dataset.del);
          if (!c) return;
          const ok = await UI.confirm("删除这个分类？", `「${c.name}」将不再出现在分类里，历史记录仍会保留。`, { okText: "删除", danger: true });
          if (!ok) return;
          const removed = Store.delCat(u.id, c.key);
          if (catEditKey === c.key) resetForm();
          else renderList();
          if (removed) UI.toastAction("分类已删除", {
            label: "撤销",
            onAct: () => { Store.restoreCat(u.id, removed); renderList(); UI.toast("已恢复分类", "success"); },
          });
        };
      });
    }

    function resetForm() {
      catEditKey = null;
      catPickedE = "🏷️";
      nameInput.value = "";
      saveBtn.textContent = "添加";
      cancelBtn.style.display = "none";
      paintEmoji();
      renderList();
    }

    cancelBtn.onclick = resetForm;

    saveBtn.onclick = () => {
      const wasEdit = !!catEditKey;
      const name = nameInput.value.trim();
      const r = wasEdit
        ? Store.updateCat(u.id, catEditKey, { name, e: catPickedE })
        : Store.addCat(u.id, { type: qeType === "in" ? "in" : "out", name, e: catPickedE });
      if (!r.ok) { UI.toast(r.msg, "warn"); return; }
      const key = catEditKey || r.cat.key;
      resetForm();
      qeCat = key;
      renderQeCats();
      UI.toast(wasEdit ? "分类已更新" : "分类已添加", "success");
    };

    renderList();
    setTimeout(() => nameInput.focus(), 150);
  }

  function bindQuickEntry(wallets, debts) {
    const seg = body.querySelector(".seg-qe");
    if (!seg) return;
    const catWrap = body.querySelector("[data-qe-cats]");
    const debtWrap = body.querySelector("[data-qe-debt-wrap]");
    const amt = body.querySelector("[data-qe-amt]");
    const acc = body.querySelector("[data-qe-acc]");
    const debt = body.querySelector("[data-qe-debt]");
    const itemWrap = body.querySelector("[data-qe-item-wrap]");
    const itemInput = body.querySelector("[data-qe-item]");
    const saveBtn = body.querySelector("[data-qe-save]");
    if (!amt || !saveBtn) return;

    // 依据类型切换：支出/收入显示分类，还债显示负债选择
    function syncType() {
      const isRepay = qeType === "repay";
      if (catWrap) catWrap.style.display = isRepay ? "none" : "";
      if (itemWrap) itemWrap.style.display = isRepay ? "none" : "";
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
      Store.addRecord(u.id, { type: qeType, cat: qeCat, amount: v, note: itemInput ? itemInput.value.trim() : "", date: UI.dayStr(0), accId: acc && acc.value ? acc.value : null });
      UI.toast("已记一笔" + (qeType === "out" ? "支出" : "收入"), "success");
      amt.value = "";
      if (itemInput) itemInput.value = "";
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
        <div class="qe-item-wrap" data-qe-item-wrap>
          <input class="input qe-item" type="text" maxlength="20" placeholder="填写收支项目（可选），如：早餐 / 打车" data-qe-item aria-label="收支项目">
        </div>
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

      <section class="section-title"><h2>${UI.esc(Store.getTitle("assets.trend"))}</h2></section>
      <section class="card fade-in">
        <div class="chart-box"><canvas></canvas></div>
      </section>

      <section class="section-title"><h2>${UI.esc(Store.getTitle("assets.cat"))}</h2></section>
      <section class="card fade-in">${catBlock}</section>

      <section class="section-title"><h2>${UI.esc(Store.getTitle("assets.recent"))}</h2></section>
      <section class="card fade-in">
        ${recent.length ? recent.map(r => {
          const isIn = r.type === "in";
          const isRepay = r.type === "repay";
          const ico = isRepay ? "💳" : catEmoji(r.cat, r.type);
          const label = r.note || (isRepay ? "还债" : catName(r.cat, r.type));
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