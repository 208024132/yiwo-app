/* 添加好友页逻辑 */

UserShell.boot({ tab: null, title: Store.getTitle("page.addFriend"), back: "friends.html", hideTab: true });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("add-body");

  let kw = "";
  let searchSeq = 0;    // 竞态防护：只采纳最新一次搜索的结果，丢弃过期返回
  let knownUsers = {};  // 本次渲染结果 id -> 用户档案（供「添加」时把陌生人落本地）

  // sentIds 需空值安全：云端陌生人尚未进本地库时，sentRequests 里 to 可能为 null
  const sentIds = () => new Set(Store.sentRequests(u.id).map(r => r.to && r.to.id).filter(Boolean));

  // yiwo_users 行(下划线) -> 供 rowHtml 使用的驼峰档案
  function fromCloudRow(r) {
    if (!r || !r.id) return null;
    return {
      id: String(r.id),
      nickname: r.nickname || "",
      account: r.account || "",
      signature: r.signature || "",
      avatarEmoji: r.avatar_emoji || "",
      avatarColor: Number(r.avatar_color) || 0,
    };
  }

  // 云端搜索结果优先，本地已同步档案补充，按 id 去重
  function mergeUsers(cloudUsers, localUsers) {
    const seen = {}, out = [];
    cloudUsers.concat(localUsers).forEach(usr => {
      if (usr && usr.id && !seen[usr.id]) { seen[usr.id] = 1; out.push(usr); }
    });
    return out;
  }

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

  async function render() {
    const q = kw.trim().toLowerCase();
    const mySeq = ++searchSeq;
    const btn = document.getElementById("search-btn");

    let results = [];
    let note = "";

    if (q) {
      // 搜索态：先云端，再本地合并去重；云端陌生人补充本地没有的账号
      if (btn) { btn.disabled = true; btn.textContent = "搜索中…"; }
      let cloudUsers = [];
      try {
        const rows = await Cloud.searchUsers(q);
        cloudUsers = rows.map(fromCloudRow).filter(x => x && x.id);
      } catch (e) { cloudUsers = []; }
      if (mySeq !== searchSeq) return;   // 已被更新的搜索取代，丢弃过期结果

      const localUsers = Store.listUsers().filter(usr =>
        [usr.nickname, usr.id, usr.account].join(" ").toLowerCase().includes(q));
      results = mergeUsers(cloudUsers, localUsers);
      if (!cloudUsers.length && results.length) note = "云端暂未返回更多用户";
    } else {
      // 推荐态：保留本地推荐逻辑
      results = Store.listUsers().filter(usr =>
        usr.id !== u.id && !Store.isFriend(u.id, usr.id) && !sentIds().has(usr.id)).slice(0, 8);
      if (results.length) note = "当前云端暂未返回更多用户";
    }

    knownUsers = {};
    results.forEach(usr => { knownUsers[usr.id] = usr; });

    body.innerHTML = `
      <div class="search-row">
        <div class="search-bar">${UI.icon("search", 18)}<input id="kw" placeholder="搜索昵称 / 用户ID / 账号" value="${UI.esc(kw)}" aria-label="搜索用户"></div>
        <button class="btn primary sm" id="search-btn">搜索</button>
      </div>
      <div class="section-title"><h2>${UI.esc(Store.getTitle(q ? "addFriend.result" : "addFriend.recommend"))}</h2></div>
      ${note ? `<div style="font-size:var(--fs-xs,12px);color:var(--text-3,#999);padding:2px 4px;margin:-6px 0 8px;">${UI.esc(note)}</div>` : ""}
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
        const target = knownUsers[b.dataset.add];
        if (target) Store.ensureUser(target);   // 云端陌生人先落本地，保证「已发送」与后续渲染一致
        const r = Store.sendRequest(u.id, b.dataset.add);
        UI.toast(r.msg, r.ok ? "success" : "warn");
        render();
      };
    });
  }

  render();
})();
