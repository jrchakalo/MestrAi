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
  genre text,
  system_name text,
  visual_style text,
  world_bible_json jsonb default '{}'::jsonb,
  current_context_summary text,
  status text not null default 'waiting_for_players',
  max_players int not null default 5,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure column exists on existing databases
alter table public.campaigns
  add column if not exists max_players int not null default 5;

alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('waiting_for_players', 'active', 'paused', 'archived'));

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

alter table public.campaign_players
  add column if not exists is_dead boolean default false;

alter table public.campaign_players
  add column if not exists death_cause text;

alter table public.campaign_players
  add column if not exists death_world_future text;

alter table public.campaign_players
  add column if not exists death_at timestamptz;

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

create index if not exists campaign_players_campaign_id_idx
  on public.campaign_players (campaign_id);

-- RATE LIMITS
create table if not exists public.api_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null default 0,
  updated_at timestamptz default now()
);

alter table public.api_rate_limits enable row level security;

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

revoke all on function public.check_rate_limit(text, int, int) from public;

alter table public.messages
  add constraint messages_role_check
  check (role in ('user', 'assistant', 'system', 'tool'));

alter table public.messages
  drop constraint if exists messages_metadata_check;

alter table public.messages
  add constraint messages_metadata_check
  check (
    jsonb_typeof(metadata) = 'object' and
    (
      (metadata ? 'type') is false or
      (metadata->>'type') in ('text', 'image', 'system', 'death_event')
    ) and
    (
      (metadata ? 'action') is false or
      (metadata->>'action') in (
        'accept',
        'ban',
        'remove',
        'join_request',
        'reject_note',
        'pause',
        'resume',
        'motd',
        'turn_start',
        'turn_action',
        'turn_advance',
        'turn_end',
        'turn_summary'
      )
    )
  );

alter table public.messages
  add constraint messages_content_length_check
  check (content is null or length(content) <= 4000);

alter table public.messages
  add constraint messages_visible_to_check
  check (
    visible_to is null OR
    array_length(visible_to, 1) > 0
  );

-- ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_players enable row level security;
alter table public.messages enable row level security;

-- REALTIME PUBLICATION
alter publication supabase_realtime add table public.campaigns;
alter publication supabase_realtime add table public.campaign_players;
alter publication supabase_realtime add table public.messages;

-- PROFILES POLICIES
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- RLS HELPERS (avoid recursive policies)
create or replace function public.is_campaign_owner(campaign_id uuid, user_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.campaigns c
    where c.id = campaign_id
      and c.owner_id = user_id
  );
$$ language sql security definer set search_path = public;

revoke all on function public.is_campaign_owner(uuid, uuid) from public;
grant execute on function public.is_campaign_owner(uuid, uuid) to authenticated;

create or replace function public.is_campaign_player(campaign_id uuid, user_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.campaign_players cp
    where cp.campaign_id = campaign_id
      and cp.player_id = user_id
  );
$$ language sql security definer set search_path = public;

revoke all on function public.is_campaign_player(uuid, uuid) from public;
grant execute on function public.is_campaign_player(uuid, uuid) to authenticated;

create or replace function public.is_campaign_member(campaign_id uuid, user_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.campaign_players cp
    where cp.campaign_id = campaign_id
      and cp.player_id = user_id
      and cp.status = 'accepted'
  );
$$ language sql security definer set search_path = public;

revoke all on function public.is_campaign_member(uuid, uuid) from public;
grant execute on function public.is_campaign_member(uuid, uuid) to authenticated;

-- CAMPAIGNS POLICIES
create policy "campaigns_select_owner" on public.campaigns
  for select using (auth.uid() = owner_id);

drop policy if exists "campaigns_select_authenticated" on public.campaigns;

create policy "campaigns_select_member" on public.campaigns
  for select using (
    auth.uid() = owner_id OR
    public.is_campaign_player(id, auth.uid())
  );

create policy "campaigns_insert_owner" on public.campaigns
  for insert with check (auth.uid() = owner_id);

create policy "campaigns_update_owner" on public.campaigns
  for update using (auth.uid() = owner_id);

create policy "campaigns_delete_owner" on public.campaigns
  for delete using (auth.uid() = owner_id);

create or replace function public.get_campaign_public(campaign_id uuid)
returns table(
  id uuid,
  title text,
  system_name text,
  genre text,
  visual_style text,
  world_bible_json jsonb,
  status text,
  max_players int,
  owner_id uuid
) as $$
  select c.id, c.title, c.system_name, c.genre, c.visual_style, c.world_bible_json, c.status, c.max_players, c.owner_id
  from public.campaigns c
  where c.id = $1;
$$ language sql security definer set search_path = public;

revoke all on function public.get_campaign_public(uuid) from public;
grant execute on function public.get_campaign_public(uuid) to authenticated;

-- CAMPAIGN PLAYERS POLICIES
drop policy if exists "campaign_players_select" on public.campaign_players;

create policy "campaign_players_select" on public.campaign_players
  for select using (
    auth.uid() = player_id OR
    public.is_campaign_owner(campaign_id, auth.uid())
  );

create or replace function public.campaign_player_counts(campaign_id uuid)
returns table(pending_count int, accepted_count int) as $$
  select
    count(*) filter (where status = 'pending')::int as pending_count,
    count(*) filter (where status = 'accepted')::int as accepted_count
  from public.campaign_players
  where campaign_players.campaign_id = $1;
$$ language sql security definer set search_path = public;

revoke all on function public.campaign_player_counts(uuid) from public;
grant execute on function public.campaign_player_counts(uuid) to authenticated;

create policy "campaign_players_insert" on public.campaign_players
  for insert with check (
    auth.uid() = player_id OR
    public.is_campaign_owner(campaign_id, auth.uid())
  );

drop policy if exists "campaign_players_update" on public.campaign_players;
drop policy if exists "campaign_players_update_self_pending" on public.campaign_players;
drop policy if exists "campaign_players_update_self_no_status_change" on public.campaign_players;

create policy "campaign_players_update_owner" on public.campaign_players
  for update using (
    public.is_campaign_owner(campaign_id, auth.uid())
  );

create policy "campaign_players_update_self" on public.campaign_players
  for update using (
    auth.uid() = player_id
  )
  with check (
    auth.uid() = player_id
    AND status in ('pending', 'accepted')
  );

create or replace function public.prevent_player_status_update()
returns trigger as $$
begin
  if auth.uid() is not null and auth.uid() = old.player_id then
    if new.status is distinct from old.status then
      raise exception 'Player cannot change status';
    end if;
    if new.is_dead is distinct from old.is_dead
      or new.death_cause is distinct from old.death_cause
      or new.death_world_future is distinct from old.death_world_future
      or new.death_at is distinct from old.death_at then
      raise exception 'Player cannot change death state';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_player_status_update on public.campaign_players;
create trigger trg_prevent_player_status_update
before update on public.campaign_players
for each row execute function public.prevent_player_status_update();

create policy "campaign_players_delete" on public.campaign_players
  for delete using (
    auth.uid() = player_id OR
    public.is_campaign_owner(campaign_id, auth.uid())
  );

-- MESSAGES POLICIES
drop policy if exists "messages_select" on public.messages;

create policy "messages_select" on public.messages
  for select using (
    public.is_campaign_member(campaign_id, auth.uid())
    OR public.is_campaign_owner(campaign_id, auth.uid())
    OR auth.uid() = any(visible_to)
  );

drop policy if exists "messages_insert" on public.messages;

create policy "messages_insert_member" on public.messages
  for insert with check (
    public.is_campaign_member(campaign_id, auth.uid())
    OR public.is_campaign_owner(campaign_id, auth.uid())
  );

create policy "messages_delete_owner" on public.messages
  for delete using (
    public.is_campaign_owner(campaign_id, auth.uid())
  );
