-- =============================================================================
-- dev-legal-texts.sql — Rechtstext-FASSUNGEN nur fuer den DEV-STACK.
--
-- Angewendet ausschliesslich von scripts/dev-stack.sh, NICHT von seed.sql.
--
-- WARUM NICHT IN seed.sql (das waere der naheliegende Ort):
-- Seit 0039 schreiben POST /clubs und POST /clubs/join keine
-- terms/privacy-Zeilen mehr in app.consents (das war rechtlich falsch: terms =
-- Vertrag, privacy = Informationspflicht — in beides willigt man nicht ein).
-- Sie erfassen eine KENNTNISNAHME in app.policy_acknowledgements, und die
-- zeigt per NOT NULL auf eine unveraenderliche Fassung in
-- internal.legal_documents. Ohne Fassung gibt es ein ehrliches 409 statt einer
-- Anmeldung, die hinterher nichts belegt (Art. 7 Abs. 1 DSGVO).
--
-- Die Fassungen in seed.sql zu legen, haette einen BESTANDS-TEST GEBROCHEN —
-- nachgemessen, nicht vermutet:
--
--   supabase/tests/sql/99d_registrierung.sql:295-298
--     insert ... values ('privacy', 2, 'de', ...);
--     testkit.is_eq('... beide Fassungen existieren nebeneinander',
--       (select count(*) from internal.legal_documents
--         where kind = 'privacy' and locale = 'de'), 2);
--
-- 99d legt privacy/1/de und privacy/2/de SELBST an und erwartet danach GENAU
-- 2. Jede privacy/de-Zeile aus dem Seed macht daraus 3 (und privacy/1/de
-- zusaetzlich ein 23505 auf dem eigenen Insert des Tests). Dasselbe gilt fuer
-- terms/1/de (99d:311). Bestands-Tests werden nicht geaendert — also stehen
-- die Fassungen hier, wo nur der Dev-Stack sie sieht.
--
-- run-tests.sh und api-db-test.sh laden diese Datei NICHT:
--   * run-tests.sh   -> 99d bleibt gruen (es gibt keine Fremd-Fassungen)
--   * api-db-test.sh -> smoke.mjs faehrt POST /clubs/join gar nicht an
--
-- FUER PRODUKTION HEISST DAS: der Betreiber MUSS eigene Fassungen
-- veroeffentlichen, sonst antwortet die Anmeldung mit 409. Das ist Absicht
-- (fail-closed), kein Versehen — aber es ist eine echte Inbetriebnahme-Pflicht.
-- Einen Endpunkt dafuer gibt es noch nicht (siehe Bericht).
--
-- Der Wortlaut hier ist ein PLATZHALTER fuer die Entwicklung. Er ist bewusst
-- als solcher gekennzeichnet, damit ihn niemand fuer eine echte Erklaerung
-- haelt.
-- =============================================================================

insert into internal.legal_documents (kind, version, locale, title, body, content_hash)
values
  ('terms', 1, 'de', 'Nutzungsbedingungen (Entwicklungsfassung)',
   'PLATZHALTER — Entwicklungsfassung, keine echten Nutzungsbedingungen. '
   || 'Vor dem Produktivbetrieb durch den Betreiber zu ersetzen.',
   'dev-terms-de-v1'),
  ('terms', 1, 'en', 'Terms of use (development version)',
   'PLACEHOLDER — development version, not real terms of use. '
   || 'To be replaced by the operator before going live.',
   'dev-terms-en-v1'),
  ('privacy', 1, 'de', 'Datenschutzerklaerung (Entwicklungsfassung)',
   'PLATZHALTER — Entwicklungsfassung, keine echte Datenschutzerklaerung. '
   || 'Vor dem Produktivbetrieb durch den Betreiber zu ersetzen.',
   'dev-privacy-de-v1'),
  ('privacy', 1, 'en', 'Privacy policy (development version)',
   'PLACEHOLDER — development version, not a real privacy policy. '
   || 'To be replaced by the operator before going live.',
   'dev-privacy-en-v1')
on conflict (kind, locale, version) do nothing;
