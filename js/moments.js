/* 我的动态：全部/照片动态流 + 权限设置 + 发布 */
UserShell.boot({ hideTab: true, back: "my.html", title: "我的动态" });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("moments-body");

  const PRIVACY = [
    { key: "public", name: "公开" },
    { key: "friends", name: "好友可见" },
    { key: "private", name: "仅自己" },
  ];
  const privName = key => (PRIVACY.find(p => p.key === key) || {}).name || key;
  const dname = id => Store.displayName(u.id, id);   // 优先备注名
  const PRESET_PHOTOS = [
    { g: "linear-gradient(135deg,#f2994a,#ef5e47)", e: "🌇" },
    { g: "linear-gradient(135deg,#56ccf2,#2f80ed)", e: "🌊" },
    { g: "linear-gradient(135deg,#a1e657,#43a047)", e: "🍃" },
  ];

  let tab = "all"; // all | photos | settings

  const findMine = id => Store.listMoments({ uid: u.id, scope: "mine" }).find(m => m.id === id) || null;

  function findOriginal(id) {
    return [...Store.listMoments({ scope: "all" }), ...Store.listMoments({ uid: u.id, scope: "mine" })]
      .find(m => m.id === id) || null;
  }

  function renderMoment(m) {
    const au = Store.getUser(m.uid) || u;
    const liked = m.likes.includes(u.id);
    let content = "";

    if (m.orig) {
      const orig = findOriginal(m.orig.id);
      const oau = Store.getUser(m.orig.uid);
      content += `<div class="m-repost-tip">转发了 ${UI.esc(oau ? dname(oau.id) : "该用户")} 的动态</div>`;
      if (orig) {
        const op = orig.photos && orig.photos[0];
        content += `<div class="m-repost-card">
          ${orig.text ? `<div class="m-text">${UI.esc(orig.text)}</div>` : ""}
          ${op ? `<div class="m-photo m-photo-sm" style="background:${op.g}">${op.e}</div>` : ""}
        </div>`;
      }
    } else {
      if (m.text) content += `<div class="m-text">${UI.esc(m.text)}</div>`;
      if (m.photos && m.photos[0]) content += `<div class="m-photo" style="background:${m.photos[0].g}">${m.photos[0].e}</div>`;
    }

    return `
      <div class="card moment-card fade-in">
        <div class="m-head">
          <span class="m-ava">${UI.avatarEl(au, "md")}</span>
          <div class="m-head-main">
            <div class="m-name ellipsis">${UI.esc(m.uid ? dname(m.uid) : au.nickname)}</div>
            <div class="m-time">${UI.timeAgo(m.t)}${m.privacy !== "public" ? ` · ${privName(m.privacy)}` : ""}</div>
          </div>
          <button class="icon-btn" data-more="${m.id}">${UI.icon("more", 20)}</button>
        </div>
        ${content}
        <div class="m-actions">
          <button class="m-action ${liked ? "on" : ""}" data-like="${m.id}">${UI.icon("like", 19)}${m.likes.length ? `<span class="num">${m.likes.length}</span>` : ""}</button>
          <button class="m-action" data-comment="${m.id}">${UI.icon("comment", 19)}${m.comments.length ? `<span class="num">${m.comments.length}</span>` : ""}</button>
          ${m.reposts ? `<span class="m-repost-count">${UI.icon("share", 16)}${m.reposts}</span>` : ""}
        </div>
        ${m.likes.length ? `<div class="m-likers txt-xs txt-3">❤️ ${m.likes.map(x => UI.esc(dname(x))).join("、")}</div>` : ""}
      </div>`;
  }

  function renderSettings() {
    const rows = PRIVACY.map(p => `
      <div class="list-item tap" data-set="${p.key}">
        <div class="li-main"><div class="li-title">${p.name}</div></div>
        ${u.privacyDefault === p.key ? `<span class="sett-check">✓</span>` : ""}
      </div>`).join("");
    return `<div class="list">${rows}</div>
      <p class="sett-tip">默认权限用于新发布的动态。</p>`;
  }

  function render() {
    let html = `
      <div class="seg moments-seg">
        <button data-tab="all" class="${tab === "all" ? "on" : ""}">全部</button>
        <button data-tab="photos" class="${tab === "photos" ? "on" : ""}">照片</button>
        <button data-tab="settings" class="${tab === "settings" ? "on" : ""}">权限设置</button>
      </div>`;

    if (tab === "settings") {
      html += renderSettings();
    } else {
      const scope = tab === "all" ? "mine" : "photos";
      const list = Store.listMoments({ uid: u.id, scope });
      html += `<div class="moment-list">${list.length
        ? list.map(renderMoment).join("")
        : `<div class="card">${UI.emptyBox("🍃", tab === "photos" ? "还没有照片动态" : "还没有动态", "点右下角 + 发布第一条动态吧")}</div>`
      }</div>`;
    }
    body.innerHTML = html;
  }

  function openComments(mid) {
    const m = findMine(mid);
    if (!m) return;
    const listHtml = m.comments.length
      ? m.comments.map(c => {
          const cu = Store.getUser(c.uid);
          return `<div class="cmt-item">
            <span>${UI.avatarEl(cu, "sm")}</span>
            <div class="cmt-main">
              <div class="cmt-name">${UI.esc(cu ? dname(cu.id) : "用户")}</div>
              <div class="cmt-text">${UI.esc(c.text)}</div>
            </div>
            <span class="cmt-time">${UI.timeAgo(c.t)}</span>
          </div>`;
        }).join("")
      : `<div class="cmt-empty">还没有评论，来抢沙发～</div>`;

    const s = UI.sheet(`
      <div class="sheet-head"><h3>评论（${m.comments.length}）</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <div class="cmt-list">${listHtml}</div>
      <div class="cmt-inputbar">
        <input class="input cmt-in" placeholder="说点什么…" maxlength="120">
        <button class="btn primary cmt-send">发送</button>
      </div>`);

    s.el.querySelector("[data-x]").onclick = () => s.close();
    const inp = s.el.querySelector(".cmt-in");
    const send = () => {
      const text = inp.value.trim();
      if (!text) { UI.toast("评论不能为空", "warn"); return; }
      Store.addComment(mid, u.id, text);
      s.close();
      render();
      openComments(mid);
    };
    s.el.querySelector(".cmt-send").onclick = send;
    inp.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
    setTimeout(() => inp.focus(), 150);
  }

  function openMore(mid) {
    const m = findMine(mid);
    if (!m) return;
    const rows = PRIVACY.map(p => `
      <div class="priv-row ${m.privacy === p.key ? "on" : ""}" data-p="${p.key}">
        <span>${p.name}</span>${m.privacy === p.key ? `<span class="check">✓</span>` : ""}
      </div>`).join("");
    const s = UI.sheet(`
      <div class="sheet-head"><h3>谁可以看</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <div class="priv-list">${rows}</div>
      <button class="btn danger-soft block del-row">删除这条动态</button>`);
    s.el.querySelector("[data-x]").onclick = () => s.close();
    s.el.querySelectorAll("[data-p]").forEach(el => el.onclick = () => {
      Store.setMomentPrivacy(mid, u.id, el.dataset.p);
      s.close();
      UI.toast("已设为「" + privName(el.dataset.p) + "」", "success");
      render();
    });
    s.el.querySelector(".del-row").onclick = () => {
      s.close();
      UI.toast("演示版暂不支持删除，可设为「仅自己」", "info");
    };
  }

  function openPublish() {
    let selected = [];
    let privacy = u.privacyDefault || "friends";
    const s = UI.sheet(`
      <div class="sheet-head"><h3>发布动态</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <textarea class="textarea pub-text" placeholder="分享此刻的想法…" maxlength="300"></textarea>
      <div class="pub-label">添加照片（可多选）</div>
      <div class="pub-photos">
        ${PRESET_PHOTOS.map((p, i) => `<div class="pub-photo" data-i="${i}" style="background:${p.g}">${p.e}</div>`).join("")}
      </div>
      <div class="pub-label">谁可以看</div>
      <div class="seg pub-seg">
        ${PRIVACY.map(p => `<button data-priv="${p.key}" class="${privacy === p.key ? "on" : ""}">${p.name}</button>`).join("")}
      </div>
      <div class="sheet-actions"><button class="btn primary block pub-go">发布</button></div>`);

    const ta = s.el.querySelector(".pub-text");
    const photoEls = s.el.querySelectorAll(".pub-photo");
    s.el.querySelector("[data-x]").onclick = () => s.close();

    photoEls.forEach(el => el.onclick = () => {
      const i = Number(el.dataset.i);
      selected = selected.includes(i) ? selected.filter(x => x !== i) : [...selected, i];
      photoEls.forEach(p => p.classList.toggle("on", selected.includes(Number(p.dataset.i))));
    });
    s.el.querySelectorAll("[data-priv]").forEach(b => b.onclick = () => {
      privacy = b.dataset.priv;
      s.el.querySelectorAll("[data-priv]").forEach(bb => bb.classList.toggle("on", bb === b));
    });
    s.el.querySelector(".pub-go").onclick = () => {
      const text = ta.value.trim();
      if (!text && !selected.length) { UI.toast("写点什么吧", "warn"); return; }
      Store.addMoment(u.id, { text, photos: selected.map(i => PRESET_PHOTOS[i]), privacy });
      s.close();
      UI.toast("发布成功", "success");
      render();
    };
  }

  body.addEventListener("click", e => {
    const t = e.target.closest("[data-tab]");
    if (t) { tab = t.dataset.tab; render(); return; }
    const like = e.target.closest("[data-like]");
    if (like) { Store.toggleLike(like.dataset.like, u.id); render(); return; }
    const cmt = e.target.closest("[data-comment]");
    if (cmt) { openComments(cmt.dataset.comment); return; }
    const more = e.target.closest("[data-more]");
    if (more) { openMore(more.dataset.more); return; }
    const set = e.target.closest("[data-set]");
    if (set) {
      Store.updateProfile(u.id, { privacyDefault: set.dataset.set });
      UI.toast("已设置默认权限为「" + privName(set.dataset.set) + "」", "success");
      render();
    }
  });

  const fab = document.createElement("button");
  fab.className = "fab";
  fab.setAttribute("aria-label", "发布动态");
  fab.innerHTML = UI.icon("plus", 26, "#fff");
  fab.onclick = openPublish;
  document.body.appendChild(fab);

  render();
})();