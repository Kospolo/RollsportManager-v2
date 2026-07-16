-- ============================================================================
-- 0052_support_tickets.sql — Support-Tickets: Verein <-> Betreiber.
--
-- Support-Tickets gab es bisher NICHT (0 Treffer in 0001–0034). Hier entsteht
-- das Datenmodell von Grund auf: ein Ticket je Anliegen, ein Verlauf aus
-- Nachrichten, streng je Mandant getrennt.
--
-- ############################################################################
-- ### WER IM VEREIN DARF EIN TICKET SEHEN/AUFMACHEN — UND WARUM KEINE      ###
-- ### EIGENE FÄHIGKEIT IN app.capabilities                                  ###
-- ############################################################################
--
-- Die Aufgabe liess beides zu ("Vorstand? eigene Fähigkeit in
-- app.capabilities?"). Der BESTAND entscheidet, und zwar gegen eine eigene
-- Fähigkeit — nachgerechnet, nicht vermutet:
--
--   (1) EINE NEUE FÄHIGKEIT SPRENGT EINEN BESTANDS-TEST.
--       93j_capability_enforcement.sql:37 nagelt den Katalog auf eine EXAKTE
--       Zahl:
--           is_eq('cap-enforcement: der Katalog hat 32 Faehigkeiten',
--                 (select count(*) from app.capabilities), 32);
--       und :46 nochmal 'unenforced' = 18. Ein 33. Eintrag faerbt beide rot.
--       Bestands-Tests werden nicht angefasst (Auftrag) — also keine neue
--       Fähigkeit.
--
--   (2) EINE VORHANDENE FÄHIGKEIT MITZUBENUTZEN IST GENAUSO GESPERRT.
--       Der naheliegende Griff wäre has_cap(club_id,'club_settings','manage')
--       — dieselbe Rollenmenge, kein neuer Katalogeintrag. Er fällt an
--       93j Abschnitt B: jede Fähigkeit, die in IRGENDEINER Policy vorkommt,
--       muss ein Etikett <> 'unenforced' tragen; 'club_settings' steht in
--       0033:217 ausdrücklich auf 'unenforced'. app.capability_policy_usage()
--       (0033:126-160) liest die Policy-Bodies per Regex und FINDET den
--       Aufruf — genau dafür ist der Detektor gebaut (93j Abschnitt D stellt
--       den Drift mit 'news' nach und verlangt, dass er auffliegt).
--       Dasselbe gilt für jede 'write_only'-Fähigkeit (93j Abschnitt C
--       verbietet ihnen eine SELECT-Policy) und für die 18 übrigen
--       'unenforced'.
--       Es bleiben nur 'routines'/'lockers'/'anniversaries'/'finance'/
--       'member_contact' — fachlich absurd für Support.
--
--   (3) DAS HAUS HAT FÜR GENAU DIESEN FALL EINE ANTWORT.
--       services/api/src/lib/capabilities.ts (requireClubRoleDb) schreibt sie
--       wörtlich auf: "Nur dort, wo es zur Rollenmenge KEINE passende
--       Fähigkeit gibt. [...] Eine Faehigkeit zu erfinden waere eine
--       Katalog-Erweiterung mit eigener Entscheidung - und eine beliebige
--       andere zu nehmen, die zufaellig dieselbe Rollenmenge trifft [...],
--       waere eine stille Bedeutungsverschiebung". /reports/summary ist der
--       Präzedenzfall (COACH_ROLES statt Fähigkeit).
--
-- ENTSCHIEDEN: app.is_club_admin(club_id) = owner/admin/moderator ("Vorstand").
-- Rollenbasiert wie die 18 Bereiche, an denen heute schon keine Fähigkeit
-- zieht. Ein EINFACHES MITGLIED sieht KEIN Ticket und kann keines aufmachen —
-- das ist der Zweck, nicht ein Mangel: ein Ticket enthält typischerweise
-- Klartext-Probleme mit Namen von KINDERN ("Anmeldung von X klemmt, Geburts-
-- datum falsch"). Der Kassenwart ist bewusst NICHT dabei (is_club_admin
-- schliesst treasurer aus, 0007:107-115) — wer Support schreibt, spricht für
-- den Verein.
-- Kein Bypass für app.is_club_member: der trägt seit 0025:85-94 den
-- platform-admin-Zweig, und er ist zu weit (jedes Mitglied).
--
-- ### DER BETREIBER ###
-- app.is_platform_admin() steht DIREKT in den Policies (0007:38-46) — nicht
-- app.cap_rank, das hat bewusst keinen Bypass (0025:219-222) und ist von
-- dieser Migration unabhängig.
--
-- ### KEIN MAILVERSAND ###
-- services/api/package.json hat keinen Mail-Client. Ein Ticket oder eine
-- Antwort BENACHRICHTIGT NIEMANDEN — wer nicht hinsieht, sieht nichts.
-- Angeflanscht werden kann es später an genau einer Stelle: dem Trigger
-- app.support_touch_ticket() unten, der jede neue Nachricht ohnehin schon
-- sieht. Bis dahin ist "benachrichtigt" eine Behauptung, die hier niemand
-- aufstellt.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Enums.
--   status   : offen / in Arbeit / wartet auf Rückmeldung / geschlossen
--   priority : niedrig / normal / hoch / dringend
--   actor    : wer geschrieben hat — Verein oder Betreiber. Bewusst KEIN
--              Rückschluss aus der Rolle: der Betreiber hat gar keine
--              club_members-Zeile (seed.sql:74-84), und ein Vereinsvorstand
--              könnte theoretisch selbst Plattform-Admin sein.
-- ----------------------------------------------------------------------------
create type app.support_ticket_status   as enum ('open', 'in_progress', 'waiting_on_club', 'closed');
create type app.support_ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type app.support_actor           as enum ('club', 'platform');

comment on type app.support_ticket_status is
  'Bearbeitungsstand eines Support-Tickets: offen / in Arbeit / wartet auf Rückmeldung des Vereins / geschlossen.';
comment on type app.support_ticket_priority is
  'Dringlichkeit eines Support-Tickets. Setzt AUSSCHLIESSLICH der Betreiber (der Verein hält sonst alles für dringend).';
comment on type app.support_actor is
  'Seite, von der eine Support-Nachricht stammt: Verein (club) oder Betreiber (platform).';

-- ----------------------------------------------------------------------------
-- support_tickets — ein Anliegen EINES Vereins.
-- ----------------------------------------------------------------------------
create table app.support_tickets (
  id                   uuid primary key default app.uuid_v7(),
  club_id              uuid not null references app.clubs (id) on delete restrict,
  -- Wer es aufgemacht hat. Immer eine Vereinsperson: der Betreiber macht keine
  -- Tickets auf (er hat keine club_members-Zeile — das Modell sagt das damit).
  created_by_member_id uuid not null references app.club_members (id) on delete restrict,
  subject              text not null,
  status               app.support_ticket_status   not null default 'open',
  priority             app.support_ticket_priority not null default 'normal',
  -- Wer zuletzt geantwortet hat (Pflicht der Aufgabe). Gepflegt vom Trigger
  -- support_touch_ticket, nie von Hand — sonst driftet die Anzeige gegen den
  -- Verlauf. Beim Anlegen setzt sie die Eröffnungsnachricht auf 'club'.
  last_reply_at        timestamptz,
  last_reply_by        app.support_actor,
  closed_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  constraint support_tickets_subject_not_blank check (btrim(subject) <> ''),
  -- Ziel des zusammengesetzten FKs aus support_messages: er ist der Grund,
  -- warum eine Nachricht nicht an einem FREMDEN Ticket hängen kann (s.u.).
  constraint support_tickets_id_club_key unique (id, club_id)
);

create index support_tickets_club_idx        on app.support_tickets (club_id);
create index support_tickets_club_status_idx on app.support_tickets (club_id, status);
-- Die Betreiber-Warteschlange: quer über alle Mandanten, neueste Regung zuerst.
create index support_tickets_queue_idx
  on app.support_tickets (status, coalesce(last_reply_at, created_at) desc);

comment on table app.support_tickets is
  'Support-Anliegen EINES Vereins an den Betreiber. Mandantengetrennt (club_id + RLS). Sichtbar/anlegbar nur für den Vereinsvorstand (app.is_club_admin) und den Betreiber (app.is_platform_admin) — ein Ticket enthält Klartext-Probleme mit Namen von Mitgliedern, oft Kindern. Status/Priorität setzt ausschliesslich der Betreiber.';
comment on column app.support_tickets.last_reply_by is
  'Seite der letzten Nachricht (club/platform). Ausschliesslich vom Trigger app.support_touch_ticket() gepflegt.';

create trigger support_tickets_set_updated_at
  before update on app.support_tickets
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- support_messages — der Verlauf. ANHÄNGEND: kein UPDATE, kein DELETE (es gibt
-- schlicht keine Policy dafür — RLS ist deny-by-default). Ein Support-Verlauf,
-- den eine der beiden Seiten nachträglich umschreiben kann, ist als Beleg
-- wertlos; und der Betreiber-Zugriff auf Vereinsdaten lebt in diesem Produkt
-- von Nachweisbarkeit.
--
-- club_id ist bewusst DENORMALISIERT (statt nur über ticket_id zu joinen):
--   * die Policy bleibt ein Prädikat auf der eigenen Zeile — kein Sub-Select
--     auf support_tickets, dessen eigene RLS mitzieht,
--   * die Mandantentrennung ist damit auf JEDER Tabelle direkt prüfbar (die
--     Konvention, an der 10_tenant_isolation.sql alle Tenant-Tabellen misst).
-- Gegen Drift sichert der ZUSAMMENGESETZTE FK auf (id, club_id): eine
-- Nachricht mit fremdem ticket_id ODER falschem club_id ist nicht speicherbar
-- (23503), unabhängig von jeder Policy.
-- ----------------------------------------------------------------------------
create table app.support_messages (
  id                uuid primary key default app.uuid_v7(),
  ticket_id         uuid not null,
  club_id           uuid not null references app.clubs (id) on delete restrict,
  -- Wer geschrieben hat. profile_id (nicht member_id!), weil der Betreiber
  -- keine club_members-Zeile hat, sehr wohl aber ein Profil
  -- (seed.sql:83-84 'RSM Plattform-Admin').
  author_profile_id uuid not null references app.profiles (id) on delete restrict,
  author_kind       app.support_actor not null,
  body              text not null,
  created_at        timestamptz not null default now(),
  constraint support_messages_body_not_blank check (btrim(body) <> ''),
  constraint support_messages_ticket_fk
    foreign key (ticket_id, club_id)
    references app.support_tickets (id, club_id) on delete cascade
);

create index support_messages_ticket_idx on app.support_messages (ticket_id, created_at);
create index support_messages_club_idx   on app.support_messages (club_id);

comment on table app.support_messages is
  'Verlauf eines Support-Tickets, ANHÄNGEND (keine UPDATE-/DELETE-Policy — RLS ist deny-by-default). Sichtbarkeit = die des Tickets. club_id ist denormalisiert; der zusammengesetzte FK (ticket_id, club_id) verhindert eine Nachricht an einem fremden Ticket.';
comment on column app.support_messages.author_kind is
  'Seite der Nachricht. Vom Trigger app.support_guard_message() gegen die Wirklichkeit geprüft — ein Verein kann sich nicht als Betreiber ausgeben.';

-- ----------------------------------------------------------------------------
-- app.support_guard_message — author_kind ist eine BEHAUPTUNG des Aufrufers.
-- Ohne diesen Trigger könnte ein Vereinsvorstand eine Nachricht mit
-- author_kind='platform' einstellen, die im UI aussieht wie eine Antwort des
-- Betreibers ("Ihr Anliegen ist erledigt" — vom Verein selbst geschrieben).
-- Die Policy kann das nicht: sie darf 'platform' nicht pauschal verbieten (der
-- Betreiber braucht es) und nicht pauschal erlauben (der Verein darf es nicht).
--
-- auth.uid() is null = Migration/Seed/service_role -> ungeprüft durch, wie
-- app.protect_member_roles (0024) und app.protect_club_membership (0007): die
-- Call-Site autorisiert dort selbst.
-- ----------------------------------------------------------------------------
create or replace function app.support_guard_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Die Nachricht gehört der schreibenden Person. Ohne diese Zeile könnte
  -- jemand im Namen einer Vereinskollegin schreiben.
  if new.author_profile_id <> auth.uid() then
    raise exception 'support: messages are always written in your own name'
      using hint = 'author_profile_id muss die eigene Profil-ID sein. / author_profile_id must be your own profile id.';
  end if;

  if new.author_kind = 'platform' and not app.is_platform_admin() then
    raise exception 'support: only the platform operator may post as "platform"'
      using hint = 'author_kind="platform" ist dem Betreiber vorbehalten. / author_kind="platform" is reserved for the operator.';
  end if;

  -- Und die Gegenrichtung: der Betreiber hat keine Vereinsmitgliedschaft, er
  -- kann also nicht "als Verein" antworten. Ohne diese Zeile könnte er einen
  -- Verein Dinge sagen lassen, die dieser nie gesagt hat — in einem Verlauf,
  -- der als Nachweis dient, ist das der schlimmere der beiden Fälle.
  if new.author_kind = 'club' and not app.is_club_admin(new.club_id) then
    raise exception 'support: only club board members may post as "club"'
      using hint = 'author_kind="club" erfordert Vorstandsrechte im Verein. / author_kind="club" requires club board rights.';
  end if;

  return new;
end;
$$;

comment on function app.support_guard_message() is
  'Prüft die BEHAUPTUNG author_kind/author_profile_id gegen die Wirklichkeit: im eigenen Namen; "platform" nur für app.is_platform_admin(); "club" nur für app.is_club_admin(). Ohne den Trigger könnte eine Seite die andere sprechen lassen.';

create trigger support_messages_guard
  before insert on app.support_messages
  for each row execute function app.support_guard_message();

-- ----------------------------------------------------------------------------
-- app.support_touch_ticket — pflegt "wer hat zuletzt geantwortet" am Ticket.
--
-- SECURITY DEFINER, weil das UPDATE sonst an der eigenen Policy scheitert:
-- support_tickets_update lässt NUR den Betreiber schreiben (Status/Priorität
-- sind seine Sache) — eine Vereinsnachricht könnte last_reply_* also nie
-- setzen. Der Trigger ist kein Schlupfloch: er schreibt ausschliesslich die
-- drei abgeleiteten Felder des Tickets, zu dem die Nachricht ohnehin gehört,
-- und die Nachricht selbst ist bereits durch Policy + support_guard_message
-- autorisiert.
--
-- DIE EINE STATUS-AUTOMATIK — und warum sie nötig ist: der Verein darf den
-- Status NICHT setzen (Betreiber-Vorbehalt). Antwortet er auf ein Ticket, das
-- auf 'waiting_on_club' steht, hätte er also keinerlei Möglichkeit, "ich habe
-- geantwortet" zu signalisieren — das Ticket bliebe in der Warteschlange des
-- Betreibers ewig als "wartet auf den Verein" stehen, obwohl der längst
-- geliefert hat. Genau diese eine Kante wird deshalb automatisch
-- zurückgedreht: waiting_on_club + Vereinsnachricht -> open. Sonst NICHTS:
-- kein Auto-Schliessen, kein Auto-Wiederöffnen eines geschlossenen Tickets.
-- ----------------------------------------------------------------------------
create or replace function app.support_touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app.support_tickets t
     set last_reply_at = new.created_at,
         last_reply_by = new.author_kind,
         status = case
                    when new.author_kind = 'club' and t.status = 'waiting_on_club'
                      then 'open'::app.support_ticket_status
                    else t.status
                  end
   where t.id = new.ticket_id;

  return null;
end;
$$;

comment on function app.support_touch_ticket() is
  'Schreibt last_reply_at/last_reply_by ans Ticket und dreht NUR die Kante waiting_on_club -> open zurück, wenn der Verein antwortet (er darf den Status nicht selbst setzen). SECURITY DEFINER, weil support_tickets_update dem Betreiber vorbehalten ist.';

create trigger support_messages_touch_ticket
  after insert on app.support_messages
  for each row execute function app.support_touch_ticket();

-- ----------------------------------------------------------------------------
-- app.support_sync_closed_at — closed_at folgt dem Status, nicht der Hand des
-- Aufrufers. Sonst stünde in der Liste "geschlossen" ohne Datum (oder ein
-- Datum ohne Schliessung).
-- ----------------------------------------------------------------------------
create or replace function app.support_sync_closed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_was_closed boolean := false;
begin
  -- OLD getrennt abfragen, NICHT per OR-Kurzschluss: in einem INSERT-Trigger
  -- ist OLD in PL/pgSQL nicht zugewiesen, ein Zugriff darauf wirft
  -- ("record old is not assigned yet") — und auf die Auswertungsreihenfolge
  -- von OR darf man sich dabei nicht verlassen.
  if tg_op = 'UPDATE' then
    v_was_closed := (old.status = 'closed');
  end if;

  if new.status = 'closed' and not v_was_closed then
    new.closed_at := now();
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

comment on function app.support_sync_closed_at() is
  'Hält support_tickets.closed_at am Status: gesetzt beim Übergang nach closed, geleert beim Wiederöffnen.';

create trigger support_tickets_sync_closed_at
  before insert or update of status on app.support_tickets
  for each row execute function app.support_sync_closed_at();

-- ----------------------------------------------------------------------------
-- RLS. Grants kommen aus 0001:43 (alter default privileges -> authenticated).
--
-- Die Sichtbarkeitsregel steht EINMAL und gilt für beide Tabellen:
--     app.is_platform_admin() or app.is_club_admin(club_id)
-- Kein has_cap/cap_rank irgendwo in diesen Policies — siehe Kopf (2):
-- app.capability_policy_usage() würde es finden und 93j faerben.
-- app.is_club_admin -> app.has_club_role -> app.member_role_keys enthält
-- keinerlei has_cap/cap_rank-Literal (geprüft), der Detektor schweigt also zu
-- Recht.
-- ----------------------------------------------------------------------------
alter table app.support_tickets  enable row level security;
alter table app.support_messages enable row level security;

-- SELECT: der Vorstand des EIGENEN Vereins — oder der Betreiber (alle).
create policy support_tickets_select on app.support_tickets
  for select to authenticated
  using (app.is_platform_admin() or app.is_club_admin(club_id));

-- INSERT: nur der Verein. Der Betreiber macht keine Tickets im Namen eines
-- Vereins auf — das wäre eine Aussage, die dem Verein zugeschrieben würde.
-- created_by_member_id muss die EIGENE Mitgliedszeile sein: sonst könnte ein
-- Vorstand das Ticket einer Kollegin unterschieben.
create policy support_tickets_insert on app.support_tickets
  for insert to authenticated
  with check (
    app.is_club_admin(club_id)
    and exists (
      select 1 from app.club_members m
      where m.id = created_by_member_id
        and m.club_id = support_tickets.club_id
        and m.profile_id = auth.uid()
    )
  );

-- UPDATE: NUR der Betreiber (Status/Priorität sind seine Warteschlange).
-- Der Verein wirkt über Nachrichten — und über die eine Automatik im Trigger.
create policy support_tickets_update on app.support_tickets
  for update to authenticated
  using (app.is_platform_admin())
  with check (app.is_platform_admin());

-- Kein DELETE für irgendwen: deny-by-default. Löschen (DSGVO Art. 17) läuft
-- über deleted_at im Service-Mode, wie im Rest des Systems.

create policy support_messages_select on app.support_messages
  for select to authenticated
  using (app.is_platform_admin() or app.is_club_admin(club_id));

-- INSERT: beide Seiten dürfen antworten. WELCHE Seite jemand ist, prüft nicht
-- die Policy, sondern app.support_guard_message() (author_kind gegen die
-- Wirklichkeit) — die Policy klärt nur den Zugang zum Mandanten.
create policy support_messages_insert on app.support_messages
  for insert to authenticated
  with check (app.is_platform_admin() or app.is_club_admin(club_id));

-- Kein UPDATE, kein DELETE: der Verlauf ist anhängend (s. Tabellenkommentar).

commit;
