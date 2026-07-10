-- ============================================================================
-- 60_anon_and_internal.sql — test class (f): anon sees NOTHING, plus the
-- internal schema (webhook idempotency) is invisible to every client role.
--
-- anon has no USAGE on the app schema at all -> every access fails with
-- 42501, it does not even return empty results. A logged-in token without
-- club_roles claims gets empty results (no error, no data).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- anon: no schema access whatsoever
-- ---------------------------------------------------------------------------
begin;
set local role anon;

do $$
begin
  perform testkit.throws('anon: cannot read clubs',
    $q$select count(*) from app.clubs$q$, '42501');
  perform testkit.throws('anon: cannot read the product catalog directly',
    $q$select count(*) from app.products$q$, '42501');
  perform testkit.throws('anon: cannot read invoices',
    $q$select count(*) from app.invoices$q$, '42501');
  perform testkit.throws('anon: cannot read entitlements',
    $q$select count(*) from app.entitlements$q$, '42501');
  perform testkit.throws('anon: cannot write RSVPs',
    $q$insert into app.event_rsvps (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000013',
               'a0000000-0000-4000-8000-000000000007', 'going')$q$, '42501');
  perform testkit.throws('anon: internal.webhook_events does not exist for anon',
    $q$select count(*) from internal.webhook_events$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- authenticated WITHOUT club_roles claims: empty results, no leaks
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('tokenless tenant: no clubs',        (select count(*) from app.clubs), 0);
  perform testkit.is_eq('tokenless tenant: no roster',       (select count(*) from app.club_members), 0);
  perform testkit.is_eq('tokenless tenant: no events',       (select count(*) from app.events), 0);
  perform testkit.is_eq('tokenless tenant: no invoices',     (select count(*) from app.invoices), 0);
  perform testkit.is_eq('tokenless tenant: no entitlements', (select count(*) from app.entitlements), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- even a fully authenticated member never touches the internal schema
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('internal: webhook_events invisible to authenticated clients',
    $q$select count(*) from internal.webhook_events$q$, '42501');
  perform testkit.throws('internal: webhook_events not writable by authenticated clients',
    $q$insert into internal.webhook_events (provider, event_id)
       values ('stripe', 'evt_fake')$q$, '42501');
end;
$$;
rollback;
