// Hero oscuro compartido por las páginas interiores (Funciones, Precios,
// Contacto). Mismo lenguaje que el de la home: base azul-noche, cuadrícula y
// una luz índigo arriba, pero compacto y alineado a la izquierda.
export default function PageHero({
  kicker,
  title,
  text,
  children,
}: {
  kicker: string;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-[#0E1033] pb-20 pt-32 text-white sm:pb-24 sm:pt-40">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 70% 80% at 20% -20%, rgba(79,92,245,0.55), transparent 70%)" }} />
      <div className="mk-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-200">{kicker}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.06] tracking-[-0.035em] sm:text-6xl">{title}</h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">{text}</p>
        {children}
      </div>
    </section>
  );
}
