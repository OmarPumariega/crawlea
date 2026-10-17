"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { PAID_MODULES, planAllowsModule, type ModuleId } from "@/lib/plans";
import {
  Anchor,
  Braces,
  ChevronDown,
  CircleUserRound,
  FileBarChart2,
  FileText,
  MessageSquareText,
  FolderKanban,
  Key,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Map,
  MapPin,
  NotebookPen,
  PenLine,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  Type,
  User,
  Users,
  Wallet,
  Wrench,
  X,
  Globe,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ProjectSwitcher, { pushRecent } from "@/components/app/ProjectSwitcher";
import Logo from "@/components/app/Logo";
import CreditsMeter from "@/components/app/CreditsMeter";
import ThemeToggle from "@/components/app/ThemeToggle";
import { useProjectIdFromPath } from "@/lib/hooks/useProjectIdFromPath";

const NAV_ITEMS = [
  { href: "/app", label: "Panel general", icon: LayoutDashboard },
  { href: "/app/proyectos", label: "Proyectos", icon: FolderKanban },
  { href: "/app/costes", label: "Costes", icon: Wallet },
  { href: "/app/perfil", label: "Mi perfil", icon: CircleUserRound },
  { href: "/app/configuracion", label: "Configuración", icon: Settings },
];

type ProjectInfo = { id: string; name: string; isLocalBusiness: boolean };

type NavModule = { href: string; label: string; icon: LucideIcon };
type NavGroup = { id: string; label: string; icon: LucideIcon; modules: NavModule[] };
type ProjectNav = { top: NavModule[]; groups: NavGroup[]; bottom: NavModule[] };

// Navegación de un proyecto agrupada por tipo de herramienta. Los módulos
// transversales (Perfil, Tareas, Notas, Visibilidad IA, Informe) van sueltos; el resto se agrupa en
// carpetas plegables: Investigación · On-Page · Técnico · Seguimiento. Geogrid
// solo aparece en proyectos locales (negocio con coordenadas) y cuelga del
// grupo Seguimiento. Copilot ya NO es una entrada de nav — es un widget
// flotante (CopilotWidget.tsx, montado en AdminShell), disponible
// en cualquier página de un proyecto sin navegar a ningún sitio.
function projectNav(base: string, isLocalBusiness: boolean): ProjectNav {
  const groups: NavGroup[] = [
    {
      id: "investigacion",
      label: "Investigación",
      icon: Search,
      modules: [
        { href: `${base}/keywords`, label: "Keywords", icon: Key },
      ],
    },
    {
      id: "onpage",
      label: "On-Page",
      icon: FileText,
      modules: [
        { href: `${base}/titulos-meta`, label: "Título y Meta", icon: Type },
        { href: `${base}/schema`, label: "Schema", icon: Braces },
        { href: `${base}/contenido`, label: "Contenido", icon: PenLine },
      ],
    },
    {
      id: "tecnico",
      label: "Técnico",
      icon: Wrench,
      modules: [
        { href: `${base}/auditoria`, label: "Auditoría", icon: ShieldCheck },
      ],
    },
    {
      id: "seguimiento",
      label: "Seguimiento",
      icon: LineChart,
      modules: [
        { href: `${base}/rank`, label: "Rank Tracking", icon: TrendingUp },
        { href: `${base}/google`, label: "Google", icon: Globe },
        { href: `${base}/competidores`, label: "Competidores", icon: Users },
        { href: `${base}/backlinks`, label: "Backlinks", icon: Anchor },
      ],
    },
  ];
  // SEO local: todo lo de SEO local en su propio grupo (de momento, el mapa de
  // calor de Google Maps). Solo en proyectos de negocio local.
  if (isLocalBusiness) {
    groups.push({
      id: "geolocal",
      label: "SEO local",
      icon: MapPin,
      modules: [{ href: `${base}/geogrid`, label: "Geogrid", icon: Map }],
    });
  }
  return {
    top: [
      { href: base, label: "Perfil", icon: User },
      { href: `${base}/tareas`, label: "Tareas", icon: ListChecks },
      { href: `${base}/notas`, label: "Notas", icon: NotebookPen },
    ],
    groups,
    bottom: [
      // Módulo propio, no cuelga de ningún grupo: no es seguimiento de posiciones.
      { href: `${base}/ia`, label: "Visibilidad IA", icon: MessageSquareText },
      { href: `${base}/informe`, label: "Informe", icon: FileBarChart2 },
    ],
  };
}

// ¿Es esta la ruta activa? Para Perfil (== base) exige coincidencia exacta;
// para el resto acepta rutas anidadas (p. ej. .../keywords/estudios/123).
function isModuleActive(href: string, base: string, pathname: string): boolean {
  if (href === base) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

// Segmentos de URL de módulos que se fusionaron como pestañas (Arquitectura→
// Keywords, TF-IDF→Contenido, Enlaces/Canibalizaciones→Auditoría). Si el
// usuario cambia de proyecto desde una URL vieja (pestaña abierta de antes
// de la fusión), se traduce el segmento a la ruta nueva en vez de caer en
// el 404 de una ruta que ya no existe. next.config.ts también redirige esas
// rutas legacy por si algo se nos escapa.
const LEGACY_MODULE_SEGMENTS: Record<string, string> = {
  arquitectura: "keywords/arquitectura",
  tfidf: "contenido/tfidf",
  enlaces: "auditoria/enlaces",
  canibalizaciones: "auditoria/canibalizaciones",
};

export default function AdminSidebar({
  navOpen,
  onClose,
}: {
  navOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const projectId = useProjectIdFromPath();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [query, setQuery] = useState("");

  // Proyecto elegido cuando NO se está dentro de uno (Panel general, lista…):
  // los módulos se ven siempre y apuntan al último proyecto usado o, si no hay,
  // al primero. Se recuerda en localStorage; dentro de un proyecto manda la URL.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const inProjects = pathname.startsWith("/app/proyectos");

  // Carga la lista de proyectos (para el selector y para los módulos). El
  // sidebar vive en el shell y no recibe el proyecto del layout — lo deduce de
  // la URL. Se recarga al entrar/salir de la sección de proyectos por si se
  // creó o borró alguno.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/proyectos")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ProjectInfo[]) => {
        if (!cancelled && Array.isArray(list)) {
          setProjects(list.map((p) => ({ id: p.id, name: p.name, isLocalBusiness: !!p.isLocalBusiness })));
          setProjectsLoaded(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [inProjects]);

  useEffect(() => {
    if (!projectId) return;
    // Registra el proyecto actual en "recientes" (localStorage) para el switcher.
    pushRecent(projectId);
    try {
      localStorage.setItem("crawlea:selectedProject", projectId);
    } catch {}
  }, [projectId]);

  // Lee la selección guardada tras montar (no en el render: evita desajustes de hidratación).
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        setSelectedId(localStorage.getItem("crawlea:selectedProject"));
      } catch {}
    });
  }, []);

  const activeId =
    projectId ??
    (selectedId && projects.some((p) => p.id === selectedId) ? selectedId : null) ??
    projects[0]?.id ??
    null;

  const project = projects.find((p) => p.id === activeId) ?? null;
  const base = project ? `/app/proyectos/${project.id}` : "";
  const nav = useMemo(
    () => (project ? projectNav(base, project.isLocalBusiness) : null),
    [project, base]
  );

  // Búsqueda: filtra la navegación (ítems globales + módulos del proyecto).
  const q = query.trim().toLowerCase();
  const filterModules = (mods: NavModule[]) =>
    q ? mods.filter((m) => m.label.toLowerCase().includes(q)) : mods;
  // Configuración (claves de API) y Costes (desglose del gasto) son solo del
  // admin; el cliente solo ve su saldo de créditos en el panel y el perfil.
  const isPlatformAdmin = session?.user?.role === "admin";
  const baseItems = NAV_ITEMS.filter((i) => isPlatformAdmin || (i.href !== "/app/configuracion" && i.href !== "/app/costes"));
  const navItemsFiltered = q
    ? baseItems.filter((i) => i.label.toLowerCase().includes(q))
    : baseItems;
  const navFiltered = nav
    ? {
        top: filterModules(nav.top),
        groups: nav.groups
          .map((g) => ({ ...g, modules: filterModules(g.modules) }))
          .filter((g) => g.modules.length > 0),
        bottom: filterModules(nav.bottom),
      }
    : null;
  const searching = q.length > 0;

  // Grupo plegable abierto. Por defecto (y al navegar a otro módulo) se abre el
  // grupo que contiene el módulo activo; el usuario puede abrir otro a mano.
  const activeGroupId = nav
    ? nav.groups.find((g) => g.modules.some((m) => isModuleActive(m.href, base, pathname)))?.id ?? null
    : null;
  // override = undefined → sigue al módulo activo (su grupo abierto por defecto);
  // string/null cuando el usuario abre/cierra a mano. Se resetea al navegar a un
  // módulo de otro grupo (patrón "reset state on prop change", sin effect).
  const [lastActive, setLastActive] = useState<string | null | undefined>(activeGroupId);
  const [override, setOverride] = useState<string | null | undefined>(undefined);
  if (activeGroupId !== lastActive) {
    setLastActive(activeGroupId);
    setOverride(undefined);
  }
  const openGroup = override !== undefined ? override : activeGroupId;

  // Segmento de módulo actual (para mantenerlo al cambiar de proyecto).
  // P.ej. estando en .../KEYWORDS, al cambiar de proyecto se va al Keywords del nuevo.
  function switchProject(newId: string) {
    if (!newId || newId === activeId) return;
    if (!projectId) {
      // Fuera de un proyecto: solo cambia el proyecto de los módulos, sin navegar.
      setSelectedId(newId);
      pushRecent(newId);
      try {
        localStorage.setItem("crawlea:selectedProject", newId);
      } catch {}
      return;
    }
    const rest = projectId ? pathname.replace(`/app/proyectos/${projectId}`, "") : "";
    const rawSeg = rest.replace(/^\//, "").split("/")[0] ?? "";
    const seg = LEGACY_MODULE_SEGMENTS[rawSeg] ?? rawSeg;
    let target = `/app/proyectos/${newId}`;
    if (seg && seg !== "geogrid") {
      target += `/${seg}`;
    } else if (seg === "geogrid") {
      // Geogrid solo existe en proyectos locales; si el destino no lo es, a Perfil.
      const np = projects.find((p) => p.id === newId);
      if (np?.isLocalBusiness) target += "/geogrid";
    }
    router.push(target);
    onClose();
  }

  const email = session?.user?.email ?? "";
  const nombre = email.split("@")[0] || "equipo";

  return (
    <>
      {navOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-20 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-30 w-[268px] bg-sidebar border-r border-line flex flex-col transition-transform md:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Marca */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Logo />
          <button className="md:hidden text-ink-faint hover:text-ink transition-colors" onClick={onClose} aria-label="Cerrar menú">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Buscador de navegación: filtra módulos y secciones al escribir */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar módulo…"
              className="w-full bg-surface border border-line rounded-xl pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
            />
          </div>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto pb-4 space-y-5">
          {/* Navegación global */}
          {navItemsFiltered.length > 0 && (
            <div className="space-y-1">
              {navItemsFiltered.map((item) => {
                const active =
                  item.href === "/app"
                    ? pathname === "/app"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <NavLink key={item.href} href={item.href} active={active} icon={<Icon className="h-[18px] w-[18px]" />} onClick={onClose}>
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          )}

          {/* Contexto de proyecto: selector + módulos (solo dentro de un
              proyecto). El selector permite cambiar de proyecto sin ir a la
              lista (1 clic), y mantiene el módulo activo al cambiar. */}
          {navFiltered && (
            <div className="space-y-4">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Proyecto
              </p>
              <ProjectSwitcher projects={projects} currentId={activeId} onSelect={switchProject} />

              <div className="space-y-1">
                {navFiltered.top.map((m) => (
                  <ModuleLink
                    key={m.href}
                    module={m}
                    base={base}
                    pathname={pathname}
                    onClick={onClose}
                    forceOpen={searching}
                  />
                ))}

                {navFiltered.groups.map((g) => {
                  const isOpen = searching || openGroup === g.id;
                  const groupHasActive = g.id === activeGroupId;
                  const GIcon = g.icon;
                  return (
                    <div key={g.id}>
                      <button
                        type="button"
                        onClick={() => setOverride(openGroup === g.id ? null : g.id)}
                        aria-expanded={isOpen}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors",
                          groupHasActive ? "text-ink" : "text-ink-faint hover:text-ink-soft"
                        )}
                      >
                        <span className="flex h-5 w-7 shrink-0 items-center justify-center">
                          <GIcon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-left">{g.label}</span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform",
                            isOpen ? "" : "-rotate-90"
                          )}
                        />
                      </button>
                      {isOpen && (
                        <div className="mt-0.5 space-y-1 pb-1">
                          {g.modules.map((m) => (
                            <ModuleLink
                              key={m.href}
                              module={m}
                              base={base}
                              pathname={pathname}
                              onClick={onClose}
                              forceOpen={searching}
                              nested
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {navFiltered.bottom.map((m) => (
                  <ModuleLink
                    key={m.href}
                    module={m}
                    base={base}
                    pathname={pathname}
                    onClick={onClose}
                    forceOpen={searching}
                  />
                ))}
              </div>

              <Link
                href="/app/proyectos"
                onClick={onClose}
                className="block px-3 pt-1 text-[13px] text-ink-faint hover:text-brand transition-colors"
              >
                Gestionar proyectos →
              </Link>
            </div>
          )}

          {!navFiltered && projectsLoaded && projects.length === 0 && !searching && (
            <div className="mx-1 rounded-xl border border-line bg-surface-muted p-3 text-[13px] text-ink-soft">
              <p className="font-semibold text-ink">Aún no tienes proyectos</p>
              <p className="mt-1">Crea el primero y aquí verás todos sus módulos.</p>
              <Link
                href="/app/proyectos/nuevo"
                onClick={onClose}
                className="mt-2 inline-block font-semibold text-brand hover:text-brand-strong"
              >
                Crear proyecto →
              </Link>
            </div>
          )}

          {session?.user?.role === "admin" && !searching && (
            <div className="space-y-1">
              <NavLink href="/admin" active={false} icon={<ShieldCheck className="h-[18px] w-[18px]" />} onClick={onClose}>
                Administración
              </NavLink>
            </div>
          )}

          {searching &&
            navItemsFiltered.length === 0 &&
            (!navFiltered || (navFiltered.top.length === 0 && navFiltered.groups.length === 0 && navFiltered.bottom.length === 0)) && (
              <p className="px-3 text-sm text-ink-faint">Sin resultados para “{query}”.</p>
            )}
        </nav>

        {/* Créditos del mes, siempre a la vista (no aparece para el admin) */}
        <CreditsMeter />

        {/* Tarjeta de usuario: enlace al perfil (datos, plan y consumo) */}
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Link href="/app/perfil" className="shrink-0" aria-label="Mi perfil">
              {session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full border border-line object-cover"
                />
              ) : (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white text-sm font-semibold"
                  aria-hidden="true"
                >
                  {nombre.charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
            <Link href="/app/perfil" className="min-w-0 flex-1 group">
              <p className="text-sm font-semibold text-ink truncate group-hover:text-brand transition-colors">
                {session?.user?.name || nombre}
              </p>
              <p className="text-xs text-ink-faint truncate">
                {session?.user?.role === "admin" ? "Plataforma" : "Mi cuenta"}
              </p>
            </Link>
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/acceso" })}
              className="p-2 text-ink-faint hover:text-alert-ink rounded-lg hover:bg-alert-tint transition-colors"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// Ítem de navegación global: píldora verde cuando está activo.
function NavLink({
  href,
  active,
  icon,
  onClick,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-brand text-white shadow-[0_6px_16px_-6px_rgba(79,92,245,0.5)]"
          : "text-ink-soft hover:bg-surface hover:text-ink hover:shadow-[0_1px_3px_rgba(17,20,43,0.06)]"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
          active ? "bg-white/20" : "bg-black/[0.05]"
        )}
      >
        {icon}
      </span>
      {children}
    </Link>
  );
}

function ModuleLink({
  module: m,
  base,
  pathname,
  onClick,
  forceOpen = false,
  nested = false,
}: {
  module: NavModule;
  base: string;
  pathname: string;
  onClick: () => void;
  forceOpen?: boolean;
  // true solo para los hijos de una carpeta desplegada; los módulos sueltos
  // (Perfil, Tareas, Notas, Informe) van alineados con las cabeceras de carpeta.
  nested?: boolean;
}) {
  const active = isModuleActive(m.href, base, pathname);
  const Icon = m.icon;
  // Candado en módulos de pago cuando el plan de la cuenta no los incluye
  // (el admin no está limitado). El gating real está en las rutas API.
  const { data: session } = useSession();
  const moduleId = m.href.split("/").pop() as ModuleId;
  const locked =
    session?.user?.role !== "admin" &&
    !!session?.user?.plan &&
    PAID_MODULES.includes(moduleId) &&
    !planAllowsModule(session.user.plan, moduleId);
  // Al buscar (forceOpen) los módulos se muestran planos; normalmente los
  // hijos de grupo van indentados bajo su carpeta.
  const indent = nested && !forceOpen ? "ml-5" : "";
  return (
    <Link
      href={m.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all",
        indent,
        active
          ? "bg-brand text-white shadow-[0_6px_16px_-6px_rgba(79,92,245,0.5)]"
          : "text-ink-soft hover:bg-surface hover:text-ink"
      )}
    >
      <span className="flex h-5 w-7 shrink-0 items-center justify-center">
        <Icon className={cn("h-4 w-4", active ? "" : "text-ink-faint")} />
      </span>
      <span className="truncate">{m.label}</span>
      {locked && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-faint" aria-label="Plan de pago" />}
    </Link>
  );
}
