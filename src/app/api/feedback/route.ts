import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { themeFeedback } from "@/db/schema";
import { getArchetype } from "@/lib/themes";

export const dynamic = "force-dynamic";

export interface FeedbackDTO {
  themeKey: string;
  rating: number;
  favourite: boolean;
  comment: string | null;
  updatedAt: string | null;
}

function toDTO(row: {
  themeKey: string;
  rating: number;
  favourite: boolean;
  comment: string | null;
  updatedAt: Date | null;
}): FeedbackDTO {
  return {
    themeKey: row.themeKey,
    rating: row.rating,
    favourite: row.favourite,
    comment: row.comment,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export async function GET() {
  try {
    const rows = await db.select().from(themeFeedback).orderBy(asc(themeFeedback.id));
    return NextResponse.json({ feedback: rows.map(toDTO) });
  } catch {
    return NextResponse.json({ feedback: [] });
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

  const theme = getArchetype(typeof payload.themeKey === "string" ? payload.themeKey : "");
  const rating = Math.max(0, Math.min(5, Math.round(Number(payload.rating) || 0)));
  const favourite = Boolean(payload.favourite);
  const comment =
    typeof payload.comment === "string" && payload.comment.trim().length > 0
      ? payload.comment.trim().slice(0, 2000)
      : null;

  try {
    const existing = await db
      .select({ id: themeFeedback.id })
      .from(themeFeedback)
      .where(eq(themeFeedback.themeKey, theme.key))
      .limit(1);

    if (existing[0]) {
      await db
        .update(themeFeedback)
        .set({ rating, favourite, comment, updatedAt: new Date() })
        .where(eq(themeFeedback.id, existing[0].id));
    } else {
      await db.insert(themeFeedback).values({ themeKey: theme.key, rating, favourite, comment });
    }

    const rows = await db.select().from(themeFeedback).orderBy(asc(themeFeedback.id));
    return NextResponse.json({ ok: true, feedback: rows.map(toDTO) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
