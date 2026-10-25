import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laboratorio de diseño · Mi Patrimonio",
  description:
    "Seis propuestas de rediseño para tu app de finanzas personales: paletas, tipografías, gráficas y componentes aplicados a tus pantallas reales.",
};

const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Instrument+Serif&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@400;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={GOOGLE_FONTS} />
      </head>
      <body className="bg-[#07080c] antialiased">{children}</body>
    </html>
  );
}
