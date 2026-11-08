# 08 — MCP de Crawlea

Servidor MCP propio para trabajar los proyectos desde Claude Code (o cualquier cliente
MCP): leer el estado de un proyecto, lanzar estudios de keywords, rank tracking, geogrid,
auditorías, competidores o backlinks, y gestionar tareas y notas.

Estado: **disponible para todas las cuentas**; cada una crea sus propios tokens y el gasto sale
de sus créditos.

## Conectarlo (Claude Code)

1. En Crawlea: **Mi perfil → Conectar con Claude Code (MCP) → Crear token**. Copia el comando
   que aparece (el token solo se ve una vez).
2. En una terminal, pega el comando:

```bash
claude mcp add --transport http crawlea https://crawlea.com/api/mcp --header "Authorization: Bearer crw_TU_TOKEN"
```

3. Comprueba con `claude mcp list` (debe salir `crawlea` conectado) o `/mcp` dentro de Claude Code.
4. Úsalo hablando normal: «lista mis proyectos», «haz un estudio de keywords para X», «lanza un
   geogrid de “dentista gijón” 5×5».

Para probarlo contra el entorno local: `http://localhost:3000/api/mcp` (con `npm run dev`).
Añade `--scope user` si quieres el MCP disponible en todos tus proyectos de Claude Code y no
solo en la carpeta actual.

## Conector personalizado (OAuth) — la forma fácil

Sin tokens ni terminal: en Claude (**Ajustes → Conectores → Añadir conector personalizado**), ChatGPT,
Cursor o cualquier herramienta con conectores MCP, se pega solo la URL `https://crawlea.com/api/mcp`.
La herramienta abre Crawlea, el usuario inicia sesión (Google) y pulsa **Permitir**; ya está conectado.
Se revoca desde **Mi perfil** (papelera junto a cada aplicación conectada) y corta el acceso al instante.

Cómo funciona (OAuth 2.1, clientes públicos con PKCE S256 obligatorio):

1. `POST /api/mcp` sin token responde `401` con `WWW-Authenticate: Bearer resource_metadata="…"`.
2. El cliente lee `/.well-known/oauth-protected-resource[/api/mcp]` (RFC 9728) y después
   `/.well-known/oauth-authorization-server` (RFC 8414).
3. Se registra solo en `POST /api/oauth/register` (RFC 7591; modelo `OAuthClient`). Redirecciones
   admitidas: https, http solo en localhost (se ignora el puerto, RFC 8252) y esquemas de app
   (`cursor://`…); nunca `javascript:`/`data:`/`file:`.
4. Abre `/oauth/authorize` (pantalla de consentimiento; sin sesión redirige a `/acceso?next=…` y vuelve).
   El `POST /api/oauth/authorize` exige `Origin` propio (CSRF), re-valida todo y emite un código de un
   solo uso de 5 min (`OAuthCode`, solo hash). Exige los términos aceptados y `MCP_ADMIN_ONLY` respetado.
5. `POST /api/oauth/token`: canjea el código (PKCE) por un access token `crwo_…` de **1 hora** y un
   refresh token `crwr_…` de 90 días que **rota** en cada uso (`OAuthGrant`, solo hashes). Un código
   que falla la verificación queda quemado; un refresh ya usado no vale.
6. `/api/mcp` acepta `crwo_…` igual que los tokens `crw_…` a mano (`verifyToken`): misma identidad por
   `AsyncLocalStorage`, mismos guards, mismo límite de 120 llamadas/min.

Verificado con el cliente OAuth del SDK oficial de MCP (descubrimiento, registro, PKCE, consentimiento,
token y llamadas) y con `curl` para los casos de ataque (redirección ajena, CSRF, PKCE ausente o `plain`,
código reutilizado, refresh rotado, revocación, cuenta sin términos). **Sin verificar en vivo** con Claude.ai,
ChatGPT ni Cursor: los clientes reales pueden pedir algo que el SDK no (p. ej. otra ruta de metadatos).
Los tokens `crw_…` siguen siendo la vía para Claude Code, Codex y Gemini CLI.

## Otros clientes (Codex, Cursor, Gemini CLI, VS Code…)

El servidor habla MCP estándar por HTTP con token en cabecera, así que no depende de Claude: cualquier
cliente MCP con URL remota sirve. La tarjeta de **Mi perfil** genera la configuración exacta de cada
uno tras crear el token. Resumen (`URL` = `https://crawlea.com/api/mcp`):

| Cliente | Dónde / cómo |
|---|---|
| Claude Code | `claude mcp add --transport http crawlea URL --header "Authorization: Bearer TOKEN"` |
| Codex | `~/.codex/config.toml`: `[mcp_servers.crawlea]` con `url = "URL"` y `bearer_token_env_var = "CRAWLEA_TOKEN"` (exportando la variable) |
| Cursor | `~/.cursor/mcp.json`: `{"mcpServers":{"crawlea":{"url":"URL","headers":{"Authorization":"Bearer TOKEN"}}}}` |
| Gemini CLI | `gemini mcp add --transport http --header "Authorization: Bearer TOKEN" crawlea URL` |
| VS Code | `.vscode/mcp.json`: `{"servers":{"crawlea":{"type":"http","url":"URL","headers":{"Authorization":"Bearer TOKEN"}}}}` |
| Solo stdio | `npx -y mcp-remote URL --header "Authorization: Bearer TOKEN"` |

Compatibilidad pensada a propósito: respuestas JSON (sin necesidad de SSE), sin sesión, token también
por `X-API-Key`, CORS abierto (clientes en navegador), esquemas de herramientas simples (sin `anyOf` ni
`additionalProperties`, que algunos clientes rechazan), anotaciones `readOnlyHint` en las `list_`/`get_`
(los clientes pueden dejarlas pasar sin pedir permiso) y listas vacías de `resources`/`prompts`.

**Verificado:** conexión, listado y llamadas con el cliente oficial del SDK de MCP (TypeScript 1.32).
**Sin verificar en vivo:** las sintaxis de Codex, Cursor, Gemini CLI y VS Code están escritas según su
documentación pública, pero no se han probado con esas herramientas; si alguna cambia su formato de
configuración, se corrige en `CLIENTS` de `src/app/app/perfil/McpTokensCard.tsx`.
Los clientes que SOLO admiten OAuth usan el conector personalizado (sección siguiente).

## Cómo funciona

- **Endpoint:** `POST /api/mcp` (`src/app/api/mcp/route.ts`). Transporte Streamable HTTP en
  modo sin estado y con respuestas JSON (JSON-RPC 2.0 a mano, sin SDK: `initialize`, `ping`,
  `tools/list`, `tools/call`). `GET`/`DELETE` → 405.
- **Autenticación:** token personal `crw_…` (256 bits) en `Authorization: Bearer`. Modelo
  `ApiToken`: solo se guarda el **hash SHA-256**; revocar = `revokedAt`. Un token solo vale en
  `/api/mcp`, no abre ninguna otra ruta. Si la cuenta se suspende, el token deja de valer.
- **Identidad:** `src/lib/mcp/context.ts` (AsyncLocalStorage). Mientras corre una herramienta,
  `requireSession()` devuelve la sesión del dueño del token en vez de mirar la cookie.
- **Herramientas = los handlers de la web:** `src/lib/mcp/tools.ts` envuelve los `route.ts` de
  `/api/proyectos/[id]/**` (`invoke.ts` los llama sin red). Así el MCP hereda todo lo que ya
  hacen: aislamiento por propietario, gating por plan, **guard de gasto y créditos**,
  registro en `ApiUsageLog`. No hay una segunda vía a los datos.
- **Aislamiento extra:** el dispatcher comprueba `projectForSession()` antes de ejecutar
  cualquier herramienta con `projectId`, además de lo que haga el handler.
- **Rate limit:** 120 llamadas/min por token. Resultados recortados a ~60.000 caracteres.

## Herramientas

| Grupo | Herramientas | Coste |
|---|---|---|
| Proyectos | `list_projects`, `get_project_overview`, `create_project`, `update_project` | gratis |
| Tareas y notas | `list_tasks`, `create_task`, `update_task`, `list_notes`, `create_note` | gratis |
| Keywords | `list_keyword_studies`, `get_keyword_study`, `add_keywords_to_study` | gratis |
| | `create_keyword_study` (con keywords), `suggest_keywords` | DataForSEO Labs, ≈0,012 $ + 0,00012 $/resultado |
| | `generate_url_structure` | OpenRouter (céntimos) |
| Rank Tracking | `list_rank_keywords`, `get_rank_history`, `get_rank_visibility` | gratis |
| | `add_rank_keywords`, `import_study_to_rank_tracking`, `check_rank_keyword` | SERP, ≈0,002 $ (depth 10) por keyword |
| SEO local | `list_geogrid_runs`, `get_geogrid_run` | gratis |
| | `run_geogrid` (asíncrono: devuelve el run `pending`) | Maps SERP, ≈0,0035 $ × puntos |
| Auditoría | `list_audits`, `get_audit`, `run_audit` | gratis |
| Google | `get_opportunities`, `get_search_console`, `get_analytics` | gratis (cuota de Google) |
| Competidores | `list_competitors`, `add_competitor` | gratis |
| | `analyze_competitor`, `get_competitor_content_gap` | Labs, ≈0,012 $ + 0,00012 $/keyword |
| Backlinks | `get_backlinks` | gratis |
| | `analyze_backlinks` | API de Backlinks (gasto aparte); `limit: "all"` puede salir caro |
| On-page | `get_tfidf_results`, `analyze_url`, `run_pagespeed` | gratis |
| | `run_tfidf` | gratis si Rank Tracking ya lo consultó; si no ≈0,002 $ |
| | `generate_title_meta`, `generate_content` | OpenRouter (céntimos) |
| Visibilidad IA | `check_ai_overview` (módulo de pago) | ≈0,004 $ por keyword |
| Mediciones | `get_scheduled_measurements`, `set_scheduled_measurement`, `run_measurement_now` | `run_measurement_now` gasta lo que cueste esa medición |

No expuesto a propósito: borrar proyectos, cuenta/plan/Stripe, ajustes de plataforma, claves de
API y Google OAuth.

## Añadir una herramienta nueva

1. Si la lógica solo vive en un `route.ts`, no hace falta tocarla: añade su loader a `R` en
   `src/lib/mcp/tools.ts` y una entrada `tool(...)` que llame a `callRoute(R.x, "GET"|"POST"…)`.
2. Si gasta, **la descripción debe decir cuánto** (es lo que lee el modelo antes de lanzarla), y
   el handler debe seguir llamando a `assertWithinSpendLimit` (invariante 3 del protocolo).
3. Pruébala con un token real (ver abajo) y con un usuario NO admin para comprobar el aislamiento.

## Probar en local sin Claude Code

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer crw_TU_TOKEN" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Acceso

`MCP_ADMIN_ONLY = false` en `src/lib/mcp/access.ts`: cualquier cuenta activa ve la tarjeta de tokens
en su perfil. Para limitarlo (p. ej. solo planes de pago) ponlo a `true` o añade un `moduleGate`.
Pendiente: una sección de ayuda en la web pública con estos pasos.
