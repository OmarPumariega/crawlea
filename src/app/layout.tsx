import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { ThemeProvider } from "next-themes";
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
    // suppressHydrationWarning: next-themes muta el atributo data-theme de
    // <html> antes del primer pintado para evitar el flash de tema equivocado.
    <html lang="es" suppressHydrationWarning>
      <body className={manrope.variable}>
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
