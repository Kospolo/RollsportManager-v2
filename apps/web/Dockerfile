# Produktions-Image der Web-App (Next.js 16) — für die öffentliche Beta
# beta.rollsportmanager.de. Bauen/Starten über infra/beta/compose.yml.
#
# WAS HIER LÄUFT — UND VOR ALLEM, WAS NICHT
# Dieses Image enthält NUR das Frontend mit den Demo-Daten. Es spricht KEINE
# API und KEINE Datenbank an, und das ist keine Einstellung, die jemand aus
# Versehen umlegen kann: apps/web/lib/data/config.ts erzwingt die Datenquelle
# "mock", sobald NODE_ENV=production ist — der api-Modus existiert nur unter
# `next dev`. Das ist auch der Grund, warum die Beta überhaupt öffentlich
# stehen darf: v2 hat bis heute keinen echten Login, nur die Persona-Anmeldung
# des Dev-Stacks. Wäre die API angebunden, könnte sich jeder Besucher per Klick
# als Vereinsinhaber ausgeben. Ohne API gibt es hier schlicht nichts zu holen.
#
# Wer das ändern will, ändert damit die Sicherheitslage der Beta. Nicht
# nebenbei tun.

# --- Abhängigkeiten -----------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
# Nur die Manifeste kopieren: solange die sich nicht ändern, kommt dieser
# Schritt aus dem Cache und der Build dauert Sekunden statt Minuten.
COPY package.json package-lock.json ./
RUN npm ci

# --- Bauen --------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# RSM_DOCKER=1  → next.config: kein Monorepo-Root (hier IST apps/web die
#                 Wurzel), dafür output: "standalone".
# RSM_BETA=1    → noindex in robots.txt und als X-Robots-Tag auf jeder Antwort.
ENV RSM_DOCKER=1 \
    RSM_BETA=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build \
    # `standalone` kopiert public/ und .next/static ABSICHTLICH nicht mit (die
    # gehören laut Next-Doku üblicherweise vor ein CDN). Hier gibt es kein CDN,
    # also legen wir sie von Hand dazu — sonst liefert die Seite kein CSS/JS.
    && cp -r public .next/standalone/ \
    && cp -r .next/static .next/standalone/.next/

# --- Laufzeit -----------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    RSM_BETA=1 \
    PORT=3021 \
    HOSTNAME=0.0.0.0
# Nur das fertige standalone-Bündel — kein Quellcode, keine Build-Werkzeuge,
# keine vollständigen node_modules.
COPY --from=build --chown=node:node /app/.next/standalone ./
# Nicht als root laufen: Das Image hat keinen Grund dazu.
USER node
EXPOSE 3021
# Damit `docker ps` ehrlich "healthy" sagt und nicht nur "läuft".
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3021/ || exit 1
CMD ["node", "server.js"]
