-- ============================================================================
-- 99rA_modul_sichtbarkeit.sql — WER SIEHT WELCHE KACHEL (Migration 0077).
--
-- WARUM DIESE DATEI
-- ---------------------------------------------------------------------------
-- Der Nutzer am iPhone: "Vereins-Admin soll Module fuer Gruppen und Mitglieder
-- einstellen koennen. Jetzt sind als Mitglied unter 'Mehr' so viele Module, wo
-- fuer das normale Mitglied eigentlich nicht zu sehen sein sollen."
--
-- Zwei Dinge muessen deshalb GEMESSEN werden, nicht behauptet:
--   1. Die neue Ebene wirkt und ist einstellbar (Rolle / Gruppe / Mitglied),
--      und zwar NUR von der Vereinsleitung.
--   2. Sie ist KEIN Sicherheitsersatz. Das ist der gefaehrlichste Punkt des
--      ganzen Umbaus: wer eine Kachel versteckt und glaubt, damit Daten
--      geschuetzt zu haben, baut ein Loch. Block F stellt deshalb ausdruecklich
--      nach, dass ein AUSGEBLENDETES Modul serverseitig GENAU SO VIEL liefert
--      wie vorher — kein neues Loch, keine neue Sperre.
--
-- Bloecke:
--   A) Der Katalog: jedes Modul ist entschieden (Faehigkeit + Mindeststufe oder
--      ausdruecklich "immer sichtbar").
--   B) Die VORGABE unterscheidet die Rollen sinnvoll — gerechnet, nicht gelistet.
--      Und sie stimmt fuer einen FRISCHEN Verein mit der vereinsunabhaengigen
--      Ableitung ueberein (kein zweites Regelwerk).
--   C) Die Vorgabe FOLGT DEN RECHTEN: aendert der Verein die Rechtematrix,
--      wandert die Kachel mit. Das ist der Punkt, an dem eine Handliste
--      versagt haette.
--   D) Die drei Ebenen und ihre Reihenfolge (Mitglied > Gruppe > Rolle).
--   E) Wer darf einstellen: Vereinsleitung ja, Mitglied nein (42501).
--      Und: die Verwaltung nimmt keine Zeile an (P0001) — der Weg zurueck.
--   F) SICHTBARKEIT IST KEIN SCHUTZ (der wichtigste Block).
--   G) Die Kette bleibt ein UND: was der Verein nicht eingeschaltet hat, kann
--      keine Sichtbarkeits-Zeile ins Menue heben.
--   H) Positivkontrolle (Sabotage): ohne die Mindeststufe waere die Vorgabe
--      wieder offen. Stellt den AUSFALL der Kontrolle nach, statt ihn zu glauben.
--
-- Personas (seed/seed.sql), Verein A = c1ab..01 (RSV Neckarsulm, HAT PRO):
--   Sandra   90..01 / a-01  coach      — Gruppe "Leistungssport" (d..01)
--   Juergen  90..02 / a-02  owner      — Gruppe "Vorstand"       (d..03)
--   Beate    90..03 / a-03  treasurer  — Gruppe "Vorstand"
--   Thomas   90..04 / a-04  admin      — is_club_admin, darf einstellen
--   AnnaLena 90..05 / a-05  coach      — Gruppe "Breitensport"   (d..02)
--   Katrin   90..09 / a-09  member     — in KEINER Gruppe
--
-- LIES 0044 (die drei Systeme) und 0077 (die vierte Frage + die Reihenfolge).
-- Diese Datei ist NEU. Bestands-Tests bleiben unberuehrt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Der Katalog ist ENTSCHIEDEN. Ein Modul ohne Zuordnung waere still immer
--    sichtbar — genau der Zustand, aus dem der Befund kam.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('sichtbarkeit: alle 26 Module sind entschieden (Faehigkeit oder ausdruecklich immer sichtbar)',
    (select count(*) from app.modules
      where visibility_capability is null and key not in ('notes', 'family')), 0);

  perform testkit.is_eq('sichtbarkeit: genau 2 Module sind ausdruecklich IMMER sichtbar (Notizen, Familie)',
    (select count(*) from app.modules where visibility_capability is null), 2);

  -- Die Zuordnung zeigt nur auf echte Faehigkeiten (der FK sichert es; hier
  -- steht, dass es gilt).
  perform testkit.is_eq('sichtbarkeit: jede Zuordnung zeigt auf eine Faehigkeit des Katalogs',
    (select count(*) from app.modules m
      where m.visibility_capability is not null
        and not exists (select 1 from app.capabilities c where c.key = m.visibility_capability)), 0);

  -- Eine Mindeststufe ueber der hoechsten Stufe der Faehigkeit waere fuer JEDE
  -- Rolle unerreichbar — die Kachel waere tot statt konfigurierbar.
  perform testkit.is_eq('sichtbarkeit: keine unerreichbare Mindeststufe',
    (select count(*) from app.modules m
      join app.capabilities c on c.key = m.visibility_capability
     where m.visibility_min_rank > (select max(app.level_rank(l)) from unnest(c.allowed_levels) as l)), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DIE VORGABE. Das ist die Antwort auf den Befund: ein Kind sieht NICHT mehr
--    dasselbe wie der Vorstand. Gerechnet aus der Rechtematrix — es steht
--    nirgends eine Liste "Rolle X sieht Y".
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
  v_bad  text;
begin
  -- Was ein normales Mitglied NICHT sehen soll — woertlich die Aufzaehlung des
  -- Nutzers (Verwaltung, Finanzen/Mahnwesen, Wartelisten, Schliessfach-
  -- Verwaltung, Auswertung) plus Jubilaeen und Abteilungen.
  select string_agg(k, ', ') into v_bad
    from unnest(array['manage','finance','lockers','waitlists','chart','anniversaries','departments']) as k
   where app.module_visible(v_club, 'a0000000-0000-4000-8000-000000000009', k);
  if v_bad is not null then
    perform testkit.fail('vorgabe: normales Mitglied sieht keine Verwaltungs-Module', v_bad);
  end if;
  perform testkit.ok('vorgabe: normales Mitglied sieht keine Verwaltungs-Module');

  -- Was es sehen MUSS — sonst waere die App fuer ein Kind leer.
  select string_agg(k, ', ') into v_bad
    from unnest(array['events','teams','routines','gallery','news','chat','notes','document','family','members']) as k
   where not app.module_visible(v_club, 'a0000000-0000-4000-8000-000000000009', k);
  if v_bad is not null then
    perform testkit.fail('vorgabe: normales Mitglied sieht seine eigenen Bereiche', v_bad);
  end if;
  perform testkit.ok('vorgabe: normales Mitglied sieht seine eigenen Bereiche');

  -- Die vier Personas unterscheiden sich SINNVOLL. Die Zahlen sind gerechnet
  -- (siehe Kopf 0077) — sie stehen hier, damit eine spaetere Verschiebung
  -- auffaellt statt durchzurutschen.
  perform testkit.is_eq('vorgabe: Mitglied sieht 19 von 26 Modulen',
    (select count(*) filter (where visible)
       from app.member_module_visibility(v_club, 'a0000000-0000-4000-8000-000000000009')), 19);
  perform testkit.is_eq('vorgabe: Trainer sieht 22 (Abteilungen, Wartelisten, Jubilaeen kommen dazu)',
    (select count(*) filter (where visible)
       from app.member_module_visibility(v_club, 'a0000000-0000-4000-8000-000000000001')), 22);
  perform testkit.is_eq('vorgabe: Kassenwart sieht 23 (Finanzen, Schliessfaecher, Auswertung — aber keine Verwaltung)',
    (select count(*) filter (where visible)
       from app.member_module_visibility(v_club, 'a0000000-0000-4000-8000-000000000003')), 23);
  perform testkit.is_eq('vorgabe: Eigentuemer sieht alle 26',
    (select count(*) filter (where visible)
       from app.member_module_visibility(v_club, 'a0000000-0000-4000-8000-000000000002')), 26);

  -- Der Kassenwart sieht die Finanzen, der Trainer nicht — sonst waere die
  -- Ableitung aus den Rechten nur Zufall.
  perform testkit.is_eq('vorgabe: Kassenwart sieht Finanzen, Trainer nicht',
    (select count(*) from (values
       (app.module_visible(v_club, 'a0000000-0000-4000-8000-000000000003', 'finance')),
       (not app.module_visible(v_club, 'a0000000-0000-4000-8000-000000000001', 'finance'))
     ) as t(ok) where ok), 2);

  -- Ohne Ausnahme entscheidet die VORGABE — und die Auskunft sagt das auch.
  perform testkit.is_eq('vorgabe: ohne Ausnahme ist die Quelle "default"',
    (select count(*) from app.member_module_visibility(v_club, 'a0000000-0000-4000-8000-000000000009')
      where source <> 'default'), 0);

  -- Kein zweites Regelwerk: die vereinsunabhaengige Ableitung und die echte
  -- Rechtematrix des (frischen) Vereins sagen dasselbe. Waeren es zwei
  -- Wahrheiten, wuerde die Nachrechnung in 0077 etwas anderes pruefen als das
  -- Menue zeigt.
  perform testkit.is_eq('vorgabe: Ableitung und Vereins-Matrix stimmen ueberein (kein zweites Regelwerk)',
    (select count(*) from app.roles r cross join app.modules m
      where r.club_id = v_club
        and app.module_role_key_default_visible(r.key, m.key)
            is distinct from app.module_role_default_visible(r.id, m.key)), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) DIE VORGABE FOLGT DEN RECHTEN. Der eigentliche Grund, warum sie abgeleitet
--    und nicht abgeschrieben ist: gibt der Verein seiner member-Rolle das Recht
--    auf Wartelisten, taucht die Kachel von selbst auf — ohne dass jemand eine
--    zweite Liste pflegt. Eine Handliste haette hier NICHTS getan.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
  v_role uuid;
begin
  select id into v_role from app.roles where club_id = v_club and key = 'member';

  perform testkit.is_eq('vorgabe folgt Rechten: vorher sieht das Mitglied die Wartelisten nicht',
    (select case when app.module_visible(v_club, 'a0000000-0000-4000-8000-000000000009', 'waitlists') then 1 else 0 end), 0);

  -- Der Verein hebt die Stufe der Rolle auf 'edit' (Verwaltung > Rollen & Rechte).
  update app.role_permissions set level = 'edit'
   where role_id = v_role and capability_key = 'waitlists';

  perform testkit.is_eq('vorgabe folgt Rechten: nach der Rechte-Aenderung sieht es die Wartelisten',
    (select case when app.module_visible(v_club, 'a0000000-0000-4000-8000-000000000009', 'waitlists') then 1 else 0 end), 1);

  -- ... und die Quelle ist weiterhin die VORGABE, nicht eine Ausnahme.
  perform testkit.is_eq('vorgabe folgt Rechten: Quelle bleibt "default" (keine Ausnahme noetig)',
    (select count(*) from app.member_module_visibility(v_club, 'a0000000-0000-4000-8000-000000000009')
      where module_key = 'waitlists' and source = 'default'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) DIE DREI EBENEN und ihre Reihenfolge: Mitglied > Gruppe > Rolle > Vorgabe.
--    Hier steht der Fall des Nutzers ("Module fuer Gruppen und Mitglieder").
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
declare
  v_club   uuid := 'c1ab0000-0000-4000-8000-000000000001';
  v_leist  uuid := 'd0000000-0000-4000-8000-000000000001';  -- Gruppe Leistungssport
  v_sandra uuid := 'a0000000-0000-4000-8000-000000000001';  -- coach, Leistungssport
  v_anna   uuid := 'a0000000-0000-4000-8000-000000000005';  -- coach, Breitensport
  v_katrin uuid := 'a0000000-0000-4000-8000-000000000009';  -- member, keine Gruppe
  v_role   uuid;
begin
  select id into v_role from app.roles where club_id = v_club and key = 'member';

  -- --- Ebene ROLLE: die Basis, eine Zeile fuer alle 24 Mitglieder ----------
  perform testkit.is_eq('ebene rolle: vorher sieht das Mitglied den Chat',
    (select case when app.module_visible(v_club, v_katrin, 'chat') then 1 else 0 end), 1);

  insert into app.module_visibility (club_id, module_key, scope, role_id, visible)
  values (v_club, 'chat', 'role', v_role, false);

  perform testkit.is_eq('ebene rolle: der Admin blendet den Chat fuer die Rolle "Mitglied" aus',
    (select case when app.module_visible(v_club, v_katrin, 'chat') then 1 else 0 end), 0);
  perform testkit.is_eq('ebene rolle: die Quelle sagt "role"',
    (select count(*) from app.member_module_visibility(v_club, v_katrin)
      where module_key = 'chat' and source = 'role'), 1);
  -- Der Trainer ist nicht Mitglied dieser Rolle -> unberuehrt.
  perform testkit.is_eq('ebene rolle: der Trainer behaelt den Chat (andere Rolle)',
    (select case when app.module_visible(v_club, v_sandra, 'chat') then 1 else 0 end), 1);

  -- --- Ebene GRUPPE: schlaegt die Rolle -----------------------------------
  -- Der Nutzer nennt sie ausdruecklich. Leistungssport verliert die Jubilaeen,
  -- Breitensport behaelt sie.
  perform testkit.is_eq('ebene gruppe: vorher sehen BEIDE Trainer die Jubilaeen',
    (select count(*) from (values
       (app.module_visible(v_club, v_sandra, 'anniversaries')),
       (app.module_visible(v_club, v_anna,   'anniversaries'))
     ) as t(ok) where ok), 2);

  insert into app.module_visibility (club_id, module_key, scope, department_id, visible)
  values (v_club, 'anniversaries', 'department', v_leist, false);

  perform testkit.is_eq('ebene gruppe: Leistungssport verliert die Jubilaeen',
    (select case when app.module_visible(v_club, v_sandra, 'anniversaries') then 1 else 0 end), 0);
  perform testkit.is_eq('ebene gruppe: Breitensport behaelt sie (andere Gruppe, unberuehrt)',
    (select case when app.module_visible(v_club, v_anna, 'anniversaries') then 1 else 0 end), 1);
  perform testkit.is_eq('ebene gruppe: die Quelle sagt "department"',
    (select count(*) from app.member_module_visibility(v_club, v_sandra)
      where module_key = 'anniversaries' and source = 'department'), 1);

  -- Die Gruppe SCHLAEGT die Rolle — in beide Richtungen. Der Chat ist fuer die
  -- Rolle "Mitglied" aus (oben); eine Gruppe kann ihn zurueckgeben.
  insert into app.module_visibility (club_id, module_key, scope, department_id, visible)
  values (v_club, 'chat', 'department', v_leist, true);
  insert into app.department_members (club_id, department_id, member_id)
  values (v_club, v_leist, v_katrin);

  perform testkit.is_eq('ebene gruppe: schlaegt die Rolle — die Gruppe gibt den Chat zurueck',
    (select case when app.module_visible(v_club, v_katrin, 'chat') then 1 else 0 end), 1);

  -- --- Ebene MITGLIED: schlaegt alles -------------------------------------
  -- Der Fall aus dem Auftrag: "dieses Elternteil darf zusaetzlich X sehen."
  perform testkit.is_eq('ebene mitglied: vorher sieht Katrin die Auswertung nicht (Vorgabe)',
    (select case when app.module_visible(v_club, v_katrin, 'chart') then 1 else 0 end), 0);

  insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
  values (v_club, 'chart', 'member', v_katrin, true);

  perform testkit.is_eq('ebene mitglied: Katrin bekommt die Auswertung ausdruecklich',
    (select case when app.module_visible(v_club, v_katrin, 'chart') then 1 else 0 end), 1);
  perform testkit.is_eq('ebene mitglied: alle anderen Mitglieder bleiben unberuehrt',
    (select case when app.module_visible(v_club, 'a0000000-0000-4000-8000-000000000012', 'chart') then 1 else 0 end), 0);

  -- ... und das Mitglied schlaegt die Gruppe.
  insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
  values (v_club, 'chat', 'member', v_katrin, false);
  perform testkit.is_eq('ebene mitglied: schlaegt die Gruppe (Mitglied aus, Gruppe an -> aus)',
    (select case when app.module_visible(v_club, v_katrin, 'chat') then 1 else 0 end), 0);
  perform testkit.is_eq('ebene mitglied: die Quelle sagt "member"',
    (select count(*) from app.member_module_visibility(v_club, v_katrin)
      where module_key = 'chat' and source = 'member'), 1);

  -- Zuruecksetzen = Zeile loeschen -> die Vorgabe gilt wieder.
  delete from app.module_visibility
   where club_id = v_club and scope = 'member' and member_id = v_katrin;
  delete from app.module_visibility
   where club_id = v_club and scope = 'department';
  delete from app.module_visibility
   where club_id = v_club and scope = 'role';
  perform testkit.is_eq('zuruecksetzen: ohne Ausnahmen gilt wieder die Vorgabe',
    (select count(*) filter (where visible)
       from app.member_module_visibility(v_club, v_katrin)), 19);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D2) MEHRERE ROLLEN / MEHRERE GRUPPEN — die Reihenfolge muss auch dann
--     eindeutig sein. Rollen sind eine VEREINIGUNG (wie app.cap_rank),
--     Gruppen sind RESTRIKTIV (ein ausdrueckliches AUS gewinnt).
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_club   uuid := 'c1ab0000-0000-4000-8000-000000000001';
  v_katrin uuid := 'a0000000-0000-4000-8000-000000000009';
  v_mem    uuid;
  v_coach  uuid;
  v_leist  uuid := 'd0000000-0000-4000-8000-000000000001';
  v_breit  uuid := 'd0000000-0000-4000-8000-000000000002';
begin
  select id into v_mem   from app.roles where club_id = v_club and key = 'member';
  select id into v_coach from app.roles where club_id = v_club and key = 'coach';

  -- Katrin bekommt zusaetzlich die Trainer-Rolle (Mehrfachrollen, 0022).
  insert into app.member_roles (club_id, member_id, role_id) values (v_club, v_katrin, v_coach);

  -- Fuer die Rolle "Mitglied" ausgeblendet — die Trainer-Rolle zeigt es aber.
  insert into app.module_visibility (club_id, module_key, scope, role_id, visible)
  values (v_club, 'exercises', 'role', v_mem, false);

  perform testkit.is_eq('mehrere rollen: eine sichtbare Rolle gewinnt (Vereinigung wie app.cap_rank)',
    (select case when app.module_visible(v_club, v_katrin, 'exercises') then 1 else 0 end), 1);

  -- Beide Rollen aus -> aus.
  insert into app.module_visibility (club_id, module_key, scope, role_id, visible)
  values (v_club, 'exercises', 'role', v_coach, false);
  perform testkit.is_eq('mehrere rollen: sind ALLE aus, ist es aus',
    (select case when app.module_visible(v_club, v_katrin, 'exercises') then 1 else 0 end), 0);

  -- Zwei Gruppen, eine sagt AUS -> aus (restriktiv, Begruendung in 0077).
  insert into app.department_members (club_id, department_id, member_id) values
    (v_club, v_leist, v_katrin), (v_club, v_breit, v_katrin);
  insert into app.module_visibility (club_id, module_key, scope, department_id, visible) values
    (v_club, 'news', 'department', v_leist, true),
    (v_club, 'news', 'department', v_breit, false);

  perform testkit.is_eq('mehrere gruppen: ein ausdrueckliches AUS gewinnt (restriktiv)',
    (select case when app.module_visible(v_club, v_katrin, 'news') then 1 else 0 end), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) WER DARF EINSTELLEN. Die Oberflaeche graut den Schalter aus — das ist
--    Kosmetik. Hier steht, dass die DATENBANK es durchsetzt.
-- ---------------------------------------------------------------------------
begin;
-- Katrin (member) versucht es.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('schreibrecht: ein Mitglied kann die Sichtbarkeit NICHT stellen (42501)',
    $q$insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
       values ('c1ab0000-0000-4000-8000-000000000001', 'finance', 'member',
               'a0000000-0000-4000-8000-000000000009', true)$q$, '42501');

  -- Lesen darf es: das Menue muss sich bauen lassen, und die eigene
  -- Einstellung nachvollziehen zu koennen verhindert Support-Faelle.
  perform testkit.succeeds('schreibrecht: lesen darf jedes Mitglied',
    $q$select count(*) from app.module_visibility$q$);
end;
$$;
rollback;

begin;
-- Sandra (coach) ist KEIN is_club_admin -> ebenfalls nein.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('schreibrecht: auch ein Trainer kann die Sichtbarkeit NICHT stellen (42501)',
    $q$insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
       values ('c1ab0000-0000-4000-8000-000000000001', 'finance', 'member',
               'a0000000-0000-4000-8000-000000000009', true)$q$, '42501');
end;
$$;
rollback;

begin;
-- Thomas (admin) darf — die Positivkontrolle. Ohne sie waere oben nur belegt,
-- dass NIEMAND schreiben kann (das koennte auch ein kaputtes Grant sein).
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('schreibrecht: die Vereinsleitung darf stellen',
    $q$insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
       values ('c1ab0000-0000-4000-8000-000000000001', 'finance', 'member',
               'a0000000-0000-4000-8000-000000000009', true)$q$);

  -- Der Weg zurueck: die VERWALTUNG nimmt keine Zeile an. Wer sie ausblendet,
  -- kaeme an die Einstellung nicht mehr heran, um es zurueckzunehmen.
  perform testkit.throws('weg zurueck: die Verwaltung kann nicht ausgeblendet werden (P0001)',
    $q$insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
       values ('c1ab0000-0000-4000-8000-000000000001', 'manage', 'member',
               'a0000000-0000-4000-8000-000000000009', false)$q$, 'P0001');
  -- Auch nicht als "sichtbar" — sonst gaebe es zwei Zustaende fuer dasselbe.
  perform testkit.throws('weg zurueck: die Verwaltung nimmt ueberhaupt keine Zeile an (P0001)',
    $q$insert into app.module_visibility (club_id, module_key, scope, role_id, visible)
       select 'c1ab0000-0000-4000-8000-000000000001', 'manage', 'role', id, true
         from app.roles where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'owner'$q$,
    'P0001');

  -- Kein Ziel aus einem FREMDEN Verein (zusammengesetzter FK, Muster 0022).
  perform testkit.throws('mandant: eine Zeile kann nicht auf ein Mitglied eines fremden Vereins zeigen (23503)',
    $q$insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
       values ('c1ab0000-0000-4000-8000-000000000001', 'finance', 'member',
               'deadbeef-a000-4000-8000-000000000001', true)$q$, '23503');

  -- Genau EIN Ziel je Zeile (CHECK) — sonst haette die Aufloesung zwei Antworten.
  perform testkit.throws('form: eine Zeile mit zwei Zielen wird abgewiesen (23514)',
    $q$insert into app.module_visibility (club_id, module_key, scope, member_id, role_id, visible)
       select 'c1ab0000-0000-4000-8000-000000000001', 'finance', 'member',
              'a0000000-0000-4000-8000-000000000009', id, true
         from app.roles where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'owner'$q$,
    '23514');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) !!! SICHTBARKEIT IST KEIN SCHUTZ !!!  — DER WICHTIGSTE BLOCK.
--
--    Die Gefahr dieses Umbaus ist nicht, dass er nicht wirkt, sondern dass
--    jemand ihn spaeter fuer eine Sperre haelt. Hier steht schwarz auf weiss:
--    ein ausgeblendetes Modul liefert derselben Person GENAU DIESELBEN Zeilen
--    wie vorher — kein neues Loch UND keine neue Sperre fuer Berechtigte.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
declare
  v_club   uuid := 'c1ab0000-0000-4000-8000-000000000001';
  v_katrin uuid := 'a0000000-0000-4000-8000-000000000009';
  v_vorher bigint;
  v_nachher bigint;
begin
  -- Vorher: was Katrin an News wirklich sehen darf (RLS entscheidet).
  select count(*) into v_vorher from app.news;
  perform testkit.is_eq('kein schutz: Ausgangslage — das Mitglied sieht News und die Kachel',
    (select case when app.module_visible(v_club, v_katrin, 'news') then 1 else 0 end), 1);

  -- Der Admin blendet die News-Kachel fuer genau diese Person aus.
  set local role postgres;
  insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
  values (v_club, 'news', 'member', v_katrin, false);
  set local role authenticated;

  perform testkit.is_eq('kein schutz: die Kachel ist weg',
    (select case when app.module_visible(v_club, v_katrin, 'news') then 1 else 0 end), 0);

  -- ... und trotzdem kommen ueber den direkten Zugriff (Deeplink, curl) EXAKT
  -- dieselben Zeilen heraus wie vorher. Genau so ist es gemeint.
  select count(*) into v_nachher from app.news;
  perform testkit.is_eq('kein schutz: derselbe Datenzugriff wie vorher — Ausblenden nimmt KEIN Recht',
    v_nachher, v_vorher);
  perform testkit.is_eq('kein schutz: es kommen ueberhaupt Zeilen heraus (sonst waere der Vergleich wertlos)',
    (select case when v_vorher > 0 then 1 else 0 end), 1);

  -- Die Gegenrichtung: eine sichtbare Kachel gibt KEIN Recht. Die Finanzen
  -- werden Katrin ausdruecklich eingeblendet — das Kassenbuch bleibt zu.
  set local role postgres;
  insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
  values (v_club, 'finance', 'member', v_katrin, true);
  set local role authenticated;

  perform testkit.is_eq('kein recht: die Finanz-Kachel ist eingeblendet',
    (select case when app.module_visible(v_club, v_katrin, 'finance') then 1 else 0 end), 1);
  perform testkit.is_eq('kein recht: das Kassenbuch bleibt trotzdem zu (RLS entscheidet, nicht das Menue)',
    (select count(*) from app.ledger_entries), 0);
  perform testkit.throws('kein recht: schreiben bleibt verboten (42501)',
    $q$insert into app.ledger_entries
         (club_id, entry_on, description, counterparty_kind, amount_cents)
       values ('c1ab0000-0000-4000-8000-000000000001', current_date,
               'Test', 'org', 100)$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F2) Und der Nachweis in der Struktur, nicht nur im Verhalten: die
--     Sichtbarkeit taucht in KEINER RLS-Policy auf. Waere sie dort eingebaut,
--     haette jemand aus einem Menue-Schalter eine Sicherheitsgrenze gemacht —
--     mit allen Folgen fuer die Beweislage.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('kein gate: keine RLS-Policy benutzt die Sichtbarkeit',
    (select count(*) from pg_policies p
      where p.schemaname in ('app', 'api')
        and (coalesce(p.qual, '') || coalesce(p.with_check, ''))
            ~ '(module_visible|member_module_visibility|module_role_default_visible|module_visibility)'), 0);

  -- Gegenprobe: der MODUL-SCHALTER (0044) steht sehr wohl in Policies. Ohne
  -- diese Zeile koennte die Kontrolle oben auch dann gruen sein, wenn das
  -- Suchmuster gar nichts findet.
  perform testkit.is_eq('kein gate: der Modul-Schalter (0044) steht dagegen sehr wohl in Policies (Gegenprobe)',
    (select case when count(*) > 20 then 1 else 0 end from pg_policies p
      where p.schemaname = 'app'
        and coalesce(p.qual, '') like '%module_enabled%'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- G) DIE KETTE BLEIBT EIN UND. Eine Sichtbarkeits-Zeile kann nichts ins Menue
--    heben, was der Verein gar nicht eingeschaltet oder nicht lizenziert hat.
--    Sonst waere die neue Ebene ein Weg, 0044 und 0012 zu umgehen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
declare
  v_club   uuid := 'c1ab0000-0000-4000-8000-000000000001';
  v_katrin uuid := 'a0000000-0000-4000-8000-000000000009';
begin
  -- Ausgangslage: der Verein hat die Uebungen an, Katrin sieht sie.
  perform testkit.is_eq('und-kette: Ausgangslage — Uebungen sind an und sichtbar',
    (select count(*) from app.my_effective_modules(v_club)
      where module_key = 'exercises' and visible), 1);

  -- Der Verein schaltet das Modul ab (0044).
  insert into app.club_modules (club_id, module_key, enabled)
  values (v_club, 'exercises', false)
  on conflict (club_id, module_key) do update set enabled = false;

  -- Und der Admin blendet es ausdruecklich EIN — die Kette bleibt trotzdem zu.
  insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
  values (v_club, 'exercises', 'member', v_katrin, true);

  perform testkit.is_eq('und-kette: abgeschaltet schlaegt eingeblendet — die Kachel bleibt weg',
    (select count(*) from app.my_effective_modules(v_club)
      where module_key = 'exercises' and visible), 0);

  -- Dasselbe fuer PRO: die Sichtbarkeit hebelt das Entitlement nicht aus.
  -- (Verein B hat kein PRO; hier genuegt die Aussage der Funktion selbst.)
  perform testkit.is_eq('und-kette: sichtbar setzt available voraus (gekauft UND eingeschaltet)',
    (select count(*) from app.my_effective_modules(v_club) where visible and not available), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- H) POSITIVKONTROLLE (Sabotage). Stellt den AUSFALL der Kontrolle nach: ohne
--    die Mindeststufe (min_rank = 1 statt 5) saehe das normale Mitglied die
--    Finanzen wieder — denn sein Eigenrecht 'read_own' waere dann genug. Ohne
--    diesen Block wuesste niemand, ob Block B ueberhaupt etwas misst.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_club   uuid := 'c1ab0000-0000-4000-8000-000000000001';
  v_katrin uuid := 'a0000000-0000-4000-8000-000000000009';
begin
  perform testkit.is_eq('sabotage: mit Mindeststufe 5 sieht das Mitglied die Finanzen nicht',
    (select case when app.module_visible(v_club, v_katrin, 'finance') then 1 else 0 end), 0);

  update app.modules set visibility_min_rank = 1 where key = 'finance';

  perform testkit.is_eq('sabotage: mit Mindeststufe 1 saehe es sie — die Kontrolle KANN also rot werden',
    (select case when app.module_visible(v_club, v_katrin, 'finance') then 1 else 0 end), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- I) DIE MATRIX fuer das Admin-UI: vollstaendig auf der Rollen-Ebene, nur
--    Ausnahmen auf den anderen beiden — und ohne die Verwaltung, die keine
--    Zeile annimmt (sonst zeigte das UI einen Schalter, der immer scheitert).
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
begin
  perform testkit.is_eq('matrix: Rollen-Ebene ist vollstaendig (25 Module x 7 Rollen, ohne "manage")',
    (select count(*) from app.club_module_visibility_matrix(v_club) where scope = 'role'), 25 * 7);
  perform testkit.is_eq('matrix: "manage" steht nicht drin — es nimmt keine Zeile an',
    (select count(*) from app.club_module_visibility_matrix(v_club) where module_key = 'manage'), 0);
  perform testkit.is_eq('matrix: ohne Ausnahmen gibt es keine Gruppen-/Mitglieds-Zeilen',
    (select count(*) from app.club_module_visibility_matrix(v_club) where scope <> 'role'), 0);
  perform testkit.is_eq('matrix: ohne Ausnahme ist override null und effective = Vorgabe',
    (select count(*) from app.club_module_visibility_matrix(v_club)
      where scope = 'role' and (override is not null or effective is distinct from default_visible)), 0);

  insert into app.module_visibility (club_id, module_key, scope, member_id, visible)
  values (v_club, 'chart', 'member', 'a0000000-0000-4000-8000-000000000009', true);
  perform testkit.is_eq('matrix: eine gesetzte Mitglieds-Ausnahme taucht mit Namen auf',
    (select count(*) from app.club_module_visibility_matrix(v_club)
      where scope = 'member' and target_label = 'Katrin Grünewald' and override), 1);
end;
$$;
rollback;
