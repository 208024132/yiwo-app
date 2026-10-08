/* 好友页逻辑：联系人（好友分组）/ 消息 / 动态，顶部导航可长按拖动排序 */

UserShell.boot({ tab: "friends", title: Store.getTitle("page.friends"), right: null });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("friends-body");

  const TAB_DEF = { contacts: "联系人", messages: "消息", moments: "动态" };
  const nav = () => Store.getFriendNav(u.id);
  let tab = nav()[0];
  let kw = "";       // 联系人搜索
  let mkw = "";      // 消息搜索
  let reqOpen = false;
  const expanded = {};    // 分组展开状态（默认全部折叠）

  const pendingCount = () => Store.pendingRequests(u.id).length;

  /* ---------- 动态卡片 ---------- */
  function momentCard(m) {
    const au = Store.getUser(m.uid) || { nickname: "神秘人", avatarEmoji: "🙂", avatarColor: 0 };
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
          <span class="m-ava">${UI.avatarEl(au, "md")}</span>
          <div class="m-main">
            <div class="m-name ellipsis">${UI.esc(m.uid ? nameOf(m.uid) : au.nickname)}</div>
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
        <input class="input" placeholder="写下你的评论…" maxlength="100" aria-label="评论内容">
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

  /* ---------- 顶部导航（长按拖动排序） ---------- */
  function navHtml() {
    return `<div class="seg friends-seg" id="friends-seg">
      ${nav().map(k => `<button data-tab="${k}" class="${tab === k ? "on" : ""}" draggable="false">${TAB_DEF[k]}</button>`).join("")}
    </div>`;
  }

  function render() {
    closeSwipe();
    body.innerHTML = navHtml() + `<div id="friends-content"></div>`;
    bindNavSort();
    if (tab === "contacts") renderContacts();
    else if (tab === "messages") renderMessages();
    else updateMoments();
  }

  /* ---------- 联系人：新的朋友 + 好友分组 ---------- */
  const nameOf = fid => Store.displayName(u.id, fid);

  function friendRow(c) {
    const last = c.last;
    const text = last ? last.text : "还没有聊过，打个招呼吧";
    return `<div class="list-item tap" data-chat="${c.user.id}">
      ${UI.avatarEl(c.user, "md")}
      <div class="li-main">
        <div class="li-title ellipsis">${UI.esc(nameOf(c.user.id))}</div>
        <div class="li-sub ellipsis">${UI.esc(text)}</div>
      </div>
      <div class="li-acts">
        <button class="btn ghost sm" data-remark="${c.user.id}">备注</button>
        <button class="btn ghost sm" data-setgroup="${c.user.id}">分组</button>
      </div>
    </div>`;
  }

  function renderContacts() {
    const box = document.getElementById("friends-content");
    const pc = pendingCount();
    box.innerHTML = `
      <div class="search-row">
        <div class="search-bar friends-search">${UI.icon("search", 18)}<input placeholder="搜索好友" value="${UI.esc(kw)}" aria-label="搜索好友"></div>
        <a class="btn ghost sm add-friend-entry" href="add-friend.html">${UI.icon("plus", 15)} 添加</a>
      </div>
      <div class="list mt-8">
        <div class="list-item tap req-entry" id="req-entry">
          <span class="req-ico">${UI.icon("users", 20)}</span>
          <span class="li-main">
            <span class="li-title">新的朋友</span>
            <span class="li-sub">${pc ? pc + " 条好友申请待处理" : "暂无新的好友申请"}</span>
          </span>
          ${pc ? `<span class="badge">${pc}</span>` : ""}
          <span class="li-arrow ${reqOpen ? "on" : ""}">${UI.icon("chevron-right", 18)}</span>
        </div>
      </div>
      <div id="req-box"></div>
      <div class="grp-bar">
        <span class="txt-xs txt-3">好友分组</span>
        <button class="btn ghost sm" id="new-group">${UI.icon("plus", 14)} 新建分组</button>
      </div>
      <div id="groups-box"></div>`;

    const si = box.querySelector(".friends-search input");
    si.oninput = () => { kw = si.value; updateContacts(); };
    box.querySelector("#req-entry").onclick = () => { reqOpen = !reqOpen; updateRequests(); };
    box.querySelector("#new-group").onclick = newGroup;
    updateContacts();
    updateRequests();
  }

  function updateContacts() {
    const box = document.getElementById("groups-box");
    if (!box) return;
    const cons = Store.getConversations(u.id);
    const q = kw.trim().toLowerCase();

    if (q) {
      const hit = cons.filter(c => (nameOf(c.user.id) + " " + (c.last ? c.last.text : "")).toLowerCase().includes(q));
      box.innerHTML = hit.length
        ? `<div class="list mt-8">${hit.map(friendRow).join("")}</div>`
        : UI.emptyBox("🔍", "没有找到匹配的好友");
      return;
    }

    box.innerHTML = Store.getGroups(u.id).map(g => {
      const members = cons.filter(c => Store.groupOf(u.id, c.user.id) === g.id);
      const open = !!expanded[g.id];
      return `<section class="grp${open ? " open" : ""}">
        <div class="grp-head" data-ghead="${g.id}">
          <span class="grp-arrow ${open ? "on" : ""}">${UI.icon("chevron-right", 16)}</span>
          <span class="grp-name ellipsis">${UI.esc(g.name)}</span>
          <span class="grp-count">${members.length}</span>
          <button class="icon-btn grp-edit" data-gedit="${g.id}" aria-label="重命名分组">${UI.icon("edit", 15)}</button>
          <button class="icon-btn grp-del" data-gdel="${g.id}" aria-label="删除分组">${UI.icon("trash", 15)}</button>
        </div>
        ${open ? (members.length
          ? `<div class="list">${members.map(friendRow).join("")}</div>`
          : `<div class="grp-empty">该分组还没有好友</div>`) : ""}
      </section>`;
    }).join("");
  }

  function updateRequests() {
    const box = document.getElementById("req-box");
    if (!box) return;
    if (!reqOpen) { box.innerHTML = ""; return; }
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

  /* ---------- 消息 ---------- */
  function renderMessages() {
    const box = document.getElementById("friends-content");
    box.innerHTML = `
      <div class="search-row">
        <div class="search-bar friends-search">${UI.icon("search", 18)}<input placeholder="搜索消息" value="${UI.esc(mkw)}" aria-label="搜索消息"></div>
      </div>
      <div id="msg-box"></div>`;
    const si = box.querySelector(".friends-search input");
    si.oninput = () => { mkw = si.value; updateMessages(); };
    updateMessages();
  }

  function updateMessages() {
    const box = document.getElementById("msg-box");
    if (!box) return;
    closeSwipe();
    const q = mkw.trim().toLowerCase();
    let list = Store.getConversations(u.id).filter(c => !c.hidden || c.unread > 0)
      .sort((a, b) => (b.last ? b.last.t : 0) - (a.last ? a.last.t : 0));
    if (q) list = list.filter(c => (nameOf(c.user.id) + " " + (c.last ? c.last.text : "")).toLowerCase().includes(q));
    box.innerHTML = list.length
      ? `<div class="list mt-8">${list.map(c => {
          const last = c.last;
          return `<div class="sw-row" data-sw>
            <div class="sw-acts">
              <button class="sw-act" data-clear="${c.user.id}">清空记录</button>
              <button class="sw-act danger" data-delrec="${c.user.id}">删除记录</button>
            </div>
            <div class="list-item tap sw-body" data-chat="${c.user.id}">
              ${UI.avatarEl(c.user, "md")}
              <div class="li-main">
                <div class="li-title ellipsis">${UI.esc(nameOf(c.user.id))}</div>
                <div class="li-sub ellipsis">${UI.esc(last ? last.text : "还没有聊过，打个招呼吧")}</div>
              </div>
              <div class="li-right">
                ${last ? `<div class="li-time">${UI.timeAgo(last.t)}</div>` : ""}
                ${c.unread > 0 ? `<span class="badge">${c.unread}</span>` : ""}
              </div>
            </div>
          </div>`;
        }).join("")}</div>`
      : UI.emptyBox("💬", q ? "没有找到相关消息" : "还没有聊天记录", "去联系人里找好友聊聊吧");
    bindSwipe();
  }

  /* ---------- 消息行滑动操作（清空 / 删除记录） ---------- */
  let openSw = null, lastSwipeEnd = 0;

  function closeSwipe() {
    if (!openSw) return;
    const s = openSw;
    openSw = null;
    s.body.style.transform = "";
    s.wrap.classList.remove("open", "from-left");
  }

  function bindSwipe() {
    document.querySelectorAll(".sw-row").forEach(wrap => {
      const body = wrap.querySelector(".sw-body");
      const acts = wrap.querySelector(".sw-acts");
      let st = null;

      body.addEventListener("pointerdown", e => {
        if (e.button != null && e.button !== 0) return;
        if (openSw && openSw.wrap !== wrap) closeSwipe();
        st = {
          x: e.clientX, y: e.clientY, horiz: false, dx: 0,
          base: wrap.classList.contains("open") ? (wrap.classList.contains("from-left") ? acts.offsetWidth : -acts.offsetWidth) : 0,
        };
        body.style.transition = "none";
      });
      body.addEventListener("pointermove", e => {
        if (!st) return;
        const dx = e.clientX - st.x, dy = e.clientY - st.y;
        if (!st.horiz) {
          // 纵向意图 → 交还给页面滚动
          if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { st = null; body.style.transition = ""; return; }
          if (Math.abs(dx) > 8) st.horiz = true;
        }
        if (!st.horiz) return;
        const w = acts.offsetWidth;
        st.dx = Math.max(-w, Math.min(w, st.base + dx));
        body.style.transform = `translateX(${st.dx}px)`;
        if (e.cancelable) e.preventDefault();
      });
      const end = () => {
        if (!st) return;
        const w = acts.offsetWidth;
        const opened = st.horiz && Math.abs(st.dx) > w * 0.45;
        body.style.transition = "";
        if (opened) {
          wrap.classList.add("open");
          wrap.classList.toggle("from-left", st.dx > 0);   // 右滑 → 操作区在左侧
        } else {
          wrap.classList.remove("open", "from-left");
        }
        body.style.transform = opened ? `translateX(${st.dx > 0 ? w : -w}px)` : "";
        openSw = opened ? { wrap, body } : (openSw && openSw.wrap === wrap ? null : openSw);
        if (st.horiz) lastSwipeEnd = Date.now();
        st = null;
      };
      body.addEventListener("pointerup", end);
      body.addEventListener("pointercancel", end);
      body.addEventListener("click", e => {
        if (wrap.classList.contains("open") || Date.now() - lastSwipeEnd < 260) {
          e.preventDefault(); e.stopPropagation();
          closeSwipe();
        }
      }, true);
    });
  }

  function clearRec(fid) {
    const nm = nameOf(fid);
    UI.confirm("清空聊天记录", "将清空与「" + nm + "」的全部聊天内容，好友关系保留。").then(ok => {
      if (!ok) return;
      Store.clearChat(u.id, fid);
      UI.toast("已清空聊天记录", "success");
      updateMessages();
    });
  }

  function deleteRec(fid) {
    const nm = nameOf(fid);
    UI.confirm("删除聊天记录", "将删除与「" + nm + "」的会话，并从消息列表移除（好友关系保留）。", { okText: "删除", danger: true }).then(ok => {
      if (!ok) return;
      Store.deleteChat(u.id, fid);
      UI.toast("已删除聊天记录", "success");
      updateMessages();
    });
  }

  /* ---------- 动态 ---------- */
  function updateMoments() {
    const box = document.getElementById("friends-content");
    if (!box) return;
    const feed = Store.listMoments({ uid: u.id, scope: "friends" });
    box.innerHTML = feed.length
      ? `<div class="moments-feed">${feed.map(momentCard).join("")}</div>`
      : UI.emptyBox("🍃", "还没有好友动态", "去添加好友，看看大家都在做什么");
  }

  /* ---------- 分组操作 ---------- */
  function newGroup() {
    UI.promptInput({ title: "新建分组", placeholder: "分组名称（最多 8 个字）", max: 8 }).then(name => {
      if (name == null) return;
      const r = Store.addGroup(u.id, name);
      if (!r.ok) { UI.toast(r.msg, "warn"); return; }
      expanded[r.group.id] = true;
      UI.toast("已创建分组「" + r.group.name + "」", "success");
      if (document.getElementById("groups-box")) updateContacts();
    });
  }

  function doRename(gid, cur) {
    UI.promptInput({ title: "重命名分组", placeholder: "分组名称（最多 8 个字）", value: cur, max: 8 }).then(name => {
      if (name == null) return;
      const r = Store.renameGroup(u.id, gid, name);
      if (!r.ok) { UI.toast(r.msg, "warn"); return; }
      UI.toast("已重命名", "success");
      updateContacts();
    });
  }

  // 备注名字（留空则恢复昵称）
  function remarkFriend(fid) {
    const nick = (Store.getUser(fid) || {}).nickname || "好友";
    UI.promptInput({
      title: "设置备注",
      placeholder: "备注名（最多 12 个字），留空恢复昵称",
      value: Store.remarkOf(u.id, fid), max: 12,
    }).then(name => {
      if (name == null) return;
      const r = Store.setRemark(u.id, fid, name);
      if (!r.ok) { UI.toast(r.msg, "warn"); return; }
      UI.toast(r.name ? "备注已保存" : "已恢复昵称「" + nick + "」", "success");
      refreshLists();
    });
  }

  // 删除分组（组内好友自动移到其他分组）
  function removeGroup(gid) {
    const g = Store.getGroups(u.id).find(x => x.id === gid);
    if (!g) return;
    const n = Store.getConversations(u.id).filter(c => Store.groupOf(u.id, c.user.id) === gid).length;
    const tip = n ? `该分组下的 ${n} 位好友会自动移动到其他分组。` : "该分组下暂无好友。";
    UI.confirm("删除分组「" + g.name + "」", tip + "删除后不可恢复。", { okText: "删除", danger: true }).then(ok => {
      if (!ok) return;
      const r = Store.delGroup(u.id, gid);
      if (!r.ok) { UI.toast(r.msg, "warn"); return; }
      UI.toast("已删除分组「" + r.name + "」", "success");
      updateContacts();
    });
  }

  function refreshLists() {
    if (document.getElementById("groups-box")) updateContacts();
    else if (document.getElementById("msg-box")) updateMessages();
  }

  function pickGroup(fid) {
    const cur = Store.groupOf(u.id, fid);
    const s = UI.sheet(`
      <div class="sheet-head"><h3>设置分组</h3><button class="icon-btn" data-close>${UI.icon("close", 18)}</button></div>
      <div class="txt-sm txt-2 grp-tip">将「${UI.esc(nameOf(fid))}」移动到：</div>
      <div class="list">
        ${Store.getGroups(u.id).map(g => `<div class="list-item tap" data-pick="${g.id}">
          <span class="li-main"><span class="li-title">${UI.esc(g.name)}</span></span>
          ${g.id === cur ? `<span class="grp-check">✓</span>` : ""}
        </div>`).join("")}
      </div>
      <div class="sheet-actions">
        <button class="btn ghost" data-newg>${UI.icon("plus", 15)} 新建分组</button>
      </div>`);
    s.el.querySelector("[data-close]").onclick = s.close;
    s.el.querySelectorAll("[data-pick]").forEach(el => el.onclick = () => {
      Store.assignGroup(u.id, fid, el.dataset.pick);
      expanded[el.dataset.pick] = true;   // 移动后展开目标分组，便于确认
      s.close();
      UI.toast("已移动分组", "success");
      updateContacts();
    });
    s.el.querySelector("[data-newg]").onclick = () => {
      s.close();
      UI.promptInput({ title: "新建分组", placeholder: "分组名称（最多 8 个字）", max: 8 }).then(name => {
        if (name == null) return;
        const r = Store.addGroup(u.id, name);
        if (!r.ok) { UI.toast(r.msg, "warn"); return; }
        Store.assignGroup(u.id, fid, r.group.id);
        expanded[r.group.id] = true;
        UI.toast("已创建并移动", "success");
        updateContacts();
      });
    };
  }

  /* ---------- 导航拖动排序 ---------- */
  function bindNavSort() {
    const seg = document.getElementById("friends-seg");
    if (!seg) return;
    const HOLD = 260, TOL = 10;
    const btns = () => [...seg.querySelectorAll("button")];
    let st = null, suppress = false;

    function place(x) {
      const item = st.item;
      const target = btns().find(el => {
        if (el === item) return false;
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right;
      });
      if (!target) return;
      const r = target.getBoundingClientRect();
      const ref = x > r.left + r.width / 2 ? target.nextSibling : target;
      if (ref === item || (ref && ref.previousSibling === item) || (!ref && seg.lastElementChild === item)) return;

      const els = btns();
      const before = new Map(els.map(el => [el, el.getBoundingClientRect()]));
      item.style.transform = "";
      const a = item.getBoundingClientRect();
      seg.insertBefore(item, ref);
      const b = item.getBoundingClientRect();
      st.corrX += a.left - b.left;
      // 其余按钮先反转、强制回流、再过渡（真正的 FLIP）
      const moved = [];
      els.forEach(el => {
        if (el === item) return;
        const p = before.get(el);
        const dx = p.left - el.getBoundingClientRect().left;
        if (!dx) return;
        el.style.transition = "none";
        el.style.transform = `translateX(${dx}px)`;
        moved.push(el);
      });
      if (moved.length) {
        void seg.offsetWidth;
        moved.forEach(el => {
          el.style.transition = "transform .2s cubic-bezier(.2,.7,.3,1)";
          el.style.transform = "";
        });
      }
      item.style.transform = `translateX(${st.dx + st.corrX}px)`;
    }

    function finish() {
      if (!st || !st.dragging) { if (st) st = null; return; }
      clearTimeout(st.timer);
      st.item.classList.remove("dragging");
      st.item.style.transform = "";
      suppress = true;
      setTimeout(() => { suppress = false; }, 120);
      Store.saveFriendNav(u.id, btns().map(b => b.dataset.tab));
      UI.toast("已保存导航顺序", "success");
      st = null;
    }

    btns().forEach(item => {
      item.addEventListener("click", e => { if (suppress) { e.preventDefault(); e.stopPropagation(); } }, true);
      item.addEventListener("pointerdown", e => {
        if (e.button != null && e.button !== 0) return;
        if (st) return;
        st = { item, pointerId: e.pointerId, startX: e.clientX, dragging: false, dx: 0, corrX: 0 };
        st.timer = setTimeout(() => {
          if (!st) return;
          st.dragging = true;
          st.item.classList.add("dragging");
          st.item.style.transform = "translateX(0px)";
          try { st.item.setPointerCapture(st.pointerId); } catch (err) { /* ignore */ }
          if (navigator.vibrate) { try { navigator.vibrate(20); } catch (err) { /* ignore */ } }
        }, HOLD);
      });
      item.addEventListener("pointermove", e => {
        if (!st || st.item !== item) return;
        if (!st.dragging) {
          if (Math.abs(e.clientX - st.startX) > TOL) { clearTimeout(st.timer); st = null; }
          return;
        }
        e.preventDefault();
        st.dx = e.clientX - st.startX;
        item.style.transform = `translateX(${st.dx + st.corrX}px)`;
        place(e.clientX);
      });
      item.addEventListener("pointerup", finish);
      item.addEventListener("pointercancel", finish);
    });

    document.addEventListener("touchmove", e => { if (st && st.dragging) e.preventDefault(); }, { passive: false });
  }

  /* ---------- 事件委托 ---------- */
  body.addEventListener("click", e => {
    const remk = e.target.closest("[data-remark]");
    if (remk) { remarkFriend(remk.dataset.remark); return; }

    const setg = e.target.closest("[data-setgroup]");
    if (setg) { pickGroup(setg.dataset.setgroup); return; }

    const gedit = e.target.closest("[data-gedit]");
    if (gedit) {
      const g = Store.getGroups(u.id).find(x => x.id === gedit.dataset.gedit);
      if (g) doRename(g.id, g.name);
      return;
    }

    const gdel = e.target.closest("[data-gdel]");
    if (gdel) { removeGroup(gdel.dataset.gdel); return; }

    const clr = e.target.closest("[data-clear]");
    if (clr) { clearRec(clr.dataset.clear); return; }

    const delr = e.target.closest("[data-delrec]");
    if (delr) { deleteRec(delr.dataset.delrec); return; }

    const ghead = e.target.closest("[data-ghead]");
    if (ghead) { const id = ghead.dataset.ghead; expanded[id] = !expanded[id]; updateContacts(); return; }

    const tabBtn = e.target.closest("[data-tab]");
    if (tabBtn) { tab = tabBtn.dataset.tab; render(); return; }

    const chatItem = e.target.closest("[data-chat]");
    if (chatItem) { location.href = "chat.html?id=" + encodeURIComponent(chatItem.dataset.chat); return; }

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
    if (reject) { Store.rejectRequest(u.id, reject.dataset.reject); updateRequests(); }
  });

  render();
})();