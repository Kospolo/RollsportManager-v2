-- ============================================================================
-- 99e_club_modules.sql — der Modul-Schalter pro Verein (Migration 0044).
--
-- WARUM DIESE DATEI
-- ---------------------------------------------------------------------------
-- Ein Schalter, der behauptet "Modul aus", aber die Daten weiter herausgibt,
-- waere schlimmer als gar kein Schalter: man verlaesst sich darauf. Diese Datei
-- misst deshalb NACH, was der Schalter wirklich tut — und stellt in Block F den
-- Ausfall der Kontrolle nach, statt ihn zu behaupten.
--
-- DIE DREI SYSTEME, DIE HIER AUSEINANDERGEHALTEN WERDEN
-- ---------------------------------------------------------------------------
--   gekauft (app.entitlements / is_club_pro, 0012)
--     UND eingeschaltet (app.club_modules, 0044)
--       UND erlaubt (app.capabilities, 0022-0033)
--   Block D beweist den Punkt, an dem man es falsch machen koennte: der
--   Schalter darf ein PRO-Gate NICHT aufmachen.
--
-- Personas (seed/seed.sql): Verein A = c1ab..01 (RSV Neckarsulm, HAT PRO).
--   Katrin  90..09 / a-09  member
--   Thomas  90..04 / a-04  admin      (is_club_admin -> darf schalten)
--   Sandra  90..01 / a-01  coach      (kein Admin -> darf NICHT schalten)
-- Verein B = deadbeef-00..01 'SC Beispielstadt' (01_fixture_club_b.sql, KEIN
--   PRO-Entitlement). Owner Bert deadbeef-90..01 / Mitglied deadbeef-a0..01.
--
-- Diese Datei ist NEU. Bestands-Tests bleiben unberuehrt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Der Katalog ist vollstaendig und die Etiketten sind entschieden.
--    Kein 'menu_only' aus Versehen: 0044 stuft alle 26 ausdruecklich ein.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('modules: der Katalog hat 26 Module',
    (select count(*) from app.modules), 26);

  perform testkit.is_eq('modules: 3 Kernmodule (members, finance, manage)',
    (select count(*) from app.modules where core), 3);
  perform testkit.is_eq('modules: 20 x enforced',
    (select count(*) from app.modules where enforcement = 'enforced'), 20);
  perform testkit.is_eq('modules: 1 x partial (family)',
    (select count(*) from app.modules where enforcement = 'partial'), 1);
  perform testkit.is_eq('modules: 2 x menu_only (chart, anniversaries)',
    (select count(*) from app.modules where enforcement = 'menu_only'), 2);

  -- core <=> kein Etikett. Der CHECK erzwingt es; hier steht, dass es gilt.
  perform testkit.is_eq('modules: Kernmodul <=> enforcement is null (kein Schalter, keine Aussage)',
    (select count(*) from app.modules where core <> (enforcement is null)), 0);

  -- Die zwei PRO-Module aus 0012 sind als solche vermerkt.
  perform testkit.is_eq('modules: genau 2 PRO-Module (gallery, document)',
    (select count(*) from app.modules where requires_pro), 2);
  perform testkit.is_eq('modules: die PRO-Module sind gallery + document',
    (select count(*) from app.modules where requires_pro and key in ('gallery', 'document')), 2);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DAS ETIKETT GEGEN DIE WIRKLICHKEIT (Muster 93j/0033).
--    Wer Durchsetzung behauptet, muss ein Gate vorweisen — und wer keine
--    behauptet, darf keins haben.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_bad text;
begin
  select string_agg(m.key, ', ') into v_bad
    from app.modules m
   where m.enforcement in ('enforced', 'partial')
     and not exists (select 1 from app.module_policy_usage() u where u.module_key = m.key);

  if v_bad is null then
    perform testkit.ok('modules: jedes durchsetzende Modul hat mindestens ein restriktives Gate');
  else
    perform testkit.fail('modules: jedes durchsetzende Modul hat mindestens ein restriktives Gate',
      format('behauptet Durchsetzung, hat aber kein Gate: %s — 0044 nachziehen', v_bad));
  end if;

  select string_agg(m.key, ', ') into v_bad
    from app.modules m
   where m.enforcement = 'menu_only'
     and exists (select 1 from app.module_policy_usage() u where u.module_key = m.key);

  if v_bad is null then
    perform testkit.ok('modules: kein "menu_only"-Modul haengt heimlich doch an einem Gate');
  else
    perform testkit.fail('modules: kein "menu_only"-Modul haengt heimlich doch an einem Gate',
      format('Etikett "menu_only", aber Gate vorhanden: %s', v_bad));
  end if;

  -- Ein Gate darf nie auf ein Kernmodul zeigen: dessen module_enabled ist
  -- konstant true — das Gate waere toter Code, der Sicherheit vortaeuscht.
  perform testkit.is_eq('modules: kein Gate zeigt auf ein Kernmodul (waere toter Code)',
    (select count(*) from app.module_policy_usage() u
      join app.modules m on m.key = u.module_key where m.core), 0);

  -- Jedes Gate ist RESTRICTIVE. Ein permissives Gate wuerde Zugriff GEBEN
  -- statt zu nehmen — die Umkehrung des Sinns.
  perform testkit.is_eq('modules: jede module_enabled-Policy ist RESTRICTIVE',
    (select count(*) from pg_policies
      where schemaname = 'app'
        and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%module_enabled(%'
        and permissive <> 'RESTRICTIVE'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) DER KERN: Modul aus -> die Daten sind WEG. Modul an -> alles wieder da.
--    Gemessen an 'gallery' (4 Zeilen im Seed) und gegengeprueft an 'documents'
--    (3 Zeilen), das NICHT mitabgeschaltet werden darf.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- Ausgangslage: nie einen Schalter angefasst = alles an (0044: fehlende Zeile = an).
  perform testkit.is_eq('modules: unberuehrt ist "gallery" eingeschaltet',
    (select case when app.module_enabled('c1ab0000-0000-4000-8000-000000000001', 'gallery') then 1 else 0 end), 1);
  perform testkit.is_eq('modules: Mitglied sieht die 4 Galerie-Bilder (Modul an, Verein ist PRO)',
    (select count(*) from app.gallery_items), 4);
end;
$$;

-- Der Admin legt den Schalter um.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
insert into app.club_modules (club_id, module_key, enabled)
values ('c1ab0000-0000-4000-8000-000000000001', 'gallery', false);

-- ... und das Mitglied sieht nichts mehr.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('modules: "gallery" AUS -> das Mitglied sieht 0 Bilder (die Daten sind weg, nicht nur die Kachel)',
    (select count(*) from app.gallery_items), 0);
  perform testkit.is_eq('modules: "gallery" AUS laesst "documents" unberuehrt (3) — ein Gate schaltet kein fremdes Modul mit ab',
    (select count(*) from app.documents), 3);
end;
$$;

-- Auch der Trainer, der die Galerie sonst pflegen darf, kommt nicht mehr rein
-- (das Gate haengt mit UND an der permissiven Policy — es nimmt weg, immer).
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('modules: "gallery" AUS -> auch der Trainer sieht 0 Bilder',
    (select count(*) from app.gallery_items), 0);
  perform testkit.throws('modules: "gallery" AUS -> auch der Trainer kann NICHTS anlegen (42501)',
    $q$insert into app.gallery_items
        (club_id, title, kind, storage_key, content_type, size_bytes, uploaded_by_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Trotzdem', 'photo',
               'gate-test-01.png', 'image/png', 10,
               'a0000000-0000-4000-8000-000000000001')$q$, '42501');
end;
$$;
rollback;

-- Und zurueck: der Schalter ist keine Einbahnstrasse.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
insert into app.club_modules (club_id, module_key, enabled)
values ('c1ab0000-0000-4000-8000-000000000001', 'gallery', false);
update app.club_modules set enabled = true
 where club_id = 'c1ab0000-0000-4000-8000-000000000001' and module_key = 'gallery';

reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('modules: "gallery" wieder AN -> die 4 Bilder sind zurueck',
    (select count(*) from app.gallery_items), 4);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) DER SCHALTER HEBELT DAS PRO-GATE NICHT AUS.
--    Der Punkt, an dem man es falsch machen koennte: Verein B hat KEIN
--    PRO-Entitlement. Sein Owner schaltet 'gallery' ausdruecklich EIN — und es
--    bleibt trotzdem zu. Ohne diesen Block waere "restriktiv" nur behauptet.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
declare
  v_club uuid := 'deadbeef-0000-4000-8000-000000000001';
begin
  -- Ausgangslage belegen: Verein B ist NICHT PRO.
  perform testkit.is_eq('pro-gate: Verein B hat KEIN aktives PRO-Entitlement',
    (select case when app.is_club_pro(v_club) then 1 else 0 end), 0);

  -- Der Owner schaltet das Modul ausdruecklich EIN.
  insert into app.club_modules (club_id, module_key, enabled)
  values (v_club, 'gallery', true);

  perform testkit.is_eq('modules: der Schalter steht bei Verein B auf AN',
    (select case when app.module_enabled(v_club, 'gallery') then 1 else 0 end), 1);

  -- ... und die Galerie bleibt trotzdem zu. Das Entitlement gewinnt.
  perform testkit.is_eq('pro-gate: Schalter AN ohne Entitlement -> die Galerie bleibt ZU (0 Zeilen)',
    (select count(*) from app.gallery_items where club_id = v_club), 0);

  perform testkit.throws('pro-gate: Schalter AN ohne Entitlement -> auch der Owner kann nichts anlegen (42501)',
    format($q$insert into app.gallery_items
        (club_id, title, kind, storage_key, content_type, size_bytes)
       values (%L, 'Ohne Lizenz', 'photo', 'nopro-01.png', 'image/png', 10)$q$, v_club), '42501');

  -- Und die Auskunft an die Clients sagt genau das: eingeschaltet, aber nicht
  -- verfuegbar. Ein UI, das nur `enabled` liest, wuerde hier luegen.
  perform testkit.is_eq('modules: club_module_states meldet enabled=true, pro_ok=false, available=FALSE',
    (select count(*) from app.club_module_states(v_club)
      where module_key = 'gallery' and enabled and not pro_ok and not available), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) DIE SCHUTZLINIEN AM SCHALTER SELBST.
--    Kernmodule sind nicht abschaltbar, und nicht jeder darf schalten.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  -- Kernmodule: der Trigger wirft P0001 — in der DB, nicht im Formular.
  perform testkit.throws('modules: der Admin kann "members" NICHT abschalten (Kernmodul, P0001)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001', 'members', false)$q$, 'P0001');
  perform testkit.throws('modules: der Admin kann "finance" NICHT abschalten (GoBD-Aufbewahrungspflicht, P0001)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001', 'finance', false)$q$, 'P0001');
  perform testkit.throws('modules: der Admin kann "manage" NICHT abschalten (sonst kein Weg zurueck, P0001)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001', 'manage', false)$q$, 'P0001');

  -- Ein Kernmodul EINschalten ist dagegen harmlos und erlaubt (idempotent).
  perform testkit.succeeds('modules: "members" auf AN setzen ist erlaubt (aendert nichts, aber verbietet auch nichts)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001', 'members', true)$q$);

  -- Ein unbekanntes Modul faellt an der FK auf.
  perform testkit.throws('modules: ein unbekannter Modul-Schluessel wird abgewiesen (FK 23503)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001', 'gibtesnicht', false)$q$, '23503');
end;
$$;
rollback;

-- Ein Coach ist kein Vereins-Admin — er darf NICHT schalten.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('modules: ein Coach kann KEIN Modul schalten (RLS 42501)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001', 'chat', false)$q$, '42501');
  -- Lesen darf er: die Clients bauen daraus ihr Menue.
  perform testkit.succeeds('modules: ein Coach DARF die Schalterstellung lesen (fuer sein Menue)',
    $q$select count(*) from app.club_module_states('c1ab0000-0000-4000-8000-000000000001')$q$);
end;
$$;
rollback;

-- Und ein Fremder schaltet gar nichts (Mandantentrennung bleibt unberuehrt).
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('modules: der Owner von Verein B kann in Verein A nichts schalten (RLS 42501)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001', 'chat', false)$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) KANN DIE KONTROLLE ROT WERDEN? Nachgestellt, nicht behauptet.
--
--    Block B schuetzt vor einem Gate, das verschwindet, waehrend das Etikett
--    'enforced' stehen bleibt. Genau dieser Drift wird hier echt herbeigefuehrt:
--    wir werfen das Gate von 'chat' weg und verlangen, dass B das FINDET.
--    Faellt dieser Block, ist die ganze Nachrechnung blind — dann ist Block B
--    eine gruene Kontrolle, die nicht rot werden kann.
--
--    Alles in begin/rollback; das Gate ueberlebt den Test.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('modules: Ausgangslage — "chat" ist als "enforced" etikettiert',
    (select count(*) from app.modules where key = 'chat' and enforcement = 'enforced'), 1);
  perform testkit.is_eq('modules: Ausgangslage — "chat" hat ein Gate',
    (select count(*) from app.module_policy_usage() where module_key = 'chat'), 1);
end;
$$;

-- Der nachgestellte Drift: jemand wirft das Gate weg und vergisst das Etikett.
drop policy chat_messages_module_gate on app.chat_messages;

do $$
declare
  v_bad text;
begin
  -- F1: der Detektor sieht das Gate nicht mehr.
  perform testkit.is_eq('modules: der Detektor bemerkt das entfernte chat-Gate',
    (select count(*) from app.module_policy_usage() where module_key = 'chat'), 0);

  -- F2: und die Kontrolle aus Block B schlaegt an. Wortgleich mit B — hier
  --     MUSS sie einen Treffer liefern, dort KEINEN.
  select string_agg(m.key, ', ') into v_bad
    from app.modules m
   where m.enforcement in ('enforced', 'partial')
     and not exists (select 1 from app.module_policy_usage() u where u.module_key = m.key);

  if v_bad = 'chat' then
    perform testkit.ok('modules: die Kontrolle aus Block B WIRD ROT, wenn ein Gate verschwindet');
  else
    perform testkit.fail('modules: die Kontrolle aus Block B WIRD ROT, wenn ein Gate verschwindet',
      format('erwartet "chat", bekommen: %s', coalesce(v_bad, '<nichts — die Nachrechnung ist BLIND>')));
  end if;
end;
$$;

-- F3: Und die Wirkung selbst faellt weg — der Beweis, dass das Gate (und nicht
--     etwas anderes) die Daten wegnimmt. Ohne Gate bleibt der Chat trotz
--     ausgeschaltetem Schalter lesbar. Genau das ist die Sabotage-Probe:
--     nimmt man den Fix heraus, ist der Schalter wirkungslos.
insert into app.club_modules (club_id, module_key, enabled)
values ('c1ab0000-0000-4000-8000-000000000001', 'chat', false);

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
declare
  v_seen int;
begin
  select count(*) into v_seen from app.chat_messages;
  if v_seen > 0 then
    perform testkit.ok(format(
      'modules: OHNE Gate ist der Schalter wirkungslos (%s Nachrichten trotz "chat"=aus) — der Fix ist also der Wirksame', v_seen));
  else
    perform testkit.fail('modules: OHNE Gate ist der Schalter wirkungslos',
      'der Chat war auch ohne Gate leer — dann misst Block C etwas anderes als das Gate');
  end if;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- G) Die Auskunft fuer die Clients (app.club_module_states) ist vollstaendig
--    und stimmt mit dem Katalog ueberein — das „Mehr"-Raster haengt daran.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('modules: club_module_states liefert alle 26 Module',
    (select count(*) from app.club_module_states('c1ab0000-0000-4000-8000-000000000001')), 26);

  -- Verein A IST PRO -> beide PRO-Module sind verfuegbar.
  perform testkit.is_eq('modules: Verein A ist PRO -> gallery + document sind verfuegbar',
    (select count(*) from app.club_module_states('c1ab0000-0000-4000-8000-000000000001')
      where module_key in ('gallery', 'document') and available), 2);

  -- available ist die UND-Kette, nicht bloss enabled.
  perform testkit.is_eq('modules: available = enabled UND pro_ok (keine Zeile widerspricht)',
    (select count(*) from app.club_module_states('c1ab0000-0000-4000-8000-000000000001')
      where available <> (enabled and pro_ok)), 0);
end;
$$;
rollback;
