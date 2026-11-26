/* Efectivo de una cuenta de inversión.

   En una cuenta de inversión el dinero y los productos son cosas distintas:

     efectivo  = dinero inicial (`cashOpening`) + suma de TODOS sus movimientos
     productos = suma del valor de mercado de sus productos
     valor     = efectivo + productos  (lo que vale la cuenta)

   El efectivo es, por tanto, un valor **derivado**: no se guarda a mano ni lo
   mueven los precios. Cada traspaso que entra lo sube, cada compra lo baja y
   cada venta o dividendo lo vuelve a subir; si borras un movimiento, el
   efectivo se recalcula solo. Es la misma regla que una cuenta corriente,
   donde el saldo también sale del saldo inicial más sus movimientos.

   `cash` se mantiene en el modelo como caché del valor derivado (otros
   módulos y copias antiguas lo leen), y `syncInvestmentCash` lo refresca.
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

/** Suma de todos los movimientos de una cuenta (traspasos incluidos). */
export function movementsNet(accountId: number, transactions: Tx[]): number {
  return round2(
    transactions.filter((t) => t.accountId === accountId).reduce((sum, t) => sum + t.amount, 0),
  );
}

/**
 * Efectivo disponible de una cuenta: el dinero con el que arranca más todo lo
 * que ha entrado y salido. En las cuentas corrientes el saldo ya es eso, así
 * que se devuelve tal cual.
 */
export function cashOf(account: Account, holdings: Holding[], transactions: Tx[] = []): number {
  if (account.kind !== "inversion") return round2(account.balance);
  const opening = typeof account.cashOpening === "number" ? account.cashOpening : 0;
  return round2(opening + movementsNet(account.id, transactions));
}

/** Valor de la cuenta: efectivo + productos (en las corrientes, el saldo). */
export function valueOf(account: Account, holdings: Holding[], transactions: Tx[] = []): number {
  if (account.kind !== "inversion") return round2(account.balance);
  return round2(cashOf(account, holdings, transactions) + productsValueOf(account.id, holdings));
}

/**
 * Migra las cuentas de inversión antiguas, que no tenían dinero inicial
 * (`cashOpening`).
 *
 * Regla: el efectivo manda el libro. La cuenta arranca en 0 y su caja es la
 * suma de todos sus movimientos, así que cada gasto que ya está en la lista
 * (aunque lo anotara la versión anterior) descuenta de verdad. Si una cuenta
 * arrastra más gastos que traspasos, su caja saldrá negativa y la app avisa de
 * que faltan aportaciones por registrar.
 *
 * Las compras importadas de otra app no se tocan: su gasto ya está en
 * `transactions.csv` y sus operaciones siguen marcadas como pagadas para que el
 * botón «Anotar» no cree movimientos duplicados.
 */
export function migrateInvestmentCash(
  accounts: Account[],
  holdings: Holding[],
  transactions: Tx[],
): { accounts: Account[]; holdings: Holding[]; migrated: number } {
  const legacy = new Set(
    accounts
      .filter((a) => a.kind === "inversion" && typeof a.cashOpening !== "number")
      .map((a) => a.id),
  );
  if (!legacy.size) return { accounts, holdings, migrated: 0 };

  const nextAccounts = accounts.map((a) =>
    legacy.has(a.id) ? { ...a, cashOpening: 0, cash: cashOf({ ...a, cashOpening: 0 }, holdings, transactions) } : a,
  );
  return { accounts: nextAccounts, holdings, migrated: legacy.size };
}

/**
 * Refresca el efectivo guardado en las cuentas de inversión a partir del libro.
 * Se llama cuando cambian los movimientos o las cuentas.
 */
export function syncInvestmentCash(accounts: Account[], holdings: Holding[], transactions: Tx[]): Account[] {
  let changed = false;
  const next = accounts.map((a) => {
    if (a.kind !== "inversion") return a;
    const cash = cashOf(a, holdings, transactions);
    if (a.cash === cash) return a;
    changed = true;
    return { ...a, cash };
  });
  return changed ? next : accounts;
}

/** Suma del efectivo disponible en todas las cuentas de inversión. */
export function investmentCash(accounts: Account[], holdings: Holding[], transactions: Tx[] = []): number {
  return round2(
    accounts.filter((a) => a.kind === "inversion").reduce((sum, a) => sum + cashOf(a, holdings, transactions), 0),
  );
}

/** Suma del valor de las cuentas de inversión (efectivo + productos). */
export function investmentValue(accounts: Account[], holdings: Holding[], transactions: Tx[] = []): number {
  return round2(
    accounts.filter((a) => a.kind === "inversion").reduce((sum, a) => sum + valueOf(a, holdings, transactions), 0),
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

/**
 * Operaciones de un producto que aún no tienen su movimiento en la cuenta.
 *
 * Misma regla que `cashOperation` salvo el filtro `settled`: que una operación
 * viniera del banco marcada como ya pagada no significa que su gasto esté
 * apuntado en Bilibank, y el usuario puede querer registrarlo. Si ya existe un
 * movimiento enlazado, no se repite.
 */
export function missingExpenseOperations(holding: Holding, transactions: Tx[]): Operation[] {
  const linked = new Set(
    transactions.filter((t) => t.productId === holding.id).map((t) => t.operationId),
  );
  return holding.operations.filter(
    (op) =>
      !linked.has(op.id) &&
      Boolean(op.date) &&
      operationAmount(op) > 0.004 &&
      (op.type === "compra" || op.type === "aportacion" ? op.units > 0 : true),
  );
}

/**
 * Importe que costó una compra **en el momento de comprarla**: participaciones
 * × precio de entonces + comisiones. No es el valor actual del producto.
 *
 * Es la cifra que se anota como gasto en la cuenta cuando se pone al día el
 * efectivo: lo que salió de tu bolsillo aquel día.
 */
export function purchaseCost(op: Op): number {
  return round2(op.units * op.price + op.fees);
}

/** Una compra que todavía no tiene su gasto anotado en el efectivo. */
export type PendingPurchase = { holding: Holding; op: Operation; cost: number };

/**
 * Compras de los productos de una cuenta que aún no están anotadas como gasto
 * en su efectivo, de la más antigua a la más reciente.
 *
 * Se considera «anotada» la compra que ya tiene un movimiento enlazado
 * (`productId` + `operationId`); así el botón nunca duplica. Sí se incluyen las
 * compras que el importe venía marcado como ya pagado (`settled`): ese dinero
 * salió de la cuenta igual y el usuario decide cuándo apuntarlo.
 *
 * El importe es `purchaseCost`: lo que costó ese día, no el valor actual.
 */
export function pendingPurchaseExpenses(
  accountId: number,
  holdings: Holding[],
  transactions: Tx[],
): PendingPurchase[] {
  const linked = new Set(
    transactions.filter((t) => t.productId !== undefined).map((t) => `${t.productId}:${t.operationId}`),
  );
  return holdings
    .filter((h) => h.accountId === accountId)
    .flatMap((holding) => holding.operations.map((op) => ({ holding, op })))
    .filter(({ holding, op }) => op.type === "compra" && !linked.has(`${holding.id}:${op.id}`))
    .map(({ holding, op }) => ({ holding, op, cost: purchaseCost(op) }))
    .filter((row) => row.cost > 0.004)
    .sort((a, b) =>
      a.op.date === b.op.date ? a.op.id - b.op.id : a.op.date < b.op.date ? -1 : 1,
    );
}

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
