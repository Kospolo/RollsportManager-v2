-- ============================================================================
-- 0060_vereinslogo.sql — Ein Logo fuer den Verein.
--
-- AUSGANGSLAGE (selbst geprueft): app.clubs (0002) hat KEIN Logo-Feld — die
-- Spalten sind id, name, short_name, city, discipline, founded_year, join_code,
-- settings, ... Die Shell zeigt heute die Initialen ("RSV"). Es gibt keine
-- Logo-Upload-UI.
--
-- === WARUM logo_asset_id (uuid -> media_assets) UND NICHT logo_key text ===
-- Exakt das Muster von app.routines.audio_asset_id / image_asset_id (0004/0057):
-- eine uuid-Referenz auf app.media_assets, on delete set null. Gruende:
--   * media_assets traegt club_id, mime_type, size, created_by, deleted_at —
--     ein blosser text-Key traegt nichts davon und muesste alles nebenher
--     erfinden. Die Referenz-Bauform ist im Repo etabliert und getestet.
--   * Der storage_key wird SERVERSEITIG erzeugt (generateStorageKey) und die
--     media_assets-Zeile mit club_id = der eigene Verein angelegt (nie vom
--     Client). Das ist genau die Lehre aus dem Kueren-Medien-Leck (Revert
--     6dafb38): ein client-gelieferter Key liess fremde Bytes referenzieren.
--     Ein text-Feld am Verein waere die Rueckkehr genau dieses Fehlers.
--
-- === SICHTBARKEIT ===
-- Das Feld traegt nur die Referenz. Die Bytes liegen wie immer ausserhalb der DB
-- (MEDIA_DIR / Objektspeicher). Ein Vereinslogo ist ein OEFFENTLICHES
-- Marken-Asset — es steht in der Shell jedes Mitglieds, in der Betreiber-
-- Vereinsliste und (potenziell) auf Login/Landing. Es wird deshalb ueber eine
-- EIGENE, schmale, oeffentliche Route ausgeliefert (GET /public/clubs/{id}/logo,
-- modules/media/club-logo.ts), die AUSSCHLIESSLICH das Logo-Asset aufloest und
-- KEIN anderes Medium erreichbar macht. media_assets_select (is_club_member,
-- 0004) bleibt unangetastet — Kinderfotos & Co. werden dadurch NICHT geoeffnet.
-- ============================================================================

begin;

alter table app.clubs
  add column logo_asset_id uuid references app.media_assets (id) on delete set null;

comment on column app.clubs.logo_asset_id is
  'Optionales Vereinslogo (app.media_assets, wie routines.audio_asset_id). Wird serverseitig gesetzt (Upload direkt, kein Client-Key). Ausgeliefert ueber die schmale, oeffentliche Route GET /public/clubs/{id}/logo, die NUR das Logo aufloest — media_assets_select (is_club_member) bleibt unveraendert, kein anderes Medium wird dadurch oeffentlich.';

-- ----------------------------------------------------------------------------
-- Spaltenrecht (die Falle aus 0035): app.clubs ist fuer authenticated seit 0035
-- eine POSITIVLISTE — eine neu hinzugefuegte Spalte erbt KEIN Leserecht und ist
-- unsichtbar, bis sie hier eingetragen wird (99e_join_code_column_privilege.sql
-- nagelt die Liste fest). logo_asset_id ist KEIN Geheimnis (nur eine Referenz
-- auf ein oeffentliches Marken-Asset) und MUSS lesbar sein: GET /clubs liefert
-- es mit (clubSchema), damit die Oberflaeche Logo-vorhanden von Initialen
-- unterscheiden kann. Also: Leserecht erteilen. UPDATE bleibt Tabellenrecht
-- (0035) — das Setzen laeuft ueber POST/DELETE /clubs/{id}/logo unter der
-- clubs_update-RLS (owner/admin).
grant select (logo_asset_id) on app.clubs to authenticated;

commit;
