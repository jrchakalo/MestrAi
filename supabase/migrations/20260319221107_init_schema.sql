-- Enable required extensions
create extension if not exists pgcrypto;

-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  preferences_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CAMPAIGNS
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  genero text,
  tom text,
  magia text,
  tech text,
  visual_style text,
  world_bible_json jsonb default '{}'::jsonb,
  current_context_summary text,
  status text not null default 'waiting_for_players',
  max_players int not null default 5,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Safe constraint (FIX)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_status_check'
  ) THEN
    ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_status_check
    CHECK (status in ('waiting_for_players', 'active', 'paused', 'archived'));
  END IF;
END
$$;

-- CAMPAIGN PLAYERS
create table if not exists public.campaign_players (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  character_name text not null,
  character_data_json jsonb default '{}'::jsonb,
  is_turn_active boolean default false,
  status text not null default 'pending',
  is_dead boolean default false,
  death_cause text,
  death_world_future text,
  death_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (campaign_id, player_id)
);

-- MESSAGES
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  role text not null,
  content text,
  metadata jsonb default '{}'::jsonb,
  visible_to uuid[] default null,
  created_at timestamptz default now()
);

create index if not exists messages_campaign_created_at_idx
  on public.messages (campaign_id, created_at);

-- RATE LIMITS
create table if not exists public.api_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null default 0,
  updated_at timestamptz default now()
);

alter table public.api_rate_limits enable row level security;

-- FUNCTION
create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns boolean as $$
declare
  now_ts timestamptz := now();
  window_start_ts timestamptz := now_ts - make_interval(secs => p_window_seconds);
  current_count int;
  current_window timestamptz;
begin
  select window_start, count
    into current_window, current_count
    from public.api_rate_limits
    where key = p_key
    for update;

  if not found then
    insert into public.api_rate_limits(key, window_start, count)
    values (p_key, now_ts, 1);
    return false;
  end if;

  if current_window < window_start_ts then
    update public.api_rate_limits
      set window_start = now_ts,
          count = 1,
          updated_at = now_ts
      where key = p_key;
    return false;
  end if;

  if current_count >= p_limit then
    return true;
  end if;

  update public.api_rate_limits
    set count = count + 1,
        updated_at = now_ts
    where key = p_key;

  return false;
end;
$$ language plpgsql security definer set search_path = public;

-- SAFE CONSTRAINTS (MESSAGES)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_role_check') THEN
    ALTER TABLE public.messages
    ADD CONSTRAINT messages_role_check
    CHECK (role in ('user', 'assistant', 'system', 'tool'));
  END IF;
END
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_players enable row level security;
alter table public.messages enable row level security;

-- REALTIME (SAFE)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;

-- POLICY FIX (IMPORTANT BUG FIXED)
DROP POLICY IF EXISTS "messages_delete_owner" ON public.messages;

CREATE POLICY "messages_delete_owner" ON public.messages
  FOR DELETE USING (
    public.is_campaign_owner(campaign_id, auth.uid())
  );