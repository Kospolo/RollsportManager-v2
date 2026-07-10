# sync-spec.md — Verbindlicher Offline-/Sync-Vertrag (v1)

**Status:** verbindlich für iOS, Android und Web (Blueprint ADR-E1 Auflage 2, ADR-E5).
Abweichungen nur über ein neues ADR. Jede Plattform sichert dieses Verhalten über
Contract-/Roundtrip-Tests ab (Flugmodus-Roundtrip ist Fertig-Kriterium der Phasen 3/4).

**Sync-Engine:** PowerSync Open Edition (self-hosted), eine Engine für alle drei Clients.
Sync Rules (YAML) liegen versioniert im Repo (`sync/`). Quell-Postgres läuft mit
`wal_level=logical`; Bucket-Storage in Postgres (kein MongoDB im Stack).

---

## 1. Offline-Tiering (welche Entität darf was)

Tier-Zuordnung pro Tabelle (Schema-Stand `app.*`, Migrationen 0001–0006).
**Grundsatz:** Was nicht explizit Tier 1 oder Tier 2 ist, ist Tier 3 (nur online).

### Tier 1 — offline lesen UND schreiben (Outbox)

| Entität | Schreib-Operation offline | Upload-Ziel (API) |
|---|---|---|
| `event_rsvps` (Zu-/Absagen inkl. `sick`) | Upsert auf `(event_id, member_id)` | `PUT /events/{eventId}/rsvp` |
| `attendance` (Anwesenheit/Check-in) | Upsert auf `(event_id, member_id)` | `PUT /events/{eventId}/attendance` |
| `routine_markers` (Kür-Zeitmarken/Notizen) | Insert (append-only) | `POST /routines/{routineId}/markers` |
| `routine_scores` (Kür-Bewertungen) | Insert (append-only) | `POST /routines/{routineId}/scores` |
| Chat-Nachrichten *(Tabelle folgt in Portal-/Chat-Phase)* | Insert (append-only) | folgt |

### Tier 2 — offline lesbar, Schreiben NUR online

`clubs`, `club_members`, `guardianships`, `teams`, `team_members`, `events`,
`event_teams`, `routines`, `routine_skaters`, `media_assets` (**nur Metadaten**,
siehe §5), `competitions`, `competition_entries`, `tasks`.

Schreibversuche auf Tier-2-Entitäten im Offline-Zustand werden im Client
**abgelehnt** (UI: deaktiviert/„nur online"), niemals in die Outbox gelegt.

### Tier 3 — NUR online, server-autoritativ (nie im lokalen Store)

`invoices`, `ledger_entries`, `invoice_counters`, `products`, `entitlements`,
Rollen-/Statusänderungen an `club_members` (inkl. Invite), `profiles`-Mutationen.
`internal.webhook_events` verlässt den Server nie.

Tier-3-Daten werden nicht in die lokale SQLite synchronisiert. Anzeige (z. B.
Lizenzstatus, eigene Rechnungen) erfolgt über Online-Reads mit normalem
HTTP-Caching; ohne Netz zeigt der Client den letzten bekannten Stand als
„Stand von …" an, ohne Interaktionsmöglichkeit.

---

## 2. Schreibpfad (Outbox → API, nie PostgREST)

1. Jede Offline-Schreiboperation erzeugt einen Outbox-Eintrag in der lokalen
   SQLite (PowerSync-CRUD-Queue). **Upload ausschließlich über `uploadData`
   gegen die API-Schicht** (Endpunkte aus §1) — nie direkt gegen PostgREST.
   Entitlements/Limits/Rollen werden serverseitig durchgesetzt; RLS bleibt
   zweite Verteidigungslinie.
2. **Idempotenz:** IDs werden clientseitig als UUIDv7 generiert. Wiederholte
   Uploads derselben Operation müssen serverseitig idempotent sein
   (Upsert-Endpunkte sind es per Definition; append-only-Inserts über die
   client-generierte ID).
3. **Reihenfolge:** FIFO pro Entitätszeile. Mehrere lokale Änderungen derselben
   Zeile dürfen vor dem Upload zur letzten Fassung zusammengefaltet werden
   (Coalescing) — für Upsert-Entitäten verpflichtend erlaubt.
4. **Retry:** Netzfehler/5xx → exponentielles Backoff mit Jitter, unbegrenzt
   (bis Erfolg oder Nutzer-Logout). Die Outbox überlebt App-Neustarts.
5. **Fehler-Semantik beim Upload:**
   - `401` → Token-Refresh, dann Retry. Schlägt der Refresh endgültig fehl:
     Outbox behalten, Re-Login anfordern.
   - `403`/`404` (RLS-Ablehnung, entzogene Rechte, gelöschtes Ziel) → Eintrag
     **verwerfen** und dem Nutzer sichtbar melden („Änderung konnte nicht
     übernommen werden"). Kein stiller Drop, kein endloser Retry.
   - `400`/`409` (Validierung) → wie 403: verwerfen + sichtbar melden; solche
     Fehler sind Client-Bugs und werden geloggt/reportet.
6. Der lokale Store ist verschlüsselte SQLite. Kein `password_hash` lokal,
   keine JSON-Schatten-Caches neben der Sync-DB.

---

## 3. Konfliktregel

- **Last-Write-Wins über Server-`updated_at`.** Der Server entscheidet; der
  Zeitstempel der Client-Uhr ist NIE konfliktentscheidend. Wer zuletzt beim
  Server ankommt, gewinnt — der frühere Stand wird überschrieben und via Sync
  an alle Clients zurückverteilt. Clients zeigen nach dem Sync immer den
  Server-Stand (lokale optimistische Werte werden ersetzt, „server wins after
  upload").
- **Append-only wo fachlich möglich** (Blueprint E5): `routine_markers`,
  `routine_scores`, Chat sind Einfüge-Ströme ohne Update-Konflikt.
- Upsert-Entitäten (`event_rsvps`, `attendance`) haben genau EINE Zeile pro
  `(event_id, member_id)` — Konflikt = letzter Upsert gewinnt.
- **Tombstones:** Löschungen auf Tier-1/2-Tabellen sind Soft-Deletes
  (`deleted_at TIMESTAMPTZ`). Clients filtern `deleted_at IS NOT NULL` aus der
  Anzeige; physisches Löschen passiert nur serverseitig (Retention-Job),
  GoBD-relevante Finanzdaten werden anonymisiert statt gelöscht (§4-Leitplanken).

---

## 4. Sichtbarkeit & Mandanten-Isolation

- Sync-Buckets sind pro `club_id` × Mitgliedschaft geschnitten (Claims
  `club_roles` aus dem JWT). Ein Client darf NIE Zeilen fremder Vereine im
  lokalen SQLite haben — automatisierter Isolationstest (zwei Test-Vereine,
  Assert: kein Fremd-Row lokal) ist Merge-Gate.
- Eltern sehen zusätzlich die Zeilen ihrer Kinder (`guardianships`), Trainer
  ihre Teams — die Sichtbarkeitsregeln entsprechen 1:1 den RLS-Policies; die
  Sync Rules dürfen sie nur EINSCHRÄNKEN, nie erweitern.

---

## 5. Medien — bewusst AUSSERHALB der Sync-Engine

- In der DB (und damit im Sync) liegen nur Metadaten: `storage_path`, `sha256`,
  `size_bytes`, `mime_type`, `duration_ms`, `waveform_peaks`. Binärdaten nie.
- Download/Streaming über kurzlebige signierte URLs (HTTP-Range); Uploads
  resumable (TUS).
- Offline-Medien nur über den expliziten Download-Manager mit nutzersichtbarem
  **Pinning** („für Wettkampf offline halten"), LRU-Eviction für Ungepinntes,
  Checksum-Verifikation (`sha256`) nach jedem Download. Genau EINE lokale
  Dateikopie pro Asset, nie in der DB.

---

## 6. Plan B (eingebaut, Blueprint E5)

Das Schema erfüllt die Voraussetzungen einer Eigenbau-Outbox (UUID-PKs,
`updated_at`-Trigger, `deleted_at`-Soft-Deletes, client-generierte IDs).
Ein PowerSync-Ausstieg kostet Client-Code, kein Schema-Redesign. Dieser
Vertrag (§1–§5) gilt unabhängig von der Engine weiter.

---

## 7. Versionierung dieses Vertrags

Änderungen an Tiering, Konfliktregel oder Fehler-Semantik erhöhen die
Versionsnummer in der Überschrift und brauchen ein Review gegen alle drei
Client-Implementierungen. Die Contract-Tests der Plattformen referenzieren
die Versionsnummer explizit.
