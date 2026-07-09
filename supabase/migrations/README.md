# supabase/migrations

Später: das EINZIGE Migrationswerkzeug für das v2-Schema (englisch, snake_case, UUIDv7, `amount_cents BIGINT`, TIMESTAMPTZ/UTC, Soft-Deletes auf Sync-Tabellen).

Regeln:
- Nie Ad-hoc-FIX-SQL direkt auf der Datenbank.
- Jede Migration läuft im CI als Dry-Run gegen eine Shadow-DB.
- RLS-Policies nur nach dem Policy-Template (Claims aus `auth.jwt()->'club_roles'`), pgTAP-Tests Pflicht.
