"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Logo from "@/components/app/Logo";

const LINKS = [
  { href: "/funciones", label: "Funciones" },
  { href: "/precios", label: "Precios" },
  { href: "/contacto", label: "Contacto" },
];

// Páginas que abren con un hero oscuro: ahí la cabecera flota transparente y
// pasa a cristal al hacer scroll. En el resto (legales) es cristal siempre.
const DARK_HERO = ["/", "/funciones", "/precios", "/contacto"];

export default function MarketingHeader({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const overHero = DARK_HERO.includes(pathname) && !scrolled && !open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cierra el menú móvil al navegar.
  useEffect(() => setOpen(false), [pathname]);

  const cta = loggedIn ? (
    <Link href="/app" data-track="open_app_click" data-track-location="header" className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-strong">
      Ir al panel
    </Link>
  ) : (
    <Link
      href="/registro"
      data-track="signup_cta_click"
      data-track-location="header"
      className={cn(
        "rounded-full px-5 py-2 text-sm font-semibold transition-colors",
        overHero ? "bg-white text-brand-700 hover:bg-brand-50" : "bg-brand text-white hover:bg-brand-strong"
      )}
    >
      Empieza gratis
    </Link>
  );

  return (
    <header
      data-section="header"
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        overHero ? "border-b border-transparent" : "border-b border-line bg-background/85 backdrop-blur-xl",
        open && "bg-background"
      )}
    >
      <div className="mx-auto grid h-[68px] max-w-[1360px] grid-cols-[auto_1fr_auto] items-center gap-6 px-5 sm:px-8 lg:px-10">
        <Link href="/" aria-label="Crawlea, inicio" className="justify-self-start">
          <Logo textClassName={cn("text-[19px]", overHero && "!text-white")} />
        </Link>

        <nav aria-label="Principal" className="hidden items-center justify-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative px-4 py-2 text-[15px] font-semibold transition-colors",
                  overHero ? (active ? "text-white" : "text-white/65 hover:text-white") : active ? "text-ink" : "text-ink-soft hover:text-ink"
                )}
              >
                {l.label}
                <span
                  className={cn(
                    "absolute inset-x-4 -bottom-px h-0.5 rounded-full transition-opacity",
                    overHero ? "bg-white" : "bg-brand",
                    active ? "opacity-100" : "opacity-0"
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-self-end gap-2 md:gap-3">
          {!loggedIn && (
            <Link
              href="/acceso"
              data-track="login_click"
              data-track-location="header"
              className={cn("hidden px-3 py-2 text-[15px] font-semibold transition-colors sm:block", overHero ? "text-white/80 hover:text-white" : "text-ink-soft hover:text-ink")}
            >
              Entra
            </Link>
          )}
          {cta}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className={cn("flex h-10 w-10 items-center justify-center rounded-full md:hidden", overHero ? "text-white" : "text-ink")}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Menú móvil" className="border-t border-line bg-background px-4 pb-6 pt-3 md:hidden">
          {[...LINKS, ...(loggedIn ? [] : [{ href: "/acceso", label: "Entra" }])].map((l) => (
            <Link key={l.href} href={l.href} className="block border-b border-line py-3.5 text-base font-semibold text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
