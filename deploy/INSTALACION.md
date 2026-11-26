# Instalación con Docker · guía rápida

Esta guía es el resumen operativo. La guía completa (Proxmox paso a paso,
seguridad y desarrollo local) está en `deploy/README.md`.

## 1 · Lo mínimo

```bash
git clone https://github.com/raulinf1998/Bilibank.git
cd Bilibank
cp env.example .env          # y pon una POSTGRES_PASSWORD decente
docker compose up -d --build
docker compose logs -f app   # espera a «Ready»
```

La app queda en `http://IP-del-servidor:3000` (o el `APP_PORT` que pongas en
`.env`).

## 2 · Copias de seguridad

```bash
# Base de datos
docker compose exec -T db pg_dump -U app -d app_db > copia-$(date -F).sql

# Desde la propia app: Ajustes → Exportar todos los datos (JSON + CSV + HTML)
```

## 3 · Actualizar

```bash
git pull origin main
docker compose up -d --build
```

## 4 · Si el build falla con «no space left on device»

El error típico es este:

```
ERROR [builder 3/5] COPY --from=deps /app/node_modules ./node_modules
failed to solve: ResourceExhausted: failed to copy files: copy file range failed: no space left on device
```

No es que falte sitio para la imagen final: es que **`node_modules` ocupa
cientos de MB y Docker lo copiaba de una etapa a otra**. El `Dockerfile` de
este repositorio ya no hace esa copia (una sola etapa compila y la imagen
final usa el `standalone` de Next, que pesa mucho menos), pero Docker guarda
caché de los intentos anteriores. Para limpiarla:

```bash
# 1. Ver qué ocupa
df -h
docker system df

# 2. Borrar restos de builds fallidos e imágenes sin usar (no toca los datos:
#    la base de datos vive en el volumen mi-patrimonio-db)
docker builder prune -af
docker image prune -af

# 3. Si aún no hay sitio, revisar la caché de compilación de BuildKit
sudo du -sh /var/lib/docker/* 2>/dev/null | sort -h | tail

# 4. Reintentar
docker compose up -d --build
```

> `docker system prune -a --volumes` **sí** borra el volumen de la base de
> datos. No lo uses salvo que hayas hecho antes `pg_dump`.

Espacio recomendado en el servidor: **4 GB libres** para construir (el
`node_modules` de compilación es lo que más pesa) y ~1,5 GB para dejar la app
funcionando. La imagen final ronda los 250 MB.

## 5 · Comprobar que está viva

```bash
curl -fsS http://127.0.0.1:3000/api/health && echo OK
docker compose ps
```

## 6 · Acceso desde la red local

El contenedor de la base de datos **no** publica puertos: sólo la app habla
con ella por la red interna `mi-patrimonio`. Para cambiar el puerto de la app,
edita `APP_PORT` en `.env` y vuelve a levantar (`docker compose up -d`).
