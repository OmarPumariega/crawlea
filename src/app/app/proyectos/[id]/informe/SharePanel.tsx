"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Check, Mail, Palette, Loader2 } from "lucide-react";
import Pill from "@/components/app/Pill";

export type ShareState = {
  token: string | null;
  emailTo: string | null;
  ownBrand: { brandName: string | null; brandLogo: string | null; brandColor: string | null };
};

const CARD =
  "bg-surface rounded-2xl border border-line p-5 shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)]";
const INPUT =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/30";
const BTN_PRIMARY =
  "bg-brand text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-brand-strong transition-colors disabled:opacity-50";
const BTN_GHOST =
  "border border-line text-ink-soft text-sm font-medium rounded-full px-4 py-2 hover:bg-background transition-colors disabled:opacity-50";

export default function SharePanel({ projectId, share }: { projectId: string; share: ShareState }) {
  const router = useRouter();
  const [token, setToken] = useState(share.token);
  const [emailTo, setEmailTo] = useState(share.emailTo ?? "");
  const [savedEmail, setSavedEmail] = useState(share.emailTo);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [brandName, setBrandName] = useState(share.ownBrand.brandName ?? "");
  const [brandColor, setBrandColor] = useState(share.ownBrand.brandColor ?? "#4f46e5");
  const [brandLogo, setBrandLogo] = useState<string | null>(share.ownBrand.brandLogo);
  const fileRef = useRef<HTMLInputElement>(null);

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/informe/${token}` : "";

  async function call(key: string, fn: () => Promise<Response>, okText: string, after?: (body: Record<string, unknown>) => void) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fn();
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "No se pudo completar la acción");
      after?.(body);
      setMsg({ tone: "success", text: okText });
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "Error inesperado" });
    } finally {
      setBusy(null);
    }
  }

  const patch = (body: object) =>
    fetch(`/api/proyectos/${projectId}/informe/compartir`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 150 * 1024) {
      setMsg({ tone: "danger", text: "El logo pesa más de 150 KB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBrandLogo(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  return (
    <>
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="h-4 w-4 text-ink-soft" />
          <h3 className="text-lg font-bold tracking-tight text-ink">Compartir con tu cliente</h3>
        </div>
        <p className="text-xs text-ink-faint mb-3">
          Un enlace de solo lectura que tu cliente abre sin cuenta. Nunca incluye el gasto en APIs.
        </p>

        {!token ? (
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={busy !== null}
            onClick={() =>
              call("create", () => patch({ enabled: true }), "Enlace creado", (b) => setToken((b.token as string) ?? null))
            }
          >
            {busy === "create" ? "Creando…" : "Crear enlace"}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input readOnly value={url} className={INPUT} onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                className={BTN_GHOST}
                title="Copiar enlace"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <div className="border-t border-line pt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <Mail className="h-4 w-4 text-ink-soft" />
                Enviarlo cada mes por email
              </label>
              <input
                type="email"
                placeholder="cliente@empresa.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className={INPUT}
              />
              <p className="text-xs text-ink-faint">
                Sale el día 1 de cada mes con el informe del mes anterior. Empieza el mes que viene.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  disabled={busy !== null || emailTo.trim() === (savedEmail ?? "")}
                  onClick={() =>
                    call(
                      "email",
                      () => patch({ emailTo: emailTo.trim() || null }),
                      emailTo.trim() ? "Envío mensual activado" : "Envío mensual desactivado",
                      (b) => setSavedEmail((b.emailTo as string) ?? null)
                    )
                  }
                >
                  {busy === "email" ? "Guardando…" : emailTo.trim() ? "Guardar" : "Quitar"}
                </button>
                {savedEmail && (
                  <button
                    type="button"
                    className={BTN_GHOST}
                    disabled={busy !== null}
                    onClick={() =>
                      call("send", () => fetch(`/api/proyectos/${projectId}/informe/compartir`, { method: "POST" }), `Enviado a ${savedEmail}`)
                    }
                  >
                    {busy === "send" ? "Enviando…" : "Enviar ahora el del mes pasado"}
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              className="w-full border-t border-line pt-3 text-xs text-ink-soft hover:text-ink transition-colors disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => {
                if (!window.confirm("El enlace actual dejará de funcionar y se apagará el envío mensual. ¿Revocarlo?")) return;
                void call("revoke", () => patch({ enabled: false }), "Enlace revocado", () => {
                  setToken(null);
                  setSavedEmail(null);
                  setEmailTo("");
                });
              }}
            >
              Revocar enlace
            </button>
          </div>
        )}

        {msg && <Pill tone={msg.tone} className="mt-3">{msg.text}</Pill>}
      </div>

      <details className={`${CARD} group`}>
        <summary className="flex items-center gap-2 cursor-pointer list-none">
          <Palette className="h-4 w-4 text-ink-soft" />
          <h3 className="text-lg font-bold tracking-tight text-ink">Marca del informe</h3>
          <span className="ml-auto text-xs text-ink-faint group-open:hidden">
            {share.ownBrand.brandName ?? "Sin configurar"}
          </span>
        </summary>
        <p className="text-xs text-ink-faint my-3">
          Tu logo y nombre en lugar de Crawlea, en todos tus informes y en los emails al cliente.
        </p>
        <div className="space-y-3">
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Nombre de tu empresa"
            className={INPUT}
            maxLength={80}
          />
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-9 w-12 rounded-lg border border-line bg-background cursor-pointer"
              aria-label="Color de la marca"
            />
            <span className="text-xs text-ink-faint tabular-nums">{brandColor}</span>
          </div>
          <div className="flex items-center gap-3">
            {brandLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandLogo} alt="Logo" className="h-9 max-w-[120px] object-contain rounded border border-line bg-white p-1" />
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
            <button type="button" className={BTN_GHOST} onClick={() => fileRef.current?.click()}>
              {brandLogo ? "Cambiar logo" : "Subir logo"}
            </button>
            {brandLogo && (
              <button type="button" className="text-xs text-ink-soft hover:text-ink" onClick={() => setBrandLogo(null)}>
                Quitar
              </button>
            )}
          </div>
          <p className="text-xs text-ink-faint">PNG, JPG, WebP o SVG de hasta 150 KB.</p>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={busy !== null}
            onClick={() =>
              call(
                "brand",
                () =>
                  fetch("/api/perfil/marca", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ brandName, brandColor, brandLogo }),
                  }),
                "Marca guardada",
                () => router.refresh()
              )
            }
          >
            {busy === "brand" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Guardar marca"}
          </button>
        </div>
      </details>
    </>
  );
}
