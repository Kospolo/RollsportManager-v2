-- ============================================================================
-- 0077_modul_sichtbarkeit.sql — WER SIEHT WELCHE KACHEL.
--
-- ############################################################################
-- ### DER BEFUND #############################################################
-- ############################################################################
-- Der Nutzer am iPhone: "Vereins-Admin soll Module fuer Gruppen und Mitglieder
-- einstellen koennen. Jetzt sind als Mitglied unter 'Mehr' so viele Module, wo
-- fuer das normale Mitglied eigentlich nicht zu sehen sein sollen."
--
-- Gemessen: apps/ios/App/Features/Mehr/MehrModel.swift haelt 30 Kacheln in
-- `MehrCatalog.available` plus zwei bedingt eingehaengte (Verwaltung, Betreiber).
-- Gefiltert wird NUR das bedingte Paar (MehrHubView.swift:29-31). Der Rest geht
-- UNGEFILTERT an jeden — ein Kind sieht dieselben ~30 Eintraege wie der Vorstand.
--
-- ############################################################################
-- ### DIE VIERTE FRAGE — UND WARUM SIE EINE EIGENE EBENE BRAUCHT #############
-- ############################################################################
-- 0044 hat drei Fragen sauber getrennt und ausdruecklich verboten, sie
-- ineinander aufzuloesen:
--
--   1. GEKAUFT?       app.entitlements / app.is_club_pro      (Betreiber)
--   2. EINGESCHALTET? app.club_modules / app.module_enabled   (Vereins-Admin)
--   3. ERLAUBT?       app.capabilities / role_permissions     (Vereins-Admin)
--
-- Diese Migration fuegt die VIERTE hinzu — und nur sie:
--
--   4. GEZEIGT?       app.module_visibility (HIER)            (Vereins-Admin)
--                     "Soll diese Person die Kachel im Menue ueberhaupt
--                      angeboten bekommen?"
--
-- Die Kette bleibt ein UND und wird nur laenger:
--
--      gekauft  UND  eingeschaltet  UND  gezeigt   ->  Kachel im Menue
--      gekauft  UND  eingeschaltet  UND  erlaubt   ->  ZUGRIFF (unveraendert)
--
-- ############################################################################
-- ### !!! SICHTBARKEIT IST KEIN SICHERHEITSERSATZ !!! ########################
-- ############################################################################
-- DAS IST DER WICHTIGSTE ABSATZ DIESER DATEI. Wer ihn ueberliest, baut spaeter
-- ein Loch.
--
-- Das Ausblenden einer Kachel ist BEQUEMLICHKEIT, NICHT SCHUTZ. Es raeumt ein
-- ueberladenes Menue auf. Es schuetzt KEINE Daten.
--
--   * Wer eine Kachel NICHT sieht, darf ueber einen Deeplink, einen
--     API-Aufruf oder curl trotzdem GENAU SO VIEL wie vorher — nicht mehr und
--     nicht weniger. Die Grenzen bleiben, wo sie sind: RLS-Mandantentrennung
--     (0002), Entitlement (0012), Modul-Gates (0044/0061/0068) und die
--     Faehigkeiten (0022-0033).
--   * Wer eine Kachel SIEHT, bekommt dadurch KEIN Recht dazu. Eine sichtbare
--     Kachel auf einer Seite, die die Person nicht lesen darf, zeigt eine leere
--     Liste oder einen 403 — genau wie vorher.
--
-- Deshalb wird hier ausdruecklich KEINE Policy, KEIN Gate und KEIN Trigger auf
-- einer Fachtabelle angefasst. app.module_visibility taucht in KEINER
-- RLS-Policy auf, und app.module_visible() darf dort NIE eingebaut werden. Wer
-- Zugriff steuern will, aendert die ROLLE (Verwaltung > Rollen & Rechte) oder
-- den MODUL-SCHALTER (Verwaltung > Module) — nicht die Sichtbarkeit.
--
-- Der Nachweis dafuer steht in 99rA_modul_sichtbarkeit.sql Block F: ein
-- ausgeblendetes Modul liefert derselben Person ueber die API weiterhin
-- exakt dieselben Zeilen wie vorher.
--
-- ############################################################################
-- ### DAS MODELL — DREI EBENEN, EINE VORGABE #################################
-- ############################################################################
-- Der Nutzer nennt drei Stellschrauben. Sie werden NICHT gleichrangig gebaut,
-- sondern gestaffelt — von der billigsten Pflege zur teuersten:
--
--   VORGABE   (keine Zeile noetig)  aus der ROLLE ABGELEITET, siehe unten.
--   ROLLE     app.roles             "die 24 Mitglieder sehen X nicht"
--   GRUPPE    app.departments       "die Leistungssport-Gruppe sieht zusaetzlich Y"
--   MITGLIED  app.club_members      "dieses Elternteil darf Z auch sehen"
--
-- Warum die ROLLE die Basis ist: der Verein pflegt seine Rollen ohnehin
-- (Verwaltung > Rollen & Rechte). 24 Mitglieder einzeln zu pflegen will
-- niemand — und wer es einmal vergisst, hat ein Kind mit dem Menue des
-- Vorstands. Rolle = eine Zeile fuer alle, die es betrifft, und neue Mitglieder
-- sind automatisch richtig eingestellt.
--
-- ### AUFLOESUNGS-REIHENFOLGE (spezifisch schlaegt allgemein) ###
--   1. MITGLIED  Eine ausdrueckliche Zeile fuer diese Person entscheidet. Punkt.
--   2. GRUPPE    Sonst: die Gruppen der Person, die eine Zeile haben. Mehrere
--                Gruppen -> ein ausdrueckliches AUS gewinnt (bool_and).
--                Begruendung: ein "aus" ist eine bewusste Entscheidung des
--                Admins; eine zweite Gruppe, in der die Person zufaellig auch
--                steckt, darf sie nicht stillschweigend aufheben.
--   3. ROLLE     Sonst: Vereinigung ueber ALLE Rollen der Person, wobei jede
--                Rolle entweder ihre ausdrueckliche Zeile oder die VORGABE
--                beisteuert. Mehrere Rollen -> ein SICHTBAR gewinnt (bool_or).
--                Begruendung: das ist exakt die Semantik, die die Rechte schon
--                haben (app.cap_rank = MAX ueber alle Rollen, 0025). Wer
--                Mitglied UND Trainer ist, sieht das Trainer-Menue — sonst
--                muesste er sich fragen, warum ihm etwas fehlt, das er darf.
--   4. (Ebene 3 ist immer definiert; ein "nichts gefunden" gibt es nur, wenn
--       die Person gar keine aktive Mitgliedschaft hat -> nichts sichtbar.)
--
-- Die Ebenen 2 und 3 sind bewusst UNTERSCHIEDLICH streng. Das ist kein
-- Versehen: eine ROLLE beschreibt, was jemand DARF (Vereinigung, wie 0025);
-- eine GRUPPE ist eine kuratierte Zielgruppe (das ausdrueckliche Nein zaehlt).
--
-- ############################################################################
-- ### DIE VORGABE — ABGELEITET, NICHT ABGESCHRIEBEN ##########################
-- ############################################################################
-- Eine neue Handliste "Rolle X sieht Modul Y" waere die zweite Wahrheit neben
-- der Rechtematrix — und sie waere ab dem Tag falsch, an dem ein Verein die
-- Rechte seiner Rollen aendert. Stattdessen leitet die Vorgabe sich AUS DEN
-- RECHTEN ab, die die Rolle ohnehin hat:
--
--   app.modules.visibility_capability  Welche Faehigkeit traegt dieses Modul?
--   app.modules.visibility_min_rank    Ab welcher STUFE lohnt sich die Kachel?
--
--   Vorgabe(Rolle, Modul) = rang(Rolle, visibility_capability) >= min_rank
--
-- Warum eine MINDESTSTUFE und nicht "hat ueberhaupt ein Recht": mehrere
-- Kacheln sind VERWALTUNGS-Bildschirme, obwohl jede Person am selben Thema ein
-- kleines Eigenrecht hat. Beispiele, gemessen an 0023:
--   * lockers      Jeder hat 'read_own' (sein eigenes Fach, 0021:156) — die
--                  Kachel heisst aber "Schliessfaecher verwalten und
--                  Mitgliedern zuweisen". min_rank = manage.
--   * finance      Jeder hat 'read_own' (eigene Rechnungen ueber
--                  can_act_for_member) — die Kachel ist der Finanz-Hub mit
--                  Kassenbuch und Mahnwesen. min_rank = manage.
--   * waitlists    Jeder hat 'read_own' (der eigene Wartelisten-Platz) — die
--                  Kachel ist die Wartelisten-Verwaltung. min_rank = edit.
-- Damit faellt genau das weg, was der Nutzer aufgezaehlt hat (Verwaltung,
-- Finanzen, Mahnwesen, Wartelisten, Schliessfach-Verwaltung, Auswertung), ohne
-- dass irgendwo eine Rollenliste steht.
--
-- Zwei Module tragen bewusst KEINE Faehigkeit (visibility_capability is null =
-- immer sichtbar): 'notes' (die eigenen Notizen) und 'family' (die eigenen
-- Kinder). Beide sind rein persoenlich, es gibt dazu keine Vereinsfaehigkeit,
-- und ein Elternteil ohne Familien-Kachel waere ein Fehler, kein Aufraeumen.
--
-- ### WAS EIN NORMALES MITGLIED DAMIT SIEHT (Systemrolle 'member', gerechnet) ##
--   SICHTBAR: Termine, Teams, Kueren, News, Chat, Galerie, Dokumente, Notizen,
--             Uebungen, Trainingsplan, Medaillen, Belegungsplan, Ausruestung,
--             Check-in, Pflichtstunden, Ueberregionale Events, Wettkampf,
--             Familie, Mitglieder                                     (19)
--   AUS:      Verwaltung, Finanzen, Schliessfaecher, Wartelisten,
--             Auswertung, Jubilaeen, Abteilungen                       (7)
-- (Im FRISCHEN Verein sind Galerie/Dokumente/Notizen zusaetzlich noch nicht
--  gebucht (0068) — dort bleiben also 16 uebrig. Die Sichtbarkeit kann nichts
--  zeigen, was der Verein gar nicht eingeschaltet hat: available UND sichtbar.)
--
-- ############################################################################
-- ### 'manage' NIMMT KEINE ZEILE AN — DER WEG ZURUECK ########################
-- ############################################################################
-- 0044 haelt 'manage' aus einem Grund als Kernmodul: dort stehen die Schalter
-- selbst, ein Abschalten waere unumkehrbar. Genau dasselbe gilt fuer die
-- Sichtbarkeit: wer die Verwaltungs-Kachel fuer die owner-Rolle ausblendet,
-- kaeme an die Einstellung nicht mehr heran, um es zurueckzunehmen. Ein Trigger
-- weist deshalb JEDE Zeile mit module_key = 'manage' ab (P0001). Wer sie
-- verstecken will, hat die Vorgabe schon: club_settings >= manage — also
-- owner/admin/moderator und sonst niemand.
--
-- ############################################################################
-- ### KEINE NEUE FAEHIGKEIT — WIE IN 0044 ####################################
-- ############################################################################
-- Schreibrecht ist app.is_club_admin (owner/admin/moderator), NICHT eine neue
-- Faehigkeit. Gruende woertlich wie 0044: 0033 zaehlt den Faehigkeiten-Katalog
-- auf exakt 32 ab (raise exception) und 93j prueft dieselbe Zahl; eine 33.
-- Faehigkeit wuerde beide rot machen. Fachlich ist is_club_admin ausserdem
-- deckungsgleich: wer die Module schalten darf, darf auch sagen, wem sie
-- angeboten werden.
--
-- LIES 0044 GANZ, bevor du hier etwas aenderst.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Der Katalog lernt, WORAUS sich seine Vorgabe ableitet.
--
--    Zwei Spalten statt einer Liste im Funktionskoerper — dieselbe Begruendung
--    wie bei default_enabled in 0068: eine Liste im Code waere die zweite
--    Wahrheit neben dem Katalog, und das Admin-UI muesste sie noch einmal
--    kennen, um "Vorgabe" beschriften zu koennen.
-- ----------------------------------------------------------------------------
alter table app.modules
  add column if not exists visibility_capability text
    references app.capabilities (key) on delete restrict,
  add column if not exists visibility_min_rank int;

alter table app.modules
  drop constraint if exists modules_visibility_pair;
alter table app.modules
  add constraint modules_visibility_pair check (
    (visibility_capability is null and visibility_min_rank is null)
    or (visibility_capability is not null and visibility_min_rank between 1 and 5)
  );

comment on column app.modules.visibility_capability is
  'Welche Faehigkeit traegt die VORGABE-Sichtbarkeit dieses Moduls (0077)? null = immer sichtbar (rein persoenliche Module: Notizen, Familie). NUR fuer die Menue-Vorgabe — NIE fuer Autorisierung: das Gate bleibt app.has_cap in den Policies.';
comment on column app.modules.visibility_min_rank is
  'Ab welchem Rang der visibility_capability (1=read_own … 5=manage) lohnt sich die Kachel? Verwaltungs-Bildschirme stehen hoch (lockers/finance = 5, waitlists = 4), obwohl jede Person am selben Thema ein kleines Eigenrecht hat. null <=> visibility_capability is null.';

-- ----------------------------------------------------------------------------
-- 2. Die Zuordnung. Eine Zeile je Modul, jede gegen 0023 (allowed_levels) und
--    0044 (Modul-Beschreibung) belegt. Der Kommentar nennt jeweils, WAS die
--    Kachel wirklich zeigt — daran haengt die Mindeststufe.
-- ----------------------------------------------------------------------------
update app.modules m
   set visibility_capability = v.cap,
       visibility_min_rank   = v.min_rank
  from (values
    -- --- Lesebereiche: die Kachel lohnt sich, sobald man den Bestand sieht --
    ('news',          'news',               3),  -- Vereins-Neuigkeiten
    ('exercises',     'exercises',          3),  -- Uebungs-Bibliothek
    ('equipment',     'equipment',          3),  -- Ausruestungsbestand
    ('medal',         'achievements',       3),  -- Medaillen/Erfolge
    ('trainingplan',  'training_slots',     3),  -- Trainingsplan
    ('regevents',     'regional_events',    3),  -- Ueberregionale Events
    ('gallery',       'gallery',            3),  -- Fotos
    ('document',      'documents',          3),  -- Dokumente/Downloads
    ('teams',         'teams',              3),  -- Kader ansehen
    ('events',        'events',             3),  -- Termine
    ('competition',   'competitions',       3),  -- Wettkampf
    ('members',       'members',            3),  -- Mitgliederverzeichnis
    -- --- Eigenbereiche: schon das eigene Recht traegt die Kachel -----------
    ('routines',      'routines',           1),  -- die EIGENE Kuer
    ('hours',         'duty_hours',         1),  -- die EIGENEN Pflichtstunden
    ('checkin',       'checkins',           1),  -- der EIGENE Check-in
    ('facility',      'facilities_booking', 1),  -- eigene Buchungen + Plan
    ('chat',          'chat',               2),  -- Team-Kanal (read_team)
    -- --- Strukturbereiche: erst ab einem Gestaltungsrecht ------------------
    ('departments',   'departments',        1),  -- Abteilungen pflegen
    ('anniversaries', 'anniversaries',      3),  -- der ganze Verein, nicht das Team
    -- --- Verwaltungs-Bildschirme (siehe Kopf: MINDESTSTUFE, nicht ">0") ----
    ('waitlists',     'waitlists',          4),  -- Wartelisten VERWALTEN
    ('lockers',       'lockers',            5),  -- Faecher zuweisen
    ('finance',       'finance',            5),  -- Kassenbuch/Rechnungen/Mahnwesen
    ('chart',         'members',            5),  -- Auswertungen ueber den Bestand
    ('manage',        'club_settings',      5)   -- die Verwaltung selbst
  ) as v(key, cap, min_rank)
 where m.key = v.key;

-- 'notes' und 'family' bleiben ausdruecklich ohne Faehigkeit = immer sichtbar.
-- Kein update, aber hier festgehalten, damit die Auslassung als ENTSCHEIDUNG
-- lesbar ist und nicht als vergessene Zeile.
update app.modules
   set visibility_capability = null, visibility_min_rank = null
 where key in ('notes', 'family');

-- ----------------------------------------------------------------------------
-- 3. Die Voraussetzung fuer den zusammengesetzten FK auf Gruppen (Muster 0022:
--    roles_id_club_uq / club_members_id_club_uq). Ohne ihn koennte eine Zeile
--    auf eine Gruppe eines FREMDEN Vereins zeigen.
-- ----------------------------------------------------------------------------
create unique index if not exists departments_id_club_uq
  on app.departments (id, club_id);

-- ----------------------------------------------------------------------------
-- 4. Der Geltungsbereich als eigener Enum — ein Tippfehler soll die Migration
--    fallen lassen, nicht stillschweigend eine vierte Ebene erfinden
--    (Muster 0044/0033).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'app' and t.typname = 'module_visibility_scope') then
    create type app.module_visibility_scope as enum ('role', 'department', 'member');
  end if;
end $$;

comment on type app.module_visibility_scope is
  'Auf WEN eine Sichtbarkeits-Zeile zielt: role (die Basis) · department (die "Gruppen" im UI) · member (die Ausnahme fuer eine Person). Aufloesung: member schlaegt department schlaegt role schlaegt Vorgabe.';

-- ----------------------------------------------------------------------------
-- 5. app.module_visibility — die AUSNAHMEN. Bewusst NUR Ausnahmen: wer nichts
--    einstellt, hat keine Zeile und bekommt die abgeleitete Vorgabe. Eine
--    vollstaendig materialisierte Matrix (26 Module x 7 Rollen x n Gruppen x
--    24 Mitglieder je Verein) waere nicht nur gross, sie waere auch SOFORT
--    veraltet, sobald jemand die Rechte einer Rolle aendert — die Vorgabe muss
--    mitwandern, nicht eingefroren sein.
-- ----------------------------------------------------------------------------
create table if not exists app.module_visibility (
  id            uuid primary key default app.uuid_v7(),
  club_id       uuid not null references app.clubs (id) on delete cascade,
  module_key    text not null references app.modules (key) on delete restrict,
  scope         app.module_visibility_scope not null,
  role_id       uuid references app.roles (id) on delete cascade,
  department_id uuid references app.departments (id) on delete cascade,
  member_id     uuid references app.club_members (id) on delete cascade,
  visible       boolean not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Genau EIN Ziel, und es passt zum Geltungsbereich. Ohne diesen CHECK koennte
  -- eine Zeile gleichzeitig auf eine Rolle und ein Mitglied zeigen — die
  -- Aufloesung haette dann zwei Antworten.
  constraint module_visibility_target_matches_scope check (
    (scope = 'role'
       and role_id is not null and department_id is null and member_id is null)
    or (scope = 'department'
       and department_id is not null and role_id is null and member_id is null)
    or (scope = 'member'
       and member_id is not null and role_id is null and department_id is null)
  )
);

-- Zusammengesetzte FKs: das Ziel MUSS demselben Verein gehoeren wie die Zeile
-- (Muster 0022:180-191). Eine Sichtbarkeits-Zeile ueber Vereinsgrenzen hinweg
-- waere ein Mandantenleck im Konfigurationsformular.
alter table app.module_visibility
  drop constraint if exists module_visibility_role_club_fk;
alter table app.module_visibility
  add constraint module_visibility_role_club_fk
  foreign key (role_id, club_id) references app.roles (id, club_id) on delete cascade;

alter table app.module_visibility
  drop constraint if exists module_visibility_department_club_fk;
alter table app.module_visibility
  add constraint module_visibility_department_club_fk
  foreign key (department_id, club_id) references app.departments (id, club_id) on delete cascade;

alter table app.module_visibility
  drop constraint if exists module_visibility_member_club_fk;
alter table app.module_visibility
  add constraint module_visibility_member_club_fk
  foreign key (member_id, club_id) references app.club_members (id, club_id) on delete cascade;

-- Je Ziel und Modul genau EINE Aussage. Partielle Unique-Indizes statt eines
-- gemeinsamen: die jeweils anderen Spalten sind null und wuerden im gemeinsamen
-- Index nie kollidieren (null <> null).
create unique index if not exists module_visibility_role_uq
  on app.module_visibility (club_id, module_key, role_id) where scope = 'role';
create unique index if not exists module_visibility_department_uq
  on app.module_visibility (club_id, module_key, department_id) where scope = 'department';
create unique index if not exists module_visibility_member_uq
  on app.module_visibility (club_id, module_key, member_id) where scope = 'member';

-- Der Index, den die Aufloesung bei JEDEM Menue-Aufbau trifft.
create index if not exists module_visibility_lookup_idx
  on app.module_visibility (club_id, scope, module_key);

create trigger module_visibility_set_updated_at
  before update on app.module_visibility
  for each row execute function app.set_updated_at();

comment on table app.module_visibility is
  'AUSNAHMEN von der abgeleiteten Menue-Vorgabe (0077): welche Kachel wird welcher Rolle / Gruppe / Person angeboten. KEINE SICHERHEITSGRENZE — Ausblenden nimmt kein Recht, Einblenden gibt keins. Kommt in KEINER RLS-Policy vor und darf es nie. Fehlende Zeile = die aus der Rechtematrix abgeleitete Vorgabe (app.module_role_default_visible).';
comment on column app.module_visibility.visible is
  'true = anbieten, false = ausblenden. Es gibt kein "unset" — wer die Vorgabe zurueckhaben will, LOESCHT die Zeile (API: visible = null).';

-- ----------------------------------------------------------------------------
-- 6. Der Weg-zurueck-Schutz. In der DATENBANK, nicht im Formular — genau wie
--    app.club_modules_guard() (0044): ein direkter API- oder SQL-Aufruf soll
--    die Verwaltungs-Kachel genauso wenig verstecken koennen wie ein Klick.
-- ----------------------------------------------------------------------------
create or replace function app.module_visibility_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.module_key = 'manage' then
    raise exception
      'Die Verwaltung kann nicht ausgeblendet werden. / Administration cannot be hidden.'
      using errcode = 'P0001',
            hint = 'Dort stehen die Einstellungen selbst — ein Ausblenden waere unumkehrbar (0044: derselbe Grund, aus dem "manage" ein Kernmodul ist). Wer sie einschraenken will, aendert die Faehigkeit "Vereinseinstellungen" unter Verwaltung > Rollen & Rechte.';
  end if;
  return new;
end;
$$;

comment on function app.module_visibility_guard() is
  'Weist eine Sichtbarkeits-Zeile fuer das Modul "manage" mit P0001 ab. Sitzt in der DB, damit ein direkter Aufruf am UI vorbei genauso scheitert wie der Klick.';

drop trigger if exists module_visibility_guard on app.module_visibility;
create trigger module_visibility_guard
  before insert or update on app.module_visibility
  for each row execute function app.module_visibility_guard();

-- ----------------------------------------------------------------------------
-- 7. RLS.
--    Lesen  : jedes Vereinsmitglied — die Clients bauen daraus ihr Menue und
--             das Admin-UI seine Matrix. Es stehen keine Personendaten drin.
--    Stellen: app.is_club_admin (owner/admin/moderator). Warum nicht has_cap:
--             siehe "KEINE NEUE FAEHIGKEIT" im Kopf.
-- ----------------------------------------------------------------------------
alter table app.module_visibility enable row level security;

create policy module_visibility_select on app.module_visibility
  for select to authenticated
  using (app.is_club_member(club_id) or app.is_platform_admin());

create policy module_visibility_insert on app.module_visibility
  for insert to authenticated
  with check (app.is_club_admin(club_id));

create policy module_visibility_update on app.module_visibility
  for update to authenticated
  using (app.is_club_admin(club_id))
  with check (app.is_club_admin(club_id));

create policy module_visibility_delete on app.module_visibility
  for delete to authenticated
  using (app.is_club_admin(club_id));

grant select, insert, update, delete on app.module_visibility to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Die VORGABE je Rolle. Liest die Rechtematrix des Vereins, nicht eine
--    zweite Liste.
--
--    Warum NICHT app.cap_rank: cap_rank fragt "welchen Rang hat die AUFRUFENDE
--    Person" (auth.uid()). Hier wird nach dem Rang EINER ROLLE gefragt,
--    unabhaengig davon, wer gerade schaut — sonst koennte das Admin-UI die
--    Vorgabe fuer fremde Rollen gar nicht anzeigen.
--
--    Die geschuetzte owner-Rolle bekommt Rang 5, wortgleich zur Regel in
--    app.cap_rank (0025:225-243): `case when r.protected then 5 end`. Ein
--    zweites Regelwerk fuer denselben Satz "owner kann alles" waere genau die
--    Sorte Drift, die 0033 einfangen musste.
-- ----------------------------------------------------------------------------
create or replace function app.module_role_default_visible(p_role_id uuid, p_module_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when m.visibility_capability is null then true
    else coalesce((
      select case when r.protected then 5
                  else app.level_rank(coalesce(rp.level, 'none'::app.role_level)) end
        from app.roles r
        left join app.role_permissions rp
               on rp.role_id = r.id
              and rp.capability_key = m.visibility_capability
       where r.id = p_role_id
    ), 0) >= m.visibility_min_rank
  end
  from app.modules m
  where m.key = p_module_key
$$;

comment on function app.module_role_default_visible(uuid, text) is
  'Die abgeleitete Menue-VORGABE fuer EINE Rolle und EIN Modul (0077): Rang der Rolle in app.modules.visibility_capability >= visibility_min_rank. Keine Faehigkeit hinterlegt = immer sichtbar (Notizen, Familie). Geschuetzte owner-Rolle = Rang 5, wortgleich zu app.cap_rank. NUR Menue — nie Autorisierung.';

-- ----------------------------------------------------------------------------
-- 9. Die Mitgliedschaft der aufrufenden Person. Denselben Gate wie
--    app.member_role_keys (0025): geloescht/inaktiv/abgelaufen -> nichts.
-- ----------------------------------------------------------------------------
create or replace function app.my_member_id(p_club_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
    from app.club_members m
   where m.club_id = p_club_id
     and m.profile_id = auth.uid()
     and m.deleted_at is null
     and m.status = 'active'
     and (m.valid_until is null or m.valid_until >= now())
   limit 1
$$;

comment on function app.my_member_id(uuid) is
  'Die Mitglieds-ID der aufrufenden Person in diesem Verein — mit demselben Mitgliedschafts-Gate wie app.member_role_keys (0025): geloescht/inaktiv/abgelaufen = null. Keine Autorisierung, nur eine Zuordnung.';

-- ----------------------------------------------------------------------------
-- 10. DIE AUFLOESUNG. Ein Ort, an dem die Reihenfolge aus dem Kopf steht —
--     Web, iOS, macOS und Android fragen alle dieselbe Funktion.
--
--     Mengenbasiert (eine Abfrage fuer alle 26 Module), nicht je Modul: das
--     Menue wird bei jedem App-Start aufgebaut.
-- ----------------------------------------------------------------------------
create or replace function app.member_module_visibility(p_club_id uuid, p_member_id uuid)
returns table (module_key text, visible boolean, source text)
language sql
stable
security definer
set search_path = ''
as $$
  with aktiv as (
    -- Ohne aktive Mitgliedschaft gibt es kein Menue. Fail-closed, aber
    -- folgenlos: die Person kaeme an die Daten ohnehin nicht heran (RLS).
    select 1 from app.club_members m
     where m.id = p_member_id
       and m.club_id = p_club_id
       and m.deleted_at is null
       and m.status = 'active'
       and (m.valid_until is null or m.valid_until >= now())
  ),
  -- Ebene 3: Vereinigung ueber ALLE Rollen (bool_or) — Semantik wie cap_rank.
  -- Jede Rolle steuert ihre ausdrueckliche Zeile bei ODER ihre Vorgabe.
  ebene_rolle as (
    select mo.key as module_key,
           bool_or(coalesce(ov.visible,
                            app.module_role_default_visible(mr.role_id, mo.key))) as visible,
           bool_or(ov.visible is not null) as hat_ausnahme
      from app.modules mo
      join app.member_roles mr
        on mr.club_id = p_club_id
       and mr.member_id = p_member_id
      left join app.module_visibility ov
             on ov.club_id = p_club_id
            and ov.module_key = mo.key
            and ov.scope = 'role'
            and ov.role_id = mr.role_id
     group by mo.key
  ),
  -- Ebene 2: die Gruppen der Person, die ueberhaupt eine Zeile haben.
  -- bool_and = ein ausdrueckliches AUS gewinnt (Begruendung im Kopf).
  ebene_gruppe as (
    select ov.module_key, bool_and(ov.visible) as visible
      from app.module_visibility ov
      join app.department_members dm
        on dm.department_id = ov.department_id
       and dm.member_id = p_member_id
       and dm.deleted_at is null
     where ov.club_id = p_club_id
       and ov.scope = 'department'
     group by ov.module_key
  ),
  -- Ebene 1: die Person selbst. Genau eine Zeile je Modul (Unique-Index).
  ebene_mitglied as (
    select ov.module_key, ov.visible
      from app.module_visibility ov
     where ov.club_id = p_club_id
       and ov.scope = 'member'
       and ov.member_id = p_member_id
  )
  select mo.key,
         coalesce(em.visible, eg.visible, er.visible, false),
         case
           when em.visible is not null       then 'member'
           when eg.visible is not null       then 'department'
           when er.hat_ausnahme              then 'role'
           when er.visible is not null       then 'default'
           else 'no_membership'
         end
    from app.modules mo
    left join ebene_rolle    er on er.module_key = mo.key
    left join ebene_gruppe   eg on eg.module_key = mo.key
    left join ebene_mitglied em on em.module_key = mo.key
   where exists (select 1 from aktiv)
   order by mo.sort, mo.key
$$;

comment on function app.member_module_visibility(uuid, uuid) is
  'Aufgeloeste MENUE-Sichtbarkeit je Modul fuer EIN Mitglied (0077). Reihenfolge: member > department > role > Vorgabe. Mehrere Gruppen -> ein AUS gewinnt; mehrere Rollen -> ein SICHTBAR gewinnt (wie app.cap_rank). `source` sagt, welche Ebene entschieden hat. KEINE AUTORISIERUNG: unsichtbar heisst nicht verboten, sichtbar heisst nicht erlaubt.';

-- ----------------------------------------------------------------------------
-- 10b. Dieselbe Vorgabe, aber fuer einen ROLLEN-SCHLUESSEL statt eine
--      Rollen-ZEILE — vereinsunabhaengig, weil sie app.rbac_default_level
--      (0023) liest statt der (womoeglich schon veraenderten) Matrix EINES
--      Vereins.
--
--      Wofuer: die Nachrechnung unten und Test 99rA muessen die AUSSAGE
--      pruefen koennen ("ein normales Mitglied sieht keine Finanzen"), und zwar
--      SOFORT bei der Migration — zu diesem Zeitpunkt gibt es noch keinen
--      Verein (der Seed laeuft danach). Eine Kontrolle, die mangels Daten
--      stillschweigend durchlaeuft, ist genau die gruene Kontrolle, die nie
--      rot werden kann.
--
--      Sie ist NICHT der Produktivpfad: das Menue liest immer die echte Matrix
--      des Vereins (app.module_role_default_visible). Beide muessen fuer einen
--      FRISCHEN Verein dasselbe sagen — 99rA misst genau das nach.
-- ----------------------------------------------------------------------------
create or replace function app.module_role_key_default_visible(p_role_key text, p_module_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when m.visibility_capability is null then true
    when p_role_key = 'owner' then true   -- protected: Rang 5, wie app.cap_rank
    else app.level_rank(app.rbac_default_level(p_role_key, m.visibility_capability))
         >= m.visibility_min_rank
  end
  from app.modules m
  where m.key = p_module_key
$$;

comment on function app.module_role_key_default_visible(text, text) is
  'Die Menue-Vorgabe fuer eine SYSTEMROLLE (Schluessel) und ein Modul — vereinsunabhaengig, aus app.rbac_default_level (0023). Nur fuer Nachrechnung/Doku; das Menue liest die echte Rechtematrix des Vereins (app.module_role_default_visible).';

-- Scalar-Bequemlichkeit fuer Tests und Einzelabfragen.
create or replace function app.module_visible(p_club_id uuid, p_member_id uuid, p_module_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select v.visible from app.member_module_visibility(p_club_id, p_member_id) v
      where v.module_key = p_module_key),
    false)
$$;

comment on function app.module_visible(uuid, uuid, text) is
  'Wird EINEM Mitglied EIN Modul im Menue angeboten (0077)? Duenne Huelle um app.member_module_visibility. NIE in einer RLS-Policy verwenden — Sichtbarkeit ist kein Schutz.';

-- ----------------------------------------------------------------------------
-- 11. DIE EINE QUELLE fuer alle Clients: Katalog + Vereins-Schalter + PRO +
--     Sichtbarkeit, fuer die AUFRUFENDE Person.
--
--     `visible` ist die volle Kette: available (gekauft UND eingeschaltet)
--     UND angeboten. Ein Modul, das der Verein gar nicht hat, kann keine
--     Sichtbarkeits-Zeile ins Menue heben — die Kette ist ein UND.
--
--     Der Rueckfall fuer eine Person OHNE Mitgliedschaft ist app.is_club_admin:
--     das trifft ausschliesslich den Betreiber mit eingeschalteter Einsicht
--     (app.operator_may('club_settings'), 0074). Der Betreiber sieht dann den
--     ungefilterten Verein — er hat kein Menue zu ordnen, er hat einen Fall zu
--     bearbeiten. Jede andere Person ohne Mitgliedschaft bekommt nichts.
-- ----------------------------------------------------------------------------
create or replace function app.my_effective_modules(p_club_id uuid)
returns table (
  module_key       text,
  label_de         text,
  label_en         text,
  desc_de          text,
  desc_en          text,
  sort             int,
  core             boolean,
  requires_pro     boolean,
  enforcement      app.module_enforcement,
  default_enabled  boolean,
  enabled          boolean,
  pro_ok           boolean,
  available        boolean,
  visible          boolean,
  visibility_source text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.module_key, s.label_de, s.label_en, s.desc_de, s.desc_en, s.sort,
         s.core, s.requires_pro, s.enforcement, s.default_enabled,
         s.enabled, s.pro_ok, s.available,
         (s.available and coalesce(v.visible, app.is_club_admin(p_club_id))) as visible,
         coalesce(v.source, 'operator') as visibility_source
    from app.club_module_states(p_club_id) s
    left join app.member_module_visibility(p_club_id, app.my_member_id(p_club_id)) v
           on v.module_key = s.module_key
   order by s.sort, s.module_key
$$;

comment on function app.my_effective_modules(uuid) is
  'DIE EINE QUELLE fuer das "Mehr"-Raster (0077): Katalog + Vereins-Schalter + PRO + aufgeloeste Sichtbarkeit fuer die AUFRUFENDE Person. `visible` = available UND angeboten. Quelle fuer GET /clubs/{clubId}/modules/effective — Web, iOS, macOS und Android bauen ihr Menue daraus, damit niemand die Liste im Client nachbaut. Sichtbarkeit ist KEIN Schutz: die Daten bleiben durch RLS/Gates gesichert.';

-- ----------------------------------------------------------------------------
-- 12. Die Matrix fuer das Admin-UI: je Modul und Rolle die VORGABE, die
--     Ausnahme (oder null) und das Ergebnis. Gruppen- und Mitglieds-Zeilen
--     kommen ueber den zweiten Zweig — dort nur die tatsaechlich gesetzten
--     Ausnahmen, denn eine vollstaendige Matrix ueber alle Mitglieder waere
--     im UI nicht lesbar und im Netz nicht klein.
-- ----------------------------------------------------------------------------
create or replace function app.club_module_visibility_matrix(p_club_id uuid)
returns table (
  module_key      text,
  scope           app.module_visibility_scope,
  target_id       uuid,
  target_label    text,
  default_visible boolean,
  override        boolean,
  effective       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Rollen: VOLLSTAENDIG (26 Module x Rollen des Vereins) — das ist die Ebene,
  -- die der Verein pflegt, sie muss ohne Vorwissen bedienbar sein.
  select mo.key,
         'role'::app.module_visibility_scope,
         r.id,
         r.name_de,
         app.module_role_default_visible(r.id, mo.key),
         ov.visible,
         coalesce(ov.visible, app.module_role_default_visible(r.id, mo.key))
    from app.modules mo
    cross join app.roles r
    left join app.module_visibility ov
           on ov.club_id = p_club_id and ov.module_key = mo.key
          and ov.scope = 'role' and ov.role_id = r.id
   where r.club_id = p_club_id
     and mo.key <> 'manage'   -- nimmt keine Zeile an (Trigger) -> kein Schalter

  union all

  -- Gruppen und Mitglieder: NUR gesetzte Ausnahmen. Neue legt das UI ueber die
  -- vorhandenen Listen (Abteilungen / Mitglieder) an.
  select ov.module_key, ov.scope, d.id, d.name,
         null::boolean, ov.visible, ov.visible
    from app.module_visibility ov
    join app.departments d on d.id = ov.department_id
   where ov.club_id = p_club_id and ov.scope = 'department'

  union all

  select ov.module_key, ov.scope, cm.id, cm.first_name || ' ' || cm.last_name,
         null::boolean, ov.visible, ov.visible
    from app.module_visibility ov
    join app.club_members cm on cm.id = ov.member_id
   where ov.club_id = p_club_id and ov.scope = 'member'
$$;

comment on function app.club_module_visibility_matrix(uuid) is
  'Die Sichtbarkeits-Einstellung eines Vereins fuer das Admin-UI (0077): Rollen-Ebene VOLLSTAENDIG (Vorgabe + Ausnahme + Ergebnis), Gruppen- und Mitglieds-Ebene nur die gesetzten Ausnahmen. "manage" fehlt bewusst — es nimmt keine Zeile an.';

-- ----------------------------------------------------------------------------
-- 13. DIE NACHRECHNUNG. Eine Vorgabe, die man nur behauptet, ist keine —
--     dieselbe Haltung wie 0044 Abschnitt 9 / 0061 / 0068.
-- ----------------------------------------------------------------------------
do $$
declare
  v_ohne     int;
  v_sichtbar int;
  v_bad      text;
begin
  -- (a) Jedes Modul ist ENTSCHIEDEN: entweder es traegt eine Faehigkeit, oder
  --     es steht ausdruecklich auf der Immer-sichtbar-Liste. Eine vergessene
  --     Zuordnung waere ein still immer sichtbares Modul.
  select count(*) into v_ohne
    from app.modules
   where visibility_capability is null
     and key not in ('notes', 'family');
  if v_ohne <> 0 then
    raise exception '0077: % Modul(e) ohne Sichtbarkeits-Zuordnung: %',
      v_ohne,
      (select string_agg(key, ', ') from app.modules
        where visibility_capability is null and key not in ('notes', 'family'))
      using hint = 'Neues Modul? Dann gehoert es in Abschnitt 2 — oder ausdruecklich auf die Immer-sichtbar-Liste.';
  end if;

  -- (b) Die Zuordnung zeigt nur auf Faehigkeiten, die es gibt (der FK sichert
  --     das schon) — und die Mindeststufe liegt in den allowed_levels der
  --     Faehigkeit. Sonst waere die Vorgabe fuer JEDE Rolle false, weil die
  --     Stufe gar nicht vergeben werden KANN.
  select string_agg(format('%s->%s(min %s)', m.key, m.visibility_capability, m.visibility_min_rank), ', ')
    into v_bad
    from app.modules m
    join app.capabilities c on c.key = m.visibility_capability
   where m.visibility_min_rank > (
      select max(app.level_rank(l)) from unnest(c.allowed_levels) as l);
  if v_bad is not null then
    raise exception '0077: Mindeststufe ueber der hoechsten Stufe der Faehigkeit — nie erreichbar: %', v_bad;
  end if;

  -- (c) Die Vorgabe trifft die Aussage des Nutzers — GERECHNET, nicht
  --     behauptet, und ohne einen einzigen Verein in der DB (der Seed laeuft
  --     erst nach den Migrationen).
  --
  --     Was ein normales Mitglied NICHT sehen soll (die Aufzaehlung des
  --     Nutzers: Verwaltung, Finanzen, Mahnwesen, Wartelisten,
  --     Schliessfach-Verwaltung, Auswertung — plus Jubilaeen/Abteilungen).
  select string_agg(k, ', ') into v_bad
    from unnest(array['manage','finance','lockers','waitlists','chart',
                      'anniversaries','departments']) as k
   where app.module_role_key_default_visible('member', k);
  if v_bad is not null then
    raise exception '0077: ein normales Mitglied saehe per Vorgabe: %', v_bad
      using hint = 'Mindeststufe in Abschnitt 2 zu niedrig?';
  end if;

  --     Was es sehen MUSS (sonst ist die App fuer ein Kind leer).
  select string_agg(k, ', ') into v_bad
    from unnest(array['events','teams','routines','gallery','news','chat',
                      'notes','document','members','family']) as k
   where not app.module_role_key_default_visible('member', k);
  if v_bad is not null then
    raise exception '0077: ein normales Mitglied saehe per Vorgabe NICHT: %', v_bad
      using hint = 'Mindeststufe in Abschnitt 2 zu hoch?';
  end if;

  --     Der Kassenwart sieht die Finanzen, der Trainer nicht — sonst waere die
  --     Ableitung aus den Rechten nur Zufall.
  if not app.module_role_key_default_visible('treasurer', 'finance') then
    raise exception '0077: der Kassenwart saehe die Finanzen nicht';
  end if;
  if app.module_role_key_default_visible('coach', 'finance') then
    raise exception '0077: der Trainer saehe die Finanzen';
  end if;
  if not app.module_role_key_default_visible('coach', 'waitlists') then
    raise exception '0077: der Trainer saehe die Wartelisten nicht';
  end if;

  -- (d) Der owner sieht alles. Die geschuetzte Rolle darf sich nicht selbst
  --     aussperren — genau der Fall, gegen den Abschnitt 6 den Trigger stellt.
  select count(*) into v_sichtbar
    from app.modules m
   where not app.module_role_key_default_visible('owner', m.key);
  if v_sichtbar <> 0 then
    raise exception '0077: der owner saehe % Modul(e) nicht', v_sichtbar;
  end if;

  -- (e) SICHTBARKEIT IST KEIN SCHUTZ — und das muss man PRUEFEN koennen, nicht
  --     nur kommentieren: die neuen Funktionen duerfen in KEINER Policy stehen.
  if exists (
    select 1 from pg_policies p
     where p.schemaname in ('app', 'api')
       and (coalesce(p.qual, '') || coalesce(p.with_check, ''))
           ~ '(module_visible|member_module_visibility|module_role_default_visible|module_visibility)'
  ) then
    raise exception
      '0077: eine RLS-Policy benutzt die Sichtbarkeit als Gate — das ist genau der Fehler, den der Kopf dieser Datei verbietet: %',
      (select string_agg(p.schemaname || '.' || p.tablename || '.' || p.policyname, ', ')
         from pg_policies p
        where p.schemaname in ('app', 'api')
          and (coalesce(p.qual, '') || coalesce(p.with_check, ''))
              ~ '(module_visible|member_module_visibility|module_role_default_visible|module_visibility)');
  end if;
end $$;

-- Der Stolperdraht aus 0030 — ans Ende JEDER Migration.
select app.assert_no_insecure_views();

commit;
