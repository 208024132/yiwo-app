/* 好友资料页逻辑 */

const fid = new URLSearchParams(location.search).get("id");
const target = Store.getUser(fid);
const meTop = Store.currentUser();
const dispName = target ? (meTop ? Store.displayName(meTop.id, fid) : target.nickname) : "好友资料";
UserShell.boot({ tab: null, title: dispName, back: "friends.html", hideTab: true });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  if (!target) { location.replace("friends.html"); return; }

  const body = document.getElementById("profile-body");
  const nameOf = id => Store.displayName(u.id, id);   // 优先备注名

  /* ---------- 动态卡片 ---------- */
  function momentCard(m) {
    const liked = (m.likes || []).includes(u.id);
    const photos = (m.photos || []).map(p => UI.photoBox(p)).join("");
    let text;
    if (m.text) text = UI.esc(m.text);
    else if (m.type === "repost" && m.orig) {
      const ou = Store.getUser(m.orig.uid);
      text = `<span class="m-repost">转发了 ${UI.esc(ou ? nameOf(ou.id) : "好友")} 的动态</span>`;
    } else text = UI.esc("分享了动态");
    return `
      <article class="card moment-card fade-in" data-mid="${m.id}">
        <div class="m-head">
          <span class="m-ava">${UI.avatarEl(target, "md")}</span>
          <div class="m-main">
            <div class="m-name ellipsis">${UI.esc(nameOf(fid))}</div>
            <div class="m-time">${UI.timeAgo(m.t)}</div>
          </div>
        </div>
        <div class="m-text">${text}</div>
        ${photos ? `<div class="m-photos" style="grid-template-columns:${(m.photos.length > 1) ? "repeat(2,1fr)" : "1fr"}">${photos}</div>` : ""}
        ${UI.qzInter({ likes: m.likes || [], comments: m.comments || [], nameOf })}
        ${UI.qzActs({ liked, likes: (m.likes || []).length, comments: (m.comments || []).length, reposts: m.reposts || 0 })}
      </article>`;
  }

  function findMoment(mid) {
    return Store.listMoments({ uid: fid, scope: "user" }).find(m => m.id === mid);
  }

  function openComments(mid) {
    const m = findMoment(mid);
    if (!m) return;
    const list = (m.comments || []).map(c => {
      const cu = Store.getUser(c.uid);
      return `<div class="cmt-item">
        <span class="cmt-ava">${UI.avatarEl(cu, "sm")}</span>
        <div class="cmt-main">
          <div class="cmt-name ellipsis">${UI.esc(cu ? nameOf(c.uid) : "用户")}</div>
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
      render();
    };
    s.el.querySelector("[data-send]").onclick = send;
    input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
    setTimeout(() => input.focus(), 120);
  }

  function doShare(mid) {
    UI.confirm("转发动态", "转发后你的好友也能看到这条动态").then(ok => {
      if (!ok) return;
      Store.repost(mid, u.id);
      UI.toast("已转发", "success");
      render();
    });
  }

  /* ---------- 渲染 ---------- */
  function render() {
    const isF = Store.isFriend(u.id, fid);

    let actions = "";
    if (u.id !== fid) {
      if (isF) {
        actions = `<div class="profile-actions">
          <a class="btn primary" href="chat.html?id=${fid}">${UI.icon("comment", 16)} 发消息</a>
          <button class="btn ghost" data-del>删除好友</button>
        </div>
        <div class="profile-actions">
          <button class="btn ghost" data-remark>${UI.icon("edit", 16)} 备注</button>
          <button class="btn ghost" data-movegroup>${UI.icon("users", 16)} 移动分组</button>
        </div>`;
      } else {
        actions = `<div class="profile-actions"><button class="btn primary block" data-add>加为好友</button></div>`;
      }
    }

    const remk = isF ? Store.remarkOf(u.id, fid) : "";
    const grpName = isF ? ((Store.getGroups(u.id).find(g => g.id === Store.groupOf(u.id, fid)) || {}).name || "") : "";

    const moments = Store.listMoments({ uid: fid, scope: "user" });
    body.innerHTML = `
      <section class="profile-hero fade-in">
        <div class="profile-ava">${UI.avatarEl(target, "xl")}</div>
        <div class="profile-name">${UI.esc(nameOf(fid))}</div>
        ${isF && remk ? `<div class="profile-nick">昵称：${UI.esc(target.nickname)}</div>` : ""}
        <div class="profile-sig">${UI.esc(target.signature || "这个人很懒，什么都没写")}</div>
        ${target.region ? `<div class="profile-region">📍 ${UI.esc(target.region)}</div>` : ""}
      </section>
      ${actions}
      <section class="list profile-info">
        ${isF ? `<div class="list-item"><span class="info-label">备注</span><span class="info-val">${UI.esc(remk || "未设置")}</span></div>
        <div class="list-item"><span class="info-label">好友分组</span><span class="info-val">${UI.esc(grpName || "—")}</span></div>` : ""}
        <div class="list-item"><span class="info-label">性别</span><span class="info-val">${UI.esc(target.gender || "保密")}</span></div>
        <div class="list-item"><span class="info-label">年龄</span><span class="info-val">${target.age ? target.age + " 岁" : "未填写"}</span></div>
        <div class="list-item"><span class="info-label">地区</span><span class="info-val">${UI.esc(target.region || "未填写")}</span></div>
        <div class="list-item"><span class="info-label">注册时间</span><span class="info-val">${UI.fmtDate(target.regTime)}</span></div>
      </section>
      <section class="section-title"><h2>TA 的动态</h2></section>
      ${moments.length ? `<div class="moments-feed">${moments.map(momentCard).join("")}</div>` : UI.emptyBox("🍃", "暂无动态")}
    `;
    bind();
  }

  // 同步顶栏标题（备注变化后）
  function syncHead() {
    const head = document.querySelector(".app-header .head-title");
    if (head) head.textContent = nameOf(fid);
  }

  // 备注名字（留空恢复昵称）
  function editRemark() {
    const nick = target.nickname || "好友";
    UI.promptInput({
      title: "设置备注",
      placeholder: "备注名（最多 12 个字），留空恢复昵称",
      value: Store.remarkOf(u.id, fid), max: 12,
    }).then(name => {
      if (name == null) return;
      const r = Store.setRemark(u.id, fid, name);
      if (!r.ok) { UI.toast(r.msg, "warn"); return; }
      UI.toast(r.name ? "备注已保存" : "已恢复昵称「" + nick + "」", "success");
      syncHead();
      render();
    });
  }

  // 移动分组
  function moveGroup() {
    const cur = Store.groupOf(u.id, fid);
    const s = UI.sheet(`
      <div class="sheet-head"><h3>移动分组</h3><button class="icon-btn" data-close>${UI.icon("close", 18)}</button></div>
      <div class="txt-sm txt-2 grp-tip">将「${UI.esc(nameOf(fid))}」移动到：</div>
      <div class="list">
        ${Store.getGroups(u.id).map(g => `<div class="list-item tap" data-pick="${g.id}">
          <span class="li-main"><span class="li-title">${UI.esc(g.name)}</span></span>
          ${g.id === cur ? `<span class="grp-check">✓</span>` : ""}
        </div>`).join("")}
      </div>`);
    s.el.querySelector("[data-close]").onclick = s.close;
    s.el.querySelectorAll("[data-pick]").forEach(el => el.onclick = () => {
      Store.assignGroup(u.id, fid, el.dataset.pick);
      s.close();
      UI.toast("已移动到「" + (Store.getGroups(u.id).find(g => g.id === el.dataset.pick) || {}).name + "」", "success");
      render();
    });
  }

  function bind() {
    const remk = body.querySelector("[data-remark]");
    if (remk) remk.onclick = editRemark;
    const mv = body.querySelector("[data-movegroup]");
    if (mv) mv.onclick = moveGroup;

    const del = body.querySelector("[data-del]");
    if (del) del.onclick = async () => {
      const ok = await UI.confirm("删除好友", "删除后将解除好友关系，且无法查看对方的朋友圈动态。");
      if (!ok) return;
      Store.deleteFriend(u.id, fid);
      UI.toast("已删除好友", "success");
      location.href = "friends.html";
    };
    const add = body.querySelector("[data-add]");
    if (add) add.onclick = () => {
      const r = Store.sendRequest(u.id, fid);
      UI.toast(r.msg, r.ok ? "success" : "warn");
      render();
    };
  }

  body.addEventListener("click", e => {
    const act = e.target.closest("[data-act]");
    if (!act) return;
    const cardEl = act.closest("[data-mid]");
    if (!cardEl) return;
    const mid = cardEl.dataset.mid;
    const type = act.dataset.act;
    if (type === "like") { Store.toggleLike(mid, u.id); render(); }
    else if (type === "comment") { openComments(mid); }
    else if (type === "share") { doShare(mid); }
  });

  render();
})();