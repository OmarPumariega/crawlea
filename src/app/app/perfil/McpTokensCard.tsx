"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Plug, Trash2 } from "lucide-react";

type TokenRow = { id: string; name: string; prefix: string; lastUsedAt: string | null; createdAt: string };

// Cómo conectar el MCP en cada herramienta. Todas hablan el mismo protocolo
// (MCP por HTTP con token en cabecera); solo cambia dónde se escribe.
const CLIENTS: { id: string; label: string; where: string; build: (url: string, token: string) => string }[] = [
  {
    id: "claude",
    label: "Claude Code",
    where: "Pégalo en una terminal.",
    build: (url, t) => `claude mcp add --transport http crawlea ${url} --header "Authorization: Bearer ${t}"`,
  },
  {
    id: "codex",
    label: "Codex",
    where: "Añade esto a ~/.codex/config.toml y exporta la variable en tu terminal.",
    build: (url, t) =>
      `export CRAWLEA_TOKEN="${t}"\n\n# ~/.codex/config.toml\n[mcp_servers.crawlea]\nurl = "${url}"\nbearer_token_env_var = "CRAWLEA_TOKEN"`,
  },
  {
    id: "cursor",
    label: "Cursor",
    where: "Guárdalo en ~/.cursor/mcp.json (o en .cursor/mcp.json del proyecto).",
    build: (url, t) =>
      JSON.stringify({ mcpServers: { crawlea: { url, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    where: "Pégalo en una terminal.",
    build: (url, t) => `gemini mcp add --transport http --header "Authorization: Bearer ${t}" crawlea ${url}`,
  },
  {
    id: "vscode",
    label: "VS Code",
    where: "Guárdalo en .vscode/mcp.json (Copilot Chat → modo Agente).",
    build: (url, t) =>
      JSON.stringify({ servers: { crawlea: { type: "http", url, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
  },
  {
    id: "otros",
    label: "Otras",
    where:
      "Para cualquier cliente MCP con URL remota usa la URL y la cabecera Authorization. Si solo admite programas locales (stdio), usa este puente:",
    build: (url, t) => `URL:     ${url}\nCabecera: Authorization: Bearer ${t}\n\n# Cliente solo local (stdio):\nnpx -y mcp-remote ${url} --header "Authorization: Bearer ${t}"`,
  },
];

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "nunca";
}

// Conexión del MCP de Crawlea con Claude Code: crea y revoca tokens personales
// y enseña el comando exacto para conectarlos. El token real solo se ve una
// vez, justo al crearlo (en BD solo queda su hash).
export default function McpTokensCard({ initial }: { initial: TokenRow[] }) {
  const [tokens, setTokens] = useState(initial);
  const [name, setName] = useState("Claude Code");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "https://crawlea.com/api/mcp";
  const [clientId, setClientId] = useState("claude");
  const client = CLIENTS.find((c) => c.id === clientId) ?? CLIENTS[0];
  const command = client.build(endpoint, fresh ?? "TU_TOKEN");

  async function create() {
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/perfil/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "No se pudo crear el token");
        return;
      }
      setFresh(data.token);
      setTokens((t) => [{ id: data.id, name: data.name, prefix: data.prefix, lastUsedAt: null, createdAt: data.createdAt }, ...t]);
    } catch {
      setError("No se pudo crear el token");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/perfil/tokens?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setTokens((t) => t.filter((x) => x.id !== id));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* el usuario puede seleccionar el texto a mano */
    }
  }

  return (
    <section className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Plug className="h-5 w-5 text-brand mt-0.5" />
        <div>
          <h2 className="text-base font-semibold text-ink">Conectar con tu IA (MCP)</h2>
          <p className="text-sm text-ink-soft">
            Con un token personal, tu herramienta de IA (Claude Code, Codex, Cursor, Gemini CLI…) puede leer tus proyectos y lanzar estudios de keywords, rank tracking, geogrid o auditorías.
            El gasto sale de tus créditos igual que desde la web.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Nombre del token"
          className="flex-1 min-w-48 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
        <button
          onClick={create}
          disabled={creating || !name.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
        >
          {creating && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear token
        </button>
      </div>
      {error && <p className="text-sm text-alert-ink">{error}</p>}

      {fresh && (
        <div className="space-y-2 rounded-xl bg-accent-tint p-3">
          <p className="text-sm text-accent-ink font-medium">
            Copia la configuración ahora: el token no se volverá a mostrar.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CLIENTS.map((c) => (
              <button
                key={c.id}
                onClick={() => setClientId(c.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  c.id === clientId ? "bg-brand text-white" : "bg-surface text-ink-soft hover:text-ink"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-soft">{client.where}</p>
          <pre className="whitespace-pre-wrap break-all rounded-lg bg-surface p-3 text-xs text-ink">{command}</pre>
          <button onClick={copy} className="inline-flex items-center gap-2 text-sm text-accent-ink font-medium">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="divide-y divide-line">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{t.name}</p>
                <p className="text-xs text-ink-faint">
                  {t.prefix}… · creado {fmt(t.createdAt)} · último uso {fmt(t.lastUsedAt)}
                </p>
              </div>
              <button onClick={() => revoke(t.id)} aria-label={`Revocar ${t.name}`} className="text-ink-faint hover:text-alert-ink">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
