"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, CalendarClock } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import Section from "@/components/ui/Section";
import Pill from "@/components/app/Pill";
import { fmtCredits } from "@/lib/credits";
import { cn } from "@/lib/utils";
import { FREQUENCY_LABEL, MEASUREMENT_FREQUENCIES, runsPerMonth, type MeasurementFrequency } from "@/lib/measurements/modules";

type Row = {
  id: string;
  label: string;
  description: string;
  unavailable: string | null;
  enabled: boolean;
  frequency: MeasurementFrequency;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: "ok" | "error" | "skipped" | null;
  lastMessage: string | null;
  costPerRunUsd: number;
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

export default function MedicionesView({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${projectId}/mediciones`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo cargar");
      setRows(body.modules as Row[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(row: Row, patch: Partial<Pick<Row, "enabled" | "frequency">>) {
    setBusy(row.id);
    setError(null);
    const next = { enabled: row.enabled, frequency: row.frequency, ...patch };
    const res = await fetch(`/api/proyectos/${projectId}/mediciones`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: row.id, ...next }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? "No se pudo guardar");
      return;
    }
    await load();
  }

  async function runNow(row: Row) {
    setBusy(`run-${row.id}`);
    setNotice(null);
    const res = await fetch(`/api/proyectos/${projectId}/mediciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: row.id }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("No se pudo lanzar la medición");
      return;
    }
    setNotice(`«${row.label}» lanzada. El resultado aparece aquí en unos instantes y en el historial del módulo.`);
    setTimeout(() => void load(), 4000);
    setTimeout(() => void load(), 15000);
  }

  if (!rows && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const monthlyUsd = (rows ?? []).filter((r) => r.enabled).reduce((s, r) => s + r.costPerRunUsd * runsPerMonth(r.frequency), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ficha · Mediciones"
        title="Mediciones programadas"
        description="Elige qué se vuelve a medir solo y cada cuánto. Cada medición se guarda en el historial de su módulo, así puedes comparar el momento actual con el anterior."
      />
      {error && <Pill tone="danger">{error}</Pill>}
      {notice && <Pill tone="brand">{notice}</Pill>}

      <Section
        title="Qué medir y cada cuánto"
        description="Al activar una medición, la primera automática llega una frecuencia después. Si quieres medir ya, usa «Medir ahora»."
        flush
      >
        <ul className="divide-y divide-line">
          {(rows ?? []).map((r) => (
            <li key={r.id} className={cn("flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4", r.unavailable && "opacity-70")}>
              <label className="mt-1 flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={r.enabled}
                  disabled={!!r.unavailable || busy === r.id}
                  onChange={(e) => save(r, { enabled: e.target.checked })}
                  aria-label={`Programar ${r.label}`}
                />
              </label>
              <div className="min-w-[240px] flex-1">
                <p className="text-sm font-semibold text-ink">{r.label}</p>
                <p className="mt-0.5 max-w-xl text-xs text-ink-soft">{r.description}</p>
                {r.unavailable && <p className="mt-1 text-xs text-alert-ink">{r.unavailable}</p>}
                {!r.unavailable && (
                  <p className="mt-1 text-xs text-ink-faint">
                    {r.costPerRunUsd > 0
                      ? `Cada vez: unos ${fmtCredits(r.costPerRunUsd)}${r.enabled ? ` · al mes: unos ${fmtCredits(r.costPerRunUsd * runsPerMonth(r.frequency))}` : ""}`
                      : "Gratis, no gasta créditos"}
                  </p>
                )}
                {r.lastRunAt && (
                  <p className={cn("mt-1 text-xs", r.lastStatus === "error" ? "text-alert-ink" : "text-ink-faint")}>
                    Última vez: {fmtDate(r.lastRunAt)}
                    {r.lastMessage ? ` — ${r.lastMessage}` : ""}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={r.frequency}
                  disabled={!!r.unavailable || busy === r.id}
                  onChange={(e) => save(r, { frequency: e.target.value as MeasurementFrequency })}
                  className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-50"
                >
                  {MEASUREMENT_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!!r.unavailable || busy !== null}
                  onClick={() => runNow(r)}
                  title="Medir ahora (gasta lo indicado, si la medición es de pago)"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-medium text-ink-soft hover:bg-background disabled:opacity-50"
                >
                  {busy === `run-${r.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Medir ahora
                </button>
              </div>
              {r.enabled && r.nextRunAt && (
                <p className="flex w-full items-center gap-1.5 pl-8 text-xs text-ink-faint">
                  <CalendarClock className="h-3.5 w-3.5" /> Próxima medición automática: {fmtDate(r.nextRunAt)}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <p className="text-xs text-ink-faint">
        {monthlyUsd > 0
          ? `Con lo que tienes activado, el gasto estimado es de unos ${fmtCredits(monthlyUsd)} al mes. Es una estimación: el coste real queda en Costes.`
          : "Con lo que tienes activado, las mediciones programadas no gastan créditos."}{" "}
        Los avisos por email (caídas de posición, backlinks perdidos...) siguen funcionando sobre estas mediciones.
      </p>
    </div>
  );
}
