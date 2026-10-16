"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutDashboard, Users, Wallet, ArrowLeft, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Logo from "@/components/app/Logo";
import AdminHeader from "@/components/app/AdminHeader";

// Shell del panel de administración de la plataforma (/admin, solo role
// admin). Mismo marco visual que la herramienta (/app) pero con su propio
// sidebar: Resumen · Usuarios · Costes y la vuelta a la herramienta.
const ITEMS = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/costes", label: "Costes", icon: Wallet },
];

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setNavOpen(false);

  return (
    <div className="h-screen bg-frame overflow-hidden p-0 md:p-4">
      <div className="h-full flex overflow-hidden bg-surface rounded-none md:rounded-[24px] border border-line shadow-[0_8px_30px_rgba(17,20,43,0.08)]">
        {navOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-20 md:hidden" onClick={close} />
        )}
        <aside
          className={cn(
            "fixed md:static inset-y-0 left-0 z-30 w-[268px] bg-sidebar border-r border-line flex flex-col transition-transform md:translate-x-0",
            navOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <Logo />
            <button className="md:hidden text-ink-faint hover:text-ink" onClick={close} aria-label="Cerrar menú">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Administración
          </p>
          <nav className="flex-1 px-3 space-y-1">
            {ITEMS.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-brand text-white shadow-[0_6px_16px_-6px_rgba(79,92,245,0.5)]"
                      : "text-ink-soft hover:bg-surface hover:text-ink"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line p-3 space-y-1">
            <Link
              href="/app"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface hover:text-ink"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
              Ir a la herramienta
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/acceso" })}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-alert-tint hover:text-alert-ink"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Cerrar sesión
            </button>
          </div>
        </aside>
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 rounded-none md:rounded-[23px]">
          <AdminHeader onOpenNav={() => setNavOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
