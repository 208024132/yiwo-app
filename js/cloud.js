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

  let app = null, auth = null, db = null;
  let sdkPromise = null;

  function isConfigured() { return !!ENV_ID; }

  /* ---------- SDK 懒加载 ---------- */
  function loadSdk() {
    if (typeof window.cloudbase !== "undefined" && window.cloudbase) return Promise.resolve(true);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(resolve => {
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => resolve(typeof window.cloudbase !== "undefined" && !!window.cloudbase);
      s.onerror = () => { sdkPromise = null; resolve(false); };
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

  // 初始化 Promise<boolean>：未配置环境时同步为 false，零成本
  const ready = init();

  function enabled() { return isConfigured() && !!auth; }

  /* ---------- 当前登录用户 ID（异步） ---------- */
  async function getUid() {
    if (!enabled()) return "";
    try {
      const { data } = await auth.getSession();
      return (data && data.session && data.session.user && data.session.user.id) || "";
    } catch (e) { return ""; }
  }

  /* ---------- 邮箱验证码注册：第一步「发送验证码」 ----------
     v3 的 signUp({email, password}) 本身就是「发送验证码」，
     返回的 data 上带 verifyOtp，用于第二步校验并完成注册登录。 */
  let pendingVerifier = null;

  async function sendCode(email, password) {
    if (!(await ready)) return { ok: false, msg: "云端服务未启用" };
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
    if (!(await ready)) return { ok: false, msg: "云端服务未启用" };
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
    if (!(await ready)) return { ok: false, msg: "云端服务未启用" };
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

  async function signOut() {
    if (!enabled()) return;
    try { await auth.signOut(); } catch (e) { /* 忽略退出失败 */ }
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
    isConfigured, ready, init,
    sendCode, verifyCode, signIn, signOut,
    getUid, pull, push,
    pullSocial, pushSocial,
    TABLE_KV, TABLE_SOCIAL,
  };
})();