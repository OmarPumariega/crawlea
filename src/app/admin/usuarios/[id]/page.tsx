import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserMonthSpendUsd } from "@/lib/dataforseo/spend";
import { effectiveUserLimitUsd, getPlan } from "@/lib/plans";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import UserActions from "@/components/admin/UserActions";

export default async function AdminUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, role: true, status: true, plan: true,
      planOverride: true, spendLimitOverrideUsd: true, createdAt: true,
      projects: { select: { id: true, name: true, domain: true }, orderBy: { name: "asc" } },
      googleConnection: { select: { googleEmail: true } },
    },
  });
  if (!user) notFound();

  const spent = await getUserMonthSpendUsd(user.id);
  const limit = effectiveUserLimitUsd(user.plan, user.spendLimitOverrideUsd);
  const isAdminAccount = user.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plataforma · Usuarios"
        title={user.name || user.email}
        description={user.name ? user.email : undefined}
        actions={
          <Link href="/admin/usuarios" className="px-3 py-1.5 border border-line text-ink-soft text-xs font-medium rounded-xl hover:bg-background">
            ← Volver al listado
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5 space-y-3 text-sm">
          <h2 className="text-sm font-semibold text-ink">Cuenta</h2>
          <dl className="space-y-2">
            <Row k="Estado">{isAdminAccount ? <Pill tone="brand">Admin</Pill> : user.status === "suspended" ? <Pill tone="danger">Suspendida</Pill> : <Pill tone="info">Activa</Pill>}</Row>
            <Row k="Plan">{getPlan(user.plan).nombre}{user.planOverride && <span className="text-xs text-ink-faint"> · asignado a mano</span>}</Row>
            <Row k="Gasto del mes">{spent.toFixed(2)}${limit !== null && <span className="text-ink-faint"> / {limit.toFixed(2)}$ {user.spendLimitOverrideUsd !== null ? "(override)" : "(plan)"}</span>}</Row>
            <Row k="Google">{user.googleConnection ? user.googleConnection.googleEmail : "No conectado"}</Row>
            <Row k="Alta">{user.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</Row>
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-ink">Proyectos ({user.projects.length})</h2>
          {user.projects.length === 0 ? (
            <p className="text-sm text-ink-soft">Sin proyectos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {user.projects.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 border-b border-line last:border-0 pb-2 last:pb-0">
                  <Link href={`/app/proyectos/${p.id}`} className="text-ink hover:text-brand truncate">{p.name}</Link>
                  <span className="text-ink-faint truncate">{p.domain ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isAdminAccount ? (
        <p className="text-sm text-ink-soft">Las cuentas de administración de la plataforma no se gestionan desde este panel.</p>
      ) : (
        <UserActions userId={user.id} status={user.status} plan={user.plan} spendLimitOverrideUsd={user.spendLimitOverrideUsd} />
      )}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-faint">{k}</dt>
      <dd className="text-ink text-right">{children}</dd>
    </div>
  );
}
