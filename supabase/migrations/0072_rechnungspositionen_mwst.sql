-- ============================================================================
-- 0072_rechnungspositionen_mwst.sql — eine Rechnung besteht aus POSITIONEN,
-- und Positionen können UMSATZSTEUER tragen. Dazu der Zustand, der zwischen
-- „offen" und „bezahlt" bisher fehlte: TEILBEZAHLT.
--
-- ############################################################################
-- ### DER BEFUND ############################################################
-- ############################################################################
-- app.invoices (0005:72-87) trägt EINE Zahl: amount_cents. Kein „2 Nächte à
-- 40,00", kein Steuersatz, kein Steuerbetrag — und keine Möglichkeit, eine
-- Anzahlung abzubilden. Eine Rechnung, auf die 43,00 von 86,00 gezahlt wurden,
-- stand im v2 weiter als vollständig offen; die Mahnstufe lief darauf weiter,
-- als sei nichts passiert.
--
-- ############################################################################
-- ### WER RECHNET — DIE DATENBANK, GENAU EINMAL #############################
-- ############################################################################
-- Zeilensumme, Steuerbetrag und Bruttowert sind GENERATED STORED Spalten. Sie
-- werden nicht vom Client geschickt und nicht von der API berechnet. Grund:
-- Beträge, die an drei Stellen (iOS, Web, Server) nachgerechnet werden, weichen
-- irgendwann an einer Stelle um einen Cent ab — und dann diskutiert ein Verein
-- mit einer Familie über einen Cent, weil zwei Programme unterschiedlich
-- gerundet haben. Es gibt hier genau eine Rundungsregel, und sie steht in der
-- Tabellendefinition:
--
--   net_cents   = round(menge * einzelpreis)
--   vat_cents   = round(net_cents * satz / 100)
--   gross_cents = net_cents + vat_cents
--
-- Gerundet wird auf der ZEILE, nicht auf der Summe (kaufmännisch üblich und die
-- Reihenfolge, die auch der Ausdruck zeigt).
--
-- app.invoices.amount_cents wird, SOBALD eine Rechnung Positionen hat, von den
-- Positionen fortgeschrieben — die Positionen sind dann die Wahrheit, nicht ein
-- zweiter, frei tippbarer Betrag daneben. Rechnungen OHNE Positionen bleiben
-- unverändert das, was sie heute sind: ein Titel und ein Betrag. Beides ist
-- legitim; was es nicht geben darf, ist beides GLEICHZEITIG mit
-- unterschiedlichem Ergebnis.
--
-- ############################################################################
-- ### POSITIONEN NUR IM ENTWURF (GoBD) ######################################
-- ############################################################################
-- Eine ausgestellte Rechnung wird nicht nachträglich umgeschrieben — das ist
-- dieselbe Linie, die 0005:96-110 schon zieht (issued invoices are never
-- hard-deleted, cancel instead). Positionen sind deshalb NUR am Entwurf
-- (status = 'draft') veränderbar. Danach: stornieren und neu ausstellen.
-- Ausgenommen ist wie überall im Repo der Kontext ohne auth.uid() (Migration,
-- Seed, Service-Korrekturlauf).
--
-- ############################################################################
-- ### TEILBEZAHLT ist ein STATUS und ein BETRAG ##############################
-- ############################################################################
-- Beides, und zwar aus einem Grund: der Status beantwortet „wie steht die
-- Rechnung da" (Liste, Filter, Mahnlauf), paid_cents beantwortet „wie viel ist
-- angekommen". Ein Status ohne Betrag wäre eine Behauptung ohne Zahl; ein
-- Betrag ohne Status würde in jeder Liste übersehen.
--
-- open_cents (generated) ist der Rest: Forderung + Mahnkosten - Gezahltes. Auch
-- das steht genau einmal in der Datenbank und nicht dreimal im Client.
--
-- KEINE Automatik, die den Status umstellt. Ob eine vollständige Zahlung die
-- Rechnung auf 'paid' setzt, entscheidet weiterhin der bestehende Weg über die
-- API (routes/invoices.ts) — er bucht dabei die Einnahme ins Kassenbuch. Ein
-- Trigger, der still auf 'paid' springt, würde genau diese Buchung überspringen
-- und ein Loch im Kassenbuch hinterlassen.
--
-- ### KEINE STEUERSÄTZE VOREINGESTELLT ###
-- vat_rate ist eine Zahl an der Position, kein Katalog und kein Vereins-Default.
-- Welcher Satz für welche Leistung gilt (0 % bei Vereinsbeiträgen, 7 %, 19 %),
-- ist steuerliche Beratung und keine Programmiervorgabe. Der Verein trägt ein,
-- was sein Steuerberater sagt.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Der neue Enum-Wert. MUSS ausserhalb der Transaktion und VOR ihr stehen:
--    ein in derselben Transaktion hinzugefügter Enum-Wert ist dort noch nicht
--    benutzbar ("unsafe use of new value"). Vorbild: 0036:41 (member_status
--    'rejected'), 0007:28 (club_member_role 'moderator').
--    Position: direkt hinter 'open' — der Lebenslauf lautet
--    draft -> open -> partially_paid -> paid | cancelled.
-- ----------------------------------------------------------------------------
alter type app.invoice_status add value if not exists 'partially_paid' after 'open';

begin;

-- ----------------------------------------------------------------------------
-- 1. Teilzahlung an der Rechnung.
--    open_cents ist generated und darf deshalb NUR Basisspalten verwenden —
--    total_cents (0071, ebenfalls generated) ist hier nicht referenzierbar,
--    also steht die Summe ausgeschrieben da. Beide Spalten bleiben dadurch
--    zwangsläufig konsistent, weil beide aus denselben drei Basiswerten kommen.
-- ----------------------------------------------------------------------------
alter table app.invoices
  add column paid_cents      bigint not null default 0,
  add column vat_total_cents bigint not null default 0,
  add constraint invoices_paid_cents_check check (paid_cents >= 0),
  add constraint invoices_vat_total_check  check (vat_total_cents >= 0),
  -- Es kann nicht mehr angekommen sein, als gefordert wurde.
  add constraint invoices_paid_not_over_total
    check (paid_cents <= amount_cents + dunning_fee_cents + dunning_interest_cents),
  -- „Teilbezahlt" ohne Zahlung ist keine Teilzahlung, sondern ein falsches Etikett.
  add constraint invoices_partially_paid_needs_payment
    check (status <> 'partially_paid' or paid_cents > 0);

alter table app.invoices
  add column open_cents bigint
    generated always as
      (amount_cents + dunning_fee_cents + dunning_interest_cents - paid_cents) stored;

comment on column app.invoices.paid_cents is
  'Bereits GEZAHLTER Betrag in ganzen Cent (Anzahlung/Teilzahlung). Bei status = partially_paid zwingend > 0. / Amount already paid, in integer cents.';
comment on column app.invoices.vat_total_cents is
  'Summe der Umsatzsteuer aus den Rechnungspositionen. 0, solange die Rechnung keine Positionen hat. Wird von app.invoice_items_recalc fortgeschrieben. / Total VAT from the invoice items.';
comment on column app.invoices.open_cents is
  'OFFENER Rest = amount_cents + Mahnkosten - paid_cents (generated, stored). / Remaining amount due.';

-- ----------------------------------------------------------------------------
-- 2. Die Positionen.
--    quantity als numeric(10,3): halbe Stunden, 1,5 Sätze Kufenschoner, aber
--    keine Gleitkommazahl (Blueprint §4 — Geld und Mengen nie als float).
--    vat_rate als numeric(5,2): 0.00 / 7.00 / 19.00, aber ohne Katalog.
-- ----------------------------------------------------------------------------
create table app.invoice_items (
  id               uuid primary key default app.uuid_v7(),
  club_id          uuid not null references app.clubs (id) on delete restrict,
  -- cascade ist hier richtig: eine Rechnung darf ohnehin nur als ENTWURF hart
  -- gelöscht werden (app.protect_invoice_delete, 0005) — verwaiste Positionen
  -- einer gelöschten Entwurfsrechnung wären reiner Müll.
  invoice_id       uuid not null references app.invoices (id) on delete cascade,
  sort_order       integer not null default 0,
  description      text not null,
  quantity         numeric(10, 3) not null,
  unit_price_cents bigint not null,
  vat_rate         numeric(5, 2) not null default 0,
  net_cents        bigint generated always as
                     (round(quantity * unit_price_cents)::bigint) stored,
  vat_cents        bigint generated always as
                     (round(round(quantity * unit_price_cents) * vat_rate / 100)::bigint) stored,
  gross_cents      bigint generated always as
                     ((round(quantity * unit_price_cents)
                       + round(round(quantity * unit_price_cents) * vat_rate / 100))::bigint) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint invoice_items_description_len check (char_length(btrim(description)) between 1 and 500),
  constraint invoice_items_quantity_check  check (quantity > 0),
  constraint invoice_items_price_check     check (unit_price_cents >= 0),
  constraint invoice_items_vat_rate_check  check (vat_rate >= 0 and vat_rate <= 100)
);

create index invoice_items_invoice_idx on app.invoice_items (invoice_id, sort_order);
create index invoice_items_club_idx    on app.invoice_items (club_id);

comment on table app.invoice_items is
  'POSITIONEN einer Rechnung: Menge x Einzelpreis + Umsatzsteuersatz. Zeilensumme, Steuerbetrag und Bruttowert sind GENERATED — es gibt genau eine Rundungsregel, und sie steht hier. Positionen sind nur am ENTWURF veränderbar (GoBD). Hat eine Rechnung Positionen, schreiben sie invoices.amount_cents und invoices.vat_total_cents fort. / Invoice line items with VAT; totals are generated columns.';
comment on column app.invoice_items.vat_rate is
  'Umsatzsteuersatz dieser Position in Prozent (z. B. 0.00 / 7.00 / 19.00). Es gibt bewusst KEINEN Katalog und keinen Vereins-Default — welcher Satz gilt, ist Sache des Steuerberaters. / VAT rate in percent; no catalogue and no default by design.';
comment on column app.invoice_items.net_cents is
  'Zeilensumme netto = round(quantity * unit_price_cents). Generated. / Line net total.';
comment on column app.invoice_items.vat_cents is
  'Steuerbetrag der Zeile = round(net * vat_rate / 100). Gerundet wird auf der ZEILE, nicht auf der Summe. Generated. / Line VAT amount.';
comment on column app.invoice_items.gross_cents is
  'Zeilensumme brutto = net + vat. Generated. / Line gross total.';

create trigger invoice_items_set_updated_at
  before update on app.invoice_items
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Integrität + GoBD-Sperre in einem BEFORE-Trigger.
--    (a) Rechnung und Position gehören zum selben Verein (der FK garantiert nur
--        Existenz — Muster wie app.protect_locker_rental, 0070).
--    (b) Positionen nur am Entwurf (nur im Client-Kontext; Seed/Service frei).
-- ----------------------------------------------------------------------------
create or replace function app.protect_invoice_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row    app.invoice_items;
  v_status app.invoice_status;
  v_club   uuid;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  select i.status, i.club_id into v_status, v_club
    from app.invoices i where i.id = v_row.invoice_id;

  if v_status is null then
    raise exception 'invoice_items: invoice % does not exist', v_row.invoice_id
      using errcode = '23503';
  end if;

  if v_club is distinct from v_row.club_id then
    raise exception 'invoice_items: invoice % does not belong to club %', v_row.invoice_id, v_row.club_id
      using errcode = '23514',
            hint = 'Rechnung und Position müssen zum selben Verein gehören. / Invoice and item must belong to the same club.';
  end if;

  if auth.uid() is not null and v_status <> 'draft' then
    raise exception 'invoice_items: only draft invoices may be edited (GoBD)'
      using errcode = '42501',
            hint = 'Positionen einer ausgestellten Rechnung sind unveränderlich — stornieren und neu ausstellen. / Items of an issued invoice are immutable; cancel and re-issue instead.';
  end if;

  return v_row;
end;
$$;

comment on function app.protect_invoice_item() is
  'Zwei Invarianten der Rechnungsposition: gleicher Verein wie die Rechnung (immer), und Änderungen nur solange die Rechnung ein ENTWURF ist (im Client-Kontext, GoBD).';

create trigger invoice_items_protect
  before insert or update or delete on app.invoice_items
  for each row execute function app.protect_invoice_item();

-- ----------------------------------------------------------------------------
-- 4. Die Fortschreibung. AFTER-Trigger: Summe der Positionen -> amount_cents +
--    vat_total_cents der Rechnung.
--
--    Bewusst als vollständige Neuberechnung (nicht als Delta): bei DELETE und
--    bei Mengenänderungen wäre ein Delta drei Fallunterscheidungen weit — und
--    eine Rechnung hat Positionen in einstelliger Zahl, nicht in Millionen.
--
--    Wenn die LETZTE Position verschwindet, wird amount_cents 0. Das ist keine
--    Panne, sondern die einzige ehrliche Antwort: eine Rechnung, deren
--    Positionen alle entfernt wurden, fordert nichts. Der Weg zurück zur
--    positionslosen Rechnung mit Handbetrag ist, den Betrag danach zu setzen.
-- ----------------------------------------------------------------------------
create or replace function app.invoice_items_recalc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice uuid := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  v_gross   bigint;
  v_vat     bigint;
begin
  select coalesce(sum(gross_cents), 0), coalesce(sum(vat_cents), 0)
    into v_gross, v_vat
    from app.invoice_items where invoice_id = v_invoice;

  update app.invoices
     set amount_cents    = v_gross,
         vat_total_cents = v_vat
   where id = v_invoice;

  return null;
end;
$$;

comment on function app.invoice_items_recalc() is
  'Schreibt die Summe der Rechnungspositionen (brutto und Umsatzsteuer) auf app.invoices.amount_cents / vat_total_cents fort. Hat eine Rechnung Positionen, sind SIE die Wahrheit — nicht ein zweiter, frei tippbarer Betrag daneben.';

create trigger invoice_items_recalc
  after insert or update or delete on app.invoice_items
  for each row execute function app.invoice_items_recalc();

-- ----------------------------------------------------------------------------
-- 5. RLS.
--    SELECT hängt bewusst an der Sichtbarkeit der RECHNUNG statt eine eigene
--    Regel zu wiederholen: die Unterabfrage auf app.invoices läuft unter der
--    RLS derselben aufrufenden Person. Wer die Rechnung sieht — auch die Mutter
--    für ihr Kind (invoices_select, 0026:260-266) —, sieht ihre Positionen. Wer
--    sie nicht sieht, bekommt 0 Zeilen. Es gibt damit KEINE zweite Lesart, die
--    beim nächsten Umbau vergessen werden kann.
--
--    Schreiben = Finanzrolle, wie an der Rechnung selbst. Der Entwurfs-Zwang
--    kommt aus dem Trigger, nicht aus der Policy (er gilt auch für DELETE, und
--    für DELETE gibt es hier absichtlich eine Policy: eine Position eines
--    ENTWURFS darf verschwinden, das ist kein Buchungsvorgang).
-- ----------------------------------------------------------------------------
alter table app.invoice_items enable row level security;

create policy invoice_items_select on app.invoice_items
  for select to authenticated
  using (
    exists (
      select 1 from app.invoices i
      where i.id = invoice_id and i.club_id = invoice_items.club_id
    )
  );

create policy invoice_items_insert on app.invoice_items
  for insert to authenticated
  with check (app.has_cap(club_id, 'finance', 'manage'));

create policy invoice_items_update on app.invoice_items
  for update to authenticated
  using (app.has_cap(club_id, 'finance', 'manage'))
  with check (app.has_cap(club_id, 'finance', 'manage'));

create policy invoice_items_delete on app.invoice_items
  for delete to authenticated
  using (app.has_cap(club_id, 'finance', 'manage'));

-- ----------------------------------------------------------------------------
-- 6. Das Modul-Gate (0061 Abschnitt 3): Positionen gehören zum abschaltbaren
--    Modul 'finance'. Ohne dieses restriktive Gate wäre der Finanz-Schalter
--    eine halbe Wahrheit — Rechnungen weg, Positionen noch da.
-- ----------------------------------------------------------------------------
create policy invoice_items_module_gate on app.invoice_items
  as restrictive for all
  using (app.module_enabled(club_id, 'finance'))
  with check (app.module_enabled(club_id, 'finance'));

-- ----------------------------------------------------------------------------
-- 7. Nachrechnung statt Behauptung.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from app.module_policy_usage() u
    where u.module_key = 'finance' and u.object = 'invoice_items'
  ) then
    raise exception '0072: app.invoice_items hat KEIN auffindbares Modul-Gate für "finance"';
  end if;
end;
$$;

commit;
