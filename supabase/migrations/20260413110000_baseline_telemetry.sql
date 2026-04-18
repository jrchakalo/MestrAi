create table if not exists public.baseline_telemetry (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  turn_number int not null,
  prompt_tokens int not null,
  completion_tokens int not null,
  generation_latency_ms int not null,
  messages_truncated int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists baseline_telemetry_campaign_created_at_idx
  on public.baseline_telemetry (campaign_id, created_at desc);

alter table public.baseline_telemetry enable row level security;
