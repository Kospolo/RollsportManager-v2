-- ============================================================================
-- 0054_kontaktdaten.sql — Telefon + Anschrift als KONTAKTdaten (Marcel 2026-07-17)
--
-- Zwei Befunde des Nutzers:
--   (A) Es fehlen Telefonnummer und Anschrift am Mitglied. Beide gehoeren zu
--       denselben KONTAKTdaten wie email/birth_date — nicht ins Selbst-Profil
--       (das ist eine freiwillige Aussage ueber den SPORT, sichtbar fuer den
--       ganzen Verein). phone/postal_address sind das Gegenteil: sie sagen, wie
--       man die Eltern erreicht, und sie sind fuer den ganzen Verein NICHT
--       bestimmt. Deshalb reihen sie sich in die REDIGIERTE Spaltengruppe ein
--       (members.ts/redactMemberForViewer), nicht in die offene.
--   (B) Eine Trainer:in soll die Eltern IHRER Team-Kinder erreichen koennen.
--       Das ist eine ZEILEN-Regel ("darf dieser coach DIESE Person sehen"),
--       keine Spalten-Regel — und sie sitzt in der API (members.ts), wie die
--       ganze Kontaktdaten-Redaktion. Hier steht deshalb NUR die Spalten-Physik.
--
-- ### WARUM HIER KEINE contains_contact_details-LEITPLANKE ###
-- Beim Selbst-Profil (0045) blockt die CHECK hineinkopierte Kontaktdaten, WEIL
-- das Publikum der ganze Verein ist. phone/postal_address SIND Kontaktdaten und
-- ihr Publikum ist eng (Verwaltung + Team-Trainer:in) — eine Leitplanke gegen
-- "das sieht aus wie eine Telefonnummer" waere hier absurd: es IST eine.
-- Die Schranke ist die Sichtbarkeit (Redaktion), nicht der Inhalt.
--
-- ### LAENGEN ###
-- phone: eine Nummer mit Vorwahl/Landeskennung/Trennern passt weit in 40.
-- postal_address: eine mehrzeilige Anschrift (Strasse, PLZ/Ort, ggf. Zusatz)
--   passt in 300 — grosszuegig genug fuer den Realfall, eng genug, dass das
--   Feld kein Freitext-Notizzettel wird.
-- ============================================================================
begin;

-- ----------------------------------------------------------------------------
-- Die Spalten. Beide nullable (nicht jede:r traegt sie ein), beide text.
-- ----------------------------------------------------------------------------
alter table app.club_members
  add column if not exists phone          text,
  add column if not exists postal_address text;

alter table app.club_members
  drop constraint if exists club_members_phone_len_chk,
  drop constraint if exists club_members_postal_address_len_chk;

alter table app.club_members
  add constraint club_members_phone_len_chk
    check (phone is null or char_length(phone) <= 40),
  add constraint club_members_postal_address_len_chk
    check (postal_address is null or char_length(postal_address) <= 300);

comment on column app.club_members.phone is
  'KONTAKTdatum (wie email/birth_date): Telefonnummer (max. 40). Publikum eng — REDIGIERT in der API (members.ts/redactMemberForViewer): can_manage_members + Plattform-Admin sehen ALLE; ein coach (NICHT guest_coach) sieht sie NUR fuer Mitglieder seiner eigenen Teams (maySeeContactOf). Kein Selbst-Profil-Feld: nicht fuer den ganzen Verein bestimmt.';
comment on column app.club_members.postal_address is
  'KONTAKTdatum (wie email/birth_date): Anschrift (max. 300). Sichtbarkeit/Redaktion wie app.club_members.phone. Schreibrecht: die Person selbst (PATCH /me) und can_manage_members (PATCH .../members/{id}) — derselbe Pfad wie email, kein zweiter.';

commit;
