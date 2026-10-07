-- Apex Planner OS — Supabase schema.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Row-level security: each user reads/writes only their own data;
-- the leaderboard shows only best sets of users who keep "public" on.

-- Public profile (name in the leaderboard, weekly volume)
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  username    text unique not null check (char_length(username) between 2 and 24),
  public      boolean not null default true,
  bodyweight  numeric check (bodyweight between 20 and 400),
  week_start  date,
  week_volume numeric not null default 0 check (week_volume >= 0),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read public or own" on public.profiles
  for select to authenticated using (public or id = auth.uid());
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Private app data, split into documents (one per key, dated data per month)
create table if not exists public.user_state (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  doc        text not null check (char_length(doc) <= 64),
  data       jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc)
);
alter table public.user_state enable row level security;
create policy "user_state: own only" on public.user_state
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Best set per exercise, for the leaderboard
create table if not exists public.lifts (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  exercise    text not null check (char_length(exercise) <= 80),  -- normalized (lowercase) name
  name        text not null check (char_length(name) <= 80),      -- name as typed
  e1rm        numeric not null check (e1rm > 0 and e1rm < 1000),
  weight      numeric check (weight >= 0 and weight < 1000),
  reps        int check (reps between 1 and 100),
  bodyweight  numeric,
  achieved_on date,
  updated_at  timestamptz not null default now(),
  primary key (user_id, exercise)
);
alter table public.lifts enable row level security;
create policy "lifts: read if owner is public" on public.lifts
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = user_id and (p.public or p.id = auth.uid())));
create policy "lifts: insert own" on public.lifts
  for insert to authenticated with check (user_id = auth.uid());
create policy "lifts: update own" on public.lifts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "lifts: delete own" on public.lifts
  for delete to authenticated using (user_id = auth.uid());

-- Live sync between the user's devices
alter publication supabase_realtime add table public.user_state;
