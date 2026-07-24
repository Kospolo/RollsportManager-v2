-- 0078 — Rechtstexte: der Betreiber-Blob ist LEER, bis der Betreiber ihn füllt.
--
-- === WARUM DIESE MIGRATION EINEN TEXT LÖSCHT ===
-- 0019 hat internal.platform_settings.legal mit Platzhaltern befüllt
-- ("Platzhalter Impressum — im Betreiber-Bereich pflegen."). Das war gedacht
-- als Hinweis im Betreiber-Editor. Ab jetzt ist es aber ein PROBLEM:
--
-- Die öffentlichen Seiten (/impressum, /datenschutz, /agb) zeigen künftig den
-- Betreiber-Blob, WENN er gefüllt ist, und sonst einen eingebauten, rechtlich
-- vollständigen Standardtext (apps/web LegalPage DEFAULT_LEGAL, aus v1
-- übernommen). Ein nicht-leerer Platzhalter würde diesen Standardtext
-- überschreiben — und "Platzhalter Impressum" stünde öffentlich auf einer
-- Seite, die nach § 5 TMG korrekt sein muss.
--
-- Leer bedeutet also NICHT "kein Impressum", sondern "zeig den eingebauten,
-- gepflegten Text". Der Betreiber überschreibt ihn nur, wenn er etwas Eigenes
-- eintragen will.
--
-- === NICHT-DESTRUKTIV ===
-- Zurückgesetzt wird NUR, was noch der Platzhalter aus 0019 ist. Hat der
-- Betreiber bereits einen eigenen Text eingetragen, bleibt der unangetastet.
-- Deshalb der like-Filter statt eines pauschalen Überschreibens.
begin;

update internal.platform_settings
   set legal = '{}'::jsonb,
       updated_at = now()
 where id = 1
   and coalesce(legal->>'impressum', '') like 'Platzhalter%';

comment on column internal.platform_settings.legal is
  'Rechtstexte-OVERRIDE des Betreibers (JSON). Schlüssel: impressum, impressumEn, '
  'datenschutz, datenschutzEn, agb, agbEn — je ein Markdown-Text. LEER ODER FEHLEND '
  'bedeutet: die öffentliche Seite zeigt den eingebauten Standardtext (LegalPage '
  'DEFAULT_LEGAL). Ein gesetzter Wert überschreibt den Standard für genau dieses '
  'Dokument und diese Sprache. Öffentlich lesbar über GET /public/legal (nur dieser '
  'Blob, keine anderen Einstellungen); geschrieben nur von is_platform_admin über '
  'PATCH /platform/settings.';

commit;
