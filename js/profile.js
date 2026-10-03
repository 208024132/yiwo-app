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

  function heroStyle() {
    const bg = u.profileBg;
    if (bg && bg.type === "image" && bg.src) return `background-image:url('${bg.src}');background-size:cover;background-position:center;`;
    if (bg && bg.type === "color" && bg.value) return `background:${bg.value};`;
    return "";
  }

  function render() {
    const hero = `
      <div class="profile-hero ${u.profileBg ? "has-bg" : ""} ${u.profileBg && u.profileBg.type === "image" ? "has-img-bg" : ""}" style="${heroStyle()}">
        <button class="profile-bg-btn" data-bg aria-label="更换背景">${UI.icon("palette", 16)}</button>
        <div class="profile-ava-wrap" data-avatar>
          ${UI.avatarEl(u, "xl")}
          <span class="icon-btn profile-ava-edit">${UI.icon("edit", 15)}</span>
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

  // 全屏查看原图
  function openViewer(src) {
    const el = document.createElement("div");
    el.className = "img-viewer";
    el.innerHTML = `<img src="${src}" alt=""><button class="img-viewer-x" aria-label="关闭">${UI.icon("close", 22)}</button>`;
    document.body.appendChild(el);
    const close = () => el.remove();
    el.onclick = e => { if (e.target === el || e.target.closest(".img-viewer-x")) close(); };
  }

  function openAvatar() {
    const hasImg = !!u.avatarImg;
    const s = UI.sheet(`
      <div class="sheet-head"><h3>头像设置</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <div class="ava-preview">${UI.avatarEl(u, "xl")}</div>
      <div class="ava-btns">
        ${hasImg ? `<button class="btn ghost sm" data-view>${UI.icon("search", 15)} 查看原图</button>` : ""}
        <button class="btn ghost sm" data-upload>${UI.icon("image", 15)} 自定义头像</button>
        ${hasImg ? `<button class="btn ghost sm" data-reset>${UI.icon("refresh", 15)} 恢复默认</button>` : ""}
      </div>
      <input type="file" accept="image/*" hidden data-file>
      <div class="ava-tip txt-xs txt-3">或选择一个默认头像</div>
      <div class="avatar-grid">
        ${EMOJIS.map(e => `<div class="avatar-opt ${!hasImg && u.avatarEmoji === e ? "on" : ""}" data-e="${e}">${e}</div>`).join("")}
      </div>`);
    s.el.querySelector("[data-x]").onclick = () => s.close();

    const view = s.el.querySelector("[data-view]");
    if (view) view.onclick = () => { if (u.avatarImg) openViewer(u.avatarImg); };

    const reset = s.el.querySelector("[data-reset]");
    if (reset) reset.onclick = () => {
      Store.updateProfile(u.id, { avatarImg: "", avatarEmoji: "" });
      s.close();
      UI.toast("已恢复默认头像", "success");
      render();
    };

    const file = s.el.querySelector("[data-file]");
    s.el.querySelector("[data-upload]").onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      try {
        const src = await UI.readImage(f, { max: 480, quality: 0.8, square: true });
        Store.updateProfile(u.id, { avatarImg: src, avatarEmoji: "" });
        s.close();
        UI.toast("头像已更新", "success");
        render();
      } catch (err) { UI.toast(err.message || "图片处理失败", "error"); }
    };

    s.el.querySelectorAll("[data-e]").forEach(el => el.onclick = () => {
      Store.updateProfile(u.id, { avatarEmoji: el.dataset.e, avatarImg: "" });
      s.close();
      UI.toast("头像已更新", "success");
      render();
    });
  }

  // 头像区背景：纯色 / 自定义图片
  const BG_PRESETS = [
    "var(--grad)",
    "linear-gradient(135deg,#f2994a,#ef5e47)",
    "linear-gradient(135deg,#56ccf2,#2f80ed)",
    "linear-gradient(135deg,#a1e657,#43a047)",
    "linear-gradient(135deg,#f76f8e,#b23a6e)",
    "linear-gradient(135deg,#9b6cf7,#5f3dcf)",
    "linear-gradient(135deg,#f2c94c,#f2994a)",
    "linear-gradient(135deg,#48c6c0,#1f8a8a)",
    "linear-gradient(135deg,#8e9eab,#5c6b7a)",
  ];

  function openBg() {
    const cur = u.profileBg;
    const curVal = cur && cur.type === "color" ? cur.value : "";
    const s = UI.sheet(`
      <div class="sheet-head"><h3>头像背景</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <div class="bg-swatches">
        ${BG_PRESETS.map(v => `<div class="bg-swatch ${curVal === v ? "on" : ""}" style="background:${v}" data-v="${v}"></div>`).join("")}
      </div>
      <div class="ava-btns">
        <button class="btn ghost sm" data-upload>${UI.icon("image", 15)} 自定义背景图</button>
        ${cur ? `<button class="btn ghost sm" data-reset>${UI.icon("refresh", 15)} 恢复默认</button>` : ""}
      </div>
      <input type="file" accept="image/*" hidden data-file>`);
    s.el.querySelector("[data-x]").onclick = () => s.close();

    const reset = s.el.querySelector("[data-reset]");
    if (reset) reset.onclick = () => {
      Store.updateProfile(u.id, { profileBg: null });
      s.close();
      UI.toast("已恢复默认背景", "success");
      render();
    };

    const file = s.el.querySelector("[data-file]");
    s.el.querySelector("[data-upload]").onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      try {
        const src = await UI.readImage(f, { max: 1280, quality: 0.75 });
        Store.updateProfile(u.id, { profileBg: { type: "image", src } });
        s.close();
        UI.toast("背景已更新", "success");
        render();
      } catch (err) { UI.toast(err.message || "图片处理失败", "error"); }
    };

    s.el.querySelectorAll("[data-v]").forEach(el => el.onclick = () => {
      Store.updateProfile(u.id, { profileBg: { type: "color", value: el.dataset.v } });
      s.close();
      UI.toast("背景已更新", "success");
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
    const bg = e.target.closest("[data-bg]");
    if (bg) { openBg(); return; }
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