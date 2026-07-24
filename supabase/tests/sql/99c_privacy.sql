-- ============================================================================
-- 99c_privacy.sql — test class (l): Sichtbarkeits-Verschärfung (migration 0021).
--
-- Küren (routines + routine_markers + routine_scores + routine_skaters):
--   SELECT = is_platform_admin OR owner/admin/moderator [ALLES]
--            OR coach/guest_coach für die betreuten Teams
--            OR member NUR wo das eigene club_member Skater ist.
--
-- Seed baseline club A (c1ab…01): 6 Küren
--   d-01 Feuervogel      team b-03
--   d-02 Mondlicht       team b-03   (Skater: a-18, a-09 Katrin)  ← eigene Kür
--   d-03 Sommerregen     team b-03
--   d-04 Tanz der Funken team b-03
--   d-05 Kleine Welle    team b-02
--   d-06 Nordwind        team b-03
-- Teams-Coaches: a-01 Sandra → b-02+b-03 ; a-05 Anna-Lena → b-01+b-02 ;
--   a-06 Milena (guest_coach, gültig) → b-03.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain MEMBER (Katrin, 90..09 / a-09) — sieht NUR die eigene Kür (d-02)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('routines: member sees ONLY her own Kür (1)',
    (select count(*) from app.routines), 1);
  perform testkit.is_eq('routines: member sees exactly d-02 (her Kür)',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000002'), 1);
  perform testkit.is_eq('routines: member does NOT see a foreign Kür (d-01)',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000001'), 0);

  -- markers/scores/skaters follow the same rule (only her Kür)
  perform testkit.is_eq('routine_markers: member sees markers of foreign Küren = 0',
    (select count(*) from app.routine_markers
      where routine_id <> 'd0000000-0000-4000-8000-000000000002'), 0);
  perform testkit.is_eq('routine_scores: member sees scores of foreign Küren = 0',
    (select count(*) from app.routine_scores
      where routine_id <> 'd0000000-0000-4000-8000-000000000002'), 0);
  perform testkit.is_eq('routine_scores: member sees BOTH of her own d-02 scores (2)',
    (select count(*) from app.routine_scores
      where routine_id = 'd0000000-0000-4000-8000-000000000002'), 2);
  perform testkit.is_eq('routine_skaters: member sees skater rows of foreign Küren = 0',
    (select count(*) from app.routine_skaters
      where routine_id <> 'd0000000-0000-4000-8000-000000000002'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- COACH Anna-Lena (90..05 / a-05) — betreut b-01+b-02 → sieht NUR d-05 (b-02),
-- nicht die b-03-Küren. (Sie skatet selbst nichts.)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('routines: coach sees ONLY her team Küren (b-02 → d-05 = 1)',
    (select count(*) from app.routines), 1);
  perform testkit.is_eq('routines: coach sees d-05 (her team b-02)',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000005'), 1);
  perform testkit.is_eq('routines: coach does NOT see a foreign team Kür (d-01, b-03)',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000001'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- COACH Sandra (90..01 / a-01) — betreut b-02+b-03 → sieht ALLE 6 Küren.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('routines: coach of b-02+b-03 sees all 6 Küren',
    (select count(*) from app.routines), 6);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- GUEST_COACH Milena (90..06 / a-06, gültig) — betreut b-03 → sieht 5 Küren
-- (alle b-03), NICHT d-05 (b-02).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('routines: guest_coach of b-03 sees the 5 b-03 Küren',
    (select count(*) from app.routines), 5);
  perform testkit.is_eq('routines: guest_coach does NOT see d-05 (b-02)',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000005'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- MODERATOR / ADMIN / OWNER — sehen ALLE 6 Küren (owner/admin/moderator = alles)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('routines: moderator sees all 6 Küren',
    (select count(*) from app.routines), 6);
  perform testkit.is_eq('routine_scores: moderator sees all scores (8)',
    (select count(*) from app.routine_scores), 8);
end;
$$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('routines: admin sees all 6 Küren',
    (select count(*) from app.routines), 6);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- PLATFORM ADMIN (90..90) — cross-club READ → sieht alle 6 Küren von club A.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
-- 0075: der blosse Claim oeffnet nichts mehr. Gemessen wird der ECHTE Zustand —
-- Claim UND eingeschaltete Einsicht, wie die Audit-Middleware sie setzt.
select set_config('app.operator_override', 'on', true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('routines: platform admin reads all 6 club-A Küren',
    (select count(*) from app.routines
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 6);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- CROSS-TENANT — club B owner sees 0 club A Küren/scores (no data leak).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('routines: club-B owner sees 0 club-A Küren',
    (select count(*) from app.routines
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('routine_scores: club-B owner sees 0 club-A scores',
    (select count(*) from app.routine_scores
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
end;
$$;
rollback;
