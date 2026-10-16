// Destino tras el registro con Google cuando llega desde el analizador de la
// web pública (?web=ejemplo.es): directo a crear el proyecto con ese dominio.
// Solo se acepta algo con forma de dominio; si no, al panel.
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

// Si llega con ?plan=basic|pro (botón de un plan de pago desde la web pública),
// vuelve a /precios con el plan para lanzar el pago nada más entrar.
export function signupCallback(web: string | undefined, plan?: string): string {
  if (plan === "basic" || plan === "pro") return `/precios?plan=${plan}`;
  return web && DOMAIN_RE.test(web) ? `/app/proyectos/nuevo?dominio=${encodeURIComponent(web.toLowerCase())}` : "/app";
}
