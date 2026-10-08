/* ============================================================
   以我APP · Service Worker（PWA 离线缓存）
   策略：
   - HTML（navigate 请求）：网络优先，失败回退缓存 —— 避免用户拿到旧版页面卡死。
   - 静态资源（JS/CSS/图片/图标/manifest）：缓存优先 + 后台静默更新（stale-while-revalidate）。
   - 云端 API / 动态请求：一律不拦截（CloudBase 走跨域 + POST，且域名含 cloudbase/tcb-api 等）。
   - 管理后台（/admin/）：不纳入 PWA，全部直接放行，避免干扰。
   更新方式：改动后 bump 下面的 CACHE 版本号（如 yiwo-v2）。
   ============================================================ */
const CACHE = "yiwo-v1";

/* install：预缓存「首页」完整依赖，保证断网也能直接打开首页 */
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./css/base.css",
  "./css/components.css",
  "./css/shell.css",
  "./css/index.css",
  "./js/theme.js",
  "./js/store.js",
  "./js/cloud.js",
  "./js/cloud-sync.js",
  "./js/ui.js",
  "./js/charts.js",
  "./js/shell-user.js",
  "./js/index.js",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

/* activate：清掉旧版本缓存，并立即接管页面 */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** 是否放行（不拦截）：
 *  - 非 GET（POST/PUT/DELETE 等，含所有云端写入）
 *  - 跨域请求（CloudBase SDK / 网关 / 字体等）
 *  - 同源但路径含云端 API 关键字（防万一 CloudBase 被反向代理到同源）
 *  - 管理后台 /admin/ 路径 */
function shouldBypass(request) {
  if (request.method !== "GET") return true;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return true;
  if (/\/admin\//.test(url.pathname)) return true;
  const hay = (url.host + url.pathname).toLowerCase();
  if (/cloudbase|tcb-api|tcloudbasegateway|rest\/v1|auth\/v1/.test(hay)) return true;
  return false;
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (shouldBypass(req)) return;   // 放行，走浏览器默认网络行为

  // 页面导航：网络优先，失败回缓存（再兜底回首页）
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req).then(cached => cached || caches.match("./index.html"))
      )
    );
    return;
  }

  // 静态资源：缓存优先，命中后后台静默更新；未命中则走网络并写缓存
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        fetch(req).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
        }).catch(() => { /* 网络失败时保留现有缓存 */ });
        return cached;
      }
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
