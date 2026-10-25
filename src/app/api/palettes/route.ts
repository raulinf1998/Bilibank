import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customPalettes } from "@/db/schema";
import { parseSeeds } from "@/lib/themes";

export const dynamic = "force-dynamic";

function slug(name: string): string {
  const s = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return s || "paleta";
}

export async function GET() {
  try {
    const rows = await db.select().from(customPalettes).orderBy(asc(customPalettes.id));
    const palettes = rows
      .map((r) => ({ key: r.key, name: r.name, seeds: parseSeeds(r.seeds) }))
      .filter((p) => p.seeds !== null);
    return NextResponse.json({ palettes });
  } catch {
    return NextResponse.json({ palettes: [] });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const payload = (body ?? {}) as Record<string, unknown>;
  const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 40) : "";
  const seeds = parseSeeds(payload.seeds);
  if (!name) return NextResponse.json({ ok: false, error: "Falta el nombre de la paleta" }, { status: 400 });
  if (!seeds) return NextResponse.json({ ok: false, error: "Colores no válidos" }, { status: 400 });

  const requested = typeof payload.key === "string" && /^custom-[a-z0-9-]{3,60}$/.test(payload.key) ? payload.key : null;
  try {
    if (requested) {
      const existing = await db.select({ id: customPalettes.id }).from(customPalettes).where(eq(customPalettes.key, requested)).limit(1);
      if (existing[0]) {
        await db.update(customPalettes).set({ name, seeds, updatedAt: new Date() }).where(eq(customPalettes.id, existing[0].id));
        return NextResponse.json({ ok: true, palette: { key: requested, name, seeds } });
      }
    }
    const key = requested ?? `custom-${slug(name)}-${Math.random().toString(36).slice(2, 7)}`;
    await db.insert(customPalettes).values({ key, name, seeds });
    return NextResponse.json({ ok: true, palette: { key, name, seeds } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!/^custom-[a-z0-9-]{3,60}$/.test(key)) return NextResponse.json({ ok: false, error: "Clave no válida" }, { status: 400 });
  try {
    await db.delete(customPalettes).where(eq(customPalettes.key, key));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
