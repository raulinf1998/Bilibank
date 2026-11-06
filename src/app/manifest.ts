import type { MetadataRoute } from "next";

/** Manifiesto de la app (icono y nombre al añadirla a la pantalla de inicio). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bilibank",
    short_name: "Bilibank",
    description: "Tu patrimonio, cuentas, inversiones y movimientos en una sola pantalla.",
    start_url: "/",
    display: "standalone",
    background_color: "#07080c",
    theme_color: "#07080c",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
