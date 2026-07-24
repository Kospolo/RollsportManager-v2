-- ============================================================================
-- 95_modules_batch1.sql — test class (i): modules batch 1 (migration 0008).
--
--   * news      — read = every club member; write = is_club_trainer only
--                 (coach yes, treasurer/plain member no).
--   * exercises — same read/write matrix as news.
--   * notes     — STRICTLY private: only the owner reads/writes them; a fellow
--                 member sees 0, and even a platform admin (cross-club reader)
--                 sees 0. The owner may not plant a note under someone else.
--
-- Seed baseline for club A: 3 news, 5 exercises, 2 notes (both owned by
-- Sandra Vogel, profile 90..01 / member m-01, coach).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain MEMBER (Katrin, 90..09) — reads news/exercises, sees NO notes, no write
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- read: member sees the club feed and the drill library
  perform testkit.is_eq('news: member sees all 3 club news', (select count(*) from app.news), 3);
  perform testkit.is_eq('exercises: member sees all 5 club exercises', (select count(*) from app.exercises), 5);

  -- notes are strictly private -> a fellow member sees NOTHING
  perform testkit.is_eq('notes: member sees 0 foreign notes (strictly private)',
    (select count(*) from app.notes), 0);
  perform testkit.affects('notes: member cannot update a foreign note (0 rows under RLS)',
    $q$update app.notes set title = 'gekapert'
        where owner_profile_id = '90000000-0000-4000-8000-000000000001'$q$, 0);

  -- write: a plain member is not is_club_trainer -> INSERT rejected
  perform testkit.throws('news: member MAY NOT create news (not a trainer)',
    $q$insert into app.news (club_id, author_member_id, title, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'Hack', 'Body')$q$, '42501');
  perform testkit.throws('exercises: member MAY NOT create an exercise (not a trainer)',
    $q$insert into app.exercises (club_id, created_by_member_id, name, category, difficulty)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'Hack', 'warmup', 1)$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- COACH (Sandra, 90..01) — is_club_trainer: writes news/exercises; owns notes
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  -- write: a coach IS a trainer -> may create news + exercises
  perform testkit.succeeds('news: coach MAY create news',
    $q$insert into app.news (club_id, author_member_id, title, body, published_at)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000001', 'Trainer-Info', 'Body', now())$q$);
  perform testkit.succeeds('exercises: coach MAY create an exercise',
    $q$insert into app.exercises (club_id, created_by_member_id, name, category, difficulty)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000001', 'Sprungserie', 'jump', 4)$q$);

  -- notes: the owner sees exactly her own 2 notes
  perform testkit.is_eq('notes: owner sees her own 2 notes',
    (select count(*) from app.notes), 2);
  perform testkit.succeeds('notes: owner MAY create a note for herself',
    $q$insert into app.notes (owner_profile_id, title, body)
       values ('90000000-0000-4000-8000-000000000001', 'Neu', 'Body')$q$);

  -- but NOT plant a note owned by someone else (with-check owner = auth.uid())
  perform testkit.throws('notes: owner MAY NOT create a note owned by another user',
    $q$insert into app.notes (owner_profile_id, title, body)
       values ('90000000-0000-4000-8000-000000000009', 'Fremd', 'Body')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- TREASURER (Beate, 90..03) — reads (is_club_member) but is NOT a trainer
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('news: treasurer reads the feed (is_club_member)',
    (select count(*) from app.news), 3);
  perform testkit.is_eq('exercises: treasurer reads the library (is_club_member)',
    (select count(*) from app.exercises), 5);
  perform testkit.is_eq('notes: treasurer sees 0 foreign notes', (select count(*) from app.notes), 0);

  -- treasurer is NOT is_club_trainer -> no news/exercise writes
  perform testkit.throws('news: treasurer MAY NOT create news (not a trainer)',
    $q$insert into app.news (club_id, author_member_id, title, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000003', 'Kasse', 'Body')$q$, '42501');
  perform testkit.throws('exercises: treasurer MAY NOT create an exercise (not a trainer)',
    $q$insert into app.exercises (club_id, created_by_member_id, name, category, difficulty)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000003', 'Kasse', 'strength', 2)$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- PLATFORM ADMIN (90..90) — cross-club READ of news/exercises, but notes stay
-- private: the one table the platform layer deliberately cannot read.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
-- 0075: seit der Zweckbindung oeffnet der blosse Claim nichts mehr. Gemessen
-- wird deshalb der ECHTE Zustand — Claim UND eingeschaltete Einsicht, genau so,
-- wie middleware/operator-access.ts sie vor jedem Plattform-Request setzt.
select set_config('app.operator_override', 'on', true);
set local role authenticated;

do $$
begin
  -- is_club_member grants platform admins cross-club READ of feed + library
  perform testkit.is_eq('news: platform admin reads news across tenants (3)',
    (select count(*) from app.news), 3);
  perform testkit.is_eq('exercises: platform admin reads exercises across tenants (5)',
    (select count(*) from app.exercises), 5);

  -- but notes have NO is_club_member path -> even a platform admin sees 0
  perform testkit.is_eq('notes: platform admin sees 0 notes (no cross-user read)',
    (select count(*) from app.notes), 0);
end;
$$;
rollback;
