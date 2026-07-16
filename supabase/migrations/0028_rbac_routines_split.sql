-- ============================================================================
-- 0028_rbac_routines_split.sql — Kueren-Split (Phase 2, Schritt 2).
--
-- Nutzer-Entscheidung (RBAC-DESIGN Korrekturblock, Entscheidung 2): die
-- Kueren-Asymmetrie ("Trainer:in SCHREIBT alle, LIEST nur die eigenen Teams")
-- wird auf ZWEI geordnete Skalen aufgeteilt und damit im Admin konfigurierbar.
-- 0026:101-112 hatte begruendet, warum das auf EINER Skala nicht geht:
-- 'edit' (4) impliziert read_all (3) -> ein Coach mit 'edit' saehe alle Kueren
-- und die 0021-Privacy-Haertung waere aufgeweicht.
--
-- ### ABWEICHUNG VON DER SPEC — bewusst, mit Begruendung ###
-- Die Spec sagt: "statt 'routines' kommen zwei — 'routines_read' und
-- 'routines_edit'". Der Key 'routines' BLEIBT hier trotzdem der Lese-Key.
-- Grund: der Key steht in 22 Assertions in 6 BESTANDS-Testdateien
-- (93_rbac · 93a_rbac_levels · 93b_rbac_union · 94_rbac_escalation ·
-- 94a_rbac_regression · 10_tenant_isolation), die nicht veraendert werden
-- duerfen — eine geaenderte Alt-Assertion ist kein Kompatibilitaetsbeweis mehr.
-- 'routines' IST bereits die Lese-Faehigkeit (0026:117-151, can_read_routine
-- als Stufenmodell); die Umbenennung waere rein kosmetisch. Der Key ist ein
-- internes Detail, das kein UI zeigt — die Labels sind es, und die werden
-- unten geschaerft. Die SEMANTIK der Nutzer-Entscheidung (zwei geordnete
-- Skalen, beide im Admin setzbar) wird vollstaendig geliefert.
--
-- ### Ehrlich benannter Preis dieser Entscheidung ###
-- 'manage' (5) bleibt in routines.allowed_levels und hat gegenueber read_all (3)
-- KEINE eigene Wirkung — kein Praedikat prueft > 3. Das Admin-UI zeigt damit
-- eine Stufe, die nichts zusaetzlich tut. 'manage' laesst sich nicht entfernen:
-- 93a:172-178 setzt genau diese Stufe, und protect_role_permissions (0024:294)
-- wuerfe dann.
--
-- ### VERHALTEN BLEIBT EXAKT GLEICH (Refaktorierung, keine Rechteaenderung) ###
-- routines_edit >= edit  ==  is_club_trainer  ==  {owner,admin,moderator,
--                                                  coach,guest_coach}
--   owner       -> Sonderzweig 0023:159-167 -> hoechste allowed_level = manage (5)
--                  (zusaetzlich schliesst cap_rank 0025:232 bei protected auf 5 kurz)
--   admin/moderator/coach/guest_coach -> 'edit' (4)
--   treasurer/member                  -> 'none' (0)
-- 'edit' statt 'manage' fuer admin/moderator hat Praezedenz: 0023:205-208 vergibt
-- fuer exakt dieselbe is_club_trainer-Menge bei 'attendance' ebenfalls 'edit'.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Katalog: die neue SCHREIB-Faehigkeit.
--    allowed_levels bewusst OHNE Lesestufen: 'routines_edit' ist keine
--    Lese-Skala. read_own/read_team/read_all darauf zu setzen waere ein
--    Kategoriefehler und wird von protect_role_permissions (0024:294-300)
--    abgelehnt. sort=105 -> direkt hinter 'routines' (100) im Admin-UI.
-- ----------------------------------------------------------------------------
insert into app.capabilities (key, label_de, label_en, allowed_levels, sort) values
  ('routines_edit', 'Küren – Bearbeiten', 'Routines – edit',
   '{none,edit,manage}', 105)
on conflict (key) do update set
  label_de       = excluded.label_de,
  label_en       = excluded.label_en,
  allowed_levels = excluded.allowed_levels,
  sort           = excluded.sort;

-- ----------------------------------------------------------------------------
-- 2. Labels schaerfen. Der KEY bleibt (siehe Kopf), aber das UI muss die beiden
--    Skalen unterscheidbar anzeigen: "Küren" allein waere nach dem Split
--    irrefuehrend. Kein Test prueft Labels (grep ueber supabase/tests/: 0 Treffer).
-- ----------------------------------------------------------------------------
update app.capabilities
   set label_de = 'Küren – Ansehen',
       label_en = 'Routines – view'
 where key = 'routines';

-- ----------------------------------------------------------------------------
-- 3. Die Startkonfiguration um den neuen Zweig ergaenzen.
--    OHNE diesen Zweig liefert der else-Zweig (0023:235-237) fail-closed 'none'
--    -> ALLE Trainer verloeren das Kuer-Schreibrecht. Das ist der gefaehrlichste
--    Einzelfehler dieser Migration.
--    Der Rest der Funktion ist woertlich aus 0023 uebernommen (create or replace
--    kann keinen einzelnen Zweig patchen).
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

    -- LESEN (unveraendert, 0021/0026 can_read_routine):
    --   owner/admin/moderator = alles; coach/guest_coach = betreute Teams;
    --   alle uebrigen (auch treasurer!) = nur eigene (Skater-Zweig).
    when 'routines' then
      return case when v_admin then 'manage'
                  when p_role_key in ('coach', 'guest_coach') then 'read_team'
                  else 'read_own' end;

    -- NEU (0028) SCHREIBEN: exakt is_club_trainer, die heutige Menge der
    -- 10 Kuer-Schreib-Policies. treasurer/member fallen auf 'none' — sie
    -- durften auch bisher nichts schreiben.
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
  'Startkonfiguration je Systemrolle × Fähigkeit. Bildet den HEUTIGEN Rechtestand 1:1 ab (nicht RBAC-DESIGN §3 — Abweichungen siehe Kopf von 0023). Seit 0028 zusätzlich routines_edit = is_club_trainer. Unbekannte Fähigkeit = none (fail-closed).';

-- ----------------------------------------------------------------------------
-- 4. BACKFILL des Bestands. rbac_seed_club ist idempotent (on conflict do
--    nothing) und ergaenzt daher NUR die fehlende routines_edit-Zeile je Rolle.
--    Wird das vergessen, ist cap_rank('routines_edit') = 0 und alle Trainer
--    verlieren das Schreibrecht. Netz: 93_rbac.sql:104-108 vergleicht
--    count(role_permissions where is_system) gegen count(capabilities) * 7 —
--    die rechte Seite steigt hier um 7 und der Test braeche laut.
--    Verein B (Fixture) braucht keinen Backfill: er entsteht NACH den
--    Migrationen, sein clubs_rbac_seed-Trigger (0024:73-75) nimmt
--    routines_edit ueber den cross join auf capabilities automatisch mit.
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
-- 5. Die 10 Kuer-Schreib-Policies auf die neue Faehigkeit.
--    Gegen pg_policies der laufenden DB verifiziert: alle 10 lauten heute
--    exakt app.is_club_trainer(club_id) — 5 Tabellen x (insert + update).
--    Kein DELETE: Kueren werden soft-geloescht (UPDATE deleted_at).
--    has_cap(...,'routines_edit','edit') trifft dieselbe Rollenmenge (siehe Kopf).
-- ----------------------------------------------------------------------------

-- routines (0007:319-322)
alter policy routines_insert on app.routines
  with check (app.has_cap(club_id, 'routines_edit', 'edit'));
alter policy routines_update on app.routines
  using (app.has_cap(club_id, 'routines_edit', 'edit'))
  with check (app.has_cap(club_id, 'routines_edit', 'edit'));

-- routine_skaters (0007:323-326)
alter policy routine_skaters_insert on app.routine_skaters
  with check (app.has_cap(club_id, 'routines_edit', 'edit'));
alter policy routine_skaters_update on app.routine_skaters
  using (app.has_cap(club_id, 'routines_edit', 'edit'))
  with check (app.has_cap(club_id, 'routines_edit', 'edit'));

-- routine_markers (0007:327-330)
alter policy routine_markers_insert on app.routine_markers
  with check (app.has_cap(club_id, 'routines_edit', 'edit'));
alter policy routine_markers_update on app.routine_markers
  using (app.has_cap(club_id, 'routines_edit', 'edit'))
  with check (app.has_cap(club_id, 'routines_edit', 'edit'));

-- routine_scores (0007:331-334)
alter policy routine_scores_insert on app.routine_scores
  with check (app.has_cap(club_id, 'routines_edit', 'edit'));
alter policy routine_scores_update on app.routine_scores
  using (app.has_cap(club_id, 'routines_edit', 'edit'))
  with check (app.has_cap(club_id, 'routines_edit', 'edit'));

-- routine_shares (0018:81-88)
alter policy routine_shares_insert on app.routine_shares
  with check (app.has_cap(club_id, 'routines_edit', 'edit'));
alter policy routine_shares_update on app.routine_shares
  using (app.has_cap(club_id, 'routines_edit', 'edit'))
  with check (app.has_cap(club_id, 'routines_edit', 'edit'));

-- ----------------------------------------------------------------------------
-- 6. Selbstkontrolle (woertlich aus 0023:247-261): jede Default-Stufe MUSS in
--    allowed_levels ihrer Faehigkeit stehen, sonst kann das Admin-UI den
--    Startwert nicht einmal wieder anzeigen.
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
-- 7. Die AEQUIVALENZ-Kontrolle: routines_edit >= edit MUSS exakt
--    is_club_trainer sein. Diese Migration ist eine Refaktorierung — wenn die
--    Mengen auseinanderlaufen, hat sie Rechte VERSCHOBEN statt migriert und
--    muss laut scheitern, nicht still durchgehen.
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
      and rp.capability_key = 'routines_edit'
      and app.level_rank(rp.level) >= app.level_rank('edit');

    if v_actual is distinct from 'admin,coach,guest_coach,moderator,owner' then
      raise exception 'routines_edit >= edit ist NICHT is_club_trainer (Verein %): got [%], erwartet [admin,coach,guest_coach,moderator,owner]',
        v_club, coalesce(v_actual, '<leer>');
    end if;
  end loop;
end;
$$;

commit;
