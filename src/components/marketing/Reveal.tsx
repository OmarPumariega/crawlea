"use client";

import { useEffect, useRef } from "react";

// Aparición suave al entrar en pantalla. El HTML llega visible desde el
// servidor (sin JS no se oculta nada); solo los bloques que están por debajo
// del primer pantallazo se ocultan al montar y se revelan al hacer scroll.
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.classList.add("rv-hide");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.remove("rv-hide");
          el.classList.add("rv-in");
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ ["--rv-delay" as string]: `${delay}ms` }}>
      {children}
    </div>
  );
}
