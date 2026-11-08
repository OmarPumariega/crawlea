import { NextRequest, NextResponse } from "next/server";
import { OAUTH_CORS, mcpUrl, publicOrigin } from "@/lib/mcp/oauth";

// RFC 9728: dice al cliente qué recurso es el MCP y quién autoriza el acceso.
// El cliente lo descubre solo gracias al `resource_metadata` del 401 de /api/mcp.
// La ruta admite el sufijo (/oauth-protected-resource/api/mcp) y la raíz.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  return NextResponse.json(
    {
      resource: mcpUrl(origin),
      authorization_servers: [origin],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp"],
      resource_name: "Crawlea",
    },
    { headers: OAUTH_CORS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS });
}
