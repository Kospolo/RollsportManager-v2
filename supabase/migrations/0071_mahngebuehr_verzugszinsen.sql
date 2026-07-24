-- ============================================================================
-- 0071_mahngebuehr_verzugszinsen.sql — was eine Mahnung KOSTET, und was am Ende
-- wirklich zu zahlen ist.
--
-- ############################################################################
-- ### DER BEFUND ############################################################
-- ############################################################################
-- app.dunning_log (0013:78-90) protokolliert seit jeher, DASS eskaliert wurde:
-- from_stage -> to_stage, action, wer, Notiz. Es protokolliert nicht, was das
-- gekostet hat. Und app.invoices kennt nur amount_cents — die Forderung aus dem
-- Anlass. Eine Rechnung mit zwei Mahnungen zeigte im v2 denselben Betrag wie am
-- Tag der Ausstellung. Der Verein sah nirgends, was er tatsächlich fordert.
--
-- ############################################################################
-- ### DER BAUENTSCHEID: EINE ZAHL, ZWEI ORTE — UND KEIN DRITTER #############
-- ############################################################################
-- Naheliegend wäre gewesen, die Gebühren NUR im dunning_log zu führen und die
-- Summe bei jedem Lesen zu ziehen. Das scheitert an der Sichtbarkeit, und zwar
-- nicht am Rand, sondern im Kern: dunning_log ist FINANZ-ONLY (0013:135 —
-- can_manage_finance). Die Mutter, die die Rechnung ihres Kindes sieht
-- (invoices_select, 0026:260-266), darf den Mahnverlauf NICHT sehen. Sie muss
-- aber wissen, was sie schuldet. Eine Summe aus einer für sie unsichtbaren
-- Tabelle hätte für sie stumm 0 ergeben — die Rechnung hätte sie ANGELOGEN.
--
-- Deshalb zwei Orte mit klarer Rollenteilung:
--   app.dunning_log.fee_cents / .interest_cents   = der EINZELSCHRITT. Was hat
--     DIESE Mahnung gekostet? Append-only, finanz-only, GoBD-Beleg.
--   app.invoices.dunning_fee_cents / .dunning_interest_cents = der STAND. Was
--     ist bis heute aufgelaufen? Sichtbar für alle, die die Rechnung sehen.
--
-- Und KEIN dritter Ort, an dem beides auseinanderlaufen kann: die
-- Rechnungsspalten sind NICHT von Hand zu setzen. Sie werden ausschliesslich
-- vom Trigger app.dunning_log_apply_costs fortgeschrieben, der bei jedem
-- angehängten Mahnschritt feuert. Wer eine Gebühr erheben will, muss den
-- Vorgang protokollieren — es gibt keinen Weg, Geld zu fordern, ohne dass ein
-- Beleg entsteht. Das ist der eigentliche Gewinn dieser Bauform.
--
-- app.invoices.total_cents ist eine GENERATED STORED Spalte: Forderung +
-- Gebühren + Zinsen. Kein Anwendungscode addiert das noch einmal irgendwo
-- anders zusammen, und keine Oberfläche kann sich verrechnen.
--
-- ############################################################################
-- ### KEINE SÄTZE, KEINE AUTOMATIK — BEWUSST ################################
-- ############################################################################
-- Diese Migration legt KEINEN Gebührensatz und KEINEN Zinssatz fest, weder als
-- Vereinseinstellung noch als Default. Grund: die Sätze sind eine der offenen
-- Fragen an den Chef, und ein voreingestellter Betrag wäre eine erfundene
-- Zusage, die im ersten echten Mahnlauf Geld fordert, das niemand beschlossen
-- hat. Gebaut wird der TRÄGER; den Betrag gibt die Kassenwartin je Schritt ein.
--
-- Ebenfalls NICHT gebaut: eine automatische Zinsberechnung nach Verzugstagen
-- (§ 288 BGB / Basiszinssatz). Sie hängt an einem Satz, den wir nicht haben,
-- und an einer Rundungs- und Stichtagsregel, die niemand vorgegeben hat.
--
-- OFFEN und ausdrücklich benannt (steht im Bericht): der ERLASS. fee_cents und
-- interest_cents sind >= 0, ein Storno-/Erlass-Schritt existiert also nicht.
-- Eine erlassene Mahngebühr ist heute nur über eine Gutschrift/Korrektur auf
-- der Rechnungsseite abbildbar. Ein negativer Mahnschritt wäre schnell gebaut —
-- aber welche Rolle ihn darf und wie er im Kassenbuch erscheint, ist eine
-- Entscheidung, keine Programmieraufgabe.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Der EINZELSCHRITT. Beide Spalten `not null default 0`, damit jede
--    bestehende Zeile (und jeder bestehende INSERT-Aufruf, z. B. Test 41) ohne
--    Änderung weiterläuft: eine Mahnung ohne Gebühr ist der Normalfall.
--
--    dunning_log ist append-only für JEDEN (0013:96-112, inkl. superuser).
--    Diese Spalten sind damit ebenfalls append-only — was einmal als Gebühr
--    protokolliert wurde, wird nie umgeschrieben.
-- ----------------------------------------------------------------------------
alter table app.dunning_log
  add column fee_cents      bigint not null default 0,
  add column interest_cents bigint not null default 0,
  add constraint dunning_log_fee_check      check (fee_cents >= 0),
  add constraint dunning_log_interest_check check (interest_cents >= 0);

comment on column app.dunning_log.fee_cents is
  'Mahngebühr DIESES Schritts in ganzen Cent (0 = keine erhoben). Append-only wie die ganze Zeile. / Dunning fee of this single step in integer cents.';
comment on column app.dunning_log.interest_cents is
  'Verzugszinsen DIESES Schritts in ganzen Cent (0 = keine berechnet). Es gibt bewusst KEINEN hinterlegten Zinssatz und keine Automatik — der Betrag wird eingegeben. / Default interest of this single step in integer cents; no rate is configured anywhere by design.';

-- ----------------------------------------------------------------------------
-- 2. Der STAND an der Rechnung + der GESAMTBETRAG.
--
--    total_cents ist generated/stored und damit die einzige Stelle, an der
--    „was ist zu zahlen" definiert ist. Eine Oberfläche, die selbst addiert,
--    kann von hier abweichen — deshalb soll sie es nicht tun, und deshalb steht
--    die Zahl im Vertrag (openapi) mit drin.
-- ----------------------------------------------------------------------------
alter table app.invoices
  add column dunning_fee_cents      bigint not null default 0,
  add column dunning_interest_cents bigint not null default 0,
  add constraint invoices_dunning_fee_check      check (dunning_fee_cents >= 0),
  add constraint invoices_dunning_interest_check check (dunning_interest_cents >= 0);

alter table app.invoices
  add column total_cents bigint
    generated always as (amount_cents + dunning_fee_cents + dunning_interest_cents) stored;

comment on column app.invoices.dunning_fee_cents is
  'AUFGELAUFENE Mahngebühren dieser Rechnung in ganzen Cent. Wird AUSSCHLIESSLICH vom Trigger app.dunning_log_apply_costs fortgeschrieben — nie von Hand gesetzt. Sichtbar für alle, die die Rechnung sehen (auch die Eltern), anders als der Mahnverlauf selbst. / Accrued dunning fees; written only by the dunning-log trigger.';
comment on column app.invoices.dunning_interest_cents is
  'AUFGELAUFENE Verzugszinsen dieser Rechnung in ganzen Cent. Herkunft und Regeln wie bei dunning_fee_cents. / Accrued default interest.';
comment on column app.invoices.total_cents is
  'GESAMTBETRAG = amount_cents + dunning_fee_cents + dunning_interest_cents (generated, stored). Die einzige gültige Antwort auf „was ist zu zahlen". / Total due, generated column.';

-- ----------------------------------------------------------------------------
-- 3. Der Fortschreiber. AFTER INSERT auf dunning_log, SECURITY DEFINER.
--
--    Warum DEFINER: die Kassenwartin darf die Rechnung ohnehin ändern, aber der
--    Fortschreiber soll auch dann korrekt laufen, wenn ein späterer Pfad die
--    invoices-UPDATE-Policy enger zieht. Er schreibt genau zwei Spalten einer
--    Zeile, deren id im soeben protokollierten Schritt steht — er kann nichts
--    anderes anfassen.
--
--    Warum ADDIEREN statt neu summieren: der Mahnverlauf ist append-only, ein
--    laufender Zähler kann also nie falsch werden, und ein SUM() über den
--    ganzen Verlauf bei jedem Schritt wäre teurer ohne Gewinn.
--
--    Der Frühausstieg bei 0/0 hält bestehende Abläufe unangetastet: eine
--    Mahnung ohne Kosten fasst die Rechnung nicht an (kein updated_at-Rütteln).
-- ----------------------------------------------------------------------------
create or replace function app.dunning_log_apply_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.fee_cents = 0 and new.interest_cents = 0 then
    return new;
  end if;

  update app.invoices
     set dunning_fee_cents      = dunning_fee_cents      + new.fee_cents,
         dunning_interest_cents = dunning_interest_cents + new.interest_cents
   where id = new.invoice_id
     and club_id = new.club_id;

  return new;
end;
$$;

comment on function app.dunning_log_apply_costs() is
  'Schreibt Mahngebühr und Verzugszinsen eines protokollierten Mahnschritts auf die Rechnung fort (app.invoices.dunning_fee_cents / dunning_interest_cents). Der EINZIGE Weg, auf dem diese beiden Spalten wachsen — Geld fordern geht damit nur mit Beleg.';

create trigger dunning_log_apply_costs
  after insert on app.dunning_log
  for each row execute function app.dunning_log_apply_costs();

-- ----------------------------------------------------------------------------
-- 4. Die Gegenkontrolle: die Rechnungsspalten wachsen NICHT von Hand.
--
--    Ohne diesen Wächter wäre der Satz oben („der einzige Weg") eine
--    Behauptung: die Kassenwartin hat UPDATE auf app.invoices und könnte
--    dunning_fee_cents beliebig setzen — ohne Beleg im Mahnverlauf.
--
--    Unterschieden wird an pg_trigger_depth(), NICHT an einem Merker aus
--    set_config: einen Merker könnte der Client selbst setzen (set_config ist
--    für jeden ausführbar) — der Wächter wäre eine Attrappe. Die Trigger-Tiefe
--    dagegen kann von aussen nicht gefälscht werden:
--      * Client-UPDATE auf app.invoices        -> Tiefe 1  (nur dieser Trigger)
--      * UPDATE aus dunning_log_apply_costs    -> Tiefe 2  (dessen Trigger + dieser)
--    Erlaubt ist deshalb ausschliesslich Tiefe >= 2.
--
--    auth.uid() is null (Migration/Seed/Service-Korrekturlauf) bleibt wie
--    überall im Repo ausgenommen.
-- ----------------------------------------------------------------------------
create or replace function app.protect_invoice_dunning_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.dunning_fee_cents is distinct from old.dunning_fee_cents
     or new.dunning_interest_cents is distinct from old.dunning_interest_cents then
    if pg_trigger_depth() < 2 then
      raise exception 'invoices: dunning_fee_cents/dunning_interest_cents are written by the dunning log only'
        using errcode = '42501',
              hint = 'Mahngebühr und Verzugszinsen entstehen NUR über einen protokollierten Mahnschritt (app.dunning_log). / Dunning fees and interest may only grow through a logged dunning step.';
    end if;
  end if;
  return new;
end;
$$;

comment on function app.protect_invoice_dunning_costs() is
  'Verhindert, dass Mahngebühr/Verzugszinsen an der Rechnung ohne Beleg im Mahnverlauf gesetzt werden. Durchgelassen wird nur der Schreibvorgang aus app.dunning_log_apply_costs (erkannt an pg_trigger_depth() >= 2, von aussen nicht fälschbar) sowie Migration/Seed/Service (auth.uid() is null).';

create trigger invoices_protect_dunning_costs
  before update on app.invoices
  for each row execute function app.protect_invoice_dunning_costs();

commit;
