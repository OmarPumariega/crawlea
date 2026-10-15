"use client";

import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import Logo from "@/components/admin/Logo";

// Saludo según la hora local del usuario (el panel se usa a diario, da calor).
function saludo(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 14) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

// Fecha larga en español: "martes, 14 de octubre" — capitalizo el primer día.
function fechaLarga(): string {
  const f = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return f.charAt(0).toUpperCase() + f.slice(1);
}

// Cabecera v3: mínima — saludo y fecha a la izquierda (el avatar y el cierre
// de sesión viven en la tarjeta de usuario del final del sidebar).
export default function AdminHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const nombre = email.split("@")[0] || "equipo";

  return (
    <header className="flex items-center justify-between gap-3 h-14 px-4 md:px-6 border-b border-line bg-white/70 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <button
          className="md:hidden text-gray-500 hover:text-gray-900 transition-colors"
          onClick={onOpenNav}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Logo en la cabecera solo en móvil (en escritorio ya está en el sidebar) */}
        <div className="md:hidden">
          <Logo compact />
        </div>
        <div className="hidden md:block min-w-0">
          <h2 className="text-base font-bold tracking-tight text-gray-900 truncate">
            {saludo()}, {nombre} <span className="text-gray-300">·</span>{" "}
            <span className="font-medium text-gray-400">{fechaLarga()}</span>
          </h2>
        </div>
      </div>
    </header>
  );
}
