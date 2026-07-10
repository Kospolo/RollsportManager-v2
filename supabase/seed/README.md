# supabase/seed

Seed-Daten für Entwicklung und Tests — **nur Dev/Staging, nie Prod** (legt Demo-Zeilen in `auth.users` an).

- `seed.sql`: Demo-Verein „RSV Neckarsulm", inhaltlich deckungsgleich mit den Portal-Mocks in `apps/web/lib/mock/` — 24 Mitglieder, 3 Teams, 15 Termine (relativ zu heute), 6 Küren mit Markern/Scores, 2 Wettkämpfe, 10 Rechnungen (offen = exakt 381,00 EUR), Kassenbuch, Produktkatalog + Beta-Entitlement.
- Ausführen: gegen eine frische DB nach allen Migrations, in **einer** psql-Session (nutzt eine `pg_temp`-Hilfsfunktion). Der Test-Harness `../scripts/db-test.sh` macht genau das automatisch.
- Noch offen: Test-Fixtures für pgTAP (zweiter Test-Verein für Mandanten-Isolationstests).
