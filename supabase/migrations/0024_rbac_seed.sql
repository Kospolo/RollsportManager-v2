-- ============================================================================
-- 0024_rbac_seed.sql — Startkonfiguration, Spiegelung, Schutz (Phase 1c).
--
-- Immer noch OHNE Wirkung auf bestehende Policies — hier entsteht nur der
-- DATENBESTAND, den 0025 dann als Autorisierungsquelle nutzt.
--
-- ### Warum das Seeding TRIGGER-getrieben ist (und nicht nur ein Backfill) ###
-- Ein einmaliger INSERT-SELECT im Migrationsschritt würde NUR die zum
-- Migrationszeitpunkt vorhandenen Vereine/Personen erfassen. Danach angelegte
-- Vereine hätten keine Rollen und damit — nach der Umschaltung in 0025 — KEINE
-- Rechte. Das ist kein theoretischer Fall:
--   * supabase/tests/sql/01_fixture_club_b.sql legt Verein B samt Owner Bert
--     ERST NACH allen Migrationen an (Fixture, als Superuser, committed).
--   * 20_privilege_escalation.sql / 90_roles_matrix.sql legen laufend
--     club_members-Zeilen an und ändern Rollen.
-- Ohne die beiden Trigger unten wären sämtliche Verein-B-Tests nach 0025 tot
-- (Bert hätte einen owner-Claim, aber keine member_roles-Zeile).
-- Deshalb: clubs AFTER INSERT -> Rollen+Matrix; club_members AFTER INSERT/
-- UPDATE OF role -> Spiegelung der Primärrolle. Der Backfill am Dateiende holt
-- nur den Bestand nach.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- app.rbac_seed_club — legt die 7 Systemrollen + ihre Startmatrix an.
-- Idempotent (on conflict do nothing): mehrfacher Aufruf ist folgenlos, damit
-- Backfill und Trigger sich nicht in die Quere kommen.
-- SECURITY DEFINER: läuft auch, wenn ein Verein per API/authenticated entsteht.
-- ----------------------------------------------------------------------------
create or replace function app.rbac_seed_club(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. die 7 Systemrollen
  insert into app.roles (club_id, key, name_de, name_en, is_system, protected, sort)
  select p_club_id, r.key, r.name_de, r.name_en, true, (r.key = 'owner'), r.sort
  from app.rbac_system_role_labels() r
  on conflict (club_id, key) do nothing;

  -- 2. die Startmatrix: jede Systemrolle × jede Fähigkeit.
  --    'none'-Stufen werden mitgeschrieben (nicht weggelassen), damit das
  --    Admin-UI eine vollständige Matrix vorfindet und nicht zwischen
  --    "nicht gesetzt" und "bewusst none" raten muss.
  insert into app.role_permissions (club_id, role_id, capability_key, level)
  select p_club_id, ro.id, c.key, app.rbac_default_level(ro.key, c.key)
  from app.roles ro
  cross join app.capabilities c
  where ro.club_id = p_club_id
    and ro.is_system
  on conflict (role_id, capability_key) do nothing;
end;
$$;

comment on function app.rbac_seed_club(uuid) is
  'Legt für einen Verein die 7 Systemrollen + die Start-Rechtematrix an (idempotent). Aufrufer: clubs-Trigger + Backfill.';

create or replace function app.rbac_seed_club_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.rbac_seed_club(new.id);
  return null;
end;
$$;

create trigger clubs_rbac_seed
  after insert on app.clubs
  for each row execute function app.rbac_seed_club_trg();

-- ----------------------------------------------------------------------------
-- Spiegelung club_members.role -> member_roles (die PRIMÄRROLLE).
-- club_members.role bleibt die denormalisierte Anzeige-/Sortier-Rolle und
-- speist weiter den GoTrue-Hook; member_roles ist ab 0025 die Wahrheit.
--
-- Scope bewusst eng: der Trigger verwaltet AUSSCHLIESSLICH die Zuweisung, die
-- der Primärrolle entspricht. Zusätzlich per Admin-UI vergebene Zweitrollen
-- fasst er nicht an — sonst würde ein Rollenwechsel stillschweigend fremde
-- Zuweisungen löschen.
-- ----------------------------------------------------------------------------
create or replace function app.sync_member_primary_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_role_id uuid;
  v_old_role_id uuid;
begin
  select id into v_new_role_id
  from app.roles
  where club_id = new.club_id and key = new.role::text;

  if v_new_role_id is null then
    -- Kann nur passieren, wenn der clubs-Trigger übersprungen wurde.
    -- Fail-closed: lieber der Insert scheitert laut, als dass eine Person
    -- ohne Rollenzuweisung (= ohne Rechte) im System landet.
    raise exception 'RBAC: Systemrolle % fehlt in Verein % — app.rbac_seed_club() nicht gelaufen?',
      new.role, new.club_id;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    select id into v_old_role_id
    from app.roles
    where club_id = old.club_id and key = old.role::text;

    delete from app.member_roles
    where member_id = old.id and role_id = v_old_role_id;
  end if;

  insert into app.member_roles (club_id, member_id, role_id)
  values (new.club_id, new.id, v_new_role_id)
  on conflict (member_id, role_id) do nothing;

  return null;
end;
$$;

comment on function app.sync_member_primary_role() is
  'Spiegelt club_members.role in app.member_roles. Verwaltet NUR die Zuweisung der Primärrolle — Zweitrollen bleiben unberührt.';

create trigger club_members_rbac_sync_insert
  after insert on app.club_members
  for each row execute function app.sync_member_primary_role();

-- Nur bei echtem Rollenwechsel — status/valid_until-Updates (z.B. "pending ->
-- active" durch den Kassenwart) dürfen den Trigger nicht unnötig anfassen.
create trigger club_members_rbac_sync_update
  after update of role on app.club_members
  for each row
  when (new.role is distinct from old.role)
  execute function app.sync_member_primary_role();

-- ----------------------------------------------------------------------------
-- protect_member_roles — die Eskalationssperre für den NEUEN Schreibpfad.
--
-- Ohne sie wäre member_roles das Loch, das protect_club_membership zustopft:
-- wer den Roster verwalten darf (auch der Kassenwart!), könnte sich sonst per
-- INSERT eine owner-Rolle danebenlegen. Die Regeln spiegeln 0007 wörtlich:
--   * niemand vergibt/entzieht sich SELBST eine Rolle
--   * owner-Rollen nur durch owner
--   * Systemrollen nach der can_change_member_role-Rangordnung
--     (Moderator nur unterhalb Moderator; Kassenwart NIE eine Rolle)
--   * eigene (nicht-System-)Rollen: nur is_club_admin
-- Kein GUC-/Flag-Bypass für den Spiegel-Trigger: eine legitime Änderung an
-- club_members.role erfüllt dieselben Regeln ohnehin, und ein per set_config
-- setzbares Flag wäre selbst der Eskalationspfad.
-- auth.uid() is null = Migration/Seed/service_role -> wie protect_club_membership
-- unbeschränkt (die Call-Site autorisiert dort selbst).
-- ----------------------------------------------------------------------------
create or replace function app.protect_member_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row       app.member_roles;
  v_role_key  text;
  v_is_system boolean;
  v_owner_uid uuid;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  v_row := coalesce(new, old);

  select r.key, r.is_system into v_role_key, v_is_system
  from app.roles r where r.id = v_row.role_id;

  -- 1. Selbstvergabe: nie. Gilt für INSERT, UPDATE und DELETE.
  select m.profile_id into v_owner_uid
  from app.club_members m where m.id = v_row.member_id;

  if v_owner_uid = auth.uid() then
    raise exception 'changing your own role assignments is not allowed';
  end if;

  -- 2. owner-Rollen ausschliesslich durch owner. Feuert — wie die
  --    entsprechende Regel in protect_club_membership (0007:200) — für JEDEN,
  --    also P0001 noch vor der RLS.
  if v_role_key = 'owner'
     and not app.has_club_role(v_row.club_id, array['owner']) then
    raise exception 'only owners may grant or revoke owner roles';
  end if;

  -- 3. Systemrollen folgen der Rangordnung aus 0007.
  --    Zwei Feinheiten WÖRTLICH von protect_club_membership (0007:203-207)
  --    übernommen — ohne sie wäre der Trigger strenger als der Bestand:
  --    (a) Vorbedingung can_manage_members: wer den Roster gar nicht verwalten
  --        darf, fällt nicht in diesen Zweig, sondern in die RLS (42501 statt
  --        P0001) — sonst kippten die erwarteten SQLSTATEs.
  --    (b) Ausnahme für die neutrale Rolle 'member' beim INSERT: sie darf JEDER
  --        Mitglieder-Verwalter vergeben (can_change_member_role liefert für
  --        treasurer IMMER false — ohne die Ausnahme könnte der Kassenwart kein
  --        einfaches Mitglied mehr anlegen; 90_roles_matrix.sql:98 fixiert das).
  --        Beim ENTZIEHEN gilt die Ausnahme NICHT: Rollen wegnehmen bleibt
  --        Sache derer, die Rollen ändern dürfen.
  if v_is_system
     and app.can_manage_members(v_row.club_id)
     and not (tg_op = 'INSERT' and v_role_key = 'member')
     and not app.can_change_member_role(v_row.club_id, v_role_key::app.club_member_role) then
    raise exception 'insufficient rights to assign role %', v_role_key;
  end if;

  -- 4. eigene Rollen: nur Vereinsadministration (nicht der Kassenwart).
  --    Gleiche Vorbedingung wie (3): Nicht-Verwalter -> RLS, nicht Trigger.
  if not v_is_system
     and app.can_manage_members(v_row.club_id)
     and not app.is_club_admin(v_row.club_id) then
    raise exception 'assigning custom roles requires club admin rights';
  end if;

  return v_row;
end;
$$;

comment on function app.protect_member_roles() is
  'Eskalationssperre für member_roles (spiegelt protect_club_membership): keine Selbstvergabe, owner nur durch owner, Systemrollen nach can_change_member_role, eigene Rollen nur durch Admins.';

create trigger member_roles_protect
  before insert or update or delete on app.member_roles
  for each row execute function app.protect_member_roles();

-- ----------------------------------------------------------------------------
-- protect_roles / protect_role_permissions — Systemrollen sind Vorlagen, keine
-- Wegwerfware: key/is_system unveränderlich, kein DELETE. Die owner-Rolle ist
-- zusätzlich protected — ihre Stufen dürfen nicht abgesenkt werden (sonst
-- sperrt sich ein Verein selbst aus).
-- ----------------------------------------------------------------------------
create or replace function app.protect_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'system roles cannot be deleted (rename or reconfigure instead)';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.club_id is distinct from old.club_id then
      raise exception 'roles.club_id is immutable';
    end if;
    if old.is_system and new.key is distinct from old.key then
      raise exception 'the key of a system role is immutable (name_de/name_en are free)';
    end if;
    if new.is_system is distinct from old.is_system
       or new.protected is distinct from old.protected then
      raise exception 'is_system/protected cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

create trigger roles_protect
  before update or delete on app.roles
  for each row execute function app.protect_roles();

create or replace function app.protect_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row       app.role_permissions;
  v_protected boolean;
begin
  v_row := coalesce(new, old);

  select r.protected into v_protected
  from app.roles r where r.id = v_row.role_id;

  if v_protected and auth.uid() is not null then
    raise exception 'the owner role is protected — its permissions cannot be changed';
  end if;

  -- Die Stufe muss zu den allowed_levels der Fähigkeit passen; sonst könnte das
  -- UI eine Stufe setzen, die es selbst nie anbietet.
  if tg_op <> 'DELETE'
     and not exists (
       select 1 from app.capabilities c
       where c.key = new.capability_key and new.level = any (c.allowed_levels)
     ) then
    raise exception 'level % is not allowed for capability %', new.level, new.capability_key;
  end if;

  return v_row;
end;
$$;

create trigger role_permissions_protect
  before insert or update or delete on app.role_permissions
  for each row execute function app.protect_role_permissions();

-- ----------------------------------------------------------------------------
-- BACKFILL des Bestands (die Trigger oben decken nur Neuanlagen ab).
-- Läuft als Migration -> auth.uid() is null -> die Schutz-Trigger halten sich
-- heraus, wie bei jedem anderen Seed auch.
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

insert into app.member_roles (club_id, member_id, role_id)
select m.club_id, m.id, r.id
from app.club_members m
join app.roles r on r.club_id = m.club_id and r.key = m.role::text
where m.deleted_at is null
on conflict (member_id, role_id) do nothing;

-- Kontrolle: nach dem Backfill MUSS jedes lebende Mitglied mindestens eine
-- Rolle haben — sonst nimmt 0025 ihm sämtliche Rechte.
do $$
declare
  v_orphans bigint;
begin
  select count(*) into v_orphans
  from app.club_members m
  where m.deleted_at is null
    and not exists (select 1 from app.member_roles mr where mr.member_id = m.id);

  if v_orphans > 0 then
    raise exception 'RBAC-Backfill unvollständig: % Mitglieder ohne Rollenzuweisung', v_orphans;
  end if;
end;
$$;

commit;
