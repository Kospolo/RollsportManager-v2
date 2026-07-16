-- ============================================================================
-- 0022_rbac_core.sql — RollsportManager v2: konfigurierbares RBAC (Phase 1a).
--
-- Diese Migration legt NUR das Datenmodell an. Sie ändert KEINE einzige
-- bestehende Policy und KEINEN bestehenden Helfer — nach 0022 verhält sich die
-- Datenbank exakt wie vorher (nichts liest die neuen Tabellen).
-- Die Umschaltung der Auflösung passiert in 0024, die Policies in 0025.
--
-- Modell (blueprint/RBAC-DESIGN.md §4):
--   app.capabilities     — statischer Fähigkeiten-Katalog (bilingual DE/EN)
--   app.roles            — je Verein 7 Systemrollen + frei anlegbare Rollen
--   app.role_permissions — Rolle × Fähigkeit → Stufe
--   app.member_roles     — Person × Rolle (MEHRERE Rollen pro Person)
--
-- Stufen-Skala (§2), eine geordnete Rangfolge je Fähigkeit:
--   none=0 · read_own=1 · read_team=2 · read_all=3 · edit=4 · manage=5
--
-- club_members.role bleibt unangetastet als denormalisierte PRIMÄRROLLE
-- (Anzeige/Sortierung/GoTrue-Hook). Die Autorisierung wandert in 0024 auf
-- member_roles; die Primärrolle wird per Trigger (0023) dorthin gespiegelt.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Stufen-Enum + Rangfunktion. Enum (nicht text), damit die Datenbank selbst
-- verhindert, dass jemals eine unbekannte Stufe in role_permissions landet.
-- ----------------------------------------------------------------------------
create type app.role_level as enum
  ('none', 'read_own', 'read_team', 'read_all', 'edit', 'manage');

comment on type app.role_level is
  'Rechte-Stufe je Fähigkeit (RBAC-DESIGN §2). Geordnete Skala: none < read_own < read_team < read_all < edit < manage.';

-- Rang als int — die EINE Stelle, die die Skala numerisch kodiert.
-- IMMUTABLE: reine Wertabbildung, damit sie in Indizes/Ausdrücken nutzbar ist.
create or replace function app.level_rank(p_level app.role_level)
returns int
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_level
    when 'none'      then 0
    when 'read_own'  then 1
    when 'read_team' then 2
    when 'read_all'  then 3
    when 'edit'      then 4
    when 'manage'    then 5
  end
$$;

comment on function app.level_rank(app.role_level) is
  'Numerischer Rang einer Stufe (none=0 … manage=5). Basis für cap_rank/has_cap.';

-- ----------------------------------------------------------------------------
-- capabilities — der statische Katalog. Kein club_id: der Katalog ist global,
-- konfigurierbar sind die STUFEN (role_permissions), nicht die Fähigkeiten.
-- allowed_levels = die im UI wählbare Teilmenge (RBAC-DESIGN §3 "Optionen").
-- ----------------------------------------------------------------------------
create table app.capabilities (
  key            text primary key,
  label_de       text not null,
  label_en       text not null,
  allowed_levels app.role_level[] not null,
  sort           int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint capabilities_key_format check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint capabilities_levels_not_empty check (array_length(allowed_levels, 1) >= 2),
  -- 'none' muss immer wählbar sein, sonst ist "Recht entziehen" nicht abbildbar
  constraint capabilities_levels_have_none check ('none' = any (allowed_levels))
);

create trigger capabilities_set_updated_at
  before update on app.capabilities
  for each row execute function app.set_updated_at();

comment on table app.capabilities is
  'Fähigkeiten-Katalog (RBAC-DESIGN §3). Global + statisch geseedet; allowed_levels = die im Admin-UI wählbaren Stufen.';

-- ----------------------------------------------------------------------------
-- roles — je Verein. Die 7 Systemrollen (key = app.club_member_role) werden
-- pro Verein per Trigger angelegt (0023), dazu beliebig viele eigene Rollen.
--   is_system  = Vorlage-Rolle, key nicht umbenennbar/löschbar (0023-Trigger)
--   protected  = owner: immer 'manage' überall, Stufen nicht absenkbar
-- ----------------------------------------------------------------------------
create table app.roles (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  key        text not null,
  name_de    text not null,
  name_en    text not null,
  is_system  boolean not null default false,
  protected  boolean not null default false,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_club_key_uq unique (club_id, key),
  constraint roles_key_format check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  -- geschützte Rollen sind immer Systemrollen (owner) — nie eine Eigenkreation
  constraint roles_protected_is_system check (not protected or is_system)
);

create index roles_club_idx on app.roles (club_id);

create trigger roles_set_updated_at
  before update on app.roles
  for each row execute function app.set_updated_at();

comment on table app.roles is
  'Rollen je Verein (RBAC-DESIGN §4): 7 Systemrollen (key = app.club_member_role) + frei anlegbare. owner ist protected.';
comment on column app.roles.key is
  'Stabiler Schlüssel. Bei Systemrollen identisch zum app.club_member_role-Enumwert — darüber läuft die Spiegelung der Primärrolle.';

-- ----------------------------------------------------------------------------
-- role_permissions — Rolle × Fähigkeit → Stufe.
-- club_id ist denormalisiert (aus roles), damit RLS + cap_rank ohne zusätzlichen
-- Join auf roles filtern können. Die FK-Kombination erzwingt Konsistenz.
-- ----------------------------------------------------------------------------
create table app.role_permissions (
  id             uuid primary key default app.uuid_v7(),
  club_id        uuid not null references app.clubs (id) on delete restrict,
  role_id        uuid not null references app.roles (id) on delete cascade,
  capability_key text not null references app.capabilities (key) on delete restrict,
  level          app.role_level not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint role_permissions_role_cap_uq unique (role_id, capability_key)
);

create index role_permissions_lookup_idx
  on app.role_permissions (role_id, capability_key);
create index role_permissions_club_idx on app.role_permissions (club_id);

create trigger role_permissions_set_updated_at
  before update on app.role_permissions
  for each row execute function app.set_updated_at();

comment on table app.role_permissions is
  'Rechte-Matrix je Verein: Rolle × Fähigkeit → Stufe. Fehlender Eintrag = "none" (cap_rank liefert 0).';

-- ----------------------------------------------------------------------------
-- member_roles — Person × Rolle. DAS Kernstück für Mehrfachrollen (§1.3).
-- Rechte = Vereinigung über ALLE Zeilen einer Person (höchste Stufe gewinnt).
-- ----------------------------------------------------------------------------
create table app.member_roles (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  member_id  uuid not null references app.club_members (id) on delete cascade,
  role_id    uuid not null references app.roles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_roles_member_role_uq unique (member_id, role_id)
);

-- Der Index, den cap_rank/has_club_role bei JEDER Policy-Auswertung trifft.
create index member_roles_club_member_idx on app.member_roles (club_id, member_id);
create index member_roles_role_idx        on app.member_roles (role_id);

create trigger member_roles_set_updated_at
  before update on app.member_roles
  for each row execute function app.set_updated_at();

comment on table app.member_roles is
  'Rollenzuweisungen (RBAC-DESIGN §4): MEHRERE Rollen pro Person. Rechte = Vereinigung (höchster Rang je Fähigkeit gewinnt).';

-- ----------------------------------------------------------------------------
-- Konsistenz-Trigger: role_permissions.club_id und member_roles.club_id müssen
-- zum club_id der referenzierten Rolle passen — sonst könnte eine Rolle aus
-- Verein A einer Person in Verein B zugewiesen werden (Mandantenbruch).
-- Postgres kennt keine FK auf (club_id, id) ohne zusätzlichen Unique-Index —
-- den legen wir an und nutzen zusammengesetzte FKs statt eines Triggers:
-- deklarativ, nicht umgehbar, kein Trigger-Overhead.
-- ----------------------------------------------------------------------------
create unique index roles_id_club_uq on app.roles (id, club_id);
create unique index club_members_id_club_uq on app.club_members (id, club_id);

alter table app.role_permissions
  add constraint role_permissions_role_club_fk
  foreign key (role_id, club_id) references app.roles (id, club_id) on delete cascade;

alter table app.member_roles
  add constraint member_roles_role_club_fk
  foreign key (role_id, club_id) references app.roles (id, club_id);

alter table app.member_roles
  add constraint member_roles_member_club_fk
  foreign key (member_id, club_id) references app.club_members (id, club_id) on delete cascade;

-- ----------------------------------------------------------------------------
-- RLS. Lesen = jedes Vereinsmitglied (das Admin-UI und /me/capabilities müssen
-- die Matrix lesen können). Schreiben = is_club_admin (owner/admin/moderator) —
-- in 0025 wird daraus has_cap('roles','manage'), was heute dieselbe Menge ist.
-- capabilities ist ein globaler Katalog: für alle Authenticated lesbar,
-- schreibbar NUR per service_role/Migration (keine INSERT/UPDATE-Policy).
-- ----------------------------------------------------------------------------
alter table app.capabilities     enable row level security;
alter table app.roles            enable row level security;
alter table app.role_permissions enable row level security;
alter table app.member_roles     enable row level security;

create policy capabilities_select on app.capabilities
  for select to authenticated
  using (true);

create policy roles_select on app.roles
  for select to authenticated
  using (app.is_club_member(club_id));

create policy roles_insert on app.roles
  for insert to authenticated
  with check (app.is_club_admin(club_id));

create policy roles_update on app.roles
  for update to authenticated
  using (app.is_club_admin(club_id))
  with check (app.is_club_admin(club_id));

create policy roles_delete on app.roles
  for delete to authenticated
  using (app.is_club_admin(club_id));

create policy role_permissions_select on app.role_permissions
  for select to authenticated
  using (app.is_club_member(club_id));

create policy role_permissions_insert on app.role_permissions
  for insert to authenticated
  with check (app.is_club_admin(club_id));

create policy role_permissions_update on app.role_permissions
  for update to authenticated
  using (app.is_club_admin(club_id))
  with check (app.is_club_admin(club_id));

create policy role_permissions_delete on app.role_permissions
  for delete to authenticated
  using (app.is_club_admin(club_id));

create policy member_roles_select on app.member_roles
  for select to authenticated
  using (app.is_club_member(club_id));

-- Schreiben auf member_roles ist der NEUE Eskalationspfad (die alte Hürde
-- protect_club_membership schützt nur club_members.role). Die Policy lässt nur
-- Mitglieder-Verwalter überhaupt heran; die Rangregeln (owner nur durch owner,
-- keine Selbstvergabe, Moderator-Schranke) erzwingt der Trigger in 0023.
create policy member_roles_insert on app.member_roles
  for insert to authenticated
  with check (app.can_manage_members(club_id));

create policy member_roles_update on app.member_roles
  for update to authenticated
  using (app.can_manage_members(club_id))
  with check (app.can_manage_members(club_id));

create policy member_roles_delete on app.member_roles
  for delete to authenticated
  using (app.can_manage_members(club_id));

commit;
