import ModuleTabs from "@/components/app/ModuleTabs";

// Ficha del proyecto = Datos + Notas en un solo módulo (antes eran dos entradas
// del menú: Perfil y Notas). Es un grupo de rutas: las URLs no cambian
// (/app/proyectos/[id] y /app/proyectos/[id]/notas).
export default async function FichaLayout({
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
          { href: base, label: "Datos", hint: "Nombre, dominio y negocio local" },
          { href: `${base}/notas`, label: "Notas", hint: "Apuntes internos del cliente" },
        ]}
      />
      {children}
    </div>
  );
}
