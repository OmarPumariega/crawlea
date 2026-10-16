# AGENTS.md — Crawlea

Este archivo sigue la convención abierta [agents.md](https://agents.md): un resumen
del proyecto pensado para que **cualquier asistente de IA** (Cursor, Codex, Copilot,
Claude Code u otro) pueda orientarse sin haber visto el proyecto antes. Si trabajas
con Claude Code específicamente, lee también [`CLAUDE.md`](./CLAUDE.md) — tiene el
mismo contenido de fondo más instrucciones propias de esa herramienta (estilo de
commits, flujo de trabajo). Este archivo y `CLAUDE.md` deben mantenerse en sync: si
cambias algo importante del proyecto, actualiza los dos.

## Qué es esto

**Crawlea** (crawlea.com) es una herramienta SEO SaaS creada por **Omar Pumariega**.
Nació como panel interno y está en plena transición a **SaaS público multi-usuario**
(estilo Semrush/Dinorank): registro con Google, suscripciones con Stripe y web
pública de marketing. Cada cliente/dominio gestionado sigue siendo una fila
`Project`, pero ahora cada `Project` pertenece a un `User` (multi-tenant simple,
sin organizaciones/equipos).

Estado de la transición (fases aprobadas):

- **Fase 1 — HECHA:** multi-usuario (registro Google + credentials para el admin),
  aislamiento por usuario en TODAS las rutas API y páginas (`src/lib/auth-guards.ts`),
  panel en `/app` (antes `/admin`, con redirects legacy), perfil `/app/perfil`,
  planes con límites (`src/lib/plans.ts`: tope de gasto mensual por cuenta +
  máximo de proyectos), conexión Google (GSC/GA4) por usuario, avisos por email
  al dueño. El admin de la plataforma ve todos los proyectos y no tiene límites
  de plan.
- **Fase 2 — hecha:** panel de administración de cuentas (`/admin`: resumen, usuarios
  con suspensión/plan manual/tope manual/borrado, costes por cuenta). Sin margen vs
  ingresos hasta que exista Stripe.
- **Fase 3 — código hecho (Stripe en modo PRUEBA):** planes Gratis/Basic 9 €/Pro 25 €, checkout + portal + webhook (`src/lib/stripe/`), gating de módulos de pago (`moduleGate`). Antes de cobrar en real: alta fiscal (ver `docs/06-roadmap-saas.md`).
- **Fase 4 — hecha:** web pública en `/` (home, precios, contacto, legales con huecos
  pendientes de textos de Omar, sitemap/robots/OG, CSP).
- **Fase 5 — pendiente:** dominio crawlea.com (compra en trámite), OAuth de Google
  verificado, quitar `NEXTAUTH_URL` horneado del Dockerfile.

**Principio no negociable:** todos los datos que muestra la app vienen de una fuente
real y verificable (DataForSEO, Google Search Console/GA4, scraping real, PageSpeed
Insights). Nada se inventa ni se estima sin fuente. Cualquier cambio que rompa esto
es un bug, no un detalle de estilo.

Especificación funcional completa (9 módulos originales): [`docs/spec-original.md`](./docs/spec-original.md).
Estado detallado módulo a módulo: [`docs/01-vision-general.md`](./docs/01-vision-general.md).
Índice completo de documentación: [`docs/README.md`](./docs/README.md).

## Estado del proyecto

Los 9 módulos del spec original están completos, más un conjunto amplio de
funcionalidad añadida después (mismo principio de "solo datos reales", fuera del
alcance original):

| # | Módulo | Qué hace |
|---|---|---|
| 1 | Keywords | Estudios de keywords vía DataForSEO Labs (volumen, intención, estacionalidad), generación de estructura de URLs vía LLM (visualizada en la pestaña Arquitectura del mismo módulo) |
| 2 | Proyectos | CRUD de clientes/dominios, NAP, tareas manuales + auto-generadas desde auditoría, notas internas |
| 3 | Título y Meta | Scraping real de una URL + 3 variantes de título/meta vía LLM |
| 4 | Schema | Catálogo de ~20 tipos schema.org, generación de JSON-LD (deterministas + LLM genérico) |
| 5 | Rank Tracking | Posiciones orgánicas reales (DataForSEO SERP), manual o programado, guard de un chequeo/día |
| 6 | Google | OAuth2 por usuario, paneles de Search Console y GA4 con snapshots persistidos |
| 7 | Contenido | Generación de contenido vía LLM + "Optimizar URL existente" con cambios concretos accionables; el análisis TF-IDF es una pestaña de este módulo |
| 8 | Auditoría | Crawler propio (rastrea el sitio entero, no una muestra) + PageSpeed + cruce con GSC, puntuación explicable; enlazado interno (PageRank/huérfanas) y canibalizaciones son pestañas de este módulo |
| 9 | Geogrid | Mapa de calor de posicionamiento local vía DataForSEO Maps SERP |

Extra (fuera del spec de 9 módulos, mismo principio de datos reales): análisis TF-IDF
(pestaña de Contenido), PageRank interno + huérfanas y canibalizaciones (pestañas de
Auditoría), detección de contenido fino,
Copilot de IA de solo lectura, Competidores (visibilidad + content gap), Backlinks,
control de gasto con tope por proyecto, avisos por email, generación automática de
tareas desde hallazgos de auditoría, Notas internas de proyecto, Informe imprimible.

No hay roadmap pendiente urgente: lo que falta (Google Ads como fuente alternativa,
Business Profile API, SEO para LLMs) está bloqueado por coste o aprobación de
terceros, no por trabajo pendiente — ver `docs/01-vision-general.md`.

## Stack técnico

- **Next.js 16** (App Router) + TypeScript + Tailwind 4 (tokens CSS-first de la
  guía de estilo en `src/app/crawlea.css`) + **Manrope** + **modo oscuro** vía
  `next-themes` (`data-theme`)
- **PostgreSQL + Prisma** (adapter `PrismaPg`, sin pgvector — esta app no usa embeddings)
- **NextAuth (JWT)** — dos vías: **Google OAuth** (registro público del SaaS,
  `GOOGLE_AUTH_CLIENT_ID/SECRET`, sin esas env el botón no aparece) y
  **credentials + bcrypt** solo para el admin de la plataforma. `requireSession()`
  (`src/lib/auth-guards.ts`) verifica en BD que la cuenta siga activa en cada
  petición (suspensión efectiva inmediata); `projectForSession()` aplica el
  aislamiento multi-tenant
- **OpenRouter** (`src/lib/seo/llm.ts`) — SDK `openai` apuntando a OpenRouter, modelo
  configurable por env var, no hardcodeado. Timeout de 90s + `maxRetries: 0` en el
  cliente (antes no tenía timeout propio y heredaba 10 min del SDK — causaba cuelgues
  silenciosos en Título/Meta, Schema y Contenido)
- **DataForSEO** — cuatro productos distintos, cada uno con su propio coste: Keywords
  Data + Labs (Módulo 1, Competidores), SERP orgánico (Módulo 5, TF-IDF), Maps SERP
  (Módulo 9), Backlinks (módulo Backlinks — el único que no reutiliza llamadas ya
  pagadas por el resto de la app)
- **googleapis** — OAuth2 + Search Console + GA4 (Módulo 6)
- **cheerio** — scraping real en dos sabores: navegador simulado (Módulos 3/4/7,
  TF-IDF) y crawler identificado como bot (`CrawleaBot/1.0`, Módulo 8/Auditoría)
- **Cron interno sin Redis** (`src/instrumentation.ts` + `instrumentation-node.ts`) —
  cada 60s procesa auditorías/rank tracking/geogrid/bootstrap pendientes. Solo corre
  con `NODE_ENV=production`; en `npm run dev` nunca se dispara
- **nodemailer** — avisos por email opcionales, degradación silenciosa sin SMTP configurado
- **Infraestructura de producción:** VPS Contabo, **crawlea.com** — stack Docker
  aislado en `/opt/crawlea` (redes, volumen y límites de recursos propios;
  solo el Traefik compartido del VPS enruta el dominio). Las migraciones de
  Prisma se aplican solas al arrancar el contenedor (`prisma migrate deploy`
  en el `CMD` del Dockerfile) — no hace falta ningún paso manual de BD tras el
  deploy. Ver `docs/03-entorno-desarrollo.md` → "Despliegue en producción".

## Arquitectura — lo esencial

Detalle completo en [`docs/02-arquitectura.md`](./docs/02-arquitectura.md). Lo que
hay que saber antes de tocar código:

- **Monolito multi-usuario.** Cada `Project` pertenece a un `User`; el aislamiento
  vive en `src/lib/auth-guards.ts` (`requireSession` + `projectForSession`) y lo
  usan todas las rutas API y el layout de proyecto. El admin de la plataforma ve
  todos los proyectos.
- **Trabajo en segundo plano sin colas externas.** Nada de BullMQ/Redis: un cron
  interno vía el hook de instrumentación de Next.js sondea tablas de Postgres
  (`AuditRun`, `RankKeyword`, `GeogridRun`, `BootstrapRun`) cada 60s, con
  `setTimeout` recursivo (no `setInterval`) para que un tick largo no se solape con
  el siguiente. Las rutas POST de auditoría/geogrid además disparan el
  procesamiento inmediato vía import dinámico fire-and-forget, para no depender de
  esperar al siguiente tick.
  - **Excepción importante:** `runAuditJob` (el crawler de sitio completo) NO se
    espera dentro de esa cadena secuencial del cron — se lanza fire-and-forget con
    un guard anti-solapamiento propio, porque un crawl real puede tardar 30-60+ min
    y bloquearía rank tracking/geogrid de todos los proyectos si el cron esperara.
  - **Gotcha real:** Next.js solo auto-descubre un fichero llamado exactamente
    `instrumentation.ts` en la raíz de `src/`. El sufijo `-node` en
    `instrumentation-node.ts` es solo el nombre de un módulo importado desde ahí, no
    algo que Next reconozca por sí solo.
- **Control de gasto real, tres niveles.** `assertWithinSpendLimit()` se llama antes
  de cualquier llamada de pago a DataForSEO y bloquea al superarse, en orden: tope
  global de plataforma → tope del plan del dueño (`src/lib/plans.ts`, el admin no
  está limitado) → tope propio del proyecto. Toda acción que gasta muestra una
  estimación antes de confirmar.
- **Secrets cifrados en BD** (AES-256-CBC, `src/lib/crypto.ts`) para claves
  configurables desde la UI (`AppSetting`) y el refresh token de Google — nunca en
  texto plano, y el valor real nunca vuelve al cliente tras guardarse.
- **Auditoría rastrea el sitio entero, no una muestra** (cambio reciente): techo de
  seguridad de 5000 páginas / profundidad 20 (antes 50/4), siembra la cola desde
  sitemap.xml (siguiendo índices de sitemap) además de seguir enlaces, normaliza
  URLs (trailing slash, parámetros de tracking, unifica variantes) para no duplicar
  nodos ni diluir el PageRank interno, e identifica cada página por su URL final
  tras redirect. Si el crawl se trunca por el techo de seguridad, la UI lo avisa.

## Gotcha de desarrollo (el más común)

**Tras cualquier `prisma migrate`/`prisma generate` hay que reiniciar el dev server.**
Next.js dev no recarga en caliente el cliente de Prisma — si añades modelos/campos
con el dev server corriendo, las tablas nuevas aparecen como `undefined` en runtime
(`Cannot read properties of undefined (reading 'findMany')`) aunque el código y
`tsc` estén bien. Síntoma: errores 500 en rutas que usan modelos recién añadidos,
que desaparecen al reiniciar.

## Cómo arrancar en local

Detalle completo en [`docs/03-entorno-desarrollo.md`](./docs/03-entorno-desarrollo.md).

```bash
npm install
cp .env.example .env   # rellena DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY
npm run db:migrate
npm run db:seed        # crea el usuario admin
npm run dev
```

El cron interno (auditorías/rank tracking/geogrid) **no corre en `npm run dev`**,
solo con `NODE_ENV=production` — para probarlo de verdad hace falta
`npm run build && npm run start`.

## Convenciones del proyecto

- **Identidad visual:** la fuente de verdad es la guía de estilo
  [`Guia de estilo/GUIA-DE-ESTILO.md`](./Guia%20de%20estilo/GUIA-DE-ESTILO.md)
  (tokens en `src/app/crawlea.css`: rampa índigo, acento único, coral solo para
  avisos/bajadas, tema claro/oscuro). Antes de tocar UI, léela: nada de
  colores/radios/sombras que no estén ahí. Los alias de la identidad anterior
  (`bg-brand`, `text-signal`, `bg-sidebar`...) viven en `globals.css` apuntando
  a la nueva paleta y se retiran gradualmente.
- **Idioma:** todo en español — UI, comentarios de código, commits, documentación.
- **Commits:** en español, describiendo el *porqué* del cambio, no solo el qué. Un
  módulo o mejora = una sesión de planificación + implementación; no se mezclan
  varios módulos sin relación en el mismo commit.
- **Sin abstracciones prematuras.** El proyecto evita infraestructura para módulos
  que todavía no existen — no se adelanta caché, colas o tablas de coste "por si
  acaso".
- **Regla permanente sobre el Informe:** cualquier módulo nuevo que añada datos
  reales (una tabla, un snapshot, un campo con valor de negocio) debe evaluar en la
  misma sesión si corresponde una sección nueva en el Informe
  (`src/lib/informe/sections.ts` + `InformeBuilder.tsx`) — no como tarea aparte.
- **Seguridad:** bcrypt para contraseñas, rate limiting de login, CSP en
  `next.config.ts`, secrets siempre cifrados antes de tocar BD.

## Dónde mirar para más detalle

- **[`docs/00-protocolo-trabajo.md`](./docs/00-protocolo-trabajo.md) — LEER PRIMERO
  antes de tocar código**: invariantes no negociables (datos reales, aislamiento
  multi-tenant, guard de gasto), recetas (añadir ruta API/página/migración),
  checklist de verificación, gotchas y coordinación entre varios agentes/personas.
- [`docs/06-roadmap-saas.md`](./docs/06-roadmap-saas.md) — decisiones de producto
  aprobadas y estado de las 5 fases de la transición a SaaS (fuente de verdad del
  estado; se actualiza en el mismo commit que el cambio)
- [`CLAUDE.md`](./CLAUDE.md) — instrucciones completas del proyecto (mismo
  contenido de fondo que este archivo, con más detalle módulo a módulo)
- [`docs/README.md`](./docs/README.md) — índice de toda la documentación
- [`docs/spec-original.md`](./docs/spec-original.md) — spec funcional completa de
  los 9 módulos originales
- [`docs/02-arquitectura.md`](./docs/02-arquitectura.md) — stack, estructura de
  carpetas, decisiones de infraestructura y por qué
- [`docs/04-modelo-de-datos.md`](./docs/04-modelo-de-datos.md) — esquema Prisma completo
