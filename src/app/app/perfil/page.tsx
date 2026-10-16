import { prisma } from "@/lib/db/prisma";
import { requireSession, isAdmin } from "@/lib/auth-guards";
import { getUserMonthSpendUsd } from "@/lib/dataforseo/spend";
import { getPlan } from "@/lib/plans";
import PageHeader from "@/components/app/PageHeader";
import GoogleConnectionCard from "@/components/app/GoogleConnectionCard";
import DeleteAccountButton from "@/app/app/perfil/DeleteAccountButton";

const ERROR_MESSAGES: Record<string, string> = {
  cancelado: "Has cancelado la conexión con Google.",
  estado_invalido: "La conexión ha caducado o no es válida. Inténtalo de nuevo.",
  sin_codigo: "Google no ha devuelto un código de autorización. Inténtalo de nuevo.",
  sin_refresh_token:
    "Google no ha devuelto un token permanente (ya habías dado acceso antes). Revoca el acceso en myaccount.google.com/permissions y vuelve a conectar.",
  sin_email: "No se ha podido obtener el email de la cuenta conectada.",
  configuracion_incompleta:
    "Faltan las credenciales de Google de la plataforma (Client ID, Client Secret o URI de redirección). Avísanos si ves este error.",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  const params = await searchParams;

  const [user, connection, spentUsd] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        name: true,
        image: true,
        plan: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
    }),
    prisma.googleConnection.findUnique({
      where: { userId: session.user.id },
      select: { googleEmail: true, scope: true, connectedAt: true },
    }),
    getUserMonthSpendUsd(session.user.id),
  ]);
  if (!user) return null;

  const admin = isAdmin(session);
  const plan = getPlan(user.plan);
  const pct = plan.topeUsdMes ? Math.min(100, (spentUsd / plan.topeUsdMes) * 100) : 0;
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? "Error al conectar con Google." : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Datos de tu cuenta, plan y consumo, y conexión con Google para Search Console y Analytics."
      />

      {/* Datos de la cuenta */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center gap-4">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-full border border-line object-cover"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-brand text-white flex items-center justify-center text-lg font-semibold">
              {(user.name ?? user.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-base font-semibold text-ink truncate">{user.name ?? "Sin nombre"}</p>
            <p className="text-sm text-ink-soft truncate">{user.email}</p>
            <p className="text-xs text-ink-faint mt-0.5">
              Miembro desde {formatDate(user.createdAt)} · {user._count.projects}{" "}
              {user._count.projects === 1 ? "proyecto" : "proyectos"}
            </p>
          </div>
        </div>
      </section>

      {/* Plan y consumo del mes */}
      <section className="rounded-2xl border border-line bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Plan</p>
            <p className="text-lg font-semibold text-ink">
              {admin ? "Plataforma (admin)" : plan.nombre}
            </p>
          </div>
          {!admin && (
            <p className="text-sm text-ink-soft">
              {plan.maxProyectos === null
                ? "Proyectos ilimitados"
                : `${user._count.projects} de ${plan.maxProyectos} proyectos`}
            </p>
          )}
        </div>

        {admin ? (
          <p className="text-sm text-ink-soft leading-relaxed">
            Esta es la cuenta de administración de la plataforma: sin límites de plan
            (el tope global de DataForSEO sigue aplicando a toda la instalación).
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">Consumo de API del mes (incluido en el plan)</span>
                <span className="font-medium text-ink">
                  {spentUsd.toFixed(2)}$ {plan.topeUsdMes !== null && `/ ${plan.topeUsdMes.toFixed(2)}$`}
                </span>
              </div>
              {plan.topeUsdMes !== null && (
                <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] ${
                      pct >= 100 ? "bg-alert" : pct >= 80 ? "bg-brand-300" : "bg-brand-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              {plan.topeUsdMes !== null && pct >= 80 && (
                <p className="text-xs text-accent-ink">
                  {pct >= 100
                    ? "Has agotado el gasto incluido este mes: las nuevas llamadas de pago están bloqueadas hasta el mes que viene."
                    : "Estás cerca del tope mensual de tu plan."}
                </p>
              )}
            </div>
            <p className="text-xs text-ink-faint">
              El consumo cuenta solo las llamadas de pago con coste real registradas este mes natural.
            </p>
          </>
        )}
      </section>

      {/* Conexión con Google (GSC/GA4) — una por usuario */}
      <GoogleConnectionCard
        connection={connection}
        justConnected={params.connected === "1"}
        errorMessage={errorMessage}
      />

      {/* Zona de peligro */}
      <section className="rounded-2xl border border-alert-tint bg-alert-tint/40 p-6 space-y-3">
        <p className="text-sm font-semibold text-alert-ink">Zona de peligro</p>
        {admin ? (
          <p className="text-sm text-ink-soft">
            La cuenta de administración de la plataforma no se puede borrar desde aquí.
          </p>
        ) : (
          <DeleteAccountButton />
        )}
      </section>
    </div>
  );
}
