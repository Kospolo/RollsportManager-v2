-- ============================================================================
-- 99g_selbstprofil_sichtbarkeit.sql — Migration 0045, gegen den echten Bestand.
--
-- Diese Datei ist NEU; Bestands-Tests bleiben unberuehrt (einzige Ausnahme:
-- 93j Block A, die Buchhaltung der enforcement-Etiketten — begruendet im Kopf
-- von 0045 und im Bericht).
--
-- WAS HIER BEWIESEN WIRD, UND WARUM IN GENAU DIESER FORM
-- ---------------------------------------------------------------------------
-- Der Auftrag verlangt fuer jeden Punkt einen Beleg, der ROT wird, wenn man den
-- Fix herausnimmt. Zwei Sorten Beleg kommen vor:
--   * PAARE: Wer "sieht 0 Zeilen" behauptet, muss daneben zeigen, dass jemand
--     anderes > 0 sieht. Eine Reihe Nullen beweist sonst nur, dass die Abfrage
--     etwas liefert, was 0 ist (Muster aus 99f).
--   * SABOTAGE (Block E): der Fix wird im Test ZURUECKGEDREHT und die Zusicherung
--     MUSS kippen. Ohne diesen Block koennte die ganze Datei gruen sein, weil
--     die Testdaten leer sind — und niemand wuesste es.
--
-- DIE KERNFRAGE DES NUTZERS, woertlich: "trainingsbeteiligung an anderen
-- mitgliedern als mitglied ... geht auch nicht — das kann trainer und hoeher
-- sehen, aber rest nicht." Block B beantwortet sie unter Impersonation, nicht
-- ueber die API: attendance_select ist eine RLS-Policy, und eine API-Antwort
-- wuerde nur beweisen, dass die API redigiert — nicht, dass die Datenbank es tut.
--
-- PERSONEN AUS DEM SEED (supabase/seed/seed.sql):
--   90..09 Katrin Gruenewald  = a-09, member, MUTTER von Lina (a-07) + Emma (a-08)
--   90..12 Stefanie Mueller   = a-12, member, Mutter von Sofia (a-10) + Ben (a-11)
--   90..03 Beate Schaefer     = a-03, treasurer
--   90..01 Sandra Vogel       = a-01, coach
--   90..02 Juergen Haeberle   = a-02, owner
--   90..06 Milena Oeztuerk    = a-06, guest_coach (vereinsextern, befristet)
--   a-15   Leonie Schroeder   = Kind OHNE Konto, mit KEINER Beziehung zu Katrin
-- ANWESENHEIT im Seed (11 Zeilen): a-07, a-10, a-13, a-15, a-19 (Termin e-04)
--   und a-16, a-17, a-18, a-21, a-22, a-23 (Termin e-05).
--   Katrins Familie darin: NUR Lina (a-07). Emma (a-08) hat keine Zeile.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) DAS SELBST-PROFIL: DIE PERSON SELBST UND IHRE KINDER — SONST NIEMAND.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

-- A1: die eigene Zeile.
select app.set_self_profile(
  'c1ab0000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000009',
  '{"motto":"Immer mit Schwung","favorite_discipline":"Solotanz","skating_since":2005}'::jsonb);

do $$
begin
  perform testkit.is_eq('selbstprofil: Katrin pflegt ihr EIGENES Profil',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000009'
        and profile_motto = 'Immer mit Schwung'
        and profile_favorite_discipline = 'Solotanz'
        and profile_skating_since = 2005), 1);
end;
$$;

-- A2: DAS KIND OHNE KONTO. Der eigentliche Grund fuer app.set_self_profile:
--     fuer Lina (profile_id is null) gibt es KEINE UPDATE-Policy, die die
--     Mutter durchliesse (0007 = can_manage_members, 0016 = profile_id =
--     auth.uid()). Ginge das hier nicht, haetten 17 Kinder des Seeds kein
--     Selbst-Profil — also genau die, fuer die das Feature gedacht ist.
select app.set_self_profile(
  'c1ab0000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000007',
  '{"motto":"Ich uebe den Flip","skating_since":2021}'::jsonb);

do $$
begin
  perform testkit.is_eq('selbstprofil: die MUTTER pflegt das Profil ihres KINDES (Vormundschaft)',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000007'
        and profile_motto = 'Ich uebe den Flip'
        and profile_skating_since = 2021), 1);

  -- A3: DIE GRENZE. Ein fremdes Kind ist kein eigenes.
  perform testkit.throws('selbstprofil: Katrin schreibt NICHT am fremden Kind (Leonie)',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000015',
      '{"motto":"gekapert"}'::jsonb)$sql$, 'P0001');

  -- A3b: und auch nicht an einer erwachsenen Fremden.
  perform testkit.throws('selbstprofil: Katrin schreibt NICHT am Profil von Stefanie',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000012',
      '{"motto":"gekapert"}'::jsonb)$sql$, 'P0001');
end;
$$;

-- A4: PATCH-Semantik — fehlender Schluessel laesst stehen, null loescht.
select app.set_self_profile(
  'c1ab0000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000009',
  '{"favorite_discipline":null}'::jsonb);

do $$
begin
  perform testkit.is_eq('selbstprofil: null loescht NUR die Disziplin, das Motto bleibt',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000009'
        and profile_favorite_discipline is null
        and profile_motto = 'Immer mit Schwung'
        and profile_skating_since = 2005), 1);

  -- A5: DER STILLE NO-OP, gegen den die Funktion sich jetzt wehrt.
  -- Echter Befund aus dem Smoke: die API schickte JSON.stringify(body)::jsonb,
  -- postgres.js kodierte doppelt, angekommen ist ein jsonb-SKALAR ("string")
  -- statt eines Objekts. Ergebnis: 200 und ein leeres Profil — "gespeichert"
  -- gesagt, nichts geschrieben. Genau die Sorte Fehler, die diese Datei mit
  -- jsonb-LITERALEN nie gefunden haette; deshalb steht die Grenze jetzt in der
  -- Funktion und hier ihr Beleg.
  perform testkit.throws('selbstprofil: ein doppelt kodiertes Patch (jsonb-String) wird LAUT abgelehnt',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000009',
      '"{\"motto\":\"still verschluckt\"}"'::jsonb)$sql$, 'P0001');

  perform testkit.throws('selbstprofil: auch ein jsonb-Array ist kein Patch',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000009',
      '["motto"]'::jsonb)$sql$, 'P0001');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DIE LEITPLANKE gegen die gedankenlose Preisgabe von Kontaktdaten.
--    Ehrlich benannt: sie faengt das Hineinkopierte, nicht das Entschlossene
--    (siehe 0045-Kopf). Genau das wird hier auch geprueft — inklusive der
--    Faelle, die DURCHRUTSCHEN. Ein Test, der nur die Treffer zeigt,
--    verspraeche eine Grenze, wo eine Leitplanke steht.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- 23514 = check_violation -> middleware/error.ts uebersetzt das zu 422.
  perform testkit.throws('leitplanke: eine E-Mail im Motto wird abgelehnt',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000007',
      '{"motto":"schreib mir: lina@example.org"}'::jsonb)$sql$, '23514');

  perform testkit.throws('leitplanke: ein Link im Motto wird abgelehnt',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000007',
      '{"motto":"mein Insta: www.example.org/lina"}'::jsonb)$sql$, '23514');

  -- DER FALL, DER DAS FELD GEFAEHRLICH MACHT: ein Kind tippt seine Handynummer.
  perform testkit.throws('leitplanke: eine Telefonnummer am Stueck wird abgelehnt',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000007',
      '{"motto":"ruf mich an 01761234567"}'::jsonb)$sql$, '23514');

  perform testkit.throws('leitplanke: laengeres Motto als 140 Zeichen wird abgelehnt',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000007',
      ('{"motto":"' || repeat('a', 141) || '"}')::jsonb)$sql$, '23514');

  perform testkit.throws('leitplanke: "laeuft seit" 1789 ist keine Jahreszahl dieses Sports',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000007',
      '{"skating_since":1789}'::jsonb)$sql$, '23514');
end;
$$;

-- Gegenprobe: die Leitplanke steht nicht im Weg. Ein Motto MIT Jahreszahl und
-- Satzzeichen muss durchgehen — sonst waere sie ein Feature-Killer.
select app.set_self_profile(
  'c1ab0000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000007',
  '{"motto":"Seit 2021 dabei, 3x die Woche Training!"}'::jsonb);

do $$
begin
  perform testkit.is_eq('leitplanke: Gegenprobe — ein normales Motto mit Zahlen geht durch',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000007'
        and profile_motto = 'Seit 2021 dabei, 3x die Woche Training!'), 1);

  -- EHRLICH: was NICHT gefangen wird. Diese Zeile ist kein Versehen, sie ist
  -- die Aussage. Wer sie liest, weiss, dass die Leitplanke eine Leitplanke ist.
  perform testkit.is_eq('leitplanke: EHRLICH — die getrennt getippte Nummer rutscht durch (bewusst, siehe 0045)',
    (select case when app.contains_contact_details('ruf mich an 0176 123 4567')
                 then 1 else 0 end), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) URHEBERSCHAFT vs. MODERATION.
--    Der Vorstand darf LOESCHEN (Moderation muss moeglich sein), aber NICHT
--    SCHREIBEN (sonst legt er einem Kind Worte in den Mund, die der ganze
--    Verein als Aussage DES KINDES liest).
-- ---------------------------------------------------------------------------
begin;
-- Vorbereitung: Lina hat ein Motto (als ihre Mutter gesetzt).
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select app.set_self_profile(
  'c1ab0000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000007',
  '{"motto":"Ich uebe den Flip"}'::jsonb);

reset role;
select set_config('request.jwt.claims', '', true);

-- Jetzt der ADMIN (Thomas, 90..04). Er darf die Zeile per RLS verwalten
-- (club_members_update = can_manage_members) — genau deshalb ist der Trigger
-- noetig: die Policy laesst ihn an die Zeile, die Spalten sind trotzdem nicht seine.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('urheberschaft: der ADMIN schreibt dem Kind KEIN Motto in den Mund',
    $sql$update app.club_members set profile_motto = 'Ich liebe Rollkunstlauf!!'
          where id = 'a0000000-0000-4000-8000-000000000007'$sql$, 'P0001');

  perform testkit.throws('urheberschaft: der ADMIN kommt auch ueber set_self_profile nicht durch',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000007',
      '{"motto":"Ich liebe Rollkunstlauf!!"}'::jsonb)$sql$, 'P0001');

  -- Die Gegenprobe, die das Ganze erst brauchbar macht: LEEREN geht.
  perform testkit.affects('moderation: der ADMIN DARF ein unangebrachtes Motto LOESCHEN',
    $sql$update app.club_members set profile_motto = null
          where id = 'a0000000-0000-4000-8000-000000000007'$sql$, 1);

  -- Und die Verwaltung der uebrigen Spalten bleibt unberuehrt — der Trigger
  -- feuert NUR bei den Profilspalten.
  perform testkit.affects('urheberschaft: die normale Stammdaten-Pflege des ADMIN bleibt unberuehrt',
    $sql$update app.club_members set first_name = 'Lina-Marie'
          where id = 'a0000000-0000-4000-8000-000000000007'$sql$, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) SICHTBARKEIT: jedes AKTIVE Mitglied liest das Selbst-Profil — der Antrag-
--    steller (pending) schreibt es nicht.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select app.set_self_profile(
  'c1ab0000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000009',
  '{"motto":"Immer mit Schwung"}'::jsonb);

reset role;
select set_config('request.jwt.claims', '', true);

-- Stefanie (fremdes Mitglied, keine Familienbeziehung zu Katrin) liest es.
-- DAS ist die Bestellung: "mitglied darf andere mitglieder sehen ... und wenn
-- das mitglied was ueber sich eintraegt, dann das auch".
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('sichtbarkeit: ein FREMDES Mitglied liest Katrins Selbst-Profil',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000009'
        and profile_motto = 'Immer mit Schwung'), 1);
end;
$$;
rollback;

-- Der pending-Antragsteller: Antrag ist kein Zutritt (0034). Ohne den
-- status-Filter im Trigger haette ein Fremder mit gueltigem Vereinscode ein
-- Feld, das der ganze Verein liest, BEVOR ihn jemand aufgenommen hat.
-- (Anlage hier statt im Seed, wie 99f es begruendet: der Roster-Bestand ist auf
--  24 Zeilen festgenagelt. Alles in begin/rollback.)
begin;
-- Das Profil 90..091 (Nadja Neuling) steht bereits im Seed (seed.sql:102/106) —
-- ABSICHTLICH ohne Mitgliedschaft, als Person, die noch keinem Verein angehoert.
-- Hier bekommt sie nur die pending-Zeile; der Roster-Bestand von 24 ist
-- anderswo festgenagelt (93_rbac.sql:112), deshalb begin/rollback.
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0000000-0000-4000-8000-000000000091', 'c1ab0000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-000000000091', 'Nadja', 'Neuling', 'member', 'pending');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- DIESE ZEILE IST DER GRUND, WARUM DER status-CHECK IM TRIGGER STEHT.
  -- app.set_self_profile ist security definer und geht damit an der RLS VORBEI
  -- (es muss: fuer die Kind-Zeile gibt es keine Policy). can_act_for_member ist
  -- fuer die Antragstellerin WAHR — es prueft nur profile_id/Vormundschaft, NICHT
  -- den Status. Ohne den status-Check waere dieses Feature also ausgerechnet der
  -- Weg gewesen, auf dem ein Fremder mit gueltigem Vereinscode dem ganzen Verein
  -- etwas hinschreibt, bevor ihn jemand aufgenommen hat. Nimmt man den Check aus
  -- 0045 heraus, wird GENAU DIESE Zeile rot.
  perform testkit.throws('pending: die Antragstellerin beschreibt ihr Selbst-Profil NICHT (status-Check im Trigger)',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000091',
      '{"motto":"Guenstige Uhren bei mir"}'::jsonb)$sql$, 'P0001');

  -- DER DIREKTE WEG — NACHGEMESSEN STATT ANGENOMMEN.
  -- Erwartet hatte ich hier den Trigger (P0001), weil club_members_update_self
  -- (0016:76-79) keinen status-Filter hat. Gemessen kommt der UPDATE aber gar
  -- nicht erst bis dorthin: er trifft 0 ZEILEN. Grund ist eine Ebene frueher —
  -- club_members_select ist app.is_club_member, und das ist seit 0025 DB-
  -- aufgeloest (member_role_keys filtert status='active'). Die Antragstellerin
  -- sieht ihre EIGENE Zeile nicht, also findet der UPDATE sie nicht.
  -- Das ist die ehrliche Fassung: die fehlende status-Bedingung in 0016 ist real,
  -- aber sie wird heute von der SELECT-Policy verdeckt. Verlassen darf man sich
  -- darauf nicht — deshalb steht der Check trotzdem im Trigger (Zeile oben).
  perform testkit.is_eq('pending: die Antragstellerin sieht ihre eigene Zeile nicht einmal',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000091'), 0);
  perform testkit.affects('pending: der direkte UPDATE trifft 0 Zeilen (die SELECT-Policy verdeckt sie)',
    $sql$update app.club_members set profile_motto = 'Guenstige Uhren bei mir'
          where id = 'a0000000-0000-4000-8000-000000000091'$sql$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) TRAININGSBETEILIGUNG — DER KERN DES AUFTRAGS.
--    "das kann trainer und hoeher sehen, aber rest nicht."
-- ---------------------------------------------------------------------------

-- E1) DAS MITGLIED: eigene Kinder JA, fremde Kinder NEIN.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- DIE ANFORDERUNG, die read_own NICHT brechen darf: eine Mutter MUSS die
  -- Trainingsbeteiligung ihres Kindes sehen. Lina (a-07) war beim Termin e-04.
  perform testkit.is_eq('anwesenheit: die MUTTER sieht die Anwesenheit ihres KINDES (Lina)',
    (select count(*) from app.attendance
      where member_id = 'a0000000-0000-4000-8000-000000000007'), 1);

  -- DER BEFUND DES NUTZERS, umgedreht: Mitglied A sieht Mitglied B NICHT.
  -- Leonie (a-15) hat eine Anwesenheitszeile und keinerlei Beziehung zu Katrin.
  perform testkit.is_eq('anwesenheit: das Mitglied sieht die Anwesenheit einer FREMDEN NICHT (Leonie)',
    (select count(*) from app.attendance
      where member_id = 'a0000000-0000-4000-8000-000000000015'), 0);

  -- Und in der Summe: von 11 Zeilen im Verein bleibt genau die eigene Familie.
  perform testkit.is_eq('anwesenheit: das Mitglied sieht GENAU 1 von 11 Zeilen (nur die eigene Familie)',
    (select count(*) from app.attendance), 1);
end;
$$;
rollback;

-- E2) DIE GEGENPROBE: "trainer und hoeher" sehen weiter alles. Ohne diesen
--     Block waere E1 auch dann gruen, wenn die Policy schlicht alles sperrt —
--     und "kaputt" ist nicht "sicher".
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('anwesenheit: die TRAINERIN sieht alle 11 Zeilen',
    (select count(*) from app.attendance), 11);
end;
$$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('anwesenheit: der VORSTAND (owner) sieht alle 11 Zeilen',
    (select count(*) from app.attendance), 11);
end;
$$;
rollback;

-- E3) DER KASSENWART. Gekappt — nachgemessen, dass kein Finanz-/Pflichtstunden-
--     Pfad daran haengt (siehe 0045-Kopf). Er ist nicht "Trainer und hoeher".
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('anwesenheit: der KASSENWART sieht die Trainingsbeteiligung der Kinder NICHT mehr',
    (select count(*) from app.attendance), 0);
end;
$$;
rollback;

-- E4) Die Stufen im Seed sind das, was das Admin-UI anzeigt. Zeigt es etwas
--     anderes als die Policy tut, ist die Anzeige eine Luege — deshalb hier
--     nachgezaehlt und nicht angenommen.
begin;
do $$
begin
  perform testkit.is_eq('anwesenheit: Seed — member steht auf read_own',
    (select count(*) from app.role_permissions rp
      join app.roles r on r.id = rp.role_id
     where r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
       and r.key = 'member' and rp.capability_key = 'attendance'
       and rp.level = 'read_own'), 1);
  perform testkit.is_eq('anwesenheit: Seed — treasurer steht auf read_own',
    (select count(*) from app.role_permissions rp
      join app.roles r on r.id = rp.role_id
     where r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
       and r.key = 'treasurer' and rp.capability_key = 'attendance'
       and rp.level = 'read_own'), 1);
  perform testkit.is_eq('anwesenheit: Seed — coach/guest_coach behalten edit (>= read_all)',
    (select count(*) from app.role_permissions rp
      join app.roles r on r.id = rp.role_id
     where r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
       and r.key in ('coach', 'guest_coach') and rp.capability_key = 'attendance'
       and rp.level = 'edit'), 2);

  -- Das Etikett, auf das sich das Admin-UI beruft. 0033 nennt 'write_only'
  -- "gelesen wird weiter" — seit 0045 ist das fuer attendance falsch.
  perform testkit.is_eq('anwesenheit: das Etikett sagt jetzt die Wahrheit (enforcement = enforced)',
    (select count(*) from app.capabilities
      where key = 'attendance' and enforcement = 'enforced'), 1);

  -- Und der Detektor aus 93j findet die SELECT-Policy wirklich (ueber den
  -- Helfer can_read_attendance). Faende er sie nicht, waere das Etikett oben
  -- nur eine Behauptung.
  perform testkit.is_eq('anwesenheit: app.capability_policy_usage() FINDET die neue SELECT-Policy',
    (select count(*) from app.capability_policy_usage()
      where capability_key = 'attendance' and cmd = 'SELECT'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) DIE POSITIVKONTROLLE — KANN DIESE DATEI ROT WERDEN?
--
--    Nachgestellt, nicht behauptet: der Fix wird zurueckgedreht (member zurueck
--    auf read_all, der Zustand VOR 0045) und E1 MUSS kippen. Faellt dieser
--    Block, ist die ganze Datei blind und E1 gruen aus dem falschen Grund.
--
--    Das ist zugleich der Beweis, dass die Stufe das LESEN wirklich steuert —
--    also genau das, was vor 0045 NICHT der Fall war: damals haette dieselbe
--    Umstellung nichts bewirkt, weil attendance_select an is_club_member hing.
--    Alles in begin/rollback; die Sabotage ueberlebt den Test nicht.
-- ---------------------------------------------------------------------------
begin;
update app.role_permissions rp
   set level = 'read_all'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'attendance';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('positivkontrolle: read_all zurueckgedreht -> das Mitglied sieht wieder ALLE 11 (E1 KANN rot werden)',
    (select count(*) from app.attendance), 11);
end;
$$;
rollback;

-- Und die Gegenrichtung: 'none' nimmt das Lesen KOMPLETT weg — die Zusage, die
-- das Etikett 'enforced' dem Admin-UI macht. Vor 0045 waere dieser Block gruen
-- gewesen mit 11 statt 0: die Stufe stand da, sie tat nur nichts.
begin;
update app.role_permissions rp
   set level = 'none'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'attendance';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('positivkontrolle: Stufe "keine" nimmt das Lesen WIRKLICH weg (0 Zeilen, auch die eigenen Kinder)',
    (select count(*) from app.attendance), 0);
end;
$$;
rollback;
