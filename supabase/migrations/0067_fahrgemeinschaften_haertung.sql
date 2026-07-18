-- ============================================================================
-- 0067_fahrgemeinschaften_haertung.sql — die drei Loecher aus 0066 (2026-07-18)
--
-- 0066 hat die Fachlogik richtig gebaut, aber drei Grenzen zu weit gezogen.
-- Diese Migration aendert KEINE Fachlogik und KEINE Tabellenform — sie zieht
-- die drei Grenzen nach. Jede der drei ist ein belegter Angriff, kein Verdacht.
--
-- ### LOCH 1 — DER KINDERSCHUTZ (der schwerste) ###
-- Belegt: Vormund Katrin sagt ihr Kind Lina in Stefanies Fahrt ab. Danach
-- traegt STEFANIE — eine fremde Erwachsene, fuer die app.can_act_for_member(Lina)
-- FALSCH ist — Lina eigenmaechtig wieder ein. Ergebnis: status='zugesagt',
-- angemeldet_von_profile_id=Stefanie. Also die Zuordnung KIND <-> FREMDE:R
-- ERWACHSENE:R ohne jedes Zutun des Vormunds, und obendrein mit einer Zeile,
-- die dann auch noch behauptet, Stefanie habe die Erklaerung abgegeben.
--
-- Die Ursache ist die Naht zwischen zwei Policies:
--   * event_ride_riders_INSERT verlangt app.can_act_for_member(member_id) —
--     korrekt, eine fremde Erwachsene prallt hier ab (42501).
--   * event_ride_riders_UPDATE (0066:689) gab der FAHRER:IN dagegen
--     UNGEFILTERTES Update auf JEDE Zusage ihrer Fahrt. Gedacht war genau EIN
--     Fall: "das Auto faellt aus, ich trage jemanden AUS". Dagestanden hat:
--     jedes Feld, jeder Zielzustand.
-- Sobald eine Zeile EINMAL existiert (und eine abgesagte Zusage existiert
-- weiter — sie ist Absicht, 0066 haelt den Verlauf fest), fuehrt der Weg nicht
-- mehr durch die enge INSERT-Tuer, sondern durch die weite UPDATE-Tuer.
-- Eine Absage war damit kein Schutz, sondern ein TUEROEFFNER.
--
-- Die Antwort steht hier auf zwei Beinen, weil ein Bein die falsche Sorte
-- Frage nicht beantworten kann:
--   (1) POLICY — beantwortet "welcher ZUSTAND darf entstehen?". Sie kennt nur
--       NEW. Also: eine Zeile darf mit status='zugesagt' nur dastehen, wenn
--       app.can_act_for_member(member_id) gilt (oder Verwaltung). Die
--       Fahrer:in kommt damit ausschliesslich noch bei status='abgesagt'
--       durch — genau ihr gedachtes Recht, das AUSTRAGEN.
--   (2) TRIGGER — beantwortet "welche VERAENDERUNG ist das?". Nur er sieht OLD
--       und kann deshalb (a) den Uebergang abgesagt->zugesagt als das erkennen,
--       was er ist (eine NEUE Zusage, also dieselbe Pruefung wie beim Anlegen),
--       und (b) die Identitaetsfelder einfrieren.
-- Beide zusammen, nicht eines statt des anderen: die Policy allein liesse eine
-- 'zugesagt'->'zugesagt'-Umschreibung von member_id durch (NEW.member_id waere
-- dann ja das eigene Kind), der Trigger allein haette keine Zustandsschranke.
--
-- ### LOCH 2 — DIE RUECKRUFNUMMER, DIE SICH NICHT ZURUECKZIEHEN LIESS ###
-- app.event_ride_contacts hatte select/insert/update — aber KEINE DELETE-Policy.
-- Die Route loescht dort (event-rides.ts:317). Ohne Policy loescht ein DELETE
-- unter RLS nicht etwa mit Fehler, sondern mit NULL BETROFFENEN ZEILEN: die
-- API meldete 200, gab die Nummer weiter aus, und roh in der DB stand sie
-- unveraendert. Das ist der schlimmste Fehlertyp bei Kontaktdaten — nicht ein
-- Leck, sondern ein VORGETAEUSCHTER Widerruf. Datenschutzrechtlich ist es der
-- Unterschied zwischen "Loeschung erfolgt" und "Loeschung behauptet"
-- (Art. 5 Abs. 1 lit. c/d/e, Art. 17 DSGVO).
--
-- Gewaehlt: DELETE-Policy statt "Route auf UPDATE auf NULL umbauen". Begruendung
-- ist Datenminimierung, nicht Bequemlichkeit — eine geloeschte Zeile IST weg;
-- eine auf NULL gesetzte Spalte verlangt, rueckrufnummer nullable zu machen und
-- hinterliesse eine leere Huelle samt created_at/updated_at, also Metadaten zu
-- einem Kontakt, den es nicht mehr geben soll. Das Praedikat ist woertlich das
-- der UPDATE-Policy: wer die Nummer AENDERN darf, darf sie auch ENTFERNEN —
-- es waere nicht erklaerbar, das Ueberschreiben zu erlauben und das Loeschen
-- nicht (ueberschreiben mit '000' waere sonst der Umweg).
--
-- ### LOCH 3 — UMHAENGEN AUF EINEN UNLESBAREN TERMIN ###
-- event_rides_update (0066:574) prueft im WITH CHECK app.can_read_event NICHT.
-- Die INSERT-Policy tut es. Damit war der Zielzustand einer Fahrt schwaecher
-- geschuetzt als ihr Anfangszustand: die Fahrer:in konnte ihre Fahrt an einen
-- Termin haengen, den sie selbst gar nicht sehen darf. Sie wuerde die Fahrt
-- danach nicht einmal mehr sehen — aber sie stuende dort, mit Abfahrtsort und
-- (ueber die Kontakttabelle) einer Rueckrufnummer, an einem fremden Publikum.
-- Zwei Zustaende derselben Zeile duerfen nicht verschieden streng sein.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Identitaet einer Zusage einfrieren + Wiederbelebung wie eine Neu-Zusage
--    behandeln.
--
-- Warum SECURITY DEFINER: die Funktion ruft app.can_act_for_member und
-- app.has_club_role — beide sind selbst definer und lesen guardianships /
-- member_roles, die der aufrufenden Person zeilenweise nicht offenstehen
-- muessen. Sie AUTORISIERT hier ausdruecklich (anders als die vier Trigger aus
-- 0066, die nur Integritaet pruefen) — deshalb liest sie ausschliesslich OLD
-- und NEW der eigenen Zeile und ruft nur die beiden vorhandenen
-- Berechtigungsfunktionen auf. Es gibt keinen Parameter, ueber den sich eine
-- fremde Zeile unterschieben liesse.
--
-- auth.uid() is null = Migration/Seed/service_role -> haelt sich heraus, wie
-- 0002/0024/0055. Der Dienstweg hat keine Vormund-Beziehung, gegen die man
-- pruefen koennte; er ist an anderer Stelle abgesichert.
-- ----------------------------------------------------------------------------
create or replace function app.protect_ride_rider_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- (a) WER mitfaehrt, ZU WELCHER Fahrt und WER es erklaert hat, steht mit dem
  --     Anlegen fest. Waeren diese Felder aenderbar, koennte man die enge
  --     INSERT-Pruefung mit einer harmlosen eigenen Zeile umgehen und sie
  --     danach auf ein fremdes Kind umschreiben — dieselbe Luecke, nur eine
  --     Spalte weiter. angemeldet_von_profile_id ist zusaetzlich der NACHWEIS,
  --     wer die Erklaerung abgegeben hat; ein Nachweis, den der Nachgewiesene
  --     selbst ueberschreiben kann, ist keiner.
  if new.member_id is distinct from old.member_id then
    raise exception 'Die mitfahrende Person einer Zusage kann nicht ausgetauscht werden'
      using errcode = '42501';
  end if;
  if new.ride_id is distinct from old.ride_id then
    raise exception 'Eine Zusage kann nicht auf eine andere Fahrt umgehaengt werden'
      using errcode = '42501';
  end if;
  if new.club_id is distinct from old.club_id then
    raise exception 'Eine Zusage kann nicht in einen anderen Verein verschoben werden'
      using errcode = '42501';
  end if;
  if new.angemeldet_von_profile_id is distinct from old.angemeldet_von_profile_id then
    raise exception 'Wer die Zusage erklaert hat, steht fest und kann nicht ueberschrieben werden'
      using errcode = '42501';
  end if;

  -- (b) WIEDERBELEBUNG ist fachlich eine NEUE Zusage und wird deshalb genau so
  --     geprueft wie eine: app.can_act_for_member (die Person selbst oder ihr:e
  --     Erziehungsberechtigte:r) oder die Verwaltung. Erfasst sind beide Wege
  --     zurueck in den aktiven Zustand — der Status UND das Zuruecknehmen eines
  --     Soft-Deletes.
  if (new.status = 'zugesagt' and old.status is distinct from 'zugesagt')
     or (new.status = 'zugesagt' and new.deleted_at is null and old.deleted_at is not null) then
    if not (
      app.can_act_for_member(new.member_id)
      or app.has_club_role(new.club_id, array['owner', 'admin', 'moderator'])
    ) then
      raise exception
        'Eine abgesagte Zusage darf nur die Person selbst bzw. ihr:e Erziehungsberechtigte:r (oder der Vorstand) wieder aktivieren (Mitglied %)',
        new.member_id
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function app.protect_ride_rider_change() is
  'Kinderschutz an der Mitfahr-Zusage (0067). Friert member_id/ride_id/club_id/angemeldet_von_profile_id nach dem Anlegen ein und behandelt jede WIEDERBELEBUNG (abgesagt -> zugesagt bzw. Ruecknahme eines Soft-Deletes) wie eine NEUE Zusage: sie verlangt app.can_act_for_member(member_id) oder die Verwaltung. Schliesst den Weg, auf dem eine Fahrer:in ueber die weite UPDATE-Policy eine vom Vormund abgesagte Zusage eines FREMDEN Kindes reaktivieren konnte — die enge INSERT-Pruefung liess sich nach dem ersten Anlegen sonst umgehen. auth.uid() is null (Seed/Service) ausgenommen wie in 0002/0024.';

create trigger event_ride_riders_protect_change
  before update on app.event_ride_riders
  for each row execute function app.protect_ride_rider_change();

-- ----------------------------------------------------------------------------
-- 2. Die UPDATE-Policy der Zusagen: das Recht der Fahrer:in endet beim
--    AUSTRAGEN.
--
-- USING bleibt unveraendert — WER die Zeile ueberhaupt anfassen darf, war
-- richtig (Person/Vormund, Verwaltung, Fahrer:in). Falsch war nur, WELCHEN
-- Zustand sie hinterlassen darf. Deshalb wird das WITH CHECK nach dem
-- ZIELZUSTAND aufgeteilt:
--   'abgesagt'  -> auch die Fahrer:in (ihr gedachtes Recht: das Auto faellt aus)
--   'zugesagt'  -> NUR can_act_for_member oder Verwaltung (wie beim Anlegen)
-- Damit steht die Aussage "eine Zusage fuer ein Kind kann nur sein Vormund
-- erklaeren" an ALLEN Tueren derselben Tabelle, nicht nur an der INSERT-Tuer.
-- ----------------------------------------------------------------------------
drop policy event_ride_riders_update on app.event_ride_riders;

create policy event_ride_riders_update on app.event_ride_riders
  for update to authenticated
  using (
    app.can_act_for_member(member_id)
    or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
    or exists (
      select 1
      from app.event_rides r
      join app.club_members m on m.id = r.driver_member_id
      where r.id = ride_id and m.profile_id = auth.uid() and m.deleted_at is null
    )
  )
  with check (
    app.is_club_member(club_id)
    and (
      -- AUSTRAGEN / ABSAGEN — hier darf die Fahrer:in mit.
      (
        status = 'abgesagt'
        and (
          app.can_act_for_member(member_id)
          or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
          or exists (
            select 1
            from app.event_rides r
            join app.club_members m on m.id = r.driver_member_id
            where r.id = ride_id and m.profile_id = auth.uid() and m.deleted_at is null
          )
        )
      )
      -- AKTIVE ZUSAGE — dieselbe Schranke wie beim Anlegen. Die Fahrer:in ist
      -- hier bewusst NICHT genannt: sie entscheidet ueber ihr Auto, nicht
      -- darueber, wessen Kind darin sitzt.
      or (
        status = 'zugesagt'
        and (
          app.can_act_for_member(member_id)
          or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
        )
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Die Rueckrufnummer laesst sich wirklich zurueckziehen.
--
-- Praedikat woertlich wie event_ride_contacts_update (0066:615): Fahrer:in der
-- Fahrt oder Verwaltung.
-- ----------------------------------------------------------------------------
create policy event_ride_contacts_delete on app.event_ride_contacts
  for delete to authenticated
  using (
    app.is_club_member(club_id)
    and exists (
      select 1 from app.event_rides r
      where r.id = ride_id
        and (
          exists (select 1 from app.club_members m
                  where m.id = r.driver_member_id
                    and m.profile_id = auth.uid()
                    and m.deleted_at is null)
          or app.has_club_role(r.club_id, array['owner', 'admin', 'moderator'])
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Eine Fahrt kann nicht an einen Termin gehaengt werden, den die
--    Schreibende nicht lesen darf (Gleichstand mit event_rides_insert).
-- ----------------------------------------------------------------------------
drop policy event_rides_update on app.event_rides;

create policy event_rides_update on app.event_rides
  for update to authenticated
  using (
    exists (
      select 1 from app.club_members m
      where m.id = driver_member_id
        and m.profile_id = auth.uid()
        and m.deleted_at is null
    )
    or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
  )
  with check (
    app.is_club_member(club_id)
    and app.can_read_event(event_id)
    and (
      exists (
        select 1 from app.club_members m
        where m.id = driver_member_id
          and m.profile_id = auth.uid()
          and m.deleted_at is null
      )
      or app.has_club_role(club_id, array['owner', 'admin', 'moderator'])
    )
  );

commit;
