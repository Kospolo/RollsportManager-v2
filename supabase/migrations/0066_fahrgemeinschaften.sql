-- ============================================================================
-- 0066_fahrgemeinschaften.sql — Fahrgemeinschaften zu Terminen (Marcel 2026-07-18)
--
-- Der Auftrag: an einem Termin bietet jemand eine FAHRT an (Abfahrtsort,
-- Abfahrtszeit, freie Plaetze, Rueckrufnummer, Notiz); andere sagen als
-- MITFAHRER zu; beide Seiten koennen absagen. Hauptfall sind Wettkaempfe und
-- Auswaertstermine — also genau die Termine, zu denen Kinder mitfahren.
--
-- ### WARUM DIE RUECKRUFNUMMER IN EINER EIGENEN TABELLE STEHT ###
-- Das ist die zentrale Entscheidung dieser Migration, und sie sieht auf den
-- ersten Blick nach unnoetiger Zerlegung aus. Sie ist keine.
--
-- Der Chef verlangt: die Rueckrufnummer sieht NUR, wer in DIESER Fahrt drin
-- ist (Fahrer <-> zugesagte Mitfahrer) plus die Verwaltung — und das
-- SERVERSEITIG, nicht per UI-Ausblenden. Die naheliegende Bauform waere eine
-- Spalte app.event_rides.rueckrufnummer. Sie kann diese Anforderung NICHT
-- erfuellen, und zwar aus einem strukturellen Grund:
--
--   RLS in Postgres ist ZEILEN-Schutz, kein SPALTEN-Schutz. Wer eine Zeile
--   sehen darf, sieht ALLE ihre Spalten. Die Fahrt selbst MUSS aber fuer
--   jeden sichtbar sein, der den Termin sieht — sonst findet niemand die
--   Mitfahrgelegenheit, die er sucht. Beides zugleich ("Fahrt sichtbar,
--   Nummer nicht") ist an EINER Zeile nicht ausdrueckbar.
--
-- Die einzige echte Spalten-Schranke, die Postgres kennt (GRANT SELECT(spalte)),
-- haengt an der DATENBANK-ROLLE — hier ist das fuer alle Beteiligten dieselbe
-- Rolle `authenticated`. Sie kann "Anna ja, Bernd nein" nicht unterscheiden.
--
-- Deshalb: die Nummer bekommt eine EIGENE ZEILE in einer eigenen Tabelle
-- (app.event_ride_contacts, 1:1 zur Fahrt) mit einer EIGENEN, strengeren
-- SELECT-Policy. Damit wird die Spalten-Frage zur Zeilen-Frage — und Zeilen
-- kann RLS. Ein `select * from app.event_rides` eines Unbeteiligten enthaelt
-- die Nummer dann nicht, weil sie dort schlicht nicht steht; ein
-- `select * from app.event_ride_contacts` liefert ihm 0 Zeilen. Das haelt
-- auch dann, wenn die API jemals umgangen oder eine Projektion vergessen wird.
--
-- ### ABGRENZUNG ZU 0054 (Kontaktdaten-Redaktion in members.ts) ###
-- Dort sitzt die Redaktion in der API, nicht in der DB — bewusst, denn sie ist
-- dort ein SPALTEN-Zuschnitt auf dem Roster, den jede berechtigte Rolle ohnehin
-- zeilenweise sehen darf (der Roster ist fuer Mitglieder sichtbar, die
-- Kontaktspalten fuer Vorstand/Team-Trainer). Hier ist die Lage strenger: das
-- Publikum der FAHRT (alle, die den Termin sehen) und das Publikum der NUMMER
-- (die Handvoll Beteiligter) fallen weit auseinander, und in der Nummer steckt
-- ein Elternkontakt. Wo die Publika so weit auseinanderliegen, ist die zweite
-- Tabelle die ehrliche Bauform. Die API projiziert zusaetzlich (Tiefenstaffelung),
-- aber sie ist hier NICHT die einzige Verteidigungslinie.
--
-- ### ABFAHRTSZEIT IST timestamptz, NICHT time ###
-- Begruendung (der Auftrag verlangt sie ausdruecklich): der Hauptfall ist der
-- AUSWAERTS-Wettkampf. Der faengt samstags um 9 Uhr an und die Fahrgemeinschaft
-- startet um 5:30 — moeglicherweise am VORTAG, wenn die Halle 400 km weg ist
-- und man Freitagabend anreist. Ein blosses `time` traegt kein Datum und waere
-- an einem mehrtaegigen Termin (events hat starts_at UND ends_at, mehrtaegig ist
-- moeglich) schlicht mehrdeutig: "05:30" an welchem Tag? Genau dieser Fall ist
-- der Hauptfall, nicht der Ausnahmefall. timestamptz ist ausserdem das, was
-- app.events.starts_at schon benutzt — eine zweite Zeit-Physik im selben
-- Terminkontext waere eine Fehlerquelle ohne Gegenwert.
--
-- ### KINDER ###
--   * Fuer ein Kind sagt ein ERZIEHUNGSBERECHTIGTER zu, nicht das Kind:
--     app.can_act_for_member (0002:192) traegt beides (eigene Zeile + Kinder
--     ueber guardianships) — dieselbe Funktion wie bei den RSVPs (0003:240).
--     Zusaetzlich haelt angemeldet_von_profile_id fest, WER zugesagt hat.
--   * Minderjaehrige bieten KEINE Fahrten an (Trigger, 42501). Ist das
--     Geburtsdatum unbekannt (bei Erwachsenen im Seed ist birth_date null),
--     wird ERLAUBT — fail-open ist hier richtig, weil ein Verein sonst die
--     Funktion nicht benutzen kann, bis jedes Geburtsdatum gepflegt ist. Das
--     ist eine bewusste Abwaegung und im Bericht ausdruecklich genannt.
--
-- ### RETURNING-FALLE ###
-- app.event_ride_contacts hat eine RESTRIKTIVE SELECT-Policy. Ein INSERT ...
-- RETURNING dort laeuft in 42501, sobald der Schreiber die Zeile nicht auch
-- lesen darf. Die Route schreibt deshalb nach dem Repo-Muster: uuid_v7() vorab,
-- INSERT OHNE RETURNING, danach getrennt lesen.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Zustaende.
--
-- 'voll' ist ein ABGELEITETER Zustand: der Trigger unten haelt ihn synchron zur
-- Platzzahl. Er wird nie von Hand gesetzt — waere er handgesetzt, gaebe es zwei
-- Wahrheiten (Status vs. tatsaechlich belegte Plaetze), die auseinanderlaufen.
-- 'abgesagt' dagegen ist eine ENTSCHEIDUNG und deshalb klebrig: eine abgesagte
-- Fahrt springt nicht von selbst auf 'offen' zurueck, nur weil jemand aussteigt.
-- ----------------------------------------------------------------------------
create type app.event_ride_status as enum ('offen', 'voll', 'abgesagt');

comment on type app.event_ride_status is
  'Zustand einer angebotenen Fahrt: offen (Plaetze frei) / voll (abgeleitet, vom Trigger app.sync_ride_status gepflegt) / abgesagt (Entscheidung des Fahrers oder des Vorstands, klebrig).';

create type app.event_ride_rider_status as enum ('zugesagt', 'abgesagt');

comment on type app.event_ride_rider_status is
  'Zustand einer Mitfahr-Zusage. Absagen setzt ''abgesagt'' (die Zeile bleibt als Verlauf stehen); eine erneute Zusage dreht dieselbe Zeile zurueck auf ''zugesagt'' — das Paar (Fahrt, Mitfahrer) ist eindeutig.';

-- ----------------------------------------------------------------------------
-- app.event_rides — EIN Fahrt-Angebot zu EINEM Termin.
--
-- Ohne rueckrufnummer (siehe Dateikopf): die steht in event_ride_contacts.
-- ----------------------------------------------------------------------------
create table app.event_rides (
  id                uuid primary key default app.uuid_v7(),
  club_id           uuid not null references app.clubs (id) on delete restrict,
  event_id          uuid not null references app.events (id) on delete cascade,
  -- Wer faehrt. on delete restrict wie ueberall beim Mitglied: eine Fahrt darf
  -- ein Mitglied nicht stillschweigend mit in den Abgrund reissen.
  driver_member_id  uuid not null references app.club_members (id) on delete restrict,
  abfahrtsort       text not null,
  abfahrtszeit      timestamptz not null,
  -- Plaetze IM AUTO fuer Mitfahrer, den Fahrer NICHT mitgezaehlt (sonst muesste
  -- jeder Nutzer im Kopf "minus eins" rechnen — die Zahl, die er eintippt, ist
  -- die Zahl, die er anbietet).
  plaetze_gesamt    int  not null,
  notiz             text,
  status            app.event_ride_status not null default 'offen',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint event_rides_abfahrtsort_not_blank check (btrim(abfahrtsort) <> ''),
  constraint event_rides_abfahrtsort_len_chk   check (char_length(abfahrtsort) <= 200),
  constraint event_rides_notiz_len_chk         check (notiz is null or char_length(notiz) <= 500),
  -- > 0: ein Angebot ueber null Plaetze ist kein Angebot. Obergrenze 8, damit
  -- das Feld kein Freitext-Unsinn wird (Kleinbus = 8 Mitfahrer ist die realistische
  -- Obergrenze im Vereinsalltag).
  constraint event_rides_plaetze_chk           check (plaetze_gesamt > 0 and plaetze_gesamt <= 8)
);

comment on table app.event_rides is
  'Fahrgemeinschaft: ein Fahrt-ANGEBOT zu einem Termin (Abfahrtsort/-zeit, Platzzahl, Notiz). Sichtbar fuer alle, die den TERMIN sehen duerfen (app.can_read_event — dieselbe Sichtbarkeit wie der Termin selbst, nicht neu erfunden). Die RUECKRUFNUMMER steht NICHT hier, sondern in app.event_ride_contacts mit eigener, engerer Policy — RLS schuetzt Zeilen, nicht Spalten.';
comment on column app.event_rides.abfahrtszeit is
  'Absoluter Abfahrtszeitpunkt (timestamptz, nicht time): bei Auswaertsterminen liegt die Abfahrt oft am VORTAG oder vor Sonnenaufgang — ein blosses time waere an mehrtaegigen Terminen mehrdeutig.';
comment on column app.event_rides.plaetze_gesamt is
  'Freie Plaetze fuer MITFAHRER, den Fahrer nicht mitgezaehlt. Ueberbuchung verhindert der Trigger app.enforce_ride_capacity (nicht nur die API).';
comment on column app.event_rides.status is
  'offen/voll/abgesagt. ''voll'' ist ABGELEITET (Trigger app.sync_ride_status) und wird nie von Hand gesetzt; ''abgesagt'' ist eine klebrige Entscheidung.';

create index event_rides_event_idx  on app.event_rides (event_id) where deleted_at is null;
create index event_rides_club_idx   on app.event_rides (club_id);
create index event_rides_driver_idx on app.event_rides (driver_member_id);

create trigger event_rides_set_updated_at
  before update on app.event_rides
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- app.event_ride_contacts — die Rueckrufnummer, 1:1 zur Fahrt, eigene Policy.
--
-- ride_id IST der Primaerschluessel: genau eine Kontaktzeile je Fahrt, ohne
-- zweiten Schluessel, den irgendwer synchron halten muesste.
-- ----------------------------------------------------------------------------
create table app.event_ride_contacts (
  ride_id         uuid primary key references app.event_rides (id) on delete cascade,
  -- club_id redundant zur Fahrt, aber absichtlich: die Mandanten-Isolation soll
  -- an DIESER Tabelle pruefbar sein, ohne ueber die Fahrt zu joinen (dieselbe
  -- Denkweise wie club_id auf event_teams/event_rsvps).
  club_id         uuid not null references app.clubs (id) on delete restrict,
  rueckrufnummer  text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint event_ride_contacts_nummer_not_blank check (btrim(rueckrufnummer) <> ''),
  -- Dieselbe Laenge wie club_members.phone (0054) — es IST dieselbe Art Datum.
  constraint event_ride_contacts_nummer_len_chk   check (char_length(rueckrufnummer) <= 40)
);

comment on table app.event_ride_contacts is
  'Rueckrufnummer EINER Fahrt, bewusst als eigene Zeile statt als Spalte auf app.event_rides: RLS schuetzt Zeilen, nicht Spalten — und die Fahrt muss weit sichtbar sein, die Nummer nicht. SELECT nur fuer Fahrt-BETEILIGTE (Fahrer + zugesagte Mitfahrer, jeweils inkl. Erziehungsberechtigte) und die Verwaltung (owner/admin/moderator/treasurer) bzw. den Plattform-Admin — durchgesetzt von app.may_see_ride_contact, nicht vom UI.';
comment on column app.event_ride_contacts.rueckrufnummer is
  'Telefonnummer fuer den Rueckruf (max. 40, wie club_members.phone). Vorbelegt aus der hinterlegten Telefonnummer des Fahrers, ueberschreibbar. KONTAKTdatum im Sinne von 0054 — Publikum eng.';

create index event_ride_contacts_club_idx on app.event_ride_contacts (club_id);

create trigger event_ride_contacts_set_updated_at
  before update on app.event_ride_contacts
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- app.event_ride_riders — die Mitfahrer.
--
-- member_id ist der MITFAHRENDE (also ggf. das KIND);
-- angemeldet_von_profile_id ist, WER die Zusage erklaert hat (Elternteil oder
-- die Person selbst). Diese Trennung ist der ganze Punkt: die Fahrerin muss
-- wissen, wen sie einsammelt (das Kind), und der Verein muss belegen koennen,
-- wer die Erklaerung abgegeben hat (der Elternteil).
-- ----------------------------------------------------------------------------
create table app.event_ride_riders (
  id                        uuid primary key default app.uuid_v7(),
  club_id                   uuid not null references app.clubs (id) on delete restrict,
  ride_id                   uuid not null references app.event_rides (id) on delete cascade,
  member_id                 uuid not null references app.club_members (id) on delete restrict,
  -- Wer zugesagt hat. set null, damit ein geloeschtes Konto die Zusage nicht
  -- mitreisst — die Zusage selbst bleibt fuer den Fahrer sichtbar.
  angemeldet_von_profile_id uuid references app.profiles (id) on delete set null,
  status                    app.event_ride_rider_status not null default 'zugesagt',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,
  -- Paar eindeutig (Auftrag). VOLL, nicht partiell: eine erneute Zusage dreht
  -- die vorhandene Zeile von 'abgesagt' auf 'zugesagt' zurueck, statt eine
  -- zweite anzulegen — so bleibt der Verlauf an einer Stelle und der Zaehler
  -- unten kann sich nicht an Karteileichen verrechnen.
  constraint event_ride_riders_uq unique (ride_id, member_id)
);

comment on table app.event_ride_riders is
  'Mitfahr-Zusage. member_id = die mitfahrende Person (ggf. das KIND), angemeldet_von_profile_id = wer die Zusage erklaert hat (Elternteil oder die Person selbst). Eintragen darf nur, wer app.can_act_for_member(member_id) erfuellt (sich selbst oder das eigene Kind) — dieselbe Vormund-Logik wie bei den RSVPs.';
comment on column app.event_ride_riders.angemeldet_von_profile_id is
  'Konto, das die Zusage erklaert hat. Bei einem Kind ist das der Erziehungsberechtigte, nicht das Kind — der Nachweis, WER entschieden hat.';

create index event_ride_riders_ride_idx   on app.event_ride_riders (ride_id) where deleted_at is null;
create index event_ride_riders_member_idx on app.event_ride_riders (member_id);
create index event_ride_riders_club_idx   on app.event_ride_riders (club_id);

create trigger event_ride_riders_set_updated_at
  before update on app.event_ride_riders
  for each row execute function app.set_updated_at();

-- ============================================================================
-- INTEGRITAET — Trigger, nicht nur API.
--
-- ### WARUM DIESE VIER TRIGGER SECURITY DEFINER SIND ###
-- Ein Trigger laeuft mit den Rechten der AUFRUFENDEN Person, RLS eingeschlossen.
-- Genau das macht Integritaets-Trigger auf RLS-geschuetzten Tabellen kaputt, und
-- zwar auf zwei Wegen, die beide hier auftraten:
--
--   * app.enforce_ride_capacity muss die Fahrt-Zeile LESEN UND SPERREN
--     (select ... for update). Postgres verlangt fuer FOR UPDATE, dass auch die
--     UPDATE-Policy die Zeile durchlaesst — eine Mutter, die ihr Kind eintraegt,
--     darf die fremde Fahrt aber nicht aendern. Ohne definer-Rechte saehe der
--     Zaehler die Fahrt schlicht nicht und wuerde "existiert nicht" melden:
--     die Kapazitaetspruefung waere wirkungslos.
--   * app.sync_ride_status SCHREIBT den abgeleiteten Status auf die Fahrt.
--     Mitfahrer duerfen Fahrten nicht aendern — der Status wuerde also nur dann
--     nachziehen, wenn zufaellig die Fahrerin selbst jemanden eintraegt.
--
-- Das ist keine Aufweichung: diese Funktionen pruefen INTEGRITAET (passt die
-- Zahl? ist die Person volljaehrig?), sie AUTORISIEREN nicht. Wer ueberhaupt
-- schreiben darf, entscheiden vorher die Policies. Alle vier tragen
-- `set search_path = ''` und lesen ausschliesslich die eigenen Tabellen ueber
-- vollqualifizierte Namen — es gibt keinen Parameter, ueber den sich fremde
-- Zeilen unterschieben liessen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Minderjaehrige bieten keine Fahrten an.
--
-- Gemessen wird das Alter ZUM ZEITPUNKT DER ABFAHRT, nicht heute: wer in drei
-- Wochen 18 wird und fuer den Wettkampf danach eine Fahrt anbietet, darf das.
-- Ein Vergleich gegen now() haette ihn ohne Grund abgewiesen.
--
-- birth_date unbekannt -> ERLAUBT (fail-open, siehe Dateikopf). Das ist die
-- einzige Stelle dieser Migration, die im Zweifel weiter statt enger ist, und
-- sie ist bewusst so gesetzt: die Erwachsenen im Bestand haben typischerweise
-- KEIN Geburtsdatum gepflegt (im Seed sind es genau die Erwachsenen), ein
-- fail-closed haette also ausgerechnet die Fahrer ausgesperrt.
-- ----------------------------------------------------------------------------
create or replace function app.protect_ride_driver_adult()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_birth date;
begin
  select m.birth_date into v_birth
  from app.club_members m
  where m.id = new.driver_member_id;

  if v_birth is not null
     and new.abfahrtszeit < (v_birth + interval '18 years') then
    raise exception 'Minderjaehrige duerfen keine Fahrt anbieten (Mitglied %)', new.driver_member_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function app.protect_ride_driver_adult() is
  'Riegel: nur Volljaehrige bieten Fahrten an. Gemessen am Alter ZUR ABFAHRTSZEIT (nicht heute). Unbekanntes birth_date erlaubt die Fahrt (fail-open, bewusst: sonst sperrt ein ungepflegtes Geburtsdatum die Erwachsenen aus). Gilt AUCH fuer den Seed/Dienstweg — eine minderjaehrige Fahrerin ist auch dann falsch, wenn sie ein Skript eintraegt.';

create trigger event_rides_driver_adult
  before insert or update of driver_member_id, abfahrtszeit on app.event_rides
  for each row execute function app.protect_ride_driver_adult();

-- ----------------------------------------------------------------------------
-- 2. Keine Ueberbuchung — und keine Zusage zu einer abgesagten Fahrt.
--
-- Der Zaehler laeuft ueber die Fahrt-Zeile, die vorher GESPERRT wird
-- (select ... for update). Ohne diese Sperre koennten zwei gleichzeitige
-- Zusagen beide den freien Platz sehen und beide einsteigen — der klassische
-- Lost-Update. Mit ihr wartet die zweite Transaktion und sieht den belegten
-- Stand. (Der unique-Index auf (ride_id, member_id) faengt nur DENSELBEN
-- Mitfahrer doppelt ab, nicht zwei verschiedene auf einem Platz.)
-- ----------------------------------------------------------------------------
create or replace function app.enforce_ride_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride    record;
  v_belegt  int;
begin
  -- Nur eine AKTIVE Zusage belegt einen Platz. Absagen/geloeschte Zeilen nicht.
  if new.status <> 'zugesagt' or new.deleted_at is not null then
    return new;
  end if;

  select r.id, r.status, r.plaetze_gesamt, r.driver_member_id, r.club_id, r.deleted_at
    into v_ride
  from app.event_rides r
  where r.id = new.ride_id
  for update;

  if not found or v_ride.deleted_at is not null then
    raise exception 'Fahrt % existiert nicht (mehr)', new.ride_id using errcode = '23503';
  end if;

  -- Mandanten-Integritaet: Fahrt, Mitfahrer-Zeile und Mitglied im selben Verein.
  if v_ride.club_id <> new.club_id then
    raise exception 'Fahrt % gehoert zu einem anderen Verein', new.ride_id using errcode = '23514';
  end if;
  if not exists (select 1 from app.club_members m
                 where m.id = new.member_id and m.club_id = new.club_id) then
    raise exception 'Mitglied % gehoert nicht zu diesem Verein', new.member_id using errcode = '23514';
  end if;

  if v_ride.status = 'abgesagt' then
    raise exception 'Fahrt % ist abgesagt — keine Zusage moeglich', new.ride_id using errcode = '23514';
  end if;

  -- Der Fahrer faehrt schon; er kann nicht sein eigener Mitfahrer sein.
  if v_ride.driver_member_id = new.member_id then
    raise exception 'Der Fahrer ist bereits an Bord und kann nicht zusaetzlich mitfahren'
      using errcode = '23514';
  end if;

  select count(*) into v_belegt
  from app.event_ride_riders rr
  where rr.ride_id = new.ride_id
    and rr.status = 'zugesagt'
    and rr.deleted_at is null
    and rr.id <> new.id;   -- die eigene Zeile beim UPDATE nicht doppelt zaehlen

  if v_belegt + 1 > v_ride.plaetze_gesamt then
    raise exception 'Fahrt % ist voll (% von % Plaetzen belegt)',
      new.ride_id, v_belegt, v_ride.plaetze_gesamt
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function app.enforce_ride_capacity() is
  'Verhindert Ueberbuchung serverseitig: sperrt die Fahrt-Zeile (for update, gegen gleichzeitige Zusagen) und weist die Zusage mit 23514 ab, wenn kein Platz frei ist, die Fahrt abgesagt ist, der Fahrer sich selbst eintragen will oder Verein/Mitglied nicht zusammenpassen.';

create trigger event_ride_riders_capacity
  before insert or update on app.event_ride_riders
  for each row execute function app.enforce_ride_capacity();

-- ----------------------------------------------------------------------------
-- 3. Die Platzzahl darf nicht unter die bereits vergebenen Plaetze fallen.
--    (Sonst waere die Ueberbuchung ueber den Umweg "Fahrt bearbeiten" wieder
--     offen — dieselbe Luecke wie beim Hochstufen der Termin-Zielgruppe in
--     0050, nur andersherum.)
-- ----------------------------------------------------------------------------
create or replace function app.enforce_ride_seats_not_below_taken()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_belegt int;
begin
  if new.plaetze_gesamt >= old.plaetze_gesamt then
    return new;
  end if;

  select count(*) into v_belegt
  from app.event_ride_riders rr
  where rr.ride_id = new.id
    and rr.status = 'zugesagt'
    and rr.deleted_at is null;

  if new.plaetze_gesamt < v_belegt then
    raise exception 'Es sitzen bereits % Mitfahrer im Auto — die Platzzahl kann nicht auf % gesenkt werden',
      v_belegt, new.plaetze_gesamt
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function app.enforce_ride_seats_not_below_taken() is
  'Die Platzzahl einer Fahrt kann nicht unter die Zahl der bereits zugesagten Mitfahrer gesenkt werden — sonst waere Ueberbuchung ueber den Umweg PATCH wieder moeglich.';

create trigger event_rides_seats_guard
  before update of plaetze_gesamt on app.event_rides
  for each row execute function app.enforce_ride_seats_not_below_taken();

-- ----------------------------------------------------------------------------
-- 4. 'voll' synchron halten (abgeleiteter Zustand, siehe Enum-Kommentar).
--    'abgesagt' wird NICHT angefasst — eine abgesagte Fahrt bleibt abgesagt.
-- ----------------------------------------------------------------------------
create or replace function app.sync_ride_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride_id uuid := coalesce(new.ride_id, old.ride_id);
  v_belegt  int;
  v_soll    app.event_ride_status;
begin
  select count(*) into v_belegt
  from app.event_ride_riders rr
  where rr.ride_id = v_ride_id
    and rr.status = 'zugesagt'
    and rr.deleted_at is null;

  -- Der Soll-Zustand wird EINMAL und typisiert bestimmt (nicht zweimal als
  -- untypisiertes Literal im UPDATE): ein blosses 'voll' im set-Zweig ist fuer
  -- Postgres text, nicht app.event_ride_status, und der implizite Cast
  -- existiert nicht.
  select case when v_belegt >= r.plaetze_gesamt then 'voll' else 'offen' end
    into v_soll
  from app.event_rides r
  where r.id = v_ride_id;

  if v_soll is null then
    return null;   -- Fahrt bereits weg (cascade delete) — nichts zu tun.
  end if;

  update app.event_rides r
     set status = v_soll
   where r.id = v_ride_id
     and r.status <> 'abgesagt'
     and r.status <> v_soll;

  return null;
end;
$$;

comment on function app.sync_ride_status() is
  'Haelt app.event_rides.status zwischen ''offen'' und ''voll'' synchron zur Zahl der zugesagten Mitfahrer. ''abgesagt'' bleibt unberuehrt. Der Status ist damit abgeleitet und kann nicht gegen die Platzzahl luegen.';

create trigger event_ride_riders_sync_status
  after insert or update or delete on app.event_ride_riders
  for each row execute function app.sync_ride_status();

-- ============================================================================
-- SICHTBARKEIT
-- ============================================================================

-- ----------------------------------------------------------------------------
-- app.may_see_ride_contact — wer die Rueckrufnummer sehen darf.
--
-- SECURITY DEFINER, weil die Funktion event_rides und event_ride_riders liest
-- und die Policy auf event_ride_contacts sonst die Policies JENER Tabellen
-- ausloesen wuerde (Policy-Rekursion, dieselbe Begruendung wie bei
-- app.can_read_event, 0050:209).
--
-- WAHR fuer:
--   (a) den Fahrer selbst (bzw. seine Erziehungsberechtigten — theoretisch,
--       praktisch ist er volljaehrig; can_act_for_member deckt beides ab),
--   (b) jede Person mit einer AKTIVEN Zusage in dieser Fahrt — und damit ueber
--       can_act_for_member auch die ELTERN des mitfahrenden Kindes. Genau das
--       ist der Sinn der Uebung: die Mutter, deren Kind mitfaehrt, braucht die
--       Nummer der Fahrerin, und die Fahrerin die der Mutter.
--       ⚠️ status='zugesagt': wer ABGESAGT hat, verliert die Nummer wieder.
--   (c) die Verwaltung (owner/admin/moderator/treasurer — app.MANAGE_MEMBER_ROLES
--       der API) wegen der Aufsichtspflicht, ausdruecklich vom Chef gewuenscht,
--   (d) den Plattform-Betreiber (ueber app.is_platform_admin, an das
--       Zugriffsprotokoll gekoppelt wie ueberall).
--
-- NICHT wahr fuer: den Rest des Vereins, Trainer:innen ohne eigene Beteiligung,
-- und jede Person aus einem anderen Verein.
-- ----------------------------------------------------------------------------
create or replace function app.may_see_ride_contact(p_ride_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.event_rides r
    where r.id = p_ride_id
      and r.deleted_at is null
      and (
        -- (a) der Fahrer
        app.can_act_for_member(r.driver_member_id)

        -- (b) eine aktive Zusage — inkl. der Eltern des mitfahrenden Kindes
        or exists (
          select 1
          from app.event_ride_riders rr
          where rr.ride_id = r.id
            and rr.status = 'zugesagt'
            and rr.deleted_at is null
            and app.can_act_for_member(rr.member_id)
        )

        -- (c) Verwaltung / Aufsichtspflicht  (d) Betreiber
        or app.has_club_role(r.club_id, array['owner', 'admin', 'moderator', 'treasurer'])
        or app.is_platform_admin()
      )
  )
$$;

comment on function app.may_see_ride_contact(uuid) is
  'Darf die/der Aufrufende die Rueckrufnummer DIESER Fahrt sehen? Wahr fuer den Fahrer, fuer jede Person mit AKTIVER Zusage (ueber can_act_for_member auch deren Erziehungsberechtigte), fuer die Verwaltung (owner/admin/moderator/treasurer, Aufsichtspflicht) und den Plattform-Admin. Wer absagt, verliert die Nummer. SECURITY DEFINER gegen Policy-Rekursion.';

-- ----------------------------------------------------------------------------
-- RLS. Grants kommen aus den default privileges (0001) — die Policies engen ein.
-- ----------------------------------------------------------------------------
alter table app.event_rides         enable row level security;
alter table app.event_ride_contacts enable row level security;
alter table app.event_ride_riders   enable row level security;

-- --- app.event_rides ---------------------------------------------------------

-- SELECT: wer den TERMIN sehen darf, sieht auch die Fahrten dazu. Die
-- Termin-Sichtbarkeit wird NICHT nachgebaut, sondern aufgerufen (app.can_read_event,
-- 0050) — sonst haetten wir zwei Wahrheiten darueber, wer einen Termin sieht,
-- und die zweite waere die falsche, sobald jemand die erste aendert.
create policy event_rides_select on app.event_rides
  for select to authenticated
  using (app.is_club_member(club_id) and app.can_read_event(event_id));

-- INSERT: eine Fahrt bietet man fuer SICH SELBST an — nicht fuer andere.
-- Deshalb hier NICHT can_act_for_member (das schloesse die eigenen KINDER ein,
-- und ein Kind als Fahrer ist genau das, was verboten ist), sondern die eigene
-- Mitgliedszeile: profile_id = auth.uid(), aktiv. Der Vorstand darf zusaetzlich
-- eine Fahrt fuer ein Mitglied eintragen (der Anruf "ich fahre, trag mich ein"
-- ist der Realfall) — der Volljaehrigkeits-Trigger gilt fuer ihn genauso.
create policy event_rides_insert on app.event_rides
  for insert to authenticated
  with check (
    app.is_club_member(club_id)
    and app.can_read_event(event_id)
    and (
      exists (
        select 1 from app.club_members m
        where m.id = driver_member_id
          and m.club_id = club_id
          and m.profile_id = auth.uid()
          and m.status = 'active'
          and m.deleted_at is null
      )
      or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
    )
  );

-- UPDATE (bearbeiten/absagen): der Fahrer selbst oder der Vorstand.
create policy event_rides_update on app.event_rides
  for update to authenticated
  using (
    exists (
      select 1 from app.club_members m
      where m.id = driver_member_id
        and m.profile_id = auth.uid()
        and m.deleted_at is null
    )
    or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
  )
  with check (
    app.is_club_member(club_id)
    and (
      exists (
        select 1 from app.club_members m
        where m.id = driver_member_id
          and m.profile_id = auth.uid()
          and m.deleted_at is null
      )
      or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
    )
  );

-- Kein DELETE: Loeschen ist SOFT (deleted_at), wie ueberall im Projekt.

-- --- app.event_ride_contacts -------------------------------------------------
-- Die enge Tuer. Nur Beteiligte + Verwaltung, durchgesetzt in der DB.
create policy event_ride_contacts_select on app.event_ride_contacts
  for select to authenticated
  using (app.is_club_member(club_id) and app.may_see_ride_contact(ride_id));

-- Schreiben darf, wer die Fahrt schreiben darf — der Fahrer oder der Vorstand.
create policy event_ride_contacts_insert on app.event_ride_contacts
  for insert to authenticated
  with check (
    app.is_club_member(club_id)
    and exists (
      select 1 from app.event_rides r
      where r.id = ride_id
        and r.club_id = club_id
        and r.deleted_at is null
        and (
          exists (select 1 from app.club_members m
                  where m.id = r.driver_member_id
                    and m.profile_id = auth.uid()
                    and m.deleted_at is null)
          or app.has_club_role(r.club_id, array['owner', 'admin', 'moderator'])
        )
    )
  );

create policy event_ride_contacts_update on app.event_ride_contacts
  for update to authenticated
  using (
    app.is_club_member(club_id)
    and exists (
      select 1 from app.event_rides r
      where r.id = ride_id
        and (
          exists (select 1 from app.club_members m
                  where m.id = r.driver_member_id
                    and m.profile_id = auth.uid()
                    and m.deleted_at is null)
          or app.has_club_role(r.club_id, array['owner', 'admin', 'moderator'])
        )
    )
  )
  with check (
    app.is_club_member(club_id)
    and exists (
      select 1 from app.event_rides r
      where r.id = ride_id
        and (
          exists (select 1 from app.club_members m
                  where m.id = r.driver_member_id
                    and m.profile_id = auth.uid()
                    and m.deleted_at is null)
          or app.has_club_role(r.club_id, array['owner', 'admin', 'moderator'])
        )
    )
  );

-- --- app.event_ride_riders ---------------------------------------------------

-- SELECT: wer die Fahrt sieht, sieht ihre Mitfahrer. Das ist Absicht und kein
-- Leck: NAMEN von Vereinsmitgliedern sind innerhalb des Vereins ohnehin
-- sichtbar (Roster), und wer eine Mitfahrgelegenheit sucht, muss sehen, ob
-- noch Platz ist und wer schon mitfaehrt. Die KONTAKTdaten sind das, was
-- geschuetzt gehoert — und die stehen nicht hier.
create policy event_ride_riders_select on app.event_ride_riders
  for select to authenticated
  using (
    app.is_club_member(club_id)
    and exists (
      select 1 from app.event_rides r
      where r.id = ride_id and r.deleted_at is null and app.can_read_event(r.event_id)
    )
  );

-- INSERT: nur fuer sich selbst ODER als Erziehungsberechtigte:r
-- (app.can_act_for_member — dieselbe Funktion wie bei den RSVPs, 0003:240).
-- Der Vorstand darf ebenfalls eintragen (Aufsicht/Telefon-Anmeldung).
-- angemeldet_von_profile_id MUSS das eigene Konto sein: die Zeile soll nicht
-- behaupten koennen, jemand anderes habe zugesagt.
create policy event_ride_riders_insert on app.event_ride_riders
  for insert to authenticated
  with check (
    app.is_club_member(club_id)
    and angemeldet_von_profile_id = auth.uid()
    and exists (
      select 1 from app.event_rides r
      where r.id = ride_id
        and r.club_id = club_id
        and r.deleted_at is null
        and app.can_read_event(r.event_id)
    )
    and (
      app.can_act_for_member(member_id)
      or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
    )
  );

-- UPDATE (Zusage zurueckziehen / erneuern): die eigene Zusage bzw. die des
-- eigenen Kindes, der FAHRER dieser Fahrt (er muss jemanden austragen koennen,
-- wenn das Auto ausfaellt) und der Vorstand.
create policy event_ride_riders_update on app.event_ride_riders
  for update to authenticated
  using (
    app.can_act_for_member(member_id)
    or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
    or exists (
      select 1 from app.event_rides r
      join app.club_members m on m.id = r.driver_member_id
      where r.id = ride_id and m.profile_id = auth.uid() and m.deleted_at is null
    )
  )
  with check (
    app.is_club_member(club_id)
    and (
      app.can_act_for_member(member_id)
      or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
      or exists (
        select 1 from app.event_rides r
        join app.club_members m on m.id = r.driver_member_id
        where r.id = ride_id and m.profile_id = auth.uid() and m.deleted_at is null
      )
    )
  );

-- Kein DELETE: eine zurueckgezogene Zusage ist 'abgesagt', nicht verschwunden.

commit;
