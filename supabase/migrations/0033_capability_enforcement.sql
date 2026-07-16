-- ============================================================================
-- 0033_capability_enforcement.sql — die Wahrheit hinter der Stufe "keine",
-- damit das Admin-UI (Phase 3) sie nicht falsch beschriften MUSS.
--
-- ### DAS PROBLEM, GEMESSEN STATT VERMUTET ###
-- Die Rechte-Matrix aus RBAC-DESIGN §7 zeigt 32 Faehigkeiten als gleichwertige
-- Stufen-Dropdowns. Sie sind aber NICHT gleichwertig. Gemessen gegen
-- rsm2-pg-dev (live, in rollback):
--
--   (a) Alle 32 Stufen der Rolle 'member' auf 'none', dann als Katrin lesen:
--         achievements|6  attendance|11  club_members|24  clubs|1
--         competitions|2  equipment|4    events|15        exercises|5
--         facilities|3    news|3         roles|7          tasks|7
--         teams|3         training_slots|5
--         INVOICES|0  LEDGER_ENTRIES|0  LOCKERS|0  ROUTINES|0
--       Kontrolle ohne die Aenderung: ROUTINES|1 LOCKERS|1 INVOICES|2.
--       Die Nullen sind also echt — und die Nicht-Nullen auch.
--
--   (b) 'finance' := none als treasurer:  cap_rank(finance)=0, aber
--         can_manage_finance = TRUE       <- der Widerspruch
--         invoices 10 -> 0   ledger_entries 10 -> 0        (wirkt)
--         bank_transactions 6 -> 6   budgets 5 -> 5   donations 3 -> 3
--         dunning_log 2 -> 2   ledger_categories 5 -> 5
--         member_fees 10 -> 10   sepa_mandates 3 -> 3      (wirkt NICHT)
--       Ursache: app.can_manage_finance delegiert an app.has_club_role(...) —
--       ROLLENbasiert, nie has_cap. Nur invoices_select/ledger_entries_select
--       fragen has_cap(…,'finance',…).
--
--   (c) 'member_contact' := none als treasurer:
--         Roster: 9 von 24 Zeilen mit E-Mail / 15 mit Geburtsdatum  <- NICHT gesperrt
--         GET /reports/anniversaries -> HTTP 403                    <- gesperrt
--       Ursache: members.ts:68-70 (maySeeFullRoster) gated auf hasClubRole aus
--       dem TOKEN und fragt member_contact nie.
--
--   (d) 'news' := none als coach (Sandra):  cap_rank(news) = 0
--         INSERT 0 1   <- INSERT trotz none GELUNGEN
--         news lesbar trotz none: 4
--       Der Key 'news' kommt in KEINER Policy und in KEINEM requireCap vor.
--
-- ### DIE FOLGE FUER DAS UI — UND WARUM DAS HIER UND NICHT DORT GELOEST WIRD ###
-- Ein Dropdown, das fuer 'news' die Stufe "keine" anbietet, verspricht etwas,
-- das der Server nicht einloest. Das ist genau die Selbsttaeuschung, die der
-- Nutzer schon einmal zu Recht angeprangert hat. Das UI MUSS also wissen, was
-- eine Stufe bei DIESER Faehigkeit ueberhaupt bewirkt.
--
-- Dieses Wissen gehoert an die Faehigkeit, nicht in den Web-Client:
--   * Es ist eine Eigenschaft der Faehigkeit — wie allowed_levels (0022) und
--     owner_only (0032). Beide sind aus demselben Grund Spalten.
--   * iOS und Android brauchen dieselbe Beschriftung. Eine Konstante in
--     apps/web waere eine zweite Wahrheit, die driftet.
--
-- ### DIE VIER WERTE ###
--   'enforced'   Die Stufe wirkt auf das LESEN. "keine" nimmt den Zugriff
--                wirklich weg.                       -> routines, lockers, anniversaries
--   'partial'    Die Stufe wirkt nur auf einen TEIL des Lesens. "keine" ist
--                hier KEIN Zugriffsentzug — Beschriftung waere Taeuschung.
--                                                    -> finance, member_contact
--   'write_only' Die Stufe wirkt nur auf das SCHREIBEN. Gelesen wird weiter.
--                                                    -> 9 Faehigkeiten
--   'unenforced' Die Stufe wirkt NIRGENDS. Reine Absichtserklaerung.
--                                                    -> 18 Faehigkeiten
--
-- ### WARUM DAS KEINE ZWEITE WAHRHEIT IST, DIE STILL DRIFTET ###
-- Eine hand-gepflegte Spalte, die behauptet "hier wirkt nichts", waere genau
-- die Sorte gruene Kontrolle, die nicht rot werden kann — der Fehler, den 93g
-- fuer die Views schon einmal behoben hat. Deshalb kommt mit der Spalte eine
-- Funktion, die die BEHAUPTUNG gegen die tatsaechlichen Policies nachrechnet:
--   app.capability_policy_usage() -> (capability_key, cmd, object)
-- Sie liest pg_policies und loest dabei auch Helfer auf, die has_cap KAPSELN
-- (app.can_read_routine -> 'routines'; sonst faenden wir 'routines' nie, weil
-- der Key in keiner Policy woertlich steht).
-- 93j haengt daran und wird ROT, sobald eine kuenftige Migration eine Policy
-- auf has_cap umstellt, ohne das Etikett nachzuziehen. Nachgestellt statt
-- behauptet: der Test baut den Drift selbst nach und verlangt, dass er auffaellt.
--
-- Was die Funktion NICHT sehen kann, ist die API (requireCap in TypeScript).
-- Diese Stellen stehen deshalb als ausdrueckliche Liste in 93j — mit dem grep,
-- aus dem sie stammt. Ehrlich benannt: DIESE Haelfte ist hand-gepflegt.
--
-- ### KEINE VERHALTENSAENDERUNG ###
-- Diese Migration aendert kein Recht, keine Policy, keinen Rang. Sie beschreibt
-- nur, was ohnehin passiert. Die 32 Werte unten sind aus pg_policies +
-- `grep -rn "requireCap(" services/api/src` abgeleitet, nicht geschaetzt.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Der Typ. Eigener Enum statt text: ein Tippfehler im UPDATE soll die
--    Migration fallen lassen, nicht stillschweigend ein Etikett erfinden.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'app' and t.typname = 'cap_enforcement') then
    create type app.cap_enforcement as enum ('enforced', 'partial', 'write_only', 'unenforced');
  end if;
end $$;

comment on type app.cap_enforcement is
  'Wie weit die eingestellte Stufe einer Fähigkeit tatsächlich durchgesetzt wird. Für die WAHRHEITSGEMÄSSE Beschriftung im Admin-UI — nicht für Autorisierung.';

-- ----------------------------------------------------------------------------
-- 2. Die Spalte. Default 'unenforced' = fail-honest: eine neue Faehigkeit gilt
--    als wirkungslos, bis jemand das Gegenteil nachweist. Das UI verspricht
--    damit im Zweifel ZU WENIG statt zu viel.
-- ----------------------------------------------------------------------------
alter table app.capabilities
  add column if not exists enforcement app.cap_enforcement not null default 'unenforced';

comment on column app.capabilities.enforcement is
  'Was die Stufe dieser Fähigkeit WIRKLICH bewirkt: enforced = auch das Lesen (»keine« entzieht den Zugriff) · partial = nur ein Teil des Lesens (»keine« ist KEIN Zugriffsentzug) · write_only = nur das Schreiben · unenforced = nichts. Rein deskriptiv, NIE Grundlage einer Autorisierung. Nachgerechnet von app.capability_policy_usage() + Test 93j.';

-- ----------------------------------------------------------------------------
-- 3. Die Nachrechnung. Liest pg_policies und loest Helfer auf, die has_cap
--    kapseln — sonst bliebe 'routines' unsichtbar (der Key steht nur in
--    app.can_read_routine, nicht in der Policy).
--
--    Bewusst KEIN Event-Trigger und kein Constraint: als Nicht-Superuser (wie
--    Supabase' `postgres`) ist `create event trigger` verboten (0030 hat das
--    ausgemessen), und ein CHECK kann pg_policies nicht lesen. Der Testlauf ist
--    ohnehin der wirksamere Ort — unsichere Etiketten entstehen durch
--    Migrationen aus DIESEM Repo, und die kommen alle an 93j vorbei.
-- ----------------------------------------------------------------------------
create or replace function app.capability_policy_usage()
returns table (capability_key text, cmd text, object text)
language sql
stable
set search_path = ''
as $$
  with fn as (
    -- app-Funktionen, die eine Faehigkeit KAPSELN (z. B. can_read_routine).
    -- has_cap selbst ist ausgenommen: dort ist die Faehigkeit ein Parameter,
    -- kein Literal — es gaebe ohnehin keinen Treffer, aber die Absicht soll
    -- dastehen.
    select p.proname::text as proname, m[1]::text as key
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral regexp_matches(
      p.prosrc, '(?:has_cap|cap_rank)\s*\([^,]+,\s*''([a-z_]+)''', 'g') m
    where n.nspname = 'app'
      and p.proname <> 'has_cap'
  ),
  pol as (
    select tablename::text as tablename, cmd::text as cmd,
           coalesce(qual, '') || ' ' || coalesce(with_check, '') as src
    from pg_policies
    where schemaname = 'app'
  )
  -- (a) has_cap/cap_rank steht woertlich in der Policy
  select distinct m[1]::text, p.cmd, p.tablename
  from pol p
  cross join lateral regexp_matches(
    p.src, '(?:has_cap|cap_rank)\s*\([^,]+,\s*''([a-z_]+)''', 'g') m
  union
  -- (b) die Policy ruft einen Helfer, der die Faehigkeit kapselt
  select distinct f.key, p.cmd, p.tablename
  from pol p
  join fn f on p.src like '%' || f.proname || '(%'
$$;

comment on function app.capability_policy_usage() is
  'Welche Fähigkeit wird von welcher RLS-Policy tatsächlich abgefragt (direkt oder über einen Helfer wie app.can_read_routine)? Rechnet app.capabilities.enforcement gegen die Wirklichkeit nach — Grundlage von Test 93j. Sieht NUR die Datenbank; requireCap in der API steht als ausdrückliche Liste in 93j.';

-- ----------------------------------------------------------------------------
-- 4. Die 32 Etiketten. Herkunft jeder einzelnen Zeile:
--      DB    = app.capability_policy_usage() (siehe oben, live abgefragt)
--      API   = grep -rn "requireCap(" services/api/src
--    Alles, was in KEINER der beiden Quellen vorkommt, bleibt 'unenforced'
--    (der Default aus Schritt 2) — die 18 sind unten trotzdem ausdruecklich
--    benannt, damit die Liste vollstaendig gelesen werden kann.
-- ----------------------------------------------------------------------------

-- (a) 'enforced' — "keine" nimmt das LESEN wirklich weg.
--     routines      : app.can_read_routine -> routines_select, routine_markers/
--                     _scores/_skaters_select (DB, gemessen: ROUTINES 1 -> 0)
--     lockers       : lockers_select (DB, gemessen: LOCKERS 1 -> 0)
--     anniversaries : reports.ts:305 requireCap(…, 'anniversaries', 'read_team')
--                     (API-only; es gibt keinen Schreibpfad — "keine" = 403)
update app.capabilities set enforcement = 'enforced'
 where key in ('routines', 'lockers', 'anniversaries');

-- (b) 'partial' — "keine" sperrt nur EINEN TEIL des Lesens. Hier waere
--     "kein Zugriff" eine Luege, und zwar die gefaehrlichste Sorte: sie
--     verspricht Vertraulichkeit, die nachweislich nicht existiert.
--     finance        : invoices_select + ledger_entries_select fragen has_cap;
--                      bank_transactions/budgets/donations/dunning_log/
--                      ledger_categories/member_fees/sepa_mandates NICHT
--                      (deren SELECT-Policies haengen an app.can_manage_finance
--                      = has_club_role, rollenbasiert). Gemessen unter (b) oben.
--     member_contact : wirkt NUR in reports.ts:309; der Roster zeigt E-Mail und
--                      Geburtsdatum weiter (members.ts:68-70 gated auf den
--                      Token-Claim). Gemessen unter (c) oben.
update app.capabilities set enforcement = 'partial'
 where key in ('finance', 'member_contact');

-- (c) 'write_only' — gelesen wird weiter, nur das Schreiben haengt an der Stufe.
--     members / equipment / equipment_reservations / facilities /
--     facilities_booking / routines_edit / team_coaches : has_cap in den
--       INSERT/UPDATE-Policies (DB), kein SELECT.
--     attendance : INSERT/UPDATE-Policies (DB) + events.ts:228 (API).
--     roles      : NUR API (roles.ts:185/247/304/371/489) — roles_select ist
--                  is_club_member (0022:208), jedes Mitglied darf die Rollen
--                  lesen. Bewusst: die Chips muessen benannt werden koennen.
update app.capabilities set enforcement = 'write_only'
 where key in ('members', 'roles', 'team_coaches', 'routines_edit', 'attendance',
               'equipment', 'equipment_reservations', 'facilities', 'facilities_booking');

-- (d) 'unenforced' — die Stufe bewirkt NICHTS. Kein has_cap, kein requireCap.
--     Ausdruecklich gesetzt (statt auf dem Default zu ruhen), damit diese Liste
--     die vollstaendige Aussage ist und ein kuenftiger Leser nicht raten muss,
--     ob hier jemand nur vergessen hat, sie zu pflegen.
--     Das ist die ehrliche Bestandsaufnahme, kein Bug-Report: die Rechte dieser
--     Bereiche haengen weiterhin an den ROLLEN-Praedikaten (is_club_trainer,
--     is_club_admin, …), die vor dem RBAC-Umbau da waren. Die Faehigkeiten sind
--     geseedet und bereit — nur zieht noch keine Policy an ihnen.
update app.capabilities set enforcement = 'unenforced'
 where key in ('club_settings', 'departments', 'teams', 'events', 'competitions',
               'tasks', 'training_slots', 'exercises', 'achievements', 'news',
               'media', 'documents', 'gallery', 'chat', 'duty_hours', 'waitlists',
               'checkins', 'regional_events');

-- Kontrolle: jede Faehigkeit ist oben genannt worden (3+2+9+18 = 32). Faellt
-- die Migration hier, ist der Katalog gewachsen, ohne dass jemand das Etikett
-- entschieden hat — genau der Moment, in dem jemand nachdenken soll.
do $$
declare
  v_total int;
  v_named int;
begin
  select count(*) into v_total from app.capabilities;
  select count(*) into v_named from app.capabilities
   where key in ('routines', 'lockers', 'anniversaries',
                 'finance', 'member_contact',
                 'members', 'roles', 'team_coaches', 'routines_edit', 'attendance',
                 'equipment', 'equipment_reservations', 'facilities', 'facilities_booking',
                 'club_settings', 'departments', 'teams', 'events', 'competitions',
                 'tasks', 'training_slots', 'exercises', 'achievements', 'news',
                 'media', 'documents', 'gallery', 'chat', 'duty_hours', 'waitlists',
                 'checkins', 'regional_events');
  if v_total <> v_named then
    raise exception
      'capability enforcement: % Fähigkeiten im Katalog, aber nur % ausdrücklich eingestuft',
      v_total, v_named
      using hint = 'Neue Fähigkeit? Dann gehört sie in 0033 (bzw. eine Folge-Migration) eingestuft — und in 93j.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. cap_ranks liefert das Etikett mit. Ohne das hier muesste der Client eine
--    zweite Runde gegen /capabilities drehen, nur um seine Zeilen beschriften
--    zu koennen — und haette bis dahin keine Wahl, als sie falsch zu
--    beschriften. Rest woertlich aus 0032:204-227.
-- ----------------------------------------------------------------------------
drop function if exists app.cap_ranks(uuid);
create or replace function app.cap_ranks(p_club_id uuid)
returns table (
  capability_key text,
  label_de       text,
  label_en       text,
  allowed_levels app.role_level[],
  sort           int,
  rank           int,
  level          app.role_level,
  owner_only     boolean,
  enforcement    app.cap_enforcement
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.key, c.label_de, c.label_en, c.allowed_levels, c.sort,
         r.rank,
         app.level_of_rank(least(r.rank, app.cap_max_rank(c.key))),
         c.owner_only,
         c.enforcement
  from app.capabilities c
  cross join lateral (select app.cap_rank(p_club_id, c.key) as rank) r
  order by c.sort, c.key
$$;

comment on function app.cap_ranks(uuid) is
  'Aufgelöste Rechte der aufrufenden Person im Verein: eine Zeile je Fähigkeit (Katalog + Rang + Stufe + owner_only + enforcement). Quelle für GET /me/capabilities und die API-Guards. Rang delegiert an app.cap_rank — kein zweites Regelwerk. ACHTUNG: `rank` ist die DURCHSETZUNG (protected owner = 5, auch über der Skala); `level` ist dieselbe Berechtigung AUF DER SKALA der Fähigkeit (immer in allowed_levels, seit 0032). Für Vergleiche `rank` nehmen, nicht level_rank(level). `enforcement` (0033) ist rein deskriptiv für die Beschriftung im UI.';

-- Der Stolperdraht aus 0030 — ans Ende JEDER Migration (0030:Kommentar).
select app.assert_no_insecure_views();

commit;
