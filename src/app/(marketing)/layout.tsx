import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import "./marketing.css";

// Web pública (Fase 4): home, precios, contacto y legales. Sin sesión
// obligatoria; solo se lee para mostrar «Ir al panel» en la cabecera.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
        Ir al contenido
      </a>
      <MarketingHeader loggedIn={!!session} />
      <main id="contenido" className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
