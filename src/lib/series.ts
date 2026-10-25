/* Series temporales y periodos de análisis de la demo.
   "Hoy" es 24/02/2026. Un periodo puede ser:
   · un preset ("1M" | "3M" | "6M" | "1A" | "MAX") que termina hoy,
   · un mes concreto ("m:YYYY-MM"),
   · un rango personalizado ("r:YYYY-MM-DD:YYYY-MM-DD"). */

const DAY = 86400000;
export const TODAY = "2026-02-24";
export const FULL_DAYS = 730;
export const PERIOD_DAYS: Record<string, number> = { "1M": 30, "3M": 90, "6M": 182, "1A": 365, MAX: 730 };

const ms = (iso: string) => Date.parse(iso + "T12:00:00Z");
export function isoFromMs(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  return isoFromMs(ms(iso) + n * DAY);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((ms(b) - ms(a)) / DAY);
}

/** Primer y último día con datos */
export const DATA_FROM = addDays(TODAY, -(FULL_DAYS - 1));
export const DATA_TO = TODAY;

export const isMonthPeriod = (p: string) => p.startsWith("m:");
export const isRangePeriod = (p: string) => p.startsWith("r:");
export const monthOf = (p: string) => p.slice(2);
export const monthPeriod = (ym: string) => `m:${ym}`;
export const rangePeriod = (a: string, b: string) => (a <= b ? `r:${a}:${b}` : `r:${b}:${a}`);

/* ------------------------------ meses (YYYY-MM) ------------------------------ */

export function addMonthsYM(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
/** Meses desde `a` hasta `b` (b − a); negativo si b es anterior */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return by * 12 + bm - (ay * 12 + am);
}
const lastDayOfYM = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0");
};
export const monthEndIso = (ym: string) => `${ym}-${lastDayOfYM(ym)}`;

const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function monthTitle(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${cap(MES_LARGO[m - 1])} ${y}`;
}
export const monthShortLabel = (ym: string) => MES_CORTO[Number(ym.split("-")[1]) - 1];

/* ------------------------------ rango de un periodo ------------------------------ */

const clampDate = (d: string) => (d < DATA_FROM ? DATA_FROM : d > DATA_TO ? DATA_TO : d);

export function periodRange(p: string): { from: string; to: string } {
  if (isMonthPeriod(p)) {
    const ym = monthOf(p);
    const a = clampDate(`${ym}-01`);
    const b = clampDate(monthEndIso(ym));
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }
  if (isRangePeriod(p)) {
    const [, x, y] = p.split(":");
    const a = clampDate(x);
    const b = clampDate(y);
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }
  const days = PERIOD_DAYS[p] ?? 365;
  return { from: addDays(TODAY, -(days - 1)), to: TODAY };
}

export const periodDays = (p: string) => {
  const { from, to } = periodRange(p);
  return daysBetween(from, to) + 1;
};
export const periodMonths = (p: string) => Math.max(1, Math.round(periodDays(p) / 30.4));
export const periodStart = (p: string) => periodRange(p).from;
export function inPeriod(date: string, p: string): boolean {
  const { from, to } = periodRange(p);
  return date >= from && date <= to;
}

const fmtShort = (iso: string) => {
  const d = new Date(ms(iso));
  return `${d.getUTCDate()} ${MES_CORTO[d.getUTCMonth()].toLowerCase()} ${d.getUTCFullYear()}`;
};

export function periodLabel(p: string): string {
  if (isMonthPeriod(p)) return monthTitle(monthOf(p));
  if (isRangePeriod(p)) {
    const { from, to } = periodRange(p);
    return `${fmtShort(from)} – ${fmtShort(to)}`;
  }
  return p === "1M" ? "Últimos 30 días" : p === "3M" ? "Últimos 3 meses" : p === "6M" ? "Últimos 6 meses" : p === "1A" ? "Último año" : "Todo el histórico (24 meses)";
}
export function periodShort(p: string): string {
  if (isMonthPeriod(p)) return monthTitle(monthOf(p));
  if (isRangePeriod(p)) return `${periodDays(p)} días`;
  return p === "1M" ? "30 días" : p === "3M" ? "3 meses" : p === "6M" ? "6 meses" : p === "1A" ? "12 meses" : "24 meses";
}

/* ------------------------------ series ------------------------------ */

export function expandSeries(values: number[], o: { spanDays?: number; seed?: number; noise?: number } = {}): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return Array.from({ length: FULL_DAYS }, () => values[0]);
  const span = o.spanDays ?? FULL_DAYS - 1;
  const seed = o.seed ?? 1;
  const end = values[n - 1];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = Math.max(hi - lo, Math.abs(end) * 0.02, 1e-6);
  const amp = range * (o.noise ?? 0.03);
  const slope = (values[n - 1] - values[0]) / (n - 1);
  const positive = lo >= 0;
  const out: number[] = [];
  for (let d = 0; d < FULL_DAYS; d++) {
    const t = d - (FULL_DAYS - 1 - span);
    const p = (t / span) * (n - 1);
    let base: number;
    if (p <= 0) {
      base = values[0] + slope * p * 0.55;
    } else {
      const i = Math.min(n - 2, Math.floor(p));
      const f = p - i;
      const c = (1 - Math.cos(f * Math.PI)) / 2;
      base = values[i] * (1 - c) + values[i + 1] * c;
    }
    const noise = Math.sin(d * 0.91 + seed) * 0.5 + Math.sin(d * 0.37 + seed * 2.1) * 0.3 + Math.sin(d * 2.3 + seed * 3.7) * 0.2;
    const fade = Math.min(1, (FULL_DAYS - 1 - d) / 4);
    let v = base + noise * amp * fade;
    if (positive && v < 0) v = Math.abs(v) * 0.2;
    out.push(v);
  }
  out[FULL_DAYS - 1] = end;
  return out;
}

export function changePct(values: number[]): number {
  if (values.length < 2 || values[0] === 0) return 0;
  return ((values[values.length - 1] - values[0]) / Math.abs(values[0])) * 100;
}

/** Índice dentro de la serie de 730 días (el último es hoy) */
const idxOf = (date: string) => FULL_DAYS - 1 - daysBetween(date, TODAY);

export function windowSeries(full: number[], p: string): number[] {
  const { from, to } = periodRange(p);
  const a = Math.max(0, Math.min(FULL_DAYS - 1, idxOf(from)));
  const b = Math.max(0, Math.min(FULL_DAYS - 1, idxOf(to)));
  return full.slice(a, b + 1);
}

const dayFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" });
const tidy = (s: string) => s.replace(/\./g, "").replace(/^./, (c) => c.toUpperCase());

export function axisTicks(p: string, n = 6): string[] {
  const { from, to } = periodRange(p);
  const span = daysBetween(from, to);
  return Array.from({ length: n }, (_, i) => {
    const iso = addDays(from, Math.round((span * i) / Math.max(1, n - 1)));
    const t = ms(iso);
    if (span <= 90) return tidy(dayFmt.format(t));
    if (span <= 365) return tidy(monthFmt.format(t));
    return `${tidy(monthFmt.format(t))} ’${new Date(t).getUTCFullYear().toString().slice(2)}`;
  });
}

/* ------------------------------ cubos (semanas / meses) ------------------------------ */

export interface Bucket {
  label: string;
  a: number;
  b: number;
}

function bucketPlan(p: string) {
  const { from, to } = periodRange(p);
  const days = daysBetween(from, to) + 1;
  if (days <= 92) return { weekly: true, from, to, n: Math.ceil(days / 7) };
  return { weekly: false, from, to, n: monthDiff(from.slice(0, 7), to.slice(0, 7)) + 1 };
}

const monthLabelShort = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return tidy(monthFmt.format(Date.UTC(y, m - 1, 1)));
};

export function bucketLabels(p: string): string[] {
  const plan = bucketPlan(p);
  return Array.from({ length: plan.n }, (_, i) => {
    if (plan.weekly) return tidy(dayFmt.format(ms(addDays(plan.from, i * 7))));
    const ym = addMonthsYM(plan.from.slice(0, 7), i);
    return plan.n > 12 ? `${monthLabelShort(ym)} ’${ym.slice(2, 4)}` : monthLabelShort(ym);
  });
}

function bucketIndex(plan: ReturnType<typeof bucketPlan>, date: string): number {
  return plan.weekly ? Math.floor(daysBetween(plan.from, date) / 7) : monthDiff(plan.from.slice(0, 7), date.slice(0, 7));
}

export function bucketize<T extends { date: string }>(p: string, items: T[], f: (t: T) => { a?: number; b?: number }): Bucket[] {
  const plan = bucketPlan(p);
  const out: Bucket[] = bucketLabels(p).map((label) => ({ label, a: 0, b: 0 }));
  for (const it of items) {
    if (it.date < plan.from || it.date > plan.to) continue;
    const idx = bucketIndex(plan, it.date);
    if (idx < 0 || idx >= plan.n) continue;
    const r = f(it);
    out[idx].a += r.a ?? 0;
    out[idx].b += r.b ?? 0;
  }
  return out;
}

export function flowsFor(p: string, txs: { date: string; amount: number; categoryId: number }[]): Bucket[] {
  return bucketize(
    p,
    txs.filter((t) => t.categoryId !== 0),
    (t) => (t.amount > 0 ? { a: t.amount } : { b: -t.amount }),
  );
}

/** Valor de la serie al cierre de cada cubo del periodo */
export function sampleAtBuckets(full: number[], p: string): number[] {
  const plan = bucketPlan(p);
  return Array.from({ length: plan.n }, (_, i) => {
    let day: string;
    if (plan.weekly) {
      day = addDays(plan.from, Math.min(i * 7 + 6, daysBetween(plan.from, plan.to)));
    } else {
      const ym = addMonthsYM(plan.from.slice(0, 7), i);
      day = ym === plan.to.slice(0, 7) ? plan.to : monthEndIso(ym);
      if (day > plan.to) day = plan.to;
    }
    return full[Math.max(0, Math.min(FULL_DAYS - 1, idxOf(day)))];
  });
}
