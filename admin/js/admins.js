const S = AdminShell.boot({ menu: "admins", title: "管理员管理" });
if (S) (function(){
Theme.apply(Theme.current());

function adminAvatar(a, size = "md") {
  return UI.avatarEl({ avatarEmoji: "🛡️", avatarColor: 4, nickname: a.name }, size);
}

function permChips(perms) {
  const chips = Store.PERMS.filter(p => (perms || []).includes(p.key)).map(p => `<span class="tag sm">${UI.esc(p.name)}</span>`).join("");
  return chips || `<span class="txt-xs txt-3">—</span>`;
}

function permOptions() {
  return Store.PERMS.filter(p => (S.admin.perms || []).includes(p.key));
}

function permList(selected = []) {
  const opts = permOptions();
  if (!opts.length) return UI.emptyBox("🔒", "无可用权限", "你当前没有可分配的权限");
  return opts.map(p => `
    <div class="set-row">
      <div class="set-main"><div class="set-title">${UI.esc(p.name)}</div></div>
      <label class="switch"><input type="checkbox" data-perm="${p.key}" ${selected.includes(p.key) ? "checked" : ""}><span class="track"></span></label>
    </div>`).join("");
}

function infoRow(label, value) {
  return `<div class="list-item"><div class="li-main" style="max-width:96px; flex-shrink:0"><div class="txt-2 txt-sm">${UI.esc(label)}</div></div><div class="flex-1" style="text-align:right; word-break:break-all">${value}</div></div>`;
}

function render() {
  const admins = Store.listAdmins();
  S.content.innerHTML = `
    <div class="card toolbar">
      <span class="tag gray">${UI.icon("info", 14)} 权限决定后台可见功能，权限不足的菜单不可见</span>
      <button class="btn primary" id="add-admin">${UI.icon("plus", 16)} 添加管理员</button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>管理员</th><th>部门</th><th>手机号</th><th>角色</th><th>权限</th><th>操作</th></tr></thead>
        <tbody>
          ${admins.map(a => {
            const isSelf = a.id === S.admin.id;
            return `<tr>
              <td>
                <div class="flex items-center gap-10">
                  ${adminAvatar(a)}
                  <div style="min-width:0">
                    <div class="bold txt-sm ellipsis">${UI.esc(a.name)}</div>
                    <div class="txt-xs txt-3 ellipsis">${UI.esc(a.account)}</div>
                  </div>
                </div>
              </td>
              <td>${UI.esc(a.dept || "—")}</td>
              <td>${UI.esc(a.phone || "—")}</td>
              <td>${a.role === "超级管理员" ? `<span class="tag">超级管理员</span>` : `<span class="tag gray">普通管理员</span>`}</td>
              <td><div class="perm-chips">${permChips(a.perms)}</div></td>
              <td>
                <div class="flex gap-8">
                  <button class="btn sm soft" data-view="${a.id}">查看</button>
                  ${isSelf ? "" : `<button class="btn sm ghost" data-edit="${a.id}">编辑权限</button>`}
                </div>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  S.content.querySelector("#add-admin").onclick = openAdd;
  S.content.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => openView(b.dataset.view)));
  S.content.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openEdit(b.dataset.edit)));
}

function openAdd() {
  const s = UI.sheet(`
    <div class="sheet-head"><h3>添加管理员</h3><button class="icon-btn" data-close>${UI.icon("close", 18)}</button></div>
    <div class="field"><label>姓名</label><input class="input" id="a-name" placeholder="姓名"></div>
    <div class="field"><label>账号</label><input class="input" id="a-account" placeholder="登录账号"></div>
    <div class="field"><label>密码</label><input class="input" id="a-password" type="password" placeholder="至少 6 位"></div>
    <div class="field"><label>手机号</label><input class="input" id="a-phone" placeholder="手机号"></div>
    <div class="field"><label>部门</label><input class="input" id="a-dept" placeholder="部门"></div>
    <div class="field"><label>身份证号</label><input class="input" id="a-idcard" placeholder="身份证号"></div>
    <div class="field"><label>权限</label><div class="list" id="perm-box">${permList([])}</div></div>
    <div class="sheet-actions">
      <button class="btn ghost" data-cancel>取消</button>
      <button class="btn primary" data-ok>添加</button>
    </div>`);

  s.el.querySelector("[data-close]").onclick = () => s.close();
  s.el.querySelector("[data-cancel]").onclick = () => s.close();
  s.el.querySelector("[data-ok]").onclick = async () => {
    const field = id => s.el.querySelector(id).value.trim();
    const name = field("#a-name");
    const account = field("#a-account");
    const password = s.el.querySelector("#a-password").value;
    if (!name || !account || !password) { UI.toast("姓名、账号、密码为必填项", "error"); return; }
    const data = {
      account, password, name,
      phone: field("#a-phone"),
      dept: field("#a-dept"),
      idcard: field("#a-idcard"),
      perms: [...s.el.querySelectorAll("[data-perm]:checked")].map(i => i.dataset.perm),
    };
    const r = await Store.addAdmin(data);
    if (!r.ok) { UI.toast(r.msg, "error"); return; }
    UI.toast("管理员已添加", "success");
    s.close();
    render();
  };
}

function openView(id) {
  const a = Store.listAdmins().find(x => x.id === id);
  if (!a) return;
  const infos = [
    ["账号", UI.esc(a.account)],
    ["手机号", UI.esc(a.phone || "—")],
    ["部门", UI.esc(a.dept || "—")],
    ["身份证号", UI.esc(a.idcard || "—")],
    ["加入时间", UI.fmtDate(a.t)],
  ];
  const s = UI.sheet(`
    <div class="sheet-head"><h3>管理员详情</h3><button class="icon-btn" data-close>${UI.icon("close", 18)}</button></div>
    <div class="ud-head">
      ${adminAvatar(a, "lg")}
      <div class="ud-info">
        <div class="bold txt-lg">${UI.esc(a.name)}</div>
        <div>${a.role === "超级管理员" ? `<span class="tag">超级管理员</span>` : `<span class="tag gray">普通管理员</span>`}</div>
      </div>
    </div>
    <div class="list mt-16">${infos.map(([k, v]) => infoRow(k, v)).join("")}</div>
    <div class="field mt-16"><label>权限</label>
      <div class="perm-chips">${permChips(a.perms)}</div>
    </div>`);
  s.el.querySelector("[data-close]").onclick = () => s.close();
}

function openEdit(id) {
  const a = Store.listAdmins().find(x => x.id === id);
  if (!a) return;
  const s = UI.sheet(`
    <div class="sheet-head"><h3>编辑权限 · ${UI.esc(a.name)}</h3><button class="icon-btn" data-close>${UI.icon("close", 18)}</button></div>
    <div class="list">${permList(a.perms || [])}</div>
    <div class="sheet-actions">
      <button class="btn ghost" data-cancel>取消</button>
      <button class="btn primary" data-ok>保存</button>
    </div>`);
  s.el.querySelector("[data-close]").onclick = () => s.close();
  s.el.querySelector("[data-cancel]").onclick = () => s.close();
  s.el.querySelector("[data-ok]").onclick = () => {
    // 弹层只列出「自己拥有的权限」，其余权限保持不变，避免误删
    const manageKeys = permOptions().map(p => p.key);
    const kept = (a.perms || []).filter(k => !manageKeys.includes(k));
    const perms = [...kept, ...[...s.el.querySelectorAll("[data-perm]:checked")].map(i => i.dataset.perm)];
    Store.updateAdmin(id, { perms });
    UI.toast("权限已更新", "success");
    s.close();
    render();
  };
}

render();})();

