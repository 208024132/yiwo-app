/* PWA：注册 Service Worker（供所有用户端页面统一引入）。
   只在支持的浏览器注册；注册失败静默，绝不影响页面主逻辑。 */
(() => {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    try {
      navigator.serviceWorker.register("./sw.js");
    } catch (e) { /* 注册失败不影响页面 */ }
  });
})();
