"use client";

import { useEffect, useState } from "react";
import { ListChecks, Loader2, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import Pill from "@/components/app/Pill";
import type { TodoTemplateItem as Template } from "@/lib/tasks";

// Catálogo global de tareas preestablecidas (CRUD), común a toda la cuenta
// — accesible desde el selector "Desde plantilla" del módulo
// Tareas de cada proyecto (modal "Gestionar plantillas"), desde donde también
// se aplican a un proyecto concreto.

const INPUT =
  "w-full border border-line rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors";

export default function TodoTemplatesCard() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Formulario de creación
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("media");
  const [creating, setCreating] = useState(false);

  // Edición inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPriority, setEditPriority] = useState("media");

  function load() {
    return fetch("/api/tareas-plantillas")
      .then((r) => r.json())
      .then((d: Template[]) => {
        if (Array.isArray(d)) setTemplates(d);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/tareas-plantillas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, detail, category, priority }),
    });
    setCreating(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Error al crear");
      return;
    }
    setTitle("");
    setDetail("");
    setCategory("");
    setPriority("media");
    load();
  }

  function startEdit(t: Template) {
    setEditId(t.id);
    setEditTitle(t.title);
    setEditDetail(t.detail ?? "");
    setEditCategory(t.category ?? "");
    setEditPriority(t.priority);
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/tareas-plantillas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        detail: editDetail,
        category: editCategory,
        priority: editPriority,
      }),
    });
    if (res.ok) {
      setEditId(null);
      load();
    }
  }

  async function remove(id: string) {
    await fetch(`/api/tareas-plantillas/${id}`, { method: "DELETE" });
    load();
  }

  const groups = Array.from(new Set(templates.map((t) => t.category ?? "Sin categoría")));

  return (
    <div className="bg-white rounded-2xl border border-line shadow-[0_1px_2px_rgba(26,29,26,0.05),0_4px_16px_-6px_rgba(26,29,26,0.10)] p-5 space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-gray-500">
          <ListChecks className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Plantillas de tareas</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Tareas preestablecidas (p.ej. &ldquo;Revisar robots.txt&rdquo;) que aplicar a los proyectos desde su
            pestaña Tareas. Comunes a toda tu cuenta.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-3 bg-background p-4 rounded-xl">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">Título *</label>
          <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Revisar robots.txt" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">Detalle (opcional)</label>
          <input className={INPUT} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Qué hay que hacer exactamente" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Categoría</label>
          <input className={INPUT} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Técnico, Contenido…" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Prioridad</label>
          <select className={INPUT} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={creating || !title.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand-strong transition-colors disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Guardar plantilla
          </button>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      </form>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : templates.length === 0 ? (
        <div className="py-12 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background text-gray-400">
            <ListChecks className="h-5 w-5" />
          </span>
          <p className="text-sm text-gray-500">Todavía no has creado ninguna plantilla.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g} className="space-y-2">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">{g}</h3>
              <ul className="space-y-1.5">
                {templates
                  .filter((t) => (t.category ?? "Sin categoría") === g)
                  .map((t) => (
                    <li key={t.id} className="border border-line rounded-xl p-3 transition-colors hover:bg-background">
                      {editId === t.id ? (
                        <div className="space-y-2">
                          <input className={INPUT} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                          <input className={INPUT} value={editDetail} onChange={(e) => setEditDetail(e.target.value)} placeholder="Detalle" />
                          <div className="flex gap-2">
                            <input className={cn(INPUT, "flex-1")} value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="Categoría" />
                            <select className={INPUT} value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                              <option value="alta">Alta</option>
                              <option value="media">Media</option>
                              <option value="baja">Baja</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(t.id)} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand-strong transition-colors">
                              <Check className="h-3.5 w-3.5" /> Guardar
                            </button>
                            <button onClick={() => setEditId(null)} className="inline-flex items-center gap-1 px-2.5 py-1 text-gray-500 text-xs hover:text-gray-900">
                              <X className="h-3.5 w-3.5" /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">{t.title}</span>
                              <Pill tone={t.priority === "alta" ? "danger" : t.priority === "baja" ? "neutral" : "warning"}>
                                {t.priority}
                              </Pill>
                            </div>
                            {t.detail && <p className="text-xs text-gray-500 mt-0.5">{t.detail}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => startEdit(t)} className="p-1 text-gray-300 hover:text-gray-900" title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => remove(t.id)} className="p-1 text-gray-300 hover:text-red-600" title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
