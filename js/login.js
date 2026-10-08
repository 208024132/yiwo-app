/* 登录页逻辑（密码只在云端校验：未配置云端或云端失败均不本地回退） */

(() => {
  Theme.apply(Theme.current());

  // 已登录直接进首页
  if (Store.currentUser()) { location.replace("index.html"); return; }

  // 冷启动时 store.js 的 hydrate 是异步的，首帧 currentUser() 可能尚未反映 IndexedDB 里的会话。
  // 数据接管完成后再判断一次登录态，避免误判。
  window.addEventListener("yiwo:store-ready", () => {
    if (Store.currentUser()) location.replace("index.html");
  });

  const accountEl = document.getElementById("account");
  const pwdEl = document.getElementById("password");
  const errEl = document.getElementById("login-err");
  const btn = document.getElementById("login-btn");

  function cloudOn() { return !!(window.Cloud && Cloud.isConfigured()); }

  async function doLogin(account, pwd) {
    const a = String(account || "").trim();
    const p = String(pwd || "").trim();
    if (!a) { errEl.textContent = "请输入账号"; return; }
    if (!p) { errEl.textContent = "请输入密码"; return; }
    errEl.textContent = "";

    // 账号体系重构：密码只在云端（CloudBase auth）一处校验。
    // 本地账号是「无密码档案」，未配置云端 / 云端失败时都不得回退本地明文比对。
    if (!cloudOn()) {
      const msg = "云端服务未配置，暂无法登录";
      errEl.textContent = msg;
      UI.toast(msg, "error");
      return;
    }

    btn.disabled = true;
    let msg = "";
    try {
      const c = await Cloud.signIn(a, p);
      if (c.ok && c.uid) {
        if (window.CloudSync) { try { await CloudSync.enter(c.uid); } catch (e) { /* ignore */ } }
        // 云端登录成功却没建立起本地会话（通常是本机数据初始化失败）时不能装作成功
        if (!Store.currentUser()) {
          msg = "云端登录成功，但本机数据初始化失败，请稍后重试";
        } else {
          let onboarded = null;
          try { onboarded = localStorage.getItem("yiwo_onboarded"); } catch (e) { onboarded = null; }
          location.href = onboarded ? "index.html" : "onboarding.html";
          return;
        }
      } else {
        msg = c.msg || "云端登录失败";
      }
    } catch (e) {
      msg = "云端登录失败：" + ((e && e.message) || "未知错误");
    }
    btn.disabled = false;
    // 失败原因必须留在页面上（toast 只停留 2 秒，很容易被漏看）
    errEl.textContent = msg;
    UI.toast(msg, "error");
  }

  btn.onclick = () => doLogin(accountEl.value, pwdEl.value);

  [accountEl, pwdEl].forEach(el => {
    el.addEventListener("input", () => { errEl.textContent = ""; });
  });
  pwdEl.addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin(accountEl.value, pwdEl.value);
  });

  // ===== 忘记密码：输入邮箱 → 收验证码 → 设置新密码 =====
  function cloudResetOn() {
    return !!(window.Cloud && Cloud.isConfigured() && typeof Cloud.sendResetCode === "function" && typeof Cloud.resetPassword === "function");
  }

  function forgotPwd() {
    const s = UI.sheet(`
      <div class="sheet-head"><h3>找回密码</h3><button class="icon-btn" data-close>${UI.icon("close", 18)}</button></div>
      <div class="field"><label>邮箱</label><input class="input" id="fp-email" type="text" placeholder="注册时的邮箱"></div>
      <div class="field">
        <label>验证码</label>
        <div class="flex gap-8">
          <input class="input flex-1" id="fp-code" placeholder="6 位数字验证码">
          <button class="btn ghost" id="fp-send">发送验证码</button>
        </div>
      </div>
      <div class="field"><label>新密码</label><input class="input" id="fp-pwd" type="password" placeholder="至少 8 位，含字母和数字"></div>
      <div class="field"><label>确认新密码</label><input class="input" id="fp-pwd2" type="password" placeholder="再次输入新密码"></div>
      <div class="field-err" id="fp-err"></div>
      <div class="sheet-actions">
        <button class="btn ghost" data-cancel>取消</button>
        <button class="btn primary" data-ok>重置密码</button>
      </div>`);

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const fpErr = s.el.querySelector("#fp-err");
    const sendBtn = s.el.querySelector("#fp-send");
    const okBtn = s.el.querySelector("[data-ok]");
    let countTimer = null;

    // 预填登录页已输入的账号，减少重复输入
    s.el.querySelector("#fp-email").value = accountEl.value.trim();

    function clearTimer() {
      if (countTimer) { clearInterval(countTimer); countTimer = null; }
    }
    s.el.querySelector("[data-close]").onclick = () => { clearTimer(); s.close(); };
    s.el.querySelector("[data-cancel]").onclick = () => { clearTimer(); s.close(); };

    function startCountdown() {
      let n = 60;
      sendBtn.disabled = true;
      sendBtn.textContent = n + "s";
      countTimer = setInterval(() => {
        n--;
        if (n <= 0) { clearTimer(); sendBtn.disabled = false; sendBtn.textContent = "发送验证码"; }
        else { sendBtn.textContent = n + "s"; }
      }, 1000);
    }

    sendBtn.onclick = async () => {
      const mail = s.el.querySelector("#fp-email").value.trim();
      if (!emailRe.test(mail)) { fpErr.textContent = "请输入正确的邮箱地址"; return; }
      if (!cloudResetOn()) { fpErr.textContent = "云端服务未配置，暂不支持找回密码"; return; }
      fpErr.textContent = "";
      sendBtn.disabled = true;
      const r = await Cloud.sendResetCode(mail);
      if (!r.ok) { sendBtn.disabled = false; fpErr.textContent = r.msg; return; }
      UI.toast("验证码已发送至你的邮箱", "success");
      startCountdown();
    };

    okBtn.onclick = async () => {
      const mail = s.el.querySelector("#fp-email").value.trim();
      const code = s.el.querySelector("#fp-code").value.trim();
      const pwd = s.el.querySelector("#fp-pwd").value;
      const pwd2 = s.el.querySelector("#fp-pwd2").value;
      fpErr.textContent = "";
      if (!emailRe.test(mail)) { fpErr.textContent = "请输入正确的邮箱地址"; return; }
      if (!/^\d{6}$/.test(code)) { fpErr.textContent = "请输入 6 位数字验证码"; return; }
      if (pwd.length < 8) { fpErr.textContent = "新密码至少 8 位"; return; }
      if (pwd !== pwd2) { fpErr.textContent = "两次输入的新密码不一致"; return; }
      if (!cloudResetOn()) { fpErr.textContent = "云端服务未配置，暂不支持找回密码"; return; }
      okBtn.disabled = true;
      const r = await Cloud.resetPassword(code, pwd);
      okBtn.disabled = false;
      if (!r.ok) { fpErr.textContent = r.msg; return; }
      clearTimer();
      s.close();
      UI.toast("密码已重置，请使用新密码登录", "success");
    };
  }

  const forgotLink = document.getElementById("forgot-pwd");
  if (forgotLink) forgotLink.onclick = () => forgotPwd();
})();
