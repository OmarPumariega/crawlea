# 06 — Roadmap SaaS

Transición de **panel interno de la agencia** a **SaaS público multi-usuario**
(estilo Semrush/Dinorank): la gente se registra, prueba y se suscribe. Este documento
es la fuente de verdad del estado de esa transición y de las decisiones de producto
ya tomadas — se actualiza en el mismo commit que el cambio de fase.

## Decisiones de producto (aprobadas, no reabrir sin motivo)

| Tema | Decisión | Por qué |
|---|---|---|
| Dominio | **Un solo dominio**: web pública en `/`, herramienta en `/app`, admin de plataforma en `/admin` | Un solo despliegue (mismo Docker), sesión compartida, la autoridad SEO se concentra. Un subdominio `app.` puede añadirse después sin rehacer nada. |
| Registro | **Solo Google** (OAuth). El admin conserva email+contraseña | Sin gestión de contraseñas/reset/verificación de email, cuentas verificadas de serie, menos abuso. Añadir registro por email más adelante no requiere migración. |
| Pagos | **Stripe** (checkout hospedado, webhooks, billing portal) | Estándar, suscripciones recurrentes, portal sin UI propia, soporta tarjeta/Bizum/SEPA. |
| Entrada | **Freemium**: plan gratis permanente limitado + planes de pago | Sin urgencia temporal, captura registros (estilo Dinorank). El trial de pago se puede añadir después. |
| API keys | **De la plataforma**: los clientes consumen DataForSEO/OpenRouter de la cuenta del producto, con topes por cuenta | Modelo Semrush: el usuario paga suscripción, no gestiona claves. Las cachés compartidas (`KeywordDataCache`, `SerpCache`) amortizan coste entre usuarios. |
| Tenancy | **Multi-tenant simple**: `User` → `Project`, sin organizaciones/equipos en v1 | Complejidad mínima que sirve al producto actual; se puede añadir org-frente a user sin romper nada. |

## Estado

| Fase | Estado | Commit |
|---|---|---|
| 1 — Fundación multi-usuario | ✅ **Hecha** | `49e26fb` |
| 2 — Panel de administración de cuentas | ⬜ Pendiente | — |
| 3 — Suscripciones con Stripe + gating de módulos | ⬜ Pendiente | — |
| 4 — Web pública (marketing) | ⬜ Pendiente | — |
| 5 — Lanzamiento e infra (dominio, OAuth verificado) | ⬜ Pendiente | — |

Para trabajar en una fase: leer [`00-protocolo-trabajo.md`](./00-protocolo-trabajo.md)
y marcarla aquí como "en progreso" al empezar.

## Fase 1 — Fundación multi-usuario (HECHA)

La barrera de seguridad que hacía imposible abrir al público, resuelta:

- **Schema** (migración `20261016120000_multiusuario_saas`): `Project.userId`
  (backfill de los datos existentes al admin actual), `User` con password nullable +
  perfil Google (`name`, `image`, `emailVerified`) + `status` (suspensión) + campos de
  suscripción (`plan`, `planStatus`, `stripeCustomerId`...), `GoogleConnection` por
  usuario (antes singleton), `NotificationLog.userId` (dedupe de avisos por usuario).
- **Auth** (`src/lib/auth.ts`): GoogleProvider (env `GOOGLE_AUTH_CLIENT_ID/SECRET`;
  sin ellas no aparece el botón y solo entra el admin por contraseña). Creación de
  cuenta en el primer login OAuth (role `user`, plan `free`). Sesión con
  `id`/`role`/`plan`/`status` refrescados desde BD.
- **Aislamiento** (`src/lib/auth-guards.ts`): `requireSession()` (revalida suspensión
  en BD en cada petición) + `projectForSession()` (admin ve todo, usuario solo lo
  suyo). Aplicado a TODAS las rutas API (~98) y páginas (layout de proyecto + dashboard
  acotado). Páginas públicas: `/acceso`, `/registro`.
- **Rutas**: panel en `/app` (antes `/admin`, redirects legacy en `next.config.ts`),
  perfil en `/app/perfil` (plan, consumo, conexión Google propia, borrado de cuenta
  en cascada vía `DELETE /api/perfil`). Componentes en `src/components/app/`.
- **Planes** (`src/lib/plans.ts`): free/pro/business con `topeUsdMes` y
  `maxProyectos` (cifras placeholder, ajustables ahí). Enforcement: tres niveles en
  `assertWithinSpendLimit()` (global → plan → proyecto) y 402 al superar el máximo de
  proyectos en `POST /api/proyectos`. **De momento free incluye todos los módulos**:
  sin vía de pago no se bloquea a nadie; el gating real llega con Stripe (Fase 3).
- **Avisos por email** al dueño del proyecto (`notify({ userId, ... })`); el tope
  global de plataforma sigue avisando al admin. `checkSpendNotifications()` añade el
  aviso de tope de plan por usuario.

Verificado con usuario de prueba: ve 0 proyectos (el admin tiene 5), proyecto ajeno
por ID → 404, config de plataforma → 403, 2º proyecto → 402. `tsc` y `build` limpios.

## Fase 2 — Panel de administración de cuentas (`/admin`, role admin)

Objetivo: control y visibilidad de todas las cuentas desde un panel propio.

- `/admin` dashboard: usuarios totales, registros de los últimos 30 días, gasto
  DataForSEO total vs ingresos Stripe del mes (margen) — depende de Stripe para el
  ingreso; sin Stripe, solo gasto.
- `/admin/usuarios`: listado (email, nombre, plan, estado, nº proyectos, gasto del
  mes) + detalle por usuario + acciones: suspender/reactivar (efectivo al instante
  gracias a `requireSession`), cambiar plan manualmente (override sin Stripe),
  tope de gasto adicional manual, borrar cuenta.
- La pestaña de costes global actual (`/app/costes` para el admin) se integra aquí
  como sección del panel admin.
- Middleware ya prepara el terreno (`/admin/*` exige role admin).

## Fase 3 — Suscripciones con Stripe + gating de módulos

Objetivo: la gente puede pagar y los módulos se bloquean por plan.

- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`,
  `STRIPE_PRICE_ID_BUSINESS` (añadir a `.env.example` y `settings-catalog.ts` si se
  quiere configurable desde el panel).
- `POST /api/stripe/checkout`: crea Checkout Session (modo subscription) desde el plan
  elegido en `/precios`.
- `POST /api/stripe/webhook` (público, firma verificada): `checkout.session.completed`,
  `customer.subscription.updated|deleted` → sincroniza `plan`/`planStatus`/
  `currentPeriodEnd`/`stripeCustomerId` en `User`.
- Stripe Billing Portal para cambiar/cancelar plan (sin UI propia).
- **Gating de módulos por plan**: recortar `modulos` del plan free en `plans.ts` y
  añadir enforcement server-side (`assertModuleAllowed`) en las rutas de módulo +
  candados con CTA a `/precios` en `AdminSidebar`/vistas. Excluir del free lo caro
  (backlinks, competidores, geogrid) según el coste real por usuario observado.

## Fase 4 — Web pública (marketing)

Objetivo: la home del SaaS en `/`.

- Route group `src/app/(marketing)/` con layout propio (header público con
  «Entrar», footer con legales).
- `/` home (hero, features por módulo, CTA «Empezar gratis»), `/precios` (renderiza
  desde `plans.ts` — misma fuente de verdad que el backend), `/contacto` (formulario
  vía SMTP/nodemailer ya existente), `/legal/{privacidad,terminos,cookies}` (el texto
  definitivo lo aporta Omar; deben citar a Stripe y Google).
- SEO de la propia web: metadata/OG, `sitemap.ts`, `robots.ts`, CSP real en
  `next.config.ts` (hoy solo `frame-ancestors`).
- La raíz actual (`/` → redirect a `/app`) se sustituye por la home.

## Fase 5 — Lanzamiento e infra

Objetivo: dominio propio y todo lo externo resuelto.

- Dominio nuevo (nombre a decidir por Omar; todo va por env). Quitar `NEXTAUTH_URL`
  horneado del Dockerfile → env de runtime; labels de Traefik en `docker-compose.yaml`
  al nuevo Host; redirect 301 de `seo.agenciaciro.com`.
- Google Cloud: OAuth client de LOGIN (scopes básicos) + **verificación de los
  scopes GSC/GA4** para conexiones por usuario — dependencia externa LENTA
  (semanas), arrancarla cuanto antes.
- Stripe: cuenta, productos y precios, endpoint de webhook.
- Seed: no crear admin con password por defecto en producción (solo con env explícito).
- `docs/` y README revisados contra el estado final.

## Riesgos y dependencias externas

- **Verificación OAuth de Google** (scopes sensibles de GSC/GA4): semanas, fuera de
  nuestro control. Arrancar en cuanto empiece la Fase 3.
- **Coste DataForSEO de usuarios free**: mitigado con `topeUsdMes` bajo del free y
  cachés compartidas; vigilar el gasto real por usuario (`ApiUsageLog`) y calibrar.
- **Rate limiting en memoria**: válido con 1 instancia (VPS único). Escalar → Redis.
- **Un solo `NEXTAUTH_URL`**: sin efecto mientras no haya subdominios; revisar si se
  añade `app.dominio` en el futuro.
