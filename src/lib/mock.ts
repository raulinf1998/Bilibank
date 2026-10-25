/* Datos de ejemplo realistas para replicar "Mi Patrimonio". */

import type { ColorRef } from "./colors";

export type AccountKind = "corriente" | "inversion";

export const KIND_LABEL: Record<AccountKind, string> = {
  corriente: "Cuenta corriente",
  inversion: "Cuenta de inversión",
};

export interface Account {
  id: number;
  name: string;
  kind: AccountKind;
  balance: number;
  initialBalance: number;
  colorIdx: ColorRef;
  history: number[];
  archived?: boolean;
}

export interface Subcategory {
  id: number;
  name: string;
  icon?: string;
  colorIdx?: ColorRef;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  colorIdx: ColorRef;
  kind: "gasto" | "ingreso";
  subcategories: Subcategory[];
}

/** Color efectivo de una subcategoría: el suyo propio o, si no tiene, el de su categoría. */
export function subColor(c: Category, s: Subcategory): ColorRef {
  return s.colorIdx ?? c.colorIdx;
}

export function subIconKey(s: Subcategory): string {
  return s.icon ?? "tag";
}

export interface Tx {
  id: number;
  date: string;
  concept: string;
  categoryId: number;
  subcategoryId: number;
  accountId: number;
  amount: number;
  tags?: string[];
  note?: string;
}

export interface Operation {
  id: number;
  date: string;
  type: "compra" | "venta" | "dividendo" | "aportacion";
  units: number;
  price: number;
  fees: number;
}

export type HoldingCategory = "Cripto" | "Materias primas" | "Fondo monetario" | "Fondo indexado" | "Acciones";
export const HOLDING_CATEGORIES: HoldingCategory[] = ["Fondo indexado", "Acciones", "Cripto", "Materias primas", "Fondo monetario"];

export interface Holding {
  id: number;
  accountId: number;
  ticker: string;
  isin: string;
  name: string;
  type: "ETF" | "Fondo" | "Acción" | "Cripto" | "Pensiones";
  currency: string;
  units: number;
  price: number;
  invested: number;
  change1d: number;
  spark: number[];
  prices: number[];
  colorIdx: ColorRef;
  source: string;
  operations: Operation[];
  /** Apodo corto que se usa en tablas y gráficos */
  nickname: string;
  category: HoldingCategory;
  /** Principales empresas o emisores con su peso sobre el producto */
  top: [string, number][];
  /** Sectores económicos con su peso (suman 100) */
  sectors: [string, number][];
  /** Exposición por país o región (los porcentajes suman 100) */
  countries: [string, number][];
  /** Aportaciones de los últimos 24 meses en euros (índice 23 = mes actual) */
  contrib: number[];
}

export interface MonthPoint {
  label: string;
  patrimonio: number;
  inversion: number;
  efectivo: number;
  ingresos: number;
  gastos: number;
}

/* ---------------------------------------------------------------
   Cuentas: 6 corrientes + 4 inversión
---------------------------------------------------------------- */

const hist = (end: number, drift: number, seed: number) =>
  Array.from({ length: 12 }, (_, i) => Math.round(end - drift * (11 - i) + Math.sin(i * 1.7 + seed) * drift * 0.6));

export const ACCOUNTS: Account[] = [
  { id: 1, name: "Cuenta Nómina", kind: "corriente", balance: 4820.44, initialBalance: 3200, colorIdx: 0, history: hist(4820, 140, 1) },
  { id: 2, name: "Cuenta Corriente", kind: "corriente", balance: 1265.18, initialBalance: 1500, colorIdx: 7, history: hist(1265, -22, 2) },
  { id: 3, name: "Cuenta Conjunta", kind: "corriente", balance: 890.02, initialBalance: 600, colorIdx: 2, history: hist(890, 24, 3) },
  { id: 4, name: "Cuenta Ahorro", kind: "corriente", balance: 6400.0, initialBalance: 4200, colorIdx: 3, history: hist(6400, 180, 4) },
  { id: 5, name: "Cuenta Remunerada", kind: "corriente", balance: 12000.0, initialBalance: 10000, colorIdx: 4, history: hist(12000, 160, 5) },
  { id: 6, name: "Efectivo", kind: "corriente", balance: 140.0, initialBalance: 200, colorIdx: 5, history: hist(140, -4, 6) },
  { id: 7, name: "Cartera Indexada", kind: "inversion", balance: 40500, initialBalance: 30000, colorIdx: 8, history: hist(38420, 820, 7) },
  { id: 8, name: "ETFs y acciones", kind: "inversion", balance: 24500, initialBalance: 15000, colorIdx: 1, history: hist(22200, 440, 8) },
  { id: 9, name: "Cripto", kind: "inversion", balance: 3361.4, initialBalance: 2730, colorIdx: 6, history: hist(3361, 32, 9) },
  { id: 10, name: "Plan de Pensiones", kind: "inversion", balance: 9241.12, initialBalance: 8400, colorIdx: 9, history: hist(9241, 72, 10) },
];

export const CURRENT_ACCOUNTS = ACCOUNTS.filter((a) => a.kind === "corriente");
export const INVEST_ACCOUNTS = ACCOUNTS.filter((a) => a.kind === "inversion");
export const LIQUID = CURRENT_ACCOUNTS.reduce((s, a) => s + a.balance, 0);
export const INVESTED = INVEST_ACCOUNTS.reduce((s, a) => s + a.balance, 0);
export const NET_WORTH = LIQUID + INVESTED;

/* ---------------------------------------------------------------
   Categorías: 8 principales × 5 subcategorías
---------------------------------------------------------------- */

const SUB_ICON: Record<string, string> = {
  "Alquiler": "home", "Luz": "zap", "Agua": "drop", "Internet y móvil": "phone", "Comunidad y seguro": "shield",
  "Supermercado": "cart", "Carnicería y pescadería": "utensils", "Panadería": "croissant", "Bebidas": "wine", "Comida a domicilio": "bike",
  "Gasolina": "fuel", "Transporte público": "train", "Parking": "parking", "Peajes": "car", "Mantenimiento": "tools",
  "Restaurantes": "utensils", "Cine y teatro": "film", "Viajes": "plane", "Deporte": "gym", "Libros y juegos": "book",
  "Farmacia": "pill", "Médico": "steth", "Dentista": "plus", "Óptica": "glasses", "Seguro médico": "shield",
  "Ropa": "shirt", "Electrónica": "laptop", "Muebles y decoración": "sofa", "Regalos": "gift", "Amazon": "bag",
  "Streaming": "film", "Música": "music", "Software": "code", "Gimnasio": "gym", "Prensa": "book",
  "Nómina": "work", "Dividendos": "piggy", "Intereses": "chart", "Ventas segunda mano": "tag", "Otros ingresos": "wallet",
};

/** Las subcategorías heredan el color de su categoría salvo que se les asigne uno propio. */
const sub = (base: number, names: string[]): Subcategory[] =>
  names.map((name, i) => ({ id: base * 10 + i + 1, name, icon: SUB_ICON[name] ?? "tag" }));

export const CATEGORIES: Category[] = [
  { id: 1, name: "Hogar", icon: "home", colorIdx: 0, kind: "gasto", subcategories: sub(1, ["Alquiler", "Luz", "Agua", "Internet y móvil", "Comunidad y seguro"]) },
  { id: 2, name: "Alimentación", icon: "cart", colorIdx: 1, kind: "gasto", subcategories: sub(2, ["Supermercado", "Carnicería y pescadería", "Panadería", "Bebidas", "Comida a domicilio"]) },
  { id: 3, name: "Transporte", icon: "car", colorIdx: 2, kind: "gasto", subcategories: sub(3, ["Gasolina", "Transporte público", "Parking", "Peajes", "Mantenimiento"]) },
  { id: 4, name: "Ocio", icon: "party", colorIdx: 3, kind: "gasto", subcategories: sub(4, ["Restaurantes", "Cine y teatro", "Viajes", "Deporte", "Libros y juegos"]) },
  { id: 5, name: "Salud", icon: "heart", colorIdx: 4, kind: "gasto", subcategories: sub(5, ["Farmacia", "Médico", "Dentista", "Óptica", "Seguro médico"]) },
  { id: 6, name: "Compras", icon: "bag", colorIdx: 5, kind: "gasto", subcategories: sub(6, ["Ropa", "Electrónica", "Muebles y decoración", "Regalos", "Amazon"]) },
  { id: 7, name: "Suscripciones", icon: "play", colorIdx: 6, kind: "gasto", subcategories: sub(7, ["Streaming", "Música", "Software", "Gimnasio", "Prensa"]) },
  { id: 8, name: "Ingresos", icon: "wallet", colorIdx: 7, kind: "ingreso", subcategories: sub(8, ["Nómina", "Dividendos", "Intereses", "Ventas segunda mano", "Otros ingresos"]) },
];

export const CATEGORY_BY_ID: Record<number, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export function subName(subId: number): string {
  for (const c of CATEGORIES) {
    const s = c.subcategories.find((x) => x.id === subId);
    if (s) return s.name;
  }
  return "—";
}

/* ---------------------------------------------------------------
   Movimientos generados de forma determinista (dic → feb)
---------------------------------------------------------------- */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const TEMPLATES: { concept: string; cat: number; sub: number; min: number; max: number; acc: number[]; freq: number }[] = [
  { concept: "Alquiler", cat: 1, sub: 11, min: 780, max: 780, acc: [1], freq: 1 },
  { concept: "Iberdrola · Luz", cat: 1, sub: 12, min: 48, max: 74, acc: [2], freq: 1 },
  { concept: "Canal de Isabel II", cat: 1, sub: 13, min: 18, max: 26, acc: [2], freq: 0.5 },
  { concept: "Digi · Fibra y móvil", cat: 1, sub: 14, min: 32, max: 32, acc: [2], freq: 1 },
  { concept: "Mercadona", cat: 2, sub: 21, min: 24, max: 96, acc: [1, 3], freq: 5 },
  { concept: "Lidl", cat: 2, sub: 21, min: 18, max: 60, acc: [1, 2], freq: 2 },
  { concept: "Pescadería Marisol", cat: 2, sub: 22, min: 14, max: 38, acc: [3, 6], freq: 1.5 },
  { concept: "Panadería La Espiga", cat: 2, sub: 23, min: 2.4, max: 7, acc: [6], freq: 3 },
  { concept: "Glovo", cat: 2, sub: 25, min: 16, max: 34, acc: [3], freq: 1.5 },
  { concept: "Repsol", cat: 3, sub: 31, min: 45, max: 70, acc: [1], freq: 1.5 },
  { concept: "Abono transporte", cat: 3, sub: 32, min: 27.3, max: 27.3, acc: [3], freq: 1 },
  { concept: "Parking Centro", cat: 3, sub: 33, min: 3, max: 12, acc: [6], freq: 1 },
  { concept: "Restaurante Lamorrea", cat: 4, sub: 41, min: 28, max: 68, acc: [1, 3], freq: 2 },
  { concept: "Yelmo Cines", cat: 4, sub: 42, min: 9, max: 24, acc: [3], freq: 0.7 },
  { concept: "Padel Indoor", cat: 4, sub: 44, min: 8, max: 16, acc: [3], freq: 2 },
  { concept: "Casa del Libro", cat: 4, sub: 45, min: 12, max: 30, acc: [1], freq: 0.6 },
  { concept: "Farmacia Soler", cat: 5, sub: 51, min: 6, max: 28, acc: [2], freq: 1.2 },
  { concept: "Clínica Dental", cat: 5, sub: 53, min: 45, max: 90, acc: [2], freq: 0.3 },
  { concept: "Zara", cat: 6, sub: 61, min: 25, max: 80, acc: [1], freq: 0.8 },
  { concept: "Amazon", cat: 6, sub: 65, min: 12, max: 65, acc: [3], freq: 1.6 },
  { concept: "Netflix", cat: 7, sub: 71, min: 13.99, max: 13.99, acc: [3], freq: 1 },
  { concept: "Spotify", cat: 7, sub: 72, min: 10.99, max: 10.99, acc: [3], freq: 1 },
  { concept: "iCloud", cat: 7, sub: 73, min: 2.99, max: 2.99, acc: [3], freq: 1 },
  { concept: "Gimnasio Metropolitan", cat: 7, sub: 74, min: 39, max: 39, acc: [2], freq: 1 },
];

function buildTransactions(): Tx[] {
  const rand = rng(20260224);
  const out: Tx[] = [];
  let id = 1;
  const months = Array.from({ length: 24 }, (_, i) => new Date(Date.UTC(2026, 1 - (23 - i), 1)).toISOString().slice(0, 7));
  for (const m of months) {
    out.push({ id: id++, date: m === "2026-02" ? "2026-02-24" : `${m}-25`, concept: "Nómina", categoryId: 8, subcategoryId: 81, accountId: 1, amount: 2340 });
    out.push({ id: id++, date: `${m}-02`, concept: "Intereses cuenta remunerada", categoryId: 8, subcategoryId: 83, accountId: 5, amount: 31.4 + rand() * 4 });
    for (const t of TEMPLATES) {
      const n = Math.floor(t.freq) + (rand() < t.freq % 1 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const day = 1 + Math.floor(rand() * (m === "2026-02" ? 24 : 28));
        const amount = -(t.min + rand() * (t.max - t.min));
        out.push({
          id: id++,
          date: `${m}-${String(day).padStart(2, "0")}`,
          concept: t.concept,
          categoryId: t.cat,
          subcategoryId: t.sub,
          accountId: t.acc[Math.floor(rand() * t.acc.length)],
          amount: Math.round(amount * 100) / 100,
          tags: t.cat === 4 && rand() > 0.6 ? ["fin de semana"] : undefined,
        });
      }
    }
  }
  out.push({ id: id++, date: "2026-02-15", concept: "Dividendo VWCE", categoryId: 8, subcategoryId: 82, accountId: 8, amount: 42.66 });
  out.push({ id: id++, date: "2026-01-14", concept: "Venta bici Wallapop", categoryId: 8, subcategoryId: 84, accountId: 3, amount: 120 });
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  return out;
}

export const TRANSACTIONS: Tx[] = buildTransactions();

/* ---------------------------------------------------------------
   Productos de inversión
---------------------------------------------------------------- */

const series = (end: number, drift: number, vol: number, seed: number) => {
  const r = rng(seed);
  const arr: number[] = [];
  let v = end - drift * 24;
  for (let i = 0; i < 24; i++) {
    v += drift + (r() - 0.5) * vol;
    arr.push(Math.round(v * 100) / 100);
  }
  arr[arr.length - 1] = end;
  return arr;
};

const ops = (list: [string, Operation["type"], number, number][]): Operation[] =>
  list.map(([date, type, units, price], i) => ({ id: i + 1, date, type, units, price, fees: type === "compra" ? 1 : 0 }));

const RAW_HOLDINGS: Omit<Holding, "spark" | "countries" | "contrib" | "nickname" | "category" | "top" | "sectors">[] = [
  { id: 1, accountId: 7, ticker: "VWRL", isin: "IE00B3RBWM25", name: "Vanguard Global Stock Index", type: "Fondo", currency: "EUR", units: 412.73, price: 44.2, invested: 15400, change1d: 0.42, colorIdx: 0, source: "Morningstar", prices: series(44.2, 0.21, 0.9, 11), operations: ops([["2024-03-04", "compra", 120, 36.1], ["2024-09-02", "compra", 110, 38.4], ["2025-03-03", "compra", 95, 41.2], ["2025-11-03", "compra", 87.73, 43.1]]) },
  { id: 2, accountId: 7, ticker: "VEM", isin: "IE0031786142", name: "Vanguard Emerging Markets", type: "Fondo", currency: "EUR", units: 268.1, price: 28.6, invested: 7000, change1d: -0.31, colorIdx: 7, source: "Morningstar", prices: series(28.6, 0.08, 0.7, 12), operations: ops([["2024-05-06", "compra", 140, 25.2], ["2025-05-05", "compra", 128.1, 27.1]]) },
  { id: 3, accountId: 7, ticker: "AMWD", isin: "LU1437016972", name: "Amundi Index MSCI World", type: "Fondo", currency: "EUR", units: 31.4, price: 296.1, invested: 8300, change1d: 0.55, colorIdx: 2, source: "Morningstar", prices: series(296.1, 1.6, 6, 13), operations: ops([["2024-01-08", "compra", 18, 252.4], ["2025-01-07", "compra", 13.4, 280.6]]) },
  { id: 4, accountId: 8, ticker: "VWCE", isin: "IE00BK5BQT80", name: "Vanguard FTSE All-World UCITS ETF", type: "ETF", currency: "EUR", units: 78.4, price: 132.44, invested: 8900, change1d: 0.62, colorIdx: 9, source: "Yahoo", prices: series(132.44, 0.7, 2.6, 14), operations: ops([["2024-02-12", "compra", 30, 104.2], ["2024-10-14", "compra", 25, 118.9], ["2025-06-09", "compra", 23.4, 126.3], ["2026-02-15", "dividendo", 0, 42.66]]) },
  { id: 5, accountId: 8, ticker: "IWDA", isin: "IE00B4L5Y983", name: "iShares Core MSCI World", type: "ETF", currency: "EUR", units: 82.1, price: 101.2, invested: 7100, change1d: 0.34, colorIdx: 1, source: "Yahoo", prices: series(101.2, 0.5, 1.9, 15), operations: ops([["2024-04-08", "compra", 45, 82.1], ["2025-04-07", "compra", 37.1, 91.6]]) },
  { id: 6, accountId: 8, ticker: "MSFT", isin: "US5949181045", name: "Microsoft Corp.", type: "Acción", currency: "USD", units: 4, price: 398.2, invested: 1380, change1d: 1.12, colorIdx: 10, source: "Yahoo", prices: series(398.2, 1.1, 9, 16), operations: ops([["2024-07-15", "compra", 4, 345]]) },
  { id: 7, accountId: 8, ticker: "ASML", isin: "NL0010273215", name: "ASML Holding", type: "Acción", currency: "EUR", units: 1.5, price: 712.0, invested: 980, change1d: -0.8, colorIdx: 4, source: "Yahoo", prices: series(712, 1.4, 22, 17), operations: ops([["2025-02-10", "compra", 2, 650], ["2025-10-13", "venta", 0.5, 690]]) },
  { id: 8, accountId: 9, ticker: "BTC", isin: "—", name: "Bitcoin", type: "Cripto", currency: "EUR", units: 0.0312, price: 62140, invested: 1750, change1d: -2.18, colorIdx: 5, source: "CoinGecko", prices: series(62140, 120, 2400, 18), operations: ops([["2024-06-03", "compra", 0.02, 56000], ["2025-01-13", "compra", 0.0112, 57800]]) },
  { id: 9, accountId: 9, ticker: "ETH", isin: "—", name: "Ethereum", type: "Cripto", currency: "EUR", units: 0.41, price: 3104, invested: 980, change1d: 1.04, colorIdx: 11, source: "CoinGecko", prices: series(3104, 14, 150, 19), operations: ops([["2024-08-05", "compra", 0.41, 2390]]) },
  { id: 10, accountId: 10, ticker: "INDEXA PP", isin: "N5137", name: "Indexa Más Rentabilidad Acciones PP", type: "Pensiones", currency: "EUR", units: 612.4, price: 15.09, invested: 8400, change1d: 0.11, colorIdx: 8, source: "Manual", prices: series(15.09, 0.04, 0.12, 20), operations: ops([["2024-01-15", "aportacion", 200, 12.9], ["2024-07-15", "aportacion", 206, 13.6], ["2025-01-15", "aportacion", 206.4, 14.3]]) },
  { id: 11, accountId: 8, ticker: "SGLN", isin: "IE00B4ND3602", name: "Physical Gold ETC", type: "ETF", currency: "EUR", units: 20, price: 62, invested: 1132, change1d: 0.27, colorIdx: 10, source: "Yahoo", prices: series(62, 0.1, 1.2, 21), operations: ops([["2024-09-10", "compra", 10, 55], ["2025-06-02", "compra", 10, 58]]) },
  { id: 12, accountId: 7, ticker: "AMEL", isin: "FR0010510800", name: "Amundi Euro Liquidity", type: "Fondo", currency: "EUR", units: 300, price: 10.5, invested: 3017, change1d: 0.01, colorIdx: 11, source: "Morningstar", prices: series(10.5, 0.01, 0.05, 22), operations: ops([["2024-03-01", "compra", 150, 10.0], ["2025-03-03", "compra", 150, 10.1]]) },
];
const ALL_WORLD: [string, number][] = [["Estados Unidos", 62], ["Japón", 6.2], ["Reino Unido", 3.6], ["Canadá", 3], ["Francia", 2.8], ["Suiza", 2.4], ["Alemania", 2.2], ["China", 2.1], ["India", 1.9], ["Otros", 13.8]];
const WORLD: [string, number][] = [["Estados Unidos", 71], ["Japón", 6.4], ["Reino Unido", 3.9], ["Canadá", 3.2], ["Francia", 3.1], ["Suiza", 2.6], ["Alemania", 2.4], ["Otros", 7.4]];
const EMERGING: [string, number][] = [["China", 29], ["India", 18], ["Taiwán", 17], ["Corea del Sur", 11], ["Brasil", 5], ["Arabia Saudí", 4], ["Sudáfrica", 3], ["México", 2], ["Otros", 11]];
const PENSION: [string, number][] = [["Estados Unidos", 58], ["Europa (sin España)", 18], ["Mercados emergentes", 10], ["Japón", 6], ["España", 3], ["Otros", 5]];
const COUNTRIES_BY_ID: Record<number, [string, number][]> = {
  1: ALL_WORLD, 2: EMERGING, 3: WORLD, 4: ALL_WORLD, 5: WORLD,
  6: [["Estados Unidos", 100]], 7: [["Países Bajos", 100]],
  8: [["Global (cripto)", 100]], 9: [["Global (cripto)", 100]], 10: PENSION,
};

/** Plan de aportación mensual por producto: [importe base, mes de inicio] */
const PLAN: Record<number, [number, number]> = { 12: [30, 0], 1: [220, 0], 4: [150, 0], 5: [100, 1], 2: [70, 2], 10: [100, 0], 8: [40, 3], 9: [20, 5] };
/** Compras puntuales (índice de mes) de productos sin plan periódico */
const LUMPS: Record<number, number[]> = { 3: [10, 22], 6: [4], 7: [11, 19], 11: [6, 14] };

function contribSeries(id: number): number[] {
  const r = rng(900 + id);
  const plan = PLAN[id];
  const lumps = LUMPS[id] ?? [];
  return Array.from({ length: 24 }, (_, i) => {
    let v = 0;
    if (plan && i >= plan[1] && r() > 0.07) v += Math.round((plan[0] * (0.9 + r() * 0.2)) / 5) * 5;
    if (lumps.includes(i)) v += Math.round((300 + r() * 400) / 10) * 10;
    return v;
  });
}

const WORLD_TOP: [string, number][] = [["Apple", 4.7], ["Microsoft", 4.4], ["Nvidia", 4.2], ["Amazon", 2.6], ["Alphabet", 2.4], ["Meta Platforms", 1.7], ["Broadcom", 1.4], ["Tesla", 1.2], ["Berkshire Hathaway", 1.0], ["JPMorgan Chase", 1.0]];
const EM_TOP: [string, number][] = [["TSMC", 9.4], ["Tencent", 4.2], ["Samsung Electronics", 3.6], ["Alibaba", 2.3], ["Reliance Industries", 1.7], ["Meituan", 1.3], ["Infosys", 1.2], ["HDFC Bank", 1.2], ["PDD Holdings", 0.9], ["Vale", 0.8]];
const MONEY_TOP: [string, number][] = [["Letras del Tesoro francés", 18], ["Bonos del Estado alemán", 14], ["BNP Paribas (depósitos)", 9], ["Société Générale (depósitos)", 7], ["Banco Santander (depósitos)", 6], ["Deutsche Bank (depósitos)", 5], ["Bonos del Estado italiano", 5], ["Caisse des Dépôts", 4], ["Bonos del Estado neerlandés", 4], ["Crédit Agricole (depósitos)", 3]];

/** Apodo, categoría, principales posiciones y, si hace falta, países de cada producto */
const META: Record<number, { nickname: string; category: HoldingCategory; top: [string, number][]; countries?: [string, number][] }> = {
  1: { nickname: "Vanguard Global", category: "Fondo indexado", top: WORLD_TOP },
  2: { nickname: "Vanguard Emergentes", category: "Fondo indexado", top: EM_TOP },
  3: { nickname: "Amundi World", category: "Fondo indexado", top: WORLD_TOP },
  4: { nickname: "All-World", category: "Fondo indexado", top: WORLD_TOP },
  5: { nickname: "iShares World", category: "Fondo indexado", top: WORLD_TOP },
  6: { nickname: "Microsoft", category: "Acciones", top: [["Microsoft", 100]] },
  7: { nickname: "ASML", category: "Acciones", top: [["ASML Holding", 100]] },
  8: { nickname: "Bitcoin", category: "Cripto", top: [["Bitcoin", 100]] },
  9: { nickname: "Ethereum", category: "Cripto", top: [["Ethereum", 100]] },
  10: { nickname: "Indexa PP", category: "Fondo indexado", top: WORLD_TOP },
  11: { nickname: "Oro físico", category: "Materias primas", top: [["Oro físico (lingotes LBMA)", 100]], countries: [["Global", 100]] },
  12: { nickname: "Monetario EUR", category: "Fondo monetario", top: MONEY_TOP, countries: [["Francia", 40], ["Alemania", 30], ["Italia", 12], ["Otros", 18]] },
};

const SEC_WORLD: [string, number][] = [["Tecnología", 24], ["Financiero", 16], ["Industria", 11], ["Salud", 10], ["Consumo cíclico", 10], ["Consumo básico", 7], ["Comunicación", 8], ["Energía", 4], ["Materiales", 4], ["Inmobiliario", 2], ["Servicios públicos", 2], ["Otros", 2]];
const SEC_WORLD_B: [string, number][] = [["Tecnología", 25], ["Financiero", 15], ["Industria", 12], ["Salud", 11], ["Consumo cíclico", 10], ["Consumo básico", 6], ["Comunicación", 8], ["Energía", 3], ["Materiales", 4], ["Inmobiliario", 2], ["Servicios públicos", 2], ["Otros", 2]];
const SEC_EM: [string, number][] = [["Tecnología", 28], ["Financiero", 22], ["Consumo cíclico", 13], ["Comunicación", 10], ["Materiales", 7], ["Energía", 5], ["Consumo básico", 5], ["Industria", 4], ["Salud", 3], ["Otros", 3]];
const SEC_MIXED: [string, number][] = [["Tecnología", 22], ["Financiero", 16], ["Consumo cíclico", 15], ["Industria", 12], ["Salud", 10], ["Comunicación", 8], ["Bonos gubernamentales", 5], ["Energía", 5], ["Materiales", 4], ["Inmobiliario", 3]];
const SEC_TECH: [string, number][] = [["Tecnología", 100]];
const SEC_CRYPTO: [string, number][] = [["Criptoactivos", 100]];
const SEC_GOLD: [string, number][] = [["Metales preciosos", 100]];
const SEC_MONEY: [string, number][] = [["Bonos gubernamentales", 60], ["Financiero", 30], ["Efectivo y equivalentes", 10]];
const SECTOR_BY_ID: Record<number, [string, number][]> = {
  1: SEC_WORLD, 2: SEC_EM, 3: SEC_WORLD_B, 4: SEC_WORLD, 5: SEC_WORLD, 6: SEC_TECH, 7: SEC_TECH, 8: SEC_CRYPTO, 9: SEC_CRYPTO,
  10: SEC_MIXED, 11: SEC_GOLD, 12: SEC_MONEY,
};

export const HOLDINGS: Holding[] = RAW_HOLDINGS.map((h) => ({
  ...h,
  nickname: META[h.id]?.nickname ?? h.ticker,
  category: META[h.id]?.category ?? "Fondo indexado",
  top: META[h.id]?.top ?? [["Sin desglose", 100]],
  sectors: SECTOR_BY_ID[h.id] ?? [["Sin clasificar", 100]],
  spark: h.prices.filter((_, i) => i % 2 === 1),
  countries: COUNTRIES_BY_ID[h.id] ?? META[h.id]?.countries ?? [["Sin clasificar", 100]],
  contrib: contribSeries(h.id),
}));

export const HOLDING_BY_ID: Record<number, Holding> = Object.fromEntries(HOLDINGS.map((h) => [h.id, h]));
export const PORTFOLIO_VALUE = HOLDINGS.reduce((s, h) => s + h.units * h.price, 0);
export const PORTFOLIO_INVESTED = HOLDINGS.reduce((s, h) => s + h.invested, 0);
export const holdingValue = (h: Holding) => h.units * h.price;

/* ---------------------------------------------------------------
   Series mensuales y KPIs
---------------------------------------------------------------- */

const MONTH_LABELS = ["Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb"];
const F_NET = [0.79, 0.81, 0.8, 0.83, 0.855, 0.84, 0.865, 0.89, 0.915, 0.905, 0.965, 1];
const F_INV = [0.74, 0.76, 0.745, 0.785, 0.81, 0.79, 0.82, 0.855, 0.885, 0.87, 0.95, 1];
const F_LIQ = [0.9, 0.91, 0.915, 0.93, 0.945, 0.94, 0.955, 0.965, 0.975, 0.98, 0.99, 1];
const FLOWS: [number, number][] = [[2480, 1720], [2510, 1880], [2390, 2050], [2640, 1610], [2720, 1980], [2410, 2260], [2560, 1740], [2610, 1830], [2780, 1960], [3120, 2680], [2690, 1870], [2382, 1505]];

export const SERIES: MonthPoint[] = MONTH_LABELS.map((label, i) => ({
  label,
  patrimonio: Math.round(NET_WORTH * F_NET[i]),
  inversion: Math.round(INVESTED * F_INV[i]),
  efectivo: Math.round(LIQUID * F_LIQ[i]),
  ingresos: FLOWS[i][0],
  gastos: FLOWS[i][1],
}));

export const KPI = {
  netWorth: NET_WORTH,
  netWorthChange: 3.42,
  netWorthDelta: 2794.18,
  invested: INVESTED,
  investedChange: 8.91,
  liquid: LIQUID,
  liquidChange: -1.24,
  xirr: 9.34,
  savingsRate: 36.8,
  emergencyFundMonths: 12.6,
};

export const NAV = [
  { id: "panel", label: "Panel", icon: "grid" },
  { id: "cuentas", label: "Cuentas", icon: "wallet" },
  { id: "inversiones", label: "Inversiones", icon: "briefcase" },
  { id: "categorias", label: "Categorías", icon: "folder" },
  { id: "graficas", label: "Gráficas", icon: "chart" },
  { id: "ajustes", label: "Ajustes", icon: "settings" },
] as const;

export type NavId = (typeof NAV)[number]["id"];

export const PERIODS = [
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "6M", label: "6M" },
  { id: "1A", label: "1A" },
  { id: "MAX", label: "Max" },
];
