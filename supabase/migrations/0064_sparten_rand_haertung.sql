-- ============================================================================
-- 0064_sparten_rand_haertung.sql — schliesst die ZWEI verbliebenen Luecken am
-- autoritativen DB-Rand der Sparten-Ebene (0062 + 0063). Beide sind ueber die
-- aktuelle API NICHT erreichbar, aber die DB ist bei self-hosted Supabase die
-- alleinige Autorisierungs-/Integritaetsgrenze — deshalb hier geschlossen.
--
-- ############################################################################
-- ### LUECKE 1 — app.sparte_members ohne gleicher-Verein-Waechter ############
-- ############################################################################
-- app.sparte_members (0062) haelt club_id, sparte_id und member_id, aber KEIN
-- DB-Waechter erzwingt, dass member_id UND sparte_id zum club_id der Zuordnung
-- gehoeren. Ein club-owner konnte per direktem SQL ein Mitglied eines FREMDEN
-- Vereins in seine eigene Sparte eintragen (RLS with_check prueft nur
-- can_manage_sparten(club_id) des eigenen Vereins; der FK auf club_members
-- garantiert nur Existenz, nicht Vereinszugehoerigkeit) -> ROWS=1.
-- Kein Fremd-Read/Write entsteht (club_members-RLS verbirgt die Person, die API
-- blockt mit 400), aber die DB-Grenze fehlt. Das Team-Pendant
-- app.protect_team_sparte (0063, Zweig 1) blockt den analogen Fall schon.
--
-- FIX 1: BEFORE INSERT/UPDATE-Trigger app.protect_sparte_member (Muster wie
-- app.protect_team_sparte / app.protect_club_membership). Erzwingt die
-- Integritaet "Mitglied UND Sparte gehoeren zum club_id der Zuordnung".
-- Verstoss = 23514 (check_violation) wie beim Team-Pendant; nicht existente
-- Referenz = 23503 (der FK faengt das schon ab, der Zweig ist defensiv/analog).
--
-- Die Integritaet laeuft UNCONDITIONAL (nicht an auth.uid() gebunden) — genau
-- wie die gleicher-Verein-Pruefung in protect_team_sparte (Zweig 1) und die
-- club_id-Immutabilitaet in protect_club_membership: ein Daten-Invariant, das
-- IMMER gilt. Der Seed/die Migration schreiben KONSISTENTE Zeilen (jedes RSV-
-- Mitglied in eine RSV-Sparte) und passieren daher (auth.uid() IS NULL) ohne
-- Block. Es gibt hier KEINE Autorisierungspruefung im Trigger — die macht die
-- RLS-Policy sparte_members_insert/update (can_manage_sparten); der Trigger
-- ergaenzt NUR die kreuz-Tabellen-Integritaet, die RLS/FK nicht ausdruecken.
--
-- Soft-Delete/Revive bleibt heil: die API belebt eine Zeile per
--   insert ... on conflict (sparte_id, member_id) do update set deleted_at=null
-- Dieses UPDATE aendert nur deleted_at; club_id/sparte_id/member_id bleiben
-- gleich -> der Trigger ueberspringt die Pruefung (Fruehausstieg unten).
--
-- ############################################################################
-- ### LUECKE 2 — teams.club_id/created_at ueber den can_manage_sparten-Pfad ##
-- ############################################################################
-- 0063 hat teams_update um `OR can_manage_sparten(club_id)` geweitet, damit der
-- Kassenwart/Plattform-Admin (OHNE Teams-Rolle) teams.sparte_id setzen kann.
-- app.protect_team_sparte, Zweig 2, schuetzt die Team-Stammdaten aber nur per
-- POSITIVLISTE (name/age_group/deleted_at). NICHT in der Liste: created_at und
-- v.a. club_id. Ein reiner can_manage_sparten-Akteur konnte also club_id oder
-- created_at eines Teams aendern. Schlimmer: ein club_id-Wechsel loest Zweig 1
-- (nur bei sparte_id-Aenderung) NICHT aus und umgeht damit die "Team+Sparte
-- selber Verein"-Integritaet — ein Team koennte club_id-seitig aus seinem
-- Verein herausgezogen werden, waehrend die alte sparte_id bestehen bleibt.
--
-- FIX 2 (bewusst gewaehlter, saubester Weg): teams.club_id UND teams.created_at
-- werden UNVERAENDERLICH gemacht — exakt nach dem Vorbild
-- app.protect_club_membership ("club_members.club_id is immutable"). Das ist
-- besser als Zweig 2 auf eine Denylist umzustellen, weil:
--   (a) es AKTEURUNABHAENGIG gilt (auch owner/admin, auch direktes service-SQL
--       im impersonierten Kontext) — ein Team wechselt schlicht NIE den Verein
--       oder sein Anlagedatum; das ist ein Daten-Invariant, keine Rollenfrage;
--   (b) es die Zweig-1-Umgehung (club_id-Wechsel ohne sparte_id-Aenderung)
--       an der Wurzel schliesst, nicht nur fuer can_manage_sparten-Akteure;
--   (c) es die bestehende Team-Pflege fuer owner/admin/moderator/coach in
--       KEINER Weise beruehrt — die aendern name/age_group/sparte_id/deleted_at
--       wie bisher, nur eben nie club_id/created_at (was sie ohnehin nie tun).
-- Verstoss = 23514 (check_violation): ein Integritaets-/Immutabilitaets-Bruch.
--
-- Der Immutabilitaets-Block steht GANZ VORN in protect_team_sparte und gilt
-- unconditional (kein auth.uid()-Gate) — Migration/Seed aendern club_id/
-- created_at bestehender Teams nie, werden also nicht blockiert. Zweig 1/2 aus
-- 0063 bleiben WOERTLICH erhalten.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- FIX 1 — app.protect_sparte_member: gleicher-Verein-Integritaet fuer
-- app.sparte_members. security definer + search_path='' (wie alle Guards), so
-- liest der Trigger app.club_members/app.sparten an der RLS vorbei und sieht die
-- WAHRE Vereinszugehoerigkeit auch eines fremden Mitglieds (das dem Angreifer
-- selbst per RLS verborgen bleibt) — genau das macht den Block ueberhaupt
-- moeglich.
-- ----------------------------------------------------------------------------
create or replace function app.protect_sparte_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_club uuid;
  v_sparte_club uuid;
begin
  -- Revive/Soft-Delete (on conflict do update set deleted_at=...) aendert nur
  -- deleted_at -> die vereinsbindenden Spalten sind unveraendert, nichts zu tun.
  if tg_op = 'UPDATE'
     and new.club_id   is not distinct from old.club_id
     and new.sparte_id is not distinct from old.sparte_id
     and new.member_id is not distinct from old.member_id then
    return new;
  end if;

  -- (1) Das zugeordnete Mitglied gehoert zum club_id der Zuordnung.
  select cm.club_id into v_member_club
    from app.club_members cm
   where cm.id = new.member_id;

  if v_member_club is null then
    raise exception 'Mitglied % existiert nicht', new.member_id
      using errcode = '23503';
  end if;
  if v_member_club is distinct from new.club_id then
    raise exception 'Mitglied und Sparten-Zuordnung gehoeren zu verschiedenen Vereinen'
      using errcode = '23514',
            hint = 'Ein Mitglied darf nur einer Sparte des EIGENEN Vereins zugeordnet werden.';
  end if;

  -- (2) Die Sparte gehoert zum selben club_id.
  select s.club_id into v_sparte_club
    from app.sparten s
   where s.id = new.sparte_id;

  if v_sparte_club is null then
    raise exception 'Sparte % existiert nicht', new.sparte_id
      using errcode = '23503';
  end if;
  if v_sparte_club is distinct from new.club_id then
    raise exception 'Sparte und Sparten-Zuordnung gehoeren zu verschiedenen Vereinen'
      using errcode = '23514',
            hint = 'Eine Zuordnung darf nur auf eine Sparte des EIGENEN Vereins zeigen.';
  end if;

  return new;
end;
$$;

comment on function app.protect_sparte_member() is
  'Gleicher-Verein-Integritaet fuer app.sparte_members: member_id UND sparte_id muessen zum club_id der Zuordnung gehoeren (Verstoss 23514, nicht existente Referenz 23503). Unconditional (kein auth.uid()-Gate) wie protect_team_sparte Zweig 1 / protect_club_membership: Daten-Invariant, das auch Seed/Migration einhalten. Autorisierung (can_manage_sparten) liegt bei der RLS-Policy; der Trigger ergaenzt nur die kreuz-Tabellen-Integritaet. Revive per on-conflict (nur deleted_at) wird uebersprungen.';

drop trigger if exists protect_sparte_member on app.sparte_members;
create trigger protect_sparte_member
  before insert or update on app.sparte_members
  for each row execute function app.protect_sparte_member();

-- ----------------------------------------------------------------------------
-- FIX 2 — app.protect_team_sparte neu: NEUER Immutabilitaets-Block ganz vorn
-- (teams.club_id/created_at fest), danach Zweig 1 + Zweig 2 WOERTLICH aus 0063.
-- ----------------------------------------------------------------------------
create or replace function app.protect_team_sparte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sparte_club    uuid;
  v_deleted        timestamptz;
  v_sparte_changed boolean;
begin
  -- ---- Immutabilitaet (NEU 0064): club_id/created_at eines Teams sind fest ---
  -- Akteurunabhaengig (kein auth.uid()-Gate), Vorbild club_members.club_id.
  -- Schliesst den ueber can_manage_sparten (0063) geoeffneten Schreibpfad, ueber
  -- den ein Nicht-Teams-Rollen-Akteur bisher club_id/created_at aendern konnte,
  -- UND die Zweig-1-Umgehung: ein club_id-Wechsel OHNE sparte_id-Aenderung
  -- wuerde die "Team+Sparte selber Verein"-Integritaet umgehen. Ein Team
  -- wechselt schlicht nie den Verein oder sein Anlagedatum.
  if tg_op = 'UPDATE' then
    if new.club_id is distinct from old.club_id then
      raise exception 'app.teams.club_id ist unveraenderlich'
        using errcode = '23514',
              hint = 'Ein Team bleibt dauerhaft in seinem Verein; club_id darf nicht wechseln.';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'app.teams.created_at ist unveraenderlich'
        using errcode = '23514';
    end if;
  end if;

  v_sparte_changed :=
       (tg_op = 'INSERT' and new.sparte_id is not null)
    or (tg_op = 'UPDATE' and new.sparte_id is distinct from old.sparte_id);

  -- ---- Zweig 1: die SPARTE-ZUORDNUNG wird gesetzt/geaendert/entfernt --------
  if v_sparte_changed then
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
  end if;

  -- ---- Zweig 2 (0063): STAMMDATEN/Soft-Delete an bestehendem Team -----------
  -- teams_update ist jetzt fuer can_manage_sparten (treasurer/Plattform-Admin)
  -- offen. Damit die NICHT die Team-Pflege mituebernehmen, verlangt jede
  -- NICHT-Sparte-Aenderung weiterhin eine echte Teams-Rolle. So gewinnt der
  -- Kassenwart GENAU sparte_id hinzu und nichts sonst.
  if tg_op = 'UPDATE'
     and auth.uid() is not null
     and (
          new.name       is distinct from old.name
       or new.age_group  is distinct from old.age_group
       or new.deleted_at is distinct from old.deleted_at
     )
     and not app.has_club_role(new.club_id, array['owner', 'admin', 'moderator', 'coach'])
  then
    raise exception
      'Team-Stammdaten aendern erfordert eine Teams-Rolle (owner/admin/moderator/coach)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function app.protect_team_sparte() is
  'Immutabilitaet (0064): teams.club_id/created_at unveraenderlich (23514), akteurunabhaengig (Vorbild club_members) — schliesst den can_manage_sparten-Schreibpfad und die Zweig-1-Umgehung durch club_id-Wechsel. Zweig 1: Setzen/Aendern/Entfernen von teams.sparte_id nur app.can_manage_sparten (owner/admin/treasurer/Plattform-Admin, OHNE moderator) + Integritaet (Team+Sparte selber Verein, Sparte existent/nicht geloescht). Zweig 2 (0063): NICHT-Sparte-Aenderungen (name/age_group/deleted_at) verlangen eine Teams-Rolle {owner,admin,moderator,coach}. Autorisierungszweige nur bei auth.uid() IS NOT NULL (Muster protect_locker/protect_club_membership).';

-- Der Stolperdraht aus 0030 — ans Ende JEDER Migration.
select app.assert_no_insecure_views();

commit;
