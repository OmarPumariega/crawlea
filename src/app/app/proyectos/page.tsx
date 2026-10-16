"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, ArrowRight, Globe, MapPin, FolderKanban } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";

type Project = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  isLocalBusiness: boolean;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/proyectos")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cartera · Proyectos"
        title="Proyectos"
        description="Cada dominio en el que trabajas es un proyecto."
        actions={
          <Link
            href="/app/proyectos/nuevo"
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand-strong transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo proyecto
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line py-12 text-center shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)]">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background text-ink-faint">
            <FolderKanban className="h-5 w-5" />
          </div>
          <p className="text-sm text-ink-soft">Todavía no hay proyectos. Crea el primero.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/app/proyectos/${p.id}`}
              className="group flex items-center gap-4 bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-4 hover:border-brand/40 hover:shadow-[0_6px_20px_rgba(17,20,43,0.07)] transition-all"
            >
              {/* Monograma del proyecto: inicial sobre verde de marca */}
              <div className="h-11 w-11 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-base font-semibold text-brand">
                  {p.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink truncate">{p.name}</div>
                <div className="flex items-center gap-1 text-xs text-ink-faint truncate">
                  <Globe className="h-3 w-3 shrink-0" />
                  {p.domain ?? p.slug}
                </div>
              </div>
              {p.isLocalBusiness && (
                <Pill tone="info" className="shrink-0">
                  <MapPin className="h-3 w-3" />
                  Local
                </Pill>
              )}
              <ArrowRight className="h-4 w-4 text-ink-faint shrink-0 group-hover:translate-x-0.5 group-hover:text-brand transition-all" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
