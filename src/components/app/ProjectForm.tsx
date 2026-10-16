"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { slugify, cn } from "@/lib/utils";
import GbpPicker, { type GbpCandidate } from "@/components/app/GbpPicker";

export type ProjectFormValues = {
  name: string;
  slug: string;
  domain: string;
  isLocalBusiness: boolean;
  businessName: string;
  address: string;
  phone: string;
  hours: string;
  lat: string;
  lng: string;
  gbpName: string;
  gbpPlaceId: string;
};

const EMPTY_VALUES: ProjectFormValues = {
  name: "",
  slug: "",
  domain: "",
  isLocalBusiness: false,
  businessName: "",
  address: "",
  phone: "",
  hours: "",
  lat: "",
  lng: "",
  gbpName: "",
  gbpPlaceId: "",
};

export default function ProjectForm({
  initial,
  submitLabel,
  showSlug = true,
  projectId,
  onSubmit,
}: {
  initial?: Partial<ProjectFormValues>;
  submitLabel: string;
  showSlug?: boolean;
  // ProjectForm solo se usa hoy en edición (proyecto ya existente), así que
  // projectId siempre llega — opcional únicamente por si en el futuro se
  // reutiliza en un flujo de creación sin id todavía.
  projectId?: string;
  onSubmit: (values: ProjectFormValues) => Promise<string | void>;
}) {
  const [form, setForm] = useState<ProjectFormValues>({ ...EMPTY_VALUES, ...initial });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Marca si el usuario ha editado el slug a mano. Mientras no, el slug se
  // deriva automáticamente del nombre (autorelleno que sigue al nombre).
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  // "Avanzado" oculto por defecto: dirección/coordenadas manuales, solo para
  // el caso de un negocio que no aparece en Google Maps — el buscador de
  // ficha es el mecanismo principal de relleno.
  const [showAdvanced, setShowAdvanced] = useState(false);

  function applyGbpCandidate(c: GbpCandidate) {
    setForm((prev) => ({
      ...prev,
      businessName: c.title,
      gbpName: c.title,
      gbpPlaceId: c.placeId,
      lat: c.lat != null ? String(c.lat) : prev.lat,
      lng: c.lng != null ? String(c.lng) : prev.lng,
      address: c.address ?? prev.address,
    }));
  }

  function set<K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const errorMessage = await onSubmit(form);
    setSubmitting(false);
    if (errorMessage) setError(errorMessage);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-ink">Datos generales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-ink-soft">Nombre del proyecto</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  name,
                  // Mientras el usuario no haya tocado el slug, se deriva del
                  // nombre en cada pulsación (autorelleno).
                  slug: slugTouched ? prev.slug : slugify(name),
                }));
              }}
              placeholder="Autocaravanas Ruta Norte"
              className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
              required
            />
          </div>
          {showSlug && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink-soft">Identificador (slug)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
                placeholder="autocaravanas-ruta-norte"
                className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors font-mono"
                required
              />
            </div>
          )}
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-sm font-medium text-ink-soft">Dominio</label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => set("domain", e.target.value)}
              placeholder="www.ejemplo.com"
              className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Negocio local (NAP)</h2>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={form.isLocalBusiness}
              onChange={(e) => set("isLocalBusiness", e.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            Es un negocio local
          </label>
        </div>
        {form.isLocalBusiness && (
          <div className="space-y-4">
            {projectId && (
              <GbpPicker
                projectId={projectId}
                currentGbpName={form.gbpName || null}
                currentPlaceId={form.gbpPlaceId || null}
                onApplied={applyGbpCandidate}
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-ink-soft">Teléfono</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-ink-soft">Horario</label>
                <input
                  type="text"
                  value={form.hours}
                  onChange={(e) => set("hours", e.target.value)}
                  placeholder="Lunes a viernes 9:00-14:00 y 16:00-19:00"
                  className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
              Avanzado: introducir dirección/coordenadas a mano
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-ink-soft">Nombre del negocio</label>
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={(e) => set("businessName", e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-ink-soft">Dirección</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-ink-soft">
                    Latitud <span className="text-ink-faint font-normal">(centro del geogrid)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => set("lat", e.target.value)}
                    placeholder="40.4168"
                    className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-ink-soft">
                    Longitud <span className="text-ink-faint font-normal">(centro del geogrid)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={(e) => set("lng", e.target.value)}
                    placeholder="-3.7038"
                    className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                  />
                </div>
                <p className="text-xs text-ink-faint sm:col-span-2">
                  Solo necesario si el negocio no aparece en el buscador de arriba (ej. ficha de Google
                  todavía no creada). Obtén las coordenadas exactas en Google Maps: clic derecho en el
                  pin → copiar.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-lg">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-2 px-4 py-2 bg-brand-900 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </form>
  );
}
