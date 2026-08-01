-- ============================================================================
-- 0087_konto_loeschen.sql — Rechte + Integritaet fuer „Konto loeschen".
--
-- Apple verlangt In-App-Kontoloeschung (App-Store-Richtlinie 5.1.1(v)); die
-- DSGVO (Art. 17) das Recht auf Loeschung. DELETE /me (routes/me.ts) loescht das
-- Konto der aufrufenden Person.
--
-- === WAS BEIM LOESCHEN PASSIERT (FK-Landschaft, selbst geprueft) ===
-- Loeschen von auth.users kaskadiert auf app.profiles (on delete cascade) und
-- damit auf notes/user_preferences/consents(subject)/policy_acknowledgements/
-- password_reset_tokens (alle CASCADE). Vereinsmitgliedschaft, Medien-/Buchungs-
-- Ersteller, Einladungen, Fahrgemeinschaften stehen auf SET NULL — die
-- Datensaetze ueberleben ENTKOPPELT (der Verein behaelt seine Historie, die
-- Person ist raus). Die Route anonymisiert zusaetzlich die PII in den eigenen
-- club_members-Zeilen (Name/E-Mail/Telefon/Adresse/Geburtsdatum), bevor sie
-- entkoppelt werden.
--
-- === ZWEI RESTRICT-FKs, die es sonst BLOCKIEREN wuerden ===
-- consents.granted_by_profile_id und support_messages.author_profile_id waren
-- RESTRICT + NOT NULL — ein Elternteil, das je eine Einwilligung erteilt hat,
-- oder wer je eine Support-Nachricht schrieb, waere unloeschbar gewesen. Beide
-- werden auf SET NULL (+ nullable) umgestellt: der Nachweis (Einwilligung,
-- Support-Verlauf) BLEIBT erhalten, nur der Zeiger auf die geloeschte Person
-- wird geleert. Das ist der uebliche DSGVO-Kompromiss zwischen Loeschung und
-- der berechtigten Aufbewahrung des Vereins-/Betriebsnachweises.
--
-- === ALLEINIGER INHABER ===
-- Wer ALLEINIGER aktiver owner eines Vereins ist, kann sich NICHT loeschen (die
-- Route antwortet 409) — sonst bliebe ein herrenloser Verein zurueck. Erst
-- Inhaberschaft uebertragen oder den Verein loeschen. Diese Regel steht in der
-- Route (mit Vereinsnamen im Fehlertext), nicht hier.
-- ============================================================================

begin;

-- service_role loescht das Konto (0085 gab nur insert/update).
grant delete on auth.users to service_role;

alter table app.consents
  alter column granted_by_profile_id drop not null;
alter table app.consents
  drop constraint consents_granted_by_profile_id_fkey,
  add constraint consents_granted_by_profile_id_fkey
    foreign key (granted_by_profile_id) references app.profiles (id) on delete set null;

alter table app.support_messages
  alter column author_profile_id drop not null;
alter table app.support_messages
  drop constraint support_messages_author_profile_id_fkey,
  add constraint support_messages_author_profile_id_fkey
    foreign key (author_profile_id) references app.profiles (id) on delete set null;

comment on column app.consents.granted_by_profile_id is
  'Wer die Einwilligung erteilt hat. NULL, wenn dieses Konto geloescht wurde (0087, on delete set null) — der Nachweis selbst bleibt.';
comment on column app.support_messages.author_profile_id is
  'Verfasser der Support-Nachricht. NULL nach Kontoloeschung (0087, on delete set null) — der Verlauf bleibt lesbar.';

commit;
