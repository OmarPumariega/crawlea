import { MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { serpFeatureLabel, interestingSerpFeatures } from "@/lib/serp/features";
import type { SerpPanorama } from "@/lib/serp/panorama";

// Panorama del SERP de una keyword en un chequeo: qué bloques hay (AI Overview,
// pack local, snippet destacado, vídeos…), quién ocupa el mapa y el snippet y
// cómo se ve tu resultado. Dato del mismo SERP que ya se paga para medir la
// posición. `previous` (el chequeo anterior) permite avisar de bloques nuevos.
export default function SerpPanoramaCard({ serp, previous }: { serp: SerpPanorama | null | undefined; previous?: SerpPanorama | null }) {
  if (!serp) {
    return <p className="text-xs text-ink-faint">Este chequeo no guardó el panorama del SERP; se registra desde la próxima comprobación.</p>;
  }
  const features = interestingSerpFeatures(serp.features);
  const appeared = previous ? features.filter((f) => !previous.features.includes(f)) : [];
  const gone = previous ? interestingSerpFeatures(previous.features).filter((f) => !serp.features.includes(f)) : [];
  const own = serp.own;
  const ownBits: string[] = [];
  if (own) {
    if (own.sitelinks > 0) ownBits.push(`${own.sitelinks} sitelinks`);
    if (own.rating?.value != null) ownBits.push(`★ ${own.rating.value}${own.rating.votes != null ? ` (${own.rating.votes})` : ""}`);
    if (own.faq) ownBits.push("FAQ");
    if (own.price) ownBits.push("precio");
    if (own.isVideo) ownBits.push("vídeo");
    if (own.isFeatured) ownBits.push("snippet destacado");
    if (own.breadcrumb) ownBits.push(`miga: ${own.breadcrumb}`);
  }
  return (
    <div className="space-y-2 rounded-xl border border-line bg-background p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-ink-soft">Panorama del SERP</span>
        {serp.resultsCount != null && <span className="text-ink-faint">· ~{serp.resultsCount.toLocaleString("es-ES")} resultados</span>}
        {features.length === 0 && <span className="text-ink-faint">· solo resultados orgánicos</span>}
      </div>
      {features.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {features.map((f) => {
            const key = f === "ai_overview" || f === "local_pack" || f === "featured_snippet";
            return (
              <span key={f} className={cn("rounded px-1.5 py-0.5", key ? "bg-brand-100 font-medium text-brand-700" : "bg-surface text-ink-soft")}>
                {serpFeatureLabel(f)}
              </span>
            );
          })}
        </div>
      )}
      {(appeared.length > 0 || gone.length > 0) && (
        <p className="text-ink-soft">
          {appeared.length > 0 && <>Nuevo desde el chequeo anterior: <strong className="text-ink">{appeared.map(serpFeatureLabel).join(", ")}</strong>. </>}
          {gone.length > 0 && <>Ya no aparece: {gone.map(serpFeatureLabel).join(", ")}.</>}
        </p>
      )}
      {serp.featuredSnippet && (
        <p className="text-ink-soft">
          Snippet destacado de <strong className="text-ink">{serp.featuredSnippet.domain ?? "otra web"}</strong>
          {serp.featuredSnippet.title ? ` — «${serp.featuredSnippet.title}»` : ""}
        </p>
      )}
      {serp.localPack.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 font-medium text-ink-soft"><MapPin className="h-3.5 w-3.5" /> Pack local: quién sale en el mapa</p>
          <ul className="space-y-0.5">
            {serp.localPack.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 text-ink-soft">
                <span className="tabular-nums text-ink-faint">{i + 1}.</span>
                <span className="font-medium text-ink">{b.title}</span>
                {b.rating != null && (
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="h-3 w-3 text-ink-faint" /> {b.rating}{b.votes != null ? ` (${b.votes})` : ""}
                  </span>
                )}
                {b.phone && <span>{b.phone}</span>}
                {b.isPaid && <span className="rounded bg-surface-muted px-1">anuncio</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {own !== undefined && (
        <p className="border-t border-line pt-2 text-ink-soft">
          {own === null ? (
            "Tu web no aparece entre los resultados orgánicos medidos."
          ) : ownBits.length > 0 ? (
            <>Tu resultado: <strong className="text-ink">{ownBits.join(" · ")}</strong></>
          ) : (
            "Tu resultado es el básico: sin sitelinks, estrellas ni FAQ."
          )}
        </p>
      )}
      {serp.peopleAlsoAsk > 0 && <p className="text-ink-faint">«La gente también pregunta»: {serp.peopleAlsoAsk} preguntas (se ven en TF-IDF).</p>}
    </div>
  );
}
