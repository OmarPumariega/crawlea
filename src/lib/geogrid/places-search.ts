import { postTask } from "@/lib/dataforseo/client";

// Búsqueda de la ficha de Google (Maps/Google Business Profile) de un
// negocio por nombre, para que el usuario elija la correcta ANTES de fijar
// el centro del geogrid — en vez de teclear lat/lng a mano (fuente de
// errores como un signo de longitud invertido). Reutiliza el mismo endpoint
// de Maps SERP que ya paga el Módulo 9 (coste real ~$0.002-0.005 por
// búsqueda), sin necesidad de la Business Profile API de Google (bloqueada
// hasta aprobación, ver CLAUDE.md) — esto es una búsqueda pública tipo
// "Google Maps", no requiere ser dueño de la ficha.
//
// location_name: "Spain" busca en todo el país; basta con que el usuario
// incluya la ciudad en la query (igual que buscaría en Google Maps) para
// que la relevancia de Google haga el resto.

export type GbpCandidate = {
  placeId: string;
  title: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviewsCount: number | null;
  category: string | null;
  // Datos de contacto de la ficha: se guardan en el proyecto al elegirla, para
  // que nadie tenga que teclearlos. Google Maps no ofrece email.
  phone: string | null;
  website: string | null;
  hoursText: string | null;
};

const MAX_CANDIDATES = 8;

type DayHours = { open?: { hour?: number; minute?: number }; close?: { hour?: number; minute?: number } }[] | null;
type Timetable = Partial<Record<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday", DayHours>>;

const DAYS: [keyof Timetable, string][] = [
  ["monday", "Lun"], ["tuesday", "Mar"], ["wednesday", "Mié"], ["thursday", "Jue"],
  ["friday", "Vie"], ["saturday", "Sáb"], ["sunday", "Dom"],
];

function hm(t?: { hour?: number; minute?: number }): string | null {
  if (!t || typeof t.hour !== "number") return null;
  return `${t.hour}:${String(t.minute ?? 0).padStart(2, "0")}`;
}

// Convierte el horario estructurado de la ficha en un texto corto agrupando los
// días con el mismo horario: «Lun-Vie 9:00-14:00 y 16:00-19:00 · Sáb-Dom cerrado».
// null si la ficha no trae horario (no se inventa).
export function formatWorkHours(timetable: Timetable | null | undefined): string | null {
  if (!timetable) return null;
  const perDay = DAYS.map(([key, label]) => {
    const slots = (timetable[key] ?? [])
      .map((x) => (hm(x.open) && hm(x.close) ? `${hm(x.open)}-${hm(x.close)}` : null))
      .filter((x): x is string => Boolean(x));
    return { label, text: slots.length > 0 ? slots.join(" y ") : "cerrado" };
  });
  if (perDay.every((d) => d.text === "cerrado") && DAYS.every(([k]) => timetable[k] == null)) return null;
  const groups: { from: string; to: string; text: string }[] = [];
  for (const d of perDay) {
    const last = groups[groups.length - 1];
    if (last && last.text === d.text) last.to = d.label;
    else groups.push({ from: d.label, to: d.label, text: d.text });
  }
  return groups.map((g) => `${g.from === g.to ? g.from : `${g.from}-${g.to}`} ${g.text}`).join(" · ");
}

type RawMapsItem = {
  type?: string;
  place_id?: string;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: { value?: number; votes_count?: number } | null;
  category?: string | null;
  phone?: string | null;
  url?: string | null;
  domain?: string | null;
  work_hours?: { timetable?: Timetable | null } | null;
};

export async function searchGbpCandidates(
  query: string
): Promise<{ candidates: GbpCandidate[]; costUsd: number | null }> {
  const task = await postTask(
    "/v3/serp/google/maps/live/advanced",
    { keyword: query, location_name: "Spain", language_code: "es" },
    "modulo9.geogrid.buscar-ficha"
  );

  const resultArr = Array.isArray(task.result) ? (task.result as Array<Record<string, unknown>>) : [];
  const items = Array.isArray(resultArr[0]?.items) ? (resultArr[0].items as RawMapsItem[]) : [];

  const candidates: GbpCandidate[] = [];
  for (const item of items) {
    if (item.type !== "maps_search") continue;
    if (typeof item.place_id !== "string" || !item.place_id) continue;
    candidates.push({
      placeId: item.place_id,
      title: typeof item.title === "string" ? item.title : "(sin nombre)",
      address: typeof item.address === "string" ? item.address : null,
      lat: typeof item.latitude === "number" ? item.latitude : null,
      lng: typeof item.longitude === "number" ? item.longitude : null,
      rating: typeof item.rating?.value === "number" ? item.rating.value : null,
      reviewsCount: typeof item.rating?.votes_count === "number" ? item.rating.votes_count : null,
      category: typeof item.category === "string" ? item.category : null,
      phone: typeof item.phone === "string" && item.phone ? item.phone : null,
      website: typeof item.url === "string" && item.url ? item.url : typeof item.domain === "string" ? item.domain : null,
      hoursText: formatWorkHours(item.work_hours?.timetable),
    });
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  return { candidates, costUsd: typeof task.cost === "number" ? task.cost : null };
}
