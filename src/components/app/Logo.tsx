import { cn } from "@/lib/utils";

// Marca de Crawlea (Guia de estilo, §8): una «c» abierta en blanco con un
// punto en la boca (el rastreador entrando en la web), sobre cuadrado índigo
// brand-500 de esquinas muy redondas. El punto va en brand-100. El nombre va
// en minúsculas, un solo color (tinta sobre claro, claro sobre oscuro).
// El símbolo usa siempre los colores fijos de la guía — funciona igual sobre
// fondo claro y oscuro, por eso el prop tone ya no cambia el relleno (se
// conserva por compatibilidad con los usos existentes).
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="#4F5CF5" />
      <path
        d="M43.52 21.63A15.5 15.5 0 1 0 43.52 42.37"
        stroke="#ffffff"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <circle cx="46" cy="32" r="4.6" fill="#C3CAFF" />
    </svg>
  );
}

export default function Logo({
  compact = false,
  tone,
  className,
  textClassName,
}: {
  compact?: boolean;
  tone?: "brand" | "light";
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-7 w-7 shrink-0" />
      {!compact && (
        <span
          className={cn(
            "font-extrabold tracking-[-0.02em] text-ink lowercase",
            textClassName
          )}
        >
          crawlea
        </span>
      )}
    </span>
  );
}
