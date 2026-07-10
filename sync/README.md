# sync

Später: `sync-rules.yaml` — die PowerSync Sync Rules (ADR-E5, self-hosted Open Edition).

**Die verbindliche Sync-Spezifikation existiert bereits:** `packages/contracts/sync-spec.md`
(Tier-Einteilung pro Tabelle, LWW via Server-`updated_at`, Outbox-FIFO/Retry,
UUIDv7-Idempotenz, Tombstones). Die Sync Rules hier müssen sie 1:1 umsetzen.

- Tier 1 (immer offline, schreibbar): Termine/RSVP, Anwesenheit, Küren-Marker/-Scores
- Tier 2 (selektiv/gepinnt, read-only): Küren-Metadaten u. a.
- Tier 3 (online-only): Finanzen, Entitlements, Plattform
- Medien laufen NICHT über die Sync-Engine (signierte URLs + lokaler Cache)

Änderungen sind review-pflichtig und Merge-Gate (Mandanten-Isolationstests müssen grün sein).
