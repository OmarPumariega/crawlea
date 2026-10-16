# 03 — Entorno de desarrollo

## Requisitos

- Node.js 24 (ver `.nvmrc`)
- PostgreSQL 16 accesible (local o remoto)

## Setup

```bash
npm install
cp .env.example .env   # rellena DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY
npm run db:migrate     # crea el esquema
npm run db:seed        # crea el usuario admin (ver prisma/seed.ts)
npm run dev
```

Credenciales sembradas por defecto: `admin@crawlea.com` / `admin1234`
(o las que definas en `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). Cámbialas antes
de usar en producción.

**Registro con Google en local:** define `GOOGLE_AUTH_CLIENT_ID` y
`GOOGLE_AUTH_CLIENT_SECRET` (OAuth client propio, redirect URI
`http://localhost:3000/api/auth/callback/google`). Sin ellas el botón de Google no
aparece y se entra como admin con contraseña — suficiente para la mayoría de tareas.

## URLs locales

| Ruta | Qué es |
|---|---|
| `/` | Redirige a `/app` (será la home pública en la Fase 4) |
| `/acceso` · `/registro` | Login y registro públicos (Google + acceso interno) |
| `/app` | La herramienta (requiere sesión) |
| `/admin` · `/admin/usuarios` · `/admin/costes` | Panel de administración de la plataforma (solo role admin, Fase 2) |

**Pruebas multi-tenant:** para verificar aislamiento, crea un usuario de prueba con
password conocido en la BD dev, entra con él por /acceso (acceso interno), comprueba
que NO ve los proyectos del admin, y bórralo después.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Migración Prisma (dev) |
| `npm run db:seed` | Siembra el usuario admin |
| `npm run db:studio` | Prisma Studio |

**Reinicia el dev server tras `prisma migrate`/`generate`** (ver gotchas en
[`00-protocolo-trabajo.md`](./00-protocolo-trabajo.md)). El cron interno solo corre
con `NODE_ENV=production` — para probarlo: `npm run build && npm run start`.

**CLI de Prisma sin red (sandbox/CI):** prefijar
`CI=true PRISMA_SKIP_UPDATE_CHECK=1 PRISMA_DISABLE_TELEMETRY=1`.

## Variables de entorno

Ver [`.env.example`](../.env.example) para la lista completa con explicación de cada una.

## Despliegue en producción (VPS Contabo)

Crawlea corre en **crawlea.com** sobre el VPS de Contabo (84.46.249.81, SSH
`vps-omar`), como un **stack aislado** del resto de servicios del VPS:

- Código en `/opt/crawlea` (clone de `github.com/OmarPumariega/crawlea`, rama `main`).
- `docker-compose.yaml` del repo: `crawlea-app` + `crawlea-db` en la red interna
  `crawlea-internal` (la DB no se publica al host), volumen propio
  `crawlea_pgdata`, límites de recursos (app 2G/2 CPUs, db 768M/1 CPU).
- Único acople con el resto del VPS: el contenedor app se conecta también a la
  red `coolify` para que el Traefik compartido (dueño de 80/443) enrute
  `Host(crawlea.com)` — mismo patrón que cirochat. Routers/middleware
  nombrados `crawlea-*` para no colisionar con otros stacks. `www.crawlea.com`
  responde 301 al dominio desnudo.
- Secrets en `/opt/crawlea/.env` (chmod 600, fuera de git): generados con
  `openssl rand`; las claves de API se copiaron del despliegue anterior o se
  configuran desde `/app/configuracion` (cifradas en BD).
- `NEXTAUTH_URL` es env de runtime del compose (no está horneada en la imagen).

Desplegar una actualización:

```bash
ssh vps-omar
cd /opt/crawlea
git pull
docker compose up -d --build   # las migraciones se aplican solas al arrancar
```

El despliegue **antiguo** (el mismo producto en su etapa interna) sigue
corriendo aparte en el mismo VPS, gestionado por Coolify; no comparte nada con
Crawlea salvo el proxy de entrada.
