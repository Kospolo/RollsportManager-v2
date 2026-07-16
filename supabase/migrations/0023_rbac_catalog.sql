-- ============================================================================
-- 0023_rbac_catalog.sql — Fähigkeiten-Katalog + Default-Matrix (Phase 1b).
--
-- Zwei Dinge, beide noch OHNE Wirkung auf bestehende Policies:
--   1. der statische capabilities-Katalog (bilingual, RBAC-DESIGN §3)
--   2. app.rbac_default_level(role_key, capability) — die Startkonfiguration
--      jedes Vereins, die 0024 in role_permissions materialisiert.
--
-- ### WICHTIG: Die Default-Matrix bildet den HEUTIGEN Stand 1:1 ab. ###
-- Sie ist NICHT die Tabelle aus RBAC-DESIGN §3 abgeschrieben. §3 ist der
-- Ziel-Default für das Admin-UI; würde man ihn hier wörtlich übernehmen, würden
-- Rechte VERSCHOBEN statt migriert. Belegte Abweichungen (Code > Spec):
--   * routines/treasurer: §3 sagt 'none', IST = read_own (can_read_routine,
--     0021:107 — der Kassenwart fällt auf den Skater-Zweig).
--   * lockers/moderator+coach: 0021 behauptet im Kommentar "sehen KEINE Fächer",
--     der CODE (0021:156) lässt aber JEDEN sein EIGENES Fach sehen -> read_own.
--   * attendance/member: §3 sagt read_own, IST = read_all (attendance_select ist
--     is_club_member und bleibt es — Lesen ist hier nicht cap-gated).
--   * member_contact/coach: §3 sagt 'read', IST = none (members.ts:69 gated auf
--     MANAGE_MEMBER_ROLES = owner/admin/moderator/treasurer).
--   * finance/coach: §3 sagt 'none', IST = read_own — der Eigen-Zweig der
--     Finanz-Policies ist can_act_for_member und gilt für JEDE Rolle.
-- Diese fünf Punkte sind bewusst als IST eingefroren und liegen dem Nutzer als
-- Freigabe-Entscheidung vor (Admin-UI kann sie danach jederzeit setzen).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Der Katalog. allowed_levels = die im UI wählbare Teilmenge je Fähigkeit.
-- ----------------------------------------------------------------------------
insert into app.capabilities (key, label_de, label_en, allowed_levels, sort) values
  ('members', 'Mitglieder', 'Members',
   '{none,read_all,manage}', 10),
  ('member_contact', 'Kontaktdaten (Geburtstag/E-Mail)', 'Contact details (birthday/e-mail)',
   '{none,read_all}', 20),
  ('roles', 'Rollen & Rechte', 'Roles & permissions',
   '{none,read_all,manage}', 30),
  ('club_settings', 'Vereinseinstellungen', 'Club settings',
   '{none,read_all,manage}', 40),
  ('departments', 'Abteilungen', 'Departments',
   '{none,read_all,edit,manage}', 50),
  ('teams', 'Teams', 'Teams',
   '{none,read_all,manage}', 60),
  ('events', 'Termine', 'Events',
   '{none,read_all,manage}', 70),
  ('competitions', 'Wettkämpfe', 'Competitions',
   '{none,read_all,manage}', 80),
  ('tasks', 'Aufgaben', 'Tasks',
   '{none,read_all,manage}', 90),
  ('routines', 'Küren', 'Routines',
   '{none,read_own,read_team,read_all,manage}', 100),
  ('attendance', 'Anwesenheit', 'Attendance',
   '{none,read_own,read_team,read_all,edit}', 110),
  ('training_slots', 'Trainingsplan', 'Training schedule',
   '{none,read_all,edit}', 120),
  ('exercises', 'Übungen', 'Exercises',
   '{none,read_all,edit}', 130),
  ('achievements', 'Erfolge', 'Achievements',
   '{none,read_all,edit}', 140),
  ('news', 'Neuigkeiten', 'News',
   '{none,read_all,edit}', 150),
  ('media', 'Medien', 'Media',
   '{none,read_all,edit}', 160),
  ('documents', 'Dokumente', 'Documents',
   '{none,read_all,edit}', 170),
  ('gallery', 'Galerie', 'Gallery',
   '{none,read_all,edit}', 180),
  ('chat', 'Chat', 'Chat',
   '{none,read_own,read_team,read_all}', 190),
  ('equipment', 'Material', 'Equipment',
   '{none,read_all,edit}', 200),
  ('equipment_reservations', 'Material-Reservierungen', 'Equipment reservations',
   '{none,read_own,read_all,edit,manage}', 210),
  ('facilities', 'Anlagen', 'Facilities',
   '{none,read_all,edit}', 220),
  ('facilities_booking', 'Belegungsplan', 'Facility bookings',
   '{none,read_own,read_all,edit,manage}', 230),
  ('lockers', 'Schließfächer', 'Lockers',
   '{none,read_own,read_all,manage}', 240),
  ('finance', 'Finanzen', 'Finance',
   '{none,read_own,manage}', 250),
  ('duty_hours', 'Pflichtstunden', 'Duty hours',
   '{none,read_own,read_all,edit}', 260),
  ('waitlists', 'Wartelisten', 'Waiting lists',
   '{none,read_own,read_all,edit}', 270),
  ('checkins', 'Check-ins', 'Check-ins',
   '{none,read_own,read_all,edit}', 280),
  ('regional_events', 'Regionale Termine', 'Regional events',
   '{none,read_all,edit}', 290),
  ('anniversaries', 'Jubiläen', 'Anniversaries',
   '{none,read_team,read_all}', 300)
on conflict (key) do update set
  label_de       = excluded.label_de,
  label_en       = excluded.label_en,
  allowed_levels = excluded.allowed_levels,
  sort           = excluded.sort;

-- ----------------------------------------------------------------------------
-- Die 7 Systemrollen: Anzeigenamen (bilingual) + Sortierung = Rangfolge.
-- Reihenfolge identisch zu app.club_member_role und services/api CLUB_ROLES.
-- ----------------------------------------------------------------------------
create or replace function app.rbac_system_role_labels()
returns table (key text, name_de text, name_en text, sort int)
language sql
immutable
parallel safe
set search_path = ''
as $$
  select * from (values
    ('owner',       'Inhaber:in',      'Owner',        10),
    ('admin',       'Administrator:in', 'Administrator', 20),
    ('moderator',   'Moderator:in',    'Moderator',    30),
    ('treasurer',   'Kassenwart:in',   'Treasurer',    40),
    ('coach',       'Trainer:in',      'Coach',        50),
    ('member',      'Mitglied',        'Member',       60),
    ('guest_coach', 'Gast-Trainer:in', 'Guest coach',  70)
  ) as t(key, name_de, name_en, sort)
$$;

comment on function app.rbac_system_role_labels() is
  'Die 7 Systemrollen (key = app.club_member_role) mit bilingualen Namen. sort = Rangfolge (owner zuerst).';

-- ----------------------------------------------------------------------------
-- app.rbac_default_level — die Startkonfiguration. EIN Ort, an dem die heutige
-- Rechte-Matrix als Stufen ausgedrückt ist. Jede Zeile ist gegen den heutigen
-- Helfer/Policy-Body belegt (siehe Kopf-Kommentar).
--
-- Rollenmengen (aus 0007 / 0021, wörtlich):
--   admin_set     = owner/admin/moderator                    (is_club_admin)
--   manager_set   = owner/admin/moderator/treasurer          (can_manage_members
--                                                             = can_manage_finance)
--   trainer_set   = owner/admin/moderator/coach/guest_coach  (is_club_trainer)
--   structure_set = owner/admin/moderator/coach              (has_club_role-Array
--                                                             OHNE guest_coach!)
--   locker_set    = owner/admin/treasurer                    (0021 lockers)
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
  -- owner ist protected (RBAC-DESIGN §4): immer die HÖCHSTE Stufe, die die
  -- Fähigkeit überhaupt kennt. Nicht pauschal 'manage' — Fähigkeiten wie
  -- member_contact ({none,read_all}) kennen gar kein 'manage'; ein fester Wert
  -- 'manage' läge ausserhalb ihrer allowed_levels und wäre im UI nicht
  -- darstellbar. Die harte Garantie "owner kann alles" sitzt zusätzlich als
  -- Kurzschluss in app.cap_rank (0025) und hängt nicht an dieser Zeile.
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

    -- club_members_insert/update = can_manage_members; Lesen = is_club_member
    -- (bleibt so) -> alle anderen sehen den Roster = read_all.
    when 'members' then
      return case when v_manager then 'manage' else 'read_all' end;

    -- API-Spaltenprojektion (members.ts:69) = MANAGE_MEMBER_ROLES. Phase 2.
    when 'member_contact' then
      return case when v_manager then 'read_all' else 'none' end;

    -- Rollenverwaltung: heute is_club_admin (0022-Policies auf roles/*).
    when 'roles', 'club_settings' then
      return case when v_admin then 'manage' else 'none' end;

    -- departments  : is_club_admin  -> manage
    -- department_members: is_club_trainer -> edit  (eine Fähigkeit, zwei Stufen)
    when 'departments' then
      return case when v_admin then 'manage'
                  when v_trainer then 'edit'
                  else 'none' end;

    -- has_club_role(array['owner','admin','moderator','coach']) — OHNE
    -- guest_coach. Lesen bleibt is_club_member -> read_all für den Rest.
    when 'teams', 'events', 'competitions', 'tasks' then
      return case when v_structure then 'manage' else 'read_all' end;

    -- can_read_routine (0021:100-114) — das Stufenmodell in Handarbeit:
    --   owner/admin/moderator = alles; coach/guest_coach = betreute Teams;
    --   alle übrigen (auch treasurer!) = nur eigene (Skater-Zweig).
    when 'routines' then
      return case when v_admin then 'manage'
                  when p_role_key in ('coach', 'guest_coach') then 'read_team'
                  else 'read_own' end;

    -- Trainer-Module: Schreiben = is_club_trainer, Lesen = is_club_member.
    when 'attendance', 'training_slots', 'exercises', 'achievements', 'news',
         'media', 'documents', 'gallery', 'equipment', 'facilities',
         'regional_events' then
      return case when v_trainer then 'edit' else 'read_all' end;

    -- is_club_trainer OR is_own_member(...) — Trainer alles, Rest nur eigenes.
    when 'facilities_booking', 'duty_hours', 'waitlists', 'checkins' then
      return case when v_trainer then 'edit' else 'read_own' end;

    when 'equipment_reservations' then
      return case when v_trainer then 'manage' else 'read_own' end;

    -- 0021: owner/admin/treasurer verwalten; JEDER sieht sein EIGENES Fach.
    when 'lockers' then
      return case when v_locker then 'manage' else 'read_own' end;

    -- can_manage_finance; der Eigen-Zweig (can_act_for_member) gilt für alle.
    when 'finance' then
      return case when v_manager then 'manage' else 'read_own' end;

    -- chat_messages_select: team-Kanal = is_team_member OR is_club_trainer,
    -- direct = eigene. Keine Policy-Umstellung in Phase 1.
    when 'chat' then
      return case when v_trainer then 'read_all' else 'read_team' end;

    -- Nicht RLS-durchgesetzt (Auswertung/Anzeige) -> RBAC-DESIGN §3 gilt.
    when 'anniversaries' then
      return case when p_role_key in ('admin', 'moderator', 'treasurer', 'coach')
                  then 'read_all' else 'read_team' end;

    else
      -- Unbekannte Fähigkeit: fail-closed. Kein stiller Vollzugriff.
      return 'none';
  end case;
end;
$$;

comment on function app.rbac_default_level(text, text) is
  'Startkonfiguration je Systemrolle × Fähigkeit. Bildet den HEUTIGEN Rechtestand 1:1 ab (nicht RBAC-DESIGN §3 — Abweichungen siehe Migrations-Kopf). Unbekannte Fähigkeit = none (fail-closed).';

-- Selbstkontrolle: jede Default-Stufe MUSS in allowed_levels der Fähigkeit
-- stehen, sonst kann das Admin-UI den Startwert nicht einmal wieder anzeigen.
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

commit;
