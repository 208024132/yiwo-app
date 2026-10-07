/* 注册页逻辑（本地建号 + 云端同步：未配置云端时纯本地） */

(() => {
  Theme.apply(Theme.current());

  // 已登录直接进首页
  if (Store.currentUser()) { location.replace("index.html"); return; }

  const el = id => document.getElementById(id);
  const emailRe = /^[a-zA-Z0-9._%+-]+@qq\.com$/;
  const codeRe = /^\d{6}$/;

  const nickname = el("nickname");
  const account = el("account");
  const code = el("code");
  const password = el("password");
  const confirm = el("confirm");
  const agree = el("agree");
  const sendBtn = el("send-code");
  const regBtn = el("register-btn");
  const err = id => el("err-" + id);

  let codeSent = false;       // 云端验证码是否已发出（验证码校验由 Cloud 内部保存的凭证完成）
  let countTimer = null;

  function cloudOn() { return !!(window.Cloud && Cloud.isConfigured()); }
  function validEmail() { return emailRe.test(account.value.trim()); }

  // 邮箱失焦校验
  account.addEventListener("blur", () => {
    const v = account.value.trim();
    err("account").textContent = (v && !emailRe.test(v)) ? "请使用 QQ 邮箱注册（xxx@qq.com）" : "";
  });

  function startCountdown() {
    let n = 60;
    sendBtn.disabled = true;
    sendBtn.textContent = n + "s";
    countTimer = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(countTimer); countTimer = null;
        sendBtn.disabled = false; sendBtn.textContent = "发送验证码";
      } else {
        sendBtn.textContent = n + "s";
      }
    }, 1000);
  }

  // 发送验证码
  sendBtn.onclick = async () => {
    if (!validEmail()) {
      err("account").textContent = "请使用 QQ 邮箱注册（xxx@qq.com）";
      return;
    }
    err("account").textContent = "";

    // 未配置云端：保持原有本地体验（不真发码）
    if (!cloudOn()) {
      UI.toast("验证码已发送，请输入 6 位验证码", "info");
      return;
    }
    if (password.value.length < 8) {
      err("password").textContent = "请先设置至少 8 位的密码";
      return;
    }
    sendBtn.disabled = true;
    // v3：signUp({email, password}) 即“发送验证码”，凭证由 Cloud 内部保存
    const r = await Cloud.sendCode(account.value.trim(), password.value);
    if (!r.ok) {
      sendBtn.disabled = false;
      UI.toast(r.msg, "error");
      return;
    }
    codeSent = true;
    UI.toast("验证码已发送至你的 QQ 邮箱", "success");
    startCountdown();
  };

  // 提交
  regBtn.onclick = async () => {
    ["nickname", "account", "code", "password", "confirm"].forEach(k => { err(k).textContent = ""; });

    let ok = true;
    if (!nickname.value.trim()) { err("nickname").textContent = "请填写网名"; ok = false; }
    if (!validEmail()) { err("account").textContent = "请使用 QQ 邮箱注册（xxx@qq.com）"; ok = false; }
    if (!codeRe.test(code.value.trim())) { err("code").textContent = "请输入 6 位数字验证码"; ok = false; }
    if (password.value.length < 8) { err("password").textContent = "密码至少 8 位"; ok = false; }
    if (confirm.value !== password.value) { err("confirm").textContent = "两次输入的密码不一致"; ok = false; }
    if (!agree.checked) { UI.toast("请先阅读并同意《用户协议与隐私政策》", "warn"); ok = false; }
    if (!ok) return;
    if (cloudOn() && !codeSent) { err("code").textContent = "请先点击「发送验证码」"; return; }

    regBtn.disabled = true;

    // 1) 先本地建号（保证离线也能用）
    const acc = account.value.trim();
    const r = Store.register({ account: acc, password: password.value, nickname: nickname.value.trim() });
    if (!r.ok) { regBtn.disabled = false; UI.toast(r.msg, "error"); return; }
    const localId = r.user.id;

    // 2) 云端注册并让 uid 对齐（未配置或失败则留作纯本地账号）
    if (cloudOn()) {
      try {
        const c = await Cloud.verifyCode(code.value.trim());
        if (c.ok && c.uid) {
          Store.migrateUid(localId, c.uid);
          if (window.CloudSync) { try { await CloudSync.enter(c.uid); } catch (e) { /* ignore */ } }
        } else {
          UI.toast("账号已创建，但云端同步未开启：" + (c.msg || "请稍后在「我的」页开启"), "warn");
        }
      } catch (e) {
        UI.toast("账号已创建，但云端同步未开启，请稍后在「我的」页开启", "warn");
      }
    }

    location.href = "index.html";
  };
})();