-- ============================================================================
-- 0044_club_modules.sql — MODUL-SCHALTER PRO VEREIN.
--
-- Ein Verein schaltet Module ein und aus. Das gab es bisher UEBERHAUPT NICHT:
-- gesucht wurde in information_schema nach %modul%/%feature%/%flag% — kein
-- club_modules, keine Feature-Tabelle. Die Plattform-Flags (FlagsPanel,
-- /platform/settings) sind GLOBAL, nicht pro Verein.
--
-- ############################################################################
-- ### DIE ABGRENZUNG — BITTE VOR DEM NAECHSTEN UMBAU LESEN ###################
-- ############################################################################
-- Es gibt jetzt DREI Systeme. Sie beantworten DREI VERSCHIEDENE Fragen und
-- duerfen nicht ineinander aufgeloest werden:
--
--   1. GEKAUFT?      app.entitlements / app.is_club_pro (0006, 0012)
--                    "Hat der Verein die Funktion lizenziert?"
--                    Wird vom BETREIBER gesetzt (Vertrag, Abo). Der Verein
--                    kann sie sich nicht selbst geben.
--
--   2. EINGESCHALTET? app.club_modules / app.module_enabled (DIESE Migration)
--                    "Will der Verein die Funktion ueberhaupt benutzen?"
--                    Wird vom VEREINS-ADMIN gesetzt. Ein kleiner Verein ohne
--                    Wettkampfbetrieb schaltet 'competition' ab und hat Ruhe.
--
--   3. ERLAUBT?       app.capabilities / roles / role_permissions (0022–0033)
--                    "Darf DIESE PERSON die Funktion benutzen — und wie weit?"
--                    Wird vom Vereins-Admin je Rolle gesetzt.
--
-- Die Reihenfolge ist eine UND-Kette, kein Ersatz voneinander:
--
--      gekauft  UND  eingeschaltet  UND  erlaubt   ->  Zugriff
--
-- ### EIN MODUL-SCHALTER HEBELT EIN PRO-GATE NICHT AUS ###
-- Das ist der Punkt, an dem man es falsch machen koennte. 'gallery' und
-- 'document' haengen seit 0012 an app.is_club_pro. Der Schalter kommt als
-- ZUSAETZLICHE restriktive Bedingung DAZU — er kann nur wegnehmen, nie geben:
--
--   gallery_items lesbar  <=>  is_club_member  AND is_club_pro   (0012, permissiv)
--                          AND module_enabled(club_id,'gallery')  (hier, RESTRIKTIV)
--
-- Schalter AN ohne Entitlement = weiterhin ZU (is_club_pro ist false).
-- Schalter AUS mit Entitlement = ZU (module_enabled ist false).
-- Beides ist in 99e_club_modules.sql nachgemessen, nicht behauptet.
--
-- Warum das technisch NICHT umgangen werden kann: eine RESTRICTIVE Policy wird
-- mit UND an alle permissiven Policies angehaengt (Postgres-Semantik). Es gibt
-- keine Formulierung, mit der eine restriktive Policy etwas ERLAUBT, das eine
-- permissive verbietet. Der Schalter ist damit strukturell unfaehig, ein Gate
-- aufzumachen. Genau deshalb diese Bauform und nicht ein Umschreiben der
-- bestehenden Policies (das haette 0012 aufweichen KOENNEN).
--
-- ############################################################################
-- ### WARUM RESTRIKTIVE POLICIES UND NICHT EIN API-GATE ######################
-- ############################################################################
-- Die Vorgabe war ausdruecklich: serverseitig, nicht nur im Menue. v1 hatte die
-- Rechte NUR clientseitig — genau das war der Fehler.
--
-- Ein API-Gate (requireModule in jeder Route) haette drei Nachteile:
--   * es muesste in ~25 Route-Dateien eingebaut und dort auf Dauer gepflegt
--     werden; eine neue Route ohne Gate ist ein stilles Loch,
--   * es wirkt nur fuer die Web/iOS-Clients, nicht fuer jeden anderen Zugriff,
--   * es ist genau die Bauform, die schon einmal vergessen wurde.
-- Die RLS-Variante gilt fuer JEDE Route — auch fuer die, die noch niemand
-- geschrieben hat. Sie ist deshalb der Ort mit der laengeren Halbwertszeit.
--
-- EHRLICH BENANNT — die zwei Grenzen der RLS-Variante:
--   (a) service_role hat BYPASSRLS (db.ts:17). Wer withServiceRole benutzt,
--       umgeht auch den Modul-Schalter. Gemessen betrifft das reports.ts
--       (Auswertung, Jubilaeen) und family.ts (Selbstbedienung) — deshalb
--       tragen genau diese Module unten KEIN 'enforced'.
--   (b) Ein abgeschaltetes Modul liefert beim LESEN 0 Zeilen (die Daten sind
--       weg), keinen HTTP-Fehlercode; Schreiben scheitert mit 42501 -> 403.
--       Das ist keine Schoenrederei, sondern die Bauform: das Gate sitzt unter
--       der Route. Die Clients erfahren den Zustand ueber
--       GET /clubs/{clubId}/modules, nicht ueber einen Fehler.
--
-- ############################################################################
-- ### DIE EHRLICHEN ETIKETTEN (Muster aus 0033) ##############################
-- ############################################################################
-- 0033 hat fuer die Faehigkeiten vorgemacht, was hier genauso noetig ist: ein
-- Schalter, der nur das Menue versteckt, darf NICHT als "aus" beschriftet
-- werden. app.modules.enforcement sagt dem UI, was der Schalter WIRKLICH tut:
--
--   'enforced'  Der Schalter wirkt in der DATENBANK. Aus = jeder Lesezugriff
--               liefert 0 Zeilen, jeder Schreibzugriff scheitert (42501/403).
--               Keine Route kann das umgehen (ausser service_role).
--   'partial'   RLS greift, ABER mindestens ein Server-Pfad umgeht sie
--               (withServiceRole). Aus ist hier KEIN vollstaendiger Entzug.
--   'menu_only' Der Schalter versteckt NUR die Kachel. Die Daten bleiben per
--               API abrufbar. Das UI MUSS das so sagen ("wirkt noch nicht"),
--               nicht "Kein Zugriff".
--   NULL        Kernmodul — es gibt gar keinen Schalter (core = true).
--               Ein CHECK erzwingt: core <=> enforcement is null. Damit kann
--               die Frage "was bewirkt der Schalter" bei Kernmodulen nicht
--               falsch beantwortet werden — sie stellt sich nicht.
--
-- Damit das Etikett nicht still driftet, kommt — wie in 0033 — eine Funktion
-- mit, die die BEHAUPTUNG gegen pg_policies nachrechnet:
--   app.module_policy_usage() -> (module_key, cmd, object)
-- Test 99e haengt daran und wird ROT, sobald jemand ein Gate entfernt und das
-- Etikett stehen laesst. Nachgestellt statt behauptet (99e Block E).
--
-- ############################################################################
-- ### KERNMODULE — WARUM DIESE DREI NICHT ABSCHALTBAR SIND ###################
-- ############################################################################
--   'members'  Ohne Mitgliederverwaltung ist kein Verein administrierbar. Wer
--              sie abschaltet, nimmt sich die Grundlage jeder anderen Funktion
--              (Rollen haengen an club_members) — der Verein sperrt sich selbst
--              aus und koennte es nicht einmal rueckgaengig machen.
--   'finance'  Aufbewahrungspflicht. GoBD / AO §147 / HGB §257 verlangen, dass
--              Buchungsbelege 10 Jahre lang lesbar und maschinell auswertbar
--              bleiben. Ein Schalter, der Rechnungen und Buchungen unsichtbar
--              macht, wuerde diese Pflicht verletzen — auch wenn die Daten
--              physisch noch da sind. Deshalb: gar nicht erst anbieten.
--   'manage'   Die Verwaltung ist der Ort, an dem die Schalter selbst stehen.
--              Waere sie abschaltbar, gaebe es keinen Weg zurueck (ein
--              Ausschalten waere unumkehrbar).
--
-- Das ist nicht nur Kosmetik im UI: app.club_modules_guard() weist ein
-- enabled = false auf einem Kernmodul mit P0001 ab. Der Schutz sitzt in der
-- Datenbank, nicht im Formular.
--
-- ############################################################################
-- ### DER KATALOG — HERKUNFT ################################################
-- ############################################################################
-- Die 26 Module sind die Kacheln des "Mehr"-Rasters
-- (apps/web/app/(portal)/mehr/i18n.ts + MehrHub.tsx AVAILABLE). Die Schluessel
-- sind woertlich die Tile-Keys, die Texte woertlich die dortigen Strings —
-- damit Raster und Schalter dieselbe Wahrheit benutzen und nicht auseinander
-- laufen.
--
-- ### KEINE NEUE FAEHIGKEIT — BEWUSST ###
-- Das Schreib-Gate auf app.club_modules ist app.is_club_admin (owner/admin/
-- moderator), NICHT has_cap(...,'club_settings',...). Grund, gemessen: 0033
-- stuft 'club_settings' als 'unenforced' ein, und 93j prueft, dass keine
-- Faehigkeit in einer Policy vorkommt, die als wirkungslos etikettiert ist —
-- ein has_cap('club_settings') hier wuerde 93j rot machen. Eine NEUE Faehigkeit
-- ginge auch nicht: 0033 zaehlt den Katalog auf genau 32 ab (raise exception)
-- und 93j prueft die 32 ebenfalls. is_club_admin ist zugleich deckungsgleich
-- mit dem Gate der Rollen-Verwaltung (roles >= manage), also fachlich richtig:
-- wer die Rollen des Vereins stellen darf, darf auch die Module stellen.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Das Etikett. Eigener Enum statt text — ein Tippfehler soll die Migration
--    fallen lassen, nicht stillschweigend ein Etikett erfinden (Muster 0033).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'app' and t.typname = 'module_enforcement') then
    create type app.module_enforcement as enum ('enforced', 'partial', 'menu_only');
  end if;
end $$;

comment on type app.module_enforcement is
  'Was der Modul-Schalter WIRKLICH bewirkt: enforced = RLS (aus = 0 Zeilen + Schreibfehler) · partial = RLS greift, aber ein Server-Pfad umgeht sie (service_role) · menu_only = versteckt nur die Kachel. Für die WAHRHEITSGEMÄSSE Beschriftung im Admin-UI — nie für Autorisierung.';

-- ----------------------------------------------------------------------------
-- 2. app.modules — der Katalog. Global + statisch geseedet (wie app.capabilities
--    aus 0022): die Module sind eine Eigenschaft der Software, nicht des Vereins.
--    Was der EINZELNE Verein damit macht, steht in app.club_modules.
-- ----------------------------------------------------------------------------
create table if not exists app.modules (
  key          text primary key,
  label_de     text not null,
  label_en     text not null,
  desc_de      text not null,
  desc_en      text not null,
  sort         int  not null default 0,
  -- Kernmodul: kein Schalter. Siehe Begruendung im Kopf.
  core         boolean not null default false,
  -- PRO-Modul: haengt zusaetzlich an app.is_club_pro (0012). Rein deskriptiv —
  -- das echte Gate steht in den Policies von 0012 und bleibt dort.
  requires_pro boolean not null default false,
  enforcement  app.module_enforcement,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint modules_key_format check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  -- Kernmodul <=> kein Schalter <=> keine Aussage ueber dessen Wirkung.
  -- Verhindert die Sorte Unsinn, die 0033 bei den Faehigkeiten haendisch
  -- ausschliessen musste ("members ist enforced" — der Schalter existiert nicht).
  constraint modules_core_has_no_switch
    check ((core and enforcement is null) or (not core and enforcement is not null))
);

create trigger modules_set_updated_at
  before update on app.modules
  for each row execute function app.set_updated_at();

comment on table app.modules is
  'Modul-Katalog (die Kacheln des „Mehr"-Rasters). Global + statisch geseedet. Beantwortet „welche Module GIBT es" — nicht „hat der Verein sie gekauft" (app.entitlements) und nicht „darf die Person sie benutzen" (app.capabilities).';
comment on column app.modules.core is
  'Kernmodul: NICHT abschaltbar (Mitglieder = sonst sperrt sich der Verein aus · Finanzen = GoBD/AO §147 Aufbewahrungspflicht · Verwaltung = sonst gibt es keinen Weg zurück). Erzwungen von app.club_modules_guard(), nicht nur im Formular.';
comment on column app.modules.requires_pro is
  'PRO-Modul: hängt ZUSÄTZLICH an app.is_club_pro (0012). Deskriptiv — das Gate selbst bleibt in den Policies von 0012. Schalter AN ohne Entitlement = weiterhin zu.';
comment on column app.modules.enforcement is
  'Was der Schalter WIRKLICH bewirkt (Muster 0033). NULL = Kernmodul, es gibt keinen Schalter. Nachgerechnet von app.module_policy_usage() + Test 99e.';

alter table app.modules enable row level security;

-- Der Katalog ist fuer jede angemeldete Person lesbar: die Clients brauchen
-- Labels und Etiketten, um das Raster ueberhaupt beschriften zu koennen. Er
-- enthaelt keine Vereinsdaten. Geschrieben wird er nur von Migrationen (der
-- Tabellen-Owner umgeht RLS ohnehin) — deshalb bewusst KEINE Schreib-Policy:
-- kein Client-Pfad soll den Katalog aendern koennen.
create policy modules_select on app.modules
  for select to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- 3. app.club_modules — der Schalter je Verein.
--
--    ### FEHLENDE ZEILE = EINGESCHALTET ###
--    Bewusst fail-OPEN, und das ist hier kein Widerspruch zu "im Zweifel
--    strenger": ein Modul-Schalter ist KEINE Sicherheitsgrenze. Die Grenzen
--    sind Entitlement (gekauft), RLS-Mandantentrennung (fremder Verein) und
--    Faehigkeit (erlaubt) — die bleiben alle fail-closed. Der Schalter sagt nur
--    "wir benutzen das hier nicht".
--    Fail-closed waere hier sogar schaedlich: ein frisch angelegter Verein
--    haette NICHTS, und jede Bestandszeile muesste rueckwirkend erzeugt werden.
--    So gilt: wer nie einen Schalter angefasst hat, hat alles an — der Zustand
--    von heute, unveraendert.
-- ----------------------------------------------------------------------------
create table if not exists app.club_modules (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete cascade,
  module_key text not null references app.modules (key) on delete restrict,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_modules_club_module_uq unique (club_id, module_key)
);

-- Der Index, den app.module_enabled bei JEDER Policy-Auswertung trifft.
create index if not exists club_modules_lookup_idx
  on app.club_modules (club_id, module_key);

create trigger club_modules_set_updated_at
  before update on app.club_modules
  for each row execute function app.set_updated_at();

comment on table app.club_modules is
  'Modul-Schalter je Verein: OB der Verein ein Modul benutzt. FEHLENDE ZEILE = EINGESCHALTET (fail-open, bewusst: der Schalter ist keine Sicherheitsgrenze — Entitlement/RLS/Fähigkeit bleiben fail-closed). Kernmodule (app.modules.core) lassen sich nicht abschalten.';

-- ----------------------------------------------------------------------------
-- 4. Der Kernmodul-Schutz. In der DATENBANK, nicht im Formular: ein direkter
--    API- oder SQL-Aufruf soll ein Kernmodul genauso wenig abschalten koennen
--    wie ein Klick im UI.
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
            hint = 'Mitglieder (sonst sperrt sich der Verein aus), Finanzen (GoBD/AO §147 Aufbewahrungspflicht) und Verwaltung (sonst gibt es keinen Weg zurück) bleiben immer an.';
  end if;

  return new;
end;
$$;

comment on function app.club_modules_guard() is
  'Weist das Abschalten eines Kernmoduls mit P0001 ab. Sitzt in der DB, damit ein direkter API-Aufruf am UI vorbei genauso scheitert wie der Klick.';

drop trigger if exists club_modules_guard on app.club_modules;
create trigger club_modules_guard
  before insert or update on app.club_modules
  for each row execute function app.club_modules_guard();

-- ----------------------------------------------------------------------------
-- 5. RLS auf dem Schalter selbst.
--    Lesen  : jedes Mitglied — die Clients muessen ihr Menue bauen koennen.
--    Stellen: app.is_club_admin (owner/admin/moderator). Warum nicht has_cap:
--             siehe "KEINE NEUE FAEHIGKEIT" im Kopf (93j/0033 zaehlen den
--             Faehigkeiten-Katalog exakt ab).
-- ----------------------------------------------------------------------------
alter table app.club_modules enable row level security;

create policy club_modules_select on app.club_modules
  for select to authenticated
  using (app.is_club_member(club_id) or app.is_platform_admin());

create policy club_modules_insert on app.club_modules
  for insert to authenticated
  with check (app.is_club_admin(club_id));

create policy club_modules_update on app.club_modules
  for update to authenticated
  using (app.is_club_admin(club_id))
  with check (app.is_club_admin(club_id));

create policy club_modules_delete on app.club_modules
  for delete to authenticated
  using (app.is_club_admin(club_id));

grant select, insert, update, delete on app.club_modules to authenticated;
grant select on app.modules to authenticated;

-- ----------------------------------------------------------------------------
-- 6. app.module_enabled — DAS Gate. Eine Funktion, ein Ort.
--
--    SECURITY DEFINER wie app.is_club_pro (0012): die Auskunft muss fuer jedes
--    Mitglied funktionieren, unabhaengig von dessen Grants auf club_modules.
--    STABLE, damit der Planner sie je Zeile cachen kann — sie haengt in vielen
--    Policies.
--
--    Enthaelt bewusst KEIN has_cap/cap_rank: app.capability_policy_usage()
--    (0033) scannt app-Funktionen nach genau diesen Literalen. Ein has_cap hier
--    wuerde 93j eine Faehigkeit unterschieben, die dort nicht hingehoert.
-- ----------------------------------------------------------------------------
create or replace function app.module_enabled(p_club_id uuid, p_module_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- Unbekannter Schluessel: kein Katalog-Eintrag, kein Schalter, kein Gate.
    when not exists (select 1 from app.modules m where m.key = p_module_key)
      then true
    -- Kernmodul: immer an. Der Guard verhindert die Zeile zwar schon, aber das
    -- Gate soll auch dann richtig antworten, wenn eine Bestandszeile aelter ist
    -- als der core-Beschluss.
    when (select m.core from app.modules m where m.key = p_module_key)
      then true
    -- Sonst: der Schalter des Vereins. Fehlende Zeile = an (siehe 3.).
    else coalesce(
      (select cm.enabled from app.club_modules cm
        where cm.club_id = p_club_id and cm.module_key = p_module_key),
      true)
  end
$$;

comment on function app.module_enabled(uuid, text) is
  'Benutzt der Verein dieses Modul? Das eine Gate hinter jeder restriktiven Modul-Policy. Fehlende Zeile = true (fail-open, bewusst — der Schalter ist keine Sicherheitsgrenze). Kernmodule und unbekannte Schlüssel = immer true. Kann NIE etwas erlauben, was eine permissive Policy verbietet (restriktive Policies hängen mit UND an).';

-- ----------------------------------------------------------------------------
-- 7. Der Katalog-Inhalt. Schluessel + Texte woertlich aus dem "Mehr"-Raster
--    (apps/web/app/(portal)/mehr/i18n.ts) — eine Wahrheit, kein zweiter Ort.
--    sort folgt der Reihenfolge in MehrHub.tsx AVAILABLE.
-- ----------------------------------------------------------------------------
insert into app.modules (key, label_de, label_en, desc_de, desc_en, sort, core, requires_pro, enforcement) values
  -- ----- abschaltbar, RLS-durchgesetzt ('enforced') -------------------------
  ('news',          'News',                  'News',                'Vereins-Neuigkeiten und Ankündigungen.',             'Club news and announcements.',                     10, false, false, 'enforced'),
  ('notes',         'Notizen',               'Notes',               'Deine privaten Notizen.',                            'Your private notes.',                              20, false, false, 'enforced'),
  ('exercises',     'Übungen',               'Exercises',           'Übungs-Bibliothek mit Videos und Anleitungen.',       'Exercise library with videos and instructions.',    30, false, false, 'enforced'),
  ('facility',      'Belegungsplan',         'Facility plan',       'Hallen und Räume belegen.',                          'Book halls and rooms.',                            50, false, false, 'enforced'),
  ('equipment',     'Ausrüstung',            'Equipment',           'Ausrüstung und Reservierungen.',                     'Equipment and reservations.',                      60, false, false, 'enforced'),
  ('medal',         'Medaillen',             'Medals',              'Medaillen und Erfolge.',                             'Medals and achievements.',                         70, false, false, 'enforced'),
  ('trainingplan',  'Trainingsplan',         'Training plan',       'Trainingspläne und Einheiten.',                      'Training plans and sessions.',                     80, false, false, 'enforced'),
  ('hours',         'Pflichtstunden',        'Duty hours',          'Geleistete Pflichtstunden im Blick.',                'Keep track of duty hours.',                        90, false, false, 'enforced'),
  ('chat',          'Chat',                  'Chat',                'Team-Chat und Direktnachrichten.',                   'Team chat and direct messages.',                  110, false, false, 'enforced'),
  ('checkin',       'Check-in',              'Check-in',            'Anwesenheit per QR-Code.',                           'Attendance via QR code.',                         120, false, false, 'enforced'),
  ('regevents',     'Überregionale Events',  'Regional events',     'Wettkämpfe und Veranstaltungen der Region.',          'Competitions and events in the region.',          130, false, false, 'enforced'),
  ('gallery',       'Galerie',               'Gallery',             'Fotos und Momente des Vereins.',                     'Photos and moments of the club.',                 140, false, true,  'enforced'),
  ('document',      'Dokumente',             'Documents',           'Dokumente und Downloads.',                           'Documents and downloads.',                        150, false, true,  'enforced'),
  ('teams',         'Teams',                 'Teams',               'Deine Trainingsgruppen und alle Teams im Verein.',    'Your training groups and all teams in the club.',  170, false, false, 'enforced'),
  ('departments',   'Abteilungen',           'Departments',         'Sparten und Abteilungen des Vereins.',               'Divisions and departments of the club.',          180, false, false, 'enforced'),
  ('lockers',       'Schließfächer',         'Lockers',             'Schließfächer verwalten und Mitgliedern zuweisen.',   'Manage lockers and assign them to members.',       190, false, false, 'enforced'),
  ('waitlists',     'Wartelisten',           'Waiting lists',       'Plätze für Hallen, Ausrüstung, Teams und Termine.',   'Slots for halls, equipment, teams and events.',    210, false, false, 'enforced'),
  ('events',        'Termine',               'Events',              'Training, Wettkämpfe und alles dazwischen.',          'Training, competitions and everything between.',   220, false, false, 'enforced'),
  ('routines',      'Küren',                 'Routines',            'Musik, Marker und Wertungen.',                       'Music, markers and scores.',                      240, false, false, 'enforced'),
  ('competition',   'Wettkampf',             'Competition',         'Vorbereitung, Meldung und Ergebnisse.',              'Preparation, entries and results.',               250, false, false, 'enforced'),

  -- ----- abschaltbar, aber ein Server-Pfad umgeht die RLS ('partial') -------
  -- family: guardianships ist gegated, ABER family.ts nutzt fuer die
  -- Selbstbedienung withServiceRole (family.ts:125/201/246 — BYPASSRLS), und
  -- app.can_act_for_member (SECURITY DEFINER) liest guardianships an der RLS
  -- vorbei. Eltern koennen also weiter fuer ihre Kinder handeln (Rechnungen,
  -- Zusagen), auch wenn "Familie" aus ist. Das UI darf hier NICHT "kein
  -- Zugriff" behaupten.
  ('family',        'Familie',               'Family',              'Deine Kinder im Verein im Blick.',                   'Keep track of your children in the club.',         40, false, false, 'partial'),

  -- ----- abschaltbar, aber NUR Kosmetik ('menu_only') ----------------------
  -- Kein eigener Tisch, den man gaten koennte: beide werden in reports.ts aus
  -- club_members/Fachtabellen BERECHNET — und zwar via withServiceRole
  -- (reports.ts:54/172, BYPASSRLS). Eine restriktive Policy gaebe es hier
  -- nicht einmal, an der sie vorbeikaemen. Ehrlich benannt statt vorgetaeuscht.
  ('chart',         'Auswertung',            'Reports',             'Auswertungen, Berichte und Listen.',                 'Reports, statistics and lists.',                  100, false, false, 'menu_only'),
  ('anniversaries', 'Jubiläen',              'Anniversaries',       'Anstehende Jubiläen und runde Geburtstage.',          'Upcoming anniversaries and milestone birthdays.',  200, false, false, 'menu_only'),

  -- ----- Kernmodule: kein Schalter (enforcement NULL, siehe CHECK) ---------
  ('members',       'Mitglieder',            'Members',             'Alle Menschen im Verein.',                           'Everyone in the club.',                           230, true,  false, null),
  ('finance',       'Finanzen',              'Finance',             'Beiträge, offene Posten und Kasse.',                 'Fees, open items and cash.',                      260, true,  false, null),
  ('manage',        'Verwaltung',            'Administration',      'Verein, Rollen und Teams.',                          'Club, roles and teams.',                          270, true,  false, null)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 8. DIE GATES. Eine restriktive Policy je Tabelle des Moduls.
--
--    Warum eine Schleife und keine 33 handgeschriebenen Policies: die Zuordnung
--    Tabelle -> Modul soll an EINER Stelle stehen und lesbar bleiben. Die
--    Schleife erzeugt fuer jede Zeile genau dieselbe Policy — kein Spielraum
--    fuer einen Tippfehler, der ein Gate still weglaesst.
--
--    Bauform je Tabelle:
--      create policy <t>_module_gate on app.<t>
--        as restrictive for all
--        using (app.module_enabled(club_id, '<key>'))
--        with check (app.module_enabled(club_id, '<key>'));
--
--    * as restrictive  -> haengt mit UND an ALLE permissiven Policies. Kann nur
--                         wegnehmen. 0012 (PRO) und 0022ff (Faehigkeiten)
--                         bleiben unangetastet wirksam — kein Aufweichen.
--    * for all         -> using deckt SELECT/UPDATE/DELETE, with check INSERT/
--                         UPDATE. Aus = weder lesen noch schreiben.
--    * kein "to"       -> gilt fuer authenticated UND anon. Ein oeffentlicher
--                         Kuer-Link (routine_shares, public-routines.ts) stirbt
--                         mit dem Modul — richtig so.
--    * Tabellen-Owner (postgres) und service_role bleiben aussen vor: der eine
--      besitzt die Tabellen (kein FORCE RLS — gemessen: 0 von 60), der andere
--      hat BYPASSRLS. Migrationen und Seed laufen deshalb unveraendert durch.
--
--    KEINE VERHALTENSAENDERUNG HEUTE: fehlende Zeile = eingeschaltet, also
--    liefert module_enabled ueberall true und jede bestehende Policy entscheidet
--    wie bisher. Die 852+ Bestands-Tests bleiben deshalb unberuehrt gruen.
--
--    KASKADEN-RISIKO: gemessen, nicht vermutet. Keine dieser Tabellen wird in
--    der Policy einer ANDEREN Tabelle referenziert (pg_policies, live geprueft);
--    die Helfer, die sie lesen (app.can_act_for_member, app.can_read_routine,
--    app.is_team_member), sind SECURITY DEFINER und gehoeren dem Tabellen-Owner
--    — RLS greift in ihnen nicht (kein FORCE RLS). Ein Gate kann also nicht
--    heimlich ein fremdes Modul mitabschalten.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      -- Modul 'news'
      ('news',                  'news'),
      -- Modul 'notes'
      ('notes',                 'notes'),
      -- Modul 'exercises'
      ('exercises',             'exercises'),
      -- Modul 'family' (partial — service_role/DEFINER-Pfade bleiben offen)
      ('guardianships',         'family'),
      -- Modul 'facility'
      ('facilities',            'facility'),
      ('facility_bookings',     'facility'),
      -- Modul 'equipment'
      ('equipment',             'equipment'),
      ('equipment_reservations','equipment'),
      -- Modul 'medal'
      ('achievements',          'medal'),
      -- Modul 'trainingplan'
      ('training_slots',        'trainingplan'),
      -- Modul 'hours'
      ('duty_entries',          'hours'),
      ('duty_requirements',     'hours'),
      -- Modul 'chat'
      ('chat_messages',         'chat'),
      -- Modul 'checkin'
      ('checkins',              'checkin'),
      -- Modul 'regevents'
      ('regional_events',       'regevents'),
      -- Modul 'gallery' (PRO — 0012 bleibt zusaetzlich wirksam)
      ('gallery_items',         'gallery'),
      -- Modul 'document' (PRO — 0012 bleibt zusaetzlich wirksam)
      ('documents',             'document'),
      -- Modul 'lockers'
      ('lockers',               'lockers'),
      -- Modul 'waitlists'
      ('waitlists',             'waitlists'),
      -- Modul 'teams'
      ('teams',                 'teams'),
      ('team_members',          'teams'),
      -- Modul 'departments'
      ('departments',           'departments'),
      ('department_members',    'departments'),
      -- Modul 'events'
      ('events',                'events'),
      ('event_rsvps',           'events'),
      ('event_teams',           'events'),
      -- Modul 'routines'
      ('routines',              'routines'),
      ('routine_markers',       'routines'),
      ('routine_scores',        'routines'),
      ('routine_skaters',       'routines'),
      ('routine_shares',        'routines'),
      -- Modul 'competition'
      ('competitions',          'competition'),
      ('competition_entries',   'competition')
    ) as t(tbl, module_key)
  loop
    -- Die Zuordnung darf nicht auf ein Modul zeigen, das es nicht gibt.
    if not exists (select 1 from app.modules m where m.key = r.module_key) then
      raise exception 'Modul-Gate: Tabelle app.% zeigt auf unbekanntes Modul "%"', r.tbl, r.module_key;
    end if;
    -- ... und nicht auf ein Kernmodul (dessen Gate waere konstant true = toter Code).
    if (select m.core from app.modules m where m.key = r.module_key) then
      raise exception 'Modul-Gate: Tabelle app.% zeigt auf das Kernmodul "%" — Kernmodule haben keinen Schalter', r.tbl, r.module_key;
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
-- 9. Die Nachrechnung. Wie app.capability_policy_usage() (0033): eine
--    hand-gepflegte Spalte, die "hier wirkt was" behauptet, waere sonst genau
--    die gruene Kontrolle, die nicht rot werden kann.
--
--    Liest pg_policies und holt den Modul-Schluessel aus den restriktiven
--    Gates. Test 99e haengt daran und wird ROT, sobald ein Gate verschwindet
--    und das Etikett 'enforced' stehen bleibt.
--
--    Bewusst KEIN Event-Trigger: als Nicht-Superuser ist `create event trigger`
--    verboten (0030 hat das ausgemessen). Der Testlauf ist ohnehin der
--    wirksamere Ort — Gates verschwinden durch Migrationen aus DIESEM Repo.
-- ----------------------------------------------------------------------------
create or replace function app.module_policy_usage()
returns table (module_key text, cmd text, object text)
language sql
stable
set search_path = ''
as $$
  select distinct m[1]::text, p.cmd::text, p.tablename::text
  from pg_policies p
  cross join lateral regexp_matches(
    coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''),
    'module_enabled\s*\([^,]+,\s*''([a-z_]+)''', 'g') m
  where p.schemaname = 'app'
    and p.permissive = 'RESTRICTIVE'
$$;

comment on function app.module_policy_usage() is
  'Welches Modul wird von welcher restriktiven RLS-Policy tatsächlich gegated? Rechnet app.modules.enforcement gegen die Wirklichkeit nach — Grundlage von Test 99e. Sieht NUR die Datenbank.';

-- ----------------------------------------------------------------------------
-- 10. app.club_module_states — die eine Auskunft fuer die Clients:
--     Katalog + Schalterstellung + PRO-Verfuegbarkeit in EINER Runde.
--     Ohne das muesste der Client drei Abfragen mischen und haette bis dahin
--     keine Wahl, als das Raster falsch zu beschriften.
-- ----------------------------------------------------------------------------
create or replace function app.club_module_states(p_club_id uuid)
returns table (
  module_key   text,
  label_de     text,
  label_en     text,
  desc_de      text,
  desc_en      text,
  sort         int,
  core         boolean,
  requires_pro boolean,
  enforcement  app.module_enforcement,
  enabled      boolean,
  pro_ok       boolean,
  available    boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.key, m.label_de, m.label_en, m.desc_de, m.desc_en, m.sort,
         m.core, m.requires_pro, m.enforcement,
         app.module_enabled(p_club_id, m.key) as enabled,
         (not m.requires_pro or app.is_club_pro(p_club_id)) as pro_ok,
         -- available = die UND-Kette aus dem Kopf, ohne die Faehigkeit (die
         -- kennt der Aufrufer selbst): gekauft UND eingeschaltet.
         (app.module_enabled(p_club_id, m.key)
          and (not m.requires_pro or app.is_club_pro(p_club_id))) as available
  from app.modules m
  order by m.sort, m.key
$$;

comment on function app.club_module_states(uuid) is
  'Modul-Katalog + Schalterstellung + PRO-Verfügbarkeit für EINEN Verein. Quelle für GET /clubs/{clubId}/modules und das „Mehr"-Raster. `available` = gekauft UND eingeschaltet (die Fähigkeit prüft der Aufrufer selbst — das ist die dritte, unabhängige Frage).';

-- Kontrolle: der Katalog ist vollstaendig und die Etiketten sind entschieden.
-- Faellt das hier, ist ein Modul dazugekommen, ohne dass jemand ueber Schalter
-- und Etikett nachgedacht hat — genau der Moment, in dem jemand nachdenken soll.
do $$
declare
  v_total int;
  v_core  int;
  v_enf   int;
  v_par   int;
  v_menu  int;
begin
  select count(*) into v_total from app.modules;
  select count(*) into v_core  from app.modules where core;
  select count(*) into v_enf   from app.modules where enforcement = 'enforced';
  select count(*) into v_par   from app.modules where enforcement = 'partial';
  select count(*) into v_menu  from app.modules where enforcement = 'menu_only';

  if v_total <> 26 or v_core <> 3 or v_enf <> 20 or v_par <> 1 or v_menu <> 2 then
    raise exception
      'Modul-Katalog: % Module (3 core / 20 enforced / 1 partial / 2 menu_only erwartet), gezaehlt: core=% enforced=% partial=% menu_only=%',
      v_total, v_core, v_enf, v_par, v_menu
      using hint = 'Neues Modul? Dann gehoert es hier eingestuft — und in 99e_club_modules.sql.';
  end if;

  -- Jedes 'enforced'/'partial'-Modul MUSS mindestens ein Gate haben, sonst ist
  -- das Etikett schon beim Anlegen gelogen.
  if exists (
    select 1 from app.modules m
     where m.enforcement in ('enforced', 'partial')
       and not exists (select 1 from app.module_policy_usage() u where u.module_key = m.key)
  ) then
    raise exception 'Modul-Katalog: ein Modul behauptet Durchsetzung, hat aber kein Gate: %',
      (select string_agg(m.key, ', ') from app.modules m
        where m.enforcement in ('enforced', 'partial')
          and not exists (select 1 from app.module_policy_usage() u where u.module_key = m.key));
  end if;

  -- ... und ein 'menu_only'-Modul darf KEINS haben, sonst verspricht das UI zu
  -- wenig (harmloser, aber genauso falsch — Muster 0033/93j).
  if exists (
    select 1 from app.modules m
     where m.enforcement = 'menu_only'
       and exists (select 1 from app.module_policy_usage() u where u.module_key = m.key)
  ) then
    raise exception 'Modul-Katalog: ein "menu_only"-Modul haengt heimlich doch an einem Gate: %',
      (select string_agg(m.key, ', ') from app.modules m
        where m.enforcement = 'menu_only'
          and exists (select 1 from app.module_policy_usage() u where u.module_key = m.key));
  end if;
end $$;

-- Der Stolperdraht aus 0030 — ans Ende JEDER Migration (0030:Kommentar).
select app.assert_no_insecure_views();

commit;
