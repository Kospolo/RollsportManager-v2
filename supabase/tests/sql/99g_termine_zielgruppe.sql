-- ============================================================================
-- 99g_termine_zielgruppe.sql — Termine/Wettkaempfe: die Zielgruppe (0050).
--
-- Bezug: Migration 0050. Diese Datei ist NEU (Bestands-Tests bleiben unberührt).
--
-- Der Nutzer woertlich: "ein mitglied darf nur seine wettkaempfe, seine termine
-- sehen — ausser es sind vereinsveranstaltungen" / "ja verein — darf aber nicht
-- jeder was eintragen".
--
-- VORHER (blank app.is_club_member, 0003:203): JEDE Persona sah ausnahmslos
-- ALLE Termine und BEIDE Wettkaempfe. Die Zahlen unten sind gegen die
-- Seed-Datenbank gemessen, nicht gerechnet:
--
--   Persona              Rolle         Termine  Wettk.  event_teams
--   owner Juergen        owner            16       2        18
--   admin Thomas         admin            16       2        18
--   moderator Petra      moderator        16       2        18
--   coach Sandra         coach            13       2        15   (t-02 + t-03)
--   coach Anna-Lena      coach            12       2        14   (t-01 + t-02)
--   guest_coach Milena   guest_coach       9       2        11   (t-03)
--   member Katrin        member           12       1        14   (Mutter: Kinder
--                                                                 in t-01 + t-02)
--   member Stefanie      member           12       1        14   (dito)
--   treasurer Beate      treasurer         2       0         0   (kein Team,
--                                                                 kein Kind)
--
-- Seed-Grundlage (club A c1ab…01): 16 Termine, davon 14 audience='teams' und
-- ZWEI ausdrueckliche Vereinsveranstaltungen (audience='club', ohne Teams):
--   e-14 Sommerfest mit Schnupperlaufen   (+23 Tage)
--   e-16 Jahreshauptversammlung           (+17 Tage)
-- 18 event_teams-Zeilen. Teams: t-01 Minis (coach Anna-Lena), t-02 Nachwuchs
-- (Sandra + Anna-Lena), t-03 Kuergruppe (Sandra + guest_coach Milena).
-- Wettkaempfe: c-01 Bezirksmeisterschaft (8 Meldungen, u.a. Katrins Kind a-07),
-- c-02 Kreispokal (3 Meldungen, alle t-03).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) MITGLIED / ELTERNTEIL — Katrin (90..09). Sie ist SELBST in keinem Team;
--    ihre Sicht entsteht AUSSCHLIESSLICH aus der Elternschaft (a-07 in t-02,
--    a-08 in t-01) plus den Vereinsveranstaltungen. Das ist der wichtigste
--    Fall des ganzen Auftrags: ohne ihn weiss kein Elternteil, wann das Kind
--    Training hat, und die App ist fuer Eltern unbrauchbar.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('member/Eltern: sieht 12 von 16 Terminen (vorher: alle 16)',
    (select count(*) from app.events), 12);

  -- Der Elternteil-Beweis, einzeln: e-01 ist ein Training von t-02. Katrin ist
  -- dort NICHT Mitglied — ihr Kind a-07 schon. Sie sieht es ueber
  -- app.can_act_for_member -> app.guardianships.
  perform testkit.is_eq('Eltern: sieht das Training des KINDES (e-01, Team t-02)',
    (select count(*) from app.events
      where id = 'e0000000-0000-4000-8000-000000000001'), 1);
  perform testkit.is_eq('Eltern: sieht auch das Training des ZWEITEN Kindes (e-03, Team t-01)',
    (select count(*) from app.events
      where id = 'e0000000-0000-4000-8000-000000000003'), 1);

  -- ... und genau NICHT die Termine des Teams, in dem sie kein Kind hat.
  perform testkit.is_eq('member: sieht KEINEN Termin des fremden Teams t-03 (e-02/e-05/e-08/e-15)',
    (select count(*) from app.events
      where id in ('e0000000-0000-4000-8000-000000000002',
                   'e0000000-0000-4000-8000-000000000005',
                   'e0000000-0000-4000-8000-000000000008',
                   'e0000000-0000-4000-8000-000000000015')), 0);

  -- Die Ausnahme, die der Nutzer ausdruecklich bestellt hat.
  perform testkit.is_eq('member: sieht BEIDE Vereinsveranstaltungen (e-14 Sommerfest, e-16 JHV)',
    (select count(*) from app.events where audience = 'club'), 2);

  -- Die Zuordnung darf nicht verraten, was der Termin selbst verschweigt.
  perform testkit.is_eq('member: sieht 14 von 18 event_teams-Zeilen (keine des fremden Teams)',
    (select count(*) from app.event_teams), 14);
  perform testkit.is_eq('member: sieht KEINE event_teams-Zeile eines Termins, den sie nicht sieht',
    (select count(*) from app.event_teams
      where event_id in ('e0000000-0000-4000-8000-000000000002',
                         'e0000000-0000-4000-8000-000000000005',
                         'e0000000-0000-4000-8000-000000000008',
                         'e0000000-0000-4000-8000-000000000015')), 0);

  -- Wettkaempfe: nur der, zu dem ihr Kind a-07 gemeldet ist (c-01).
  perform testkit.is_eq('member/Eltern: sieht NUR den Wettkampf ihres Kindes (c-01)',
    (select count(*) from app.competitions), 1);
  perform testkit.is_eq('member/Eltern: ... und das ist die Bezirksmeisterschaft',
    (select count(*) from app.competitions
      where id = 'c0000000-0000-4000-8000-000000000001'), 1);
  perform testkit.is_eq('member: sieht den Kreispokal NICHT (kein eigenes Kind gemeldet)',
    (select count(*) from app.competitions
      where id = 'c0000000-0000-4000-8000-000000000002'), 0);

  -- "darf aber nicht jeder was eintragen" — das Mitglied schon gar nicht.
  perform testkit.throws('member: legt KEINE Vereinsveranstaltung an (kein Schreibrecht)',
    $q$insert into app.events (club_id, type, title, starts_at, ends_at, audience)
       values ('c1ab0000-0000-4000-8000-000000000001', 'other', 'Mitglieds-Vereinsfest',
               now() + interval '1 day', now() + interval '1 day 2 hours', 'club')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) TRAINERIN — Sandra (90..01), betreut t-02 + t-03.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('coach: sieht 13 von 16 Terminen (ihre Teams t-02/t-03 + Verein)',
    (select count(*) from app.events), 13);

  -- Der Fall, an dem die Regel scheitern wuerde, wenn man die Trainerin
  -- vergisst: sie MUSS ihr eigenes Training sehen.
  perform testkit.is_eq('coach: sieht ihr EIGENES Training (e-02, Team t-03)',
    (select count(*) from app.events
      where id = 'e0000000-0000-4000-8000-000000000002'), 1);
  perform testkit.is_eq('coach: sieht die Termine des fremden Teams t-01 NICHT (e-03/e-06/e-10)',
    (select count(*) from app.events
      where id in ('e0000000-0000-4000-8000-000000000003',
                   'e0000000-0000-4000-8000-000000000006',
                   'e0000000-0000-4000-8000-000000000010')), 0);
  perform testkit.is_eq('coach: sieht die Vereinsveranstaltungen',
    (select count(*) from app.events where audience = 'club'), 2);

  -- "darf aber nicht jeder was eintragen": die Trainerin ist NICHT der Vorstand.
  perform testkit.throws('coach: legt KEINE Vereinsveranstaltung an (42501)',
    $q$insert into app.events (club_id, type, title, starts_at, ends_at, audience)
       values ('c1ab0000-0000-4000-8000-000000000001', 'other', 'Trainer-Vereinsfest',
               now() + interval '1 day', now() + interval '1 day 2 hours', 'club')$q$, '42501');

  -- HOCHSTUFEN per UPDATE — der Umweg, den der Auftrag ausdruecklich nennt.
  perform testkit.throws('coach: stuft einen Team-Termin NICHT auf Verein hoch (PATCH-Weg)',
    $q$update app.events set audience = 'club'
        where id = 'e0000000-0000-4000-8000-000000000002'$q$, '42501');

  -- HERUNTERSTUFEN — die Gegenrichtung.
  perform testkit.throws('coach: stuft eine Vereinsveranstaltung NICHT herunter',
    $q$update app.events set audience = 'teams'
        where id = 'e0000000-0000-4000-8000-000000000014'$q$, '42501');

  -- Und er schreibt eine Vereinsveranstaltung auch nicht um (strenger als der
  -- Wortlaut: wer sie nicht anlegen darf, darf sie auch nicht kapern).
  perform testkit.throws('coach: schreibt eine Vereinsveranstaltung NICHT um',
    $q$update app.events set title = 'Gekapert'
        where id = 'e0000000-0000-4000-8000-000000000016'$q$, '42501');

  -- Ein normaler Team-Termin bleibt fuer ihn editierbar (nichts kaputtgemacht).
  perform testkit.affects('coach: aendert seinen eigenen Team-Termin weiterhin (1 Zeile)',
    $q$update app.events set title = 'Training Kuergruppe (neu)'
        where id = 'e0000000-0000-4000-8000-000000000002'$q$, 1);

  -- Wettkaempfe: die Trainerin sieht ALLE — sie macht die Meldung. Der
  -- Grenzfall "Wettkampf ohne Meldung" waere sonst unauffindbar UND
  -- unbefuellbar (siehe app.can_read_competition).
  perform testkit.is_eq('coach: sieht ALLE Wettkaempfe (sie meldet)',
    (select count(*) from app.competitions), 2);

  -- Eigenbefund des Auftrags: die Trainerin haengt Termine nur an IHRE Teams.
  perform testkit.throws('coach: haengt einen Termin NICHT an ein fremdes Team (t-01)',
    $q$insert into app.event_teams (club_id, event_id, team_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000002',
               'b0000000-0000-4000-8000-000000000001')$q$, '42501');
  perform testkit.succeeds('coach: haengt einen Termin an ihr EIGENES Team (t-02)',
    $q$insert into app.event_teams (club_id, event_id, team_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000002',
               'b0000000-0000-4000-8000-000000000002')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) KASSE — Beate (90..03). Bestellt: NICHT. Sie hat kein Team und kein Kind,
--    also bleiben genau die Vereinsveranstaltungen. Vorher sah sie alle 16.
--    Geprueft und im Migrationskopf belegt: an app.events haengt KEIN Finanz-
--    oder Pflichtstunden-Pfad, der Schnitt ist folgenlos.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('treasurer: sieht NUR die 2 Vereinsveranstaltungen (vorher 16)',
    (select count(*) from app.events), 2);
  perform testkit.is_eq('treasurer: sieht KEINEN Wettkampf (vorher 2)',
    (select count(*) from app.competitions), 0);
  perform testkit.is_eq('treasurer: sieht KEINE event_teams-Zeile',
    (select count(*) from app.event_teams), 0);
  perform testkit.throws('treasurer: legt keine Vereinsveranstaltung an',
    $q$insert into app.events (club_id, type, title, starts_at, ends_at, audience)
       values ('c1ab0000-0000-4000-8000-000000000001', 'other', 'Kassen-Vereinsfest',
               now() + interval '1 day', now() + interval '1 day 2 hours', 'club')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) VORSTAND — owner Juergen (90..02). Sieht alles, darf veroeffentlichen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('owner: sieht ALLE 16 Termine', (select count(*) from app.events), 16);
  perform testkit.is_eq('owner: sieht ALLE 18 event_teams', (select count(*) from app.event_teams), 18);
  perform testkit.is_eq('owner: sieht BEIDE Wettkaempfe', (select count(*) from app.competitions), 2);

  perform testkit.succeeds('owner: legt eine Vereinsveranstaltung an',
    $q$insert into app.events (club_id, type, title, starts_at, ends_at, audience)
       values ('c1ab0000-0000-4000-8000-000000000001', 'other', 'Neues Vereinsfest',
               now() + interval '1 day', now() + interval '1 day 2 hours', 'club')$q$);

  -- HOCHSTUFEN: auch der owner muss erst die Team-Zuordnung aufloesen — die
  -- Integritaetsregel (Grenzfall B) gilt fuer JEDEN, sie ist kein Rechte-Gate.
  -- e-15 haengt an t-03; der Versuch OHNE Aufraeumen scheitert korrekt.
  perform testkit.throws('owner: stuft einen Termin MIT Team nicht einfach hoch (23514)',
    $q$update app.events set audience = 'club'
        where id = 'e0000000-0000-4000-8000-000000000015'$q$, '23514');
  perform testkit.affects('owner: loest zuerst die Team-Zuordnung (e-15)',
    $q$update app.event_teams set deleted_at = now()
        where event_id = 'e0000000-0000-4000-8000-000000000015'$q$, 1);
  perform testkit.affects('owner: ... und stuft den nun teamlosen Termin auf Verein hoch',
    $q$update app.events set audience = 'club'
        where id = 'e0000000-0000-4000-8000-000000000015'$q$, 1);
end;
$$;
rollback;

-- MODERATOR — Petra (90..14) gehoert zum Vorstand: sie darf es auch.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('moderator: sieht ALLE 16 Termine (Hallenplanung)',
    (select count(*) from app.events), 16);
  perform testkit.succeeds('moderator: legt eine Vereinsveranstaltung an',
    $q$insert into app.events (club_id, type, title, starts_at, ends_at, audience)
       values ('c1ab0000-0000-4000-8000-000000000001', 'other', 'Moderator-Vereinsfest',
               now() + interval '1 day', now() + interval '1 day 2 hours', 'club')$q$);
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- E) GRENZFALL A — audience='teams' OHNE eine einzige event_teams-Zeile.
--    Die Antwort darf nicht "alle" sein. Sie ist "nur der Vorstand": der
--    Team-Zweig ist ein EXISTS ueber app.event_teams, null Zeilen = kein
--    Treffer. Ein solcher Termin ist ein Versehen (die API weist ihn mit 400
--    ab) — er darf aber nicht vereinsweit lecken, und er darf auch nicht
--    unauffindbar werden, sonst kann ihn niemand mehr reparieren.
-- ---------------------------------------------------------------------------
begin;
set local role postgres;
insert into app.events (id, club_id, type, title, starts_at, ends_at, audience) values
  ('e0000000-0000-4000-8000-0000000000ff', 'c1ab0000-0000-4000-8000-000000000001',
   'training', 'Geistersatz ohne Team',
   now() + interval '2 days', now() + interval '2 days 1 hour', 'teams');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select testkit.is_eq('Grenzfall A: teamloser ''teams''-Termin ist fuer das Mitglied UNSICHTBAR',
  (select count(*) from app.events where id = 'e0000000-0000-4000-8000-0000000000ff'), 0);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
select testkit.is_eq('Grenzfall A: ... auch fuer die Trainerin unsichtbar',
  (select count(*) from app.events where id = 'e0000000-0000-4000-8000-0000000000ff'), 0);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
select testkit.is_eq('Grenzfall A: ... aber der Vorstand findet ihn (kein Geistersatz)',
  (select count(*) from app.events where id = 'e0000000-0000-4000-8000-0000000000ff'), 1);
rollback;

-- ---------------------------------------------------------------------------
-- F) GRENZFALL B — 'club' und Teams schliessen sich aus, auf BEIDEN Wegen.
-- ---------------------------------------------------------------------------
begin;
set local role postgres;
do $$
begin
  -- Weg 1: an eine bestehende Vereinsveranstaltung ein Team haengen.
  perform testkit.throws('Grenzfall B: Team an eine Vereinsveranstaltung haengen -> 23514',
    $q$insert into app.event_teams (club_id, event_id, team_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000014',
               'b0000000-0000-4000-8000-000000000001')$q$, '23514');

  -- Weg 2: einen Termin MIT Teams auf 'club' hochstufen.
  perform testkit.throws('Grenzfall B: Termin mit Teams auf ''club'' hochstufen -> 23514',
    $q$update app.events set audience = 'club'
        where id = 'e0000000-0000-4000-8000-000000000001'$q$, '23514');

  -- Die Regel gilt AUSNAHMSLOS — auch fuer den Superuser/Seed. Eine zweite
  -- Wahrheit darf auch der Dienstweg nicht erzeugen (anders als der
  -- AUTORISIERUNGS-Trigger, der service_role bewusst durchlaesst).
  perform testkit.is_eq('Grenzfall B: die 2 Vereinsveranstaltungen haben 0 Team-Zeilen',
    (select count(*) from app.event_teams et
      join app.events e on e.id = et.event_id
     where e.audience = 'club'), 0);
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- F2) DER RETURNING-FALLSTRICK — dieselbe Falle wie bei den Kueren (93f).
--     BEIM BAUEN HINEINGETRETEN, nicht theoretisch: nach dem Scharfschalten
--     lieferte POST /events fuer JEDE Persona 403, auch fuer den owner. Denn
--     `insert ... returning` zieht ZUSAETZLICH die SELECT-Policy heran;
--     app.can_read_event ist STABLE und liest app.events, sieht die eben
--     eingefuegte Zeile im Snapshot des EIGENEN Statements also nicht ->
--     false -> irrefuehrendes "new row violates row-level security policy"
--     (42501), obwohl der INSERT erlaubt ist. Gefunden hat das NUR
--     api-db-test.sh; alle 1191 SQL-Tests waren gruen, weil sie den INSERT
--     nackt pruefen. Die API legt deshalb ohne returning an und liest die
--     Zeile in einem SEPARATEN Statement zurueck (events.ts, wie routines.ts).
--     Diese Assertions sind die Regressionsbremse: sie halten den Fallstrick
--     fest, damit ihn niemand mit `returning *` "vereinfacht".
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  -- Der nackte INSERT ist erlaubt (so pruefen die uebrigen Suiten).
  perform testkit.succeeds('returning: der nackte INSERT einer Vereinsveranstaltung ist erlaubt',
    $q$insert into app.events (club_id, type, title, starts_at, ends_at, audience)
       values ('c1ab0000-0000-4000-8000-000000000001', 'other', 'Ohne returning',
               now() + interval '1 day', now() + interval '1 day 2 hours', 'club')$q$);

  -- DERSELBE INSERT mit returning — 42501, sogar als owner. Das ist der Bug.
  perform testkit.throws('returning: DERSELBE INSERT mit `returning id` scheitert — auch als owner',
    $q$insert into app.events (club_id, type, title, starts_at, ends_at, audience)
       values ('c1ab0000-0000-4000-8000-000000000001', 'other', 'Mit returning',
               now() + interval '1 day', now() + interval '1 day 2 hours', 'club')
       returning id$q$, '42501');
end $$;
rollback;

-- Der Weg, den die API tatsaechlich geht (events.ts): id vorab ziehen, OHNE
-- returning einfuegen — und die Zeile in einem SEPARATEN Statement derselben
-- Transaktion zuruecklesen. Dann ist sie sichtbar. Das ist der Beweis, dass
-- der Ausweg traegt und die SELECT-Policy dafuer NICHT aufgeweicht werden muss.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
insert into app.events (id, club_id, type, title, starts_at, ends_at, audience)
values ('e0000000-0000-4000-8000-0000000000fe', 'c1ab0000-0000-4000-8000-000000000001',
        'other', 'API-Weg', now() + interval '1 day', now() + interval '1 day 2 hours', 'club');
select testkit.is_eq('returning: id vorab + INSERT ohne returning + separates Lesen -> sichtbar',
  (select count(*) from app.events where id = 'e0000000-0000-4000-8000-0000000000fe'), 1);
rollback;

-- ---------------------------------------------------------------------------
-- G) MANDANTENTRENNUNG bleibt (die Verengung darf sie nicht ersetzen):
--    Bert ist owner von Verein B — er sieht NICHTS von Verein A, obwohl er in
--    SEINEM Verein alles sieht.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('Mandant: Verein-B-owner sieht 0 Termine von Verein A',
    (select count(*) from app.events
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('Mandant: Verein-B-owner sieht 0 Wettkaempfe von Verein A',
    (select count(*) from app.competitions
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('Mandant: ... sieht aber SEINEN eigenen Termin',
    (select count(*) from app.events
      where club_id = 'deadbeef-0000-4000-8000-000000000001'), 1);
  -- Auch die Vereinsveranstaltung von Verein A bleibt draussen: audience='club'
  -- heisst "jedes Mitglied DIESES Vereins", nicht "alle".
  perform testkit.is_eq('Mandant: die Vereinsveranstaltung von A leckt NICHT nach B',
    (select count(*) from app.events where audience = 'club'), 0);
end $$;
rollback;
