-- ============================================================================
-- 0040_rsvp_gesundheitsdaten.sql — Art.-9-Leck schliessen: der Abmeldegrund
-- (rsvp_status 'sick' + der Freitext) ist Gesundheitsdatum, oft das EINES KINDES.
--
-- ### DER BEFUND, LIVE GEMESSEN (nicht vermutet) ###
-- Gegen den Harness (Migrationen + seed), als Katrin Grünewald (90..09) —
-- ein GANZ NORMALES Mitglied, weder Trainerin noch Erziehungsberechtigte:
--     set local role authenticated;
--     select m.first_name, m.birth_date, r.status, r.comment
--       from app.event_rsvps r join app.club_members m on m.id = r.member_id
--      where r.status = 'sick';
--   -> Nele Hoffmann | 2014-08-16 | sick | Erkältung, morgen wieder dabei
-- Ein beliebiges Vereinsmitglied liest, dass ein 11-jaehriges Kind krank ist,
-- samt Diagnose-Freitext. Ursache:
--   * app.rsvp_status kennt 'sick'                         (0003:23)
--   * app.event_rsvps.comment ist Freitext                 (0003:123)
--   * event_rsvps_select ist blank app.is_club_member()    (0003:231-233)
--     — der Kommentar DARUEBER (0003:163) behauptet "RSVPs = die Person selbst /
--       ihr Vormund / das Trainerteam". Der CODE sagt: JEDES Mitglied. Der Code galt.
--   * GET /events liefert die Zeilen per to_jsonb(r) komplett aus (events.ts:73-76)
--   * 0021/0026/0027 haben event_rsvps nie angefasst (gegengeprueft: 0 Treffer)
--
-- ### WER DEN GRUND SEHEN DARF ###
--   1. die Person selbst + ihre Erziehungsberechtigten  (app.can_act_for_member)
--   2. wer den Verein verwaltet: owner/admin
--   3. wer das TEAM DIESES MITGLIEDS betreut: coach/guest_coach + coached_team_ids
-- Alle anderen sehen hoechstens "abgemeldet" (declined) OHNE Grund.
--
-- BEWUSST DRAUSSEN, jeweils die STRENGERE Lesart (Datenminimierung, Art. 5(1)(c)):
--   * moderator — moderiert Inhalte; Gesundheitsdaten von Kindern gehen ihn nichts an.
--     (0021 zaehlt ihn im admin_set mit; fuer Art.-9-Daten wird hier bewusst enger
--      geschnitten als bei den Kueren.)
--   * treasurer — Kasse.
--   * PLATFORM-ADMIN — app.is_club_member() traegt einen is_platform_admin-Bypass
--     (0025:85-95), can_read_rsvp_reason traegt ihn ABSICHTLICH NICHT: der
--     Plattformbetreiber sieht die Zeile (maskiert), nie den Grund. Getestet.
--
-- ### WARUM KEINE EIGENE FAEHIGKEIT (app.capabilities) — GEPRUEFT, NICHT GERATEN ###
-- Erst der Katalog: KEINE bestehende Faehigkeit passt.
--   * events/attendance — rbac_default_level gibt 'member' hier read_all
--     (0023:196/207). has_cap(...,'attendance','read_team') ist fuer JEDES
--     Mitglied wahr -> als Schranke wertlos.
--   * routines — die Stufenform (read_own/read_team/read_all) passt exakt, die
--     BEDEUTUNG nicht: "Küren – Ansehen" (0028:66) wuerde im Admin-UI die
--     Krankmeldung von Kindern schalten. Ein falsches Etikett ist hier
--     schlimmer als keins.
--   * member_contact — Kontaktdaten, nicht Gesundheit; coach = 'none'
--     (0023:180) -> die eigene Trainerin des Kindes verloere den Grund,
--     genau gegen die Anforderung.
-- Eine NEUE Faehigkeit ist von BESTANDS-TESTS verboten (die nicht geaendert
-- werden duerfen):
--   93j_capability_enforcement.sql:37  is_eq('der Katalog hat 32 Faehigkeiten', 32)
--   93j:40-46                          enforced=3 / partial=2 / write_only=9 /
--                                      unenforced=18  (Summe = 32)
--   93i_protected_capabilities.sql:29  is_eq('owner_only', 3)
-- Eine 33. Faehigkeit liesse 93j:37 sofort fallen ("got 33, expected 32"), eine
-- owner_only-Faehigkeit zusaetzlich 93i:29. Ausserdem verlangt 93j Block C von
-- jeder als 'enforced' etikettierten Faehigkeit eine SELECT-POLICY — die es hier
-- nie gaebe, weil die Schranke eine SPALTEN-Maske ist und keine Zeilen-Policy.
-- -> Deshalb rollenbasiert, exakt nach dem Muster app.can_read_routine (0021:88),
--    das dieselbe Frage fuer die Kueren beantwortet. has_club_role ist seit
--    0025:64 DB-aufgeloest (member_role_keys), traegt also Mehrfachrollen UND
--    den guest_coach-Ablauf zentral.
--
-- ### DIE FALLE, AN DER DER JUBILAEUMS-FIX GEFALLEN IST ###
-- Dort reichte es nicht, 'years' wegzunehmen — die blosse ANWESENHEIT in der
-- Liste war schon die Auskunft. Hier zu Ende gedacht:
--   (a) ZEILE VERSTECKEN WAERE DER GLEICHE FEHLER. Filterte man 'sick'-Zeilen per
--       RLS weg, verriete die LUECKE den Grund: Kind X ist im Team, hat aber keine
--       RSVP-Zeile -> "krank oder gar nicht geantwortet", und gegen die Anzahl der
--       Antworten aufgeloest sogar eindeutig. Deshalb bleibt die ZEILE stehen und
--       nur der WERT wird maskiert. Die RLS-Zeilenregel bleibt unberuehrt.
--   (b) 'sick' -> 'declined' ist ununterscheidbar von einer echten Absage:
--       deterministische Abbildung auf einen Wert, den es ohnehin haeufig gibt.
--   (c) DER FREITEXT IST DIE EIGENTLICHE GEFAHR, NICHT DER ENUM-WERT. Der Seed
--       zeigt es selbst: e-07/a-19 ist 'declined' mit "Klassenfahrt bis Freitag".
--       Nichts hindert Eltern daran, "Kind hat Fieber" in eine 'declined'-Zeile zu
--       schreiben. Nur den Kommentar der 'sick'-Zeilen zu leeren, waere doppelt
--       falsch: es liesse Gesundheitsdaten in 'declined'-Zeilen stehen UND
--       "declined + comment IS NULL" waere der neue Verraeter (genau die
--       Jubilaeums-Falle). Deshalb: comment wird fuer JEDEN Status geleert.
--   (d) AGGREGAT / ZAEHLUNG / SORTIERUNG: dagegen hilft eine Maske in der API
--       NICHT — `order by status` oder `count(*) group by status` auf der
--       Basistabelle laege am TypeScript vorbei. Deshalb wird der Rohwert per
--       GRANT entzogen (unten, Punkt 4): ohne SELECT auf status/comment kann
--       niemand danach sortieren, gruppieren oder zaehlen.
--   (e) EHRLICHER REST: responded_at bleibt sichtbar. Eine Absage, die am
--       Morgen des Termins eintrifft, ist ein schwaches Indiz. Das ist der Zeile
--       inhaerent — es liesse sich nur durch (a) beseitigen, was schlimmer waere.
--       Benannt, nicht behauptet, dass es weg sei.
--
-- ### WARUM GRANT-ENTZUG + VIEW UND NICHT NUR EINE PROJEKTION IN events.ts ###
-- 0021 haelt fest: "Spalten-Filter am API-Layer, Zeilen-Filter per RLS". Fuer
-- Art.-9-Daten ist das zu wenig: eine TS-Projektion schuetzt genau so lange, wie
-- der naechste Entwickler daran denkt. Mit dem Entzug scheitert jeder kuenftige
-- `select * from app.event_rsvps` als authenticated LAUT mit 42501, statt still
-- wieder zu lecken. Gemessen wurde beides:
--     revoke select (status, comment) ... from authenticated   -> WIRKUNGSLOS,
--       ein GRANT auf Tabellenebene deckt alle Spalten; Spalten-REVOKE kann davon
--       nichts abziehen. Der Rohwert blieb lesbar. (Deshalb unten: erst SELECT
--       auf der Tabelle entziehen, dann die harmlosen Spalten einzeln granten.)
--     Danach: `select status ...` als Mitglied -> 42501 ✓
--             `select count(*) ...`            -> 28 ✓ (10_tenant_isolation:24/68
--                                                 zaehlt nur, bleibt gruen)
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Die EINE Wahrheit: wer darf den GRUND einer Ab-/Zusage sehen?
--    Muster und Aufbau woertlich wie app.can_read_routine (0021:88-114).
--    SECURITY DEFINER: der Blick in team_members/guardianships ist RLS-frei,
--    sonst haengt die Maske an der Sichtbarkeit ihrer eigenen Hilfstabellen.
-- ----------------------------------------------------------------------------
create or replace function app.can_read_rsvp_reason(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- 1. eigene Daten: die Person selbst und ihre Erziehungsberechtigten.
    --    BEWUSST ohne jede Rollen-/Faehigkeitsschranke — es sind ihre eigenen
    --    Daten (Art. 15). Ein Verein darf Eltern die Krankmeldung ihres Kindes
    --    nicht wegkonfigurieren.
    app.can_act_for_member(p_member_id)
    -- 2. wer den Verein verwaltet (Datenminimierung: OHNE moderator/treasurer)
    or app.has_club_role(p_club_id, array['owner', 'admin'])
    -- 3. wer das Team DIESES Mitglieds betreut. coached_team_ids = die Quelle
    --    aus 0025:169; has_club_role traegt den guest_coach-Ablauf.
    or (
      app.has_club_role(p_club_id, array['coach', 'guest_coach'])
      and exists (
        select 1
        from app.team_members tm
        where tm.member_id = p_member_id
          and tm.club_id   = p_club_id
          and tm.deleted_at is null
          and tm.team_id = any (app.coached_team_ids(p_club_id))
      )
    )
$$;

comment on function app.can_read_rsvp_reason(uuid, uuid) is
  'Darf die aufrufende Person den GRUND einer Ab-/Zusage dieses Mitglieds sehen (rsvp_status "sick" + Freitext = Gesundheitsdatum, Art. 9)? Selbst/Erziehungsberechtigte (immer) · owner/admin · coach/guest_coach des Teams DIESES Mitglieds. KEIN platform-admin-Bypass — bewusst enger als app.is_club_member(). Sonst: maskiert (0040).';

-- ----------------------------------------------------------------------------
-- 2. Die Maske als Funktion.
--
--    WARUM SECURITY DEFINER UND WARUM PER ID: Punkt 4 entzieht authenticated
--    SELECT auf status/comment. Eine View mit security_invoker=true (Pflicht,
--    0030/93g) darf die Spalten dann selbst NICHT MEHR anfassen — sie wuerde
--    mit 42501 scheitern. Also liest diese Funktion den Rohwert stellvertretend
--    und gibt NUR das Maskierte zurueck.
--
--    ZWEITE WAHRHEIT? NEIN. Die Funktion filtert keine ZEILEN — das bleibt
--    allein die RLS der Basistabelle (die View ist invoker). Sie beantwortet
--    nur die Frage "welchen Wert darf DIESER Aufrufer bei DIESER Zeile sehen".
--    Der eine Zeilen-Gate `app.is_club_member(r.club_id)` ist woertlich dasselbe
--    Praedikat wie event_rsvps_select (0003:231-233) und schliesst die einzige
--    Luecke, die ein DEFINER-Aufruf sonst aufrisse: ohne ihn beantwortete die
--    Funktion die Frage auch fuer eine FREMDE Vereins-ID und verriete damit die
--    Existenz + den groben Status einer Zeile aus einem anderen Mandanten.
--    Unbekannte ID und fremder Mandant liefern beide NULL — ununterscheidbar.
-- ----------------------------------------------------------------------------
create type app.rsvp_masked_row as (
  status  app.rsvp_status,
  comment text
);

comment on type app.rsvp_masked_row is
  'Rueckgabe von app.rsvp_masked(): der fuer den Aufrufer zulaessige Status + Freitext einer RSVP-Zeile.';

create or replace function app.rsvp_masked(p_rsvp_id uuid)
returns app.rsvp_masked_row
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when app.can_read_rsvp_reason(r.club_id, r.member_id) then r.status
      -- 'sick' -> 'declined': ununterscheidbar von einer echten Absage.
      -- going/maybe/declined bleiben, wie sie sind.
      when r.status = 'sick' then 'declined'::app.rsvp_status
      else r.status
    end,
    -- Der Freitext faellt fuer JEDEN Status weg (nicht nur bei 'sick'):
    -- er kann bei jedem Status Gesundheitsdaten enthalten, und ein nur bei
    -- 'sick' geleerter Kommentar waere selbst das Verraeter-Merkmal.
    case when app.can_read_rsvp_reason(r.club_id, r.member_id) then r.comment end
  from app.event_rsvps r
  where r.id = p_rsvp_id
    -- derselbe Zeilen-Gate wie event_rsvps_select (0003:231-233) — verhindert,
    -- dass der DEFINER-Aufruf zum Mandanten-Spaeher wird.
    and app.is_club_member(r.club_id)
$$;

comment on function app.rsvp_masked(uuid) is
  'Der fuer die aufrufende Person zulaessige Status/Freitext einer RSVP-Zeile: "sick" wird zu "declined" und der Freitext zu NULL, solange app.can_read_rsvp_reason() nicht greift. Fremder Mandant oder unbekannte ID -> NULL (kein Existenz-Verrat). Traeger der Maske fuer app.event_rsvps_visible (0040).';

-- Kein Aufruf durch anon/public (Muster 0005:65). anon liefe ohnehin ins Leere
-- (auth.uid() ist NULL -> is_club_member false), aber eine SECURITY-DEFINER-
-- Funktion gehoert nicht per Default an PUBLIC.
revoke execute on function app.rsvp_masked(uuid) from public;
grant execute on function app.rsvp_masked(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Die View, die die API ab jetzt liest.
--    security_invoker = true ist PFLICHT (0030 + 93c/93g): damit filtert die
--    RLS von app.event_rsvps die ZEILEN weiter ganz normal — die View aendert
--    ausschliesslich die beiden Spaltenwerte.
-- ----------------------------------------------------------------------------
create view app.event_rsvps_visible with (security_invoker = true) as
  select r.id,
         r.club_id,
         r.event_id,
         r.member_id,
         v.status,
         v.comment,
         r.responded_at,
         r.created_at,
         r.updated_at,
         r.deleted_at
  from app.event_rsvps r
  cross join lateral app.rsvp_masked(r.id) v;

comment on view app.event_rsvps_visible is
  'app.event_rsvps mit maskiertem Grund: "sick" erscheint als "declined" und comment als NULL, ausser fuer Selbst/Erziehungsberechtigte/owner/admin/Team-Trainer:in (app.can_read_rsvp_reason). ZEILEN filtert unveraendert die RLS der Basistabelle (security_invoker). DIE Lesequelle fuer RSVPs — die Rohspalten sind authenticated entzogen (0040).';

-- Nur lesen (Muster 0027:42 fuer app.team_coaches). Geschrieben wird weiterhin
-- gegen app.event_rsvps, wo INSERT/UPDATE-Policy + Trigger greifen.
revoke insert, update, delete on app.event_rsvps_visible from authenticated;
grant select on app.event_rsvps_visible to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Der eigentliche Riegel: den ROHWERT entziehen.
--
--    ACHTUNG, DIE FALLE (gemessen): `revoke select (status, comment) ...` allein
--    ist WIRKUNGSLOS, solange das Tabellen-GRANT aus 0001:42 steht — ein
--    Tabellen-GRANT deckt alle Spalten, ein Spalten-REVOKE zieht davon nichts ab.
--    Also: SELECT auf der TABELLE entziehen und die unbedenklichen Spalten
--    einzeln zurueckgeben.
--
--    WAS DAS NICHT BRICHT (gegen den Bestand gemessen, nicht gehofft):
--      * select count(*) / where club_id = ...   -> club_id ist gegrantet
--        (10_tenant_isolation.sql:24+68 zaehlt genau so -> bleibt gruen)
--      * insert / update / delete                -> unangetastet (nur SELECT)
--      * 70_guardianship.sql:45/54 `update ... set status = 'sick' where
--        event_id = .. and member_id = ..`       -> liest status nicht ✓
--    WAS ES BRICHT — und deshalb in events.ts mitgeaendert wird:
--      * `returning *`             -> 42501
--      * `on conflict do update set status = EXCLUDED.status` -> 42501: ON
--        CONFLICT DO UPDATE verlangt SELECT auf die Spalten, die in seinen
--        SET-Ausdruecken gelesen werden, und EXCLUDED.status zaehlt dazu.
--        Gemessen: mit `set status = $4` (dem Parameter selbst, wertgleich)
--        laeuft derselbe Upsert durch. events.ts:150-160 ist entsprechend
--        umgestellt — atomar bleibt er.
-- ----------------------------------------------------------------------------
revoke select on app.event_rsvps from authenticated;
grant select (id, club_id, event_id, member_id, responded_at, created_at, updated_at, deleted_at)
  on app.event_rsvps to authenticated;

comment on column app.event_rsvps.status is
  'Antwort des Mitglieds. "sick" ist ein GESUNDHEITSDATUM (Art. 9 DSGVO), meist das eines Kindes: authenticated hat auf dieser Spalte KEIN SELECT (0040). Gelesen wird ausschliesslich ueber app.event_rsvps_visible.';

comment on column app.event_rsvps.comment is
  'Freitext zur Antwort — kann bei JEDEM Status Gesundheitsdaten enthalten (Art. 9): authenticated hat hier KEIN SELECT (0040). Gelesen wird ausschliesslich ueber app.event_rsvps_visible.';

-- ----------------------------------------------------------------------------
-- 5. Der Dauerschutz aus 0030 auf den neuen Bestand anwenden.
-- ----------------------------------------------------------------------------
select app.assert_no_insecure_views();

commit;
