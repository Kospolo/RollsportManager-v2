-- ============================================================================
-- 0080_rechnungseinstellungen.sql — der BRIEFKOPF einer Rechnung, EIN Satz je
-- Verein. Bis hierher trug eine Rechnung Nummer, Betrag und Positionen (0072) —
-- aber keinen Absender, keine Steuernummer, keine Bankverbindung und keine
-- Fusszeile. Ein Ausdruck ohne diese Angaben ist keine ordentliche Rechnung.
--
-- ############################################################################
-- ### EIN SATZ JE VEREIN ####################################################
-- ############################################################################
-- app.invoice_settings hat einen UNIQUE-Schluessel auf club_id: es gibt genau
-- einen Briefkopf pro Verein, nicht je Rechnung. Die Angaben werden beim Druck
-- (Web-Druckansicht, Cmd+P) in die Rechnung gezogen — sie sind NICHT in der
-- einzelnen Rechnung eingefroren, denn sie aendern sich selten und gehoeren zum
-- Verein, nicht zum Vorgang.
--
-- ############################################################################
-- ### WER SCHREIBT, WER LIEST ###############################################
-- ############################################################################
-- Schreiben = app.is_club_admin (owner/admin/moderator) — der Briefkopf ist eine
-- Vereins-Grundeinstellung wie Name und Logo (0060), kein Finanz-Buchungsvorgang.
-- Ein Kassenwart (treasurer) fuehrt die Kasse, aendert aber nicht die
-- Aussendarstellung des Vereins.
-- Lesen = jedes Vereinsmitglied (app.is_club_member): wer eine Rechnung sieht,
-- sieht auch ihren Briefkopf; die Druckansicht braucht die Angaben.
--
-- ### NUMMERNKREIS-PRAEFIX ###
-- number_prefix ist NUR informativ/kosmetisch. Die fortlaufende, luecken- und
-- race-freie Rechnungsnummer kommt weiterhin ausschliesslich aus
-- app.next_invoice_number() (0005) — dieser Satz vergibt keine Nummern.
--
-- ### KEIN MWST-KATALOG ###
-- default_vat_rate ist ein VORSCHLAG fuer die Positionseingabe, mehr nicht.
-- Welcher Satz fuer welche Leistung gilt, bleibt Sache des Steuerberaters
-- (dieselbe Linie wie 0072: vat_rate steht an der Position, kein Vereins-Zwang).
-- ============================================================================

begin;

create table app.invoice_settings (
  id               uuid primary key default app.uuid_v7(),
  -- genau EIN Briefkopf je Verein; cascade, weil der Briefkopf ohne den Verein
  -- keinen Sinn hat (anders als eine Rechnung, die GoBD-terminal bleibt).
  club_id          uuid not null unique references app.clubs (id) on delete cascade,

  -- Absenderblock / Briefkopf (mehrzeilig, Freitext).
  sender_block     text not null default '',
  -- optionales Logo (Pfad oder Data-URL); leer = keins.
  logo_url         text not null default '',

  -- Steuerliche Kennungen.
  tax_number       text not null default '',   -- Steuernummer
  vat_id           text not null default '',   -- USt-IdNr

  -- Vertretungsberechtigung (Vorstand) fuer die Fusszeile.
  board_members    text not null default '',

  -- Fusszeile (Vereinsregister, Gemeinnuetzigkeit, Kontakt …).
  footer_text      text not null default '',

  -- Bankverbindung.
  bank_name        text not null default '',
  iban             text not null default '',
  bic              text not null default '',
  account_holder   text not null default '',

  -- Nummernkreis-Praefix (rein informativ, siehe Kopf).
  number_prefix    text not null default '',

  -- MwSt-Default fuer die Positionseingabe (Vorschlag, kein Zwang).
  default_vat_rate numeric(5, 2) not null default 0,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint invoice_settings_vat_default_check check (default_vat_rate >= 0 and default_vat_rate <= 100)
);

comment on table app.invoice_settings is
  'BRIEFKOPF/Rechnungs-Einstellungen je Verein (EIN Satz, UNIQUE club_id): Absenderblock, Logo, Steuernummer/USt-IdNr, Vorstand, Fusszeile, Bankverbindung, Nummernkreis-Praefix, MwSt-Default. Schreiben = is_club_admin, Lesen = Vereinsmitglied. / Per-club invoice letterhead & settings.';
comment on column app.invoice_settings.number_prefix is
  'Rein informativ. Die fortlaufende Rechnungsnummer kommt aus app.next_invoice_number(), nicht aus dieser Spalte. / Cosmetic only; the running number is issued by app.next_invoice_number().';
comment on column app.invoice_settings.default_vat_rate is
  'Vorschlag fuer den Steuersatz neuer Positionen — kein Katalog und kein Zwang (0072). / Suggested VAT rate for new items; no catalogue, no enforcement.';

create trigger invoice_settings_set_updated_at
  before update on app.invoice_settings
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS. Lesen = Mitglied, Schreiben = is_club_admin. Kein DELETE-Pfad: der
-- Briefkopf verschwindet nur mit dem Verein (cascade).
-- ----------------------------------------------------------------------------
alter table app.invoice_settings enable row level security;

create policy invoice_settings_select on app.invoice_settings
  for select to authenticated
  using (app.is_club_member(club_id));

create policy invoice_settings_insert on app.invoice_settings
  for insert to authenticated
  with check (app.is_club_admin(club_id));

create policy invoice_settings_update on app.invoice_settings
  for update to authenticated
  using (app.is_club_admin(club_id))
  with check (app.is_club_admin(club_id));

-- ----------------------------------------------------------------------------
-- Modul-Gate (0061): der Briefkopf gehoert zum abschaltbaren Modul 'finance'.
-- Ist die Finanz aus, ist auch die Rechnungs-Einstellung nicht erreichbar —
-- sonst waere der Finanz-Schalter eine halbe Wahrheit.
-- ----------------------------------------------------------------------------
create policy invoice_settings_module_gate on app.invoice_settings
  as restrictive for all
  using (app.module_enabled(club_id, 'finance'))
  with check (app.module_enabled(club_id, 'finance'));

commit;
