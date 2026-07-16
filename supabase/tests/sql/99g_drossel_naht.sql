-- ===========================================================================
-- 99g — DIE NAHT ZWISCHEN 0037 (N Codes) UND 0038 (F5).
--
-- Warum dieser Test existiert: Trupp 2 und Trupp 3 hatten beide recht, und
-- zusammen ergaben sie einen Fehler, den KEINER von beiden sehen konnte —
-- jeder hatte nur seine eigene Migration im Baum:
--
--   * 0037 macht app.club_join_codes zur Wahrheit. Nach einer Rotation mit
--     Ueberlappung ist der ALTE Code weiter einloesbar, steht aber nicht mehr
--     in app.clubs.join_code (dort liegt der juengste).
--   * 0038/F5 fragte app.clubs, ob ein Code echt ist -> der noch gueltige
--     Alt-Code galt als RATEVERSUCH und fuellte die code-Achse. Nach 20
--     ehrlichen Anmeldungen mit dem Aushang-Code: global gesperrt. Genau der
--     Selbst-DoS, den F5 abschaffen sollte.
--
-- 0042 laesst F5 dieselbe Tabelle fragen wie den Einloeser.
-- ===========================================================================

begin;
set local role service_role;

-- Ausgangslage: ein Verein, zwei gleichzeitig gueltige Codes. Genau das, was
-- 0037s Ueberlappungsfenster erzeugt (rotate mit overlap_hours).
insert into app.clubs (id, name, city, short_name, discipline, join_code)
values ('c1ab0000-0000-4000-8000-0000000000f1', 'RSV Nahtstelle', 'Testheim', 'RSVN',
        'rollkunstlauf', 'NEUE-CODE');

-- Der ALTE Code: noch 24h gueltig, aber NICHT mehr die Spalte auf app.clubs.
insert into app.club_join_codes (club_id, code, code_normalized, expires_at, label)
values ('c1ab0000-0000-4000-8000-0000000000f1', 'ALTE-CODE',
        app.normalize_join_code('ALTE-CODE'), now() + interval '24 hours', 'Aushang Halle');

-- ---------------------------------------------------------------------------
-- (a) Der ALTE, noch gueltige Code ist KEIN Rateversuch.
--
-- Das ist der Kern. Vor 0042 lieferte derselbe Aufruf allowed=true, legte aber
-- eine Zaehlerzeile an — und die 21. ehrliche Anmeldung war gesperrt.
-- ---------------------------------------------------------------------------
select testkit.is_eq(
  'Naht 0037/0038: der ueberlappende ALTE Code zaehlt NICHT als Rateversuch',
  (select count(*) from internal.auth_rate_limits
    where scope = 'code'
      and identifier = 'probe-alt'),
  0);

select internal.rate_limit_hit('code', 'probe-alt', 20, interval '1 hour',
                               app.normalize_join_code('ALTE-CODE'));

select testkit.is_eq(
  'Naht 0037/0038: nach dem Aufruf steht NICHTS auf der code-Achse (F5 greift auch fuer den Alt-Code)',
  (select count(*) from internal.auth_rate_limits
    where scope = 'code' and identifier = 'probe-alt'),
  0);

-- ---------------------------------------------------------------------------
-- (b) Der NEUE Code natuerlich auch nicht (das ging schon vor 0042 —
--     Gegenprobe, damit (a) nicht bloss "F5 ist ganz aus" beweist).
-- ---------------------------------------------------------------------------
select internal.rate_limit_hit('code', 'probe-neu', 20, interval '1 hour',
                               app.normalize_join_code('NEUE-CODE'));
select testkit.is_eq(
  'Naht 0037/0038: der juengste Code zaehlt weiterhin nicht',
  (select count(*) from internal.auth_rate_limits
    where scope = 'code' and identifier = 'probe-neu'),
  0);

-- ---------------------------------------------------------------------------
-- (c) DER BOTSCHUTZ IST UNVERAENDERT. Ein geratener Code steht in KEINER
--     Tabelle und wird gezaehlt — sonst haette 0042 die Drossel abgeschafft
--     statt sie zu reparieren.
-- ---------------------------------------------------------------------------
select internal.rate_limit_hit('code', 'probe-raten', 20, interval '1 hour',
                               app.normalize_join_code('ZZZZ-ZZZZ'));
select testkit.is_eq(
  'Naht 0037/0038: ein GERATENER Code zaehlt weiterhin (der Botschutz bleibt)',
  (select coalesce(sum(attempts), 0) from internal.auth_rate_limits
    where scope = 'code' and identifier = 'probe-raten'),
  1);

-- ---------------------------------------------------------------------------
-- (d) Ein WIDERRUFENER Code ist kein Freifahrtschein: wer ihn schickt, raet
--     (aus Sicht der Drossel) — und wird gezaehlt.
-- ---------------------------------------------------------------------------
insert into app.club_join_codes (club_id, code, code_normalized, revoked_at)
values ('c1ab0000-0000-4000-8000-0000000000f1', 'TOTE-CODE',
        app.normalize_join_code('TOTE-CODE'), now());
select internal.rate_limit_hit('code', 'probe-tot', 20, interval '1 hour',
                               app.normalize_join_code('TOTE-CODE'));
select testkit.is_eq(
  'Naht 0037/0038: ein WIDERRUFENER Code zaehlt (er ist nicht einloesbar)',
  (select coalesce(sum(attempts), 0) from internal.auth_rate_limits
    where scope = 'code' and identifier = 'probe-tot'),
  1);

-- ---------------------------------------------------------------------------
-- (e) Ein ABGELAUFENER Code ebenso — dieselbe Bedingung wie beim Einloeser.
-- ---------------------------------------------------------------------------
insert into app.club_join_codes (club_id, code, code_normalized, expires_at)
values ('c1ab0000-0000-4000-8000-0000000000f1', 'ALTX-CODE',
        app.normalize_join_code('ALTX-CODE'), now() - interval '1 minute');
select internal.rate_limit_hit('code', 'probe-abgelaufen', 20, interval '1 hour',
                               app.normalize_join_code('ALTX-CODE'));
select testkit.is_eq(
  'Naht 0037/0038: ein ABGELAUFENER Code zaehlt (deckungsgleich mit dem Einloeser)',
  (select coalesce(sum(attempts), 0) from internal.auth_rate_limits
    where scope = 'code' and identifier = 'probe-abgelaufen'),
  1);

rollback;
