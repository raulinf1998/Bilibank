import { NextResponse } from "next/server";
import { deadline, expired, fetchWithDeadline, readJson, readText } from "@/lib/upstream";

/**
 * Perfil de un producto (sectores, principales posiciones y países), best effort.
 *
 * Yahoo Finance es la única fuente pública que devuelve desgloses sin clave de
 * API, y solo lo hace para ETFs y algunos fondos: los fondos de inversión
 * españoles suelen no tener datos. Cuando no hay nada, se responde `null` y la
 * app conserva lo que el usuario haya escrito a mano.
 *
 * Todas las peticiones llevan tiempo máximo y se capturan: sin red, la ruta
 * responde 200 con perfiles vacíos en vez de romper la interfaz.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (compatible; MiPatrimonio/1.0)";
const CACHE_TTL = 30 * 60 * 1000;

interface Item {
  id: number;
  ticker: string;
  isin?: string;
  name?: string;
}

interface Profile {
  sectors: [string, number][];
  top: [string, number][];
  countries: [string, number][];
  source: string;
  note?: string;
}

const cache = new Map<string, { at: number; value: Profile | null }>();

/* Nombres de Yahoo → castellano */
const SECTOR_ES: Record<string, string> = {
  realestate: "Inmobiliario",
  consumer_cyclical: "Consumo cíclico",
  basic_materials: "Materiales básicos",
  consumer_defensive: "Consumo defensivo",
  technology: "Tecnología",
  communication_services: "Comunicación",
  financial_services: "Finanzas",
  healthcare: "Salud",
  industrials: "Industria",
  energy: "Energía",
  utilities: "Servicios públicos",
};

function candidates(item: Item): string[] {
  const raw = (item.ticker || "").trim().toUpperCase();
  const out: string[] = [];
  if (!raw || /[\s/]/.test(raw)) return out;
  out.push(raw);
  if (item.isin && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(item.isin)) out.push(item.isin);
  const dot = raw.lastIndexOf(".");
  if (dot > 0) out.push(raw.slice(0, dot), `${raw.slice(0, dot)}.F`);
  return [...new Set(out)];
}

async function yahooSession(): Promise<{ cookie: string; crumb: string } | null> {
  try {
    const landing = await fetchWithDeadline(
      "https://fc.yahoo.com",
      { headers: { "User-Agent": UA }, cache: "no-store", redirect: "manual" },
      2500,
    );
    if (!landing) return null;
    const cookies = typeof landing.headers.getSetCookie === "function" ? landing.headers.getSetCookie() : [];
    const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
    if (!cookie) return null;
    const crumbResponse = await fetchWithDeadline(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      { headers: { "User-Agent": UA, Cookie: cookie }, cache: "no-store" },
      2500,
    );
    const crumb = (await readText(crumbResponse))?.trim() ?? "";
    if (!crumb || crumb.includes("<") || crumb.length > 32) return null;
    return { cookie, crumb };
  } catch {
    return null;
  }
}

interface YahooQuoteSummary {
  quoteSummary?: {
    result?: {
      topHoldings?: {
        holdings?: { symbol?: string; holdingName?: string; holdingPercent?: { raw?: number } }[];
        sectorWeightings?: Record<string, { raw?: number }>[];
      };
      assetProfile?: { country?: string; sector?: string; longBusinessSummary?: string };
      price?: { longName?: string; shortName?: string };
    }[];
  };
}

function parseSummary(json: YahooQuoteSummary): Profile | null {
  const result = json.quoteSummary?.result?.[0];
  if (!result) return null;

  const sectors: [string, number][] = [];
  for (const row of result.topHoldings?.sectorWeightings ?? []) {
    for (const [key, value] of Object.entries(row)) {
      const pct = (value?.raw ?? 0) * 100;
      if (pct > 0.1) sectors.push([SECTOR_ES[key] ?? key, Math.round(pct * 10) / 10]);
    }
  }

  const top: [string, number][] = (result.topHoldings?.holdings ?? [])
    .map((h) => [h.holdingName ?? h.symbol ?? "—", Math.round((h.holdingPercent?.raw ?? 0) * 1000) / 10] as [string, number])
    .filter(([, pct]) => pct > 0)
    .slice(0, 10);

  /* Yahoo no publica desglose por país: solo el domicilio del fondo. */
  const countries: [string, number][] = [];
  const domicile = result.assetProfile?.country;
  if (domicile && top.length) countries.push([domicile, 100]);

  if (!sectors.length && !top.length) return null;
  sectors.sort((a, b) => b[1] - a[1]);
  return {
    sectors,
    top,
    countries,
    source: "Yahoo Finance",
    note: sectors.length ? undefined : "Sin desglose sectorial en la fuente",
  };
}

async function fetchProfile(item: Item, session: { cookie: string; crumb: string } | null, budget: { stop: number }): Promise<Profile | null> {
  if (!session) return null;
  for (const symbol of candidates(item)) {
    try {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=topHoldings,assetProfile,price&crumb=${encodeURIComponent(session.crumb)}`;
      if (expired(budget)) return null;
      const response = await fetchWithDeadline(
        url,
        { headers: { "User-Agent": UA, Cookie: session.cookie, Accept: "application/json" }, cache: "no-store" },
        3000,
      );
      const json = await readJson<YahooQuoteSummary>(response);
      if (!json) continue;
      const profile = parseSummary(json);
      if (profile) return profile;
    } catch {
      /* siguiente candidato */
    }
  }
  return null;
}

export async function POST(request: Request) {
  let items: Item[] = [];
  try {
    const body = (await request.json()) as { items?: Item[] };
    items = Array.isArray(body.items) ? body.items.slice(0, 15) : [];
  } catch {
    return NextResponse.json({ profiles: {}, source: "none", message: "Petición inválida" });
  }

  const profiles: Record<string, Profile | null> = {};
  const now = Date.now();
  const pending = items.filter((item) => {
    const hit = cache.get(`${item.ticker}|${item.isin ?? ""}`);
    if (hit && now - hit.at < CACHE_TTL) {
      profiles[String(item.id)] = hit.value;
      return false;
    }
    return true;
  });

  /* Presupuesto global: sin red, la ruta responde en pocos segundos. */
  const budget = deadline(9000);
  let session: { cookie: string; crumb: string } | null = null;
  if (pending.length) session = await yahooSession();

  await Promise.all(
    pending.map(async (item) => {
      const profile = expired(budget) ? null : await fetchProfile(item, session, budget);
      cache.set(`${item.ticker}|${item.isin ?? ""}`, { at: now, value: profile });
      profiles[String(item.id)] = profile;
    }),
  );

  const found = Object.values(profiles).filter(Boolean).length;
  return NextResponse.json({
    profiles,
    source: found ? "Yahoo Finance" : "none",
    found,
    total: items.length,
    message: found
      ? undefined
      : session
        ? "Las fuentes no tienen desglose para estos productos; puedes escribirlo a mano"
        : "No se pudo conectar con las fuentes de datos",
  });
}
