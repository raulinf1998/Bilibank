import { asc } from "drizzle-orm";
import { db } from "@/db";
import { customPalettes, designPreferences, themeFeedback } from "@/db/schema";
import { coerceConfig, defaultConfig, parseSeeds } from "@/lib/themes";
import type { CustomPaletteRecord } from "@/components/preview/palettes";
import { DesignLab, type FeedbackState } from "@/components/lab/DesignLab";

export const dynamic = "force-dynamic";

/** Design lab (comparison & export tool). The real app lives at "/". */
export default async function LabPage() {
  let config = defaultConfig();
  const feedback: Record<string, FeedbackState> = {};
  const palettes: CustomPaletteRecord[] = [];

  try {
    const [prefs, rows, pal] = await Promise.all([
      db.select().from(designPreferences).orderBy(asc(designPreferences.id)).limit(1),
      db.select().from(themeFeedback),
      db.select().from(customPalettes).orderBy(asc(customPalettes.id)).catch(() => []),
    ]);
    for (const r of pal) {
      const seeds = parseSeeds(r.seeds);
      if (seeds) palettes.push({ key: r.key, name: r.name, seeds });
    }
    if (prefs[0]) config = coerceConfig({ ...prefs[0] });
    for (const row of rows) feedback[row.themeKey] = { rating: row.rating, favourite: row.favourite, comment: row.comment };
  } catch {
    // Schema not ready yet.
  }

  return <DesignLab initialConfig={config} initialFeedback={feedback} initialPalettes={palettes} />;
}
