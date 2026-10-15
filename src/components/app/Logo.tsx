import { cn } from "@/lib/utils";

// Marca de Crawlea: cuadrado redondeado + tres barras ascendentes (motivo de
// ranking/crecimiento). El símbolo usa el color de marca y no depende del
// color del texto contenedor:
//   • "brand" (default): cuadrado verde de marca, barras blancas — el tono
//     acento del sistema, funciona sobre claro y oscuro.
//   • "light" (fondos de tinta, p. ej. el login): cuadrado lima, barras tinta.

function LogoMark({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "light";
}) {
  const squareFill = tone === "brand" ? "var(--brand)" : "var(--signal)";
  const barsFill = tone === "brand" ? "#ffffff" : "var(--ink)";
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill={squareFill} />
      <rect x="8" y="17" width="3" height="7" rx="1" fill={barsFill} />
      <rect x="13.5" y="13" width="3" height="11" rx="1" fill={barsFill} />
      <rect x="19" y="9" width="3" height="15" rx="1" fill={barsFill} />
    </svg>
  );
}

export default function Logo({
  compact = false,
  tone = "brand",
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
      <LogoMark className="h-7 w-7 shrink-0" tone={tone} />
      {!compact && (
        <span className={cn("font-semibold tracking-tight text-gray-900", textClassName)}>
          Crawlea
        </span>
      )}
    </span>
  );
}
