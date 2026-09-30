/* 好友页逻辑：联系人 / 动态 / 新请求 */

UserShell.boot({ tab: "friends", title: "好友", right: null });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("friends-body");

  let tab = "contacts";
  let kw = "";

  const pendingCount = () => Store.pendingRequests(u.id).length;

  /* ---------- 动态卡片 ---------- */
  function momentCard(m) {
    const au = Store.getUser(m.uid) || { nickname: "神秘人", avatarEmoji: "🙂", avatarColor: 0 };
    const liked = (m.likes || []).includes(u.id);
    const photos = (m.photos || []).map(p =>
      `<span class="m-photo" style="background:${p.g}">${p.e}</span>`).join("");
    let text;
    if (m.text) text = UI.esc(m.text);
    else if (m.type === "repost" && m.orig) {
      const ou = Store.getUser(m.orig.uid);
      text = `<span class="m-repost">转发了 ${UI.esc(ou ? ou.nickname : "好友")} 的动态</span>`;
    } else text = UI.esc("分享了动态");
    return `
      <article class="card moment-card fade-in" data-mid="${m.id}">
        <div class="m-head">
          <span class="m-ava">${UI.avatarEl(au, "md")}</span>
          <div class="m-main">
            <div class="m-name ellipsis">${UI.esc(au.nickname)}</div>
            <div class="m-time">${UI.timeAgo(m.t)}</div>
          </div>
        </div>
        <div class="m-text">${text}</div>
        ${photos ? `<div class="m-photos" style="grid-template-columns:${(m.photos.length > 1) ? "repeat(2,1fr)" : "1fr"}">${photos}</div>` : ""}
        <div class="m-actions">
          <button class="m-act ${liked ? "on" : ""}" data-act="like"><span class="m-act-ico">${UI.icon("like", 18)}</span>${(m.likes || []).length}</button>
          <button class="m-act" data-act="comment"><span class="m-act-ico">${UI.icon("comment", 18)}</span>${(m.comments || []).length}</button>
          <button class="m-act" data-act="share"><span class="m-act-ico">${UI.icon("share", 18)}</span>${m.reposts || 0}</button>
        </div>
      </article>`;
  }

  function findMoment(mid) {
    return Store.listMoments({ uid: u.id, scope: "friends" }).find(m => m.id === mid);
  }

  /* ---------- 评论弹层 ---------- */
  function openComments(mid) {
    const m = findMoment(mid);
    if (!m) return;
    const list = (m.comments || []).map(c => {
      const cu = Store.getUser(c.uid);
      return `<div class="cmt-item">
        <span class="cmt-ava">${UI.avatarEl(cu, "sm")}</span>
        <div class="cmt-main">
          <div class="cmt-name ellipsis">${UI.esc(cu.nickname)}</div>
          <div class="cmt-text">${UI.esc(c.text)}</div>
          <div class="cmt-time">${UI.timeAgo(c.t)}</div>
        </div>
      </div>`;
    }).join("");
    const s = UI.sheet(`
      <div class="sheet-head"><h3>评论</h3><button class="icon-btn" data-close>${UI.icon("close", 18)}</button></div>
      <div class="cmt-list">${list || `<div class="cmt-none">还没有评论，来抢沙发～</div>`}</div>
      <div class="cmt-inputbar">
        <input class="input" placeholder="写下你的评论…" maxlength="100">
        <button class="btn primary sm" data-send>发送</button>
      </div>`);
    const input = s.el.querySelector("input");
    s.el.querySelector("[data-close]").onclick = () => s.close();
    const send = () => {
      const txt = input.value.trim();
      if (!txt) { UI.toast("请输入评论内容", "warn"); return; }
      Store.addComment(mid, u.id, txt);
      s.close();
      UI.toast("评论成功", "success");
      updateMoments();
    };
    s.el.querySelector("[data-send]").onclick = send;
    input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
    setTimeout(() => input.focus(), 120);
  }

  /* ---------- 转发 ---------- */
  function doShare(mid) {
    UI.confirm("转发动态", "转发后你的好友也能看到这条动态").then(ok => {
      if (!ok) return;
      Store.repost(mid, u.id);
      UI.toast("已转发", "success");
      updateMoments();
    });
  }

  /* ---------- 分段渲染 ---------- */
  function render() {
    const pc = pendingCount();
    body.innerHTML = `
      <div class="seg friends-seg">
        <button data-tab="contacts" class="${tab === "contacts" ? "on" : ""}">联系人</button>
        <button data-tab="moments" class="${tab === "moments" ? "on" : ""}">动态</button>
        <button data-tab="requests" class="${tab === "requests" ? "on" : ""}">新请求${pc > 0 ? `<span class="seg-badge">${pc}</span>` : ""}</button>
      </div>
      <div id="friends-content"></div>`;

    if (tab === "contacts") renderContacts();
    else if (tab === "moments") updateMoments();
    else updateRequests();
  }

  function renderContacts() {
    const box = document.getElementById("friends-content");
    box.innerHTML = `
      <div class="search-row">
        <div class="search-bar friends-search">${UI.icon("search", 18)}<input placeholder="搜索好友或消息" value="${UI.esc(kw)}"></div>
        <a class="btn ghost sm add-friend-entry" href="add-friend.html">${UI.icon("plus", 15)} 添加</a>
      </div>
      <div id="contacts-box"></div>`;
    const si = box.querySelector(".friends-search input");
    si.oninput = () => { kw = si.value; updateContacts(); };
    updateContacts();
  }

  function updateContacts() {
    const box = document.getElementById("contacts-box");
    if (!box) return;
    const lists = Store.getConversations(u.id);
    const q = kw.trim().toLowerCase();
    const filtered = q
      ? lists.filter(c => (c.user.nickname + " " + (c.last ? c.last.text : "")).toLowerCase().includes(q))
      : lists;
    box.innerHTML = filtered.length
      ? `<div class="list mt-8">${filtered.map(c => {
          const last = c.last;
          const time = last ? UI.timeAgo(last.t) : "";
          const text = last ? last.text : "还没有聊过，打个招呼吧";
          return `<div class="list-item tap" data-chat="${c.user.id}">
            ${UI.avatarEl(c.user, "md")}
            <div class="li-main">
              <div class="li-title ellipsis">${UI.esc(c.user.nickname)}</div>
              <div class="li-sub ellipsis">${UI.esc(text)}</div>
            </div>
            <div class="li-right">
              ${time ? `<div class="li-time">${time}</div>` : ""}
              ${c.unread > 0 ? `<span class="badge">${c.unread}</span>` : ""}
            </div>
          </div>`;
        }).join("")}</div>`
      : UI.emptyBox("👋", "还没有好友", "点击上方「添加」认识新朋友吧");
  }

  function updateMoments() {
    const box = document.getElementById("friends-content");
    if (!box) return;
    const feed = Store.listMoments({ uid: u.id, scope: "friends" });
    box.innerHTML = feed.length
      ? `<div class="moments-feed mt-8">${feed.map(momentCard).join("")}</div>`
      : UI.emptyBox("🍃", "还没有好友动态", "去添加好友，看看大家都在做什么");
  }

  function updateRequests() {
    const box = document.getElementById("friends-content");
    if (!box) return;
    const reqs = Store.pendingRequests(u.id);
    box.innerHTML = reqs.length
      ? `<div class="req-list mt-8">${reqs.map(r => `
        <div class="card req-card">
          ${UI.avatarEl(r.from, "md")}
          <div class="req-main">
            <div class="req-name ellipsis">${UI.esc(r.from.nickname)}</div>
            <div class="req-time">${UI.timeAgo(r.t)} 申请添加你为好友</div>
          </div>
          <div class="req-btns">
            <button class="btn ghost sm" data-reject="${r.from.id}">拒绝</button>
            <button class="btn primary sm" data-accept="${r.from.id}">通过</button>
          </div>
        </div>`).join("")}</div>`
      : UI.emptyBox("🧑‍🤝‍🧑", "暂无新的好友申请");
  }

  /* ---------- 事件委托 ---------- */
  body.addEventListener("click", e => {
    const tabBtn = e.target.closest("[data-tab]");
    if (tabBtn) { tab = tabBtn.dataset.tab; kw = ""; render(); return; }

    const chatItem = e.target.closest("[data-chat]");
    if (chatItem) { location.href = "chat.html?id=" + chatItem.dataset.chat; return; }

    const act = e.target.closest("[data-act]");
    if (act) {
      const cardEl = act.closest("[data-mid]");
      if (!cardEl) return;
      const mid = cardEl.dataset.mid;
      const type = act.dataset.act;
      if (type === "like") { Store.toggleLike(mid, u.id); updateMoments(); }
      else if (type === "comment") { openComments(mid); }
      else if (type === "share") { doShare(mid); }
      return;
    }

    const accept = e.target.closest("[data-accept]");
    if (accept) {
      Store.acceptRequest(u.id, accept.dataset.accept);
      UI.toast("已添加为好友", "success");
      render();
      return;
    }

    const reject = e.target.closest("[data-reject]");
    if (reject) { Store.rejectRequest(u.id, reject.dataset.reject); render(); }
  });

  render();
})();