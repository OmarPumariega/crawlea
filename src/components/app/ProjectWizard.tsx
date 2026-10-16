"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Select from "@radix-ui/react-select";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/utils";
import Stepper, { type StepDescriptor } from "@/components/app/Stepper";
import LocationPicker, { type LocationValue } from "@/components/app/LocationPicker";
import GbpPicker from "@/components/app/GbpPicker";

// Wizard de alta de proyecto en 6 pasos. El proyecto se crea en el paso 1
// (mínimo name + domain recomendado) y los siguientes lo enriquecen vía
// PATCH/POST a su id. Todos los pasos salvo el núcleo del 1 son omitibles.
// Reutiliza los endpoints existentes sin tocarlos.

const STEPS: StepDescriptor[] = [
  { title: "Datos del proyecto" },
  { title: "Negocio local", optional: true },
  { title: "Google", optional: true },
  { title: "Keywords", optional: true },
  { title: "Competidores", optional: true },
  { title: "Lanzar" },
];

const INPUT =
  "w-full px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors";
const LABEL = "block text-sm font-medium text-ink-soft";

type GscSite = { siteUrl: string; permissionLevel: string };
type Ga4Property = { propertyId: string; displayName: string; accountName: string };

export default function ProjectWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  // Estado "completado/omitido" de cada paso, para el resumen final.
  const [stepStatus, setStepStatus] = useState<("pending" | "done" | "skipped")[]>(
    STEPS.map(() => "pending")
  );

  // --- Paso 1: datos básicos ---
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [domain, setDomain] = useState("");
  const [spendLimit, setSpendLimit] = useState("");

  // --- Paso 2: negocio local ---
  const [isLocalBusiness, setIsLocalBusiness] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [gbpName, setGbpName] = useState("");
  const [gbpPlaceId, setGbpPlaceId] = useState("");
  const [showAdvancedLocal, setShowAdvancedLocal] = useState(false);

  // --- Paso 3: Google ---
  const [propLoading, setPropLoading] = useState(false);
  const [propNotConnected, setPropNotConnected] = useState(false);
  const [gscSites, setGscSites] = useState<GscSite[]>([]);
  const [ga4Properties, setGa4Properties] = useState<Ga4Property[]>([]);
  const [gscSiteUrl, setGscSiteUrl] = useState("");
  const [ga4PropertyId, setGa4PropertyId] = useState("");

  // --- Paso 4: keywords ---
  const [studyName, setStudyName] = useState("");
  const [seedKeywords, setSeedKeywords] = useState("");
  const [location, setLocation] = useState<LocationValue>(null);

  // --- Paso 5: competidores ---
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [addDomain, setAddDomain] = useState("");

  // --- Paso 6: lanzar ---
  const [runAudit, setRunAudit] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const effectiveSlug = slugTouched ? slug : slugify(name);

  function markStatus(index: number, status: "done" | "skipped") {
    setStepStatus((prev) => prev.map((s, i) => (i === index ? status : s)));
  }

  // Carga propiedades de Google al entrar en el paso 3. El spinner se activa en
  // gotoStep (al navegar hacia aquí), no aquí dentro, para no hacer setState
  // síncrono dentro del effect.
  useEffect(() => {
    if (step !== 2 || projectId === null) return;
    fetch("/api/google/propiedades")
      .then(async (r) => {
        if (r.status === 409) {
          setPropNotConnected(true);
          return null;
        }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (data) {
          setGscSites(data.gscSites ?? []);
          setGa4Properties(data.ga4Properties ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setPropLoading(false));
  }, [step, projectId]);

  function gotoStep(i: number) {
    setError("");
    if (i === 2) {
      setPropLoading(true);
      setPropNotConnected(false);
    }
    setStep(i);
  }

  async function patchProject(fields: Record<string, unknown>): Promise<boolean> {
    if (!projectId) return false;
    const res = await fetch(`/api/proyectos/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    return res.ok;
  }

  // --- Acción "Continuar" por paso ---
  async function handleContinue(): Promise<boolean> {
    setError("");
    setSaving(true);
    try {
      if (step === 0) {
        // Crear (o actualizar si ya existe).
        const body = {
          name,
          slug: effectiveSlug,
          domain,
          spendLimitUsd: spendLimit,
        };
        if (projectId) {
          await patchProject(body);
        } else {
          const res = await fetch("/api/proyectos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error ?? "Error al crear el proyecto");
            return false;
          }
          setProjectId(data.id);
        }
      } else if (step === 1) {
        await patchProject({
          isLocalBusiness,
          businessName,
          address,
          phone,
          hours,
          lat,
          lng,
          gbpName,
          gbpPlaceId,
        });
      } else if (step === 2) {
        await patchProject({ gscSiteUrl, ga4PropertyId });
      } else if (step === 3) {
        const res = await fetch(`/api/proyectos/${projectId}/keywords/estudios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: studyName || undefined,
            keywords: seedKeywords || undefined,
            locationCode: location?.code,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          // No bloquea el wizard: avisa y sigue.
          setError(d.error ?? "No se pudo crear el estudio de keywords (puedes continuar).");
        }
      } else if (step === 4) {
        await Promise.all(
          competitors
            .filter(Boolean)
            .map((d) =>
              fetch(`/api/proyectos/${projectId}/competidores`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain: d }),
              }).catch(() => {})
            )
        );
      }
      markStatus(step, "done");
      return true;
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function goNext() {
    const ok = await handleContinue();
    if (ok) gotoStep(Math.min(step + 1, STEPS.length - 1));
  }

  function skip() {
    markStatus(step, "skipped");
    gotoStep(Math.min(step + 1, STEPS.length - 1));
  }

  function back() {
    gotoStep(Math.max(step - 1, 0));
  }

  async function finish() {
    if (!projectId) {
      router.push("/app/proyectos");
      return;
    }
    setError("");
    setSaving(true);
    try {
      // Encola el lanzamiento completo (importar keywords del estudio al rank
      // tracking + chequeo/TF-IDF + análisis de competidores) como un
      // BootstrapRun en background — el endpoint solo crea el registro y
      // dispara el job, responde casi al instante. El trabajo real (que puede
      // tardar minutos) se sigue viendo desde el panel de la ficha del
      // proyecto, con polling; navegar aquí no espera a que termine.
      const res = await fetch(`/api/proyectos/${projectId}/bootstrap`, { method: "POST" });
      if (!res.ok && res.status !== 409) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "No se pudo encolar el análisis inicial.");
        return;
      }
      if (runAudit) {
        const auditRes = await fetch(`/api/proyectos/${projectId}/auditorias`, { method: "POST" });
        if (!auditRes.ok && auditRes.status !== 409) {
          const d = await auditRes.json().catch(() => ({}));
          setError(d.error ?? "No se pudo encolar la auditoría técnica.");
          return;
        }
      }
      router.push(`/app/proyectos/${projectId}`);
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  function addCompetitor() {
    const d = addDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (d && !competitors.includes(d)) setCompetitors((prev) => [...prev, d]);
    setAddDomain("");
  }

  const isLast = step === STEPS.length - 1;
  const canContinueStep0 = name.trim().length > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/app/proyectos"
        className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Proyectos
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-ink">Nuevo proyecto</h1>
        <p className="text-sm text-ink-soft mt-1">
          Configura el proyecto paso a paso. Los opcionales puedes omitirlos y completarlos después.
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-4 sm:p-6">
        <Stepper steps={STEPS} current={step} onStepClick={(i) => gotoStep(i)} />
      </div>

      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 sm:p-6 space-y-4">
        {/* PASO 1 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={LABEL}>Nombre del proyecto *</label>
                <input
                  className={INPUT}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pumariega"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className={LABEL}>Identificador (slug)</label>
                <input
                  className={cn(INPUT, "font-mono")}
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  placeholder="pumariega"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className={LABEL}>Dominio *</label>
              <input
                className={INPUT}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="pumariega.com (sin https://)"
              />
              <p className="text-xs text-ink-faint">
                Necesario para rastrear el sitio (auditoría, geogrid, etc.). Puedes omitirlo y
                añadirlo luego, pero sin él la auditoría no puede lanzarse.
              </p>
            </div>
            <div className="space-y-1">
              <label className={LABEL}>Tope de gasto mensual (USD, opcional)</label>
              <input
                className={INPUT}
                value={spendLimit}
                onChange={(e) => setSpendLimit(e.target.value)}
                placeholder="Vacío = sin tope"
                inputMode="decimal"
              />
            </div>
          </div>
        )}

        {/* PASO 2 */}
        {step === 1 && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isLocalBusiness}
                onChange={(e) => setIsLocalBusiness(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-ink-soft">
                Es un negocio local con ubicación física (activa SEO local / geogrid)
              </span>
            </label>
            {isLocalBusiness && (
              <>
                {projectId ? (
                  <div className="space-y-2">
                    <GbpPicker
                      projectId={projectId}
                      currentGbpName={gbpName || null}
                      currentPlaceId={gbpPlaceId || null}
                      onApplied={(c) => {
                        setBusinessName(c.title);
                        setGbpName(c.title);
                        setGbpPlaceId(c.placeId);
                        if (c.lat != null) setLat(String(c.lat));
                        if (c.lng != null) setLng(String(c.lng));
                        if (c.address) setAddress(c.address);
                      }}
                    />
                    <p className="text-xs text-ink-faint">
                      Busca tu negocio por nombre y selecciónalo: rellena automáticamente el nombre, la
                      dirección, el Place ID y las coordenadas — necesarias para el geogrid (mapa de
                      calor de posicionamiento local).
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-ink-faint">
                    Guarda el paso 1 primero para poder buscar la ficha de Google del negocio.
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LABEL}>Teléfono</label>
                    <input className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL}>Horario (texto libre)</label>
                    <input className={INPUT} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="L-V 9:00-20:00, S 10:00-14:00" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvancedLocal((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvancedLocal && "rotate-180")} />
                  Avanzado: introducir dirección/coordenadas a mano
                </button>
                {showAdvancedLocal && (
                  <div className="space-y-4 pt-1">
                    <div className="space-y-1">
                      <label className={LABEL}>Nombre del negocio</label>
                      <input className={INPUT} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className={LABEL}>Dirección</label>
                      <input className={INPUT} value={address} onChange={(e) => setAddress(e.target.value)} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className={LABEL}>Latitud</label>
                        <input className={INPUT} value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="43.3623" />
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL}>Longitud</label>
                        <input className={INPUT} value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" placeholder="-5.8486" />
                      </div>
                    </div>
                    <p className="text-xs text-ink-faint">
                      Solo necesario si el negocio no aparece en el buscador de arriba.
                    </p>
                  </div>
                )}
              </>
            )}
            {!isLocalBusiness && (
              <p className="text-sm text-ink-soft">
                Si no es un negocio local, omite este paso. Podrás activarlo más tarde desde la ficha
                del proyecto.
              </p>
            )}
          </div>
        )}

        {/* PASO 3 */}
        {step === 2 && (
          <div className="space-y-4">
            {propLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
            ) : propNotConnected ? (
              <div className="text-sm text-ink-soft space-y-2">
                <p>Todavía no hay ninguna cuenta de Google conectada.</p>
                <Link href="/app/configuracion" className="text-ink font-medium underline">
                  Conéctala en Configuración →
                </Link>
                <p className="text-xs text-ink-faint">
                  Puedes omitir este paso y conectar Search Console / Analytics más tarde.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className={LABEL}>Search Console</label>
                  <Select.Root value={gscSiteUrl || undefined} onValueChange={setGscSiteUrl}>
                    <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors bg-surface">
                      <Select.Value placeholder="Sin seleccionar" />
                      <Select.Icon><ChevronDown className="h-4 w-4 text-ink-faint" /></Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
                        <Select.Viewport>
                          {gscSites.map((s) => (
                            <Select.Item key={s.siteUrl} value={s.siteUrl} className="px-3 py-2 text-sm text-ink outline-none cursor-pointer data-[highlighted]:bg-surface-muted">
                              <Select.ItemText>{s.siteUrl}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
                <div className="space-y-1">
                  <label className={LABEL}>Google Analytics (GA4)</label>
                  <Select.Root value={ga4PropertyId || undefined} onValueChange={setGa4PropertyId}>
                    <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors bg-surface">
                      <Select.Value placeholder="Sin seleccionar" />
                      <Select.Icon><ChevronDown className="h-4 w-4 text-ink-faint" /></Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
                        <Select.Viewport>
                          {ga4Properties.map((p) => (
                            <Select.Item key={p.propertyId} value={p.propertyId} className="px-3 py-2 text-sm text-ink outline-none cursor-pointer data-[highlighted]:bg-surface-muted">
                              <Select.ItemText>{p.accountName} — {p.displayName}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
              </>
            )}
          </div>
        )}

        {/* PASO 4 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className={LABEL}>Nombre del estudio (opcional)</label>
              <input
                className={INPUT}
                value={studyName}
                onChange={(e) => setStudyName(e.target.value)}
                placeholder={`Estudio inicial — ${new Date().toLocaleDateString("es-ES")}`}
              />
            </div>
            <div className="space-y-1">
              <label className={LABEL}>Keywords semilla (una por línea, opcional)</label>
              <textarea
                className={cn(INPUT, "resize-y")}
                rows={4}
                value={seedKeywords}
                onChange={(e) => setSeedKeywords(e.target.value)}
                placeholder={"barbería Gijón\ncorte de pelo hombre\narreglo de barba"}
              />
              <p className="text-xs text-ink-faint">
                Si dejas vacío, se crea un estudio en blanco (gratis) que rellenarás después. Con
                semillas se resuelve volumen e intención vía DataForSEO.
              </p>
              <p className="text-xs text-ink-soft">
                Al lanzar el proyecto, estas keywords se importarán automáticamente al Rank Tracking
                y se chequeará su posición real en Google (lo que también alimentará el módulo
                TF-IDF sin coste adicional).
              </p>
            </div>
            <div className="space-y-1">
              <label className={LABEL}>Ubicación de la búsqueda (opcional)</label>
              <LocationPicker value={location} onChange={setLocation} />
            </div>
          </div>
        )}

        {/* PASO 5 */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              Añade los dominios competidores. Al lanzar el proyecto se analizarán automáticamente
              (visibilidad real + top keywords + content gap frente a tu dominio).
            </p>
            <div className="flex gap-2">
              <input
                className={INPUT}
                value={addDomain}
                onChange={(e) => setAddDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCompetitor())}
                placeholder="competidor.com"
              />
              <button
                type="button"
                onClick={addCompetitor}
                className="px-3 py-2 bg-surface-muted text-ink-soft text-sm font-medium rounded-lg hover:bg-surface-muted shrink-0 inline-flex items-center gap-1"
              >
                <Plus className="h-4 w-4" /> Añadir
              </button>
            </div>
            {competitors.length > 0 && (
              <ul className="space-y-1.5">
                {competitors.map((d) => (
                  <li key={d} className="flex items-center justify-between gap-2 px-3 py-2 bg-background rounded-lg">
                    <span className="text-sm text-ink-soft truncate">{d}</span>
                    <button
                      type="button"
                      onClick={() => setCompetitors((prev) => prev.filter((x) => x !== d))}
                      className="text-ink-faint hover:text-alert-ink shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* PASO 6 */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink-soft">Resumen</p>
              <ul className="space-y-1.5 text-sm">
                {STEPS.slice(0, 5).map((s, i) => (
                  <li key={s.title} className="flex items-center gap-2">
                    {stepStatus[i] === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-accent-ink shrink-0" />
                    ) : (
                      <span className="h-4 w-4 flex items-center justify-center text-ink-faint shrink-0">–</span>
                    )}
                    <span className={stepStatus[i] === "done" ? "text-ink" : "text-ink-faint"}>
                      {s.title}
                      {stepStatus[i] === "skipped" && " (omitido)"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-xs text-ink-soft bg-background border border-line rounded-xl p-3 space-y-1">
              <p className="font-medium text-ink-soft">Al pulsar “Crear y lanzar” se ejecutará en segundo plano:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Importar las keywords del estudio al Rank Tracking y comprobar su posición.</li>
                <li>Generar el análisis TF-IDF de cada keyword (gratis, reutiliza el SERP ya pagado).</li>
                <li>Analizar cada competidor (visibilidad + content gap).</li>
              </ul>
              <p className="text-ink-soft">
                El coste real se registra en el panel de Costes. Puedes ver el progreso al entrar en
                la ficha del proyecto.
              </p>
            </div>
            <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-line hover:bg-background">
              <input
                type="checkbox"
                checked={runAudit}
                onChange={(e) => setRunAudit(e.target.checked)}
                className="h-4 w-4 mt-0.5"
              />
              <span>
                <span className="text-sm font-medium text-ink">Ejecutar auditoría técnica ahora</span>
                <span className="block text-xs text-ink-soft">
                  Rastrea el sitio (enlaces rotos, HTTPS, canonicals, on-page…). Requiere dominio.
                </span>
              </span>
            </label>
          </div>
        )}

        {error && <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-lg">{error}</p>}

        {/* Navegación */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
          {step === 0 ? (
            <Link href="/app/proyectos" className="text-sm text-ink-soft hover:text-ink inline-flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Cancelar
            </Link>
          ) : (
            <button type="button" onClick={back} className="text-sm text-ink-soft hover:text-ink inline-flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Atrás
            </button>
          )}

          <div className="flex items-center gap-2">
            {step > 0 && !isLast && (
              <button type="button" onClick={skip} className="px-3 py-2 text-sm text-ink-soft hover:text-ink">
                Omitir paso
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={goNext}
                disabled={saving || (step === 0 && !canContinueStep0)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-900 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Continuar <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-900 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Crear y lanzar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
