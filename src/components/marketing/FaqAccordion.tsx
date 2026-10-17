"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/track";

type Item = { q: string; a: string; cat: string };

export default function FaqAccordion({ items, cats }: { items: Item[]; cats: string[] }) {
  const [cat, setCat] = useState(cats[0]);
  const [open, setOpen] = useState<string | null>(null);
  const shown = items.filter((f) => f.cat === cat);

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.7fr]">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <p className="text-sm font-bold text-ink"><span className="text-brand">05</span><span className="mx-2 text-ink-faint">/</span>Preguntas</p>
        <h2 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl">Preguntas frecuentes</h2>
        <div role="tablist" aria-label="Temas" className="mt-8 flex flex-wrap gap-2 lg:flex-col lg:items-start">
          {cats.map((c) => (
            <button
              key={c} type="button" role="tab" aria-selected={c === cat}
              onClick={() => { setCat(c); setOpen(null); }}
              className={cn("rounded-full border px-4 py-2 text-sm font-bold transition-colors", c === cat ? "border-[#0E1033] bg-[#0E1033] text-white" : "border-line bg-surface text-ink-soft hover:border-ink/30 hover:text-ink")}
            >{c}</button>
          ))}
        </div>
        <div className="mt-10 rounded-[20px] border border-line bg-surface p-5">
          <p className="font-bold text-ink">¿No está tu duda?</p>
          <p className="mt-1 text-sm text-ink-soft">Cuéntanos qué necesitas y te respondemos.</p>
          <Link href="/contacto" data-track="faq_contact_click" className="mt-3 inline-block text-sm font-bold text-brand hover:text-brand-strong">Escríbenos</Link>
        </div>
      </div>

      <div className="divide-y divide-line border-y border-line" key={cat}>
        {shown.map((f, i) => {
          const isOpen = open === f.q;
          return (
            <div key={f.q} className={cn("mk-stagger", isOpen && "faq-open")}>
              <div style={{ ["--i" as string]: i }}>
                <button
                  type="button" aria-expanded={isOpen}
                  onClick={() => { track("faq_toggle", { question: f.q }); setOpen(isOpen ? null : f.q); }}
                  className="group flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-bold text-ink"
                >
                  <span className="transition-colors group-hover:text-brand">{f.q}</span>
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300", isOpen ? "rotate-45 border-brand bg-brand text-white" : "border-line text-brand")}><Plus className="h-4 w-4" /></span>
                </button>
                <div className="faq-body"><div><p className="max-w-xl pb-6 leading-relaxed text-ink-soft">{f.a}</p></div></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
