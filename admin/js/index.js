/* 后台登录页逻辑 */
(() => {
  Theme.apply(Theme.current());
  const cur = Store.currentAdmin();
  if (cur) { location.href = cur.mustChangePwd ? "my.html" : "dashboard.html"; return; }

  const form = document.getElementById("login-form");
  const acc = document.getElementById("login-account");
  const pwd = document.getElementById("login-password");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const r = await Store.loginAdmin(acc.value, pwd.value);
    if (r.ok) {
      // 首次登录强制改密：先跳「我的」页修改密码，再进入后台
      location.href = r.mustChangePwd ? "my.html" : "dashboard.html";
    }
    else { UI.toast(r.msg, "error"); }
  });
})();
