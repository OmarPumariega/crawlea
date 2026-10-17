import ModuleTabs from "@/components/app/ModuleTabs";

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
  const base = `/app/proyectos/${id}`;
  return (
    <div className="space-y-4">
      <ModuleTabs
        tabs={[
          { href: `${base}/keywords`, label: "Estudios", hint: "Investiga y guarda keywords" },
          { href: `${base}/keywords/arquitectura`, label: "Arquitectura", hint: "Árbol de URLs propuesto" },
        ]}
      />
      {children}
    </div>
  );
}
