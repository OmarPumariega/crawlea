import Link from "next/link";
import { COMPANY, LEGAL_UPDATED_LABEL } from "@/lib/legal/company";

export type Block =
  | string
  | { list: string[] }
  | { table: { head: string[]; rows: string[][] } };
export type LegalSection = { heading: string; body: Block[] };

// Plantilla de las páginas legales: título, fecha, aviso de revisión si quedan
// huecos y secciones con párrafos, listas y tablas.
export default function LegalDoc({ title, intro, sections }: { title: string; intro?: string; sections: LegalSection[] }) {
  // El aviso desaparece solo cuando todos los datos del titular están rellenos.
  const hasPlaceholders = Object.values(COMPANY).some((v) => v.startsWith("["));
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 pt-28 sm:px-8">
      <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-faint">Última actualización: {LEGAL_UPDATED_LABEL}</p>
      {hasPlaceholders && (
        <p className="mt-5 rounded-2xl bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-soft">
          Texto en revisión. Los datos entre corchetes los completará el titular antes del lanzamiento. Para cualquier duda, escribe a{" "}
          <a href={`mailto:${COMPANY.email}`} className="font-semibold text-brand hover:underline">{COMPANY.email}</a>.
        </p>
      )}
      {intro && <p className="mt-6 leading-relaxed text-ink-soft">{intro}</p>}
      <nav aria-label="Índice" className="mt-8 rounded-2xl border border-line p-5">
        <p className="text-sm font-bold text-ink">Contenido</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          {sections.map((s, i) => (
            <li key={s.heading}><a href={`#s${i + 1}`} className="hover:text-brand">{s.heading}</a></li>
          ))}
        </ol>
      </nav>
      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section key={s.heading} id={`s${i + 1}`} className="scroll-mt-24">
            <h2 className="text-xl font-bold text-ink">{i + 1}. {s.heading}</h2>
            <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">
              {s.body.map((b, j) =>
                typeof b === "string" ? (
                  <p key={j}>{b}</p>
                ) : "list" in b ? (
                  <ul key={j} className="list-disc space-y-1.5 pl-5">{b.list.map((li) => <li key={li}>{li}</li>)}</ul>
                ) : (
                  <div key={j} className="overflow-x-auto rounded-2xl border border-line">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface-muted text-xs text-ink-faint"><tr>{b.table.head.map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
                      <tbody>{b.table.rows.map((r, k) => (<tr key={k} className="border-t border-line align-top">{r.map((c, l) => <td key={l} className="p-3">{c}</td>)}</tr>))}</tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-12 text-sm text-ink-faint">
        Consulta también: <Link href="/legal/aviso-legal" className="hover:text-brand">Aviso legal</Link> · <Link href="/legal/privacidad" className="hover:text-brand">Privacidad</Link> · <Link href="/legal/cookies" className="hover:text-brand">Cookies</Link> · <Link href="/legal/terminos" className="hover:text-brand">Términos de uso</Link> · <Link href="/legal/condiciones-contratacion" className="hover:text-brand">Condiciones de contratación</Link>
      </p>
    </article>
  );
}
