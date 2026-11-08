import { NextRequest, NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { prisma } from "@/lib/db/prisma";
import { requireSession, projectForSession } from "@/lib/auth-guards";
import { mcpContext } from "@/lib/mcp/context";
import { McpToolError } from "@/lib/mcp/invoke";
import { TOOLS, TOOLS_BY_NAME } from "@/lib/mcp/tools";
import { verifyToken } from "@/lib/mcp/tokens";

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
const MAX_RESULT_CHARS = 60_000;

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
  let text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (text.length > MAX_RESULT_CHARS) {
    text =
      text.slice(0, MAX_RESULT_CHARS) +
      `\n\n[Resultado recortado: ${text.length - MAX_RESULT_CHARS} caracteres más. Pide un subconjunto más concreto.]`;
  }
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
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: { type: "object", properties: t.properties, required: t.required },
        })),
      });
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

function unauthorized() {
  return NextResponse.json(
    { error: "Token inválido o revocado" },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="crawlea"' } }
  );
}

export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const raw = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const verified = raw ? await verifyToken(raw) : null;
  if (!verified) return unauthorized();

  // La cuenta debe seguir activa (suspendida = el token deja de valer).
  const user = await prisma.user.findUnique({ where: { id: verified.userId }, select: { status: true } });
  if (!user || user.status !== "active") return unauthorized();

  try {
    await callLimiter.consume(verified.tokenId, 1);
  } catch {
    return NextResponse.json(rpcError(null, -32000, "Demasiadas peticiones, espera un momento."), { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, "JSON inválido"), { status: 400 });
  }

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleMessage(verified.userId, m as JsonRpcRequest)))).filter(
      (r) => r !== null
    );
    return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  }

  const response = await handleMessage(verified.userId, body as JsonRpcRequest);
  return response ? NextResponse.json(response) : new NextResponse(null, { status: 202 });
}

// Sin stream de servidor ni sesiones: el cliente lo sabe por el 405.
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
