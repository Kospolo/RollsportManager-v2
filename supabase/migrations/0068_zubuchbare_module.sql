-- ============================================================================
-- 0068_zubuchbare_module.sql — GALERIE, DOKUMENTE und NOTIZEN sind ZUBUCHBAR.
--
-- ############################################################################
-- ### DER BEFUND #############################################################
-- ############################################################################
-- Der Nutzer war eindeutig: "Galerie ist Pro und Pro muss man erst freischalten;
-- genauso Dokumente — das ist ein Feature, das ein Verein zusaetzlich buchen
-- kann, nicht automatisch aktiviert; genauso Notizen."
--
-- 0044 hat die MECHANIK dafuer schon gebaut (app.club_modules + die restriktiven
-- Gates + app.module_enabled). Was fehlte, war die VOREINSTELLUNG: 0044 legte
-- fest "fehlende Zeile = EINGESCHALTET" (fail-open) — mit der damals richtigen
-- Begruendung, dass ein Modul-Schalter keine Sicherheitsgrenze ist und ein frisch
-- angelegter Verein sonst NICHTS haette.
--
-- Fuer ein ZUBUCHBARES Modul ist genau das aber die falsche Voreinstellung: ein
-- neuer Verein bekaeme Galerie, Dokumente und Notizen geschenkt, obwohl er sie
-- nie gebucht hat. Diese Migration dreht die Voreinstellung — fuer DIESE DREI
-- und nur fuer diese drei.
--
-- ############################################################################
-- ### WAS SICH AENDERT — UND WAS AUSDRUECKLICH NICHT #########################
-- ############################################################################
-- NEU:  app.modules.default_enabled — die Voreinstellung JE MODUL. true fuer die
--       23 Bestands-Module (unveraendertes Verhalten), false fuer gallery,
--       document und notes.
-- NEU:  app.module_enabled faellt nicht mehr pauschal auf `true` zurueck, sondern
--       auf die Voreinstellung des Moduls.
--
-- NICHT: die Gates. gallery_items, documents und notes tragen ihr restriktives
--        Modul-Gate seit 0044 (Abschnitt 8) — es wird hier KEINES neu gebaut und
--        KEINES angefasst. Nur die Antwort von module_enabled aendert sich; die
--        Policies fragen unveraendert dieselbe Funktion.
-- NICHT: das PRO-Gate. gallery/document haengen zusaetzlich an app.is_club_pro
--        (0012). Buchen (Schalter AN) ohne Lizenz bleibt ZU. Die UND-Kette aus
--        0044 gilt weiter: gekauft UND eingeschaltet UND erlaubt.
-- NICHT: die Bestands-Vereine. Abschnitt 3 traegt fuer JEDEN heute existierenden
--        Verein eine ausdrueckliche enabled = true-Zeile nach. Wer die Module
--        heute benutzt, benutzt sie morgen weiter — die neue Voreinstellung gilt
--        nur fuer Vereine, die es noch nicht gibt. Ein stiller Entzug bei einem
--        laufenden Verein waere Datenverlust im Erleben des Nutzers.
--
-- ############################################################################
-- ### DIE NULL-CLUB-FALLE — GEMESSEN, NICHT VERMUTET #########################
-- ############################################################################
-- app.notes.club_id ist NULLABLE (0008:70). Eine Notiz ohne Verein ist eine rein
-- persoenliche Notiz — sie gehoert zu KEINEM Verein und kann deshalb auch von
-- keinem Vereins-Schalter erfasst werden. Ohne Sonderbehandlung wuerde die neue
-- Voreinstellung sie fuer IMMER unsichtbar machen (das Gate fragt
-- module_enabled(NULL,'notes') -> kein club_modules-Treffer -> Voreinstellung
-- false). Gemessen betrifft das den Seed (seed.sql:870, club_id null) und
-- 95_modules_batch1.sql (legt Notizen ohne club_id an).
--
-- Deshalb: p_club_id is null -> true. Das ist keine Luecke, sondern die richtige
-- Aussage. Der Schalter beantwortet "benutzt DIESER VEREIN das Modul" — bei
-- einer vereinslosen Notiz stellt sich die Frage nicht. Die praktische
-- Einbuchung passiert zusaetzlich in der API (assertModuleEnabled auf
-- POST /notes mit club_id) und in der RLS fuer jede Notiz MIT Verein.
--
-- ############################################################################
-- ### WARUM EINE SPALTE UND KEINE LISTE IM FUNKTIONSKOERPER ##################
-- ############################################################################
-- Ein `when p_module_key in ('gallery','document','notes') then false` waere die
-- zweite Wahrheit neben dem Katalog: das Admin-UI muesste dieselbe Liste noch
-- einmal kennen, um "zubuchbar" beschriften zu koennen, und beide koennten
-- auseinanderlaufen. Die Spalte ist EIN Ort, den Katalog, Gate und UI gemeinsam
-- lesen — dasselbe Muster wie core/requires_pro/enforcement in 0044.
--
-- LIES 0044 GANZ, bevor du hier etwas aenderst.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Die Voreinstellung je Modul. Default true = jedes Bestands-Modul behaelt
--    sein Verhalten; nur wer ausdruecklich auf false gesetzt wird, ist zubuchbar.
-- ----------------------------------------------------------------------------
alter table app.modules
  add column if not exists default_enabled boolean not null default true;

comment on column app.modules.default_enabled is
  'Voreinstellung fuer einen Verein OHNE eigene club_modules-Zeile. true = von Haus aus an (die Regel). false = ZUBUCHBAR: ein neuer Verein hat das Modul aus, bis er es bucht (Galerie, Dokumente, Notizen — 0068). Gelesen von app.module_enabled; NICHT von der Autorisierung — das Gate bleibt die restriktive Policy aus 0044.';

update app.modules
   set default_enabled = false
 where key in ('gallery', 'document', 'notes');

-- ----------------------------------------------------------------------------
-- 2. Das Gate. Einzige Aenderung gegenueber 0044: der Rueckfall ist nicht mehr
--    das Literal `true`, sondern die Voreinstellung des Moduls — plus die
--    NULL-Club-Regel aus dem Kopf.
--
--    Bauform, Volatilitaet (stable) und SECURITY DEFINER bleiben unveraendert:
--    die Funktion haengt in ~35 restriktiven Policies, sie darf sich nicht anders
--    verhalten als dort erwartet.
-- ----------------------------------------------------------------------------
create or replace function app.module_enabled(p_club_id uuid, p_module_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- Kein Verein, kein Vereins-Schalter. Betrifft app.notes.club_id is null
    -- (persoenliche Notiz ohne Verein) — siehe NULL-CLUB-FALLE im Kopf.
    when p_club_id is null
      then true
    -- Unbekannter Schluessel: kein Katalog-Eintrag, kein Schalter, kein Gate.
    when not exists (select 1 from app.modules m where m.key = p_module_key)
      then true
    -- Kernmodul: immer an (der Guard verhindert die Zeile, das Gate antwortet
    -- auch bei einer aelteren Bestandszeile richtig).
    when (select m.core from app.modules m where m.key = p_module_key)
      then true
    -- Sonst: der Schalter des Vereins. Fehlende Zeile = die VOREINSTELLUNG des
    -- Moduls (0068) — fuer die zubuchbaren Module also AUS.
    else coalesce(
      (select cm.enabled from app.club_modules cm
        where cm.club_id = p_club_id and cm.module_key = p_module_key),
      (select m.default_enabled from app.modules m where m.key = p_module_key))
  end
$$;

comment on function app.module_enabled(uuid, text) is
  'Benutzt der Verein dieses Modul? Das eine Gate hinter jeder restriktiven Modul-Policy. Fehlende Zeile = app.modules.default_enabled (seit 0068: true fuer die Regel, false fuer die zubuchbaren Module Galerie/Dokumente/Notizen). p_club_id null = true (vereinslose Notiz). Kernmodule und unbekannte Schluessel = immer true. Kann NIE etwas erlauben, was eine permissive Policy verbietet (restriktive Policies haengen mit UND an).';

-- ----------------------------------------------------------------------------
-- 3. Der Bestands-Backfill. Jeder heute existierende Verein bekommt fuer die drei
--    Module eine ausdrueckliche Zeile — mit dem Wert, den er HEUTE effektiv hat.
--    Damit ist die Migration fuer Bestands-Vereine verhaltensneutral und die neue
--    Voreinstellung wirkt ausschliesslich auf kuenftige Vereine.
--
--    on conflict do nothing: wer den Schalter schon einmal angefasst hat (auch
--    auf false), behaelt seine Entscheidung. Eine Migration ueberstimmt den
--    Vereins-Admin nicht.
-- ----------------------------------------------------------------------------
insert into app.club_modules (club_id, module_key, enabled)
select c.id, m.key, true
  from app.clubs c
 cross join (values ('gallery'), ('document'), ('notes')) as m(key)
on conflict (club_id, module_key) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Die Auskunft fuer die Clients. `default_enabled` kommt mit, damit Web und
--    iOS den Zustand EHRLICH beschriften koennen: ein Modul, das nie gebucht
--    wurde, ist nicht "kaputt" und nicht "leer" — es ist NICHT GEBUCHT, und der
--    Client kann sagen, wie man es bucht.
--
--    Rueckgabetyp aendert sich -> drop + create (create or replace kann den
--    Record-Typ einer Funktion nicht umbauen).
-- ----------------------------------------------------------------------------
drop function if exists app.club_module_states(uuid);

create function app.club_module_states(p_club_id uuid)
returns table (
  module_key      text,
  label_de        text,
  label_en        text,
  desc_de         text,
  desc_en         text,
  sort            int,
  core            boolean,
  requires_pro    boolean,
  enforcement     app.module_enforcement,
  default_enabled boolean,
  enabled         boolean,
  pro_ok          boolean,
  available       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.key, m.label_de, m.label_en, m.desc_de, m.desc_en, m.sort,
         m.core, m.requires_pro, m.enforcement, m.default_enabled,
         app.module_enabled(p_club_id, m.key) as enabled,
         (not m.requires_pro or app.is_club_pro(p_club_id)) as pro_ok,
         (app.module_enabled(p_club_id, m.key)
          and (not m.requires_pro or app.is_club_pro(p_club_id))) as available
  from app.modules m
  order by m.sort, m.key
$$;

comment on function app.club_module_states(uuid) is
  'Modul-Katalog + Schalterstellung + PRO-Verfuegbarkeit fuer EINEN Verein. Quelle fuer GET /clubs/{clubId}/modules und das "Mehr"-Raster. `available` = gekauft UND eingeschaltet. `default_enabled` = false kennzeichnet ein ZUBUCHBARES Modul (0068) — der Client sagt dann "nicht gebucht" statt "leer".';

-- ----------------------------------------------------------------------------
-- 5. Die Nachrechnung. Eine Voreinstellung "aus" ohne Gate waere eine Behauptung
--    ohne Deckung: das UI wuerde "nicht gebucht" sagen, die Daten kaemen aber
--    weiter heraus. Genau die Sorte gruene Kontrolle, die nicht rot werden kann.
-- ----------------------------------------------------------------------------
do $$
declare
  v_bookable int;
begin
  select count(*) into v_bookable from app.modules where not default_enabled;
  if v_bookable <> 3 then
    raise exception
      '0068: erwartet 3 zubuchbare Module (gallery, document, notes), gezaehlt: %', v_bookable
      using hint = 'Ein weiteres Modul zubuchbar gemacht? Dann gehoert es hier hoch — und in 99oA_zubuchbare_module.sql.';
  end if;

  -- Ein zubuchbares Modul MUSS ein echtes Gate haben, sonst ist "nicht gebucht"
  -- gelogen (Muster 0044 Abschnitt 9 / 0033).
  if exists (
    select 1 from app.modules m
     where not m.default_enabled
       and not exists (select 1 from app.module_policy_usage() u where u.module_key = m.key)
  ) then
    raise exception '0068: ein zubuchbares Modul hat KEIN Gate: %',
      (select string_agg(m.key, ', ') from app.modules m
        where not m.default_enabled
          and not exists (select 1 from app.module_policy_usage() u where u.module_key = m.key));
  end if;

  -- ... und darf kein Kernmodul sein (dessen Gate ist konstant true).
  if exists (select 1 from app.modules where not default_enabled and core) then
    raise exception '0068: ein Kernmodul kann nicht zubuchbar sein (sein Gate ist konstant true)';
  end if;

  -- Der Backfill hat jeden Bestands-Verein erfasst.
  if exists (
    select 1 from app.clubs c
    cross join (values ('gallery'), ('document'), ('notes')) as m(key)
     where not exists (select 1 from app.club_modules cm
                        where cm.club_id = c.id and cm.module_key = m.key)
  ) then
    raise exception '0068: Backfill unvollstaendig — ein Bestands-Verein haette ein Modul still verloren';
  end if;
end $$;

-- Der Stolperdraht aus 0030 — ans Ende JEDER Migration.
select app.assert_no_insecure_views();

commit;
