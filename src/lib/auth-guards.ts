import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import type { Prisma, Project } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { planAllowsModule, type ModuleId } from "@/lib/plans";
import { mcpContext } from "@/lib/mcp/context";

// Barrera de aislamiento multi-tenant de las rutas API. Todo handler llama a
// requireSession() en vez de getServerSession(), y todo acceso a un proyecto
// pasa por projectForSession() — el where compuesto garantiza que un usuario
// solo puede tocar sus propios proyectos (el admin de la plataforma ve todos,
// para soporte e inspección desde el panel de administración).

export async function requireSession(): Promise<Session | null> {
  // Petición que llega por el MCP (/api/mcp): el token ya se validó y la
  // identidad viene del contexto, no de la cookie. Mismo criterio de estado
  // fresco desde BD que abajo.
  const mcp = mcpContext.getStore();
  if (mcp) {
    const u = await prisma.user.findUnique({
      where: { id: mcp.userId },
      select: { id: true, email: true, name: true, role: true, plan: true, status: true },
    });
    if (!u || u.status !== "active") return null;
    return {
      user: { id: u.id, email: u.email, name: u.name, role: u.role, plan: u.plan, status: u.status },
      expires: new Date(Date.now() + 60_000).toISOString(),
    };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  // Estado fresco desde BD, no del JWT: una suspensión desde el panel de
  // administración corta el acceso en la siguiente petición, sin esperar a
  // que caduque el token.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  });
  if (!user || user.status !== "active") return null;

  return session;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === "admin";
}

// Respuesta estándar para "proyecto inexistente O de otro usuario": 404 sin
// distinguir el caso, para no filtrar la existencia de proyectos ajenos.
export function projectNotFound(): NextResponse {
  return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
}

export async function projectForSession(
  session: Session,
  projectId: string
): Promise<Project | null>;
export async function projectForSession<T extends Prisma.ProjectSelect>(
  session: Session,
  projectId: string,
  select: T
): Promise<Prisma.ProjectGetPayload<{ select: T }> | null>;
export async function projectForSession<T extends Prisma.ProjectSelect>(
  session: Session,
  projectId: string,
  select?: T
): Promise<Project | Prisma.ProjectGetPayload<{ select: T }> | null> {
  const where = isAdmin(session)
    ? { id: projectId }
    : { id: projectId, userId: session.user.id };
  return prisma.project.findUnique({
    where,
    ...(select ? { select } : {}),
  });
}

// Gating por plan en el servidor: devuelve una respuesta 402 si el plan de la
// cuenta no incluye el módulo, o null si puede continuar. El admin de la
// plataforma no está limitado. Lee el plan de BD (no del JWT) para que un
// cambio de plan o una cancelación apliquen en la siguiente petición.
export async function moduleGate(
  session: Session,
  moduleId: ModuleId
): Promise<NextResponse | null> {
  if (isAdmin(session)) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  if (user && planAllowsModule(user.plan, moduleId)) return null;
  return NextResponse.json(
    { error: "Este módulo no está incluido en tu plan. Mejora a Pro para usarlo.", code: "plan_required" },
    { status: 402 }
  );
}

// Para páginas de servidor: true si la cuenta puede usar el módulo.
export async function canUseModule(session: Session, moduleId: ModuleId): Promise<boolean> {
  return (await moduleGate(session, moduleId)) === null;
}
