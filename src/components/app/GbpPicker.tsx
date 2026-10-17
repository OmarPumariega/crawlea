"use client";

import { useState } from "react";
import { Loader2, Search, MapPin, Star, CheckCircle2, X, Phone, Clock } from "lucide-react";
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
  phone: string | null;
  website: string | null;
  hoursText: string | null;
};

// Lo que ya sabemos de la ficha elegida (se muestra en su tarjeta).
export type GbpDetails = { address?: string | null; phone?: string | null; hours?: string | null };

export default function GbpPicker({
  projectId,
  currentGbpName,
  currentPlaceId,
  details,
  onApplied,
  onRemoved,
}: {
  projectId: string;
  currentGbpName: string | null;
  currentPlaceId: string | null;
  details?: GbpDetails;
  onApplied: (c: GbpCandidate) => void;
  // Si se pasa, la tarjeta de la ficha elegida ofrece «Quitar».
  onRemoved?: () => void;
}) {
  // Con una ficha elegida no se enseña el buscador: solo si se pulsa «Cambiar».
  const [changing, setChanging] = useState(false);
  const [removing, setRemoving] = useState(false);
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
      body: JSON.stringify({
        placeId: c.placeId, title: c.title, lat: c.lat, lng: c.lng, address: c.address,
        phone: c.phone, hoursText: c.hoursText,
      }),
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
    setChanging(false);
  }

  async function handleRemove() {
    if (!window.confirm("¿Quitar la ficha? El proyecto dejará de ser de SEO local y se borrarán los datos que venían de ella (dirección, teléfono, horario y centro del mapa).")) return;
    setRemoving(true);
    setError("");
    const res = await fetch(`/api/proyectos/${projectId}/geogrid/ficha`, { method: "DELETE" });
    setRemoving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo quitar la ficha");
      return;
    }
    setChanging(false);
    onRemoved?.();
  }

  const hasFicha = Boolean(currentPlaceId);
  const showSearch = !hasFicha || changing;

  return (
    <div className="space-y-3">
      {hasFicha && !changing && (
        <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{currentGbpName}</p>
              <p className="text-xs text-ink-soft">Ficha de Google verificada · SEO local activado</p>
            </div>
          </div>
          <ul className="space-y-1.5 text-sm text-ink-soft">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
              <span>{details?.address || "La ficha no indica dirección"}</span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
              <span>{details?.phone || "La ficha no indica teléfono"}</span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
              <span>{details?.hours || "La ficha no indica horario"}</span>
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-background"
            >
              Cambiar ficha
            </button>
            {onRemoved && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-faint hover:bg-alert-tint hover:text-alert-ink disabled:opacity-50"
              >
                {removing && <Loader2 className="h-3 w-3 animate-spin" />}
                Quitar
              </button>
            )}
          </div>
        </div>
      )}

      {showSearch && (
        <p className="text-sm text-ink-soft">
          {changing
            ? "Busca la nueva ficha. Al elegirla sustituye a la actual y se actualizan dirección, teléfono y horario."
            : "Busca tu negocio en Google Maps y elígelo: de la ficha sacamos nombre, dirección, teléfono y horario, y se activa el SEO local. Sin ficha, no hay SEO local."}
        </p>
      )}

      {/* div, no <form>: este componente vive dentro del <form> de "Ejecutar
          geogrid" y HTML no permite formularios anidados — Enter en el
          input dispara la búsqueda a mano en vez de un submit real. */}
      {showSearch && (
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
        {changing && (
          <button
            type="button"
            onClick={() => {
              setChanging(false);
              setCandidates(null);
              setError("");
            }}
            className="shrink-0 px-2 text-xs font-semibold text-ink-soft hover:text-ink"
          >
            Cancelar
          </button>
        )}
      </div>
      )}

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
