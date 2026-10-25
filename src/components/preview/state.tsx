"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ACCOUNTS,
  CATEGORIES,
  HOLDINGS,
  TRANSACTIONS,
  type Account,
  type Category,
  type Holding,
  type HoldingCategory,
  type NavId,
  type Operation,
  type Subcategory,
  type Tx,
} from "@/lib/mock";
import { setTodayReference } from "@/lib/series";
import { shortDate, stablePrice, todayIso, withPrice } from "@/lib/market";
import { demoteCategory as demoteInTree, moveItem, moveSubcategory as moveSubInTree, promoteSubcategory as promoteInTree, remapTransaction } from "@/lib/category-tree";
import type { ArchetypeDef, DesignConfig, DonutKey } from "@/lib/themes";
import { getArchetype } from "@/lib/themes";

/* ------------------------------------------------------------------
   Rutas y popups de la app simulada
------------------------------------------------------------------ */

export interface Route {
  page: NavId;
  accountId?: number;
  productId?: number;
  categoryId?: number;
}

export type ModalKind =
  | { kind: "tx"; accountId?: number; categoryId?: number }
  | { kind: "transfer" }
  | { kind: "account" }
  | { kind: "product"; accountId?: number }
  | { kind: "operation"; productId: number }
  | { kind: "category"; parentId?: number }
  | { kind: "categoryTx"; categoryId: number; subcategoryId?: number }
  | { kind: "editAccount"; accountId: number }
  | { kind: "editCategory"; categoryId: number }
  | { kind: "editSubcategory"; categoryId: number; subcategoryId: number }
  | { kind: "editProduct"; productId: number }
  | { kind: "txDetail"; txId: number }
  | { kind: "editTx"; txId: number }
  | { kind: "editOperation"; productId: number; opId: number }
  | { kind: "accountDetail"; accountId: number }
  | { kind: "paletteEditor"; key?: string }
  | { kind: "search" }
  | { kind: "notifications" }
  | { kind: "confirmClear" }
  | { kind: "organizeCategories"; categoryId?: number };

const DEFAULT_SOURCES: Record<string, boolean> = { "Yahoo Finance": true, CoinGecko: true, "Alpha Vantage": false, Morningstar: true };

export type NewHolding = Omit<Holding, "id" | "spark" | "prices" | "operations" | "change1d" | "contrib" | "countries" | "top" | "sectors" | "nickname" | "category"> & { country?: string; nickname?: string; category?: HoldingCategory };

export interface WorkspaceSnapshot {
  accounts: Account[];
  categories: Category[];
  holdings: Holding[];
  transactions: Tx[];
}

export type SaveState = "idle" | "saving" | "saved" | "error";

interface PreviewState {
  saveState: SaveState;
  lastSavedAt: string | null;
  route: Route;
  go: (r: Route) => void;
  back: () => void;
  modal: ModalKind | null;
  openModal: (m: ModalKind) => void;
  closeModal: () => void;
  closeAllModals: () => void;
  period: string;
  setPeriod: (p: string) => void;
  toast: string | null;
  flash: (msg: string) => void;

  accounts: Account[];
  categories: Category[];
  holdings: Holding[];
  transactions: Tx[];
  sources: Record<string, boolean>;
  toggleSource: (name: string) => void;
  /** Actualiza precios: estables por día y, si hay red, con datos de mercado reales. */
  refreshPrices: () => Promise<void>;

  addTransaction: (tx: Omit<Tx, "id">) => void;
  addTransfer: (from: number, to: number, amount: number, date: string, concept: string) => void;
  addAccount: (a: Omit<Account, "id" | "history" | "initialBalance">) => void;
  addHolding: (h: NewHolding) => void;
  addOperation: (productId: number, op: Omit<Operation, "id">) => void;
  addCategory: (c: Omit<Category, "id" | "subcategories">, subs: string[]) => void;
  /** Mueve una categoría en la lista (direction -1 arriba, +1 abajo). */
  reorderCategory: (id: number, direction: -1 | 1) => void;
  /** Mueve una subcategoría dentro de su categoría. */
  reorderSubcategory: (categoryId: number, subId: number, direction: -1 | 1) => void;
  /** Convierte una subcategoría en categoría propia (sus movimientos la siguen). */
  promoteSubcategory: (categoryId: number, subId: number) => void;
  /** Convierte una categoría en subcategoría de otra (sus movimientos se mueven con ella). */
  demoteCategory: (categoryId: number, targetCategoryId: number) => void;
  /** Cambia una subcategoría de categoría padre. */
  moveSubcategory: (categoryId: number, subId: number, targetCategoryId: number) => void;
  addSubcategory: (parentId: number, name: string, extra?: { icon?: string; colorIdx?: import("@/lib/colors").ColorRef }) => void;
  updateTransaction: (id: number, tx: Omit<Tx, "id">) => void;
  updateTransfer: (txId: number, v: { from: number; to: number; amount: number; date: string; concept: string }) => void;
  updateAccount: (id: number, patch: Partial<Account>) => void;
  updateCategory: (id: number, patch: Partial<Category>) => void;
  updateSubcategory: (categoryId: number, subId: number, patch: Partial<Subcategory>) => void;
  updateHolding: (id: number, patch: Partial<Holding>) => void;
  updateOperation: (productId: number, opId: number, op: Omit<Operation, "id">) => void;
  deleteOperation: (productId: number, opId: number) => void;
  deleteTransaction: (id: number) => void;
  /** Borra la cuenta y sus movimientos; los productos deben moverse antes. */
  deleteAccount: (id: number) => boolean;
  /** Archiva o recupera una cuenta conservando todos sus datos. */
  setAccountArchived: (id: number, archived: boolean) => void;
  clearTransactions: () => void;
  resetData: () => void;
  exportData: () => string;
  importData: (json: string) => boolean;
}

const Ctx = createContext<PreviewState | null>(null);

const sortTx = (list: Tx[]) => [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));

/** Última fecha con movimientos; ancla la ventana temporal de periodos y gráficas. */
function anchorDate(data: WorkspaceSnapshot | null | undefined): string | null {
  if (!data?.transactions?.length) return null;
  let max = "";
  for (const tx of data.transactions) if (tx.date > max) max = tx.date;
  return max || null;
}

export function PreviewDataProvider({ children, initialRoute, initialModal, initialData, persist = false }: { children: ReactNode; initialRoute?: Route; initialModal?: ModalKind; initialData?: WorkspaceSnapshot | null; persist?: boolean }) {
  /* La ventana temporal se ancla antes de renderizar los hijos para que el HTML
     del servidor y el del cliente usen la misma fecha de referencia. */
  const anchor = useMemo(() => anchorDate(initialData), [initialData]);
  setTodayReference(anchor);

  const [route, setRoute] = useState<Route>(initialRoute ?? { page: "panel" });
  const [history, setHistory] = useState<Route[]>([]);
  const [stack, setStack] = useState<ModalKind[]>(initialModal ? [initialModal] : []);
  const [period, setPeriod] = useState("1A");
  const [toast, setToast] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>(initialData?.accounts?.length ? initialData.accounts : ACCOUNTS);
  const [categories, setCategories] = useState<Category[]>(initialData?.categories?.length ? initialData.categories : CATEGORIES);
  const [holdings, setHoldings] = useState<Holding[]>(initialData?.holdings?.length ? initialData.holdings : HOLDINGS);
  const [transactions, setTransactions] = useState<Tx[]>(initialData?.transactions ? initialData.transactions : TRANSACTIONS);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [sources, setSources] = useState<Record<string, boolean>>(DEFAULT_SOURCES);

  const hydrated = useRef(false);
  useEffect(() => {
    if (!persist) return;
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    setSaveState("idle");
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        const response = await fetch("/api/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { accounts, categories, holdings, transactions } }),
        });
        if (!response.ok) throw new Error("save failed");
        if (!cancelled) {
          const payload = (await response.json()) as { updatedAt?: string };
          setLastSavedAt(payload.updatedAt ?? new Date().toISOString());
          setSaveState("saved");
        }
      } catch {
        if (!cancelled) setSaveState("error");
      }
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accounts, categories, holdings, transactions, persist]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const go = useCallback(
    (r: Route) => {
      setStack([]);
      setHistory((h) => [...h.slice(-12), route]);
      setRoute(r);
    },
    [route],
  );

  const back = useCallback(() => {
    setStack([]);
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setRoute(prev ?? { page: route.page });
  }, [history, route.page]);

  const openModal = useCallback((m: ModalKind) => setStack((s) => [...s, m]), []);
  const closeModal = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const closeAllModals = useCallback(() => setStack([]), []);

  const addTransaction = useCallback(
    (tx: Omit<Tx, "id">) => {
      setTransactions((list) => sortTx([{ ...tx, id: Math.max(0, ...list.map((t) => t.id)) + 1 }, ...list]));
      setAccounts((list) => list.map((a) => (a.id === tx.accountId ? { ...a, balance: a.balance + tx.amount } : a)));
      flash(tx.amount >= 0 ? "Ingreso registrado" : "Gasto registrado");
    },
    [flash],
  );

  const addTransfer = useCallback(
    (from: number, to: number, amount: number, date: string, concept: string) => {
      const fromName = accounts.find((a) => a.id === from)?.name ?? "";
      const toName = accounts.find((a) => a.id === to)?.name ?? "";
      setTransactions((list) => {
        const id = Math.max(0, ...list.map((t) => t.id)) + 1;
        return sortTx([
          { id, date, concept: `${concept} → ${toName}`, categoryId: 0, subcategoryId: 0, accountId: from, amount: -amount },
          { id: id + 1, date, concept: `${concept} ← ${fromName}`, categoryId: 0, subcategoryId: 0, accountId: to, amount },
          ...list,
        ]);
      });
      setAccounts((list) => list.map((a) => (a.id === from ? { ...a, balance: a.balance - amount } : a.id === to ? { ...a, balance: a.balance + amount } : a)));
      flash("Traspaso registrado");
    },
    [accounts, flash],
  );

  const addAccount = useCallback(
    (a: Omit<Account, "id" | "history" | "initialBalance">) => {
      setAccounts((list) => {
        const id = Math.max(0, ...list.map((x) => x.id)) + 1;
        return [...list, { ...a, id, initialBalance: a.balance, history: Array.from({ length: 12 }, () => a.balance) }];
      });
      flash("Cuenta creada");
    },
    [flash],
  );

  const addHolding = useCallback(
    (h: NewHolding) => {
      setHoldings((list) => {
        const id = Math.max(0, ...list.map((x) => x.id)) + 1;
        const prices = Array.from({ length: 24 }, (_, i) => h.price * (0.92 + (i / 23) * 0.08));
        const { country, nickname, category, ...rest } = h;
        return [
          ...list,
          {
            ...rest,
            id,
            nickname: nickname?.trim() || rest.ticker,
            category: category ?? "Fondo indexado",
            top: [["Sin desglose", 100]] as [string, number][],
            sectors: [["Sin clasificar", 100]] as [string, number][],
            countries: [[country ?? "Sin clasificar", 100]] as [string, number][],
            contrib: [...Array(23).fill(0), h.invested] as number[],
            prices,
            spark: prices.filter((_, i) => i % 2 === 1),
            change1d: 0,
            operations: [{ id: 1, date: "2026-02-24", type: "compra", units: h.units, price: h.invested / Math.max(h.units, 1e-9), fees: 0 }],
          },
        ];
      });
      flash("Producto añadido a la cartera");
    },
    [flash],
  );

  /** Efecto de una operación sobre participaciones, coste y aportaciones mensuales (sign = +1 aplicar, -1 revertir) */
  const withOp = (h: Holding, op: Omit<Operation, "id">, sign: 1 | -1): Holding => {
    const isBuy = op.type === "compra" || op.type === "aportacion";
    const isSell = op.type === "venta";
    const avg = h.units > 0 ? h.invested / h.units : 0;
    const cash = op.units * op.price + op.fees;
    const monthsAgo = (2026 - Number(op.date.slice(0, 4))) * 12 + (2 - Number(op.date.slice(5, 7)));
    const idx = 23 - monthsAgo;
    const contrib = [...(h.contrib ?? Array(24).fill(0))];
    if (isBuy && idx >= 0 && idx < 24) contrib[idx] = Math.max(0, contrib[idx] + sign * cash);
    return {
      ...h,
      contrib,
      units: Math.max(0, h.units + (isBuy ? sign * op.units : isSell ? -sign * op.units : 0)),
      invested: Math.max(0, h.invested + (isBuy ? sign * cash : isSell ? -sign * op.units * avg : 0)),
    };
  };

  /* ------------------------------------------------------------------
     Compras de productos → movimiento de gasto en la categoría «Inversiones»

     El movimiento se registra en la cuenta del producto para que aparezca en
     su lista de movimientos. NO se toca `account.balance`: en las cuentas de
     inversión el saldo se deduce del valor de los productos, así que restarlo
     otra vez descontaría el dinero dos veces.
  ------------------------------------------------------------------ */

  /** Categoría «Inversiones» (se crea la primera vez, con su subcategoría). */
  const investmentCategory = useCallback((): { categoryId: number; subcategoryId: number } => {
    const existing = categories.find((c) => /^inversi/i.test(c.name.trim()));
    if (existing) {
      const sub =
        existing.subcategories.find((s) => /financier/i.test(s.name)) ??
        existing.subcategories.find((s) => /compra/i.test(s.name)) ??
        existing.subcategories[0];
      return { categoryId: existing.id, subcategoryId: sub?.id ?? 0 };
    }
    const id = Math.max(0, ...categories.map((c) => c.id)) + 1;
    const subId = id * 100 + 1;
    setCategories((list) => [
      ...list,
      {
        id,
        name: "Inversiones",
        icon: "chart",
        colorIdx: 5,
        kind: "gasto",
        subcategories: [{ id: subId, name: "Compras de productos", icon: "chart" }],
      },
    ]);
    return { categoryId: id, subcategoryId: subId };
  }, [categories]);

  /**
   * Ajusta el saldo de la cuenta al registrar o quitar una compra.
   * En las cuentas de inversión el saldo ya incluye el valor de los productos,
   * así que no se toca; en las cuentas corrientes el dinero sí sale de la cuenta.
   */
  const settlePurchase = useCallback((accountId: number, spent: number) => {
    setAccounts((list) =>
      list.map((a) =>
        a.id === accountId && a.kind === "corriente"
          ? { ...a, balance: Math.round((a.balance - spent) * 100) / 100 }
          : a,
      ),
    );
  }, []);

  /** Alta del movimiento asociado a una compra. */
  const pushPurchaseMovement = useCallback(
    (product: Holding, operation: Omit<Operation, "id">, operationId: number) => {
      const { categoryId, subcategoryId } = investmentCategory();
      const total = Math.round((operation.units * operation.price + operation.fees) * 100) / 100;
      setTransactions((list) => {
        const id = Math.max(0, ...list.map((t) => t.id)) + 1;
        return sortTx([
          {
            id,
            date: operation.date,
            concept: `Compra ${product.nickname || product.ticker}`,
            categoryId,
            subcategoryId,
            accountId: product.accountId,
            amount: -Math.abs(total),
            note: `${operation.units} × ${operation.price} €${operation.fees ? ` + ${operation.fees} € de comisiones` : ""}`,
            productId: product.id,
            operationId,
          },
          ...list,
        ]);
      });
      settlePurchase(product.accountId, total);
    },
    [investmentCategory, settlePurchase],
  );

  /** Actualiza el movimiento asociado a una operación ya existente. */
  const syncPurchaseMovement = useCallback(
    (product: Holding, operationId: number, operation: Omit<Operation, "id"> | null) => {
      const linked = transactions.find((t) => t.productId === product.id && t.operationId === operationId);
      if (!linked) return;
      const previous = -linked.amount;
      const total = operation ? Math.round((operation.units * operation.price + operation.fees) * 100) / 100 : 0;
      settlePurchase(product.accountId, total - previous);
      setTransactions((list) => {
        if (!operation) return list.filter((t) => t.id !== linked.id);
        return sortTx(
          list.map((t) =>
            t.id === linked.id
              ? {
                  ...t,
                  date: operation.date,
                  amount: -Math.abs(total),
                  note: `${operation.units} × ${operation.price} €${operation.fees ? ` + ${operation.fees} € de comisiones` : ""}`,
                }
              : t,
          ),
        );
      });
    },
    [transactions, settlePurchase],
  );

  const addOperation = useCallback(
    (productId: number, op: Omit<Operation, "id">) => {
      const product = holdings.find((h) => h.id === productId);
      const id = Math.max(0, ...(product?.operations.map((o) => o.id) ?? [0])) + 1;
      setHoldings((list) =>
        list.map((h) => {
          if (h.id !== productId) return h;
          return { ...withOp(h, op, 1), operations: [...h.operations, { ...op, id }] };
        }),
      );
      if (product && op.type === "compra") pushPurchaseMovement(product, op, id);
      flash(op.type === "compra" ? "Compra registrada y anotada en Inversiones" : "Operación registrada");
    },
    [holdings, pushPurchaseMovement, flash],
  );

  const updateOperation = useCallback(
    (productId: number, opId: number, op: Omit<Operation, "id">) => {
      setHoldings((list) =>
        list.map((h) => {
          if (h.id !== productId) return h;
          const old = h.operations.find((o) => o.id === opId);
          if (!old) return h;
          const next = withOp(withOp(h, old, -1), op, 1);
          return { ...next, operations: next.operations.map((o) => (o.id === opId ? { ...op, id: opId } : o)) };
        }),
      );
      const product = holdings.find((h) => h.id === productId);
      if (product) syncPurchaseMovement(product, opId, op.type === "compra" ? op : null);
      flash("Operación actualizada");
    },
    [holdings, syncPurchaseMovement, flash],
  );

  const deleteOperation = useCallback(
    (productId: number, opId: number) => {
      setHoldings((list) =>
        list.map((h) => {
          if (h.id !== productId) return h;
          const old = h.operations.find((o) => o.id === opId);
          if (!old) return h;
          return { ...withOp(h, old, -1), operations: h.operations.filter((o) => o.id !== opId) };
        }),
      );
      setTransactions((list) => list.filter((t) => !(t.productId === productId && t.operationId === opId)));
      flash("Operación eliminada");
    },
    [flash],
  );

  const addCategory = useCallback(
    (c: Omit<Category, "id" | "subcategories">, subs: string[]) => {
      setCategories((list) => {
        const id = Math.max(0, ...list.map((x) => x.id)) + 1;
        return [...list, { ...c, id, subcategories: subs.filter(Boolean).map((name, i) => ({ id: id * 10 + i + 1, name })) }];
      });
      flash("Categoría creada");
    },
    [flash],
  );

  const addSubcategory = useCallback(
    (parentId: number, name: string, extra?: { icon?: string; colorIdx?: import("@/lib/colors").ColorRef }) => {
      setCategories((list) =>
        list.map((c) => {
          if (c.id !== parentId) return c;
          const nextId = Math.max(c.id * 10, ...c.subcategories.map((s) => s.id)) + 1;
          return {
            ...c,
            subcategories: [...c.subcategories, { id: nextId, name, icon: extra?.icon ?? "tag", colorIdx: extra?.colorIdx }],
          };
        }),
      );
      flash("Subcategoría añadida");
    },
    [flash],
  );

  const findSibling = (list: Tx[], tx: Tx) =>
    list.find(
      (t) =>
        t.id !== tx.id &&
        t.categoryId === 0 &&
        t.accountId !== tx.accountId &&
        t.date === tx.date &&
        t.amount === -tx.amount,
    );

  const updateTransaction = useCallback(
    (id: number, next: Omit<Tx, "id">) => {
      const old = transactions.find((t) => t.id === id);
      if (!old || old.categoryId === 0) return;
      setTransactions((list) => sortTx(list.map((t) => (t.id === id ? { ...next, id, operationId: old.operationId, productId: old.productId } : t))));
      if (!old.operationId) {
        setAccounts((list) =>
          list.map((a) => {
            let b = a.balance;
            if (a.id === old.accountId) b -= old.amount;
            if (a.id === next.accountId) b += next.amount;
            return b === a.balance ? a : { ...a, balance: b };
          }),
        );
      }
      flash("Movimiento actualizado");
    },
    [transactions, flash],
  );

  const updateTransfer = useCallback(
    (txId: number, v: { from: number; to: number; amount: number; date: string; concept: string }) => {
      const leg = transactions.find((t) => t.id === txId);
      if (!leg || leg.categoryId !== 0) return;
      const sib = findSibling(transactions, leg);
      const legs = sib ? [leg, sib] : [leg];
      setTransactions((list) => {
        const rest = list.filter((t) => !legs.some((l) => l.id === t.id));
        const fromName = accounts.find((a) => a.id === v.from)?.name ?? "";
        const toName = accounts.find((a) => a.id === v.to)?.name ?? "";
        const id = Math.max(0, ...rest.map((t) => t.id)) + 1;
        return sortTx([
          { id, date: v.date, concept: `${v.concept} → ${toName}`, categoryId: 0, subcategoryId: 0, accountId: v.from, amount: -v.amount },
          { id: id + 1, date: v.date, concept: `${v.concept} ← ${fromName}`, categoryId: 0, subcategoryId: 0, accountId: v.to, amount: v.amount },
          ...rest,
        ]);
      });
      setAccounts((list) =>
        list.map((a) => {
          let b = a.balance;
          for (const l of legs) if (a.id === l.accountId) b -= l.amount;
          if (a.id === v.from) b -= v.amount;
          if (a.id === v.to) b += v.amount;
          return b === a.balance ? a : { ...a, balance: b };
        }),
      );
      flash("Traspaso actualizado");
    },
    [transactions, accounts, flash],
  );

  const updateAccount = useCallback(
    (id: number, patch: Partial<Account>) => {
      setAccounts((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      flash("Cuenta actualizada");
    },
    [flash],
  );
  /* ---------------------- organización de categorías ---------------------- */

  const reorderCategory = useCallback(
    (id: number, direction: -1 | 1) => {
      setCategories((list) => {
        const index = list.findIndex((c) => c.id === id);
        return index < 0 ? list : moveItem(list, index, direction);
      });
      flash(direction < 0 ? "Categoría movida hacia arriba" : "Categoría movida hacia abajo");
    },
    [flash],
  );

  const reorderSubcategory = useCallback(
    (categoryId: number, subId: number, direction: -1 | 1) => {
      setCategories((list) =>
        list.map((c) => {
          if (c.id !== categoryId) return c;
          const index = c.subcategories.findIndex((s) => s.id === subId);
          return index < 0 ? c : { ...c, subcategories: moveItem(c.subcategories, index, direction) };
        }),
      );
      flash("Subcategoría reordenada");
    },
    [flash],
  );

  const promoteSubcategory = useCallback(
    (categoryId: number, subId: number) => {
      setCategories((list) => {
        const change = promoteInTree(list, categoryId, subId);
        if (change.remap) setTransactions((txs) => txs.map((t) => remapTransaction(t, change.remap)));
        return change.categories;
      });
      flash("Subcategoría convertida en categoría · sus movimientos la acompañan");
    },
    [flash],
  );

  const demoteCategory = useCallback(
    (categoryId: number, targetCategoryId: number) => {
      setCategories((list) => {
        const change = demoteInTree(list, categoryId, targetCategoryId);
        if (change.remap) setTransactions((txs) => txs.map((t) => remapTransaction(t, change.remap)));
        return change.categories;
      });
      flash("Categoría convertida en subcategoría · movimientos conservados");
    },
    [flash],
  );

  const moveSubcategory = useCallback(
    (categoryId: number, subId: number, targetCategoryId: number) => {
      setCategories((list) => moveSubInTree(list, categoryId, subId, targetCategoryId));
      flash("Subcategoría movida de categoría");
    },
    [flash],
  );

  const updateCategory = useCallback(
    (id: number, patch: Partial<Category>) => {
      setCategories((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      flash("Categoría actualizada");
    },
    [flash],
  );
  const updateSubcategory = useCallback(
    (categoryId: number, subId: number, patch: Partial<Subcategory>) => {
      setCategories((list) =>
        list.map((c) => (c.id === categoryId ? { ...c, subcategories: c.subcategories.map((s) => (s.id === subId ? { ...s, ...patch } : s)) } : c)),
      );
      flash("Subcategoría actualizada");
    },
    [flash],
  );
  const updateHolding = useCallback(
    (id: number, patch: Partial<Holding>) => {
      setHoldings((list) => list.map((h) => (h.id === id ? { ...h, ...patch } : h)));
      flash("Producto actualizado");
    },
    [flash],
  );

  const deleteTransaction = useCallback(
    (id: number) => {
      const tx = transactions.find((t) => t.id === id);
      if (!tx) return;
      setTransactions((list) => list.filter((t) => t.id !== id));

      /* Un movimiento de compra se borra junto con su operación; el saldo se
         devuelve con la misma regla con la que se descontó. */
      if (typeof tx.operationId === "number" && typeof tx.productId === "number") {
        const productId = tx.productId;
        const operationId = tx.operationId;
        setHoldings((list) =>
          list.map((h) => {
            if (h.id !== productId) return h;
            const old = h.operations.find((o) => o.id === operationId);
            if (!old) return h;
            return { ...withOp(h, old, -1), operations: h.operations.filter((o) => o.id !== operationId) };
          }),
        );
        settlePurchase(tx.accountId, tx.amount);
        flash("Movimiento y operación de compra eliminados");
        return;
      }

      setAccounts((list) => list.map((a) => (a.id === tx.accountId ? { ...a, balance: a.balance - tx.amount } : a)));
      flash("Movimiento eliminado");
    },
    [transactions, settlePurchase, flash],
  );

  const setAccountArchived = useCallback(
    (id: number, archived: boolean) => {
      setAccounts((list) => list.map((a) => (a.id === id ? { ...a, archived: archived || undefined } : a)));
      flash(archived ? "Cuenta archivada · sus movimientos siguen contando en las estadísticas" : "Cuenta recuperada");
    },
    [flash],
  );

  const deleteAccount = useCallback(
    (id: number) => {
      const products = holdings.filter((h) => h.accountId === id);
      if (products.length) {
        flash(`!Mueve antes los ${products.length} productos de esta cuenta`);
        return false;
      }
      const removed = transactions.filter((t) => t.accountId === id).length;
      setAccounts((list) => list.filter((a) => a.id !== id));
      setTransactions((list) => list.filter((t) => t.accountId !== id));
      setRoute((r) => (r.accountId === id ? { page: "cuentas" } : r));
      flash(`Cuenta eliminada junto con ${removed} movimientos`);
      return true;
    },
    [holdings, transactions, flash],
  );

  const clearTransactions = useCallback(() => {
    setTransactions([]);
    flash("Movimientos borrados · cuentas y productos conservados");
  }, [flash]);

  const resetData = useCallback(() => {
    setAccounts(ACCOUNTS);
    setCategories(CATEGORIES);
    setHoldings(HOLDINGS);
    setTransactions(TRANSACTIONS);
    setSources(DEFAULT_SOURCES);
    setRoute({ page: "ajustes" });
    setHistory([]);
    setStack([]);
    flash("Datos de ejemplo restaurados");
  }, [flash]);

  const exportData = useCallback(
    () => JSON.stringify({ app: "mi-patrimonio-demo", version: 1, exportedAt: "2026-02-24", accounts, categories, holdings, transactions }, null, 2),
    [accounts, categories, holdings, transactions],
  );

  const importData = useCallback(
    (json: string) => {
      try {
        const d = JSON.parse(json) as Record<string, unknown>;
        if (!Array.isArray(d.accounts) || !Array.isArray(d.categories) || !Array.isArray(d.holdings) || !Array.isArray(d.transactions)) throw new Error("formato");
        setAccounts(d.accounts as Account[]);
        setCategories(d.categories as Category[]);
        setHoldings(
          (d.holdings as Holding[]).map((h) => ({
            ...h,
            contrib: Array.isArray(h.contrib) && h.contrib.length === 24 ? h.contrib : Array(24).fill(0),
            sectors: Array.isArray(h.sectors) && h.sectors.length ? h.sectors : [["Sin clasificar", 100]],
            top: Array.isArray(h.top) && h.top.length ? h.top : [["Sin desglose", 100]],
            countries: Array.isArray(h.countries) && h.countries.length ? h.countries : [["Sin clasificar", 100]],
          })),
        );
        setTransactions(sortTx(d.transactions as Tx[]));
        flash("Datos importados correctamente");
        return true;
      } catch {
        flash("!Archivo no válido: se esperaba una copia exportada desde esta pantalla");
        return false;
      }
    },
    [flash],
  );

  const toggleSource = useCallback((name: string) => setSources((s) => ({ ...s, [name]: !s[name] })), []);

  /**
   * Actualizar precios ya no es aleatorio acumulativo:
   *  1. Se aplica un precio determinista para el día de hoy (repetir el clic
   *     devuelve el mismo valor, porque se calcula desde `priceBase`).
   *  2. Se intenta traer precios reales de /api/prices; si llegan, sustituyen
   *     a los simulados. Si no hay red, se queda la simulación estable.
   */
  const refreshPrices = useCallback(async () => {
    const today = todayIso();
    const snapshot = holdings.map((h) => ({ id: h.id, ticker: h.ticker, isin: h.isin, base: h.priceBase ?? h.price }));

    setHoldings((list) => list.map((h) => withPrice(h, h.priceBase ?? h.price, stablePrice(h.priceBase ?? h.price, h.ticker, today), today)));
    flash(`Precios actualizados · ${shortDate(today)}`);

    if (!snapshot.length) return;
    try {
      const response = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: snapshot }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("sin respuesta");
      const payload = (await response.json()) as { prices?: Record<string, number> };
      const live = Object.entries(payload.prices ?? {}).filter(([, price]) => typeof price === "number" && price > 0);
      if (!live.length) {
        flash("Las fuentes no tienen precios para estos productos: se mantiene la simulación");
        return;
      }
      const byId = new Map(live.map(([id, price]) => [Number(id), price]));
      setHoldings((list) => list.map((h) => {
        const price = byId.get(h.id);
        return price ? withPrice(h, h.priceBase ?? h.price, price, today) : h;
      }));
      flash(`Precios de mercado: ${live.length} de ${snapshot.length} productos`);
    } catch {
      flash("Sin conexión con las fuentes: se mantiene la simulación del día");
    }
  }, [holdings, flash]);

  const modal = stack.length ? stack[stack.length - 1] : null;

  const value = useMemo<PreviewState>(
    () => ({
      route, go, back, modal, openModal, closeModal, closeAllModals, period, setPeriod, toast, flash, saveState, lastSavedAt,
      accounts, categories, holdings, transactions, sources, toggleSource,
      addTransaction, addTransfer, addAccount, addHolding, addOperation, addCategory, addSubcategory, reorderCategory, reorderSubcategory, promoteSubcategory, demoteCategory, moveSubcategory,
      updateTransaction, updateTransfer, updateAccount, updateCategory, updateSubcategory, updateHolding, updateOperation, deleteOperation,
      deleteTransaction, deleteAccount, setAccountArchived, clearTransactions, resetData, exportData, importData, refreshPrices,
    }),
    [route, go, back, modal, openModal, closeModal, closeAllModals, period, toast, flash, saveState, lastSavedAt, accounts, categories, holdings, transactions, sources, toggleSource, addTransaction, addTransfer, addAccount, addHolding, addOperation, addCategory, addSubcategory, reorderCategory, reorderSubcategory, promoteSubcategory, demoteCategory, moveSubcategory, updateTransaction, updateTransfer, updateAccount, updateCategory, updateSubcategory, updateHolding, updateOperation, deleteOperation, deleteTransaction, deleteAccount, setAccountArchived, clearTransactions, resetData, exportData, importData, refreshPrices],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreview(): PreviewState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreview fuera de PreviewDataProvider");
  return v;
}

/* ------------------------------------------------------------------
   Arquetipo + configuración activos
------------------------------------------------------------------ */

interface ArchCtx {
  cfg: DesignConfig;
  arch: ArchetypeDef;
  isMobile: boolean;
  patchConfig?: (p: Partial<DesignConfig>) => void;
}

const ArchContext = createContext<ArchCtx | null>(null);

export function ArchProvider({ cfg, patchConfig, isMobile, children }: { cfg: DesignConfig; patchConfig?: (p: Partial<DesignConfig>) => void; /** Anula el dispositivo guardado (la app cambia sola a móvil en pantallas estrechas) */ isMobile?: boolean; children: ReactNode }) {
  const value = useMemo<ArchCtx>(
    () => ({
      cfg,
      arch: { ...getArchetype(cfg.archetypeKey), chartStyle: cfg.chartStyleKey },
      isMobile: isMobile ?? cfg.device === "mobile",
      patchConfig,
    }),
    [cfg, patchConfig, isMobile],
  );
  return <ArchContext.Provider value={value}>{children}</ArchContext.Provider>;
}

export function useArch(): ArchCtx {
  const v = useContext(ArchContext);
  if (!v) throw new Error("useArch fuera de ArchProvider");
  return v;
}

/** Estilo de donut elegido por el usuario (por defecto, anillo clásico) */
export function useDonutStyle(): DonutKey {
  const v = useContext(ArchContext);
  return v?.cfg.donutKey ?? "ring";
}
