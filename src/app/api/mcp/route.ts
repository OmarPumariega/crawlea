import { NextRequest, NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { prisma } from "@/lib/db/prisma";
import { requireSession, projectForSession } from "@/lib/auth-guards";
import { mcpContext } from "@/lib/mcp/context";
import { McpToolError } from "@/lib/mcp/invoke";
import { TOOLS, TOOLS_BY_NAME } from "@/lib/mcp/tools";
import { verifyToken } from "@/lib/mcp/tokens";
import { publicOrigin } from "@/lib/mcp/oauth";

// Servidor MCP de Crawlea (transporte Streamable HTTP, modo sin estado y
// respuestas JSON). Se conecta desde Claude Code con un token personal:
//   claude mcp add --transport http crawlea https://crawlea.com/api/mcp \
//     --header "Authorization: Bearer crw_..."
// Cada herramienta ejecuta un handler de la API de la web dentro de la
// identidad del dueño del token (src/lib/mcp/context.ts).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS =
  "Crawlea es un SaaS SEO con datos reales (DataForSEO, Search Console, GA4, PageSpeed). " +
  "Empieza por list_projects para obtener el projectId y por get_project_overview para ver el estado del proyecto. " +
  "Las herramientas de lectura son gratis; las que gastan (keywords, rank, geogrid, competidores, backlinks) indican su coste aproximado en la descripción. " +
  "Dile al usuario el coste antes de lanzar acciones caras (p. ej. backlinks con limit «all», estudios grandes). " +
  "Los datos son reales: si una herramienta devuelve vacío o error, díselo al usuario tal cual, no rellenes con estimaciones.";

// 120 llamadas por minuto y token: de sobra para trabajo interactivo, frena un
// bucle descontrolado antes de que llegue a gastar.
const callLimiter = new RateLimiterMemory({ points: 120, duration: 60 });

type JsonRpcId = string | number | null;
type JsonRpcRequest = { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> };

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function textResult(value: unknown, isError = false) {
  // Sin límite de tamaño: el resultado se devuelve entero.
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

async function callTool(userId: string, name: string, args: Record<string, unknown>) {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) return textResult(`Herramienta desconocida: ${name}`, true);

  try {
    return await mcpContext.run({ userId }, async () => {
      const session = await requireSession();
      if (!session) return textResult("Cuenta no disponible (suspendida o eliminada).", true);

      let pid = "";
      if (tool.project) {
        pid = typeof args.projectId === "string" ? args.projectId : "";
        // Aislamiento: se comprueba aquí, además de en cada handler. Un id
        // ajeno o inexistente da el mismo error.
        const project = pid ? await projectForSession(session, pid, { id: true }) : null;
        if (!project) return textResult("Proyecto no encontrado. Usa list_projects para ver los ids válidos.", true);
      }
      const data = await tool.run(args, pid);
      return textResult(data ?? { ok: true });
    });
  } catch (error) {
    if (error instanceof McpToolError) return textResult(error.message, true);
    console.error(`[mcp] ${name}:`, error);
    return textResult("Error interno al ejecutar la herramienta.", true);
  }
}

async function handleMessage(userId: string, msg: JsonRpcRequest) {
  const id = msg.id ?? null;
  const isNotification = msg.id === undefined;

  switch (msg.method) {
    case "initialize": {
      const asked = typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "";
      return rpcResult(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "crawlea", title: "Crawlea", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, {
        tools: TOOLS.map((t) => {
          // Los list_/get_ solo leen: los clientes (Codex, Cursor...) pueden
          // dejarlos pasar sin pedir permiso cada vez. El resto escribe o gasta.
          const readOnly = /^(list|get)_/.test(t.name);
          return {
            name: t.name,
            title: t.name.replace(/_/g, " "),
            description: t.description,
            inputSchema: {
              type: "object",
              properties: t.properties,
              ...(t.required.length ? { required: t.required } : {}),
            },
            annotations: { readOnlyHint: readOnly, ...(readOnly ? {} : { destructiveHint: false }), openWorldHint: !readOnly },
          };
        }),
      });
    // Algunos clientes piden estas listas aunque el servidor no las anuncie.
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "resources/templates/list":
      return rpcResult(id, { resourceTemplates: [] });
    case "prompts/list":
      return rpcResult(id, { prompts: [] });
    case "tools/call": {
      const name = typeof msg.params?.name === "string" ? msg.params.name : "";
      const args =
        msg.params?.arguments && typeof msg.params.arguments === "object"
          ? (msg.params.arguments as Record<string, unknown>)
          : {};
      return rpcResult(id, await callTool(userId, name, args));
    }
    default:
      if (isNotification || msg.method?.startsWith("notifications/")) return null;
      return rpcError(id, -32601, `Método no soportado: ${msg.method ?? "(vacío)"}`);
  }
}

// CORS abierto: el acceso va por token en cabecera (no por cookie), así que no
// hay credenciales ambientales que proteger. Hace falta para clientes que corren
// en el navegador (MCP Inspector, conectores web).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, X-API-Key, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...CORS, ...extra } });
}
function empty(status: number, extra: Record<string, string> = {}) {
  return new NextResponse(null, { status, headers: { ...CORS, ...extra } });
}

// El `resource_metadata` es lo que hace que un cliente MCP compatible con OAuth
// (conector personalizado de Claude, ChatGPT, Cursor...) descubra solo cómo
// pedir permiso al usuario (RFC 9728). Los clientes con token a mano lo ignoran.
function unauthorized(req: NextRequest, hadToken: boolean) {
  const metadata = `${publicOrigin(req)}/.well-known/oauth-protected-resource/api/mcp`;
  const challenge =
    `Bearer realm="crawlea", resource_metadata="${metadata}"` +
    (hadToken ? ', error="invalid_token", error_description="Token inválido, caducado o revocado"' : "");
  return json({ error: "Token inválido o revocado" }, 401, { "WWW-Authenticate": challenge });
}

export async function OPTIONS() {
  return empty(204);
}

// Token por «Authorization: Bearer crw_…» (lo normal) o por «X-API-Key», para
// clientes que no dejan fijar Authorization.
function tokenFrom(req: NextRequest): string {
  const header = req.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return (req.headers.get("x-api-key") ?? "").trim();
}

export async function POST(req: NextRequest) {
  const raw = tokenFrom(req);
  const verified = raw ? await verifyToken(raw) : null;
  if (!verified) return unauthorized(req, raw !== "");

  // La cuenta debe seguir activa (suspendida = el token deja de valer).
  const user = await prisma.user.findUnique({ where: { id: verified.userId }, select: { status: true } });
  if (!user || user.status !== "active") return unauthorized(req, true);

  try {
    await callLimiter.consume(verified.tokenId, 1);
  } catch {
    return json(rpcError(null, -32000, "Demasiadas peticiones, espera un momento."), 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "JSON inválido"), 400);
  }

  const isMessage = (m: unknown): m is JsonRpcRequest => !!m && typeof m === "object" && !Array.isArray(m);

  if (Array.isArray(body)) {
    const out = (
      await Promise.all(
        body.map((m) => (isMessage(m) ? handleMessage(verified.userId, m) : rpcError(null, -32600, "Petición inválida")))
      )
    ).filter((r) => r !== null);
    return out.length ? json(out) : empty(202);
  }
  if (!isMessage(body)) return json(rpcError(null, -32600, "Petición inválida"), 400);

  const response = await handleMessage(verified.userId, body);
  return response ? json(response) : empty(202);
}

// Sin stream de servidor ni sesiones: el cliente lo sabe por el 405.
export async function GET() {
  return empty(405, { Allow: "POST, OPTIONS" });
}
export async function DELETE() {
  return empty(405, { Allow: "POST, OPTIONS" });
}
