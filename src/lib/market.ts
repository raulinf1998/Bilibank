/* Precios y datos de mercado.

   Dos capas:
   1. `stablePrice` — simulación DETERMINISTA: el precio de un producto para una
      fecha concreta siempre es el mismo, así que pulsar «Actualizar precios» dos
      veces el mismo día no mueve la cotización (antes era un paseo aleatorio que
      se acumulaba en cada clic).
   2. Rutas `/api/prices` y `/api/market-data` — intentan traer precios, sectores,
      países y top de posiciones de fuentes públicas. Si no hay red o la fuente no
      conoce el valor, se mantiene la capa determinista y se avisa en la interfaz.
*/

import type { Holding } from "./mock";

/* ------------------------------ fechas ------------------------------ */

/** Fecha de hoy en formato YYYY-MM-DD (hora local del navegador). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/* ------------------------------ determinismo ------------------------------ */

/** Hash FNV-1a de 32 bits; estable entre navegador y servidor. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Variación diaria pseudoaleatoria pero estable, en el rango ±`amplitude`. */
export function dailyDrift(seed: string, iso: string, amplitude = 0.02): number {
  const h = hashString(`${seed}|${iso}`);
  /* Dos tiradas del hash para que la distribución no dependa solo del último bit */
  const a = h / 0xffffffff;
  const b = hashString(`${iso}|${seed}`) / 0xffffffff;
  return (a + b - 1) * amplitude;
}

/** Precio de `base` para un producto y un día: mismo resultado siempre. */
export function stablePrice(base: number, ticker: string, iso: string, amplitude = 0.02): number {
  if (!Number.isFinite(base) || base <= 0) return base;
  const price = base * (1 + dailyDrift(ticker || "sin-ticker", iso, amplitude));
  return Math.max(0.01, Math.round(price * 100) / 100);
}

/**
 * Aplica un precio a un producto sin destruir el histórico: deja `priceBase`
 * (referencia sobre la que se calcula) y sustituye el último punto de la serie.
 */
export function withPrice(h: Holding, base: number, price: number, iso: string): Holding {
  const prices = h.prices.length ? [...h.prices] : [price];
  prices[prices.length - 1] = price;
  const spark = prices.slice(-12);
  const safeBase = base > 0 ? base : price;
  return {
    ...h,
    priceBase: h.priceBase ?? safeBase,
    prices: prices,
    spark,
    price,
    change1d: safeBase > 0 ? Math.round(((price - safeBase) / safeBase) * 10000) / 100 : 0,
    pricesUpdatedOn: iso,
  };
}

/* ------------------------------ desgloses ------------------------------ */

export type Breakdown = [string, number][];

/** Suma 100 % ajustando la última fila; descarta filas a cero. */
export function normalizeBreakdown(rows: Breakdown): Breakdown {
  const clean = rows.filter(([name, pct]) => name.trim() !== "" && Number.isFinite(pct) && pct > 0).map(([name, pct]) => [name.trim(), Math.round(pct * 10) / 10] as [string, number]);
  const total = clean.reduce((s, [, pct]) => s + pct, 0);
  if (!clean.length) return [];
  if (total === 0) return clean.map(([name]) => [name, Math.round((100 / clean.length) * 10) / 10]);
  return clean.map(([name, pct]) => [name, Math.round((pct / total) * 1000) / 10]);
}

export const breakdownTotal = (rows: Breakdown): number => Math.round(rows.reduce((s, [, pct]) => s + (Number.isFinite(pct) ? pct : 0), 0) * 10) / 10;

/** ¿Siguen siendo los valores de relleno del importador? */
export const isPlaceholderBreakdown = (rows: Breakdown | undefined): boolean =>
  !rows || !rows.length || rows.every(([name]) => name === "Sin clasificar" || name === "Sin desglose");

export interface MarketProfile {
  sectors: Breakdown;
  top: Breakdown;
  countries: Breakdown;
  source: string;
  note?: string;
}

/** Resultado de `/api/market-data` por producto. */
export type MarketProfileMap = Record<string, MarketProfile | null>;
