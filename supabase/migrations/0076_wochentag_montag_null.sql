-- 0076 — Wochentag: 0 = Montag. Verbindlich, nicht mehr implizit.
--
-- === WARUM DIESE MIGRATION KEINE SPALTE AENDERT ===
-- Der Wertebereich war nie falsch: `training_slots.weekday` traegt seit 0010 den
-- CHECK `between 0 and 6`, und Web sowie API rechnen bereits mit 0 = Montag
-- (apps/web trainingsplan/helpers.ts:17 `(getDay() + 6) % 7`,
--  services/api/src/lib/validation.ts weekdaySchema).
-- Falsch war, dass es NIRGENDS geschrieben stand, wo eine andere Plattform es
-- lesen kann. Die generierten Swift-/Kotlin-Clients bekamen nur `Int` bzw.
-- `Long` ohne Bedeutung — der Wertebereich war fuer iOS/Android reine Vermutung.
--
-- Eine falsch geratene Konvention faellt nicht beim Kompilieren auf und auch
-- nicht im Test: der Wochenplan steht dann einfach einen Tag daneben, und der
-- Verein merkt es, wenn jemand zum falschen Training kommt. Deshalb steht die
-- Festlegung ab jetzt AN DER SPALTE — die Datenbank ist die einzige Stelle, die
-- alle vier Plattformen gemeinsam lesen.
--
-- Festgelegt von Marcel am 2026-07-23: „In Deutschland faengt die Woche immer
-- montags an." Das entspricht ISO 8601. Wer hier etwas aendert, aendert es fuer
-- Web, iOS, macOS und Android gleichzeitig — und muss JEDE Umrechnung mitziehen.
--
-- Umrechnung aus den Datums-APIs (die zaehlen unterschiedlich!):
--   JavaScript Date.getDay()          -> 0 = Sonntag  =>  (getDay() + 6) % 7
--   Swift Calendar .weekday           -> 1 = Sonntag  =>  (weekday + 5) % 7
--   Kotlin DayOfWeek.getValue()       -> 1 = Montag   =>  value - 1
--   Postgres extract(dow from ...)    -> 0 = Sonntag  =>  (dow + 6)::int % 7
--   Postgres extract(isodow from ...) -> 1 = Montag   =>  isodow - 1
begin;

comment on column app.training_slots.weekday is
  'Wochentag des Trainings: 0 = Montag, 1 = Dienstag, 2 = Mittwoch, 3 = Donnerstag, '
  '4 = Freitag, 5 = Samstag, 6 = Sonntag (ISO 8601 — die Woche beginnt montags; '
  'Festlegung Marcel 2026-07-23). NICHT die JS-Zaehlung (dort 0 = Sonntag): aus '
  'Date.getDay() umrechnen mit (getDay() + 6) % 7. In Postgres liefert '
  'extract(isodow from datum) - 1 direkt diesen Wert.';

commit;
