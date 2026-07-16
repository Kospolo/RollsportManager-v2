-- ============================================================================
-- 93e_rbac_resolution.sql — die Aufloesungs-Funktionen fuer die API (0029).
--
-- Diese Funktionen sind die Bruecke zwischen DB und API. Was hier faellt,
-- faellt in GET /me/capabilities und in jedem API-Guard — deshalb wird nicht
-- nur "liefert Zeilen" geprueft, sondern die VERTRAEGE:
--   A) level_rank/level_of_rank sind exakt umkehrbar (darauf stuetzt sich TS)
--   B) cap_ranks ist vollstaendig und deckt sich mit der geseedeten Matrix
--   C) der Mitgliedschafts-Gate wirkt auch hier (abgelaufen = alles 0)
--   D) Mehrfachrollen wirken SOFORT, ohne neuen Token
--
-- Personas: 90..01 Sandra (coach) · 90..02 Juergen (owner) · 90..06 Milena
--   (guest_coach, valid_until = +30d) · 90..09 Katrin (member).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) DIE UMKEHRBARKEIT. services/api/src/lib/capabilities.ts kodiert die Skala
--    als Array-Index (rankOf); bricht diese Umkehrung, liefert die API stumm
--    falsche Stufen. Geprueft wird ueber enum_range — nicht ueber eine
--    handgeschriebene Liste, die selbst veralten koennte.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_level app.role_level;
  v_bad   text := '';
begin
  foreach v_level in array enum_range(null::app.role_level) loop
    if app.level_of_rank(app.level_rank(v_level)) is distinct from v_level then
      v_bad := v_bad || format('%s->%s->%s ', v_level, app.level_rank(v_level),
                               app.level_of_rank(app.level_rank(v_level)));
    end if;
  end loop;

  if v_bad <> '' then
    perform testkit.fail('aufloesung: level_of_rank(level_rank(l)) = l fuer alle Stufen', v_bad);
  end if;
  perform testkit.ok('aufloesung: level_of_rank(level_rank(l)) = l fuer alle Stufen');

  -- Die Skala hat genau 6 Werte — waechst sie, muss die TS-Seite mitwachsen.
  perform testkit.is_eq('aufloesung: die Stufen-Skala hat genau 6 Werte',
    array_length(enum_range(null::app.role_level), 1)::bigint, 6);
  -- Fail-closed: ein Rang ausserhalb 0..5 liefert NULL, keinen stillen Default.
  perform testkit.is_eq('aufloesung: unbekannter Rang -> NULL (fail-closed)',
    (select count(*)::bigint from (select app.level_of_rank(9) as l) t where t.l is null), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) VOLLSTAENDIGKEIT + DECKUNGSGLEICHHEIT mit der geseedeten Matrix.
--    Sandra hat genau EINE Rolle (coach) -> ihr aufgeloester Rang MUSS je
--    Faehigkeit exakt der Stufe der Rolle 'coach' entsprechen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
begin
  perform testkit.is_eq('cap_ranks: eine Zeile je Faehigkeit im Katalog',
    (select count(*) from app.cap_ranks(v_club)),
    (select count(*) from app.capabilities));

  perform testkit.is_eq('cap_ranks: Sandras Raenge decken sich exakt mit der Rolle coach',
    (select count(*) from app.cap_ranks(v_club) cr
      join app.roles r on r.club_id = v_club and r.key = 'coach'
      join app.role_permissions rp on rp.role_id = r.id
                                  and rp.capability_key = cr.capability_key
     where cr.rank is distinct from app.level_rank(rp.level)), 0);

  -- rank und level muessen dasselbe sagen — sonst liefert die API zwei Wahrheiten.
  perform testkit.is_eq('cap_ranks: rank und level sind konsistent',
    (select count(*) from app.cap_ranks(v_club)
      where level is distinct from app.level_of_rank(rank)), 0);

  -- Stichprobe mit Namen statt nur Mengen (0028 im Zusammenspiel).
  perform testkit.is_eq('cap_ranks: Sandra routines = read_team (2)',
    (select rank::bigint from app.cap_ranks(v_club) where capability_key = 'routines'), 2);
  perform testkit.is_eq('cap_ranks: Sandra routines_edit = edit (4)',
    (select rank::bigint from app.cap_ranks(v_club) where capability_key = 'routines_edit'), 4);
  perform testkit.is_eq('cap_ranks: Sandra finance = read_own (1)',
    (select rank::bigint from app.cap_ranks(v_club) where capability_key = 'finance'), 1);
  -- Der Katalog reist mit — das Admin-UI braucht Labels + allowed_levels.
  perform testkit.is_eq('cap_ranks: liefert bilinguale Labels mit',
    (select count(*) from app.cap_ranks(v_club)
      where label_de is null or label_en is null or label_de = '' or label_en = ''), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B2) Der owner-Kurzschluss (0025:232): protected -> ueberall Rang 5.
--     Das ist die harte Garantie "der Verein sperrt sich nicht selbst aus".
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('cap_ranks: der Owner hat auf JEDER Faehigkeit Rang 5',
    (select count(*) from app.cap_ranks('c1ab0000-0000-4000-8000-000000000001')
      where rank <> 5), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) DER MITGLIEDSCHAFTS-GATE. Dieselben Claims, aber die Mitgliedschaft ist
--    abgelaufen -> cap_ranks muss ueberall 0 liefern. Wuerde die API die
--    Raenge selbst aus role_permissions rechnen (statt via cap_rank), fiele
--    genau dieser Gate weg — deshalb steht der Test hier.
-- ---------------------------------------------------------------------------
begin;
update app.club_members
   set valid_until = now() - interval '1 day'
 where id = 'a0000000-0000-4000-8000-000000000006';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('gate: abgelaufener Gast-Trainer hat auf ALLEN Faehigkeiten Rang 0',
    (select count(*) from app.cap_ranks('c1ab0000-0000-4000-8000-000000000001')
      where rank <> 0), 0);
  -- Die Zeilen verschwinden NICHT — der Katalog bleibt vollstaendig, nur die
  -- Raenge fallen. Das UI zeigt "keine Rechte", nicht "keine Faehigkeiten".
  perform testkit.is_eq('gate: der Katalog bleibt trotzdem vollstaendig',
    (select count(*) from app.cap_ranks('c1ab0000-0000-4000-8000-000000000001')),
    (select count(*) from app.capabilities));
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) MEHRFACHROLLEN wirken SOFORT — der Kern der Phase-2-Zusage.
--    Katrin behaelt ihren Token (club_roles sagt weiterhin nur "member").
--    Sie bekommt die Rolle coach DAZU -> ihre Raenge steigen ohne Re-Login.
-- ---------------------------------------------------------------------------
begin;
insert into app.member_roles (club_id, member_id, role_id)
select 'c1ab0000-0000-4000-8000-000000000001',
       'a0000000-0000-4000-8000-000000000009', r.id
from app.roles r
where r.club_id = 'c1ab0000-0000-4000-8000-000000000001' and r.key = 'coach';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
begin
  -- Vereinigung = hoechste Stufe je Faehigkeit gewinnt.
  perform testkit.is_eq('union: attendance steigt sofort auf edit (4) — ohne neuen Token',
    (select rank::bigint from app.cap_ranks(v_club) where capability_key = 'attendance'), 4);
  perform testkit.is_eq('union: routines_edit steigt sofort auf edit (4)',
    (select rank::bigint from app.cap_ranks(v_club) where capability_key = 'routines_edit'), 4);
  -- Kein Recht geht durch die Zweitrolle VERLOREN: member hat attendance
  -- read_all (3), coach hat edit (4) -> 4. Und wo member hoeher ist, bleibt es.
  perform testkit.is_eq('union: kein Rang faellt unter das Maximum beider Rollen',
    (select count(*) from app.cap_ranks(v_club) cr
      where cr.rank < (
        select max(app.level_rank(rp.level))
        from app.roles r
        join app.role_permissions rp on rp.role_id = r.id
        where r.club_id = v_club and r.key in ('member', 'coach')
          and rp.capability_key = cr.capability_key)), 0);
end;
$$;
rollback;
