/* 首次使用引导页：滑动卡片介绍核心功能
   - 独立轻量布局，不依赖登录态（未登录也能浏览，跳转 index 后由 UserShell 统一守卫）
   - 完成或跳过时写 localStorage.yiwo_onboarded=1，再跳 index.html */
(() => {
  Theme.apply(Theme.current());

  // localStorage 读写兜底（隐私模式/配额满时不卡死）
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  // 已完成引导则不再展示，直接进首页
  if (lsGet("yiwo_onboarded")) { location.replace("index.html"); return; }

  const SLIDES = [
    { e: "💰", title: "轻松记账", desc: "记下每一笔开销，看清钱都花在了哪里" },
    { e: "👥", title: "好友社交", desc: "添加好友，分享生活动态，互相点赞评论" },
    { e: "☁️", title: "多设备同步", desc: "数据云端备份，换设备登录也不会丢" },
    { e: "🔥", title: "健身打卡", desc: "坚持每日运动打卡，养成健康好习惯" },
  ];

  const track = document.getElementById("ob-track");
  const dots = document.getElementById("ob-dots");
  const nextBtn = document.getElementById("ob-next");
  const skipBtn = document.getElementById("ob-skip");
  let idx = 0;

  // 渲染卡片与分页圆点
  track.innerHTML = SLIDES.map(s => `
    <section class="ob-slide">
      <div class="ob-emoji">${s.e}</div>
      <div class="ob-title">${UI.esc(s.title)}</div>
      <div class="ob-desc">${UI.esc(s.desc)}</div>
    </section>`).join("");

  dots.innerHTML = SLIDES.map((_, i) => `<span class="ob-dot ${i === 0 ? "on" : ""}"></span>`).join("");

  function finish() {
    lsSet("yiwo_onboarded", "1");
    location.href = "index.html";
  }

  function go(i) {
    idx = Math.max(0, Math.min(SLIDES.length - 1, i));
    track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" });
    update();
  }

  function update() {
    dots.querySelectorAll(".ob-dot").forEach((d, i) => d.classList.toggle("on", i === idx));
    nextBtn.textContent = idx === SLIDES.length - 1 ? "开始使用" : "下一步";
  }

  // 滑动结束后定位当前卡片
  track.addEventListener("scroll", () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== idx) { idx = i; update(); }
  }, { passive: true });

  nextBtn.onclick = () => {
    if (idx === SLIDES.length - 1) finish();
    else go(idx + 1);
  };

  skipBtn.onclick = finish;

  // 键盘左右切换
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") go(idx + 1);
    if (e.key === "ArrowLeft") go(idx - 1);
  });
})();
