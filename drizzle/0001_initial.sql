create extension if not exists "pgcrypto";

create table humans (
  id uuid primary key default gen_random_uuid(),
  public_handle text not null,
  avatar_url text not null,
  created_at timestamptz not null default now()
);

create table agent_installations (
  id uuid primary key default gen_random_uuid(),
  human_id uuid not null references humans(id) on delete cascade,
  agent_label text not null,
  local_machine_label text null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz null
);

create table claim_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'available',
  expires_at timestamptz not null,
  claimed_human_id uuid null references humans(id) on delete set null,
  created_at timestamptz not null default now()
);

create table owner_tokens (
  id uuid primary key default gen_random_uuid(),
  human_id uuid not null references humans(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz null,
  revoked_at timestamptz null
);

create table burns (
  id uuid primary key default gen_random_uuid(),
  human_id uuid not null references humans(id) on delete cascade,
  agent_installation_id uuid not null references agent_installations(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic')),
  model text not null,
  preset_id text null,
  requested_billed_token_target bigint not null check (requested_billed_token_target > 0),
  billed_tokens_consumed bigint not null default 0 check (billed_tokens_consumed >= 0),
  status text not null check (status in ('queued', 'running', 'stopping', 'completed', 'interrupted', 'failed')),
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  last_heartbeat_at timestamptz null
);

create table burn_events (
  id uuid primary key default gen_random_uuid(),
  burn_id uuid not null references burns(id) on delete cascade,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index humans_public_handle_idx
on humans (lower(public_handle));

create unique index burns_one_active_per_human_idx
on burns (human_id)
where status in ('queued', 'running', 'stopping');
