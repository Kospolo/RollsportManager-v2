# etl

Später: die v1→v2-Migration (Blueprint Phase 1 / Cutover).

- Eingefrorene Schema-Baseline des v1-Prod (`pg_dump --schema-only`)
- Mapping-Tabellen deutsch→englisch (verein→club, kür→routine, …)
- Idempotentes ETL mit Verifikation (Row-Count/Checksum gegen echten Prod-Dump)
- Medien-ETL Base64→Storage inkl. Waveform-Peaks
- v1-Kompat-Schema (deutsch benannte Views + INSTEAD-OF-Trigger für v1.9-Clients)
