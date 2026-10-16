import Link from "next/link";
import { Lock } from "lucide-react";

// Pantalla que sustituye a un módulo de pago cuando el plan de la cuenta no
// lo incluye. El gating real vive en las rutas API (moduleGate); esto solo
// evita mostrar una vista que fallaría con 402.
export default function UpgradeWall({ modulo }: { modulo: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-[20px] border border-line bg-surface p-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand">
        <Lock className="h-5 w-5" />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-ink">{modulo} está en los planes de pago</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Tu plan Gratis no incluye este módulo porque consulta fuentes de pago por cada análisis.
        Pasa a Pro y empieza a usarlo.
      </p>
      <Link
        href="/precios"
        data-track="upgrade_click"
        data-track-location={modulo}
        className="mt-6 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
      >
        Ver planes
      </Link>
    </div>
  );
}
