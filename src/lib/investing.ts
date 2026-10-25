import { holdingValue, type Holding } from "./mock";
import { isosFor } from "./geo";
import { FULL_DAYS, TODAY, addMonthsYM, monthDiff, periodRange } from "./series";

const DAY = 86_400_000;

/* ------------------------------------------------------------------
   Distribución por países
------------------------------------------------------------------ */

export interface CountryRow {
  name: string;
  value: number;
  pct: number;
  colorIdx: number;
}

/** Un país o región de la lista superior, con su rango (0 = primero) y los códigos que pinta en el mapa */
export interface MapEntry {
  name: string;
  pct: number;
  rank: number;
  isos: string[];
}

export function countryDistribution(holdings: Holding[], top = 8): { total: number; rows: CountryRow[] } {
  const acc = new Map<string, number>();
  for (const h of holdings) {
    const v = holdingValue(h);
    for (const [country, pct] of h.countries) acc.set(country, (acc.get(country) ?? 0) + (v * pct) / 100);
  }
  const all = [...acc.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const total = all.reduce((s, x) => s + x.value, 0) || 1;
  const head = all.filter((x) => x.name !== "Otros").slice(0, top);
  const rest = all.filter((x) => !head.includes(x)).reduce((s, x) => s + x.value, 0);
  const list = rest > 0 ? [...head, { name: "Otros", value: rest }] : head;
  return {
    total,
    rows: list.map((x, i) => ({ name: x.name, value: x.value, pct: (x.value / total) * 100, colorIdx: i })),
  };
}

/** Los cinco primeros de la lista que pueden situarse en el mapa (países o regiones conocidas) */
export function countryTop5(rows: CountryRow[]): MapEntry[] {
  return rows
    .filter((r) => r.name !== "Otros" && isosFor(r.name).length > 0)
    .slice(0, 5)
    .map((r, rank) => ({ name: r.name, pct: r.pct, rank, isos: isosFor(r.name) }));
}

/** Código ISO → rango que lo pinta. Si un país aparece en dos entradas, gana la de mayor rango (la primera). */
export function paintMap(entries: MapEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) for (const iso of e.isos) if (!m.has(iso)) m.set(iso, e.rank);
  return m;
}

export function rankOf(name: string, entries: MapEntry[]): number | undefined {
  return entries.find((e) => e.name === name)?.rank;
}

/* ------------------------------------------------------------------
   Sectores
------------------------------------------------------------------ */

export interface SectorRow {
  name: string;
  value: number;
  pct: number;
  colorIdx: number;
}

export function sectorDistribution(holdings: Holding[], top = 8): { total: number; rows: SectorRow[] } {
  const acc = new Map<string, number>();
  for (const h of holdings) {
    const v = holdingValue(h);
    for (const [sector, pct] of h.sectors) acc.set(sector, (acc.get(sector) ?? 0) + (v * pct) / 100);
  }
  const all = [...acc.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const total = all.reduce((s, x) => s + x.value, 0) || 1;
  const head = all.slice(0, top);
  const rest = all.slice(top).reduce((s, x) => s + x.value, 0);
  const list = rest > 0 ? [...head, { name: "Otros sectores", value: rest }] : head;
  return {
    total,
    rows: list.map((x, i) => ({ name: x.name, value: x.value, pct: (x.value / total) * 100, colorIdx: i })),
  };
}

/* ------------------------------------------------------------------
   Posición diaria de un producto (unidades y coste a partir de sus operaciones)
------------------------------------------------------------------ */

function dayIndex(date: string): number {
  const ms = Date.parse(date + "T12:00:00Z");
  const today = Date.parse(TODAY + "T12:00:00Z");
  return FULL_DAYS - 1 - Math.round((today - ms) / DAY);
}

/** Unidades y coste acumulado de cada día (método de coste medio para las ventas) */
export function holdingPath(h: Holding): { units: number[]; cost: number[] } {
  const events = h.operations
    .filter((o) => o.type !== "dividendo")
    .map((o) => ({ d: Math.max(0, dayIndex(o.date)), o }))
    .sort((a, b) => a.d - b.d);
  const units = new Array<number>(FULL_DAYS).fill(0);
  const cost = new Array<number>(FULL_DAYS).fill(0);
  let u = 0;
  let c = 0;
  let ei = 0;
  for (let d = 0; d < FULL_DAYS; d++) {
    while (ei < events.length && events[ei].d <= d) {
      const { o } = events[ei++];
      if (o.type === "venta") {
        const avg = u > 0 ? c / u : 0;
        const q = Math.min(o.units, u);
        u -= q;
        c -= q * avg;
      } else {
        u += o.units;
        c += o.units * o.price + o.fees;
      }
    }
    units[d] = u;
    cost[d] = c;
  }
  return { units, cost };
}

/* ------------------------------------------------------------------
   Aportaciones mensuales por producto
------------------------------------------------------------------ */

export const CONTRIB_MONTHS: Record<string, number> = { "1M": 3, "3M": 3, "6M": 6, "1A": 12, MAX: 24 };

const BASE_YM = "2026-02";
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const monthLabelOf = (ym: string, withYear: boolean) => {
  const [y, m] = ym.split("-").map(Number);
  return withYear ? `${MES[m - 1]} ’${String(y).slice(2)}` : MES[m - 1];
};

export interface ContribResult {
  months: number;
  groups: { label: string; parts: number[] }[];
  keys: { name: string; colorIdx: Holding["colorIdx"]; id: number }[];
  total: number;
  avg: number;
  last: number;
  best: { label: string; value: number };
}

/** Meses (YYYY-MM) que cubre un periodo: presets terminan en febrero 2026; meses y rangos, en su propio calendario */
function monthsOf(period: string): string[] {
  const preset = CONTRIB_MONTHS[period];
  if (preset !== undefined) return Array.from({ length: preset }, (_, i) => addMonthsYM(BASE_YM, -(preset - 1 - i)));
  const { from, to } = periodRange(period);
  const a = from.slice(0, 7);
  const n = monthDiff(a, to.slice(0, 7)) + 1;
  return Array.from({ length: n }, (_, i) => addMonthsYM(a, i));
}

export function monthlyContributions(holdings: Holding[], period: string): ContribResult {
  const yms = monthsOf(period);
  const withYear = yms.length > 12;
  /** Índice de los 24 meses de datos (23 = febrero 2026) */
  const valueAt = (h: Holding, ym: string) => {
    const i = 23 - monthDiff(ym, BASE_YM);
    return i >= 0 && i < 24 ? h.contrib[i] ?? 0 : 0;
  };
  const used = holdings.filter((h) => yms.some((ym) => valueAt(h, ym) > 0));
  const groups = yms.map((ym) => ({ label: monthLabelOf(ym, withYear), parts: used.map((h) => valueAt(h, ym)) }));
  const totals = groups.map((g) => g.parts.reduce((a, b) => a + b, 0));
  const total = totals.reduce((a, b) => a + b, 0);
  const bestIdx = totals.reduce((bi, v, i) => (v > totals[bi] ? i : bi), 0);
  return {
    months: yms.length,
    groups,
    keys: used.map((h) => ({ name: h.nickname, colorIdx: h.colorIdx, id: h.id })),
    total,
    avg: yms.length ? total / yms.length : 0,
    last: totals[totals.length - 1] ?? 0,
    best: { label: groups[bestIdx]?.label ?? "—", value: totals[bestIdx] ?? 0 },
  };
}
