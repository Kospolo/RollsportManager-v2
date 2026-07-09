# sync

Später: `sync-rules.yaml` — die PowerSync Sync Rules (ADR-E5, self-hosted Open Edition).

- Tier 1 (immer offline): Termine, Anwesenheit, eigene Mitgliedsdaten
- Tier 2 (selektiv/gepinnt): Küren-Metadaten, Chat
- Medien laufen NICHT über die Sync-Engine (signierte URLs + lokaler Cache)

Änderungen sind review-pflichtig und Merge-Gate (Mandanten-Isolationstests müssen grün sein).
