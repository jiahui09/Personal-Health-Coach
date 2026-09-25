-- 个人健康手记 · Supabase 建表脚本（免费档可用）
--
-- 用法：Supabase Dashboard → SQL Editor → 粘贴执行（一次即可）。
-- 设计原则：
--   1. 全表 user_id uuid，RLS 只允许 auth.uid() = user_id（多设备共享同一账号，互不可见）。
--   2. 只存「原始记录」：体重、每日体征、膳食、训练、待办、体征档。
--      统计（BMI / RMR / TDEE / 目标热量与蛋白 / 抗阻周目标 / 趋势与情景外推）一律由
--      客户端 domain/ 纯函数现算，不落库 —— 避免派生值与原始值漂移。
--   3. 单位与语义固定：体重 kg、时长分钟、热量 kcal、蛋白 g、身高 cm、腰围 cm。
--
-- 免费档提示：本 schema 只有 6 张表 + 少量索引，单用户十年数据也在数十 MB 量级。

-- ---------- 扩展（gen_random_uuid） ----------
create extension if not exists pgcrypto;

-- ---------- 1. 体征档（Raw：你告诉我的原始事实） ----------
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  name           text,
  sex            text check (sex in ('female', 'male', 'other')),
  birth_year     integer check (birth_year between 1900 and 2200),
  height_cm      numeric(5, 1) check (height_cm between 100 and 250),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  waist_cm       numeric(5, 1) check (waist_cm between 40 and 200),
  goal           text check (goal in ('fat loss', 'maintain', 'muscle gain', 'general fitness')),
  goal_source    text check (goal_source in ('user', 'advice')),
  updated_at     timestamptz not null default now()
);

-- ---------- 2. 体重（同日可多条 → 当日代表值取最新一条） ----------
create table if not exists public.weight_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  measured_on date not null,
  measured_at time,
  weight_kg   numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 500),
  source      text not null default 'manual' check (source in ('manual', 'scale')),
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists weight_records_user_day_idx
  on public.weight_records (user_id, measured_on desc);

-- ---------- 3. 每日体征（睡眠为判别联合：区间 or 手录眠时） ----------
create table if not exists public.daily_states (
  user_id            uuid not null references auth.users (id) on delete cascade,
  on_date            date not null,
  sleep_start        time,            -- interval 分支
  sleep_wake         time,            -- interval 分支
  sleep_minutes      integer check (sleep_minutes is null or (sleep_minutes > 0 and sleep_minutes <= 1440)), -- duration 分支
  energy             integer check (energy is null or energy between 1 and 5),
  soreness           integer check (soreness is null or soreness between 1 and 5),
  notes              text,
  primary key (user_id, on_date),
  -- 两个分支互斥：要么给就寝/起身,要么给手录眠时
  constraint daily_states_sleep_exclusive check (
    (sleep_start is not null and sleep_wake is not null and sleep_minutes is null)
    or (sleep_start is null and sleep_wake is null)
  )
);

-- ---------- 4. 膳食（实际入账；建议膳须确认后才写入） ----------
create table if not exists public.meals (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  eaten_on           date not null,
  eaten_at           time not null default '00:00',
  category           text not null check (category in ('breakfast', 'lunch', 'dinner', 'snack')),
  name               text not null,
  foods              text[] not null default '{}',
  calories_kcal      numeric(7, 1) not null default 0 check (calories_kcal >= 0),
  protein_g          numeric(6, 1) not null default 0 check (protein_g >= 0),
  source             text not null default 'manual' check (source in ('manual', 'suggested', 'database')),
  confirmed          boolean not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists meals_user_day_idx on public.meals (user_id, eaten_on desc);

-- ---------- 5. 训练（类别是结构化事实,抗阻统计只认它） ----------
create table if not exists public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  performed_on     date not null,
  performed_at     time not null default '00:00',
  title            text not null,
  duration_minutes integer not null default 0 check (duration_minutes >= 0 and duration_minutes <= 600),
  duration_source  text not null default 'estimated' check (duration_source in ('actual', 'estimated')),
  category         text not null default 'resistance'
                     check (category in ('resistance', 'recovery', 'cardio', 'mobility', 'other')),
  exercises        jsonb not null default '[]'::jsonb,
  perceived_difficulty text check (perceived_difficulty in ('light', 'moderate', 'challenging')),
  completed        boolean not null default true,
  feeling          text,
  created_at       timestamptz not null default now()
);
create index if not exists workout_sessions_user_day_idx
  on public.workout_sessions (user_id, performed_on desc);

-- ---------- 6. 今日之事（待办；完成与否只看 status） ----------
create table if not exists public.todos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  on_date           date not null,
  title             text not null,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  priority          text check (priority in ('low', 'medium', 'high')),
  status            text not null default 'todo' check (status in ('todo', 'done', 'skipped')),
  category          text check (category in ('workout', 'reading', 'work', 'life')),
  created_at        timestamptz not null default now()
);
create index if not exists todos_user_day_idx on public.todos (user_id, on_date desc);

-- ============================================================
-- RLS：每张表都只认「本人」
-- ============================================================
alter table public.profiles          enable row level security;
alter table public.weight_records    enable row level security;
alter table public.daily_states      enable row level security;
alter table public.meals             enable row level security;
alter table public.workout_sessions  enable row level security;
alter table public.todos             enable row level security;

-- profiles：user_id 即主键
drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 其余五表：同一套四条策略（select / insert / update / delete）
do $$
declare t text;
begin
  foreach t in array array['weight_records', 'daily_states', 'meals', 'workout_sessions', 'todos']
  loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format(
      'create policy %I_owner on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- 验证（部署后自查）
-- ============================================================
-- 1) 表与策略是否齐备：
--    select tablename, rowsecurity from pg_tables where schemaname = 'public';
--    select tablename, policyname from pg_policies where schemaname = 'public';
-- 2) 越权测试（应返回空,而不是他人的行）：
--    以 A 账号写入一条体重后,用 B 账号执行
--    curl "$VITE_SUPABASE_URL/rest/v1/weight_records?select=*" \
--         -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer <B 的 access_token>"
--    → 期望 []（若返回 A 的行,说明 RLS 未生效,立即停止部署）
