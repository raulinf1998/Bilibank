import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { asc } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { customPalettes, designPreferences, workspaceData } from "@/db/schema";
import { coerceConfig, defaultConfig, parseSeeds } from "@/lib/themes";
import { buildSnapshot } from "@/lib/moneymatter";
import { setTodayReference } from "@/lib/series";
import type { CustomPaletteRecord } from "@/components/preview/palettes";
import type { WorkspaceSnapshot } from "@/components/preview/state";

/** Carpeta donde vive el export de MoneyMatter ya descomprimido (semilla inicial). */
const SEED_DIR = path.join(process.cwd(), "data", "moneymatter");

/**
 * Lee el export de MoneyMatter incluido en `data/moneymatter/` y lo convierte
 * al modelo de la aplicación. Se usa cuando la base de datos todavía no tiene
 * datos guardados, para que la app arranque con tus finanzas reales.
 */
async function loadMoneyMatterSeed(): Promise<WorkspaceSnapshot | null> {
  try {
    const names = await readdir(SEED_DIR);
    const files: Record<string, string> = {};
    for (const name of names) {
      if (!/\.(csv|json)$/i.test(name)) continue;
      files[name] = await readFile(path.join(SEED_DIR, name), "utf8");
    }
    if (!files["accounts.csv"] && !files["transactions.csv"]) return null;
    return buildSnapshot(files, { source: "data/moneymatter" }).snapshot;
  } catch {
    return null;
  }
}

const latestDate = (data: WorkspaceSnapshot | null): string | null => {
  if (!data?.transactions?.length) return null;
  let max = "";
  for (const tx of data.transactions) if (tx.date > max) max = tx.date;
  return max || null;
};

/** Loads the persisted design & workspace state for the full-screen application. */
export async function loadAppState() {
  let config = defaultConfig();
  const palettes: CustomPaletteRecord[] = [];
  let data: WorkspaceSnapshot | null = null;

  try {
    await ensureSchema();
    const [prefs, rows, workspace] = await Promise.all([
      db.select().from(designPreferences).orderBy(asc(designPreferences.id)).limit(1),
      db.select().from(customPalettes).orderBy(asc(customPalettes.id)).catch(() => []),
      db.select().from(workspaceData).orderBy(asc(workspaceData.id)).limit(1).catch(() => []),
    ]);
    if (prefs[0]) config = coerceConfig({ ...prefs[0] });
    for (const row of rows) {
      const seeds = parseSeeds(row.seeds);
      if (seeds) palettes.push({ key: row.key, name: row.name, seeds });
    }
    const snapshot = workspace[0]?.data;
    if (snapshot && typeof snapshot === "object" && "accounts" in snapshot) data = snapshot as unknown as WorkspaceSnapshot;
  } catch {
    // First boot before the schema exists: start with the sample workspace.
  }

  // Sin datos guardados en PostgreSQL, arranca con el export de MoneyMatter.
  if (!data) data = await loadMoneyMatterSeed();

  // La ventana temporal (periodos, gráficas) se ancla al último movimiento real.
  setTodayReference(latestDate(data));

  return { config, palettes, data };
}
