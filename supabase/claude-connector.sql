-- Claude connector: personal keys for the apex-mcp Edge Function.
-- Run once in Supabase: SQL Editor → New query → paste → Run (also included in schema.sql).
-- Only the SHA-256 of a key is stored; the app makes the key, the function looks the user up by its hash.
create table if not exists public.mcp_tokens (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now()
);
alter table public.mcp_tokens enable row level security;
drop policy if exists "mcp_tokens: own only" on public.mcp_tokens;
create policy "mcp_tokens: own only" on public.mcp_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
