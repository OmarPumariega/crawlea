import { requireSession, projectForSession, moduleGate, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { safeFetchHtml, SafeFetchError } from "@/lib/net/safe-fetch";
import { analyzeHtml, type AnalysisResult } from "@/lib/url-analyzer/analyze";
import { normalizeUrl } from "@/lib/seo/normalize-url";
import { findTrackedKeywordForUrl } from "@/lib/rank/find-tracked-keyword";

// Sin coste de API (solo descarga la página y la analiza), pero cada análisis
// hace una petición saliente desde nuestro servidor: se limita por usuario.
const limiter = new RateLimiterMemory({ points: 30, duration: 600 });

// GET — historial de análisis del proyecto (los 40 últimos).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "analizador");
  if (gate) return gate;
  const { id } = await params;
  const project = await projectForSession(session, id, { id: true, domain: true });
  if (!project) return projectNotFound();

  const history = await prisma.urlAnalysis.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, url: true, keyword: true, score: true, createdAt: true },
  });
  return NextResponse.json({ domain: project.domain, history });
}

// POST { url, keyword? } — descarga la URL, la analiza y guarda el resultado.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "analizador");
  if (gate) return gate;
  const { id } = await params;
  const project = await projectForSession(session, id, { id: true });
  if (!project) return projectNotFound();

  try {
    await limiter.consume(session.user.id);
  } catch {
    return NextResponse.json({ error: "Has analizado muchas URLs seguidas. Espera unos minutos." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { url?: unknown; keyword?: unknown };
  let rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) return NextResponse.json({ error: "Escribe la URL que quieres analizar" }, { status: 400 });
  if (!/^https?:\/\//i.test(rawUrl)) rawUrl = `https://${rawUrl}`;
  if (rawUrl.length > 2000) return NextResponse.json({ error: "La URL es demasiado larga" }, { status: 400 });
  let keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 120) : "";

  let page;
  try {
    page = await safeFetchHtml(rawUrl);
  } catch (e) {
    if (e instanceof SafeFetchError) {
      return NextResponse.json({ error: e.message }, { status: e.code === "blocked" || e.code === "invalid_url" ? 400 : 502 });
    }
    return NextResponse.json({ error: "No se ha podido analizar esa URL" }, { status: 502 });
  }

  // Sin keyword escrita, se propone la que ya se sigue en Rank Tracking para
  // esta URL (si posiciona por alguna). Es solo una sugerencia visible.
  let keywordAuto = false;
  if (!keyword) {
    const tracked = await findTrackedKeywordForUrl(id, page.finalUrl).catch(() => null);
    if (tracked) {
      keyword = tracked.keyword;
      keywordAuto = true;
    }
  }

  const result: AnalysisResult = analyzeHtml({
    url: rawUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    loadMs: page.loadMs,
    redirects: page.redirects,
    html: page.body,
    headers: page.headers,
    keyword: keyword || null,
  });

  const storedUrl = normalizeUrl(page.finalUrl) ?? page.finalUrl;
  const previous = await prisma.urlAnalysis.findFirst({
    where: { projectId: id, url: storedUrl },
    orderBy: { createdAt: "desc" },
    select: { score: true, createdAt: true },
  });
  const saved = await prisma.urlAnalysis.create({
    data: { projectId: id, url: storedUrl, keyword: keyword || null, score: result.score, result: JSON.parse(JSON.stringify(result)) },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ id: saved.id, createdAt: saved.createdAt, result, keywordAuto, previous });
}
