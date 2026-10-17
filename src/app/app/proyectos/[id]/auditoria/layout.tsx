import ModuleTabs from "@/components/app/ModuleTabs";

// Pestañas del módulo de Auditoría. Enlaces (PageRank interno y huérfanas,
// que se alimentan del último crawl) y Canibalizaciones (cruce con Search
// Console) viven aquí como pestañas desde la fusión de módulos — antes eran
// rutas propias /enlaces y /canibalizaciones.
export default async function AuditoriaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = `/app/proyectos/${id}`;
  return (
    <div className="space-y-4">
      <ModuleTabs
        tabs={[
          { href: `${base}/auditoria`, label: "Auditoría", hint: "Salud técnica del sitio" },
          { href: `${base}/auditoria/enlaces`, label: "Enlaces", hint: "PageRank y enlazado interno" },
          { href: `${base}/auditoria/canibalizaciones`, label: "Canibalizaciones", hint: "Páginas que compiten entre sí" },
        ]}
      />
      {children}
    </div>
  );
}
