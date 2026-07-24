-- ============================================================================
-- 99pB_schliessfach_miete.sql — Schließfächer kosten Geld (Migration 0070).
--
-- WARUM DIESE DATEI
-- ---------------------------------------------------------------------------
-- Die Vollreferenz nennt als Luecke Nr. 1 in der Liste: „Schliessfaecher sind
-- in v2 gratis." Gebaut wurde dagegen ZWEI Preisebenen, ein Mietvertrag und
-- eine Sichtbarkeit, die Geld anders behandelt als ein Schluessel. Jede dieser
-- Aussagen ist hier gemessen — und zu jeder 0 gehoert eine GEGENPROBE, die
-- zeigt, dass ueberhaupt etwas zu sehen gewesen waere.
--
--   A) Die Struktur: Groesse, Listenpreis, NULL <> 0, Seed-Gegenprobe.
--   B) Die Kasse verwaltet (treasurer sieht und schreibt alles).
--   C) Das Mitglied sieht NUR seine eigene Vermietung.
--   D) Die FAMILIE sieht die Vermietung ihres Kindes — anders als beim Fach
--      selbst. Eine Miete ist eine Zahlungspflicht; wer zahlt, muss sie sehen.
--   E) Der Plattform-Betreiber sieht sie NICHT (bewusste Abweichung von
--      lockers_select — Kinderdaten + Vereinsgeld in einem Satz).
--   F) Mandantentrennung.
--   G) Ein Fach ist nicht zweimal gleichzeitig vermietet.
--   H) club/locker/member sind unveraenderlich.
--   I) Gleicher-Verein-Waechter (fremdes Mitglied, fremdes Fach).
--   J) DIE v1-REGEL: der Statuswechsel des Fachs beendet die Vermietung NICHT.
--   K) Modul 'lockers' AUS -> auch die Vertraege sind weg.
--
-- Personas (seed), Verein A = c1ab..01:
--   Sandra a-01/90..01 coach · Juergen a-02/90..02 owner · Beate a-03/90..03
--   treasurer · Thomas a-04/90..04 admin · Katrin a-09/90..09 member (Mutter
--   von Lina a-07) · Petra a-14/90..14 moderator.
--   Faecher e0c0..01..08, Vermietungen e0d0..01..05.
-- Verein B = deadbeef-0000-..-01, Owner Bert deadbeef-9000-..-01.
--
-- Diese Datei ist NEU. Bestands-Tests bleiben unberuehrt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Struktur + Seed-Gegenprobe. Ohne sie waere jede 0 weiter unten wertlos.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('fach-geld: app.lockers traegt jetzt size UND price_per_month_cents',
    (select count(*) from information_schema.columns
      where table_schema = 'app' and table_name = 'lockers'
        and column_name in ('size', 'price_per_month_cents')), 2);

  perform testkit.is_eq('fach-geld: drei Groessen (klein/mittel/gross)',
    (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'locker_size'), 3);

  perform testkit.is_eq('fach-geld: drei Vermietungs-Zustaende (aktiv/beendet/gekuendigt)',
    (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'locker_rental_status'), 3);

  -- Der Kern der Preis-Bauform: LEER und NULL sind zwei verschiedene Aussagen.
  perform testkit.is_eq('fach-geld: Fach 06/07 haben KEINEN Preis (nicht festgelegt)',
    (select count(*) from app.lockers
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'
        and price_per_month_cents is null), 2);
  perform testkit.is_eq('fach-geld: Fach 04 ist AUSDRUECKLICH kostenlos (0), nicht "leer"',
    (select count(*) from app.lockers
      where id = 'e0c00000-0000-4000-8000-000000000004' and price_per_month_cents = 0), 1);

  -- Gegenprobe fuer alles Folgende: es gibt ueberhaupt Vertraege.
  perform testkit.is_eq('fach-geld: der Seed hat 5 Vermietungen (4 aktiv, 1 beendet)',
    (select count(*) from app.locker_rentals where deleted_at is null), 5);
  perform testkit.is_eq('fach-geld: davon 4 aktiv',
    (select count(*) from app.locker_rentals where status = 'aktiv' and deleted_at is null), 4);

  -- Ebene 2 weicht von Ebene 1 ab — genau dafuer gibt es sie.
  perform testkit.is_eq('fach-geld: Fach 02 kostet 300 laut Liste, vermietet ist es fuer 150',
    (select count(*) from app.locker_rentals r
      join app.lockers l on l.id = r.locker_id
     where r.id = 'e0d00000-0000-4000-8000-000000000002'
       and l.price_per_month_cents = 300 and r.price_per_month_cents = 150), 1);

  perform testkit.is_eq('fach-geld: eine Vermietung darf "nicht festgelegt" sein (NULL, kein 0)',
    (select count(*) from app.locker_rentals
      where id = 'e0d00000-0000-4000-8000-000000000003' and price_per_month_cents is null), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) Die Kasse verwaltet. treasurer = lockers/manage (Voreinstellung 0023).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('fach-miete: die Kassenwartin sieht ALLE 5 Vermietungen',
    (select count(*) from app.locker_rentals where deleted_at is null), 5);

  perform testkit.succeeds('fach-miete: die Kassenwartin darf ein freies Fach vermieten',
    $q$insert into app.locker_rentals (club_id, locker_id, member_id, price_per_month_cents, start_on)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0c00000-0000-4000-8000-000000000006',
               'a0000000-0000-4000-8000-000000000012', 250, current_date)$q$);

  perform testkit.affects('fach-miete: sie darf den vereinbarten Preis nachtraeglich aendern',
    $q$update app.locker_rentals set price_per_month_cents = 400
        where id = 'e0d00000-0000-4000-8000-000000000001'$q$, 1);

  perform testkit.affects('fach-miete: und sie darf kuendigen (Status, nicht Loeschen)',
    $q$update app.locker_rentals set status = 'gekuendigt', end_on = current_date
        where id = 'e0d00000-0000-4000-8000-000000000004'$q$, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) Das Mitglied sieht NUR seine eigene Vermietung — mit Gegenprobe.
--     Katrin (a-09) mietet Fach 01 (Vertrag e0d0..01).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('fach-miete: das Mitglied sieht GENAU eine Vermietung (von 5)',
    (select count(*) from app.locker_rentals where deleted_at is null), 1);
  perform testkit.is_eq('fach-miete: und zwar die eigene',
    (select count(*) from app.locker_rentals
      where id = 'e0d00000-0000-4000-8000-000000000001'), 1);

  perform testkit.throws('fach-miete: das Mitglied kann sich selbst kein Fach vermieten (42501)',
    $q$insert into app.locker_rentals (club_id, locker_id, member_id, start_on)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0c00000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000009', current_date)$q$, '42501');

  perform testkit.affects('fach-miete: und es kann den eigenen Preis nicht herunterschreiben',
    $q$update app.locker_rentals set price_per_month_cents = 0
        where id = 'e0d00000-0000-4000-8000-000000000001'$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) DIE FAMILIE. Anders als beim Fach selbst (dort gilt own_member_id) traegt
--    die Vermietung can_act_for_member: eine Miete ist eine ZAHLUNGSPFLICHT.
--    Gemessen an einem frisch angelegten Vertrag ueber Lina (a-07), dem Kind
--    von Katrin (a-09) — im Seed hat kein Kind ein Fach, und deshalb wird der
--    Fall hier hergestellt statt behauptet.
-- ---------------------------------------------------------------------------
begin;
insert into app.locker_rentals
  (id, club_id, locker_id, member_id, price_per_month_cents, start_on, status)
values
  ('e0d00000-0000-4000-8000-0000000000ff', 'c1ab0000-0000-4000-8000-000000000001',
   'e0c00000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007',
   350, current_date, 'aktiv');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('fach-familie: die Mutter sieht die Vermietung IHRER TOCHTER',
    (select count(*) from app.locker_rentals
      where id = 'e0d00000-0000-4000-8000-0000000000ff'), 1);
  perform testkit.is_eq('fach-familie: sie sieht ihre eigene UND die der Tochter (2), nicht mehr',
    (select count(*) from app.locker_rentals where deleted_at is null), 2);
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);

-- Die Gegenprobe: eine FREMDE Mutter (Stefanie a-12) sieht Linas Vertrag nicht.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('fach-familie: eine FREMDE Mutter sieht Linas Vertrag NICHT',
    (select count(*) from app.locker_rentals
      where id = 'e0d00000-0000-4000-8000-0000000000ff'), 0);
  perform testkit.is_eq('fach-familie: sie hat selbst keins -> sieht ueberhaupt keine Vermietung',
    (select count(*) from app.locker_rentals where deleted_at is null), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) Der Plattform-Betreiber. lockers_select traegt einen is_platform_admin-
--    Zweig — locker_rentals_select bewusst NICHT. Genau das wird hier gemessen,
--    denn eine bewusste Abweichung, die niemand prueft, ist beim naechsten
--    „Vereinheitlichen" weg.
--
--    ### WAS AN DIESEM BLOCK FALSCH WAR ####################################
--    Er hat den Betreiber gemessen, wie es ihn im Betrieb NICHT gibt: nur mit
--    dem Claim, OHNE die Sitzungsvariable app.operator_override. Die echte API
--    setzt sie aber bei JEDEM Plattform-Request
--    (services/api/src/middleware/operator-access.ts). Gemessen wurde also ein
--    Zustand, den kein einziger Request je erreicht — und das Ergebnis „0
--    Vermietungen" war deshalb keine Zusicherung, sondern ein Zufall.
--    Nachgemessen im echten Zustand sah der Betreiber ALLE 5 Vertraege, mit
--    member_id und Preis. Ein Test, der eine Zusage nur scheinbar prueft, ist
--    schlimmer als kein Test: er beendet das Nachdenken.
--
--    Der Block misst jetzt BEIDE Zustaende und benennt, welcher der echte ist.
-- ---------------------------------------------------------------------------

-- E1) DER ECHTE BETRIEBSZUSTAND: Claim UND Sitzungsvariable, wie die API sie
--     setzt. Das ist der Fall, auf den es ankommt.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
select set_config('app.operator_override', 'on', true);   -- wie die echte API
set local role authenticated;
do $$
begin
  -- Gegenprobe zuerst, und diesmal eine, die etwas wert ist: die Einsicht ist
  -- nachweislich AN und wirkt nachweislich — sonst waere jede 0 unten wertlos.
  perform testkit.is_eq('fach-betreiber: die Betreiber-Einsicht ist eingeschaltet',
    (select case when app.operator_override() then 1 else 0 end), 1);
  perform testkit.is_eq('fach-betreiber: sie wirkt auch — "members" ist owner-gleich (Rang 5)',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'members')), 5);
  -- ### GEAENDERT DURCH MIGRATION 0075 ###
  -- Hier stand: „er sieht die 8 Faecher (lockers_select, is_platform_admin-
  -- Zweig)" — und genau diese Zeile war der Rest des Lecks. app.lockers traegt
  -- assigned_member_id UND price_per_month_cents; von den 4 vermieteten
  -- Faechern gehoeren DREI Minderjaehrigen. „Welches Kind mietet welches Fach
  -- fuer wie viel Geld" blieb damit rekonstruierbar, obwohl locker_rentals
  -- schon zu war. 0075 bindet lockers_select an app.operator_may('lockers').
  perform testkit.is_eq('fach-betreiber: er sieht KEIN Fach mehr (0075, waren 8)',
    (select count(*) from app.lockers where deleted_at is null), 0);
  -- Und auch die SECURITY-DEFINER-Warnfunktion meldet nicht mehr an der RLS
  -- vorbei, dass an einem Fach gerade eine Vermietung laeuft.
  perform testkit.is_eq('fach-betreiber: locker_has_active_rental meldet nichts mehr (0075)',
    (select count(*) from app.lockers l where app.locker_has_active_rental(l.id)), 0);

  -- DER KERN: keine Vermietung. Nicht weil der Zugang fehlt, sondern
  -- weil die Faehigkeit "lockers" fuer den Betreiber nicht freigegeben ist (0074).
  perform testkit.is_eq('fach-betreiber: aber KEINE Vermietung (Kinderdaten + Vereinsgeld)',
    (select count(*) from app.locker_rentals where deleted_at is null), 0);
  perform testkit.is_eq('fach-betreiber: cap_rank(lockers) ist 0 — die Zweckbindung greift (0074)',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'lockers')), 0);
  perform testkit.is_eq('fach-betreiber: "lockers" steht NICHT auf der Betreiber-Allowlist',
    (select count(*) from app.operator_capabilities where capability_key = 'lockers'), 0);

  -- Und er kann auch keine anlegen oder aendern.
  perform testkit.throws('fach-betreiber: er kann auch keine Vermietung anlegen (42501)',
    $q$insert into app.locker_rentals (club_id, locker_id, member_id, start_on)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0c00000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000007', current_date)$q$,
    '42501');
end;
$$;
rollback;

-- E2) Gegenprobe, dass es die Vertraege ueberhaupt gibt — RLS-frei gezaehlt.
--     Ohne sie bestuende E1 auch bei leerer Tabelle.
begin;
set local role service_role;
do $$
begin
  perform testkit.is_eq('fach-betreiber/Gegenprobe: es gibt ueberhaupt 5 Vermietungen',
    (select count(*) from app.locker_rentals where deleted_at is null), 5);
end;
$$;
rollback;

-- E3) Der Claim ALLEIN — der Zustand, den der alte Block gemessen hat.
--     Bis 0075 sah er hier 8 Faecher: lockers_select fragte app.is_platform_admin()
--     direkt, also OHNE die Sitzungsvariable und damit ohne jede Kopplung an die
--     Protokollzeile aus 0051. Seit 0075 haengt auch dieser Zweig an
--     app.operator_may('lockers') — und der verlangt beides.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('fach-betreiber/ohne Einsicht: der blosse Claim sieht KEIN Fach mehr (0075, waren 8)',
    (select count(*) from app.lockers where deleted_at is null), 0);
  perform testkit.is_eq('fach-betreiber/ohne Einsicht: und ebenfalls keine Vermietung',
    (select count(*) from app.locker_rentals where deleted_at is null), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Mandantentrennung.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('fach-mandant: der Owner des FREMDEN Vereins sieht 0 Vermietungen',
    (select count(*) from app.locker_rentals where deleted_at is null), 0);

  perform testkit.throws('fach-mandant: er kann auch keine in Verein A anlegen (42501)',
    $q$insert into app.locker_rentals (club_id, locker_id, member_id, start_on)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0c00000-0000-4000-8000-000000000006',
               'a0000000-0000-4000-8000-000000000009', current_date)$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- G) Ein Fach ist nicht zweimal gleichzeitig vermietet — aber die HISTORIE
--    daneben ist erlaubt. Beides gehoert gemessen, sonst waere der Teilindex
--    entweder zu scharf oder wirkungslos.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('fach-eindeutig: ein zweiter AKTIVER Vertrag am selben Fach wird abgewiesen',
    $q$insert into app.locker_rentals (club_id, locker_id, member_id, start_on, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0c00000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000012', current_date, 'aktiv')$q$, '23505');

  perform testkit.succeeds('fach-eindeutig: eine BEENDETE Vermietung daneben ist erlaubt (Historie)',
    $q$insert into app.locker_rentals (club_id, locker_id, member_id, start_on, end_on, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0c00000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000012',
               current_date - 700, current_date - 500, 'beendet')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- H) Unveraenderlich: Verein, Fach, Mieter:in. Ohne das liesse sich
--    Zahlungshistorie nachtraeglich einer anderen Person zuschreiben.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('fach-immutabel: das FACH einer Vermietung ist nicht wechselbar',
    $q$update app.locker_rentals set locker_id = 'e0c00000-0000-4000-8000-000000000006'
        where id = 'e0d00000-0000-4000-8000-000000000001'$q$, '42501');

  perform testkit.throws('fach-immutabel: die MIETER:IN ist nicht wechselbar',
    $q$update app.locker_rentals set member_id = 'a0000000-0000-4000-8000-000000000012'
        where id = 'e0d00000-0000-4000-8000-000000000001'$q$, '42501');

  -- Gegenprobe: der Alltag bleibt moeglich.
  perform testkit.affects('fach-immutabel: Preis/Zeitraum/Status bleiben aenderbar',
    $q$update app.locker_rentals set price_per_month_cents = 999, end_on = current_date + 30
        where id = 'e0d00000-0000-4000-8000-000000000001'$q$, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- I) Gleicher-Verein-Waechter. Der FK garantiert nur Existenz.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('fach-integritaet: ein FREMDES Mitglied kann kein Fach in Verein A mieten',
    $q$insert into app.locker_rentals (club_id, locker_id, member_id, start_on)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0c00000-0000-4000-8000-000000000006',
               'deadbeef-a000-4000-8000-000000000001', current_date)$q$, '23514');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- J) DIE v1-REGEL, und der einzige Grund, warum sie hier steht: sie ist
--    KONTRAINTUITIV. „Fach auf defekt" fuehlt sich an wie „Vertrag zu Ende".
--    Ist es nicht — und die Oberflaeche muss genau davor warnen koennen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('fach-warnung: Fach 01 hat eine laufende Vermietung',
    (select case when app.locker_has_active_rental('e0c00000-0000-4000-8000-000000000001')
                 then 1 else 0 end), 1);

  perform testkit.affects('fach-warnung: das Fach wird auf defekt gesetzt',
    $q$update app.lockers set status = 'broken'
        where id = 'e0c00000-0000-4000-8000-000000000001'$q$, 1);

  perform testkit.is_eq('fach-warnung: die Vermietung laeuft TROTZDEM weiter (v1-Regel, keine Automatik)',
    (select case when app.locker_has_active_rental('e0c00000-0000-4000-8000-000000000001')
                 then 1 else 0 end), 1);

  perform testkit.affects('fach-warnung: auch "freigeben" beendet den Vertrag nicht',
    $q$update app.lockers set status = 'free', assigned_member_id = null
        where id = 'e0c00000-0000-4000-8000-000000000001'$q$, 1);

  perform testkit.is_eq('fach-warnung: der Vertrag steht immer noch auf aktiv',
    (select count(*) from app.locker_rentals
      where id = 'e0d00000-0000-4000-8000-000000000001' and status = 'aktiv'), 1);

  -- Gegenprobe: an einem Fach OHNE Vertrag meldet die Funktion auch nichts.
  perform testkit.is_eq('fach-warnung: Fach 06 hat keine Vermietung -> keine Warnung',
    (select case when app.locker_has_active_rental('e0c00000-0000-4000-8000-000000000006')
                 then 1 else 0 end), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- K) Modul 'lockers' AUS. Ohne Gate waere der Schalter eine halbe Wahrheit:
--    Faecher weg, Mietvertraege noch da.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

insert into app.club_modules (club_id, module_key, enabled)
values ('c1ab0000-0000-4000-8000-000000000001', 'lockers', false)
on conflict (club_id, module_key) do update set enabled = false;

do $$
begin
  perform testkit.is_eq('fach-modul: "lockers" AUS -> 0 Faecher',
    (select count(*) from app.lockers), 0);
  perform testkit.is_eq('fach-modul: "lockers" AUS -> auch 0 Vermietungen',
    (select count(*) from app.locker_rentals), 0);
  perform testkit.throws('fach-modul: "lockers" AUS -> auch der Admin legt keine Vermietung an',
    $q$insert into app.locker_rentals (club_id, locker_id, member_id, start_on)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0c00000-0000-4000-8000-000000000006',
               'a0000000-0000-4000-8000-000000000009', current_date)$q$, '42501');
end;
$$;
rollback;
