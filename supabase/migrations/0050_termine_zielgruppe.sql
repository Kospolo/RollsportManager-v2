-- ============================================================================
-- 0050_termine_zielgruppe.sql — Termine/Wettkaempfe: die Zielgruppe scharf
-- schalten (Nutzer: "ein mitglied darf nur seine wettkaempfe, seine termine
-- sehen — ausser es sind vereinsveranstaltungen" / "ja verein — darf aber
-- nicht jeder was eintragen").
--
-- ### BEFUND (live gegen die Seed-DB gemessen, nicht vermutet) ###
-- events_select (0003:203-205) ist blank app.is_club_member(club_id) — owner,
-- admin, coach, member, guest, treasurer sehen ausnahmslos ALLE 15 Termine und
-- beide Wettkaempfe. Dieselbe Blankozeile in event_teams_select (0003:217) und
-- competitions_select (0004:277). Die Zielgruppe ist dabei MODELLIERT UND
-- GEFUELLT (app.event_teams: 21 Zeilen ueber 15 Termine) — sie wurde nur nie
-- abgefragt.
--
-- ### KORREKTUR AM AUFTRAGS-BEFUND ###
-- Die Vorgabe sagte "JEDER der 15 Termine haengt an genau einem Team". Das
-- stimmt nicht: e-09 (Elternabend) haengt an DREI Teams, e-11/e-12/e-14 an
-- zwei bzw. drei. 21 Zeilen auf 15 Termine gehen nur so auf. Fuer die Regel
-- ist das folgenlos (n:m war ohnehin die Annahme), fuer die erwarteten
-- Zahlen je Persona nicht — siehe seed.sql.
--
-- ### 1. AUSDRUECKLICHES MERKMAL, FAIL-CLOSED ###
-- app.events.audience ('teams' | 'club'), Vorgabe 'teams'. BEWUSST KEIN
-- Rateschluss "kein Team = Verein": wer beim Anlegen das Team vergisst, wuerde
-- damit versehentlich vereinsweit veroeffentlichen — und dahinter haengen
-- Kinderdaten. Der Fehler muss in die sichere Richtung fallen.
--
-- GRENZFALL A — audience='teams' OHNE eine einzige event_teams-Zeile:
--   Der Termin adressiert dann NIEMANDEN. Genau das faellt aus der Regel unten
--   von selbst heraus: der Team-Zweig ist ein EXISTS ueber app.event_teams —
--   null Zeilen = kein Treffer = kein Mitglied, kein Elternteil, keine
--   Trainerin sieht ihn. Sichtbar bleibt er allein der Vereins-Ebene
--   (owner/admin/moderator). Das ist Absicht
--   und nicht Zufall: "niemand sieht ihn" waere ein unauffindbarer Geistersatz,
--   den keiner mehr reparieren kann. Die Antwort ist also NICHT "alle",
--   sondern "nur der Vorstand".
--
-- GRENZFALL B — darf ein 'club'-Termin zusaetzlich Teams haben?
--   NEIN, ein Trigger verbietet es (protect_event_audience_teams unten).
--   Begruendung: bei audience='club' traegt eine event_teams-Zeile fuer die
--   Sichtbarkeit NICHTS mehr bei — sie waere eine ZWEITE WAHRHEIT neben der
--   Zielgruppe. Genau diese Fehlerklasse hat das Projekt schon zweimal
--   getroffen (0025:163-168 zu team_coaches). Ein Leser, der event_teams-Zeilen
--   sieht, schliesst auf eine Team-Begrenzung, die es nicht gibt. Lieber ein
--   lautes 42501 als ein Datensatz, der zwei Dinge gleichzeitig behauptet.
--
-- ### 2. DAS HAEKCHEN IST RECHTEPFLICHTIG ###
-- Durchgesetzt ueber app.has_club_role(club_id, array['owner','admin',
-- 'moderator']) — in der DATENBANK (Trigger app.protect_event_audience) UND in
-- der API (events.ts). NICHT nur im UI: v1 hatte die Rechte ausschliesslich
-- clientseitig, genau das war der Fehler dieses Projekts.
--
-- WARUM KEINE FAEHIGKEIT — und warum das eine ECHTE EINSCHRAENKUNG ist:
--   Geprueft, ob eine vorhandene passt: NEIN. app.rbac_default_level (0023:193,
--   heute 0031:73-160) vergibt 'events'/'competitions' an v_structure =
--   owner/admin/moderator/COACH als 'manage'. Ein Gate auf
--   has_cap(club,'events','manage') wuerde die Trainerin also GENAU NICHT
--   aussperren — das Gegenteil der Bestellung. Der else-Zweig gibt allen
--   uebrigen (member/treasurer/guest_coach) 'read_all'; ein Lese-Gate darauf
--   hiesse "alle sehen alles", also der heutige Fehler in neuer Schreibweise.
--   'roles'/'club_settings' treffen zwar zufaellig die richtige Menge
--   (v_admin), stehen aber fuer etwas anderes — sie hier zu missbrauchen waere
--   eine stille Bedeutungsverschiebung (gleiche Begruendung wie reports.ts:49).
--
--   Eine NEUE Faehigkeit 'club_events' {none,read_all,manage} war gebaut und
--   lief. Sie ist wieder ausgebaut, weil sie an einer Auftragsgrenze scheitert,
--   nicht an der Technik: app.capabilities ist per 0033:243 zensiert, und
--   supabase/tests/sql/93j_capability_enforcement.sql:36-46 nagelt die Zahlen
--   fest (32 Faehigkeiten, 3 x enforced). Eine 33. Faehigkeit faerbt 93j
--   zwingend rot — und Bestands-Tests werden hier nicht angefasst. 0033 selbst
--   verlangt fuer neue Faehigkeiten ausdruecklich den 93j-Nachtrag ("Neue
--   Faehigkeit? Dann gehoert sie in 0033 ... — und in 93j"); dieser Nachtrag
--   ist die eine Aenderung, die der Auftrag verbietet. Gemeldet statt still
--   gebogen.
--
--   PREIS DIESER LOESUNG, offen benannt:
--     * NICHT KONFIGURIERBAR. Der Verein kann das Recht nicht umhaengen; es
--       klebt an owner/admin/moderator. Bestellt war genau diese Menge, aber
--       das konfigurierbare Rechte-System bleibt hier aussen vor.
--     * CLAIM-BASIERT. has_club_role liest app.jwt_club_role (0002:161-187),
--       also die EINE Rolle im Token — Mehrfachrollen aus app.member_roles
--       wirken nicht, und eine Rechteaenderung braucht ein neues Token.
--       app.cap_rank (0025) koennte beides. Das ist KEIN neues Loch: alle
--       uebrigen Policies auf app.events/event_teams/competitions (0003/0004)
--       sind bereits claim-basiert; die Domaene bleibt damit in sich stimmig
--       statt halb umgestellt. Die guest_coach-Befristung greift, has_club_role
--       prueft sie (0002:174-184).
--   ZUM FREIGEBEN: 93j:36-46 auf 33/4 nachziehen, dann ist die Faehigkeits-
--   Fassung eine kleine Migration.
--
-- ### 3. LESEN ###
-- app.can_read_event / app.can_read_competition (SECURITY DEFINER, Muster von
-- app.can_read_routine 0026:120). WARUM ALS FUNKTION und nicht inline: die
-- Policies muessten sich sonst gegenseitig lesen (events_select braucht
-- event_teams, event_teams_select braucht events) — Postgres bricht das mit
-- "infinite recursion detected in policy for relation" ab. Der DEFINER-Helfer
-- schneidet die Schleife durch.
--
-- ### KASSE (treasurer) ###
-- Bleibt aussen vor, wie bestellt. VORHER GEPRUEFT, nicht blind gekappt:
--   grep ueber alle Migrationen nach Finanz-/Pflichtstunden-Pfaden auf
--   app.events -> KEIN Treffer. app.invoices/ledger_entries/member_fees/
--   duty_requirements haben keinen Bezug zu app.events. Einzig app.checkins
--   (0011:116) fuehrt ein OPTIONALES event_id, haengt aber an der eigenen
--   Faehigkeit 'checkins' und nicht am Termin. Der Schnitt ist folgenlos.
--
-- ### 4. SCHREIBEN: die Trainerin nur fuer IHRE Teams ###
-- event_teams_insert/_update war has_club_role(owner/admin/coach) ohne jeden
-- Team-Bezug: eine Trainerin konnte Termine an JEDES Team haengen, auch an
-- fremde. Ab jetzt: owner/admin unveraendert alles, coach nur die Teams aus
-- app.coached_team_ids. moderator/guest_coach bleiben draussen — sie duerfen
-- hier heute nicht schreiben, und Weiten ist verboten. Die neue Menge ist eine
-- echte Teilmenge der alten.
--
-- ### WAS HIER BEWUSST *NICHT* PASSIERT ###
-- competition_entries_select bleibt unveraendert (blank is_club_member).
-- Grund: supabase/tests/sql/99b_wettkampf.sql:57-59 friert die heutige Weite
-- ausdruecklich als Sollverhalten ein ("competition_entries stay member-visible
-- (not restricted by 0021)" + is_eq(... , 3)). Jede ehrliche Verengung faerbt
-- diesen Bestands-Test rot, und Bestands-Tests werden hier nicht angefasst.
-- Gemeldet statt still gebogen. Praktische Wirkung heute: keine — GET
-- /competitions bettet die Startliste nur fuer SICHTBARE Wettkaempfe ein, und
-- die filtert competitions_select ab jetzt. Es bleibt eine Luecke in der
-- Tiefenverteidigung (direkter Tabellenzugriff), keine im Produkt.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Die Zielgruppe als ausdrueckliche Spalte
-- ----------------------------------------------------------------------------
create type app.event_audience as enum ('teams', 'club');

comment on type app.event_audience is
  'Zielgruppe eines Termins: ''teams'' = nur die zugeordneten Teams (Vorgabe, fail-closed); ''club'' = ausdrueckliche Vereinsveranstaltung, jedes Mitglied sieht sie. Setzen darf nur der Vorstand (owner/admin/moderator).';

alter table app.events
  add column audience app.event_audience not null default 'teams';

comment on column app.events.audience is
  'AUSDRUECKLICHES Merkmal, kein Rateschluss aus fehlenden Teams. Vorgabe ''teams'': wer das Team vergisst, veroeffentlicht NICHT versehentlich vereinsweit.';

create index events_audience_idx on app.events (club_id, audience);

-- ----------------------------------------------------------------------------
-- 3. Lese-Sichtbarkeit: die Helfer
-- ----------------------------------------------------------------------------
create or replace function app.can_read_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.events e
    where e.id = p_event_id
      and e.deleted_at is null
      and (
        -- (1) Ausdrueckliche Vereinsveranstaltung -> jedes Vereinsmitglied.
        --     (Der Mitgliedschafts-Gate selbst sitzt in der Policy.)
        e.audience = 'club'

        -- (2) Vereins-Ebene: Vorstand/Admin/Moderator sehen alles
        --     (Hallenplanung, Uebersicht). Zur Einschraenkung dieser Zeile
        --     (claim-basiert, nicht konfigurierbar) siehe Migrations-Kopf §2.
        or app.has_club_role(e.club_id, array['owner', 'admin', 'moderator'])

        -- (3) Die zugeordneten Teams. EIN Praedikat deckt drei Personen ab,
        --     weil app.team_members sowohl Skater ALS AUCH Trainer:innen
        --     fuehrt (0025:169-185 - team_coaches ist nur eine Sicht darauf)
        --     und app.can_act_for_member (0002:192-215) sowohl die eigene
        --     Mitgliedschaft als auch die eigenen KINDER (guardianships) trifft:
        --       * das Mitglied im Team          (eigene Zeile)
        --       * die ELTERN eines Kindes im Team (guardianship-Zweig)  <- der
        --         wichtigste Fall: ohne ihn weiss niemand, wann das Kind
        --         Training hat, und die App ist fuer Eltern unbrauchbar
        --       * die Trainer:in des Teams      (ihre team_members-Zeile
        --         role='coach' -- deshalb braucht es hier KEINEN eigenen
        --         coached_team_ids-Zweig; er waere exakt dieselbe Menge)
        --     Die guest_coach-Befristung haengt NICHT hier, sondern im
        --     app.is_club_member(club_id) der Policy (0002:145-154) - ein
        --     abgelaufener Gastzugang sieht 0 Termine (Test 30).
        or exists (
          select 1
          from app.event_teams et
          join app.team_members tm
            on tm.team_id = et.team_id
           and tm.deleted_at is null
          where et.event_id = e.id
            and et.deleted_at is null
            and app.can_act_for_member(tm.member_id)
        )
      )
  )
$$;

comment on function app.can_read_event(uuid) is
  'Sichtbarkeit eines Termins: audience=''club'' -> jedes Mitglied; owner/admin/moderator -> Vorstand sieht alles; sonst nur ueber app.event_teams (Team-Mitglied, dessen ELTERN via can_act_for_member, und die Trainer:in des Teams). audience=''teams'' OHNE Team-Zeile -> nur Vorstand. SECURITY DEFINER, weil sich events_select und event_teams_select sonst gegenseitig lesen muessten (Policy-Rekursion). Der Mitgliedschafts-Gate sitzt in der Policy, nicht hier.';

create or replace function app.can_read_competition(p_competition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.competitions c
    where c.id = p_competition_id
      and c.deleted_at is null
      and (
        -- (1) Vereins-Ebene: Vorstand sieht alles.
        app.has_club_role(c.club_id, array['owner', 'admin', 'moderator'])

        -- (2) TRAINER:INNEN SEHEN ALLE WETTKAEMPFE - und das loest den
        --     Grenzfall "Wettkampf, zu dem noch NIEMAND gemeldet ist":
        --     Wer meldet, muss den Wettkampf finden koennen. Waere der
        --     Trainer-Zugang wie bei den Terminen auf "Wettkaempfe MEINER
        --     Teams" zugeschnitten, entstuende eine Sackgasse UND ein Rennen:
        --     ein leerer Wettkampf waere fuer jede Trainerin unsichtbar (=
        --     niemand kann die erste Meldung eintragen), und sobald eine
        --     fremde Trainerin die erste Meldung setzt, VERLOERE die andere
        --     den Wettkampf wieder aus der Liste und koennte ihre eigene
        --     Skaterin nicht mehr melden. Deshalb: Wettkampf-STAMMDATEN (Name,
        --     Ort, Datum) sind fuer die Staffs offen - sie sind keine
        --     Kinderdaten. Die Kinderdaten stehen in competition_entries, und
        --     die bleiben zugeschnitten.
        --     is_club_trainer = owner/admin/moderator/coach/guest_coach;
        --     treasurer ist NICHT dabei (wie bestellt).
        or app.is_club_trainer(c.club_id)

        -- (3) Mitglieder: die Wettkaempfe, zu denen sie gemeldet sind -
        --     Eltern die ihrer Kinder (can_act_for_member deckt beides).
        or exists (
          select 1
          from app.competition_entries ce
          where ce.competition_id = c.id
            and ce.deleted_at is null
            and app.can_act_for_member(ce.member_id)
        )
      )
  )
$$;

comment on function app.can_read_competition(uuid) is
  'Sichtbarkeit eines Wettkampfs: Vorstand (owner/admin/moderator) und Trainer:innen (is_club_trainer) sehen alle - Letztere, weil sie die Meldung machen und ein Wettkampf ohne Meldungen sonst unauffindbar UND unbefuellbar waere. Mitglieder/Eltern sehen die, zu denen sie/ihre Kinder gemeldet sind (can_act_for_member). Kasse: nein.';

-- ----------------------------------------------------------------------------
-- 4. Die Policies scharf schalten.
--    ALLE drei behalten das fuehrende app.is_club_member(club_id) und haengen
--    die Zielgruppe mit AND daran. Damit ist jede neue Policy BEWEISBAR eine
--    Teilmenge der alten - es kann niemand mehr sehen als heute, nur weniger.
-- ----------------------------------------------------------------------------
drop policy events_select on app.events;
create policy events_select on app.events
  for select to authenticated
  using (app.is_club_member(club_id) and app.can_read_event(id));

drop policy event_teams_select on app.event_teams;
create policy event_teams_select on app.event_teams
  for select to authenticated
  using (app.is_club_member(club_id) and app.can_read_event(event_id));

drop policy competitions_select on app.competitions;
create policy competitions_select on app.competitions
  for select to authenticated
  using (app.is_club_member(club_id) and app.can_read_competition(id));

-- ----------------------------------------------------------------------------
-- 5. Das Haekchen ist rechtepflichtig — SERVERSEITIG, nicht nur im UI.
--    v1 hatte die Rechte NUR clientseitig; genau das war der Fehler dieses
--    Projekts. Der Trigger ist die letzte Instanz: er greift auch dann, wenn
--    die API-Pruefung (events.ts) jemals umgangen oder vergessen wird.
--    Trigger statt WITH CHECK, weil eine Policy-Verletzung die Zeile still
--    wegfiltert (0 rows) — hier soll es LAUT scheppern (42501).
-- ----------------------------------------------------------------------------
create or replace function app.protect_event_audience()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- auth.uid() is null = kein Nutzer-Token (service_role, Seed, Migration).
  -- Dieselbe Ausnahme und dieselbe Begruendung wie app.protect_club_membership
  -- (0002:236 "service_role tokens carry no sub claim and stay exempt"): dieser
  -- Trigger autorisiert MENSCHEN. Der Dienstweg hat mit withServiceRole seine
  -- eigene, protokollierte Kontrolle (db.ts) — er wird hier nicht doppelt
  -- gepruefT, sonst koennte der Seed keinen einzigen Vereinstermin anlegen.
  -- NICHT betroffen sind die beiden Integritaets-Trigger unten: eine zweite
  -- Wahrheit darf auch der Seed nicht erzeugen, die gelten ausnahmslos.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.audience = 'club'
       and not app.has_club_role(new.club_id, array['owner', 'admin', 'moderator']) then
      raise exception 'Vereinsveranstaltungen anlegen darf nur der Vorstand (owner/admin/moderator)'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    -- Deckt DREI Wege ab, alle ausdruecklich bestellt bzw. strenger gedacht:
    --   * HOCHSTUFEN  (new.audience = 'club'): der coach macht aus seinem
    --     Team-Training keine vereinsweite Veroeffentlichung.
    --   * HERUNTERSTUFEN (old.audience = 'club'): er nimmt dem Verein auch
    --     keine Vereinsveranstaltung weg.
    --   * UMSCHREIBEN (old.audience = 'club', Titel/Notiz/deleted_at): eine
    --     Vereinsveranstaltung ist eine vereinsweite Nachricht. Wer sie nicht
    --     anlegen darf, darf sie auch nicht umschreiben oder loeschen -
    --     sonst waere das Recht ueber den Umweg PATCH wieder offen. Das geht
    --     ueber den Wortlaut hinaus ("im Zweifel strenger") und kostet nichts:
    --     Team-Termine (teams->teams) beruehrt es nicht.
    if (old.audience = 'club' or new.audience = 'club')
       and not app.has_club_role(new.club_id, array['owner', 'admin', 'moderator']) then
      raise exception 'Vereinsveranstaltungen aendern darf nur der Vorstand (owner/admin/moderator)'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function app.protect_event_audience() is
  'Serverseitiger Riegel fuer die Zielgruppe: audience=''club'' anlegen/aendern/entfernen darf nur owner/admin/moderator. Greift auch beim PATCH-Hochstufen und beim Herunterstufen. 42501 statt stiller Filterung.';

create trigger events_protect_audience
  before insert or update on app.events
  for each row execute function app.protect_event_audience();

-- ----------------------------------------------------------------------------
-- 6. Grenzfall B: 'club' und Teams schliessen sich aus (Trigger auf BEIDEN
--    Seiten, sonst laesst sich die Regel ueber die jeweils andere Tabelle
--    umgehen).
-- ----------------------------------------------------------------------------
create or replace function app.protect_event_audience_teams()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.audience = 'club'
     and exists (select 1 from app.event_teams et
                 where et.event_id = new.id and et.deleted_at is null) then
    raise exception 'Eine Vereinsveranstaltung hat keine Team-Zuordnung — erst die Teams entfernen (Termin %)', new.id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger events_audience_no_teams
  after insert or update of audience on app.events
  for each row execute function app.protect_event_audience_teams();

create or replace function app.protect_event_teams_audience()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is null
     and exists (select 1 from app.events e
                 where e.id = new.event_id and e.audience = 'club') then
    raise exception 'Termin % ist eine Vereinsveranstaltung — sie kennt keine Team-Zuordnung', new.event_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger event_teams_audience_guard
  before insert or update on app.event_teams
  for each row execute function app.protect_event_teams_audience();

-- ----------------------------------------------------------------------------
-- 7. Die Trainerin haengt Termine nur an IHRE Teams (Eigenbefund des Auftrags).
--    ALT: has_club_role(owner/admin/coach) ohne jeden Team-Bezug -> eine
--    Trainerin konnte Termine an JEDES Team haengen, auch an fremde.
--    NEU: owner/admin unveraendert alles; coach nur app.coached_team_ids.
--    BEWUSST OHNE moderator und OHNE guest_coach: beide sind heute hier NICHT
--    schreibberechtigt. Sie aufzunehmen waere eine AUSWEITUNG - und Weiten ist
--    hier verboten, auch wenn es symmetrisch aussaehe (die Lese-Seite kennt den
--    moderator sehr wohl). Die neue Menge ist damit eine echte Teilmenge der
--    alten: coach verliert die fremden Teams, sonst aendert sich nichts.
-- ----------------------------------------------------------------------------
drop policy event_teams_insert on app.event_teams;
create policy event_teams_insert on app.event_teams
  for insert to authenticated
  with check (
    app.has_club_role(club_id, array['owner', 'admin'])
    or (
      app.has_club_role(club_id, array['coach'])
      and team_id = any (app.coached_team_ids(club_id))
    )
  );

drop policy event_teams_update on app.event_teams;
create policy event_teams_update on app.event_teams
  for update to authenticated
  using (
    app.has_club_role(club_id, array['owner', 'admin'])
    or (
      app.has_club_role(club_id, array['coach'])
      and team_id = any (app.coached_team_ids(club_id))
    )
  )
  with check (
    app.has_club_role(club_id, array['owner', 'admin'])
    or (
      app.has_club_role(club_id, array['coach'])
      and team_id = any (app.coached_team_ids(club_id))
    )
  );

commit;
