alter table burns add column burn_session_token_hash text;

create unique index burns_burn_session_token_hash_idx
  on burns (burn_session_token_hash)
  where burn_session_token_hash is not null;
