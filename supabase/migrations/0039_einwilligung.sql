-- ============================================================================
-- 0039_einwilligung.sql — Die Einwilligung erzwingt etwas.
--
-- AUSGANGSLAGE (selbst geprueft, nicht uebernommen):
-- Der Befund der Datenschutzbeauftragten lautete "app.consents wird NIRGENDS
-- abgefragt, grep = 0 Treffer". Das ist FALSCH. Einwilligungen werden sehr wohl
-- geschrieben — an genau zwei Stellen:
--   * services/api/src/routes/clubs.ts:259-266        (POST /clubs)
--   * services/api/src/routes/registration.ts:184-191 (POST /clubs/join)
-- Beide schreiben in einer Schleife ueber ['terms','privacy'] je eine Zeile mit
-- granted = true.
--
-- Der Befund ist im Ergebnis trotzdem richtig, aber aus dem umgekehrten Grund:
-- Es werden AUSSCHLIESSLICH die beiden Zwecke erfasst, die KEINE Einwilligung
-- sind — und kein einziger der vier, die welche sind. photos_internal,
-- photos_public, chat und newsletter kommen im gesamten Baum nicht ein Mal als
-- Wert vor. Das Modell dokumentiert nicht zu wenig; es dokumentiert das Falsche.
--
-- ----------------------------------------------------------------------------
-- WELCHE ZWEI DER SECHS ZWECKE FALSCH EINSORTIERT SIND: terms UND privacy.
-- ----------------------------------------------------------------------------
-- Die DSB hat recht, und es sind genau die beiden, die heute allein erfasst
-- werden. Begruendung, jeweils am Code belegt:
--
--   'terms' (Nutzungsbedingungen) ist Art. 6 Abs. 1 lit. b DSGVO —
--   Vertragserfuellung. Die Bedingungen anzunehmen IST der Vertragsschluss.
--   Ein Vertrag ist keine Einwilligung: er ist nicht "freiwillig" im Sinne von
--   Art. 4 Nr. 11 (man kann ihn ablehnen, aber dann gibt es kein Vertrag —
--   das ist gerade KEINE Freiwilligkeit im Einwilligungssinn) und er ist nicht
--   nach Art. 7 Abs. 3 frei widerruflich.
--
--   'privacy' (Datenschutzerklaerung) ist Art. 13 — eine INFORMATIONSPFLICHT
--   des Verantwortlichen. Man willigt in eine Datenschutzerklaerung nicht ein;
--   man nimmt sie zur Kenntnis. "Ich willige in Ihre Datenschutzerklaerung
--   ein" ist ein Satz ohne Rechtsinhalt — es gibt nichts, worin man einwilligt,
--   und der Wortlaut der Web-Oberflaeche sagt das sogar schon richtig:
--   apps/web/app/(auth)/beitreten/i18n.ts:17 = "Ich habe die
--   Datenschutzerklaerung GELESEN." Das ist Kenntnisnahme, kein Ja.
--
-- WARUM DAS NICHT NUR EINE ETIKETTENFRAGE IST — es sind drei echte Fehler:
--
--   1. KOPPLUNGSVERBOT (Art. 7 Abs. 4). validation.ts:2510-2511 deklariert
--      accept_terms/accept_privacy als z.literal(true) — also PFLICHT. Ein
--      Pflicht-Haken, der in einer Tabelle namens "consents" mit einer Spalte
--      "granted" landet, stellt Vertragsnotwendiges als Einwilligung dar.
--      Genau das verbietet Art. 7 Abs. 4. Und es faerbt ab: steht Pflichtiges
--      neben Freiwilligem in derselben Liste, wirkt auch das Freiwillige wie
--      Pflicht — die Einwilligung in photos_public waere dann nicht mehr
--      freiwillig und damit unwirksam.
--
--   2. WIDERRUF WIRD UNSINNIG (Art. 7 Abs. 3). app.consents ist append-only mit
--      Widerruf per granted=false. Auf 'privacy' angewandt heisst das: ein
--      Mitglied kann die Datenschutzerklaerung "widerrufen". Was soll dann
--      gelten? Die Frage hat keine Antwort, weil sie falsch gestellt ist.
--
--   3. DER NACHWEIS IST WERTLOS (Art. 7 Abs. 1). Beide Aufrufstellen setzen
--      legal_document_id NICHT — die Spalte bleibt NULL. Damit zeigt der
--      "Nachweis" auf keinen Wortlaut. internal.legal_documents wurde in 0034
--      eigens gebaut, damit genau das nicht passiert (0034:388-405), und wird
--      von niemandem benutzt. Eine Zustimmung ohne Fassungszeiger belegt nur,
--      dass jemand irgendwann irgendetwas angehakt hat.
--
-- KONSEQUENZ: Kenntnisnahme und Einwilligung werden getrennt.
--   * app.policy_acknowledgements (NEU) — Kenntnisnahme/Vertragsannahme.
--     Kein "granted", kein Widerruf: eine Kenntnisnahme ist eine TATSACHE, kein
--     Schalter. legal_document_id ist NOT NULL — ohne Fassung kein Eintrag.
--   * app.consents — nur noch echte Einwilligung (Art. 6 Abs. 1 lit. a).
--     terms/privacy werden dort ABGEWIESEN.
--
-- Die Enum-Werte 'terms'/'privacy' bleiben im Typ app.consent_purpose stehen
-- (Postgres kann Enum-Werte nicht gefahrlos entfernen); der CHECK unten macht
-- sie in app.consents unbenutzbar. Der Typ wird von
-- app.policy_acknowledgements.kind weiterverwendet — dort gehoeren sie hin.
--
-- ============================================================================
-- G2 — DAS KIND, DAS SICH SELBST EINWILLIGT
-- ============================================================================
-- consents_insert Variante (a) (0034:561-568) greift, sobald
-- club_members.profile_id = auth.uid(). Ein Kind mit Konto erklaert damit
-- photos_public selbst — und die Zeile sieht im Nachweis GUELTIG aus.
-- Belegt im eigenen Harness vor diesem Fix:
--   ANGRIFF-1 (Kind willigt selbst ein): GELUNGEN — Zeile liegt vor
-- birth_date (0002:76) wird gespeichert und nirgends ausgewertet.
--
-- ALTERSSCHWELLE: 16. Art. 8 Abs. 1 DSGVO nennt 16 und erlaubt den
-- Mitgliedstaaten, auf bis zu 13 abzusenken. Deutschland hat NICHT abgesenkt
-- (kein Gebrauch der Oeffnungsklausel im BDSG) -> es bleibt bei 16.
--
-- DAS UNBEKANNTE GEBURTSDATUM — der eigentlich schwierige Fall.
-- birth_date ist NULL-bar (0002:76), und POST /clubs/join (registration.ts:178)
-- erhebt es gar nicht. "NULL = erwachsen" waere der Freifahrtschein fuer genau
-- die Kinder, die ueber den Vereinscode hereinkommen. "NULL = Kind" waere
-- unbrauchbar: kein Bestandsmitglied koennte je einwilligen, und der Beitritt
-- fragt das Datum nirgends ab.
-- ENTSCHIEDEN: bei unbekanntem Alter entscheidet die GUARDIANSHIP. Wer als
-- Muendel eingetragen ist (app.guardianships), ist ein Kind — die Eintragung
-- sagt das bereits, ganz ohne Geburtsdatum. Damit sind alle ueber family.ts
-- angelegten Kinder (Kind + Guardianship in einem Zug) geschuetzt, und der
-- Erwachsene ohne Geburtsdatum wird nicht ausgesperrt.
-- RESTRISIKO, offen benannt: ein Kind, das per Vereinscode selbst beitritt,
-- ohne Geburtsdatum und ohne eingetragene Guardianship, kann weiterhin selbst
-- erklaeren. Das schliesst nur, wer beim Beitritt das Geburtsdatum erhebt —
-- das ist POST /clubs/join und liegt in einer anderen Spur (siehe Bericht).
--
-- DER WIDERRUF IST NIE ALTERSGEPRUEFT (Art. 7 Abs. 3 S. 4): er muss so einfach
-- sein wie die Erteilung. Eine Sperre schuetzt vor einer Erklaerung, die man
-- nicht ueberblickt — "nehmt das Foto runter" ueberblickt auch ein
-- Zehnjaehriger. Wer den Widerruf altersprueft, benutzt den Kinderschutz gegen
-- das Kind.
--
-- ============================================================================
-- DER 16. GEBURTSTAG — eine Entscheidung, keine Unterlassung
-- ============================================================================
-- Frage: Was passiert mit einer vorhandenen Eltern-Einwilligung, wenn das Kind
-- 16 wird? Stillschweigend weitergelten zu lassen WAERE eine Aussage — naemlich
-- die, dass ein Erwachsener dauerhaft an eine Erklaerung gebunden ist, die er
-- nie abgegeben hat.
--
-- ENTSCHIEDEN: Eine von Eltern erteilte Einwilligung ERLISCHT mit dem 16.
-- Geburtstag des Kindes — wirksam ab diesem Tag (ex nunc), NICHT rueckwirkend.
--
-- Begruendung:
--   * Art. 8 gibt den Eltern die Erklaerungsmacht NUR DESHALB, weil das Kind
--     nicht wirksam erklaeren kann. Faellt der Grund weg, faellt die Macht weg.
--     Die Eltern-Erklaerung war nie der Wille des Kindes; sie war ein Ersatz.
--   * Art. 4 Nr. 11 verlangt eine Willensbekundung DER BETROFFENEN PERSON.
--     Ab 16 kann diese Person selbst wollen — dann kann ein Stellvertreter
--     nicht laenger fuer sie wollen.
--   * NICHT rueckwirkend, weil Art. 7 Abs. 3 Satz 2 ausdruecklich sagt, dass
--     ein Widerruf die Rechtmaessigkeit der bis dahin erfolgten Verarbeitung
--     nicht beruehrt. Rueckwirkende Nichtigkeit wuerde den Nachweis dafuer
--     zerstoeren, dass alles Vorherige rechtmaessig war.
--
-- PRAKTISCHE FOLGE, ausdruecklich gewollt: photos_public eines Kindes geht am
-- 16. Geburtstag AUS und bleibt aus, bis die (nun) 16-jaehrige Person selbst
-- zustimmt. Das ist unbequem und richtig.
--
-- Umgesetzt in der Lese-Sicht app.effective_consents — nicht per Trigger:
-- app.consents ist append-only, es DARF sich keine Zeile aendern. Der Ablauf
-- ist eine Eigenschaft der Auswertung, kein Ereignis.
--
-- ============================================================================
-- G4 — EINWILLIGUNG MIT FREMDEM club_id
-- ============================================================================
-- app.consents hatte KEINEN Konsistenz-Check club_id <-> member_id.club_id.
-- Belegt im eigenen Harness vor diesem Fix:
--   ANGRIFF-2 (fremder club_id): GELUNGEN — Zeile im FREMDEN Verein
--   LECK (Admin Verein B sieht Klaras Einwilligung): JA — 1 Zeile(n)
-- consents_select gibt die Zeile via has_club_role(club_id) den Admins des
-- FREMDEN Vereins. Gefixt per zusammengesetztem Fremdschluessel (nicht per
-- Trigger: der FK ist nicht umgehbar und kennt keine Wettlauf-Luecke).
-- ============================================================================

begin;

-- ============================================================================
-- 1. app.policy_acknowledgements — KENNTNISNAHME, nicht Einwilligung
-- ============================================================================
create table app.policy_acknowledgements (
  id                uuid        primary key default app.uuid_v7(),
  profile_id        uuid        not null references app.profiles (id) on delete cascade,
  club_id           uuid        references app.clubs (id) on delete cascade,
  kind              text        not null,
  legal_document_id uuid        not null references internal.legal_documents (id) on delete restrict,
  evidence          jsonb       not null default '{}'::jsonb,
  acknowledged_at   timestamptz not null default now(),
  constraint policy_ack_kind_chk check (kind in ('terms', 'privacy', 'imprint'))
);

comment on table app.policy_acknowledgements is
  'KENNTNISNAHME von Rechtstexten (Art. 13 Informationspflicht) und Vertragsannahme (Art. 6 Abs. 1 lit. b) — AUSDRUECKLICH KEINE Einwilligung. Getrennt von app.consents, weil ein Pflicht-Haken neben freiwilligen Haken das Kopplungsverbot (Art. 7 Abs. 4) verletzt und die freiwilligen mit unwirksam macht. Kein granted, kein Widerruf: eine Kenntnisnahme ist eine Tatsache, kein Schalter.';
comment on column app.policy_acknowledgements.legal_document_id is
  'NOT NULL — im Gegensatz zu app.consents.legal_document_id. Eine Kenntnisnahme OHNE Angabe, WOVON, ist inhaltsleer. Genau dieser Zeiger fehlte bisher an beiden Aufrufstellen (clubs.ts:259, registration.ts:184: legal_document_id blieb NULL).';
comment on column app.policy_acknowledgements.club_id is
  'NULL erlaubt: die Bedingungen werden bei der VEREINSANLAGE angenommen, bevor der Verein existiert.';

create index policy_ack_profile_idx on app.policy_acknowledgements (profile_id, kind, acknowledged_at desc);
create index policy_ack_club_idx    on app.policy_acknowledgements (club_id, kind, acknowledged_at desc);

-- Append-only, aus demselben Grund wie app.consents: DELETE bleibt fuer
-- privilegierte Pfade offen (Art. 17 + on delete cascade), UPDATE nie.
create or replace function app.deny_ack_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception
      'app.policy_acknowledgements ist APPEND-ONLY: UPDATE ist nicht erlaubt. Eine neue Fassung wird neu zur Kenntnis genommen (neue Zeile).'
      using errcode = '42501';
  end if;

  if current_user in ('authenticated', 'anon') then
    raise exception
      'app.policy_acknowledgements: DELETE ist nicht erlaubt.'
      using errcode = '42501';
  end if;

  return null;
end;
$$;

create trigger policy_ack_append_only
  before update or delete on app.policy_acknowledgements
  for each statement execute function app.deny_ack_mutation();

alter table app.policy_acknowledgements enable row level security;

grant select, insert on app.policy_acknowledgements to authenticated;

-- Die eigene Kenntnisnahme, und — fuer die Nachweispflicht — die des Vereins.
create policy policy_ack_select on app.policy_acknowledgements
  for select to authenticated
  using (
    profile_id = auth.uid()
    or (club_id is not null and app.has_club_role(club_id, array['owner', 'admin']))
  );

-- Nur im eigenen Namen. Eine Kenntnisnahme kann NIEMAND fuer einen anderen
-- erklaeren — auch Eltern nicht: "gelesen" ist keine Willenserklaerung, die
-- man vertreten koennte.
create policy policy_ack_insert on app.policy_acknowledgements
  for insert to authenticated
  with check (profile_id = auth.uid());

comment on policy policy_ack_insert on app.policy_acknowledgements is
  'Nur im eigenen Namen. Anders als bei app.consents gibt es hier KEINE Eltern-Variante: Kenntnisnahme ist keine vertretbare Willenserklaerung.';

-- ============================================================================
-- 2. app.consents: terms/privacy gehoeren nicht hierher
-- ============================================================================
-- Die Fehlermeldung nennt den Ersatzweg ausdruecklich. Wer diesen INSERT
-- schreibt, soll nicht suchen muessen, sondern sofort wissen, wohin.
alter table app.consents
  add constraint consents_purpose_is_real_consent_chk
  check (purpose not in ('terms', 'privacy'));

comment on constraint consents_purpose_is_real_consent_chk on app.consents is
  'terms/privacy sind KEINE Einwilligung (Art. 6 Abs. 1 lit. b bzw. Art. 13), sondern Kenntnisnahme -> app.policy_acknowledgements. Ein Pflicht-Haken in der Einwilligungstabelle verletzt das Kopplungsverbot (Art. 7 Abs. 4) und macht die echten Einwilligungen daneben unfreiwillig.';

-- ============================================================================
-- 3. G4 — club_id MUSS zum Mitglied passen
-- ============================================================================
-- Zusammengesetzter Fremdschluessel statt Trigger: nicht umgehbar, keine
-- Wettlauf-Luecke, und er ersetzt den bisherigen Einzel-FK auf member_id
-- vollstaendig (inklusive on delete cascade).
--
-- MATCH SIMPLE (Vorgabe) ist hier genau richtig: member_id ist NULL-bar
-- (consents_subject_chk laesst subject_profile_id allein zu). Bei member_id IS
-- NULL wird der FK nicht geprueft — gewollt, denn dann gibt es kein Mitglied,
-- zu dem club_id passen muesste. Diesen Fall deckt Abschnitt 4 ab.
--
-- DAS ZIEL DES FK GIBT ES SCHON: 0022:178 legt den Unique-Index
-- club_members_id_club_uq (id, club_id) an — eigens fuer genau diese Bauart.
-- 0022:172-175 beschreibt sie woertlich als Hausmittel gegen den Mandantenbruch
-- ("zusammengesetzte FKs statt eines Triggers: deklarativ, nicht umgehbar") und
-- wendet sie auf role_permissions, team_members u.a. an. app.consents kam
-- spaeter (0034) und hat als einzige Tabelle mit club_id+member_id vergessen,
-- dem Muster zu folgen — DAS ist die ganze Ursache von G4. Hier wird nichts
-- erfunden, nur nachgeholt.
alter table app.consents drop constraint consents_member_id_fkey;

alter table app.consents
  add constraint consents_member_club_fk
  foreign key (member_id, club_id) references app.club_members (id, club_id)
  on delete cascade;

comment on constraint consents_member_club_fk on app.consents is
  'G4: schliesst die Einwilligung mit FREMDEM club_id. Vorher konnte man member_id eines Vereins mit club_id eines anderen einfuegen; consents_select gab die Zeile dann via has_club_role(club_id) den Admins des FREMDEN Vereins (im Harness belegt). Ersetzt consents_member_id_fkey.';

-- ============================================================================
-- 4. G2 — Altersschwelle + Art.-8-Zwang
-- ============================================================================
create or replace function app.consent_age_years(p_birth_date date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_birth_date is null then null
    else extract(year from age(current_date, p_birth_date))::integer
  end;
$$;

comment on function app.consent_age_years(date) is
  'Alter in vollen Jahren. NULL bei unbekanntem Geburtsdatum — der Aufrufer MUSS NULL als "unbekannt" behandeln, nicht als "erwachsen".';

-- SECURITY DEFINER ist hier KEIN Beiwerk, sondern notwendig — und der Grund ist
-- lehrreich: die Pruefungen unten schlagen club_members und guardianships nach.
-- Ohne definer-Rechte laufen diese Nachschlage unter RLS DER AUFRUFENDEN PERSON.
-- Dann sieht der Trigger die Mitgliedszeile eines Dritten NICHT und meldet
-- "unbekanntes Mitglied" statt "du darfst das nicht" — die Wache wuerde je nach
-- Aufrufer etwas anderes behaupten. Genau deshalb sind auch alle Helfer aus
-- 0002 (is_club_member, has_club_role, can_act_for_member) security definer.
create or replace function app.enforce_consent_art8()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member        record;
  v_age           integer;
  v_is_guardian   boolean;
  v_is_ward       boolean;
  v_subject_owner uuid;
begin
  -- ------------------------------------------------------------------------
  -- DER WIDERRUF IST NIE ALTERSGEPRUEFT.
  -- Art. 7 Abs. 3 S. 4: der Widerruf muss so einfach sein wie die Erteilung.
  -- Eine Altersschwelle SCHUETZT vor einer Erklaerung, die man nicht ueberblickt
  -- — ein "nehmt das Foto runter" ueberblickt auch ein Zehnjaehriger, und es
  -- gibt nichts, wovor ihn eine Sperre hier schuetzen wuerde. Wer den Widerruf
  -- altersprueft, benutzt den Kinderschutz gegen das Kind.
  -- ------------------------------------------------------------------------
  if not new.granted then
    return new;
  end if;

  -- Ohne member_id gibt es kein Geburtsdatum und kein Muendel-Verhaeltnis:
  -- die Erklaerung kann sich nur auf das eigene Profil beziehen.
  if new.member_id is null then
    -- Der Zweck-Wert ist hier bereits auf echte Einwilligung eingeengt.
    -- Ohne Mitgliedszeile darf nur die betroffene Person selbst erklaeren.
    if new.subject_profile_id is null
       or new.granted_by_profile_id <> new.subject_profile_id then
      raise exception
        'Einwilligung ohne member_id ist nur fuer das EIGENE Profil moeglich (granted_by muss = subject sein).'
        using errcode = '42501';
    end if;
    return new;
  end if;

  select m.id, m.club_id, m.profile_id, m.birth_date
    into v_member
  from app.club_members m
  where m.id = new.member_id;

  if not found then
    raise exception 'Einwilligung verweist auf ein unbekanntes Mitglied.' using errcode = '23503';
  end if;

  v_age           := app.consent_age_years(v_member.birth_date);
  v_subject_owner := v_member.profile_id;

  -- Wird diese Person als MUENDEL gefuehrt? Eine eingetragene Guardianship ist
  -- fuer sich genommen eine Aussage: "fuer diese Person traegt jemand anderes
  -- die elterliche Verantwortung". Das gilt UNABHAENGIG vom Geburtsdatum.
  select exists (
    select 1 from app.guardianships g
    where g.child_member_id = new.member_id
      and g.deleted_at is null
  ) into v_is_ward;

  -- Erklaert die betroffene Person selbst?
  if v_subject_owner is not null and new.granted_by_profile_id = v_subject_owner then
    -- SELBST-ERKLAERUNG.
    --
    -- UNBEKANNTES GEBURTSDATUM: birth_date ist NULL-bar (0002:76) und
    -- POST /clubs/join (registration.ts:178) erhebt es GAR NICHT — die grosse
    -- Mehrheit der Zeilen hat also kein Alter. Wuerde NULL hart als "Kind"
    -- gelten, koennte kein einziges Bestandsmitglied je einwilligen; wuerde es
    -- als "erwachsen" gelten, waere der Art.-8-Zwang auf genau dem Weg umgangen,
    -- auf dem die meisten hereinkommen.
    --
    -- Deshalb entscheidet bei unbekanntem Alter die GUARDIANSHIP: wer als
    -- Muendel eingetragen ist, ist ein Kind — dafuer braucht es kein
    -- Geburtsdatum, denn die Eintragung sagt es bereits. Das trifft genau die
    -- Kinder, die ueber POST /clubs/{id}/children angelegt werden (family.ts
    -- legt Kind UND Guardianship in einem Zug an), und laesst den Erwachsenen
    -- ohne Geburtsdatum in Ruhe.
    if v_age is null and v_is_ward then
      raise exception
        'Diese Person ist als Muendel eingetragen und das Geburtsdatum fehlt: eine eigene Einwilligung ist damit nicht nachweisbar wirksam (Art. 8 DSGVO). Entweder erklaert eine erziehungsberechtigte Person, oder das Geburtsdatum wird ergaenzt.'
        using errcode = '42501';
    end if;

    if v_age is not null and v_age < 16 then
      raise exception
        'Minderjaehrig (% Jahre): eine eigene Einwilligung ist unwirksam. Ab 16 selbst, darunter erklaert eine erziehungsberechtigte Person (Art. 8 Abs. 1 DSGVO; Deutschland hat die Schwelle nicht auf 13 abgesenkt).',
        v_age
        using errcode = '42501';
    end if;

    return new;
  end if;

  -- FREMD-ERKLAERUNG: nur als eingetragene erziehungsberechtigte Person.
  select exists (
    select 1
    from app.guardianships g
    join app.club_members gm on gm.id = g.guardian_member_id
    where g.child_member_id = new.member_id
      and g.deleted_at is null
      and gm.profile_id = new.granted_by_profile_id
      and gm.deleted_at is null
  ) into v_is_guardian;

  if not v_is_guardian then
    raise exception
      'Nur die betroffene Person selbst oder eine eingetragene erziehungsberechtigte Person darf einwilligen (Art. 8 Abs. 2 DSGVO).'
      using errcode = '42501';
  end if;

  -- Eine erziehungsberechtigte Person darf erklaeren, solange das Kind unter 16
  -- ist. Ab 16 ist die Erklaerungsmacht erloschen (siehe Kopfkommentar) — dann
  -- waere eine NEUE Eltern-Zeile ein Rueckschritt hinter den 16. Geburtstag.
  if v_age is not null and v_age >= 16 then
    raise exception
      'Mit % Jahren erklaert die betroffene Person selbst (Art. 8 Abs. 1 DSGVO). Eine Erklaerung durch erziehungsberechtigte Personen ist ab 16 nicht mehr moeglich.',
      v_age
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function app.enforce_consent_art8() is
  'G2: erzwingt Art. 8 DSGVO beim ERTEILEN. Unter 16 — oder bei unbekanntem Geburtsdatum, wenn die Person als Muendel eingetragen ist — ist die Selbst-Erklaerung unwirksam; erklaeren darf dann nur eine eingetragene erziehungsberechtigte Person (app.guardianships). Ab 16 gilt das Umgekehrte: nur noch die Person selbst. Der WIDERRUF (granted=false) ist nie altersgeprueft (Art. 7 Abs. 3 S. 4). Laeuft als ROW-Trigger und damit auch fuer service_role — die API umgeht ihn NICHT.';

-- FOR EACH ROW und ohne Rollen-Ausnahme: anders als bei den append-only-Wachen
-- ist das hier kein Formfehler, den man dem Aufrufer erklaeren will, sondern
-- eine inhaltliche Pruefung JEDER Zeile. Sie muss auch fuer service_role
-- gelten — sonst waere der Art.-8-Zwang durch jeden API-Pfad umgehbar, und
-- genau die API ist es, die die Zeilen schreibt.
create trigger consents_enforce_art8
  before insert on app.consents
  for each row execute function app.enforce_consent_art8();

-- ============================================================================
-- 5. app.consents.seq — die Reihenfolge muss EINDEUTIG sein
-- ============================================================================
-- "Die juengste Zeile je (Person, Zweck) gilt" ist die gesamte Semantik von
-- app.consents. Sie braucht eine Ordnung, die nie unentschieden ausgeht — und
-- genau die gab es nicht:
--
--   * recorded_at hat den Vorgabewert now(). now() ist die TRANSAKTIONSZEIT:
--     alle Zeilen einer Transaktion tragen dieselbe. Die API schreibt
--     Einwilligungen in einer Schleife in EINER Transaktion (so macht es
--     clubs.ts:259 heute schon) -> systematischer Gleichstand, kein Sonderfall.
--   * Der naheliegende Ausweg "dann eben nach id" traegt nicht: app.uuid_v7
--     (0001:65-74) stempelt clock_timestamp() nur in MILLISEKUNDEN. Zwei
--     Zeilen derselben Millisekunde unterscheiden sich nur noch im ZUFALLSTEIL
--     — 'order by id desc' wuerfelt dann.
--
-- Ohne Tiebreaker haette "gilt die Einwilligung?" bei zwei Zeilen aus derselben
-- Transaktion ein zufaelliges Ergebnis. Beim Widerruf waere das die Frage, ob
-- das Foto onlinebleibt — per Muenzwurf. Dieser Fehler ist beim Bau der Sicht
-- aufgefallen (der Test 'Widerruf: die Sicht zeigt sofort nicht mehr wirksam'
-- schlug zufaellig fehl), nicht durch Nachdenken; deshalb steht er hier so
-- ausfuehrlich.
--
-- Eine Sequenz ist monoton und kollidiert nie. recorded_at bleibt die
-- rechtliche Wahrheit (danach wird zuerst sortiert); seq entscheidet nur den
-- Gleichstand.
alter table app.consents
  add column seq bigint generated always as identity;

comment on column app.consents.seq is
  'Monotone Einfuege-Reihenfolge. NUR als Tiebreaker fuer "welche Zeile ist die juengste": recorded_at (= now(), Transaktionszeit) ist bei mehreren Zeilen EINER Transaktion identisch, und app.uuid_v7 loest nur Millisekunden auf — ohne seq entscheidet der Zufall, ob eine Einwilligung als erteilt oder widerrufen gilt.';

-- ============================================================================
-- 6. app.effective_consents — der aktuelle Stand, inkl. 16.-Geburtstag-Ablauf
-- ============================================================================
-- WER DIESE SICHT NICHT BENUTZT, LIEST FALSCH. app.consents ist ein Journal:
-- die juengste Zeile je (member_id, purpose) gilt, alles davor ist Geschichte.
-- Ein 'select granted from app.consents where ...' ohne diese Auswertung
-- liefert irgendeine historische Zeile.
create or replace view app.effective_consents
with (security_invoker = true)
as
select
  c.id,
  c.club_id,
  c.member_id,
  c.subject_profile_id,
  c.purpose,
  c.granted_by_profile_id,
  c.legal_document_id,
  c.policy_version,
  c.recorded_at,
  -- Der tatsaechlich wirksame Stand.
  case
    when not c.granted then false
    -- Von Eltern erteilt, Kind inzwischen 16+ -> erloschen (ex nunc).
    when m.profile_id is distinct from c.granted_by_profile_id
     and app.consent_age_years(m.birth_date) >= 16 then false
    else true
  end as effective,
  c.granted as recorded_granted,
  (m.profile_id is distinct from c.granted_by_profile_id) as granted_by_guardian,
  case
    when not c.granted then 'revoked'
    when m.profile_id is distinct from c.granted_by_profile_id
     and app.consent_age_years(m.birth_date) >= 16 then 'expired_age_16'
    else 'valid'
  end as state
from app.consents c
left join app.club_members m on m.id = c.member_id
where c.id = (
  select c2.id
  from app.consents c2
  where c2.purpose = c.purpose
    and c2.member_id is not distinct from c.member_id
    and c2.subject_profile_id is not distinct from c.subject_profile_id
  order by c2.recorded_at desc, c2.seq desc
  limit 1
);

comment on view app.effective_consents is
  'Der WIRKSAME Einwilligungsstand: juengste Zeile je (Person, Zweck), plus die Auswertung des 16. Geburtstags. state=expired_age_16 bedeutet: die Eltern-Einwilligung ist mit dem 16. Geburtstag erloschen und muss von der betroffenen Person selbst neu erteilt werden. security_invoker=true -> die Sicht sieht nur, was die aufrufende Person ohnehin sehen darf (consents_select gilt weiter, 0030-Regel).';
comment on column app.effective_consents.effective is
  'DAS Feld, das zaehlt. Wer app.consents direkt liest, liest ein Journal und bekommt womoeglich eine widerrufene oder erloschene Zeile als "granted=true".';

grant select on app.effective_consents to authenticated;

commit;
