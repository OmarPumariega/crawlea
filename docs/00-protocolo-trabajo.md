# 00 — Protocolo de trabajo

Cómo se trabaja en este repo para que **cualquier persona o agente de IA** pueda
incorporarse, tocar código y salir sin romper nada ni duplicar trabajo. Es el primer
documento a leer después de [`../AGENTS.md`](../AGENTS.md) (resumen del proyecto) —
si algo de aquí contradice a otro doc, gana este archivo, y se corrige el otro.

## Orden de lectura al llegar (onboarding)

1. [`../AGENTS.md`](../AGENTS.md) (o [`../CLAUDE.md`](../CLAUDE.md) si usas Claude Code) — qué es esto, stack, estado.
2. Este protocolo.
3. [`06-roadmap-saas.md`](./06-roadmap-saas.md) — en qué fase estamos y qué toca ahora. **El roadmap es la fuente de verdad del estado**: si el código y el roadmap difieren, se actualiza el roadmap en el mismo commit.
4. Según la tarea: [`02-arquitectura.md`](./02-arquitectura.md) (estructura), [`04-modelo-de-datos.md`](./04-modelo-de-datos.md) (schema), [`05-autenticacion.md`](./05-autenticacion.md) (roles/aislamiento).

## Invariantes no negociables

Romper cualquiera de estas es un bug grave, no un detalle de estilo:

1. **Solo datos reales.** Todo lo que muestra la app viene de una fuente verificable
   (DataForSEO, GSC/GA4, scraping real, PageSpeed). Nada se inventa ni se estima sin
   fuente. Un módulo sin fuente de datos real no se construye.
2. **Aislamiento multi-tenant.** TODA ruta API empieza con `requireSession()` y todo
   acceso a un proyecto pasa por `projectForSession()` (`src/lib/auth-guards.ts`).
   Las rutas de recursos hijos (notas, keywords, runs...) verifican el proyecto padre.
   Una query nueva sobre `Project` o sus hijos SIN filtro por propietario es un bug de
   seguridad. El admin de la plataforma (role `admin`) es la única excepción intencional.
3. **Guard de gasto antes de pagar.** Toda llamada nueva a DataForSEO llama antes a
   `assertWithinSpendLimit(projectId)` (`src/lib/dataforseo/spend.ts`) y registra el
   coste real devuelto por la API en `ApiUsageLog`. La UI muestra estimación antes de
   confirmar (`src/lib/dataforseo/pricing.ts`).
4. **Secrets cifrados en BD.** Nada sensible en texto plano: `src/lib/crypto.ts`
   (AES-256-CBC) para `AppSetting` y refresh tokens de Google. El valor real nunca
   vuelve al cliente tras guardarse.
5. **Regla del Informe.** Cualquier módulo nuevo que añada datos reales evalúa en la
   misma sesión si le corresponde sección en el Informe (`src/lib/informe/sections.ts`
   + `InformeBuilder.tsx`).
6. **Idioma español en todo:** UI, comentarios, commits, docs.

## Flujo de trabajo

- **Una tarea = una sesión = uno o pocos commits.** No se mezclan módulos sin
  relación en el mismo commit. Los commits explican el *porqué*.
- **Tareas grandes → plan primero.** Cambios multi-archivo o con decisiones de
  producto se planifican y se aprueban antes de escribir código.
- **Antes de empezar**, mira el roadmap: marca en progreso lo que vas a hacer para
  que otro agente no lo duplique, y al terminar devuelve el estado real
  (hecho / en progreso + qué falta).
- **No commits a `main` sin verificar** (ver checklist de abajo). No se fuerza push.
  Rama corta si la tarea es larga o van a coincir varios agentes en el repo.
- **No se adelanta infraestructura** (cachés, colas, tablas "por si acaso") para
  módulos que no existen — decisión histórica del proyecto.

## Recetas rápidas

### Añadir una ruta API (bajo `/api/proyectos/[id]/...`)

```ts
import { requireSession, projectForSession } from "@/lib/auth-guards";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const project = await projectForSession(session, id);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  // ... queries de modelos hijos con where: { projectId: id }
}
```

- Recursos hijos (`[noteId]`, `[kwId]`...): mismo check del padre
  (`projectForSession(session, id, { id: true })`) antes de tocar el hijo.
- Rutas de plataforma (config global, gasto global): gate `isAdmin(session)` → 403.
- Nunca `getServerSession` directo: `requireSession()` es la vía (revalida
  suspensión contra BD).

### Añadir una página bajo un proyecto

Las páginas de `/app/proyectos/[id]/**` ya están aisladas por el layout
(`src/app/app/proyectos/[id]/layout.tsx` hace `projectForSession` + 404). Cualquier
query server-side dentro puede fiarse de ese gate — pero si la página carga datos de
OTRO usuario por métricas globales (como hacía el dashboard), filtra por
`project.userId` / `{ project: { userId } }`.

### Cambiar el schema de Prisma

1. Editar `prisma/schema.prisma`.
2. Migración: `npx prisma migrate dev --name lo_que_cambia`. Si hay datos existentes
   que requieren backfill, genera con `--create-only`, edita el SQL y aplica.
3. `npx prisma generate`.
4. **Reiniciar el dev server** (obligatorio — ver gotchas).

## Checklist antes de dar por terminada una tarea

- [ ] `npx tsc --noEmit` limpio.
- [ ] `npm run build` pasa (si tocaste rutas/redirects/middleware, es imprescindible).
- [ ] Smoke test mínimo con el dev server de lo que tocaste (login incluido si tocaste auth).
- [ ] Si tocaste aislamiento o auth: prueba con un usuario de prueba que NO ve datos
      del admin (crear usuario con password conocido en BD dev, entrar, borrar después).
- [ ] Docs actualizadas en el mismo commit: roadmap si cambia el estado de una fase,
      `02-arquitectura.md`/`04-modelo-de-datos.md` si cambia estructura o schema,
      `AGENTS.md` + `CLAUDE.md` si cambia algo importante del proyecto (van en sync).
- [ ] Commit en español explicando el porqué.

## Gotchas conocidos (leer una vez, ahorrar horas)

- **Dev server tras `prisma migrate`/`generate`: hay que reiniciarlo.** Next.js no
  recarga el cliente de Prisma; los modelos nuevos aparecen como `undefined` en
  runtime aunque `tsc` pase. Síntoma: 500 raros en rutas que usan modelos recientes.
- **El cron interno solo corre en producción** (`NODE_ENV=production`): para probarlo
  de verdad, `npm run build && npm run start`. En `npm run dev` nunca se dispara.
- **`instrumentation.ts`**: Next.js solo auto-descubre un fichero con EXACTAMENTE ese
  nombre en la raíz de `src/`. `instrumentation-node.ts` es un módulo importado,
  no una convención de Next.
- **CLI de Prisma en entornos sin red:** cuelga silenciosamente por el update-check.
  Usar `CI=true PRISMA_SKIP_UPDATE_CHECK=1 PRISMA_DISABLE_TELEMETRY=1` (así corren
  en sandboxes/CI).
- **`NEXTAUTH_URL` está horneado en el Dockerfile** (pendiente de mover a env de
  runtime en la Fase 5). Al cambiar de dominio, ojo con eso y con los redirect URIs
  de Google.
- **Rate limiting de login es en memoria** (`rate-limiter-flexible`): válido mientras
  haya una sola instancia. Si se escala a más réplicas, migrar a Redis antes.
- **Caches compartidas entre usuarios** (`KeywordDataCache`, `SerpCache`): son
  intencionalmente globales (el dato de SERP no depende de quién lo pidió) y ahorran
  coste real de DataForSEO. No hace falta "aislarlas" por usuario.

## Coordinación entre varios agentes/personas

- **El roadmap (`06-roadmap-saas.md`) manda.** Estado por fase: pendiente / en
  progreso / hecha. Se actualiza en el mismo commit del cambio.
- **Cada fase del SaaS es una unidad de trabajo independiente** con su propio
  commit(s). No se avanza la Fase N+1 sin cerrar la N salvo decisión expresa.
- **Si dos agentes coinciden:** ramas separadas + commits pequeños; el que integra
  primero resuelve sus propios conflictos. Nadie reescribe historia de `main`.
- **Dudas de producto** (precios, límites, nombres): quedan recogidas como
  decisiones en el roadmap o como pendientes explícitos ahí — no se deciden por
  cuenta propia en código.
