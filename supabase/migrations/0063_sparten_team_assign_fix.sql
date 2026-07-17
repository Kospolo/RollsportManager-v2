-- ============================================================================
-- 0063_sparten_team_assign_fix.sql — schliesst eine Luecke aus 0062:
-- der KASSENWART (treasurer) konnte ein Team FAKTISCH NICHT einer Sparte
-- zuordnen, obwohl die Chef-Entscheidung ihn ausdruecklich dazu ermaechtigt.
--
-- ############################################################################
-- ### DER BEFUND ############################################################
-- ############################################################################
-- 0062 sagt woertlich (Chef-Entscheidung): Team->Sparte-Zuordnung anlegen/
-- aendern/entfernen darf NUR is_platform_admin() ODER club-Rolle in
-- {owner, admin, treasurer}. Durchgesetzt wird das ueber:
--   (a) den Trigger app.protect_team_sparte (setzen/aendern/entfernen von
--       teams.sparte_id nur can_manage_sparten), UND — davor —
--   (b) die RLS-Policy teams_update, die ueberhaupt entscheidet, ob die
--       Team-Zeile fuer ein UPDATE sichtbar ist.
--
-- teams_update ist aber (seit 0007) has_club_role(owner/admin/MODERATOR/coach)
-- — der treasurer steht NICHT darin. Fuer den Kassenwart greift die USING-
-- Klausel also NICHT: sein `update app.teams set sparte_id = …` wird von RLS
-- STILL herausgefiltert (0 Zeilen), er erreicht den Trigger nie. Ergebnis: der
-- vom Chef ermaechtigte Kassenwart kann faktisch KEIN Team zuordnen. Der
-- Trigger-Zweig `can_manage_sparten` ist fuer ihn toter Code.
--
-- Belegt durch die Luecke im 0062-eigenen Test 99k_sparten.sql: dort ist die
-- Team->Sparte-Zuordnung fuer owner/moderator/coach/member geprueft — fuer den
-- treasurer FEHLT sie. Sein Fall faellt sonst still in dieselbe „0 Zeilen"-
-- Falle wie der member (99k:210).
--
-- ############################################################################
-- ### DER FIX — die Absicht von 0062 vervollstaendigen, nicht ausweiten ######
-- ############################################################################
-- 0062 wollte: „teams_update ist WEIT, der Trigger sortiert, wer WAS darf."
-- Genau dieses Modell wird hier vollstaendig gemacht:
--
--   1. teams_update wird um `OR app.can_manage_sparten(club_id)` erweitert.
--      Damit passiert der treasurer (und der Plattform-Admin) das Zeilen-Gate
--      und erreicht den Trigger — der seine Zuordnung schon heute korrekt
--      zulaesst.
--
--   2. DAMIT der treasurer dadurch NICHT heimlich auch Team-STAMMDATEN
--      (name/age_group) oder den Soft-Delete aendern darf (das hat der Chef
--      NICHT gewaehrt), bekommt der Trigger einen zweiten Zweig: eine
--      NICHT-Sparte-Aenderung an einem bestehenden Team verlangt weiterhin
--      eine echte Teams-Rolle {owner, admin, moderator, coach}. Der treasurer
--      gewinnt also GENAU EIN Recht hinzu — teams.sparte_id — und nichts sonst.
--
-- Wirkung auf die anderen Rollen (unveraendert, per 99k belegt):
--   * owner/admin      : Struktur-Rolle UND can_manage_sparten -> alles wie bisher.
--   * moderator/coach  : Struktur-Rolle, aber NICHT can_manage_sparten -> duerfen
--                        Teams pflegen, Sparte-Zuordnung blockt der Trigger (42501).
--   * member           : weder noch -> teams_update filtert weiter (0 Zeilen).
--   * treasurer        : NEU can_manage_sparten -> darf jetzt NUR sparte_id
--                        setzen/aendern/entfernen; Stammdaten blockt Zweig 2 (42501).
--   * platform admin   : can_manage_sparten via is_platform_admin() -> darf
--                        zuordnen; Stammdaten nur mit Betreiber-Override
--                        (has_club_role), sonst 42501 — wie ueberall sonst.
--
-- Kein withServiceRole-Bypass, keine SECURITY-DEFINER-Schreibfunktion: die
-- Autorisierung bleibt in RLS + Trigger, die API schreibt weiter impersoniert.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. teams_update weiten: Struktur-Rolle ODER can_manage_sparten. Nur so
--    erreicht der treasurer/Plattform-Admin ueberhaupt den Trigger. teams_insert
--    bleibt UNVERAENDERT (der treasurer legt keine Teams an — 90_roles_matrix).
-- ----------------------------------------------------------------------------
alter policy teams_update on app.teams
  using (
    app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach'])
    or app.can_manage_sparten(club_id)
  )
  with check (
    app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach'])
    or app.can_manage_sparten(club_id)
  );

-- ----------------------------------------------------------------------------
-- 2. protect_team_sparte neu: Zweig 1 (Sparte-Zuordnung, unveraendert aus 0062)
--    + Zweig 2 (NEU: Stammdaten-/Soft-Delete-Aenderung verlangt Teams-Rolle).
--    Zweig 2 steht VOR dem frueheren Fruehausstieg „sparte_id unveraendert",
--    damit er auch reine Umbenennungen erfasst.
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

  -- ---- Zweig 2 (NEU 0063): STAMMDATEN/Soft-Delete an bestehendem Team -------
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
  'Zweig 1: Setzen/Aendern/Entfernen von teams.sparte_id nur app.can_manage_sparten (owner/admin/treasurer/Plattform-Admin, OHNE moderator) + Integritaet (Team+Sparte selber Verein, Sparte existent/nicht geloescht). Zweig 2 (0063): NICHT-Sparte-Aenderungen (name/age_group/deleted_at) verlangen weiter eine Teams-Rolle {owner,admin,moderator,coach} — noetig, seit teams_update fuer can_manage_sparten geoeffnet ist, damit der Kassenwart GENAU die Sparte-Zuordnung erhaelt und nicht die Team-Pflege. Autorisierung nur bei auth.uid() IS NOT NULL (Muster protect_locker/protect_club_membership).';

-- Der Stolperdraht aus 0030 — ans Ende JEDER Migration.
select app.assert_no_insecure_views();

commit;
