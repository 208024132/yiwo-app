/* ============================================================
   以我APP · 数据中心（IndexedDB 持久化 + 内存镜像）
   用户端与管理后台共用同一份数据。
   所有页面通过 window.Store 读写数据，不要直接操作存储层。

   存储设计（本次把持久化介质从 localStorage 换成 IndexedDB）：
   1. 权威数据存放在 IndexedDB（yiwo-db / kv / state 单条记录），
      容量远大于 localStorage，不再因 5MB 上限静默丢数据；
   2. 运行期在内存维护一份 db 镜像，Store 的所有方法同步读写它，
      因此页面里 Store.listTasks(uid) 这类同步调用无需任何改动；
   3. 内存镜像变更后 debounce 350ms 异步落盘；
      切后台（visibilitychange）与离开页面（pagehide）立即 flush；
   4. IndexedDB 只能异步读取，而页面脚本是同步执行的
      （如 UserShell.boot 里同步调用 Store.currentUser() 做登录守卫），
      为保证首屏拿到正确数据，额外维护一份 localStorage 引导快照
      （yiwo_boot_v1）—— 它只是启动加速缓存，不是数据源，写失败可容忍；
   5. 老版本数据（localStorage 的 yiwo_db_v2）在首次启动时自动迁移进
      IndexedDB，确认写库成功后才删除旧那份，迁移失败则保留不动。
   ============================================================ */
window.Store = (() => {
  const pad = n => (n < 10 ? "0" + n : "" + n);
  const dayStr = off => {
    const d = new Date();
    d.setDate(d.getDate() + off);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const ts = (off, hm) => {
    const [h, m] = hm.split(":").map(Number);
    const d = new Date();
    d.setDate(d.getDate() + off);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };

  /* ---------- 存储常量 ---------- */
  const LS_KEY = "yiwo_db_v2";      // 老版本 localStorage 业务数据：仅在迁移时读取，迁移成功后删除
  const BOOT_KEY = "yiwo_boot_v1";  // 同步引导快照（启动加速缓存，非数据源）
  const BOOT_BUDGET = 3.5 * 1024 * 1024; // 引导快照体积上限（字符数），超出则剔除图片后写入
  const CACHE_THROTTLE = 800;       // 引导快照同步写入的最小间隔（ms）
  const FLUSH_DELAY = 350;          // 内存镜像落盘 debounce（ms）
  const IDB_NAME = "yiwo-db";       // IndexedDB 库名
  const IDB_STORE = "kv";           // IndexedDB 对象仓库名
  const IDB_KEY = "state";          // 整份 db 对应的固定 key
  const IDB_VERSION = 1;            // 库版本（结构变更时递增）
  const IMG_MARK = "yiwo-idb:";     // 引导快照里图片的占位标记（形如 yiwo-idb:m:p1:0）

  /* ---------- 常量配置 ---------- */
  const CATS = [
    { key: "food", name: "餐饮", e: "🍜" },
    { key: "traffic", name: "交通", e: "🚌" },
    { key: "shopping", name: "购物", e: "🛍️" },
    { key: "fun", name: "娱乐", e: "🎮" },
    { key: "home", name: "居住", e: "🏠" },
    { key: "medical", name: "医疗", e: "💊" },
    { key: "income", name: "收入", e: "💰" },
    { key: "other", name: "其他", e: "📦" },
  ];
  const SPORTS = [
    { key: "run", name: "跑步", e: "🏃" },
    { key: "walk", name: "步行", e: "🚶" },
    { key: "ride", name: "骑行", e: "🚴" },
    { key: "gym", name: "健身", e: "🏋️" },
    { key: "swim", name: "游泳", e: "🏊" },
    { key: "yoga", name: "瑜伽", e: "🧘" },
  ];
  const PERMS = [
    { key: "users", name: "用户管理" },
    { key: "layout", name: "页面布局管理" },
    { key: "admins", name: "管理员管理" },
  ];
  const REGIONS = ["广东·深圳", "广东·广州", "北京", "上海", "浙江·杭州", "四川·成都", "湖北·武汉", "江苏·南京", "福建·厦门", "山东·青岛"];

  /* 资产账户类型与分组（用于「总资产」） */
  const WALLET_TYPES = [
    { key: "wx", name: "微信", e: "💬" },
    { key: "alipay", name: "支付宝", e: "🅰️" },
    { key: "bank", name: "银行", e: "🏦" },
  ];
  const WALLET_GROUPS = [
    { key: "pay", name: "微信 & 支付宝", types: ["wx", "alipay"] },
    { key: "bank", name: "银行", types: ["bank"] },
  ];
  function seedWallets() {
    return {};
  }
  function seedDebts() {
    return {};
  }

  /* ---------- 前端功能配置（后台「页面布局管理」可改） ----------
     featureCatalog   ：每个功能的元数据（文字 / emoji / SVG 图标名 / 渐变色 / 跳转）
     featureSurfaces  ：各展示位的顺序与显隐（数组顺序即展示顺序）
     titles           ：页面小标题与顶栏标题
     注意：图标分两套 —— e 为宫格用 emoji，ico 为 Tab/侧边栏用 UI.PATH 图标名。 */
  const FEATURE_CATALOG = {
    accounting: { name: "记账", e: "💰", ico: "wallet", g: "linear-gradient(135deg,#f2994a,#ef5e47)", href: "accounting.html" },
    fitness: { name: "健身打卡", e: "🔥", ico: "flame", g: "linear-gradient(135deg,#f76f8e,#b23a6e)", href: "fitness.html" },
    tasks: { name: "任务进度", e: "🎯", ico: "target", g: "linear-gradient(135deg,#56ccf2,#2f80ed)", href: "tasks.html" },
    memo: { name: "备忘录", e: "📝", ico: "memo", g: "linear-gradient(135deg,#9b6cf7,#5f3dcf)", href: "memo.html" },
    bookshelf: { name: "阅读书架", e: "📚", ico: "book", g: "linear-gradient(135deg,#48c6c0,#1f8a8a)", href: "bookshelf.html" },
    moments: { name: "我的动态", e: "✨", ico: "sparkles", g: "linear-gradient(135deg,#f2c94c,#f2994a)", href: "moments.html" },
    profile: { name: "个人信息", e: "👤", ico: "user", g: "linear-gradient(135deg,#f2994a,#ef5e47)", href: "profile.html" },
    theme: { name: "主题皮肤", e: "🎨", ico: "palette", g: "", href: "theme.html" },
    backup: { name: "数据备份", e: "🛡️", ico: "shield", g: "", href: "" },
    about: { name: "关于以我", e: "ℹ️", ico: "info", g: "", href: "" },
    home: { name: "首页", e: "", ico: "home", g: "", href: "index.html" },
    friends: { name: "好友", e: "", ico: "users", g: "", href: "friends.html" },
    assets: { name: "资产", e: "", ico: "wallet", g: "", href: "assets.html" },
    my: { name: "我的", e: "", ico: "user", g: "", href: "my.html" },
  };
  const FEATURE_SURFACES = {
    tab: ["home", "friends", "assets", "my"],
    home: ["accounting", "fitness", "tasks", "memo", "bookshelf", "moments"],
    my: ["moments", "bookshelf", "memo", "fitness", "tasks", "profile"],
    mylist: ["theme", "backup", "about"],
    sidenav: ["accounting", "fitness", "tasks", "memo", "bookshelf", "moments"],
  };
  const SURFACE_NAMES = {
    tab: "底部 Tab",
    home: "首页宫格",
    my: "我的宫格",
    mylist: "我的列表",
    sidenav: "电脑端侧边栏",
  };
  const TITLE_DEFS = {
    "home.quick": "快捷功能",
    "home.moments": "好友动态",
    "home.tasks": "今日任务",
    "assets.trend": "近 7 日支出",
    "assets.cat": "支出分类",
    "assets.recent": "最近记录",
    "fitness.today": "今日打卡",
    "fitness.days": "近 14 天",
    "fitness.calendar": "打卡日历",
    "friend.moments": "TA 的动态",
    "addFriend.result": "搜索结果",
    "addFriend.recommend": "推荐用户",
    "page.accounting": "记账",
    "page.fitness": "健身打卡",
    "page.tasks": "任务进度",
    "page.memo": "备忘录",
    "page.bookshelf": "阅读书架",
    "page.moments": "我的动态",
    "page.profile": "个人信息",
    "page.friends": "好友",
    "page.assets": "资产",
    "page.my": "我的",
    "page.theme": "主题",
    "page.addFriend": "添加好友",
  };
  const FEATURE_FIELDS = ["name", "e", "ico", "g", "href"];
  function defaultCatalog() { return JSON.parse(JSON.stringify(FEATURE_CATALOG)); }
  function defaultSurfaces() {
    const out = {};
    Object.keys(FEATURE_SURFACES).forEach(k => { out[k] = FEATURE_SURFACES[k].map(key => ({ key, visible: true })); });
    return out;
  }
  function defaultTitles() { return Object.assign({}, TITLE_DEFS); }
  /* 补齐 settings 中功能配置相关的缺失键（老数据 / 导入备份后调用），返回是否有变更 */
  function ensureSettings() {
    if (!db.settings || typeof db.settings !== "object") db.settings = {};
    const s = db.settings;
    let changed = false;
    if (!s.featureCatalog || typeof s.featureCatalog !== "object") { s.featureCatalog = defaultCatalog(); changed = true; }
    else {
      Object.keys(FEATURE_CATALOG).forEach(key => {
        if (!s.featureCatalog[key]) { s.featureCatalog[key] = Object.assign({}, FEATURE_CATALOG[key]); changed = true; }
      });
    }
    if (!s.featureSurfaces || typeof s.featureSurfaces !== "object") { s.featureSurfaces = defaultSurfaces(); changed = true; }
    else {
      Object.keys(FEATURE_SURFACES).forEach(surface => {
        if (!Array.isArray(s.featureSurfaces[surface])) { s.featureSurfaces[surface] = FEATURE_SURFACES[surface].map(key => ({ key, visible: true })); changed = true; }
      });
    }
    if (!s.titles || typeof s.titles !== "object") { s.titles = defaultTitles(); changed = true; }
    return changed;
  }

  /* ---------- 种子数据 ---------- */
  function seed() {
    // 出厂不预置任何注册用户（原演示用户 u10001~u10010 已全部清除）
    const users = [];

    // 无用户即无好友关系 / 好友请求 / 聊天 / 动态
    const friends = [];
    const friendReqs = [];

    const chats = [];

    const moments = [];

    // 用户数据一律为空（新注册用户从零开始）
    const accounts = {};

    const books = {
      recommend: [
        { id: "b1", title: "人类简史", author: "尤瓦尔·赫拉利", tag: "历史", desc: "从认知革命到人工智能，重新理解人类。", g: "linear-gradient(135deg,#5b6abf,#30336b)" },
        { id: "b2", title: "百年孤独", author: "加西亚·马尔克斯", tag: "文学", desc: "魔幻现实主义的巅峰之作。", g: "linear-gradient(135deg,#c05621,#7b341e)" },
        { id: "b3", title: "小王子", author: "圣埃克苏佩里", tag: "童话", desc: "所有大人最初都是孩子。", g: "linear-gradient(135deg,#f6ad55,#dd6b20)" },
        { id: "b4", title: "三体", author: "刘慈欣", tag: "科幻", desc: "给岁月以文明，而不是给文明以岁月。", g: "linear-gradient(135deg,#2c5282,#1a365d)" },
        { id: "b5", title: "被讨厌的勇气", author: "岸见一郎", tag: "心理", desc: "一切烦恼都来自人际关系。", g: "linear-gradient(135deg,#48bb78,#276749)" },
        { id: "b6", title: "活着", author: "余华", tag: "小说", desc: "人是为了活着本身而活着。", g: "linear-gradient(135deg,#9b2c2c,#5f1b1b)" },
      ],
      shelf: {},
    };

    const memos = {};
    const fitness = {};
    const tasks = {};

    // 仅保留 1 个引导超级管理员：用于首次进入后台（进去后可自行改密、改名、新增管理员）
    const admins = [
      { id: "ad1", account: "admin@yiwo.com", password: "888888", name: "陈以我", phone: "13800001111", dept: "产品部",
        idcard: "4403**********1234", perms: ["users", "layout", "admins"], role: "超级管理员", t: ts(-50, "09:00") },
    ];

    return {
      users, friends, friendReqs, chats, moments, accounts, books, memos, fitness, tasks, admins,
      wallets: seedWallets(),
      debts: seedDebts(),
      customCats: {},
      order: {},
      groups: {},
      friendGroup: {},
      friendNav: {},
      remark: {},
      chatHidden: {},
      settings: {
        appName: "以我",
        homeGreeting: "你好，{nickname} 👋",
        tabLabels: ["首页", "好友", "资产", "我的"],
        gridCols: 3,
        homeModules: { banner: true, stats: true, moments: true, tasks: true },
        banners: [
          { id: "banner1", text: "欢迎使用以我 App · 记录每一天的自己", tone: "grad" },
        ],
        defaultTheme: "red",
        featureCatalog: defaultCatalog(),
        featureSurfaces: defaultSurfaces(),
        titles: defaultTitles(),
      },
      session: null,
      seq: 1,
    };
  }

  /* ============================================================
     IndexedDB 极简封装（原生 API，Promise 化，零第三方依赖）
     ============================================================ */
  const IDB = {
    conn: null,     // 已打开的数据库连接，复用避免重复 open
    failed: false,  // 打开失败后不再重试，降级为「内存 + localStorage 快照」

    /** 打开数据库，返回 Promise<IDBDatabase> */
    open() {
      if (this.conn) return Promise.resolve(this.conn);
      if (this.failed || typeof indexedDB === "undefined" || !indexedDB) {
        return Promise.reject(new Error("IndexedDB 不可用"));
      }
      return new Promise((resolve, reject) => {
        let req;
        try {
          req = indexedDB.open(IDB_NAME, IDB_VERSION);
        } catch (e) {
          this.failed = true;
          reject(e);
          return;
        }
        req.onupgradeneeded = () => {
          const database = req.result;
          if (!database.objectStoreNames.contains(IDB_STORE)) database.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => {
          this.conn = req.result;
          // 其他标签页升级版本时关闭当前连接，下次操作自动重开
          this.conn.onversionchange = () => { this.conn.close(); this.conn = null; };
          resolve(this.conn);
        };
        req.onerror = () => {
          this.failed = true;
          reject(req.error || new Error("IndexedDB 打开失败"));
        };
        req.onblocked = () => { /* 有其他标签页占用旧版本，等待其释放即可 */ };
      });
    },

    /** 读取整份 db；库为空返回 null */
    get() {
      return this.open().then(conn => new Promise((resolve, reject) => {
        const tx = conn.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error("IndexedDB 读取失败"));
      }));
    },

    /** 写入整份 db；返回 Promise<boolean> */
    set(value) {
      return this.open().then(conn => new Promise((resolve, reject) => {
        let tx;
        try {
          tx = conn.transaction(IDB_STORE, "readwrite");
        } catch (e) {
          reject(e);
          return;
        }
        tx.objectStore(IDB_STORE).put(value, IDB_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error("IndexedDB 写入失败"));
        tx.onabort = () => reject(tx.error || new Error("IndexedDB 写入被中止"));
      }));
    },
  };

  /* ============================================================
     错误上报
     注意：store.js 在页面中早于 ui.js 加载，模块顶层绝不能同步调用
     UI.toast，否则 ReferenceError。这里先 console.error，UI 就绪后
     （DOMContentLoaded，此时 ui.js 已执行完）再统一弹出提示。
     ============================================================ */
  const pendingToasts = [];
  function reportError(msg, err) {
    if (err) console.error("[Store] " + msg, err);
    else console.error("[Store] " + msg);
    if (window.UI && typeof UI.toast === "function") {
      try { UI.toast(msg, "error"); return; } catch (e) { /* ignore */ }
    }
    if (pendingToasts.indexOf(msg) < 0) pendingToasts.push(msg);
  }
  function drainToasts() {
    while (pendingToasts.length) {
      const msg = pendingToasts.shift();
      try { if (window.UI && typeof UI.toast === "function") UI.toast(msg, "error"); } catch (e) { /* ignore */ }
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", drainToasts);
  } else {
    drainToasts();
  }

  /* ============================================================
     同步引导快照（仅用于启动首帧，非数据源）
     IndexedDB 只能异步读，而 UserShell.boot / 页面脚本都是同步调用
     Store（登录守卫更是同步判断 Store.currentUser()），因此必须有
     一份可同步读取的镜像，否则首屏会拿到种子数据甚至被判为未登录。
     ============================================================ */
  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const v = JSON.parse(raw);
      return v && typeof v === "object" ? v : null;
    } catch (e) {
      return null;
    }
  }
  function tryStringify(v) {
    try { return JSON.stringify(v); } catch (e) { return null; }
  }
  /**
   * 剔除大体积图片后的副本，图片位置换成可回溯的占位标记。
   * 只针对 users / moments 做浅拷贝改写，不做整份深拷贝，避免大数据量下的卡顿。
   */
  function slimClone(src) {
    try {
      const out = {};
      Object.keys(src).forEach(k => { out[k] = src[k]; });
      out.users = (src.users || []).map(u =>
        u && u.avatarImg ? Object.assign({}, u, { avatarImg: IMG_MARK + "u:" + u.id }) : u);
      out.moments = (src.moments || []).map(m => {
        if (!m || !m.photos || !m.photos.length) return m;
        return Object.assign({}, m, {
          photos: m.photos.map((p, i) =>
            p && p.src ? Object.assign({}, p, { src: IMG_MARK + "m:" + m.id + ":" + i }) : p),
        });
      });
      return out;
    } catch (e) {
      return null;
    }
  }
  let cacheOversize = false;   // 上一次已知整份快照超预算，跳过重复 stringify
  let cacheWarned = false;     // 快照写失败只提示一次，避免刷屏
  function bootCacheJSON() {
    if (!cacheOversize) {
      const full = tryStringify(db);
      if (full !== null && full.length <= BOOT_BUDGET) return full;
      cacheOversize = true;
    }
    const slim = slimClone(db);
    return slim === null ? null : tryStringify(slim);
  }
  let lastCacheWrite = 0;
  function writeBootCache() {
    lastCacheWrite = Date.now();
    const json = bootCacheJSON();
    if (json === null) { warnCache(); return false; }
    try {
      localStorage.setItem(BOOT_KEY, json);
      return true;
    } catch (e) {
      // 超出 localStorage 配额：改为写入剔图快照再试一次
      const slim = slimClone(db);
      const slimJson = slim === null ? null : tryStringify(slim);
      if (slimJson !== null && slimJson !== json) {
        try { localStorage.setItem(BOOT_KEY, slimJson); cacheOversize = true; warnCache(); return true; }
        catch (e2) { /* 仍然失败，放弃快照 */ }
      }
      try { localStorage.removeItem(BOOT_KEY); } catch (e2) { /* ignore */ }
      warnCache();
      return false;
    }
  }
  function warnCache() {
    if (cacheWarned) return;
    cacheWarned = true;
    reportError("本地缓存写入失败，数据已存入数据库；启动可能稍慢", null);
  }
  /** 引导快照来自剔图版本时，数据就绪后把页面上的图片补回去 */
  function patchDeferredImages() {
    try {
      const imgs = document.querySelectorAll('img[src^="' + IMG_MARK + '"]');
      Array.prototype.forEach.call(imgs, img => {
        const spec = String(img.getAttribute("src") || "").slice(IMG_MARK.length).split(":");
        let real = null;
        if (spec[0] === "u") {
          const u = (db.users || []).find(x => x.id === spec[1]);
          real = u && u.avatarImg && String(u.avatarImg).indexOf(IMG_MARK) !== 0 ? u.avatarImg : null;
        } else if (spec[0] === "m") {
          const m = (db.moments || []).find(x => x.id === spec[1]);
          const p = m && m.photos ? m.photos[Number(spec[2])] : null;
          real = p && p.src && String(p.src).indexOf(IMG_MARK) !== 0 ? p.src : null;
        }
        if (real) img.setAttribute("src", real);
      });
    } catch (e) { /* ignore */ }
  }

  /* ============================================================
     加载：同步引导（快照 > 老 localStorage 数据 > 种子） + 异步接管
     ============================================================ */
  let db;
  let bootSource = "seed";  // cache | legacy | seed
  let dirty = false;
  let bootDb = null;        // 首帧引导快照对象（可能含剔图占位符），用于接管后补齐旧引用

  (function loadSync() {
    const cache = readJSON(BOOT_KEY);
    if (cache && Array.isArray(cache.users)) { db = cache; bootDb = cache; bootSource = "cache"; return; }
    // 迁移：老版本 localStorage 里的数据，读进来后由 hydrate() 写入 IndexedDB
    const legacy = readJSON(LS_KEY);
    if (legacy && Array.isArray(legacy.users)) { db = legacy; bootSource = "legacy"; return; }
    db = seed();
    bootSource = "seed";
  })();

  /* 旧数据补齐新增字段（老数据 / 导入备份 / 异步接管后都会调用） */
  function normalizeDb() {
    ["remark", "chatHidden", "groups", "friendGroup", "friendNav"].forEach(k => {
      if (!db[k]) { db[k] = {}; dirty = true; }
    });
    if (!db.wallets) { db.wallets = seedWallets(); dirty = true; }
    if (!db.debts) { db.debts = seedDebts(); dirty = true; }
    if (!db.customCats) { db.customCats = {}; dirty = true; }
    if (ensureSettings()) dirty = true;
    // 迁移：早期版本为用户预置了「与默认完全相同」的宫格顺序，会遮蔽后台默认顺序，这里清理掉
    if (db.order) {
      const DEF_ORDER = ["moments", "bookshelf", "memo", "fitness", "tasks", "profile"];
      Object.keys(db.order).forEach(k => {
        const a = db.order[k];
        if (Array.isArray(a) && a.length === DEF_ORDER.length && a.every((v, i) => v === DEF_ORDER[i])) { delete db.order[k]; dirty = true; }
      });
    }
    return dirty;
  }
  normalizeDb();

  /* ============================================================
     持久化：内存镜像 -> IndexedDB（debounce） + 引导快照（同步/节流）
     ============================================================ */
  let flushTimer = null;
  let lastSessionJson = "";
  let hydrating = true;   // 异步接管是否尚未完成（完成前禁止落盘）
  let pendingWrites = false; // 接管完成前是否发生过写操作（有则不丢弃，见 hydrate）

  /** 安排一次异步落盘（debounce 350ms） */
  function scheduleFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushNow();
    }, FLUSH_DELAY);
  }

  /** 立即落盘：同步写引导快照 + 异步写 IndexedDB */
  function flushNow() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    // 异步接管完成前禁止落盘，否则种子占位数据会把 IndexedDB 里的真实数据覆盖掉
    if (hydrating) { dirty = true; pendingWrites = true; return Promise.resolve(false); }
    dirty = false;
    lastSessionJson = tryStringify(db.session || null) || "";
    writeBootCache();
    return IDB.set(db).then(() => true).catch(err => {
      reportError("数据保存失败，请检查浏览器存储空间或隐私设置", err);
      return false;
    });
  }

  /** 会话变化时立刻写快照（登录/退出后马上跳转页面也保证不丢），否则按节流写入 */
  function maybeWriteBootCache() {
    if (hydrating) return;
    const sessionJson = tryStringify(db.session || null) || "";
    const now = Date.now();
    if (sessionJson !== lastSessionJson || now - lastCacheWrite >= CACHE_THROTTLE) {
      lastSessionJson = sessionJson;
      writeBootCache();
    }
  }
  /** 接管完成前发生的写操作：记录到 pendingWrites，由 hydrate 决定如何处理 */
  function notePendingWrite() { if (hydrating) pendingWrites = true; }

  /** 数据变更入口：所有业务方法写完内存后调用它 */
  function persist() {
    dirty = true;
    notePendingWrite();
    scheduleFlush();
    maybeWriteBootCache();
  }
  function save() { persist(); }

  /* 切后台 / 离开页面：立即 flush，避免丢掉最后一次操作 */
  function flushOnLeave() {
    try { flushNow(); } catch (e) { /* ignore */ }
  }
  window.addEventListener("pagehide", flushOnLeave);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnLeave();
  });

  /* ============================================================
     异步接管：用 IndexedDB 的权威数据覆盖内存镜像
     ============================================================ */
  /** 写入 IndexedDB，成功后清除老版本 localStorage 数据（严禁先删后写） */
  function writeToIdb() {
    return IDB.set(db).then(() => {
      try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
      return true;
    });
  }

  /**
   * 极少数场景（引导快照缺失且 IndexedDB 有数据）下，首帧用的是种子占位数据。
   * 数据就绪后写一份快照并重载一次，让页面展示真实数据；
   * 快照写不进去就不重载，避免死循环；同一标签页最多重载一次。
   */
  function reloadOnceAfterColdBoot() {
    try {
      if (sessionStorage.getItem("yiwo_cold_reload") === "1") return;
    } catch (e) { return; }
    if (!writeBootCache()) return;
    try { sessionStorage.setItem("yiwo_cold_reload", "1"); } catch (e) { /* ignore */ }
    try { location.reload(); } catch (e) { /* ignore */ }
  }

  /**
   * 引导快照在超预算时会被剔图（头像/动态图换成 yiwo-idb: 占位符），
   * 页面脚本此时可能已经持有这些旧对象引用。接管到真实数据后，
   * 只把占位符就地回填成真实图片，不覆盖其它字段（避免冲掉接管前的新改动）；
   * DOM <img> 的占位符由 patchDeferredImages 负责。
   */
  function reviveBootRefs(saved) {
    if (!bootDb || !saved) return;
    const isPh = v => typeof v === "string" && v.indexOf(IMG_MARK) === 0;
    const oldUsers = bootDb.users, newUsers = saved.users;
    if (Array.isArray(oldUsers) && Array.isArray(newUsers)) {
      newUsers.forEach(n => {
        if (!n || n.id == null) return;
        const o = oldUsers.find(x => x && x.id === n.id);
        if (o && o !== n && isPh(o.avatarImg) && !isPh(n.avatarImg)) o.avatarImg = n.avatarImg;
      });
    }
    const oldMoments = bootDb.moments, newMoments = saved.moments;
    if (Array.isArray(oldMoments) && Array.isArray(newMoments)) {
      newMoments.forEach(n => {
        if (!n || n.id == null || !Array.isArray(n.photos)) return;
        const o = oldMoments.find(x => x && x.id === n.id);
        if (!o || o === n || !Array.isArray(o.photos)) return;
        n.photos.forEach((np, i) => {
          const op = o.photos[i];
          if (op && np && isPh(op.src) && !isPh(np.src)) op.src = np.src;
        });
      });
    }
  }

  function hydrate() {
    return IDB.get().then(saved => {
      if (saved && Array.isArray(saved.users)) {
        // 库里已有数据：默认以 IndexedDB 为准覆盖内存。
        // 例外：本页首帧就是真实数据（快照/老数据）且用户已经在接管前改过，
        // 此时内存里的才是最新意图，保留内存并回写，避免丢掉这次操作。
        const usedPlaceholder = bootSource === "seed";
        reviveBootRefs(saved);
        if (!(pendingWrites && !usedPlaceholder)) db = saved;
        bootDb = null;
        hydrating = false;
        pendingWrites = false;
        normalizeDb();
        if (dirty) flushNow(); else writeBootCache();
        patchDeferredImages();
        window.dispatchEvent(new CustomEvent("yiwo:store-ready", { detail: { source: "idb" } }));
        if (usedPlaceholder) reloadOnceAfterColdBoot();
        return;
      }
      // 库为空：迁移老数据或播种新数据（db 已是最终值，可以安全落盘）
      bootDb = null;
      hydrating = false;
      pendingWrites = false;
      if (bootSource === "legacy") {
        return writeToIdb().then(() => {
          writeBootCache();
          patchDeferredImages();
          window.dispatchEvent(new CustomEvent("yiwo:store-ready", { detail: { source: "migrated" } }));
        }).catch(err => {
          // 写库失败：保留 localStorage 老数据不删，下次启动重试迁移
          reportError("数据迁移失败，已保留原有本地数据，请刷新页面重试", err);
          writeBootCache();
        });
      }
      writeBootCache();
      return writeToIdb().catch(err => {
        reportError("本地数据库写入失败，数据可能不会被保存", err);
      });
    }).catch(err => {
      // IndexedDB 不可用（隐私模式 / 浏览器不支持）：降级为内存 + localStorage 快照
      bootDb = null;
      hydrating = false;
      pendingWrites = false;
      reportError("本地数据库不可用，已降级为浏览器本地缓存存储", err);
      writeBootCache();
    });
  }

  /* ---------- 会话与用户 ---------- */
  function currentUser() {
    if (db.session && db.session.type === "user") {
      return db.users.find(u => u.id === db.session.uid) || null;
    }
    return null;
  }
  function currentAdmin() {
    if (db.session && db.session.type === "admin") {
      return db.admins.find(a => a.id === db.session.aid) || null;
    }
    return null;
  }
  function login(account, password) {
    const u = db.users.find(x => x.account === String(account).trim());
    if (!u) return { ok: false, msg: "账号不存在" };
    if (u.password !== password) return { ok: false, msg: "密码不正确" };
    db.session = { type: "user", uid: u.id };
    persist();
    flushNow();
    return { ok: true, user: u };
  }
  function register({ account, password, nickname }) {
    account = String(account || "").trim();
    if (!/^[a-zA-Z0-9._%+-]+@qq\.com$/.test(account)) return { ok: false, msg: "请使用 QQ 邮箱注册（xxx@qq.com）" };
    if (db.users.some(u => u.account === account)) return { ok: false, msg: "该邮箱已注册" };
    const id = "u" + Date.now().toString().slice(-8);
    const user = {
      id, account, password, nickname: nickname || account.split("@")[0], avatarEmoji: "🙂",
      avatarColor: Math.floor(Math.random() * 8), signature: "这个人很懒，什么都没写",
      phone: "", age: 0, gender: "保密", birthday: "", region: "广东·深圳",
      privacyDefault: "friends", regTime: Date.now(),
    };
    db.users.push(user);
    db.session = { type: "user", uid: id };
    persist();
    flushNow();
    return { ok: true, user };
  }
  function logout() {
    db.session = null;
    persist();
    flushNow();
  }
  function updateProfile(uid, patch) {
    const u = db.users.find(x => x.id === uid);
    if (!u) return;
    Object.assign(u, patch);
    persist();
  }
  function getUser(id) { return db.users.find(u => u.id === id) || null; }
  function listUsers() {
    return [...db.users].sort((a, b) => b.regTime - a.regTime);
  }
  function filterUsers({ q = "", gender = "", region = "" } = {}) {
    q = q.trim().toLowerCase();
    return listUsers().filter(u => {
      if (gender && u.gender !== gender) return false;
      if (region && u.region !== region) return false;
      if (q) {
        const blob = [u.nickname, u.account, u.id, u.phone, u.signature, u.region, String(u.age)].join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }

  /* ---------- 好友 ---------- */
  function listFriends(uid) {
    return db.friends
      .filter(f => f.a === uid || f.b === uid)
      .map(f => ({ user: getUser(f.a === uid ? f.b : f.a), since: f.since }))
      .filter(x => x.user);
  }
  function isFriend(uid, fid) {
    if (uid === fid) return true;
    return db.friends.some(f => (f.a === uid && f.b === fid) || (f.a === fid && f.b === uid));
  }
  function pendingRequests(uid) {
    return db.friendReqs.filter(r => r.to === uid).map(r => ({ from: getUser(r.from), t: r.t }));
  }
  function sentRequests(uid) {
    return db.friendReqs.filter(r => r.from === uid).map(r => ({ to: getUser(r.to), t: r.t }));
  }
  function sendRequest(uid, targetId) {
    if (uid === targetId) return { ok: false, msg: "不能添加自己为好友" };
    if (isFriend(uid, targetId)) return { ok: false, msg: "你们已经是好友了" };
    const existed = db.friendReqs.some(r => r.from === uid && r.to === targetId);
    if (existed) return { ok: false, msg: "已发送过申请，等待对方通过" };
    db.friendReqs.push({ from: uid, to: targetId, t: Date.now() });
    persist();
    return { ok: true, msg: "好友申请已发送" };
  }
  function acceptRequest(uid, fromId) {
    const idx = db.friendReqs.findIndex(r => r.from === fromId && r.to === uid);
    if (idx >= 0) db.friendReqs.splice(idx, 1);
    if (!isFriend(uid, fromId)) db.friends.push({ a: uid, b: fromId, since: Date.now() });
    persist();
  }
  function rejectRequest(uid, fromId) {
    db.friendReqs = db.friendReqs.filter(r => !(r.from === fromId && r.to === uid));
    persist();
  }
  function deleteFriend(uid, fid) {
    db.friends = db.friends.filter(f => !((f.a === uid && f.b === fid) || (f.a === fid && f.b === uid)));
    if (db.friendGroup && db.friendGroup[uid]) delete db.friendGroup[uid][fid];
    if (db.remark && db.remark[uid]) delete db.remark[uid][fid];
    persist();
  }

  /* ---------- 对话 ---------- */
  function getMessages(uid, fid) {
    const c = db.chats.find(x => (x.a === uid && x.b === fid) || (x.a === fid && x.b === uid));
    return c ? c.msgs : [];
  }
  function getConversations(uid) {
    const hid = (db.chatHidden && db.chatHidden[uid]) || [];
    return listFriends(uid).map(f => {
      const msgs = getMessages(uid, f.user.id);
      return {
        user: f.user,
        last: msgs.length ? msgs[msgs.length - 1] : null,
        unread: msgs.filter(m => m.from === f.user.id && !m.read).length,
        hidden: hid.includes(f.user.id),
      };
    });
  }
  // 清空聊天内容，保留会话
  function clearChat(uid, fid) {
    const c = db.chats.find(x => (x.a === uid && x.b === fid) || (x.a === fid && x.b === uid));
    if (c) { c.msgs = []; persist(); }
  }
  // 删除会话：清空消息 + 从消息列表移除（好友关系保留）
  function deleteChat(uid, fid) {
    const c = db.chats.find(x => (x.a === uid && x.b === fid) || (x.a === fid && x.b === uid));
    if (c) c.msgs = [];
    if (!db.chatHidden) db.chatHidden = {};
    if (!db.chatHidden[uid]) db.chatHidden[uid] = [];
    if (!db.chatHidden[uid].includes(fid)) db.chatHidden[uid].push(fid);
    persist();
  }
  function sendMessage(uid, fid, text) {
    const msg = { id: "m" + Date.now(), from: uid, text, t: Date.now(), read: true };
    let c = db.chats.find(x => (x.a === uid && x.b === fid) || (x.a === fid && x.b === uid));
    if (!c) { c = { a: uid, b: fid, msgs: [] }; db.chats.push(c); }
    c.msgs.push(msg);
    // 有新消息则让会话重新出现在消息列表
    if (db.chatHidden && db.chatHidden[uid]) {
      db.chatHidden[uid] = db.chatHidden[uid].filter(x => x !== fid);
    }
    persist();
    return msg;
  }
  function markRead(uid, fid) {
    db.chats.forEach(c => {
      if ((c.a === uid && c.b === fid) || (c.a === fid && c.b === uid)) {
        c.msgs.forEach(m => { if (m.from === fid) m.read = true; });
      }
    });
    persist();
  }

  /* ---------- 动态 ---------- */
  function listMoments({ uid = null, scope = "friends" } = {}) {
    let list = [...db.moments].sort((a, b) => b.t - a.t);
    if (scope === "mine") list = list.filter(m => m.uid === uid);
    else if (scope === "photos") list = list.filter(m => m.uid === uid && m.photos && m.photos.length);
    else if (scope === "user") list = list.filter(m => m.uid === uid && m.privacy !== "private");
    else if (scope === "friends") {
      const fids = new Set([uid, ...listFriends(uid).map(f => f.user.id)]);
      list = list.filter(m => fids.has(m.uid) && (m.uid === uid || m.privacy !== "private"));
    } else if (scope === "all") list = list.filter(m => m.privacy === "public");
    return list;
  }
  function likeCount(mid) { /* 便捷计算由页面完成 */ }
  function toggleLike(mid, uid) {
    const m = db.moments.find(x => x.id === mid);
    if (!m) return { liked: false };
    const i = m.likes.indexOf(uid);
    if (i >= 0) m.likes.splice(i, 1);
    else m.likes.push(uid);
    persist();
    return { liked: i < 0 };
  }
  function addComment(mid, uid, text) {
    const m = db.moments.find(x => x.id === mid);
    if (!m) return;
    m.comments.push({ uid, text, t: Date.now() });
    persist();
  }
  function repost(mid, uid) {
    const orig = db.moments.find(x => x.id === mid);
    if (!orig) return;
    db.moments.push({
      id: "p" + Date.now(), uid, type: "repost", text: "",
      photos: [], orig: { id: orig.id, uid: orig.uid },
      privacy: getUser(uid).privacyDefault || "friends",
      likes: [], comments: [], reposts: 0, t: Date.now(),
    });
    orig.reposts = (orig.reposts || 0) + 1;
    persist();
  }
  function addMoment(uid, { text, photos = [], privacy } = {}) {
    const m = {
      id: "p" + Date.now(), uid, type: photos.length ? "photo" : "text", text,
      photos, privacy: privacy || getUser(uid).privacyDefault || "friends",
      likes: [], comments: [], reposts: 0, t: Date.now(),
    };
    db.moments.unshift(m);
    persist();
    return m;
  }
  function setMomentPrivacy(mid, uid, privacy) {
    const m = db.moments.find(x => x.id === mid);
    if (m && m.uid === uid) { m.privacy = privacy; persist(); return true; }
    return false;
  }
  // 删除自己的动态，返回被删对象（供撤销恢复）
  function delMoment(mid, uid) {
    const i = db.moments.findIndex(m => m.id === mid);
    if (i < 0) return null;
    if (uid && db.moments[i].uid !== uid) return null;
    const removed = db.moments.splice(i, 1)[0];
    if (removed.orig) {
      const o = db.moments.find(m => m.id === removed.orig.id);
      if (o) o.reposts = Math.max(0, (o.reposts || 0) - 1);
    }
    persist();
    return removed;
  }
  // 撤销删除动态
  function restoreMoment(m) {
    if (!m) return;
    db.moments.push(m);
    if (m.orig) {
      const o = db.moments.find(x => x.id === m.orig.id);
      if (o) o.reposts = (o.reposts || 0) + 1;
    }
    persist();
  }

  /* ---------- 资产账户（总资产） ---------- */
  function listWallets(uid) {
    return (db.wallets[uid] || []).slice().sort((a, b) => a.t - b.t);
  }
  function walletSummary(uid) {
    const list = listWallets(uid);
    let total = 0, liquid = 0;
    list.forEach(a => { total += a.balance; if (a.liquid) liquid += a.balance; });
    const groups = WALLET_GROUPS.map(g => ({
      key: g.key, name: g.name,
      items: list.filter(a => g.types.indexOf(a.type) >= 0),
    })).filter(g => g.items.length);
    const debts = listDebts(uid);
    const debt = debts.reduce((s, d) => s + d.amount, 0);
    return { total, liquid, frozen: total - liquid, count: list.length, groups, list, debts, debt, net: total - debt };
  }
  /* ---------- 负债 ---------- */
  function listDebts(uid) {
    return (db.debts[uid] || []).slice().sort((a, b) => a.t - b.t);
  }
  function addDebt(uid, { name, amount = 0 }) {
    const d = {
      id: "d" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: String(name || "").trim() || "新负债",
      amount: Number(amount) || 0, t: Date.now(),
    };
    if (!db.debts[uid]) db.debts[uid] = [];
    db.debts[uid].push(d);
    persist();
    return d;
  }
  function updateDebt(uid, id, patch) {
    const d = (db.debts[uid] || []).find(x => x.id === id);
    if (!d) return null;
    Object.assign(d, patch);
    persist();
    return d;
  }
  function delDebt(uid, id) {
    const list = db.debts[uid] || [];
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return null;
    const removed = list.splice(i, 1)[0];
    persist();
    return removed;
  }
  function restoreDebt(uid, d) {
    if (!d) return;
    if (!db.debts[uid]) db.debts[uid] = [];
    db.debts[uid].push(d);
    persist();
  }
  function addWallet(uid, { name, type = "bank", liquid = true, balance = 0 }) {
    const acc = {
      id: "w" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: String(name || "").trim() || "新账户",
      type, liquid: !!liquid, balance: Number(balance) || 0, t: Date.now(),
    };
    if (!db.wallets[uid]) db.wallets[uid] = [];
    db.wallets[uid].push(acc);
    persist();
    return acc;
  }
  function updateWallet(uid, id, patch) {
    const a = (db.wallets[uid] || []).find(x => x.id === id);
    if (!a) return null;
    Object.assign(a, patch);
    persist();
    return a;
  }
  function delWallet(uid, id) {
    const list = db.wallets[uid] || [];
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return null;
    const removed = list.splice(i, 1)[0];
    persist();
    return removed;
  }
  function restoreWallet(uid, acc) {
    if (!acc) return;
    if (!db.wallets[uid]) db.wallets[uid] = [];
    db.wallets[uid].push(acc);
    persist();
  }
  function adjustWallet(uid, id, delta) {
    const a = (db.wallets[uid] || []).find(x => x.id === id);
    if (a) a.balance = Number((a.balance + delta).toFixed(2));
  }

  /* ---------- 记账 ---------- */
  function listRecords(uid) {
    const r = (db.accounts[uid] || []).slice().sort((a, b) => b.t - a.t);
    return r;
  }
  // dir=1 应用记录影响；dir=-1 撤销记录影响（删除/撤销删除时使用）
  function applyRecord(uid, rec, dir) {
    const cash = rec.type === "in" ? 1 : -1; // 收入加钱；支出/还债扣钱
    if (rec.accId) adjustWallet(uid, rec.accId, dir * cash * rec.amount);
    if (rec.type === "repay" && rec.debtId) {
      const d = (db.debts[uid] || []).find(x => x.id === rec.debtId);
      if (d) d.amount = Number((d.amount - dir * rec.amount).toFixed(2));
    }
  }
  function addRecord(uid, { type, cat, amount, note = "", date, accId = null, debtId = null }) {
    const amt = Number(amount);
    const rec = { id: "a" + Date.now(), type, cat, amount: amt, note, date, accId: accId || null, debtId: debtId || null, t: Date.now() };
    if (!db.accounts[uid]) db.accounts[uid] = [];
    db.accounts[uid].push(rec);
    applyRecord(uid, rec, 1);
    persist();
    return rec;
  }
  // 用某个账户给某笔负债还债：扣账户余额 + 减少负债
  function repayDebt(uid, { debtId, accId, amount, note = "", date }) {
    const amt = Number(amount) || 0;
    if (amt <= 0) return { ok: false, msg: "请输入还款金额" };
    const d = (db.debts[uid] || []).find(x => x.id === debtId);
    if (!d) return { ok: false, msg: "请选择要还的负债" };
    const a = (db.wallets[uid] || []).find(x => x.id === accId);
    if (!a) return { ok: false, msg: "请选择付款账户" };
    if (amt > d.amount + 0.001) return { ok: false, msg: "还款金额超过欠款（剩余 ¥" + d.amount.toFixed(2) + "）" };
    if (amt > a.balance + 0.001) return { ok: false, msg: "账户余额不足（可用 ¥" + a.balance.toFixed(2) + "）" };
    const rec = addRecord(uid, { type: "repay", cat: "debt", amount: amt, note: note || ("还 " + d.name), date, accId, debtId });
    return { ok: true, rec };
  }
  function delRecord(uid, rid) {
    const list = db.accounts[uid] || [];
    const i = list.findIndex(r => r.id === rid);
    if (i < 0) return null;
    const removed = list.splice(i, 1)[0];
    applyRecord(uid, removed, -1);
    persist();
    return removed;
  }
  function restoreRecord(uid, rec) {
    if (!rec) return;
    if (!db.accounts[uid]) db.accounts[uid] = [];
    db.accounts[uid].push(rec);
    applyRecord(uid, rec, 1);
    persist();
  }
  function getSummary(uid) {
    const rs = db.accounts[uid] || [];
    let income = 0, expense = 0;
    const byCat = {};
    rs.forEach(r => {
      if (r.type === "in") income += r.amount;
      else if (r.type === "out") { expense += r.amount; byCat[r.cat] = (byCat[r.cat] || 0) + r.amount; }
      // 还债（repay）是资产与负债之间的转移，不计入收支统计
    });
    const trend = [];
    for (let off = -6; off <= 0; off++) {
      const d = dayStr(off);
      trend.push({ day: d.slice(5), amount: rs.filter(r => r.date === d && r.type === "out").reduce((s, r) => s + r.amount, 0) });
    }
    return {
      income, expense, balance: income - expense,
      byCat: Object.entries(byCat).map(([cat, amount]) => ({ cat, amount })).sort((a, b) => b.amount - a.amount),
      trend,
    };
  }

  /* ---------- 自定义收支分类（记一笔的「理由」） ---------- */
  function customCats(uid, type) {
    const list = (db.customCats && db.customCats[uid]) || [];
    return type ? list.filter(c => c.type === type) : list.slice();
  }
  // 内置分类 + 用户自定义分类（按收/支类型）
  function listCats(uid, type) {
    const base = type === "in"
      ? CATS.filter(c => c.key === "income")
      : CATS.filter(c => c.key !== "income");
    return base.concat(customCats(uid, type));
  }
  function catInfo(uid, key, type) {
    const c = listCats(uid, type).find(x => x.key === key);
    if (c) return c;
    return type === "in" ? { key, name: "收入", e: "💰" } : { key, name: "其他", e: "📦" };
  }
  function addCat(uid, { type = "out", name = "", e = "🏷️" } = {}) {
    name = String(name || "").trim();
    if (!name) return { ok: false, msg: "请输入分类名称" };
    if (name.length > 6) return { ok: false, msg: "分类名称不超过 6 个字" };
    if (listCats(uid, type).some(c => c.name === name)) return { ok: false, msg: "该分类已存在" };
    if (!db.customCats) db.customCats = {};
    if (!db.customCats[uid]) db.customCats[uid] = [];
    const cat = { key: "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name, e: e || "🏷️", type, custom: true };
    db.customCats[uid].push(cat);
    persist();
    return { ok: true, cat };
  }
  function updateCat(uid, key, { name, e } = {}) {
    const c = ((db.customCats && db.customCats[uid]) || []).find(x => x.key === key);
    if (!c) return { ok: false, msg: "只能编辑自定义分类" };
    if (name !== undefined) {
      name = String(name).trim();
      if (!name) return { ok: false, msg: "请输入分类名称" };
      if (name.length > 6) return { ok: false, msg: "分类名称不超过 6 个字" };
      if (listCats(uid, c.type).some(x => x.name === name && x.key !== key)) return { ok: false, msg: "该分类已存在" };
      c.name = name;
    }
    if (e !== undefined) c.e = e || "🏷️";
    persist();
    return { ok: true, cat: c };
  }
  function delCat(uid, key) {
    const list = (db.customCats && db.customCats[uid]) || [];
    const i = list.findIndex(x => x.key === key);
    if (i < 0) return null;
    const removed = list.splice(i, 1)[0];
    persist();
    return removed;
  }
  function restoreCat(uid, cat) {
    if (!cat) return;
    if (!db.customCats) db.customCats = {};
    if (!db.customCats[uid]) db.customCats[uid] = [];
    db.customCats[uid].push(cat);
    persist();
  }

  /* ---------- 书架 ---------- */
  function recommendBooks() { return db.books.recommend; }
  function myBooks(uid) {
    const shelf = db.books.shelf[uid] || [];
    return shelf.map(s => ({ ...s, book: db.books.recommend.find(b => b.id === s.bid) })).filter(x => x.book);
  }
  function addToShelf(uid, bid) {
    if (!db.books.shelf[uid]) db.books.shelf[uid] = [];
    const ex = db.books.shelf[uid].find(s => s.bid === bid);
    if (ex) return { ok: false, msg: "已在书架中" };
    db.books.shelf[uid].push({ bid, pct: 0, since: Date.now() });
    persist();
    return { ok: true, msg: "已加入书架" };
  }
  function removeFromShelf(uid, bid) {
    db.books.shelf[uid] = (db.books.shelf[uid] || []).filter(s => s.bid !== bid);
    persist();
  }
  function setProgress(uid, bid, pct) {
    const s = (db.books.shelf[uid] || []).find(x => x.bid === bid);
    if (s) { s.pct = Math.max(0, Math.min(100, pct)); persist(); }
  }

  /* ---------- 备忘录 ---------- */
  function listMemos(uid) {
    return (db.memos[uid] || []).slice().sort((a, b) => (b.pin - a.pin) || (b.t - a.t));
  }
  function saveMemo(uid, memo) {
    if (!db.memos[uid]) db.memos[uid] = [];
    if (memo.id) {
      const i = db.memos[uid].findIndex(m => m.id === memo.id);
      if (i >= 0) { db.memos[uid][i] = Object.assign(db.memos[uid][i], memo, { t: Date.now() }); persist(); return db.memos[uid][i]; }
    }
    const m = { id: "mm" + Date.now(), text: memo.text, tag: memo.tag || "", pin: !!memo.pin, t: Date.now() };
    db.memos[uid].push(m);
    persist();
    return m;
  }
  function delMemo(uid, id) {
    db.memos[uid] = (db.memos[uid] || []).filter(m => m.id !== id);
    persist();
  }

  /* ---------- 健身打卡 ---------- */
  function fitnessOf(uid) {
    const f = db.fitness[uid] || { goalWeekly: 4, days: {} };
    const list = f.days[dayStr(0)] || [];
    let streak = 0;
    for (let off = 0; ; off++) {
      const d = dayStr(-off);
      if ((f.days[d] || []).length) streak++;
      else if (off === 0) continue;
      else break;
    }
    let weekCount = 0;
    for (let off = 1; off <= 7; off++) {
      const d = dayStr(-off);
      if ((f.days[d] || []).length) weekCount++;
    }
    return {
      today: list,
      weekCount, // 本周（不含今天）已打卡天数
      streak,
      goalWeekly: f.goalWeekly || 4,
      goalPct: Math.min(100, Math.round(((weekCount + (list.length ? 1 : 0)) / (f.goalWeekly || 4)) * 100)),
    };
  }
  function checkin(uid, sportKey) {
    if (!db.fitness[uid]) db.fitness[uid] = { goalWeekly: 4, days: {} };
    const f = db.fitness[uid];
    const d = dayStr(0);
    if (!f.days[d]) f.days[d] = [];
    const i = f.days[d].indexOf(sportKey);
    if (i >= 0) f.days[d].splice(i, 1);
    else f.days[d].push(sportKey);
    persist();
    return i < 0;
  }
  function setWeeklyGoal(uid, n) {
    if (!db.fitness[uid]) db.fitness[uid] = { goalWeekly: 4, days: {} };
    db.fitness[uid].goalWeekly = Math.max(1, Math.min(7, n));
    persist();
  }
  function fitnessDays(uid, n = 14) {
    const f = db.fitness[uid] || { days: {} };
    const out = [];
    for (let off = n - 1; off >= 0; off--) {
      const d = dayStr(-off);
      out.push({ day: d, sports: f.days[d] || [] });
    }
    return out;
  }

  /* ---------- 任务 ---------- */
  function listTasks(uid) {
    return (db.tasks[uid] || []).slice().sort((a, b) => {
      const order = { doing: 0, todo: 1, done: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.t - a.t;
    });
  }
  function saveTask(uid, task) {
    if (!db.tasks[uid]) db.tasks[uid] = [];
    if (task.id) {
      const i = db.tasks[uid].findIndex(x => x.id === task.id);
      if (i >= 0) { db.tasks[uid][i] = Object.assign(db.tasks[uid][i], task); persist(); return db.tasks[uid][i]; }
    }
    const t = { id: "t" + Date.now(), title: task.title, tag: task.tag || "", pct: task.pct || 0, status: task.status || "todo", t: Date.now() };
    db.tasks[uid].push(t);
    persist();
    return t;
  }
  function delTask(uid, id) {
    db.tasks[uid] = (db.tasks[uid] || []).filter(x => x.id !== id);
    persist();
  }

  /* ---------- 页面设置（后台布局管理） ---------- */
  function getSettings() { return JSON.parse(JSON.stringify(db.settings)); }
  function saveSettings(patch) {
    Object.keys(patch || {}).forEach(k => {
      const v = patch[k];
      // 对象（非数组）做一层深合并，数组与基础类型直接替换
      if (v && typeof v === "object" && !Array.isArray(v) &&
          db.settings[k] && typeof db.settings[k] === "object" && !Array.isArray(db.settings[k])) {
        Object.assign(db.settings[k], v);
      } else {
        db.settings[k] = v;
      }
    });
    persist();
    // 若用户没有本地主题选择，立即应用新的默认主题
    if (!localStorage.getItem("yiwo_theme") && patch && patch.defaultTheme) {
      window.Theme && Theme.apply(patch.defaultTheme);
    }
  }

  /* ---------- 前端功能配置 ---------- */
  function getCatalog() { return JSON.parse(JSON.stringify(db.settings.featureCatalog || {})); }
  function getCatalogItem(key) {
    const c = (db.settings.featureCatalog || {})[key];
    return c ? JSON.parse(JSON.stringify(c)) : null;
  }
  // 后台用：含隐藏项，带 visible 标记
  function listSurface(surface) {
    const arr = (db.settings.featureSurfaces && db.settings.featureSurfaces[surface]) || [];
    const cat = db.settings.featureCatalog || {};
    return arr.map(item => {
      const key = typeof item === "string" ? item : item.key;
      const meta = cat[key] || FEATURE_CATALOG[key] || { name: key, e: "", ico: "info", g: "", href: "" };
      return { key, name: meta.name, e: meta.e, ico: meta.ico, g: meta.g, href: meta.href, visible: (typeof item === "object" && item.visible === false) ? false : true };
    });
  }
  // 前端用：按序、过滤隐藏项
  function listFeatures(surface) {
    return listSurface(surface).filter(f => f.visible !== false);
  }
  // 用传入的有序键数组重写该 surface（保留每个 key 原有的 visible）
  function setSurface(surface, keys) {
    if (!SURFACE_NAMES[surface]) return { ok: false, msg: "未知的展示位" };
    if (!Array.isArray(keys) || !keys.length) return { ok: false, msg: "至少保留一个功能" };
    const prev = {};
    ((db.settings.featureSurfaces && db.settings.featureSurfaces[surface]) || []).forEach(it => {
      const k = typeof it === "string" ? it : it.key;
      prev[k] = (typeof it === "object" && it.visible === false) ? false : true;
    });
    const next = keys.map(k => ({ key: k, visible: prev[k] !== false }));
    if (surface === "tab" && next.filter(x => x.visible).length < 2) return { ok: false, msg: "底部 Tab 至少保留 2 个功能" };
    if (!db.settings.featureSurfaces) db.settings.featureSurfaces = {};
    db.settings.featureSurfaces[surface] = next;
    persist();
    return { ok: true };
  }
  // 单个功能显隐
  function setFeatureVisible(surface, key, visible) {
    const arr = (db.settings.featureSurfaces && db.settings.featureSurfaces[surface]) || [];
    const it = arr.find(x => (typeof x === "string" ? x : x.key) === key);
    if (!it) return { ok: false, msg: "功能不存在" };
    const target = typeof it === "string" ? { key: it, visible: true } : it;
    const idx = arr.indexOf(it);
    const next = { key: target.key, visible: !!visible };
    if (surface === "tab" && !visible && arr.filter(x => (typeof x === "string" ? x : x.key) !== key && !(typeof x === "object" && x.visible === false)).length < 2) {
      return { ok: false, msg: "底部 Tab 至少保留 2 个功能" };
    }
    arr[idx] = next;
    persist();
    return { ok: true };
  }
  // 修改功能元数据（文字 / emoji / SVG 图标名 / 配色 / 跳转）
  function updateCatalogItem(key, patch) {
    const cat = db.settings.featureCatalog || {};
    if (!cat[key]) return { ok: false, msg: "功能不存在" };
    if (patch && patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) return { ok: false, msg: "功能名称不能为空" };
      if (name.length > 8) return { ok: false, msg: "功能名称不超过 8 个字" };
      patch.name = name;
    }
    FEATURE_FIELDS.forEach(f => { if (patch && patch[f] !== undefined) cat[key][f] = patch[f]; });
    persist();
    return { ok: true, item: JSON.parse(JSON.stringify(cat[key])) };
  }
  function resetFeatures() {
    db.settings.featureCatalog = defaultCatalog();
    db.settings.featureSurfaces = defaultSurfaces();
    db.settings.titles = defaultTitles();
    persist();
  }
  // 页面小标题 / 顶栏标题
  function getTitles() {
    const t = db.settings.titles || {};
    const out = Object.assign({}, TITLE_DEFS);
    Object.keys(t).forEach(k => { if (t[k] !== undefined && t[k] !== null && t[k] !== "") out[k] = t[k]; });
    return out;
  }
  function getTitle(key, fallback) {
    const t = db.settings.titles || {};
    if (t[key] !== undefined && t[key] !== null && t[key] !== "") return t[key];
    if (TITLE_DEFS[key] !== undefined) return TITLE_DEFS[key];
    return fallback !== undefined ? fallback : key;
  }
  function saveTitles(patch) {
    if (!db.settings.titles) db.settings.titles = {};
    Object.keys(patch || {}).forEach(k => {
      const v = patch[k];
      if (v === undefined || v === null || String(v).trim() === "") delete db.settings.titles[k];
      else db.settings.titles[k] = String(v).trim();
    });
    persist();
  }

  /* ---------- 数据备份（导出 / 导入） ---------- */
  // 始终从内存镜像导出，保证导出的是当前最新状态
  function exportBackup() {
    return JSON.stringify({ __yiwo: true, version: 2, exportedAt: Date.now(), data: db });
  }
  function importBackup(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, msg: "文件内容不是有效的 JSON" }; }
    const next = obj && obj.__yiwo ? obj.data : obj;
    if (!next || !Array.isArray(next.users)) return { ok: false, msg: "不是有效的以我备份文件" };
    ["remark", "chatHidden", "groups", "friendGroup", "friendNav", "wallets", "debts", "customCats"].forEach(k => { if (!next[k]) next[k] = {}; });
    db = next;
    ensureSettings();
    persist();
    flushNow();
    return { ok: true };
  }

  /* ---------- 我的页面宫格排序 ---------- */
  function getOrder(uid) { return db.order[uid] || ["moments", "bookshelf", "memo", "fitness", "tasks", "profile"]; }
  function getOrderRaw(uid) { return db.order[uid] ? db.order[uid].slice() : null; }
  function saveOrder(uid, arr) { db.order[uid] = arr; persist(); }

  /* ---------- 好友分组 ---------- */
  const DEFAULT_GROUPS = ["家人", "朋友", "同事", "同学", "特别关心"];
  function newGid() { return "g" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function ensureGroups(uid) {
    if (!db.groups) db.groups = {};
    let list = db.groups[uid];
    if (!list || !list.length) {
      list = DEFAULT_GROUPS.map(name => ({ id: newGid(), name }));
      db.groups[uid] = list;
      persist();
    }
    return list;
  }
  function getGroups(uid) { return ensureGroups(uid).map(g => ({ ...g })); }
  function addGroup(uid, name) {
    name = String(name || "").trim();
    if (!name) return { ok: false, msg: "请输入分组名称" };
    if (name.length > 8) return { ok: false, msg: "分组名称不超过 8 个字" };
    const list = ensureGroups(uid);
    if (list.some(g => g.name === name)) return { ok: false, msg: "该分组已存在" };
    const g = { id: newGid(), name };
    list.push(g);
    persist();
    return { ok: true, group: { ...g } };
  }
  function renameGroup(uid, gid, name) {
    name = String(name || "").trim();
    if (!name) return { ok: false, msg: "请输入分组名称" };
    if (name.length > 8) return { ok: false, msg: "分组名称不超过 8 个字" };
    const list = ensureGroups(uid);
    if (list.some(g => g.name === name && g.id !== gid)) return { ok: false, msg: "该分组已存在" };
    const g = list.find(x => x.id === gid);
    if (!g) return { ok: false, msg: "分组不存在" };
    g.name = name;
    persist();
    return { ok: true };
  }
  // 默认分组：优先「朋友」，被删/改名后回退到第一个分组
  function defaultGroupId(list) {
    const g = list.find(x => x.name === "朋友") || list[0];
    return g.id;
  }
  // 未指定分组的好友默认归入「朋友」
  function groupOf(uid, fid) {
    const list = ensureGroups(uid);
    const map = (db.friendGroup && db.friendGroup[uid]) || {};
    const g = list.find(x => x.id === map[fid]);
    return g ? g.id : defaultGroupId(list);
  }
  function assignGroup(uid, fid, gid) {
    if (!db.friendGroup) db.friendGroup = {};
    if (!db.friendGroup[uid]) db.friendGroup[uid] = {};
    db.friendGroup[uid][fid] = gid;
    persist();
  }
  // 删除分组：组内好友自动移动到剩下的第一个分组
  function delGroup(uid, gid) {
    const list = ensureGroups(uid);
    if (list.length <= 1) return { ok: false, msg: "至少保留一个分组" };
    const idx = list.findIndex(g => g.id === gid);
    if (idx < 0) return { ok: false, msg: "分组不存在" };
    const name = list[idx].name;
    list.splice(idx, 1);
    const fallback = defaultGroupId(list);
    const map = (db.friendGroup && db.friendGroup[uid]) || {};
    let moved = 0;
    Object.keys(map).forEach(fid => { if (map[fid] === gid) { map[fid] = fallback; moved++; } });
    persist();
    return { ok: true, name, moved, to: list.find(g => g.id === fallback).name };
  }

  /* ---------- 好友备注 ---------- */
  function remarkOf(uid, fid) {
    return (db.remark && db.remark[uid] && db.remark[uid][fid]) || "";
  }
  function setRemark(uid, fid, name) {
    name = String(name == null ? "" : name).trim();
    if (name.length > 12) return { ok: false, msg: "备注名不超过 12 个字" };
    if (!db.remark) db.remark = {};
    if (!db.remark[uid]) db.remark[uid] = {};
    if (name) db.remark[uid][fid] = name;
    else delete db.remark[uid][fid];
    persist();
    return { ok: true, name };
  }
  // 列表/聊天中显示的名字：有备注用备注，否则用昵称
  function displayName(uid, fid) {
    const r = remarkOf(uid, fid);
    if (r) return r;
    const u = getUser(fid);
    return u ? u.nickname : "好友";
  }

  /* ---------- 好友页导航顺序 ---------- */
  const FRIEND_NAV = ["contacts", "messages", "moments"];
  function getFriendNav(uid) {
    if (!db.friendNav) db.friendNav = {};
    const arr = db.friendNav[uid];
    if (!arr || arr.length !== FRIEND_NAV.length || FRIEND_NAV.some(k => !arr.includes(k))) return [...FRIEND_NAV];
    return [...arr];
  }
  function saveFriendNav(uid, arr) {
    if (!db.friendNav) db.friendNav = {};
    const next = [];
    (Array.isArray(arr) ? arr : []).forEach(k => { if (FRIEND_NAV.includes(k) && !next.includes(k)) next.push(k); });
    FRIEND_NAV.forEach(k => { if (!next.includes(k)) next.push(k); });   // 补齐缺失项，保持用户顺序
    db.friendNav[uid] = next;
    persist();
  }

  /* ---------- 管理员 ---------- */
  function loginAdmin(account, password) {
    const a = db.admins.find(x => x.account === String(account).trim());
    if (!a) return { ok: false, msg: "管理员账号不存在" };
    if (a.password !== password) return { ok: false, msg: "密码不正确" };
    db.session = { type: "admin", aid: a.id };
    persist();
    flushNow();
    return { ok: true, admin: a };
  }
  function listAdmins() { return [...db.admins]; }
  function addAdmin({ account, password, name, phone, dept, idcard, perms = [] }) {
    if (db.admins.some(a => a.account === account)) return { ok: false, msg: "该账号已存在" };
    const a = {
      id: "ad" + Date.now(), account, password, name, phone, dept, idcard,
      perms, role: perms.includes("admins") ? "超级管理员" : "普通管理员", t: Date.now(),
    };
    db.admins.push(a);
    persist();
    return { ok: true, admin: a };
  }
  function updateAdmin(aid, patch) {
    const a = db.admins.find(x => x.id === aid);
    if (!a) return;
    Object.assign(a, patch);
    if (patch.perms) a.role = patch.perms.includes("admins") ? "超级管理员" : "普通管理员";
    persist();
  }
  function hasPerm(admin, key) {
    return !!(admin && (admin.perms || []).includes(key));
  }

  /* ---------- 后台仪表盘 ---------- */
  function dashboard() {
    const users = listUsers();
    const today = new Date().setHours(0, 0, 0, 0);
    const todayNew = users.filter(u => u.regTime >= today).length;
    let totalAssets = 0;
    Object.values(db.wallets || {}).forEach(list => {
      list.forEach(a => { totalAssets += a.balance; });
    });
    const gender = [["男", 0], ["女", 0], ["保密", 0]].map(([name, value]) => {
      const cnt = users.filter(u => u.gender === name).length;
      return { name, value: cnt };
    }).filter(x => x.value > 0);
    const regionMap = {};
    users.forEach(u => { regionMap[u.region] = (regionMap[u.region] || 0) + 1; });
    const region = Object.entries(regionMap).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 6);
    const trend = [];
    for (let off = -6; off <= 0; off++) {
      const d = dayStr(off);
      trend.push({ day: d.slice(5), count: users.filter(u => {
        const dt = new Date(u.regTime);
        return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` === d;
      }).length });
    }
    return {
      total: users.length, todayNew, totalAssets,
      momentCount: db.moments.length,
      gender, region, trend,
      recentUsers: users.slice(0, 6),
    };
  }

  /* ---------- 危险操作：恢复出厂设置 ---------- */
  /** 清空所有业务数据并重置为出厂种子（含管理员账号、主题、页面布局配置），同时退出登录 */
  function factoryReset() {
    db = seed();
    db.session = null;
    persist();
    return flushNow();
  }

  /* ---------- 启动异步接管（IndexedDB -> 内存镜像） ---------- */
  hydrate();

  return {
    CATS, SPORTS, PERMS, REGIONS, WALLET_TYPES, WALLET_GROUPS, save,
    // 会话/用户
    currentUser, currentAdmin, login, register, logout, updateProfile, getUser, listUsers, filterUsers,
    // 好友
    listFriends, isFriend, pendingRequests, sentRequests, sendRequest, acceptRequest, rejectRequest, deleteFriend,
    // 好友分组
    getGroups, addGroup, renameGroup, delGroup, groupOf, assignGroup,
    // 好友备注
    remarkOf, setRemark, displayName,
    // 好友页导航顺序
    getFriendNav, saveFriendNav,
    // 对话
    getMessages, getConversations, sendMessage, markRead, clearChat, deleteChat,
    // 动态
    listMoments, toggleLike, addComment, repost, addMoment, setMomentPrivacy, delMoment, restoreMoment,
    // 资产账户 / 负债 / 记账
    listWallets, walletSummary, addWallet, updateWallet, delWallet, restoreWallet,
    listDebts, addDebt, updateDebt, delDebt, restoreDebt,
    listRecords, addRecord, repayDebt, delRecord, restoreRecord, getSummary,
    customCats, listCats, catInfo, addCat, updateCat, delCat, restoreCat,
    // 书架
    recommendBooks, myBooks, addToShelf, removeFromShelf, setProgress,
    // 备忘录
    listMemos, saveMemo, delMemo,
    // 健身
    fitnessOf, checkin, setWeeklyGoal, fitnessDays,
    // 任务
    listTasks, saveTask, delTask,
    // 设置
    getSettings, saveSettings,
    // 前端功能配置
    FEATURE_CATALOG, FEATURE_SURFACES, SURFACE_NAMES, TITLE_DEFS,
    getCatalog, getCatalogItem, listFeatures, listSurface, setSurface, setFeatureVisible,
    updateCatalogItem, getTitles, getTitle, saveTitles, resetFeatures,
    // 排序
    getOrder, getOrderRaw, saveOrder,
    // 数据备份
    exportBackup, importBackup,
    // 管理员
    loginAdmin, listAdmins, addAdmin, updateAdmin, hasPerm,
    // 仪表盘
    dashboard,
    // 危险操作
    factoryReset,
  };
})();
