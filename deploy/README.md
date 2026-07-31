# RollsportManager v2 — Prod-Deploy (Mac Studio .220)

Schlanker Stack: **Postgres + Hono-API**, `AUTH_MODE=selfhosted` (kein GoTrue).
Laeuft neben dem alten v1-Supabase — strikt getrennt (Container `rsm2-prod-*`,
eigene Ports, Bind-Mounts). **v1 wird nicht angefasst.**

## Einmalig

```bash
cd deploy
cp .env.example .env
# .env fuellen: POSTGRES_PASSWORD, AUTH_JWT_SECRET, RATE_LIMIT_PEPPER
#   openssl rand -base64 48   (je Secret einen)

docker compose up -d db          # nur die DB starten
./migrate.sh                     # Bootstrap + alle Migrationen (kein Dev-Seed)
docker compose up -d --build api # API bauen + starten
curl -s http://127.0.0.1:3023/health   # → ok
```

### SMTP (fuer Reset-/Verify-Mails)

SMTP liegt in `internal.platform_settings` (DB), nicht in der ENV. Einmalig setzen
(Strato-Werte aus v1) — entweder ueber den Betreiber-Admin oder per SQL:

```sql
update internal.platform_settings
   set smtp = jsonb_build_object(
     'host','smtp.strato.de','port',587,
     'user','noreply@rollsportmanager.de',
     'from','RollsportManager <noreply@rollsportmanager.de>',
     'secure',false,'password','<STRATO-PASSWORT>')
 where id = 1;
```

## Reverse-Proxy (NPM)

Neuer Proxy-Host: `api.rollsportmanager.de` → `127.0.0.1:3023` (Schema http),
Websockets aus, **SSL per Let's Encrypt** (DNS zeigt bereits auf .220). Danach:

```bash
curl -s https://api.rollsportmanager.de/health   # → ok
```

## Updates

```bash
git pull
cd deploy
./migrate.sh                     # neue Migrationen
docker compose up -d --build api # neue API-Version
```

## Sicherheit (fail-closed)

`AUTH_MODE=selfhosted` verweigert den Start mit den oeffentlichen Dev-Platzhaltern
fuer `AUTH_JWT_SECRET`/`RATE_LIMIT_PEPPER` und mit `MAIL_TRANSPORT=dry-run`.
`/dev/login` (Persona-Login) antwortet in diesem Modus **404**.
