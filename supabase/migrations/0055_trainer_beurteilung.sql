-- ============================================================================
-- 0055_trainer_beurteilung.sql — Trainer:innen-Beurteilung eines/einer (oft
-- MINDERJÄHRIGEN) Sportler:in. Ganz neue Tabelle; das gab es bisher NICHT
-- (0 Treffer auf "assessment"/"beurteilung" in 0001–0053).
--
-- ############################################################################
-- ### WAS GESPEICHERT WIRD — Freitext + zwei strukturierte Noten           ###
-- ############################################################################
-- Der Nutzer liess offen "strukturiert + Freitext ODER nur Freitext — halt es
-- nutzbar". Entschieden: BEIDES. Der Freitext (body) ist die eigentliche
-- Einschätzung und Pflicht; dazu zwei OPTIONALE Noten 1–5, die im
-- Rollkunstlauf die zwei Wertungssäulen sind, an denen auch das Kampfgericht
-- misst — Technik (Sprünge/Pirouetten/Schritte) und Ausdruck/Präsentation.
-- Optional, weil eine kurze verbale Rückmeldung ("schöner Fortschritt beim
-- Flip") nicht zu einer Benotung gezwungen werden soll. Mehr Achsen zu
-- erfinden wäre Ausdenken ohne Auftrag; zwei decken die Referenzwertung ab.
--
-- ############################################################################
-- ### WER DARF WAS — Marcels Vorgabe (2026-07-17), 1:1 auf Hausfunktionen  ###
-- ############################################################################
--
-- SCHREIBEN  (POST):  Trainer:in DES TEAMS der beurteilten Person + Vorstand.
--   * Trainer-Pfad = app.coaches_member (unten): has_club_role(coach/guest_coach)
--     UND die Person ist Mitglied eines Teams, das die/der Aufrufer:in als
--     coach führt (app.coached_team_ids, Quelle team_members.role='coach' aus
--     0025). Ein FREMDER Trainer, der die Person NICHT betreut, fällt hier
--     durch — genau die Vorgabe "schreibt NICHT".
--   * Vorstand = app.is_club_admin = owner/admin/moderator (0007). Der
--     Kassenwart (treasurer) schreibt AUSDRÜCKLICH NICHT: eine pädagogische
--     Beurteilung ist keine Kassensache. Datenminimierung wie 0040 (dort
--     owner/admin für den Schreib-/Autoritätspfad).
--
-- LESEN  (GET):  Staff + die FAMILIE.
--   * FAMILIE = app.can_act_for_member (0002:192): die Person selbst
--     (profile_id = auth.uid()) UND ihre Erziehungsberechtigten. OHNE jede
--     Rollen-/Fähigkeitsschranke — es sind ihre eigenen Daten bzw. das
--     Auskunftsrecht der Eltern über ihr Kind (Art. 15). Sie sieht AUSSCHLIESS-
--     LICH die Beurteilungen ÜBER SICH bzw. über das eigene Kind — nie fremde.
--   * STAFF-ALLE = app.can_manage_members = owner/admin/moderator/TREASURER
--     (0007). Diese vier lesen ALLE Beurteilungen des Vereins.
--       WARUM treasurer/moderator ALLE und nicht "nur ihre Teams": sie HABEN
--       keine Teamzuordnung (coached_team_ids ist für sie leer). Eine
--       team-begrenzte Regel gäbe ihnen NICHTS und widerspräche der aus-
--       drücklichen Vorgabe, dass "Kasse/Moderator" zur lesenden Staff zählen.
--       Ihr legitimer Grund ist Auskunft/Vorstandsarbeit — und die ist
--       vereinsweit, nicht teamgebunden. (Der treasurer LIEST nur; schreiben/
--       ändern/löschen darf er nichts, s.o.)
--   * TRAINER-TEAM = app.coaches_member: coach/guest_coach lesen NUR die
--     Beurteilungen der Mitglieder ihrer betreuten Teams. Ein Trainer sieht
--     also die fremder Teams NICHT.
--   Ein NORMALES Mitglied (weder Staff noch Familie) sieht KEINE fremde
--   Beurteilung — das ist der Zweck, kein Mangel (Klarnamen von Kindern).
--
-- ÄNDERN/LÖSCHEN (PATCH/DELETE): nur der/die AUTOR:IN oder der Vorstand
--   (is_club_admin). Der treasurer NICHT (er las nur). Löschen ist SOFT
--   (deleted_at) über die UPDATE-Policy — es gibt bewusst KEINE DELETE-Policy
--   (deny-by-default), wie im Rest des Systems (DSGVO Art. 17 läuft über den
--   Service-Mode).
--
-- Kein Bypass über app.is_club_member: der trägt seit 0025 den platform-admin-
-- Zweig und ist zu weit (jedes Mitglied). Die Sichtbarkeit hängt allein an den
-- drei benannten Funktionen.
--
-- KEINE neue Fähigkeit in app.capabilities: 93j_capability_enforcement.sql:37
-- nagelt den Katalog auf eine EXAKTE Zahl fest — ein neuer Eintrag färbte den
-- Bestands-Test rot (der nicht angefasst wird). Die Rechte hier sind ohnehin
-- rollen-/beziehungsbasiert (Team-Betreuung, Erziehungsberechtigung), nicht
-- als Stufen-Skala je Fähigkeit ausdrückbar — dasselbe Muster wie 0040/0052.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- app.coaches_member — betreut die/der Aufrufer:in das Team DIESES Mitglieds?
--   Muster wörtlich aus 0040 (can_read_rsvp_reason, Zweig 3). SECURITY
--   DEFINER: der Blick in team_members ist RLS-frei, sonst hinge die
--   Sichtbarkeit an der ihrer eigenen Hilfstabellen.
--   has_club_role(['coach','guest_coach']) trägt den guest_coach-Ablauf
--   (0002); coached_team_ids ist die kanonische Quelle "meine Teams"
--   (role='coach' in team_members) — dieselbe, an der die Kür-Sichtbarkeit
--   hängt (0025/0026). Damit ist "team_members role=coach im selben Team" aus
--   der Vorgabe exakt getroffen.
-- ----------------------------------------------------------------------------
create or replace function app.coaches_member(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_club_role(p_club_id, array['coach', 'guest_coach'])
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
  'Betreut die aufrufende Person (als coach/guest_coach) ein Team, dem p_member_id angehört? Quelle der Teams: app.coached_team_ids (team_members.role=coach, 0025). Trägt den guest_coach-Ablauf über has_club_role. Genutzt von der Beurteilungs-RLS (0055) für Schreib- und Team-Lesepfad.';

-- ----------------------------------------------------------------------------
-- app.member_assessments — eine schriftliche Einschätzung über EINE Person.
-- ----------------------------------------------------------------------------
create table app.member_assessments (
  id                uuid primary key default app.uuid_v7(),
  club_id           uuid not null references app.clubs (id) on delete restrict,
  -- Der/die Beurteilte.
  member_id         uuid not null references app.club_members (id) on delete restrict,
  -- Der/die beurteilende Trainer:in (bzw. Vorstand). Immer eine Vereinsperson.
  author_member_id  uuid not null references app.club_members (id) on delete restrict,
  -- Die eigentliche Einschätzung (Pflicht, Längen-Check gegen leer/Roman).
  body              text not null,
  -- Optionale strukturierte Noten (1–5), die zwei Wertungssäulen im
  -- Rollkunstlauf. NULL = "keine Note vergeben", bewusst erlaubt.
  rating_technik    smallint,
  rating_ausdruck   smallint,
  assessed_on       date not null default current_date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint member_assessments_body_len
    check (char_length(btrim(body)) between 1 and 5000),
  constraint member_assessments_technik_range
    check (rating_technik is null or rating_technik between 1 and 5),
  constraint member_assessments_ausdruck_range
    check (rating_ausdruck is null or rating_ausdruck between 1 and 5),
  -- Man beurteilt nicht sich selbst.
  constraint member_assessments_not_self
    check (member_id <> author_member_id)
);

create index member_assessments_member_idx on app.member_assessments (club_id, member_id);
create index member_assessments_author_idx on app.member_assessments (club_id, author_member_id);

comment on table app.member_assessments is
  'Schriftliche Trainer:innen-Beurteilung über EIN (oft minderjähriges) Mitglied. Mandantengetrennt (club_id + RLS). Schreiben: Team-Trainer:in (app.coaches_member) + Vorstand (is_club_admin). Lesen: Staff (can_manage_members = auch treasurer) alles, coach/guest_coach ihre Teams, die Familie (can_act_for_member) ihre eigene. Ändern/Löschen: Autor:in oder Vorstand. Löschen ist SOFT (deleted_at).';
comment on column app.member_assessments.rating_technik is
  'Optionale Technik-Note 1–5 (Sprünge/Pirouetten/Schritte). NULL = keine Note. / Optional technique grade 1–5.';
comment on column app.member_assessments.rating_ausdruck is
  'Optionale Ausdrucks-/Präsentationsnote 1–5. NULL = keine Note. / Optional expression grade 1–5.';

create trigger member_assessments_set_updated_at
  before update on app.member_assessments
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- app.protect_member_assessment — club_id/member_id/author_member_id sind
-- unveränderlich. Ohne das könnte selbst ein berechtigter Editor (Autor oder
-- Vorstand, die die UPDATE-Policy passieren) eine Beurteilung nachträglich
-- einer ANDEREN Person oder einem anderen Verein zuschreiben — ein
-- Integritäts-, bei Kinderdaten auch ein Zuordnungsrisiko. Nur Rumpf (body),
-- Noten und assessed_on sind änderbar.
-- auth.uid() is null = Migration/Seed/service_role -> ungeprüft durch (die
-- Call-Site autorisiert dort selbst), wie app.support_guard_message (0052).
-- ----------------------------------------------------------------------------
create or replace function app.protect_member_assessment()
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
    raise exception 'member_assessments: club_id, member_id and author_member_id are immutable'
      using hint = 'Verein, beurteilte Person und Autor:in einer Beurteilung sind unveränderlich. / club, assessed member and author of an assessment are immutable.';
  end if;
  return new;
end;
$$;

comment on function app.protect_member_assessment() is
  'Friert club_id/member_id/author_member_id einer Beurteilung ein (nur body/Noten/assessed_on änderbar). auth.uid() is null (Seed/Service) bleibt ausgenommen.';

create trigger member_assessments_protect
  before update on app.member_assessments
  for each row execute function app.protect_member_assessment();

-- ----------------------------------------------------------------------------
-- RLS. Grants kommen aus 0001:43 (alter default privileges -> authenticated:
-- select/insert/update/delete). RLS ist der Zeilenfilter; ein fehlendes
-- DELETE-Policy = deny-by-default für hartes Löschen.
-- ----------------------------------------------------------------------------
alter table app.member_assessments enable row level security;

-- SELECT: Familie (eigene) · Staff/Vorstand+Kasse (alle) · Team-Trainer:in (Team).
create policy member_assessments_select on app.member_assessments
  for select to authenticated
  using (
    app.can_act_for_member(member_id)
    or app.can_manage_members(club_id)
    or app.coaches_member(club_id, member_id)
  );

-- INSERT: Team-Trainer:in der Person ODER Vorstand — UND die Autorenzeile ist
-- die EIGENE Mitgliedszeile (sonst schriebe man im Namen einer Kollegin).
create policy member_assessments_insert on app.member_assessments
  for insert to authenticated
  with check (
    (app.is_club_admin(club_id) or app.coaches_member(club_id, member_id))
    and exists (
      select 1 from app.club_members am
      where am.id = author_member_id
        and am.club_id = member_assessments.club_id
        and am.profile_id = auth.uid()
        and am.deleted_at is null
    )
  );

-- UPDATE (Ändern + Soft-Delete): nur der/die Autor:in oder der Vorstand.
--   using  = ALTE Zeile (darf ich diese anfassen?),
--   with check = NEUE Zeile (bleibt sie autorisiert?). Der Immutabilitäts-
--   Trigger hält club/member/author dabei fest, also kann der Vorstand die
--   Zeile nicht aus der eigenen Prüfmenge heraus umschreiben.
create policy member_assessments_update on app.member_assessments
  for update to authenticated
  using (
    app.is_club_admin(club_id)
    or exists (
      select 1 from app.club_members am
      where am.id = author_member_id
        and am.profile_id = auth.uid()
        and am.deleted_at is null
    )
  )
  with check (
    app.is_club_admin(club_id)
    or exists (
      select 1 from app.club_members am
      where am.id = author_member_id
        and am.profile_id = auth.uid()
        and am.deleted_at is null
    )
  );

-- Kein DELETE für irgendwen: deny-by-default. Löschen läuft über deleted_at.

commit;
