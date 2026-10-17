"use client";

import { useState } from "react";
import { Loader2, Plus, Check } from "lucide-react";
import Modal from "@/components/app/Modal";
import { fmtCredits } from "@/lib/credits";
import { discoverCompetitorsCostUsd } from "@/lib/dataforseo/pricing";

type Item = { domain: string; intersections: number; avgPosition: number | null; organicTraffic: number | null; organicKeywords: number | null };

const num = (v: number | null) => (v == null ? "—" : v.toLocaleString("es-ES"));

// Descubre los dominios que comparten keywords con tu web (Labs competitors_domain).
export default function DiscoverCompetitorsModal({ projectId, open, onClose, onAdded }: { projectId: string; open: boolean; onClose: () => void; onAdded: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function search() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/proyectos/${projectId}/competidores/descubrir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await res.json();
    if (!res.ok) setError(d.error ?? "No se pudo buscar");
    else setItems(d.items);
    setLoading(false);
  }

  async function add(domain: string) {
    const res = await fetch(`/api/proyectos/${projectId}/competidores`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
    if (res.ok || res.status === 409) {
      setAdded((prev) => new Set(prev).add(domain));
      onAdded();
    }
  }

  return (
    <Modal open={open} title="Descubrir competidores" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          Webs que aparecen en Google para las mismas búsquedas que tú. Se excluyen los gigantes genéricos (Wikipedia, YouTube…), pero revisa la lista: los directorios y portales grandes no son competidores reales.
        </p>
        {items === null ? (
          <button onClick={search} disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Buscar ({fmtCredits(discoverCompetitorsCostUsd())})
          </button>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-soft">No hemos encontrado competidores nuevos con keywords en común.</p>
        ) : (
          <table className="data-table data-table-compact w-full">
            <thead>
              <tr>
                <th>Web</th>
                <th className="num">Keywords en común</th>
                <th className="num">Su posición media</th>
                <th className="num">Tráfico est.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const big = (c.organicKeywords ?? 0) > 100000;
                return (
                  <tr key={c.domain}>
                    <td>
                      <p className="font-medium text-ink">{c.domain}</p>
                      {big && <p className="text-[11px] text-ink-faint">Web muy grande: probablemente un directorio o portal</p>}
                    </td>
                    <td className="num tabular-nums font-semibold text-ink">{c.intersections}</td>
                    <td className="num tabular-nums text-ink-soft">{c.avgPosition != null ? c.avgPosition.toFixed(1).replace(".", ",") : "—"}</td>
                    <td className="num tabular-nums text-ink-soft">{num(c.organicTraffic)}</td>
                    <td className="text-right">
                      <button onClick={() => add(c.domain)} disabled={added.has(c.domain)} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-surface-muted disabled:text-accent-ink">
                        {added.has(c.domain) ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {added.has(c.domain) ? "Añadido" : "Añadir"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {error && <p className="rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert-ink">{error}</p>}
      </div>
    </Modal>
  );
}
