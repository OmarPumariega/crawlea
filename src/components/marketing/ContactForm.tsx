"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function ContactForm({ topic }: { topic?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [web, setWeb] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("sending");
    try {
      const res = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, web, topic }),
      });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      setError((await res.json().catch(() => null))?.error ?? "No hemos podido enviar el mensaje.");
    } catch {
      setError("No hemos podido enviar el mensaje. Revisa tu conexión e inténtalo de nuevo.");
    }
    setStatus("idle");
  }

  if (status === "sent") {
    return (
      <div className="rounded-[20px] border border-line bg-surface p-6" role="status">
        <p className="font-bold text-ink">Mensaje enviado.</p>
        <p className="mt-1 text-sm text-ink-soft">Te respondemos al email que nos has dejado.</p>
      </div>
    );
  }

  const field =
    "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-[20px] border border-line bg-surface p-6">
      <div>
        <label htmlFor="c-name" className="mb-1.5 block text-sm font-medium text-ink">Nombre</label>
        <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" className={field} />
      </div>
      <div>
        <label htmlFor="c-email" className="mb-1.5 block text-sm font-medium text-ink">Email</label>
        <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} autoComplete="email" className={field} />
      </div>
      <div>
        <label htmlFor="c-msg" className="mb-1.5 block text-sm font-medium text-ink">Mensaje</label>
        <textarea id="c-msg" value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} maxLength={3000} rows={6} className={field} />
      </div>
      {/* Honeypot: oculto a personas y a lectores de pantalla. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="c-web">No rellenes este campo</label>
        <input id="c-web" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
      </div>
      {error && <p className="rounded-2xl bg-alert-tint px-4 py-2.5 text-sm text-alert-ink" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
      >
        {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
        Envía el mensaje
      </button>
    </form>
  );
}
