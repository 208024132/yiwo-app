/* 登录页逻辑（密码只在云端校验：未配置云端或云端失败均不本地回退） */

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
          location.href = "index.html";
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
})();