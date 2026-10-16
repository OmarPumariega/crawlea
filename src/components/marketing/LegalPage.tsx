// Plantilla de las páginas legales. El texto definitivo lo aporta Omar: hasta
// entonces cada sección lleva un hueco [ENTRE CORCHETES] bien visible y un
// aviso arriba, para que nada parezca definitivo sin serlo.
export default function LegalPage({
  title,
  sections,
}: {
  title: string;
  sections: { heading: string; hint: string }[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-ink">{title}</h1>
      <p className="mt-4 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-soft">
        Texto pendiente de revisión. Los apartados entre corchetes se completarán antes del lanzamiento.
      </p>
      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-xl font-bold text-ink">{s.heading}</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">[{s.hint}]</p>
          </section>
        ))}
      </div>
    </div>
  );
}
