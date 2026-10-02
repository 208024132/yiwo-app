/* 主题页逻辑：11 套主题选择（本地优先级最高），恢复默认则跟随后台默认主题 */
(() => {
  UserShell.boot({ tab: null, title: "主题", back: "my.html", hideTab: true });

  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("theme-body");

  function hasLocal() { return !!localStorage.getItem("yiwo_theme"); }

  function render() {
    const cur = Theme.current();
    const localPicked = hasLocal();

    body.innerHTML = `
      <section class="card flat intro fade-in">
        <div class="intro-title flex items-center gap-6">${UI.icon("sparkles", 18)}<span class="bold">选择一套主题</span></div>
        <p class="txt-sm txt-3 mt-8">立即生效，管理后台可配置默认主题</p>
      </section>

      <section class="theme-grid mt-16">
        ${Theme.THEMES.map(t => {
          const active = t.id === cur;
          return `
          <div class="theme-card ${active ? "on" : ""}" data-id="${t.id}">
            <div class="theme-swatch" style="background:linear-gradient(135deg,${t.swatch[0]},${t.swatch[1]} 55%,${t.swatch[2]})"></div>
            <div class="theme-info">
              <div class="theme-name-row">
                <span class="bold">${UI.esc(t.name)}</span>
                ${t.dark ? `<span class="tag">深色</span>` : ""}
              </div>
              <div class="txt-xs txt-3 mt-8">${UI.esc(t.desc)}</div>
            </div>
            ${active ? `<span class="theme-check">${UI.icon("check", 16)}</span>` : ""}
          </div>`;
        }).join("")}
      </section>

      <div class="txt-xs txt-3 theme-src mt-12">
        ${localPicked ? `当前主题「${UI.esc(Theme.byId(cur).name)}」` : "当前使用后台默认"}
      </div>

      <button class="btn ghost block reset-btn mt-16">恢复默认主题</button>
    `;

    body.querySelectorAll(".theme-card").forEach(card => {
      card.onclick = () => {
        const id = card.dataset.id;
        Theme.setLocal(id);
        UI.toast("已切换为「" + Theme.byId(id).name + "」");
        render();
      };
    });

    body.querySelector(".reset-btn").onclick = async () => {
      const ok = await UI.confirm("恢复默认主题", "将清除本地主题选择，使用后台默认主题");
      if (!ok) return;
      Theme.clearLocal();
      UI.toast("已恢复后台默认主题");
      render();
    };
  }

  render();
})();