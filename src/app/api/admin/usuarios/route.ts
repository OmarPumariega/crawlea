import { NextResponse } from "next/server";
import { requireSession, isAdmin, unauthorized } from "@/lib/auth-guards";
import { listAdminUsers } from "@/lib/admin/users";

// Listado de cuentas de la plataforma — solo admin.
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();
  if (!isAdmin(session)) return NextResponse.json({ error: "Prohibido" }, { status: 403 });

  return NextResponse.json(await listAdminUsers());
}
