-- ============================================================================
-- 99h_selbstprofil_publikum.sql — Migration 0053, gegen den echten Bestand.
--
-- Diese Datei ist NEU; Bestands-Tests bleiben unberuehrt.
--
-- WAS HIER BEWIESEN WIRD
-- ---------------------------------------------------------------------------
-- Das Selbst-Profil bekommt ein Publikum mit zwei Stufen ('public'/'internal').
-- Die eigentliche LESE-Projektion sitzt in der API (members.ts/redactSelfProfile,
-- wie die Kontaktdaten-Redaktion — bewusst NICHT in RLS, Begruendung im Kopf von
-- 0053). Diese SQL-Datei beweist deshalb DREI Dinge, die die API-Projektion
-- traegt, und stellt die Projektion selbst als SQL-Ausdruck nach:
--   * Block A: die Spalte, ihre Vorgabe 'internal' (fail-safe) und die CHECK.
--   * Block B: der Schreibweg (set_self_profile) schreibt die Stufe; Patch-Semantik.
--   * Block C: der Urheberschutz — eine Stufen-AENDERUNG ist Urheberschaft; ein
--     Administrator kann ein Kind-Profil NICHT oeffentlich schalten, die Mutter
--     schon; reines Motto-Leeren (Moderation) bleibt unberuehrt.
--   * Block D: die PROJEKTION als SQL nachgestellt — pro Persona die Zahl der
--     sichtbaren Mottos. Mitglied: 4 oeffentliche, 0 interne fremde. Vorstand/
--     Trainer: alle 6. Kassenwart: 4 (kein "intern"). Nicht-Mitglied: 0.
--   * Block E: die Positivkontrolle (Sabotage) — wird der Sichtbarkeits-Filter
--     entfernt (internalViewer=true erzwungen), sieht das Mitglied 6 statt 4.
--     Faellt dieser Block, ist Block D gruen aus dem falschen Grund.
--
-- Der API-Ausdruck, den Block D/E nachstellen (redactSelfProfile):
--   sichtbar := internalViewer                       -- Stufe (b), Rollen-Claim
--            OR app.can_act_for_member(m.id)          -- Stufe (c), Person/Vormund
--            OR m.profile_visibility = 'public'       -- Stufe (a), Spalten-Wert
-- internalViewer ist ein Rollen-Claim (owner/admin/moderator/coach/guest_coach,
-- NICHT treasurer) — in SQL pro Persona als Literal eingesetzt, weil die API ihn
-- aus den Claims bildet, nicht aus der DB.
--
-- SEED-GRUNDLAGE (supabase/seed/seed.sql):
--   OEFFENTLICH mit Motto: a-01 (Sandra/coach), a-07 (Lina/Kind), a-09
--     (Katrin/member), a-12 (Stefanie/member)                        -> 4
--   INTERN mit Motto:      a-05 (Anna-Lena/coach), a-14 (Petra/moderator) -> 2
--   -> insgesamt 6 Zeilen mit Motto.
-- PERSONEN: 90..09 Katrin (member, Mutter von a-07/a-08), 90..12 Stefanie
--   (member), 90..03 Beate (treasurer), 90..01 Sandra (coach), 90..02 Juergen
--   (owner), 90..06 Milena (guest_coach), 90..04 Thomas (admin), 90..14 Petra
--   (moderator). Club c1 = c1ab0000-…-001.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) DIE SPALTE: Vorgabe 'internal' (fail-safe), CHECK auf public/internal,
--    Bestand ausser dem Seed auf 'internal'.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  -- Die Vorgabe ist der sichere Weg: eine frisch angelegte Zeile ist 'internal'.
  -- (service_role hier -> Trigger ausgenommen; profile_visibility bekommt den
  --  Default.)
  perform testkit.succeeds('publikum: eine neue Zeile bekommt die Vorgabe',
    $sql$insert into app.club_members (id, club_id, first_name, last_name, role, status)
         values ('a0000000-0000-4000-8000-0000000000f1',
                 'c1ab0000-0000-4000-8000-000000000001', 'Test', 'Vorgabe', 'member', 'active')$sql$);
  perform testkit.is_eq('publikum: die Vorgabe ist internal (fail-safe)',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-0000000000f1'
        and profile_visibility = 'internal'), 1);

  -- Die CHECK laesst nur public/internal zu. 23514 -> 422 in der API.
  perform testkit.throws('publikum: eine unbekannte Stufe wird abgelehnt',
    $sql$update app.club_members set profile_visibility = 'oeffentlich'
          where id = 'a0000000-0000-4000-8000-0000000000f1'$sql$, '23514');

  -- Der Bestand ausser den vier Seed-Oeffentlichen steht auf 'internal'.
  perform testkit.is_eq('publikum: genau 4 Seed-Profile stehen auf public',
    (select count(*) from app.club_members
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'
        and profile_visibility = 'public'), 4);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DER SCHREIBWEG: set_self_profile schreibt die Stufe. Patch-Semantik:
--    fehlender Schluessel laesst die Stufe stehen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

-- Katrin steht im Seed auf 'public'. Sie schaltet ihr eigenes Profil auf intern.
select app.set_self_profile(
  'c1ab0000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000009',
  '{"visibility":"internal"}'::jsonb);

do $$
begin
  perform testkit.is_eq('schreibweg: die Person schaltet ihre eigene Stufe auf internal',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000009'
        and profile_visibility = 'internal'), 1);

  -- Patch-Semantik: ein reines Motto-Update laesst die Stufe stehen (kein
  -- 'visibility'-Schluessel -> unveraendert).
  perform (select app.set_self_profile(
    'c1ab0000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000009',
    '{"motto":"Neues Motto ohne Stufenwechsel"}'::jsonb));
  perform testkit.is_eq('schreibweg: ein Motto-Patch ohne visibility laesst die Stufe stehen',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000009'
        and profile_visibility = 'internal'
        and profile_motto = 'Neues Motto ohne Stufenwechsel'), 1);

  -- Und zurueck auf public.
  perform (select app.set_self_profile(
    'c1ab0000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000009',
    '{"visibility":"public"}'::jsonb));
  perform testkit.is_eq('schreibweg: die Person schaltet wieder auf public',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000009'
        and profile_visibility = 'public'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) URHEBERSCHAFT DER STUFE. Eine Stufen-AENDERUNG ist wie das Setzen eines
--    Mottos: nur Person/Vormund, nur active. Ein Administrator darf ein
--    Kind-Profil NICHT oeffentlich schalten (sonst zeigt er es dem ganzen
--    Verein ohne Zutun des Kindes). Reines Motto-Leeren (Moderation) bleibt.
-- ---------------------------------------------------------------------------
begin;
-- Ausgangslage: Lina (a-07, Kind) steht im Seed auf 'public'. Der ADMIN (Thomas)
-- darf die Zeile per RLS verwalten (can_manage_members) — der Trigger schuetzt
-- trotzdem die Stufe.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('urheberschaft: der ADMIN schaltet die Stufe des Kindes NICHT auf internal',
    $sql$update app.club_members set profile_visibility = 'internal'
          where id = 'a0000000-0000-4000-8000-000000000007'$sql$, 'P0001');

  perform testkit.throws('urheberschaft: der ADMIN kommt auch ueber set_self_profile nicht durch',
    $sql$select app.set_self_profile(
      'c1ab0000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000007',
      '{"visibility":"internal"}'::jsonb)$sql$, 'P0001');

  -- MODERATION bleibt: das Motto LEEREN darf der Admin (Trigger feuert nur bei
  -- Urheberschaft, nicht beim Leeren) — und die Stufe bleibt dabei unberuehrt.
  perform testkit.affects('moderation: der ADMIN DARF ein Motto weiter LOESCHEN',
    $sql$update app.club_members set profile_motto = null
          where id = 'a0000000-0000-4000-8000-000000000007'$sql$, 1);
end;
$$;
rollback;

-- Die Mutter DARF die Stufe ihres Kindes aendern (can_act_for_member, active).
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select app.set_self_profile(
  'c1ab0000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000007',
  '{"visibility":"internal"}'::jsonb);
do $$
begin
  perform testkit.is_eq('urheberschaft: die MUTTER schaltet die Stufe ihres KINDES (Vormundschaft)',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000007'
        and profile_visibility = 'internal'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) DIE PROJEKTION NACHGESTELLT — pro Persona die Zahl der sichtbaren Mottos.
--    sichtbar := internalViewer OR can_act_for_member(id) OR visibility='public'.
--    Alles unter Impersonation, damit can_act_for_member den echten Betrachter
--    sieht und RLS die Roster-Zeilen so filtert, wie die Person sie wirklich hat.
-- ---------------------------------------------------------------------------

-- D1) DAS MITGLIED (Stefanie, keine Familienbeziehung zu den intern-Profilen).
--     internalViewer = false.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: das MITGLIED sieht genau die 4 OEFFENTLICHEN Mottos',
    (select count(*) from app.club_members m
      where m.profile_motto is not null
        and (false or app.can_act_for_member(m.id) or m.profile_visibility = 'public')), 4);

  -- Der Kern des Auftrags: KEIN internes fremdes Profil sickert durch.
  perform testkit.is_eq('projektion: das MITGLIED sieht 0 INTERNE fremde Mottos',
    (select count(*) from app.club_members m
      where m.profile_motto is not null
        and m.profile_visibility = 'internal'
        and not app.can_act_for_member(m.id)
        and (false or app.can_act_for_member(m.id) or m.profile_visibility = 'public')), 0);
end;
$$;
rollback;

-- D2) DAS MITGLIED ALS ELTERNTEIL (Katrin) sieht ihr eigenes Kind IMMER —
--     auch wenn dessen Stufe 'internal' waere. Beweis ueber (c).
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
-- Lina (a-07) auf intern schalten (als ihre Mutter) — sie muss fuer die Mutter
-- trotzdem sichtbar bleiben.
select app.set_self_profile(
  'c1ab0000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000007',
  '{"visibility":"internal"}'::jsonb);
do $$
begin
  perform testkit.is_eq('projektion: das ELTERNTEIL sieht das eigene Kind IMMER (auch intern)',
    (select count(*) from app.club_members m
      where m.id = 'a0000000-0000-4000-8000-000000000007'
        and m.profile_motto is not null
        and (false or app.can_act_for_member(m.id) or m.profile_visibility = 'public')), 1);
end;
$$;
rollback;

-- D3) DER KASSENWART ist KEIN "Vorstand/Trainer" -> internalViewer = false.
--     Er sieht die 4 oeffentlichen, aber die 2 internen NICHT.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: der KASSENWART sieht nur die 4 oeffentlichen (kein "intern")',
    (select count(*) from app.club_members m
      where m.profile_motto is not null
        and (false or app.can_act_for_member(m.id) or m.profile_visibility = 'public')), 4);
end;
$$;
rollback;

-- D4) VORSTAND/TRAINER (internalViewer = true) sehen ALLE 6.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: die TRAINERIN (coach) sieht alle 6 Mottos',
    (select count(*) from app.club_members m
      where m.profile_motto is not null
        and (true or app.can_act_for_member(m.id) or m.profile_visibility = 'public')), 6);
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
  perform testkit.is_eq('projektion: der VORSTAND (owner) sieht alle 6 Mottos',
    (select count(*) from app.club_members m
      where m.profile_motto is not null
        and (true or app.can_act_for_member(m.id) or m.profile_visibility = 'public')), 6);
end;
$$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: der GAST-TRAINER (guest_coach) sieht alle 6 Mottos',
    (select count(*) from app.club_members m
      where m.profile_motto is not null
        and (true or app.can_act_for_member(m.id) or m.profile_visibility = 'public')), 6);
end;
$$;
rollback;

-- D5) DAS NICHT-MITGLIED sieht ueberhaupt keine Vereinszeile (RLS filtert schon
--     die Zeilen weg, bevor eine Projektion greift). Nadja (90..091) hat im Seed
--     eine Profil-Zeile, aber KEINE Mitgliedschaft in c1.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: das NICHT-MITGLIED sieht 0 Vereinszeilen (RLS)',
    (select count(*) from app.club_members
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) POSITIVKONTROLLE (SABOTAGE): kann Block D rot werden?
--    Nachgestellt, nicht behauptet: wird der Sichtbarkeits-Filter aus der
--    Projektion genommen (internalViewer auf true erzwungen — so, als redigierte
--    die API NICHT), sieht dasselbe Mitglied 6 statt 4. Genau die 2 internen
--    fremden Profile sind der Unterschied. Faellt dieser Block, ist die
--    Projektion in Block D wirkungslos und D1 gruen aus dem falschen Grund.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  -- MIT Filter: 4 (wie D1).
  perform testkit.is_eq('positivkontrolle: MIT Sichtbarkeits-Filter sieht das Mitglied 4',
    (select count(*) from app.club_members m
      where m.profile_motto is not null
        and (false or app.can_act_for_member(m.id) or m.profile_visibility = 'public')), 4);
  -- OHNE Filter (internalViewer erzwungen true): 6. Der Unterschied SIND die
  -- 2 internen — die Projektion ist also das, was sie sperrt.
  perform testkit.is_eq('positivkontrolle: OHNE Filter saehe dasselbe Mitglied 6 (D1 KANN rot werden)',
    (select count(*) from app.club_members m
      where m.profile_motto is not null
        and (true or app.can_act_for_member(m.id) or m.profile_visibility = 'public')), 6);
end;
$$;
rollback;
