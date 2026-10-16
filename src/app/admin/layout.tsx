import { redirect } from "next/navigation";
import { requireSession, isAdmin } from "@/lib/auth-guards";
import Providers from "@/components/Providers";
import PlatformShell from "@/components/admin/PlatformShell";
import AnalyticsIdentity from "@/components/analytics/AnalyticsIdentity";
import { analyticsIdentity } from "@/lib/analytics/identity";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Administración · Crawlea", robots: { index: false } };

// Panel de administración de la plataforma: solo role admin. El middleware ya
// filtra por JWT; aquí se revalida contra BD (cuenta activa) y el rol.
export default async function AdminPlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect("/acceso");
  if (!isAdmin(session)) redirect("/app");

  const identity = await analyticsIdentity(session.user.id);

  return (
    <Providers session={session}>
      {identity && <AnalyticsIdentity {...identity} />}
      <PlatformShell>{children}</PlatformShell>
    </Providers>
  );
}
