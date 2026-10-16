"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";
import Logo from "@/components/app/Logo";
import { track } from "@/lib/analytics/track";

// Panel compartido de /acceso y /registro. El SaaS se entra con Google (vía
// pública); el formulario email+contraseña queda como "acceso interno" para
// el admin de la plataforma (única cuenta con password).
export default function AuthPanel({ variant, callbackUrl = "/app" }: { variant: "acceso" | "registro"; callbackUrl?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showInternal, setShowInternal] = useState(false);

  const esRegistro = variant === "registro";

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    // redirect true: Google navega a su pantalla de consentimiento; no hay
    // resultado que inspeccionar aquí (los errores llegan por query param).
    track(esRegistro ? "sign_up_start" : "login", { method: "google" });
    await signIn("google", { callbackUrl });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email o contraseña incorrectos");
    } else {
      router.push("/app");
      router.refresh();
    }
  }

  const highlights = [
    "Auditoría técnica, rank tracking y SEO local en un solo panel",
    "Datos reales de Search Console, Analytics y DataForSEO",
    "Copilot con IA y generación de títulos, metas, schema y contenido",
  ];

  // Alturas de las barras decorativas (motivo de ranking): ascensión clara
  // con pequeñas vacilaciones — la última, en lima, es "la que sube al primer
  // puesto".
  const bars = [32, 48, 60, 74, 92, 116];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Panel de tinta (oculto en móvil): la superficie más bold de la
          identidad — grid de puntos, barras de ranking sobredimensionadas
          cortadas por el borde y micro-etiquetas en mono. */}
      <aside className="hidden lg:flex flex-col justify-between bg-brand text-white p-12 relative overflow-hidden">
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          className="absolute bottom-0 right-0 flex items-end gap-3 pr-10 pb-10"
          aria-hidden="true"
        >
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-9 rounded-t-md origin-bottom animate-[rise_0.7s_ease-out_both]"
              style={{
                height: h * 1.6,
                animationDelay: `${i * 90}ms`,
                background:
                  i === bars.length - 1 ? "var(--signal)" : "rgba(255,255,255,0.14)",
              }}
            />
          ))}
        </div>

        <div className="relative">
          <Logo tone="light" textClassName="text-white text-lg" />
          <p className="mt-2 text-xs font-semibold text-signal/90">
            {esRegistro ? "Crear cuenta" : "Acceso"}
          </p>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight">
            Todo tu SEO,
            <br />
            con datos reales
          </h1>
          <p className="text-white/70 leading-relaxed">
            Centraliza el trabajo SEO de tus proyectos sin saltar entre Ahrefs,
            Semrush ni hojas de cálculo. Empieza gratis y sube de plan cuando
            lo necesites.
          </p>
          <ul className="space-y-3 pt-6 border-t border-white/10">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-3 text-sm text-white/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal/15">
                  <Check className="h-3 w-3 text-signal" />
                </span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs font-semibold text-white/50">
          © {new Date().getFullYear()} Crawlea
        </p>
      </aside>

      {/* Formulario sobre papel */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          {/* Logo visible en móvil (en escritorio ya está en el panel izquierdo) */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-8 shadow-[0_1px_2px_rgba(17,20,43,0.05),0_16px_40px_-24px_rgba(17,20,43,0.25)]">
            <div className="mb-6">
              <p className="text-xs font-semibold text-ink-faint">
                {esRegistro ? "Registro" : "Acceso"}
              </p>
              <h2 className="text-xl font-semibold text-ink mt-1">
                {esRegistro ? "Crear tu cuenta" : "Iniciar sesión"}
              </h2>
            </div>

            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full py-2.5 px-4 border border-line bg-surface text-ink text-sm font-medium rounded-xl hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-colors active:scale-[0.99]"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
                  />
                </svg>
              )}
              {esRegistro ? "Continuar con Google" : "Entrar con Google"}
            </button>

            <p className="mt-3 text-xs text-ink-soft leading-relaxed">
              {esRegistro && "Plan gratis, sin tarjeta: crea tu primer proyecto y pruébalo todo. "}
              Al continuar con Google, aceptas los{" "}
              <Link href="/legal/terminos" target="_blank" className="font-semibold text-brand hover:underline">Términos de uso</Link> y la{" "}
              <Link href="/legal/privacidad" target="_blank" className="font-semibold text-brand hover:underline">Política de privacidad</Link>.
              Te los pediremos de nuevo al entrar para dejar constancia.
            </p>

            <div className="mt-6 pt-5 border-t border-line">
              {showInternal ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-xs font-semibold font-medium text-ink-soft">
                    Acceso interno (email y contraseña)
                  </p>
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-semibold font-medium text-ink-soft mb-1.5">
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15 bg-surface"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-xs font-semibold font-medium text-ink-soft mb-1.5">
                      Contraseña
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15 bg-surface"
                      placeholder="••••••••"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-alert-ink bg-alert-tint border border-alert-tint px-3 py-2 rounded-xl">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-brand text-white text-sm font-medium rounded-full hover:bg-brand-strong disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-[background-color,transform] active:scale-[0.99]"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Entrar
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowInternal(true)}
                  className="text-xs text-ink-faint hover:text-ink-soft underline underline-offset-4"
                >
                  Acceso interno con contraseña
                </button>
              )}
            </div>
          </div>

          {!esRegistro && (
            <p className="mt-6 text-center text-sm text-ink-soft">
              ¿No tienes cuenta?{" "}
              <a href="/registro" className="text-brand hover:underline font-medium">
                Crear cuenta gratis
              </a>
            </p>
          )}

          <p className="mt-6 text-center text-xs font-semibold text-ink-faint">
            Solo datos reales
          </p>
        </div>
      </div>
    </div>
  );
}
