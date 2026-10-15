import { cn } from "@/lib/utils";

// Pill de estado/estado ligero (badge redondeado con tinte suave). Sustituye
// a los badges ad-hoc que cada vista se montaba con bg-*-50 text-*-700.
export type PillTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONES: Record<PillTone, string> = {
  neutral: "bg-gray-100 text-gray-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
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
