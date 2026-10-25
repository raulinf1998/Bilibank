/* Utilidades de libro de movimientos.

   - Los traspasos se guardan como dos apuntes (salida y entrada) sin categoría.
     `transferEndpoints` los empareja para poder mostrar cuenta origen y destino.
   - `runningBalances` calcula el saldo resultante de la cuenta después de cada
     movimiento, partiendo del saldo actual y deshaciendo hacia atrás.
*/

import type { Account, Tx } from "./mock";

/** Apunte de traspaso: `categoryId` 0 (igual que en el resto de la app). */
export const isTransfer = (tx: Tx): boolean => tx.categoryId === 0;

export interface TransferEndpoints {
  from: Account | undefined;
  to: Account | undefined;
  /** id de la pata contraria del traspaso */
  pairId?: number;
}

/**
 * Busca la pata contraria de un traspaso (mismo día, importe opuesto y otra
 * cuenta) y devuelve la cuenta de origen y la de destino del dinero.
 */
export function transferEndpoints(tx: Tx, transactions: Tx[], accounts: Account[]): TransferEndpoints {
  const self = accounts.find((a) => a.id === tx.accountId);
  if (!isTransfer(tx)) return { from: self, to: undefined };

  const candidates = transactions.filter(
    (t) =>
      t.id !== tx.id &&
      t.categoryId === 0 &&
      t.date === tx.date &&
      t.accountId !== tx.accountId &&
      Math.abs(t.amount + tx.amount) < 0.005,
  );
  /* Si hay varios candidatos, el más cercano en id (los traspasos se crean juntos). */
  const pair = candidates.sort((a, b) => Math.abs(a.id - tx.id) - Math.abs(b.id - tx.id))[0];
  const other = pair ? accounts.find((a) => a.id === pair.accountId) : undefined;

  const outgoing = tx.amount < 0;
  return {
    from: outgoing ? self : other,
    to: outgoing ? other : self,
    pairId: pair?.id,
  };
}

/** Texto «Origen → Destino» de un traspaso. */
export function transferLabel(tx: Tx, transactions: Tx[], accounts: Account[]): string {
  const { from, to } = transferEndpoints(tx, transactions, accounts);
  if (from && to) return `${from.name} → ${to.name}`;
  if (from) return `Desde ${from.name}`;
  if (to) return `Hacia ${to.name}`;
  return "Entre cuentas";
}

/**
 * Saldo de cada cuenta después de cada movimiento: `Map<txId, saldo>`.
 * Se parte del saldo actual y se recorre del más reciente al más antiguo.
 */
export function runningBalances(accounts: Account[], transactions: Tx[]): Map<number, number> {
  const out = new Map<number, number>();
  const order = (a: Tx, b: Tx) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1);

  for (const account of accounts) {
    const own = transactions.filter((t) => t.accountId === account.id).sort(order);
    let balance = account.balance;
    for (let i = own.length - 1; i >= 0; i--) {
      const tx = own[i];
      out.set(tx.id, Math.round(balance * 100) / 100);
      balance -= tx.amount;
    }
  }
  return out;
}

/**
 * Borra un movimiento y devuelve el libro resultante.
 * Si el apunte es un traspaso (`categoryId` 0) se eliminan SIEMPRE las dos
 * patas —aunque la baja se pida desde una sola cuenta— y se revierten los
 * saldos de las dos cuentas implicadas.
 */
export function removeTransaction(
  tx: Tx,
  transactions: Tx[],
  accounts: Account[],
): { transactions: Tx[]; accounts: Account[]; removed: number } {
  const legs = isTransfer(tx)
    ? transactions.filter(
        (t) =>
          t.id === tx.id ||
          (t.categoryId === 0 &&
            t.accountId !== tx.accountId &&
            t.date === tx.date &&
            Math.abs(t.amount + tx.amount) < 0.005),
      )
    : [tx];
  const ids = new Set(legs.map((l) => l.id));
  return {
    transactions: transactions.filter((t) => !ids.has(t.id)),
    accounts: accounts.map((a) => {
      const delta = legs.filter((l) => l.accountId === a.id).reduce((sum, l) => sum + l.amount, 0);
      return delta === 0 ? a : { ...a, balance: Math.round((a.balance - delta) * 100) / 100 };
    }),
    removed: legs.length,
  };
}

/** ¿Todos los movimientos de la lista pertenecen a la misma cuenta? */
export function singleAccount(transactions: Tx[]): number | null {
  if (!transactions.length) return null;
  const first = transactions[0].accountId;
  return transactions.every((t) => t.accountId === first) ? first : null;
}
