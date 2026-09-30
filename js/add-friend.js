/* 添加好友页逻辑 */

UserShell.boot({ tab: null, title: "添加好友", back: "friends.html", hideTab: true });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("add-body");

  let kw = "";

  const sentIds = () => new Set(Store.sentRequests(u.id).map(r => r.to.id));

  function rowHtml(usr) {
    let action;
    if (usr.id === u.id) action = `<span class="tag gray">我</span>`;
    else if (Store.isFriend(u.id, usr.id)) action = `<span class="tag">已是好友</span>`;
    else if (sentIds().has(usr.id)) action = `<span class="tag gray">已发送</span>`;
    else action = `<button class="btn sm primary" data-add="${usr.id}">添加</button>`;
    return `
      <div class="list-item">
        ${UI.avatarEl(usr, "md")}
        <div class="li-main">
          <div class="li-title ellipsis">${UI.esc(usr.nickname)}</div>
          ${usr.signature ? `<div class="li-sub ellipsis">${UI.esc(usr.signature)}</div>` : ""}
          <div class="li-sub">ID：${UI.esc(usr.id)}</div>
        </div>
        ${action}
      </div>`;
  }

  function render() {
    const q = kw.trim().toLowerCase();
    let results;
    if (q) {
      results = Store.listUsers().filter(usr =>
        [usr.nickname, usr.id, usr.account].join(" ").toLowerCase().includes(q));
    } else {
      results = Store.listUsers().filter(usr =>
        usr.id !== u.id && !Store.isFriend(u.id, usr.id) && !sentIds().has(usr.id)).slice(0, 8);
    }

    body.innerHTML = `
      <div class="search-row">
        <div class="search-bar">${UI.icon("search", 18)}<input id="kw" placeholder="搜索昵称 / 用户ID / 账号" value="${UI.esc(kw)}"></div>
        <button class="btn primary sm" id="search-btn">搜索</button>
      </div>
      <div class="section-title"><h2>${q ? "搜索结果" : "推荐用户"}</h2></div>
      ${results.length
        ? `<div class="result-list">${results.map(rowHtml).join("")}</div>`
        : UI.emptyBox("🔍", "没有找到相关用户", "换个关键词试试吧")}`;

    bind();
  }

  function bind() {
    const kwEl = document.getElementById("kw");
    const searchBtn = document.getElementById("search-btn");
    if (kwEl) {
      kwEl.oninput = () => {
        kw = kwEl.value;
        if (!kw.trim()) render();
      };
      kwEl.addEventListener("keydown", e => { if (e.key === "Enter") searchBtn.click(); });
    }
    if (searchBtn) searchBtn.onclick = () => {
      kw = kwEl.value;
      render();
    };
    body.querySelectorAll("[data-add]").forEach(b => {
      b.onclick = () => {
        const r = Store.sendRequest(u.id, b.dataset.add);
        UI.toast(r.msg, r.ok ? "success" : "warn");
        render();
      };
    });
  }

  render();
})();