# infra

Später: Infrastruktur als Code + Betrieb.

- `prod-hetzner/` — compose.yml, Secret-Bootstrap, pgBackRest, Monitoring (Uptime, Replication-Slot-Lag, Disk)
- `staging-proxmox/` — Staging-Umgebung auf dem lokalen Proxmox
- `runbooks/` — Restore, Cutover, Incident, Slot-Lag

Secrets liegen nie im Repo; Konfiguration über Admin-UI, `.env` nur Fallback.
