# scripts/ — Lokaler Dev-Workflow (RollsportManager v2)

## TL;DR

```bash
scripts/dev-stack.sh up       # DB (55433) + API (3022) starten, bei leerer DB: Migrations + Seed
scripts/dev-stack.sh status   # was läuft gerade?
scripts/dev-stack.sh down     # API beenden + DB-Container stoppen (Daten bleiben!)
scripts/dev-stack.sh reset    # alles weg + frisch geseedete DB + neu starten
```

Danach:

```bash
# Token für eine Seed-Persona holen (nur AUTH_MODE=dev, sonst 404):
curl -s -X POST http://127.0.0.1:3022/dev/login \
  -H 'content-type: application/json' -d '{"persona":"coach"}'

# ... und damit echte Seed-Daten lesen:
TOKEN=$(curl -s -X POST http://127.0.0.1:3022/dev/login \
  -H 'content-type: application/json' -d '{"persona":"coach"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
curl -s "http://127.0.0.1:3022/events?club_id=c1ab0000-0000-4000-8000-000000000001" \
  -H "authorization: Bearer $TOKEN"
```

## Was `dev-stack.sh up` genau macht

1. **Dev-DB** `rsm2-pg-dev` (postgres:16-alpine) auf `127.0.0.1:55433` starten.
   Idempotent: läuft der Container, wird er wiederverwendet; ist er gestoppt,
   wird er gestartet. Die Daten liegen als **Bind-Mount** in `.dev/pgdata`
   (gitignored, KEIN Named Volume) und überleben `down`.
2. Bei **leerer DB** (kein `app`-Schema): Supabase-Shim (auth-Schema,
   `auth.uid()`/`auth.jwt()`, Client-Rollen) + alle Migrations aus
   `supabase/migrations/` + Seed aus `supabase/seed/seed.sql` einspielen —
   über die geteilte Harness-Lib `supabase/scripts/lib/pg-harness.sh`
   im persistenten Modus (`HARNESS_PERSIST_DIR`).
3. **API** (`services/api`, Hono) auf `http://127.0.0.1:3022` im Hintergrund
   starten: `AUTH_MODE=dev`, HS256-Secret aus `.dev/secrets.env` (wird beim
   ersten `up` generiert, gitignored), PID in `.dev/api.pid`, Log in
   `.dev/api.log`.

`down` stoppt API + Container (Container wird **nicht** gelöscht). `reset`
löscht zusätzlich `.dev/pgdata` und baut die Seed-DB frisch auf.

## Ports (fest vereinbart)

| Dienst          | Port  |
|-----------------|-------|
| Web-Portal (Next.js) | 3021 |
| API (Hono, Dev) | 3022 |
| Dev-DB `rsm2-pg-dev` | 55433 |
| Test-DB `rsm2-pg-test` (nur Test-Scripts, throwaway) | 55436 |

Der Dev-Stack und die Test-Scripts (`supabase/scripts/db-test.sh`,
`supabase/tests/run-tests.sh`, `services/api/scripts/api-db-test.sh`) laufen
parallel und stören sich nicht — andere Container-Namen, andere Ports.

## Dev-Login: `POST /dev/login`

**Nur Entwicklung.** Die Route antwortet nur bei `AUTH_MODE=dev`; in jedem
anderen Modus liefert sie 404 wie eine nicht existierende Route. Sie ist
bewusst **nicht** in der OpenAPI-Spec / den generierten Clients (plain
Hono-Router, wie die Webhooks).

Request: `{"persona": "coach" | "owner" | "treasurer" | "admin" | "member" | "guest"}`

Antwort:

```json
{
  "token_type": "Bearer",
  "access_token": "<HS256-JWT, 12 h gültig>",
  "expires_in": 43200,
  "persona": "coach",
  "profile": {
    "sub": "90000000-0000-4000-8000-000000000001",
    "member_id": "a0000000-0000-4000-8000-000000000001",
    "display_name": "Sandra Vogel",
    "email": "sandra.vogel@example.org",
    "club_id": "c1ab0000-0000-4000-8000-000000000001",
    "club_role": "coach"
  }
}
```

Die Token-Claims entsprechen exakt dem GoTrue-Hook-Vertrag, den die
Auth-Middleware und die RLS-Impersonation erwarten:
`sub` (uuid), `role: "authenticated"`, `club_roles: {"<club_id>": "<rolle>"}`,
`aud: "authenticated"`.

### Seed-Personas (Verein „RSV Neckarsulm“, `club_id c1ab0000-0000-4000-8000-000000000001`)

| Persona     | Name             | `sub`                                  | Club-Rolle    |
|-------------|------------------|----------------------------------------|---------------|
| `coach`     | Sandra Vogel     | `90000000-0000-4000-8000-000000000001` | `coach`       |
| `owner`     | Jürgen Häberle   | `90000000-0000-4000-8000-000000000002` | `owner`       |
| `treasurer` | Beate Schäfer    | `90000000-0000-4000-8000-000000000003` | `treasurer`   |
| `admin`     | Thomas Krüger    | `90000000-0000-4000-8000-000000000004` | `admin`       |
| `member`    | Katrin Grünewald | `90000000-0000-4000-8000-000000000009` | `member` (Elternteil von Lina) |
| `guest`     | Milena Öztürk    | `90000000-0000-4000-8000-000000000006` | `guest_coach` (befristet) |

Quelle: `services/api/src/routes/dev-login.ts` (`DEV_PERSONAS`) —
bei Seed-Änderungen dort mitziehen.

## Für die Web-Teams (apps/web, Port 3021)

* **CORS** für `http://localhost:3021` ist in der API freigeschaltet
  (nur `AUTH_MODE=dev`; erlaubte Header: `authorization`, `content-type`,
  `x-request-id`).
* Token holen: `POST http://127.0.0.1:3022/dev/login` mit `{"persona": …}`,
  dann `Authorization: Bearer <access_token>` an alle API-Calls.
* Die Daten sind die **echten Seed-Daten** (identisch zu den Mock-Zahlen:
  15 Events, 24 Mitglieder, 10 Rechnungen, offene Summe 381,00 €, …) —
  RLS greift wirklich: `member` sieht z. B. nur 2 eigene Rechnungen.
* Der API-Anschluss gehört hinter das `NEXT_PUBLIC_DATA_SOURCE`-Flag —
  Mocks bleiben der Default, Dev-Login ist reiner Entwicklungskomfort.
* Fehlerformat: RFC 7807 `application/problem+json` inkl. `request_id`.

## Troubleshooting

* **API startet nicht:** `.dev/api.log` ansehen. Port 3022 durch einen
  fremden Prozess belegt → dev-stack bricht bewusst ab statt zu killen.
* **Seed kaputtgespielt:** `scripts/dev-stack.sh reset` = frische Seed-DB.
* **Secret rotieren:** `.dev/secrets.env` löschen, `down` + `up` — alle
  alten Tokens werden dadurch ungültig.
