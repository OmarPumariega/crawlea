// Google Maps devuelve como «web» de un negocio lo que el dueño puso en su ficha, y muchos
// ponen su Instagram, un WhatsApp o su agenda de reservas. Pedir las keywords de ese dominio
// devuelve las de TODA la plataforma (instagram.com, fresha.com...), sin relación con el
// negocio. Solo tiene sentido pedirlas cuando la ficha apunta a una web propia.
//
// Archivo puro (sin imports) para poder probarlo con `node --experimental-strip-types`.
const PLATFORM_DOMAINS = [
  // redes sociales y mensajería
  "instagram.com", "facebook.com", "fb.com", "fb.me", "m.me", "wa.me", "whatsapp.com", "t.me",
  "tiktok.com", "youtube.com", "youtu.be", "twitter.com", "x.com", "linkedin.com", "pinterest.com",
  "linktr.ee", "beacons.ai", "bio.link",
  // Google
  "google.com", "google.es", "goo.gl", "g.page", "business.site",
  // reservas y agendas
  "koibox.cloud", "koibox.com", "booksy.com", "fresha.com", "treatwell.es", "treatwell.com",
  "calendly.com", "setmore.com", "simplybook.me", "bookeo.com", "reservio.com", "agendapro.com",
  "thefork.es", "thefork.com", "tripadvisor.es", "tripadvisor.com", "paginasamarillas.es",
  "yelp.com", "doctoralia.es", "wixsite.com", "negocio.site",
];

export function isOwnSiteDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  const d = domain.trim().toLowerCase().replace(/^www\./, "");
  if (!d) return false;
  return !PLATFORM_DOMAINS.some((p) => d === p || d.endsWith(`.${p}`));
}
