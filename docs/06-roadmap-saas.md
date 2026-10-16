# 06 — Roadmap SaaS

Transición de **panel interno** a **SaaS público multi-usuario**
(estilo Semrush/Dinorank): la gente se registra, prueba y se suscribe. Este documento
es la fuente de verdad del estado de esa transición y de las decisiones de producto
ya tomadas — se actualiza en el mismo commit que el cambio de fase.

## Decisiones de producto (aprobadas, no reabrir sin motivo)

| Tema | Decisión | Por qué |
|---|---|---|
| Marca y dominio | **Crawlea**, dominio `crawlea.com` (compra en trámite) | Nombre elegido para el lanzamiento público. El rebranding es completo: UI, docs, user-agent del crawler (`CrawleaBot/1.0`), remitente de emails, Docker/Traefik y `package.json`. |
| Estructura de dominio | **Un solo dominio**: web pública en `/`, herramienta en `/app`, admin de plataforma en `/admin` | Un solo despliegue (mismo Docker), sesión compartida, la autoridad SEO se concentra. Un subdominio `app.` puede añadirse después sin rehacer nada. |
| Registro | **Solo Google** (OAuth). El admin conserva email+contraseña | Sin gestión de contraseñas/reset/verificación de email, cuentas verificadas de serie, menos abuso. Añadir registro por email más adelante no requiere migración. |
| Pagos | **Stripe** (checkout hospedado, webhooks, billing portal) | Estándar, suscripciones recurrentes, portal sin UI propia, soporta tarjeta/Bizum/SEPA. |
| Entrada | **Freemium**: plan gratis permanente limitado + planes de pago | Sin urgencia temporal, captura registros (estilo Dinorank). El trial de pago se puede añadir después. |
| API keys | **De la plataforma**: los clientes consumen DataForSEO/OpenRouter de la cuenta del producto, con topes por cuenta | Modelo Semrush: el usuario paga suscripción, no gestiona claves. Las cachés compartidas (`KeywordDataCache`, `SerpCache`) amortizan coste entre usuarios. |
| Tenancy | **Multi-tenant simple**: `User` → `Project`, sin organizaciones/equipos en v1 | Complejidad mínima que sirve al producto actual; se puede añadir org-frente a user sin romper nada. |

## Estado

| Fase | Estado | Commit |
|---|---|---|
| 1 — Fundación multi-usuario | ✅ **Hecha** | `49e26fb` |
| 2 — Panel de administración de cuentas | ✅ **Hecha** (pendiente verificar en BD dev) | — |
| 3 — Suscripciones con Stripe + gating de módulos | ⬜ Pendiente | — |
| 4 — Web pública (marketing) | ✅ **Hecha** (textos legales pendientes de Omar) | — |
| 5 — Lanzamiento e infra | 🔶 **En progreso** | — |

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

## Fase 2 — Panel de administración de cuentas (`/admin`, role admin) (HECHA)

- **Layout** `src/app/admin/layout.tsx`: `requireSession()` + `isAdmin` (si no, a `/app`),
  shell propio (`src/components/admin/PlatformShell.tsx`: Resumen · Usuarios · Costes ·
  volver a la herramienta). Enlace "Administración" en `AdminSidebar` solo para el admin.
- **`/admin`**: cuentas, altas 30 días, gasto DataForSEO del mes vs tope global, cuentas
  ≥80% de su tope, cuentas por plan, top por gasto. **Sin ingresos/margen**: llegan con
  Stripe (Fase 3) — no hay fuente real todavía.
- **`/admin/usuarios`** (+ `[id]`): listado con búsqueda y filtros, gasto del mes por
  cuenta (`src/lib/admin/users.ts`, query agrupada). Acciones vía
  `PATCH|DELETE /api/admin/usuarios/[id]`: suspender/reactivar (efectivo al instante),
  cambiar plan (marca `planOverride`), tope de gasto manual (`spendLimitOverrideUsd`,
  sustituye al del plan) y borrar cuenta. Las cuentas admin no se tocan desde aquí.
- **`/admin/costes`**: gasto del mes por cuenta; el detalle por tipo de llamada y por
  proyecto sigue en `/app/costes` (vista global del admin).
- Migración `20261016180000_fase2_admin_cuentas`: `User.planOverride`,
  `User.spendLimitOverrideUsd`. El tope efectivo (`effectiveUserLimitUsd` en `plans.ts`)
  lo usan `assertWithinSpendLimit`, los avisos, el perfil, el panel y `/api/costes`.
- Los redirects legacy `/admin/*` → `/app/*` quedan solo para `proyectos`, `configuracion`
  y `perfil`.
- **Pendiente de la Fase 3:** el webhook de Stripe no debe pisar el plan si `planOverride`.

## Fase 3 — Suscripciones con Stripe + gating de módulos (HECHA; Stripe en modo REAL)

> **Producción en modo real** (cuenta hija «Crawlea» de la organización «Omar Pumariega»):
> productos Basic/Pro, destino de eventos `crawlea-suscripciones`, portal de clientes y clave
> restringida `crawlea-app-produccion` (`rk_live_`, sin operaciones que muevan fondos) ya
> creados en modo real; las 4 variables `STRIPE_*` del `.env` del VPS apuntan a ellos
> (copia de las de prueba en `.env.bak-test`). Las obligaciones fiscales (alta, IVA,
> facturación) son del titular y no las resuelve el código.

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

## Fase 2 — Panel de administración de cuentas (`/admin`, role admin) (HECHA)

- **Layout** `src/app/admin/layout.tsx`: `requireSession()` + `isAdmin` (si no, a `/app`),
  shell propio (`src/components/admin/PlatformShell.tsx`: Resumen · Usuarios · Costes ·
  volver a la herramienta). Enlace "Administración" en `AdminSidebar` solo para el admin.
- **`/admin`**: cuentas, altas 30 días, gasto DataForSEO del mes vs tope global, cuentas
  ≥80% de su tope, cuentas por plan, top por gasto. **Sin ingresos/margen**: llegan con
  Stripe (Fase 3) — no hay fuente real todavía.
- **`/admin/usuarios`** (+ `[id]`): listado con búsqueda y filtros, gasto del mes por
  cuenta (`src/lib/admin/users.ts`, query agrupada). Acciones vía
  `PATCH|DELETE /api/admin/usuarios/[id]`: suspender/reactivar (efectivo al instante),
  cambiar plan (marca `planOverride`), tope de gasto manual (`spendLimitOverrideUsd`,
  sustituye al del plan) y borrar cuenta. Las cuentas admin no se tocan desde aquí.
- **`/admin/costes`**: gasto del mes por cuenta; el detalle por tipo de llamada y por
  proyecto sigue en `/app/costes` (vista global del admin).
- Migración `20261016180000_fase2_admin_cuentas`: `User.planOverride`,
  `User.spendLimitOverrideUsd`. El tope efectivo (`effectiveUserLimitUsd` en `plans.ts`)
  lo usan `assertWithinSpendLimit`, los avisos, el perfil, el panel y `/api/costes`.
- Los redirects legacy `/admin/*` → `/app/*` quedan solo para `proyectos`, `configuracion`
  y `perfil`.
- **Pendiente de la Fase 3:** el webhook de Stripe no debe pisar el plan si `planOverride`.

## Fase 3 — Suscripciones con Stripe + gating de módulos (HECHA; Stripe en modo REAL)

> **Requisito previo (no técnico):** antes de activar cobros reales hay que tener la
> actividad dada de alta fiscalmente (autónomo o sociedad) y definir cómo se factura y
> declara el IVA. Hoy el titular es persona física sin alta. **Stripe está configurado en
> modo prueba (`sk_test_`)**: no se cobra nada real. Pasar a modo real = claves `sk_live_`,
> productos/precios y webhook nuevos en modo activo, y cambiarlos en Configuración/`.env`.

- **Planes** (`src/lib/plans.ts`): Gratis 0 € (1 proyecto), **Basic 9 €** (3 proyectos),
  **Pro 25 €** (10 proyectos), IVA incluido. Se eliminó el plan Business.
- **Créditos** (`src/lib/credits.ts`): el cliente nunca ve céntimos ni coste por llamada,
  solo una bolsa mensual de créditos: **Gratis 100, Basic 600, Pro 2000** (`creditosMes`
  en `plans.ts`). 1 crédito = 0,002 $ de coste real de DataForSEO (`USD_PER_CREDIT`), así que
  un chequeo de posición Top-10 cuesta 1 crédito. Por dentro nada cambia: el gasto sigue
  siendo `ApiUsageLog.costUsd` y el tope de la cuenta (`topeUsdMes`) se deriva de
  `creditosMes`; el guard (`assertWithinSpendLimit`) bloquea al agotarse y la bolsa se
  renueva sola el día 1 (mes natural). Solo cuenta DataForSEO: auditoría, títulos, schema,
  contenido y Copilot (IA) no gastan créditos. Las estimaciones previas a cada acción, el
  perfil, el dashboard, `/app/costes` y el informe muestran créditos al cliente; el admin
  sigue viendo USD reales (`/admin`, `/app/costes`). Ajustar valores = tocar `plans.ts` /
  `USD_PER_CREDIT`. Al cliente le basta: «posiciones, palabras clave… gastan créditos».
- **Gating**: Gratis excluye `backlinks`, `competidores` y `geogrid` (`PAID_MODULES`). Servidor:
  `moduleGate(session, módulo)` en `src/lib/auth-guards.ts` (402 `plan_required`, lee el plan
  de BD, el admin está exento) en las 13 rutas API de esos módulos; las 3 páginas muestran
  `UpgradeWall`; el sidebar pinta un candado.
- **Stripe** (`src/lib/stripe/`): `client.ts` (clave y price IDs vía `getSetting`, editables
  en Configuración: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_BASIC`,
  `STRIPE_PRICE_ID_PRO`), `sync.ts` (aplica la suscripción a `User`; respeta `planOverride`;
  `past_due` conserva el plan, `canceled/unpaid` vuelve a Gratis; cancela la suscripción al
  borrar la cuenta).
- Rutas: `POST /api/stripe/checkout` (suscripción), `POST /api/stripe/portal` (gestionar/cancelar),
  `POST /api/stripe/webhook` (público, firma verificada sobre el cuerpo crudo; eventos
  `checkout.session.completed` y `customer.subscription.created|updated|deleted`). El plan lo
  fija SOLO el webhook.
- UI: `PricingCards` es servidor; con Stripe configurado y sesión muestra `CheckoutButton`
  (evento `begin_checkout`), sin sesión envía a `/registro`; sin Stripe, «Pago disponible
  próximamente». `/app/perfil` muestra renovación y «Gestionar suscripción»; la vuelta de
  Checkout (`?pago=ok`) emite `purchase`.
- Stripe (cuenta Crawlea; hay copia equivalente en modo prueba): productos «Crawlea Basic» y «Crawlea Pro» (mensual), destino de
  eventos `crawlea-suscripciones` → `https://crawlea.com/api/stripe/webhook`, portal de
  clientes con la configuración por defecto (sin cambio de plan desde el portal: se cancela
  y se contrata el otro).

## Fase 4 — Web pública (marketing) (HECHA)

- Route group `src/app/(marketing)/` con header público («Entra» → `/acceso` → `/app`,
  «Empieza gratis» → `/registro`; con sesión muestra «Ir al panel») y footer con legales.
  La raíz `/` ya es la home (se eliminó el redirect a `/app`).
- `/` home (hero, funciones reales por módulo, datos reales, pasos, CTA), `/precios`
  (renderiza desde `plans.ts`; los CTA de pago llevan a `/registro` o a Checkout según Stripe/sesión, ver Fase 3), `/contacto` (formulario →
  `POST /api/contacto`: honeypot, rate limit 5/h por IP, envía por el SMTP existente a
  `ALERT_TO` con reply-to; 503 si no hay SMTP), `/legal/{privacidad,terminos,cookies}`
  **con huecos marcados** `[...]` — Omar aporta los textos definitivos.
- **Analizador del hero (conversión):** el visitante escribe su web →
  `POST /api/analizar-web` hace una revisión rápida REAL de la home (`src/lib/analyzer/
  quick-check.ts`: HTTPS, título, descripción, H1, canonical, viewport, alt, robots.txt,
  sitemap; sin APIs de pago; guarda SSRF y rate limit por IP) → recuento real de
  problemas y comprobaciones superadas (sin nota inventada) → el detalle sale borroso
  y el botón lleva a `/registro?web=dominio` → Google → directo a
  `/app/proyectos/nuevo?dominio=...` (asistente con el dominio ya puesto). No se pide email.
- Carrusel de funciones de la home arrastrable con ratón (y táctil nativo).
- Copy según `Guia de comunicación/GUIA-DE-COMUNICACION.md` (sin nombrar competencia,
  sin promesas; la «formación» de la marca NO se anuncia: no existe aún).
- SEO: `metadataBase` (de `NEXTAUTH_URL`), metadata + canonical por página, JSON-LD
  `SoftwareApplication` en la home, `sitemap.ts`, `robots.ts` (bloquea `/app`, `/admin`,
  `/api`), `opengraph-image.tsx`, `noindex` en `/app`, `/admin`, `/acceso`, `/registro`.
- CSP real en `next.config.ts` (`'unsafe-inline'` en script/style por Next; sin
  `form-action` a propósito: rompería el redirect de Google). Verificado sin
  violaciones en home/precios.
- Pendiente: textos legales, decidir si se añade cookie banner (hoy solo cookies
  técnicas → no hace falta), y revisar CSP en producción navegando la herramienta.

## Fase 5 — Lanzamiento e infra

Objetivo: dominio propio y todo lo externo resuelto.

- ✅ Dominio comprado: **crawlea.com**, DNS apuntando al VPS (84.46.249.81).
- ✅ Despliegue aislado en el VPS: proyecto propio en `/opt/crawlea`
  (`docker-compose.yaml` con redes/volumen/límites propios, routers
  `crawlea-*` en el Traefik compartido — único punto de acople, mismo patrón
  que cirochat). `NEXTAUTH_URL` ya es env de runtime, no horneada. Repo en
  `github.com/OmarPumariega/crawlea` (antes `seo-ciro`, renombrado con
  redirect automático de GitHub).
- ✅ www.crawlea.com → 301 a crawlea.com (canonical único).
- ⬜ Google Cloud: OAuth client de LOGIN (scopes básicos) + **verificación de los
  scopes GSC/GA4** para conexiones por usuario — dependencia externa LENTA
  (semanas), arrancarla cuanto antes.
- ⬜ Stripe: cuenta, productos y precios, endpoint de webhook (Fase 3).
- ⬜ Decidir si se mantiene redirect 301 desde la URL del despliegue antiguo
  y si se migran sus datos (proyectos del admin) a la instancia nueva; el
  despliegue antiguo sigue corriendo intacto e independiente.
- ⬜ `docs/` y README revisados contra el estado final.

## Riesgos y dependencias externas

- **Verificación OAuth de Google** (scopes sensibles de GSC/GA4): semanas, fuera de
  nuestro control. Arrancar en cuanto empiece la Fase 3.
- **Coste DataForSEO de usuarios free**: mitigado con `topeUsdMes` bajo del free y
  cachés compartidas; vigilar el gasto real por usuario (`ApiUsageLog`) y calibrar.
- **Rate limiting en memoria**: válido con 1 instancia (VPS único). Escalar → Redis.
- **Un solo `NEXTAUTH_URL`**: sin efecto mientras no haya subdominios; revisar si se
  añade `app.dominio` en el futuro.
