-- ============================================================
-- 以我 APP · 后台用户信息同步 —— 管理员私密档案表
-- 表名：public.yiwo_admin_profiles
-- 用途：保存全站用户的完整档案（含手机号/年龄/生日等私密字段）。
-- 权限模型（双层）：
--   ① 普通登录用户（authenticated）：RLS 策略限定「只能读写自己那一行」
--      （id = auth.uid()），用户端改资料后直写本表，数据库层面杜绝越权。
--   ② 云函数 admin-users（API Key = service_role）：绕过 RLS 读全表，
--      供管理后台查看。API Key 只放云函数环境变量，绝不进前端。
-- 执行位置：CloudBase 控制台 → SQL 数据库 → SQL 编辑器
-- ============================================================

create table if not exists public.yiwo_admin_profiles (
  id            varchar(64) primary key,          -- 用户 ID（与 CloudBase auth 用户 id 一致，text 类型可比较 auth.uid()）
  account       text default '',                  -- 邮箱账号
  nickname      text default '',                  -- 昵称
  avatar_emoji  text default '🙂',                -- 头像 emoji
  avatar_color  int  default 0,                   -- 头像配色索引（0-7）
  signature     text default '',                  -- 个性签名
  gender        text default '保密',              -- 性别：男 / 女 / 保密
  region        text default '',                  -- 地区
  phone         text default '',                  -- 手机号（私密）
  age           int  default 0,                   -- 年龄（私密）
  birthday      text default '',                  -- 生日（私密）
  updated_at    bigint default 0                  -- 最近更新时间（毫秒时间戳）
);

-- 最近更新时间倒序是后台读接口的默认排序，建索引避免全表扫描
create index if not exists idx_yiwo_admin_profiles_updated
  on public.yiwo_admin_profiles (updated_at desc);

-- 开启 RLS（行级安全）
alter table public.yiwo_admin_profiles enable row level security;

-- ① 用户本人策略：只能 SELECT / INSERT / UPDATE「自己那一行」（id = auth.uid()）
--    注意：id 列是 varchar(64)，与 auth.uid() 返回的 text 直接比较即可（勿用 uuid）。
create policy admin_profiles_select_own on public.yiwo_admin_profiles
  for select to authenticated
  using (id = auth.uid());

create policy admin_profiles_insert_own on public.yiwo_admin_profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy admin_profiles_update_own on public.yiwo_admin_profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ② 表权限层授权（RLS 策略必须配 GRANT 才生效）：
--    authenticated：本人行的读写（配合上面的策略）
--    service_role  ：全权（云函数读全表用，绕过 RLS）
grant select, insert, update on public.yiwo_admin_profiles to authenticated;
grant select, insert, update, delete on public.yiwo_admin_profiles to service_role;

-- 可选：如果后续要回收/重建，用下面语句清理（默认注释，不执行）
-- drop table if exists public.yiwo_admin_profiles cascade;
