import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin, requireSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { LEGAL_VERSION } from "@/lib/legal/company";
import { MCP_ADMIN_ONLY } from "@/lib/mcp/access";
import { firstValues, redirectWith, validateAuthorize } from "@/lib/mcp/authorize";
import Logo from "@/components/app/Logo";

export const metadata = { title: "Conectar con Crawlea", robots: { index: false } };
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-6 space-y-5">
        <Logo />
        {children}
      </div>
    </div>
  );
}

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Shell>
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
      <div className="text-sm text-ink-soft space-y-3">{children}</div>
    </Shell>
  );
}

// Pantalla de consentimiento del conector MCP: la herramienta de IA (Claude,
// ChatGPT, Cursor...) redirige aquí al usuario. Sin sesión → login y vuelta.
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = firstValues(sp);
  const check = await validateAuthorize(params);

  if (!check.ok && check.fatal) {
    return (
      <Problem title="No se puede conectar">
        <p>{check.message}</p>
        <p>Vuelve a la herramienta de IA e inténtalo de nuevo.</p>
      </Problem>
    );
  }
  if (!check.ok) {
    redirect(redirectWith(check.redirectUri, { error: check.error, error_description: check.description, state: check.state }));
  }

  const session = await requireSession();
  if (!session) {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]);
    redirect(`/acceso?next=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`);
  }

  if (MCP_ADMIN_ONLY && !isAdmin(session)) {
    return (
      <Problem title="Aún no disponible">
        <p>El MCP de Crawlea todavía no está disponible para tu cuenta.</p>
      </Problem>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, termsVersion: true },
  });
  if (user?.termsVersion !== LEGAL_VERSION) {
    return (
      <Problem title="Antes, acepta los términos">
        <p>Entra en Crawlea y acepta los términos y la política de privacidad. Después vuelve a conectar desde tu herramienta de IA.</p>
        <Link href="/app" className="inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">
          Ir a Crawlea
        </Link>
      </Problem>
    );
  }

  let host = check.redirectUri;
  try {
    const u = new URL(check.redirectUri);
    host = u.host || u.protocol;
  } catch {
    /* se muestra tal cual */
  }

  return (
    <Shell>
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-ink">
          «{check.client.name}» quiere conectarse a tu cuenta de Crawlea
        </h1>
        <p className="text-sm text-ink-soft">
          Sesión iniciada como <span className="font-medium text-ink">{user?.email}</span>.
        </p>
      </div>

      <ul className="space-y-2 text-sm text-ink-soft list-disc pl-5">
        <li>Ver tus proyectos y todos sus datos (posiciones, auditorías, Search Console…).</li>
        <li>Crear y editar tareas y notas.</li>
        <li>
          Lanzar análisis que <span className="font-medium text-ink">gastan créditos de tu cuenta</span>, con el mismo tope que
          en la web.
        </li>
      </ul>
      <p className="text-xs text-ink-faint">
        Volverás a <span className="font-medium">{host}</span>. Continúa solo si has iniciado tú esta conexión. Puedes
        revocar el permiso cuando quieras desde Mi perfil.
      </p>

      <form method="post" action="/api/oauth/authorize" className="flex gap-2">
        <input type="hidden" name="client_id" value={check.client.id} />
        <input type="hidden" name="redirect_uri" value={check.redirectUri} />
        <input type="hidden" name="response_type" value="code" />
        <input type="hidden" name="code_challenge" value={check.codeChallenge} />
        <input type="hidden" name="code_challenge_method" value="S256" />
        {check.state && <input type="hidden" name="state" value={check.state} />}
        <button
          type="submit"
          name="decision"
          value="allow"
          className="flex-1 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
        >
          Permitir
        </button>
        <button
          type="submit"
          name="decision"
          value="deny"
          className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-muted"
        >
          Cancelar
        </button>
      </form>
    </Shell>
  );
}
