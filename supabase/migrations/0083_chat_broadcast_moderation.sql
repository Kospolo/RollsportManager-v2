-- ============================================================================
-- 0083_chat_broadcast_moderation.sql — Broadcast-Kanal + Moderations-Löschung
--
-- ### ZWEI ERWEITERUNGEN, EIN THEMA (Chat) ###
-- (A) BROADCAST: ein vereinsweiter Ansage-Kanal. Der Vorstand/die Verwaltung
--     schreibt, ALLE Vereinsmitglieder lesen (read-only). Kein Team, kein
--     Empfänger — die Nachricht gehört dem Verein.
-- (B) MODERATION: der Vereinsvorstand darf eine FREMDE Nachricht soft-löschen
--     (Ergänzung zum Meldesystem 0082). Bisher durfte das laut
--     chat_messages_update (0011:195-198) NUR der Absender.
--
-- ### WAS HIER BEWUSST NICHT PASSIERT: GRUPPENCHAT ###
-- Ein echter N-Personen-Gruppenchat hat im Schema keinen Anker (direct kennt
-- genau EINEN recipient, team hängt an app.teams). Er bräuchte eine eigene
-- Teilnehmer-Tabelle UND ein eigenes Kinderschutz-Design: ein 2-Personen-
-- „Gruppen"-Kanal darf nicht zur stillen Umgehung des DM-Guards (0043) werden.
-- Das ist ein eigener, sicherheitsgeprüfter Baustein — nicht hier.
--
-- ### KINDERSCHUTZ BLEIBT UNANGETASTET ###
-- Der direct-Zweig der INSERT-Policy (0043, app.chat_dm_allowed) wird WORTGLEICH
-- übernommen. Broadcast ist einseitig (nur Admin schreibt, kein 1:1) und club-
-- weit sichtbar — es entsteht kein unbeobachteter Erwachsener↔Kind-Kontakt.
--
-- ### MODERATION DARF LÖSCHEN, NICHT UMSCHREIBEN ###
-- Die UPDATE-Policy allein kann Spalten nicht einschränken — ein Admin könnte
-- sonst über UPDATE den FREMDEN Text (auch den eines Kindes, auch die Grundlage
-- eines Meldungs-Snapshots) verändern. Deshalb zusätzlich ein BEFORE-UPDATE-
-- Guard: wer nicht der Absender ist, darf ausschließlich deleted_at /
-- deleted_by_member_id setzen. Muster wie app.chat_report_guard_update (0082).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- (0) Audit-Spalte: wer hat moderativ gelöscht?
--     NULL = keine Moderation (Absender hat selbst gelöscht oder nicht gelöscht).
-- ----------------------------------------------------------------------------
alter table app.chat_messages
  add column deleted_by_member_id uuid references app.club_members (id) on delete set null;

comment on column app.chat_messages.deleted_by_member_id is
  'Moderation: die Admin-Mitgliedszeile, die diese fremde Nachricht soft-gelöscht hat. NULL, wenn der Absender selbst gelöscht hat (oder die Nachricht nicht gelöscht ist).';

-- ----------------------------------------------------------------------------
-- (1) channel_type um 'broadcast' erweitern (TEXT + CHECK, Batch-Konvention).
-- ----------------------------------------------------------------------------
alter table app.chat_messages drop constraint chat_messages_channel_check;
alter table app.chat_messages add constraint chat_messages_channel_check
  check (channel_type in ('team', 'direct', 'broadcast'));

-- ----------------------------------------------------------------------------
-- (2) Shape: broadcast ist vereinsweit — weder Team noch Empfänger.
-- ----------------------------------------------------------------------------
alter table app.chat_messages drop constraint chat_messages_shape_check;
alter table app.chat_messages add constraint chat_messages_shape_check check (
  (channel_type = 'team'      and team_id is not null and recipient_member_id is null)
  or
  (channel_type = 'direct'    and recipient_member_id is not null and team_id is null)
  or
  (channel_type = 'broadcast' and team_id is null and recipient_member_id is null)
);

-- ----------------------------------------------------------------------------
-- (3) SELECT: team/direct WORTGLEICH aus 0075 übernommen (Betreiber-Zweck-
--     bindung: reale Rolle ODER operator_may('chat') — NICHT is_club_trainer,
--     das würde den Betreiber-Override wieder öffnen). Neu: broadcast liest
--     jedes REALE Vereinsmitglied; der Betreiber nur mit Zweck 'chat'.
--     ACHTUNG: `alter policy` statt drop+create — sonst überschreibt man die
--     spätere Härtung (0075). Der else-false-Zweig bleibt.
-- ----------------------------------------------------------------------------
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
      when 'broadcast' then (
        app.club_membership_held(club_id) or app.operator_may('chat')
      )
      else false
    end
  );

-- ----------------------------------------------------------------------------
-- (4) INSERT: team/direct WORTGLEICH aus 0043 (Kinderschutz + Tenancy bleiben).
--     Neu: broadcast nur reale Vereins-Admins (owner/admin/moderator) —
--     club_role_held, nicht is_club_admin (dessen operator-Zweig 'club_settings'
--     wäre der falsche Schlüssel; der Betreiber postet ohnehin nicht, weil
--     is_own_member(sender) für ihn falsch ist).
-- ----------------------------------------------------------------------------
alter policy chat_messages_insert on app.chat_messages
  with check (
    app.is_own_member(sender_member_id)
    and exists (
      select 1 from app.club_members s
      where s.id = sender_member_id
        and s.club_id = chat_messages.club_id
        and s.deleted_at is null
    )
    and (
      (channel_type = 'team' and app.is_team_member(team_id))
      or
      (channel_type = 'direct'
        and exists (
          select 1 from app.club_members r
          where r.id = recipient_member_id
            and r.club_id = chat_messages.club_id
            and r.deleted_at is null
        )
        and app.chat_dm_allowed(sender_member_id, recipient_member_id)
      )
      or
      (channel_type = 'broadcast'
        and app.club_role_held(club_id, array['owner', 'admin', 'moderator']))
    )
  );

-- ----------------------------------------------------------------------------
-- (5) UPDATE: Absender ODER realer Vereins-Admin (Moderation). Bewusst
--     club_role_held(owner/admin/moderator), KEIN Betreiber-Zweig — Moderation
--     der Vereins-Chats ist Vereinssache. WAS sich ändern darf, sperrt der
--     Unveränderlichkeits-Guard (6): faktisch nur das Soft-Löschen.
-- ----------------------------------------------------------------------------
alter policy chat_messages_update on app.chat_messages
  using (
    app.is_own_member(sender_member_id)
    or app.club_role_held(club_id, array['owner', 'admin', 'moderator'])
  )
  with check (
    app.is_own_member(sender_member_id)
    or app.club_role_held(club_id, array['owner', 'admin', 'moderator'])
  );

-- ----------------------------------------------------------------------------
-- (6) UNVERÄNDERLICHKEITS-GUARD — für ALLE, nicht nur Moderatoren.
--
--     ### DER FUND, DER DIESEN GUARD SCHÄRFT (adversariale Prüfung) ###
--     Der Kinderschutz (0043 app.chat_dm_allowed), die Mandantentrennung
--     (Sender+Empfänger im selben Verein) und das Broadcast-Admin-Gate prüfen
--     nur beim INSERT. Ein früherer Entwurf nahm den ABSENDER vom Guard aus —
--     dann konnte er seine eigene, erlaubte Erwachsenen-DM per UPDATE auf ein
--     KIND umbiegen (recipient_member_id), in einen fremden Verein umhängen
--     (club_id) oder zur vereinsweiten Ansage machen (channel_type='broadcast')
--     und so alle INSERT-Schranken umgehen. Reproduziert gegen die Dev-DB.
--
--     Konsequenz: eine chat_messages-Zeile ist UNVERÄNDERLICH — die einzige
--     erlaubte Mutation ist das Soft-Löschen (deleted_at + deleted_by_member_id).
--     Das deckt sich mit dem Datenmodell (0011: „Edits are not modelled here;
--     create / list / delete only"). Der Guard gilt für Absender UND Admin.
-- ----------------------------------------------------------------------------
create or replace function app.chat_messages_immutable_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Inhalt, Kanal, Empfänger, Verein, Absender, Zeitstempel: unveränderlich.
  if new.club_id             is distinct from old.club_id
     or new.channel_type        is distinct from old.channel_type
     or new.team_id             is distinct from old.team_id
     or new.sender_member_id    is distinct from old.sender_member_id
     or new.recipient_member_id is distinct from old.recipient_member_id
     or new.body                is distinct from old.body
     or new.image_url           is distinct from old.image_url
     or new.created_at          is distinct from old.created_at then
    raise exception
      'Eine Chat-Nachricht ist unveraenderlich; erlaubt ist nur das Soft-Loeschen (chat_messages_immutable_guard).';
  end if;
  -- Soft-Delete ist eine Einbahnstrasse: kein Wiederherstellen (auch nicht durch
  -- einen Admin) — sonst liesse sich eine gemeldete/moderierte Nachricht heimlich
  -- reaktivieren.
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception
      'Eine geloeschte Nachricht kann nicht wiederhergestellt werden (chat_messages_immutable_guard).';
  end if;
  -- Wer löscht, trägt sich SELBST als Löschende:r ein (oder null). Kein Fälschen
  -- eines fremden Audit-Eintrags.
  if new.deleted_by_member_id is not null
     and not app.is_own_member(new.deleted_by_member_id) then
    raise exception
      'deleted_by_member_id muss die eigene Mitgliedszeile sein (chat_messages_immutable_guard).';
  end if;
  return new;
end;
$$;

comment on function app.chat_messages_immutable_guard() is
  'Kinderschutz/Integrität: eine chat_messages-Zeile ist unveraenderlich ausser beim Soft-Loeschen (deleted_at/deleted_by_member_id). Verhindert, dass der Absender seine Nachricht per UPDATE in einen anderen Kanal/Empfaenger/Verein ummorpht (Umgehung von 0043-Kinderschutz, Tenancy, Broadcast-Admin-Gate) und dass ein Admin eine geloeschte Nachricht wiederbelebt oder fremde deleted_by-Audits faelscht.';

create trigger chat_messages_immutable_guard
  before update on app.chat_messages
  for each row execute function app.chat_messages_immutable_guard();

commit;
