import { postTask } from "@/lib/dataforseo/client";

// Consulta a un asistente de IA con búsqueda web activa (DataForSEO · AI
// Optimization → LLM Responses, modo Live). Devuelve la respuesta y las
// fuentes citadas (annotations). España por defecto: el contenido de las
// consultas y la ubicación de la búsqueda web son los del cliente real.

export type AiPlatform = "chatgpt" | "perplexity";

export const AI_PLATFORMS: Record<AiPlatform, { label: string; path: string; model: string; estCostUsd: number }> = {
  // Estimaciones orientativas a partir de los ejemplos de la documentación
  // (~0,03$ con búsqueda web en ChatGPT, ~0,007$ en Perplexity). El coste real
  // es el que devuelve la API y se registra en ApiUsageLog.
  chatgpt: { label: "ChatGPT", path: "/v3/ai_optimization/chat_gpt/llm_responses/live", model: "gpt-4o-mini", estCostUsd: 0.03 },
  perplexity: { label: "Perplexity", path: "/v3/ai_optimization/perplexity/llm_responses/live", model: "sonar", estCostUsd: 0.01 },
};

export function estimateCostUsd(platforms: AiPlatform[], prompts: number): number {
  const perPrompt = platforms.reduce((s, p) => s + AI_PLATFORMS[p].estCostUsd, 0);
  return Math.round(perPrompt * prompts * 1000) / 1000;
}

type Section = { type?: string; text?: string | null; annotations?: { url?: string | null; title?: string | null }[] | null };
type Item = { type?: string; sections?: Section[] | null };
type LlmResult = {
  model_name?: string;
  items?: Item[] | null;
  fan_out_queries?: unknown;
  input_tokens?: number;
  output_tokens?: number;
};

export type AiAnswer = {
  model: string | null;
  answer: string;
  annotations: { url?: string | null; title?: string | null }[];
  costUsd: number | null;
  // Búsquedas internas que el asistente lanzó para responder (fan-out): muestra
  // qué consultas reales usa la IA, útil para decidir qué contenido cubrir.
  fanOutQueries: string[];
  inputTokens: number | null;
  outputTokens: number | null;
};

export async function askAssistant(platform: AiPlatform, userPrompt: string): Promise<AiAnswer> {
  const cfg = AI_PLATFORMS[platform];
  const body: Record<string, unknown> =
    platform === "chatgpt"
      ? { user_prompt: userPrompt, model_name: cfg.model, web_search: true, force_web_search: true, web_search_country_iso_code: "ES" }
      : { user_prompt: userPrompt, model_name: cfg.model, web_search_country_iso_code: "ES" };

  const task = await postTask(cfg.path, body, `ai.${platform}`);
  const result = (Array.isArray(task.result) ? task.result[0] : null) as LlmResult | null;

  const texts: string[] = [];
  const annotations: AiAnswer["annotations"] = [];
  for (const item of result?.items ?? []) {
    if (item.type && item.type !== "message") continue; // se ignora el razonamiento interno
    for (const s of item.sections ?? []) {
      if (typeof s.text === "string") texts.push(s.text);
      for (const a of s.annotations ?? []) annotations.push(a);
    }
  }
  return {
    model: result?.model_name ?? null,
    answer: texts.join("\n\n"),
    annotations,
    costUsd: typeof task.cost === "number" ? task.cost : null,
    fanOutQueries: Array.isArray(result?.fan_out_queries)
      ? (result.fan_out_queries as unknown[]).filter((q): q is string => typeof q === "string" && q !== "")
      : [],
    inputTokens: typeof result?.input_tokens === "number" ? result.input_tokens : null,
    outputTokens: typeof result?.output_tokens === "number" ? result.output_tokens : null,
  };
}
