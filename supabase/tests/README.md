# supabase/tests — SQL-Sicherheits-Testsuite (RLS / Mandanten / GoBD)

Reine SQL-Testsuite gegen das v2-Schema. Sie stellt strukturell sicher, dass
**genau die drei v1-Katastrophenklassen** aus dem Security-Audit
(`blueprint/research/08-security-audit.md`) in v2 unmoeglich sind:

1. **Selbst-Befoerderung** (v1-F2: Mitglied setzt eigene Rolle auf `admin`/`super_admin`)
2. **Lesbare/schreibbare Secrets & Lizenzen** (v1: `activate_premium` fuer alle → Selbst-Lizenzierung)
3. **Fehlende Mandanten-Trennung** (Fremd-Verein-Daten sichtbar)

Zusaetzlich: Gasttrainer-Ablauf, Finanz-Sichtbarkeit, GoBD-Unveraenderlichkeit,
Eltern/Kind-Rechte, `anon` sieht nichts.

## Ausfuehren

```bash
supabase/tests/run-tests.sh
```

Das Script

- startet ueber die **gemeinsame Harness-Lib**
  `supabase/scripts/lib/pg-harness.sh` (genutzt von `db-test.sh`,
  `run-tests.sh` und `services/api/scripts/api-db-test.sh`) einen
  **Wegwerf-Container** `rsm2-pg-test` (`postgres:16-alpine`,
  `127.0.0.1:55432`, `--rm`),
- installiert den minimalen Supabase-Shim (`auth`-Schema, `auth.uid()`,
  `auth.jwt()`, Rollen `anon`/`authenticated`/`service_role`),
- spielt **alle** Migrationen aus `supabase/migrations` + `supabase/seed/seed.sql`
  in eine **frische** DB ein,
- fuehrt die Suiten aus `supabase/tests/sql/*.sql` in Reihenfolge aus,
- **entfernt den Container IMMER** (bash-`trap` auf `EXIT`), auch bei Fehler.

Keine lokale Postgres-/psql-Installation noetig (alles laeuft `docker exec`).
Der Container heisst immer `rsm2-pg-test` — **niemals** werden andere
(Produktions-)Container angefasst. `run-tests.sh` und `db-test.sh` teilen sich
den Containernamen und duerfen daher nicht gleichzeitig laufen.

### Ausgabeformat (TAP-artig)

Jeder Test meldet `ok N - <Beschreibung>`. Ein Fehlschlag bricht per
`RAISE EXCEPTION 'not ok N - ... >> <Detail>'` und `ON_ERROR_STOP` sofort ab;
das Script endet mit Exit-Code ≠ 0. Am Ende steht der TAP-Plan `1..N` und eine
Konsistenzpruefung (gedruckte Anzahl == `testkit.test_no`-Sequenz).

**Aktueller Stand: 155 Tests, alle gruen.**

## Aufbau

| Datei | Zweck |
|---|---|
| `sql/00_testkit.sql` | Assertion-Helfer im Schema `testkit` (`ok`, `is_eq`, `throws`, `succeeds`, `affects`). INVOKER-Rechte → laufen wirklich als die gesetzte Rolle. |
| `sql/01_fixture_club_b.sql` | Zweiter Mandant „SC Beispielstadt" (`deadbeef-…`) mit je ≥1 Zeile in **jeder** Mandantentabelle — Grundlage der Isolationstests. |
| `sql/10_tenant_isolation.sql` | Testklasse **(a)** Mandanten-Isolation |
| `sql/20_privilege_escalation.sql` | Testklasse **(b)** Rechteausweitung |
| `sql/30_guest_coach_expiry.sql` | Testklasse **(c)** Gasttrainer nach `valid_until` |
| `sql/40_finance.sql` | Testklasse **(d)** Finanz-Sichtbarkeit/Schreibschutz |
| `sql/50_entitlements_platform.sql` | Testklasse **(e)** Entitlements + Produktkatalog |
| `sql/60_anon_and_internal.sql` | Testklasse **(f)** `anon` + `internal`-Schema |
| `sql/70_guardianship.sql` | Testklasse **(g)** Eltern/Kind (`guardianships`) |
| `sql/80_gobd_immutability.sql` | Testklasse **(h)** GoBD-Unveraenderlichkeit |

Jeder Testfall setzt `request.jwt.claims` per `set_config(..., true)` und
`SET LOCAL ROLE` (verschiedene Seed-User) in einem eigenen `BEGIN … ROLLBACK`,
sodass die DB zwischen den Faellen unveraendert bleibt.

## Was jede Testklasse absichert

### (a) Mandanten-Isolation — `10_tenant_isolation.sql`
Ein Mitglied von Verein A sieht **null** Zeilen von Verein B — geprueft auf
**allen 18 Mandantentabellen** plus `clubs`, `profiles`, `entitlements`, und in
**beide Richtungen** (A→B als Mitglied, B→A sogar als `owner`). Positiv-Kontrolle:
der Club-B-Owner sieht seine eigenen Daten korrekt.

### (b) Rechteausweitung — `20_privilege_escalation.sql`
Die v1-Kernluecke. Geprueft:
- Mitglied `UPDATE` eigene `role` → **stiller No-op** (0 Zeilen, RLS-`WITH CHECK`).
- Mitglied `INSERT` in eigenen/fremden Roster → **abgelehnt** (RLS `42501`; Owner-Zeile zusaetzlich Trigger `P0001`).
- Admin aendert **eigene** Rolle → **abgelehnt** (Trigger `P0001`).
- Admin fasst Owner-Zeilen an / vergibt `owner` per `UPDATE` **oder** `INSERT` → **abgelehnt**.
- `club_id` ist immutabel (auch fuer Superuser).
- Positiv: Admin darf Nicht-Owner verwalten; Owner darf Zweit-Owner ernennen; `service_role` (API-Schicht, kein `sub`-Claim) darf Rollen setzen.

### (c) Gasttrainer-Ablauf — `30_guest_coach_expiry.sql`
`guest_coach` mit gueltiger Mitgliedschaft: Zugriff + Anwesenheit/Marker
schreiben. Nach `valid_until` in der Vergangenheit **oder** `status='left'` —
bei **identischen** JWT-Claims — verschwindet jeglicher Zugriff (serverseitig in
`is_club_member`/`has_club_role` erzwungen, nicht nur ueber Claims).

### (d) Finanzen — `40_finance.sql`
Mitglied sieht nur **eigene** Rechnungen, nie das Kassenbuch, und kann nichts
Finanzielles schreiben. Coach: keine Finanz-Sicht. Treasurer: volle Sicht +
legitime Schreibvorgaenge (Rechnung, Kassenbuch, Storno, Mahnstufe). Der
Rechnungsnummern-Generator ist ausschliesslich `service_role`; die
Zaehlertabelle ist fuer Clients unsichtbar (kein `COUNT(*)+1`-Race wie v1).

### (e) Entitlements/Plattform — `50_entitlements_platform.sql`
Die v1-Selbst-Lizenzierungs-Luecke. `authenticated` kann Entitlements
**niemals** schreiben (auch nicht als Owner) — `INSERT/UPDATE/DELETE` `42501`.
Lesen nur eigene Profil-Zeile bzw. Zeilen des eigenen Vereins. Produktkatalog
read-only, inaktive Produkte versteckt. Nur `service_role` (Webhook-Dienst)
schreibt.

### (f) `anon` + `internal` — `60_anon_and_internal.sql`
`anon` hat **kein** `USAGE` auf `app` → jeder Zugriff `42501` (nicht nur leere
Ergebnisse). `authenticated` ohne `club_roles`-Claims: leere Ergebnisse, keine
Lecks. `internal.webhook_events` ist fuer alle Client-Rollen unsichtbar.

### (g) Eltern/Kind — `70_guardianship.sql`
Eltern sehen/handeln fuer **eigene** Kinder (RSVP, Rechnungen des Kindes) via
`guardianships`, nie fuer fremde Kinder. Niemand kann sich selbst ein fremdes
Kind zuweisen oder bestehende Beziehungen umbiegen. Anwesenheit bleibt
Coaching-Sache (Eltern duerfen nicht). Admin verwaltet legitim.

### (h) GoBD-Unveraenderlichkeit — `80_gobd_immutability.sql`
Kassenbuch (`ledger_entries`) ist append-only: `UPDATE`/`DELETE` scheitern fuer
**jede** Rolle inkl. `service_role` (`BYPASSRLS`) und Superuser (Trigger
`P0001`); fuer Clients zusaetzlich Grant-Ebene (`42501`). Ausgestellte
Rechnungen sind nicht loeschbar (nur Entwuerfe). Korrektur nur ueber
Storno-Zeile (`reverses_entry_id`).

## Gefundene + gefixte Schema-Luecke

**INSERT-Owner-Luecke (in `0002_identity_tenancy.sql` behoben).**
Der Trigger `protect_club_membership` deckte urspruenglich nur `UPDATE` ab. Ein
`admin` (der laut RLS-`WITH CHECK` in den eigenen Verein `INSERT`en darf) konnte
so eine **brandneue Zeile mit `role='owner'`** anlegen — Rechteausweitung durch
die Hintertuer (v1-Klasse F2). Fix: die Funktion behandelt jetzt auch `INSERT`
(`tg_op = 'INSERT'` → nur Owner duerfen Owner-Zeilen anlegen), zusaetzlicher
Trigger `club_members_protect_insert`. `service_role` (kein `sub`-Claim) bleibt
ausgenommen; der API-Member-Create-Flow (`services/api`) laeuft unveraendert
gruen (`npm run db:test`).

## Kompatibilitaet

Nach dem Fix laufen **alle drei** Harnesse gruen:
`supabase/tests/run-tests.sh` (155), `supabase/scripts/db-test.sh` (Schema/Seed),
`services/api` → `npm run db:test` (API-Smoke).
