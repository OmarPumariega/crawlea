import { NextRequest, NextResponse } from "next/server";
import { analyzeIpLimiter, getClientIp } from "@/lib/rate-limit";
import { quickCheck, QuickCheckError } from "@/lib/analyzer/quick-check";

// Analizador público de la home (sin sesión). Devuelve solo el resumen
// (recuentos reales); el detalle de los problemas se ve dentro de la herramienta,
// tras crear la cuenta. Es una revisión rápida real de la home, sin coste de API.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url : "";

  try {
    await analyzeIpLimiter.consume(getClientIp(req.headers));
  } catch {
    return NextResponse.json({ error: "Has hecho varios análisis seguidos. Inténtalo de nuevo en unos minutos." }, { status: 429 });
  }

  try {
    const r = await quickCheck(url);
    const count = (s: string) => r.issues.filter((i) => i.severity === s).length;
    return NextResponse.json({
      domain: r.domain,
      issuesCount: r.issues.length,
      passedCount: r.passed.length,
      bySeverity: { alto: count("alto"), medio: count("medio"), bajo: count("bajo") },
    });
  } catch (e) {
    if (e instanceof QuickCheckError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("[analizar-web]", e);
    return NextResponse.json({ error: "No hemos podido analizar esa web. Inténtalo de nuevo en unos minutos." }, { status: 500 });
  }
}
