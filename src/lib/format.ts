const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const eur0 = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const num = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const pct = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export const formatEUR = (v: number) => eur.format(v);
export const formatEUR0 = (v: number) => eur0.format(v);
export const formatNum = (v: number) => num.format(v);
export const formatPct = (v: number) => pct.format(v / 100);
export const formatSigned = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${eur.format(Math.abs(v))}`;
export const formatCompact = (v: number) =>
  new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

export function formatFullDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
