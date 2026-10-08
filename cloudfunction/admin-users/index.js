'use strict';

/* ============================================================
   以我 APP · 后台用户信息同步 云函数 `admin-users`
   ------------------------------------------------------------
   【HTTP 函数 / Web 函数】形态：常驻 HTTP 服务，监听 9000 端口。
   只承担一个能力：

   读（管理后台用）  GET  /?secret=<ADMIN_SECRET>
     校验 secret 通过后，用 service_role API Key 读全表
     yiwo_admin_profiles（含 phone/age/birthday 私密字段），
     以 JSON 数组返回。

   写不需要走本函数：用户端经 RLS（id = auth.uid()）直写该表，
   数据库层面保证只能写自己那一行，比云函数验签更可靠。

   ⚠️ 环境变量（在云函数「函数配置 → 环境变量」里设置，绝不写进代码）：
     ENV_ID            ：CloudBase 环境 ID，如 yiwoapp-xxxx
     CLOUDBASE_API_KEY ：service_role 的 API Key（能绕过 RLS，只能后端用）
     ADMIN_SECRET      ：管理密钥（后台调本接口的凭证，32 位随机串）

   ⚠️ 官方约定（docs.cloudbase.net）：
     - HTTP 函数必须监听 9000 端口（PORT 环境变量由平台注入，默认 9000）
     - zip 根目录需含 scf_bootstrap 启动脚本（#!/bin/bash + node index.js）
   ============================================================ */

const http = require('http');

const ENV_ID = String(process.env.ENV_ID || '').trim();
const API_KEY = String(process.env.CLOUDBASE_API_KEY || '').trim();
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || '').trim();
const TABLE = 'yiwo_admin_profiles';
const PORT = Number(process.env.PORT) || 9000;

/* ---------- 返回 JSON ---------- */
function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(body);
}

/* ---------- CORS：管理后台部署在 GitHub Pages，跨域调用必须放行 ---------- */
function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/* ---------- 用 service_role API Key 读私密表（官方 RDB REST 网关） ----------
   GET https://<ENV_ID>.api.tcloudbasegateway.com/v1/rdb/rest/<table>?select=*&order=updated_at.desc
   Header: Authorization: Bearer <API Key>   （API Key 对应 service_role，绕过 RLS） */
async function readProfiles() {
  const url =
    'https://' + ENV_ID + '.api.tcloudbasegateway.com/v1/rdb/rest/' + TABLE +
    '?select=*&order=updated_at.desc';
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + API_KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),   // 8 秒超时，防止网关挂起拖死函数
  });
  if (!res.ok) {
    const err = new Error('rdb gateway http ' + res.status);
    err.status = 502;
    throw err;
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

const server = http.createServer(async (req, res) => {
  applyCors(res);

  // 浏览器跨域预检
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  let u;
  try { u = new URL(req.url, 'http://localhost'); } catch (e) {
    return sendJson(res, 400, { error: 'bad_request' });
  }

  // 健康检查：/ 或 /health 不带 secret 时返回存活信息（不泄露任何数据）
  if ((u.pathname === '/' || u.pathname === '/health') && !u.searchParams.get('secret')) {
    return sendJson(res, 200, { ok: true, service: 'admin-users', auth: 'required' });
  }

  // 配置检查：环境变量没配好直接明说，方便在控制台日志排查
  if (!ENV_ID || !API_KEY || !ADMIN_SECRET) {
    console.error('[admin-users] config missing: ENV_ID/API_KEY/ADMIN_SECRET');
    return sendJson(res, 500, {
      error: 'config_missing',
      msg: '缺少环境变量 ENV_ID / CLOUDBASE_API_KEY / ADMIN_SECRET（在函数配置-环境变量里设置）',
    });
  }

  // 管理密钥校验
  const secret = String(u.searchParams.get('secret') || '');
  if (secret !== ADMIN_SECRET) {
    console.warn('[admin-users] forbidden: bad secret');
    return sendJson(res, 403, { error: 'forbidden' });
  }

  try {
    const rows = await readProfiles();
    console.log('[admin-users] ok, rows=' + rows.length);
    return sendJson(res, 200, rows);
  } catch (e) {
    console.error('[admin-users] read failed:', e && e.message);
    return sendJson(res, (e && e.status) || 500, {
      error: 'read_failed',
      msg: String(e && e.message || e),
    });
  }
});

server.listen(PORT, () => {
  console.log('[admin-users] listening on port ' + PORT);
});
