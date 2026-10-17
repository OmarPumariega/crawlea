import ModuleTabs from "@/components/app/ModuleTabs";

// Competidores y Backlinks son una sola herramienta: el competidor es la
// unidad (visibilidad, content gap, autoridad y backlinks); Backlinks es una
// pestaña con el detalle del enlazado externo, no un módulo aparte. La ruta
// antigua /backlinks redirige aquí desde next.config.ts.
export default async function CompetidoresLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = `/app/proyectos/${id}/competidores`;
  return (
    <div className="space-y-4">
      <ModuleTabs
        tabs={[
          { href: base, label: "Competidores", hint: "Tráfico, keywords y content gap" },
          { href: `${base}/backlinks`, label: "Backlinks", hint: "Autoridad y enlaces entrantes" },
        ]}
      />
      {children}
    </div>
  );
}
