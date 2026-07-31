# ============================================================================
# RollsportManager v2 — API (Hono, self-contained Auth). Schlankes Prod-Image.
#
# Zwei Stufen: bauen (mit devDeps → tsc) und laufen (nur prod-Deps + dist/).
# Keine nativen Abhaengigkeiten (postgres.js, nodemailer, jose sind reines JS).
#
# WICHTIG im Betrieb (docker-compose setzt das):
#   * API_HOST=0.0.0.0  — sonst lauscht der Server nur auf 127.0.0.1 IM Container
#     und der Reverse-Proxy erreicht ihn nicht (Default in index.ts ist 127.0.0.1).
#   * AUTH_MODE=selfhosted + starke Secrets — sonst verweigert die API den Start.
# ============================================================================

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Uploads liegen ausserhalb der DB; der Pfad wird per MEDIA_DIR auf ein
# Bind-Mount gelegt (docker-compose). Default-Verzeichnis anlegen + Rechte.
RUN mkdir -p /data/media && chown -R node:node /data
EXPOSE 3022
USER node
CMD ["node", "dist/index.js"]
