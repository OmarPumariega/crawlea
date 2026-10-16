"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, Calendar, AlertCircle, CheckCircle2, ListChecks, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Modal from "@/components/app/Modal";
import UrlLink from "@/components/app/UrlLink";
import TodoTemplatesCard from "@/components/app/TodoTemplatesCard";
import { ISSUE_META } from "@/lib/audit/issue-meta";
import { splitManualTask, type TodoTemplateItem } from "@/lib/tasks";

type Todo = {
  id: string;
  text: string;
  title: string | null;
  detail: string | null;
  priority: string;
  done: boolean;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  issueType: string | null;
  affectedUrls: string[];
};

// Prioridades: etiqueta + clases de color para la pastilla (tarjeta) y para
// el botón activo del formulario. baja=verde, media=ámbar, alta=rojo.
type Priority = "baja" | "media" | "alta";
const PRIORITY_META: Record<Priority, { label: string; badge: string; button: string; dot: string }> = {
  baja: { label: "Baja", badge: "bg-accent-tint text-accent-ink", button: "Baja", dot: "bg-brand-500" },
  media: { label: "Media", badge: "bg-accent-tint text-accent-ink", button: "Media", dot: "bg-brand-300" },
  alta: { label: "Alta", badge: "bg-alert-tint text-alert-ink", button: "Alta", dot: "bg-alert" },
};
const PRIORITY_ORDER: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };
function priorityRank(p: string): number {
  return p in PRIORITY_ORDER ? PRIORITY_ORDER[p as Priority] : 1;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Filtro de fecha de la lista — "Todas" no toca nada; el resto acota por
// mes/año. Se aplica a createdAt en Pendientes (cuándo se creó/detectó) y a
// completedAt en Completadas (cuándo se resolvió) — cada pestaña usa el
// campo que tiene sentido para ella.
type DateFilter = "all" | "this-month" | "last-month" | `year:${number}`;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

// Años reales presentes en los datos (createdAt + completedAt de todas las
// tareas) — nunca hardcodeados, así sigue funcionando sin tocar código
// pase el tiempo que pase.
function availableYears(todos: Todo[]): number[] {
  const years = new Set<number>();
  for (const t of todos) {
    years.add(new Date(t.createdAt).getFullYear());
    if (t.completedAt) years.add(new Date(t.completedAt).getFullYear());
  }
  return Array.from(years).sort((a, b) => b - a);
}

// Tarea auto-generada desde un hallazgo de auditoría (issueType no null) —
// misma idea visual que "Problemas a corregir" en Auditoría: título +
// contador, colapsable, con el "cómo arreglarlo" y la lista de páginas
// completas y clicables (nunca texto plano recortado a 5 ejemplos).
function AutoTaskCard({
  todo,
  busy,
  onToggleDone,
  onDelete,
}: {
  todo: Todo;
  busy: boolean;
  onToggleDone: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = todo.issueType ? ISSUE_META[todo.issueType] : undefined;
  if (!meta) return null;

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={todo.done}
          onChange={onToggleDone}
          disabled={busy}
          title={todo.done ? "Marcar como pendiente" : "Marcar como resuelta"}
          className="h-4 w-4 rounded-md border-line text-brand accent-[#4f5cf5] focus:ring-2 focus:ring-brand/25 shrink-0"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <span
            className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full shrink-0",
              todo.done ? "bg-brand-100 text-accent-ink" : "bg-brand-100 text-brand-700"
            )}
          >
            {todo.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          </span>
          <span className={cn("text-sm font-medium truncate", todo.done ? "text-ink-faint line-through" : "text-ink")}>
            {meta.label}
          </span>
          <Pill tone="neutral" className="shrink-0">
            {todo.affectedUrls.length} {todo.affectedUrls.length === 1 ? "página" : "páginas"}
          </Pill>
          <span className="flex-1" />
          {open ? (
            <ChevronUp className="h-4 w-4 text-ink-faint shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-ink-faint shrink-0" />
          )}
        </button>
        <button
          onClick={onDelete}
          disabled={busy}
          className="p-1 text-ink-faint hover:text-alert-ink disabled:opacity-50 shrink-0"
          title="Eliminar tarea"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-line pt-3 space-y-3">
          <p className="text-sm text-ink-soft">{meta.description}</p>
          <div className="bg-accent-tint border border-brand-100 text-accent-ink text-sm px-3 py-2 rounded-xl">
            <span className="font-medium">Cómo arreglarlo: </span>
            {meta.fix}
          </div>
          {todo.affectedUrls.length > 0 && (
            <ul className="space-y-1">
              {todo.affectedUrls.map((u) => (
                <li key={u}>
                  <UrlLink url={u} className="text-xs" />
                </li>
              ))}
            </ul>
          )}
          <p className="font-mono text-[11px] text-ink-faint">
            Detectado el {new Date(todo.createdAt).toLocaleDateString("es-ES")}
            {todo.done && todo.completedAt
              ? ` · resuelta o superada por una auditoría más reciente el ${new Date(todo.completedAt).toLocaleDateString("es-ES")}`
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function ManualTaskCard({
  todo,
  overdue,
  busy,
  onToggleDone,
  onDelete,
}: {
  todo: Todo;
  overdue: boolean;
  busy: boolean;
  onToggleDone: () => void;
  onDelete: () => void;
}) {
  // Backward compat: tareas legacy sin title/detail se separan de text por
  // saltos de línea (splitManualTask). Las nuevas ya traen title/detail.
  const legacy = todo.title === null ? splitManualTask(todo.text) : null;
  const title = todo.title ?? legacy?.title ?? todo.text;
  const detail = todo.detail ?? legacy?.detail ?? "";
  const prioMeta = PRIORITY_META[todo.priority as Priority] ?? PRIORITY_META.media;

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={todo.done}
          onChange={onToggleDone}
          disabled={busy}
          title={todo.done ? "Marcar como pendiente" : "Marcar como completada"}
          className="h-4 w-4 rounded-md border-line text-brand accent-[#4f5cf5] focus:ring-2 focus:ring-brand/25 shrink-0"
        />
        <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <span
            className={cn("h-2 w-2 rounded-full shrink-0", prioMeta.dot)}
            title={prioMeta.label}
          />
          <span className={cn("text-sm truncate", todo.done ? "text-ink-faint line-through" : "text-ink")}>
            {title}
          </span>
          {todo.dueDate && (
            <Pill tone={overdue ? "danger" : "neutral"} className="shrink-0">
              {overdue ? "vencida " : "vence "}
              {new Date(todo.dueDate).toLocaleDateString("es-ES")}
            </Pill>
          )}
        </div>
        <button
          onClick={onDelete}
          disabled={busy}
          className="p-1 text-ink-faint hover:text-alert-ink disabled:opacity-50 shrink-0"
          title="Eliminar tarea"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>

      {detail && (
        <div className="px-4 pb-4 border-t border-line pt-3 space-y-2">
          <p className={cn("text-sm whitespace-pre-line", todo.done ? "text-ink-faint" : "text-ink-soft")}>
            {detail}
          </p>
          <p className="font-mono text-[11px] text-ink-faint">
            Creada el {new Date(todo.createdAt).toLocaleDateString("es-ES")}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TareasView({ projectId }: { projectId: string }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [dueDate, setDueDate] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pendientes" | "completadas">("pendientes");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // Añadir tarea: dos modos dentro de la misma tarjeta — manual (título/
  // detalle/prioridad/fecha) o desde el catálogo de plantillas.
  const [addMode, setAddMode] = useState<"manual" | "template">("manual");
  const [templates, setTemplates] = useState<TodoTemplateItem[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [selectedTpls, setSelectedTpls] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  // Gestión del catálogo (crear/editar/borrar plantillas) — modal aparte,
  // accesible desde el modo "Desde plantilla", no una sección propia.
  const [manageOpen, setManageOpen] = useState(false);

  function loadTemplates() {
    setTplLoading(true);
    fetch("/api/tareas-plantillas")
      .then((r) => r.json())
      .then((d: TodoTemplateItem[]) => {
        if (Array.isArray(d)) setTemplates(d);
      })
      .finally(() => setTplLoading(false));
  }

  function selectTemplateMode() {
    setAddMode("template");
    if (templates.length === 0) loadTemplates();
  }

  function toggleTpl(id: string) {
    setSelectedTpls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyTemplates() {
    if (selectedTpls.size === 0) return;
    setApplying(true);
    const res = await fetch(`/api/proyectos/${projectId}/todos/from-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateIds: Array.from(selectedTpls) }),
    });
    setApplying(false);
    if (res.ok) {
      setSelectedTpls(new Set());
      setAddMode("manual");
      loadTodos();
    }
  }

  function loadTodos() {
    return fetch(`/api/proyectos/${projectId}/todos`)
      .then((r) => r.json())
      .then((d: Todo[] | { error: string }) => {
        if (Array.isArray(d)) setTodos(d);
      });
  }

  useEffect(() => {
    loadTodos().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const trimmedDetail = detail.trim();
    setCreating(true);
    const res = await fetch(`/api/proyectos/${projectId}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: trimmedTitle,
        detail: trimmedDetail || undefined,
        priority,
        dueDate: dueDate || undefined,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error ?? "Error al crear la tarea");
      return;
    }
    setTitle("");
    setDetail("");
    setPriority("media");
    setDueDate("");
    setShowDate(false);
    loadTodos();
  }

  async function toggleDone(todo: Todo) {
    setBusyId(todo.id);
    const res = await fetch(`/api/proyectos/${projectId}/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !todo.done }),
    });
    setBusyId(null);
    if (res.ok) loadTodos();
  }

  async function handleDelete(todoId: string) {
    setBusyId(todoId);
    const res = await fetch(`/api/proyectos/${projectId}/todos/${todoId}`, {
      method: "DELETE",
    });
    setBusyId(null);
    setConfirmDeleteId(null);
    if (res.ok) loadTodos();
  }

  const today = startOfToday();
  const pendingCount = todos.filter((t) => !t.done).length;
  const completedCount = todos.filter((t) => t.done).length;
  const tabTodosUnfiltered = todos.filter((t) => (tab === "pendientes" ? !t.done : t.done));

  const now = new Date();
  const thisMonthKey = monthKey(now);
  const lastMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  function matchesDateFilter(todo: Todo): boolean {
    if (dateFilter === "all") return true;
    const raw = tab === "completadas" ? todo.completedAt : todo.createdAt;
    if (!raw) return false;
    const d = new Date(raw);
    if (dateFilter === "this-month") return monthKey(d) === thisMonthKey;
    if (dateFilter === "last-month") return monthKey(d) === lastMonthKey;
    return d.getFullYear() === Number(dateFilter.slice(5));
  }
  const tabTodos = tabTodosUnfiltered.filter(matchesDateFilter);
  const autoTodos = tabTodos.filter((t) => t.issueType !== null);
  // Pendientes manuales ordenadas por prioridad (alta → media → baja); las
  // completadas respetan el orden del servidor (createdAt desc).
  const manualTodos = tabTodos
    .filter((t) => t.issueType === null)
    .sort((a, b) => {
      if (tab !== "pendientes") return 0;
      return priorityRank(a.priority) - priorityRank(b.priority);
    });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Proyecto · Tareas"
        title="Tareas"
        description="Lista de seguimiento del proyecto — manuales y auto-generadas desde hallazgos de auditoría. Marca, completa o elimina para tener siempre a la vista lo pendiente."
      />

      {/* Añadir tarea: un único card con dos modos (manual / desde plantilla) */}
      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
        <div className="inline-flex items-center gap-1 bg-black/[0.05] rounded-xl p-1">
          <button
            type="button"
            onClick={() => setAddMode("manual")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              addMode === "manual"
                ? "bg-surface text-ink shadow-[0_1px_3px_rgba(17,20,43,0.12)]"
                : "text-ink-soft hover:text-ink"
            )}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={selectTemplateMode}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              addMode === "template"
                ? "bg-surface text-ink shadow-[0_1px_3px_rgba(17,20,43,0.12)]"
                : "text-ink-soft hover:text-ink"
            )}
          >
            Desde plantilla
          </button>
        </div>

        {addMode === "manual" ? (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="block text-sm font-medium text-ink-soft">Título de la tarea</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Revisar títulos de la home"
                  className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand-strong transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Añadir tarea
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink-soft">Detalle (opcional)</label>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Notas, contexto o pasos adicionales"
                className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors resize-y"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink-soft">Prioridad</label>
              <div className="flex items-center gap-2">
                {(["baja", "media", "alta"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors",
                      priority === p
                        ? cn(PRIORITY_META[p].badge, "border-transparent font-medium")
                        : "border-line text-ink-soft hover:text-ink hover:bg-background"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", PRIORITY_META[p].dot)} />
                    {PRIORITY_META[p].button}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDate((v) => !v)}
              className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDate && "rotate-180")} />
              Fecha de vencimiento (opcional)
            </button>
            {showDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-ink-faint" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                />
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate("")}
                    className="text-xs text-ink-faint hover:text-ink"
                  >
                    Quitar fecha
                  </button>
                )}
              </div>
            )}

            {error && <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-xl">{error}</p>}
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-ink-soft">Selecciona tareas del catálogo para añadirlas a este proyecto.</p>
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink shrink-0"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Gestionar plantillas →
              </button>
            </div>
            {tplLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
            ) : templates.length === 0 ? (
              <p className="text-sm text-ink-soft">
                No hay plantillas creadas todavía —{" "}
                <button type="button" onClick={() => setManageOpen(true)} className="underline hover:text-ink">
                  crea la primera
                </button>
                .
              </p>
            ) : (
              <ul className="space-y-1.5">
                {templates.map((t) => (
                  <li key={t.id}>
                    <label className="flex items-start gap-2 text-sm cursor-pointer p-2 rounded-xl hover:bg-background transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedTpls.has(t.id)}
                        onChange={() => toggleTpl(t.id)}
                        className="h-4 w-4 mt-0.5 rounded-md border-line text-brand accent-[#4f5cf5]"
                      />
                      <span className="min-w-0">
                        <span className="text-ink font-medium">{t.title}</span>
                        {t.category && <span className="text-xs text-ink-faint ml-1">· {t.category}</span>}
                        {t.detail && <span className="block text-xs text-ink-soft">{t.detail}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {templates.length > 0 && (
              <button
                type="button"
                onClick={applyTemplates}
                disabled={applying || selectedTpls.size === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand-strong transition-colors disabled:opacity-50"
              >
                {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Añadir {selectedTpls.size > 0 ? `(${selectedTpls.size})` : ""}
              </button>
            )}
          </div>
        )}
      </div>

      <Modal open={manageOpen} title="Catálogo de plantillas" onClose={() => { setManageOpen(false); loadTemplates(); }}>
        <TodoTemplatesCard />
      </Modal>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 bg-black/[0.05] rounded-xl p-1">
          <button
            onClick={() => setTab("pendientes")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === "pendientes"
                ? "bg-surface text-ink shadow-[0_1px_3px_rgba(17,20,43,0.12)]"
                : "text-ink-soft hover:text-ink"
            )}
          >
            Pendientes <span className="tabular-nums">({pendingCount})</span>
          </button>
          <button
            onClick={() => setTab("completadas")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === "completadas"
                ? "bg-surface text-ink shadow-[0_1px_3px_rgba(17,20,43,0.12)]"
                : "text-ink-soft hover:text-ink"
            )}
          >
            Completadas <span className="tabular-nums">({completedCount})</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {dateFilter !== "all" && (
            <span className="text-xs text-ink-faint tabular-nums">
              {tabTodos.length} de {tabTodosUnfiltered.length}
            </span>
          )}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="border border-line rounded-xl px-2.5 py-1.5 text-xs bg-surface text-ink-soft outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
          >
            <option value="all">Todas las fechas</option>
            <option value="this-month">Este mes</option>
            <option value="last-month">Mes anterior</option>
            {availableYears(todos).map((y) => (
              <option key={y} value={`year:${y}`}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
      ) : tabTodos.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)]">
          <div className="py-12 text-center">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background text-ink-faint">
              {tab === "pendientes" ? <CheckCircle2 className="h-5 w-5" /> : <ListChecks className="h-5 w-5" />}
            </span>
            <p className="text-sm text-ink-soft">
              {tab === "pendientes"
                ? "Sin tareas pendientes — todo al día."
                : "Todavía no se ha completado ninguna tarea."}
            </p>
          </div>
        </div>
      ) : (
        <>
          {autoTodos.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                Hallazgos de auditoría ({autoTodos.length})
              </h3>
              <div className="space-y-2">
                {autoTodos.map((todo) => (
                  <AutoTaskCard
                    key={todo.id}
                    todo={todo}
                    busy={busyId === todo.id}
                    onToggleDone={() => toggleDone(todo)}
                    onDelete={() => setConfirmDeleteId(todo.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {manualTodos.length > 0 && (
            <div className="space-y-2">
              {autoTodos.length > 0 && (
                <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Tareas manuales</h3>
              )}
              <div className="space-y-2">
                {manualTodos.map((todo) => {
                  const overdue = !todo.done && todo.dueDate !== null && new Date(todo.dueDate) < today;
                  return (
                    <ManualTaskCard
                      key={todo.id}
                      todo={todo}
                      overdue={overdue}
                      busy={busyId === todo.id}
                      onToggleDone={() => toggleDone(todo)}
                      onDelete={() => setConfirmDeleteId(todo.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="¿Eliminar esta tarea?"
        description="No se puede deshacer."
        busy={busyId === confirmDeleteId}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
      />
    </div>
  );
}
