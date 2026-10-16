import Link from "next/link";
import { Lock } from "lucide-react";

// Qué incluye cada módulo de pago: se enseña con candado para que el cliente
// vea que existe y qué puede hacer con él. Solo funciones reales de la herramienta.
const FEATURES: Record<string, { resumen: string; herramientas: string[] }> = {
  Backlinks: {
    resumen: "Descubre quién enlaza a tu web y a la de tus competidores, y cuánta autoridad tienen esos enlaces.",
    herramientas: [
      "Autoridad del dominio y enlaces totales, dofollow y rotos",
      "Listado de backlinks con anchor, autoridad y primera vez visto",
      "Tus páginas con más enlaces entrantes",
      "Comparativa de autoridad con tus competidores",
      "Dominios que enlazan a tu competencia y no a ti",
    ],
  },
  Competidores: {
    resumen: "Mira qué posiciona tu competencia en Google y qué te falta para alcanzarla.",
    herramientas: [
      "Visibilidad orgánica y tráfico estimado de cada competidor",
      "Distribución de posiciones: top 3, top 10 y top 100",
      "Content gap: palabras clave que ellos tienen y tú no",
      "Cómo muestran su título y descripción en Google",
      "Análisis on-page de cualquier página de la competencia",
      "Importar sus palabras clave a tu estudio con un clic",
    ],
  },
  Geogrid: {
    resumen: "Comprueba dónde apareces en Google Maps, punto por punto, alrededor de tu negocio.",
    herramientas: [
      "Mapa de calor con rejillas de 3×3, 5×5 o 7×7",
      "Posición exacta de tu ficha en cada punto",
      "Histórico y comparación entre dos escaneos",
      "Palabras clave por las que aparecen tus competidores locales",
      "Búsqueda y enlace de tu ficha de Google Business",
    ],
  },
};

// Pantalla de un módulo de pago cuando el plan de la cuenta no lo incluye. El
// bloqueo real vive en las rutas API (moduleGate); esto enseña qué hay dentro.
export default function UpgradeWall({ modulo }: { modulo: string }) {
  const info = FEATURES[modulo];
  return (
    <div className="mx-auto max-w-2xl rounded-[20px] border border-line bg-surface p-8 sm:p-10">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold text-ink-faint">Incluido en Basic y Pro</p>
          <h1 className="text-xl font-semibold text-ink">{modulo}</h1>
        </div>
      </div>
      {info && (
        <>
          <p className="mt-5 text-sm leading-relaxed text-ink-soft">{info.resumen}</p>
          <ul className="mt-5 divide-y divide-line rounded-2xl border border-line">
            {info.herramientas.map((h) => (
              <li key={h} className="flex items-center gap-3 px-4 py-3 text-sm text-ink">
                <Lock className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-5 text-sm text-ink-soft">
        Tu plan Gratis no incluye este módulo porque consulta fuentes de pago. Pasa a Basic o Pro y empieza a usarlo.
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
