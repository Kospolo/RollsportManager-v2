# supabase/migrations

Das EINZIGE Migrationswerkzeug für das v2-Schema (englisch, snake_case, UUIDv7, `amount_cents BIGINT`, TIMESTAMPTZ/UTC, Soft-Deletes auf Sync-Tabellen).

Stand (Phase 1):

- `0001_foundation.sql` — Schemas `app`/`api`/`internal`, Grants, `app.uuid_v7()`, `set_updated_at()`, JWT-Claim-Helper
- `0002_identity_tenancy.sql` — `clubs`, `profiles`, `club_members`, `guardianships`, RLS-Helper (`is_club_member`, `has_club_role`, `can_act_for_member`), Rollen-Schutz-Trigger
- `0003_teams_events.sql` — `teams`, `team_members`, `events`, `event_teams`, `event_rsvps`, `attendance`
- `0004_media_routines_competitions.sql` — `media_assets`, `routines`, `routine_skaters`, `routine_markers`, `competitions`, `competition_entries`, `routine_scores`
- `0005_finance.sql` — `invoice_counters` + `next_invoice_number()`, `invoices`, `ledger_entries` (append-only, GoBD)
- `0006_platform.sql` — `products`, `entitlements` (nur service-Role schreibbar), `internal.webhook_events`, `tasks`
- `0007_roles_moderator.sql` — Rolle `moderator` + Rechte-Matrix (Referenz §1), Capability-Helper, `protect_club_membership`
- `0008_modules_batch1.sql` — `news`, `notes`, `exercises`
- `0009_modules_batch2.sql` — `facilities`, `facility_bookings`, `equipment`, `equipment_reservations`, `achievements`
- `0010_modules_batch3.sql` — `training_slots`, `duty_requirements`, `duty_entries` (Trainingsplan/Pflichtstunden/Auswertung)
- `0011_modules_batch4.sql` — `chat_messages`, `checkins`, `regional_events`
- `0012_modules_batch5.sql` — `gallery_items`, `documents` (PRO-gated) + Helper `is_club_pro(club_id)`; Lesen = Mitglied + PRO, Schreiben = Trainer + PRO (Referenz §4 „PRO-Gating"). Bytes liegen ausserhalb der DB (`MEDIA_DIR`, `services/api`-Modul `media`); Schema hält `storage_key`/`content_type` für den Prod-Wechsel auf Object Storage + signierte URLs bereit.

Details/RLS-Matrix: `../schemas/README.md`. Lokaler Test: `../scripts/db-test.sh`.

Regeln:
- Nie Ad-hoc-FIX-SQL direkt auf der Datenbank.
- Jede Migration läuft im CI als Dry-Run gegen eine Shadow-DB.
- RLS-Policies nur nach dem Policy-Template (Claims aus `auth.jwt()->'club_roles'`), pgTAP-Tests Pflicht.
