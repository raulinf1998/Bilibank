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
  | { kind: "confirmClear" };

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
  refreshPrices: () => void;

  addTransaction: (tx: Omit<Tx, "id">) => void;
  addTransfer: (from: number, to: number, amount: number, date: string, concept: string) => void;
  addAccount: (a: Omit<Account, "id" | "history" | "initialBalance">) => void;
  addHolding: (h: NewHolding) => void;
  addOperation: (productId: number, op: Omit<Operation, "id">) => void;
  addCategory: (c: Omit<Category, "id" | "subcategories">, subs: string[]) => void;
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
  clearTransactions: () => void;
  resetData: () => void;
  exportData: () => string;
  importData: (json: string) => boolean;
}

const Ctx = createContext<PreviewState | null>(null);

const sortTx = (list: Tx[]) => [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));

export function PreviewDataProvider({ children, initialRoute, initialModal, initialData, persist = false }: { children: ReactNode; initialRoute?: Route; initialModal?: ModalKind; initialData?: WorkspaceSnapshot | null; persist?: boolean }) {
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

  const addOperation = useCallback(
    (productId: number, op: Omit<Operation, "id">) => {
      setHoldings((list) =>
        list.map((h) => {
          if (h.id !== productId) return h;
          const id = Math.max(0, ...h.operations.map((o) => o.id)) + 1;
          return { ...withOp(h, op, 1), operations: [...h.operations, { ...op, id }] };
        }),
      );
      flash("Operación registrada");
    },
    [flash],
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
      flash("Operación actualizada");
    },
    [flash],
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
      setTransactions((list) => sortTx(list.map((t) => (t.id === id ? { ...next, id } : t))));
      setAccounts((list) =>
        list.map((a) => {
          let b = a.balance;
          if (a.id === old.accountId) b -= old.amount;
          if (a.id === next.accountId) b += next.amount;
          return b === a.balance ? a : { ...a, balance: b };
        }),
      );
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
      setAccounts((list) => list.map((a) => (a.id === tx.accountId ? { ...a, balance: a.balance - tx.amount } : a)));
      flash("Movimiento eliminado");
    },
    [transactions, flash],
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

  const refreshPrices = useCallback(() => {
    setHoldings((list) =>
      list.map((h) => {
        const drift = (Math.random() - 0.5) * 0.04;
        const price = Math.max(0.01, Math.round(h.price * (1 + drift) * 100) / 100);
        const prices = [...h.prices.slice(1), price];
        return {
          ...h,
          price,
          change1d: Math.round(drift * 10000) / 100,
          prices,
          spark: prices.filter((_, i) => i % 2 === 1),
        };
      }),
    );
    flash("Precios actualizados");
  }, [flash]);

  const modal = stack.length ? stack[stack.length - 1] : null;

  const value = useMemo<PreviewState>(
    () => ({
      route, go, back, modal, openModal, closeModal, closeAllModals, period, setPeriod, toast, flash, saveState, lastSavedAt,
      accounts, categories, holdings, transactions, sources, toggleSource,
      addTransaction, addTransfer, addAccount, addHolding, addOperation, addCategory, addSubcategory,
      updateTransaction, updateTransfer, updateAccount, updateCategory, updateSubcategory, updateHolding, updateOperation, deleteOperation,
      deleteTransaction, clearTransactions, resetData, exportData, importData, refreshPrices,
    }),
    [route, go, back, modal, openModal, closeModal, closeAllModals, period, toast, flash, saveState, lastSavedAt, accounts, categories, holdings, transactions, sources, toggleSource, addTransaction, addTransfer, addAccount, addHolding, addOperation, addCategory, addSubcategory, updateTransaction, updateTransfer, updateAccount, updateCategory, updateSubcategory, updateHolding, updateOperation, deleteOperation, deleteTransaction, clearTransactions, resetData, exportData, importData, refreshPrices],
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

export function ArchProvider({ cfg, patchConfig, children }: { cfg: DesignConfig; patchConfig?: (p: Partial<DesignConfig>) => void; children: ReactNode }) {
  const value = useMemo<ArchCtx>(() => ({ cfg, arch: { ...getArchetype(cfg.archetypeKey), chartStyle: cfg.chartStyleKey }, isMobile: cfg.device === "mobile", patchConfig }), [cfg, patchConfig]);
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
