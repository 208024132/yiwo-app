const S = AdminShell.boot({ menu: "my", title: "我的" });
if (S) (function(){
Theme.apply(Theme.current());

function adminAvatar(a, size = "md") {
  return UI.avatarEl({ avatarEmoji: "🛡️", avatarColor: 4, nickname: a.name }, size);
}

function permChips(perms) {
  const chips = Store.PERMS.filter(p => (perms || []).includes(p.key)).map(p => `<span class="tag sm">${UI.esc(p.name)}</span>`).join("");
  return chips || `<span class="txt-xs txt-3">无权限</span>`;
}

function render() {
  const a = Store.currentAdmin();
  if (!a) return;

  const rows = [
    ["姓名", UI.esc(a.name)],
    ["账号", `${UI.esc(a.account)} <span class="txt-xs txt-3">（只读）</span>`],
    ["手机号", UI.esc(a.phone || "—")],
    ["部门", UI.esc(a.dept || "—")],
    ["身份证号", UI.esc(a.idcard || "—")],
  ];

  S.content.innerHTML = `
    <div class="card profile-card">
      ${adminAvatar(a, "xl")}
      <div class="profile-main">
        <div class="profile-name bold txt-xl">${UI.esc(a.name)}</div>
        <div class="profile-meta">
          ${a.role === "超级管理员" ? `<span class="tag">超级管理员</span>` : `<span class="tag gray">普通管理员</span>`}
          <span class="txt-2 txt-sm">${UI.esc(a.dept || "—")}</span>
        </div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="list">
        ${rows.map(([k, v]) => `
          <div class="list-item">
            <div class="li-main" style="max-width:96px; flex-shrink:0"><div class="txt-2 txt-sm">${UI.esc(k)}</div></div>
            <div class="flex-1" style="text-align:right; word-break:break-all">${v}</div>
          </div>`).join("")}
        <div class="list-item">
          <div class="li-main" style="max-width:96px; flex-shrink:0"><div class="txt-2 txt-sm">权限</div></div>
          <div class="flex-1 perm-chips">${permChips(a.perms)}</div>
        </div>
        <div class="list-item">
          <div class="li-main" style="max-width:96px; flex-shrink:0"><div class="txt-2 txt-sm">加入时间</div></div>
          <div class="flex-1" style="text-align:right">${UI.fmtDate(a.t)}</div>
        </div>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn ghost" id="edit-profile">${UI.icon("edit", 16)} 编辑资料</button>
      <button class="btn ghost" id="change-pwd">${UI.icon("lock", 16)} 修改密码</button>
    </div>

    <div class="card note-card">
      <p class="txt-xs txt-3">我的权限由超级管理员在「管理员管理」中配置。</p>
    </div>`;

  S.content.querySelector("#edit-profile").onclick = openEdit;
  S.content.querySelector("#change-pwd").onclick = openPwd;
}

function openEdit() {
  const a = Store.currentAdmin();
  if (!a) return;
  const s = UI.sheet(`
    <div class="sheet-head"><h3>编辑资料</h3><button class="icon-btn" data-close>${UI.icon("close", 18)}</button></div>
    <div class="field"><label>姓名</label><input class="input" id="p-name" value="${UI.esc(a.name)}"></div>
    <div class="field"><label>手机号</label><input class="input" id="p-phone" value="${UI.esc(a.phone || "")}"></div>
    <div class="field"><label>部门</label><input class="input" id="p-dept" value="${UI.esc(a.dept || "")}"></div>
    <div class="sheet-actions">
      <button class="btn ghost" data-cancel>取消</button>
      <button class="btn primary" data-ok>保存</button>
    </div>`);
  s.el.querySelector("[data-close]").onclick = () => s.close();
  s.el.querySelector("[data-cancel]").onclick = () => s.close();
  s.el.querySelector("[data-ok]").onclick = () => {
    const name = s.el.querySelector("#p-name").value.trim();
    if (!name) { UI.toast("姓名不能为空", "error"); return; }
    Store.updateAdmin(a.id, {
      name,
      phone: s.el.querySelector("#p-phone").value.trim(),
      dept: s.el.querySelector("#p-dept").value.trim(),
    });
    UI.toast("资料已更新", "success");
    s.close();
    render();
  };
}

function openPwd() {
  const a = Store.currentAdmin();
  if (!a) return;
  const s = UI.sheet(`
    <div class="sheet-head"><h3>修改密码</h3><button class="icon-btn" data-close>${UI.icon("close", 18)}</button></div>
    <div class="field"><label>旧密码</label><input class="input" id="pw-old" type="password" placeholder="请输入旧密码"></div>
    <div class="field"><label>新密码</label><input class="input" id="pw-new" type="password" placeholder="至少 6 位"></div>
    <div class="field"><label>确认新密码</label><input class="input" id="pw-again" type="password" placeholder="再次输入新密码"></div>
    <div class="sheet-actions">
      <button class="btn ghost" data-cancel>取消</button>
      <button class="btn primary" data-ok>确认修改</button>
    </div>`);
  s.el.querySelector("[data-close]").onclick = () => s.close();
  s.el.querySelector("[data-cancel]").onclick = () => s.close();
  s.el.querySelector("[data-ok]").onclick = () => {
    const old = s.el.querySelector("#pw-old").value;
    const nw = s.el.querySelector("#pw-new").value;
    const again = s.el.querySelector("#pw-again").value;
    if (old !== Store.currentAdmin().password) { UI.toast("旧密码不正确", "error"); return; }
    if (nw.length < 6) { UI.toast("新密码至少 6 位", "error"); return; }
    if (nw !== again) { UI.toast("两次输入的新密码不一致", "error"); return; }
    Store.updateAdmin(a.id, { password: nw });
    UI.toast("密码已修改", "success");
    s.close();
  };
}

render();})();
