import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Logo from "@/components/app/Logo";

const LINKS = [
  { href: "/#funciones", label: "Funciones" },
  { href: "/precios", label: "Precios" },
  { href: "/contacto", label: "Contacto" },
];

// Cabecera de la web pública. Con sesión iniciada muestra «Ir al panel» en
// vez de «Entra»; la home sigue siendo pública e indexable para todos.
export default async function MarketingHeader() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Crawlea, inicio">
          <Logo textClassName="text-lg" />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {session ? (
            <Link href="/app" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">
              Ir al panel
            </Link>
          ) : (
            <>
              <Link href="/acceso" className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink">
                Entra
              </Link>
              <Link href="/registro" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">
                Empieza gratis
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
