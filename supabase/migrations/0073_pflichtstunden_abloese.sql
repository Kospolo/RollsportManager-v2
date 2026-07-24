-- ============================================================================
-- 0073_pflichtstunden_abloese.sql — was eine NICHT geleistete Pflichtstunde
-- kostet, und was daraus für ein Mitglied folgt.
--
-- ############################################################################
-- ### DER BEFUND ############################################################
-- ############################################################################
-- app.duty_requirements (0010:66-80) kennt das SOLL (required_hours) und den
-- Zeitraum. app.duty_entries kennt das IST. Was fehlt, ist die dritte Zahl, die
-- jeder Verein hat: der Betrag je fehlender Stunde. Ohne ihn ist die
-- Pflichtstunden-Verwaltung eine Buchführung ohne Folge — sie zeigt ein Minus
-- und kann nicht sagen, was das Minus bedeutet.
--
-- ############################################################################
-- ### EINE ZAHL AM SOLL, KEINE PREISLISTE ###################################
-- ############################################################################
-- cost_per_hour_cents hängt am duty_requirements-Satz, nicht am Verein. Das ist
-- Absicht: das Soll ist ohnehin je Saison, je Team oder je Mitglied
-- unterschiedlich (die Kaskade in 0010:70-72), und ein Vereins-Default daneben
-- wäre ein zweiter Ort für dieselbe Zahl. Wer für alle denselben Satz will,
-- trägt ihn in den vereinsweiten Satz ein — das ist genau der Fall, den die
-- Kaskade schon abbildet.
--
-- NULLABLE, und NULL heisst NICHT 0: „keine Ablöse vereinbart" ist etwas
-- anderes als „eine Ablöse von 0,00 EUR". Dieselbe Unterscheidung wie beim
-- Schließfach-Preis (0070) — und aus demselben Grund: ein `not null default 0`
-- hätte eine Entscheidung erfunden, die kein Verein getroffen hat.
--
-- ############################################################################
-- ### DIE BERECHNUNG STEHT IN DER DATENBANK — UND SIE NENNT IHRE REGELN ######
-- ############################################################################
-- app.duty_buyout() liefert Soll, Ist, Fehlstunden, Satz und Betrag in EINER
-- Zeile. Nicht, weil es bequem ist, sondern weil eine Ablöse, die drei Clients
-- je selbst ausrechnen, drei Beträge ergibt, sobald einer von ihnen ein Detail
-- anders liest. Die Regeln, die diese Funktion trifft, stehen deshalb hier
-- ausgeschrieben und nicht in einem Kommentar im Client:
--
--   1. Es zählen NUR GENEHMIGTE Stunden (duty_entries.approved). Eine
--      eingetragene, noch nicht bestätigte Stunde ist ein Anspruch, keine
--      Leistung. Wer das anders will, ändert es HIER — an einer Stelle.
--      ⚠️ Das ist eine gesetzte Regel, keine Vorgabe des Chefs. Sie steht so im
--      Bericht und gehört bestätigt.
--   2. Es zählen nur Stunden IM ZEITRAUM des Solls (period_start..period_end).
--   3. Fehlstunden werden bei 0 abgeschnitten: wer mehr leistet als gefordert,
--      bekommt keine negative Ablöse (also keine Gutschrift). Auch das ist eine
--      Entscheidung und keine Rundungsfrage.
--   4. Gerundet wird EINMAL, am Ende, auf ganze Cent.
--   5. Ohne cost_per_hour_cents gibt es keinen Betrag — buyout_cents ist dann
--      NULL, nicht 0. Die Funktion erfindet keinen Satz.
--
-- ############################################################################
-- ### WER DARF DAS RECHNEN ##################################################
-- ############################################################################
-- Die Funktion ist SECURITY DEFINER, weil sie über app.duty_entries aggregiert;
-- die Alternative — sie unter der RLS der aufrufenden Person laufen zu lassen —
-- wäre die gefährlichere: eine Kassenwartin, die duty_entries nicht sehen darf,
-- bekäme keine Fehlermeldung, sondern eine STILL ZU NIEDRIGE Zahl. Eine falsche
-- Rechnung ist schlimmer als ein ehrliches 42501.
--
-- Deshalb prüft die Funktion selbst, und zwar entlang der bestehenden Linien:
--   * app.is_own_member(member) — das eigene Konto (duty_entries_select, 0010:200).
--   * app.is_club_trainer(club) — der Trainerstab, ebenfalls wie 0010:200.
--   * has_cap(club,'finance','manage') — NEU und begründet: die Ablöse ist eine
--     Forderung. Wer die Kasse führt, muss sie beziffern können, ohne dafür
--     Trainer sein zu müssen. Er bekommt dabei GENAU EINE aggregierte Zeile —
--     keinen Zugriff auf die einzelnen Stundeneinträge; duty_entries_select
--     bleibt unverändert.
--
-- can_act_for_member (die Eltern) steht hier bewusst NICHT: duty_entries_select
-- kennt den Familienzweig heute nicht, und diese Migration ist nicht der Ort,
-- an dem still eine neue Sichtbarkeit entsteht. Ob Eltern die Pflichtstunden
-- ihres Kindes sehen sollen, ist eine eigene Entscheidung — sie steht im
-- Bericht als offener Punkt.
--
-- ### NICHT GEBAUT ###
-- Keine automatische Rechnung aus der Ablöse. Wann abgerechnet wird (Saisonende?
-- monatlich?) und ob mit Umsatzsteuer, ist eine Vereinsentscheidung. Die
-- Funktion liefert den Betrag; den Beleg schreibt ein Mensch über den
-- bestehenden Rechnungsweg (jetzt mit Positionen, 0072).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Der Kostensatz am Soll.
-- ----------------------------------------------------------------------------
alter table app.duty_requirements
  add column cost_per_hour_cents bigint,
  add constraint duty_requirements_cost_check
    check (cost_per_hour_cents is null or cost_per_hour_cents >= 0);

comment on column app.duty_requirements.cost_per_hour_cents is
  'ABLÖSE je fehlender Pflichtstunde in ganzen Cent. NULL = keine Ablöse vereinbart (NICHT dasselbe wie 0,00 EUR). / Buyout cost per missing duty hour in integer cents; NULL = no buyout agreed.';

-- ----------------------------------------------------------------------------
-- 2. Die Berechnung. Eine Zeile: Soll, Ist, Fehlstunden, Satz, Betrag.
--    Gibt 0 Zeilen zurück, wenn das Soll auf das Mitglied gar nicht zutrifft —
--    „keine Aussage" ist dann die richtige Antwort, nicht „0,00 EUR".
-- ----------------------------------------------------------------------------
create or replace function app.duty_buyout(p_requirement_id uuid, p_member_id uuid)
returns table (
  requirement_id      uuid,
  member_id           uuid,
  required_hours      numeric,
  done_hours          numeric,
  missing_hours       numeric,
  cost_per_hour_cents bigint,
  buyout_cents        bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_req  app.duty_requirements;
  v_done numeric;
  v_miss numeric;
begin
  select * into v_req
    from app.duty_requirements
   where id = p_requirement_id and deleted_at is null;

  if v_req.id is null then
    return;                                   -- kein Soll -> keine Aussage
  end if;

  -- Zugriff (siehe Kopf). Fehlende Berechtigung ist ein Fehler, keine 0.
  -- auth.uid() is null = Migration/Seed/Service-Pfad, wie überall im Repo
  -- ausgenommen; die Rolle anon kann die Funktion mangels EXECUTE gar nicht
  -- aufrufen (revoke from public unten).
  if not (
        auth.uid() is null
     or app.is_own_member(p_member_id)
     or app.is_club_trainer(v_req.club_id)
     or app.has_cap(v_req.club_id, 'finance', 'manage')
  ) then
    raise exception 'duty_buyout: not allowed for this member'
      using errcode = '42501',
            hint = 'Die Ablöse darf sehen: das Mitglied selbst, der Trainerstab und die Kassenführung. / Buyout figures are visible to the member, the coaching staff and finance.';
  end if;

  -- Das Mitglied muss überhaupt zum Verein gehören.
  if not exists (
    select 1 from app.club_members m
    where m.id = p_member_id and m.club_id = v_req.club_id and m.deleted_at is null
  ) then
    return;
  end if;

  -- Trifft das Soll auf DIESES Mitglied zu? Die Kaskade aus 0010:
  --   member_id gesetzt -> nur diese Person.
  --   team_id gesetzt   -> nur die Mitglieder dieses Teams.
  --   beides null       -> der ganze Verein.
  if v_req.member_id is not null and v_req.member_id <> p_member_id then
    return;
  end if;

  if v_req.member_id is null and v_req.team_id is not null then
    if not exists (
      select 1 from app.team_members tm
      where tm.team_id = v_req.team_id
        and tm.member_id = p_member_id
        and tm.deleted_at is null
    ) then
      return;
    end if;
  end if;

  -- IST: nur GENEHMIGTE Stunden, nur im Zeitraum des Solls.
  select coalesce(sum(e.hours), 0) into v_done
    from app.duty_entries e
   where e.club_id = v_req.club_id
     and e.member_id = p_member_id
     and e.approved
     and e.deleted_at is null
     and e.activity_date between v_req.period_start and v_req.period_end;

  v_miss := greatest(v_req.required_hours - v_done, 0);

  return query
  select v_req.id,
         p_member_id,
         v_req.required_hours,
         v_done,
         v_miss,
         v_req.cost_per_hour_cents,
         case
           when v_req.cost_per_hour_cents is null then null::bigint
           else round(v_miss * v_req.cost_per_hour_cents)::bigint
         end;
end;
$$;

comment on function app.duty_buyout(uuid, uuid) is
  'Pflichtstunden-Abrechnung für EIN Mitglied an EINEM Soll: Soll, genehmigtes Ist, Fehlstunden, Kostensatz und Ablösebetrag in einer Zeile. Es zählen nur GENEHMIGTE Stunden im Zeitraum des Solls; Fehlstunden werden bei 0 abgeschnitten (keine Gutschrift bei Übererfüllung); ohne cost_per_hour_cents ist buyout_cents NULL, nicht 0. Sichtbar für das Mitglied selbst, den Trainerstab und die Kassenführung — die Funktion gibt NUR die Aggregatzeile heraus, keine einzelnen Stundeneinträge.';

revoke execute on function app.duty_buyout(uuid, uuid) from public;
grant execute on function app.duty_buyout(uuid, uuid) to authenticated, service_role;

commit;
