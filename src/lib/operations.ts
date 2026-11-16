/* Resultado de cada operación de un producto, tomada UNA A UNA.

   Responde a «¿cuánto invertí en esta operación y cuánto llevo ganado solo con
   ella?». Las compras se siguen como lotes FIFO (las ventas consumen primero
   las más antiguas), de modo que la ganancia de una compra incluye lo ya
   realizado en las participaciones que se hayan vendido de ese lote y lo que
   queda pendiente al precio actual.
*/

import type { Holding, Operation } from "./mock";

export type OperationKind = Operation["type"];

export interface OperationResult {
  op: Operation;
  kind: OperationKind;
  /** Participaciones compradas o vendidas (0 en dividendos y aportaciones) */
  units: number;
  price: number;
  fees: number;
  /** Dinero que salió (compra/aportación) o que entró (venta/dividendo) */
  amount: number;
  /** Coste FIFO de las participaciones vendidas (solo ventas) */
  costBasis?: number;
  /** Valor actual de lo que aún queda de ese lote (solo compras) */
  currentValue?: number;
  /** Ganancia de esta operación: realizada + latente */
  gain?: number;
  /** Ganancia sobre lo invertido, en porcentaje */
  gainPct?: number;
  /** Participaciones del lote que siguen en cartera (solo compras) */
  remainingUnits?: number;
  /** Coste de las participaciones que aún quedan de ese lote (solo compras) */
  remainingCost?: number;
  /** true cuando el lote se ha vendido por completo */
  closed?: boolean;
}

interface Lot {
  opId: number;
  units: number;
  remaining: number;
  costPerUnit: number;
  realized: number;
}

/** Ordena las operaciones de la más antigua a la más reciente. */
const byDate = (a: Operation, b: Operation) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1);

/**
 * Calcula el resultado de cada operación del producto.
 * Devuelve la lista en el mismo orden en que se registraron.
 */
export function operationResults(h: Holding): OperationResult[] {
  const ops = [...h.operations].sort(byDate);
  const lots: Lot[] = [];
  const out = new Map<number, OperationResult>();

  for (const op of ops) {
    if (op.type === "compra") {
      const amount = op.units * op.price + op.fees;
      const costPerUnit = op.units > 0 ? amount / op.units : 0;
      lots.push({ opId: op.id, units: op.units, remaining: op.units, costPerUnit, realized: 0 });
      out.set(op.id, {
        op,
        kind: "compra",
        units: op.units,
        price: op.price,
        fees: op.fees,
        amount,
        remainingUnits: op.units,
      });
      continue;
    }

    if (op.type === "venta") {
      let pending = op.units;
      let cost = 0;
      for (const lot of lots) {
        if (pending <= 0) break;
        const take = Math.min(lot.remaining, pending);
        if (take <= 0) continue;
        lot.remaining -= take;
        pending -= take;
        cost += take * lot.costPerUnit;
        /* Parte proporcional de las comisiones de la venta para este lote */
        const feeShare = op.units > 0 ? (op.fees * take) / op.units : 0;
        lot.realized += take * op.price - feeShare - take * lot.costPerUnit;
      }
      const proceeds = op.units * op.price - op.fees;
      const realized = proceeds - cost;
      out.set(op.id, {
        op,
        kind: "venta",
        units: op.units,
        price: op.price,
        fees: op.fees,
        amount: proceeds,
        costBasis: cost,
        gain: realized,
        gainPct: cost > 0 ? (realized / cost) * 100 : undefined,
      });
      continue;
    }

    /* Dividendo: importe neto que entra. Aportación: dinero que se añade. */
    const amount = op.type === "dividendo" ? op.price : op.units * op.price + op.fees;
    out.set(op.id, {
      op,
      kind: op.type,
      units: op.type === "dividendo" ? 0 : op.units,
      price: op.price,
      fees: op.fees,
      amount,
      gain: op.type === "dividendo" ? amount : undefined,
    });
  }

  /* Cierre de las compras: valor latente + lo ya realizado de ese lote. */
  for (const lot of lots) {
    const row = out.get(lot.opId);
    if (!row) continue;
    const currentValue = lot.remaining * h.price;
    const cost = lot.units * lot.costPerUnit;
    /* Ganancia del lote = lo latente (valor − coste de lo que queda) + lo ya
       realizado al vender parte de ese mismo lote. */
    const gain = currentValue + lot.realized - lot.remaining * lot.costPerUnit;
    row.currentValue = currentValue;
    row.remainingUnits = lot.remaining;
    row.remainingCost = lot.remaining * lot.costPerUnit;
    row.closed = lot.remaining <= 0.0000001;
    row.gain = gain;
    row.gainPct = cost > 0 ? (gain / cost) * 100 : undefined;
  }

  return [...out.values()];
}

/** Totales de la tabla de operaciones de un producto. */
export function operationTotals(rows: OperationResult[]) {
  const bought = rows.filter((r) => r.kind === "compra" || r.kind === "aportacion").reduce((s, r) => s + r.amount, 0);
  const sold = rows.filter((r) => r.kind === "venta").reduce((s, r) => s + r.amount, 0);
  const dividends = rows.filter((r) => r.kind === "dividendo").reduce((s, r) => s + r.amount, 0);
  const fees = rows.reduce((s, r) => s + (r.fees || 0), 0);
  /* Latente = valor actual − coste de lo que sigue en cartera (sin doble conteo). */
  const openGain = rows
    .filter((r) => r.kind === "compra")
    .reduce((s, r) => s + (r.currentValue ?? 0) - (r.remainingCost ?? 0), 0);
  const realizedGain = rows.filter((r) => r.kind === "venta").reduce((s, r) => s + (r.gain ?? 0), 0);
  return { bought, sold, dividends, fees, openGain, realizedGain };
}
