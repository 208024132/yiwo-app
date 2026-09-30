/* 个人信息：头像 + 资料编辑 */
UserShell.boot({ hideTab: true, back: "my.html", title: "个人信息" });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("profile-body");
  const EMOJIS = ["🦁", "🐼", "🐳", "🦊", "🐱", "🐰", "🐯", "🐨"];
  const disp = v => (v ? String(v) : "未设置");

  function fieldRow(label, value, key) {
    return `
      <div class="list-item tap" data-edit="${key}">
        <div class="li-main"><div class="li-title">${label}</div></div>
        <span class="li-value ellipsis">${UI.esc(value)}</span>
        <span class="li-arrow">${UI.icon("chevron-right", 18)}</span>
      </div>`;
  }

  function render() {
    const hero = `
      <div class="profile-hero">
        <div class="profile-ava-wrap">
          ${UI.avatarEl(u, "xl")}
          <button class="icon-btn profile-ava-edit" data-avatar aria-label="更换头像">${UI.icon("edit", 15)}</button>
        </div>
        <div class="profile-name">${UI.esc(u.nickname)}</div>
        <div class="profile-sig">${UI.esc(u.signature || "这个人很懒，什么都没写")}</div>
      </div>`;

    const list = `
      <div class="list profile-list">
        ${fieldRow("网名", u.nickname, "nickname")}
        ${fieldRow("个性签名", u.signature || "未设置", "signature")}
        <div class="list-item">
          <div class="li-main"><div class="li-title">用户ID</div></div>
          <span class="li-value num">${UI.esc(u.id)}</span>
          <button class="icon-btn" data-copy aria-label="复制">${UI.icon("layers", 18)}</button>
        </div>
        ${fieldRow("手机号", disp(u.phone), "phone")}
        ${fieldRow("年龄", u.age ? u.age + " 岁" : "未设置", "age")}
        ${fieldRow("性别", u.gender || "未设置", "gender")}
        ${fieldRow("出生日期", disp(u.birthday), "birthday")}
        ${fieldRow("地区", disp(u.region), "region")}
      </div>`;

    const note = `
      <div class="card privacy-note-card">
        <p class="privacy-note">我们收集的个人信息（头像、个性签名、网名、用户ID、手机号、年龄、性别、出生日期、地区）仅用于完善你的个人资料与好友查找，不会向第三方披露。</p>
      </div>`;

    body.innerHTML = hero + list + note;
  }

  function openAvatar() {
    const s = UI.sheet(`
      <div class="sheet-head"><h3>选择头像</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <div class="avatar-grid">
        ${EMOJIS.map(e => `<div class="avatar-opt ${u.avatarEmoji === e ? "on" : ""}" data-e="${e}">${e}</div>`).join("")}
      </div>`);
    s.el.querySelector("[data-x]").onclick = () => s.close();
    s.el.querySelectorAll("[data-e]").forEach(el => el.onclick = () => {
      Store.updateProfile(u.id, { avatarEmoji: el.dataset.e });
      s.close();
      UI.toast("头像已更新", "success");
      render();
    });
  }

  function openAge() {
    const s = UI.sheet(`
      <div class="sheet-head"><h3>年龄</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <input type="number" min="18" max="80" class="input" data-n value="${u.age || ""}" placeholder="18-80">
      <div class="sheet-actions">
        <button class="btn ghost" data-no>取消</button>
        <button class="btn primary" data-ok>保存</button>
      </div>`);
    s.el.querySelector("[data-x]").onclick = s.el.querySelector("[data-no]").onclick = () => s.close();
    s.el.querySelector("[data-ok]").onclick = () => {
      const raw = s.el.querySelector("[data-n]").value.trim();
      if (!raw) { Store.updateProfile(u.id, { age: 0 }); s.close(); UI.toast("已保存", "success"); render(); return; }
      const n = Number(raw);
      if (n < 18 || n > 80) { UI.toast("年龄需在 18-80 之间", "warn"); return; }
      Store.updateProfile(u.id, { age: n });
      s.close();
      UI.toast("已保存", "success");
      render();
    };
  }

  function openGender() {
    const opts = ["男", "女", "保密"];
    const s = UI.sheet(`
      <div class="sheet-head"><h3>性别</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <div class="seg">${opts.map(k => `<button data-g="${k}" class="${u.gender === k ? "on" : ""}">${k}</button>`).join("")}</div>`);
    s.el.querySelector("[data-x]").onclick = () => s.close();
    s.el.querySelectorAll("[data-g]").forEach(b => b.onclick = () => {
      Store.updateProfile(u.id, { gender: b.dataset.g });
      s.close();
      UI.toast("已保存", "success");
      render();
    });
  }

  function openBirthday() {
    const s = UI.sheet(`
      <div class="sheet-head"><h3>出生日期</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <input type="date" class="input" data-d value="${u.birthday || ""}">
      <div class="sheet-actions">
        <button class="btn ghost" data-no>取消</button>
        <button class="btn primary" data-ok>保存</button>
      </div>`);
    s.el.querySelector("[data-x]").onclick = s.el.querySelector("[data-no]").onclick = () => s.close();
    s.el.querySelector("[data-ok]").onclick = () => {
      Store.updateProfile(u.id, { birthday: s.el.querySelector("[data-d]").value });
      s.close();
      UI.toast("已保存", "success");
      render();
    };
  }

  function openRegion() {
    const s = UI.sheet(`
      <div class="sheet-head"><h3>选择地区</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <div class="region-list">
        ${Store.REGIONS.map(r => `
          <div class="region-row ${u.region === r ? "on" : ""}" data-r="${r}">
            <span>${r}</span>${u.region === r ? `<span>✓</span>` : ""}
          </div>`).join("")}
      </div>`);
    s.el.querySelector("[data-x]").onclick = () => s.close();
    s.el.querySelectorAll("[data-r]").forEach(el => el.onclick = () => {
      Store.updateProfile(u.id, { region: el.dataset.r });
      s.close();
      UI.toast("已保存", "success");
      render();
    });
  }

  async function handleEdit(key) {
    if (key === "nickname") {
      const v = await UI.promptInput({ title: "修改网名", placeholder: "输入网名", value: u.nickname, max: 20 });
      if (v === null) return;
      if (!v) { UI.toast("网名不能为空", "warn"); return; }
      Store.updateProfile(u.id, { nickname: v });
      UI.toast("已保存", "success");
      render();
    } else if (key === "signature") {
      const v = await UI.promptInput({ title: "个性签名", placeholder: "写一句话介绍自己", value: u.signature, max: 30 });
      if (v === null) return;
      Store.updateProfile(u.id, { signature: v });
      UI.toast("已保存", "success");
      render();
    } else if (key === "phone") {
      const v = await UI.promptInput({ title: "手机号", placeholder: "请输入 11 位手机号", value: u.phone, max: 11 });
      if (v === null) return;
      if (v && !/^1\d{10}$/.test(v)) { UI.toast("手机号格式不正确", "error"); return; }
      Store.updateProfile(u.id, { phone: v });
      UI.toast("已保存", "success");
      render();
    } else if (key === "age") {
      openAge();
    } else if (key === "gender") {
      openGender();
    } else if (key === "birthday") {
      openBirthday();
    } else if (key === "region") {
      openRegion();
    }
  }

  body.addEventListener("click", e => {
    const av = e.target.closest("[data-avatar]");
    if (av) { openAvatar(); return; }
    const cp = e.target.closest("[data-copy]");
    if (cp) {
      const done = () => UI.toast("已复制", "success");
      const fail = () => UI.toast("复制失败", "error");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(u.id).then(done, fail);
      } else {
        const ta = document.createElement("textarea");
        ta.value = u.id;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (err) { fail(); }
        ta.remove();
      }
      return;
    }
    const ed = e.target.closest("[data-edit]");
    if (ed) handleEdit(ed.dataset.edit);
  });

  render();
})();