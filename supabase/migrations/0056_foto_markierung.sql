-- ============================================================================
-- 0056_foto_markierung.sql — "Diese Person ist auf dem Bild" (Trupp 3 A)
--
-- AUSGANGSLAGE (selbst geprueft, nicht uebernommen):
-- Es gibt app.gallery_items (0012) und app.media_assets (0004). Eine Markierung
-- "wer ist auf einem Bild" existiert NICHT — grep photo_tag = 0 Treffer. Diese
-- Migration legt sie an: app.photo_tags.
--
-- ============================================================================
-- DIE ZWEI RECHTE SIND VERSCHIEDEN — und das ist der ganze Kern.
-- ============================================================================
--   MARKIEREN ist ein Metadatum: Staff traegt ein, wer auf dem Foto ist.
--     Das darf auch fuer ein Kind geschehen, dessen Eltern der FOTO-NUTZUNG
--     NICHT zugestimmt haben. Die Markierung ist keine Veroeffentlichung; sie
--     ist die Voraussetzung dafuer, ein Foto ueberhaupt einer Person zuordnen
--     und es dann — je nach Einwilligung — zeigen ODER eben verbergen zu
--     koennen. Wer das Markieren an die Einwilligung baende, koennte ein Foto
--     ohne Einwilligung nie gezielt AUS einem Profil heraushalten, weil er gar
--     nicht wuesste, dass die Person drauf ist.
--
--   ANZEIGEN auf dem Profil ist an die EINWILLIGUNG gebunden, NICHT an die
--     Rolle. Ein markiertes Foto erscheint im (vereinsinternen) Profil einer
--     Person NUR, wenn fuer sie eine wirksame Einwilligung 'photos_internal'
--     vorliegt (app.effective_consents, Zweck aus 0039/0034). Liegt keine vor,
--     erscheint es NICHT — auch nicht fuer Staff. Die Anzeige-Wache ist die
--     Einwilligung, kein Rollenrang. Deshalb liegt sie in der ABRUF-Projektion
--     (services/api/routes/photo-tags.ts) UND — als zweite Linie — in einer
--     definer-Funktion, die den Einwilligungsstand rollenunabhaengig kennt.
--
-- Belegt in supabase/tests/sql/99i_foto_markierung.sql: markieren OHNE
-- Einwilligung GELINGT (Zeile liegt vor), ANZEIGEN OHNE Einwilligung liefert
-- 0 Zeilen — auch fuer den owner.
--
-- ============================================================================
-- WER DARF MARKIEREN — Staff, aber OHNE Kasse. Begruendung.
-- ============================================================================
-- Markieren ist kuratorische Arbeit am Bildbestand: dieselbe Personengruppe,
-- die die Galerie pflegt (COACH_ROLES / is_club_trainer): owner, admin,
-- moderator, coach, guest_coach. Der KASSENWART (treasurer) ist bewusst NICHT
-- dabei: sein Aufgabenkreis ist Finanzen und Mitgliederverwaltung, nicht die
-- inhaltliche Frage "wer ist auf diesem Foto". Eine Markierung beruehrt
-- Identitaetsdaten — bei KINDERN im Zweifel strenger: kein Recht ohne
-- fachlichen Bedarf. Die Galerie-Schreibpolitik (0012) zieht dieselbe Grenze
-- (coach/guest_coach ja, treasurer nein) — hier wird nichts erfunden, nur die
-- vorhandene Kuratoren-Grenze auf die Markierung uebertragen.
--
-- ============================================================================
-- MANDANTENSICHERHEIT — zusammengesetzte Fremdschluessel, kein Trigger.
-- ============================================================================
-- Wie in 0022/0039 nachgeholt: (member_id, club_id) und
-- (tagged_by_member_id, club_id) zeigen auf app.club_members (id, club_id)
-- (Unique club_members_id_club_uq, 0022:178); (gallery_item_id, club_id) zeigt
-- auf app.gallery_items (id, club_id). Damit ist ein Foto-Tag NIE ueber
-- Vereinsgrenzen hinweg konstruierbar — deklarativ, nicht umgehbar, ohne
-- Wettlauf-Luecke. Fuer gallery_items fehlte der zusammengesetzte Unique bisher;
-- er wird hier angelegt (er widerspricht keinem Bestand: id ist bereits PK).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Voraussetzung fuer den zusammengesetzten FK auf die Galerie.
-- ----------------------------------------------------------------------------
create unique index gallery_items_id_club_uq on app.gallery_items (id, club_id);

-- ----------------------------------------------------------------------------
-- 1. app.has_internal_photo_consent — die ANZEIGE-WACHE, rollenunabhaengig.
--
-- SECURITY DEFINER ist hier notwendig und nicht Beiwerk: die Frage "liegt fuer
-- diese Person eine wirksame 'photos_internal'-Einwilligung vor?" muss FUER
-- JEDEN Betrachter DIESELBE Antwort geben. app.effective_consents ist
-- security_invoker und consents_select (0034) zeigt einem einfachen Mitglied
-- die FREMDE Einwilligung NICHT — liefe die Pruefung unter dem Recht des
-- Betrachters, saehe ein Mitglied das eingewilligte Foto einer anderen Person
-- NICHT, obwohl die Einwilligung vorliegt. Als definer laeuft der Blick auf
-- effective_consents mit den Rechten des Eigentuemers (postgres) und kennt den
-- WAHREN Stand. Genau ein Begriff von "eingewilligt", fuer alle gleich.
-- ----------------------------------------------------------------------------
create or replace function app.has_internal_photo_consent(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.effective_consents ec
    where ec.member_id = p_member_id
      and ec.purpose = 'photos_internal'
      and ec.effective
  )
$$;

comment on function app.has_internal_photo_consent(uuid) is
  'Liegt fuer dieses Mitglied eine WIRKSAME Einwilligung "photos_internal" vor (app.effective_consents, inkl. Widerruf + 16.-Geburtstag-Ablauf aus 0039)? Die ANZEIGE eines markierten Fotos auf dem Profil haengt AUSSCHLIESSLICH hieran, nicht an der Rolle des Betrachters. SECURITY DEFINER, damit die Antwort fuer jeden Betrachter gleich ist (consents_select wuerde sie sonst rollenabhaengig verfaelschen).';

-- ----------------------------------------------------------------------------
-- 2. app.photo_tags
-- ----------------------------------------------------------------------------
create table app.photo_tags (
  id                  uuid        primary key default app.uuid_v7(),
  club_id             uuid        not null references app.clubs (id) on delete cascade,
  gallery_item_id     uuid        not null,
  member_id           uuid        not null,   -- WER ist auf dem Bild
  tagged_by_member_id uuid        not null,   -- WER hat markiert (Staff)
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  -- Mandantensicherheit: die drei Bezuege muessen im SELBEN Verein liegen.
  constraint photo_tags_item_club_fk
    foreign key (gallery_item_id, club_id) references app.gallery_items (id, club_id)
    on delete cascade,
  constraint photo_tags_member_club_fk
    foreign key (member_id, club_id) references app.club_members (id, club_id)
    on delete cascade,
  constraint photo_tags_tagger_club_fk
    foreign key (tagged_by_member_id, club_id) references app.club_members (id, club_id)
    on delete cascade
);

comment on table app.photo_tags is
  'Markierung "diese Person ist auf diesem Galerie-Bild". MARKIEREN = Staff (kuratorisch, auch fuer nicht-eingewilligte Kinder). ANZEIGEN auf dem Profil = nur bei wirksamer Einwilligung "photos_internal" (app.has_internal_photo_consent) — an die Einwilligung gebunden, nicht an die Rolle. Soft-Delete (deleted_at): der/die Markierte, ein Vormund ODER Staff koennen die Markierung entfernen.';
comment on column app.photo_tags.member_id is
  'Die markierte Person als Vereinsmitglied. Die Markierung als solche setzt KEINE Einwilligung voraus (Metadatum); erst die ANZEIGE tut es.';
comment on column app.photo_tags.tagged_by_member_id is
  'Die markierende Staff-Person (Nachweis, wer die Zuordnung getroffen hat).';

-- Eine AKTIVE Markierung je (Bild, Person). Partiell (deleted_at is null), damit
-- eine entfernte Markierung spaeter erneut gesetzt werden kann — der Wortlaut
-- des Auftrags UNIQUE(gallery_item_id, member_id) gilt fuer die geltende Zeile.
create unique index photo_tags_active_uq
  on app.photo_tags (gallery_item_id, member_id)
  where deleted_at is null;

create index photo_tags_member_idx on app.photo_tags (member_id) where deleted_at is null;
create index photo_tags_item_idx   on app.photo_tags (gallery_item_id) where deleted_at is null;
create index photo_tags_club_idx   on app.photo_tags (club_id);

alter table app.photo_tags enable row level security;

-- DELETE wird NICHT an authenticated erteilt: das Entfernen ist ein Soft-Delete
-- (UPDATE deleted_at). Hartes Loeschen bleibt privilegierten Pfaden (Erasure)
-- vorbehalten, wie bei den uebrigen Sync-Tabellen.
grant select, insert, update on app.photo_tags to authenticated;

-- ----------------------------------------------------------------------------
-- 2a. SELECT — zwei getrennte Sichtbarkeiten in EINER Policy:
--     * VERWALTUNG (rollenunabhaengig von der Einwilligung): Staff sowie die
--       markierte Person selbst / ein Vormund (can_act_for_member) sehen die
--       Markierung IMMER — sonst koennte niemand sie entfernen (Art. 17), auch
--       ohne Einwilligung.
--     * ANZEIGE fuer alle uebrigen Mitglieder: nur wenn eine wirksame
--       Einwilligung "photos_internal" vorliegt.
-- Die ABRUF-Projektion fuers Profil (photo-tags.ts) filtert die Einwilligung
-- ZUSAETZLICH hart — damit gilt die Einwilligungs-Bindung auch fuer Staff auf
-- dem Profil, obwohl deren Verwaltungs-Sicht hier breiter ist.
-- ----------------------------------------------------------------------------
create policy photo_tags_select on app.photo_tags
  for select to authenticated
  using (
    app.is_club_member(club_id)
    and (
      app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach', 'guest_coach'])
      or app.can_act_for_member(member_id)
      or app.has_internal_photo_consent(member_id)
    )
  );

comment on policy photo_tags_select on app.photo_tags is
  'Staff und die markierte Person/Vormund sehen die Markierung immer (Verwaltung/Entfernen). Alle uebrigen Mitglieder nur bei wirksamer Einwilligung "photos_internal". Die Profil-ANZEIGE (photo-tags.ts) bindet die Einwilligung zusaetzlich hart — auch fuer Staff.';

-- ----------------------------------------------------------------------------
-- 2b. INSERT (markieren) — NUR Staff (ohne Kasse), und tagged_by MUSS die
--     eigene Mitgliedszeile sein. KEINE Einwilligungspruefung: markieren ist
--     ein Metadatum (siehe Kopf).
-- ----------------------------------------------------------------------------
create policy photo_tags_insert on app.photo_tags
  for insert to authenticated
  with check (
    app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach', 'guest_coach'])
    and exists (
      select 1
      from app.club_members m
      where m.id = app.photo_tags.tagged_by_member_id
        and m.club_id = app.photo_tags.club_id
        and m.profile_id = auth.uid()
        and m.deleted_at is null
    )
  );

comment on policy photo_tags_insert on app.photo_tags is
  'Markieren nur Staff (owner/admin/moderator/coach/guest_coach — bewusst OHNE treasurer). tagged_by_member_id muss die eigene Mitgliedszeile sein. Ausdruecklich KEINE Einwilligungspruefung: markieren ist ein Metadatum und darf auch fuer nicht-eingewilligte Kinder geschehen (die ANZEIGE ist das, was verborgen bleibt).';

-- ----------------------------------------------------------------------------
-- 2c. UPDATE (Soft-Delete/Entfernen) — der/die Markierte, ein Vormund ODER
--     Staff. can_act_for_member deckt "die betroffene Person selbst oder ein
--     eingetragener Vormund" bereits ab (0002).
-- ----------------------------------------------------------------------------
create policy photo_tags_update on app.photo_tags
  for update to authenticated
  using (
    app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach', 'guest_coach'])
    or app.can_act_for_member(member_id)
  )
  with check (
    app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach', 'guest_coach'])
    or app.can_act_for_member(member_id)
  );

comment on policy photo_tags_update on app.photo_tags is
  'Entfernen (Soft-Delete deleted_at) durch die markierte Person, einen eingetragenen Vormund (can_act_for_member) ODER Staff. Der Vormund braucht KEINE Einwilligung, um die Markierung des Kindes zu sehen und zu entfernen — die Verwaltungs-SELECT-Policy zeigt sie ihm.';

commit;
