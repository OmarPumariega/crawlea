"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Modal from "@/components/app/Modal";
import { AreaSpark } from "@/components/ui/charts";
import { fmtCredits } from "@/lib/credits";
import { TRAFFIC_HISTORY_COST_USD } from "@/lib/dataforseo/pricing";

type Point = { month: string; traffic: number | null; keywords: number | null; top3: number | null; top10: number | null };
type History = { domain: string; points: Point[]; fetchedAt: string };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const label = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;

// Evolución mensual de tráfico y keywords de tu web y tus competidores. Pedirla
// cuesta unos 65 créditos por dominio (Labs historical_rank_overview); lo ya
// pedido queda guardado y se ve gratis.
export default function TrafficHistoryModal({ projectId, open, onClose, domains }: { projectId: string; open: boolean; onClose: () => void; domains: { domain: string; isOwn: boolean }[] }) {
  const [data, setData] = useState<Record<string, History>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/proyectos/${projectId}/competidores/historico`)
      .then((r) => r.json())
      .then((list: History[]) => {
        if (Array.isArray(list)) setData(Object.fromEntries(list.map((h) => [h.domain, h])));
      })
      .finally(() => setLoading(false));
  }, [open, projectId]);

  async function request(domain: string) {
    setBusy(domain);
    setError("");
    const res = await fetch(`/api/proyectos/${projectId}/competidores/historico`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
    const d = await res.json();
    if (!res.ok) setError(d.error ?? "No se pudo obtener");
    else setData((prev) => ({ ...prev, [domain]: d }));
    setBusy(null);
  }

  return (
    <Modal open={open} title="Evolución del tráfico" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Tráfico orgánico estimado y keywords al mes, para ver quién crece y quién baja. Es una estimación de DataForSEO, no tráfico medido.</p>
        {error && <p className="rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert-ink">{error}</p>}
        {loading ? (
          <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-ink-faint" /></div>
        ) : (
          <ul className="space-y-4">
            {domains.map(({ domain, isOwn }) => {
              const h = data[domain];
              const pts = h?.points.filter((p) => p.traffic != null) ?? [];
              const first = pts[0]?.traffic ?? null;
              const last = pts[pts.length - 1]?.traffic ?? null;
              const change = first && last != null && first > 0 ? ((last - first) / first) * 100 : null;
              return (
                <li key={domain} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{domain}{isOwn && <span className="ml-1.5 text-xs font-semibold text-brand">tú</span>}</p>
                    {!h && (
                      <button onClick={() => request(domain)} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
                        {busy === domain && <Loader2 className="h-3 w-3 animate-spin" />}
                        Ver evolución ({fmtCredits(TRAFFIC_HISTORY_COST_USD)})
                      </button>
                    )}
                  </div>
                  {h && pts.length >= 2 && (
                    <div className="mt-3 grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
                      <div>
                        <AreaSpark points={pts.map((p) => p.traffic as number)} height={72} />
                        <div className="mt-1 flex justify-between text-[11px] text-ink-faint"><span>{label(pts[0].month)}</span><span>{label(pts[pts.length - 1].month)}</span></div>
                      </div>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between"><dt className="text-ink-faint">Tráfico</dt><dd className="tabular-nums font-semibold text-ink">{first?.toLocaleString("es-ES")} → {last?.toLocaleString("es-ES")}</dd></div>
                        {change !== null && <div className="flex justify-between"><dt className="text-ink-faint">Cambio</dt><dd className={cn("tabular-nums font-semibold", change < 0 ? "text-alert-ink" : "text-ink")}>{change > 0 ? "+" : ""}{Math.round(change)} %</dd></div>}
                        <div className="flex justify-between"><dt className="text-ink-faint">Keywords</dt><dd className="tabular-nums text-ink-soft">{pts[0].keywords ?? "—"} → {pts[pts.length - 1].keywords ?? "—"}</dd></div>
                        <div className="flex justify-between"><dt className="text-ink-faint">En top 10</dt><dd className="tabular-nums text-ink-soft">{pts[pts.length - 1].top10 ?? "—"}</dd></div>
                      </dl>
                    </div>
                  )}
                  {h && pts.length < 2 && <p className="mt-2 text-xs text-ink-faint">DataForSEO no tiene histórico suficiente de este dominio.</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
