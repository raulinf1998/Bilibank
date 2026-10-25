import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import {
  exportCardTsx,
  exportIndexCss,
  exportPaletteSummary,
  exportTailwindConfig,
  toCssVars,
  type DesignConfig,
  type PaletteDef,
} from "./themes";

/** Never enumerate the project root or accept filesystem paths from a request. */
const SOURCE_FILES = [
  "src/components/preview/AppPreview.tsx",
  "src/components/preview/charts.tsx",
  "src/components/preview/datefield.tsx",
  "src/components/preview/forms.tsx",
  "src/components/preview/hover.tsx",
  "src/components/preview/palette-editor.tsx",
  "src/components/preview/palettes.tsx",
  "src/components/preview/periodbar.tsx",
  "src/components/preview/primitives.tsx",
  "src/components/preview/state.tsx",
  "src/components/preview/views-extra.tsx",
  "src/components/preview/views-main.tsx",
  "src/components/preview/worldmap.tsx",
  "src/components/lab/DesignLab.tsx",
  "src/components/lab/parts.tsx",
  "src/components/lab/integration-download.tsx",
  "src/lib/colors.ts",
  "src/lib/format.ts",
  "src/lib/geo.ts",
  "src/lib/icons.tsx",
  "src/lib/investing.ts",
  "src/lib/mock.ts",
  "src/lib/series.ts",
  "src/lib/themes.ts",
  "src/lib/worldmap-data.ts",
  "src/app/globals.css",
  "scripts/build-worldmap.mjs",
] as const;

export async function readMigrationGuide(): Promise<string> {
  return readFile(path.join(process.cwd(), "docs/MIGRACION_MONEY_V2.md"), "utf8");
}

function selectionCss(config: DesignConfig, palette: PaletteDef): string {
  const blocks = (["light", "dark"] as const).map((mode) => {
    const selector = mode === "light" ? ":root" : ".dark";
    const variables = toCssVars({ ...config, mode }, palette);
    return `${selector} {\n  color-scheme: ${mode};\n${Object.entries(variables).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`;
  });
  return `/* Tokens de interfaz. No modifican los colores persistentes de cuentas/categorías/productos.\n   Fusionar con el sistema de estilos de Money_v2; consultar LEEME.md. */\n\n${blocks.join("\n\n")}\n`;
}

export async function buildIntegrationPackage(config: DesignConfig, palette: PaletteDef): Promise<Uint8Array> {
  const [guide, limits, sources] = await Promise.all([
    readMigrationGuide(),
    readFile(path.join(process.cwd(), "docs/REFERENCIA-Y-LIMITACIONES.md"), "utf8"),
    Promise.all(SOURCE_FILES.map(async (file) => {
      // Keep tracing scoped below src/ or to this one script; never join a dynamic
      // path directly to the project root (that would trace unrelated files).
      const content = file === "scripts/build-worldmap.mjs"
        ? await readFile(path.join(process.cwd(), "scripts", "build-worldmap.mjs"), "utf8")
        : await readFile(path.join(process.cwd(), "src", file.slice(4)), "utf8");
      return [file, content] as const;
    })),
  ]);

  const files: Record<string, Uint8Array> = {
    "LEEME.md": strToU8(guide),
    "REFERENCIA-Y-LIMITACIONES.md": strToU8(limits),
    "seleccion/configuracion.json": strToU8(JSON.stringify(config, null, 2) + "\n"),
    "seleccion/paleta.json": strToU8(JSON.stringify(palette, null, 2) + "\n"),
    "seleccion/resumen.txt": strToU8(exportPaletteSummary(config, palette)),
    "seleccion/tokens.css": strToU8(selectionCss(config, palette)),
    "ejemplos-tailwind3/tailwind.config.js": strToU8(exportTailwindConfig(config, palette)),
    "ejemplos-tailwind3/src/index.css": strToU8(exportIndexCss(config, palette)),
    "ejemplos-tailwind3/src/components/Card.tsx": strToU8(exportCardTsx(config)),
    "referencia-ui/LEEME.md": strToU8(
      "# Fuentes de referencia visual\n\nEstos archivos son la interfaz del laboratorio, no una aplicación Vite autónoma ni un parche de Money_v2.\n\nLee ../LEEME.md y ../REFERENCIA-Y-LIMITACIONES.md.\n\nNo copies state.tsx/mock.ts/series.ts como fuente financiera real. No copies globals.css sin adaptar Tailwind 4 a Tailwind 3.\n",
    ),
  };
  for (const [file, content] of sources) files[`referencia-ui/${file}`] = strToU8(content);

  const inventory = {
    format: "money-v2-ui-integration-reference-v1",
    generatedAt: new Date().toISOString(),
    targetRepository: "https://github.com/raulreg98/Money_v2",
    targetApplicationPath: "Money-main/Money-main",
    automaticPatch: false,
    containsSecretsOrDatabase: false,
    referenceIncludesSyntheticDemoData: true,
    warning: "Referencia visual que requiere adaptación a Vite/Express/SQLite. No sobrescribir el repositorio completo ni reemplazar la lógica financiera.",
    selectedDesign: config,
    files: Object.entries(files).map(([file, bytes]) => ({
      file,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })),
  };
  files["INVENTARIO.json"] = strToU8(JSON.stringify(inventory, null, 2) + "\n");
  return zipSync(files, { level: 6 });
}
