import { ImageResponse } from "next/og";

export const alt = "Crawlea · El SEO esencial, a tu alcance";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Imagen para compartir en redes: marca + titular, colores fijos de la guía.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#4F5CF5", color: "#fff", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 48, fontWeight: 800 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#fff", color: "#4F5CF5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44 }}>c</div>
          crawlea
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>El SEO esencial, a tu alcance</div>
          <div style={{ fontSize: 34, color: "#C3CAFF" }}>Rastrea tu web, sigue tus posiciones y aprende qué mejorar primero.</div>
        </div>
      </div>
    ),
    size
  );
}
