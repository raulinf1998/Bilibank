/* Copia de seguridad de Bilibank.

   Dos formatos distintos, para dos públicos distintos:

   1. CSV (ver `csv-export.ts`): plano, fácil de abrir en Excel o de llevar a
      otra aplicación.
   2. Copia de seguridad de Bilibank (este módulo): un ZIP con
      · `bilibank-copia.json`  → estado exacto. Es lo que se vuelve a cargar
        desde «Importar / restaurar datos» para recuperarlo todo tal cual.
      · `copia-legible.html`   → documento autocontenido (se abre en cualquier
        navegador, se puede imprimir o guardar en PDF) con TODOS los datos en
        tablas legibles.
      · `LEEME.txt`            → qué es cada archivo y cómo restaurar.
      · `datos-csv/*.csv`      → los mismos CSV del exportador, como red de
        seguridad adicional.

   El JSON mantiene las claves de primer nivel (`accounts`, `categories`,
   `holdings`, `transactions`) para que el importador que ya existe lo acepte.
*/

import { zipSync, strToU8 } from "fflate";
import { holdingValue, type Account, type Category, type Holding, type Tx } from "./mock";
import { isTransfer, runningBalances, transferEndpoints } from "./ledger";
import { cashOf, valueOf } from "./cash";
import { todayIso } from "./market";
import { buildCsvFiles, toCsv } from "./csv-export";

export interface BackupPayload {
  accounts: Account[];
  categories: Category[];
  holdings: Holding[];
  transactions: Tx[];
}

export const BACKUP_APP = "bilibank";
export const BACKUP_VERSION = 2;

const eur = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
const eur0 = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const num = (v: number, d = 2) =>
  new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const pct = (v: number) => `${num(v, 1)} %`;
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${eur(Math.abs(v))}`;
const longDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
};
const shortDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso ?? "";
};
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------ totales ------------------------------ */

export interface BackupTotals {
  liquid: number;
  invested: number;
  investCash: number;
  net: number;
  investedCost: number;
  gain: number;
  income: number;
  expense: number;
}

export function backupTotals(data: BackupPayload): BackupTotals {
  const { accounts, holdings, transactions } = data;
  const liquid = accounts.filter((a) => a.kind === "corriente").reduce((s, a) => s + a.balance, 0);
  const invested = holdings.reduce((s, h) => s + holdingValue(h), 0);
  const investCash = accounts.filter((a) => a.kind === "inversion").reduce((s, a) => s + cashOf(a, holdings), 0);
  const investedCost = holdings.reduce((s, h) => s + h.invested, 0);
  const income = transactions.filter((t) => !isTransfer(t) && t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => !isTransfer(t) && t.amount < 0).reduce((s, t) => s - t.amount, 0);
  return { liquid, invested, investCash, net: liquid + invested + investCash, investedCost, gain: invested - investedCost, income, expense };
}

/* ------------------------------ JSON exacto ------------------------------ */

export function buildBackupJson(data: BackupPayload, dateStamp = todayIso()): string {
  const t = backupTotals(data);
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: dateStamp,
      resumen: {
        patrimonioNeto: Math.round(t.net * 100) / 100,
        liquidez: Math.round(t.liquid * 100) / 100,
        invertido: Math.round(t.invested * 100) / 100,
        costeInversion: Math.round(t.investedCost * 100) / 100,
        cuentas: data.accounts.length,
        productos: data.holdings.length,
        categorias: data.categories.length,
        movimientos: data.transactions.length,
      },
      accounts: data.accounts,
      categories: data.categories,
      holdings: data.holdings,
      transactions: data.transactions,
    },
    null,
    2,
  );
}

/** ¿Este JSON es una copia de Bilibank restaurable? */
export function isBackupJson(text: string): boolean {
  try {
    const d = JSON.parse(text) as Record<string, unknown>;
    return (
      (d.app === BACKUP_APP || d.app === "mi-patrimonio-demo") &&
      Array.isArray(d.accounts) &&
      Array.isArray(d.categories) &&
      Array.isArray(d.holdings) &&
      Array.isArray(d.transactions)
    );
  } catch {
    return false;
  }
}

/** Busca el JSON de copia dentro de un ZIP (por si el usuario lo descomprimió y recomprimió). */
export function findBackupInZip(entries: Record<string, Uint8Array>, read: (b: Uint8Array) => string): string | null {
  for (const [name, bytes] of Object.entries(entries)) {
    if (name.endsWith("/") || !/\.json$/i.test(name)) continue;
    const text = read(bytes);
    if (isBackupJson(text)) return text;
  }
  return null;
}

/* ------------------------------ documento legible ------------------------------ */

function table(headers: string[], rows: (string | number)[][], numeric: number[] = []): string {
  const head = headers
    .map((h, i) => `<th${numeric.includes(i) ? ' class="n"' : ""}>${esc(h)}</th>`)
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => `<td${numeric.includes(i) ? ' class="n"' : ""}>${esc(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("\n");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Documento HTML autocontenido (sin scripts ni recursos externos) con todos los
 * datos en tablas: sirve para leerlo a ojo, imprimirlo o guardarlo en PDF.
 */
export function buildReadableHtml(data: BackupPayload, dateStamp = todayIso()): string {
  const { accounts, categories, holdings, transactions } = data;
  const t = backupTotals(data);
  const balances = runningBalances(accounts, transactions);
  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? "—";

  const summary = [
    ["Patrimonio neto", eur(t.net)],
    ["Liquidez en cuentas corrientes", eur(t.liquid)],
    ["Invertido en productos", eur(t.invested)],
    ["Efectivo sin invertir en cuentas de inversión", eur(t.investCash)],
    ["Coste de la inversión", eur(t.investedCost)],
    ["Ganancia latente", signed(t.gain)],
    ["Ingresos registrados", eur(t.income)],
    ["Gastos registrados", eur(t.expense)],
    ["Ahorro registrado", signed(t.income - t.expense)],
    ["Cuentas", String(accounts.length)],
    ["Productos de inversión", String(holdings.length)],
    ["Categorías / subcategorías", `${categories.length} / ${categories.reduce((s, c) => s + c.subcategories.length, 0)}`],
    ["Movimientos", String(transactions.length)],
    ["Traspasos", String(transactions.filter((x) => isTransfer(x) && x.amount < 0).length)],
  ];

  const accountRows = accounts.map((a) => {
    const own = transactions.filter((x) => x.accountId === a.id);
    const products = holdings.filter((h) => h.accountId === a.id);
    const invested = products.reduce((s, h) => s + holdingValue(h), 0);
    return [
      a.name,
      a.kind === "inversion" ? "Inversión" : "Corriente",
      eur(valueOf(a, holdings)),
      a.archived ? "Sí" : "No",
      String(products.length),
      products.length ? eur(invested) : "—",
      String(own.length),
      own.length ? shortDate(own[own.length - 1].date) : "—",
    ];
  });

  const categoryRows: (string | number)[][] = [];
  for (const c of categories) {
    const list = c.subcategories.length ? c.subcategories : [{ id: 0, name: "—", icon: undefined, colorIdx: undefined }];
    for (const s of list) {
      const txs = transactions.filter((x) => x.categoryId === c.id && (s.id === 0 || x.subcategoryId === s.id));
      categoryRows.push([
        c.name,
        c.kind === "ingreso" ? "Ingreso" : "Gasto",
        s.name,
        c.icon,
        String(txs.length),
        eur(Math.abs(txs.reduce((sum, x) => sum + x.amount, 0))),
      ]);
    }
  }

  const movementRows = [...transactions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
    .map((tx) => {
      const cat = categories.find((c) => c.id === tx.categoryId);
      const sub = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
      const ends = isTransfer(tx) ? transferEndpoints(tx, transactions, accounts) : null;
      return [
        shortDate(tx.date),
        tx.concept,
        isTransfer(tx) ? "Traspaso" : tx.amount >= 0 ? "Ingreso" : "Gasto",
        accountName(tx.accountId),
        ends ? `${ends.from?.name ?? "?"} → ${ends.to?.name ?? "?"}` : "—",
        cat ? `${cat.name}${sub ? ` › ${sub.name}` : ""}` : "—",
        signed(tx.amount),
        typeof balances.get(tx.id) === "number" ? eur(balances.get(tx.id) as number) : "—",
        tx.note ?? "",
      ];
    });

  const holdingRows = holdings.map((h) => {
    const value = holdingValue(h);
    const gain = value - h.invested;
    return [
      h.nickname || h.name,
      h.ticker,
      h.isin || "—",
      accountName(h.accountId),
      h.type,
      num(h.units, 4),
      eur(h.price),
      eur(value),
      eur(h.invested),
      signed(gain),
      pct(h.invested > 0 ? (gain / h.invested) * 100 : 0),
    ];
  });

  const purchaseRows = holdings
    .flatMap((h) =>
      h.operations
        .filter((op) => op.type === "compra")
        .map((op) => {
          const invested = op.units * op.price + op.fees;
          const now = op.units * h.price;
          return {
            date: op.date,
            row: [
              shortDate(op.date),
              h.nickname || h.name,
              h.ticker,
              accountName(h.accountId),
              num(op.units, 4),
              eur(op.price),
              eur(op.fees),
              eur(invested),
              eur(now),
              signed(now - invested),
              pct(invested > 0 ? ((now - invested) / invested) * 100 : 0),
            ],
          };
        }),
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((x) => x.row);

  const otherOpRows = holdings
    .flatMap((h) =>
      h.operations
        .filter((op) => op.type !== "compra")
        .map((op) => [shortDate(op.date), h.nickname || h.name, op.type, num(op.units, 4), eur(op.price), eur(op.fees), eur(op.units * op.price + op.fees)]),
    )
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])));

  const section = (id: string, title: string, sub: string, content: string) =>
    `<section id="${id}"><h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p>${content}</section>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bilibank · Copia de seguridad del ${esc(shortDate(dateStamp))}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 20px 64px; font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
         background: #f7f7f5; color: #14161a; }
  main { max-width: 1080px; margin: 0 auto; }
  header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
           border-bottom: 3px solid #EAB308; padding-bottom: 14px; margin-bottom: 8px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .pig { width: 44px; height: 44px; border-radius: 12px; background: #111827; display: grid; place-items: center; }
  .pig svg { width: 28px; height: 28px; stroke: #EAB308; fill: none; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
  h1 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
  .muted { color: #5b6472; font-size: 12.5px; margin: 0; }
  nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 26px; }
  nav a { padding: 5px 11px; border-radius: 999px; border: 1px solid #d7dae0; background: #fff; color: #14161a;
          text-decoration: none; font-size: 12px; font-weight: 600; }
  section { margin-bottom: 34px; }
  h2 { font-size: 16px; margin: 0 0 2px; }
  .sub { margin: 0 0 12px; color: #5b6472; font-size: 12.5px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e3e5e9; border-radius: 10px; overflow: hidden; }
  thead th { background: #f0f1f3; text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em;
             padding: 8px 10px; color: #47505c; border-bottom: 1px solid #e3e5e9; white-space: nowrap; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #eef0f2; font-size: 12.5px; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fbfbfc; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-bottom: 14px; }
  .card { background: #fff; border: 1px solid #e3e5e9; border-radius: 12px; padding: 12px 14px; }
  .card b { display: block; font-size: 18px; font-variant-numeric: tabular-nums; margin-top: 2px; }
  .card span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .09em; color: #6b7480; }
  .pos { color: #15803d; } .neg { color: #b91c1c; }
  .note { background: #fffbe8; border: 1px solid #f0d98c; border-radius: 12px; padding: 12px 14px; font-size: 12.5px; }
  footer { margin-top: 40px; border-top: 1px solid #e3e5e9; padding-top: 12px; color: #6b7480; font-size: 11.5px; }
  @media print { body { background: #fff; padding: 0; } nav { display: none; } table { break-inside: auto; }
    section { break-inside: avoid-page; } thead { display: table-header-group; } td, th { font-size: 9.5px; } }
  @media (prefers-color-scheme: dark) {
    body { background: #0b0d12; color: #e7e9ee; }
    table, .card, nav a { background: #141821; border-color: #262c38; }
    thead th { background: #1a1f2a; color: #aeb6c4; border-color: #262c38; }
    tbody td { border-color: #1d222c; } tbody tr:nth-child(even) td { background: #11151d; }
    .muted, .sub, .card span, footer { color: #98a1b1; } .note { background: #221f10; border-color: #4b4118; }
  }
</style>
</head>
<body>
<main>
  <header>
    <div class="brand">
      <span class="pig" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"/><path d="M16 10h.01"/><path d="M2 8v1a2 2 0 0 0 2 2h1"/></svg>
      </span>
      <div>
        <h1>Bilibank · Copia de seguridad</h1>
        <p class="muted">Generada el ${esc(longDate(dateStamp))} · ${transactions.length} movimientos · ${holdings.length} productos · ${accounts.length} cuentas</p>
      </div>
    </div>
    <p class="muted">Documento legible · el archivo <code>bilibank-copia.json</code> de este ZIP restaura todo</p>
  </header>

  <nav>
    <a href="#resumen">Resumen</a><a href="#cuentas">Cuentas</a><a href="#categorias">Categorías</a>
    <a href="#inversiones">Inversiones</a><a href="#compras">Compras</a><a href="#operaciones">Otras operaciones</a>
    <a href="#movimientos">Movimientos</a>
  </nav>

  ${section("resumen", "Resumen", "Totales calculados con los datos de esta copia", `
    <div class="cards">
      <div class="card"><span>Patrimonio neto</span><b>${esc(eur(t.net))}</b></div>
      <div class="card"><span>Liquidez</span><b>${esc(eur(t.liquid))}</b></div>
      <div class="card"><span>Invertido</span><b>${esc(eur(t.invested))}</b></div>
      <div class="card"><span>Ganancia latente</span><b class="${t.gain >= 0 ? "pos" : "neg"}">${esc(signed(t.gain))}</b></div>
    </div>
    ${table(["Métrica", "Valor"], summary, [1])}`)}

  ${section("cuentas", "Cuentas", `${accounts.length} cuentas, incluidas las archivadas`, table(["Cuenta", "Tipo", "Saldo", "Archivada", "Productos", "Valor productos", "Movimientos", "Último movimiento"], accountRows, [2, 5, 6]))}

  ${section("categorias", "Categorías y subcategorías", `${categories.length} categorías · ${categories.reduce((s, c) => s + c.subcategories.length, 0)} subcategorías`, table(["Categoría", "Tipo", "Subcategoría", "Icono", "Movimientos", "Total"], categoryRows, [4, 5]))}

  ${section("inversiones", "Inversiones", `${holdings.length} productos`, table(["Producto", "Ticker", "ISIN", "Cuenta", "Tipo", "Participaciones", "Precio", "Valor", "Invertido", "Ganancia", "Rentabilidad"], holdingRows, [5, 6, 7, 8, 9, 10]))}

  ${section("compras", "Compras de productos", "Cada compra con lo invertido y lo que vale hoy", table(["Fecha", "Producto", "Ticker", "Cuenta", "Participaciones", "Precio compra", "Comisiones", "Invertido", "Valor hoy", "Ganancia", "Rentabilidad"], purchaseRows, [4, 5, 6, 7, 8, 9, 10]))}

  ${section("operaciones", "Otras operaciones", "Ventas, dividendos y aportaciones", table(["Fecha", "Producto", "Tipo", "Participaciones", "Precio", "Comisiones", "Importe"], otherOpRows, [3, 4, 5, 6]))}

  ${section("movimientos", "Movimientos", `Todos los apuntes, del más reciente al más antiguo · ${transactions.length}`, table(["Fecha", "Concepto", "Tipo", "Cuenta", "Origen → destino", "Categoría", "Importe", "Saldo", "Nota"], movementRows, [6, 7]))}

  <p class="note"><b>Cómo restaurar:</b> en Bilibank, abre <i>Ajustes → Datos → Importar / restaurar datos</i> y elige este ZIP (o el <code>bilibank-copia.json</code> que contiene). Se recuperan cuentas, categorías, productos, operaciones y movimientos tal y como estaban el ${esc(shortDate(dateStamp))}.</p>

  <footer>Bilibank · copia generada el ${esc(longDate(dateStamp))} · documento generado automáticamente, sin datos externos.</footer>
</main>
</body>
</html>`;
}

/* ------------------------------ LEEME ------------------------------ */

export function buildReadme(data: BackupPayload, dateStamp = todayIso()): string {
  const counts = {
    accounts: data.accounts.length,
    categories: data.categories.length,
    subcategories: data.categories.reduce((s, c) => s + c.subcategories.length, 0),
    holdings: data.holdings.length,
    operations: data.holdings.reduce((s, h) => s + h.operations.length, 0),
    transactions: data.transactions.length,
    transfers: data.transactions.filter((t) => isTransfer(t) && t.amount < 0).length,
  };
  return `BILIBANK · COPIA DE SEGURIDAD
Generada el ${shortDate(dateStamp)}

QUÉ HAY EN ESTA CARPETA
  1. bilibank-copia.json
     Copia exacta de todos los datos. ES EL ARCHIVO QUE SE USA PARA RESTAURAR.
  2. copia-legible.html
     Documento para leer con calma: resumen, cuentas, categorías, inversiones,
     compras, operaciones y todos los movimientos. Ábrelo con doble clic en
     cualquier navegador; se puede imprimir o guardar como PDF.
  3. datos-csv/*.csv
     Los mismos datos en CSV (separador «;», decimales con coma), para abrirlos
     en Excel, Numbers, LibreOffice o llevarlos a otra aplicación.
  4. LEEME.txt
     Este archivo.

CÓMO RESTAURAR
  · Opción rápida: en Bilibank, Ajustes → Datos → «Importar / restaurar datos»
    y elige este mismo ZIP. La app detecta el JSON de dentro y lo restaura.
  · Opción manual: descomprime el ZIP y carga «bilibank-copia.json» con el
    mismo botón.

DATOS INCLUIDOS
  Cuentas: ${counts.accounts}
  Categorías: ${counts.categories} (${counts.subcategories} subcategorías)
  Productos de inversión: ${counts.holdings}
  Operaciones de inversión: ${counts.operations}
  Movimientos: ${counts.transactions} (${counts.transfers} traspasos)

CONSEJO
  Guarda una copia antes de cambiar datos importantes y conserva la anterior
  hasta comprobar que todo está bien.
`;
}

/* ------------------------------ ZIP ------------------------------ */

export interface BackupBundle {
  zip: Uint8Array;
  json: string;
  html: string;
  readme: string;
}

/**
 * ZIP completo de copia de seguridad. `includeCsv` añade los CSV (por defecto sí)
 * para que el mismo paquete sirva también para otra aplicación.
 */
export function buildBackupBundle(data: BackupPayload, dateStamp = todayIso(), includeCsv = true): BackupBundle {
  const json = buildBackupJson(data, dateStamp);
  const html = buildReadableHtml(data, dateStamp);
  const readme = buildReadme(data, dateStamp);
  const folder = `bilibank-copia-${dateStamp}`;

  const entries: Record<string, Uint8Array> = {
    [`${folder}/bilibank-copia.json`]: strToU8(json),
    [`${folder}/copia-legible.html`]: strToU8(html),
    [`${folder}/LEEME.txt`]: strToU8(readme),
  };

  if (includeCsv) {
    const csv = buildCsvFiles(data);
    for (const f of csv) entries[`${folder}/datos-csv/${f.filename}`] = strToU8("\ufeff" + f.content);
    const indice = toCsv(["Archivo", "Contenido", "Filas"], csv.map((f) => [f.filename, f.description, f.rows]));
    entries[`${folder}/datos-csv/INDICE.csv`] = strToU8("\ufeff" + indice);
  }

  return { zip: zipSync(entries, { level: 6 }), json, html, readme };
}
