"use client";

import { useEffect, useState } from "react";

// Cifra que sube de 0 al valor al montarse. Con movimiento reducido muestra
// directamente el valor final.
export default function CountUp({ to, decimals = 0, duration = 1400 }: { to: number; decimals?: number; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setV(to));
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{new Intl.NumberFormat("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: "always" }).format(v)}</>;
}
