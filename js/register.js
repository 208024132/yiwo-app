/* 注册页逻辑（密码只交云端 + 本地建「无密码档案」：未配置云端时不可注册） */

(() => {
  Theme.apply(Theme.current());

  // 已登录直接进首页
  if (Store.currentUser()) { location.replace("index.html"); return; }

  const el = id => document.getElementById(id);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
    err("account").textContent = (v && !emailRe.test(v)) ? "请输入正确的邮箱地址（如 name@example.com）" : "";
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
      err("account").textContent = "请输入正确的邮箱地址（如 name@example.com）";
      return;
    }
    err("account").textContent = "";

    // 账号体系重构：密码只在云端（CloudBase auth），本地不再保存密码；
    // 未配置云端时无法完成注册，给出清晰提示而非静默放行。
    if (!cloudOn()) {
      err("code").textContent = "云端服务未配置，暂不支持注册";
      UI.toast("云端服务未配置，暂不支持注册", "error");
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
    UI.toast("验证码已发送至你的邮箱", "success");
    startCountdown();
  };

  // 提交
  regBtn.onclick = async () => {
    ["nickname", "account", "code", "password", "confirm"].forEach(k => { err(k).textContent = ""; });

    // 账号体系重构：注册依赖云端（密码只交给 CloudBase auth），未配置云端时不得建号。
    if (!cloudOn()) {
      err("code").textContent = "云端服务未配置，暂不支持注册";
      UI.toast("云端服务未配置，暂不支持注册", "error");
      return;
    }

    let ok = true;
    if (!nickname.value.trim()) { err("nickname").textContent = "请填写网名"; ok = false; }
    if (!validEmail()) { err("account").textContent = "请输入正确的邮箱地址（如 name@example.com）"; ok = false; }
    if (!codeRe.test(code.value.trim())) { err("code").textContent = "请输入 6 位数字验证码"; ok = false; }
    if (password.value.length < 8) { err("password").textContent = "密码至少 8 位"; ok = false; }
    if (confirm.value !== password.value) { err("confirm").textContent = "两次输入的密码不一致"; ok = false; }
    if (!agree.checked) { UI.toast("请先阅读并同意《用户协议与隐私政策》", "warn"); ok = false; }
    if (!ok) return;
    if (!codeSent) { err("code").textContent = "请先点击「发送验证码」"; return; }

    regBtn.disabled = true;

    const acc = account.value.trim();

    // 1) 先完成云端注册（校验验证码）。必须放在本地建号之前：
    //    否则云端失败时仍会建出“只在本机”的账号，换设备永远登不上。
    const c = await Cloud.verifyCode(code.value.trim());
    if (!c.ok || !c.uid) {
      regBtn.disabled = false;
      err("code").textContent = c.msg || "云端注册失败，请重试";
      return;
    }
    const cloudUid = c.uid;

    // 2) 本地建号：只建「无密码档案」，密码已由云端保存（本地不传、不落密码）
    const r = Store.register({ account: acc, nickname: nickname.value.trim() });
    if (!r.ok) { regBtn.disabled = false; UI.toast(r.msg, "error"); return; }

    // 3) 本地 id 与云端 uid 对齐，并拉取该邮箱在云端的已有数据
    Store.migrateUid(r.user.id, cloudUid);
    if (window.CloudSync) { try { await CloudSync.enter(cloudUid); } catch (e) { /* ignore */ } }

    location.href = localStorage.getItem("yiwo_onboarded") ? "index.html" : "onboarding.html";
  };
})();