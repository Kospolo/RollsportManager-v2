-- ============================================================================
-- 0069_trainer_notiz.sql — die INTERNE Arbeitsnotiz einer Trainer:in ÜBER EIN
-- MITGLIED (oft ein Kind). Das DRITTE Ding neben zwei bereits bestehenden —
-- und ausdrücklich KEIN Ersatz für eines davon:
--
--   1. app.notes (0008)              PERSÖNLICHER Zettel. RLS: owner_profile_id
--                                    = auth.uid(). Nur die Autor:in, über NICHTS
--                                    und NIEMANDEN. Bleibt unverändert.
--   2. app.member_assessments (0055) OFFIZIELLE Beurteilung über ein Mitglied.
--                                    Die FAMILIE liest sie (can_act_for_member)
--                                    — bewusste Entscheidung des Chefs zum
--                                    Auskunftsrecht der Eltern. Bleibt
--                                    UNVERÄNDERT; diese Migration fasst weder
--                                    ihre Tabelle noch ihre Policies an.
--   3. app.member_coach_notes (HIER) INTERNE Arbeitsnotiz. Die Familie sieht sie
--                                    NICHT. Das ist der ganze Zweck.
--
-- ############################################################################
-- ### DIE VORGABE (Chef, wörtlich) ###########################################
-- ############################################################################
-- „Trainer-Notizen sind nur für Trainer und höher, da die höher alle eine
--  Datenschutzvereinbarung unterschrieben haben."
-- Beispielinhalte: „Sprung sitzt nicht, anders erklären", „fehlt in letzter
-- Zeit oft". Nicht sichtbar für das Mitglied, nicht für die Eltern.
--
-- ############################################################################
-- ### WER LIEST — UND WARUM DIE FAMILIE STRUKTURELL DRAUSSEN IST #############
-- ############################################################################
-- Der Kern der Vorgabe ist eine AUSSCHLIESSUNG, keine Erlaubnis. Eine
-- Ausschließung, die nur daraus folgt, dass man can_act_for_member „nicht
-- dazugeschrieben" hat, ist schwach: sie hält genau so lange, bis jemand eine
-- zweite Lesart baut (ein Join, eine Aggregat-Route, eine neue Policy) und
-- dabei nicht an die Familie denkt. Deshalb steht die Familie hier NICHT
-- einfach nur nicht im Prädikat — sie steht ausdrücklich NEGIERT darin:
--
--     not app.can_act_for_member(p_member_id)
--
-- als ERSTER Faktor von app.can_read_coach_note(). Damit gilt: es gibt keine
-- Stufe, keine Rolle und keine Rechte-Matrix-Einstellung, die einer Person
-- Zugriff auf die Notizen über SICH SELBST oder über IHR KIND gibt. Der
-- Ausschluss ist nicht Abwesenheit einer Erlaubnis, sondern eine Bedingung.
--
-- Das hat eine Folge, die AUSDRÜCKLICH benannt gehört, weil sie eine
-- Entscheidung ist und keine Nebenwirkung: eine Trainer:in, die ihr EIGENES
-- Kind betreut, liest und schreibt über dieses Kind KEINE internen Notizen —
-- ihre Trainerrolle hebt ihre Elternrolle nicht auf. Dasselbe gilt für die
-- Moderatorin Petra aus dem Seed, die zugleich Finns Mutter ist: sie liest die
-- Notizen des ganzen Vereins, die über ihren eigenen Sohn NICHT. Genau dieser
-- Fall wird in 99pA gemessen, weil er der schärfste Beleg dafür ist, dass die
-- Ausschließung stärker ist als die Leitungsrolle.
--
-- Wer liest also:
--   * Stufe 'manage'    -> vereinsweit. Voreinstellung: owner/admin/moderator.
--   * Stufe 'read_team' -> NUR die Mitglieder der selbst betreuten Teams, und
--     (oder 'edit')        das auch nur als club-Rolle 'coach' —
--                          app.coaches_member_bound (unten).
--   * niemand sonst. Ein einfaches Mitglied, ein fremder Trainer, ein anderer
--     Verein: 0 Zeilen.
--
-- ############################################################################
-- ### WARUM EINE EIGENE HILFSFUNKTION STATT app.coaches_member (0055) ########
-- ############################################################################
-- app.coaches_member trägt has_club_role(['coach','guest_coach']) — der
-- GASTTRAINER ist dort bewusst drin (bei der Beurteilung soll er mitlesen).
-- Für die interne Notiz hat der Chef ihn ausdrücklich ausgeschlossen:
-- Gasttrainer:innen sind befristet und haben die Datenschutzvereinbarung
-- typischerweise NICHT unterschrieben. app.coaches_member DARF deshalb hier
-- nicht wiederverwendet werden — und sie wird auch nicht verändert, sonst
-- verschöbe sich still die Beurteilungs-Sichtbarkeit aus 0055.
--
-- app.coaches_member_bound ist die engere Zwillingsfunktion: identischer
-- Team-Zweig, aber has_club_role(['coach']) OHNE guest_coach. Milena (Seed,
-- guest_coach in Team 3) fällt damit STRUKTURELL durch — zusätzlich zu ihrer
-- Voreinstellung 'none' in der Rechte-Matrix. Zwei unabhängige Gründe.
--
-- ############################################################################
-- ### DER KASSENWART — und warum die Fähigkeit in die Matrix gehört ##########
-- ############################################################################
-- Der Chef: der Kassenwart steht im Rang „höher", hat aber fachlich nichts mit
-- Trainingsnotizen zu tun; VOREINSTELLUNG = liest nicht; der Verein soll es
-- selbst umstellen können. Beides zusammen geht nur über die konfigurierbare
-- Rechte-Matrix (app.capabilities / role_permissions, UI „Verwaltung → Rollen &
-- Rechte"). Deshalb bekommt die Notiz eine EIGENE Fähigkeit 'coach_notes' mit
-- treasurer := 'none' als Startwert — abschaltbar UND anschaltbar, ohne
-- Migration.
--
-- 0055 hat auf eine neue Fähigkeit VERZICHTET und das begründet: Test 93j
-- nagelt den Katalog auf eine exakte Zahl. Diese Migration geht den anderen
-- Weg — nicht gegen 0055, sondern weil der Chef diesmal ausdrücklich die
-- konfigurierbare Matrix verlangt hat. Der Weg ist vom Repo vorgesehen: der
-- Wächter am Ende von 0033 sagt wörtlich „Neue Fähigkeit? Dann gehört sie in
-- 0033 (bzw. eine Folge-Migration) eingestuft — und in 93j." Genau das
-- passiert hier (enforcement unten) und dort (93j: 32 -> 33, enforced 4 -> 5).
-- Präzedenzfall für die Buchhaltung in 93j ist 0045 (attendance).
--
-- ############################################################################
-- ### DIE STUFEN-SKALA — bewusst NUR VIER ####################################
-- ############################################################################
-- app.role_level ist eine LINEARE Skala (none < read_own < read_team <
-- read_all < edit < manage). Für diese Fähigkeit sind nicht alle Stufen
-- sinnvoll unterscheidbar, und eine Stufe anzubieten, die nichts anderes tut
-- als die daneben, wäre genau die Sorte Versprechen, die der Server nicht
-- einlöst. Angeboten werden deshalb nur vier, jede mit eigener Wirkung:
--
--   none       kein Zugriff.
--   read_team  LIEST die Notizen der von mir betreuten Mitglieder.
--   edit       liest UND SCHREIBT die Notizen der von mir betreuten Mitglieder.
--   manage     liest und schreibt VEREINSWEIT (die Leitung).
--
-- 'read_all' fehlt absichtlich: „alle lesen, aber nichts schreiben" ist für
-- diese Daten kein Bedarf, den jemand geäußert hat, und jede angebotene Stufe
-- muss eine gemessene Wirkung haben (Block C in 93j misst das nach).
--
-- ############################################################################
-- ### EHRLICHKEIT AN DER EINGABE #############################################
-- ############################################################################
-- Ausdrücklicher Wunsch des Chefs: an der Eingabemaske MUSS stehen, dass die
-- Notiz zwar vor Mitglied und Eltern verborgen ist, bei einem förmlichen
-- Auskunftsersuchen nach Art. 15 DSGVO aber dennoch herausgegeben werden muss.
-- Der Text darf nicht verharmlost und nicht weggelassen werden. Er lebt in
-- apps/web (DE+EN) — und der Grund steht hier, damit er bei einem Redesign
-- nicht als Deko-Text wegfällt.
--
-- Datenschutz-Einordnung (bewusst NICHT „das ist ja intern"):
--   * Auch die interne Notiz ist ein personenbezogenes Datum. Verborgenheit vor
--     der betroffenen Person ist eine ZUGRIFFS-Entscheidung, keine
--     Rechtsgrundlage — Art. 15 bleibt unberührt.
--   * Deshalb: Längenbegrenzung (kein Dossier), Autor:in unveränderlich
--     (Zurechenbarkeit), Soft-Delete statt Hard-Delete (Nachvollziehbarkeit),
--     und eine enge Leserschaft (Datenminimierung, Art. 5 Abs. 1 lit. c).
--   * Eine automatische Löschfrist ist NICHT eingebaut — dazu gab es keine
--     Vorgabe, und eine erfundene Frist wäre eine Zusicherung ohne Auftrag.
--     Steht als offener Punkt im Bericht.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Die Fähigkeit im konfigurierbaren Katalog.
--    Sortierung 310 = hinter 'anniversaries' (300), dem bisher letzten Eintrag.
-- ----------------------------------------------------------------------------
insert into app.capabilities (key, label_de, label_en, allowed_levels, sort) values
  ('coach_notes', 'Interne Trainer-Notizen', 'Internal coach notes',
   '{none,read_team,edit,manage}', 310)
on conflict (key) do update set
  label_de       = excluded.label_de,
  label_en       = excluded.label_en,
  allowed_levels = excluded.allowed_levels,
  sort           = excluded.sort;

-- ----------------------------------------------------------------------------
-- 2. Die Startkonfiguration. Körper WÖRTLICH aus 0045:530-626 übernommen —
--    nur der 'coach_notes'-Zweig kommt hinzu. Wortgleich heißt: kein anderes
--    Recht verschiebt sich durch diese Migration, und ein Diff gegen 0045 zeigt
--    genau eine Ergänzung.
--
--    Die Voreinstellung ist die Vorgabe des Chefs, Rolle für Rolle:
--      owner              -> 'manage' (automatisch: der owner-Zweig oben nimmt
--                            die höchste erlaubte Stufe; protected = Rang 5)
--      admin, moderator   -> 'manage'      vereinsweit lesen + schreiben
--      coach              -> 'edit'        lesen + schreiben, NUR eigene Teams
--      treasurer          -> 'none'        VOREINSTELLUNG, per UI umstellbar
--      member             -> 'none'
--      guest_coach        -> 'none'        (zusätzlich strukturell gesperrt,
--                                           s. app.coaches_member_bound)
--
--    Eigene, selbst angelegte Rollen bekommen KEINE Zeile und damit Rang 0 =
--    'none' (cap_rank coalesce). Fail-closed: eine neue Rolle liest interne
--    Notizen erst, wenn der Verein es ausdrücklich einstellt.
-- ----------------------------------------------------------------------------
create or replace function app.rbac_default_level(p_role_key text, p_capability text)
returns app.role_level
language plpgsql
stable
parallel safe
set search_path = ''
as $$
declare
  v_admin     boolean := p_role_key in ('owner', 'admin', 'moderator');
  v_manager   boolean := p_role_key in ('owner', 'admin', 'moderator', 'treasurer');
  v_trainer   boolean := p_role_key in ('owner', 'admin', 'moderator', 'coach', 'guest_coach');
  v_structure boolean := p_role_key in ('owner', 'admin', 'moderator', 'coach');
  v_locker    boolean := p_role_key in ('owner', 'admin', 'treasurer');
  v_top       app.role_level;
begin
  if p_role_key = 'owner' then
    select l into v_top
    from app.capabilities c
    cross join unnest(c.allowed_levels) as l
    where c.key = p_capability
    order by app.level_rank(l) desc
    limit 1;
    return coalesce(v_top, 'none');
  end if;

  case p_capability

    when 'members' then
      return case when v_manager then 'manage' else 'read_all' end;

    when 'member_contact' then
      return case when v_manager then 'read_all' else 'none' end;

    when 'roles', 'club_settings' then
      return case when v_admin then 'manage' else 'none' end;

    when 'departments' then
      return case when v_admin then 'manage'
                  when v_trainer then 'edit'
                  else 'none' end;

    when 'teams', 'events', 'competitions', 'tasks' then
      return case when v_structure then 'manage' else 'read_all' end;

    when 'team_coaches' then
      return case when v_admin then 'manage' else 'none' end;

    when 'routines' then
      return case when v_admin then 'manage'
                  when p_role_key in ('coach', 'guest_coach') then 'read_team'
                  else 'read_own' end;

    when 'routines_edit' then
      return case when v_trainer then 'edit' else 'none' end;

    -- NEU (0045) — der Befund des Nutzers: "trainingsbeteiligung an anderen
    -- mitgliedern als mitglied ... das kann trainer und hoeher sehen, aber rest
    -- nicht." Vorher stand 'attendance' in der Sammel-Zeile der Trainer-Module
    -- und damit fuer JEDEN Nicht-Trainer auf 'read_all'.
    --   v_trainer (owner/admin/moderator/coach/guest_coach) -> edit (>= read_all)
    --   alle uebrigen, ausdruecklich INKLUSIVE treasurer     -> read_own
    -- treasurer: kein Finanz-/Pflichtstunden-Pfad haengt daran (nachgemessen,
    -- siehe Kopf); ohne Zweck kein Zugriff auf Kinderdaten. Per Admin-UI je
    -- Verein jederzeit zurueckzuholen.
    when 'attendance' then
      return case when v_trainer then 'edit' else 'read_own' end;

    when 'training_slots', 'exercises', 'achievements', 'news',
         'media', 'documents', 'gallery', 'equipment', 'facilities',
         'regional_events' then
      return case when v_trainer then 'edit' else 'read_all' end;

    when 'facilities_booking', 'duty_hours', 'waitlists', 'checkins' then
      return case when v_trainer then 'edit' else 'read_own' end;

    when 'equipment_reservations' then
      return case when v_trainer then 'manage' else 'read_own' end;

    when 'lockers' then
      return case when v_locker then 'manage' else 'read_own' end;

    when 'finance' then
      return case when v_manager then 'manage' else 'read_own' end;

    when 'chat' then
      return case when v_trainer then 'read_all' else 'read_team' end;

    when 'anniversaries' then
      return case when p_role_key in ('admin', 'moderator', 'treasurer', 'coach')
                  then 'read_all' else 'read_team' end;

    -- NEU (0069) — die interne Trainer-Notiz. Vorgabe des Chefs: "nur fuer
    -- Trainer und hoeher"; Kassenwart VOREINGESTELLT ohne Zugriff (fachlich
    -- nichts mit Trainingsnotizen zu tun), per Rollen-UI umstellbar.
    -- guest_coach 'none': befristet, Datenschutzvereinbarung typischerweise
    -- nicht unterschrieben. 'edit' fuer coach = lesen+schreiben, aber NUR im
    -- eigenen Team (app.coaches_member_bound schneidet das zu).
    when 'coach_notes' then
      return case when p_role_key in ('admin', 'moderator') then 'manage'
                  when p_role_key = 'coach' then 'edit'
                  else 'none' end;

    else
      -- Unbekannte Faehigkeit: fail-closed. Kein stiller Vollzugriff.
      return 'none';
  end case;
end;
$$;

comment on function app.rbac_default_level(text, text) is
  'Startkonfiguration je Systemrolle × Fähigkeit. Bildet den HEUTIGEN Rechtestand ab (nicht RBAC-DESIGN §3 — Abweichungen siehe Kopf von 0023). Seit 0028 routines_edit = is_club_trainer. Seit 0031 team_coaches = nur Team-Verwalter, bewusst OHNE coach. Seit 0045 attendance: Nicht-Trainer (inkl. treasurer) = read_own statt read_all. Seit 0069 coach_notes: admin/moderator = manage, coach = edit (teamgebunden), treasurer/member/guest_coach = none.';

-- ----------------------------------------------------------------------------
-- 3. BACKFILL des Bestands. rbac_seed_club ist idempotent (on conflict do
--    nothing, 0024:54): es ERGÄNZT die fehlenden 'coach_notes'-Zeilen für die
--    7 Systemrollen jedes bestehenden Vereins und fasst NICHTS Bestehendes an.
--    Ohne diesen Schritt hätte jeder Altverein für 'coach_notes' gar keine
--    Zeile — cap_rank lieferte 0 und selbst die Trainerin käme nicht heran.
--    Neue Vereine bekommen sie über den clubs_rbac_seed-Trigger.
-- ----------------------------------------------------------------------------
do $$
declare
  v_club record;
begin
  for v_club in select id from app.clubs loop
    perform app.rbac_seed_club(v_club.id);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. app.coaches_member_bound — der ENGERE Zwilling von app.coaches_member
--    (0055). Unterschied: NUR die club-Rolle 'coach', OHNE 'guest_coach'.
--
--    app.coaches_member bleibt unverändert — sie trägt die Sichtbarkeit der
--    Beurteilung (0055), und dort SOLL der Gasttrainer mitlesen. Hätte man dort
--    guest_coach entfernt, wäre still eine fremde Funktion beschnitten worden.
--    Zwei Namen für zwei Regeln ist hier billiger als ein Schalter.
--
--    Achtung, der Grund für has_club_role statt eines team_members-Filters:
--    ein guest_coach steht in team_members MIT role='coach' (so ist der Seed,
--    und so ist die Bauform). app.coached_team_ids liefert ihm also sehr wohl
--    seine Teams. Der Ausschluss kann deshalb NUR über die VEREINSROLLE
--    laufen — genau das tut has_club_role(p_club_id, array['coach']).
--
--    SECURITY DEFINER wie das Vorbild: der Blick in team_members ist RLS-frei,
--    sonst hinge die Sichtbarkeit an der RLS ihrer eigenen Hilfstabellen.
-- ----------------------------------------------------------------------------
create or replace function app.coaches_member_bound(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_club_role(p_club_id, array['coach'])
     and exists (
       select 1
       from app.team_members tm
       where tm.member_id = p_member_id
         and tm.club_id   = p_club_id
         and tm.deleted_at is null
         and tm.team_id = any (app.coached_team_ids(p_club_id))
     )
$$;

comment on function app.coaches_member_bound(uuid, uuid) is
  'Betreut die aufrufende Person als FESTE Trainer:in (club-Rolle coach, OHNE guest_coach) ein Team, dem p_member_id angehört? Engerer Zwilling von app.coaches_member (0055), eingeführt für die interne Trainer-Notiz (0069): Gasttrainer:innen sind befristet und haben die Datenschutzvereinbarung typischerweise nicht unterschrieben.';

-- ----------------------------------------------------------------------------
-- 5. Die beiden Sichtbarkeits-Funktionen. Sie sind der EINZIGE Ort, an dem die
--    Regel steht — die Policies unten rufen nur noch. Das ist Absicht:
--      * Der Familien-Ausschluss steht damit an EINER Stelle und kann nicht in
--        einer von drei Policies vergessen werden.
--      * app.capability_policy_usage() (0033) löst Helfer auf, die has_cap
--        KAPSELN. Nur deshalb findet die Nachrechnung 'coach_notes' überhaupt
--        und kann das Etikett 'enforced' unten bestätigen (Test 93j, Block B/C).
--
--    Reihenfolge der Faktoren ist bewusst: die Negation der Familie steht
--    VORNE, nicht als Nachgedanke hinten.
-- ----------------------------------------------------------------------------
create or replace function app.can_read_coach_note(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- (1) DIE FAMILIE IST IMMER AUSSEN VOR — die betroffene Person selbst UND
    --     ihre Erziehungsberechtigten. Keine Stufe, keine Rolle, keine
    --     Matrix-Einstellung hebt das auf. Das ist der Kern der Vorgabe.
    not app.can_act_for_member(p_member_id)
    and (
      -- (2) Vereinsweit: Stufe 'manage'. Voreinstellung owner/admin/moderator.
      app.has_cap(p_club_id, 'coach_notes', 'manage')
      -- (3) Teamgebunden: mindestens 'read_team' UND feste Trainer:in DIESES
      --     Mitglieds. Ein Trainer eines anderen Teams fällt hier durch.
      or (app.has_cap(p_club_id, 'coach_notes', 'read_team')
          and app.coaches_member_bound(p_club_id, p_member_id))
    )
$$;

comment on function app.can_read_coach_note(uuid, uuid) is
  'Darf die aufrufende Person die internen Trainer-Notizen über p_member_id LESEN? Voraussetzung ist IMMER, dass sie NICHT die betroffene Person oder deren Erziehungsberechtigte ist (not can_act_for_member) — dieser Ausschluss ist durch keine Rechte-Einstellung aufhebbar. Darüber hinaus: Fähigkeit coach_notes auf manage (vereinsweit) ODER read_team + coaches_member_bound (eigenes Team, ohne guest_coach).';

create or replace function app.can_write_coach_note(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not app.can_act_for_member(p_member_id)
    and (
      app.has_cap(p_club_id, 'coach_notes', 'manage')
      or (app.has_cap(p_club_id, 'coach_notes', 'edit')
          and app.coaches_member_bound(p_club_id, p_member_id))
    )
$$;

comment on function app.can_write_coach_note(uuid, uuid) is
  'Darf die aufrufende Person eine interne Trainer-Notiz über p_member_id ANLEGEN/ÄNDERN? Wie can_read_coach_note, aber der Team-Zweig verlangt Stufe edit statt read_team. Schreiben ist damit stets eine Teilmenge des Lesens — es gibt keine Notiz, die jemand schreiben, aber nicht sehen kann.';

-- ----------------------------------------------------------------------------
-- 6. Die Tabelle.
--    body-Länge 1..4000: kürzer als die Beurteilung (5000). Eine interne Notiz
--    ist ein Merkzettel, kein Dossier — Datenminimierung ist hier auch eine
--    Frage der Bauform, nicht nur der guten Absicht.
--    not_self: man notiert nicht über sich selbst (Muster aus 0055).
-- ----------------------------------------------------------------------------
create table app.member_coach_notes (
  id                uuid primary key default app.uuid_v7(),
  club_id           uuid not null references app.clubs (id) on delete restrict,
  -- Die Person, ÜBER die notiert wird (oft ein Kind).
  member_id         uuid not null references app.club_members (id) on delete restrict,
  -- Die notierende Trainer:in bzw. Vereinsleitung. Immer eine Vereinsperson.
  author_member_id  uuid not null references app.club_members (id) on delete restrict,
  body              text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint member_coach_notes_body_len
    check (char_length(btrim(body)) between 1 and 4000),
  constraint member_coach_notes_not_self
    check (member_id <> author_member_id)
);

create index member_coach_notes_member_idx on app.member_coach_notes (club_id, member_id);
create index member_coach_notes_author_idx on app.member_coach_notes (club_id, author_member_id);

comment on table app.member_coach_notes is
  'INTERNE Arbeitsnotiz einer Trainer:in über EIN Mitglied (oft ein Kind) — z. B. "Sprung sitzt nicht, anders erklären". NICHT sichtbar für das Mitglied und NICHT für die Erziehungsberechtigten (app.can_read_coach_note negiert can_act_for_member). Abzugrenzen von app.notes (0008, persönlicher Zettel) und app.member_assessments (0055, offizielle Beurteilung, die die Familie SEHR WOHL liest). Lesen/Schreiben: Fähigkeit coach_notes (Rechte-Matrix) — manage = vereinsweit, edit/read_team = nur eigene Teams als feste Trainer:in. Löschen ist SOFT. Hinweis: Vertraulichkeit vor der Familie ist eine Zugriffsentscheidung, KEINE Rechtsgrundlage — bei einem Auskunftsersuchen nach Art. 15 DSGVO kann die Notiz herausgegeben werden müssen.';
comment on column app.member_coach_notes.member_id is
  'club_members.id der Person, ÜBER die notiert wird. / club_members.id of the member the note is about.';
comment on column app.member_coach_notes.author_member_id is
  'club_members.id der notierenden Person. Nach dem Anlegen unveränderlich (Trigger member_coach_notes_protect) — Zurechenbarkeit. / Immutable after creation.';

create trigger member_coach_notes_set_updated_at
  before update on app.member_coach_notes
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. Unveränderlichkeit von club_id/member_id/author_member_id (Muster aus
--    0055/0067). Ohne das könnte selbst ein berechtigter Editor eine Notiz
--    nachträglich einer ANDEREN Person zuschreiben — bei einer Notiz, die die
--    Betroffene nicht sieht, wiegt das doppelt: sie kann der Falschzuordnung
--    nicht widersprechen, weil sie von ihr nichts weiß.
--    auth.uid() is null = Migration/Seed/service_role -> ungeprüft durch.
-- ----------------------------------------------------------------------------
create or replace function app.protect_member_coach_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.club_id <> old.club_id
     or new.member_id <> old.member_id
     or new.author_member_id <> old.author_member_id then
    raise exception 'member_coach_notes: club_id, member_id and author_member_id are immutable'
      using hint = 'Verein, betroffene Person und Autor:in einer internen Trainer-Notiz sind unveränderlich. / club, subject member and author of an internal coach note are immutable.';
  end if;
  return new;
end;
$$;

comment on function app.protect_member_coach_note() is
  'Friert club_id/member_id/author_member_id einer internen Trainer-Notiz ein (nur body änderbar). auth.uid() is null (Seed/Service) bleibt ausgenommen.';

create trigger member_coach_notes_protect
  before update on app.member_coach_notes
  for each row execute function app.protect_member_coach_note();

-- ----------------------------------------------------------------------------
-- 8. RLS. Grants kommen aus 0001:43 (authenticated: select/insert/update/
--    delete); RLS ist der Zeilenfilter. Eine fehlende DELETE-Policy ist
--    deny-by-default für hartes Löschen — gelöscht wird über deleted_at.
-- ----------------------------------------------------------------------------
alter table app.member_coach_notes enable row level security;

create policy member_coach_notes_select on app.member_coach_notes
  for select to authenticated
  using (app.can_read_coach_note(club_id, member_id));

-- INSERT: schreibberechtigt UND die Autorenzeile ist die EIGENE Mitgliedschaft
-- (sonst schriebe man im Namen einer Kollegin). Mitgliedschafts-Gate wie 0037:
-- status/valid_until, damit ein abgelaufener Zugang nicht mehr schreibt.
create policy member_coach_notes_insert on app.member_coach_notes
  for insert to authenticated
  with check (
    app.can_write_coach_note(club_id, member_id)
    and exists (
      select 1 from app.club_members am
      where am.id = author_member_id
        and am.club_id = member_coach_notes.club_id
        and am.profile_id = auth.uid()
        and am.deleted_at is null
        and am.status = 'active'
        and (am.valid_until is null or am.valid_until >= now())
    )
  );

-- UPDATE (Ändern + Soft-Delete): die Autor:in oder die Leitung ('manage').
-- can_write_coach_note steht als Klammer davor, damit eine Trainer:in, der die
-- Fähigkeit später entzogen wird, auch ihre ALTEN Notizen nicht mehr umschreibt.
-- using = alte Zeile, with check = neue Zeile; der Trigger hält dabei
-- club/member/author fest.
create policy member_coach_notes_update on app.member_coach_notes
  for update to authenticated
  using (
    app.can_write_coach_note(club_id, member_id)
    and (
      app.has_cap(club_id, 'coach_notes', 'manage')
      or exists (
        select 1 from app.club_members am
        where am.id = author_member_id
          and am.profile_id = auth.uid()
          and am.deleted_at is null
      )
    )
  )
  with check (
    app.can_write_coach_note(club_id, member_id)
    and (
      app.has_cap(club_id, 'coach_notes', 'manage')
      or exists (
        select 1 from app.club_members am
        where am.id = author_member_id
          and am.profile_id = auth.uid()
          and am.deleted_at is null
      )
    )
  );

-- Kein DELETE für irgendwen: deny-by-default.

-- ----------------------------------------------------------------------------
-- 9. Das Etikett (0033). 'enforced' = die Stufe wirkt auf das LESEN: "keine"
--    nimmt den Zugriff wirklich weg. Das ist hier keine Behauptung —
--    member_coach_notes_select ruft app.can_read_coach_note, und die kapselt
--    has_cap(...,'coach_notes',...). app.capability_policy_usage() löst genau
--    solche Helfer auf und findet die Fähigkeit deshalb MIT cmd='SELECT'.
--    Test 93j Block B/C rechnet das nach; 99pA misst die Wirkung an echten
--    Zeilen (Stufe auf 'none' -> 0 Zeilen).
-- ----------------------------------------------------------------------------
update app.capabilities set enforcement = 'enforced' where key = 'coach_notes';

commit;
