/* ============================================================
   以我APP · 本地 ↔ 云端同步（P1：账号 + 个人数据）
   依赖：window.Store（store.js）、window.Cloud（cloud.js）
   设计原则：
   - 未配置云端环境 / 未链接云端账号时完全袖手旁观，本地功能零影响。
   - 云端个人数据包按 uid 一份（yiwo_kv/{uid}），只覆盖本人那份；
     本地其它账号的数据不会被清掉。
   - 上行剥离密码；下行保留本地登录会话，且合并时不复活任何 password 字段。
   ============================================================ */
window.CloudSync = (() => {
  const LINK_KEY = "yiwo_cloud_uid";     // 本机已链接的云端 uid
  const SYNC_KEY = "yiwo_cloud_sync_at"; // 最近一次与云端对齐的时间戳（LWW 基准）
  const DEBOUNCE = 300;                  // 本地改动合并上行延迟（原 800，用户反馈同步慢，调快）
  const POLL_MS = 30000;                 // 后台轮询下拉间隔：有网络变化时实时感知另一端改动

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
  /* ---------- 社交记录序列化 / 合并（P2：好友、好友申请、会话、动态） ---------- */
  // 本地四类集合 -> 云端记录数组（id / kind / owner_id / members / updated_at / deleted / data）
  function socialRecords(db) {
    const meta = db.socialMeta || {};
    const atOf = (id, fb) => Math.max(Number(meta[id] && meta[id].at) || 0, Number(fb) || 0);
    const recs = {};

    (db.friends || []).forEach(f => {
      if (!f || !f.a || !f.b) return;
      const id = Store.socialId("friend", f.a, f.b);
      recs[id] = { id, kind: "friend", owner_id: f.a, members: [f.a, f.b],
        updated_at: atOf(id, f.since), deleted: false, data: { a: f.a, b: f.b, since: f.since || 0 } };
    });
    (db.friendReqs || []).forEach(r => {
      if (!r || !r.from || !r.to) return;
      const id = Store.socialId("req", r.from, r.to);
      recs[id] = { id, kind: "req", owner_id: r.from, members: [r.from, r.to],
        updated_at: atOf(id, r.t), deleted: false, data: { from: r.from, to: r.to, t: r.t || 0 } };
    });
    (db.chats || []).forEach(c => {
      if (!c || !c.a || !c.b) return;
      const id = Store.socialId("chat", c.a, c.b);
      const msgs = c.msgs || [];
      const last = msgs.length ? msgs[msgs.length - 1].t : 0;
      recs[id] = { id, kind: "chat", owner_id: c.a, members: [c.a, c.b],
        updated_at: atOf(id, last), deleted: false,
        data: { a: c.a, b: c.b, msgs, clearedAt: c.clearedAt || 0 } };
    });
    (db.moments || []).forEach(m => {
      if (!m || !m.id || !m.uid) return;
      const id = Store.socialId("moment", m.id);
      recs[id] = { id, kind: "moment", owner_id: m.uid, members: [m.uid],
        updated_at: atOf(id, m.t), deleted: !!m.deleted, data: m };
    });
    // 墓碑：本地实体已删除但云端要留痕，否则换设备后会“复活”
    Object.keys(meta).forEach(id => {
      const mv = meta[id] || {};
      if (!mv.del) return;
      if (recs[id]) { recs[id].deleted = true; recs[id].data = null; return; }
      recs[id] = { id, kind: id.split(":")[0], owner_id: (mv.m || [])[0] || "",
        members: mv.m || [], updated_at: Number(mv.at) || 0, deleted: true, data: null };
    });
    return Object.keys(recs).map(k => recs[k]);
  }

  // 云端行 -> 规范化记录
  function normalizeRow(r) {
    return {
      id: String(r.id),
      kind: String(r.kind || String(r.id).split(":")[0]),
      owner_id: r.owner_id || "",
      members: Array.isArray(r.members) ? r.members : [],
      updated_at: Number(r.updated_at) || 0,
      deleted: !!r.deleted,
      data: r.data || null,
    };
  }

  // 会话消息按 msg.id 取并集（两设备各发的消息都不丢），并按 clearedAt 过滤“已清空”
  function unionChat(x, y) {
    const xs = x || {}, ys = y || {};
    const clear = Math.max(Number(xs.clearedAt) || 0, Number(ys.clearedAt) || 0);
    const byId = {};
    (xs.msgs || []).forEach(m => { if (m && m.id) byId[m.id] = m; });
    (ys.msgs || []).forEach(m => {
      if (!m || !m.id) return;
      const cur = byId[m.id];
      if (!cur) byId[m.id] = Object.assign({}, m, { read: !!m.read });
      else if (m.read && !cur.read) byId[m.id] = Object.assign({}, cur, { read: true });
    });
    let msgs = Object.keys(byId).map(k => byId[k]).sort((p, q) => (p.t || 0) - (q.t || 0));
    if (clear) msgs = msgs.filter(m => (m.t || 0) > clear);
    const added = msgs.length !== (xs.msgs || []).length || clear !== (Number(xs.clearedAt) || 0);
    return { data: { a: xs.a || ys.a, b: xs.b || ys.b, msgs, clearedAt: clear }, added };
  }

  // 动态的点赞/评论/转发数取并集，正文与可见性按 updated_at 较新者为准
  function unionMoment(x, y) {
    const xs = x || {}, ys = y || {};
    const likes = [], seen = {};
    (xs.likes || []).concat(ys.likes || []).forEach(u => { if (u && !seen[u]) { seen[u] = 1; likes.push(u); } });
    const comments = [], cseen = {};
    const key = c => [c && c.uid, c && c.t, c && c.text].join("|");
    (xs.comments || []).concat(ys.comments || []).forEach(c => { const k = key(c); if (!cseen[k]) { cseen[k] = 1; comments.push(c); } });
    comments.sort((p, q) => (p.t || 0) - (q.t || 0));
    const data = Object.assign({}, xs, { likes, comments, reposts: Math.max(xs.reposts || 0, ys.reposts || 0) });
    const added = likes.length !== (xs.likes || []).length || comments.length !== (xs.comments || []).length;
    return { data, added };
  }

  // 单条记录合并：updated_at 较新者为准；聊天/动态再叠加集合字段并集
  function mergeOne(local, remote) {
    if (!local) return { rec: remote, changed: true };
    if (!remote) return { rec: local, changed: false };
    const winner = remote.updated_at > local.updated_at ? remote
      : (remote.updated_at < local.updated_at ? local : (local.deleted && !remote.deleted ? remote : local));
    const loser = winner === remote ? local : remote;
    let rec = winner, added = false;
    if (!winner.deleted) {
      if (winner.kind === "chat") {
        const u = unionChat(winner.data, loser.data);
        rec = Object.assign({}, winner, { data: u.data }); added = u.added;
      } else if (winner.kind === "moment") {
        const u = unionMoment(winner.data, loser.data);
        rec = Object.assign({}, winner, { data: u.data }); added = u.added;
      }
    }
    return { rec, changed: winner === remote || added };
  }

  // 云端社交记录并入本地四类集合，返回合并结果与“是否有变化”
  function mergeSocial(rows, localDb) {
    const local = {};
    socialRecords(localDb).forEach(r => { local[r.id] = r; });
    const all = Object.assign({}, local);
    let changed = false;
    (rows || []).forEach(r => {
      if (!r || !r.id) return;
      const m = mergeOne(local[String(r.id)] || null, normalizeRow(r));
      all[m.rec.id] = m.rec;
      if (m.changed) changed = true;
    });
    const friends = [], friendReqs = [], chats = [], moments = [], socialMeta = {};
    Object.keys(all).forEach(id => {
      const r = all[id];
      socialMeta[id] = { at: Number(r.updated_at) || 0, del: r.deleted ? 1 : 0, m: r.members || [] };
      if (r.deleted) return;
      const d = r.data || {};
      if (r.kind === "friend" && d.a && d.b) friends.push({ a: d.a, b: d.b, since: d.since || r.updated_at });
      else if (r.kind === "req" && d.from && d.to) friendReqs.push({ from: d.from, to: d.to, t: d.t || r.updated_at });
      else if (r.kind === "chat" && d.a && d.b) chats.push({ a: d.a, b: d.b, msgs: d.msgs || [], clearedAt: d.clearedAt || 0 });
      else if (r.kind === "moment" && d.id && d.uid) moments.push(d);
    });
    moments.sort((a, b) => (b.t || 0) - (a.t || 0));   // 与 addMoment 的 unshift 顺序一致
    return { friends, friendReqs, chats, moments, socialMeta, changed };
  }

  // 社交轻量指纹：只看会变的摘要，避免把 base64 图片整包哈希
  function socialDigest(db) {
    const parts = socialRecords(db).map(r => {
      const d = r.data || {};
      const extra = r.kind === "chat" ? ((d.msgs || []).length + ":" + (d.clearedAt || 0))
        : r.kind === "moment" ? ((d.likes || []).length + "/" + (d.comments || []).length + "/" + (d.reposts || 0) + "/" + (d.privacy || ""))
          : "";
      return r.id + "@" + r.updated_at + "#" + (r.deleted ? 1 : 0) + "~" + extra;
    });
    return hash(parts.join(","));
  }

  function snapshotHash(db) {
    const u = findUser(db, cloudUid || localUid());
    return hash(JSON.stringify(kvSnapshot(db))) + "|"
      + hash(u ? JSON.stringify(profileOf(u)) : "") + "|" + socialDigest(db);
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
   * - 社交集合按记录 id 并集 + updated_at LWW 合并；
   * - 密码只存云端：所有用户对象合并后都剥掉 password，避免旧数据/云端残留写回本地。
   * email：当前云端会话邮箱，用于给骨架档案补账号/昵称（可为空）。
   */
  // 骨架档案兜底：补齐昵称/注册时间/头像等默认字段，避免出现「全空用户」（管理后台渲染 NaN）。
  function decorateUser(u, uid, email) {
    if (!u) u = {};
    u.id = uid;
    if (!u.account && email) u.account = email;
    if (!u.nickname) u.nickname = u.account ? String(u.account).split("@")[0] : ("用户" + String(uid).slice(-4));
    if (!u.regTime) u.regTime = Date.now();
    if (!u.avatarEmoji) u.avatarEmoji = "🙂";
    if (u.avatarColor === undefined) u.avatarColor = Math.floor(Math.random() * 8);
    if (!u.signature) u.signature = "这个人很懒，什么都没写";
    if (!u.gender) u.gender = "保密";
    return u;
  }
  function buildNext(kvData, uid, profile, localDb, soc, email) {
    const data = kvData || {};
    const next = {
      users: [],
      friends: soc.friends,
      friendReqs: soc.friendReqs,
      chats: soc.chats,
      moments: soc.moments,
      socialMeta: soc.socialMeta,
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
    // 本人资料以云端为准，但保留本机字段；密码只存云端，合并时绝不写回本地。
    if (profile || local) {
      const merged = Object.assign({}, local || {}, profile || {}, { id: uid });
      delete merged.password;   // 下行合并不得复活本地旧密码 / 云端可能残留的 password
      decorateUser(merged, uid, email);
      next.users.push(merged);
      seen[uid] = 1;
    }
    (localDb.users || []).forEach(u => {
      if (u && u.id && !seen[u.id]) {
        const kept = Object.assign({}, u);
        delete kept.password;   // 本地其它账号同样不落密码
        next.users.push(kept);
        seen[u.id] = 1;
      }
    });
    if (!next.users.some(u => u && u.id === uid)) {
      // 兜底档案：云端无数据且本机无此用户（如换设备首次登录且云端资料缺失）。
      // 必须补齐默认字段，否则会落一个只有 id 的空壳用户进本地库。
      const fallback = decorateUser(Object.assign({}, (localUser() || {}), { id: uid }), uid, email);
      delete fallback.password; // 兜底档案也不落密码
      next.users.unshift(fallback);
    }
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
  let firstChangeAt = 0;   // 本轮连续改动的起始时间，用于硬超时兜底
  function onLocalChange() {
    if (applying || !isLinked() || !Cloud.isConfigured()) return;
    if (timer) clearTimeout(timer);
    if (!firstChangeAt) firstChangeAt = Date.now();
    const wait = Math.min(DEBOUNCE, Math.max(0, DEBOUNCE - (Date.now() - firstChangeAt)));
    timer = setTimeout(() => {
      timer = null;
      firstChangeAt = 0;
      pushAll();
    }, wait);
  }

  async function pushAll(force) {
    if (!isLinked() || !Cloud.isConfigured()) return false;
    if (flushing) { pendingAgain = true; return false; }
    const db = Store.getSnapshot();
    const h = snapshotHash(db);
    if (!force && h === lastHash) return true;
    flushing = true;
    setStatus("syncing");
    const now = Date.now();
    const kvOk = await Cloud.push(cloudUid, buildPayload(cloudUid, db), now);
    let socOk = true;
    try { socOk = await Cloud.pushSocial(socialRecords(db)); } catch (e) { socOk = false; }
    const ok = kvOk && socOk;
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
  // 返回社交集合本次是否被云端数据改变（用于决定是否需要回推）
  async function adopt(payload, uid, socialRows) {
    applying = true;
    try {
      const localDb = Store.getSnapshot();
      const soc = mergeSocial(socialRows || [], localDb);
      // 尝试从云端会话取邮箱，给骨架档案补上账号/昵称（取不到不影响主流程）
      let email = "";
      try { email = await Cloud.getEmail(); } catch (e) { /* ignore */ }
      const next = buildNext(payload && payload.kv, uid, payload && payload.profile, localDb, soc, email);
      Store.beginRemoteApply();
      try {
        Store.applyRemote(next, { keepSession: false });
      } finally {
        Store.endRemoteApply();
      }
      lastHash = snapshotHash(Store.getSnapshot());
      return soc.changed;
    } finally {
      applying = false;
    }
  }

  // 拉取云端社交记录（失败按“无社交数据”处理，不阻断个人数据同步）
  async function pullSocialSafe() {
    try {
      const rows = await Cloud.pullSocial();
      return rows || [];
    } catch (e) { return []; }
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
      const social = await pullSocialSafe();
      const hasRemote = !!(remote && remote.payload);
      if (hasRemote) {
        await adopt(remote.payload, uid, social);
        const at = Number(remote.updatedAt) || Date.now();
        writeLS(SYNC_KEY, String(at));
        link(uid);
        setStatus("ok");
        return { ok: true, adopted: true };
      }
      // 云端没有个人数据：并入云端已有的社交记录，并建立本地登录会话，
      // 再把本地这份首传到云端。此处必须走 adopt，否则登录成功却没有本地会话，
      // 页面跳转后会因 currentUser() 为空被踢回登录页。
      link(uid);
      await adopt(null, uid, social);
      const ok = await pushAll(true);
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
    const social = await pullSocialSafe();

    const remoteAt = Number(remote.updatedAt) || 0;
    const localAt = Number(readLS(SYNC_KEY)) || 0;
    if (remoteAt > localAt) {
      const socialChanged = await adopt(remote.payload, cloudUid, social);
      writeLS(SYNC_KEY, String(remoteAt));
      setStatus("ok");
      if (socialChanged) await pushAll(true);   // 合并进来的本地记录回推云端
      return true;
    }
    // 个人数据以本地为准，但社交记录要按 LWW 合并（可能是另一台设备新增的）
    if (!social.length) return await pushAll();
    const socialChanged = await adopt(null, cloudUid, social);
    return await pushAll(socialChanged);
  }

  /* ---------- 页面启动：恢复上次的链接并同步 ---------- */
  async function boot() {
    if (!Cloud.isConfigured()) { setStatus("off"); return; }
    // ensureReady：初始化失败可重试（配合 cloud.js 热修），避免网络抖动一次就永久 off
    const ok = await Cloud.ensureReady();
    if (!ok) { setStatus("off"); return; }
    const cu = await Cloud.getUid();
    const saved = readLS(LINK_KEY);
    if (cu && (cu === saved || cu === localUid())) {
      link(cu);
      await syncNow();
      startPolling();
    } else if (!cu) {
      setStatus("idle");
    }
  }

  /* ---------- 自动同步：切回前台立即同步 + 定时轮询下拉 ----------
     让另一端改个人信息后，本机能尽快感知（LWW：无变化则零成本）。 */
  let pollTimer = null;
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => { syncNow(); }, POLL_MS);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
  }
  function onVis() {
    if (document.visibilityState === "visible") syncNow();
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("focus", onVis);
  }

  return {
    onLocalChange, enter, syncNow, boot, reset,
    startPolling, stopPolling,
    isLinked, getStatus, linkedUid,
    getLastSyncAt: () => Number(readLS(SYNC_KEY)) || 0,
    KV_KEYS,
  };
})();