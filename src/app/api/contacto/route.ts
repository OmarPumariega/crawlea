import { NextRequest, NextResponse } from "next/server";
import { contactIpLimiter, getClientIp } from "@/lib/rate-limit";
import { sendEmail, isEmailConfigured } from "@/lib/notifications/email";

// Formulario público de contacto (sin sesión). Defensas: honeypot, límites de
// longitud y rate limit por IP. El mensaje llega por el SMTP ya configurado a
// ALERT_TO, con el email de quien escribe como reply-to.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }

  // Honeypot: un bot rellena el campo oculto. Respondemos ok sin enviar nada.
  if (typeof body.web === "string" && body.web.trim() !== "") return NextResponse.json({ ok: true });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 60) : "";

  if (!name || name.length > 100) return NextResponse.json({ error: "Escribe tu nombre." }, { status: 400 });
  if (!EMAIL_RE.test(email) || email.length > 200) return NextResponse.json({ error: "Escribe un email válido." }, { status: 400 });
  if (message.length < 10 || message.length > 3000) {
    return NextResponse.json({ error: "El mensaje debe tener entre 10 y 3.000 caracteres." }, { status: 400 });
  }

  try {
    await contactIpLimiter.consume(getClientIp(req.headers));
  } catch {
    return NextResponse.json({ error: "Has enviado varios mensajes seguidos. Inténtalo más tarde." }, { status: 429 });
  }

  if (!(await isEmailConfigured())) {
    return NextResponse.json({ error: "Ahora mismo no podemos recibir mensajes. Inténtalo más tarde." }, { status: 503 });
  }

  const ok = await sendEmail({
    replyTo: email,
    subject: `Contacto web${topic ? ` (${topic})` : ""}: ${name}`,
    text: `${message}\n\n—\n${name} <${email}>`,
  });
  if (!ok) return NextResponse.json({ error: "No hemos podido enviar el mensaje. Inténtalo de nuevo en unos minutos." }, { status: 502 });

  return NextResponse.json({ ok: true });
}
