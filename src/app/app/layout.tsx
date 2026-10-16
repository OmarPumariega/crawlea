import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-guards";
import Providers from "@/components/Providers";
import AdminShell from "@/components/app/AdminShell";
import AnalyticsIdentity from "@/components/analytics/AnalyticsIdentity";
import { analyticsIdentity } from "@/lib/analytics/identity";
import TermsGate from "@/components/app/TermsGate";
import { prisma } from "@/lib/db/prisma";
import { LEGAL_VERSION } from "@/lib/legal/company";

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

  const identity = await analyticsIdentity(session.user.id);
  const terms = await prisma.user.findUnique({ where: { id: session.user.id }, select: { termsVersion: true } });
  const needsTerms = terms?.termsVersion !== LEGAL_VERSION;

  return (
    <Providers session={session}>
      {identity && <AnalyticsIdentity {...identity} />}
      {needsTerms && <TermsGate />}
      <AdminShell>{children}</AdminShell>
    </Providers>
  );
}
