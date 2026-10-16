// Exportación CSV genérica sin backend — todo el dato ya está cargado en el
// cliente, igual que en Rank Tracking (primer módulo que lo implementó).
import { track } from "@/lib/analytics/track";

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csv = [headers, ...rows]
    .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  track("export_csv", { rows: rows.length, kind: filename.split("-")[0] });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
