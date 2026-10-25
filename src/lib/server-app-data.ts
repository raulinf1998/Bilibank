import { asc } from "drizzle-orm";
import { db } from "@/db";
import { customPalettes, designPreferences, workspaceData } from "@/db/schema";
import { coerceConfig, defaultConfig, parseSeeds } from "@/lib/themes";
import type { CustomPaletteRecord } from "@/components/preview/palettes";
import type { WorkspaceSnapshot } from "@/components/preview/state";

/** Loads the persisted design & workspace state for the full-screen application. */
export async function loadAppState() {
  let config = defaultConfig();
  const palettes: CustomPaletteRecord[] = [];
  let data: WorkspaceSnapshot | null = null;

  try {
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

  return { config, palettes, data };
}
