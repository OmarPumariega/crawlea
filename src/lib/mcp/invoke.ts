import { NextRequest } from "next/server";

// Llama a un handler de la API de Crawlea (los mismos route.ts que usa la web)
// sin pasar por la red. Todo lo que el handler comprueba (propietario del
// proyecto, plan, tope de gasto, validación del body) se aplica igual que desde
// la interfaz: el MCP no tiene un camino paralelo a los datos.

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> }
) => Promise<Response>;

export type RouteModule = Partial<Record<"GET" | "POST" | "PATCH" | "PUT" | "DELETE", unknown>>;
export type RouteLoader = () => Promise<RouteModule>;

export class McpToolError extends Error {}

type Call = {
  params?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
};

export async function callRoute(
  loader: RouteLoader,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  call: Call = {}
): Promise<unknown> {
  const mod = await loader();
  const handler = mod[method] as RouteHandler | undefined;
  if (!handler) throw new McpToolError(`Operación ${method} no disponible`);

  const url = new URL("http://crawlea.internal/api/mcp-internal");
  for (const [k, v] of Object.entries(call.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const hasBody = call.body !== undefined && method !== "GET";
  const req = new NextRequest(url, {
    method,
    headers: hasBody ? { "content-type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(call.body) : undefined,
  });

  const res = await handler(req, { params: Promise.resolve(call.params ?? {}) });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (res.status >= 400) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Error ${res.status}`;
    throw new McpToolError(`${msg} (HTTP ${res.status})`);
  }
  return data;
}
