# Crawlea · Guía de estilo v0.3

Herramienta SEO propia de Omar. Referencias: dashboards minimalistas y muy visuales (tarjetas blancas, números grandes, gráficos suaves, un solo acento). Esta guía es la fuente de verdad para cualquier pantalla del proyecto.

> **Para cualquier agente IA:** antes de crear o modificar cualquier componente, lee este archivo y usa solo los tokens de `crawlea.css`. No introduzcas colores, radios ni sombras que no estén aquí.

---

## 1. Principios

1. **Un solo protagonista de color.** El índigo es el 10 % de la pantalla. El resto es blanco y neutros.
2. **Los datos mandan.** El número grande es lo primero que se lee; el gráfico lo acompaña.
3. **Todo en azul.** Neutros teñidos de azul, gráficos con una sola rampa índigo y lo positivo también en azul. No hay verde ni amarillo en la interfaz.
3b. **Un único color cálido.** El coral-rojo (`alert`) aparece solo en avisos y en bajadas de posición. Al ser escaso, cuando sale se ve.
4. **Aire.** Mucho espacio interior, nada de bordes duros, casi sin sombra.
5. **Proporción 60-30-10.** 60 % fondo y tarjetas · 30 % texto y estructura · 10 % acento.

## 2. Color

### Acento (rampa índigo)
| Token | Hex | Uso |
|---|---|---|
| `brand-50` | `#EEF0FF` | Fondo suave de pastillas, hover, celdas vacías de heatmap |
| `brand-100` | `#C3CAFF` | Barras no destacadas, series secundarias |
| `brand-200` | `#9DA8FF` | Series intermedias |
| `brand-300` | `#7381FF` | Hover de botones, degradados |
| `brand-500` | `#4F5CF5` | **Color de marca**: botón primario, dato destacado, enlaces |
| `brand-700` | `#3238AD` | Texto sobre fondo claro de acento, estado pulsado |
| `brand-900` | `#1C1F5E` | Superficies oscuras (tooltips, tarjeta destacada) |

### Neutros
| Token | Hex | Uso |
|---|---|---|
| `canvas` | `#F2F3F8` | Fondo de la app |
| `surface` | `#FFFFFF` | Tarjetas |
| `surface-muted` | `#F7F8FC` | Zonas hundidas dentro de tarjeta, inputs |
| `line` | `#E4E6EF` | Bordes, separadores |
| `ink` | `#11142B` | Texto principal |
| `ink-soft` | `#6A6F88` | Texto secundario |
| `ink-faint` | `#9A9FB5` | Ejes y etiquetas de gráficos (nunca para texto de lectura) |

### Alerta (el único color que no es azul)
| Token | Hex | Uso |
|---|---|---|
| `alert` | `#E8575F` | Relleno, icono o línea de un aviso o de una bajada de posición |
| `alert-ink` | `#C13A43` (claro) · `#FF8A91` (oscuro) | Texto pequeño en alerta |
| `alert-tint` | `#FDEAEB` (claro) · rojo al 16 % (oscuro) | Fondo de pastilla de alerta |

**Cuándo se usa `alert` (lista cerrada):**
1. **Avisos y errores** que requieren acción: enlaces rotos, URL no indexable, fallo de rastreo.
2. **Cambio de posición negativo** en el ranking (▼ 2).

**Cuándo NO se usa:** decoración, botones, títulos, gráficos de series, ni para "perdidos" o "descensos" que no sean de posicionamiento (un backlink perdido o una caída de tráfico va en `pill-neutral`). Tampoco hay ámbar ni verde.

### Cómo se expresa lo bueno y lo malo sin verde
| Situación | Tratamiento |
|---|---|
| Sube / mejora | Pastilla azul `pill-up` con ▲ (`accent-tint` + `accent-ink`) |
| Baja de posición | Pastilla `pill-down` con ▼ (único uso del color cálido junto a los avisos) |
| Dato sin valoración (perdidos, totales) | `pill-neutral`, gris azulado |
| Estado correcto | Barra o icono en `brand-500`, sin color especial |
| Estado a medias | Misma barra en `brand-300` (más pálida) |
| Estado crítico | Barra en `alert` + pastilla "Revisar" |

**Regla de contraste:** `alert` sirve para rellenos, iconos y líneas. Para **texto pequeño** usa siempre `alert-ink`, y `accent-ink` para el texto azul de acento. El texto blanco sobre `brand-500` cumple AA.

### Reglas de uso
- El rojo **solo** aparece en la lista cerrada de arriba. Nunca decorativo.
- Una gráfica de series usa la rampa índigo (pálido → intenso). El dato destacado va en `brand-500`; el resto en `brand-100`.
- Si necesitas distinguir más de 3 series, cambia el trazo (continuo, discontinuo, punteado) antes de añadir colores.
- Prohibido: degradados multicolor, negro puro `#000`, grises sin tinte, sombras de color.

### Modo oscuro

Activo desde el principio. Se aplica con `data-theme="dark"` en `<html>`; los tokens cambian solos, así que **los componentes nunca llevan colores fijos**: usan `bg-surface`, `text-ink`, `border-line`, etc.

| Token | Claro | Oscuro |
|---|---|---|
| `canvas` | `#F2F3F8` | `#0C0E1D` |
| `surface` | `#FFFFFF` | `#151833` |
| `surface-muted` | `#F7F8FC` | `#1B1F3D` |
| `line` | `#E4E6EF` | `#262A4D` |
| `ink` | `#11142B` | `#EEF0FF` |
| `ink-soft` | `#6A6F88` | `#A3A8C6` |
| `ink-faint` | `#9A9FB5` | `#6D7298` |
| `accent-ink` (texto de acento) | `#3238AD` | `#9DA8FF` |

Reglas del oscuro:
- El fondo es azul-noche, **nunca negro puro**: mantiene el tinte de marca.
- La rampa índigo no cambia. `brand-500` sigue siendo el botón primario. Para **texto** de acento sobre oscuro se usa `accent-ink`, no `brand-500` (no llega a contraste AA).
- La pastilla de alerta usa fondo translúcido (`alert-tint`) y texto más claro (`alert-ink`). La pastilla azul usa `accent-tint` y `accent-ink`.
- En gráficos, las barras no destacadas pasan a `chart-muted` (`#2F3570`) y el heatmap a su propia escala (`--heat-0…4`). El relleno `alert` no cambia.
- En lugar de sombra, las tarjetas llevan un borde de 1 px casi invisible.

Cómo gestionarlo en Next.js: instala `next-themes` y envuelve la app con `<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>`. Así respeta la preferencia del sistema y recuerda la elección del usuario. El botón de alternar tema va en la barra superior, junto al avatar.

## 3. Tipografía

- **Familia:** Manrope (Google Fonts), pesos 400, 500, 600, 700, 800.
- **Números:** siempre con `tabular-nums` (clase `.num`).

| Rol | Tamaño / peso | Ejemplo |
|---|---|---|
| Título de página | 28-32 px · 800 · tracking -0.02em | "Resumen" |
| Cifra grande (KPI) | 40-48 px · 800 · tracking -0.03em | `68,4` |
| Título de tarjeta | 15-16 px · 700 | "Visibilidad" |
| Cuerpo | 14 px · 500 | Texto de tablas y descripciones |
| Etiqueta / eje | 12 px · 600 · `ink-faint` | "Ene", "Posición" |

Integración en Next.js 16 (`app/layout.tsx`):

```tsx
import { Manrope } from "next/font/google";
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
```

## 4. Forma, espacio y elevación

| Elemento | Valor |
|---|---|
| Tarjeta | radio `20px` (`rounded-card`), padding 24 px, sombra `shadow-card` |
| Elementos internos (inputs, celdas) | radio `14px` (`rounded-inner`) |
| Botones, pastillas, navegación | radio completo (`rounded-pill`) |
| Rejilla | 12 columnas, hueco de 16-20 px |
| Escala de espacio | 4 · 8 · 12 · 16 · 24 · 32 · 48 px |
| Bordes | 1 px `line`, solo donde haga falta separar |

## 5. Componentes clave

- **Botón primario:** píldora, fondo `brand-500`, texto blanco, 600. Hover `brand-300`→ pulsado `brand-700`.
- **Botón secundario:** píldora, fondo `surface`, borde `line`, texto `ink`.
- **Navegación superior:** píldoras; la activa en `brand-500` con texto blanco, las demás en `surface-muted`.
- **Pastilla de variación (`.pill-up` / `.pill-down`):** al lado del número grande, con flecha y porcentaje: `▲ 4,2 %`. `pill-up` es azul; `pill-down` es el color de alerta y solo se usa para bajadas de posición o avisos.
- **Tarjeta KPI:** etiqueta pequeña → cifra grande → pastilla de variación → minigráfico.
- **Tarjeta destacada:** una por pantalla como máximo, fondo `brand-500` a `brand-700`, texto blanco.
- **Tooltip:** fondo `brand-900`, texto blanco, radio 12 px.

## 6. Gráficos

| Tipo | Regla |
|---|---|
| Barras | Esquinas superiores redondeadas (8 px). Una destacada en `brand-500`, el resto `brand-100`. Sin rejilla vertical. |
| Líneas | Trazo 2,5 px `brand-500`, curva suave, relleno degradado `brand-500` 18 % → 0 %. Serie de comparación en `brand-100`, discontinua. |
| Donut | Grosor ~14 % del diámetro, extremos redondeados, porcentaje grande en el centro. |
| Heatmap | Celdas de 10-14 px con radio 4, escala `brand-50` → `brand-500`. |
| Progreso | Barra de 8 px con radio completo, fondo `brand-50`, relleno `brand-500`. |
| Ejes | Solo etiquetas en `ink-faint` 12 px; líneas horizontales en `line`, finas. |

Biblioteca recomendada: Recharts o visx, con los colores leídos de los tokens (`var(--color-brand-500)`).

## 7. Iconos

Lucide, trazo de 1,5 px, 18-20 px. Color `ink-soft` por defecto, `brand-500` si está activo. Un icono dentro de círculo de 40 px sobre `surface-muted` para accesos.

## 8. Logo

- **Icono:** una «c» abierta en blanco con un punto claro en la boca (el rastreador entrando en la web), sobre un cuadrado índigo `brand-500` de esquinas muy redondas (radio 28 %). El punto va en `brand-100`.
- **Nombre:** `crawlea` en minúsculas, Manrope 800, tracking -0.02em, **en un solo color**: `ink` (#11142B) sobre fondo claro y #EEF0FF sobre fondo oscuro. Sin letras de otro color.
- **Zona de respeto:** el alto de la «c» del icono alrededor. **Tamaño mínimo:** icono 16 px, logo horizontal 96 px de ancho.
- **Favicon:** versión simplificada con trazo más grueso y la boca más abierta para que se lea a 16 px.
- **No hacer:** cambiar el índigo del icono ni aplicarle degradados; colorear letras sueltas del nombre; estirar o girar el logo; añadir sombras o contornos; escribirlo en mayúsculas.
- **Archivos** (el texto ya está convertido a curvas, no necesita la fuente instalada):
  - `crawlea-logo.svg` (fondo claro) y `crawlea-logo-dark.svg` (fondo oscuro)
  - `crawlea-icon.svg` y `crawlea-icon-512.png` (icono sin texto, para redes y PWA)
  - `favicon.svg` (versión pequeña) y `apple-touch-icon.png` (180 px)

## 9. Tono de voz

Tuteo, directo, verbos en imperativo, sin jerga innecesaria y sin exclamaciones de relleno.

| En vez de | Escribe |
|---|---|
| "Iniciar el análisis del sitio web" | "Rastrea tu web" |
| "Se ha producido un error" | "No hemos podido rastrear esta URL. Revisa que sea pública." |
| "No hay datos disponibles" | "Aún no hay datos. Lanza el primer rastreo." |
| "Su posicionamiento ha mejorado" | "Subes 4 posiciones esta semana" |

Cifras con coma decimal y punto de millar (`12.480`, `4,2 %`), fechas `16 oct 2026`.

## 10. Integración en el proyecto

0. Copia estos archivos a la carpeta del proyecto: `GUIA-DE-ESTILO.md` en la raíz y, si usas Claude Code, referencia la guía desde `CLAUDE.md` ("Antes de tocar UI, lee GUIA-DE-ESTILO.md").
1. Copia `crawlea.css` a `app/crawlea.css`.
2. En `app/globals.css`:
   ```css
   @import "tailwindcss";
   @import "./crawlea.css";
   ```
3. Configura la fuente como en el apartado 3.
4. Copia `favicon.svg` a `app/icon.svg` (Next lo usa como favicon), `apple-touch-icon.png` a `app/apple-icon.png`, y los logos y `crawlea-icon-512.png` a `public/brand/`.
5. Instala `next-themes` y configura el proveedor como en el apartado de modo oscuro.
6. Cambia el nombre en metadatos (`title`, Open Graph) y en el dominio. Redirige 301 desde la URL anterior del despliegue actual a crawlea.com.
7. Usa `ejemplo-dashboard.html` como referencia visual de cada componente (tarjeta KPI, pastillas, barras, donut, heatmap, tabla) en claro y oscuro.

---
*v0.3 · 16 oct 2026 · Logo nuevo (la «c» con punto).*
