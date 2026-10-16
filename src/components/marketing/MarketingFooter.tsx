import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Logo from "@/components/app/Logo";

const COLUMNS = [
  {
    title: "Producto",
    links: [
      { href: "/funciones", label: "Funciones" },
      { href: "/precios", label: "Precios" },
      { href: "/contacto", label: "Contacto" },
    ],
  },
  {
    title: "Funciones",
    links: [
      { href: "/funciones#posiciones", label: "Posiciones" },
      { href: "/funciones#auditoria", label: "Auditoría" },
      { href: "/funciones#backlinks", label: "Backlinks" },
      { href: "/funciones#seo-local", label: "SEO local" },
    ],
  },
  {
    title: "Tu cuenta",
    links: [
      { href: "/acceso", label: "Entra" },
      { href: "/registro", label: "Crea tu cuenta" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacidad", label: "Privacidad" },
      { href: "/legal/terminos", label: "Términos de uso" },
      { href: "/legal/cookies", label: "Cookies" },
    ],
  },
];

// Pie oscuro, mismo lenguaje que los hero: cuadrícula tenue, columnas de
// enlaces y el nombre de la marca en grande cortado por el borde inferior.
export default function MarketingFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#0B0D2B] text-white">
      <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 60% 70% at 0% 0%, rgba(79,92,245,0.28), transparent 70%)" }} />

      <div className="relative mx-auto max-w-[1360px] px-5 pt-16 sm:px-8 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Link href="/" aria-label="Crawlea, inicio"><Logo textClassName="text-2xl !text-white" /></Link>
            <p className="mt-5 text-[15px] leading-relaxed text-white/60">Lo esencial del SEO, con claridad y a un precio justo.</p>
            <Link href="/registro" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50">
              Empieza gratis <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <nav aria-label="Pie" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {COLUMNS.map((c) => (
              <div key={c.title}>
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">{c.title}</h2>
                <ul className="mt-5 space-y-3.5">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-[15px] font-medium text-white/75 transition-colors hover:text-white">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-2 border-t border-white/10 py-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Crawlea. Todos los derechos reservados.</p>
          <p className="max-w-xl sm:text-right">Google, Search Console, Analytics, PageSpeed Insights y Google Maps son marcas de Google LLC. Crawlea no está afiliada a Google. Los datos de las maquetas son de ejemplo.</p>
        </div>
      </div>

      <p className="pointer-events-none relative select-none overflow-hidden whitespace-nowrap text-center text-[clamp(6rem,22vw,21rem)] font-extrabold leading-[0.78] tracking-[-0.06em] text-white/[0.05]" aria-hidden="true">
        crawlea
      </p>
    </footer>
  );
}
