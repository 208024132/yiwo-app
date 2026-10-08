/* 通知中心：聚合好友申请 / 未读消息 / 动态互动 */

UserShell.boot({ tab: "friends", title: "通知", back: "index.html" });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("notif-body");

  const nameOf = fid => Store.displayName(u.id, fid);

  function render() {
    const reqs = Store.pendingRequests(u.id);

    const unread = Store.getConversations(u.id)
      .filter(c => c.unread > 0)
      .sort((a, b) => (b.last ? b.last.t : 0) - (a.last ? a.last.t : 0));

    // 动态互动：我发出的动态收到的点赞 / 评论（点赞按人聚合，评论逐条展示）
    const inter = [];
    Store.listMoments({ uid: u.id, scope: "mine" }).forEach(m => {
      const likers = (m.likes || []).filter(id => id !== u.id);
      if (likers.length) {
        inter.push({
          uid: likers[0],
          text: likers.length > 1
            ? nameOf(likers[0]) + " 等 " + likers.length + " 人赞了你的动态"
            : nameOf(likers[0]) + " 赞了你的动态",
          t: m.t,
        });
      }
      (m.comments || []).forEach(c => {
        if (c.uid === u.id) return;
        inter.push({
          uid: c.uid,
          text: nameOf(c.uid) + " 评论了你的动态：" + c.text,
          t: c.t,
        });
      });
    });
    inter.sort((a, b) => b.t - a.t);

    const sections = [];

    if (reqs.length) {
      sections.push(`
        <section class="section-title"><h2>好友申请</h2><span class="badge">${reqs.length}</span></section>
        <div class="list">
          ${reqs.map(r => {
            const from = r.from || { id: "", nickname: "用户" };
            return `
            <div class="list-item">
              ${UI.avatarEl(r.from, "md")}
              <div class="li-main">
                <div class="li-title ellipsis">${UI.esc(from.nickname)}</div>
                <div class="li-sub">${UI.timeAgo(r.t)} 申请添加你为好友</div>
              </div>
              <button class="btn ghost sm" data-reject="${from.id}">拒绝</button>
              <button class="btn primary sm" data-accept="${from.id}">同意</button>
            </div>`;
          }).join("")}
        </div>`);
    }

    if (unread.length) {
      sections.push(`
        <section class="section-title"><h2>未读消息</h2><span class="badge">${unread.reduce((s, c) => s + c.unread, 0)}</span></section>
        <div class="list">
          ${unread.map(c => `
            <a class="list-item tap" data-chat="${c.user.id}">
              ${UI.avatarEl(c.user, "md")}
              <div class="li-main">
                <div class="li-title ellipsis">${UI.esc(nameOf(c.user.id))}</div>
                <div class="li-sub ellipsis">${UI.esc(c.last ? c.last.text : "新消息")}</div>
              </div>
              <span class="badge">${c.unread}</span>
              <span class="li-arrow">${UI.icon("chevron-right", 18)}</span>
            </a>`).join("")}
        </div>`);
    }

    if (inter.length) {
      sections.push(`
        <section class="section-title"><h2>动态互动</h2></section>
        <div class="list">
          ${inter.map(it => `
            <a class="list-item tap" href="moments.html">
              ${UI.avatarEl(Store.getUser(it.uid), "md")}
              <div class="li-main">
                <div class="li-title ellipsis">${UI.esc(it.text)}</div>
                <div class="li-sub">${UI.timeAgo(it.t)}</div>
              </div>
              <span class="li-arrow">${UI.icon("chevron-right", 18)}</span>
            </a>`).join("")}
        </div>`);
    }

    body.innerHTML = sections.length
      ? sections.join("")
      : UI.emptyBox("🔔", "暂无通知", "好友申请、未读消息和动态互动都会显示在这里");
  }

  body.addEventListener("click", e => {
    const chat = e.target.closest("[data-chat]");
    if (chat) { location.href = "chat.html?id=" + encodeURIComponent(chat.dataset.chat); return; }

    const accept = e.target.closest("[data-accept]");
    if (accept) {
      Store.acceptRequest(u.id, accept.dataset.accept);
      UI.toast("已添加为好友", "success");
      render();
      return;
    }

    const reject = e.target.closest("[data-reject]");
    if (reject) {
      Store.rejectRequest(u.id, reject.dataset.reject);
      UI.toast("已拒绝好友申请", "success");
      render();
    }
  });

  render();
})();
