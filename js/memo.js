/* 备忘录：搜索 + 置顶 + 新建/编辑/删除 */
UserShell.boot({ hideTab: true, back: "my.html", title: "备忘录" });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("memo-body");
  let keyword = "";

  body.innerHTML = `
    <div class="search-bar memo-search">
      <span>${UI.icon("search", 18)}</span>
      <input type="text" placeholder="搜索备忘录" data-search>
    </div>
    <div class="memo-list" data-list></div>`;

  const listEl = body.querySelector("[data-list]");
  const searchIn = body.querySelector("[data-search]");

  searchIn.addEventListener("input", UI.debounce(e => {
    keyword = e.target.value.trim().toLowerCase();
    render();
  }, 300));

  const filtered = () => Store.listMemos(u.id)
    .filter(m => !keyword || (m.text + " " + (m.tag || "")).toLowerCase().includes(keyword));

  function memoCard(m) {
    return `
      <div class="card memo-card" data-edit="${m.id}">
        <div class="memo-top">
          <button class="icon-btn memo-pin ${m.pin ? "on" : ""}" data-pin="${m.id}">${UI.icon("pin", 18)}</button>
          <div class="memo-text clamp-2">${UI.esc(m.text)}</div>
          <button class="icon-btn memo-del" data-del="${m.id}">${UI.icon("trash", 18)}</button>
        </div>
        <div class="memo-bottom">
          ${m.tag ? `<span class="tag">${UI.esc(m.tag)}</span>` : `<span></span>`}
          <span class="memo-time">${UI.timeAgo(m.t)}</span>
        </div>
      </div>`;
  }

  function render() {
    const list = filtered();
    listEl.innerHTML = list.length
      ? list.map(memoCard).join("")
      : `<div class="card">${UI.emptyBox("📝", "暂无备忘录", keyword ? "换个关键词试试" : "点击右下角 + 记下一条备忘")}</div>`;
  }

  function openEditor(m) {
    const s = UI.sheet(`
      <div class="sheet-head"><h3>${m ? "编辑备忘录" : "新建备忘录"}</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <textarea class="textarea" data-t placeholder="写点什么…">${m ? UI.esc(m.text) : ""}</textarea>
      <input class="input memo-tag" data-g placeholder="标签（可选）" value="${m ? UI.esc(m.tag || "") : ""}" maxlength="10">
      <div class="sheet-actions"><button class="btn primary block" data-save>保存</button></div>`);
    s.el.querySelector("[data-x]").onclick = () => s.close();
    s.el.querySelector("[data-save]").onclick = () => {
      const text = s.el.querySelector("[data-t]").value.trim();
      if (!text) { UI.toast("内容不能为空", "warn"); return; }
      const tag = s.el.querySelector("[data-g]").value.trim();
      Store.saveMemo(u.id, { id: m ? m.id : null, text, tag });
      s.close();
      UI.toast("已保存", "success");
      render();
    };
    setTimeout(() => s.el.querySelector("[data-t]").focus(), 150);
  }

  body.addEventListener("click", e => {
    const pin = e.target.closest("[data-pin]");
    if (pin) {
      const m = Store.listMemos(u.id).find(x => x.id === pin.dataset.pin);
      if (m) { Store.saveMemo(u.id, { id: m.id, text: m.text, tag: m.tag, pin: !m.pin }); render(); }
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      const m = Store.listMemos(u.id).find(x => x.id === del.dataset.del);
      if (m) {
        UI.confirm("删除这条备忘录？", "删除后不可恢复", { danger: true }).then(ok => {
          if (ok) { Store.delMemo(u.id, m.id); UI.toast("已删除", "success"); render(); }
        });
      }
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      const m = Store.listMemos(u.id).find(x => x.id === edit.dataset.edit);
      if (m) openEditor(m);
    }
  });

  const fab = document.createElement("button");
  fab.className = "fab";
  fab.setAttribute("aria-label", "新建备忘录");
  fab.innerHTML = UI.icon("plus", 26, "#fff");
  fab.onclick = () => openEditor(null);
  document.body.appendChild(fab);

  render();
})();