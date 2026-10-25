import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Permite que la vista previa del sandbox use los recursos de desarrollo.
  allowedDevOrigins: ["3000-ip8ny6nqgybb48bt1o32w.e2b.app"],
  outputFileTracingIncludes: {
    "/instalacion": ["./deploy/README.md"],
    // Export de MoneyMatter usado como datos iniciales (también dentro de Docker).
    "/": ["./data/moneymatter/*"],
    "/app": ["./data/moneymatter/*"],
    "/api/integration": [
      "./docs/MIGRACION_MONEY_V2.md",
      "./docs/REFERENCIA-Y-LIMITACIONES.md",
      "./src/components/preview/**/*.tsx",
      "./src/components/lab/**/*.tsx",
      "./src/lib/*.ts",
      "./src/lib/*.tsx",
      "./src/app/globals.css",
      "./scripts/build-worldmap.mjs",
    ],
  },
};

export default nextConfig;
