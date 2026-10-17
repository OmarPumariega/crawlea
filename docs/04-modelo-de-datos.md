# 04 — Modelo de datos

Esquema actual en [`prisma/schema.prisma`](../prisma/schema.prisma).

## `User`

Cuenta de la plataforma (SaaS multi-usuario). Dos orígenes: Google OAuth (registro
público — `password` es null, sin gestión de contraseñas) y seed/manual (el admin de
la plataforma, con password bcrypt). Campos clave:

- `role`: `"admin"` (plataforma, ve todos los proyectos) | `"user"` (cliente).
- `status`: `"active"` | `"suspended"` — la suspensión corta el acceso al instante
  (`requireSession()` relee esto en cada petición).
- `plan` / `planStatus` / `stripeCustomerId` / `stripeSubscriptionId` /
  `currentPeriodEnd`: suscripción. `plan` responde a los ids de
  `src/lib/plans.ts` (`"free"` por defecto); los campos stripe* los sincroniza el
  webhook (Fase 3) y hoy son null.
- `planOverride` / `spendLimitOverrideUsd` (Fase 2): gestión manual desde `/admin`.
  `planOverride` = plan asignado a mano (el webhook de Stripe de la Fase 3 no debe
  pisarlo); `spendLimitOverrideUsd` = tope mensual de la cuenta que SUSTITUYE el del
  plan (`effectiveUserLimitUsd()` en `src/lib/plans.ts`).
- `name` / `image` / `emailVerified`: perfil OAuth de Google.

## `Project`

Entidad central: un cliente/dominio gestionado. **Pertenece a un `User`**
(`userId`, onDelete Cascade) — es la base del aislamiento multi-tenant: toda query
de API pasa por `projectForSession()` (`src/lib/auth-guards.ts`). De aquí cuelga el
resto de módulos (keywords, rank tracking, auditorías...).

- `isLocalBusiness` + campos NAP (`businessName`, `address`, `phone`, `hours`): solo
  rellenos si el proyecto es un negocio local. El spec (Módulo 9) usa este flag para
  decidir si se muestra el check de seguimiento Geogrid en el listado de keywords.
- `toneOfVoice` / `notes`: perfil de marca, lo consumen el Módulo 3 (títulos/metas)
  y el Módulo 7 (generador de contenido).
- `gscSiteUrl` / `ga4PropertyId` (Módulo 6): propiedad de Search Console / GA4
  seleccionada. Strings simples, no FK — son identificadores que vienen directos
  de la API de Google, no filas locales.
- `spendLimitUsd` (`Float?`): tope de gasto mensual de DataForSEO específico de este
  proyecto, opcional. Es el TERCER nivel de `assertWithinSpendLimit()` — por encima
  están el tope global de plataforma y el tope del plan del dueño.

## `TitleMetaGeneration` (Módulo 3)

Un registro por generación exitosa de título/meta descripción para una URL del
proyecto. Solo se persiste si el scraping y el parseo de la respuesta del LLM
funcionaron — los intentos fallidos no dejan fila, para que el historial del
proyecto solo muestre resultados usables. `variants` guarda las 3 variantes
(`{ title, description }`); `model` registra qué modelo de OpenRouter se usó.

## `SchemaGeneration` (Módulo 4)

Un registro por generación de schema.org (JSON-LD) validada. `suggestedType` es
la heurística automática; `selectedType` es el tipo realmente usado (puede ser
un override manual del combobox). Ambos pueden ser cualquiera de los ~20 tipos
del catálogo en `src/lib/seo/schema/catalog.ts`. `model` es `null` para los tipos
deterministas (`LocalBusiness`, `Organization`, `WebSite`, `BreadcrumbList`),
que se derivan del proyecto/página sin llamar al LLM; el resto usan un prompt
LLM genérico y dejan el modelo aquí.

## `ApiUsageLog` (infraestructura transversal, sección 5 del spec)

Versión mínima: un registro por llamada de pago a un LLM (hoy solo `api: "openrouter"`),
con tokens y coste si la API los devuelve. `projectId` es opcional con
`onDelete: SetNull` porque es dato contable que debe sobrevivir aunque se borre
el proyecto. Sin topes de gasto ni avisos por email todavía — eso es una tarea
aparte, cuando haga falta.

## `GoogleConnection` (Módulo 6)

Conexión OAuth2 de un USUARIO con Google (GSC/GA4) — **una fila por usuario**
(`userId @unique`, onDelete Cascade). En el SaaS cada cliente conecta su propia
cuenta; el upsert va contra `userId`, sin condición de carrera. La fila singleton
original migró al admin de plataforma en la migración `20261016120000_multiusuario_saas`.
`encryptedRefreshToken` usa `src/lib/crypto.ts`. `getGoogleClient(userId)` es la única
vía de construir el cliente — nunca traer el token a mano. La propiedad elegida por
proyecto vive directamente en `Project` (`gscSiteUrl`/`ga4PropertyId`), porque son
identificadores opacos de Google, no entidades locales.

## `ContentGeneration` (Módulo 7)

Un registro por generación exitosa de contenido (`blog` | `pagina` | `producto` |
`novedad_gbp`). El historial cronológico por proyecto hace de "versionado" (sección 6
del spec: comparar/recuperar) — no hace falta un modelo padre/hijo aparte, igual que
`TitleMetaGeneration`. `content` es texto plano con la jerarquía de encabezados marcada
en Markdown (`#`/`##`/`###`). Reutiliza `Project.toneOfVoice` en el prompt, sin campo
propio para el tono.

## `AuditRun` / `AuditPage` (Módulo 8)

Primer módulo con datos genuinamente anidados N-por-ejecución (hasta ~50 páginas), a
diferencia de las generaciones de una sola fila de los módulos 3/4/7 — de ahí una tabla
hija (`AuditPage`) en vez de un JSON dentro de `AuditRun`: la UI necesita listar/filtrar
páginas con problemas, y el histórico ("evolución") solo necesita los campos de
`AuditRun`, así que separarlos mantiene la consulta de historial ligera (`findMany` sin
`include`) frente a la de detalle (`include: { pages: true }`).

`AuditRun.status` (`pending`/`running`/`completed`/`failed`) lo gestiona el cron interno
de `src/instrumentation.ts` (ver `docs/02-arquitectura.md`), no una cola externa.
`categoryScores` guarda el detalle numérico de cada categoría (no solo el número final),
para que la puntuación sea auditable a mano. `psiData` es PageSpeed Insights **solo de
la home**, no por página — cada llamada tarda varios segundos, auditar cada página del
crawl sería impracticable en un job de fondo. `gscChecked` distingue "sin conexión de
Google/sin propiedad configurada" (no se afirma nada sobre indexación) de "sí se cruzó" —
y aun así `AuditPage.inSearchConsole` es una señal indirecta (impresiones en Search
Console en 90 días), no el resultado de la API de Inspección de URLs (exigiría un scope
OAuth nuevo → reconsentimiento de toda cuenta ya conectada).

**Ampliación tipo Screaming Frog** (auditoría on-page): `scoring.ts` pasó de 4 a 5
categorías — `indexabilidad` 25, `enlaces` 20, `onpage` 20 (nueva), `rendimiento` 25,
`accesibilidadImagenes` 10, pesos que siguen sumando 100. `onpage` penaliza
proporcionalmente a `paginasConIssuesOnPage / crawled`, usando los campos nuevos de
`AuditPage`: `title`/`titleLength` (issue si &lt;30 o &gt;65 caracteres, o ausente),
`metaDescription`/`metaLength` (&lt;120 o &gt;160), `h1Count` (issue si 0 o &gt;1),
`isRedirect` (via `res.redirected`), `externalLinksCount` + muestra de dominios
externos. `AuditRun` además guarda `robotsTxt` (contenido crudo) y datos de
`sitemap.xml` (`sitemapFound`, `sitemapUrlCount`, hasta 100 URLs de muestra). Sigue
degradando por categoría igual que el diseño original: sin datos de PSI,
`rendimiento` se excluye y el total se renormaliza sobre las categorías con dato; sin
páginas crawleadas con imágenes/enlaces/on-page problemáticos, esas categorías dan
nota completa en vez de penalizar por ausencia de datos.

## `KeywordStudy` / `Keyword` (Módulo 1)

Un "estudio" es una lista de keywords pegada por el usuario para un proyecto, con los
datos de DataForSEO ya resueltos (volumen/competición/CPC/intención) y la estructura de
URLs opcionalmente generada encima. Tope de 300 keywords por estudio (por encima del
"50-200 típico" del spec, muy por debajo del límite técnico de DataForSEO).

- `Keyword.searchVolume` `null` = DataForSEO no tiene dato. **Nunca** se fabrica un 0
  cuando el valor real es desconocido — el null es la única señal honesta.
- `competition`: `"HIGH" | "MEDIUM" | "LOW"`, tal cual lo devuelve DataForSEO.
- `intent`: `"informacional" | "mixta" | "transaccional"` — el vocabulario de 3 buckets
  del proyecto. Los 4 labels de DataForSEO (`informational`, `navigational`,
  `commercial`, `transactional`) se mapean en `mapIntent()`; `navigational`/`commercial`
  se agrupan como `mixta`.
- `priority` (0-100): cuota de volumen dentro del estudio
  (`round(volumen / volumenMáximo * 100)`). Competición y CPC **no** entran en la
  fórmula — quedan como columnas para ponderarlas a mano.
- `structure` (`Json?`): propuesta de URLs/H1/encabezados generada vía OpenRouter sobre
  las keywords ya persistidas. `null` hasta que se genera; regenerar sobrescribe (sin
  versionado en v1, `updatedAt` es la pista de auditoría).

## `KeywordDataCache` (infraestructura transversal, sección 5 del spec)

Primera tabla de caché de la app ("evitar pagar dos veces por el mismo dato"). Clave por
`(keyword, idioma, ubicación)`, **no** por proyecto/estudio — el volumen de una keyword es
un dato objetivo de SERP que no depende de quién lo pidió. 30 días de frescura (`cache.ts`)
antes de volver a pagar por ella. Consecuencia correcta pero a tener en cuenta: dos
proyectos que apunten a la misma keyword comparten caché (es el comportamiento deseado
para datos objetivos); no hay `forceRefresh` por proyecto todavía.

## `RankKeyword` / `RankPosition` (Módulo 5)

Una keyword que se sigue posicionalmente para un proyecto (dominio). Desacoplada de los
estudios del Módulo 1: la posición es un atributo del proyecto, no de la investigación,
así que la misma keyword en varios estudios se rastrea una sola vez. El `device`
(desktop/mobile) define un SERP distinto → es parte de la clave única (puedes seguir la
misma keyword en los dos devices por separado).

- `lastPosition`/`bestPosition` `null` = nunca comprobada, o fuera del `depth` pedido. `bestPosition`
  solo mejora (baja) con posiciones reales; un "fuera del depth" no empeora el histórico.
- `frequency` (`manual`/`daily`/`weekly`/`monthly`): las programadas las procesa el cron
  interno; `manual` solo se dispara desde la UI (chequeo síncrono).
- `depth` (10/30/50/100, default 10): resultados a parsear. DataForSEO factura por bloque de
  10, así que depth=10 es ~10x más barato que depth=100 — el equilibrio entre coste y visión
  profunda se decide por keyword (la mayoría del valor accionable está en página 1).
- `RankPosition`: una fila por chequeo, con `position` (null = fuera del depth) y `url`.
  Indexada por (rankKeywordId, checkedAt) para la consulta de histórico.

## `GeogridRun` (Módulo 9)

Una ejecución de geogrid: rejilla N×N (3/5/7) de puntos alrededor del negocio, cada uno
consultando Maps SERP para ver en qué posición (`rank_absolute`) aparece el negocio para la
keyword en ese punto. Procesada en background por el cron (pending → running → completed/failed),
como las auditorías del Módulo 8 — una rejilla 5×5 son 25 llamadas (~75s), demasiado largo
para síncrono.

Los puntos van en un JSON (`points`), no en una tabla hija, porque siempre se pintan juntos
como mapa de calor y nunca se filtran individualmente (a diferencia de las páginas de una
auditoría). `foundCount`/`averagePosition` resumen cuántos puntos posicionan y la media (solo
de los puntos donde el negocio apareció). El centro de la rejilla viene de `Project.lat`/`lng`
— de ahí que el geogrid solo esté disponible para proyectos locales con coordenadas.

## `TodoItem` (Módulo 2, ampliado)

Tarea manual (`text`, `dueDate?`, `done`) creada desde la pestaña Tareas, más un
segundo origen: al completarse una auditoría, `generateAuditTasks()`
(`src/lib/audit/job.ts`) crea automáticamente un `TodoItem` por tipo de hallazgo
accionable (títulos/metas ausentes o mal dimensionados, H1 ausente/duplicado, enlaces
rotos, contenido fino, sin HTTPS, etc.), con hasta 5 rutas de ejemplo y una sugerencia
de arreglo. No hay un campo de schema que distinga origen manual de automático — las
tareas automáticas se identifican por convención de texto (prefijo `🔍 [Auditoría
&lt;fecha&gt;]`). Antes de crear las nuevas, la siguiente auditoría marca `done` las
`TodoItem` automáticas de la anterior que empiecen por ese prefijo, así que cada
auditoría "sustituye" a la anterior en vez de acumular tareas obsoletas; las tareas
manuales nunca se tocan.

## `NotificationLog` (avisos por email)

Un registro por aviso enviado, con `@@unique([userId, type, key])` como mecanismo de
dedupe (un mismo evento nunca genera dos correos — y el mismo evento de dos usuarios
distintos son dos avisos legítimos). `userId` es el destinatario: el dueño del
proyecto para avisos de proyecto (auditoría, caída de posición) o de plan (tope de
gasto de su cuenta); los avisos de plataforma (tope global) se registran contra el
primer admin. `type`: `audit_completed`, `audit_failed`, `rank_drop` (caída de
posición ≥10 en un chequeo), `spend_warning` (≥80% de un tope), `spend_exceeded`
(≥100%). El envío usa `nodemailer` (`src/lib/notifications/email.ts`) y se degrada
con elegancia: si no hay `SMTP_HOST`/`ALERT_TO` configurados (`isEmailConfigured()`),
simplemente no se envía nada, sin error visible al usuario.

## `CopilotThread` (Copilot SEO)

Un hilo de conversación por proyecto: `title` (derivado de los primeros 40 caracteres
del primer mensaje del usuario) y `messages` (`Json`, array `{role, content}`). Chat de
**solo lectura** vía OpenRouter — el contexto del proyecto (última puntuación de
auditoría, top-10 de rank tracking, nº de estudios de keywords, gasto del mes) se
inyecta como texto plano en el system prompt; el modelo no tiene tool-calling ni puede
modificar datos.

## `SerpCache` (caché cruzada Rank Tracking ↔ TF-IDF)

El top-10 orgánico de cada chequeo de posición (Módulo 5) se guarda aquí 7 días. Es una
relación productor/consumidor de un solo sentido: Rank Tracking la escribe siempre que
comprueba una keyword; TF-IDF la lee antes de pagar su propia llamada SERP, y solo paga
si no hay entrada fresca. No es un reemplazo de `KeywordDataCache` (esa cachea volumen/
intención, esta cachea resultados de SERP).

## `Competitor` / `VisibilitySnapshot` (Competidores, Tier 2)

`Competitor`: dominios competidores que se decide trackear para un proyecto
(único por `projectId`+`domain`), más `contentGap`/`contentGapAt` cacheados — volver a
ver el content gap ya calculado es gratis, solo "Analizar" dispara una llamada nueva a
DataForSEO Labs `domain_intersection`.

`VisibilitySnapshot`: histórico de mediciones de visibilidad, reutilizado tanto para el
dominio propio del proyecto como para cada competidor (mismo mecanismo de tendencia
para ambos). Cada snapshot es una llamada de pago a `domain_rank_overview` (tráfico
orgánico estimado, nº de keywords) + `ranked_keywords` (top keywords, guardadas en
`topKeywords`) — de ahí que viendo el histórico no se repita el gasto, solo al pedir un
snapshot nuevo.

## `GscSnapshot` (Módulo 6 — Search Console)

Snapshot de rendimiento real de Search Console para un proyecto. Se persiste cada vez
que se abre el panel de GSC, con **dedupe por `projectId`+`month`** (un snapshot por
proyecto y mes, así se acumula histórico sin crecer indefinidamente). Guarda `totals`
(clics/impresiones/CTR/posición), `topQueries`, `topPages`, desgloses `byDevice` y
`byCountry`, y `monthly` (evolución 12 meses), más `rangeDays` del periodo consultado.

Lo lee el **Copilot** (`src/lib/copilot/context.ts`) — inyecta el resumen y las top
queries reales en el system prompt del chat — y queda disponible para que otros módulos
crujen con datos de tráfico reales sin volver a llamar a la API. Esos datos salen de la
misma `searchanalytics.query` que el panel, así que no añade conexión ni coste.

## `AiOverviewCheck` (Visibilidad IA — AI Overview por keyword)

Una fila por comprobación de una `RankKeyword`: `hasOverview` (Google mostró respuesta con
IA), `cited`/`citedRank` (el dominio del proyecto entre las fuentes), `references` (JSON
`[{domain,url,title,source}]`), `excerpt` (≤600 car.) y `costUsd`. Cascade desde `RankKeyword`.

## `AiPrompt` / `AiCheck` (Visibilidad IA — preguntas a ChatGPT/Perplexity, muestra puntual)

`AiPrompt`: pregunta seguida de un proyecto (`prompt` ≤200, único por proyecto, máx. 30).
`AiCheck`: una comprobación real (pregunta × asistente) con `cited`, `mentioned`,
`citedRank`, `sources` (JSON `[{domain,url,title}]`), `answer` (≤4000 car.) y `costUsd`; el
histórico permite ver la evolución. Cascade desde `Project` → `AiPrompt` → `AiCheck`.

## Informe compartible y marca blanca

`Project.reportShareToken` (único, enlace público), `reportEmailTo` y
`reportEmailLastMonth` (dedupe `"2026-09"` del envío mensual). `User.brandName`,
`brandLogo` (data URL ≤150 KB) y `brandColor` (`#RRGGBB`).

## Evolución prevista (no construida todavía)

Sin modelos pendientes de módulos del spec. Las mejoras transversales (topes por proyecto,
avisos email, exportación de informes, versionado de contenido) no exigen nuevos modelos en
esta fase.

Se añaden en la sesión de planificación de cada módulo, no por adelantado, para no
migrar tablas que luego cambian de forma al conocer el caso de uso real.
