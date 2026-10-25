"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowLeftRight, ArrowUpRight, Bell, Briefcase, Check, Landmark, Pencil, Plus, Search, StickyNote, Tag, Trash2, TriangleAlert,
} from "lucide-react";
import type { Account, AccountKind, Category, Holding, Operation, Tx } from "@/lib/mock";
import { HOLDING_CATEGORIES, type HoldingCategory } from "@/lib/mock";
import { subColor } from "@/lib/mock";
import { chartColor, onColor, type ColorRef } from "@/lib/colors";
import { iconNode } from "@/lib/icons";
import { KIND_LABEL, PERIODS } from "@/lib/mock";
import { inPeriod, periodLabel } from "@/lib/series";
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
      return <EditTxModal key={`edit-${modal.txId}`} txId={modal.txId} onClose={closeModal} />;
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

function TransactionForm({ accountId, categoryId: presetCategory, initialType = "gasto", onClose }: { accountId?: number; categoryId?: number; initialType?: TxType; onClose: () => void }) {
  const { accounts, categories, addTransaction, addTransfer } = usePreview();
  const [type, setType] = useState<TxType>(initialType);
  const tone = TONE[type];

  const [accId, setAccId] = useState(accountId ?? accounts.find((a) => a.kind === "corriente")?.id ?? accounts[0].id);
  const [fromId, setFromId] = useState(accountId ?? accounts[0]?.id ?? 1);
  const [toId, setToId] = useState(accounts.find((a) => a.id !== (accountId ?? accounts[0]?.id))?.id ?? accounts[1]?.id ?? 2);

  const catsForType = categories.filter((c) => (type === "ingreso" ? c.kind === "ingreso" : c.kind === "gasto"));
  const initialCat = categories.find((c) => c.id === presetCategory && c.kind === "gasto") ?? catsForType[0];
  const [categoryId, setCategoryId] = useState<number | null>(initialCat?.id ?? null);
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const [subcategoryId, setSubcategoryId] = useState<number | null>(initialCat?.subcategories[0]?.id ?? null);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [concept, setConcept] = useState("");
  const [note, setNote] = useState("");

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

  const amountValid = Number(amount) > 0;
  const valid = type === "traspaso" ? amountValid && fromId !== toId : amountValid && Boolean(category) && Boolean(subcategoryId);

  const submit = () => {
    if (!valid) return;
    if (type === "traspaso") {
      addTransfer(fromId, toId, Number(amount), date, concept.trim() || "Traspaso");
    } else if (category) {
      addTransaction({
        date,
        concept: concept.trim() || (category.subcategories.find((s) => s.id === subcategoryId)?.name ?? category.name),
        categoryId: category.id,
        subcategoryId: subcategoryId ?? category.subcategories[0]?.id ?? 0,
        accountId: accId,
        amount: type === "gasto" ? -Math.abs(Number(amount)) : Math.abs(Number(amount)),
        note: note.trim() || undefined,
      });
    }
    onClose();
  };

  return (
    <Modal title="Nueva transacción" onClose={onClose} width={580} footer={
      <>
        <Btn variant="ghost" onClick={onClose} full>Cancelar</Btn>
        <Btn onClick={submit} disabled={!valid} tone={tone} full icon={<Check className="h-3.5 w-3.5" strokeWidth={3} />}>
          Guardar {TYPE_LABEL[type].toLowerCase()}
        </Btn>
      </>
    }>
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
              <div className="grid grid-cols-3 gap-2">{accounts.map((a) => <AccountCard key={a.id} a={a} selected={fromId === a.id} onPick={() => setFromId(a.id)} />)}</div>
            </div>
            <div>
              <span className="pv-muted mb-2 block text-[11px] font-bold uppercase tracking-[0.1em]">Hacia</span>
              <div className="grid grid-cols-3 gap-2">{accounts.map((a) => <AccountCard key={a.id} a={a} selected={toId === a.id} onPick={() => setToId(a.id)} />)}</div>
            </div>
            <Field label="Concepto"><Input placeholder="Aportación mensual…" value={concept} onChange={(e) => setConcept(e.target.value)} /></Field>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="pv-muted text-[11px] font-bold uppercase tracking-[0.1em]">Cuenta</span>
                <span className="pv-faint text-[11px]">{accounts.length} cuentas</span>
              </div>
              <div className="grid grid-cols-3 gap-2">{accounts.map((a) => <AccountCard key={a.id} a={a} selected={accId === a.id} onPick={() => setAccId(a.id)} />)}</div>
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
            <input value={concept && type !== "traspaso" ? concept : note} onChange={(e) => (type === "traspaso" ? setConcept(e.target.value) : setNote(e.target.value))} placeholder={type === "traspaso" ? "Concepto (opcional)" : "Nota (opcional)"} className="w-full bg-transparent text-[12.5px] outline-none" style={{ color: "var(--text)" }} />
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
  const rowsInfo: [string, string][] = [
    ["Fecha", formatFullDate(tx.date)],
    ["Cuenta", acc ? acc.name : "—"],
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

function baseConcept(concept: string): string {
  return concept.split(" → ")[0].split(" ← ")[0];
}

function EditTxModal({ txId, onClose }: { txId: number; onClose: () => void }) {
  const { transactions } = usePreview();
  const tx = transactions.find((t) => t.id === txId);
  if (!tx) return null;
  return tx.categoryId === 0 ? <EditTransferModal tx={tx} onClose={onClose} /> : <EditMovementModal tx={tx} onClose={onClose} />;
}

function EditMovementModal({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  const { accounts, categories, updateTransaction } = usePreview();
  const [type, setType] = useState<"gasto" | "ingreso">(tx.amount >= 0 ? "ingreso" : "gasto");
  const [concept, setConcept] = useState(tx.concept);
  const [amount, setAmount] = useState(String(Math.abs(tx.amount)));
  const [date, setDate] = useState(tx.date);
  const [accountId, setAccountId] = useState(tx.accountId);
  const [categoryId, setCategoryId] = useState(tx.categoryId);
  const [subcategoryId, setSubcategoryId] = useState(tx.subcategoryId);
  const [note, setNote] = useState(tx.note ?? "");

  const catsForType = categories.filter((c) => (type === "ingreso" ? c.kind === "ingreso" : c.kind === "gasto"));
  const category = categories.find((c) => c.id === categoryId) ?? null;

  const changeType = (t: "gasto" | "ingreso") => {
    setType(t);
    const list = categories.filter((c) => (t === "ingreso" ? c.kind === "ingreso" : c.kind === "gasto"));
    if (!list.some((c) => c.id === categoryId)) {
      setCategoryId(list[0]?.id ?? 0);
      setSubcategoryId(list[0]?.subcategories[0]?.id ?? 0);
    }
  };

  const valid = Number(amount) > 0 && concept.trim().length > 0 && categoryId > 0 && subcategoryId > 0;

  const submit = () => {
    if (!valid) return;
    updateTransaction(tx.id, {
      date,
      concept: concept.trim(),
      categoryId,
      subcategoryId,
      accountId,
      amount: type === "gasto" ? -Math.abs(Number(amount)) : Math.abs(Number(amount)),
      tags: tx.tags,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal title="Editar movimiento" sub="Los saldos de las cuentas se recalculan al guardar" onClose={onClose} width={520} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={submit} disabled={!valid}>Guardar cambios</Btn></>}>
      <div className="flex flex-col gap-3.5">
        <Segmented options={[{ id: "gasto", label: "Gasto" }, { id: "ingreso", label: "Ingreso" }]} value={type} onChange={changeType} />
        <Field label="Concepto"><Input value={concept} onChange={(e) => setConcept(e.target.value)} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe (€)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} /></Field>
          <Field label="Fecha"><DateField value={date} onChange={setDate} /></Field>
        </div>
        <Field label="Cuenta">
          <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
            <optgroup label="Cuentas corrientes">{accounts.filter((a) => a.kind === "corriente").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
            <optgroup label="Cuentas de inversión">{accounts.filter((a) => a.kind === "inversion").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <Select value={categoryId} onChange={(e) => { const id = Number(e.target.value); setCategoryId(id); setSubcategoryId(categories.find((c) => c.id === id)?.subcategories[0]?.id ?? 0); }}>
              {catsForType.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Subcategoría">
            <Select value={subcategoryId} onChange={(e) => setSubcategoryId(Number(e.target.value))}>
              {(category?.subcategories ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Nota"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></Field>
      </div>
    </Modal>
  );
}

function EditTransferModal({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  const { accounts, transactions, updateTransfer } = usePreview();
  const sib = transactions.find((t) => t.id !== tx.id && t.categoryId === 0 && t.accountId !== tx.accountId && t.date === tx.date && t.amount === -tx.amount);
  const fromLeg = tx.amount < 0 ? tx : sib;
  const toLeg = tx.amount < 0 ? sib : tx;
  const [fromId, setFromId] = useState(fromLeg?.accountId ?? tx.accountId);
  const [toId, setToId] = useState(toLeg?.accountId ?? accounts.find((a) => a.id !== tx.accountId)?.id ?? tx.accountId);
  const [amount, setAmount] = useState(String(Math.abs(tx.amount)));
  const [date, setDate] = useState(tx.date);
  const [concept, setConcept] = useState(baseConcept(tx.concept));
  const valid = Number(amount) > 0 && fromId !== toId;

  return (
    <Modal title="Editar traspaso" sub="Se actualizan las dos patas (salida y entrada)" onClose={onClose} width={520} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn disabled={!valid} onClick={() => { updateTransfer(tx.id, { from: fromId, to: toId, amount: Number(amount), date, concept: concept.trim() || "Traspaso" }); onClose(); }}>Guardar cambios</Btn></>}>
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde"><Select value={fromId} onChange={(e) => setFromId(Number(e.target.value))}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          <Field label="Hacia"><Select value={toId} onChange={(e) => setToId(Number(e.target.value))}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe (€)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} autoFocus /></Field>
          <Field label="Fecha"><DateField value={date} onChange={setDate} /></Field>
        </div>
        <Field label="Concepto"><Input value={concept} onChange={(e) => setConcept(e.target.value)} /></Field>
      </div>
    </Modal>
  );
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
  const { accounts, holdings, updateAccount } = usePreview();
  const acc = accounts.find((a) => a.id === accountId);
  const [name, setName] = useState(acc?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(acc?.kind ?? "corriente");
  const [color, setColor] = useState<ColorRef>(acc?.colorIdx ?? 0);
  if (!acc) return null;
  const prods = holdings.filter((h) => h.accountId === acc.id);
  const blocked = kind === "corriente" && prods.length > 0;
  const changed = kind !== acc.kind;
  return (
    <Modal
      title="Editar cuenta"
      sub={`Ahora es una ${KIND_LABEL[acc.kind].toLowerCase()}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn disabled={!name.trim() || blocked} onClick={() => { updateAccount(acc.id, { name: name.trim(), kind, colorIdx: color }); onClose(); }}>{changed ? "Guardar y cambiar de tipo" : "Guardar cambios"}</Btn>
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
  if (!h) return null;
  return (
    <Modal title="Editar producto" sub={h.isin} onClose={onClose} width={560} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn disabled={!name.trim() || !ticker.trim()} onClick={() => { updateHolding(h.id, { name: name.trim(), ticker: ticker.trim().toUpperCase(), nickname: nickname.trim() || ticker.trim().toUpperCase(), category, source, colorIdx: color, accountId }); onClose(); }}>Guardar cambios</Btn></>}>
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="Ticker"><Input value={ticker} onChange={(e) => setTicker(e.target.value)} autoFocus /></Field>
          <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apodo" hint="Nombre corto para tablas y gráficos"><Input value={nickname} maxLength={22} onChange={(e) => setNickname(e.target.value)} /></Field>
          <Field label="Categoría"><Select value={category} onChange={(e) => setCategory(e.target.value as HoldingCategory)}>{HOLDING_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        <Field label="Cuenta de inversión" hint="Mueve el producto a otra cuenta de inversión"><Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>{accounts.filter((a) => a.kind === "inversion").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Fuente de precios"><Select value={source} onChange={(e) => setSource(e.target.value)}>{["Yahoo", "Morningstar", "CoinGecko", "Stooq", "Twelve Data", "Alpha Vantage", "Manual"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Color del producto"><ColorPicker value={color} onChange={setColor} /></Field>
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
  const inv = accounts.filter((a) => a.kind === "inversion");
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
