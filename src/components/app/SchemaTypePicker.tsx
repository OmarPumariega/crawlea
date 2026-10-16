"use client";

import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Pill from "@/components/app/Pill";
import {
  SCHEMA_CATALOG,
  SCHEMA_CATEGORIES,
  getCatalogEntry,
  type CatalogEntry,
} from "@/lib/seo/schema/catalog";

// Combobox buscador de tipos de schema.org, agrupado por categoría. Reemplaza
// al <Select> fijo de 3 opciones. El catálogo se importa directamente (datos
// puros, sin código de servidor) para que el filtrado sea instantáneo en cliente.

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchQuery(entry: CatalogEntry, q: string): boolean {
  const hay = stripAccents(
    `${entry.type} ${entry.label} ${entry.description} ${entry.category}`.toLowerCase()
  );
  return hay.includes(q);
}

export default function SchemaTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (type: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = getCatalogEntry(value) ?? null;
  const q = stripAccents(query.trim().toLowerCase());

  const grouped = useMemo(() => {
    return SCHEMA_CATEGORIES.map((cat) => ({
      category: cat,
      entries: SCHEMA_CATALOG.filter((e) => e.category === cat && (q ? matchQuery(e, q) : true)),
    })).filter((g) => g.entries.length > 0);
  }, [q]);

  const totalShown = grouped.reduce((n, g) => n + g.entries.length, 0);

  function pick(type: string) {
    onChange(type);
    setOpen(false);
    setQuery("");
  }

  return (
    <div>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors hover:bg-background"
          >
            <span className={cn("truncate text-left", current ? "text-ink" : "text-ink-faint")}>
              {current ? current.label : "Selecciona un tipo…"}
            </span>
            <ChevronDown className="h-4 w-4 text-ink-faint shrink-0" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 bg-surface border border-line rounded-xl shadow-lg flex flex-col max-h-96 w-[var(--radix-popover-trigger-width)]"
          >
            <div className="p-2 border-b border-line">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background">
                <Search className="h-3.5 w-3.5 text-ink-faint shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar tipo (artículo, producto, receta…)"
                  className="bg-transparent text-sm outline-none flex-1 min-w-0"
                />
              </div>
            </div>

            <div className="overflow-y-auto py-1">
              {grouped.map((g) => (
                <div key={g.category}>
                  <p className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                    {g.category}
                  </p>
                  {g.entries.map((e) => (
                    <Row key={e.type} entry={e} active={e.type === value} onClick={() => pick(e.type)} />
                  ))}
                </div>
              ))}
              {totalShown === 0 && (
                <p className="px-3 py-3 text-sm text-ink-faint">Sin resultados.</p>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function Row({
  entry,
  active,
  onClick,
}: {
  entry: CatalogEntry;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-background transition-colors",
        active ? "bg-brand/5" : ""
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm truncate", active ? "text-ink font-medium" : "text-ink-soft")}>
            {entry.label}
          </span>
          {entry.generator === "deterministic" && (
            <Pill tone="success" className="px-1.5 py-0 text-[10px] shrink-0">
              sin IA
            </Pill>
          )}
        </div>
        <p className="text-xs text-ink-faint leading-snug truncate">{entry.description}</p>
      </div>
      {active && <Check className="h-3.5 w-3.5 text-brand shrink-0 mt-1" />}
    </button>
  );
}
