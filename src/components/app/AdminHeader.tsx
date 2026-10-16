"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun } from "lucide-react";
import Logo from "@/components/app/Logo";

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

// Alternar claro/oscuro (guía §2): recuerda la elección y respeta el sistema.
// No se pinta hasta estar montado para no discrepar con el HTML del servidor.
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return <span className="h-8 w-8" aria-hidden="true" />;
  const oscuro = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(oscuro ? "light" : "dark")}
      className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-soft hover:text-ink hover:bg-surface-muted transition-colors"
      aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={oscuro ? "Tema claro" : "Tema oscuro"}
    >
      {oscuro ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  );
}

// Cabecera: saludo y fecha a la izquierda, alternar de tema a la derecha (el
// avatar y el cierre de sesión viven en la tarjeta de usuario del sidebar).
export default function AdminHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const nombre = email.split("@")[0] || "equipo";

  return (
    <header className="flex items-center justify-between gap-3 h-14 px-4 md:px-6 border-b border-line bg-surface/70 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <button
          className="md:hidden text-ink-soft hover:text-ink transition-colors"
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
          <h2 className="text-base font-bold tracking-tight text-ink truncate">
            {saludo()}, {nombre} <span className="text-ink-faint">·</span>{" "}
            <span className="font-medium text-ink-soft">{fechaLarga()}</span>
          </h2>
        </div>
      </div>
      <ThemeToggle />
    </header>
  );
}
