/* Exportador CSV de todos los datos de Bilibank.

   Genera un conjunto de ficheros CSV (uno por entidad) listos para abrir en
   Excel, Numbers, LibreOffice o cargar en cualquier herramienta de análisis:

   · cuentas.csv        todas las cuentas, su saldo y su valor invertido
   · categorias.csv     categorías y subcategorías con sus totales
   · movimientos.csv    todos los apuntes (gastos, ingresos y traspasos)
   · traspasos.csv      traspasos emparejados con origen y destino
   · inversiones.csv    productos en cartera con valor, coste y rentabilidad
   · operaciones.csv    compras, ventas, dividendos y aportaciones
   · composicion.csv    sectores, países y principales posiciones por producto
   · resumen.csv        totales del patrimonio y recuento de datos

   Formato: separador «;» y decimales con coma (Excel en español), UTF-8 con
   BOM para que los acentos se lean bien, y saltos de línea CRLF.
*/

import { zipSync, strToU8 } from "fflate";
import { holdingValue, type Account, type Category, type Holding, type Tx } from "./mock";
import { isTransfer, runningBalances, transferEndpoints } from "./ledger";
import { todayIso } from "./market";

export interface ExportPayload {
  accounts: Account[];
  categories: Category[];
  holdings: Holding[];
  transactions: Tx[];
}

export interface CsvFile {
  /** Identificador estable para seleccionar qué se descarga. */
  key: string;
  /** Nombre del fichero dentro del ZIP (sin fecha). */
  filename: string;
  label: string;
  description: string;
  /** Número de filas de datos (sin cabecera). */
  rows: number;
  content: string;
}

const SEP = ";";
const EOL = "\r\n";

/** Número con dos decimales y coma, como en el resto de la app. */
const num = (v: number | undefined | null): string =>
  typeof v === "number" && Number.isFinite(v) ? (Math.round(v * 100) / 100).toFixed(2).replace(".", ",") : "";

/** Porcentaje con dos decimales y coma (sin el símbolo). */
const pct = (v: number): string => (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");

/**
 * Celda CSV: comillas siempre, comillas internas duplicadas. Evita que Excel
 * interprete como fórmula un texto que empiece por =, +, -, @.
 */
function cell(value: unknown): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Construye el CSV a partir de la cabecera y las filas. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(cell).join(SEP)).join(EOL);
}

/** Fecha ISO (YYYY-MM-DD) → fecha de la hoja de cálculo (DD/MM/AAAA). */
const date = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso ?? "";
};

const colorName = (c: unknown): string => (typeof c === "string" ? c : String(c ?? ""));

/** Todos los CSV disponibles, ya construidos. */
export function buildCsvFiles(data: ExportPayload): CsvFile[] {
  const { accounts, categories, holdings, transactions } = data;
  const balances = runningBalances(accounts, transactions);
  const dateStamp = todayIso();

  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? "";

  /* ------------------------------ cuentas ------------------------------ */
  const accountRows = accounts.map((a) => {
    const own = transactions.filter((t) => t.accountId === a.id);
    const products = holdings.filter((h) => h.accountId === a.id);
    const invested = products.reduce((s, h) => s + holdingValue(h), 0);
    return [
      a.name,
      a.kind === "inversion" ? "Inversión" : "Corriente",
      num(a.balance),
      num(a.initialBalance),
      a.archived ? "Sí" : "No",
      products.length,
      num(invested),
      num(a.kind === "inversion" ? a.balance - invested : 0),
      own.length,
      own.length ? date(own[0].date) : "",
      own.length ? date(own[own.length - 1].date) : "",
      colorName(a.colorIdx),
    ];
  });

  /* ------------------------------ categorías ------------------------------ */
  const categoryRows: unknown[][] = [];
  for (const c of categories) {
    const txs = transactions.filter((t) => t.categoryId === c.id);
    if (!c.subcategories.length) {
      categoryRows.push([
        c.name, c.kind === "ingreso" ? "Ingreso" : "Gasto", "", c.icon, colorName(c.colorIdx),
        txs.length, num(Math.abs(txs.reduce((s, t) => s + t.amount, 0))),
      ]);
      continue;
    }
    for (const s of c.subcategories) {
      const subs = txs.filter((t) => t.subcategoryId === s.id);
      categoryRows.push([
        c.name,
        c.kind === "ingreso" ? "Ingreso" : "Gasto",
        s.name,
        s.icon ?? c.icon,
        colorName(s.colorIdx ?? c.colorIdx),
        subs.length,
        num(Math.abs(subs.reduce((sum, t) => sum + t.amount, 0))),
      ]);
    }
  }

  /* ------------------------------ movimientos ------------------------------ */
  const movementRows = transactions.map((t) => {
    const cat = categories.find((c) => c.id === t.categoryId);
    const sub = cat?.subcategories.find((s) => s.id === t.subcategoryId);
    const ends = isTransfer(t) ? transferEndpoints(t, transactions, accounts) : null;
    const product = typeof t.productId === "number" ? holdings.find((h) => h.id === t.productId) : undefined;
    return [
      date(t.date),
      t.date,
      t.concept,
      isTransfer(t) ? "Traspaso" : t.amount >= 0 ? "Ingreso" : "Gasto",
      accountName(t.accountId),
      ends?.from?.name ?? "",
      ends?.to?.name ?? "",
      isTransfer(t) ? "Traspaso" : cat?.name ?? "Sin categoría",
      sub?.name ?? "",
      num(t.amount),
      num(balances.get(t.id)),
      (t.tags ?? []).join(" "),
      t.note ?? "",
      product ? `${product.nickname || product.name} (${product.ticker})` : "",
      typeof t.operationId === "number" ? t.operationId : "",
    ];
  });

  /* ------------------------------ traspasos ------------------------------ */
  /* Cada traspaso son dos apuntes: se exporta una sola fila por traspaso,
     con la cuenta de origen, la de destino y el importe (positivo). */
  const transferRows: unknown[][] = [];
  for (const t of transactions) {
    if (!isTransfer(t)) continue;
    const ends = transferEndpoints(t, transactions, accounts);
    if (ends.from && ends.to && t.amount > 0) continue; // ya exportado desde la salida
    transferRows.push([date(t.date), t.date, ends.from?.name ?? accountName(t.accountId), ends.to?.name ?? "", num(Math.abs(t.amount)), t.concept]);
  }

  /* ------------------------------ inversiones ------------------------------ */
  const portfolioValue = holdings.reduce((s, h) => s + holdingValue(h), 0);
  const holdingRows = holdings.map((h) => {
    const value = holdingValue(h);
    const gain = value - h.invested;
    return [
      accountName(h.accountId),
      h.nickname || h.name,
      h.name,
      h.ticker,
      h.isin,
      h.category,
      h.type,
      h.currency,
      num(h.units),
      num(h.price),
      num(value),
      num(h.invested),
      num(gain),
      pct(h.invested > 0 ? (gain / h.invested) * 100 : 0),
      pct(portfolioValue > 0 ? (value / portfolioValue) * 100 : 0),
      pct(h.change1d),
      h.source,
      h.pricesUpdatedOn ?? "",
    ];
  });

  /* ------------------------------ operaciones ------------------------------ */
  const operationRows: unknown[][] = [];
  for (const h of holdings) {
    for (const op of h.operations) {
      operationRows.push([
        h.nickname || h.name,
        h.ticker,
        accountName(h.accountId),
        date(op.date),
        op.date,
        op.type,
        num(op.units),
        num(op.price),
        num(op.fees),
        num(op.units * op.price + op.fees),
      ]);
    }
  }
  operationRows.sort((a, b) => String(a[4]).localeCompare(String(b[4])));

  /* ------------------------------ composición ------------------------------ */
  const compositionRows: unknown[][] = [];
  for (const h of holdings) {
    const name = `${h.nickname || h.name} (${h.ticker})`;
    for (const [label, list] of [["Sectores", h.sectors], ["Países", h.countries], ["Principales posiciones", h.top]] as [string, [string, number][]][]) {
      for (const [item, weight] of list ?? []) compositionRows.push([name, h.ticker, label, item, pct(weight)]);
    }
  }

  /* ------------------------------ resumen ------------------------------ */
  const liquid = accounts.filter((a) => a.kind === "corriente").reduce((s, a) => s + a.balance, 0);
  const invested = holdings.reduce((s, h) => s + holdingValue(h), 0);
  const investCash = accounts
    .filter((a) => a.kind === "inversion")
    .reduce((s, a) => s + Math.max(a.balance - holdings.filter((h) => h.accountId === a.id).reduce((x, h) => x + holdingValue(h), 0), 0), 0);
  const investedCost = holdings.reduce((s, h) => s + h.invested, 0);
  const income = transactions.filter((t) => !isTransfer(t) && t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => !isTransfer(t) && t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const summaryRows: unknown[][] = [
    ["Fecha de exportación", date(dateStamp)],
    ["Patrimonio neto", num(liquid + invested + investCash)],
    ["Liquidez (cuentas corrientes)", num(liquid)],
    ["Invertido en productos", num(invested)],
    ["Efectivo en cuentas de inversión", num(investCash)],
    ["Coste de la inversión", num(investedCost)],
    ["Ganancia latente", num(invested - investedCost)],
    ["Rentabilidad de la cartera (%)", pct(investedCost > 0 ? ((invested - investedCost) / investedCost) * 100 : 0)],
    ["Ingresos registrados", num(income)],
    ["Gastos registrados", num(expense)],
    ["Ahorro registrado", num(income - expense)],
    ["Cuentas", accounts.length],
    ["Cuentas archivadas", accounts.filter((a) => a.archived).length],
    ["Productos de inversión", holdings.length],
    ["Categorías", categories.length],
    ["Subcategorías", categories.reduce((s, c) => s + c.subcategories.length, 0)],
    ["Movimientos", transactions.length],
    ["Traspasos", transferRows.length],
  ];

  return [
    {
      key: "cuentas",
      filename: "cuentas.csv",
      label: "Cuentas",
      description: "Saldo actual e inicial, tipo, valor invertido y nº de movimientos",
      rows: accountRows.length,
      content: toCsv(
        ["Cuenta", "Tipo", "Saldo actual (EUR)", "Saldo inicial (EUR)", "Archivada", "Nº productos", "Valor productos (EUR)", "Efectivo sin invertir (EUR)", "Nº movimientos", "Primer movimiento", "Último movimiento", "Color"],
        accountRows,
      ),
    },
    {
      key: "categorias",
      filename: "categorias.csv",
      label: "Categorías",
      description: "Cada subcategoría con su categoría, icono, color y total",
      rows: categoryRows.length,
      content: toCsv(["Categoría", "Tipo", "Subcategoría", "Icono", "Color", "Nº movimientos", "Total (EUR)"], categoryRows),
    },
    {
      key: "movimientos",
      filename: "movimientos.csv",
      label: "Movimientos",
      description: "Todos los apuntes con cuenta, categoría, importe y saldo resultante",
      rows: movementRows.length,
      content: toCsv(
        ["Fecha", "Fecha ISO", "Concepto", "Tipo", "Cuenta", "Cuenta origen", "Cuenta destino", "Categoría", "Subcategoría", "Importe (EUR)", "Saldo resultante (EUR)", "Etiquetas", "Nota", "Producto", "ID operación"],
        movementRows,
      ),
    },
    {
      key: "traspasos",
      filename: "traspasos.csv",
      label: "Traspasos",
      description: "Una fila por traspaso, con cuenta de origen y de destino",
      rows: transferRows.length,
      content: toCsv(["Fecha", "Fecha ISO", "Origen", "Destino", "Importe (EUR)", "Concepto"], transferRows),
    },
    {
      key: "inversiones",
      filename: "inversiones.csv",
      label: "Inversiones",
      description: "Productos con participaciones, precio, valor, coste y rentabilidad",
      rows: holdingRows.length,
      content: toCsv(
        ["Cuenta", "Producto", "Nombre completo", "Ticker", "ISIN", "Categoría", "Tipo", "Moneda", "Participaciones", "Precio (EUR)", "Valor (EUR)", "Invertido (EUR)", "Ganancia (EUR)", "Rentabilidad (%)", "Peso cartera (%)", "Variación diaria (%)", "Fuente", "Precio actualizado"],
        holdingRows,
      ),
    },
    {
      key: "operaciones",
      filename: "operaciones.csv",
      label: "Operaciones",
      description: "Compras, ventas, dividendos y aportaciones de cada producto",
      rows: operationRows.length,
      content: toCsv(["Producto", "Ticker", "Cuenta", "Fecha", "Fecha ISO", "Tipo", "Participaciones", "Precio (EUR)", "Comisiones (EUR)", "Importe total (EUR)"], operationRows),
    },
    {
      key: "composicion",
      filename: "composicion.csv",
      label: "Composición",
      description: "Sectores, países y principales posiciones de cada producto",
      rows: compositionRows.length,
      content: toCsv(["Producto", "Ticker", "Dimensión", "Elemento", "Peso (%)"], compositionRows),
    },
    {
      key: "resumen",
      filename: "resumen.csv",
      label: "Resumen",
      description: "Patrimonio, ahorro y recuento de datos de la exportación",
      rows: summaryRows.length,
      content: toCsv(["Métrica", "Valor"], summaryRows),
    },
  ];
}

/** ZIP (sin comprimir más de lo necesario) con los CSV seleccionados. */
export function buildCsvZip(files: CsvFile[], dateStamp = todayIso()): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[`bilibank-${dateStamp}/${f.filename}`] = strToU8("\ufeff" + f.content);
  return zipSync(entries, { level: 6 });
}

/* ------------------------------ descargas ------------------------------ */

/** Descarga un texto como fichero (sólo navegador). */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga un CSV con BOM para que Excel respete los acentos. */
export function downloadCsv(filename: string, content: string): void {
  const name = filename.replace(/\.csv$/i, "") + "-" + todayIso() + ".csv";
  downloadText(name, "\ufeff" + content, "text/csv;charset=utf-8");
}

/** Descarga un ZIP ya generado. */
export function downloadBytes(filename: string, bytes: Uint8Array, mime: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const downloadCsvZip = (bytes: Uint8Array, dateStamp = todayIso()) =>
  downloadBytes(`bilibank-datos-${dateStamp}.zip`, bytes, "application/zip");
