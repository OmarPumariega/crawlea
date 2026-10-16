// Cabecera de sección editorial: número + etiqueta, título a la izquierda y
// la explicación a la derecha. Evita el patrón «todo centrado» de plantilla.
export default function SectionHead({
  n,
  label,
  title,
  text,
}: {
  n: string;
  label: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="grid gap-6 border-t border-line pt-6 md:grid-cols-12 md:gap-8">
      <p className="text-sm font-bold text-ink md:col-span-12">
        <span className="text-brand">{n}</span>
        <span className="mx-2 text-ink-faint">/</span>
        {label}
      </p>
      <h2 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl md:col-span-7">{title}</h2>
      {text && <p className="text-lg leading-relaxed text-ink-soft md:col-span-4 md:col-start-9 md:self-end">{text}</p>}
    </div>
  );
}
