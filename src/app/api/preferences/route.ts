import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { designPreferences } from "@/db/schema";
import { coerceConfig, defaultConfig } from "@/lib/themes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(designPreferences).orderBy(asc(designPreferences.id)).limit(1);
    const row = rows[0];
    if (!row) return NextResponse.json({ config: defaultConfig(), saved: false });
    return NextResponse.json({
      config: coerceConfig({ ...row }),
      saved: true,
      updatedAt: row.updatedAt,
    });
  } catch {
    return NextResponse.json({ config: defaultConfig(), saved: false, error: true });
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const config = coerceConfig((body ?? {}) as Record<string, unknown>);
  const { archetypeKey, ...rest } = config;
  const row = { ...rest, themeKey: archetypeKey };

  try {
    const rows = await db
      .select({ id: designPreferences.id })
      .from(designPreferences)
      .orderBy(asc(designPreferences.id))
      .limit(1);
    const existing = rows[0];
    if (existing) {
      await db
        .update(designPreferences)
        .set({ ...row, updatedAt: new Date() })
        .where(eq(designPreferences.id, existing.id));
    } else {
      await db.insert(designPreferences).values(row);
    }
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
