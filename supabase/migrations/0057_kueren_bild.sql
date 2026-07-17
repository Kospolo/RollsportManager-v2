-- ============================================================================
-- 0057_kueren_bild.sql — Ein Bild fuer die Kuer (Trupp 3 B)
--
-- AUSGANGSLAGE (selbst geprueft): app.routines (0004) hat audio_asset_id, aber
-- KEIN Bild-Feld — grep image_asset = 0 Treffer. Die Kuer soll auf dem Profil
-- ein Bild zeigen, WENN vorhanden; sonst der schoene Normalfall (Web-Phase).
-- Diese Migration liefert NUR das Feld; die Sichtbarkeit der Kuer bleibt
-- unveraendert (app.can_read_routine, 0026).
--
-- Genau wie audio_asset_id: uuid NULL -> app.media_assets, on delete set null.
-- Keine neue Policy, keine Aenderung an can_read_routine — das Bild teilt die
-- Sichtbarkeit seiner Kuer (wer die Kuer sieht, sieht ihr Bild; die Bytes
-- liegen wie immer ausserhalb der DB, media_assets haelt nur die Referenz).
-- ============================================================================

begin;

alter table app.routines
  add column image_asset_id uuid references app.media_assets (id) on delete set null;

comment on column app.routines.image_asset_id is
  'Optionales Bild der Kuer (app.media_assets, wie audio_asset_id). Die Kuer zeigt es auf dem Profil, wenn vorhanden; sonst der Normalfall. Sichtbarkeit unveraendert (app.can_read_routine, 0026): das Bild folgt der Kuer, hat keine eigene Policy.';

commit;
