-- ============================================================================
-- 0021_privacy.sql — RollsportManager v2: Sichtbarkeits-Verschärfung
-- (Security-Härtung der Mitglieder-/Modul-Sichtbarkeit, RLS = die Wahrheit).
--
-- Was diese Migration verschärft (Ziel-Rechte, verbindlich):
--   * lockers (Schließfächer): SELECT nur für owner/admin/treasurer ODER
--     is_platform_admin ODER das EIGENE Fach (assigned_member_id = eigenes
--     club_member). Ein Mitglied sieht NUR sein eigenes Fach, sonst nichts.
--     Moderator/Coach sehen KEINE Fächer. Verwalten = owner/admin/treasurer.
--   * facility_bookings (Belegungsplan): Lesen bleibt is_club_member (Plan
--     sichtbar), ANLEGEN aber nur noch is_club_trainer+ (Mitglieder dürfen
--     NICHT mehr buchen). UPDATE/DELETE unverändert = Ersteller ODER Trainer.
--   * routines + routine_markers + routine_scores + routine_skaters (Küren):
--     SELECT = is_platform_admin ODER owner/admin/moderator [ALLES] ODER
--     coach/guest_coach für die von ihnen betreuten Teams (+ eigene, wo sie
--     selbst Skater sind) ODER member NUR wo das eigene club_member Skater ist.
--     Schreiben bleibt is_club_trainer (unverändert).
--   * club_members: RLS-Lesen bleibt is_club_member (Roster sichtbar) — die
--     Spalten-Restriktion für Nicht-Finanz-Rollen macht die API (members.ts).
--
-- Spalten-Filter (Roster) am API-Layer, Zeilen-Filter per RLS (Blueprint §4).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Helper: own_member_id — die club_members.id des eingeloggten Nutzers im
-- gegebenen Verein (NULL, wenn der Nutzer dort kein Mitglied ist). SECURITY
-- DEFINER, damit der Lookup RLS-frei ist (keine Policy-Rekursion).
-- ----------------------------------------------------------------------------
create or replace function app.own_member_id(p_club_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from app.club_members m
  where m.club_id = p_club_id
    and m.profile_id = auth.uid()
    and m.deleted_at is null
  order by m.created_at
  limit 1
$$;

comment on function app.own_member_id(uuid) is
  'club_members.id des eingeloggten Nutzers im Verein (NULL = kein Mitglied). Basis für "nur eigenes Fach / eigene Kür".';

-- ----------------------------------------------------------------------------
-- Helper: coaches_team — betreut der Aufrufer das gegebene Team? (Trainer-Rolle
-- in app.team_members, soft-deleted ausgeschlossen). p_team_id kann NULL sein
-- (Kür ohne Team) -> dann false.
-- ----------------------------------------------------------------------------
create or replace function app.coaches_team(p_club_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.team_members tm
    join app.club_members m on m.id = tm.member_id
    where tm.team_id = p_team_id
      and tm.club_id = p_club_id
      and tm.role = 'coach'
      and tm.deleted_at is null
      and m.profile_id = auth.uid()
      and m.deleted_at is null
  )
$$;

comment on function app.coaches_team(uuid, uuid) is
  'True, wenn der Aufrufer als Trainer (team_members.role=coach) im gegebenen Team steht. Für die Kür-Sichtbarkeit der Coaches.';

-- ----------------------------------------------------------------------------
-- Helper: can_read_routine — die EINE Stelle, die die Kür-Lesesichtbarkeit
-- kodiert (routines + markers + scores + skaters delegieren hierher):
--   is_platform_admin
--   ODER owner/admin/moderator  [ALLES im Verein]
--   ODER coach/guest_coach UND betreut das Team der Kür
--   ODER der Aufrufer ist selbst Skater der Kür (eigene Kür).
-- SECURITY DEFINER -> der innere Zugriff auf routines/routine_skaters ist
-- RLS-frei, keine Rekursion über die eigene Policy.
-- ----------------------------------------------------------------------------
create or replace function app.can_read_routine(p_routine_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.routines r
    where r.id = p_routine_id
      and r.deleted_at is null
      and (
        app.is_platform_admin()
        or app.has_club_role(r.club_id, array['owner', 'admin', 'moderator'])
        or (
          app.has_club_role(r.club_id, array['coach', 'guest_coach'])
          and app.coaches_team(r.club_id, r.team_id)
        )
        or exists (
          select 1
          from app.routine_skaters rs
          where rs.routine_id = r.id
            and rs.deleted_at is null
            and app.is_own_member(rs.member_id)
        )
      )
  )
$$;

comment on function app.can_read_routine(uuid) is
  'Kür-Lesesichtbarkeit (Referenz-Privacy): platform-admin / owner-admin-moderator = alles; coach/guest_coach = betreute Teams; member = nur eigene (Skater).';

-- ============================================================================
-- lockers — Schließfächer
-- ============================================================================

-- protect_locker: die Master-Daten-Sperre gilt jetzt gegen alle, die NICHT
-- owner/admin/treasurer sind (früher is_club_admin). Da die UPDATE-Policy
-- ohnehin nur owner/admin/treasurer zulässt, dürfen diese drei alles ändern.
create or replace function app.protect_locker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_club_role(new.club_id, array['owner', 'admin', 'treasurer']) then
    if new.club_id    is distinct from old.club_id
       or new.label    is distinct from old.label
       or new.location is distinct from old.location
       or new.note     is distinct from old.note
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'lockers: assign/release only — editing or deleting a locker needs owner/admin/treasurer'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- SELECT: owner/admin/treasurer ODER platform-admin ODER das eigene Fach.
drop policy if exists lockers_select on app.lockers;
create policy lockers_select on app.lockers
  for select to authenticated
  using (
    app.is_platform_admin()
    or app.has_club_role(club_id, array['owner', 'admin', 'treasurer'])
    or assigned_member_id = app.own_member_id(club_id)
  );

-- Verwalten (create / edit / soft-delete) = owner/admin/treasurer.
drop policy if exists lockers_insert on app.lockers;
create policy lockers_insert on app.lockers
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'treasurer']));

drop policy if exists lockers_update on app.lockers;
create policy lockers_update on app.lockers
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'treasurer']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'treasurer']));

-- ============================================================================
-- facility_bookings — Belegungsplan
--   Lesen bleibt is_club_member (Plan sichtbar für alle Mitglieder).
--   ANLEGEN nur noch is_club_trainer (Mitglieder dürfen NICHT mehr buchen).
--   UPDATE/DELETE unverändert = Ersteller (is_own_member) ODER is_club_trainer.
-- ============================================================================
drop policy if exists facility_bookings_insert on app.facility_bookings;
create policy facility_bookings_insert on app.facility_bookings
  for insert to authenticated
  with check (app.is_club_trainer(club_id));

-- ============================================================================
-- routines + routine_markers + routine_scores + routine_skaters — Küren
--   SELECT nur noch über can_read_routine (siehe oben). Schreiben unverändert.
-- ============================================================================
drop policy if exists routines_select on app.routines;
create policy routines_select on app.routines
  for select to authenticated
  using (app.can_read_routine(id));

drop policy if exists routine_skaters_select on app.routine_skaters;
create policy routine_skaters_select on app.routine_skaters
  for select to authenticated
  using (app.can_read_routine(routine_id));

drop policy if exists routine_markers_select on app.routine_markers;
create policy routine_markers_select on app.routine_markers
  for select to authenticated
  using (app.can_read_routine(routine_id));

drop policy if exists routine_scores_select on app.routine_scores;
create policy routine_scores_select on app.routine_scores
  for select to authenticated
  using (app.can_read_routine(routine_id));

commit;
