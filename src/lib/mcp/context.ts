import { AsyncLocalStorage } from "node:async_hooks";

// Identidad de la petición MCP en curso. El endpoint /api/mcp valida el token
// personal y ejecuta cada herramienta dentro de `mcpContext.run(...)`; mientras
// tanto, `requireSession()` (src/lib/auth-guards.ts) devuelve la sesión de ese
// usuario en vez de mirar la cookie de NextAuth. Así los handlers de la API que
// reutiliza el MCP conservan TODOS sus guards (aislamiento, plan, tope de gasto)
// y el token solo vale dentro de /api/mcp: no abre ninguna otra ruta.
//
// Se cuelga de globalThis para que sea una única instancia aunque el bundler
// duplique el módulo entre rutas.
export type McpIdentity = { userId: string };

const g = globalThis as { __crawleaMcpContext?: AsyncLocalStorage<McpIdentity> };

export const mcpContext: AsyncLocalStorage<McpIdentity> = (g.__crawleaMcpContext ??=
  new AsyncLocalStorage<McpIdentity>());
