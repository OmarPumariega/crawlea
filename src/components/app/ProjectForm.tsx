"use client";

import { useState } from "react";
import { Globe, Loader2, MapPin } from "lucide-react";
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
  // La ficha se guarda en su propio endpoint nada más elegirla o quitarla; aquí
  // solo se refleja en pantalla lo que la ficha aporta y se avisa al menú
  // (aparece o desaparece "SEO local").
  function applyGbpCandidate(c: GbpCandidate) {
    setForm((prev) => ({
      ...prev,
      isLocalBusiness: true,
      businessName: c.title,
      gbpName: c.title,
      gbpPlaceId: c.placeId,
      lat: c.lat != null ? String(c.lat) : "",
      lng: c.lng != null ? String(c.lng) : "",
      address: c.address ?? "",
      phone: c.phone ?? "",
      hours: c.hoursText ?? "",
    }));
    window.dispatchEvent(new Event("crawlea:projects-changed"));
  }

  function clearGbp() {
    setForm((prev) => ({
      ...prev,
      isLocalBusiness: false,
      businessName: "",
      gbpName: "",
      gbpPlaceId: "",
      lat: "",
      lng: "",
      address: "",
      phone: "",
      hours: "",
    }));
    window.dispatchEvent(new Event("crawlea:projects-changed"));
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

  const INPUT =
    "w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15";
  const LABEL = "mb-1 block text-[13px] font-semibold text-ink-soft";

  return (
    <form onSubmit={handleSubmit} className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-card">
      <div className="grid xl:grid-cols-2">
        {/* Datos del proyecto */}
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
              <Globe className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-ink">Datos del proyecto</h2>
              <p className="text-sm text-ink-soft">Cómo se llama y en qué web trabajas.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Nombre del proyecto</label>
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
                className={INPUT}
                required
              />
            </div>
            {showSlug && (
              <div>
                <label className={LABEL}>Identificador (slug)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value);
                  }}
                  placeholder="autocaravanas-ruta-norte"
                  className={cn(INPUT, "font-mono")}
                  required
                />
              </div>
            )}
            <div>
              <label className={LABEL}>Dominio</label>
              <input type="text" value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="www.ejemplo.com" className={INPUT} />
              <p className="mt-1 text-xs text-ink-faint">Es la web que se rastrea, se audita y de la que se mide la posición.</p>
            </div>
          </div>
        </div>

        {/* Negocio local: siempre visible; elegir la ficha de Google lo activa */}
        <div className="space-y-5 border-t border-line p-6 xl:border-l xl:border-t-0">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-ink">Negocio local</h2>
              <p className="text-sm text-ink-soft">Su ficha de Google Maps: de ahí sale toda la información del negocio.</p>
            </div>
          </div>
          {projectId && (
            <GbpPicker
              projectId={projectId}
              currentGbpName={form.gbpName || null}
              currentPlaceId={form.gbpPlaceId || null}
              details={{ address: form.address, phone: form.phone, hours: form.hours }}
              onApplied={applyGbpCandidate}
              onRemoved={clearGbp}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-muted/50 px-6 py-4">
        <div className="min-h-5 text-sm">
          {error && <span className="rounded-lg bg-alert-tint px-3 py-1.5 text-alert-ink">{error}</span>}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
