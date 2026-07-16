-- ============================================================================
-- 0026_rbac_policies.sql — Kern-Policies auf Fähigkeiten (Phase 1e).
--
-- Stellt die Kern-Tabellen aus RBAC-DESIGN §9.1 von festen Rollenlisten auf
-- has_cap/cap_rank um: members · lockers · routines · facilities(+bookings) ·
-- equipment(+reservations) · attendance · finance (invoices/ledger).
--
-- VERHALTEN BLEIBT IDENTISCH. Die Default-Matrix aus 0023 ist so gewählt, dass
-- jede neue Bedingung dieselbe Rollenmenge trifft wie die alte; die Äquivalenz
-- ist je Policy unten einzeln nachgerechnet und in 93_rbac.sql pro Rolle
-- gegengetestet. Neu ist NICHT wer darf, sondern DASS es konfigurierbar ist.
--
-- Nicht umgestellt (bewusst, Begründung an Ort und Stelle):
--   * die 46 is_club_member-Policies (Mitgliedschaft != Fähigkeit)
--   * der SCHREIB-Pfad der Küren (bleibt is_club_trainer — siehe unten)
--   * die restlichen Module (news, exercises, teams, events, …): ihre Policies
--     laufen weiter über has_club_role, das seit 0025 ebenfalls aus der DB
--     auflöst. Sie folgen gruppenweise in eigenen Migrationen.
-- ============================================================================

begin;

-- ============================================================================
-- members — club_members schreiben.
-- ALT: can_manage_members(club_id)          = owner/admin/moderator/treasurer
-- NEU: has_cap(club_id,'members','manage')  -> Default 'manage' für genau diese
--      vier; coach/member/guest_coach haben 'read_all' (3) < manage (5).
-- Die Feinsteuerung der Rollenänderung macht weiterhin der Trigger
-- protect_club_membership, NICHT die Policy (unverändert).
-- Lesen (club_members_select = is_club_member) bleibt unangetastet: der Roster
-- ist für jedes Mitglied sichtbar, die Spalten-Restriktion macht die API.
-- ============================================================================
alter policy club_members_insert on app.club_members
  with check (app.has_cap(club_id, 'members', 'manage'));

alter policy club_members_update on app.club_members
  using (app.has_cap(club_id, 'members', 'manage'))
  with check (app.has_cap(club_id, 'members', 'manage'));

-- ============================================================================
-- lockers — Schließfächer (0021-Härtung bleibt wortgleich erhalten).
-- ALT: is_platform_admin OR has_club_role([owner,admin,treasurer])
--      OR assigned_member_id = own_member_id(club_id)
-- NEU: is_platform_admin OR has_cap('lockers','read_all')
--      OR (cap_rank('lockers') >= read_own AND assigned_member_id = own_member_id)
-- Äquivalenz: owner/admin/treasurer = manage(5) >= read_all(3) -> alle Fächer.
-- moderator/coach/member/guest_coach = read_own(1): 1 >= 3 nein -> nur das
-- EIGENE Fach. Das entspricht dem CODE von 0021:156 (dessen Kommentar
-- "Moderator/Coach sehen KEINE Fächer" war schon immer falsch — die
-- own-Bedingung galt dort für jeden). is_platform_admin bleibt explizit im
-- Prädikat; has_cap hat bewusst KEINEN eingebauten Bypass.
-- ============================================================================
drop policy if exists lockers_select on app.lockers;
create policy lockers_select on app.lockers
  for select to authenticated
  using (
    app.is_platform_admin()
    or app.has_cap(club_id, 'lockers', 'read_all')
    or (
      app.cap_rank(club_id, 'lockers') >= app.level_rank('read_own')
      and assigned_member_id = app.own_member_id(club_id)
    )
  );

drop policy if exists lockers_insert on app.lockers;
create policy lockers_insert on app.lockers
  for insert to authenticated
  with check (app.has_cap(club_id, 'lockers', 'manage'));

drop policy if exists lockers_update on app.lockers;
create policy lockers_update on app.lockers
  for update to authenticated
  using (app.has_cap(club_id, 'lockers', 'manage'))
  with check (app.has_cap(club_id, 'lockers', 'manage'));

-- Die Master-Daten-Sperre zieht mit (identische Rollenmenge wie 0021:135).
create or replace function app.protect_locker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_cap(new.club_id, 'lockers', 'manage') then
    if new.club_id    is distinct from old.club_id
       or new.label    is distinct from old.label
       or new.location is distinct from old.location
       or new.note     is distinct from old.note
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'lockers: assign/release only — editing or deleting a locker needs the lockers capability at level manage'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- routines — Küren. NUR der LESE-Pfad wird umgestellt.
--
-- ### Warum der Schreib-Pfad bleibt, wie er ist ###
-- Lese- und Schreibrecht sind bei Küren ASYMMETRISCH: is_club_trainer darf JEDE
-- Kür des Vereins schreiben (0007:319), sehen darf ein Coach aber nur die Küren
-- seiner Teams (0021). Auf einer einzigen geordneten Skala ist das nicht
-- abbildbar — 'edit' (4) impliziert laut RBAC-DESIGN §2 read_all (3). Gäbe man
-- dem Coach 'edit', bekäme er read_all und die 0021-Privacy-Härtung wäre
-- aufgeweicht (er sähe alle Küren). Gäbe man ihm nur read_team, verlöre er das
-- Schreibrecht (30_guest_coach_expiry.sql:30 fixiert: guest_coach DARF Marker
-- setzen). Beides inakzeptabel -> die Fähigkeit 'routines' bildet die
-- LESE-Stufe ab (Optionen none/read_own/read_team/read_all/manage, exakt
-- RBAC-DESIGN §3), der Schreib-Pfad bleibt bis zu einer ausdrücklichen
-- Entscheidung des Nutzers auf is_club_trainer.
--
-- can_read_routine behält Signatur und Aufrufer; nur der Body wird zum
-- Stufenmodell. Die 4 SELECT-Policies (0021:186-204) bleiben wortgleich.
-- ============================================================================
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
        -- >= read_all: alles im Verein (Default: owner/admin/moderator)
        or app.cap_rank(r.club_id, 'routines') >= app.level_rank('read_all')
        -- = read_team: die betreuten Teams (Default: coach/guest_coach)
        or (
          app.cap_rank(r.club_id, 'routines') = app.level_rank('read_team')
          and r.team_id = any (app.coached_team_ids(r.club_id))
        )
        -- >= read_own: die eigenen Küren (Default: alle übrigen, inkl. treasurer)
        or (
          app.cap_rank(r.club_id, 'routines') >= app.level_rank('read_own')
          and exists (
            select 1
            from app.routine_skaters rs
            where rs.routine_id = r.id
              and rs.deleted_at is null
              and app.is_own_member(rs.member_id)
          )
        )
      )
  )
$$;

comment on function app.can_read_routine(uuid) is
  'Kür-Lesesichtbarkeit als Stufenmodell über cap_rank(club,''routines''): >=read_all alles; =read_team die betreuten Teams (coached_team_ids); >=read_own die eigenen (Skater). Signatur/Aufrufer unverändert (0021).';

-- ============================================================================
-- attendance — Anwesenheit. Lesen bleibt is_club_member (unverändert).
-- ALT: is_club_trainer(club_id)                = owner/admin/moderator/coach/guest_coach
-- NEU: has_cap(club_id,'attendance','edit')    -> Default 'edit' für genau diese
--      fünf; treasurer/member haben 'read_all' (3) < edit (4).
-- ============================================================================
alter policy attendance_insert on app.attendance
  with check (app.has_cap(club_id, 'attendance', 'edit'));

alter policy attendance_update on app.attendance
  using (app.has_cap(club_id, 'attendance', 'edit'))
  with check (app.has_cap(club_id, 'attendance', 'edit'));

-- ============================================================================
-- facilities / facility_bookings — Anlagen + Belegungsplan.
-- facilities:        ALT is_club_trainer -> NEU has_cap('facilities','edit').
-- facility_bookings: Lesen bleibt is_club_member (Plan für alle sichtbar).
--   INSERT ALT (0021:178) = is_club_trainer  -> has_cap('facilities_booking','edit');
--     die 0021-Härtung "Mitglieder dürfen NICHT mehr buchen" bleibt: Default
--     member = read_own (1) < edit (4).
--   UPDATE ALT = is_club_trainer OR is_own_member(booked_by_member_id)
--     -> has_cap(...,'edit') OR (cap_rank >= read_own AND is_own_member(...)).
--     Der Eigen-Zweig bekommt einen Stufen-Gate, der im Default für JEDEN
--     erfüllt ist (read_own) -> heute identisch, künftig abschaltbar.
-- ============================================================================
alter policy facilities_insert on app.facilities
  with check (app.has_cap(club_id, 'facilities', 'edit'));

alter policy facilities_update on app.facilities
  using (app.has_cap(club_id, 'facilities', 'edit'))
  with check (app.has_cap(club_id, 'facilities', 'edit'));

alter policy facility_bookings_insert on app.facility_bookings
  with check (app.has_cap(club_id, 'facilities_booking', 'edit'));

alter policy facility_bookings_update on app.facility_bookings
  using (
    app.has_cap(club_id, 'facilities_booking', 'edit')
    or (
      app.cap_rank(club_id, 'facilities_booking') >= app.level_rank('read_own')
      and app.is_own_member(booked_by_member_id)
    )
  )
  with check (
    app.has_cap(club_id, 'facilities_booking', 'edit')
    or (
      app.cap_rank(club_id, 'facilities_booking') >= app.level_rank('read_own')
      and app.is_own_member(booked_by_member_id)
    )
  );

-- ============================================================================
-- equipment / equipment_reservations — Material.
-- equipment:              ALT is_club_trainer -> has_cap('equipment','edit').
-- equipment_reservations: ALT is_club_trainer OR is_own_member(reserved_by...)
--   -> has_cap('equipment_reservations','edit') OR (cap_rank >= read_own AND own).
--   Default Trainer = manage (5) >= edit (4); alle übrigen read_own (1).
--   Der is_club_member-Vorfilter des INSERT bleibt wortgleich stehen.
-- ============================================================================
alter policy equipment_insert on app.equipment
  with check (app.has_cap(club_id, 'equipment', 'edit'));

alter policy equipment_update on app.equipment
  using (app.has_cap(club_id, 'equipment', 'edit'))
  with check (app.has_cap(club_id, 'equipment', 'edit'));

alter policy equipment_reservations_insert on app.equipment_reservations
  with check (
    app.is_club_member(club_id)
    and (
      app.has_cap(club_id, 'equipment_reservations', 'edit')
      or (
        app.cap_rank(club_id, 'equipment_reservations') >= app.level_rank('read_own')
        and app.is_own_member(reserved_by_member_id)
      )
    )
  );

alter policy equipment_reservations_update on app.equipment_reservations
  using (
    app.has_cap(club_id, 'equipment_reservations', 'edit')
    or (
      app.cap_rank(club_id, 'equipment_reservations') >= app.level_rank('read_own')
      and app.is_own_member(reserved_by_member_id)
    )
  )
  with check (
    app.has_cap(club_id, 'equipment_reservations', 'edit')
    or (
      app.cap_rank(club_id, 'equipment_reservations') >= app.level_rank('read_own')
      and app.is_own_member(reserved_by_member_id)
    )
  );

-- ============================================================================
-- finance — invoices + ledger_entries (der Rest der 11 Finanz-Tabellen folgt
-- in der Finanz-Gruppe; sie hängen alle am selben can_manage_finance).
-- ALT: can_manage_finance(club_id)         = owner/admin/moderator/treasurer
-- NEU: has_cap(club_id,'finance','manage') -> Default 'manage' für genau diese vier.
-- Der Eltern-/Eigen-Zweig can_act_for_member BLEIBT (Eltern sehen die Rechnung
-- ihres Kindes) und bekommt denselben read_own-Gate wie oben: im Default für
-- jede Rolle erfüllt -> heute identisch.
-- ledger_entries: kein UPDATE/DELETE — GoBD-Immutability unverändert.
-- ============================================================================
alter policy invoices_select on app.invoices
  using (
    app.has_cap(club_id, 'finance', 'manage')
    or (
      app.cap_rank(club_id, 'finance') >= app.level_rank('read_own')
      and app.can_act_for_member(member_id)
    )
  );

alter policy invoices_insert on app.invoices
  with check (app.has_cap(club_id, 'finance', 'manage'));

alter policy invoices_update on app.invoices
  using (app.has_cap(club_id, 'finance', 'manage'))
  with check (app.has_cap(club_id, 'finance', 'manage'));

alter policy ledger_entries_select on app.ledger_entries
  using (app.has_cap(club_id, 'finance', 'manage'));

alter policy ledger_entries_insert on app.ledger_entries
  with check (app.has_cap(club_id, 'finance', 'manage'));

commit;
