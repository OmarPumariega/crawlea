import { cn } from "@/lib/utils";

// Pill de estado (badge píldora con tinte suave), en el lenguaje de la guía
// de estilo: lo positivo/sube es AZUL (accent), el peligro es el coral de
// alerta y no existe el verde/ámbar en la interfaz. "A medias" (warning) es
// un paso más de tinte dentro de la misma rampa índigo (brand-100/700).
export type PillTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONES: Record<PillTone, string> = {
  neutral: "bg-surface-muted text-ink-soft",
  success: "bg-accent-tint text-accent-ink",
  warning: "bg-brand-100 text-brand-700",
  danger: "bg-alert-tint text-alert-ink",
  info: "bg-accent-tint text-accent-ink",
  brand: "bg-brand/10 text-brand",
};

export default function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
