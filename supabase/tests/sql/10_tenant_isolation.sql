-- ============================================================================
-- 10_tenant_isolation.sql — test class (a): tenant isolation.
--
-- A member of club A must not see a SINGLE row of club B — checked on every
-- tenant table (all tables carrying club_id), plus clubs, profiles and
-- entitlements. Both directions are tested (A -> B and B -> A).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Direction 1: plain member of club A (Katrin Gruenewald) vs. club B
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
declare
  t text;
  v bigint;
  tenant_tables text[] := array[
    'club_members','guardianships','teams','team_members','events',
    'event_teams','event_rsvps','attendance','media_assets','routines',
    'routine_skaters','routine_markers','competitions','competition_entries',
    'routine_scores','invoices','ledger_entries','tasks'];
begin
  perform testkit.is_eq('isolation A->B: club A member sees exactly 1 club (the own one)',
    (select count(*) from app.clubs), 1);
  perform testkit.is_eq('isolation A->B: club B row in app.clubs is invisible',
    (select count(*) from app.clubs where id = 'deadbeef-0000-4000-8000-000000000001'), 0);

  foreach t in array tenant_tables loop
    execute format('select count(*) from app.%I where club_id = %L',
      t, 'deadbeef-0000-4000-8000-000000000001') into v;
    perform testkit.is_eq(
      format('isolation A->B: app.%s rows of club B invisible to club A member', t), v, 0);
  end loop;

  perform testkit.is_eq('isolation A->B: profiles are strictly the own row (1)',
    (select count(*) from app.profiles), 1);
  perform testkit.is_eq('isolation A->B: club B owner profile is invisible',
    (select count(*) from app.profiles
      where id = 'deadbeef-9000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('isolation A->B: club B entitlement is invisible',
    (select count(*) from app.entitlements
      where subject_id = 'deadbeef-0000-4000-8000-000000000001'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Direction 2: owner of club B (Bert Beispiel) vs. club A
-- Even the highest tenant role sees nothing of a foreign club.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
declare
  t text;
  v bigint;
  tenant_tables text[] := array[
    'club_members','guardianships','teams','team_members','events',
    'event_teams','event_rsvps','attendance','media_assets','routines',
    'routine_skaters','routine_markers','competitions','competition_entries',
    'routine_scores','invoices','ledger_entries','tasks'];
begin
  perform testkit.is_eq('isolation B->A: club B owner sees exactly 1 club (the own one)',
    (select count(*) from app.clubs), 1);

  foreach t in array tenant_tables loop
    execute format('select count(*) from app.%I where club_id = %L',
      t, 'c1ab0000-0000-4000-8000-000000000001') into v;
    perform testkit.is_eq(
      format('isolation B->A: app.%s rows of club A invisible to club B OWNER', t), v, 0);
  end loop;

  -- positive sanity: the fixture data of the own club IS visible
  perform testkit.is_eq('isolation B->A: club B owner still sees the own roster (3)',
    (select count(*) from app.club_members), 3);
  perform testkit.is_eq('isolation B->A: club B owner sees only the own cash book (1 row)',
    (select count(*) from app.ledger_entries), 1);
  perform testkit.is_eq('isolation B->A: club B owner sees only the own invoices (1 row)',
    (select count(*) from app.invoices), 1);
  perform testkit.is_eq('isolation B->A: entitlement of club A is invisible',
    (select count(*) from app.entitlements
      where subject_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
end;
$$;
rollback;
