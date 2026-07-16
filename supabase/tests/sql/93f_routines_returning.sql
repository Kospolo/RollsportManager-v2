-- ============================================================================
-- 93f_routines_returning.sql — der RETURNING-Fallstrick beim Kuer-Anlegen.
--
-- WARUM ES DIESE DATEI GIBT (der Bug, den 711 gruene Tests nicht gesehen haben)
-- ---------------------------------------------------------------------------
-- POST /routines lieferte fuer ALLE 8 Personas 403 — auch fuer den
-- Vereinsinhaber. Das Kernfeature "Kuer anlegen" war fuer NIEMANDEN nutzbar.
-- Altbestand seit der Privacy-Haertung (0021), KEINE Phase-2-Regression.
--
-- Ursache: `insert ... returning *` zieht ZUSAETZLICH die SELECT-Policy heran
--   routines_select using (app.can_read_routine(id))
-- can_read_routine ist STABLE security definer und liest app.routines. Im
-- Snapshot des EIGENEN Statements ist die soeben eingefuegte Zeile unsichtbar
-- -> die Policy liefert false -> Postgres meldet die irrefuehrende Meldung
-- "new row violates row-level security policy for table routines" (42501),
-- OBWOHL der INSERT selbst erlaubt ist.
--
-- Warum kein Bestands-Test das fand: 93d:124-126 prueft das Schreibrecht mit
-- einem NACKTEN `insert into app.routines (...) values (...)` OHNE returning.
-- Der beweist das INSERT-Recht korrekt — und geht am echten API-Pfad vorbei.
-- Genau diese Luecke schliesst diese Datei: sie prueft das INSERT so, wie die
-- API es tatsaechlich absetzt.
--
-- Diese Datei ist NEU (Bestands-Tests bleiben unveraendert).
--
-- Personas (profile_id -> Person):
--   90..02 Juergen Haeberle  (owner)
--   90..01 Sandra Vogel      (coach,       betreut b-02 + b-03)
--   90..06 Milena Oeztuerk   (guest_coach, betreut b-03)
--   90..03 Beate Schaefer    (treasurer)
--   90..09 Katrin Gruenewald (member)
-- Teams: b-01 Minis & Anfaenger · b-02 Nachwuchs Pflicht · b-03 Kuergruppe Leistung
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) DER BEFUND, schwarz auf weiss: derselbe INSERT, einmal ohne und einmal
--    mit returning — als OWNER, der unstrittig alles darf. Ohne returning
--    geht er durch, mit returning fliegt 42501. Das ist der ganze Bug.
--    Diese beiden Assertions sind die Regressionsbremse: faellt A2 kuenftig
--    um (weil jemand die SELECT-Policy anfasst), ist das ein Alarm.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  if app.has_cap('c1ab0000-0000-4000-8000-000000000001', 'routines_edit', 'edit') then
    perform testkit.ok('returning: Vorbedingung — owner darf Kueren schreiben (routines_edit)');
  else
    perform testkit.fail('returning: Vorbedingung — owner darf Kueren schreiben (routines_edit)',
      'owner hat routines_edit < edit');
  end if;

  -- A1: der nackte INSERT (so prueft 93d) — erlaubt.
  perform testkit.succeeds('returning: der nackte INSERT ist erlaubt (so prueft 93d)',
    $q$insert into app.routines (club_id, team_id, title)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000003', 'A1 ohne returning')$q$);

  -- A2: DERSELBE INSERT mit returning — 42501. Der Beweis, dass returning
  --     (und nicht das Schreibrecht) die Ursache ist.
  perform testkit.throws('returning: DERSELBE INSERT mit returning * scheitert (der Bug)',
    $q$insert into app.routines (club_id, team_id, title)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000003', 'A2 mit returning')
       returning *$q$, '42501');

  -- A3: auch `returning id` rettet nicht — JEDES returning loest die
  --     SELECT-Policy aus, nicht nur `returning *`. Haelt den naheliegenden
  --     Fehlschluss "dann halt nur die id" dauerhaft fest.
  perform testkit.throws('returning: auch `returning id` scheitert — nicht nur `returning *`',
    $q$insert into app.routines (club_id, team_id, title)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000003', 'A3 returning id')
       returning id$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DER FIX, den routes/routines.ts fahrt, als Test nachgestellt:
--    id vorab ziehen -> INSERT OHNE returning -> in einem SEPARATEN Statement
--    zuruecklesen. Ein spaeteres Statement derselben Transaktion sieht die
--    Schreibvorgaenge der frueheren Kommandos, also greift can_read_routine
--    normal. Keine Policy wird dafuer aufgeweicht.
--    Geprueft fuer alle 5 Trainer-Rollen auf einem Team, das sie betreuen.
-- ---------------------------------------------------------------------------

-- B1 owner (sieht alles im Verein, auch ohne Team)
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
declare
  v_id uuid := app.uuid_v7();
begin
  execute format(
    $q$insert into app.routines (id, club_id, team_id, title)
       values (%L, 'c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000003', 'B1 owner')$q$, v_id);
  perform testkit.is_eq('fix: owner legt an und liest die frische Kuer separat zurueck',
    (select count(*) from app.routines where id = v_id), 1);
end;
$$;
rollback;

-- B2 coach auf EIGENEM Team (b-03 = Kuergruppe Leistung, Sandra betreut es)
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
declare
  v_id uuid := app.uuid_v7();
begin
  execute format(
    $q$insert into app.routines (id, club_id, team_id, title)
       values (%L, 'c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000003', 'B2 coach eigenes Team')$q$, v_id);
  perform testkit.is_eq('fix: coach legt fuer SEIN Team an und liest zurueck',
    (select count(*) from app.routines where id = v_id), 1);
end;
$$;
rollback;

-- B3 guest_coach auf EIGENEM Team (Milena betreut b-03)
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;
do $$
declare
  v_id uuid := app.uuid_v7();
begin
  execute format(
    $q$insert into app.routines (id, club_id, team_id, title)
       values (%L, 'c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000003', 'B3 guest_coach eigenes Team')$q$, v_id);
  perform testkit.is_eq('fix: guest_coach legt fuer SEIN Team an und liest zurueck',
    (select count(*) from app.routines where id = v_id), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) DIE ASYMMETRIE, ehrlich festgehalten: das Schreibrecht (routines_edit)
--    ist WEITER als das Leserecht (can_read_routine). Ein coach DARF fuer ein
--    fremdes Team schreiben, sieht das Ergebnis aber nicht.
--    Deshalb bricht die API in genau diesem Fall mit 422 ab, statt eine
--    unsichtbare Geisterzeile zu hinterlassen. Hier der DB-Beleg dafuer, dass
--    der Fall real ist — und dass die SELECT-Policy dabei NICHT aufgeweicht ist.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
declare
  v_fremd uuid := app.uuid_v7();
  v_ohne  uuid := app.uuid_v7();
begin
  -- b-01 (Minis & Anfaenger) betreut Sandra NICHT.
  execute format(
    $q$insert into app.routines (id, club_id, team_id, title)
       values (%L, 'c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000001', 'C1 fremdes Team')$q$, v_fremd);
  -- Der INSERT oben ist ohne Exception durchgelaufen = das Schreibrecht steht.
  perform testkit.ok('asymmetrie: coach DARF fuer ein fremdes Team schreiben (INSERT geht durch)');
  perform testkit.is_eq('asymmetrie: ... sieht die Zeile aber NICHT (deshalb 422 in der API)',
    (select count(*) from app.routines r where r.id = v_fremd), 0);

  -- Ohne Team: coaches_team(club, null) ist false -> ebenfalls unsichtbar.
  execute format(
    $q$insert into app.routines (id, club_id, team_id, title)
       values (%L, 'c1ab0000-0000-4000-8000-000000000001', null, 'C2 ohne Team')$q$, v_ohne);
  perform testkit.is_eq('asymmetrie: coach sieht auch die teamlose Kuer nicht (422 in der API)',
    (select count(*) from app.routines where id = v_ohne), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) Die Gegenprobe zum Fix: er hat NIEMANDEM etwas geschenkt.
--    treasurer und member duerfen weiterhin KEINE Kuer anlegen — weder nackt
--    noch mit returning. Sonst waere aus einem Lesefehler ein Schreibrecht
--    geworden.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('gegenprobe: treasurer legt KEINE Kuer an (nackter INSERT)',
    $q$insert into app.routines (club_id, team_id, title)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000003', 'darf nicht')$q$, '42501');
  perform testkit.throws('gegenprobe: treasurer legt KEINE Kuer an (mit returning)',
    $q$insert into app.routines (club_id, team_id, title)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000003', 'darf nicht')
       returning *$q$, '42501');
end;
$$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('gegenprobe: member legt KEINE Kuer an (nackter INSERT)',
    $q$insert into app.routines (club_id, team_id, title)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000003', 'darf nicht')$q$, '42501');
  perform testkit.throws('gegenprobe: member legt KEINE Kuer an (mit returning)',
    $q$insert into app.routines (club_id, team_id, title)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000003', 'darf nicht')
       returning *$q$, '42501');
end;
$$;
rollback;
