/* 登录页逻辑（云端优先，失败回退本地） */

(() => {
  Theme.apply(Theme.current());

  // 已登录直接进首页
  if (Store.currentUser()) { location.replace("index.html"); return; }

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

    // 1) 云端优先：支持换设备登录（未配置云端时跳过）
    let cloudErr = "";
    if (cloudOn()) {
      btn.disabled = true;
      try {
        const c = await Cloud.signIn(a, p);
        if (c.ok && c.uid) {
          if (window.CloudSync) { try { await CloudSync.enter(c.uid); } catch (e) { /* ignore */ } }
          location.href = "index.html";
          return;
        }
        cloudErr = c.msg || "";
      } catch (e) { /* 网络异常：走本地回退 */ }
      btn.disabled = false;
    }

    // 2) 本地回退（老账号 / 离线）
    const r = Store.login(a, p);
    if (r.ok) { location.href = "index.html"; return; }
    UI.toast(cloudErr || r.msg, "error");
  }

  btn.onclick = () => doLogin(accountEl.value, pwdEl.value);

  [accountEl, pwdEl].forEach(el => {
    el.addEventListener("input", () => { errEl.textContent = ""; });
  });
  pwdEl.addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin(accountEl.value, pwdEl.value);
  });
})();