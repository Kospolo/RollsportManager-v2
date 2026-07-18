-- ============================================================================
-- 0065_einladungen.sql — Einladung per E-Mail: gezielter Gegenpol zum Vereinscode.
--
-- ZWEI WEGE HEREIN, ZWEI VERTRAUENSMODELLE.
-- Der Vereinscode (0034/0037) ist ein GETEILTES Geheimnis: er haengt am Aushang
-- und in der Eltern-WhatsApp, jeder der ihn kennt darf ihn einloesen. Deshalb
-- ist ein richtiger Code ein ANTRAG (status='pending'), den der Vorstand erst
-- freigibt — der Code allein oeffnet nur die Warteschlange.
--
-- Die Einladung ist das Gegenteil: der Vorstand tippt EINE Adresse und schickt
-- einen Einmal-Token nur DORTHIN. Wer den Token vorzeigt, ist genau die Person,
-- die eingeladen wurde — die Auswahl HAT bereits stattgefunden. Der Akt des
-- Einladens IST die Freigabe. Darum entsteht bei der Annahme sofort eine AKTIVE
-- Mitgliedschaft, nicht ein zweiter Antrag: den Vorstand ein zweites Mal
-- klicken zu lassen ("er hat doch schon eingeladen") waere Zeremonie ohne
-- Schutzgewinn. (Die Route setzt das um; das Schema traegt es nur.)
--
-- DER TOKEN LIEGT NIE IM KLARTEXT IN DER DATENBANK.
-- Gespeichert wird nur sein SHA-256 (token_hash). Ein Datenbankabzug enthaelt
-- damit keine gueltigen Annahme-Links — dieselbe Logik wie beim Passwort-Hash:
-- der Server prueft GLEICHHEIT (hash(vorgezeigter Token) = gespeicherter Hash),
-- er muss den Token nie zuruecklesen. Der Klartext existiert genau einmal, in
-- der Mail. Der Zufall kommt aus dem CSPRNG der API (node:crypto), 256 Bit —
-- Raten ist aussichtslos, eine Drosselung dafuer waere Zierde.
--
-- WARUM DIE ANNAHME NICHT UEBER RLS DES EINLADERS LAEUFT.
-- Die eingeladene Person ist NICHT can_manage_members — sie kann club_members
-- nicht selbst beschreiben (club_members_insert verlangt has_cap members:manage,
-- 0026). Und sie soll die Einladungszeile auch nicht sehen oder aendern duerfen
-- (das ist Vorstandssache). Die Annahme ist deshalb eine SECURITY-DEFINER-
-- Funktion (app.accept_invitation), die AUSSCHLIESSLICH bei gueltigem, nicht
-- abgelaufenem, nicht bereits benutztem Token wirkt und dann genau EINE
-- Mitgliedschaft fuer die aufrufende Person (auth.uid()) anlegt. Der Token ist
-- die Autorisierung, nicht die Rolle des Aufrufers — dasselbe Muster wie der
-- Service-Mode beim Code-Beitritt, nur hier als Funktion, damit die
-- Kenntnisnahme (terms/privacy) daneben unter der EIGENEN Identitaet der Person
-- laufen kann (policy_ack_insert verlangt profile_id = auth.uid()).
--
-- KINDER (Art. 8 DSGVO).
-- Dieser Pfad legt eine SELBST-Mitgliedschaft an: profile_id = auth.uid(), die
-- Person hat ein eigenes Konto und nimmt in EIGENEM Namen an. Er erhebt nur die
-- KENNTNISNAHME von terms/privacy — die ist alterslos (Vertrag/Art. 13, kein
-- Art.-8-Gate, siehe 0039). Es wird KEINE echte Einwilligung (photos_public
-- etc.) erklaert; die bleibt der Familien-/Einwilligungspfad, wo der Trigger
-- app.enforce_consent_art8 (0039) den Art.-8-Zwang unabhaengig von diesem Weg
-- erzwingt. Ein wirkliches KIND wird ueber den Familienpfad angelegt (Vormund
-- legt Kind + Guardianship an, family.ts) — nicht per E-Mail-Selbstannahme.
-- Der Einladungsweg ist fuer Menschen mit eigenem Konto (erwachsen / ab 16).
-- Das ist dieselbe Grenze wie beim Code-Beitritt und bewusst so gezogen.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Lebenslauf einer Einladung. 'expired' ist ein AUSGEWERTETER Zustand
-- (expires_at < now()) — die Route/Funktion dreht abgelaufene 'pending'-Zeilen
-- beim naechsten Anfassen auf 'expired', damit der Teil-Index unten (nur eine
-- OFFENE Einladung je Adresse) einer Neu-Einladung nicht ewig im Weg steht.
-- ----------------------------------------------------------------------------
create type app.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

comment on type app.invitation_status is
  'Zustand einer E-Mail-Einladung: pending (offen) / accepted (angenommen, Token verbraucht) / revoked (vom Vorstand zurueckgezogen) / expired (Ablauf ueberschritten).';

-- ----------------------------------------------------------------------------
-- app.invitations — eine gezielte Einladung EINER Adresse in EINEN Verein.
-- ----------------------------------------------------------------------------
create table app.invitations (
  id                     uuid primary key default app.uuid_v7(),
  club_id                uuid not null references app.clubs (id) on delete cascade,
  -- KLEINGESCHRIEBEN gespeichert (citext ist in diesem Stack nicht installiert,
  -- 0034 haelt es genauso). Der CHECK erzwingt die Normalform, damit der
  -- Teil-Index unten "eine offene Einladung je Adresse" zuverlaessig greift und
  -- 'A@x.de' nicht neben 'a@x.de' zur zweiten Einladung wird.
  email                  text not null,
  -- Zielrolle. owner ist NIE einladbar (assignableRoleSchema schliesst ihn aus,
  -- und protect_club_membership laesst eine owner-Zeile ohnehin nur von einem
  -- owner zu). guest_coach weist die Route ab (er braucht valid_until, das eine
  -- E-Mail-Einladung nicht traegt).
  target_role            app.club_member_role not null default 'member',
  -- NUR der Hash. Der Klartext-Token lebt ausschliesslich in der Mail.
  token_hash             text not null,
  status                 app.invitation_status not null default 'pending',
  -- Wer eingeladen hat. member_id fuer die Anzeige im Verein, profile_id als
  -- stabiler Bezug (das Mitglied kann spaeter geloescht werden -> set null).
  invited_by_member_id   uuid references app.club_members (id) on delete set null,
  invited_by_profile_id  uuid references app.profiles (id) on delete set null,
  -- Wer angenommen hat und welche Mitgliedszeile dabei entstand.
  accepted_by_profile_id uuid references app.profiles (id) on delete set null,
  accepted_member_id     uuid references app.club_members (id) on delete set null,
  expires_at             timestamptz not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  accepted_at            timestamptz,
  revoked_at             timestamptz,
  constraint invitations_email_not_blank check (btrim(email) <> ''),
  constraint invitations_email_is_lower  check (email = lower(email)),
  constraint invitations_token_hash_not_blank check (btrim(token_hash) <> '')
);

comment on table app.invitations is
  'Gezielte E-Mail-Einladung in einen Verein. Nur der SHA-256 des Einmal-Tokens wird gespeichert (token_hash) — der Klartext lebt ausschliesslich in der Mail. Sichtbar/anlegbar/widerrufbar nur fuer can_manage_members (has_cap members:manage) des Vereins; die ANNAHME laeuft nicht ueber RLS, sondern token-geprueft ueber app.accept_invitation (SECURITY DEFINER).';
comment on column app.invitations.token_hash is
  'SHA-256 (base64url) des CSPRNG-Tokens. NIE der Klartext — ein DB-Abzug enthaelt damit keine gueltigen Annahme-Links.';
comment on column app.invitations.target_role is
  'Rolle, die die Mitgliedschaft bei Annahme bekommt. owner ausgeschlossen; guest_coach von der Route abgewiesen (braucht valid_until).';

-- Der Token wird UEBER seinen Hash gefunden — global eindeutig (256 Bit
-- Entropie, eine Kollision ist astronomisch, der Index macht sie unmoeglich).
create unique index invitations_token_hash_uq on app.invitations (token_hash);

-- HOECHSTENS EINE OFFENE Einladung je (Verein, Adresse). Eine Neu-Einladung
-- derselben Adresse frischt die vorhandene 'pending'-Zeile auf (neuer Token,
-- neuer Ablauf), sie legt keine zweite an. 'accepted'/'revoked'/'expired'
-- blockieren nicht — man kann nach Ablauf erneut einladen.
create unique index invitations_open_pending_uq
  on app.invitations (club_id, email)
  where status = 'pending';

create index invitations_club_status_idx on app.invitations (club_id, status);

create trigger invitations_set_updated_at
  before update on app.invitations
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS. Grants: default privileges (0001:43) geben authenticated bereits
-- select/insert/update/delete — die Policies engen ein.
--
-- ### WARUM ROLLENBASIERT UND NICHT has_cap('members','manage') ###
-- Der naheliegende Griff waere die Faehigkeit, die club_members_insert (0026)
-- verlangt. Er ist aber genau in der SELECT-Policy VERBOTEN: 'members' ist im
-- Katalog als 'write_only' etikettiert (0033), und 93j Abschnitt C verbietet
-- jeder write_only-Faehigkeit eine SELECT-Policy — app.capability_policy_usage
-- liest die Policy-Rumpfe per Regex und faerbt den Verstoss rot. Das ist auch
-- inhaltlich richtig: 'members:manage' ist das Recht, den Roster zu SCHREIBEN,
-- nicht das Recht, die Einladungsliste (mit fremden E-Mail-Adressen) zu LESEN.
--
-- Deshalb rollenbasiert — dieselbe Wahl und derselbe Grund wie bei
-- support_tickets (0052): der VORSTAND/die Verwaltung = owner/admin/moderator/
-- treasurer (das ist app.MANAGE_MEMBER_ROLES der API, guards.ts). Ein einfaches
-- Mitglied oder Trainer sieht KEINE Einladungen. app.has_club_role loest die
-- Rollen seit 0025 aus der DB auf (member_role_keys, inkl. status-Gate) — nicht
-- aus dem Token; der frisch angelegte Inhaber wirkt also sofort. Kein has_cap/
-- cap_rank-Literal in irgendeiner dieser Policies -> der 93j-Detektor schweigt
-- zu Recht. Die Route spiegelt die Menge (requireClubRoleDb(MANAGE_MEMBER_ROLES)).
-- ----------------------------------------------------------------------------
alter table app.invitations enable row level security;

-- SELECT: der Vorstand/die Verwaltung des EIGENEN Vereins — oder der Betreiber.
create policy invitations_select on app.invitations
  for select to authenticated
  using (
    app.is_platform_admin()
    or app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'treasurer'])
  );

-- INSERT: nur der Vorstand/die Verwaltung. Die Route prueft zusaetzlich
-- canAssignRole (ein Kassenwart darf keine admin-Einladung verschicken).
create policy invitations_insert on app.invitations
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'treasurer']));

-- UPDATE: dieselbe Menge (Auffrischen bei Neu-Einladung, Widerruf). Die ANNAHME
-- laeuft NICHT hierueber, sondern ueber app.accept_invitation (SECURITY
-- DEFINER) — die eingeladene Person ist nicht Vorstand.
create policy invitations_update on app.invitations
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'treasurer']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'treasurer']));

-- Kein DELETE fuer irgendwen: deny-by-default. Aufraeumen abgelaufener Zeilen
-- ist Sache eines Service-Mode-/Wartungspfads (Art. 5 Abs. 1 lit. e), nicht des
-- Vereins-Clients.

-- ============================================================================
-- app.accept_invitation — die token-gepruefte Annahme.
--
-- SECURITY DEFINER, weil die eingeladene Person weder club_members beschreiben
-- (has_cap members:manage fehlt) noch die Einladungszeile sehen/aendern darf.
-- Die Autorisierung ist der TOKEN, nicht die Rolle des Aufrufers.
--
-- LAEUFT IM SERVICE-MODE (auth.uid() = null), genau wie der Code-Beitritt
-- (registration.ts POST /clubs/join): die eingeladene Person legt sich SELBST
-- eine Rolle an, und protect_member_roles (0024:184) verbietet die
-- Selbst-Rollenvergabe fuer JEDE Person mit auth.uid() — nur der service_role-
-- Pfad (auth.uid() is null, 0024:170) ist ausgenommen. Die Identitaet der
-- annehmenden Person kommt deshalb NICHT aus auth.uid(), sondern als Parameter
-- p_profile_id; die Route belegt ihn mit der VERIFIZIERTEN claims.sub (requireAuth
-- ist gelaufen). Dasselbe Muster wie recordAcknowledgements/recordConsents, die
-- ihre profileId ebenfalls im Service-Mode als Parameter bekommen.
--
-- WIRKT NUR bei: token_hash trifft, status='pending', expires_at in der
-- Zukunft, Verein nicht geloescht. Sonst 0 Zeilen -> die Route macht daraus die
-- immer gleiche 404 (kein Leck, ob Token unbekannt/abgelaufen/verbraucht war).
--
-- KEIN Umgehen der Wachen: der club_members-INSERT laeuft durch
-- protect_club_membership (0002) — der greift bei target_role<>'owner' und
-- auth.uid() is null anstandslos. Der Art.-8-Trigger sitzt auf app.consents,
-- nicht auf club_members; hier wird keine Einwilligung geschrieben.
-- ============================================================================
create or replace function app.accept_invitation(
  p_token_hash text,
  p_profile_id uuid,
  p_first_name text,
  p_last_name  text
)
returns table (club_id uuid, club_name text, member_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv     record;
  v_profile uuid := p_profile_id;
  v_member  uuid;
  v_existing uuid;
begin
  if v_profile is null then
    raise exception 'Annahme erfordert ein angemeldetes Konto.' using errcode = '42501';
  end if;

  -- Die EINE Bedingung, unter der ueberhaupt etwas passiert. FOR UPDATE sperrt
  -- die Zeile, damit zwei gleichzeitige Annahmen desselben Tokens sich nicht
  -- beide fuer gueltig halten — die zweite findet status<>'pending' vor.
  select i.id, i.club_id, i.email, i.target_role, c.name as club_name
    into v_inv
  from app.invitations i
  join app.clubs c on c.id = i.club_id and c.deleted_at is null
  where i.token_hash = p_token_hash
    and i.status = 'pending'
    and i.expires_at > now()
  for update of i;

  if not found then
    return;  -- 0 Zeilen -> die Route antwortet mit der neutralen 404.
  end if;

  -- Schon Mitglied dieses Vereins? Dann keine zweite Zeile (der Teil-Index
  -- club_members_club_profile_uq wuerde 23505 werfen). Den Token trotzdem
  -- verbrauchen und die bestehende Mitgliedschaft zurueckgeben — die Einladung
  -- hat ihr Ziel ja erreicht.
  select m.id into v_existing
  from app.club_members m
  where m.club_id = v_inv.club_id
    and m.profile_id = v_profile
    and m.deleted_at is null
  limit 1;

  if v_existing is not null then
    v_member := v_existing;
  else
    -- Die Mitgliedschaft entsteht AKTIV: der Vorstand hat gezielt eingeladen,
    -- der Token ist die Freigabe (siehe Dateikopf). role = target_role der
    -- Einladung. Kein RETURNING-Fallstrick hier: der definer (Tabellen-
    -- eigentuemer) darf jede Spalte lesen — aber wir brauchen ohnehin nur die
    -- frisch erzeugte id.
    insert into app.club_members (club_id, profile_id, first_name, last_name, role, status, joined_on)
    values (v_inv.club_id, v_profile, p_first_name, p_last_name, v_inv.target_role, 'active', current_date)
    returning id into v_member;
  end if;

  -- Token verbraucht. Ab jetzt ist die Zeile 'accepted' — ein zweiter Versuch
  -- findet sie nicht mehr als 'pending'.
  update app.invitations
     set status                 = 'accepted',
         accepted_at            = now(),
         accepted_by_profile_id = v_profile,
         accepted_member_id     = v_member
   where id = v_inv.id;

  club_id   := v_inv.club_id;
  club_name := v_inv.club_name;
  member_id := v_member;
  return next;
end;
$$;

comment on function app.accept_invitation(text, uuid, text, text) is
  'Token-gepruefte Annahme einer Einladung. SECURITY DEFINER, aufgerufen im Service-Mode (auth.uid() null, wie der Code-Beitritt): p_profile_id ist die VERIFIZIERTE claims.sub der annehmenden Person. Wirkt NUR bei gueltigem, nicht abgelaufenem, nicht verbrauchtem Token und legt genau EINE aktive Mitgliedschaft an (oder gibt eine bestehende zurueck). Verbraucht den Token (status=accepted). 0 Zeilen bei ungueltigem Token -> die Route antwortet neutral 404.';

-- Aufgerufen von der Route im Service-Mode; service_role darf ausfuehren.
grant execute on function app.accept_invitation(text, uuid, text, text) to service_role;

commit;
