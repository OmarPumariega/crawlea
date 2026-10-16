import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-guards";
import Providers from "@/components/Providers";
import AdminShell from "@/components/app/AdminShell";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Crawlea", robots: { index: false } };

// Layout del panel (/app): gate real de sesión (requireSession verifica en BD
// que la cuenta sigue activa — un usuario suspendido no entra ni con JWT
// válido) y monta el provider de sesión + el shell.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  if (!session) redirect("/acceso");

  return (
    <Providers session={session}>
      <AdminShell>{children}</AdminShell>
    </Providers>
  );
}
