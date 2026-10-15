"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import Logo from "@/components/admin/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      router.push("/admin");
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
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-signal/90">
            Panel interno
          </p>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight">
            El panel SEO interno
            <br />
            de Agencia Ciro
          </h1>
          <p className="text-white/70 leading-relaxed">
            Centraliza todo el trabajo SEO de tus clientes con datos reales, sin
            saltar entre Ahrefs, Semrush ni hojas de cálculo.
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

        <p className="relative font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
          © {new Date().getFullYear()} Agencia Ciro
        </p>
      </aside>

      {/* Formulario sobre papel */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          {/* Logo visible en móvil (en escritorio ya está en el panel izquierdo) */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo />
          </div>

          <div className="rounded-2xl border border-line bg-white p-8 shadow-[0_1px_2px_rgba(26,29,26,0.05),0_16px_40px_-24px_rgba(26,29,26,0.25)]">
            <div className="mb-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
                Acceso
              </p>
              <h2 className="text-xl font-semibold text-gray-900 mt-1">Iniciar sesión</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block font-mono text-[11px] uppercase tracking-[0.12em] font-medium text-gray-500 mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15 bg-white"
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block font-mono text-[11px] uppercase tracking-[0.12em] font-medium text-gray-500 mb-1.5">
                  Contraseña
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-line rounded-xl text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15 bg-white"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand-strong disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-[background-color,transform] active:scale-[0.99]"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Entrar
              </button>
            </form>
          </div>

          <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">
            Uso interno · Solo datos reales
          </p>
        </div>
      </div>
    </div>
  );
}
