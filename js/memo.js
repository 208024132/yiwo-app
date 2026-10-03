/* 备忘录：小米/HyperOS 风格卡片流 + 搜索 + 置顶 */
UserShell.boot({ hideTab: true, back: "my.html", title: "备忘录" });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("memo-body");
  let keyword = "";
  let filter = "all";   // all | pin

  body.innerHTML = `
    <div class="mi-search">
      ${UI.icon("search", 18)}
      <input type="text" placeholder="搜索笔记" data-search aria-label="搜索笔记">
    </div>
    <div class="mi-tabs">
      <button data-f="all" class="on">全部</button>
      <button data-f="pin">置顶</button>
    </div>
    <div class="mi-stat" data-stat></div>
    <div class="mi-grid" data-list></div>`;

  const listEl = body.querySelector("[data-list]");
  const statEl = body.querySelector("[data-stat]");
  const searchIn = body.querySelector("[data-search]");

  searchIn.addEventListener("input", UI.debounce(e => {
    keyword = e.target.value.trim().toLowerCase();
    render();
  }, 300));

  // 小米笔记的时间展示：今天显示时间，同年显示月日，跨年显示年月日
  function noteTime(t) {
    const d = new Date(t), now = new Date();
    if (d.toDateString() === now.toDateString()) return UI.fmtTime(t);
    const md = (d.getMonth() + 1) + "月" + d.getDate() + "日";
    return d.getFullYear() === now.getFullYear() ? md : d.getFullYear() + "年" + md;
  }

  function noteCard(m) {
    const lines = String(m.text || "").split("\n");
    const title = lines[0].trim() || "无标题";
    const rest = lines.slice(1).join("\n").trim();
    return `
      <article class="mi-note${m.pin ? " pinned" : ""}" data-edit="${m.id}">
        <div class="mi-note-title clamp-2">${UI.esc(title)}</div>
        ${rest ? `<div class="mi-note-body clamp-3">${UI.esc(rest)}</div>` : ""}
        <div class="mi-note-foot">
          <span class="mi-note-date">${noteTime(m.t)}</span>
          ${m.tag ? `<span class="mi-note-tag">${UI.esc(m.tag)}</span>` : ""}
          <span class="mi-note-acts">
            <button class="mi-ico ${m.pin ? "on" : ""}" data-pin="${m.id}" aria-label="置顶">${UI.icon("pin", 15)}</button>
            <button class="mi-ico" data-del="${m.id}" aria-label="删除">${UI.icon("trash", 15)}</button>
          </span>
        </div>
      </article>`;
  }

  function filtered() {
    let list = Store.listMemos(u.id);
    if (filter === "pin") list = list.filter(m => m.pin);
    if (keyword) list = list.filter(m => (m.text + " " + (m.tag || "")).toLowerCase().includes(keyword));
    return list;
  }

  function render() {
    const list = filtered();
    statEl.textContent = list.length ? `共 ${list.length} 条笔记` : "";
    listEl.innerHTML = list.length
      ? list.map(noteCard).join("")
      : `<div class="card mi-empty-card">${UI.emptyBox("📝", keyword ? "没有匹配的笔记" : "还没有笔记",
          keyword ? "换个关键词试试" : "点击右下角 + 记录第一条")}</div>`;
  }

  function openEditor(m) {
    const s = UI.sheet(`
      <div class="sheet-head"><h3>${m ? "编辑笔记" : "新建笔记"}</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <textarea class="textarea" data-t placeholder="写点什么…" maxlength="500">${m ? UI.esc(m.text) : ""}</textarea>
      <input class="input memo-tag" data-g placeholder="标签（可选）" value="${m ? UI.esc(m.tag || "") : ""}" maxlength="10">
      <div class="sheet-actions"><button class="btn primary block" data-save>保存</button></div>`);
    s.el.querySelector("[data-x]").onclick = () => s.close();
    s.el.querySelector("[data-save]").onclick = () => {
      const text = s.el.querySelector("[data-t]").value.trim();
      if (!text) { UI.toast("内容不能为空", "warn"); return; }
      const tag = s.el.querySelector("[data-g]").value.trim();
      Store.saveMemo(u.id, { id: m ? m.id : null, text, tag, pin: m ? m.pin : false });
      s.close();
      UI.toast("已保存", "success");
      render();
    };
    setTimeout(() => s.el.querySelector("[data-t]").focus(), 150);
  }

  body.addEventListener("click", e => {
    const f = e.target.closest("[data-f]");
    if (f) {
      filter = f.dataset.f;
      body.querySelectorAll("[data-f]").forEach(b => b.classList.toggle("on", b === f));
      render();
      return;
    }
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
        UI.confirm("删除这条笔记？", "删除后不可恢复", { danger: true }).then(ok => {
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
  fab.setAttribute("aria-label", "新建笔记");
  fab.innerHTML = UI.icon("plus", 26, "#fff");
  fab.onclick = () => openEditor(null);
  document.body.appendChild(fab);

  render();
})();
