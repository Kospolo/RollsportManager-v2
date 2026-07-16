-- ============================================================================
-- 0025_rbac_resolve.sql — DIE Umschaltung: Auflösung aus der DB (Phase 1d).
--
-- Ab hier liest die Autorisierung NICHT mehr den JWT-Claim 'club_roles',
-- sondern app.member_roles. Wirkung (RBAC-DESIGN §5):
--   * Rechteänderungen greifen SOFORT — ohne Neuanmeldung, ohne Token-Ablauf.
--   * Mehrfachrollen wirken: Rechte = Vereinigung über ALLE Rollen der Person.
-- Es wird KEINE Policy angefasst: has_club_role behält Signatur und Semantik,
-- die ~110 Policies auf 48 Tabellen ziehen automatisch nach.
--
-- ### Bewusste VERSCHÄRFUNG (nie Aufweichung), muss benannt werden: ###
-- Der Mitgliedschafts-Gate (deleted_at is null AND status='active' AND
-- valid_until offen) galt bisher NUR für guest_coach — für alle anderen Rollen
-- gab es GAR KEINEN DB-Abgleich (reines JWT-Vertrauen, 0002:161). Ein
-- soft-gelöschtes oder ausgetretenes Mitglied behielt seine Rechte bis zum
-- Token-Ablauf. Genau das behebt diese Migration: der Gate gilt jetzt für JEDE
-- Rolle. Im Bestand nachweislich folgenlos (alle 10 Test-Personas sind
-- 'active'; die einzige 'pending'-Person im Seed — Greta Lindner, a0..24 — hat
-- profile_id = NULL und kann nie JWT-Subjekt sein).
--
-- UNVERÄNDERT und bewusst NICHT DB-aufgelöst:
--   * app.is_platform_admin() — Plattform-Ebene, kein Vereinsrollen-Konzept.
--   * app.is_club_pro()       — Abo-Gate (orthogonal zu Rechten), bleibt als
--                               eigener UND-Faktor neben has_cap stehen.
--   * has_club_role bekommt WEITERHIN keinen is_platform_admin-Bypass — ein
--     solcher wäre eine Aufweichung (der Plattform-Admin bekäme Schreibrechte,
--     die er heute nicht hat; 90_roles_matrix.sql:148 fixiert das).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Der EINE Mitgliedschafts-Gate, auf den sich alles Weitere stützt.
-- Liefert die Rollen-Keys der aufrufenden Person im Verein — leer, wenn die
-- Mitgliedschaft gelöscht, nicht aktiv oder abgelaufen ist.
-- ----------------------------------------------------------------------------
create or replace function app.member_role_keys(p_club_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(r.key), '{}'::text[])
  from app.member_roles mr
  join app.roles r        on r.id = mr.role_id
  join app.club_members m on m.id = mr.member_id
  where mr.club_id = p_club_id
    and m.profile_id = auth.uid()
    and m.deleted_at is null
    and m.status = 'active'
    and (m.valid_until is null or m.valid_until >= now())
$$;

comment on function app.member_role_keys(uuid) is
  'Alle Rollen-Keys der aufrufenden Person im Verein (DB-Auflösung, kein JWT). Enthält den Mitgliedschafts-Gate: gelöscht/inaktiv/abgelaufen -> leer.';

-- ----------------------------------------------------------------------------
-- has_club_role — DER Dreh- und Angelpunkt. Signatur unverändert.
-- Mehrfachrollen: exists über ALLE Rollen der Person (ODER-Semantik) —
-- identisch zur bisherigen Array-Semantik, wenn die Person genau eine Rolle hat.
-- guest_coach-Befristung: steckt jetzt im Gate und gilt für alle Rollen.
-- ----------------------------------------------------------------------------
create or replace function app.has_club_role(p_club_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from unnest(app.member_role_keys(p_club_id)) as k
    where k = any (p_roles)
  )
$$;

comment on function app.has_club_role(uuid, text[]) is
  'Hält die aufrufende Person eine der genannten Rollen im Verein? Auflösung aus app.member_roles (nicht mehr aus dem JWT) -> Änderungen wirken sofort. Mehrfachrollen = Vereinigung. Kein platform-admin-Bypass.';

-- ----------------------------------------------------------------------------
-- is_club_member — DB-aufgelöst; der platform-admin-Bypass BLEIBT (0007:68,
-- Cross-Club-READ).
-- ----------------------------------------------------------------------------
create or replace function app.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin()
      or array_length(app.member_role_keys(p_club_id), 1) > 0
$$;

comment on function app.is_club_member(uuid) is
  'Ist die aufrufende Person (effektiv) Mitglied? DB-aufgelöst; platform admins behalten den Cross-Club-READ-Bypass.';

-- ----------------------------------------------------------------------------
-- can_change_member_role — Regeln WÖRTLICH aus 0007, nur die Herkunft der
-- eigenen Rolle ändert sich: bei Mehrfachrollen zählt der HÖCHSTE Rang, sonst
-- kippte die Rangordnung (wer zusätzlich 'member' hat, dürfte plötzlich weniger).
-- Rangfolge = Sortierung des Enums app.club_member_role (owner zuerst) -> das
-- Minimum des Enums IST der höchste Rang. Nur Systemrollen haben einen Rang;
-- eigene Rollen bleiben aussen vor (fail-closed).
-- ----------------------------------------------------------------------------
create or replace function app.can_change_member_role(p_club_id uuid, p_target_role app.club_member_role)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select min(r.key::app.club_member_role)::text into v_role
  from app.member_roles mr
  join app.roles r        on r.id = mr.role_id
  join app.club_members m on m.id = mr.member_id
  where mr.club_id = p_club_id
    and r.is_system
    and m.profile_id = auth.uid()
    and m.deleted_at is null
    and m.status = 'active'
    and (m.valid_until is null or m.valid_until >= now());

  if v_role is null then
    return false;
  end if;
  if p_target_role = 'owner' then
    return v_role = 'owner';                       -- only owners grant owner
  end if;
  if v_role in ('owner', 'admin') then
    return true;
  end if;
  if v_role = 'moderator' then
    return p_target_role not in ('admin', 'moderator');  -- owner already handled
  end if;
  return false;                                    -- treasurer & below: no roles
end;
$$;

-- ----------------------------------------------------------------------------
-- jwt_club_role — NICHT gelöscht (GoTrue-Hook-Vertrag/Doku), aber ab sofort
-- ohne Autorisierungs-Aufrufer.
-- ----------------------------------------------------------------------------
comment on function app.jwt_club_role(uuid) is
  'DEPRECATED (0025): nur noch Transport-/Anzeigeinfo aus dem Token. Die Autorisierung löst seit 0025 über app.member_roles auf — NICHT für neue Policies verwenden.';

-- ----------------------------------------------------------------------------
-- Trainer-Teams (RBAC-DESIGN §1.4 / §4).
--
-- ### Abweichung von RBAC-DESIGN §8 — mit Begründung, Freigabe offen: ###
-- Die Spec nimmt an, die Trainer-Zuordnung hänge an "teams.coach*" und müsse
-- nach app.team_coaches migriert werden. Im Schema gibt es keine solche Spalte:
-- app.teams (0003:30-38) hat id/club_id/name/age_group/created_at/updated_at/
-- deleted_at — mehr nicht. app.team_members IST bereits die n:m-Zuordnung
-- (role='coach', unique(team_id, member_id) = exakt der von §4 geforderte
-- UNIQUE), und der Seed belegt den Mehrfach-Fall im Betrieb (Sandra Vogel
-- betreut b0..02 + b0..03; Anna-Lena Böhm b0..01 + b0..02).
-- Anforderung §1.4 ist damit im Schema SCHON erfüllt.
-- Eine zweite Basistabelle wäre eine exakte Teilmenge von team_members und
-- damit eine zweite Wahrheit: team_members_insert und ein team_coaches-Insert
-- laufen auseinander, can_read_routine hängt an der einen, die Admin-UI an der
-- anderen — die Fehlerklasse, die hier schon zweimal Phantom-Bugs erzeugt hat.
-- Deshalb: app.team_coaches als VIEW (erfüllt §4 nach aussen, eine Wahrheit).
-- ----------------------------------------------------------------------------
create or replace function app.coached_team_ids(p_club_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(tm.team_id), '{}'::uuid[])
  from app.team_members tm
  join app.club_members m on m.id = tm.member_id
  where tm.club_id = p_club_id
    and tm.role = 'coach'
    and tm.deleted_at is null
    and m.profile_id = auth.uid()
    and m.deleted_at is null
$$;

comment on function app.coached_team_ids(uuid) is
  'Team-IDs, die die aufrufende Person als Trainer:in betreut (Quelle: app.team_members role=coach). ACHTUNG: prüft NUR deleted_at — der Rollen-/Befristungs-Gate steckt in has_cap/cap_rank, nie hier.';

-- coaches_team bleibt ein dünner Wrapper: Signatur unverändert -> 0021 und die
-- 19 Kür-Tests in 99c_privacy.sql bleiben unberührt.
create or replace function app.coaches_team(p_club_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_team_id is not null
     and p_team_id = any (app.coached_team_ids(p_club_id))
$$;

create or replace view app.team_coaches as
  select tm.id, tm.club_id, tm.team_id, tm.member_id, tm.created_at, tm.updated_at
  from app.team_members tm
  where tm.role = 'coach'
    and tm.deleted_at is null;

comment on view app.team_coaches is
  'RBAC-DESIGN §4 "team_coaches" als Sicht auf app.team_members (role=coach) — EINE Wahrheit statt einer zweiten, driftenden Tabelle. Schreiben: app.team_members mit role=coach.';

-- ----------------------------------------------------------------------------
-- cap_rank / has_cap — die Fähigkeiten-Auflösung (RBAC-DESIGN §5).
--   * Max über ALLE Rollen der Person (Mehrfachrollen = höchste Stufe gewinnt)
--   * protected (owner) schliesst kurz auf 5 — unabhängig von role_permissions
--   * fehlender/„none"-Eintrag -> 0 (coalesce), also fail-closed
--   * derselbe Mitgliedschafts-Gate wie has_club_role -> ein abgelaufener
--     Gastzugang liefert Rang 0 (die guest_coach-Befristung greift damit
--     ZENTRAL, auch für coached_team_ids-Pfade, die selbst nicht prüfen)
--   * KEIN impliziter is_platform_admin-Bypass — has_club_role hat heute keinen;
--     ein Bypass gäbe dem Plattform-Admin Schreibrechte = Aufweichung.
--     is_platform_admin() steht weiterhin explizit dort im Prädikat, wo es
--     heute steht (lockers_select, can_read_routine).
-- ----------------------------------------------------------------------------
create or replace function app.cap_rank(p_club_id uuid, p_capability text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(
           case when r.protected then 5 else app.level_rank(rp.level) end
         ), 0)
  from app.member_roles mr
  join app.roles r        on r.id = mr.role_id
  join app.club_members m on m.id = mr.member_id
  left join app.role_permissions rp
         on rp.role_id = mr.role_id
        and rp.capability_key = p_capability
  where mr.club_id = p_club_id
    and m.profile_id = auth.uid()
    and m.deleted_at is null
    and m.status = 'active'
    and (m.valid_until is null or m.valid_until >= now())
$$;

comment on function app.cap_rank(uuid, text) is
  'Aufgelöster Rang der aufrufenden Person für eine Fähigkeit (0..5): Max über ALLE Rollen; owner-Rolle (protected) = immer 5; nichts gesetzt = 0.';

-- Primärvariante: liest sich in Policies wie ein Satz -> has_cap(club_id,'finance','manage')
create or replace function app.has_cap(p_club_id uuid, p_capability text, p_min_level app.role_level)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.cap_rank(p_club_id, p_capability) >= app.level_rank(p_min_level)
$$;

comment on function app.has_cap(uuid, text, app.role_level) is
  'Erreicht die aufrufende Person mindestens die genannte Stufe für die Fähigkeit? (RBAC-DESIGN §5)';

-- Rang-Variante (RBAC-DESIGN §5 notiert has_cap(club_id, capability, min_rank)).
-- BEWUSST NICHT als has_cap-Überladung: ein Literal wie 'manage' ist für
-- Postgres vom Typ 'unknown', und zwischen has_cap(uuid,text,app.role_level)
-- und has_cap(uuid,text,int) könnte er dann nicht wählen —
-- "function app.has_cap(uuid, unknown, unknown) is not unique". Jede Policy
-- müsste explizit casten. Daher eigener Name statt Überladung.
create or replace function app.has_cap_rank(p_club_id uuid, p_capability text, p_min_rank int)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.cap_rank(p_club_id, p_capability) >= p_min_rank
$$;

comment on function app.has_cap_rank(uuid, text, int) is
  'has_cap mit numerischem Mindestrang (none=0 … manage=5) — für Aufrufer, die den Rang selbst berechnen (API). In Policies gehört die app.role_level-Variante app.has_cap() verwendet.';

commit;
