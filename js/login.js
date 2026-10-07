/* 登录页逻辑 */

(() => {
  Theme.apply(Theme.current());

  // 已登录直接进首页
  if (Store.currentUser()) { location.replace("index.html"); return; }

  const accountEl = document.getElementById("account");
  const pwdEl = document.getElementById("password");
  const errEl = document.getElementById("login-err");

  function doLogin(account, pwd) {
    const a = String(account || "").trim();
    const p = String(pwd || "").trim();
    if (!a) { errEl.textContent = "请输入账号"; return; }
    if (!p) { errEl.textContent = "请输入密码"; return; }
    errEl.textContent = "";
    const r = Store.login(a, p);
    if (r.ok) { location.href = "index.html"; }
    else { UI.toast(r.msg, "error"); }
  }

  document.getElementById("login-btn").onclick = () => doLogin(accountEl.value, pwdEl.value);

  [accountEl, pwdEl].forEach(el => {
    el.addEventListener("input", () => { errEl.textContent = ""; });
  });
  pwdEl.addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin(accountEl.value, pwdEl.value);
  });
})();