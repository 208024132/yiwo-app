const S = AdminShell.boot({ menu: "users", title: "用户管理" });
if (S) (function(){
Theme.apply(Theme.current());

let q = "", gender = "", region = "";

function todayNew() {
  const today = new Date().setHours(0, 0, 0, 0);
  return Store.listUsers().filter(u => u.regTime >= today).length;
}

function render() {
  const list = Store.filterUsers({ q, gender, region });
  const total = Store.listUsers().length;
  const genderOpts = [["", "全部性别"], ["男", "男"], ["女", "女"], ["保密", "保密"]];
  const regionOpts = [["", "全部地区"], ...Store.PROVINCES.map(p => [p.n, p.n])];

  S.content.innerHTML = `
    <div class="card filter-card">
      <div class="search-bar">${UI.icon("search", 18)}<input id="f-q" type="text" placeholder="搜索昵称/ID/账号/手机号/地区" value="${UI.esc(q)}"></div>
      <div class="filter-selects">
        <select class="select" id="f-gender">
          ${genderOpts.map(([v, n]) => `<option value="${v}" ${gender === v ? "selected" : ""}>${n}</option>`).join("")}
        </select>
        <select class="select" id="f-region">
          ${regionOpts.map(([v, n]) => `<option value="${v}" ${region === v ? "selected" : ""}>${n}</option>`).join("")}
        </select>
        <button class="btn ghost sm" id="f-clear">清空</button>
      </div>
    </div>

    <div class="ustats grid-2">
      <div class="stat-card">
        <div class="stat-ico">${UI.icon("users", 20)}</div>
        <div class="stat-label">用户总数</div>
        <div class="stat-val num">${total}</div>
      </div>
      <div class="stat-card">
        <div class="stat-ico">${UI.icon("clock", 20)}</div>
        <div class="stat-label">今日新增</div>
        <div class="stat-val num">${todayNew()}</div>
      </div>
    </div>

    <div class="table-wrap">
      ${list.length ? `
      <table class="table">
        <thead><tr>
          <th>用户</th><th>网名·签名</th><th>手机号</th><th>性别</th><th>年龄</th><th>地区</th><th>注册时间</th><th>操作</th>
        </tr></thead>
        <tbody>
          ${list.map(u => `
            <tr>
              <td>
                <div class="flex items-center gap-10">
                  ${UI.avatarEl(u, "sm")}
                  <div style="min-width:0">
                    <div class="ellipsis bold txt-sm">${UI.esc(u.nickname)}</div>
                    <div class="txt-xs txt-3 ellipsis">${UI.esc(u.id)}</div>
                  </div>
                </div>
              </td>
              <td>
                <div style="min-width:0; max-width:190px">
                  <div class="ellipsis">${UI.esc(u.nickname)}</div>
                  <div class="txt-xs txt-3 ellipsis">${UI.esc(u.signature || "—")}</div>
                </div>
              </td>
              <td>${UI.esc(u.phone || "—")}</td>
              <td>${UI.esc(u.gender)}</td>
              <td>${u.age || "—"}</td>
              <td>${UI.esc(u.region)}</td>
              <td class="txt-2">${UI.fmtDateTime(u.regTime)}</td>
              <td><button class="btn sm soft" data-view="${u.id}">查看</button></td>
            </tr>`).join("")}
        </tbody>
      </table>` : UI.emptyBox("🔍", "没有匹配的用户", "试试调整关键词或筛选条件")}
    </div>`;

  const qInput = S.content.querySelector("#f-q");
  if (qInput) qInput.addEventListener("input", UI.debounce(e => { q = e.target.value.trim(); render(); }, 300));
  const gSel = S.content.querySelector("#f-gender");
  if (gSel) gSel.addEventListener("change", e => { gender = e.target.value; render(); });
  const rSel = S.content.querySelector("#f-region");
  if (rSel) rSel.addEventListener("change", e => { region = e.target.value; render(); });
  const clear = S.content.querySelector("#f-clear");
  if (clear) clear.addEventListener("click", () => { q = ""; gender = ""; region = ""; render(); });
  S.content.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => openUser(btn.dataset.view)));
}

function infoRow(label, value) {
  return `<div class="list-item"><div class="li-main" style="max-width:92px; flex-shrink:0"><div class="txt-2 txt-sm">${UI.esc(label)}</div></div><div class="flex-1" style="text-align:right; word-break:break-all">${value}</div></div>`;
}

function catEmoji(cat) {
  const c = Store.CATS.find(x => x.key === cat);
  return c ? c.e : "📦";
}

function openUser(uid) {
  const u = Store.getUser(uid);
  if (!u) return;
  const sum = Store.getSummary(uid);
  const records = Store.listRecords(uid).slice(0, 5);

  const infos = [
    ["签名", UI.esc(u.signature || "—")],
    ["手机号", UI.esc(u.phone || "—")],
    ["性别", UI.esc(u.gender)],
    ["年龄", u.age ? u.age : "—"],
    ["生日", u.birthday ? UI.esc(u.birthday) : "—"],
    ["地区", UI.esc(u.region)],
    ["注册时间", UI.fmtDateTime(u.regTime)],
  ];

  const asset = `
    <div class="card asset-card">
      <div class="asset-grid">
        <div class="asset-item"><div class="txt-xs txt-3">收入</div><div class="num asset-income">+${UI.fmtMoney(sum.income)}</div></div>
        <div class="asset-item"><div class="txt-xs txt-3">支出</div><div class="num">-${UI.fmtMoney(sum.expense)}</div></div>
        <div class="asset-item"><div class="txt-xs txt-3">余额</div><div class="num">${UI.fmtMoney(sum.balance)}</div></div>
      </div>
      <div class="asset-title bold txt-sm">最近 5 笔记录</div>
      ${records.length ? records.map(r => `
        <div class="record-row">
          <span class="record-cat">${catEmoji(r.cat)}</span>
          <div class="flex-1" style="min-width:0">
            <div class="ellipsis txt-sm">${UI.esc(r.note || "")}</div>
            <div class="txt-xs txt-3">${UI.esc(r.date || "")}</div>
          </div>
          <span class="num ${r.type === "in" ? "record-in" : ""}">${r.type === "in" ? "+" : "-"}${UI.fmtMoney(r.amount)}</span>
        </div>`).join("") : `<div class="txt-xs txt-3" style="padding:10px 0">暂无记账记录</div>`}
    </div>`;

  const s = UI.sheet(`
    <div class="sheet-head"><h3>用户详情</h3><button class="icon-btn" data-close>${UI.icon("close", 18)}</button></div>
    <div class="ud-head">
      ${UI.avatarEl(u, "lg")}
      <div class="ud-info">
        <div class="bold txt-lg">${UI.esc(u.nickname)}</div>
        <div class="txt-xs txt-3 ellipsis">${UI.esc(u.account)}</div>
        <div class="txt-xs txt-3">ID：${UI.esc(u.id)}</div>
      </div>
    </div>
    <div class="list mt-16">${infos.map(([k, v]) => infoRow(k, v)).join("")}</div>
    ${asset}`);
  s.el.querySelector("[data-close]").onclick = () => s.close();
}

render();})();
