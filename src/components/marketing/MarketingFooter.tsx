import Link from "next/link";
import Logo from "@/components/app/Logo";

export default function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs space-y-3">
          <Logo textClassName="text-lg" />
          <p className="text-sm leading-relaxed text-ink-soft">Lo esencial del SEO, con claridad y a un precio justo.</p>
        </div>
        <nav aria-label="Pie" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
          <Link href="/#funciones" className="text-ink-soft hover:text-ink">Funciones</Link>
          <Link href="/precios" className="text-ink-soft hover:text-ink">Precios</Link>
          <Link href="/contacto" className="text-ink-soft hover:text-ink">Contacto</Link>
          <Link href="/legal/privacidad" className="text-ink-soft hover:text-ink">Privacidad</Link>
          <Link href="/legal/terminos" className="text-ink-soft hover:text-ink">Términos</Link>
          <Link href="/legal/cookies" className="text-ink-soft hover:text-ink">Cookies</Link>
        </nav>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-ink-faint">
        © {new Date().getFullYear()} Crawlea
      </div>
    </footer>
  );
}
