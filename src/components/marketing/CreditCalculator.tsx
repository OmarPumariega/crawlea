"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { rankCheckCostUsd, FREQUENCY_PER_MONTH } from "@/lib/dataforseo/pricing";
import { USD_PER_CREDIT } from "@/lib/credits";
import { PUBLIC_PLANS } from "@/lib/plans";

// Calculadora: cuántos créditos al mes gasta el seguimiento de posiciones con
// tus palabras, tu frecuencia y tu profundidad. Usa las mismas tarifas y los
// mismos planes que la herramienta (pricing.ts y plans.ts); es una estimación.
const FREQS = [["monthly", "Mensual"], ["weekly", "Semanal"], ["daily", "Diaria"]] as const;
const DEPTHS = [10, 30, 50, 100] as const;

export default function CreditCalculator() {
  const [count, setCount] = useState(40);
  const [freq, setFreq] = useState<(typeof FREQS)[number][0]>("weekly");
  const [depth, setDepth] = useState<(typeof DEPTHS)[number]>(10);

  const perCheck = Math.round(rankCheckCostUsd(depth) / USD_PER_CREDIT);
  const credits = Math.round(count * perCheck * FREQUENCY_PER_MONTH[freq]);
  const plans = PUBLIC_PLANS.filter((p) => p.creditosMes !== null);
  const fit = plans.find((p) => (p.creditosMes ?? 0) >= credits);
  const max = Math.max(...plans.map((p) => p.creditosMes ?? 0));
  const pct = Math.min(100, (credits / max) * 100);

  const chip = (on: boolean) => cn("rounded-full border px-4 py-1.5 text-[13px] font-bold transition-colors", on ? "border-white bg-white text-[#0E1033]" : "border-white/25 text-white/75 hover:border-white/60 hover:text-white");

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-[#0E1033] p-6 text-white sm:p-10">
      <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 60% 70% at 0% 100%, rgba(79,92,245,0.5), transparent 70%)" }} />
      <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-brand-200">Calculadora de créditos</p>
          <h3 className="mt-3 text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl">Cuántos créditos gasta tu seguimiento</h3>
          <p className="mt-3 max-w-md leading-relaxed text-white/70">Un crédito es una comprobación de posición en el top 10. Cuanto más profundo y más frecuente, más créditos.</p>

          <div className="mt-8 space-y-6">
            <div>
              <label htmlFor="cc-count" className="flex items-baseline justify-between text-sm font-bold"><span>Palabras clave</span><span className="text-2xl font-extrabold tabular-nums">{count}</span></label>
              <input id="cc-count" type="range" min={5} max={300} step={5} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mk-range mt-3 w-full" />
            </div>
            <div>
              <p className="text-sm font-bold">Frecuencia</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Frecuencia">
                {FREQS.map(([k, l]) => <button key={k} type="button" aria-pressed={freq === k} onClick={() => setFreq(k)} className={chip(freq === k)}>{l}</button>)}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold">Profundidad</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Profundidad">
                {DEPTHS.map((d) => <button key={d} type="button" aria-pressed={depth === d} onClick={() => setDepth(d)} className={chip(depth === d)}>Top {d}</button>)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8">
          <p className="text-xs font-semibold text-white/60">Gasto estimado al mes</p>
          <p className="mt-1 text-6xl font-extrabold tracking-[-0.04em] tabular-nums">{credits.toLocaleString("es-ES", { useGrouping: true })}</p>
          <p className="text-sm text-white/60">créditos</p>

          <div className="mt-6">
            <div className="relative h-2.5 rounded-full bg-white/15">
              <div className="h-full rounded-full bg-brand-200 transition-[width] duration-500" style={{ width: `${pct}%` }} />
              {plans.map((p) => (
                <span key={p.id} className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-white/60" style={{ left: `${Math.min(99.5, ((p.creditosMes ?? 0) / max) * 100)}%` }} aria-hidden="true" />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-white/55">
              {plans.map((p) => <span key={p.id}>{p.nombre} · {(p.creditosMes ?? 0).toLocaleString("es-ES", { useGrouping: true })}</span>)}
            </div>
          </div>

          <p className="mt-6 leading-relaxed text-white/85">
            {fit
              ? <>Te encaja el plan <b className="text-white">{fit.nombre}</b>{fit.precioEurMes === 0 ? ": es gratis." : `, de ${fit.precioEurMes} € al mes.`}</>
              : <>Pasas de los {max.toLocaleString("es-ES", { useGrouping: true })} créditos del plan más alto. <Link href="/contacto" className="font-bold text-white underline underline-offset-4">Escríbenos</Link> y lo vemos.</>}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-white/50">Estimación orientativa. La auditoría, los títulos, el contenido y el asistente no gastan créditos. Cada palabra se comprueba como mucho una vez al día.</p>
        </div>
      </div>
    </div>
  );
}
