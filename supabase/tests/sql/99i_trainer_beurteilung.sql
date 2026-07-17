-- ============================================================================
-- 99i_trainer_beurteilung.sql — Trainer:innen-Beurteilung (migration 0055,
-- app.member_assessments). Eine schriftliche Einschätzung über ein (oft
-- MINDERJÄHRIGES) Vereinsmitglied. NEUE Datei; friert die Rechte von 0055 ein.
--
-- SEED-BEZUG (club A, c1ab…01):
--   Trainer:innen  Sandra Vogel   (90..01 / a-01, coach)      -> t-02 + t-03
--                  Anna-Lena Böhm (90..05 / a-05, coach)      -> t-01 + t-02
--                  Milena Öztürk  (90..06 / a-06, guest_coach)-> t-03 (aktiv)
--   Vorstand       Jürgen Häberle (90..02 / a-02, owner)
--                  Petra Köhler   (90..14 / a-14, moderator)
--   Kasse          Beate Schäfer  (90..03 / a-03, treasurer)
--   Familie        Katrin Grünewald (90..09 / a-09, member),
--                  Mutter von Lina a-07 (t-02) und Emma a-08 (t-01)
--                  Stefanie Müller (90..12 / a-12, member),
--                  Mutter von Sofia a-10, Ben a-11 (KEINE Beurteilung geseedet)
--   Seed-Beurteilungen:
--     A1  über Lina  a-07 (t-02)  von Sandra   a-01
--     A2  über Emma  a-08 (t-01)  von Anna-Lena a-05
--     A3  über Maja  a-16 (t-03)  von Sandra   a-01
--     A4  über Johanna a-17 (t-03) von Sandra  a-01 (Ausdruck NULL)
--
-- Bestands-Tests bleiben unberührt; diese Datei ist NEU.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) SCHREIBEN — der Kern: ein FREMDER Trainer, der die Person NICHT betreut,
--    schreibt NICHT. Positivkontrolle daneben, sonst wäre das Verbot nur ein
--    genereller Ausfall.
-- ---------------------------------------------------------------------------
begin;
-- Anna-Lena (coach t-01/t-02) beurteilt Maja a-16, die in t-03 turnt.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('beurteilung-write: FREMDER Trainer (Anna-Lena, t-01/t-02) schreibt NICHT über Maja (t-03)',
    $q$insert into app.member_assessments (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016',
               'a0000000-0000-4000-8000-000000000005', 'unbefugt')$q$,
    '42501');

  -- Positivkontrolle: dasselbe Team, das Anna-Lena BETREUT (Emma a-08 in t-01)
  -- geht durch.
  perform testkit.succeeds('beurteilung-write: Anna-Lena schreibt über Emma (t-01, ihr Team)',
    $q$insert into app.member_assessments (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000008',
               'a0000000-0000-4000-8000-000000000005', 'betreutes Team')$q$);
end;
$$;
rollback;

begin;
-- Sandra (coach t-02/t-03) — betreut Maja a-16 in t-03 -> darf.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('beurteilung-write: Sandra (t-03) schreibt über Maja (t-03)',
    $q$insert into app.member_assessments (club_id, member_id, author_member_id, body, rating_technik, rating_ausdruck)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016',
               'a0000000-0000-4000-8000-000000000001', 'Note technik/ausdruck', 5, 4)$q$);

  -- Autoren-Bindung: Sandra kann NICHT im Namen von Anna-Lena (a-05) schreiben.
  perform testkit.throws('beurteilung-write: Sandra kann NICHT als Anna-Lena (fremde Autorenzeile) schreiben',
    $q$insert into app.member_assessments (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000005', 'fremde Autorenzeile')$q$,
    '42501');

  -- CHECK: Note ausserhalb 1..5 -> 23514.
  perform testkit.throws('beurteilung-write: Note 6 verletzt den 1..5-CHECK',
    $q$insert into app.member_assessments (club_id, member_id, author_member_id, body, rating_technik)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000001', 'ok', 6)$q$,
    '23514');

  -- CHECK: leerer body -> 23514.
  perform testkit.throws('beurteilung-write: leerer body verletzt den Längen-CHECK',
    $q$insert into app.member_assessments (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000001', '   ')$q$,
    '23514');
end;
$$;
rollback;

begin;
-- guest_coach Milena (t-03, aktiv) darf ihr Team beurteilen.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('beurteilung-write: guest_coach Milena schreibt über Maja (t-03)',
    $q$insert into app.member_assessments (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016',
               'a0000000-0000-4000-8000-000000000006', 'guest_coach betreut t-03')$q$);
end;
$$;
rollback;

begin;
-- Vorstand (owner) darf über JEDE Person schreiben; Kasse (treasurer) NICHT.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('beurteilung-write: Vorstand (owner) schreibt über Hanna (a-23)',
    $q$insert into app.member_assessments (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000023',
               'a0000000-0000-4000-8000-000000000002', 'Vorstand darf')$q$);
end;
$$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('beurteilung-write: Kasse (treasurer) schreibt NICHT (nur Lesen)',
    $q$insert into app.member_assessments (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000003', 'Kasse darf nicht')$q$,
    '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) LESEN — ein NORMALES Mitglied sieht KEINE fremde Beurteilung.
-- ---------------------------------------------------------------------------
begin;
-- Stefanie Müller (member) — Mutter von a-10/a-11, für die NICHTS geseedet ist.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('beurteilung-read: normales Mitglied sieht Maja-Beurteilungen NICHT (0)',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000016'), 0);
  perform testkit.is_eq('beurteilung-read: normales Mitglied sieht INSGESAMT keine fremde (0)',
    (select count(*) from app.member_assessments), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) LESEN — die FAMILIE sieht die eigene / die des eigenen Kindes, nie fremde.
-- ---------------------------------------------------------------------------
begin;
-- Selbst-Zweig (profile_id = auth.uid()): Fixture-Beurteilung ÜBER Katrin a-09
-- (als Superuser eingefügt, RLS-frei), dann als Katrin gelesen.
insert into app.member_assessments (id, club_id, member_id, author_member_id, body)
  values ('f0000000-0000-4000-8000-000000000001',
          'c1ab0000-0000-4000-8000-000000000001',
          'a0000000-0000-4000-8000-000000000009',
          'a0000000-0000-4000-8000-000000000002', 'Auskunft Selbst-Test');
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  -- Selbst: die Beurteilung ÜBER die eigene Person.
  perform testkit.is_eq('beurteilung-read: die betroffene Person (self, profile_id=uid) sieht ihre eigene',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000009'), 1);
  -- Elternteil: das Kind Lina a-07 (A1) und Emma a-08 (A2).
  perform testkit.is_eq('beurteilung-read: Elternteil sieht die des Kindes Lina (A1)',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000007'), 1);
  perform testkit.is_eq('beurteilung-read: Elternteil sieht die des Kindes Emma (A2)',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000008'), 1);
  -- Aber NICHT die eines fremden Kindes (Maja a-16).
  perform testkit.is_eq('beurteilung-read: Elternteil sieht die eines FREMDEN Kindes (Maja) NICHT (0)',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000016'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) LESEN — Staff sieht (Kasse/Vorstand ALLE; coach nur seine Teams).
-- ---------------------------------------------------------------------------
begin;
-- Kasse (treasurer) = can_manage_members -> ALLE.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  -- can_manage_members -> ALLE vier Seed-Beurteilungen (A1..A4).
  perform testkit.is_eq('beurteilung-read: Kasse (treasurer) sieht ALLE 4 Beurteilungen des Vereins',
    (select count(*) from app.member_assessments), 4);
  perform testkit.is_eq('beurteilung-read: Kasse sieht Maja (t-03, A3)',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000016'), 1);
  perform testkit.is_eq('beurteilung-read: Kasse sieht auch Lina (t-02, A1)',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000007'), 1);
end;
$$;
rollback;

begin;
-- coach Sandra betreut t-02/t-03: sieht Maja+Johanna (t-03) und Lina (t-02),
-- NICHT Emma (t-01). Insgesamt genau A1+A3+A4 = 3.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('beurteilung-read: coach Sandra sieht NUR ihre Teams (A1+A3+A4 = 3)',
    (select count(*) from app.member_assessments), 3);
  perform testkit.is_eq('beurteilung-read: coach Sandra sieht Maja (t-03, A3)',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000016'), 1);
  perform testkit.is_eq('beurteilung-read: coach Sandra sieht Emma (t-01, NICHT ihr Team) NICHT (0)',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000008'), 0);
end;
$$;
rollback;

begin;
-- coach Anna-Lena betreut t-01/t-02: sieht Emma (t-01), NICHT Maja (t-03).
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('beurteilung-read: coach Anna-Lena sieht Emma (t-01, A2)',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000008'), 1);
  perform testkit.is_eq('beurteilung-read: coach Anna-Lena sieht Maja (t-03) NICHT (0)',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000016'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) ÄNDERN/LÖSCHEN — nur Autor:in oder Vorstand. Ein Team-Trainer, der die
--    Zeile LESEN darf, aber nicht Autor ist, ändert sie NICHT.
-- ---------------------------------------------------------------------------
begin;
-- Sandra ist Autorin von A1 (Lina) -> darf ändern und (soft) löschen.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.affects('beurteilung-edit: Autorin Sandra ändert ihre A1 (Lina)',
    $q$update app.member_assessments set body = 'überarbeitet'
       where member_id = 'a0000000-0000-4000-8000-000000000007'
         and author_member_id = 'a0000000-0000-4000-8000-000000000001'
         and deleted_at is null$q$, 1);

  -- Immutabilität: die beurteilte Person einer Beurteilung ist unveränderlich.
  perform testkit.throws('beurteilung-edit: member_id einer Beurteilung ist unveränderlich (Trigger P0001)',
    $q$update app.member_assessments set member_id = 'a0000000-0000-4000-8000-000000000016'
       where member_id = 'a0000000-0000-4000-8000-000000000007'
         and author_member_id = 'a0000000-0000-4000-8000-000000000001'$q$,
    'P0001');
end;
$$;
rollback;

begin;
-- Anna-Lena betreut t-02 und DARF A1 (Lina, t-02) LESEN — aber sie ist nicht
-- die Autorin (Sandra ist es) und kein Vorstand: UPDATE trifft 0 Zeilen.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('beurteilung-edit: Anna-Lena DARF A1 (Lina, t-02) lesen',
    (select count(*) from app.member_assessments
      where member_id = 'a0000000-0000-4000-8000-000000000007'), 1);
  perform testkit.affects('beurteilung-edit: aber Anna-Lena (nicht Autorin) ändert A1 NICHT (0 Zeilen)',
    $q$update app.member_assessments set body = 'fremd'
       where member_id = 'a0000000-0000-4000-8000-000000000007'
         and deleted_at is null$q$, 0);
  perform testkit.affects('beurteilung-edit: und löscht A1 NICHT (0 Zeilen)',
    $q$update app.member_assessments set deleted_at = now()
       where member_id = 'a0000000-0000-4000-8000-000000000007'
         and deleted_at is null$q$, 0);
end;
$$;
rollback;

begin;
-- Kasse (treasurer) LIEST alles, ändert aber NICHTS.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.affects('beurteilung-edit: Kasse (treasurer) ändert A3 (Maja) NICHT (0 Zeilen)',
    $q$update app.member_assessments set body = 'kasse'
       where member_id = 'a0000000-0000-4000-8000-000000000016'
         and deleted_at is null$q$, 0);
end;
$$;
rollback;

begin;
-- Vorstand (moderator = is_club_admin) ändert und löscht jede Beurteilung.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.affects('beurteilung-edit: Vorstand (moderator) ändert A3 (Maja, fremde Autorin)',
    $q$update app.member_assessments set body = 'vorstand'
       where member_id = 'a0000000-0000-4000-8000-000000000016'
         and author_member_id = 'a0000000-0000-4000-8000-000000000001'
         and deleted_at is null$q$, 1);
  perform testkit.affects('beurteilung-edit: Vorstand (moderator) soft-löscht A1 (Lina)',
    $q$update app.member_assessments set deleted_at = now()
       where member_id = 'a0000000-0000-4000-8000-000000000007'
         and deleted_at is null$q$, 1);
end;
$$;
rollback;
