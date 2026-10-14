import ModuleTabs from "@/components/admin/ModuleTabs";

// Pestañas del módulo Keywords. Arquitectura (generación de estructura de
// URLs a partir de un estudio) vive aquí como pestaña desde la fusión de
// módulos — antes era una ruta propia /arquitectura.
export default async function KeywordsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = `/admin/proyectos/${id}`;
  return (
    <div className="space-y-4">
      <ModuleTabs
        tabs={[
          { href: `${base}/keywords`, label: "Estudios" },
          { href: `${base}/keywords/arquitectura`, label: "Arquitectura" },
        ]}
      />
      {children}
    </div>
  );
}
