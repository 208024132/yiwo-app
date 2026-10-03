/* ============================================================
   以我APP · 数据中心（localStorage 模拟后端）
   用户端与管理后台共用同一份数据。
   所有页面通过 window.Store 读写数据，不要直接操作 localStorage。
   ============================================================ */
window.Store = (() => {
  const KEY = "yiwo_db_v2";
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

  /* ---------- 种子数据 ---------- */
  function seed() {
    const users = [
      { id: "u10001", account: "yiwome@qq.com", password: "123456", nickname: "以我同学", avatarEmoji: "🐳", avatarColor: 1,
        signature: "认真记录每一天的自己 ✨", phone: "138****6688", age: 24, gender: "男", birthday: "2002-03-15", region: "广东·深圳",
        privacyDefault: "friends", regTime: ts(-40, "09:30") },
      { id: "u10002", account: "momo@qq.com", password: "123456", nickname: "抹茶星冰乐", avatarEmoji: "🍵", avatarColor: 6,
        signature: "奶茶半糖去冰", phone: "137****2233", age: 23, gender: "女", birthday: "2003-07-22", region: "广东·广州",
        privacyDefault: "public", regTime: ts(-36, "14:12") },
      { id: "u10003", account: "coder@qq.com", password: "123456", nickname: "代码搬运工", avatarEmoji: "👨‍💻", avatarColor: 1,
        signature: "Talk is cheap", phone: "136****8877", age: 26, gender: "男", birthday: "2000-11-08", region: "北京",
        privacyDefault: "public", regTime: ts(-33, "21:45") },
      { id: "u10004", account: "runner@qq.com", password: "123456", nickname: "跑步的阿泽", avatarEmoji: "🏃", avatarColor: 2,
        signature: "每天 5 公里", phone: "135****5566", age: 25, gender: "男", birthday: "2001-01-30", region: "浙江·杭州",
        privacyDefault: "friends", regTime: ts(-30, "07:05") },
      { id: "u10005", account: "bookworm@qq.com", password: "123456", nickname: "读书的猫", avatarEmoji: "🐱", avatarColor: 4,
        signature: "一周一本书", phone: "134****9900", age: 27, gender: "女", birthday: "1999-09-12", region: "上海",
        privacyDefault: "public", regTime: ts(-28, "20:18") },
      { id: "u10006", account: "lily@qq.com", password: "123456", nickname: "Lily 不吃辣", avatarEmoji: "🌸", avatarColor: 3,
        signature: "爱拍照爱生活", phone: "133****4411", age: 22, gender: "女", birthday: "2004-05-06", region: "四川·成都",
        privacyDefault: "public", regTime: ts(-24, "11:40") },
      { id: "u10007", account: "chef@qq.com", password: "123456", nickname: "深夜食堂", avatarEmoji: "🍳", avatarColor: 5,
        signature: "会做饭的程序员", phone: "132****1188", age: 28, gender: "男", birthday: "1998-12-25", region: "湖北·武汉",
        privacyDefault: "friends", regTime: ts(-20, "18:22") },
      { id: "u10008", account: "traveler@qq.com", password: "123456", nickname: "环游小鹿", avatarEmoji: "🦌", avatarColor: 2,
        signature: "世界那么大", phone: "131****7733", age: 24, gender: "女", birthday: "2002-08-18", region: "福建·厦门",
        privacyDefault: "public", regTime: ts(-15, "10:00") },
      { id: "u10009", account: "fitness@qq.com", password: "123456", nickname: "铁馆老李", avatarEmoji: "💪", avatarColor: 0,
        signature: "撸铁使我快乐", phone: "130****6622", age: 29, gender: "男", birthday: "1997-04-02", region: "江苏·南京",
        privacyDefault: "friends", regTime: ts(-9, "06:30") },
      { id: "u10010", account: "newbie@qq.com", password: "123456", nickname: "小新同学", avatarEmoji: "🐣", avatarColor: 5,
        signature: "刚来，请多关照", phone: "139****3344", age: 21, gender: "男", birthday: "2005-10-01", region: "山东·青岛",
        privacyDefault: "public", regTime: ts(-1, "16:55") },
    ];

    const friends = [
      { a: "u10001", b: "u10002", since: ts(-30, "10:00") },
      { a: "u10001", b: "u10003", since: ts(-25, "10:00") },
      { a: "u10001", b: "u10004", since: ts(-18, "10:00") },
      { a: "u10001", b: "u10005", since: ts(-12, "10:00") },
      { a: "u10001", b: "u10006", since: ts(-6, "10:00") },
    ];
    const friendReqs = [
      { from: "u10007", to: "u10001", t: ts(-1, "23:10") },
      { from: "u10008", to: "u10001", t: ts(-2, "15:20") },
    ];

    const chats = [
      { a: "u10001", b: "u10002", msgs: [
        { id: "m1", from: "u10002", text: "周末去爬山吗？⛰️", t: ts(0, "09:12"), read: true },
        { id: "m2", from: "u10001", text: "可以呀，周六早上怎么样？", t: ts(0, "09:15"), read: true },
        { id: "m3", from: "u10002", text: "没问题，8 点在老地方集合！", t: ts(0, "09:16"), read: true },
        { id: "m4", from: "u10002", text: "记得带水和防晒哦～", t: ts(0, "09:20"), read: false },
      ] },
      { a: "u10001", b: "u10003", msgs: [
        { id: "m5", from: "u10003", text: "你上次说的记账 App 很好用，谢谢推荐！", t: ts(-1, "20:01"), read: false },
      ] },
    ];

    const moments = [
      { id: "p1", uid: "u10001", type: "photo", text: "今天的晚霞像打翻的调色盘 🌇", photos: [{ g: "linear-gradient(135deg,#f2994a,#ef5e47)", e: "🌇" }],
        privacy: "friends", likes: ["u10002", "u10003", "u10004"], comments: [
          { uid: "u10002", text: "太美了吧！在哪里拍的？", t: ts(0, "19:40") },
        ], reposts: 1, t: ts(0, "18:52") },
      { id: "p2", uid: "u10001", type: "text", text: "坚持记账第 30 天，小钱钱都在掌控之中 💰", photos: [],
        privacy: "public", likes: ["u10002"], comments: [], reposts: 0, t: ts(-2, "21:10") },
      { id: "p3", uid: "u10001", type: "photo", text: "健身房打卡，没有人能阻止我变强 🏋️", photos: [{ g: "linear-gradient(135deg,#56ccf2,#2f80ed)", e: "🏋️" }],
        privacy: "friends", likes: ["u10004", "u10009"], comments: [
          { uid: "u10004", text: "一起练啊兄弟", t: ts(-3, "20:05") },
        ], reposts: 0, t: ts(-3, "19:30") },
      { id: "p4", uid: "u10002", type: "photo", text: "秋天的第一杯奶茶 🍂", photos: [{ g: "linear-gradient(135deg,#a1e657,#43a047)", e: "🧋" }],
        privacy: "public", likes: ["u10001", "u10006"], comments: [{ uid: "u10001", text: "半糖去冰谢谢", t: ts(-1, "15:12") }], reposts: 0, t: ts(-1, "14:58") },
      { id: "p5", uid: "u10004", type: "text", text: "清晨 5 公里打卡，配速 5'30''，状态不错！", photos: [],
        privacy: "public", likes: ["u10001"], comments: [], reposts: 0, t: ts(-1, "06:42") },
      { id: "p6", uid: "u10005", type: "photo", text: "本周在读：《百年孤独》📚", photos: [{ g: "linear-gradient(135deg,#9b6cf7,#5f3dcf)", e: "📚" }],
        privacy: "public", likes: ["u10001", "u10002", "u10003"], comments: [], reposts: 1, t: ts(-4, "22:20") },
      { id: "p7", uid: "u10006", type: "photo", text: "川西自驾 Day3，随手一拍都是屏保", photos: [{ g: "linear-gradient(135deg,#f76f8e,#b23a6e)", e: "🏔️" }],
        privacy: "public", likes: ["u10001"], comments: [], reposts: 0, t: ts(-5, "20:11") },
      { id: "p8", uid: "u10003", type: "text", text: "新版本终于上线了，熬夜值了", photos: [],
        privacy: "public", likes: ["u10001", "u10004"], comments: [], reposts: 0, t: ts(-6, "02:33") },
    ];

    const accounts = {
      u10001: [
        { id: "a1", type: "out", cat: "food", amount: 26.5, note: "午餐·沙县小吃", date: dayStr(0), t: ts(0, "12:20") },
        { id: "a2", type: "out", cat: "traffic", amount: 8, note: "地铁通勤", date: dayStr(0), t: ts(0, "08:45") },
        { id: "a3", type: "out", cat: "shopping", amount: 129, note: "新耳机配件", date: dayStr(-1), t: ts(-1, "20:15") },
        { id: "a4", type: "out", cat: "food", amount: 45, note: "晚餐·和同事聚餐", date: dayStr(-1), t: ts(-1, "19:00") },
        { id: "a5", type: "in", cat: "income", amount: 8500, note: "9 月工资", date: dayStr(-2), t: ts(-2, "10:00") },
        { id: "a6", type: "out", cat: "fun", amount: 68, note: "电影票", date: dayStr(-2), t: ts(-2, "19:30") },
        { id: "a7", type: "out", cat: "food", amount: 18, note: "早餐·豆浆油条", date: dayStr(-3), t: ts(-3, "08:10") },
        { id: "a8", type: "out", cat: "traffic", amount: 12.5, note: "打车", date: dayStr(-3), t: ts(-3, "22:05") },
        { id: "a9", type: "out", cat: "home", amount: 1800, note: "房租", date: dayStr(-4), t: ts(-4, "09:00") },
        { id: "a10", type: "out", cat: "shopping", amount: 89, note: "运动水壶", date: dayStr(-5), t: ts(-5, "15:40") },
        { id: "a11", type: "out", cat: "food", amount: 32, note: "点外卖", date: dayStr(-5), t: ts(-5, "12:30") },
        { id: "a12", type: "out", cat: "medical", amount: 56, note: "感冒药", date: dayStr(-6), t: ts(-6, "17:20") },
        { id: "a13", type: "out", cat: "fun", amount: 25, note: "视频会员", date: dayStr(-6), t: ts(-6, "21:00") },
      ],
    };

    const books = {
      recommend: [
        { id: "b1", title: "人类简史", author: "尤瓦尔·赫拉利", tag: "历史", desc: "从认知革命到人工智能，重新理解人类。", g: "linear-gradient(135deg,#5b6abf,#30336b)" },
        { id: "b2", title: "百年孤独", author: "加西亚·马尔克斯", tag: "文学", desc: "魔幻现实主义的巅峰之作。", g: "linear-gradient(135deg,#c05621,#7b341e)" },
        { id: "b3", title: "小王子", author: "圣埃克苏佩里", tag: "童话", desc: "所有大人最初都是孩子。", g: "linear-gradient(135deg,#f6ad55,#dd6b20)" },
        { id: "b4", title: "三体", author: "刘慈欣", tag: "科幻", desc: "给岁月以文明，而不是给文明以岁月。", g: "linear-gradient(135deg,#2c5282,#1a365d)" },
        { id: "b5", title: "被讨厌的勇气", author: "岸见一郎", tag: "心理", desc: "一切烦恼都来自人际关系。", g: "linear-gradient(135deg,#48bb78,#276749)" },
        { id: "b6", title: "活着", author: "余华", tag: "小说", desc: "人是为了活着本身而活着。", g: "linear-gradient(135deg,#9b2c2c,#5f1b1b)" },
      ],
      shelf: {
        u10001: [
          { bid: "b6", pct: 78, since: ts(-20, "20:00") },
          { bid: "b4", pct: 35, since: ts(-10, "20:00") },
          { bid: "b3", pct: 100, since: ts(-5, "20:00") },
        ],
      },
    };

    const memos = {
      u10001: [
        { id: "mm1", text: "买牛奶、鸡蛋、全麦面包", tag: "购物", pin: true, t: ts(-1, "08:30") },
        { id: "mm2", text: "下周三 14:00 产品评审会，记得提前准备 demo", tag: "工作", pin: true, t: ts(-2, "17:45") },
        { id: "mm3", text: "灵感：给记账加一个「心愿单」功能，攒钱更有动力", tag: "灵感", pin: false, t: ts(-3, "23:12") },
      ],
    };

    const fitness = {
      u10001: {
        goalWeekly: 4,
        days: {
          [dayStr(0)]: ["run"],
          [dayStr(-1)]: ["gym"],
          [dayStr(-2)]: ["walk"],
          [dayStr(-3)]: ["ride"],
          [dayStr(-5)]: ["run", "gym"],
          [dayStr(-7)]: ["yoga"],
          [dayStr(-8)]: ["swim"],
        },
      },
    };

    const tasks = {
      u10001: [
        { id: "t1", title: "阅读《活着》到 100%", tag: "阅读", pct: 78, status: "doing", t: ts(-4, "10:00") },
        { id: "t2", title: "每周健身 4 次", tag: "健身", pct: 60, status: "doing", t: ts(-6, "10:00") },
        { id: "t3", title: "学会做 3 道新菜", tag: "生活", pct: 33, status: "todo", t: ts(-8, "10:00") },
        { id: "t4", title: "整理 9 月账单", tag: "理财", pct: 100, status: "done", t: ts(-3, "10:00") },
      ],
    };

    const admins = [
      { id: "ad1", account: "admin@yiwo.com", password: "888888", name: "陈以我", phone: "13800001111", dept: "产品部",
        idcard: "4403**********1234", perms: ["users", "layout", "admins"], role: "超级管理员", t: ts(-50, "09:00") },
      { id: "ad2", account: "wang@yiwo.com", password: "456789", name: "王运营", phone: "13900002222", dept: "运营部",
        idcard: "4403**********5678", perms: ["users"], role: "普通管理员", t: ts(-20, "09:00") },
    ];

    return {
      users, friends, friendReqs, chats, moments, accounts, books, memos, fitness, tasks, admins,
      order: { u10001: ["moments", "bookshelf", "memo", "fitness", "tasks", "profile"] },
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
      },
      session: null,
      seq: 1,
    };
  }

  /* ---------- 加载 ---------- */
  let db;
  try {
    db = JSON.parse(localStorage.getItem(KEY));
  } catch (e) { db = null; }
  let dirty = !db || !db.users;
  if (!db || !db.users) db = seed();
  // 旧数据补齐新增字段
  ["remark", "chatHidden", "groups", "friendGroup", "friendNav"].forEach(k => {
    if (!db[k]) { db[k] = {}; dirty = true; }
  });
  if (dirty) persist();

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) {
      console.warn("persist failed", e);
      if (window.UI && UI.toast) UI.toast("本地存储空间不足，请减少本地图片后再试", "error");
    }
  }
  function save() { persist(); }

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
    db.order[id] = ["moments", "bookshelf", "memo", "fitness", "tasks", "profile"];
    persist();
    return { ok: true, user };
  }
  function logout() {
    db.session = null;
    persist();
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

  /* ---------- 资产 / 记账 ---------- */
  function listRecords(uid) {
    const r = (db.accounts[uid] || []).slice().sort((a, b) => b.t - a.t);
    return r;
  }
  function addRecord(uid, { type, cat, amount, note = "", date }) {
    const rec = { id: "a" + Date.now(), type, cat, amount: Number(amount), note, date, t: Date.now() };
    if (!db.accounts[uid]) db.accounts[uid] = [];
    db.accounts[uid].push(rec);
    persist();
    return rec;
  }
  function delRecord(uid, rid) {
    const list = db.accounts[uid] || [];
    const i = list.findIndex(r => r.id === rid);
    if (i < 0) return null;
    const removed = list.splice(i, 1)[0];
    persist();
    return removed;
  }
  function restoreRecord(uid, rec) {
    if (!rec) return;
    if (!db.accounts[uid]) db.accounts[uid] = [];
    db.accounts[uid].push(rec);
    persist();
  }
  function getSummary(uid) {
    const rs = db.accounts[uid] || [];
    let income = 0, expense = 0;
    const byCat = {};
    rs.forEach(r => {
      if (r.type === "in") income += r.amount;
      else { expense += r.amount; byCat[r.cat] = (byCat[r.cat] || 0) + r.amount; }
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
    Object.assign(db.settings, patch);
    persist();
    // 若用户没有本地主题选择，立即应用新的默认主题
    if (!localStorage.getItem("yiwo_theme") && patch.defaultTheme) {
      window.Theme && Theme.apply(patch.defaultTheme);
    }
  }

  /* ---------- 数据备份（导出 / 导入） ---------- */
  function exportBackup() {
    return JSON.stringify({ __yiwo: true, version: 2, exportedAt: Date.now(), data: db });
  }
  function importBackup(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, msg: "文件内容不是有效的 JSON" }; }
    const next = obj && obj.__yiwo ? obj.data : obj;
    if (!next || !Array.isArray(next.users)) return { ok: false, msg: "不是有效的以我备份文件" };
    ["remark", "chatHidden", "groups", "friendGroup", "friendNav"].forEach(k => { if (!next[k]) next[k] = {}; });
    db = next;
    persist();
    return { ok: true };
  }

  /* ---------- 我的页面宫格排序 ---------- */
  function getOrder(uid) { return db.order[uid] || ["moments", "bookshelf", "memo", "fitness", "tasks", "profile"]; }
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
    Object.values(db.accounts).forEach(list => {
      list.forEach(r => { totalAssets += (r.type === "in" ? 1 : -1) * r.amount; });
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

  return {
    CATS, SPORTS, PERMS, REGIONS, save,
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
    // 资产
    listRecords, addRecord, delRecord, restoreRecord, getSummary,
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
    // 排序
    getOrder, saveOrder,
    // 数据备份
    exportBackup, importBackup,
    // 管理员
    loginAdmin, listAdmins, addAdmin, updateAdmin, hasPerm,
    // 仪表盘
    dashboard,
  };
})();