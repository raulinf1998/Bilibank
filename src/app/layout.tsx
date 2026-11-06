import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

/**
 * Identidad de la aplicación: pestaña del navegador, historial y accesos
 * directos del móvil. El icono es la hucha de cerdito de Bilibank.
 */
export const metadata: Metadata = {
  title: {
    default: "Bilibank · Tus finanzas personales",
    template: "%s · Bilibank",
  },
  applicationName: "Bilibank",
  description:
    "Bilibank: tu patrimonio, cuentas, inversiones y movimientos en una sola pantalla, con diseño personalizable.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Bilibank", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "Bilibank",
    description: "Tu patrimonio, cuentas, inversiones y movimientos en una sola pantalla.",
    siteName: "Bilibank",
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Bilibank" }],
  },
  twitter: { card: "summary", title: "Bilibank", images: ["/icon-512.png"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07080c" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
  ],
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
