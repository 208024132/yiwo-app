/* ============================================================
   以我APP · 主题管理器（6 套主题）
   优先级：设备本地选择 > 后台默认主题 > 以我红(red)
   ============================================================ */
window.Theme = (() => {
  const LOCAL_KEY = "yiwo_theme";
  const THEMES = [
    { id: "red",    name: "以我红", desc: "温暖品牌默认色", swatch: ["#df8a70", "#c45e4a", "#a33b2c"], dark: false, bg: "#faf5ef" },
    { id: "green",  name: "森屿绿", desc: "清新自然的绿意", swatch: ["#7cbd98", "#4d8f6e", "#356f55"], dark: false, bg: "#f3f8f3" },
    { id: "gold",   name: "落日金", desc: "暖阳般的金色调", swatch: ["#e8c76a", "#c1932c", "#96711e"], dark: false, bg: "#faf6e8" },
    { id: "orange", name: "蜜橘橙", desc: "元气满满的橘色", swatch: ["#f0a06b", "#d96a33", "#b05126"], dark: false, bg: "#faf4ec" },
    { id: "blue",   name: "海盐蓝", desc: "安静清爽的海蓝", swatch: ["#74a9de", "#3d7fc4", "#2f6399"], dark: false, bg: "#f2f6fb" },
    { id: "purple", name: "星夜紫", desc: "深邃暗色星夜", swatch: ["#8b5cf6", "#6d28d9", "#4c1d95"], dark: true, bg: "#16141f" },
  ];

  function current() {
    const local = localStorage.getItem(LOCAL_KEY);
    if (local && THEMES.some(t => t.id === local)) return local;
    try {
      const s = window.Store ? Store.getSettings() : null;
      if (s && s.defaultTheme && THEMES.some(t => t.id === s.defaultTheme)) return s.defaultTheme;
    } catch (e) { /* ignore */ }
    return "red";
  }

  function apply(id = current()) {
    document.documentElement.dataset.theme = id;
  }

  /** 设备本地选择（用户自己在主题页选） */
  function setLocal(id) {
    if (!THEMES.some(t => t.id === id)) return;
    localStorage.setItem(LOCAL_KEY, id);
    apply(id);
  }

  /** 清除本地选择，回落到后台默认主题 */
  function clearLocal() {
    localStorage.removeItem(LOCAL_KEY);
    apply(current());
  }

  function byId(id) { return THEMES.find(t => t.id === id) || THEMES[0]; }

  apply(); // 启动即生效（store 未加载时会回落红主题，随后由 shell 二次校正）

  return { THEMES, current, apply, setLocal, clearLocal, byId };
})();