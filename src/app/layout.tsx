import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// Identidad tipográfica Crawlea: Manrope (geométrica, humana, la de las
// referencias de la guía de estilo). Los números de datos van siempre con
// la clase .num (tabular-nums). El mono cae al stack del sistema.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Crawlea · El SEO esencial, a tu alcance", template: "%s" },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_ES",
    title: "Crawlea · El SEO esencial, a tu alcance",
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes muta el atributo data-theme de
    // <html> antes del primer pintado para evitar el flash de tema equivocado.
    // La variable de la fuente va en <html> (no en <body>): crawlea.css resuelve
    // --font-sans → var(--font-manrope) en :root, y las variables CSS no suben
    // de hijos a padres — en <body> la resolución en raíz falla y toda la app
    // caería a la fuente por defecto del navegador en vez de a Manrope.
    <html lang="es" className={manrope.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
