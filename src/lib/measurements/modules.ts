// Mediciones que se pueden programar desde la Ficha. Archivo puro (sin imports) para poder probarlo
// con `node --experimental-strip-types`.
export type MeasurementModuleId = "rank" | "geogrid" | "audit" | "velocidad" | "competidores" | "backlinks";

export const MEASUREMENT_FREQUENCIES = ["weekly", "monthly", "quarterly"] as const;
export type MeasurementFrequency = (typeof MEASUREMENT_FREQUENCIES)[number];

export const FREQUENCY_LABEL: Record<MeasurementFrequency, string> = {
  weekly: "Cada semana",
  monthly: "Cada mes",
  quarterly: "Cada trimestre",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const FREQUENCY_DAYS: Record<MeasurementFrequency, number> = { weekly: 7, monthly: 30, quarterly: 90 };

export function isFrequency(v: unknown): v is MeasurementFrequency {
  return typeof v === "string" && (MEASUREMENT_FREQUENCIES as readonly string[]).includes(v);
}

export function nextRunFrom(from: Date, frequency: MeasurementFrequency): Date {
  return new Date(from.getTime() + FREQUENCY_DAYS[frequency] * DAY_MS);
}

// Veces al mes que se repite (para estimar el gasto mensual).
export function runsPerMonth(frequency: MeasurementFrequency): number {
  return 30 / FREQUENCY_DAYS[frequency];
}

export type MeasurementModuleDef = {
  id: MeasurementModuleId;
  label: string;
  description: string;
  // Módulo de plan que hace falta (null = disponible en todos los planes).
  planModule: "rank" | "geogrid" | "competidores" | "backlinks" | null;
};

export const MEASUREMENT_MODULES: MeasurementModuleDef[] = [
  {
    id: "rank",
    label: "Rank Tracking",
    description: "Vuelve a comprobar la posición de todas las keywords que sigues. Cada medición se suma a su evolución.",
    planModule: "rank",
  },
  {
    id: "geogrid",
    label: "SEO local (Geogrid)",
    description: "Repite los últimos mapas de calor (misma keyword, rejilla y radio) para ver cómo evoluciona tu posición en Maps.",
    planModule: "geogrid",
  },
  {
    id: "audit",
    label: "Auditoría de la web",
    description: "Rastrea el sitio entero y vuelve a buscar fallos técnicos. La pestaña Cambios compara con la anterior.",
    planModule: null,
  },
  {
    id: "velocidad",
    label: "Velocidad (PageSpeed)",
    description: "Mide otra vez las páginas que ya has medido (o la home). Gratis, no gasta créditos.",
    planModule: null,
  },
  {
    id: "competidores",
    label: "Competidores",
    description: "Actualiza el tráfico y las keywords de tu dominio y de tus competidores. Se guarda en el historial de Competidores.",
    planModule: "competidores",
  },
  {
    id: "backlinks",
    label: "Backlinks",
    description: "Vuelve a analizar los enlaces entrantes de tu dominio y avisa si pierdes dominios de referencia.",
    planModule: "backlinks",
  },
];

export function isMeasurementModule(v: unknown): v is MeasurementModuleId {
  return typeof v === "string" && MEASUREMENT_MODULES.some((m) => m.id === v);
}
