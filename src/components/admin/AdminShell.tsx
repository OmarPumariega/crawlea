"use client";

import { useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import CopilotWidget from "@/components/admin/CopilotWidget";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    // Marco: la app entera flota como una tarjeta redondeada sobre un canvas
    // gris cálido (look "framed app" de las referencias). En móvil ocupa todo
    // el viewport sin margen ni radio.
    <div className="h-screen bg-canvas overflow-hidden p-0 md:p-4">
      <div className="h-full flex overflow-hidden bg-white rounded-none md:rounded-[24px] border border-line shadow-[0_8px_30px_rgba(26,29,26,0.08)]">
        <AdminSidebar navOpen={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 rounded-none md:rounded-[23px]">
          <AdminHeader onOpenNav={() => setNavOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
      {/* Vive aquí (no dentro de <main>) porque AdminShell se monta una sola
          vez para todo /admin — no remonta al navegar entre módulos de un
          proyecto, así que el widget conserva su estado (abierto/minimizado,
          hilo activo) sin Context ni librería de estado nueva. */}
      <CopilotWidget />
    </div>
  );
}
