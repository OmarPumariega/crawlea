// Países disponibles para el estudio de keywords. DataForSEO Labs (volumen, dificultad,
// intención) SOLO admite países; para una comunidad, provincia o ciudad el volumen sale de
// Google Ads (Keywords Data), que sí trabaja con esa granularidad pero no da dificultad ni
// intención. Los códigos son los identificadores de ubicación de Google (los mismos que usa
// DataForSEO). Archivo puro (sin imports) para poder probarlo con node.
export type KeywordCountry = { code: number; name: string; language: string };

export const KEYWORD_COUNTRIES: KeywordCountry[] = [
  { code: 2724, name: "España", language: "es" },
  { code: 2484, name: "México", language: "es" },
  { code: 2032, name: "Argentina", language: "es" },
  { code: 2170, name: "Colombia", language: "es" },
  { code: 2152, name: "Chile", language: "es" },
  { code: 2604, name: "Perú", language: "es" },
  { code: 2840, name: "Estados Unidos", language: "en" },
  { code: 2826, name: "Reino Unido", language: "en" },
  { code: 2250, name: "Francia", language: "fr" },
  { code: 2276, name: "Alemania", language: "de" },
  { code: 2380, name: "Italia", language: "it" },
  { code: 2620, name: "Portugal", language: "pt" },
];

export function isCountryCode(code: number): boolean {
  return KEYWORD_COUNTRIES.some((c) => c.code === code);
}
