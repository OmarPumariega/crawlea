import { requireSession, projectForSession, moduleGate, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { AI_PLATFORMS } from "@/lib/ai-visibility/llm";
import { rootDomain, type AiSource } from "@/lib/ai-visibility/detect";

const MAX_PROMPTS = 30;
const MAX_PROMPT_LEN = 200;

// GET — preguntas seguidas con su última comprobación por plataforma, más los
// agregados que alimentan los KPI y el ranking de "quién se cita".
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "ia");
  if (gate) return gate;
  const { id } = await params;
  const project = await projectForSession(session, id, { id: true, domain: true });
  if (!project) return projectNotFound();

  const [prompts, competitors] = await Promise.all([
    prisma.aiPrompt.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
      include: {
        checks: {
          orderBy: { checkedAt: "desc" },
          take: 12, // suficiente para la última por plataforma y una mini tendencia
          select: { id: true, platform: true, model: true, cited: true, mentioned: true, citedRank: true, sources: true, answer: true, checkedAt: true, fanOutQueries: true },
        },
      },
    }),
    prisma.competitor.findMany({ where: { projectId: id }, select: { domain: true } }),
  ]);

  return NextResponse.json({
    domain: project.domain ? rootDomain(project.domain) : null,
    competitors: competitors.map((c) => rootDomain(c.domain)),
    platforms: Object.fromEntries(
      Object.entries(AI_PLATFORMS).map(([k, v]) => [k, { label: v.label, estCostUsd: v.estCostUsd }])
    ),
    prompts: prompts.map((p) => ({
      id: p.id,
      prompt: p.prompt,
      createdAt: p.createdAt,
      checks: p.checks.map((c) => ({ ...c, sources: c.sources as unknown as AiSource[] })),
    })),
  });
}

// POST { prompts: string[] } — añade preguntas (se ignoran duplicadas).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "ia");
  if (gate) return gate;
  const { id } = await params;
  const project = await projectForSession(session, id, { id: true });
  if (!project) return projectNotFound();

  const body = (await req.json().catch(() => ({}))) as { prompts?: unknown };
  const incoming = Array.isArray(body.prompts) ? body.prompts : [];
  const clean = [...new Set(incoming.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean))];
  if (clean.length === 0) return NextResponse.json({ error: "Escribe al menos una pregunta" }, { status: 400 });
  if (clean.some((p) => p.length > MAX_PROMPT_LEN)) {
    return NextResponse.json({ error: `Cada pregunta puede tener como máximo ${MAX_PROMPT_LEN} caracteres` }, { status: 400 });
  }

  const existing = await prisma.aiPrompt.count({ where: { projectId: id } });
  if (existing + clean.length > MAX_PROMPTS) {
    return NextResponse.json({ error: `Puedes seguir hasta ${MAX_PROMPTS} preguntas por proyecto` }, { status: 400 });
  }
  const res = await prisma.aiPrompt.createMany({
    data: clean.map((prompt) => ({ projectId: id, prompt })),
    skipDuplicates: true,
  });
  return NextResponse.json({ added: res.count });
}
