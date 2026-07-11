-- ============================================================================
-- 51_platform_settings.sql — test class: Betreiber-Konsole settings (0019).
--
-- internal.platform_settings is the ONE internal object deliberately reachable
-- by `authenticated`, gated ENTIRELY by RLS app.is_platform_admin():
--   * a club owner / plain member sees NOTHING and writes NOTHING;
--   * a platform-admin JWT (is_platform_admin claim) reads + writes the row;
--   * service_role (the webhook/system path) bypasses RLS;
--   * every OTHER internal object stays invisible to authenticated (42501) —
--     granting schema USAGE must NOT have exposed webhook_events / migrations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- anon: no schema access at all
-- ---------------------------------------------------------------------------
begin;
set local role anon;
do $$
begin
  perform testkit.throws('platform_settings: anon cannot read it',
    $q$select count(*) from internal.platform_settings$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Club owner (authenticated, NOT a platform admin): fully locked out by RLS
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('platform_settings: club owner sees 0 rows (RLS hides the singleton)',
    (select count(*) from internal.platform_settings), 0);
  perform testkit.affects('platform_settings: club owner UPDATE affects 0 rows (RLS)',
    $q$update internal.platform_settings set feature_flags = '{}'::jsonb where id = 1$q$, 0);
  perform testkit.throws('platform_settings: club owner INSERT rejected by RLS (42501)',
    $q$insert into internal.platform_settings (id, smtp) values (1, '{}'::jsonb)$q$, '42501');
  -- regression: granting internal USAGE must NOT expose other internal objects
  perform testkit.throws('internal: webhook_events still invisible to authenticated (42501)',
    $q$select count(*) from internal.webhook_events$q$, '42501');
  perform testkit.throws('internal: schema_migrations invisible to authenticated (42501)',
    $q$select count(*) from internal.schema_migrations$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Plain member (authenticated): identical lock-out
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('platform_settings: plain member sees 0 rows',
    (select count(*) from internal.platform_settings), 0);
  perform testkit.affects('platform_settings: plain member UPDATE affects 0 rows',
    $q$update internal.platform_settings set legal = '{}'::jsonb where id = 1$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Platform admin (authenticated + is_platform_admin claim): full read/write.
-- This is the ONLY authenticated caller RLS lets through — "nur is_platform_admin".
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","club_roles":{},"is_platform_admin":true,"app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('platform_settings: platform admin sees the singleton (1)',
    (select count(*) from internal.platform_settings), 1);
  perform testkit.is_eq('platform_settings: seed placeholders present (smtp host set)',
    (select count(*) from internal.platform_settings
      where smtp ->> 'host' = 'smtp.example.org'), 1);
  perform testkit.affects('platform_settings: platform admin MAY update the row (1)',
    $q$update internal.platform_settings
        set feature_flags = feature_flags || '{"smoke":true}'::jsonb where id = 1$q$, 1);
  -- the second is_platform_admin claim shape (app_metadata) is also accepted by the DB helper
  perform testkit.is_eq('platform_settings: is_platform_admin() true under this claim',
    (select case when app.is_platform_admin() then 1 else 0 end), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- service_role: the webhook/system path — bypasses RLS, reads the ledger too
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
do $$
begin
  perform testkit.is_eq('platform_settings: service_role reads the row (1)',
    (select count(*) from internal.platform_settings), 1);
  perform testkit.affects('platform_settings: service_role MAY update (1)',
    $q$update internal.platform_settings set content = content where id = 1$q$, 1);
  perform testkit.is_eq('schema_migrations: service_role sees the applied ledger (>= 19)',
    (select case when count(*) >= 19 then 1 else 0 end from internal.schema_migrations), 1);
  perform testkit.is_eq('schema_migrations: 0019_platform is recorded',
    (select count(*) from internal.schema_migrations where version = '0019_platform'), 1);
end;
$$;
rollback;
