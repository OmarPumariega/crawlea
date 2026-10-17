import { requireSession, projectForSession, moduleGate, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DataForSeoError } from "@/lib/dataforseo/client";
import { assertWithinSpendLimit, DataForSeoSpendLimitError } from "@/lib/dataforseo/spend";
import { AI_PLATFORMS, askAssistant, estimateCostUsd, type AiPlatform } from "@/lib/ai-visibility/llm";
import { detectVisibility } from "@/lib/ai-visibility/detect";

export const maxDuration = 300;
const MAX_PER_CALL = 10;

// POST { promptIds: string[], platforms: ("chatgpt"|"perplexity")[] } —
// pregunta de verdad a cada asistente (con búsqueda web) y guarda si el
// dominio del proyecto sale citado o mencionado. Una llamada de pago por
// (pregunta × plataforma): el tope de créditos se comprueba ANTES de cada una
// y se para en cuanto se agota, devolviendo lo ya hecho.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "ia");
  if (gate) return gate;
  const { id } = await params;
  const project = await projectForSession(session, id, { id: true, name: true, domain: true, businessName: true });
  if (!project) return projectNotFound();
  if (!project.domain) {
    return NextResponse.json({ error: "El proyecto necesita un dominio para medir si apareces" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { promptIds?: unknown; platforms?: unknown };
  const platforms = (Array.isArray(body.platforms) ? body.platforms : []).filter(
    (p): p is AiPlatform => typeof p === "string" && p in AI_PLATFORMS
  );
  const promptIds = (Array.isArray(body.promptIds) ? body.promptIds : []).filter((p): p is string => typeof p === "string");
  if (platforms.length === 0) return NextResponse.json({ error: "Elige al menos un asistente" }, { status: 400 });
  if (promptIds.length === 0) return NextResponse.json({ error: "Elige al menos una pregunta" }, { status: 400 });
  if (promptIds.length > MAX_PER_CALL) {
    return NextResponse.json({ error: `Comprueba como máximo ${MAX_PER_CALL} preguntas de una vez` }, { status: 400 });
  }

  const prompts = await prisma.aiPrompt.findMany({ where: { id: { in: promptIds }, projectId: id } });
  if (prompts.length === 0) return NextResponse.json({ error: "Preguntas no encontradas" }, { status: 404 });

  // Comprobación previa del total: evita empezar algo que no se puede acabar.
  try {
    await assertWithinSpendLimit(id, estimateCostUsd(platforms, prompts.length));
  } catch (error) {
    if (error instanceof DataForSeoSpendLimitError) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }

  const brandNames = [project.businessName, project.name].filter((n): n is string => Boolean(n));
  let done = 0;
  let stopped: string | null = null;
  const errors: string[] = [];

  outer: for (const p of prompts) {
    for (const platform of platforms) {
      try {
        await assertWithinSpendLimit(id, AI_PLATFORMS[platform].estCostUsd);
        const ans = await askAssistant(platform, p.prompt);
        const det = detectVisibility({
          answer: ans.answer,
          annotations: ans.annotations,
          projectDomain: project.domain,
          brandNames,
        });
        await prisma.aiCheck.create({
          data: {
            promptId: p.id,
            platform,
            model: ans.model,
            cited: det.cited,
            mentioned: det.mentioned,
            citedRank: det.citedRank,
            sources: det.sources.slice(0, 20),
            answer: ans.answer.slice(0, 4000),
            costUsd: ans.costUsd,
            fanOutQueries: ans.fanOutQueries,
            inputTokens: ans.inputTokens,
            outputTokens: ans.outputTokens,
          },
        });
        if (ans.costUsd !== null) {
          await prisma.apiUsageLog.create({
            data: { projectId: id, api: "dataforseo", endpoint: `ia.${platform}`, model: ans.model, costUsd: ans.costUsd },
          });
        }
        done++;
      } catch (error) {
        if (error instanceof DataForSeoSpendLimitError) {
          stopped = error.message;
          break outer;
        }
        errors.push(error instanceof DataForSeoError ? error.message : "No se pudo completar una de las consultas");
      }
    }
  }

  return NextResponse.json({ done, stopped, errors: [...new Set(errors)] });
}
