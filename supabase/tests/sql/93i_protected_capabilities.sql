-- ============================================================================
-- 93i_protected_capabilities.sql — geschuetzte Faehigkeiten + zwei Folgefehler.
--
-- Deckt Migration 0032 ab. Drei Befunde, alle live belegt:
--   (1) Eine Moderatorin hob ihre EIGENE Rolle bei 'lockers' von read_own auf
--       manage (HTTP 200) und sah danach alle 8 Schliessfaecher statt 0 —
--       quer zur ausdruecklichen Privacy-Entscheidung (0021).
--   (2) Die protected owner-Rolle liess sich UMBENENNEN ("Putzkraft") — 200.
--   (3) cap_rank meldete dem owner pauschal Rang 5, auch wo die Skala gar
--       kein 5 kennt (member_contact: allowed_levels = {none,read_all}).
--
-- Kein Bestands-Test fror etwas davon als Sollverhalten ein (geprueft:
-- 'member_contact' kommt in supabase/tests/ NULL mal vor; 93_rbac:31 haelt
-- ausdruecklich fest, dass der protected owner "ueber die Matrix, nicht ueber
-- den cap_rank-Kurzschluss" zaehlt). Diese Datei ist NEU.
--
-- Personas: 90..02 Juergen Haeberle (owner) · 90..14 Petra Koehler (moderator)
--   · 90..04 Thomas Krueger (admin) · 90..03 Beate Schaefer (treasurer).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Der Katalog: genau die drei Faehigkeiten aus der Nutzer-Vorgabe sind
--    geschuetzt — datengetrieben ueber eine Spalte, nicht in Code verdrahtet.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('geschuetzt: genau 3 Faehigkeiten sind owner_only',
    (select count(*) from app.capabilities where owner_only), 3);
  perform testkit.is_eq('geschuetzt: es sind lockers, member_contact, finance',
    (select count(*) from app.capabilities
      where owner_only and key in ('lockers', 'member_contact', 'finance')), 3);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) BEFUND (1) nachgestellt: die Moderatorin gibt sich selbst 'lockers'.
--    Sie hat roles:manage — genau das reicht ab jetzt NICHT mehr.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;

do $$
declare
  v_mod uuid := (select id from app.roles
                  where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'moderator');
begin
  -- Vorbedingung: sie DARF Rollen verwalten. Sonst belegt der Test nichts —
  -- dann scheiterte sie schon an roles:manage statt an der Haertung.
  if app.has_cap('c1ab0000-0000-4000-8000-000000000001', 'roles', 'manage') then
    perform testkit.ok('geschuetzt: Vorbedingung — die Moderatorin HAT roles:manage');
  else
    perform testkit.fail('geschuetzt: Vorbedingung — die Moderatorin HAT roles:manage',
      'sie hat roles < manage; der Test belegt dann nicht die geschuetzte Faehigkeit');
  end if;

  perform testkit.throws('geschuetzt: Moderatorin hebt ihre EIGENE Rolle bei lockers NICHT auf manage',
    format($q$update app.role_permissions set level = 'manage'
             where role_id = %L and capability_key = 'lockers'$q$, v_mod), 'P0001');

  perform testkit.throws('geschuetzt: auch member_contact bleibt ihr verwehrt',
    format($q$update app.role_permissions set level = 'read_all'
             where role_id = %L and capability_key = 'member_contact'$q$, v_mod), 'P0001');

  perform testkit.throws('geschuetzt: und finance ebenso',
    format($q$update app.role_permissions set level = 'manage'
             where role_id = %L and capability_key = 'finance'$q$, v_mod), 'P0001');

  -- Der Umweg ueber DELETE zaehlt genauso: eine geschuetzte Stufe zu loeschen
  -- ist derselbe Eingriff (und der on-conflict-Pfad der API legt sie neu an).
  perform testkit.throws('geschuetzt: sie kann die Stufe auch nicht LOESCHEN',
    format($q$delete from app.role_permissions
             where role_id = %L and capability_key = 'lockers'$q$, v_mod), 'P0001');

  -- Und der Umweg ueber eine NEUE eigene Rolle ist ebenfalls zu.
  perform testkit.throws('geschuetzt: auch ueber eine neue Rolle kommt sie nicht an lockers',
    $q$insert into app.role_permissions (club_id, role_id, capability_key, level)
       select 'c1ab0000-0000-4000-8000-000000000001', r.id, 'lockers', 'manage'
       from app.roles r where r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
         and r.key = 'coach'$q$, 'P0001');

  -- Die Gegenprobe: NICHT geschuetzte Faehigkeiten kann sie weiterhin setzen.
  -- Sonst haette 0032 den Rollen-Admin insgesamt entmachtet statt gezielt zu
  -- schuetzen.
  perform testkit.succeeds('geschuetzt: NICHT geschuetzte Faehigkeiten setzt sie weiterhin (news)',
    format($q$update app.role_permissions set level = 'read_all'
             where role_id = %L and capability_key = 'news'$q$, v_mod));
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) Die Gegenprobe zu B: der VEREINSINHABER darf es. Eine Sperre, die auch
--    den Inhaber aussperrt, waere ein Ausfall statt einer Haertung.
--    (Seine EIGENE Rolle bleibt unantastbar — das ist der protected-Zweig aus
--    0024 und hier nicht das Thema; er stellt eine ANDERE Rolle ein.)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
declare
  v_mod uuid := (select id from app.roles
                  where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'moderator');
begin
  perform testkit.is_eq('geschuetzt: app.is_club_owner erkennt den Inhaber',
    (select count(*) from (values (1)) t
      where app.is_club_owner('c1ab0000-0000-4000-8000-000000000001')), 1);
  perform testkit.succeeds('geschuetzt: der Inhaber DARF lockers vergeben',
    format($q$update app.role_permissions set level = 'manage'
             where role_id = %L and capability_key = 'lockers'$q$, v_mod));
end;
$$;
rollback;

-- Und der Admin ist NICHT der Inhaber — der Unterschied ist der ganze Punkt.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
do $$
declare
  v_mod uuid := (select id from app.roles
                  where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'moderator');
begin
  perform testkit.is_eq('geschuetzt: der admin ist NICHT is_club_owner',
    (select count(*) from (values (1)) t
      where app.is_club_owner('c1ab0000-0000-4000-8000-000000000001')), 0);
  perform testkit.throws('geschuetzt: also kommt auch der admin nicht an lockers',
    format($q$update app.role_permissions set level = 'manage'
             where role_id = %L and capability_key = 'lockers'$q$, v_mod), 'P0001');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) BEFUND (2): die Inhaber-Rolle laesst sich nicht mehr umbenennen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
declare
  v_own uuid := (select id from app.roles
                  where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'owner');
begin
  perform testkit.throws('inhaber-rolle: laesst sich NICHT mehr umbenennen (war "Putzkraft")',
    format($q$update app.roles set name_de = 'Putzkraft', name_en = 'Cleaner'
             where id = %L$q$, v_own), 'P0001');

  -- Die Gegenprobe: JEDE ANDERE Systemrolle bleibt frei benennbar (0024:257).
  -- Sonst haette 0032 mehr zugenagelt als beauftragt.
  perform testkit.succeeds('inhaber-rolle: andere Systemrollen bleiben frei benennbar',
    $q$update app.roles set name_de = 'Uebungsleitung', name_en = 'Head coach'
        where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'coach'$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) BEFUND (3): die GEMELDETE Stufe liegt jetzt immer auf der Skala.
--
--    WICHTIG — warum hier `level` und nicht `rank` korrigiert wird:
--    Der erste Ansatz war, den Kurzschluss in cap_rank auf max(allowed_levels)
--    zu klemmen. Das ist VERBOTEN: 93e_rbac_resolution.sql:96-113 friert
--    "protected -> ueberall Rang 5" ausdruecklich als "harte Garantie (der
--    Verein sperrt sich nicht selbst aus)" ein. Der Versuch liess genau diesen
--    Bestands-Test fallen ("got 17, expected 0"). Bestands-Tests werden nicht
--    angefasst -> cap_rank bleibt, korrigiert wird die MELDUNG in cap_ranks.
--
--    Die Falle fuer die Admin-UI: ein Dropdown aus allowed_levels findet einen
--    gemeldeten Wert nicht wieder, den es auf dieser Skala gar nicht gibt.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
  v_bad  text;
begin
  -- E1: der konkret gemeldete Befund. member_contact kennt nur {none,read_all}
  --     -> gemeldete Stufe read_all statt des erfundenen 'manage'.
  perform testkit.is_eq('meldung: owner member_contact meldet read_all, NICHT manage',
    (select count(*) from app.cap_ranks(v_club)
      where capability_key = 'member_contact' and level = 'read_all'), 1);

  -- E2: DIE Zusicherung, auf die sich ein Admin-UI verlassen koennen muss —
  --     fuer JEDE Faehigkeit liegt die gemeldete Stufe in ihren
  --     allowed_levels. Vorher galt das bei 17 von 32 nicht.
  select string_agg(format('%s: level=%s allowed=%s', capability_key, level,
                           allowed_levels::text), ', ')
    into v_bad
  from app.cap_ranks(v_club)
  where not (level = any (allowed_levels));

  if v_bad is null then
    perform testkit.ok('meldung: die gemeldete Stufe liegt bei JEDER Faehigkeit in allowed_levels');
  else
    perform testkit.fail('meldung: die gemeldete Stufe liegt bei JEDER Faehigkeit in allowed_levels',
      format('ausserhalb der Skala: %s', v_bad));
  end if;

  -- E3: KEIN Rechteverlust und KEIN Bruch der harten Garantie: der Rang bleibt
  --     ueberall 5 (genau das, was 93e:96-113 verlangt). Die Durchsetzung ist
  --     unveraendert — diese Migration korrigiert nur die Anzeige.
  perform testkit.is_eq('meldung: der Rang des owner bleibt auf JEDER Faehigkeit 5 (93e-Garantie)',
    (select count(*) from app.cap_ranks(v_club) where rank <> 5), 0);

  -- E4: wo die Skala bis manage reicht, meldet sie weiterhin manage —
  --     das Klemmen darf nur dort wirken, wo 5 ausserhalb der Skala lag.
  perform testkit.is_eq('meldung: wo die Skala manage kennt, meldet sie weiterhin manage',
    (select count(*) from app.cap_ranks(v_club)
      where capability_key in ('finance', 'lockers', 'roles') and level = 'manage'), 3);
end;
$$;
rollback;

-- E5) Die Gegenprobe an einer NICHT geschuetzten Rolle: fuer sie ist das
--     Klemmen ein no-op (ihr Rang liegt ohnehin in allowed_levels). Sonst
--     haette 0032 auch dort etwas verschoben.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
begin
  -- Fuer jede Nicht-owner-Zeile MUSS level_rank(level) = rank gelten.
  perform testkit.is_eq('meldung: fuer die coach-Rolle gilt weiterhin level_rank(level) = rank',
    (select count(*) from app.cap_ranks(v_club)
      where app.level_rank(level) <> rank), 0);
  perform testkit.is_eq('meldung: und ihre Stufen liegen ebenfalls alle in allowed_levels',
    (select count(*) from app.cap_ranks(v_club)
      where not (level = any (allowed_levels))), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Und der Beweis, dass E3/E4 keine Rechte gekostet haben: der owner kommt
--    weiterhin ueberall hin, wo er vorher hinkam. Die Kuer-Sicht und die
--    Schliessfaecher sind die beiden Faehigkeiten mit echten Lese-Policies.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('kein verlust: der owner sieht weiterhin alle 8 Schliessfaecher',
    (select count(*) from app.lockers), 8);
  perform testkit.is_eq('kein verlust: der owner sieht weiterhin alle 6 Kueren',
    (select count(*) from app.routines), 6);
  perform testkit.is_eq('kein verlust: member_contact >= read_all haelt (der Roster-Spaltenschutz)',
    (select count(*) from (values (1)) t
      where app.has_cap('c1ab0000-0000-4000-8000-000000000001', 'member_contact', 'read_all')), 1);
end;
$$;
rollback;
