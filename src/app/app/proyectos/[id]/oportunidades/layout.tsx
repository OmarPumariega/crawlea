import ModuleTabs from "@/components/app/ModuleTabs";

// Oportunidades: lo que Search Console ya dice que puedes mejorar (gratis).
export default async function OportunidadesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = `/app/proyectos/${id}/oportunidades`;
  return (
    <div className="space-y-4">
      <ModuleTabs
        tabs={[
          { href: base, label: "Mejoras rápidas", hint: "Qué tocar primero" },
          { href: `${base}/perdidas`, label: "Páginas que bajan", hint: "Tráfico que estás perdiendo" },
        ]}
      />
      {children}
    </div>
  );
}
