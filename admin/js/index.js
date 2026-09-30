/* 后台登录页逻辑 */
(() => {
  Theme.apply(Theme.current());
  if (Store.currentAdmin()) { location.href = "dashboard.html"; return; }

  const form = document.getElementById("login-form");
  const acc = document.getElementById("login-account");
  const pwd = document.getElementById("login-password");

  form.addEventListener("submit", e => {
    e.preventDefault();
    const r = Store.loginAdmin(acc.value, pwd.value);
    if (r.ok) { location.href = "dashboard.html"; }
    else { UI.toast(r.msg, "error"); }
  });
})();