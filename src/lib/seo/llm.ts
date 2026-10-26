import OpenAI from "openai";
import { getSetting } from "@/lib/settings";

// El cliente no se cachea a nivel de módulo (a diferencia de la versión
// anterior): la API key puede cambiar en caliente desde Configuración, y
// construir el cliente es barato (no abre conexión hasta la primera
// llamada) — cachear habría servido una clave vieja hasta reiniciar el
// proceso.
// La clave falta o es un valor de ejemplo (copiado de .env.example): no hay IA configurada.
export class LlmNotConfiguredError extends Error {
  constructor() {
    super("La IA no está disponible ahora mismo. Inténtalo de nuevo más tarde.");
    this.name = "LlmNotConfiguredError";
  }
}

// Mensaje para quien administra la plataforma: dice la causa real y dónde arreglarla. Los clientes ven
// el genérico (no tienen por qué saber de claves ni de Configuración).
export const LLM_NOT_CONFIGURED_ADMIN_MESSAGE =
  "La clave de OpenRouter no está configurada (o es un valor de ejemplo). Pégala en Configuración → Claves de API para activar la IA.";

export async function getOpenRouterClient(): Promise<OpenAI> {
  const apiKey = await getSetting("OPENROUTER_API_KEY");
  if (!apiKey || /^placehold/i.test(apiKey.trim())) {
    console.error("[llm] falta la clave de OpenRouter (Configuración u OPENROUTER_API_KEY)");
    throw new LlmNotConfiguredError();
  }
  // timeout explícito: el default del SDK son 10 min (con hasta 2 reintentos
  // sobre timeouts, hasta 30 min reales) — eso es lo que hacía que Título/Meta
  // pareciera "colgado" cuando en realidad era OpenRouter tardando. maxRetries:0
  // para que el timeout sea el límite real, no el primero de varios intentos.
  return new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1", timeout: 90_000, maxRetries: 0 });
}

export async function getDefaultOpenRouterModel(): Promise<string> {
  return (await getSetting("OPENROUTER_MODEL")) || "openai/gpt-4o-mini";
}

// Modelo del Copilot: cae al modelo general de la herramienta si no se fijó
// uno propio desde Configuración. Permite usar un modelo más conversacional
// solo para el chat sin afectar a Título/Meta/Schema/Contenido.
export async function getCopilotModel(): Promise<string> {
  return (await getSetting("COPILOT_MODEL")) || getDefaultOpenRouterModel();
}

// Instrucciones del Copilot: por defecto conversacional, conciso y SIN
// markdown (la UI pinta texto plano, los ##/* se verían literalmente).
export const DEFAULT_COPILOT_SYSTEM_PROMPT =
  "Eres el asistente SEO de Crawlea para el proyecto que se indica. " +
  "Responde en español, en tono conversacional y cercano, como un colega experto que resuelve dudas y da consejos accionables. " +
  "Sé conciso: respuestas cortas (3-5 frases) salvo que te pidan detalle. " +
  "NUNCA uses markdown (sin *, #, -, **, ni listas con guion): escribe en texto plano, con frases naturales. " +
  "Usa datos reales del proyecto cuando sean relevantes. Si faltan datos o no estás seguro, dilo y sugiere cómo conseguirlos.";

export async function getCopilotSystemPrompt(): Promise<string> {
  return (await getSetting("COPILOT_SYSTEM_PROMPT")) || DEFAULT_COPILOT_SYSTEM_PROMPT;
}

// Traduce errores del SDK de OpenAI/OpenRouter a un mensaje que un usuario no
// técnico pueda entender y actuar — antes se devolvía error.message tal cual
// (p.ej. "401 Missing Authentication header"), que parecía "la función está
// rota" en vez de "falta configurar la clave de OpenRouter".
export function friendlyLlmErrorMessage(error: unknown, isAdmin = false): string {
  if (error instanceof LlmNotConfiguredError) return isAdmin ? LLM_NOT_CONFIGURED_ADMIN_MESSAGE : error.message;
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return "La IA está tardando más de lo normal en responder (más de 90s). Puede que el servicio esté saturado — inténtalo de nuevo en unos minutos.";
  }
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) {
      if (isAdmin) return "OpenRouter ha rechazado la clave (no es válida o ha caducado). Revísala en Configuración → Claves de API.";
      return "La IA no está disponible ahora mismo. Inténtalo de nuevo más tarde.";
    }
    if (error.status === 429) {
      return "La IA está recibiendo muchas peticiones. Inténtalo de nuevo en unos segundos.";
    }
    if (error.status && error.status >= 500) {
      return "La IA no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.";
    }
    console.error("[llm]", error.status, error.message);
    return "La IA no ha podido responder. Inténtalo de nuevo en unos minutos.";
  }
  return error instanceof Error ? error.message : "Error al generar con IA";
}
