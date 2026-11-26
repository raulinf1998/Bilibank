# syntax=docker/dockerfile:1

# ---- Compilación ----
# Una sola etapa instala las dependencias (las de desarrollo también hacen
# falta para compilar: tailwind, postcss, typescript…). Antes había una etapa
# `deps` cuyo `node_modules` (~700 MB) se copiaba entera al builder: esa copia
# es la que agotaba el disco del servidor («no space left on device»).
# El servidor final no necesita nada de aquí fuera de lo que Next copia en
# `.next/standalone`.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Valor sólo para compilar: no se conecta a ninguna base durante el build.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
# package-lock.json es recomendable, pero el ZIP descargado desde GitHub puede
# no incluirlo. El comodín permite construir en ambos casos.
COPY package*.json ./
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      echo "AVISO: package-lock.json no encontrado; se usará npm install"; \
      npm install --no-audit --no-fund; \
    fi \
 && npm cache clean --force
COPY . .
RUN npm run build && rm -rf /app/node_modules/.cache

# ---- Imagen final ----
# Next.js en modo `standalone` ya incluye en .next/standalone las dependencias
# que usa el servidor: no hace falta copiar node_modules entero a la imagen.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Europe/Madrid

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
