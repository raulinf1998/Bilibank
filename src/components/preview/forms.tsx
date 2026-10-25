"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown, ArrowDownRight, ArrowLeftRight, ArrowUp, ArrowUpRight, Bell, Briefcase, Check, ChevronRight, Download, Landmark, LoaderCircle, Pencil, Plus, Search, StickyNote, Tag, Trash2, TriangleAlert, X,
} from "lucide-react";
import type { Account, AccountKind, Category, Holding, Operation, Tx } from "@/lib/mock";
import { HOLDING_CATEGORIES, type HoldingCategory } from "@/lib/mock";
import { subColor } from "@/lib/mock";
import { chartColor, onColor, type ColorRef } from "@/lib/colors";
import { iconNode } from "@/lib/icons";
import { KIND_LABEL, PERIODS } from "@/lib/mock";
import { inPeriod, periodLabel } from "@/lib/series";
import { breakdownTotal, isPlaceholderBreakdown, normalizeBreakdown } from "@/lib/market";
import { isTransfer, transferEndpoints } from "@/lib/ledger";
import { formatEUR, formatEUR0, formatFullDate, formatSigned } from "@/lib/format";
import { Btn, ColorPicker, Field, IconBadge, IconPicker, Input, Modal, Segmented, Select } from "./primitives";
import { DateField } from "./datefield";
import { usePreview } from "./state";
import { CAT_ICON, AccountDetailEmbedded, TxList, catIcon, useOpenAccount, useSpending } from "./views-main";
import { PaletteEditorModal } from "./palette-editor";

const today = "2026-02-24";

export function ModalHost() {
  const { modal, closeModal } = usePreview();
  if (!modal) return null;
  switch (modal.kind) {
    case "tx":
      return <TransactionForm key="tx" accountId={modal.accountId} categoryId={modal.categoryId} initialType="gasto" onClose={closeModal} />;
    case "transfer":
      return <TransactionForm key="tr" initialType="traspaso" onClose={closeModal} />;
    case "account":
      return <AccountForm onClose={closeModal} />;
    case "product":
      return <ProductForm accountId={modal.accountId} onClose={closeModal} />;
    case "operation":
      return <OperationForm productId={modal.productId} onClose={closeModal} />;
    case "category":
      return <CategoryForm parentId={modal.parentId} onClose={closeModal} />;
    case "categoryTx":
      return <CategoryTxModal key={`${modal.categoryId}-${modal.subcategoryId ?? 0}`} categoryId={modal.categoryId} subcategoryId={modal.subcategoryId} onClose={closeModal} />;
    case "editAccount":
      return <EditAccountModal accountId={modal.accountId} onClose={closeModal} />;
    case "editCategory":
      return <EditCategoryModal categoryId={modal.categoryId} onClose={closeModal} />;
    case "editProduct":
      return <EditProductModal productId={modal.productId} onClose={closeModal} />;
    case "editOperation":
      return <OperationForm key={`op-${modal.opId}`} productId={modal.productId} operationId={modal.opId} onClose={closeModal} />;
    case "editSubcategory":
      return <EditSubcategoryModal key={`sub-${modal.subcategoryId}`} categoryId={modal.categoryId} subcategoryId={modal.subcategoryId} onClose={closeModal} />;
    case "txDetail":
      return <TxDetailModal txId={modal.txId} onClose={closeModal} />;
    case "editTx":
      return <TransactionForm key={`edit-${modal.txId}`} txId={modal.txId} onClose={closeModal} />;
    case "accountDetail":
      return <AccountDetailModal key={`acc-${modal.accountId}`} accountId={modal.accountId} onClose={closeModal} />;
    case "paletteEditor":
      return <PaletteEditorModal key={`pal-${modal.key ?? "new"}`} paletteKey={modal.key} onClose={closeModal} />;
    case "search":
      return <SearchModal onClose={closeModal} />;
    case "notifications":
      return <NotificationsModal onClose={closeModal} />;
    case "confirmClear":
      return <ConfirmClearModal onClose={closeModal} />;
    case "organizeCategories":
      return <OrganizeCategoriesModal categoryId={modal.categoryId} onClose={closeModal} />;
    default:
      return null;
  }
}

/* ------------------------------ Nueva transacción (gasto / ingreso / traspaso) ------------------------------ */

type TxType = "gasto" | "ingreso" | "traspaso";

const TONE: Record<TxType, string> = { gasto: "var(--neg)", ingreso: "var(--pos)", traspaso: "var(--accent)" };
const TYPE_LABEL: Record<TxType, string> = { gasto: "Gasto", ingreso: "Ingreso", traspaso: "Traspaso" };
const TYPE_ICON: Record<TxType, React.ReactNode> = {
  gasto: <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2.4} />,
  ingreso: <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.4} />,
  traspaso: <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.4} />,
};

const accIcon = (a: Account) => (a.kind === "inversion" ? <Briefcase className="h-4 w-4" /> : <Landmark className="h-4 w-4" />);

function AccountCard({ a, selected, onPick }: { a: Account; selected: boolean; onPick: () => void }) {
  const col = chartColor(a.colorIdx);
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full min-w-0 flex-col items-start gap-2 overflow-hidden text-left transition-colors"
      style={{
        padding: 10,
        borderRadius: "var(--radius)",
        border: `1.5px solid ${selected ? col : "var(--border)"}`,
        background: selected ? `color-mix(in srgb, ${col} 14%, var(--surface-2))` : "var(--surface-2)",
      }}
    >
      <IconBadge icon={accIcon(a)} colorIdx={a.colorIdx} size={28} />
      <div className="w-full min-w-0">
        <p className="truncate text-[12px] font-semibold leading-tight" style={{ color: "var(--text)" }} title={a.name}>{a.name}</p>
        <p className="pv-num pv-faint truncate text-[11px]">{formatEUR(a.balance)}</p>
      </div>
    </button>
  );
}

function TransactionForm({
  accountId,
  categoryId: presetCategory,
  txId,
  initialType = "gasto",
  onClose,
}: {
  accountId?: number;
  categoryId?: number;
  /** Movimiento que se edita: se reutiliza el mismo formulario que al crear. */
  txId?: number;
  initialType?: TxType;
  onClose: () => void;
}) {
  const { accounts, categories, transactions, addTransaction, updateTransaction, addTransfer, updateTransfer, deleteTransaction } = usePreview();
  const editing = txId === undefined ? undefined : transactions.find((t) => t.id === txId);
  const transferEdit = editing ? editing.categoryId === 0 : false;
  const ends = editing && transferEdit ? transferEndpoints(editing, transactions, accounts) : null;

  const [type, setType] = useState<TxType>(
    editing ? (transferEdit ? "traspaso" : editing.amount >= 0 ? "ingreso" : "gasto") : initialType,
  );
  const tone = TONE[type];

  const firstAccount = accounts.find((a) => a.kind === "corriente" && !a.archived) ?? accounts[0];
  const [accId, setAccId] = useState(editing?.accountId ?? accountId ?? firstAccount?.id ?? 1);
  const [fromId, setFromId] = useState(
    ends?.from?.id ?? (editing && transferEdit ? editing.accountId : accountId ?? firstAccount?.id ?? 1),
  );
  const [toId, setToId] = useState(
    ends?.to?.id ?? accounts.find((a) => a.id !== (accountId ?? firstAccount?.id))?.id ?? accounts[1]?.id ?? 2,
  );

  const catsForType = categories.filter((c) => (type === "ingreso" ? c.kind === "ingreso" : c.kind === "gasto"));
  const initialCat =
    editing && !transferEdit
      ? categories.find((c) => c.id === editing.categoryId) ?? catsForType[0]
      : categories.find((c) => c.id === presetCategory && c.kind === "gasto") ?? catsForType[0];
  const [categoryId, setCategoryId] = useState<number | null>(initialCat?.id ?? null);
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const [subcategoryId, setSubcategoryId] = useState<number | null>(
    editing && !transferEdit ? editing.subcategoryId : initialCat?.subcategories[0]?.id ?? null,
  );

  const [amount, setAmount] = useState(editing ? String(Math.abs(editing.amount)) : "");
  const [date, setDate] = useState(editing?.date ?? today);
  const [concept, setConcept] = useState(editing ? (transferEdit ? baseConcept(editing.concept) : editing.concept) : "");
  const [note, setNote] = useState(editing?.note ?? "");

  const changeType = (t: TxType) => {
    setType(t);
    if (t !== "traspaso") {
      const first = categories.find((c) => (t === "ingreso" ? c.kind === "ingreso" : c.kind === "gasto"));
      setCategoryId(first?.id ?? null);
      setSubcategoryId(first?.subcategories[0]?.id ?? null);
    }
  };

  const selectCategory = (c: Category) => {
    setCategoryId(c.id);
    setSubcategoryId(c.subcategories[0]?.id ?? null);
  };

  /* Las cuentas de inversión no se ofrecen para gastos e ingresos: sólo se
     mueven con traspasos (y con las compras de productos dentro de la app).
     La cuenta ya elegida sigue visible para no romper una edición. */
  const pickable = (current: number[]) =>
    accounts.filter((a) => (!a.archived && (type === "traspaso" || a.kind === "corriente")) || current.includes(a.id));

  const amountValid = Number(amount) > 0;
  const valid = type === "traspaso" ? amountValid && fromId !== toId : amountValid && Boolean(category) && Boolean(subcategoryId);

  const subName = category?.subcategories.find((s) => s.id === subcategoryId)?.name;
  const conceptText = concept.trim();

  const submit = () => {
    if (!valid) return;
    const value = Math.abs(Number(amount));

    if (editing) {
      if (type === "traspaso") {
        if (transferEdit) {
          updateTransfer(editing.id, { from: fromId, to: toId, amount: value, date, concept: conceptText || "Traspaso" });
        } else {
          deleteTransaction(editing.id);
          addTransfer(fromId, toId, value, date, conceptText || "Traspaso");
        }
      } else if (category) {
        const next: Omit<Tx, "id"> = {
          date,
          concept: conceptText || subName || category.name,
          categoryId: category.id,
          subcategoryId: subcategoryId ?? category.subcategories[0]?.id ?? 0,
          accountId: accId,
          amount: type === "gasto" ? -value : value,
          tags: editing.tags,
          note: note.trim() || undefined,
        };
        if (transferEdit) {
          /* Cambio de traspaso a gasto/ingreso: se quitan las dos patas y se crea el movimiento. */
          const pairId = ends?.pairId;
          deleteTransaction(editing.id);
          if (pairId !== undefined) deleteTransaction(pairId);
          addTransaction(next);
        } else {
          updateTransaction(editing.id, next);
        }
      }
    } else if (type === "traspaso") {
      addTransfer(fromId, toId, value, date, conceptText || "Traspaso");
    } else if (category) {
      addTransaction({
        date,
        concept: conceptText || subName || category.name,
        categoryId: category.id,
        subcategoryId: subcategoryId ?? category.subcategories[0]?.id ?? 0,
        accountId: accId,
        amount: type === "gasto" ? -value : value,
        note: note.trim() || undefined,
      });
    }
    onClose();
  };

  return (
    <Modal
      title={editing ? (transferEdit ? "Editar traspaso" : "Editar transacción") : "Nueva transacción"}
      sub={editing ? "Los saldos de las cuentas se recalculan al guardar" : undefined}
      onClose={onClose}
      width={580}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} full>Cancelar</Btn>
          <Btn onClick={submit} disabled={!valid} tone={tone} full icon={<Check className="h-3.5 w-3.5" strokeWidth={3} />}>
            {editing ? "Guardar cambios" : `Guardar ${TYPE_LABEL[type].toLowerCase()}`}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-1.5 p-1" style={{ background: "var(--surface-2)", borderRadius: "var(--radius)" }}>
          {(["gasto", "ingreso", "traspaso"] as TxType[]).map((t) => {
            const active = t === type;
            const c = TONE[t];
            return (
              <button key={t} type="button" onClick={() => changeType(t)} className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-semibold transition-colors" style={{ borderRadius: "var(--radius-sm)", background: active ? `color-mix(in srgb, ${c} 18%, transparent)` : "transparent", color: active ? c : "var(--muted)" }}>
                {TYPE_ICON[t]} {TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>

        <div className="py-1 text-center">
          <p className="pv-muted text-[11px] font-bold uppercase tracking-[0.18em]">Importe</p>
          <div className="mt-2 flex items-center justify-center gap-2.5">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} inputMode="decimal" placeholder="0,00" autoFocus className="pv-num pv-display bg-transparent text-center outline-none" style={{ width: 190, fontSize: 42, fontWeight: 800, color: "var(--text)", border: "none" }} />
            <span style={{ fontSize: 26, fontWeight: 700, color: tone }}>€</span>
          </div>
        </div>

        {type === "traspaso" ? (
          <div className="flex flex-col gap-4">
            <div>
              <span className="pv-muted mb-2 block text-[11px] font-bold uppercase tracking-[0.1em]">Desde</span>
              <div className="grid grid-cols-3 gap-2">{pickable([fromId]).map((a) => <AccountCard key={a.id} a={a} selected={fromId === a.id} onPick={() => setFromId(a.id)} />)}</div>
            </div>
            <div>
              <span className="pv-muted mb-2 block text-[11px] font-bold uppercase tracking-[0.1em]">Hacia</span>
              <div className="grid grid-cols-3 gap-2">{pickable([toId]).map((a) => <AccountCard key={a.id} a={a} selected={toId === a.id} onPick={() => setToId(a.id)} />)}</div>
            </div>
            <Field label="Concepto"><Input placeholder="Aportación mensual…" value={concept} onChange={(e) => setConcept(e.target.value)} /></Field>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="pv-muted text-[11px] font-bold uppercase tracking-[0.1em]">Cuenta</span>
                <span className="pv-faint text-[11px]">{pickable([accId]).length} cuentas</span>
              </div>
              <div className="grid grid-cols-3 gap-2">{pickable([accId]).map((a) => <AccountCard key={a.id} a={a} selected={accId === a.id} onPick={() => setAccId(a.id)} />)}</div>
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="pv-muted text-[11px] font-bold uppercase tracking-[0.1em]">Categoría</span>
                <span className="pv-faint text-[11px]">{catsForType.length} categorías</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {catsForType.map((c) => {
                  const selected = categoryId === c.id;
                  const col = chartColor(c.colorIdx);
                  const fg = onColor(typeof c.colorIdx === "string" ? c.colorIdx : "#000000");
                  return (
                    <button key={c.id} type="button" onClick={() => selectCategory(c)} title={c.name} className="flex min-w-0 flex-col items-center gap-1.5 overflow-hidden text-center transition-colors" style={{ padding: "10px 6px", borderRadius: "var(--radius)", border: `1.5px solid ${selected ? col : "var(--border)"}`, background: selected ? col : "var(--surface-2)" }}>
                      <span style={{ color: selected ? fg : col }}>{catIcon(c)}</span>
                      <span className="w-full break-words text-[10.5px] font-semibold leading-tight" style={{ color: selected ? fg : "var(--muted)", hyphens: "auto" }}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {category && (
              <div style={{ padding: 14, borderRadius: "var(--radius)", background: `color-mix(in srgb, ${chartColor(category.colorIdx)} 12%, var(--surface))`, border: `1px solid color-mix(in srgb, ${chartColor(category.colorIdx)} 38%, transparent)` }}>
                <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: chartColor(category.colorIdx) }}>
                  {catIcon(category)} {category.name} <span className="pv-faint text-[11px] font-normal normal-case tracking-normal">· elige subcategoría</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {category.subcategories.map((s) => {
                    const selected = subcategoryId === s.id;
                    const scol = chartColor(subColor(category, s));
                    const fg = onColor(typeof subColor(category, s) === "string" ? (subColor(category, s) as string) : "#000000");
                    return (
                      <button key={s.id} type="button" onClick={() => setSubcategoryId(s.id)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors" style={{ background: selected ? scol : "var(--surface-2)", color: selected ? fg : "var(--text)", border: `1px solid ${selected ? scol : "var(--border)"}` }}>
                        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : <span style={{ color: scol }}>{iconNode(s.icon)}</span>}
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <DateField value={date} onChange={setDate} />
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <StickyNote className="h-4 w-4 shrink-0" style={{ color: "var(--faint)" }} />
            <input
              value={type === "traspaso" ? concept : note}
              onChange={(e) => (type === "traspaso" ? setConcept(e.target.value) : setNote(e.target.value))}
              placeholder={type === "traspaso" ? "Concepto (opcional)" : "Nota (opcional)"}
              className="w-full bg-transparent text-[12.5px] outline-none"
              style={{ color: "var(--text)" }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Popup: gastos de una categoría ------------------------------ */

function CategoryTxModal({ categoryId, subcategoryId, onClose }: { categoryId: number; subcategoryId?: number; onClose: () => void }) {
  const { categories, transactions, period, setPeriod, go, openModal } = usePreview();
  const cat = categories.find((c) => c.id === categoryId);
  const [sub, setSub] = useState<number | null>(subcategoryId ?? null);

  const rows = useMemo(() => transactions.filter((t) => t.categoryId === categoryId && inPeriod(t.date, period)), [transactions, categoryId, period]);
  if (!cat) return null;
  const income = cat.kind === "ingreso";
  const activeSub = cat.subcategories.find((s) => s.id === sub) ?? null;
  const filtered = sub ? rows.filter((t) => t.subcategoryId === sub) : rows;
  const total = Math.abs(filtered.reduce((s, t) => s + t.amount, 0));
  const headColor = activeSub ? chartColor(subColor(cat, activeSub)) : chartColor(cat.colorIdx);

  return (
    <Modal
      title={cat.name}
      sub={`${periodLabel(period)} · ${filtered.length} ${income ? "ingresos" : "gastos"}`}
      onClose={onClose}
      width={620}
      footer={
        <>
          {activeSub && <Btn variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "editSubcategory", categoryId: cat.id, subcategoryId: activeSub.id })}>Editar subcategoría</Btn>}
          <Btn variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "editCategory", categoryId: cat.id })}>Editar categoría</Btn>
          <Btn variant="ghost" onClick={() => go({ page: "categorias", categoryId: cat.id })}>Ver categoría</Btn>
          <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "tx", categoryId: cat.id })}>{income ? "Añadir ingreso" : "Añadir gasto"}</Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented options={PERIODS} value={period} onChange={setPeriod} />

        <div className="flex items-center gap-4" style={{ padding: 14, borderRadius: "var(--radius)", background: `color-mix(in srgb, ${headColor} 12%, var(--surface))`, border: `1px solid color-mix(in srgb, ${headColor} 35%, transparent)` }}>
          <IconBadge icon={activeSub ? iconNode(activeSub.icon) : catIcon(cat)} colorIdx={activeSub ? subColor(cat, activeSub) : cat.colorIdx} size={44} />
          <div className="min-w-0 flex-1">
            <p className="pv-muted text-[11px] font-semibold uppercase tracking-[0.1em]">{activeSub ? activeSub.name : "Total de la categoría"}</p>
            <p className="pv-num pv-display text-[26px] font-bold leading-tight" style={{ color: "var(--text)" }}>{formatEUR(total)}</p>
            <p className="pv-faint mt-1 text-[11px]">{filtered.length} {income ? "ingresos" : "movimientos"} · {periodLabel(period).toLowerCase()}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSub(null)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ background: sub === null ? chartColor(cat.colorIdx) : "var(--surface-2)", color: sub === null ? onColor(typeof cat.colorIdx === "string" ? cat.colorIdx : "#000000") : "var(--text)", border: `1px solid ${sub === null ? chartColor(cat.colorIdx) : "var(--border)"}` }}>
            {catIcon(cat)} Todas · {rows.length}
          </button>
          {cat.subcategories.map((s) => {
            const n = rows.filter((t) => t.subcategoryId === s.id).length;
            const on = sub === s.id;
            const scol = chartColor(subColor(cat, s));
            const fg = onColor(typeof subColor(cat, s) === "string" ? (subColor(cat, s) as string) : "#000000");
            return (
              <button key={s.id} type="button" onClick={() => setSub(on ? null : s.id)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ background: on ? scol : "var(--surface-2)", color: on ? fg : n ? "var(--text)" : "var(--faint)", border: `1px solid ${on ? scol : "var(--border)"}` }}>
                <span style={{ color: on ? fg : scol }}>{iconNode(s.icon)}</span>
                {s.name} · {n}
              </button>
            );
          })}
        </div>

        <div className="-mx-5 overflow-hidden" style={{ borderTop: "1px solid var(--border)" }}>
          <TxList txs={filtered} limit={60} fixedCategory />
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Detalle de movimiento ------------------------------ */

function TxDetailModal({ txId, onClose }: { txId: number; onClose: () => void }) {
  const { transactions, categories, accounts, deleteTransaction, openModal } = usePreview();
  const openAccount = useOpenAccount();
  const tx = transactions.find((t) => t.id === txId);
  const [confirm, setConfirm] = useState(false);
  if (!tx) return null;
  const cat = categories.find((c) => c.id === tx.categoryId);
  const sub = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
  const acc = accounts.find((a) => a.id === tx.accountId);
  const ends = isTransfer(tx) ? transferEndpoints(tx, transactions, accounts) : null;
  const rowsInfo: [string, string][] = [
    ["Fecha", formatFullDate(tx.date)],
    ...(ends
      ? ([
          ["Cuenta de origen", ends.from?.name ?? "—"],
          ["Cuenta de destino", ends.to?.name ?? "—"],
          ["Tipo", tx.amount < 0 ? "Salida de dinero" : "Entrada de dinero"],
        ] as [string, string][])
      : ([["Cuenta", acc ? acc.name : "—"]] as [string, string][])),
    ["Categoría", cat ? `${cat.name} › ${sub?.name ?? "—"}` : "Traspaso entre cuentas"],
    ...(tx.tags?.length ? ([["Etiquetas", tx.tags.map((t) => `#${t}`).join(" ")]] as [string, string][]) : []),
    ...(tx.note ? ([["Nota", tx.note]] as [string, string][]) : []),
  ];
  return (
    <Modal
      title="Detalle del movimiento"
      onClose={onClose}
      width={480}
      footer={
        confirm ? (
          <>
            <Btn variant="ghost" onClick={() => setConfirm(false)}>No, conservar</Btn>
            <Btn variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { deleteTransaction(tx.id); onClose(); }}>Sí, eliminar</Btn>
          </>
        ) : (
          <>
            <Btn variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirm(true)}>Eliminar</Btn>
            <Btn variant="ghost" onClick={() => openModal({ kind: "editTx", txId: tx.id })}>Editar</Btn>
            {cat && <Btn variant="ghost" onClick={() => { onClose(); openModal({ kind: "categoryTx", categoryId: cat.id }); }}>Ver categoría</Btn>}
            {acc && <Btn variant="ghost" onClick={() => openAccount(acc.id)}>Ver cuenta</Btn>}
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <p className="pv-muted text-[11px] font-semibold uppercase tracking-[0.14em]">{tx.concept}</p>
          <p className="pv-num pv-display mt-1 text-[36px] font-bold" style={{ color: tx.amount >= 0 ? "var(--pos)" : "var(--text)" }}>{formatSigned(tx.amount)}</p>
        </div>
        <dl className="flex flex-col gap-2 text-[12.5px]">
          {rowsInfo.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <dt className="pv-muted">{k}</dt>
              <dd className="text-right font-semibold" style={{ color: "var(--text)" }}>{v}</dd>
            </div>
          ))}
        </dl>
        {confirm && <p className="flex items-center gap-2 text-[12px]" style={{ color: "var(--neg)" }}><TriangleAlert className="h-4 w-4" /> Se revertirá el importe en el saldo de la cuenta.</p>}
      </div>
    </Modal>
  );
}

/* ------------------------------ Editar movimiento ------------------------------ */

/** Concepto base de un traspaso, sin la flecha de origen → destino. */
function baseConcept(concept: string): string {
  return concept.split(" → ")[0].split(" ← ")[0];
}

/* ------------------------------ Buscar ------------------------------ */

function SearchRow({ icon, title, sub, onPick }: { icon: React.ReactNode; title: string; sub?: string; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="pv-hit flex w-full items-center gap-3 px-2 py-2 text-left" style={{ borderRadius: "var(--radius-sm)" }}>
      {icon}
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text)" }}>{title}</span>{sub && <span className="pv-faint block truncate text-[11px]">{sub}</span>}</span>
    </button>
  );
}

function SearchGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div><p className="pv-faint mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.14em]">{title}</p>{children}</div>
  );
}

function SearchModal({ onClose }: { onClose: () => void }) {
  const { accounts, holdings, categories, transactions, go, openModal } = usePreview();
  const openAccount = useOpenAccount();
  const [q, setQ] = useState("");
  const n = q.trim().toLowerCase();
  const has = (s: string) => s.toLowerCase().includes(n);
  const accs = (n ? accounts.filter((a) => has(a.name) || has(KIND_LABEL[a.kind])) : accounts).slice(0, 5);
  const prods = (n ? holdings.filter((h) => has(h.ticker) || has(h.name) || has(h.isin)) : holdings).slice(0, 5);
  const cats = (n ? categories.filter((c) => has(c.name) || c.subcategories.some((s) => has(s.name))) : categories).slice(0, 5);
  const txs = (n ? transactions.filter((t) => has(t.concept)) : transactions).slice(0, 6);
  const empty = !accs.length && !prods.length && !cats.length && !txs.length;

  return (
    <Modal title="Buscar" sub="Cuentas, productos, categorías y movimientos" onClose={onClose} width={560}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <Search className="h-4 w-4" style={{ color: "var(--faint)" }} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mercadona, VWCE, Ocio, Nómina…" className="w-full bg-transparent text-[13px] outline-none" style={{ color: "var(--text)" }} />
        </div>
        {empty && <p className="pv-faint py-6 text-center text-[12px]">Sin resultados para «{q}»</p>}
        {accs.length > 0 && <SearchGroup title="Cuentas">{accs.map((a) => <SearchRow key={a.id} icon={<IconBadge icon={accIcon(a)} colorIdx={a.colorIdx} size={30} />} title={a.name} sub={`${KIND_LABEL[a.kind]} · ${formatEUR(a.balance)}`} onPick={() => openAccount(a.id)} />)}</SearchGroup>}
        {prods.length > 0 && <SearchGroup title="Productos">{prods.map((h) => <SearchRow key={h.id} icon={<IconBadge icon={<span className="pv-num text-[9px] font-bold">{h.ticker.slice(0, 3)}</span>} colorIdx={h.colorIdx} size={30} />} title={`${h.ticker} · ${h.name}`} sub={h.type} onPick={() => go({ page: "inversiones", productId: h.id })} />)}</SearchGroup>}
        {cats.length > 0 && <SearchGroup title="Categorías">{cats.map((c) => <SearchRow key={c.id} icon={<IconBadge icon={catIcon(c)} colorIdx={c.colorIdx} size={30} />} title={c.name} sub={c.subcategories.map((s) => s.name).join(", ")} onPick={() => { onClose(); openModal({ kind: "categoryTx", categoryId: c.id }); }} />)}</SearchGroup>}
        {txs.length > 0 && <SearchGroup title="Movimientos">{txs.map((t) => <SearchRow key={t.id} icon={<IconBadge icon={catIcon(categories.find((c) => c.id === t.categoryId))} colorIdx={categories.find((c) => c.id === t.categoryId)?.colorIdx ?? 0} size={30} />} title={t.concept} sub={`${formatFullDate(t.date)} · ${formatSigned(t.amount)}`} onPick={() => openModal({ kind: "txDetail", txId: t.id })} />)}</SearchGroup>}
      </div>
    </Modal>
  );
}

/* ------------------------------ Avisos ------------------------------ */

function NotificationsModal({ onClose }: { onClose: () => void }) {
  const { byCat } = useSpending();
  const { accounts, openModal } = usePreview();
  const openAccount = useOpenAccount();
  const top = [...byCat].sort((a, b) => b.spent - a.spent)[0];
  const low = accounts.filter((a) => a.kind === "corriente" && a.balance < 300);
  const items: { key: string; tone: "neg" | "warn" | "info"; title: string; sub: string; onPick?: () => void }[] = [
    ...(top ? [{ key: `t${top.id}`, tone: "info" as const, title: `Mayor gasto: ${top.name}`, sub: `${formatEUR0(top.spent)} en el periodo`, onPick: () => openModal({ kind: "categoryTx", categoryId: top.id }) }] : []),
    ...low.map((a) => ({ key: `l${a.id}`, tone: "warn" as const, title: `Saldo bajo en ${a.name}`, sub: formatEUR(a.balance), onPick: () => openAccount(a.id) })),
    { key: "p", tone: "info", title: "Precios actualizados", sub: "Última sincronización hace 4 minutos" },
  ];
  const color = { neg: "var(--neg)", warn: "var(--chart-5)", info: "var(--accent)" };
  return (
    <Modal title="Avisos" sub={`${items.length} notificaciones`} onClose={onClose} width={520}>
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <button key={it.key} type="button" disabled={!it.onPick} onClick={it.onPick} className="pv-hit flex items-start gap-3 px-3 py-2.5 text-left" style={{ borderRadius: "var(--radius)", border: "1px solid var(--border)", cursor: it.onPick ? "pointer" : "default" }}>
            <span className="mt-0.5" style={{ color: color[it.tone] }}><Bell className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold" style={{ color: "var(--text)" }}>{it.title}</span><span className="pv-faint block text-[11.5px]">{it.sub}</span></span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ------------------------------ Confirmar borrado ------------------------------ */


/* ------------------------------ Organizar categorías ------------------------------ */

function OrganizeCategoriesModal({ categoryId, onClose }: { categoryId?: number; onClose: () => void }) {
  const {
    categories,
    transactions,
    reorderCategory,
    reorderSubcategory,
    promoteSubcategory,
    demoteCategory,
    moveSubcategory,
  } = usePreview();
  const [expanded, setExpanded] = useState<number[]>(categoryId ? [categoryId] : []);

  const toggle = (id: number) => setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const countFor = (catId: number, subId?: number) =>
    transactions.filter((t) => t.categoryId === catId && (subId === undefined || t.subcategoryId === subId)).length;

  const arrow = (disabled: boolean, label: string, icon: ReactNode, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 shrink-0 place-items-center disabled:opacity-30"
      style={{ color: "var(--muted)", border: `1px solid ${disabled ? "var(--border)" : "var(--border-strong)"}`, borderRadius: "var(--radius-sm)" }}
    >
      {icon}
    </button>
  );

  return (
    <Modal
      title="Organizar categorías"
      sub="Cambia el orden o convierte categorías en subcategorías y al revés"
      onClose={onClose}
      width={660}
      footer={<Btn onClick={onClose}>Hecho</Btn>}
    >
      <p className="pv-faint mb-3 text-[11px] leading-snug">
        Al convertir, los movimientos se mueven con la categoría: no se pierde ningún registro.
      </p>

      <div className="flex flex-col gap-2">
        {categories.map((c, index) => {
          const open = expanded.includes(c.id);
          const others = categories.filter((x) => x.id !== c.id);
          return (
            <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface-2)" }}>
              <div className="flex items-center gap-2 p-2">
                {arrow(index === 0, "Subir categoría", <ArrowUp className="h-3.5 w-3.5" />, () => reorderCategory(c.id, -1))}
                {arrow(index === categories.length - 1, "Bajar categoría", <ArrowDown className="h-3.5 w-3.5" />, () => reorderCategory(c.id, 1))}
                <button type="button" onClick={() => toggle(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform" style={{ color: "var(--faint)", transform: open ? "rotate(90deg)" : undefined }} />
                  <span className="shrink-0" style={{ color: chartColor(c.colorIdx) }}>{iconNode(c.icon)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>{c.name}</span>
                    <span className="pv-faint block text-[10.5px]">{c.subcategories.length} subcategorías · {countFor(c.id)} movimientos</span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Select
                    aria-label={`Convertir ${c.name} en subcategoría de otra categoría`}
                    value=""
                    onChange={(e) => { if (e.target.value) demoteCategory(c.id, Number(e.target.value)); }}
                    style={{ width: 168, fontSize: 11 }}
                  >
                    <option value="">Convertir en subcategoría de…</option>
                    {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                </div>
              </div>

              {open && (
                <div className="flex flex-col gap-1.5 px-2 pb-2 pl-6">
                  {c.subcategories.length === 0 && <p className="pv-faint text-[11px]">Sin subcategorías.</p>}
                  {c.subcategories.map((sub, i) => (
                    <div key={sub.id} className="flex items-center gap-2" style={{ padding: "5px 8px", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
                      {arrow(i === 0, "Subir subcategoría", <ArrowUp className="h-3 w-3" />, () => reorderSubcategory(c.id, sub.id, -1))}
                      {arrow(i === c.subcategories.length - 1, "Bajar subcategoría", <ArrowDown className="h-3 w-3" />, () => reorderSubcategory(c.id, sub.id, 1))}
                      <span className="shrink-0" style={{ color: chartColor(subColor(c, sub)) }}>{iconNode(sub.icon)}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--text)" }}>{sub.name}</span>
                      <span className="pv-faint pv-num shrink-0 text-[10.5px]">{countFor(c.id, sub.id)} mov.</span>
                      <Btn variant="ghost" size="sm" aria={`Convertir ${sub.name} en categoría propia`} onClick={() => promoteSubcategory(c.id, sub.id)}>
                        <ArrowUpRight className="mr-1 inline h-3 w-3" /> A categoría
                      </Btn>
                      <Select
                        aria-label={`Mover ${sub.name} a otra categoría`}
                        value=""
                        onChange={(e) => { if (e.target.value) moveSubcategory(c.id, sub.id, Number(e.target.value)); }}
                        style={{ width: 132, fontSize: 11 }}
                      >
                        <option value="">Mover a…</option>
                        {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function ConfirmClearModal({ onClose }: { onClose: () => void }) {
  const { transactions, clearTransactions } = usePreview();
  return (
    <Modal title="Borrar todos los movimientos" onClose={onClose} width={460} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { clearTransactions(); onClose(); }}>Borrar {transactions.length} movimientos</Btn></>}>
      <div className="flex items-start gap-3">
        <IconBadge icon={<TriangleAlert className="h-4 w-4" />} colorIdx={10} size={36} />
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--text)" }}>
          Se eliminarán los <b>{transactions.length}</b> movimientos de la demo. Las cuentas, productos y categorías se conservan. Puedes volver al estado inicial desde <i>Ajustes › Restablecer datos de ejemplo</i>.
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------ Edición ------------------------------ */


function AccountKindPicker({ value, onChange }: { value: AccountKind; onChange: (k: AccountKind) => void }) {
  const options: { id: AccountKind; title: string; desc: string; icon: React.ReactNode }[] = [
    { id: "corriente", title: "Cuenta corriente", desc: "Recibe ingresos, paga gastos y hace traspasos.", icon: <Landmark className="h-4 w-4" /> },
    { id: "inversion", title: "Cuenta de inversión", desc: "Recibe traspasos y compra productos de inversión.", icon: <Briefcase className="h-4 w-4" /> },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className="flex items-start gap-3 text-left transition-colors"
            style={{ padding: 12, borderRadius: "var(--radius)", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-soft)" : "var(--surface-2)" }}
          >
            <span className="mt-0.5" style={{ color: active ? "var(--accent)" : "var(--muted)" }}>{o.icon}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                {o.title}
                {active && <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: "var(--accent)" }} />}
              </span>
              <span className="pv-faint mt-0.5 block text-[11.5px] leading-snug">{o.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EditAccountModal({ accountId, onClose }: { accountId: number; onClose: () => void }) {
  const { accounts, holdings, transactions, updateAccount, setAccountArchived, deleteAccount } = usePreview();
  const acc = accounts.find((a) => a.id === accountId);
  const [name, setName] = useState(acc?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(acc?.kind ?? "corriente");
  const [color, setColor] = useState<ColorRef>(acc?.colorIdx ?? 0);
  const [archived, setArchived] = useState(Boolean(acc?.archived));
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!acc) return null;

  const prods = holdings.filter((h) => h.accountId === acc.id);
  const txCount = transactions.filter((t) => t.accountId === acc.id).length;
  const blocked = kind === "corriente" && prods.length > 0;
  const changed = kind !== acc.kind;

  const save = () => {
    updateAccount(acc.id, { name: name.trim(), kind, colorIdx: color });
    if (archived !== Boolean(acc.archived)) setAccountArchived(acc.id, archived);
    onClose();
  };

  return (
    <Modal
      title="Editar cuenta"
      sub={`Ahora es una ${KIND_LABEL[acc.kind].toLowerCase()}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn disabled={!name.trim() || blocked} onClick={save}>{changed ? "Guardar y cambiar de tipo" : "Guardar cambios"}</Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Tipo de cuenta"><AccountKindPicker value={kind} onChange={setKind} /></Field>
        {blocked && (
          <p className="flex items-start gap-2 text-[12px] leading-snug" style={{ color: "var(--neg)" }}>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Esta cuenta tiene {prods.length} {prods.length === 1 ? "producto" : "productos"} ({prods.map((h) => h.ticker).join(", ")}). Para convertirla en cuenta corriente, mueve antes cada producto a otra cuenta de inversión desde «Editar producto».</span>
          </p>
        )}
        {changed && !blocked && (
          <p className="pv-muted text-[12px] leading-snug">
            {kind === "inversion" ? "Pasará a la sección «Cuentas de inversión»: sus movimientos y su saldo se conservan, y podrás añadirle productos." : "Pasará a la sección «Cuentas corrientes»: sus movimientos y su saldo se conservan."}
          </p>
        )}
        <Field label="Color de la cuenta"><ColorPicker value={color} onChange={setColor} /></Field>

        <div className="pv-divider" />

        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>Archivar cuenta</p>
            <p className="pv-faint text-[11px] leading-snug">
              Deja de aparecer en las listas y al registrar movimientos, pero conserva su saldo, sus {txCount} movimientos
              y sigue contando en las estadísticas. Puedes recuperarla cuando quieras.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={archived}
            aria-label="Archivar cuenta"
            onClick={() => setArchived((v) => !v)}
            className="mt-1 shrink-0 px-3 py-1.5 text-[11.5px] font-semibold"
            style={{
              borderRadius: 999,
              border: `1px solid ${archived ? "var(--accent)" : "var(--border-strong)"}`,
              background: archived ? "var(--accent-soft)" : "var(--surface-2)",
              color: archived ? "var(--accent)" : "var(--muted)",
            }}
          >
            {archived ? "Archivada" : "Activa"}
          </button>
        </div>

        <div className="pv-divider" />

        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>Eliminar cuenta</p>
            <p className="pv-faint text-[11px] leading-snug">
              {prods.length
                ? `Tiene ${prods.length} ${prods.length === 1 ? "producto" : "productos"}: muévelos a otra cuenta antes de eliminarla.`
                : `Se borrarán también sus ${txCount} movimientos. Si solo quieres dejar de verla, archívala.`}
            </p>
          </div>
          {confirmDelete ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <Btn variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>No</Btn>
              <Btn
                variant="danger"
                size="sm"
                disabled={prods.length > 0}
                onClick={() => { if (deleteAccount(acc.id)) onClose(); }}
              >
                Sí, eliminar
              </Btn>
            </div>
          ) : (
            <Btn variant="danger" size="sm" icon={<Trash2 className="h-3 w-3" />} disabled={prods.length > 0} onClick={() => setConfirmDelete(true)}>
              Eliminar
            </Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}

function AccountDetailModal({ accountId, onClose }: { accountId: number; onClose: () => void }) {
  const { accounts } = usePreview();
  const acc = accounts.find((a) => a.id === accountId);
  if (!acc) return null;
  return (
    <Modal title={acc.name} sub={`${KIND_LABEL[acc.kind]} · ficha completa`} onClose={onClose} width={1040}>
      <AccountDetailEmbedded id={acc.id} />
    </Modal>
  );
}

function EditCategoryModal({ categoryId, onClose }: { categoryId: number; onClose: () => void }) {
  const { categories, updateCategory } = usePreview();
  const c = categories.find((x) => x.id === categoryId);
  const [name, setName] = useState(c?.name ?? "");
  const [icon, setIcon] = useState(c?.icon ?? "bag");
  const [color, setColor] = useState<ColorRef>(c?.colorIdx ?? 0);
  if (!c) return null;
  return (
    <Modal title="Editar categoría" sub={`${c.subcategories.length} subcategorías`} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn disabled={!name.trim()} onClick={() => { updateCategory(c.id, { name: name.trim(), icon, colorIdx: color }); onClose(); }}>Guardar cambios</Btn></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Icono"><IconPicker value={icon} onChange={setIcon} /></Field>
        <Field label="Color de la categoría"><ColorPicker value={color} onChange={setColor} /></Field>
      </div>
    </Modal>
  );
}

function SubColorField({ parentColor, inherit, setInherit, color, setColor }: { parentColor: ColorRef; inherit: boolean; setInherit: (v: boolean) => void; color: ColorRef; setColor: (c: ColorRef) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px]" style={{ color: "var(--text)" }}>
        <input type="checkbox" checked={inherit} onChange={(e) => setInherit(e.target.checked)} className="h-4 w-4" style={{ accentColor: "var(--accent)" }} />
        <span className="h-4 w-4 shrink-0" style={{ background: chartColor(parentColor), borderRadius: 4 }} />
        Usar el color de la categoría
      </label>
      {!inherit && <ColorPicker value={color} onChange={setColor} />}
    </div>
  );
}

function EditSubcategoryModal({ categoryId, subcategoryId, onClose }: { categoryId: number; subcategoryId: number; onClose: () => void }) {
  const { categories, updateSubcategory } = usePreview();
  const cat = categories.find((c) => c.id === categoryId);
  const sub = cat?.subcategories.find((s) => s.id === subcategoryId);
  const [name, setName] = useState(sub?.name ?? "");
  const [icon, setIcon] = useState(sub?.icon ?? "tag");
  const [inherit, setInherit] = useState(sub?.colorIdx === undefined);
  const [color, setColor] = useState<ColorRef>(sub?.colorIdx ?? cat?.colorIdx ?? 0);
  if (!cat || !sub) return null;
  const shown: ColorRef = inherit ? cat.colorIdx : color;
  return (
    <Modal
      title="Editar subcategoría"
      sub={`Dentro de «${cat.name}»`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn disabled={!name.trim()} onClick={() => { updateSubcategory(cat.id, sub.id, { name: name.trim(), icon, colorIdx: inherit ? undefined : color }); onClose(); }}>Guardar cambios</Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3" style={{ padding: 12, borderRadius: "var(--radius)", background: `color-mix(in srgb, ${chartColor(shown)} 12%, var(--surface))`, border: `1px solid color-mix(in srgb, ${chartColor(shown)} 35%, transparent)` }}>
          <IconBadge icon={iconNode(icon)} colorIdx={shown} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold" style={{ color: "var(--text)" }}>{name.trim() || "Sin nombre"}</p>
            <p className="pv-faint text-[11px]">Vista previa · {cat.name}</p>
          </div>
        </div>
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Icono"><IconPicker value={icon} onChange={setIcon} /></Field>
        <Field label="Color de la subcategoría"><SubColorField parentColor={cat.colorIdx} inherit={inherit} setInherit={setInherit} color={color} setColor={setColor} /></Field>
      </div>
    </Modal>
  );
}

function NewSubcategoryModal({ parent, onClose }: { parent: Category; onClose: () => void }) {
  const { addSubcategory } = usePreview();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("tag");
  const [inherit, setInherit] = useState(true);
  const [color, setColor] = useState<ColorRef>(parent.colorIdx);
  const shown: ColorRef = inherit ? parent.colorIdx : color;
  return (
    <Modal title={`Nueva subcategoría en «${parent.name}»`} sub={`Ya tiene ${parent.subcategories.length}: ${parent.subcategories.map((s) => s.name).join(", ")}`} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn disabled={!name.trim()} icon={<Tag className="h-3.5 w-3.5" />} onClick={() => { addSubcategory(parent.id, name.trim(), { icon, colorIdx: inherit ? undefined : color }); onClose(); }}>Añadir</Btn></>}>
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3" style={{ padding: 12, borderRadius: "var(--radius)", background: `color-mix(in srgb, ${chartColor(shown)} 12%, var(--surface))`, border: `1px solid color-mix(in srgb, ${chartColor(shown)} 35%, transparent)` }}>
          <IconBadge icon={iconNode(icon)} colorIdx={shown} size={40} />
          <p className="truncate text-[14px] font-semibold" style={{ color: "var(--text)" }}>{name.trim() || "Nueva subcategoría"}</p>
        </div>
        <Field label="Nombre"><Input placeholder="Ej. Mascotas" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Icono de la subcategoría"><IconPicker value={icon} onChange={setIcon} /></Field>
        <Field label="Color de la subcategoría"><SubColorField parentColor={parent.colorIdx} inherit={inherit} setInherit={setInherit} color={color} setColor={setColor} /></Field>
      </div>
    </Modal>
  );
}

function BreakdownEditor({
  label,
  hint,
  rows,
  onChange,
  placeholder,
  max,
}: {
  label: string;
  hint: string;
  rows: [string, number][];
  onChange: (rows: [string, number][]) => void;
  placeholder: string;
  max?: number;
}) {
  const total = breakdownTotal(rows);
  const update = (index: number, patch: Partial<{ name: string; pct: number }>) =>
    onChange(rows.map((row, i) => (i === index ? [patch.name ?? row[0], patch.pct ?? row[1]] : row)) as [string, number][]);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{label}</span>
        <span className="pv-num text-[11px] font-semibold" style={{ color: total > 100.5 ? "var(--neg)" : "var(--muted)" }}>{total.toFixed(1)} %</span>
      </div>
      <p className="pv-faint mb-2 text-[10.5px] leading-snug">{hint}</p>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={`${label}-${i}`} className="flex items-center gap-1.5">
            <Input value={row[0]} placeholder={placeholder} onChange={(e) => update(i, { name: e.target.value })} />
            <div className="w-[86px] shrink-0">
              <Input
                inputMode="decimal"
                value={String(row[1]).replace(".", ",")}
                onChange={(e) => update(i, { pct: Number(e.target.value.replace(",", ".")) || 0 })}
                aria-label={`Porcentaje de ${row[0] || label}`}
              />
            </div>
            <button
              type="button"
              aria-label="Quitar fila"
              onClick={() => onChange(rows.filter((_, index) => index !== i) as [string, number][])}
              className="grid h-8 w-8 shrink-0 place-items-center"
              style={{ color: "var(--faint)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="ghost" size="sm" icon={<Plus className="h-3 w-3" />} onClick={() => onChange([...rows, ["", 0]] as [string, number][])} disabled={max ? rows.length >= max : false}>
            Añadir
          </Btn>
          {rows.length > 0 && total !== 100 && (
            <Btn variant="ghost" size="sm" onClick={() => onChange(normalizeBreakdown(rows))}>Ajustar a 100 %</Btn>
          )}
          {rows.length > 0 && (
            <span className="ml-auto"><Btn variant="ghost" size="sm" onClick={() => onChange([])}>Vaciar</Btn></span>
          )}
        </div>
      </div>
    </div>
  );
}

function EditProductModal({ productId, onClose }: { productId: number; onClose: () => void }) {
  const { holdings, accounts, updateHolding } = usePreview();
  const h = holdings.find((x) => x.id === productId);
  const [accountId, setAccountId] = useState(h?.accountId ?? 0);
  const [name, setName] = useState(h?.name ?? "");
  const [nickname, setNickname] = useState(h?.nickname ?? "");
  const [ticker, setTicker] = useState(h?.ticker ?? "");
  const [category, setCategory] = useState<HoldingCategory>(h?.category ?? "Fondo indexado");
  const [source, setSource] = useState(h?.source ?? "Manual");
  const [color, setColor] = useState<ColorRef>(h?.colorIdx ?? 0);
  const [sectors, setSectors] = useState<[string, number][]>(h?.sectors ?? []);
  const [top, setTop] = useState<[string, number][]>(h?.top ?? []);
  const [countries, setCountries] = useState<[string, number][]>(h?.countries ?? []);
  const [feed, setFeed] = useState<{ status: "idle" | "loading" | "done" | "error"; message?: string }>({ status: "idle" });
  const autoTried = useRef(false);
  const holding = h;

  const fetchProfile = async () => {
    if (!holding) return;
    setFeed({ status: "loading" });
    try {
      const response = await fetch("/api/market-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id: holding.id, ticker: ticker.trim(), isin: holding.isin, name }] }),
        signal: AbortSignal.timeout(15000),
      });
      const payload = (await response.json()) as {
        profiles?: Record<string, { sectors: [string, number][]; top: [string, number][]; countries: [string, number][]; source: string } | null>;
        message?: string;
      };
      const profile = payload.profiles?.[String(holding.id)];
      if (!profile) {
        setFeed({ status: "error", message: payload.message ?? "La fuente no tiene desglose de este producto. Puedes escribirlo a mano." });
        return;
      }
      if (profile.sectors.length) setSectors(profile.sectors);
      if (profile.top.length) setTop(profile.top);
      if (profile.countries.length) setCountries(profile.countries);
      setFeed({ status: "done", message: `Datos de ${profile.source}. Revísalos antes de guardar.` });
    } catch {
      setFeed({ status: "error", message: "No se pudo conectar con la fuente de datos. Introduce los valores a mano." });
    }
  };

  /* Si el producto no tiene desglose (típico tras importar MoneyMatter), se
     intenta traer de la fuente automáticamente al abrir la ficha. */
  useEffect(() => {
    if (!holding || autoTried.current) return;
    autoTried.current = true;
    if (!isPlaceholderBreakdown(holding.sectors) && !isPlaceholderBreakdown(holding.top)) return;
    /* En un temporizador para no encadenar estado dentro del efecto. */
    const timer = setTimeout(() => { void fetchProfile(); }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!h) return null;

  return (
    <Modal
      title="Editar producto"
      sub={h.isin || h.ticker}
      onClose={onClose}
      width={620}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn
            disabled={!name.trim() || !ticker.trim()}
            onClick={() => {
              updateHolding(h.id, {
                name: name.trim(),
                ticker: ticker.trim().toUpperCase(),
                nickname: nickname.trim() || ticker.trim().toUpperCase(),
                category,
                source,
                colorIdx: color,
                accountId,
                sectors: normalizeBreakdown(sectors).length ? normalizeBreakdown(sectors) : [["Sin clasificar", 100]],
                top: normalizeBreakdown(top).length ? normalizeBreakdown(top) : [["Sin desglose", 100]],
                countries: normalizeBreakdown(countries).length ? normalizeBreakdown(countries) : [["Sin clasificar", 100]],
              });
            onClose();
          }}
          >
            Guardar cambios
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="Ticker"><Input value={ticker} onChange={(e) => setTicker(e.target.value)} autoFocus /></Field>
          <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apodo" hint="Nombre corto para tablas y gráficos"><Input value={nickname} maxLength={22} onChange={(e) => setNickname(e.target.value)} /></Field>
          <Field label="Categoría"><Select value={category} onChange={(e) => setCategory(e.target.value as HoldingCategory)}>{HOLDING_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        <Field label="Cuenta de inversión" hint="Mueve el producto a otra cuenta de inversión"><Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>{accounts.filter((a) => a.kind === "inversion" && !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Fuente de precios"><Select value={source} onChange={(e) => setSource(e.target.value)}>{["Yahoo", "Morningstar", "CoinGecko", "Stooq", "Twelve Data", "Alpha Vantage", "Manual"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Color del producto"><ColorPicker value={color} onChange={setColor} /></Field>

        <div className="pv-divider" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>Composición del producto</p>
            <p className="pv-faint text-[11px] leading-snug">Se usa en las vistas de sectores, países y top de empresas.</p>
          </div>
          <Btn
            variant="ghost"
            size="sm"
            icon={feed.status === "loading" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            onClick={fetchProfile}
            disabled={feed.status === "loading"}
          >
            {feed.status === "loading" ? "Buscando…" : "Buscar datos"}
          </Btn>
        </div>
        {feed.message && (
          <p className="text-[11px] leading-snug" style={{ color: feed.status === "error" ? "var(--neg)" : "var(--pos)" }}>{feed.message}</p>
        )}

        <BreakdownEditor
          label="Sectores"
          hint="Porcentaje de cada sector económico. Debe sumar 100 %."
          rows={sectors}
          onChange={setSectors}
          placeholder="Tecnología"
        />
        <BreakdownEditor
          label="Top 10 empresas"
          hint="Mayores posiciones del producto y su peso."
          rows={top}
          onChange={setTop}
          placeholder="Apple Inc."
          max={10}
        />
        <BreakdownEditor
          label="Países y regiones"
          hint="Exposición geográfica del producto."
          rows={countries}
          onChange={setCountries}
          placeholder="Estados Unidos"
        />
      </div>
    </Modal>
  );
}

/* ------------------------------ Altas ------------------------------ */

function AccountForm({ onClose }: { onClose: () => void }) {
  const { addAccount, accounts } = usePreview();
  const [kind, setKind] = useState<AccountKind>("corriente");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [color, setColor] = useState<ColorRef>(accounts.length % 12);
  const valid = name.trim();
  return (
    <Modal title="Nueva cuenta" sub="Solo hay dos clases: cuenta corriente o cuenta de inversión" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn disabled={!valid} onClick={() => { addAccount({ name: name.trim(), kind, balance: Number(balance) || 0, colorIdx: color }); onClose(); }}>Crear cuenta</Btn></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Tipo de cuenta"><AccountKindPicker value={kind} onChange={setKind} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre"><Input placeholder={kind === "corriente" ? "Cuenta Nómina" : "Bróker"} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Saldo inicial (€)"><Input inputMode="decimal" placeholder="0,00" value={balance} onChange={(e) => setBalance(e.target.value.replace(",", "."))} /></Field>
        </div>
        <Field label="Color de la cuenta"><ColorPicker value={color} onChange={setColor} /></Field>
      </div>
    </Modal>
  );
}

function ProductForm({ accountId, onClose }: { accountId?: number; onClose: () => void }) {
  const { accounts, addHolding, holdings } = usePreview();
  const inv = accounts.filter((a) => a.kind === "inversion" && !a.archived);
  const [acc, setAcc] = useState(String(accountId ?? inv[0]?.id ?? 7));
  const [ticker, setTicker] = useState("");
  const [nickname, setNickname] = useState("");
  const [name, setName] = useState("");
  const [isin, setIsin] = useState("");
  const [type, setType] = useState<Holding["type"]>("ETF");
  const [category, setCategory] = useState<HoldingCategory>("Fondo indexado");
  const [source, setSource] = useState("Yahoo");
  const [country, setCountry] = useState("Global");
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [color, setColor] = useState<ColorRef>(holdings.length % 12);
  const valid = ticker.trim() && name.trim() && Number(units) > 0 && Number(price) > 0;
  return (
    <Modal title="Añadir producto" sub="ETF, fondo, acción, cripto o plan de pensiones" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn disabled={!valid} onClick={() => { addHolding({ accountId: Number(acc), ticker: ticker.trim().toUpperCase(), nickname: nickname.trim() || ticker.trim().toUpperCase(), category, name: name.trim(), isin: isin.trim() || "—", type, currency: "EUR", units: Number(units), price: Number(price), invested: Number(cost) || Number(units) * Number(price), colorIdx: color, source, country }); onClose(); }}>Añadir a la cartera</Btn></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Cuenta de inversión"><Select value={acc} onChange={(e) => setAcc(e.target.value)}>{inv.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="Ticker"><Input placeholder="VWCE" value={ticker} onChange={(e) => setTicker(e.target.value)} autoFocus /></Field>
          <Field label="Nombre"><Input placeholder="Vanguard FTSE All-World" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apodo" hint="Nombre corto para tablas y gráficos"><Input placeholder="All-World" value={nickname} maxLength={22} onChange={(e) => setNickname(e.target.value)} /></Field>
          <Field label="Categoría"><Select value={category} onChange={(e) => setCategory(e.target.value as HoldingCategory)}>{HOLDING_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tipo"><Select value={type} onChange={(e) => setType(e.target.value as Holding["type"])}>{["ETF", "Fondo", "Acción", "Cripto", "Pensiones"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="ISIN"><Input placeholder="IE00BK5BQT80" value={isin} onChange={(e) => setIsin(e.target.value)} /></Field>
          <Field label="Fuente"><Select value={source} onChange={(e) => setSource(e.target.value)}>{["Yahoo", "Morningstar", "CoinGecko", "Stooq", "Twelve Data", "Alpha Vantage", "Manual"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Participaciones"><Input inputMode="decimal" placeholder="10" value={units} onChange={(e) => setUnits(e.target.value.replace(",", "."))} /></Field>
          <Field label="Precio actual (€)"><Input inputMode="decimal" placeholder="100,00" value={price} onChange={(e) => setPrice(e.target.value.replace(",", "."))} /></Field>
          <Field label="Coste total (€)" hint="Vacío: part. × precio"><Input inputMode="decimal" placeholder="1.000,00" value={cost} onChange={(e) => setCost(e.target.value.replace(",", "."))} /></Field>
        </div>
        <Field label="País / región principal" hint="Se usa en el mapa de países"><Select value={country} onChange={(e) => setCountry(e.target.value)}>{["Global", "Estados Unidos", "España", "Europa (sin España)", "Mercados emergentes", "Japón", "China", "Global (cripto)", "Otros"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Color del producto"><ColorPicker value={color} onChange={setColor} /></Field>
      </div>
    </Modal>
  );
}

function OperationForm({ productId, operationId, onClose }: { productId: number; operationId?: number; onClose: () => void }) {
  const { holdings, addOperation, updateOperation, deleteOperation } = usePreview();
  const h = holdings.find((x) => x.id === productId);
  const existing = h?.operations.find((o) => o.id === operationId);
  const [type, setType] = useState<Operation["type"]>(existing?.type ?? "compra");
  const [units, setUnits] = useState(existing ? String(existing.units) : "");
  const [price, setPrice] = useState(existing ? String(existing.price) : h ? String(h.price) : "");
  const [fees, setFees] = useState(existing ? String(existing.fees) : "1");
  const [date, setDate] = useState(existing?.date ?? today);
  const [confirmDel, setConfirmDel] = useState(false);
  if (!h) return null;
  const editing = Boolean(existing);
  const isDiv = type === "dividendo";
  const valid = isDiv ? Number(price) > 0 : Number(units) > 0 && Number(price) > 0;
  const total = isDiv ? Number(price) : Number(units) * Number(price) + Number(fees || 0);
  const op = { date, type, units: isDiv ? 0 : Number(units), price: Number(price), fees: isDiv ? 0 : Number(fees || 0) };
  const save = () => {
    if (!valid) return;
    if (existing) updateOperation(h.id, existing.id, op);
    else addOperation(h.id, op);
    onClose();
  };
  const footer = confirmDel ? (
    <>
      <Btn variant="ghost" onClick={() => setConfirmDel(false)}>No, conservar</Btn>
      <Btn variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { if (existing) deleteOperation(h.id, existing.id); onClose(); }}>Sí, eliminar</Btn>
    </>
  ) : (
    <>
      {editing && <Btn variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmDel(true)}>Eliminar</Btn>}
      <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
      <Btn disabled={!valid} onClick={save}>{editing ? "Guardar cambios" : "Registrar"}</Btn>
    </>
  );
  return (
    <Modal title={editing ? `Editar operación · ${h.nickname}` : `Nueva operación · ${h.nickname}`} sub={h.name} onClose={onClose} footer={footer}>
      <div className="flex flex-col gap-3.5">
        <Segmented options={[{ id: "compra", label: "Compra" }, { id: "venta", label: "Venta" }, { id: "dividendo", label: "Dividendo" }, { id: "aportacion", label: "Aportación" }]} value={type} onChange={setType} />
        <div className="grid grid-cols-2 gap-3">
          {!isDiv && <Field label="Participaciones"><Input inputMode="decimal" placeholder="10" value={units} onChange={(e) => setUnits(e.target.value.replace(",", "."))} autoFocus /></Field>}
          <Field label={isDiv ? "Importe neto (€)" : "Precio por participación (€)"}><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(",", "."))} /></Field>
          {!isDiv && <Field label="Comisiones (€)"><Input inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value.replace(",", "."))} /></Field>}
          <Field label="Fecha"><DateField value={date} onChange={setDate} /></Field>
        </div>
        <div className="flex items-center justify-between px-3 py-2" style={{ background: "var(--surface-2)", borderRadius: "var(--radius)" }}>
          <span className="pv-muted text-[12px]">Total operación</span>
          <span className="pv-num text-[14px] font-bold" style={{ color: "var(--text)" }}>{formatEUR(total || 0)}</span>
        </div>
        {confirmDel && <p className="flex items-center gap-2 text-[12px]" style={{ color: "var(--neg)" }}><TriangleAlert className="h-4 w-4" /> Se restarán sus participaciones, coste y aportación del producto.</p>}
      </div>
    </Modal>
  );
}

function CategoryForm({ parentId, onClose }: { parentId?: number; onClose: () => void }) {
  const { categories, addCategory } = usePreview();
  const parent = categories.find((c) => c.id === parentId);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"gasto" | "ingreso">("gasto");
  const [icon, setIcon] = useState("bag");
  const [color, setColor] = useState<ColorRef>(categories.length % 12);
  const [subs, setSubs] = useState("");

  if (parent) return <NewSubcategoryModal parent={parent} onClose={onClose} />;

  return (
    <Modal title="Nueva categoría" sub="Con sus subcategorías iniciales" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn disabled={!name.trim()} onClick={() => { addCategory({ name: name.trim(), icon, colorIdx: color, kind }, subs.split(",").map((s) => s.trim())); onClose(); }}>Crear categoría</Btn></>}>
      <div className="flex flex-col gap-3.5">
        <Segmented options={[{ id: "gasto", label: "Gasto" }, { id: "ingreso", label: "Ingreso" }]} value={kind} onChange={setKind} />
        <Field label="Nombre"><Input placeholder="Mascotas" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Subcategorías" hint="Separadas por comas"><Input placeholder="Veterinario, Comida, Accesorios" value={subs} onChange={(e) => setSubs(e.target.value)} /></Field>
        <Field label="Icono"><IconPicker value={icon} onChange={setIcon} /></Field>
        <Field label="Color de la categoría"><ColorPicker value={color} onChange={setColor} /></Field>
      </div>
    </Modal>
  );
}

export { CAT_ICON };
