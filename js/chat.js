/* 聊天页逻辑 */

const fid = new URLSearchParams(location.search).get("id");
const friend = Store.getUser(fid);
const me = Store.currentUser();
// 标题优先显示备注名
const chatTitle = friend ? (me ? Store.displayName(me.id, fid) : friend.nickname) : "聊天";
UserShell.boot({ tab: null, title: chatTitle, back: "friends.html", hideTab: true });

// 点击顶栏任意处进入好友资料
if (friend) {
  const head = document.querySelector(".app-header .head-title");
  if (head) {
    head.innerHTML = `<a class="chat-head-link" href="friend-profile.html?id=${encodeURIComponent(fid)}">
      ${UI.avatarEl(friend, "sm")}
      <span class="chat-head-name ellipsis">${UI.esc(chatTitle)}</span>
      ${UI.icon("chevron-right", 14)}
    </a>`;
    head.classList.add("chat-head");
  }
}

(() => {
  const u = Store.currentUser();
  if (!u) return;

  const body = document.getElementById("chat-body");

  // 底部输入条（共享 .chat-inputbar）
  const bar = document.createElement("div");
  bar.className = "chat-inputbar";
  bar.innerHTML = `<input id="chat-input" placeholder="发消息…" autocomplete="off" maxlength="200">
    <button class="send-btn" id="send-btn" aria-label="发送">${UI.icon("send", 20)}</button>`;
  document.body.appendChild(bar);
  const input = bar.querySelector("#chat-input");
  const sendBtn = bar.querySelector("#send-btn");

  // 好友无效则回到好友页
  if (!friend) { location.replace("friends.html"); return; }

  Store.markRead(u.id, fid);

  const REPLIES = ["收到收到！", "哈哈哈好的", "下次一起呀", "👌 没问题"];
  let replyTimer = null;

  function scrollBottom() {
    requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
  }

  function render() {
    const msgs = Store.getMessages(u.id, fid);
    let html = "";
    let prevT = null;
    msgs.forEach(m => {
      if (prevT === null || m.t - prevT > 5 * 60 * 1000) {
        html += `<div class="chat-time">${UI.fmtDateTime(m.t)}</div>`;
      }
      prevT = m.t;
      const mine = m.from === u.id;
      html += `<div class="bubble-row ${mine ? "mine" : ""}">
        ${mine ? "" : `<a class="bubble-ava" href="friend-profile.html?id=${fid}">${UI.avatarEl(friend, "sm")}</a>`}
        <div class="bubble">${UI.esc(m.text)}</div>
      </div>`;
    });
    body.innerHTML = html || UI.emptyBox("💬", "开始你们的第一次聊天吧");
    scrollBottom();
  }

  function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    Store.sendMessage(u.id, fid, text);
    render();
    // 模拟好友自动回复
    if (replyTimer) clearTimeout(replyTimer);
    replyTimer = setTimeout(() => {
      Store.sendMessage(fid, u.id, REPLIES[Math.floor(Math.random() * REPLIES.length)]);
      render();
    }, 1500);
  }

  sendBtn.onclick = send;
  input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });

  render();
})();