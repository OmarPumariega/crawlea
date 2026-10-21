import ModuleTabs from "@/components/app/ModuleTabs";

// Barra superior común a todos los módulos: nombre del módulo a la izquierda y
// el historial a la derecha.
export default function IaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <ModuleTabs title="Visibilidad en IA" hint="AI Overview, ChatGPT y Perplexity" />
      {children}
    </div>
  );
}
