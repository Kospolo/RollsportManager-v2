-- ============================================================================
-- 0061_finanz_abschaltbar.sql — 'finance' wird ein ABSCHALTBARES Modul.
--
-- ############################################################################
-- ### WARUM DAS GoBD-SICHER IST — BITTE ZUERST LESEN #########################
-- ############################################################################
-- 0044 fuehrte 'finance' als KERNMODUL (core = true, nicht abschaltbar) mit der
-- Begruendung GoBD / AO §147 / HGB §257: Buchungsbelege muessen 10 Jahre lang
-- lesbar und auswertbar bleiben. Diese Begruendung war zu grob.
--
-- Die AUFBEWAHRUNG haengt NICHT am Modul-Schalter. Sie ist durch die
-- append-only-Trigger auf app.ledger_entries (0005) gesichert: das Kassenbuch
-- ist unveraenderlich und wird NIE geloescht, voellig unabhaengig davon, ob das
-- Modul ein- oder ausgeschaltet ist. Der Schalter verbirgt nur die ANZEIGE und
-- den Zugriff ueber die API — die DATEN bleiben Byte fuer Byte in der DB.
-- Wieder-Einschalten macht alles wieder sichtbar. Es geht nichts verloren.
--
-- Fachlich: nicht jeder Verein fuehrt seine Finanzen mit dieser App. Wer es
-- nicht tut, soll nichts Finanzielles sehen — und darf das abschalten, ohne
-- eine Aufbewahrungspflicht zu verletzen, denn es wird nichts aufgehoben, was
-- die App verwahrt: leere Finanztabellen kann man nicht "nicht aufbewahren".
-- Hat ein Verein doch gebucht und schaltet dann ab, bleiben die Buchungen in
-- der DB (der Beweis steht in 99j_finanz_abschaltbar.sql: select count(*) > 0
-- bei ausgeschaltetem Modul).
--
-- ############################################################################
-- ### members / manage BLEIBEN KERN — NUR finance wird abschaltbar ###########
-- ############################################################################
-- 'members' (sonst sperrt sich der Verein aus) und 'manage' (sonst gibt es
-- keinen Weg zurueck zum Schalter) bleiben core = true. Der Kernmodul-Schutz
-- app.club_modules_guard() (0044) ist DATENGETRIEBEN (er liest app.modules.core)
-- — er blockt nach dieser Migration weiterhin members/manage, laesst finance
-- aber durch, weil finance.core jetzt false ist. Wir korrigieren nur den
-- Hinweistext der Funktion (er nannte Finanzen als "immer an").
--
-- ############################################################################
-- ### DIE DURCHSETZUNG — enforced, nicht nur menu_only #######################
-- ############################################################################
-- finance bekommt das Etikett 'enforced' und dafuer restriktive RLS-Gates auf
-- allen Finanztabellen (wie 0044 es fuer die 20 abschaltbaren Module tat). AUS
-- = jeder Lesezugriff liefert 0 Zeilen, jeder Schreibzugriff scheitert (42501).
--
-- ABER: 0044 nennt eine ehrliche Grenze der RLS-Variante — service_role hat
-- BYPASSRLS. Vier Finanz-Endpunkte laufen heute im Service-Mode und umgehen die
-- Gates: reports/summary (offene Rechnungen), reports/annual (Jahresabschluss),
-- invoices POST (Rechnungsnummern-Sequenz), donations POST (Spenden-Sequenz),
-- budgets report. Anders als bei 'family' (dort ist der Service-Pfad GEWOLLT
-- offen -> 'partial') SOLL finance vollstaendig dicht sein. Deshalb bekommen
-- genau diese Endpunkte einen EXPLIZITEN Modul-Check im Code
-- (app.module_enabled(club_id,'finance')), sodass 'enforced' auch dort haelt.
-- Das Etikett bleibt 'enforced': der RLS-Weg ist vollstaendig gegated, und die
-- Handvoll Service-Pfade sind im Code nachgezogen (dokumentiert an jeder Route).
--
-- LIES 0044 GANZ, bevor du hier etwas aenderst — Bauform, restrictive-Semantik
-- und die module_policy_usage()-Nachrechnung stehen dort.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. finance wird abschaltbar. Der CHECK modules_core_has_no_switch (0044)
--    verlangt: (core und enforcement is null) ODER (nicht core und enforcement
--    ist gesetzt). core=false + enforcement='enforced' erfuellt ihn.
-- ----------------------------------------------------------------------------
update app.modules
   set core = false, enforcement = 'enforced'
 where key = 'finance';

comment on column app.modules.core is
  'Kernmodul: NICHT abschaltbar. Nach 0061 nur noch Mitglieder (sonst sperrt sich der Verein aus) und Verwaltung (sonst kein Weg zurueck). Finanzen wurde abschaltbar gemacht — die Aufbewahrung haengt an den ledger-append-only-Triggern (0005), NICHT am Schalter. Erzwungen von app.club_modules_guard().';

-- ----------------------------------------------------------------------------
-- 2. Der Kernmodul-Schutz — Funktion unveraendert (sie liest core dynamisch),
--    nur der Hinweistext wird korrigiert: Finanzen ist nicht mehr "immer an".
-- ----------------------------------------------------------------------------
create or replace function app.club_modules_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_core boolean;
begin
  select m.core into v_core from app.modules m where m.key = new.module_key;

  if v_core and not new.enabled then
    raise exception
      'Das Modul "%" ist ein Kernmodul und kann nicht abgeschaltet werden. / Module "%" is a core module and cannot be switched off.',
      new.module_key, new.module_key
      using errcode = 'P0001',
            hint = 'Mitglieder (sonst sperrt sich der Verein aus) und Verwaltung (sonst gibt es keinen Weg zurueck) bleiben immer an. Finanzen ist seit 0061 abschaltbar (Aufbewahrung sichern die ledger-append-only-Trigger, nicht der Schalter).';
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. DIE GATES. Eine restriktive Policy je Finanztabelle — genau die Bauform
--    aus 0044 (Abschnitt 8). Bewusst NUR die Datentabellen mit echtem Inhalt;
--    die reinen Sequenz-Halter (invoice_counters, donation_receipt_counters)
--    werden ausgelassen: sie tragen keine Nutzerdaten und werden nur ueber
--    SECURITY-DEFINER-Nummernfunktionen im Service-Mode beruehrt (RLS greift
--    dort ohnehin nicht) — ein Gate waere dort wirkungslose Kosmetik.
--
--    Gemessen (nicht vermutet): keine dieser Tabellen wird in der RLS-Policy
--    einer NICHT-Finanztabelle referenziert; die Treffer im Repo sind ein
--    Kommentar (0020) und eine FK-Spalte (0013). Ein finance-Gate kann damit
--    kein fremdes Modul heimlich mitabschalten (0044-Kaskadenanalyse).
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('invoices',              'finance'),
      ('ledger_entries',        'finance'),
      ('ledger_categories',     'finance'),
      ('dunning_log',           'finance'),
      ('member_fees',           'finance'),
      ('membership_categories', 'finance'),
      ('family_discounts',      'finance'),
      ('sepa_mandates',         'finance'),
      ('bank_transactions',     'finance'),
      ('donations',             'finance'),
      ('budgets',               'finance')
    ) as t(tbl, module_key)
  loop
    if (select m.core from app.modules m where m.key = r.module_key) then
      raise exception 'Modul-Gate: Tabelle app.% zeigt auf das Kernmodul "%"', r.tbl, r.module_key;
    end if;
    execute format(
      'drop policy if exists %I on app.%I', r.tbl || '_module_gate', r.tbl);
    execute format(
      'create policy %I on app.%I as restrictive for all
         using (app.module_enabled(club_id, %L))
         with check (app.module_enabled(club_id, %L))',
      r.tbl || '_module_gate', r.tbl, r.module_key, r.module_key);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Die Nachrechnung (wie 0044 Abschnitt 9 + der Katalog-Check): 'finance' ist
--    jetzt kein Kernmodul mehr, behauptet 'enforced' und MUSS also mindestens
--    ein Gate haben; kein Gate darf auf ein Kernmodul zeigen.
-- ----------------------------------------------------------------------------
do $$
declare
  v_core int;
  v_enf  int;
begin
  select count(*) into v_core from app.modules where core;
  if v_core <> 2 then
    raise exception 'finance-Migration: erwartet 2 Kernmodule (members, manage), gezaehlt: %', v_core;
  end if;

  -- finance ist enforced und hat ein Gate.
  if not exists (select 1 from app.module_policy_usage() u where u.module_key = 'finance') then
    raise exception 'finance-Migration: finance ist "enforced", hat aber KEIN Gate';
  end if;

  -- Kein Gate zeigt auf ein Kernmodul (waere toter Code, taeuscht Sicherheit vor).
  select count(*) into v_enf
    from app.module_policy_usage() u join app.modules m on m.key = u.module_key where m.core;
  if v_enf <> 0 then
    raise exception 'finance-Migration: ein Gate zeigt auf ein Kernmodul (toter Code)';
  end if;

  -- Jedes 'enforced'/'partial'-Modul hat weiterhin mindestens ein Gate (0044-Invariante).
  if exists (
    select 1 from app.modules m
     where m.enforcement in ('enforced', 'partial')
       and not exists (select 1 from app.module_policy_usage() u where u.module_key = m.key)
  ) then
    raise exception 'finance-Migration: ein durchsetzendes Modul hat kein Gate: %',
      (select string_agg(m.key, ', ') from app.modules m
        where m.enforcement in ('enforced', 'partial')
          and not exists (select 1 from app.module_policy_usage() u where u.module_key = m.key));
  end if;
end $$;

-- Der Stolperdraht aus 0030 — ans Ende JEDER Migration.
select app.assert_no_insecure_views();

commit;
