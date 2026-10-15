import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Identidad tipográfica v3: Plus Jakarta Sans (geométrica, moderna, la de los
// dashboards de referencia) + IBM Plex Mono solo para datos numéricos/código.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crawlea — Panel SEO",
  description:
    "Herramienta SEO todo-en-uno con datos reales: keywords, auditoría técnica, rank tracking, contenido y geogrid local.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${jakarta.variable} ${plexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
