import Link from "next/link";
import { CheckCircle2, Link2 } from "lucide-react";

// Estado de la conexión con Google a la vista en la Ficha, para no tener que
// buscarla: sin conectar = botón grande; conectado pero sin propiedades =
// siguiente paso; todo listo = una línea discreta con acceso a los datos.
export default function GoogleConnectBanner({
  projectId,
  email,
  gscSelected,
  ga4Selected,
}: {
  projectId: string;
  email: string | null;
  gscSelected: boolean;
  ga4Selected: boolean;
}) {
  const base = `/app/proyectos/${projectId}`;

  if (!email) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-brand/20 bg-brand-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Link2 className="h-4 w-4" /></span>
          <div>
            <p className="text-[15px] font-bold text-ink">Conecta Google para ver tus datos reales</p>
            <p className="mt-0.5 max-w-xl text-sm text-ink-soft">
              Con Search Console y Analytics Crawlea te dice qué mejorar primero, qué páginas pierden tráfico y cuántas visitas llegan de verdad. Solo lectura, sin gastar créditos.
            </p>
          </div>
        </div>
        <a
          href={`/api/google/oauth/authorize?volver=${encodeURIComponent(base)}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
        >
          Conectar con Google
        </a>
      </section>
    );
  }

  if (!gscSelected || !ga4Selected) {
    const missing = [!gscSelected && "Search Console", !ga4Selected && "Analytics"].filter(Boolean).join(" y ");
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink"><CheckCircle2 className="h-4 w-4" /></span>
          <div>
            <p className="text-[15px] font-bold text-ink">Google conectado como {email}</p>
            <p className="mt-0.5 text-sm text-ink-soft">Falta elegir la propiedad de {missing} para este proyecto.</p>
          </div>
        </div>
        <Link href={`${base}/google`} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong">
          Elegir propiedades
        </Link>
      </section>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
      <CheckCircle2 className="h-4 w-4 text-accent-ink" />
      Google conectado ({email}): Search Console y Analytics de este proyecto.
      <Link href={`${base}/google`} className="font-semibold text-brand hover:underline">Ver datos →</Link>
    </p>
  );
}
