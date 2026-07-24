-- ============================================================================
-- 0070_schliessfach_miete.sql — SCHLIESSFÄCHER KOSTEN GELD.
--
-- ############################################################################
-- ### DER BEFUND ############################################################
-- ############################################################################
-- blueprint/ORIGINAL-VOLLREFERENZ.md §3.1 (Zeile 609 der Lückenliste): „Schließ-
-- fächer sind in v2 gratis." app.lockers (0017:87-98) trägt label, location,
-- status, assigned_member_id, note — KEINEN Preis und KEINE Größe. Und die
-- ganze zweite Tabelle der v1 fehlt: die VERMIETUNG mit eigenem, vom Listen-
-- preis abweichendem Preis, Mietzeitraum und Status.
--
-- v1 hatte ZWEI Preisebenen, und das ist keine Doppelung, sondern der Kern:
--   Ebene 1  app.lockers.price_per_month_cents  = der LISTENPREIS am Fach.
--   Ebene 2  app.locker_rentals.price_per_month_cents = der TATSÄCHLICH
--            VEREINBARTE Preis dieser einen Vermietung. Er wird beim Vermieten
--            aus Ebene 1 vorgeschlagen und darf ÜBERSCHRIEBEN werden
--            (v1 SchliessfachVermietungSheet.swift:45-46,126).
--
-- ############################################################################
-- ### GRATIS IST DER SONDERFALL, NICHT DIE REGEL — UND NULL <> 0 #############
-- ############################################################################
-- v1 Models/Schliessfach.swift:95-103: „kostenlos" gilt, wenn der Preis LEER
-- ODER 0 ist. Das sind zwei verschiedene Aussagen, und diese Migration hält sie
-- auseinander, statt sie auf einen Wert zu quetschen:
--   NULL = NICHT FESTGELEGT. Niemand hat sich geäußert. In der Vermietung heißt
--          das in der v1 wörtlich „Nicht festgelegt"
--          (Models/SchliessfachVermietung.swift:67-75).
--   0    = AUSDRÜCKLICH KOSTENLOS. Jemand hat entschieden.
-- Eine `not null default 0`-Spalte hätte beides zu „ist halt gratis" verschmolzen
-- und damit eine Entscheidung erfunden, die niemand getroffen hat.
--
-- ### KEIN STILLER FALLBACK VON EBENE 2 AUF EBENE 1 ###
-- Ausdrücklich NICHT gebaut: „Vermietungspreis leer -> nimm den Fachpreis".
-- Das wäre bequem und wäre falsch. Der Listenpreis kann sich ändern, nachdem
-- die Vermietung läuft; ein Fallback würde alte Verträge rückwirkend teurer
-- machen. Die API liefert beide Zahlen nebeneinander aus, die Oberfläche zeigt
-- „Nicht festgelegt" — die Entscheidung trifft ein Mensch, nicht ein coalesce().
--
-- ############################################################################
-- ### DIE RECHTE — WIE FINANZEN, ABER AM LOCKER-RECHT ########################
-- ############################################################################
-- Der Auftrag: „Rechte wie Finanzen (Kasse/Vorstand verwalten; Mitglied sieht
-- sein eigenes Fach)." Das ist genau die Voreinstellung der BESTEHENDEN
-- Fähigkeit 'lockers' (0023:218-220, v_locker = owner/admin/treasurer ->
-- 'manage'; alle übrigen 'read_own'). Deshalb bekommt die Vermietung KEINE
-- eigene Fähigkeit: eine zweite Fähigkeit für dieselbe Sache wäre eine zweite
-- Wahrheit, und die Rechte-Matrix hätte zwei Schalter, die man
-- auseinanderdrehen kann, ohne dass irgendwer das wollte.
--
-- ZWEI bewusste Abweichungen von lockers_select (0026:53-63), beide begründet:
--
--   (a) app.can_act_for_member statt assigned_member_id = own_member_id.
--       Eine Vermietung ist eine ZAHLUNGSPFLICHT. Wer sie bezahlt, muss sie
--       sehen dürfen — und für ein Kind bezahlen die Eltern. Genau so hält es
--       invoices_select (0026:260-266: „Eltern sehen die Rechnung ihres
--       Kindes"). Das Fach selbst (app.lockers) bleibt UNVERÄNDERT bei
--       own_member_id; diese Migration fasst lockers_select nicht an.
--
--   (b) KEIN app.is_platform_admin()-Zweig. lockers_select hat einen; hier
--       fehlt er absichtlich. Der Plattform-Betreiber hätte sonst eine Liste
--       „welches Kind mietet welches Fach für wie viel Geld" — Vereinsgeld und
--       Kinderdaten in einem Satz. invoices_select (das Vorbild für Geld) hat
--       diesen Zweig ebenfalls nicht. Betreiber-Zugriff läuft über den
--       ausgewiesenen Weg (operator_audit_log), nicht über eine stille Policy.
--
-- Kinderschutz: Mietpreise gehören NICHT in Mitgliederlisten (Würde — ein Kind
-- ist nicht sein Fach und nicht sein Rückstand). Diese Migration legt deshalb
-- KEINE View und KEINE Aggregat-Route an, die Mitglied und Preis nebeneinander
-- stellt; die Miete erscheint in der MONATSÜBERSICHT DES MITGLIEDS (v1
-- www/portal/membership.html:369) — dort, wo die Person ihre eigenen Kosten
-- sieht.
--
-- ############################################################################
-- ### DER STATUSWECHSEL BEENDET KEINE VERMIETUNG #############################
-- ############################################################################
-- v1 SchliessfachFormView.swift:106-114 warnt beim Statuswechsel: „Achtung:
-- Eine aktive Vermietung wird nicht automatisch beendet!" Das ist RICHTIG so
-- und wird hier NICHT wegautomatisiert: ein Fach, das als defekt markiert wird,
-- hat trotzdem einen laufenden Vertrag — ob der endet, ist eine Entscheidung
-- des Vereins, keine Nebenwirkung eines Dropdowns. Diese Migration liefert
-- dafür app.locker_has_active_rental(), damit die Warnung auf einer MESSUNG
-- beruht und nicht auf einer Vermutung der Oberfläche.
--
-- ### WAS BEWUSST NICHT GEBAUT WIRD ###
--   * Keine Kaution — die gibt es in der v1 weder in der App noch in der DB
--     (Vollreferenz §3.1, „Bekannte Fehler"). Nichts erfinden.
--   * Keine automatische Rechnungsstellung aus der Miete. Der Zusammenhang
--     Miete -> Rechnung ist eine Geschäftsentscheidung (Turnus, Anteilsmonate,
--     Kündigungsfrist), zu der es keine Vorgabe gibt.
--   * Keine Preisliste/Staffel je Größe. Der Preis hängt am einzelnen Fach,
--     genau wie in der v1. (Eine Größen-Preisliste steht auf der Liste der
--     offenen Chef-Fragen und wird hier nicht vorweggenommen.)
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Die Größe. Werte deutsch wie in der v1 (klein/mittel/gross) und wie in
--    0066 (offen/voll/abgesagt) — der Codegen macht daraus Swift-/Kotlin-Enum-
--    Fälle, deshalb ASCII: 'gross', nicht 'groß'. Die ANZEIGE trägt echte
--    Umlaute, sie lebt in der i18n der Oberflächen.
-- ----------------------------------------------------------------------------
create type app.locker_size as enum ('klein', 'mittel', 'gross');

comment on type app.locker_size is
  'Größe eines Schließfachs (v1 schliessfaecher.groesse): klein / mittel / gross. Default mittel. / Locker size, default mittel.';

-- ----------------------------------------------------------------------------
-- 2. Der Status einer Vermietung. v1: aktiv / beendet / gekündigt.
--    'gekuendigt' ohne Umlaut aus demselben Codegen-Grund wie oben; die
--    Oberfläche schreibt „gekündigt".
--
--    Der Unterschied zwischen 'beendet' und 'gekuendigt' ist nicht kosmetisch:
--    beendet = der vereinbarte Zeitraum ist abgelaufen. gekuendigt = jemand hat
--    vorzeitig gekündigt. Für die Kasse ist das derselbe Zustand („zahlt nicht
--    mehr"), für die Rückfrage im Verein nicht.
-- ----------------------------------------------------------------------------
create type app.locker_rental_status as enum ('aktiv', 'beendet', 'gekuendigt');

comment on type app.locker_rental_status is
  'Status einer Schließfach-Vermietung (v1 schliessfach_vermietungen.status): aktiv / beendet (Zeitraum abgelaufen) / gekuendigt (vorzeitig beendet). Anzeige mit echtem Umlaut in der i18n. / Locker rental status.';

-- ----------------------------------------------------------------------------
-- 3. EBENE 1 — der Listenpreis am Fach + die Größe.
--    price_per_month_cents ist NULLABLE (siehe Kopf: NULL <> 0) und in ganzen
--    Cent (Blueprint §4: Geld ist integer cents, nie float — dieselbe Bauform
--    wie invoices.amount_cents, 0005:78).
-- ----------------------------------------------------------------------------
alter table app.lockers
  add column size app.locker_size not null default 'mittel',
  add column price_per_month_cents bigint,
  add constraint lockers_price_check
    check (price_per_month_cents is null or price_per_month_cents >= 0);

comment on column app.lockers.size is
  'Größe des Fachs: klein / mittel / gross. / Locker size.';
comment on column app.lockers.price_per_month_cents is
  'LISTENPREIS des Fachs in ganzen Cent je Monat. NULL = nicht festgelegt, 0 = ausdrücklich kostenlos — das ist NICHT dasselbe. Der tatsächlich berechnete Preis steht an der Vermietung (app.locker_rentals) und darf abweichen. / Monthly list price in integer cents; NULL = unset, 0 = explicitly free.';

-- ----------------------------------------------------------------------------
-- 4. Die Master-Daten-Sperre zieht mit. app.protect_locker (zuletzt 0026:80-98)
--    friert für alle, die 'lockers' NICHT auf 'manage' haben, die Stammdaten
--    ein und lässt nur assign/release durch. Ohne diese Ergänzung wären Größe
--    und PREIS die einzigen Stammdaten ohne Sperre.
--
--    Heute ist das doppelt gemoppelt (lockers_update verlangt ohnehin
--    'manage'), und genau deshalb steht es hier: die Policy kann sich ändern,
--    der Trigger ist die zweite Linie. Der Rest der Funktion ist WORTGLEICH
--    aus 0026 übernommen — ein Diff zeigt genau zwei neue Zeilen.
-- ----------------------------------------------------------------------------
create or replace function app.protect_locker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_cap(new.club_id, 'lockers', 'manage') then
    if new.club_id    is distinct from old.club_id
       or new.label    is distinct from old.label
       or new.location is distinct from old.location
       or new.note     is distinct from old.note
       or new.size     is distinct from old.size
       or new.price_per_month_cents is distinct from old.price_per_month_cents
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'lockers: assign/release only — editing or deleting a locker needs the lockers capability at level manage'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function app.protect_locker() is
  'Stammdaten-Sperre für Schließfächer: ohne Fähigkeit lockers=manage sind nur status + assigned_member_id änderbar (assign/release). Seit 0070 auch size und price_per_month_cents gesperrt.';

-- ----------------------------------------------------------------------------
-- 5. EBENE 2 — die Vermietung.
--
--    member_id ist NOT NULL: eine Vermietung ohne Mieter ist keine. Wer nur
--    „Fach belegt" ausdrücken will, nutzt weiterhin lockers.assigned_member_id.
--
--    end_on NULL = unbefristet (v1: „leer = unbegrenzt"). Die Dauer in Monaten
--    wird NICHT gespeichert — sie ist aus start_on/end_on ableitbar, und ein
--    zweiter Ort für dieselbe Wahrheit läuft irgendwann auseinander.
--
--    on delete restrict bei locker_id und member_id: ein Mietvertrag ist ein
--    Geldvorgang. Er verschwindet nicht, weil jemand ein Fach aufräumt.
-- ----------------------------------------------------------------------------
create table app.locker_rentals (
  id                    uuid primary key default app.uuid_v7(),
  club_id               uuid not null references app.clubs (id) on delete restrict,
  locker_id             uuid not null references app.lockers (id) on delete restrict,
  member_id             uuid not null references app.club_members (id) on delete restrict,
  -- Der VEREINBARTE Preis dieser Vermietung. NULL = nicht festgelegt.
  price_per_month_cents bigint,
  start_on              date not null,
  end_on                date,
  status                app.locker_rental_status not null default 'aktiv',
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint locker_rentals_price_check
    check (price_per_month_cents is null or price_per_month_cents >= 0),
  constraint locker_rentals_period_check
    check (end_on is null or end_on >= start_on)
);

create index locker_rentals_club_idx   on app.locker_rentals (club_id, status);
create index locker_rentals_locker_idx on app.locker_rentals (locker_id, status);
create index locker_rentals_member_idx on app.locker_rentals (club_id, member_id);

-- Ein Fach kann nicht zweimal gleichzeitig vermietet sein. Der Teilindex greift
-- nur auf 'aktiv' und ungelöschte Zeilen — die Historie (beendet/gekuendigt)
-- darf beliebig viele Verträge je Fach enthalten, und genau dafür ist sie da.
create unique index locker_rentals_one_active_per_locker
  on app.locker_rentals (locker_id)
  where status = 'aktiv' and deleted_at is null;

comment on table app.locker_rentals is
  'VERMIETUNG eines Schließfachs (v1 schliessfach_vermietungen): Mieter, Zeitraum und der TATSÄCHLICH VEREINBARTE Monatspreis, der vom Listenpreis am Fach abweichen darf. price_per_month_cents NULL = nicht festgelegt, 0 = kostenlos. Lesen/Schreiben über die bestehende Fähigkeit lockers (manage = alles, read_own + can_act_for_member = die eigene bzw. die des eigenen Kindes). Eine laufende Vermietung endet NIE automatisch — auch nicht, wenn das Fach auf defekt gesetzt wird. / Locker rental contract.';
comment on column app.locker_rentals.price_per_month_cents is
  'Vereinbarter Monatspreis in ganzen Cent. NULL = „Nicht festgelegt", 0 = kostenlos. KEIN stiller Rückfall auf den Listenpreis des Fachs — der kann sich ändern, der Vertrag nicht. / Agreed monthly price in integer cents; no silent fallback to the locker list price.';
comment on column app.locker_rentals.end_on is
  'Ende des Mietzeitraums. NULL = unbefristet. / End of the rental period; NULL = open-ended.';

create trigger locker_rentals_set_updated_at
  before update on app.locker_rentals
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Integrität + Unveränderlichkeit in EINEM Trigger (Muster:
--    app.protect_sparte_member, 0064).
--
--    (a) GLEICHER VEREIN: Fach UND Mieter gehören zum club_id der Vermietung.
--        Der FK garantiert nur Existenz, nicht Zugehörigkeit — ohne diesen
--        Zweig könnte ein Vorstand per direktem SQL ein FREMDES Mitglied in ein
--        eigenes Fach eintragen. Läuft UNCONDITIONAL (nicht an auth.uid()
--        gebunden): ein Daten-Invariant, keine Rollenfrage. Seed und Migration
--        schreiben konsistente Zeilen und passieren.
--
--    (b) UNVERÄNDERLICH sind club_id, locker_id und member_id. Ein Mietvertrag
--        wechselt weder den Verein noch das Fach noch den Mieter — wer ein
--        anderes Fach mietet, bekommt einen NEUEN Vertrag, und der alte wird
--        beendet. Sonst ließe sich Zahlungshistorie nachträglich einer anderen
--        Person zuschreiben. Preis, Zeitraum, Status und Notiz bleiben
--        änderbar; das ist der Alltag (Kündigung, Preisanpassung).
--        Der Immutabilitäts-Zweig ist wie in 0069 an auth.uid() gebunden, damit
--        Migration/Seed/Service-Pfade (Korrekturläufe) durchkommen.
-- ----------------------------------------------------------------------------
create or replace function app.protect_locker_rental()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- (a) gleicher Verein — immer, für jeden.
  if not exists (
    select 1 from app.lockers l
    where l.id = new.locker_id and l.club_id = new.club_id
  ) then
    raise exception 'locker_rentals: locker % does not belong to club %', new.locker_id, new.club_id
      using errcode = '23514',
            hint = 'Fach und Vermietung müssen zum selben Verein gehören. / Locker and rental must belong to the same club.';
  end if;

  if not exists (
    select 1 from app.club_members m
    where m.id = new.member_id and m.club_id = new.club_id
  ) then
    raise exception 'locker_rentals: member % does not belong to club %', new.member_id, new.club_id
      using errcode = '23514',
            hint = 'Mieter:in und Vermietung müssen zum selben Verein gehören. / Renter and rental must belong to the same club.';
  end if;

  -- (b) Unveränderlichkeit — nur im Client-Kontext.
  if tg_op = 'UPDATE' and auth.uid() is not null then
    if new.club_id   is distinct from old.club_id
       or new.locker_id is distinct from old.locker_id
       or new.member_id is distinct from old.member_id then
      raise exception 'locker_rentals: club_id, locker_id and member_id are immutable'
        using errcode = '42501',
              hint = 'Verein, Fach und Mieter:in einer Vermietung sind unveränderlich — für ein anderes Fach eine NEUE Vermietung anlegen und die alte beenden. / Club, locker and renter of a rental are immutable.';
    end if;
  end if;

  return new;
end;
$$;

comment on function app.protect_locker_rental() is
  'Zwei Invarianten der Schließfach-Vermietung: (a) Fach und Mieter:in gehören zum club_id der Vermietung (immer, auch für Service-Pfade); (b) club_id/locker_id/member_id sind nach dem Anlegen unveränderlich (im Client-Kontext).';

create trigger locker_rentals_protect
  before insert or update on app.locker_rentals
  for each row execute function app.protect_locker_rental();

-- ----------------------------------------------------------------------------
-- 7. Die Messung für die ehrliche Warnung beim Statuswechsel.
--    SECURITY DEFINER, weil die Oberfläche die Warnung auch dann zeigen muss,
--    wenn die aufrufende Person die Vermietung selbst nicht lesen darf — die
--    Funktion gibt NUR ein boolean zurück, keine Zeile, keinen Preis, keinen
--    Namen. Mehr braucht eine Warnung nicht, und mehr soll sie nicht wissen.
-- ----------------------------------------------------------------------------
create or replace function app.locker_has_active_rental(p_locker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app.locker_rentals r
    where r.locker_id = p_locker_id
      and r.status = 'aktiv'
      and r.deleted_at is null
  )
$$;

comment on function app.locker_has_active_rental(uuid) is
  'Läuft an diesem Fach gerade eine Vermietung? Grundlage für die ehrliche Warnung „Eine aktive Vermietung wird nicht automatisch beendet" beim Statuswechsel (v1 SchliessfachFormView.swift:106-114). Gibt bewusst NUR ein boolean zurück — kein Mieter, kein Preis.';

-- ----------------------------------------------------------------------------
-- 8. RLS. Siehe Kopf für die beiden bewussten Abweichungen von lockers_select.
--    Kein DELETE-Policy: gelöscht wird weich (deleted_at) — und im Regelfall
--    gar nicht, sondern beendet.
-- ----------------------------------------------------------------------------
alter table app.locker_rentals enable row level security;

create policy locker_rentals_select on app.locker_rentals
  for select to authenticated
  using (
    app.has_cap(club_id, 'lockers', 'read_all')
    or (
      app.cap_rank(club_id, 'lockers') >= app.level_rank('read_own')
      and app.can_act_for_member(member_id)
    )
  );

create policy locker_rentals_insert on app.locker_rentals
  for insert to authenticated
  with check (app.has_cap(club_id, 'lockers', 'manage'));

create policy locker_rentals_update on app.locker_rentals
  for update to authenticated
  using (app.has_cap(club_id, 'lockers', 'manage'))
  with check (app.has_cap(club_id, 'lockers', 'manage'));

-- ----------------------------------------------------------------------------
-- 9. Das Modul-Gate (0044 Abschnitt 8). Die Vermietung gehört zum abschaltbaren
--    Modul 'lockers' — ohne dieses restriktive Gate wäre der Schalter für das
--    Modul eine halbe Wahrheit: Fächer weg, Mietverträge noch da.
--    Wortgleich zum Generator aus 0044/0061.
-- ----------------------------------------------------------------------------
create policy locker_rentals_module_gate on app.locker_rentals
  as restrictive for all
  using (app.module_enabled(club_id, 'lockers'))
  with check (app.module_enabled(club_id, 'lockers'));

-- ----------------------------------------------------------------------------
-- 10. Nachrechnung statt Behauptung: das Gate MUSS von app.module_policy_usage()
--     gefunden werden, sonst behauptet das Etikett 'enforced' am Modul
--     'lockers' etwas, das für die neue Tabelle nicht gilt.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from app.module_policy_usage() u
    where u.module_key = 'lockers' and u.object = 'locker_rentals'
  ) then
    raise exception '0070: app.locker_rentals hat KEIN auffindbares Modul-Gate für "lockers"';
  end if;
end;
$$;

commit;
