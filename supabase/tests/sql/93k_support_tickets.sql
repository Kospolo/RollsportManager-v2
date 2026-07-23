-- ============================================================================
-- 93k_support_tickets.sql — Support-Tickets (Migration 0052).
--
-- Diese Datei ist NEU. Bestands-Tests bleiben unberuehrt.
--
-- Der Kern, in einem Satz: ein Ticket enthaelt Klartext-Probleme mit Namen von
-- Mitgliedern (oft Kindern). Verein A darf davon bei Verein B NICHTS sehen,
-- der Betreiber sieht beides, und ein einfaches Mitglied sieht gar nichts.
--
-- Personen (seed.sql + 01_fixture_club_b.sql):
--   Verein A c1ab0000-…-0001  Juergen …0002 owner · Thomas …0004 admin
--                             Petra …0014 moderator · Beate …0003 treasurer
--                             Sandra …0001 coach · Katrin …0009 member
--   Verein B deadbeef-0000-…  Bert deadbeef-9000-…-0001 owner
--                             Paula deadbeef-9000-…-0002 member
--   Betreiber 90000000-…-0090 (KEINE club_members-Zeile, Profil vorhanden)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) FIXTURE — und zugleich der erste Beweis: der VORSTAND darf ein Ticket
--    aufmachen. Beide Tickets entstehen unter IMPERSONATION (nicht als
--    Superuser), damit hier schon die INSERT-Policy laeuft. Committed, weil
--    die folgenden Bloecke sie brauchen; Aufraeumen am Dateiende.
-- ---------------------------------------------------------------------------
begin;

-- Verein A: Thomas (admin) macht ein Ticket auf.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('support: Vereins-Vorstand (admin) macht ein Ticket auf',
    $q$insert into app.support_tickets (id, club_id, created_by_member_id, subject)
       values ('5099a000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000004',
               'Anmeldung von Clara klemmt — Geburtsdatum wird nicht uebernommen')$q$);
  perform testkit.succeeds('support: … und schreibt die Eroeffnungsnachricht',
    $q$insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
       values ('5099a000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-000000000004', 'club',
               'Beim Anlegen von Clara Musterkind (geb. 2016-04-02) bricht das Formular ab.')$q$);
end;
$$;

reset role;

-- Verein B: Bert (owner) macht sein Ticket auf.
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('support: Vereins-Vorstand (owner) von Verein B macht ein Ticket auf',
    $q$insert into app.support_tickets (id, club_id, created_by_member_id, subject)
       values ('5099b000-0000-4000-8000-000000000001',
               'deadbeef-0000-4000-8000-000000000001',
               'deadbeef-a000-4000-8000-000000000001',
               'SEPA-Lastschrift von Paula Probe doppelt eingezogen')$q$);
  perform testkit.succeeds('support: … Eroeffnungsnachricht Verein B',
    $q$insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
       values ('5099b000-0000-4000-8000-000000000001',
               'deadbeef-0000-4000-8000-000000000001',
               'deadbeef-9000-4000-8000-000000000001', 'club',
               'Paula Probe wurde der Beitrag zweimal abgebucht.')$q$);
end;
$$;

reset role;
commit;

-- Der Trigger hat mitgeschrieben (kein Aufrufer hat last_reply_* gesetzt).
begin;
do $$
begin
  perform testkit.is_eq('support: der Trigger setzt last_reply_by = club auf beiden Tickets',
    (select count(*) from app.support_tickets
      where last_reply_by = 'club' and last_reply_at is not null), 2);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DER KERN — MANDANTENTRENNUNG. Verein A sieht das Ticket von Verein B
--    NICHT. Beide Richtungen, Tickets UND Verlauf.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('support A->B: Vorstand A sieht genau 1 Ticket (das eigene)',
    (select count(*) from app.support_tickets), 1);
  perform testkit.is_eq('support A->B: das Ticket von Verein B ist unsichtbar',
    (select count(*) from app.support_tickets
      where club_id = 'deadbeef-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('support A->B: der Verlauf von Verein B ist unsichtbar',
    (select count(*) from app.support_messages
      where club_id = 'deadbeef-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('support A->B: gezielter Griff auf die Ticket-ID von B liefert nichts',
    (select count(*) from app.support_tickets
      where id = '5099b000-0000-4000-8000-000000000001'), 0);
  -- Er kann auch kein TICKET in den fremden Verein legen. Auf support_tickets
  -- liegt kein BEFORE-Trigger — hier antwortet die INSERT-Policy selbst, und
  -- zwar mit 42501. Das ist der Beleg fuer die RLS-Schicht als solche.
  perform testkit.throws('support A->B: Vorstand A kann kein Ticket in Verein B anlegen (42501, RLS)',
    $q$insert into app.support_tickets (club_id, created_by_member_id, subject)
       values ('deadbeef-0000-4000-8000-000000000001',
               'deadbeef-a000-4000-8000-000000000001', 'Untergeschoben')$q$,
    '42501');

  -- Und er kann sich nicht in den fremden Verlauf HINEINSCHREIBEN.
  -- ACHTUNG SQLSTATE: hier antwortet NICHT die Policy, sondern der
  -- BEFORE-INSERT-Trigger app.support_guard_message — Trigger laufen vor der
  -- RLS-WITH-CHECK, also P0001 statt 42501. Dieselbe Reihenfolge notiert
  -- 0024:196-199 fuer protect_club_membership ("feuert ... fuer JEDEN, also
  -- P0001 noch vor der RLS"). Beide Schichten wuerden greifen; die erste
  -- gewinnt. Verlangt wird hier nur: es geht NICHT.
  perform testkit.throws('support A->B: Vorstand A kann keine Nachricht an das Ticket von B haengen (P0001, Trigger vor RLS)',
    $q$insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
       values ('5099b000-0000-4000-8000-000000000001',
               'deadbeef-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-000000000004', 'club', 'mitgelesen')$q$,
    'P0001');
  -- Auch nicht mit dem EIGENEN club_id als Tarnung: der zusammengesetzte FK
  -- (ticket_id, club_id) kennt die Kombination nicht.
  perform testkit.throws('support A->B: fremdes Ticket + eigener club_id scheitert am FK (23503)',
    $q$insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
       values ('5099b000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-000000000004', 'club', 'getarnt')$q$,
    '23503');
end;
$$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('support B->A: Vorstand B sieht genau 1 Ticket (das eigene)',
    (select count(*) from app.support_tickets), 1);
  perform testkit.is_eq('support B->A: das Ticket von Verein A ist unsichtbar',
    (select count(*) from app.support_tickets
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('support B->A: der Verlauf von Verein A ist unsichtbar',
    (select count(*) from app.support_messages
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) DER BETREIBER sieht BEIDE — mandantenuebergreifend, ueber
--    app.is_platform_admin() direkt (NICHT ueber cap_rank, das hat bewusst
--    keinen Bypass, 0025:219-222).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","club_roles":{},"is_platform_admin":true,"app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('support: der Betreiber sieht BEIDE Tickets',
    (select count(*) from app.support_tickets), 2);
  perform testkit.is_eq('support: der Betreiber sieht den Verlauf BEIDER Vereine',
    (select count(*) from app.support_messages), 2);
  perform testkit.is_eq('support: … und zwar aus zwei verschiedenen Mandanten',
    (select count(distinct club_id) from app.support_tickets), 2);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) DIE ENTSCHEIDUNG, BELEGT: ein EINFACHES MITGLIED kann NICHT.
--    Katrin (member, Verein A) sieht kein Ticket ihres eigenen Vereins und
--    kann keines aufmachen. Das ist Absicht: im Ticket oben steht der Name
--    eines Kindes samt Geburtsdatum.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('support: einfaches Mitglied sieht KEIN Ticket (auch nicht im eigenen Verein)',
    (select count(*) from app.support_tickets), 0);
  perform testkit.is_eq('support: einfaches Mitglied sieht KEINEN Verlauf',
    (select count(*) from app.support_messages), 0);
  perform testkit.throws('support: einfaches Mitglied kann kein Ticket aufmachen (42501)',
    $q$insert into app.support_tickets (club_id, created_by_member_id, subject)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'Darf nicht')$q$,
    '42501');
end;
$$;
rollback;

-- Der Trainer ebenso wenig (is_club_admin schliesst coach aus).
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('support: Trainer:in sieht KEIN Ticket',
    (select count(*) from app.support_tickets), 0);
end;
$$;
rollback;

-- Und der Kassenwart auch nicht — die AUSDRUECKLICHE Kante der Entscheidung:
-- is_club_admin (0007:107-115) = owner/admin/moderator, OHNE treasurer.
-- can_manage_members haette ihn eingeschlossen; genommen wurde is_club_admin.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('support: Kassenwart:in sieht KEIN Ticket (is_club_admin ohne treasurer)',
    (select count(*) from app.support_tickets), 0);
end;
$$;
rollback;

-- Der Moderator DARF — die andere Kante derselben Entscheidung.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('support: Moderator:in sieht das Ticket des eigenen Vereins',
    (select count(*) from app.support_tickets), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) NIEMAND SPRICHT FUER DIE ANDERE SEITE (app.support_guard_message).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  -- Der Verein gibt sich als Betreiber aus ("Ihr Anliegen ist erledigt").
  perform testkit.throws('support: Verein kann sich NICHT als Betreiber ausgeben (author_kind=platform)',
    $q$insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
       values ('5099a000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-000000000004', 'platform', 'Erledigt, keine Sorge.')$q$,
    'P0001');
  -- … und schreibt auch nicht im Namen der Kollegin.
  perform testkit.throws('support: niemand schreibt unter fremdem Namen',
    $q$insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
       values ('5099a000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-000000000002', 'club', 'Gruss vom Vorsitzenden')$q$,
    'P0001');
end;
$$;
rollback;

-- Auch der Betreiber kann den Verein nicht sprechen lassen.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","club_roles":{},"app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('support: der Betreiber kann NICHT als Verein schreiben (author_kind=club)',
    $q$insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
       values ('5099a000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-000000000090', 'club', 'Wir ziehen die Frage zurueck.')$q$,
    'P0001');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) STATUS/PRIORITAET SIND SACHE DES BETREIBERS.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  -- Selbst der Vereins-INHABER nicht — er sieht das Ticket, aendert es aber nicht.
  perform testkit.is_eq('support: der Vereins-Inhaber SIEHT sein Ticket',
    (select count(*) from app.support_tickets
      where id = '5099a000-0000-4000-8000-000000000001'), 1);
  perform testkit.affects('support: … aendert aber den Status nicht (RLS, 0 Zeilen)',
    $q$update app.support_tickets set status = 'closed'
       where id = '5099a000-0000-4000-8000-000000000001'$q$, 0);
  perform testkit.affects('support: … und die Prioritaet auch nicht',
    $q$update app.support_tickets set priority = 'urgent'
       where id = '5099a000-0000-4000-8000-000000000001'$q$, 0);
  perform testkit.affects('support: … und loeschen kann es niemand (keine DELETE-Policy)',
    $q$delete from app.support_tickets
       where id = '5099a000-0000-4000-8000-000000000001'$q$, 0);
end;
$$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","club_roles":{},"app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.affects('support: der Betreiber setzt den Status (1 Zeile)',
    $q$update app.support_tickets set status = 'closed'
       where id = '5099a000-0000-4000-8000-000000000001'$q$, 1);
  perform testkit.is_eq('support: closed_at folgt dem Status automatisch',
    (select count(*) from app.support_tickets
      where id = '5099a000-0000-4000-8000-000000000001' and closed_at is not null), 1);
  perform testkit.affects('support: … und beim Wiederoeffnen faellt closed_at weg',
    $q$update app.support_tickets set status = 'open'
       where id = '5099a000-0000-4000-8000-000000000001'$q$, 1);
  perform testkit.is_eq('support: closed_at ist nach dem Wiederoeffnen leer',
    (select count(*) from app.support_tickets
      where id = '5099a000-0000-4000-8000-000000000001' and closed_at is null), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- G) DIE EINE STATUS-AUTOMATIK: waiting_on_club + Vereinsnachricht -> open.
--    Ohne sie koennte der Verein nie signalisieren, dass er geliefert hat
--    (er darf den Status nicht setzen, siehe F).
-- ---------------------------------------------------------------------------
begin;
-- Ausgangslage als Betreiber: "wartet auf Rueckmeldung".
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","club_roles":{},"app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;
update app.support_tickets set status = 'waiting_on_club'
 where id = '5099a000-0000-4000-8000-000000000001';
reset role;

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('support: Ausgangslage — das Ticket wartet auf den Verein',
    (select count(*) from app.support_tickets
      where id = '5099a000-0000-4000-8000-000000000001' and status = 'waiting_on_club'), 1);
  perform testkit.succeeds('support: der Verein antwortet',
    $q$insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
       values ('5099a000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-000000000004', 'club',
               'Geburtsdatum nachgereicht: 02.04.2016.')$q$);
  perform testkit.is_eq('support: … das Ticket steht danach wieder auf "offen"',
    (select count(*) from app.support_tickets
      where id = '5099a000-0000-4000-8000-000000000001' and status = 'open'), 1);
  perform testkit.is_eq('support: … und last_reply_by steht auf club',
    (select count(*) from app.support_tickets
      where id = '5099a000-0000-4000-8000-000000000001' and last_reply_by = 'club'), 1);
end;
$$;
rollback;

-- Ein GESCHLOSSENES Ticket reisst eine Vereinsnachricht NICHT wieder auf —
-- die Automatik ist genau eine Kante, nicht "irgendwas mit Status".
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","club_roles":{},"app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;
update app.support_tickets set status = 'closed'
 where id = '5099a000-0000-4000-8000-000000000001';
reset role;

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('support: der Verein schreibt an ein geschlossenes Ticket',
    $q$insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
       values ('5099a000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-000000000004', 'club', 'Nachtrag.')$q$);
  perform testkit.is_eq('support: … das Ticket bleibt geschlossen (kein Auto-Wiederoeffnen)',
    (select count(*) from app.support_tickets
      where id = '5099a000-0000-4000-8000-000000000001' and status = 'closed'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- H) DER VERLAUF IST ANHAENGEND — keine Seite schreibt ihn um.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.affects('support: der Verein kann eine Nachricht nicht nachtraeglich aendern',
    $q$update app.support_messages set body = 'so war das nie'
       where club_id = 'c1ab0000-0000-4000-8000-000000000001'$q$, 0);
  perform testkit.affects('support: … und nicht loeschen',
    $q$delete from app.support_messages
       where club_id = 'c1ab0000-0000-4000-8000-000000000001'$q$, 0);
end;
$$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","club_roles":{},"app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;
do $$
begin
  -- Auch der Betreiber nicht. Er sieht alles — umschreiben darf er nichts.
  perform testkit.affects('support: auch der BETREIBER kann den Verlauf nicht umschreiben',
    $q$update app.support_messages set body = 'das habe ich nie gesagt'$q$, 0);
  perform testkit.affects('support: … und nicht loeschen',
    $q$delete from app.support_messages$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- I) anon sieht nichts (die Tabellen sind keine oeffentliche Flaeche).
-- ---------------------------------------------------------------------------
begin;
set local role anon;
do $$
begin
  perform testkit.throws('support: anon kommt an die Tickets nicht heran (42501)',
    $q$select count(*) from app.support_tickets$q$, '42501');
  perform testkit.throws('support: anon kommt an den Verlauf nicht heran (42501)',
    $q$select count(*) from app.support_messages$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- J) KEIN DRIFT IM FAEHIGKEITEN-KATALOG. 0052 fuehrt bewusst KEINE neue
--    Faehigkeit ein und benutzt in keiner seiner Policies has_cap/cap_rank
--    (Begruendung: Migrationskopf 0052). Faellt dieser Block, hat jemand das
--    umgebaut — und muss dann 93j:37/:46 und 0033 mitziehen.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_bad text;
begin
  -- 32 -> 33 (0069, 'coach_notes' fuer die interne Trainer-Notiz). Diese Zahl
  -- ist BUCHHALTUNG, nicht die Aussage dieses Blocks: sie faellt auch dann,
  -- wenn eine voellig unbeteiligte Migration den Katalog erweitert — so wie
  -- hier. Die eigentliche Zusicherung ("0052 fuehrt keine Faehigkeit ein und
  -- haengt keine Support-Policy an has_cap") tragen die beiden Pruefungen
  -- darunter, und die sind unveraendert und weiterhin scharf.
  perform testkit.is_eq('support: der Faehigkeiten-Katalog hat 33 Faehigkeiten',
    (select count(*) from app.capabilities), 33);
  perform testkit.is_eq('support: es gibt KEINE Faehigkeit "support"',
    (select count(*) from app.capabilities where key like 'support%'), 0);

  -- Der Detektor aus 0033 auf die beiden neuen Tabellen angesetzt.
  select string_agg(distinct u.capability_key, ', ') into v_bad
    from app.capability_policy_usage() u
   where u.object in ('support_tickets', 'support_messages');

  if v_bad is null then
    perform testkit.ok('support: keine Support-Policy haengt an einer Faehigkeit (rollenbasiert, wie entschieden)');
  else
    perform testkit.fail('support: keine Support-Policy haengt an einer Faehigkeit (rollenbasiert, wie entschieden)',
      format('has_cap/cap_rank in einer Support-Policy gefunden: %s — 0033 + 93j muessen dann nachgezogen werden', v_bad));
  end if;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- K) Aufraeumen: die Fixture aus (A) wieder entfernen, damit die folgenden
--    Suiten eine Datenbank ohne Support-Altlasten vorfinden. Als Superuser
--    (Fixture-Abbau, kein Policy-Test) — die Nachrichten haengen per
--    ON DELETE CASCADE am Ticket.
-- ---------------------------------------------------------------------------
begin;
delete from app.support_tickets
 where id in ('5099a000-0000-4000-8000-000000000001',
              '5099b000-0000-4000-8000-000000000001');
do $$
begin
  perform testkit.is_eq('support: Fixture abgeraeumt — keine Tickets mehr',
    (select count(*) from app.support_tickets), 0);
  perform testkit.is_eq('support: … und der Verlauf ist per CASCADE mitgegangen',
    (select count(*) from app.support_messages), 0);
end;
$$;
commit;
