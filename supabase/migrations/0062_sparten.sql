-- ============================================================================
-- 0062_sparten.sql — Die SPARTEN-Ebene: Verein -> Sparten -> Teams -> Mitglieder.
--
-- ############################################################################
-- ### FACHLICHER RAHMEN — BITTE ZUERST LESEN #################################
-- ############################################################################
-- Mehrsparten-Vereine (Bsp. REV Heilbronn: Eiskunstlauf, Rollkunstlauf,
-- Hockey) brauchen die Ebene SPARTE zwischen Verein und Team. Modell:
--
--     Verein (app.clubs)
--        └── Sparten (app.sparten)              -- NEU (diese Migration)
--              ├── Teams (app.teams.sparte_id)  -- NEU: 1 Team = 1 Sparte
--              └── Mitglieder (app.sparte_members) -- NEU: n:m, ein Mitglied
--                                                     kann in MEHREREN Sparten
--                                                     sein.
--
-- ABGRENZUNG (bewusst NICHT angefasst):
--   * app.departments (0017, "Abteilungen": Leistungssport/Breitensport/
--     Vorstand) ist nur eine Mitglieder-GRUPPIERUNG, KEINE Sparte. Bleibt
--     unveraendert (wird spaeter im UI zu "Gruppen").
--   * app.clubs.discipline (EIN Freitext-Sportfeld pro Verein) bleibt in
--     dieser Migration ERHALTEN (Abwaertskompat). Es wird nur als Quelle des
--     Backfills gelesen, NICHT geloescht. Ein spaeterer Migrationsschritt kann
--     es entfernen, sobald kein Code es mehr liest.
--
-- ############################################################################
-- ### SCHREIB-GUARD — CHEF-ENTSCHEIDUNG WOERTLICH ############################
-- ############################################################################
-- "Sparten anlegen/aendern/loeschen darf nur Super-Admin, Admin, Kassenwart
--  und Vorstand, sonst keiner."  Zuordnung auf das echte Rollen-Modell:
--     Super-Admin = app.is_platform_admin()   (Plattform-Ebene, JWT-Claim)
--     Vorstand    = club-Rolle 'owner'
--     Admin       = club-Rolle 'admin'
--     Kassenwart  = club-Rolle 'treasurer'
--
-- => NEUER, DEDIZIERTER Helfer app.can_manage_sparten(club) =
--        is_platform_admin() OR has_club_role(club, {owner, admin, treasurer}).
--
-- ⚠️ BEWUSST OHNE 'moderator'. Der Moderator ist die Kueren-Moderation (0007),
--    NICHT der Vorstand; der Chef nannte ihn NICHT. Deshalb werden die
--    bestehenden Helfer app.is_club_admin (owner/admin/moderator) und
--    app.can_manage_finance (owner/admin/moderator/treasurer) hier NICHT
--    wiederverwendet — sie schliessen moderator ein. can_manage_sparten ist
--    absichtlich enger. (Belegt in 99k_sparten.sql: moderator = FALSE.)
--
-- SELECT der Sparten dagegen: alle effektiven Vereinsmitglieder
-- (app.is_club_member, tenant-scoped; Plattform-Admin cross-club READ).
--
-- ############################################################################
-- ### DURCHSETZUNG — Defense in Depth an der DB-Grenze #######################
-- ############################################################################
--   * app.sparten / app.sparte_members: RLS mit den Standard-Policies
--     (SELECT = is_club_member, INSERT/UPDATE = can_manage_sparten). Kein
--     DELETE-Policy -> Hard-Delete default-deny; Loeschen = soft-delete via
--     UPDATE (deleted_at), genau wie teams/departments/lockers.
--   * Team->Sparte-Zuordnung (app.teams.sparte_id): die bestehende
--     teams_update-Policy ist WEITER (owner/admin/moderator/coach duerfen Teams
--     pflegen). Die Zuordnung zu einer Sparte ist aber enger (can_manage_
--     sparten). Deshalb ein BEFORE-Trigger app.protect_team_sparte() (Muster
--     wie app.protect_locker 0017 / app.protect_club_membership 0007): er
--     laesst Team-Pflege durch, blockt aber das Setzen/Aendern/Entfernen von
--     sparte_id, wenn NICHT can_manage_sparten — und erzwingt zusaetzlich die
--     Integritaet "Team und Sparte gehoeren zum selben Verein".
--
-- Wie 0007/0017: die Autorisierungszweige der Trigger laufen nur, wenn
-- auth.uid() IS NOT NULL. Im Migrations-/Seed-/Service-Kontext (kein JWT)
-- werden sie uebersprungen, damit Backfill und Seed als Eigentuemer schreiben
-- koennen.
--
-- ⚠️ RETURNING-FALLE (Repo-Muster): INSERT/UPDATE mit RETURNING auf Tabellen
--    mit restriktiver SELECT-Policy -> 42501. Backfill und Seed schreiben
--    daher OHNE RETURNING (uuid_v7() vorab, dann separat lesen, falls noetig).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. app.sparten — die neue Ebene. Soft-delete-konform (deleted_at) wie der
--    Rest. Name je Verein eindeutig (case-insensitiv, ohne soft-deletes).
-- ----------------------------------------------------------------------------
create table app.sparten (
  id              uuid primary key default app.uuid_v7(),
  club_id         uuid not null references app.clubs (id) on delete restrict,
  name            text not null,
  icon            text,                              -- Icon-Name/Emoji (optional)
  farbe           text,                              -- Hex '#RRGGBB' (optional)
  aktiv           boolean not null default true,
  sortierung      integer not null default 0,
  eigene_finanzen boolean not null default false,    -- aus = Vereinskasse
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint sparten_name_len
    check (char_length(btrim(name)) between 1 and 80),
  constraint sparten_icon_len
    check (icon is null or char_length(icon) <= 40),
  constraint sparten_farbe_format
    check (farbe is null or farbe ~ '^#[0-9A-Fa-f]{6}$')
);

-- Name je Verein eindeutig (case-insensitiv), soft-deletes ausgenommen ->
-- eine geloeschte Sparte blockiert den Namen nicht.
create unique index sparten_club_name_uq
  on app.sparten (club_id, lower(name))
  where deleted_at is null;

-- Listenreihenfolge im Portal: Sortierung, dann Name.
create index sparten_club_sort_idx on app.sparten (club_id, sortierung, name);

comment on table app.sparten is
  'Sparte eines Vereins (Verein -> Sparten -> Teams -> Mitglieder). Trennt Mehrsparten-Vereine (z.B. Eiskunstlauf/Rollkunstlauf/Hockey). NICHT zu verwechseln mit app.departments (Mitglieder-Gruppierung "Abteilungen"). Schreiben = app.can_manage_sparten (owner/admin/treasurer/Plattform-Admin, OHNE moderator); Lesen = is_club_member.';
comment on column app.sparten.eigene_finanzen is
  'true = die Sparte fuehrt eine eigene Kasse; false (Default) = Vereinskasse.';
comment on column app.sparten.aktiv is
  'Aktiv-Flag (Anzeige/Zuordnung). Soft-delete (deleted_at) ist das endgueltige Entfernen; aktiv=false blendet nur aus.';

create trigger sparten_set_updated_at
  before update on app.sparten
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. app.sparte_members — n:m Mitglied <-> Sparte. Ein Mitglied kann in
--    MEHREREN Sparten sein. Paar eindeutig (inkl. soft-deletes -> Wieder-
--    Zuordnen belebt die Zeile, Muster wie department_members 0017). Kein
--    updated_at: Zeilen werden nur angelegt und soft-geloescht, nie mutiert.
-- ----------------------------------------------------------------------------
create table app.sparte_members (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  sparte_id  uuid not null references app.sparten (id) on delete cascade,
  member_id  uuid not null references app.club_members (id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sparte_members_uq unique (sparte_id, member_id)
);

create index sparte_members_club_idx   on app.sparte_members (club_id);
create index sparte_members_member_idx on app.sparte_members (member_id);
create index sparte_members_sparte_idx on app.sparte_members (sparte_id);

comment on table app.sparte_members is
  'n:m Mitglied <-> Sparte. Ein Mitglied kann in mehreren Sparten sein; Paar (sparte_id, member_id) eindeutig. Schreiben = app.can_manage_sparten; Lesen = is_club_member. Soft-delete via deleted_at.';

-- ----------------------------------------------------------------------------
-- 3. app.teams.sparte_id — ein Team gehoert zu GENAU EINER Sparte (nullable,
--    solange nicht zugeordnet). ON DELETE SET NULL, weil ein Team eigene
--    Mitglieder/Termine/Kueren traegt: das Loeschen einer Sparte darf NIEMALS
--    Teams mitreissen — das Team wird nur "sparten-los" und kann neu
--    zugeordnet werden. (Hard-Delete einer Sparte ist per RLS ohnehin
--    default-deny; SET NULL greift nur, falls service_role hart loescht.)
--    Die "gleicher-Verein"-Integritaet sichert der Trigger unten (ON DELETE
--    SET NULL vertraegt sich nicht mit einem zusammengesetzten FK, weil dieser
--    das NOT-NULL club_id mit-nullen wuerde).
-- ----------------------------------------------------------------------------
alter table app.teams
  add column sparte_id uuid references app.sparten (id) on delete set null;

create index teams_sparte_idx on app.teams (sparte_id);

comment on column app.teams.sparte_id is
  'Sparte des Teams (1 Team = 1 Sparte; NULL = noch nicht zugeordnet). Setzen/Aendern/Entfernen nur app.can_manage_sparten (Trigger app.protect_team_sparte). ON DELETE SET NULL: Sparte weg -> Team bleibt bestehen, wird sparten-los.';

-- ----------------------------------------------------------------------------
-- 4. app.can_manage_sparten — der DEDIZIERTE Schreib-Guard (siehe Rahmen).
--    is_platform_admin() OR club-Rolle in {owner, admin, treasurer}.
--    OHNE moderator — deshalb NICHT is_club_admin/can_manage_finance.
--    security definer + search_path='' wie alle Capability-Helfer (0007).
-- ----------------------------------------------------------------------------
create or replace function app.can_manage_sparten(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin()
      or app.has_club_role(p_club_id, array['owner', 'admin', 'treasurer'])
$$;

comment on function app.can_manage_sparten(uuid) is
  'Schreib-Guard fuer Sparten (Chef-Entscheidung): TRUE fuer Plattform-Admin ODER club-Rolle owner/admin/treasurer. BEWUSST OHNE moderator (Kueren-Moderation, nicht Vorstand). Deshalb NICHT is_club_admin/can_manage_finance wiederverwendbar.';

-- ----------------------------------------------------------------------------
-- 5. app.protect_team_sparte — Team-Pflege bleibt weit (teams_update-Policy),
--    aber die SPARTEN-ZUORDNUNG ist eng: setzen/aendern/entfernen nur
--    can_manage_sparten. Zusaetzlich Integritaet: Team und Sparte im selben
--    Verein, Sparte existiert und ist nicht soft-geloescht.
-- ----------------------------------------------------------------------------
create or replace function app.protect_team_sparte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sparte_club uuid;
  v_deleted     timestamptz;
begin
  -- Zuordnung unveraendert -> nichts zu tun (Team-Umbenennung, age_group ...).
  if tg_op = 'UPDATE' and new.sparte_id is not distinct from old.sparte_id then
    return new;
  end if;
  -- Team OHNE Sparte anlegen ist normale Team-Pflege (coach darf Teams anlegen).
  if tg_op = 'INSERT' and new.sparte_id is null then
    return new;
  end if;

  -- Ab hier wird die Zuordnung gesetzt, geaendert oder entfernt.

  -- Integritaet nur, wenn eine Sparte gesetzt wird.
  if new.sparte_id is not null then
    select s.club_id, s.deleted_at
      into v_sparte_club, v_deleted
      from app.sparten s
     where s.id = new.sparte_id;

    if v_sparte_club is null or v_deleted is not null then
      raise exception 'Sparte % existiert nicht oder ist geloescht', new.sparte_id
        using errcode = '23503';
    end if;
    if v_sparte_club is distinct from new.club_id then
      raise exception 'Team und Sparte gehoeren zu verschiedenen Vereinen'
        using errcode = '23514',
              hint = 'Ein Team darf nur einer Sparte des EIGENEN Vereins zugeordnet werden.';
    end if;
  end if;

  -- Autorisierung fuer JEDE Aenderung der Zuordnung (setzen/aendern/entfernen).
  -- Im Server-/Migrations-/Seed-Kontext (kein JWT) uebersprungen (wie 0007/0017).
  if auth.uid() is not null and not app.can_manage_sparten(new.club_id) then
    raise exception
      'Nur Vorstand/Admin/Kassenwart/Super-Admin duerfen Teams einer Sparte zuordnen'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function app.protect_team_sparte() is
  'Team-Pflege bleibt weit (teams_update-Policy owner/admin/moderator/coach), aber Setzen/Aendern/Entfernen von teams.sparte_id nur app.can_manage_sparten (OHNE moderator). Zusaetzlich: Team+Sparte im selben Verein, Sparte existent und nicht soft-geloescht. Autorisierung nur bei auth.uid() IS NOT NULL (Muster protect_locker/protect_club_membership).';

drop trigger if exists protect_team_sparte on app.teams;
create trigger protect_team_sparte
  before insert or update on app.teams
  for each row execute function app.protect_team_sparte();

-- ----------------------------------------------------------------------------
-- 6. RLS — sparten + sparte_members. Standard-Bauform (0003/0017):
--    SELECT = is_club_member (alle effektiven Vereinsmitglieder, tenant-scoped,
--    Plattform-Admin cross-club READ). INSERT/UPDATE = can_manage_sparten.
--    Kein DELETE-Policy -> Hard-Delete default-deny; Loeschen = soft-delete.
-- ----------------------------------------------------------------------------
alter table app.sparten        enable row level security;
alter table app.sparte_members enable row level security;

-- sparten
create policy sparten_select on app.sparten
  for select to authenticated
  using (app.is_club_member(club_id));

create policy sparten_insert on app.sparten
  for insert to authenticated
  with check (app.can_manage_sparten(club_id));

create policy sparten_update on app.sparten
  for update to authenticated
  using (app.can_manage_sparten(club_id))
  with check (app.can_manage_sparten(club_id));

-- sparte_members
create policy sparte_members_select on app.sparte_members
  for select to authenticated
  using (app.is_club_member(club_id));

create policy sparte_members_insert on app.sparte_members
  for insert to authenticated
  with check (app.can_manage_sparten(club_id));

create policy sparte_members_update on app.sparte_members
  for update to authenticated
  using (app.can_manage_sparten(club_id))
  with check (app.can_manage_sparten(club_id));

-- ----------------------------------------------------------------------------
-- 7. BACKFILL — jeder BESTEHENDE Verein bekommt eine erste Sparte aus dem
--    discipline-Freitext, damit kein Verein ohne Sparte dasteht. Idempotent
--    (WHERE NOT EXISTS): nur Vereine ohne aktive Sparte. OHNE RETURNING.
--
--    HINWEIS zum Test-Harness: Migrationen laufen VOR dem Seed. In der frischen
--    Testdatenbank existiert hier noch KEIN Verein -> dieser Backfill trifft 0
--    Zeilen (kein Fehler). Der Seed (seed.sql) legt die Sparte fuer RSV
--    Neckarsulm selbst an. In der PRODUKTION mit bestehenden Vereinen legt
--    dieser Block je Verein genau eine Sparte an (Beweis in der Verifikation:
--    Legacy-Verein anlegen -> denselben Block erneut fahren -> 1 Sparte).
-- ----------------------------------------------------------------------------
insert into app.sparten (id, club_id, name, icon, farbe, aktiv, sortierung, eigene_finanzen)
select app.uuid_v7(),
       c.id,
       coalesce(nullif(btrim(c.discipline), ''), 'Allgemein'),
       null,
       null,
       true,
       0,
       false
from app.clubs c
where c.deleted_at is null
  and not exists (
    select 1 from app.sparten s
    where s.club_id = c.id and s.deleted_at is null
  );

-- ----------------------------------------------------------------------------
-- 8. Nachrechnung (Repo-Muster): jeder nicht-geloeschte Verein, der zum
--    Migrationszeitpunkt existierte, hat jetzt >= 1 aktive Sparte. In der
--    frischen Testdatenbank ist die Vereinsmenge leer -> trivially true.
-- ----------------------------------------------------------------------------
do $$
declare
  v_ohne int;
begin
  select count(*) into v_ohne
  from app.clubs c
  where c.deleted_at is null
    and not exists (
      select 1 from app.sparten s
      where s.club_id = c.id and s.deleted_at is null
    );
  if v_ohne <> 0 then
    raise exception 'Sparten-Backfill: % Verein(e) ohne Sparte geblieben', v_ohne;
  end if;
end $$;

-- Der Stolperdraht aus 0030 — ans Ende JEDER Migration.
select app.assert_no_insecure_views();

commit;
