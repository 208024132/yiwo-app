/* ============================================================
   以我APP · 云端接入层（腾讯云 CloudBase · PG 模式）
   - 未配置 ENV_ID 时：全部方法返回“未启用”，不加载任何外部脚本，应用照常纯本地可用。
   - 配置后：按需懒加载 CloudBase JS SDK v3，提供邮箱验证码注册 / 邮箱密码登录 +
     个人数据读写（PostgreSQL + PostgREST + RLS，通过 app.rdb() 访问）。
   - 本文件不依赖其它脚本，可在 store.js 之后任意位置引入。
   ============================================================ */
window.Cloud = (() => {
  /* ==== 配置：腾讯云 CloudBase 控制台环境 ID / 前端 Publishable Key ==== */
  const ENV_ID = "yiwoapp-d9g9zythq6a6cee08";
  const REGION = "ap-shanghai";
  const ACCESS_KEY = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjM3ZWNkMzI1LTQ3YWUtNDI1My05MjMzLTE2OWRhZjU2NjBlZSJ9.eyJpc3MiOiJodHRwczovL3lpd29hcHAtZDlnOXp5dGhxNmE2Y2VlMDguYXAtc2hhbmdoYWkudGNiLWFwaS50ZW5jZW50Y2xvdWRhcGkuY29tIiwic3ViIjoiYW5vbiIsImF1ZCI6Inlpd29hcHAtZDlnOXp5dGhxNmE2Y2VlMDgiLCJleHAiOjQwOTUwMzU2ODYsImlhdCI6MTc5MTM1MjQ4Niwibm9uY2UiOiIwbnVqMjZlUVRndUE3ZEhOcGtEXzNBIiwiYXRfaGFzaCI6IjBudWoyNmVRVGd1QTdkSE5wa0RfM0EiLCJuYW1lIjoiQW5vbnltb3VzIiwic2NvcGUiOiJhbm9ueW1vdXMiLCJwcm9qZWN0X2lkIjoieWl3b2FwcC1kOWc5enl0aHE2YTZjZWUwOCIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.DHsCRNuZYjYIH1nOikNeQJX4qkkpuUXjGA57M1nLOzN-8iGX6jx-6QYVKynZR56tu7K6BRKOKXxWKi52lRf7b0aSvJSSMOiX2bRwpQIqHbeKi7St5-2zyK0ObjtlEnrCu3S6D4z-ocXnYzASbjOR_IdlDMCf5szjfHzCh2mv3fCM63wluzoebxvv7WiKr2W8WKzvDNPVVRR_sUIUSq8KviaTm7tjVcN86yLyPuGQLBphp3t-rjtotuTbCIxLodw8sgijAPvt4Mx65q13zSoFWdo_q39K2xOmQ0eqcXU0ic3wLMiunQ94y5FqN40A6POPtHzQABJCBtJwqbgbZbOewA";

  const SDK_URL = "https://static.cloudbase.net/cloudbase-js-sdk/3.10.1/cloudbase.full.js";
  const TABLE_KV = "yiwo_kv";    // 每个用户一行：id = 用户 ID，data = 个人数据整包
  const TABLE_SOCIAL = "yiwo_social"; // 社交记录：一行一条（好友边/好友申请/会话/动态）
  const TABLE_USERS = "yiwo_users"; // 全站用户目录：每人一行公开档案，RLS read-all / 本人可写

  // 管理员私密档案表：用户本人经 RLS（id = auth.uid()）直写，后台经云函数读全表。
  const TABLE_ADMIN = "yiwo_admin_profiles";

  let app = null, auth = null, db = null;
  let sdkPromise = null;

  function isConfigured() { return !!ENV_ID; }

  /* ---------- SDK 懒加载（带 8s 超时兜底） ----------
     网络抖动时 <script> 可能既不 onload 也不 onerror（挂起），
     没有超时会让 signIn 永远等待、按钮永远禁用。 */
  function loadSdk() {
    if (typeof window.cloudbase !== "undefined" && window.cloudbase) return Promise.resolve(true);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(resolve => {
      const s = document.createElement("script");
      let settled = false;
      const finish = ok => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok) sdkPromise = null;   // 失败清空，允许下次调用重新加载
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 8000);
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => finish(typeof window.cloudbase !== "undefined" && !!window.cloudbase);
      s.onerror = () => finish(false);
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  /* ---------- 初始化（幂等） ---------- */
  async function init() {
    if (!isConfigured()) return false;
    if (app) return true;
    if (!(await loadSdk())) return false;
    try {
      app = window.cloudbase.init({
        env: ENV_ID,
        region: REGION,
        accessKey: ACCESS_KEY,
        auth: { detectSessionInUrl: true },
      });
      // v3 文档用 app.auth（属性），控制台示例用 app.auth()（方法），两种都兼容
      auth = (typeof app.auth === "function") ? app.auth() : app.auth;
      db = (typeof app.rdb === "function") ? app.rdb() : null;
      return true;
    } catch (e) {
      app = auth = db = null;
      return false;
    }
  }

  /* ---------- 初始化（幂等 + 失败可重试） ----------
     旧版 `const ready = init()` 是一次性 Promise：页面加载瞬间若网络抖动导致
     SDK 脚本加载失败，本页会话将永远返回「云端服务未启用」，用户只能整页刷新。
     改为 ensureInit()：初始化失败后，下一次调用（如再点一次登录）会自动重试。 */
  let initPromise = null;
  let initFailed = false;
  function ensureInit() {
    if (app) return Promise.resolve(true);
    if (!isConfigured()) return Promise.resolve(false);
    if (!initPromise || initFailed) {
      initFailed = false;
      initPromise = init().then(ok => {
        if (!ok) initFailed = true;   // 标记失败，下次 ensureInit() 重新走一遍
        return ok;
      });
    }
    return initPromise;
  }
  // 兼容旧引用（cloud-sync 旧版 boot 用 Cloud.ready）：保留启动即预热一次
  const ready = ensureInit();

  /** 供外部等待云端就绪（可重试版） */
  function ensureReady() { return ensureInit(); }

  function enabled() { return isConfigured() && !!auth; }

  /* ---------- 当前登录用户 ID（异步） ---------- */
  async function getUid() {
    if (!enabled()) return "";
    try {
      const { data } = await auth.getSession();
      return (data && data.session && data.session.user && data.session.user.id) || "";
    } catch (e) { return ""; }
  }

  /* ---------- 当前登录用户的邮箱（用于给本地骨架档案补账号/昵称） ---------- */
  async function getEmail() {
    if (!enabled()) return "";
    try {
      const { data } = await auth.getSession();
      return (data && data.session && data.session.user && data.session.user.email) || "";
    } catch (e) { return ""; }
  }

  /* ---------- 邮箱验证码注册：第一步「发送验证码」 ----------
     v3 的 signUp({email, password}) 本身就是「发送验证码」，
     返回的 data 上带 verifyOtp，用于第二步校验并完成注册登录。 */
  let pendingVerifier = null;
  let pendingReset = null;

  async function sendCode(email, password) {
    if (!isConfigured()) return { ok: false, msg: "云端服务未启用" };
    if (!(await ensureInit())) return { ok: false, msg: "云端连接失败，请检查网络后重试" };
    const mail = String(email || "").trim();
    if (!mail) return { ok: false, msg: "请输入邮箱" };
    if (!password) return { ok: false, msg: "请先填写密码" };
    try {
      const { data, error } = await auth.signUp({ email: mail, password: String(password) });
      if (error) return { ok: false, msg: errMsg(error, "验证码发送失败，请稍后重试") };
      pendingVerifier = data;
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: errMsg(e, "验证码发送失败，请稍后重试") };
    }
  }

  /* ---------- 邮箱验证码注册：第二步「校验验证码」 → 完成注册并登录 ---------- */
  async function verifyCode(code) {
    if (!isConfigured()) return { ok: false, msg: "云端服务未启用" };
    if (!(await ensureInit())) return { ok: false, msg: "云端连接失败，请检查网络后重试" };
    if (!pendingVerifier) return { ok: false, msg: "请先点击「发送验证码」" };
    try {
      const { data, error } = await pendingVerifier.verifyOtp({ token: String(code || "").trim() });
      if (error) return { ok: false, msg: errMsg(error, "验证码不正确或已失效") };
      const uid = (data && data.user && data.user.id) || (await getUid());
      if (!uid) return { ok: false, msg: "注册失败，请稍后重试" };
      pendingVerifier = null;
      return { ok: true, uid };
    } catch (e) {
      return { ok: false, msg: errMsg(e, "验证码不正确或已失效") };
    }
  }

  /* ---------- 邮箱 + 密码登录 ---------- */
  async function signIn(email, password) {
    if (!isConfigured()) return { ok: false, msg: "云端服务未启用" };
    if (!(await ensureInit())) return { ok: false, msg: "云端连接失败，请检查网络后重试" };
    try {
      const { data, error } = await auth.signInWithPassword({
        email: String(email || "").trim(),
        password: String(password || ""),
      });
      if (error) return { ok: false, msg: errMsg(error, "账号或密码不正确") };
      const uid = (data && data.user && data.user.id) || (await getUid());
      if (!uid) return { ok: false, msg: "登录失败，请稍后重试" };
      return { ok: true, uid };
    } catch (e) {
      return { ok: false, msg: errMsg(e, "账号或密码不正确") };
    }
  }

  /* ---------- 忘记密码：发送重置验证码（CloudBase v3 的 resetPasswordForEmail） ----------
     v3 的 resetPasswordForEmail(email) 会向邮箱发送验证码，返回的 data 上带 updateUser，
     用于第二步校验验证码并写入新密码（等价 Supabase 的 PASSWORD_RECOVERY 流程）。 */
  async function sendResetCode(email) {
    if (!isConfigured()) return { ok: false, msg: "云端服务未启用" };
    if (!(await ensureInit())) return { ok: false, msg: "云端连接失败，请检查网络后重试" };
    if (typeof auth.resetPasswordForEmail !== "function") return { ok: false, msg: "当前云端版本暂不支持邮箱找回密码，请稍后重试" };
    const mail = String(email || "").trim();
    if (!mail) return { ok: false, msg: "请输入邮箱" };
    try {
      const { data, error } = await auth.resetPasswordForEmail(mail);
      if (error) return { ok: false, msg: errMsg(error, "验证码发送失败，请稍后重试") };
      pendingReset = data;
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: errMsg(e, "验证码发送失败，请稍后重试") };
    }
  }

  /* ---------- 忘记密码：校验验证码并设置新密码 ---------- */
  async function resetPassword(code, newPassword) {
    if (!isConfigured()) return { ok: false, msg: "云端服务未启用" };
    if (!(await ensureInit())) return { ok: false, msg: "云端连接失败，请检查网络后重试" };
    if (!pendingReset) return { ok: false, msg: "请先点击「发送验证码」" };
    const pwd = String(newPassword || "");
    if (pwd.length < 8) return { ok: false, msg: "新密码至少 8 位" };
    if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) return { ok: false, msg: "新密码需同时包含字母和数字" };
    try {
      const { data, error } = await pendingReset.updateUser({ nonce: String(code || "").trim(), password: pwd });
      if (error) return { ok: false, msg: errMsg(error, "验证码不正确或已失效") };
      pendingReset = null;
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: errMsg(e, "验证码不正确或已失效") };
    }
  }

  async function signOut() {
    if (!enabled()) return;
    try { await auth.signOut(); } catch (e) { /* 忽略退出失败 */ }
  }

  /* ---------- 注销当前账号（敏感操作，需二次认证） ----------
     CloudBase v3 身份认证支持删除当前账号（HTTP DELETE /auth/v1/user/me），
     Web SDK 侧方法名因版本略有差异，这里做防御式探测：
     1) 优先 auth.deleteUser({ password })（部分版本直接支持）；
     2) 其次 auth.sudo({ password }) 获取 sudo_token 后调用 auth.deleteMe({ sudo_token })；
     3) 均不支持时返回 notSupported，由调用方降级为「清空本地 + 提示联系管理员」。 */
  async function deleteMe(password) {
    if (!isConfigured()) return { ok: false, msg: "云端服务未启用" };
    if (!(await ensureInit())) return { ok: false, msg: "云端连接失败，请检查网络后重试" };
    const pwd = String(password || "");
    try {
      if (typeof auth.deleteUser === "function") {
        const { error } = await auth.deleteUser({ password: pwd });
        if (error) return { ok: false, msg: errMsg(error, "注销失败，请确认密码正确后重试") };
        return { ok: true };
      }
      if (typeof auth.deleteMe === "function") {
        let token = "";
        if (typeof auth.sudo === "function" && pwd) {
          try {
            const sr = await auth.sudo({ password: pwd });
            token = String((sr && ((sr.data && sr.data.sudo_token) || sr.sudo_token)) || "");
          } catch (e) { /* 拿不到 sudo_token 时仍尝试 deleteMe，由错误提示兜底 */ }
        }
        const { error } = await auth.deleteMe(token ? { sudo_token: token } : {});
        if (error) return { ok: false, msg: errMsg(error, "注销失败，请稍后重试") };
        return { ok: true };
      }
      return { ok: false, notSupported: true, msg: "当前云端版本暂不支持自助注销" };
    } catch (e) {
      return { ok: false, msg: errMsg(e, "注销失败，请稍后重试") };
    }
  }

  /* ---------- 全站用户目录（yiwo_users：RLS read-all 公开档案，本人可写自己那行） ----------
     防御式：表尚未建好 / 无权限 / 查询报错时，一律返回空/失败，绝不抛未捕获异常。 */

  // 按 id 去重（三列搜索结果可能命中同一行）
  function dedupeUsers(rows) {
    const seen = {}, out = [];
    (Array.isArray(rows) ? rows : []).forEach(r => {
      if (!r || !r.id) return;
      const id = String(r.id);
      if (seen[id]) return;
      seen[id] = 1;
      out.push(r);
    });
    return out;
  }

  // 把用户输入里的 LIKE 通配符转义成字面量，避免 `%`/`_`/`\` 被当成通配符
  function escapeLike(s) {
    return String(s == null ? "" : s).replace(/[\\%_]/g, m => "\\" + m);
  }

  /** 全站搜索用户（昵称/ID/账号 模糊匹配，最多 20 条）。 */
  async function searchUsers(q) {
    if (!enabled() || !db) return [];
    const key = String(q || "").trim();
    if (!key) return [];
    const like = "%" + escapeLike(key) + "%";
    const cols = ["nickname", "account", "id"];

    // 不使用 .or()：CloudBase rdb 对 or 内 like/ilike 的通配符约定（% 还是 *）无法在
    // 本地仓库里确定，且无法连真库验证。改成分列 ilike + 前端按 id 去重，语义等价、兼容性更稳。
    const hasOp = op => typeof db.from(TABLE_USERS).select("*")[op] === "function";
    const op = hasOp("ilike") ? "ilike" : (hasOp("like") ? "like" : "");
    if (!op) return [];

    const parts = await Promise.all(cols.map(async col => {
      try {
        const res = await db.from(TABLE_USERS).select("*")[op](col, like).limit(20);
        return (res && !res.error && Array.isArray(res.data)) ? res.data : [];
      } catch (e) { return []; }   // 表不存在 / 该操作符不支持 / 该列不存在，一律忽略
    }));
    return dedupeUsers([].concat(...parts)).slice(0, 20);
  }

  /** 拉取单个用户的公开档案 -> 行对象 | null */
  async function getUserProfile(id) {
    if (!enabled() || !db || !id) return null;
    try {
      const { data, error } = await db.from(TABLE_USERS).select("*").eq("id", String(id));
      if (error) return null;
      return (data && data[0]) || null;
    } catch (e) { return null; }
  }

  /** 写入/更新本人的公开档案（RLS 保证只能写自己那行；失败静默） */
  async function upsertMyProfile(profile) {
    if (!enabled() || !db || !profile || !profile.id) return false;
    try {
      const { error } = await db.from(TABLE_USERS).upsert(profile, { onConflict: "id" });
      return !error;
    } catch (e) { return false; }
  }

  /** 批量拉取多个用户的公开档案（ids 为字符串数组，最多 200） */
  async function listUserProfiles(ids) {
    if (!enabled() || !db || !Array.isArray(ids) || !ids.length) return [];
    const uniq = [...new Set(ids.map(String).filter(Boolean))].slice(0, 200);
    if (!uniq.length) return [];
    const builder = db.from(TABLE_USERS).select("*");
    if (typeof builder.in === "function") {
      try {
        const { data, error } = await builder.in("id", uniq);
        if (error) return [];
        return Array.isArray(data) ? data : [];
      } catch (e) { return []; }
    }
    // 降级：不支持 .in 时逐条 eq（仍静默失败）
    const rows = [];
    for (const id of uniq) {
      try {
        const { data, error } = await db.from(TABLE_USERS).select("*").eq("id", id);
        if (!error && data && data[0]) rows.push(data[0]);
      } catch (e) { /* ignore */ }
    }
    return rows;
  }

  /* ---------- 管理员私密档案（yiwo_admin_profiles，RLS 本人直写） ----------
     该表对 authenticated 开放「只能读写自己那一行」的 RLS 策略（id = auth.uid()），
     用户端直写即可，身份由数据库兜底，无需把 JWT 交给云函数验签。
     后台读全表走云函数 admin-users（service_role，绕 RLS）。 */

  /** 写本人完整档案（含 phone/age/birthday）到 yiwo_admin_profiles（RLS 保证只能写自己那行）。
      返回 true/false；失败静默——私密档案上云失败不影响 kv/社交主同步。 */
  async function upsertAdminProfile(profile) {
    if (!isConfigured() || !profile || !profile.id) return false;
    try {
      if (!(await ensureInit()) || !db) return false;
      const row = Object.assign({}, profile, {
        id: String(profile.id),
        updated_at: Number(profile.updated_at) || Date.now(),
      });
      const { error } = await db.from(TABLE_ADMIN).upsert(row, { onConflict: "id" });
      return !error;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 数据读写（PostgreSQL：yiwo_kv 单表，RLS 按 owner_id 隔离） ---------- */

  /** 拉取某用户的云端数据包 -> { updatedAt, payload } | null */
  async function pull(uid) {
    if (!enabled() || !db || !uid) return null;
    try {
      const { data, error } = await db.from(TABLE_KV).select("*").eq("id", uid);
      if (error) return null;
      const row = (data && data[0]) || null;
      if (!row) return { updatedAt: 0, payload: null };   // 查询成功但云端还没有数据
      return { updatedAt: Number(row.updated_at) || 0, payload: row.data || null };
    } catch (e) {
      return null;   // 无权限 / 无数据，一律当作“云端无数据”
    }
  }

  /** 写入某用户的数据包（存在则更新，不存在则插入，成功返回 true） */
  async function push(uid, payload, updatedAt) {
    if (!enabled() || !db || !uid) return false;
    try {
      const { error } = await db.from(TABLE_KV).upsert(
        { id: uid, updated_at: Number(updatedAt) || Date.now(), data: payload },
        { onConflict: "id" }
      );
      return !error;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 社交数据读写（yiwo_social：RLS 已按 members 过滤，故无需前端条件） ---------- */

  /** 拉取当前用户可见的社交记录 -> 数组 | null（失败返回 null 表示“无法连接”） */
  async function pullSocial() {
    if (!enabled() || !db) return null;
    try {
      const { data, error } = await db.from(TABLE_SOCIAL).select("*");
      if (error) return null;
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return null;
    }
  }

  /** 写入社交记录（按 id 批量 upsert；批量失败则逐条重试，成功返回 true） */
  async function pushSocial(rows) {
    if (!enabled() || !db || !Array.isArray(rows) || !rows.length) return true;
    try {
      const { error } = await db.from(TABLE_SOCIAL).upsert(rows, { onConflict: "id" });
      if (!error) return true;
    } catch (e) { /* 落到逐条补偿 */ }
    let ok = true;
    for (let i = 0; i < rows.length; i++) {
      try {
        const { error } = await db.from(TABLE_SOCIAL).upsert(rows[i], { onConflict: "id" });
        if (error) ok = false;
      } catch (e) { ok = false; }
    }
    return ok;
  }

  /* ---------- 错误信息中文化 ---------- */
  function errMsg(e, fallback) {
    const m = String((e && (e.message || e.error_description || e.errMsg || e.msg || e.details)) || "");
    if (!m) return fallback;
    if (/password/i.test(m) && /(invalid|incorrect|wrong|not\s*match|at least|too short)/i.test(m)) return "密码不符合要求，请设置 8 位以上含字母和数字的密码";
    if (/email/i.test(m) && /(invalid|not\s*valid|format)/i.test(m)) return "邮箱格式不正确";
    if (/(already|exist|registered)/i.test(m)) return "该邮箱已注册，请直接登录";
    if (/verification|verify|otp|验证码|token/i.test(m)) return "验证码不正确或已失效";
    if (/(rate|too many|频繁|frequency|exhausted)/i.test(m)) return "操作过于频繁，请稍后再试";
    if (/(not\s*found|不存在|no user)/i.test(m)) return "账号不存在，请先注册";
    if (/(network|timeout|fetch|failed to fetch|load failed)/i.test(m)) return "网络异常，请检查网络后重试";
    // 未归类的错误不吞掉：带上服务端原文，便于定位（例如「凭据验证失败」）
    return fallback + "（" + m + "）";
  }

  return {
    isConfigured, ready, ensureReady, init,
    sendCode, verifyCode, signIn, signOut, deleteMe,
    sendResetCode, resetPassword,
    getUid, getEmail, pull, push,
    pullSocial, pushSocial,
    searchUsers, getUserProfile, upsertMyProfile, listUserProfiles,
    upsertAdminProfile,
    TABLE_KV, TABLE_SOCIAL, TABLE_USERS, TABLE_ADMIN,
  };
})();
