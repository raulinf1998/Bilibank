import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/instalacion": ["./deploy/README.md"],
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
