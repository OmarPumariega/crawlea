import { redirect } from "next/navigation";
import { requireSession, isAdmin } from "@/lib/auth-guards";
import Providers from "@/components/Providers";
import PlatformShell from "@/components/admin/PlatformShell";

// Panel de administración de la plataforma: solo role admin. El middleware ya
// filtra por JWT; aquí se revalida contra BD (cuenta activa) y el rol.
export default async function AdminPlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect("/acceso");
  if (!isAdmin(session)) redirect("/app");

  return (
    <Providers session={session}>
      <PlatformShell>{children}</PlatformShell>
    </Providers>
  );
}
