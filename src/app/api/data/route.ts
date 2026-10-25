import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceData } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export interface Snapshot {
  accounts: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  holdings: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

function cleanList(value: unknown, max: number): Record<string, unknown>[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const out: Record<string, unknown>[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    out.push(JSON.parse(JSON.stringify(item)) as Record<string, unknown>);
  }
  return out;
}

export function validateSnapshot(raw: unknown): Snapshot | null {
  if (!isRecord(raw)) return null;
  const accounts = cleanList(raw.accounts, 200);
  const categories = cleanList(raw.categories, 500);
  const holdings = cleanList(raw.holdings, 1000);
  const transactions = cleanList(raw.transactions, 30000);
  if (!accounts || !categories || !holdings || !transactions) return null;
  return { accounts, categories, holdings, transactions };
}

export async function GET() {
  try {
    const rows = await db.select().from(workspaceData).orderBy(asc(workspaceData.id)).limit(1);
    const row = rows[0];
    if (!row) return NextResponse.json({ data: null, saved: false });
    const data = validateSnapshot(row.data);
    if (!data) return NextResponse.json({ data: null, saved: false });
    return NextResponse.json({ data, saved: true, updatedAt: row.updatedAt });
  } catch {
    return NextResponse.json({ data: null, saved: false, error: true });
  }
}

export async function PUT(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return NextResponse.json({ ok: false, error: "Los datos superan el tamaño permitido" }, { status: 413 });
  let body: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Los datos superan el tamaño permitido" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const snapshot = validateSnapshot(isRecord(body) && "data" in body ? body.data : body);
  if (!snapshot) return NextResponse.json({ ok: false, error: "Estructura de datos no válida" }, { status: 400 });
  try {
    const rows = await db.select({ id: workspaceData.id }).from(workspaceData).orderBy(asc(workspaceData.id)).limit(1);
    if (rows[0]) {
      await db.update(workspaceData).set({ data: snapshot, updatedAt: new Date() }).where(eq(workspaceData.id, rows[0].id));
    } else {
      await db.insert(workspaceData).values({ id: 1, data: snapshot });
    }
    return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
