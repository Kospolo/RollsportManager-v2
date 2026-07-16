-- ============================================================================
-- 0043_chat_dm_guard.sql — Wer darf WEN direkt anschreiben?
--
-- ### DER ANLASS ###
-- "Neue Nachricht an ..." (Empfaengerauswahl) hat bis jetzt gefehlt: /chat/
-- channels liefert nur BESTEHENDE Faeden. Sobald man die Auswahl baut, wird die
-- bisher nur theoretische Frage praktisch — die Liste ist eine MITGLIEDERLISTE,
-- und in diesem Verein stehen sehr viele KINDER drin.
--
-- ### BEFUND VOR DIESER MIGRATION (0011:119-133, live belegt) ###
-- chat_messages_insert erlaubt JEDEM Vereinsmitglied eine Direktnachricht an
-- JEDES andere Mitglied desselben Vereins — einzige Bedingung: der Empfaenger
-- ist nicht geloescht. Ein erwachsenes Mitglied ohne jede Beziehung zu einem
-- Kind konnte diesem 1:1 und unbeobachtet schreiben. Ohne UI fiel das nicht auf;
-- mit der Empfaengerauswahl waere es ein Feature geworden.
--
-- ### DIE REGEL, DIE HIER ENTSTEHT ###
-- Kein unbeobachteter 1:1-Kontakt zwischen Erwachsenen und Minderjaehrigen
-- ausser ueber die zwei Wege, die es fachlich zwingend braucht:
--   * Sorgeberechtigte  -> ihr eigenes Kind   (app.guardianships)
--   * Trainer:innen     -> ihre Schuetzlinge  (team_members.role='coach' im
--                          SELBEN Team wie das Kind)
-- Alles andere: Erwachsener <-> Kind ist zu. Symmetrisch, also auch das Kind
-- kann einen unbeteiligten Erwachsenen nicht anschreiben (sonst waere die
-- Sperre mit einem "schreib mir zuerst" ausgehebelt).
-- BEWUSST OFFEN GELASSEN: Kind <-> Kind. Zwei Minderjaehrige sind Gleichaltrige;
-- das zu sperren ist kein Kinderschutz, sondern nur Kontaktverbot unter Kindern.
-- Erwachsener <-> Erwachsener bleibt unveraendert offen.
--
-- ### DIE GRENZE DIESER REGEL — EHRLICH GESAGT ###
-- "Minderjaehrig" kann nur aus club_members.birth_date kommen; eine andere
-- Angabe hat die Zeile nicht. birth_date IS NULL heisst darum hier
-- "erwachsen" — NICHT weil das sicher ist, sondern weil die Gegenrichtung
-- (unbekannt = Kind) jeden Erwachsenen sperren wuerde: im Seed haben ALLE
-- Erwachsenen birth_date = null. Der Schutz ist also nur so gut wie die
-- gepflegten Geburtsdaten. Ein Kind ohne Geburtsdatum ist NICHT geschuetzt.
-- Das gehoert in die Mitgliederpflege (Pflichtfeld), nicht in diese Policy.
--
-- ### ZWEITER FUND, GLEICH MITGENOMMEN: SENDER OHNE VEREINSBEZUG ###
-- is_own_member(sender_member_id) prueft nur "die Zeile gehoert mir" — NICHT,
-- dass sie zum club_id der Nachricht gehoert. Wer in Verein A UND B Mitglied
-- ist, konnte eine Zeile mit club_id=A und sender=seiner B-Zeile einfuegen; der
-- Empfaenger in A sah dann einen Peer aus Verein B (peer-Join in chat.ts).
-- Der Empfaenger war schon immer an chat_messages.club_id gebunden, der Sender
-- nicht. Hier zugezogen.
--
-- ### BESTANDS-TESTS: KEINER friert die Weite als Sollverhalten ein ###
-- Geprueft, nicht vermutet. Der einzige DM-Insert-Test unter supabase/tests/
-- ist 98_modules_batch4.sql:105-109 — Katrin (a-09) -> Sandra (a-01), beide
-- birth_date = null, also Erwachsene, gleicher Verein: bleibt erlaubt.
-- 98:111-115 (Sender-Spoofing -> 42501) bleibt unberuehrt.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- app.chat_is_minor — minderjaehrig laut hinterlegtem Geburtsdatum.
-- Bewusst KEIN fail-closed bei birth_date is null (siehe Kopf).
-- ----------------------------------------------------------------------------
create or replace function app.chat_is_minor(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.club_members m
    where m.id = p_member_id
      and m.deleted_at is null
      and m.birth_date is not null
      and m.birth_date > (current_date - interval '18 years')
  )
$$;

comment on function app.chat_is_minor(uuid) is
  'True when the member has a birth_date on file and is under 18. birth_date IS NULL counts as adult (see 0043 header): the opposite would lock out every adult, because adults carry no birth_date in practice.';

-- ----------------------------------------------------------------------------
-- app.chat_dm_allowed — darf p_sender an p_recipient eine DIREKTnachricht
-- schicken? Reines Paar-Praedikat (kein auth.uid()), damit es 1:1 pruefbar ist
-- und in beide Richtungen dasselbe sagt.
-- ----------------------------------------------------------------------------
create or replace function app.chat_dm_allowed(p_sender_member_id uuid, p_recipient_member_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sender_minor boolean := app.chat_is_minor(p_sender_member_id);
  v_recip_minor  boolean := app.chat_is_minor(p_recipient_member_id);
  v_adult        uuid;
  v_child        uuid;
begin
  -- Erwachsener <-> Erwachsener und Kind <-> Kind: unveraendert offen.
  if v_sender_minor = v_recip_minor then
    return true;
  end if;

  -- gemischtes Paar -> die zwei erlaubten Beziehungen entscheiden
  if v_recip_minor then
    v_adult := p_sender_member_id;
    v_child := p_recipient_member_id;
  else
    v_adult := p_recipient_member_id;
    v_child := p_sender_member_id;
  end if;

  -- (1) Sorgeberechtigte:r des Kindes
  if exists (
    select 1
    from app.guardianships g
    where g.guardian_member_id = v_adult
      and g.child_member_id = v_child
      and g.deleted_at is null
  ) then
    return true;
  end if;

  -- (2) Trainer:in eines Teams, in dem das Kind ist ("erreicht seine
  --     Schuetzlinge"). Bewusst team_members.role = 'coach' und nicht
  --     is_club_trainer(): letzteres ist owner/admin/moderator/coach/
  --     guest_coach VEREINSWEIT und wuerde die Sperre fuer den halben
  --     Vorstand wieder aufmachen.
  return exists (
    select 1
    from app.team_members tc
    join app.team_members tk on tk.team_id = tc.team_id and tk.deleted_at is null
    where tc.member_id = v_adult
      and tc.role = 'coach'
      and tc.deleted_at is null
      and tk.member_id = v_child
  );
end;
$$;

comment on function app.chat_dm_allowed(uuid, uuid) is
  'Referenz Kinderschutz (0043): a direct message between an adult and a minor is only allowed when the adult is a guardian of that minor or a coach of one of the minor teams. adult<->adult and minor<->minor are unrestricted. Symmetric by design.';

-- ----------------------------------------------------------------------------
-- chat_messages_insert — ersetzt 0011:119-133.
-- Neu gegenueber dem Bestand:
--   * der Sender muss zum club_id der Nachricht gehoeren (Tenancy),
--   * eine Direktnachricht muss app.chat_dm_allowed bestehen (Kinderschutz).
-- Unveraendert: Sender ist immer die eigene Zeile, Team-Post nur als
-- Team-Mitglied, Empfaenger im selben Verein.
-- Der SELECT-Pfad bleibt bewusst unangetastet: bestehende Faeden muessen
-- lesbar bleiben (auch als Beleg), gesperrt wird das ENTSTEHEN.
-- ----------------------------------------------------------------------------
drop policy chat_messages_insert on app.chat_messages;

create policy chat_messages_insert on app.chat_messages
  for insert to authenticated
  with check (
    app.is_own_member(sender_member_id)
    -- Tenancy: die Sender-Zeile gehoert in den Verein der Nachricht
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
    )
  );
