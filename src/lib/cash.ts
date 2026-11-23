/* Efectivo de una cuenta de inversión.

   En una cuenta de inversión el dinero y los productos son cosas distintas:

     efectivo  = `account.cash`  (lo que queda disponible para comprar)
     productos = suma del valor de mercado de sus productos
     valor     = efectivo + productos  (lo que vale la cuenta)

   Antes sólo existía `account.balance` con el valor total, y el efectivo se
   deducía restando el valor de la cartera. Con ese modelo una compra nunca
   bajaba la caja (el dinero entraba y salía en la misma operación) y las
   cuentas importadas de otra app mostraban siempre 0 €.

   `cashOf` y `valueOf` centralizan la lectura: si una cuenta antigua todavía
   no tiene `cash` guardado se deduce (saldo − productos) y `ensureInvestmentCash`
   lo fija para que los precios ya no lo muevan por su cuenta.
*/

import type { Account, Holding, Operation, Tx } from "./mock";

/** Una operación sin id (las que se están creando o editando). */
type Op = Omit<Operation, "id">;

const round2 = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
};

/** Valor de mercado de los productos de una cuenta. */
export function productsValueOf(accountId: number, holdings: Holding[]): number {
  return round2(
    holdings.filter((h) => h.accountId === accountId).reduce((sum, h) => sum + (h.units || 0) * (h.price || 0), 0),
  );
}

/**
 * Efectivo disponible de una cuenta.
 * En las cuentas de inversión sale de `cash`; en las corrientes, del saldo.
 */
export function cashOf(account: Account, holdings: Holding[]): number {
  if (account.kind !== "inversion") return round2(account.balance);
  if (typeof account.cash === "number" && Number.isFinite(account.cash)) return round2(account.cash);
  /* Cuenta antigua sin `cash`: el saldo era valor total, así que el efectivo es
     lo que sobraba por encima de los productos. */
  return round2(Math.max(account.balance - productsValueOf(account.id, holdings), 0));
}

/** Valor de la cuenta: efectivo + productos (en las corrientes, el saldo). */
export function valueOf(account: Account, holdings: Holding[]): number {
  if (account.kind !== "inversion") return round2(account.balance);
  return round2(cashOf(account, holdings) + productsValueOf(account.id, holdings));
}

/**
 * Migra las cuentas de inversión antiguas, que guardaban en `balance` el valor
 * total (productos + efectivo).
 *
 * Se fija `cash` con el efectivo que se deducía hasta ahora y se marcan sus
 * operaciones como ya pagadas: ese dinero ya estaba dentro del saldo guardado,
 * así que volver a aplicarlo dejaría la caja en negativo.
 */
export function migrateInvestmentCash(
  accounts: Account[],
  holdings: Holding[],
): { accounts: Account[]; holdings: Holding[]; migrated: number } {
  const legacy = new Set(
    accounts
      .filter((a) => a.kind === "inversion" && !(typeof a.cash === "number" && Number.isFinite(a.cash)))
      .map((a) => a.id),
  );
  if (!legacy.size) return { accounts, holdings, migrated: 0 };
  const nextAccounts = accounts.map((a) =>
    legacy.has(a.id) ? { ...a, cash: round2(Math.max(a.balance - productsValueOf(a.id, holdings), 0)) } : a,
  );
  const nextHoldings = holdings.map((h) =>
    legacy.has(h.accountId) && h.operations.some((op) => !op.settled)
      ? { ...h, operations: h.operations.map((op) => (op.settled ? op : { ...op, settled: true })) }
      : h,
  );
  return { accounts: nextAccounts, holdings: nextHoldings, migrated: legacy.size };
}

/** Suma del efectivo disponible en todas las cuentas de inversión. */
export function investmentCash(accounts: Account[], holdings: Holding[]): number {
  return round2(
    accounts.filter((a) => a.kind === "inversion").reduce((sum, a) => sum + cashOf(a, holdings), 0),
  );
}

/** Suma del valor de las cuentas de inversión (efectivo + productos). */
export function investmentValue(accounts: Account[], holdings: Holding[]): number {
  return round2(
    accounts.filter((a) => a.kind === "inversion").reduce((sum, a) => sum + valueOf(a, holdings), 0),
  );
}

/* ------------------------------------------------------------------
   Operaciones de un producto
   Comprar (o aportar) saca dinero de la cuenta; vender y cobrar un dividendo
   lo ingresan. El importe y el signo viven aquí para que la app, los listados
   y las exportaciones usen exactamente la misma cuenta.
------------------------------------------------------------------ */

/** Importe en positivo: lo que cuesta una compra o lo que paga una venta. */
export function operationAmount(op: Op): number {
  if (op.type === "dividendo") return round2(op.price);
  if (op.type === "venta") return round2(op.units * op.price - op.fees);
  return round2(op.units * op.price + op.fees);
}

/** Signo del movimiento en la cuenta: −1 sale dinero, +1 entra. */
export const operationSign = (op: Op): 1 | -1 =>
  op.type === "venta" || op.type === "dividendo" ? 1 : -1;

/** Efecto de una operación sobre el efectivo de la cuenta (con signo). */
export function operationCashDelta(op: Op): number {
  return round2(operationSign(op) * operationAmount(op));
}

/**
 * ¿Esta operación genera un movimiento de dinero en la cuenta?
 * Las operaciones importadas que ya venían pagadas con el efectivo de la
 * cartera (`settled`) son historial: no vuelven a cobrarse.
 */
export const cashOperation = (op: Op): boolean =>
  !op.settled &&
  Boolean(op.date) &&
  operationAmount(op) > 0.004 &&
  (op.type === "compra" || op.type === "aportacion" ? op.units > 0 : true);

/** ¿Mete dinero en la cuenta (venta o dividendo)? */
export const isCreditOperation = (op: Op): boolean => operationSign(op) === 1;

/** Concepto del movimiento que genera una operación. */
export function operationConcept(op: Op, productName: string): string {
  if (op.type === "venta") return `Venta ${productName}`;
  if (op.type === "dividendo") return `Dividendo ${productName}`;
  if (op.type === "aportacion") return `Aportación ${productName}`;
  return `Compra ${productName}`;
}

/** Traspasos que han entrado o salido de una cuenta (categoría 0). */
export function transfersNet(accountId: number, transactions: Tx[]): number {
  return round2(
    transactions.filter((t) => t.accountId === accountId && t.categoryId === 0).reduce((sum, t) => sum + t.amount, 0),
  );
}
