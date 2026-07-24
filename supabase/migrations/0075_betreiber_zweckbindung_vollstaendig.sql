-- ============================================================================
-- 0075_betreiber_zweckbindung_vollstaendig.sql
-- DIE ZWECKBINDUNG BEKOMMT DIE TÜREN, DIE 0074 NICHT ERREICHT HAT.
--
-- ############################################################################
-- ### DER BEFUND (gemessen, nicht vermutet) #################################
-- ############################################################################
-- 0074 hat den Betreiber-Override an app.operator_may(capability) gebunden und
-- wirkt: coach_notes = 0 Zeilen, locker_rentals = 0, Finanzfläche = 0.
-- Gemessen im eigenen Harness, Seed-Stand, Persona 90000000-…-090:
--
--   (A) MIT eingeschalteter Einsicht (Claim + app.operator_override='on'):
--         app.lockers              8 Zeilen  <- inkl. assigned_member_id UND
--                                              price_per_month_cents
--         app.locker_has_active_rental(…)  true für 4 Fächer
--         app.guardianships        5 Zeilen  <- wer ist Elternteil von wem
--         app.checkins             4 Zeilen  <- wer wann in der Halle war
--         app.member_assessments   4 Zeilen  <- der volle Beurteilungstext
--         app.chat_messages        5, app.documents 3, app.media_assets 8,
--         app.gallery_items 4, app.attendance 11
--
--   (B) NUR MIT DEM CLAIM, OHNE die Sitzungsvariable — also OHNE den Weg, an
--       dem das Protokoll hängt:
--         app.lockers              8 Zeilen (!)
--         app.club_members        24 Zeilen (!)
--         app.club_modules         3, can_read_routine 6/6
--         is_club_member/can_manage_sparten/is_club_pro = true
--
-- (B) ist der eigentliche Skandal an den ALTEN Zweigen: sie hängen an
-- app.is_platform_admin() — dem blossen Claim — und NICHT an
-- app.operator_override(). 0051 hat den Zugriff bewusst an den Nachweis
-- gekoppelt („kein Einblick ohne Protokollzeile"); diese Zweige sind älter und
-- umgehen die Kopplung in der Datenbank vollständig. Dass in der laufenden API
-- trotzdem jede Zeile protokolliert wird, liegt allein daran, dass die
-- Middleware auf '*' liegt — eine Eigenschaft des Aufrufwegs, keine der Daten.
--
-- Zur Einordnung, warum das kein Papierproblem ist: von den 4 Fächern mit
-- Mieter:in im Seed gehören DREI Minderjährigen (15, 15, 17 Jahre) — mit Preis.
-- „Welches Kind mietet welches Fach für wie viel Geld" war über /lockers weiter
-- rekonstruierbar, obwohl /locker-rentals seit 0074 zu ist.
--
-- ############################################################################
-- ### DIE REGEL, DIE DIESE MIGRATION DURCHSETZT #############################
-- ############################################################################
-- Es gibt genau EINE Quelle der Betreiber-Autorität: app.operator_capabilities
-- (0074). Jede Tür, durch die der Betreiber personenbezogene Daten eines
-- Vereins sieht, fragt ab jetzt app.operator_may(<Fähigkeit>) — und nichts
-- sonst. Kein Zweig fragt mehr app.is_platform_admin() allein.
--
-- Daraus folgen drei Dinge, jedes mit Absicht:
--   1. FAIL-CLOSED bleibt fail-closed. Was nicht in der Allowlist steht, sieht
--      der Betreiber nicht — auch nicht über eine Nebentür (Art. 25 Abs. 2).
--   2. KEIN ZUGRIFF OHNE PROTOKOLL gilt jetzt auch in der Datenbank. Der blosse
--      Claim öffnet nichts mehr; es braucht die Sitzungsvariable, und die setzt
--      nur db.ts, nachdem middleware/operator-access.ts protokolliert hat.
--   3. DIE VEREINSSEITE ÄNDERT SICH UM KEIN BISSCHEN. Überall, wo bisher
--      app.has_club_role / app.is_club_member / app.can_manage_members stand,
--      steht jetzt die REINE Mitgliedschaftsfrage (app.club_role_held aus 0074
--      bzw. app.club_membership_held, neu hier) PLUS ein eigener, benannter
--      Betreiber-Zweig. Die Rollenmengen sind wortgleich übernommen.
--
-- ############################################################################
-- ### WAS BEWUSST OFFEN BLEIBT — und warum ##################################
-- ############################################################################
-- * app.has_club_role() und app.is_club_trainer() behalten den PAUSCHALEN
--   Override. Das ist die Entscheidung aus 0074 (Kopf, Punkt 2): sie sind der
--   STRUKTUR-Gate und tragen 22 SCHREIBENDE Policies (news, exercises,
--   training_slots, achievements, media, regional_events, gallery,
--   department_members, duty_requirements). Sie fail-closed zu machen nähme dem
--   Betreiber in derselben Zeile die Schreibrechte, die 0051 ihm ausdrücklich
--   gibt. Diese Migration nimmt ihnen stattdessen die LESE-Türen ab: die vier
--   SELECT-Policies, die an is_club_trainer hingen (checkins, waitlists,
--   duty_entries, chat_messages), fragen jetzt club_role_held + operator_may.
--   Ergebnis: der Betreiber darf weiter reparieren, aber nicht mehr mitlesen.
--
-- * app.operator_audit_log_select, app.support_tickets_*, app.support_messages_*
--   und app.support_guard_message bleiben WORTGLEICH auf is_platform_admin().
--   Das ist die eigene Datenhaltung des Auftragsverarbeiters (sein Protokoll,
--   seine Support-Postfächer) und der „Ansehen"-Weg aus 0051. Wer sie bindet,
--   nimmt dem Betreiber die Nachweisführung, die der Grund für den Zugriff ist.
--
-- * Der Katalog app.capabilities wird NICHT erweitert. Für Daten ohne eigene
--   Fähigkeit (Vormundschaften, Einwilligungen, Einladungen, Rückrufnummern der
--   Fahrgemeinschaften, Beurteilungen) wird die Fähigkeit gewählt, die die
--   DATENKLASSE benennt — 'member_contact' bzw. 'coach_notes'. Beide sind in
--   0074 mit Begründung GESPERRT. Eine neue Fähigkeit wäre eine Änderung der
--   Rechte-Matrix des VEREINS (app.role_permissions, Admin-UI) und damit eine
--   ganz andere Entscheidung als die Grenze des Auftragsverarbeiters.
--   Nur der BETREIBER-Zweig benutzt diese Schlüssel; die Vereinsseite behält
--   ihr eigenes, unverändertes Prädikat.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. app.club_membership_held — die REINE Mitgliedschaftsfrage.
--
--    Gegenstück zu app.club_role_held (0074, Abschnitt 6) für die Fälle, in
--    denen keine Rollenmenge geprüft wird, sondern nur „ist die Person
--    überhaupt Mitglied". Rumpf wörtlich aus app.is_club_member (0025:92),
--    nur ohne den Betreiber-Zweig.
--
--    Warum eine eigene Funktion und kein CASE in is_club_member: dieselbe
--    Begründung wie in 0074 Abschnitt 6. Eine Person, die BEIDES ist
--    (Plattform-Admin und Vereinsmitglied), darf ihre echte Mitgliedschaft
--    nicht verlieren, sobald die Einsicht anspringt. Mit club_membership_held
--    bleibt es eine ODER-Verknüpfung.
-- ----------------------------------------------------------------------------
create or replace function app.club_membership_held(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_length(app.member_role_keys(p_club_id), 1) > 0, false)
$$;

comment on function app.club_membership_held(uuid) is
  'Ist die aufrufende Person TATSAECHLICH Mitglied dieses Vereins — ohne jeden Betreiber-Zweig? Gegenstueck zu app.club_role_held (0074) fuer Praedikate ohne Rollenmenge. app.is_club_member ist diese Funktion PLUS dem zweckgebundenen Betreiber-Zweig (operator_may(''members'')). Liefert strikt true/false, nie NULL.';

-- ----------------------------------------------------------------------------
-- 2. app.is_club_member — der Cross-Club-READ des Betreibers bekommt einen Zweck.
--
--    VORHER: app.is_platform_admin() or array_length(member_role_keys)>0
--            -> der blosse Claim, ohne Sitzungsvariable, ohne Zweck. Das ist
--            der Zweig, den 0074 im Kopf unter „Ebenfalls benannt" als offen
--            stehen gelassen hat (0074:125-129).
--    NACHHER: app.operator_may('members') or app.club_membership_held(...)
--
--    'members' IST freigegeben -> für den eingeschalteten Betreiber ändert sich
--    HEUTE nichts (39 SELECT-Policies hängen hier, darunter clubs_select — ohne
--    diesen Zweig könnte der Betreiber keinen Verein mehr unterstützen).
--    Was sich ändert, ist zweierlei, und beides ist der Punkt:
--      * Der Claim ALLEIN öffnet nichts mehr -> „kein Zugriff ohne Protokoll"
--        steht jetzt in der Datenbank und nicht nur im Aufrufweg.
--      * Nähme jemand 'members' von der Allowlist, schlösse sich diese ganze
--        Fläche mit. Vorher wäre sie offen geblieben.
-- ----------------------------------------------------------------------------
create or replace function app.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.club_membership_held(p_club_id)
      or app.operator_may('members')
$$;

comment on function app.is_club_member(uuid) is
  'Ist die aufrufende Person (effektiv) Mitglied? DB-aufgeloest. Seit 0075 zweckgebunden fuer den Betreiber: der Cross-Club-READ wirkt nur bei EINGESCHALTETER Einsicht (0051) UND freigegebener Faehigkeit "members" (0074) — der blosse Plattform-Admin-Claim bewirkt hier nichts mehr.';

-- ----------------------------------------------------------------------------
-- 3. Die drei weiteren Funktionen mit unbedingtem is_platform_admin(), deren
--    Fähigkeit FREIGEGEBEN ist. Ergebnis für den eingeschalteten Betreiber
--    unverändert; neu ist allein die Kopplung an Protokoll und Allowlist.
-- ----------------------------------------------------------------------------

-- KUEREN. 'routines' ist freigegeben (0051 hat die Moderation ausdruecklich
-- zugesagt, 99e misst sie). Rumpf wörtlich aus 0026:130ff.
create or replace function app.can_read_routine(p_routine_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.routines r
    where r.id = p_routine_id
      and r.deleted_at is null
      and (
        -- 0075: hier stand bis dahin der blosse Plattform-Admin-Claim.
        app.operator_may('routines')
        -- >= read_all: alles im Verein (Default: owner/admin/moderator)
        or app.cap_rank(r.club_id, 'routines') >= app.level_rank('read_all')
        -- = read_team: die betreuten Teams (Default: coach/guest_coach)
        or (
          app.cap_rank(r.club_id, 'routines') = app.level_rank('read_team')
          and r.team_id = any (app.coached_team_ids(r.club_id))
        )
        -- >= read_own: die eigenen Küren (Default: alle übrigen, inkl. treasurer)
        or (
          app.cap_rank(r.club_id, 'routines') >= app.level_rank('read_own')
          and exists (
            select 1
            from app.routine_skaters rs
            where rs.routine_id = r.id
              and rs.deleted_at is null
              and app.is_own_member(rs.member_id)
          )
        )
      )
  )
$$;

comment on function app.can_read_routine(uuid) is
  'Kuer-Lesesichtbarkeit: Stufenmodell aus 0026 (read_all / read_team / read_own). Seit 0075 haengt der Betreiber-Zweig an app.operator_may(''routines'') statt am blossen Plattform-Admin-Claim — die Kuer-Moderation aus 0051 bleibt offen, aber nur auf dem protokollierten Weg.';

-- SPARTEN. 'departments' ist freigegeben. Rollenmenge wörtlich aus 0062:176,
-- der Betreiber-Zweig wird vom Claim auf den Zweck umgehaengt.
create or replace function app.can_manage_sparten(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.club_role_held(p_club_id, array['owner', 'admin', 'treasurer'])
      or app.operator_may('departments')
$$;

comment on function app.can_manage_sparten(uuid) is
  'Schreib-Guard fuer Sparten: club-Rolle owner/admin/treasurer (BEWUSST OHNE moderator, 0062) ODER — seit 0075 zweckgebunden — die protokollierte Betreiber-Einsicht mit freigegebener Faehigkeit "departments".';

-- PRO-GATING. Das ist eine LIZENZfrage und damit Betrieb im engsten Sinn;
-- 'club_settings' ist freigegeben. Rumpf wörtlich aus 0012:53ff.
create or replace function app.is_club_pro(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.operator_may('club_settings')
      or exists (
        select 1
        from app.entitlements e
        where e.subject_type = 'club'
          and e.subject_id = p_club_id
          and coalesce(e.metadata ->> 'tier', '') in ('pro', 'premium')
          and coalesce(e.metadata ->> 'status', 'active') in ('active', 'trial')
          and (e.valid_until is null or e.valid_until >= now())
      )
$$;

comment on function app.is_club_pro(uuid) is
  'PRO-Gating (Referenz 4): aktives pro/premium-Entitlement des Vereins. Seit 0075 haengt der Betreiber-Zweig an app.operator_may(''club_settings'') statt am blossen Claim — Lizenzfragen bleiben Betrieb, aber auf dem protokollierten Weg.';

-- ----------------------------------------------------------------------------
-- 4. Die Funktionen, die ZUGEHEN. Hier wirkt die Migration.
-- ----------------------------------------------------------------------------

-- ANWESENHEIT. 'attendance' ist NICHT freigegeben (0074: „Wann welches Kind wo
-- war. Ein Bewegungsprofil ist nichts, was man zum Betrieb braucht.").
-- Rumpf wörtlich aus 0045:488ff.
create or replace function app.can_read_attendance(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.operator_may('attendance')   -- 0075: war der blosse Claim
      or app.cap_rank(p_club_id, 'attendance') >= app.level_rank('read_all')
      or (
        app.cap_rank(p_club_id, 'attendance') = app.level_rank('read_team')
        and exists (
          select 1
          from app.team_members tm
          where tm.member_id = p_member_id
            and tm.deleted_at is null
            and tm.team_id = any (app.coached_team_ids(p_club_id))
        )
      )
      or (
        app.cap_rank(p_club_id, 'attendance') >= app.level_rank('read_own')
        -- can_act_for_member und NICHT is_own_member: die Kinder ohne Konto
        -- (profile_id is null) haengen ausschliesslich an der Vormundschaft.
        and app.can_act_for_member(p_member_id)
      )
$$;

comment on function app.can_read_attendance(uuid, uuid) is
  'Anwesenheits-Lesesichtbarkeit (0045). Seit 0075 zweckgebunden fuer den Betreiber: app.operator_may(''attendance'') — heute NICHT freigegeben, der Auftragsverarbeiter bekommt kein Bewegungsprofil eines Kindes.';

-- GESUNDHEITSDATEN AN DER ABSAGE (0040). Der Grund einer Absage ist im
-- Regelfall eine Krankmeldung. Die Vereinsseite bleibt wortgleich
-- (owner/admin ohne moderator/treasurer, plus die betreuende Trainerin); neu
-- ist nur, dass der Betreiber NICHT mehr über den pauschalen has_club_role-
-- Override in den owner/admin-Zweig fällt.
create or replace function app.can_read_rsvp_reason(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- 1. eigene Daten: die Person selbst und ihre Erziehungsberechtigten.
    --    BEWUSST ohne jede Rollen-/Faehigkeitsschranke — es sind ihre eigenen
    --    Daten (Art. 15). Ein Verein darf Eltern die Krankmeldung ihres Kindes
    --    nicht wegkonfigurieren.
    app.can_act_for_member(p_member_id)
    -- 2. wer den Verein verwaltet (Datenminimierung: OHNE moderator/treasurer)
    --    0075: club_role_held statt has_club_role -> kein Betreiber-Durchgriff.
    or app.club_role_held(p_club_id, array['owner', 'admin'])
    -- 3. wer das Team DIESES Mitglieds betreut. coached_team_ids = die Quelle
    --    aus 0025:169; club_role_held traegt den guest_coach-Ablauf.
    or (
      app.club_role_held(p_club_id, array['coach', 'guest_coach'])
      and exists (
        select 1
        from app.team_members tm
        where tm.member_id = p_member_id
          and tm.club_id   = p_club_id
          and tm.deleted_at is null
          and tm.team_id = any (app.coached_team_ids(p_club_id))
      )
    )
    -- 4. der Betreiber: nur mit freigegebener Faehigkeit. 'attendance' ist es
    --    nicht — eine Krankmeldung ist keine Betriebsinformation.
    or app.operator_may('attendance')
$$;

comment on function app.can_read_rsvp_reason(uuid, uuid) is
  'Darf der Absage-GRUND (0040, faktisch eine Krankmeldung) gelesen werden? Familie immer; owner/admin; die betreuende Trainerin. Seit 0075 fuer den Betreiber zweckgebunden auf app.operator_may(''attendance'') — heute gesperrt.';

-- RUECKRUFNUMMER DER FAHRGEMEINSCHAFT (0066). Eine Telefonnummer, oft die der
-- Eltern eines mitfahrenden Kindes. Vereinsseite wortgleich; der Betreiber
-- verliert BEIDE Wege (den eigenen is_platform_admin-Zweig UND den
-- Durchgriff ueber has_club_role).
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

        -- (c) Verwaltung / Aufsichtspflicht (0075: club_role_held)
        or app.club_role_held(r.club_id, array['owner', 'admin', 'moderator', 'treasurer'])
        -- (d) Betreiber — zweckgebunden. 'member_contact' ist gesperrt.
        or app.operator_may('member_contact')
      )
  )
$$;

comment on function app.may_see_ride_contact(uuid) is
  'Darf die/der Aufrufende die Rueckrufnummer DIESER Fahrt sehen? Fahrer, aktive Zusagen (inkl. Erziehungsberechtigte), Verwaltung. Seit 0075 fuer den Betreiber zweckgebunden auf app.operator_may(''member_contact'') — heute gesperrt: eine Telefonnummer ist kein Betriebsdatum.';

-- SCHLIESSFACH-VERMIETUNG: die SECURITY-DEFINER-Meldung an der RLS vorbei.
--
-- Die Funktion war als reine Ja/Nein-Warnung gedacht („eine aktive Vermietung
-- wird nicht automatisch beendet"). Sie meldet aber SECURITY DEFINER an
-- locker_rentals_select vorbei — und damit war die Vermietung eines Fachs auch
-- für jemanden ablesbar, dem 0074 die Miettabelle gerade verschlossen hat.
-- Zusammen mit lockers_select (unten) war das der zweite Baustein von „welches
-- Kind mietet welches Fach": Mieter und Preis aus app.lockers, die Bestätigung
-- „läuft gerade" aus dieser Funktion.
--
-- Der Fix nimmt der Funktion NICHT ihre Aufgabe, sondern hängt sie an dieselbe
-- Sichtbarkeit wie das Fach selbst: wer das Fach sehen darf, darf auch wissen,
-- ob daran gerade eine Vermietung läuft. Für die Oberfläche ändert sich nichts
-- (sie ruft die Funktion aus einem Formular, das das Fach ohnehin anzeigt).
create or replace function app.locker_has_active_rental(p_locker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.locker_rentals r
    join app.lockers l on l.id = r.locker_id
    where r.locker_id = p_locker_id
      and r.status = 'aktiv'
      and r.deleted_at is null
      -- 0075: dieselbe Sichtbarkeit wie lockers_select. Ohne diese Zeile
      -- meldete die Funktion an der RLS vorbei.
      and (
        app.has_cap(l.club_id, 'lockers', 'read_all')
        or (
          app.cap_rank(l.club_id, 'lockers') >= app.level_rank('read_own')
          and l.assigned_member_id = app.own_member_id(l.club_id)
        )
        or app.operator_may('lockers')
      )
  )
$$;

comment on function app.locker_has_active_rental(uuid) is
  'Laeuft an diesem Fach gerade eine Vermietung? Gibt weiterhin NUR ein boolean zurueck — kein Mieter, kein Preis. Seit 0075 an dieselbe Sichtbarkeit gebunden wie das Fach selbst (lockers_select): SECURITY DEFINER darf nicht an der RLS vorbei melden, sonst ist die Vermietung eines Kindes ueber die Warnung rekonstruierbar.';

-- ----------------------------------------------------------------------------
-- 5. „Betreut die Person dieses Team/Mitglied?" ist eine TATSACHE, keine Befugnis.
--
--    coaches_member / coaches_member_bound fragten ueber has_club_role — und
--    damit galt der eingeschaltete Betreiber dort als Trainer JEDES Teams.
--    Heute rettet nur der zweite Teil des Praedikats (coached_team_ids ist fuer
--    ihn leer, weil er in keinem Team steht). Das ist ein Zufall der Datenlage,
--    keine Zusage — und genau die Sorte Zufall, die eine spaetere Migration
--    kippt. club_role_held stellt es richtig: der Betreiber IST kein Trainer.
-- ----------------------------------------------------------------------------
create or replace function app.coaches_member(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.club_role_held(p_club_id, array['coach', 'guest_coach'])
     and exists (
       select 1
       from app.team_members tm
       where tm.member_id = p_member_id
         and tm.club_id   = p_club_id
         and tm.deleted_at is null
         and tm.team_id = any (app.coached_team_ids(p_club_id))
     )
$$;

create or replace function app.coaches_member_bound(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.club_role_held(p_club_id, array['coach'])
     and exists (
       select 1
       from app.team_members tm
       where tm.member_id = p_member_id
         and tm.club_id   = p_club_id
         and tm.deleted_at is null
         and tm.team_id = any (app.coached_team_ids(p_club_id))
     )
$$;

comment on function app.coaches_member(uuid, uuid) is
  'Betreut die aufrufende Person dieses Mitglied (Team-Schnitt)? Seit 0075 ueber app.club_role_held statt app.has_club_role: eine TATSACHE ueber die Vereinsrolle, die kein Betreiber-Override erfinden darf.';
comment on function app.coaches_member_bound(uuid, uuid) is
  'Wie app.coaches_member, aber NUR die feste Trainerin (ohne guest_coach) — Grundlage der Trainer-Notiz (0069). Seit 0075 ueber app.club_role_held.';

-- ----------------------------------------------------------------------------
-- 6. DIE POLICIES. Aufbau ueberall gleich:
--    Vereinsseite wortgleich (nur has_club_role/is_club_member -> die reine
--    Frage), plus EIN benannter Betreiber-Zweig.
-- ----------------------------------------------------------------------------

-- 6a. SCHLIESSFAECHER — die Tuer aus dem Befund (0026:54).
--     'lockers' ist NICHT freigegeben. Zusammen mit locker_has_active_rental
--     (oben) ist „welches Kind mietet welches Fach fuer wie viel" damit zu.
alter policy lockers_select on app.lockers
  using (
    app.has_cap(club_id, 'lockers', 'read_all')
    or (
      app.cap_rank(club_id, 'lockers') >= app.level_rank('read_own')
      and assigned_member_id = app.own_member_id(club_id)
    )
    -- 0075: war app.is_platform_admin() — ein unbedingter, protokoll-freier
    -- Generalschluessel auf 8 Faecher inkl. Mieter:in und Preis.
    or app.operator_may('lockers')
  );

-- 6b. EINLADUNGEN (0065:151). Eine Einladung IST eine E-Mail-Adresse.
--     0074 hat 'member_contact' mit genau dieser Begruendung gesperrt
--     („Fuer den Support nicht noetig: die E-Mail steht in /platform/users").
alter policy invitations_select on app.invitations
  using (
    app.club_role_held(club_id, array['owner', 'admin', 'moderator', 'treasurer'])
    or app.operator_may('member_contact')
  );

-- 6c. VORMUNDSCHAFTEN (0007:264) — „welches Elternteil gehoert zu welchem Kind".
--     Vereinsseite: app.is_club_admin = owner/admin/moderator, wortgleich.
--     Der Betreiber fiel bisher ueber is_club_admin -> operator_may('club_settings')
--     hier hinein; die Familienzuordnung ist aber keine Vereinseinstellung.
alter policy guardianships_select on app.guardianships
  using (
    app.club_role_held(club_id, array['owner', 'admin', 'moderator'])
    or app.can_act_for_member(guardian_member_id)
    or app.can_act_for_member(child_member_id)
    or app.operator_may('member_contact')
  );

-- 6d. EINWILLIGUNGEN (0035/0056). Rechtsgeschaefte ueber ein Kind.
alter policy consents_select on app.consents
  using (
    granted_by_profile_id = auth.uid()
    or subject_profile_id = auth.uid()
    or exists (
      select 1 from app.club_members m
      where m.id = consents.member_id and m.profile_id = auth.uid()
    )
    or app.club_role_held(club_id, array['owner', 'admin', 'moderator', 'treasurer'])
    or app.operator_may('member_contact')
  );

-- 6e. CHECK-INS — „wer wann in der Halle war" (0074 nennt es beim Namen).
--     Vereinsseite wortgleich = app.is_club_trainer.
alter policy checkins_select on app.checkins
  using (
    app.is_own_member(member_id)
    or app.club_role_held(club_id, array['owner', 'admin', 'moderator', 'coach', 'guest_coach'])
    or app.operator_may('checkins')
  );

-- 6f. WARTELISTEN.
alter policy waitlists_select on app.waitlists
  using (
    app.is_own_member(member_id)
    or app.club_role_held(club_id, array['owner', 'admin', 'moderator', 'coach', 'guest_coach'])
    or app.operator_may('waitlists')
  );

-- 6g. PFLICHTSTUNDEN-EINTRAEGE.
alter policy duty_entries_select on app.duty_entries
  using (
    app.is_own_member(member_id)
    or app.club_role_held(club_id, array['owner', 'admin', 'moderator', 'coach', 'guest_coach'])
    or app.operator_may('duty_hours')
  );

-- 6h. CHAT. Der DM-Zweig war nie offen (is_own_member); der TEAM-Kanal schon.
alter policy chat_messages_select on app.chat_messages
  using (
    case channel_type
      when 'team' then (
        app.is_team_member(team_id)
        or app.club_role_held(club_id, array['owner', 'admin', 'moderator', 'coach', 'guest_coach'])
        or app.operator_may('chat')
      )
      when 'direct' then (
        app.is_own_member(sender_member_id) or app.is_own_member(recipient_member_id)
      )
      else false
    end
  );

-- 6i. BEURTEILUNGEN (0055) — der volle Beurteilungstext ueber ein Kind.
--     Der Betreiber kam ueber app.can_manage_members hinein ('members' ist
--     freigegeben). Die Beurteilung ist aber dieselbe Datenklasse wie die
--     interne Notiz, die 0074 ausdruecklich gesperrt hat — also derselbe
--     Schluessel: 'coach_notes'.
alter policy member_assessments_select on app.member_assessments
  using (
    app.can_act_for_member(member_id)
    or app.club_role_held(club_id, array['owner', 'admin', 'moderator', 'treasurer'])
    or app.coaches_member(club_id, member_id)
    or app.operator_may('coach_notes')
  );

-- 6j. RUECKMELDUNGEN ZU TERMINEN (0040 haengt die Gesundheitsdaten daran).
alter policy event_rsvps_select on app.event_rsvps
  using (
    app.club_membership_held(club_id)
    or app.operator_may('events')
  );

-- 6k. MEDIEN / GALERIE / DOKUMENTE / FOTO-MARKIERUNGEN.
--     0074: „Inhalte des Vereins, oft mit Kinderfotos." Alle vier Faehigkeiten
--     sind gesperrt. Vereinsseite jeweils wortgleich.
alter policy media_assets_select on app.media_assets
  using (
    app.club_membership_held(club_id)
    or app.operator_may('media')
  );

alter policy gallery_items_select on app.gallery_items
  using (
    (app.club_membership_held(club_id) or app.operator_may('gallery'))
    and app.is_club_pro(club_id)
  );

alter policy documents_select on app.documents
  using (
    (app.club_membership_held(club_id) or app.operator_may('documents'))
    and app.is_club_pro(club_id)
  );

alter policy photo_tags_select on app.photo_tags
  using (
    app.operator_may('media')
    or (
      app.club_membership_held(club_id)
      and (
        app.club_role_held(club_id, array['owner', 'admin', 'moderator', 'coach', 'guest_coach'])
        or app.can_act_for_member(member_id)
        or app.has_internal_photo_consent(member_id)
      )
    )
  );

-- 6l. MODUL-SCHALTER. Keine personenbezogenen Daten, 'club_settings' ist
--     freigegeben -> Ergebnis unveraendert, nur ohne den protokoll-freien Zweig.
alter policy club_modules_select on app.club_modules
  using (
    app.club_membership_held(club_id)
    or app.operator_may('club_settings')
  );

-- 6m. RICHTLINIEN-BESTAETIGUNGEN. Ebenfalls Betrieb ('club_settings').
alter policy policy_ack_select on app.policy_acknowledgements
  using (
    profile_id = auth.uid()
    or (club_id is not null and (
          app.club_role_held(club_id, array['owner', 'admin'])
          or app.operator_may('club_settings')
       ))
  );

-- ----------------------------------------------------------------------------
-- 6n. DIE ZWEITE RUNDE — gefunden durch eine VOLKSZÄHLUNG, nicht durch Nachdenken.
--
-- Nach den Türen oben wurde im Harness gezählt, was der eingeschaltete Betreiber
-- ÜBERHAUPT NOCH sieht: eine Schleife über alle RLS-Tabellen mit count(*).
-- Genau so sind diese acht aufgefallen — jede hängt an app.is_club_member, jede
-- trägt eine member_id, und keine war in der ersten Runde auf dem Zettel.
-- (Der Zählschleifen-Test steht als 99q_*.sql in der Suite; er ist der Grund,
-- warum die NÄCHSTE solche Tabelle nicht wieder erst einem Angreifer auffällt.)
--
-- Der Maßstab war überall derselbe: sagt die Zeile etwas über eine BESTIMMTE
-- Person aus, das über „ist Mitglied und hat Rolle X" hinausgeht? Dann bekommt
-- sie den Zweck ihres Moduls — und der ist in 0074 durchweg gesperrt.
-- Reine Vereinsstruktur (Teams, Sparten, Termine, Übungen, Material, Anlagen,
-- Rollen-Matrix, Modulschalter) bleibt bewusst offen: sie ist der Gegenstand des
-- Supports und sagt über niemanden etwas aus.
-- ----------------------------------------------------------------------------

-- Wer welchen Erfolg errungen hat.
alter policy achievements_select on app.achievements
  using (app.club_membership_held(club_id) or app.operator_may('achievements'));

-- Wer bei welchem Wettkampf gestartet ist.
alter policy competition_entries_select on app.competition_entries
  using (app.club_membership_held(club_id) or app.operator_may('competitions'));

-- Wer welches Material reserviert hat.
alter policy equipment_reservations_select on app.equipment_reservations
  using (app.club_membership_held(club_id) or app.operator_may('equipment_reservations'));

-- Wer welche Halle wann gebucht hat.
alter policy facility_bookings_select on app.facility_bookings
  using (app.club_membership_held(club_id) or app.operator_may('facilities_booking'));

-- Wer mit wem im Auto sitzt (die Nummer selbst haengt an may_see_ride_contact).
alter policy event_ride_riders_select on app.event_ride_riders
  using (
    (app.club_membership_held(club_id) or app.operator_may('events'))
    and exists (
      select 1 from app.event_rides r
      where r.id = event_ride_riders.ride_id
        and r.deleted_at is null
        and app.can_read_event(r.event_id)
    )
  );

-- Wer eine Mitfahrgelegenheit anbietet (driver_member_id).
alter policy event_rides_select on app.event_rides
  using (app.club_membership_held(club_id) or app.operator_may('events'));

-- Welche FAMILIE einen Beitragsnachlass bekommt — eine Finanzaussage.
alter policy family_discounts_select on app.family_discounts
  using (app.club_membership_held(club_id) or app.operator_may('finance'));

-- Wem welche Aufgabe zugewiesen ist.
alter policy tasks_select on app.tasks
  using (app.club_membership_held(club_id) or app.operator_may('tasks'));

-- Welches Mitglied wie viele Pflichtstunden schuldet (member_id-Spalte!).
alter policy duty_requirements_select on app.duty_requirements
  using (app.club_membership_held(club_id) or app.operator_may('duty_hours'));

-- BEITRITTSCODE. Kein Personenbezug, aber ein Geheimnis des Vereins: der Code
-- laesst beitreten. 'club_settings' ist freigegeben -> Ergebnis unveraendert;
-- neu ist nur, dass der pauschale has_club_role-Durchgriff wegfaellt und der
-- Zugriff am Protokoll haengt.
create or replace function app.can_read_join_code(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.club_role_held(p_club_id, array['owner', 'admin', 'moderator'])
      or app.operator_may('club_settings')
$$;

comment on function app.can_read_join_code(uuid) is
  'Darf der Beitrittscode des Vereins gelesen werden? Vereinsseite owner/admin/moderator (unveraendert). Seit 0075 haengt der Betreiber-Zweig an app.operator_may(''club_settings'') statt am pauschalen has_club_role-Durchgriff.';

-- ----------------------------------------------------------------------------
-- 7. NACHRECHNUNG statt Behauptung (Muster: 0074 Abschnitt 9 / 0070 / 0033).
--    Was oben zugesichert wird, wird hier gemessen — sonst ist es ein Kommentar
--    und keine Eigenschaft.
-- ----------------------------------------------------------------------------
do $$
declare
  v_left text;
begin
  -- (a) KEINE Policy und KEINE Funktion fragt mehr app.is_platform_admin(),
  --     ausser den namentlich zugelassenen Ausnahmen (Protokoll + Support +
  --     die Definition selbst + app.operator_override, die den Claim ja
  --     auswerten MUSS).
  select string_agg(x, ', ' order by x) into v_left from (
    select tablename || '.' || policyname as x
    from pg_catalog.pg_policies
    where schemaname = 'app'
      and (coalesce(qual, '') like '%is_platform_admin%'
        or coalesce(with_check, '') like '%is_platform_admin%')
      and tablename not in ('operator_audit_log', 'support_tickets', 'support_messages')
  ) s;
  if v_left is not null then
    raise exception '0075: diese Policies fragen weiterhin den blossen Plattform-Admin-Claim statt app.operator_may(): %', v_left;
  end if;

  select string_agg(p.proname, ', ' order by p.proname) into v_left
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app'
    and p.prokind = 'f'
    and p.prosrc like '%is_platform_admin%'
    and p.proname not in ('is_platform_admin', 'operator_override', 'support_guard_message');
  if v_left is not null then
    raise exception '0075: diese Funktionen fragen weiterhin den blossen Plattform-Admin-Claim statt app.operator_may(): %', v_left;
  end if;

  -- (b) Die Zweckbindung haengt an der Allowlist und nicht an einem Tippfehler:
  --     jeder Faehigkeitsschluessel, den die neuen Zweige nennen, muss es im
  --     Katalog wirklich geben. Ein vertippter Schluessel waere sonst eine
  --     stille Dauer-Sperre, die niemand mehr oeffnen kann.
  select string_agg(k, ', ' order by k) into v_left
  from unnest(array['members','routines','departments','club_settings','lockers',
                    'member_contact','checkins','waitlists','duty_hours','chat',
                    'coach_notes','events','media','gallery','documents','attendance',
                    'achievements','competitions','equipment_reservations',
                    'facilities_booking','finance','tasks']) as k
  where not exists (select 1 from app.capabilities c where c.key = k);
  if v_left is not null then
    raise exception '0075: unbekannte Faehigkeitsschluessel in den Betreiber-Zweigen: %', v_left;
  end if;

  -- (c) Und die gesperrten sind wirklich gesperrt.
  select string_agg(k, ', ' order by k) into v_left
  from unnest(array['lockers','member_contact','checkins','waitlists','duty_hours',
                    'chat','coach_notes','events','media','gallery','documents','attendance',
                    'achievements','competitions','equipment_reservations',
                    'facilities_booking','finance','tasks']) as k
  where exists (select 1 from app.operator_capabilities oc where oc.capability_key = k);
  if v_left is not null then
    raise exception '0075: diese Faehigkeiten duerfen NICHT auf der Betreiber-Allowlist stehen: %', v_left;
  end if;
end;
$$;

commit;
