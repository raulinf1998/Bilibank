# Mi Patrimonio — aplicación completa en tu Proxmox

Esta carpeta contiene todo lo necesario para ejecutar **esta aplicación** (la interfaz que hemos diseñado, con sus 6 estructuras y todas las paletas) en un contenedor de tu servidor, con una base de datos PostgreSQL persistente y acceso por IP desde cualquier dispositivo de casa.

La aplicación se sirve en `/app`. Incluye:

- Panel, cuentas corrientes y de inversión, productos, categorías y subcategorías.
- Movimientos con filtros, alta, edición y detalle.
- Inversiones: operaciones, aportaciones, países, sectores, top 10 y vistas de evolución.
- Gráficas de la pestaña Analítica y selector de periodo.
- Ajustes con **selector de estructura**, paletas integradas y paletas personalizadas.
- Guardado automático de los datos de trabajo en PostgreSQL.

> **Seguridad:** la aplicación no tiene inicio de sesión. Pensada para tu red local (LAN/VPN). No publiques el puerto en Internet sin poner delante un proxy con autenticación.

---

## 1. Crear el contenedor en Proxmox

En la consola del nodo Proxmox, crea un LXC Debian 12 con al menos **2 vCPU, 2 GB de RAM y 8 GB de disco**:

```bash
pct create 210 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname mi-patrimonio --memory 2048 --cores 2 --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.1.50/24,gw=192.168.1.1 \
  --unprivileged 1 --features nesting=1 --onboot 1
pct start 210
pct enter 210
```

Ajusta `ip=192.168.1.50/24` y la puerta de enlace a las de tu red. Fijar la IP aquí evita que cambie con DHCP.

Dentro del contenedor:

```bash
apt update && apt install -y curl unzip
curl -fsSL https://get.docker.com | sh
```

## 2. Copiar y arrancar la aplicación

Sube el ZIP que descargaste (`mi-patrimonio-app.zip`) al contenedor y descomprímelo:

```bash
mkdir -p /opt/mi-patrimonio
cd /opt/mi-patrimonio
unzip /ruta/mi-patrimonio-app.zip
bash install.sh --no-start
nano .env   # opcional: la contraseña ya se generó
```

Si descargaste el ZIP desde GitHub, ejecuta primero `bash install.sh --no-start`: crea `.env`
(con una contraseña segura generada) y `.dockerignore`, porque GitHub no incluye los archivos
que empiezan por punto. Puedes editar `.env` para cambiar la contraseña o `APP_PORT`.

Arranca:

```bash
docker compose up -d --build
```

`package-lock.json` es recomendable para que el build sea reproducible, pero el Dockerfile también funciona si no está: en ese caso usa `npm install` dentro de la etapa de compilación. Si el ZIP descargado desde GitHub no contiene el lockfile, no tienes que crearlo manualmente para poder arrancar.

La primera vez tarda unos minutos (instala dependencias y compila). Comprueba el estado:

```bash
docker compose ps
docker compose logs -f app
```

Cuando ambos servicios estén sanos, abre desde cualquier dispositivo de tu casa:

```
http://192.168.1.50:3000/app
```

Sustituye la IP por la de tu contenedor. La página principal `/` es el laboratorio de diseño; la aplicación real es `/app`.

## 3. Cambiar estructura, paleta y modo

Dentro de `/app`, ve a **Ajustes**:

- **Estructura de la interfaz**: 6 opciones (tarjetas clásicas, suave neumórfico, material tonal, explorador, app bancaria, feed de historias).
- **Paleta de color**: integradas + tus paletas personalizadas, con modo oscuro/claro.
- **Crear paleta**: editor con colores base de ambos modos y vista previa.

Los cambios se guardan en la base de datos y se aplican en todos los dispositivos.

## 4. Persistencia de los datos

- PostgreSQL guarda la configuración visual, tus paletas y los datos de trabajo (cuentas, categorías, productos y movimientos).
- Los datos viven en el **volumen Docker `mi-patrimonio-db`**, fuera del contenedor de la app. Reconstruir la app no los borra.
- La primera vez, la app arranca con un conjunto de ejemplo. Puedes editarlo; cada cambio se guarda automáticamente (indicador «Guardado en el servidor»).
- En **Ajustes → Datos** puedes descargar una copia JSON, importarla o restablecer los ejemplos.

### Copia de seguridad

```bash
cd /opt/mi-patrimonio
docker compose exec -T db pg_dump -U app -d app_db > copia-$(date +%F).sql
```

O también:

```bash
docker run --rm -v mi-patrimonio-db:/data -v "$PWD":/backup alpine \
  tar czf /backup/volumen-$(date +%F).tgz -C /data .
```

Guarda las copias fuera del contenedor. Para restaurar:

```bash
cat copia-2026-02-24.sql | docker compose exec -T db psql -U app -d app_db
```

## 5. Actualizar

```bash
cd /opt/mi-patrimonio
docker compose exec -T db pg_dump -U app -d app_db > copia-antes-de-actualizar.sql
# descomprime la nueva versión encima (conserva tu .env)
docker compose up -d --build
```

No uses `docker compose down -v`: el volumen `-v` se elimina y perderías la base de datos.

## 6. Acceso desde otros dispositivos y seguridad

- Entra por la IP fija del contenedor: teléfono, tablet y ordenador de la misma red.
- El puerto de PostgreSQL **no se publica** en la red doméstica; solo la app puede hablar con él.
- No expongas el puerto 3000 a Internet. Si quieres acceso remoto, usa **VPN (WireGuard/Tailscale)** o un reverse proxy con autenticación:

```nginx
server {
  listen 80;
  server_name patrimonio.tudominio.com;
  auth_basic "Mi Patrimonio";
  auth_basic_user_file /etc/nginx/.htpasswd;
  location / {
    proxy_pass http://192.168.1.50:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

- Mantén el LXC actualizado y haz copias periódicas.

## 7. Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| `POSTGRES_PASSWORD` requerido | Falta `.env`. Ejecuta `bash install.sh --no-start` (lo crea con contraseña generada). |
| La app no arranca y el log dice `DATABASE_URL` | El contenedor `db` no está sano. Revisa `docker compose ps` y los logs de `db`. |
| La página carga el laboratorio | La aplicación es `/app` (con barra final opcional). |
| El puerto 3000 está ocupado | Cambia `APP_PORT` en `.env` y ejecuta `docker compose up -d`. |
| Quiero empezar de cero | Copia una backup y restablece los datos de ejemplo desde Ajustes; no borres el volumen sin copia. |

## 8. Desarrollo local (opcional)

```bash
npm ci
cp env.example .env   # ajusta DATABASE_URL a tu PostgreSQL local
npm run dev
```

Abre `http://localhost:3000/app`.
