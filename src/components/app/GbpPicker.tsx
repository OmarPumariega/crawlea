"use client";

import { useState } from "react";
import { Loader2, Search, MapPin, Star, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Búsqueda y selección de la ficha de Google (Maps) de referencia del
// negocio, ANTES de lanzar un geogrid — así el centro del mapa y el
// matching (checkMapsRank prioriza place_id sobre nombre/dominio) vienen de
// una ficha real elegida por el usuario, no de lat/lng tecleadas a mano
// (fuente de errores, ej. un signo de longitud invertido).

export type GbpCandidate = {
  placeId: string;
  title: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviewsCount: number | null;
  category: string | null;
};

export default function GbpPicker({
  projectId,
  currentGbpName,
  currentPlaceId,
  onApplied,
}: {
  projectId: string;
  currentGbpName: string | null;
  currentPlaceId: string | null;
  onApplied: (c: GbpCandidate) => void;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<GbpCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setCandidates(null);
    const res = await fetch(`/api/proyectos/${projectId}/geogrid/ficha?q=${encodeURIComponent(query.trim())}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Error al buscar la ficha");
      return;
    }
    setCandidates(data.candidates);
    if (data.candidates.length === 0) setError("Sin resultados en Google Maps para esa búsqueda.");
  }

  async function handleApply(c: GbpCandidate) {
    setApplyingId(c.placeId);
    setError("");
    const res = await fetch(`/api/proyectos/${projectId}/geogrid/ficha`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: c.placeId, title: c.title, lat: c.lat, lng: c.lng, address: c.address }),
    });
    const data = await res.json();
    setApplyingId(null);
    if (!res.ok) {
      setError(data.error ?? "Error al aplicar la ficha");
      return;
    }
    onApplied(c);
    setCandidates(null);
    setQuery("");
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink-soft">Ficha de Google del negocio</label>

      {currentPlaceId ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-brand-100 bg-accent-tint rounded-lg text-sm">
          <CheckCircle2 className="h-4 w-4 text-accent-ink shrink-0" />
          <span className="text-accent-ink truncate flex-1">{currentGbpName}</span>
          <span className="text-[10px] text-accent-ink shrink-0">place_id verificado</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 border border-brand-100 bg-accent-tint rounded-lg text-xs text-accent-ink">
          Sin ficha de Google seleccionada — se usan las coordenadas guardadas del proyecto, sin
          garantía de que sean las del negocio correcto.
        </div>
      )}

      {/* div, no <form>: este componente vive dentro del <form> de "Ejecutar
          geogrid" y HTML no permite formularios anidados — Enter en el
          input dispara la búsqueda a mano en vez de un submit real. */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
          placeholder="Nombre del negocio + ciudad (ej. «Pumariega Estudios Gijón»)"
          className="flex-1 px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
        />
        <button
          type="button"
          onClick={() => handleSearch()}
          disabled={loading || !query.trim()}
          className="flex items-center gap-1.5 px-3 py-2 border border-line text-ink-soft text-sm font-medium rounded-lg hover:bg-background disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </button>
        {candidates && (
          <button
            type="button"
            onClick={() => {
              setCandidates(null);
              setError("");
            }}
            className="p-2 text-ink-faint hover:text-ink shrink-0"
            title="Cerrar resultados"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && <p className="text-xs text-alert-ink bg-alert-tint px-3 py-2 rounded-lg">{error}</p>}

      {candidates && candidates.length > 0 && (
        <ul className="border border-line rounded-xl divide-y divide-line overflow-hidden">
          {candidates.map((c) => (
            <li key={c.placeId} className="p-3 flex items-start gap-3 hover:bg-background">
              <MapPin className="h-4 w-4 text-ink-faint shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">{c.title}</p>
                {c.address && <p className="text-xs text-ink-soft truncate">{c.address}</p>}
                <p className="text-xs text-ink-faint flex items-center gap-1 flex-wrap mt-0.5">
                  {c.rating !== null ? (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {c.rating.toFixed(1)}/5.0{c.reviewsCount !== null && ` (${c.reviewsCount})`}
                    </span>
                  ) : (
                    "Sin valoraciones"
                  )}
                  {c.category && <span>· {c.category}</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleApply(c)}
                disabled={applyingId !== null || c.lat === null || c.lng === null}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 disabled:opacity-50",
                  c.placeId === currentPlaceId
                    ? "bg-brand-100 text-accent-ink"
                    : "bg-brand text-white hover:bg-brand-strong"
                )}
              >
                {applyingId === c.placeId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : c.placeId === currentPlaceId ? (
                  "Seleccionada"
                ) : (
                  "Usar esta"
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
