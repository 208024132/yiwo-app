/* 任务进度：列表 + 编辑 + 新建 */
UserShell.boot({ hideTab: true, back: "my.html", title: "任务进度" });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("tasks-body");

  const STATUS = [
    { key: "todo", name: "待开始", cls: "gray" },
    { key: "doing", name: "进行中", cls: "warn" },
    { key: "done", name: "已完成", cls: "success" },
  ];
  const stOf = key => STATUS.find(s => s.key === key) || STATUS[0];

  function taskCard(t) {
    const s = stOf(t.status);
    return `
      <div class="card task-card" data-task="${t.id}">
        <div class="task-top">
          <span class="tag ${s.cls}">${s.name}</span>
          <div class="task-title ellipsis ${t.status === "done" ? "is-done" : ""}">${UI.esc(t.title)}</div>
          <button class="icon-btn task-del" data-del="${t.id}">${UI.icon("trash", 18)}</button>
        </div>
        <div class="task-prog">
          <div class="progress"><i style="width:${t.pct}%"></i></div>
          <span class="task-pct num">${t.pct}%</span>
        </div>
      </div>`;
  }

  function render() {
    const list = Store.listTasks(u.id);
    body.innerHTML = `<div class="task-list">${list.length
      ? list.map(taskCard).join("")
      : `<div class="card">${UI.emptyBox("🎯", "暂无任务", "添加任务，让目标清晰可见")}</div>`
    }</div>`;
  }

  function openEditor(t) {
    const status = t ? t.status : "todo";
    const pct = t ? t.pct : 0;
    const s = UI.sheet(`
      <div class="sheet-head"><h3>${t ? "编辑任务" : "新建任务"}</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <div class="field"><label>任务标题</label>
        <input class="input" data-title value="${t ? UI.esc(t.title) : ""}" placeholder="要完成什么？" maxlength="40"></div>
      <div class="field"><label>标签（可选）</label>
        <input class="input" data-tag value="${t ? UI.esc(t.tag || "") : ""}" placeholder="如：工作 / 生活" maxlength="10"></div>
      <div class="field"><label>进度</label>
        <div class="range-box">
          <input type="range" class="range" min="0" max="100" step="1" value="${pct}" data-r>
          <span class="range-val num" data-v>${pct}%</span>
        </div>
      </div>
      <div class="field"><label>状态</label>
        <div class="seg">
          ${STATUS.map(st => `<button data-status="${st.key}" class="${status === st.key ? "on" : ""}">${st.name}</button>`).join("")}
        </div>
      </div>
      <div class="sheet-actions"><button class="btn primary block" data-save>保存</button></div>`);

    let curStatus = status;
    const r = s.el.querySelector("[data-r]");
    const v = s.el.querySelector("[data-v]");
    s.el.querySelector("[data-x]").onclick = () => s.close();
    r.oninput = () => { v.textContent = r.value + "%"; };
    s.el.querySelectorAll("[data-status]").forEach(b => b.onclick = () => {
      curStatus = b.dataset.status;
      s.el.querySelectorAll("[data-status]").forEach(bb => bb.classList.toggle("on", bb === b));
      if (curStatus === "done") { r.value = 100; v.textContent = "100%"; }
    });
    s.el.querySelector("[data-save]").onclick = () => {
      const title = s.el.querySelector("[data-title]").value.trim();
      if (!title) { UI.toast("请输入任务标题", "warn"); return; }
      const tag = s.el.querySelector("[data-tag]").value.trim();
      const finalPct = curStatus === "done" ? 100 : Number(r.value);
      Store.saveTask(u.id, { id: t ? t.id : null, title, tag, pct: finalPct, status: curStatus });
      s.close();
      UI.toast("已保存", "success");
      render();
    };
  }

  body.addEventListener("click", e => {
    const del = e.target.closest("[data-del]");
    if (del) {
      const t = Store.listTasks(u.id).find(x => x.id === del.dataset.del);
      if (t) {
        UI.confirm("删除任务？", `确定删除「${t.title}」吗？`, { danger: true }).then(ok => {
          if (ok) { Store.delTask(u.id, t.id); UI.toast("已删除", "success"); render(); }
        });
      }
      return;
    }
    const row = e.target.closest("[data-task]");
    if (row) {
      const t = Store.listTasks(u.id).find(x => x.id === row.dataset.task);
      if (t) openEditor(t);
    }
  });

  const fab = document.createElement("button");
  fab.className = "fab";
  fab.setAttribute("aria-label", "新建任务");
  fab.innerHTML = UI.icon("plus", 26, "#fff");
  fab.onclick = () => openEditor(null);
  document.body.appendChild(fab);

  render();
})();