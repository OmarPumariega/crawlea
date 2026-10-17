"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import ProjectForm, { type ProjectFormValues } from "@/components/app/ProjectForm";
import GoogleConnectBanner from "@/components/app/GoogleConnectBanner";
import BootstrapPanel from "@/components/app/BootstrapPanel";
import PageHeader from "@/components/app/PageHeader";
import StatTile from "@/components/ui/StatTile";
import Link from "next/link";

type ProjectRecord = ProjectFormValues & { id: string };

type ProjectSummary = {
  auditScore: number | null;
  auditDate: string | null;
  rankCount: number;
  studyCount: number;
  competitorCount: number;
  openTasks: number;
};

export default function ProjectEditView({
  project,
  summary,
  google,
}: {
  project: ProjectRecord;
  summary: ProjectSummary;
  google: { email: string | null; gscSelected: boolean; ga4Selected: boolean };
}) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleSubmit(values: ProjectFormValues) {
    const res = await fetch(`/api/proyectos/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Solo nombre y dominio: la ficha de Google (y lo que aporta) se guarda por
      // su cuenta al elegirla o quitarla, y un PATCH parcial no toca el resto.
      body: JSON.stringify({ name: values.name, domain: values.domain }),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Error al guardar el proyecto";
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/proyectos/${project.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error ?? "Error al eliminar el proyecto");
      return;
    }
    router.push("/app/proyectos");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ficha · Datos"
        title={project.name}
        description={project.domain || "Sin dominio configurado"}
        actions={
          <button
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-faint hover:bg-alert-tint hover:text-alert-ink"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar proyecto
          </button>
        }
      />

      <GoogleConnectBanner projectId={project.id} email={google.email} gscSelected={google.gscSelected} ga4Selected={google.ga4Selected} />

      {/* Estado del proyecto de un vistazo; cada tarjeta lleva a su módulo */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href={`/app/proyectos/${project.id}/auditoria`} className="block">
          <StatTile
            highlight
            label="Nota de la auditoría"
            value={summary.auditScore != null ? <>{summary.auditScore}<span className="text-xl font-bold text-white/60">/100</span></> : "—"}
            hint={summary.auditDate ? `del ${new Date(summary.auditDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}` : "aún sin auditar"}
          />
        </Link>
        <Link href={`/app/proyectos/${project.id}/rank`} className="block">
          <StatTile label="Keywords en seguimiento" value={summary.rankCount} hint="en Rank Tracking" />
        </Link>
        <Link href={`/app/proyectos/${project.id}/keywords`} className="block">
          <StatTile label="Keywords investigadas" value={summary.studyCount.toLocaleString("es-ES")} hint="en tus estudios" />
        </Link>
        <Link href={`/app/proyectos/${project.id}/tareas`} className="block">
          <StatTile label="Tareas pendientes" value={summary.openTasks} hint={`${summary.competitorCount} competidores seguidos`} />
        </Link>
      </div>

      {/* Solo aparece cuando hay algo por poner en marcha (keywords por importar o
          competidores sin analizar); si todo está al día, no ocupa sitio. */}
      <BootstrapPanel projectId={project.id} />

      <ProjectForm
        initial={project}
        showSlug={false}
        projectId={project.id}
        submitLabel="Guardar cambios"
        onSubmit={handleSubmit}
      />

      {confirmingDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-alert-tint flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-alert-ink" />
              </div>
              <div>
                <h3 className="font-semibold text-ink">Eliminar proyecto</h3>
                <p className="text-sm text-ink-soft mt-1">
                  Vas a eliminar <strong className="text-ink">{project.name}</strong>. Esta
                  acción <strong className="text-alert-ink">no se puede deshacer</strong>.
                </p>
              </div>
            </div>
            {deleteError && (
              <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-lg mt-4">{deleteError}</p>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setConfirmingDelete(false);
                  setDeleteError("");
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm text-ink-soft border border-line rounded-xl hover:bg-background disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-alert rounded-lg hover:bg-alert disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
