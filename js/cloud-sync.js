/* ============================================================
   以我APP · 本地 ↔ 云端同步（P1：账号 + 个人数据）
   依赖：window.Store（store.js）、window.Cloud（cloud.js）
   设计原则：
   - 未配置云端环境 / 未链接云端账号时完全袖手旁观，本地功能零影响。
   - 云端个人数据包按 uid 一份（yiwo_kv/{uid}），只覆盖本人那份；
     本地其它账号的数据不会被清掉。
   - 上行剥离密码；下行保留本地登录会话。
   ============================================================ */
window.CloudSync = (() => {
  const LINK_KEY = "yiwo_cloud_uid";     // 本机已链接的云端 uid
  const SYNC_KEY = "yiwo_cloud_sync_at"; // 最近一次与云端对齐的时间戳（LWW 基准）
  const DEBOUNCE = 800;                  // 本地改动合并上行延迟

  // 以 uid 为键的个人数据集合（P1 同步范围）
  const KV_KEYS = ["accounts", "wallets", "debts", "customCats", "catOrder", "order",
    "groups", "friendGroup", "remark", "chatHidden", "friendNav", "memos", "fitness", "tasks"];

  let cloudUid = "";
  let applying = false;      // 下行接管期间忽略本地变更通知
  let flushing = false;      // 正在上行
  let pendingAgain = false;  // 上行期间又发生变更
  let timer = null;
  let lastHash = "";

  let status = { state: "idle", at: 0, msg: "" };

  /* ---------- 工具 ---------- */
  function isLinked() { return !!cloudUid; }
  function getStatus() { return Object.assign({}, status); }
  function linkedUid() { return cloudUid; }

  function setStatus(state, msg) {
    status = { state, at: Date.now(), msg: msg || "" };
    try {
      window.dispatchEvent(new CustomEvent("yiwo:cloud-status", { detail: Object.assign({}, status) }));
    } catch (e) { /* ignore */ }
  }

  function localUser() { try { return Store.currentUser(); } catch (e) { return null; } }
  function localUid() { const u = localUser(); return u ? u.id : ""; }

  function readLS(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function writeLS(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function removeLS(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  // djb2：轻量指纹，用于判断本地是否有实质变化
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return h + ":" + str.length;
  }

  /* ---------- 数据包构造 ---------- */
  // 个人数据包：uid 键集合 + 书架 + 全局设置
  function kvSnapshot(db) {
    const data = {};
    KV_KEYS.forEach(k => { data[k] = db[k] || {}; });
    data.books = db.books || { recommend: [], shelf: {} };
    data.settings = db.settings || {};
    return data;
  }
  // 上行的用户资料：剥掉明文密码
  function profileOf(u) {
    const p = Object.assign({}, u);
    delete p.password;
    return p;
  }
  function findUser(db, id) {
    return (db.users || []).find(x => x && x.id === id) || null;
  }
  function snapshotHash(db) {
    const u = findUser(db, cloudUid || localUid());
    return hash(JSON.stringify(kvSnapshot(db))) + "|" + hash(u ? JSON.stringify(profileOf(u)) : "");
  }
  function buildPayload(uid, db) {
    const u = findUser(db, uid);
    // 剥掉明文密码，只上行公开资料
    return { kv: kvSnapshot(db), profile: u ? profileOf(u) : {} };
  }

  /**
   * 用云端数据构造本地镜像：
   * - 本人数据以云端为准；
   * - 本地其它账号的数据（云端没有的键）继续保留，避免误删；
   * - 社交集合（好友/申请/会话/动态）P1 不同步，保留本地。
   */
  function buildNext(kvData, uid, profile, localDb) {
    const data = kvData || {};
    const next = {
      users: [],
      friends: (localDb.friends || []),
      friendReqs: (localDb.friendReqs || []),
      chats: (localDb.chats || []),
      moments: (localDb.moments || []),
      admins: (localDb.admins || []),
      settings: data.settings || localDb.settings || {},
      books: data.books || localDb.books || { recommend: [], shelf: {} },
      session: { type: "user", uid: uid },
      seq: localDb.seq || 1,
    };
    KV_KEYS.forEach(k => {
      next[k] = Object.assign({}, (localDb[k] || {}), (data[k] || {}));
    });

    const seen = {};
    const local = findUser(localDb, uid);
    // 本人资料以云端为准，但保留本机字段（如明文密码只存本机）
    if (profile || local) {
      const merged = Object.assign({}, local || {}, profile || {}, { id: uid });
      if (!merged.nickname && merged.account) merged.nickname = String(merged.account).split("@")[0];
      next.users.push(merged);
      seen[uid] = 1;
    }
    (localDb.users || []).forEach(u => {
      if (u && u.id && !seen[u.id]) { next.users.push(u); seen[u.id] = 1; }
    });
    if (!next.users.some(u => u && u.id === uid)) next.users.unshift(Object.assign({}, (localUser() || {}), { id: uid }));
    return next;
  }

  /* ---------- 链接状态 ---------- */
  function link(uid) { cloudUid = uid; writeLS(LINK_KEY, uid); }
  function reset() {
    cloudUid = "";
    if (timer) { clearTimeout(timer); timer = null; }
    removeLS(LINK_KEY);
    setStatus("idle");
  }

  /* ---------- 等待本地数据接管完成（store.hydrate 完成前不得改数据） ----------
     在脚本加载时就开始监听，避免事件已触发而漏接。 */
  let storeReady = false;
  let readyWaiters = [];
  window.addEventListener("yiwo:store-ready", () => {
    storeReady = true;
    readyWaiters.splice(0).forEach(fn => fn());
  });
  function whenStoreReady() {
    if (storeReady) return Promise.resolve();
    return new Promise(resolve => {
      readyWaiters.push(resolve);
      setTimeout(resolve, 3000);   // 兜底：本地存储异常时不至于永久阻塞
    });
  }

  /* ---------- 上行 ---------- */
  function onLocalChange() {
    if (applying || !isLinked() || !Cloud.isConfigured()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; pushAll(); }, DEBOUNCE);
  }

  async function pushAll() {
    if (!isLinked() || !Cloud.isConfigured()) return false;
    if (flushing) { pendingAgain = true; return false; }
    const db = Store.getSnapshot();
    const h = snapshotHash(db);
    if (h === lastHash) return true;
    flushing = true;
    setStatus("syncing");
    const now = Date.now();
    const ok = await Cloud.push(cloudUid, buildPayload(cloudUid, db), now);
    flushing = false;
    if (ok) {
      lastHash = snapshotHash(db);
      writeLS(SYNC_KEY, String(now));
      setStatus("ok");
    } else {
      setStatus("error", "同步失败，请检查网络后重试");
    }
    if (pendingAgain) { pendingAgain = false; if (ok) onLocalChange(); }
    return ok;
  }

  /* ---------- 下行 ---------- */
  function adopt(payload, uid) {
    applying = true;
    try {
      const next = buildNext(payload && payload.kv, uid, payload && payload.profile, Store.getSnapshot());
      Store.beginRemoteApply();
      try {
        Store.applyRemote(next, { keepSession: false });
      } finally {
        Store.endRemoteApply();
      }
      lastHash = snapshotHash(Store.getSnapshot());
    } finally {
      applying = false;
    }
  }

  /* ---------- 登录/注册后的统一入口 ---------- */
  async function enter(uid) {
    if (!uid) return { ok: false, msg: "缺少云端账号标识" };
    if (!Cloud.isConfigured()) return { ok: false, msg: "云端服务未启用" };
    setStatus("syncing");
    await whenStoreReady();
    try {
      // 本地新注册账号 id 与云端 uid 对齐（老账号启用同步同理）
      const cur = localUid();
      if (cur && cur !== uid) Store.migrateUid(cur, uid);

      const remote = await Cloud.pull(uid);
      const hasRemote = !!(remote && remote.payload);
      if (hasRemote) {
        adopt(remote.payload, uid);
        const at = Number(remote.updatedAt) || Date.now();
        writeLS(SYNC_KEY, String(at));
        link(uid);
        setStatus("ok");
        return { ok: true, adopted: true };
      }
      // 云端无数据：把本地这份首传到云端
      link(uid);
      const ok = await pushAll();
      if (!ok) setStatus("error", "首次上传失败，请稍后点「立即同步」重试");
      return { ok: true, adopted: false };
    } catch (e) {
      setStatus("error", "同步初始化失败");
      return { ok: false, msg: "同步初始化失败" };
    }
  }

  /* ---------- 立即同步（LWW：云端更新则下行，否则上行） ---------- */
  async function syncNow() {
    if (!isLinked() || !Cloud.isConfigured()) return false;
    setStatus("syncing");
    await whenStoreReady();
    let remote = null;
    try { remote = await Cloud.pull(cloudUid); } catch (e) { remote = null; }
    if (!remote) { setStatus("offline", "无法连接云端，请检查网络"); return false; }

    const remoteAt = Number(remote.updatedAt) || 0;
    const localAt = Number(readLS(SYNC_KEY)) || 0;
    if (remoteAt > localAt) {
      adopt(remote.payload, cloudUid);
      writeLS(SYNC_KEY, String(remoteAt));
      setStatus("ok");
      return true;
    }
    return await pushAll();
  }

  /* ---------- 页面启动：恢复上次的链接并同步 ---------- */
  async function boot() {
    if (!Cloud.isConfigured()) { setStatus("off"); return; }
    const ok = await Cloud.ready;
    if (!ok) { setStatus("off"); return; }
    const cu = await Cloud.getUid();
    const saved = readLS(LINK_KEY);
    if (cu && (cu === saved || cu === localUid())) {
      link(cu);
      await syncNow();
    } else if (!cu) {
      setStatus("idle");
    }
  }

  return {
    onLocalChange, enter, syncNow, boot, reset,
    isLinked, getStatus, linkedUid,
    getLastSyncAt: () => Number(readLS(SYNC_KEY)) || 0,
    KV_KEYS,
  };
})();