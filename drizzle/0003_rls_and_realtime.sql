-- Defense-in-depth for the browser anon key.
--
-- Supabase grants the `anon` role full SELECT/INSERT/UPDATE/DELETE on every
-- table in the public schema by default. That means once we publish
-- NEXT_PUBLIC_SUPABASE_ANON_KEY to the browser, any visitor could rewrite
-- owner tokens or claim codes unless we lock it down.
--
-- Strategy:
--   1. Enable RLS on all tables. Without a policy, every role except
--      postgres (which has BYPASSRLS) is denied.
--   2. Add permissive SELECT policies on the three public-facing tables:
--      humans, burns, burn_events. The homepage + profile + burn page
--      already treat them as public.
--   3. Revoke the default write grants from anon so policies can't be
--      bypassed even if a SELECT policy is added later.
--   4. Revoke anon SELECT on the private tables so realtime never leaks
--      claim_codes / owner_tokens / agent_installations rows.
--   5. Publish burns, burn_events, humans to supabase_realtime so the
--      site can subscribe.

alter table humans enable row level security;
alter table agent_installations enable row level security;
alter table claim_codes enable row level security;
alter table owner_tokens enable row level security;
alter table burns enable row level security;
alter table burn_events enable row level security;

create policy humans_public_select on humans
  for select to anon, authenticated
  using (true);

create policy burns_public_select on burns
  for select to anon, authenticated
  using (true);

create policy burn_events_public_select on burn_events
  for select to anon, authenticated
  using (true);

revoke insert, update, delete, truncate, references, trigger on
  humans, agent_installations, claim_codes, owner_tokens, burns, burn_events
  from anon;

revoke select on claim_codes, owner_tokens, agent_installations from anon;

alter publication supabase_realtime add table humans, burns, burn_events;
