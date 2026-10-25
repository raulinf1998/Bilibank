import { NextResponse } from "next/server";
import { deadline, expired, fetchWithDeadline, readJson } from "@/lib/upstream";

/**
 * Precios de mercado (best effort).
 *
 * Prueba Yahoo Finance para cada ticker. Si la red o la fuente no responden,
 * devuelve una lista vacía y el cliente mantiene su precio simulado estable.
 * No lanza errores: la app debe funcionar sin conexión.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Item {
  id: number;
  ticker: string;
  isin?: string;
  base: number;
}

/** Candidatos de símbolo para un ticker del export (fondos españoles, ETFs, etc.). */
function candidates(item: Item): string[] {
  const raw = (item.ticker || "").trim().toUpperCase();
  const out = new Set<string>();
  if (!raw || /[\s/]/.test(raw)) return [];
  out.add(raw);
  /* IE00B3RBWM25 → varios sufijos habituales de Yahoo */
  if (item.isin && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(item.isin)) {
    out.add(item.isin);
    for (const suffix of [".F", ".DE", ".L", ".IR", ".AS", ".MI"]) out.add(item.isin + suffix);
  }
  /* 0P0001XF40.F ya lleva sufijo; también se prueba sin él */
  const dot = raw.lastIndexOf(".");
  if (dot > 0) {
    out.add(raw.slice(0, dot));
    out.add(`${raw.slice(0, dot)}.F`);
  }
  return [...out];
}

async function yahooPrice(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const response = await fetchWithDeadline(
    url,
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; MiPatrimonio/1.0)", Accept: "application/json" }, cache: "no-store" },
    2500,
  );
  const json = await readJson<{ chart?: { result?: { meta?: { regularMarketPrice?: number; previousClose?: number } }[] } }>(response);
  const meta = json?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice ?? meta?.previousClose;
  return typeof price === "number" && price > 0 ? Math.round(price * 100) / 100 : null;
}

export async function POST(request: Request) {
  let items: Item[] = [];
  try {
    const body = (await request.json()) as { items?: Item[] };
    items = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
  } catch {
    return NextResponse.json({ prices: {}, source: "none", message: "Petición inválida" });
  }

  const prices: Record<string, number> = {};
  const misses: string[] = [];
  /* Presupuesto global: la ruta responde siempre en menos de ~6 s, haya red o no. */
  const budget = deadline(6000);

  await Promise.all(
    items.map(async (item) => {
      for (const symbol of candidates(item)) {
        if (expired(budget)) break;
        try {
          const price = await yahooPrice(symbol);
          if (price) {
            prices[String(item.id)] = price;
            return;
          }
        } catch {
          /* se prueba el siguiente candidato */
        }
      }
      misses.push(item.ticker);
    }),
  );

  return NextResponse.json({
    prices,
    source: Object.keys(prices).length ? "Yahoo Finance" : "none",
    found: Object.keys(prices).length,
    total: items.length,
    misses: misses.slice(0, 10),
  });
}
