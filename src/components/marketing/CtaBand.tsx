import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/marketing/Reveal";
import { Bars, Pill } from "@/components/marketing/mockups";

// Cierre de página: banda oscura a dos columnas (texto + tarjeta de muestra).
export default function CtaBand() {
  return (
    <section className="mx-auto w-full max-w-[1360px] px-5 pb-24 sm:px-8 lg:px-10">
      <Reveal>
        <div className="relative overflow-hidden rounded-[28px] bg-[#0E1033] text-white">
          <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 60% 100% at 100% 100%, rgba(79,92,245,0.5), transparent 70%)" }} />
          <div className="relative grid items-center gap-10 px-8 py-14 sm:px-14 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl">Rastrea tu primera web hoy</h2>
              <p className="mt-4 max-w-md text-lg text-white/70">Crea tu cuenta con Google. Tarda unos minutos y no pide tarjeta.</p>
              <Link href="/registro" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50">
                Empieza gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="hidden rounded-[20px] border border-line bg-surface p-5 text-ink lg:block" aria-hidden="true">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">Visibilidad</p>
                <Pill>▲ 4,2 pts</Pill>
              </div>
              <p className="mt-1 text-3xl font-extrabold tracking-[-0.03em] tabular-nums">68,4 %</p>
              <Bars values={[38, 46, 42, 55, 61, 72, 88]} className="mt-4 h-24" />
              <p className="mt-3 text-[11px] text-ink-faint">Datos de ejemplo.</p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
