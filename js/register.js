/* 注册页逻辑 */

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
  const err = id => el("err-" + id);

  function validEmail() {
    return emailRe.test(account.value.trim());
  }

  // 邮箱失焦校验
  account.addEventListener("blur", () => {
    const v = account.value.trim();
    err("account").textContent = (v && !emailRe.test(v)) ? "请使用 QQ 邮箱注册（xxx@qq.com）" : "";
  });

  // 发送验证码
  el("send-code").onclick = () => {
    if (!validEmail()) {
      err("account").textContent = "请使用 QQ 邮箱注册（xxx@qq.com）";
      return;
    }
    err("account").textContent = "";
    UI.toast("验证码已发送，请输入 6 位验证码", "info");
  };

  // 提交
  el("register-btn").onclick = () => {
    ["nickname", "account", "code", "password", "confirm"].forEach(k => { err(k).textContent = ""; });

    let ok = true;
    if (!nickname.value.trim()) { err("nickname").textContent = "请填写网名"; ok = false; }
    if (!validEmail()) { err("account").textContent = "请使用 QQ 邮箱注册（xxx@qq.com）"; ok = false; }
    if (!codeRe.test(code.value.trim())) { err("code").textContent = "请输入 6 位数字验证码"; ok = false; }
    if (password.value.length < 6) { err("password").textContent = "密码至少 6 位"; ok = false; }
    if (confirm.value !== password.value) { err("confirm").textContent = "两次输入的密码不一致"; ok = false; }
    if (!agree.checked) { UI.toast("请先阅读并同意《用户协议与隐私政策》", "warn"); ok = false; }
    if (!ok) return;

    const r = Store.register({ account: account.value.trim(), password: password.value, nickname: nickname.value.trim() });
    if (r.ok) { location.href = "index.html"; }
    else { UI.toast(r.msg, "error"); }
  };
})();