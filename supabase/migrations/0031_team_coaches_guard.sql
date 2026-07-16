-- ============================================================================
-- 0031_team_coaches_guard.sql — Trainer-Zuordnungen vergibt nur, wer die Teams
-- verwaltet. Eine Trainerin kann sich nicht mehr selbst fremde Teams geben.
--
-- ### DER BEFUND (live belegt gegen rsm2-pg-dev + API :3022) ###
-- PUT /clubs/{c}/teams/{t}/coaches, angemeldet als Sandra Vogel (coach):
--   Trainer von "Minis & Anfaenger" vorher:  Anna-Lena Boehm
--   -> PUT mit member_ids = [Anna-Lena, Sandra]              -> HTTP 200
--   Trainer nachher:                         Anna-Lena Boehm, Sandra Vogel
-- Sandra betreut dieses Team NICHT. Ueber coached_team_ids/can_read_routine
-- sieht sie danach dessen Kueren. Selbstbedienung.
--
-- ### WOHER DIE WEITE KAM — KEINE Phase-2-Aufweichung ###
-- Das DB-Recht besteht seit 0007: team_members_insert/update =
-- has_club_role([owner, admin, moderator, coach]). Die API liess es durch,
-- weil roles.ts requireCap(..., 'teams', 'manage') prueft — und 'teams:manage'
-- schliesst den coach ein (rbac_default_level: v_structure = owner/admin/
-- moderator/COACH). Ein Kandidat fuer genau die Falle aus dem RBAC-DESIGN,
-- Korrekturblock Phase 2, Punkt 7 ("teams.ts: ADMIN_ROLES vs. teams:manage").
-- Der Nutzer hat entschieden, es zuzumachen.
--
-- ### BESTANDS-TESTS: KEINER friert die Weite als Sollverhalten ein ###
-- Geprueft, nicht vermutet — jedes team_members-Schreiben in supabase/tests/
-- laeuft ueber den SERVICE-Pfad (kein sub-Claim, RLS greift dort nicht):
--   01_fixture_club_b.sql:51  Fixture-Aufbau
--   93a_rbac_levels.sql:36    "Service-Pfad (kein sub-Claim)" (Kommentar dort)
--   93a_rbac_levels.sql:369   davor: reset role; set_config(claims,'')
--   93a_rbac_levels.sql:391   davor: reset role; set_config(claims,'')
-- 94:187 und 93c:35-36 LESEN nur. Kein Test behauptet "coach darf zuordnen".
-- Es musste also kein Bestands-Test angefasst werden.
--
-- ### DER WEG: eine eigene, KONFIGURIERBARE Faehigkeit ###
-- Nicht die Rollen hart verdrahten, sondern eine Faehigkeit 'team_coaches' —
-- passend zum Rest des Systems (Stufen, im Admin setzbar) und zur Vorgabe
-- "owner/admin/moderator bzw. die passende Faehigkeit".
-- Warum NICHT die vorhandene 'teams' benutzt: die traegt der coach bereits mit
-- 'manage' — genau daran ist der Endpoint gescheitert. Sie zu verengen wuerde
-- dem coach zugleich die legitime Team-Verwaltung nehmen (Rechte verschieben
-- statt haerten). Eine zweite Skala trennt beides sauber — dieselbe Logik wie
-- beim Kueren-Split (0028: 'routines' lesen vs. 'routines_edit' schreiben).
--
-- ### DER SCHNITT: nur role='coach' wird enger ###
-- Der Skater-Roster (role='skater') BLEIBT beim coach — das ist seine Arbeit
-- und war nie das Problem. Nur die Zeilen mit role='coach' verlangen ab jetzt
-- 'team_coaches' >= manage. Strikt enger, nie weiter.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Katalog: die neue Faehigkeit.
--    allowed_levels bewusst NUR {none, manage}: "Trainer zuordnen" ist keine
--    Lese-Skala und kennt kein sinnvolles 'edit' zwischen "gar nicht" und
--    "darf zuordnen". Eine Stufe zu erfinden, die kein Praedikat prueft, waere
--    der Fehler, den 0028 bei 'routines'.manage ehrlich benannt hat.
--    sort=65 -> zwischen 'teams' (60) und 'events' (70) im Admin-UI.
-- ----------------------------------------------------------------------------
insert into app.capabilities (key, label_de, label_en, allowed_levels, sort) values
  ('team_coaches', 'Trainer-Zuordnungen', 'Coach assignments',
   '{none,manage}', 65)
on conflict (key) do update set
  label_de       = excluded.label_de,
  label_en       = excluded.label_en,
  allowed_levels = excluded.allowed_levels,
  sort           = excluded.sort;

-- ----------------------------------------------------------------------------
-- 2. Startkonfiguration: NUR die Team-Verwalter (owner/admin/moderator).
--    Der coach faellt hier bewusst auf 'none' — das IST die Haertung.
--    Der Rest der Funktion ist woertlich aus 0028 uebernommen (create or
--    replace kann keinen einzelnen Zweig patchen).
-- ----------------------------------------------------------------------------
create or replace function app.rbac_default_level(p_role_key text, p_capability text)
returns app.role_level
language plpgsql
stable
parallel safe
set search_path = ''
as $$
declare
  v_admin     boolean := p_role_key in ('owner', 'admin', 'moderator');
  v_manager   boolean := p_role_key in ('owner', 'admin', 'moderator', 'treasurer');
  v_trainer   boolean := p_role_key in ('owner', 'admin', 'moderator', 'coach', 'guest_coach');
  v_structure boolean := p_role_key in ('owner', 'admin', 'moderator', 'coach');
  v_locker    boolean := p_role_key in ('owner', 'admin', 'treasurer');
  v_top       app.role_level;
begin
  if p_role_key = 'owner' then
    select l into v_top
    from app.capabilities c
    cross join unnest(c.allowed_levels) as l
    where c.key = p_capability
    order by app.level_rank(l) desc
    limit 1;
    return coalesce(v_top, 'none');
  end if;

  case p_capability

    when 'members' then
      return case when v_manager then 'manage' else 'read_all' end;

    when 'member_contact' then
      return case when v_manager then 'read_all' else 'none' end;

    when 'roles', 'club_settings' then
      return case when v_admin then 'manage' else 'none' end;

    when 'departments' then
      return case when v_admin then 'manage'
                  when v_trainer then 'edit'
                  else 'none' end;

    when 'teams', 'events', 'competitions', 'tasks' then
      return case when v_structure then 'manage' else 'read_all' end;

    -- NEU (0031): Trainer-Zuordnungen. NUR Team-Verwalter, ausdruecklich OHNE
    -- coach — sonst gaebe sich eine Trainerin selbst fremde Teams (der Befund).
    when 'team_coaches' then
      return case when v_admin then 'manage' else 'none' end;

    -- LESEN (unveraendert, 0021/0026 can_read_routine):
    --   owner/admin/moderator = alles; coach/guest_coach = betreute Teams;
    --   alle uebrigen (auch treasurer!) = nur eigene (Skater-Zweig).
    when 'routines' then
      return case when v_admin then 'manage'
                  when p_role_key in ('coach', 'guest_coach') then 'read_team'
                  else 'read_own' end;

    -- (0028) SCHREIBEN: exakt is_club_trainer, die Menge der 10 Kuer-
    -- Schreib-Policies. treasurer/member fallen auf 'none'.
    when 'routines_edit' then
      return case when v_trainer then 'edit' else 'none' end;

    when 'attendance', 'training_slots', 'exercises', 'achievements', 'news',
         'media', 'documents', 'gallery', 'equipment', 'facilities',
         'regional_events' then
      return case when v_trainer then 'edit' else 'read_all' end;

    when 'facilities_booking', 'duty_hours', 'waitlists', 'checkins' then
      return case when v_trainer then 'edit' else 'read_own' end;

    when 'equipment_reservations' then
      return case when v_trainer then 'manage' else 'read_own' end;

    when 'lockers' then
      return case when v_locker then 'manage' else 'read_own' end;

    when 'finance' then
      return case when v_manager then 'manage' else 'read_own' end;

    when 'chat' then
      return case when v_trainer then 'read_all' else 'read_team' end;

    when 'anniversaries' then
      return case when p_role_key in ('admin', 'moderator', 'treasurer', 'coach')
                  then 'read_all' else 'read_team' end;

    else
      -- Unbekannte Faehigkeit: fail-closed. Kein stiller Vollzugriff.
      return 'none';
  end case;
end;
$$;

comment on function app.rbac_default_level(text, text) is
  'Startkonfiguration je Systemrolle × Fähigkeit. Bildet den HEUTIGEN Rechtestand 1:1 ab (nicht RBAC-DESIGN §3 — Abweichungen siehe Kopf von 0023). Seit 0028 routines_edit = is_club_trainer. Seit 0031 team_coaches = nur Team-Verwalter (owner/admin/moderator), bewusst OHNE coach.';

-- ----------------------------------------------------------------------------
-- 3. BACKFILL des Bestands (Muster aus 0028:4). rbac_seed_club ist idempotent
--    (on conflict do nothing) und ergaenzt daher NUR die fehlende
--    team_coaches-Zeile je Rolle. Ohne Backfill waere cap_rank('team_coaches')
--    = 0 fuer ALLE — auch fuer owner/admin/moderator, und niemand koennte mehr
--    Trainer zuordnen. Netz: 93_rbac.sql:104-108 vergleicht
--    count(role_permissions where is_system) gegen count(capabilities) * 7 —
--    die rechte Seite steigt hier um 7 und der Test braeche laut.
-- ----------------------------------------------------------------------------
do $$
declare
  v_club uuid;
begin
  for v_club in select id from app.clubs loop
    perform app.rbac_seed_club(v_club);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Die Policies. NUR der coach-Zweig wird enger; role='skater' behaelt exakt
--    die bisherige Menge (0007).
--
--    Zum UPDATE, weil es der subtile Teil ist: `using` sieht die ALTE Zeile,
--    `with check` die NEUE. Daraus folgt genau das gewuenschte Verhalten:
--      skater -> coach  : using(alt=skater) laesst den coach durch, aber
--                         with check(neu=coach) verlangt team_coaches:manage
--                         -> ein coach kann NIEMANDEN befoerdern.
--      coach  -> skater : using(alt=coach) verlangt bereits manage
--                         -> ein coach kann keinen Trainer degradieren.
--      coach soft-delete: alt UND neu sind 'coach' -> manage noetig.
--      skater soft-delete: beide 'skater' -> bleibt beim coach (seine Arbeit).
-- ----------------------------------------------------------------------------
alter policy team_members_insert on app.team_members
  with check (
    case when role = 'coach'
         then app.has_cap(club_id, 'team_coaches', 'manage')
         else app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach'])
    end
  );

alter policy team_members_update on app.team_members
  using (
    case when role = 'coach'
         then app.has_cap(club_id, 'team_coaches', 'manage')
         else app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach'])
    end
  )
  with check (
    case when role = 'coach'
         then app.has_cap(club_id, 'team_coaches', 'manage')
         else app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach'])
    end
  );

-- ----------------------------------------------------------------------------
-- 5. Selbstkontrolle (woertlich aus 0028:6): jede Default-Stufe MUSS in
--    allowed_levels ihrer Faehigkeit stehen, sonst kann das Admin-UI den
--    Startwert nicht einmal anzeigen.
-- ----------------------------------------------------------------------------
do $$
declare
  v_bad text;
begin
  select string_agg(format('%s/%s=%s', r.key, c.key, app.rbac_default_level(r.key, c.key)), ', ')
    into v_bad
  from app.capabilities c
  cross join app.rbac_system_role_labels() r
  where not (app.rbac_default_level(r.key, c.key) = any (c.allowed_levels));

  if v_bad is not null then
    raise exception 'rbac_default_level liefert Stufen ausserhalb von allowed_levels: %', v_bad;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Die WIRKUNGS-Kontrolle: team_coaches >= manage MUSS exakt
--    {owner, admin, moderator} sein. Waere der coach dabei, haette diese
--    Migration nichts gehaertet und die Selbstbedienung bliebe offen — dann
--    muss sie laut scheitern statt still durchzugehen.
-- ----------------------------------------------------------------------------
do $$
declare
  v_club uuid;
  v_actual text;
begin
  for v_club in select id from app.clubs loop
    select string_agg(r.key, ',' order by r.key) into v_actual
    from app.roles r
    join app.role_permissions rp on rp.role_id = r.id
    where r.club_id = v_club
      and r.is_system
      and rp.capability_key = 'team_coaches'
      and app.level_rank(rp.level) >= app.level_rank('manage');

    if v_actual is distinct from 'admin,moderator,owner' then
      raise exception 'team_coaches >= manage ist NICHT {owner,admin,moderator} (Verein %): got [%]',
        v_club, coalesce(v_actual, '<leer>');
    end if;
  end loop;
end;
$$;

commit;
