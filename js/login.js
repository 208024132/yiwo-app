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
    const cloudTried = cloudOn();
    if (cloudTried) {
      btn.disabled = true;
      try {
        const c = await Cloud.signIn(a, p);
        if (c.ok && c.uid) {
          if (window.CloudSync) { try { await CloudSync.enter(c.uid); } catch (e) { /* ignore */ } }
          // 云端登录成功却没建立起本地会话（通常是本机数据初始化失败）时不能装作成功
          if (!Store.currentUser()) {
            btn.disabled = false;
            errEl.textContent = "云端登录成功，但本机数据初始化失败，请稍后重试";
            UI.toast("云端登录成功，但本机数据初始化失败，请稍后重试", "error");
            return;
          }
          location.href = "index.html";
          return;
        }
        cloudErr = c.msg || "云端登录失败";
      } catch (e) {
        cloudErr = "云端登录失败：" + ((e && e.message) || "未知错误");
      }
      btn.disabled = false;
    }

    // 2) 本地回退（老账号 / 离线）。注意：本机账号只在当前设备可见，换设备登不上。
    const r = Store.login(a, p);
    if (r.ok) {
      if (cloudErr) UI.toast("已用本机本地账号登录，云端未连接：" + cloudErr, "warn");
      location.href = "index.html";
      return;
    }
    // 失败原因必须留在页面上（toast 只停留 2 秒，很容易被漏看）
    errEl.textContent = cloudErr || r.msg;
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