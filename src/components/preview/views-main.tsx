"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeftRight, Briefcase, Building2, Coins, Download, Landmark, Pencil, PiggyBank,
  Plus, RefreshCw, ShoppingCart, TrendingUp, Wallet,
} from "lucide-react";
import { HOLDING_CATEGORIES, KIND_LABEL, PERIODS, SERIES, holdingValue, type Account, type Category, type Holding, type Tx } from "@/lib/mock";
import { CAT_ICON, iconNode } from "@/lib/icons";
import { countryDistribution, countryTop5, holdingPath, monthlyContributions, sectorDistribution, type ContribResult, type MapEntry } from "@/lib/investing";
import { WorldMap } from "./worldmap";
import { PeriodBar } from "./periodbar";
import type { ChartStyleKey } from "@/lib/themes";
import { chartColor, onColor, type ColorRef } from "@/lib/colors";
import { FULL_DAYS, TODAY, addDays, periodRange, bucketLabels, changePct, expandSeries, flowsFor, inPeriod, periodDays, periodLabel, periodMonths, periodShort, periodStart, sampleAtBuckets, windowSeries } from "@/lib/series";
import { formatEUR, formatEUR0, formatNum, formatPct, formatDate, formatFullDate, formatSigned } from "@/lib/format";
import { CompareBars, Donut, HBars, MultiLines, Sparkline, StackedArea, StackedBars, TrendChart, downsample } from "./charts";
import { HoverLayer, TipBody, TipRow } from "./hover";
import { BucketAxis, Btn, Chip, KpiGroup, Panel, PanelGrid, PageHeader, RowList, SectionTitle, Segmented, Select, Stack, TimeAxis } from "./primitives";
import { useArch, usePreview } from "./state";

export { CAT_ICON };

export function catIcon(c?: Category) {
  return c ? iconNode(c.icon) : <ArrowLeftRight className="h-4 w-4" />;
}

export function accountSeries(a: Account): number[] {
  return expandSeries([...a.history.slice(0, -1), a.balance], { spanDays: 335, seed: a.id });
}

/* ------------------------------ gasto del periodo ------------------------------ */

export function useSpending() {
  const { transactions, categories, period } = usePreview();
  return useMemo(() => {
    const months = periodMonths(period);
    const days = periodDays(period);
    const start = periodStart(period);
    const rows = transactions.filter((t) => t.categoryId !== 0 && inPeriod(t.date, period));
    const byCat = categories
      .filter((c) => c.kind === "gasto")
      .map((c) => ({
        ...c,
        spent: -rows.filter((t) => t.categoryId === c.id && t.amount < 0).reduce((s, t) => s + t.amount, 0),
      }));
    const totalSpent = byCat.reduce((s, c) => s + c.spent, 0);
    const income = rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const prevStart = addDays(start, -days);
    const prevSpent = -transactions.filter((t) => t.categoryId !== 0 && t.amount < 0 && t.date >= prevStart && t.date < start).reduce((s, t) => s + t.amount, 0);
    const prevPct = prevSpent > 0 ? ((totalSpent - prevSpent) / prevSpent) * 100 : null;
    const avgMonthly = totalSpent / months;
    return { rows, byCat, totalSpent, income, months, prevPct, avgMonthly };
  }, [transactions, categories, period]);
}

export function useTotals() {
  const { accounts, holdings } = usePreview();
  return useMemo(() => {
    const liquid = accounts.filter((a) => a.kind === "corriente").reduce((s, a) => s + a.balance, 0);
    const invested = holdings.reduce((s, h) => s + holdingValue(h), 0);
    const investedCost = holdings.reduce((s, h) => s + h.invested, 0);
    /** Efectivo disponible dentro de las cuentas de inversión (saldo menos el valor de sus productos) */
    const investCash = accounts
      .filter((a) => a.kind === "inversion")
      .reduce((s, a) => s + Math.max(a.balance - holdings.filter((h) => h.accountId === a.id).reduce((x, h) => x + holdingValue(h), 0), 0), 0);
    const net = liquid + invested + investCash;
    const head = SERIES.slice(0, -1);
    const ratio = invested / Math.max(invested + investCash, 1);
    return {
      liquid, invested, investCash, investedCost, net, gain: invested - investedCost,
      pat: expandSeries([...head.map((s) => s.patrimonio), net], { spanDays: 335, seed: 3 }),
      inv: expandSeries([...head.map((s) => s.inversion * ratio), invested], { spanDays: 335, seed: 5 }),
      invAll: expandSeries([...head.map((s) => s.inversion), invested + investCash], { spanDays: 335, seed: 5 }),
      liq: expandSeries([...head.map((s) => s.efectivo), liquid], { spanDays: 335, seed: 8 }),
    };
  }, [accounts, holdings]);
}

/** En «App bancaria» las cuentas se abren en una ventana; en el resto, en su propia página. */
export function useOpenAccount() {
  const { go } = usePreview();
  return (id: number) => go({ page: "cuentas", accountId: id });
}

const trend = (v: number): "up" | "down" => (v >= 0 ? "up" : "down");

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTxCsv(name: string, txs: Tx[], categories: Category[], accounts: Account[]) {
  const head = ["Fecha", "Concepto", "Cuenta", "Categoría", "Subcategoría", "Importe (EUR)"];
  const lines = txs.map((t) => {
    const cat = categories.find((c) => c.id === t.categoryId);
    return [t.date, t.concept, accounts.find((a) => a.id === t.accountId)?.name ?? "", cat?.name ?? "Traspaso", cat?.subcategories.find((s) => s.id === t.subcategoryId)?.name ?? "", t.amount.toFixed(2).replace(".", ",")];
  });
  const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  downloadFile(name, "\ufeff" + csv, "text/csv;charset=utf-8");
}

/* ==================================================================
   TRANSACCIONES (compartido)
================================================================== */

/* ==================================================================
   TRANSACCIONES (compartido, con filtros por tipo y categoría)
================================================================== */

type TxKind = "todos" | "gasto" | "ingreso" | "traspaso";
const KIND_OPTIONS: { id: TxKind; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "gasto", label: "Gastos" },
  { id: "ingreso", label: "Ingresos" },
  { id: "traspaso", label: "Traspasos" },
];
const kindOf = (t: Tx): Exclude<TxKind, "todos"> => (t.categoryId === 0 ? "traspaso" : t.amount >= 0 ? "ingreso" : "gasto");

export function TxList({
  txs,
  limit,
  showAccount = true,
  filterable = true,
  fixedCategory = false,
}: {
  txs: Tx[];
  limit?: number;
  showAccount?: boolean;
  filterable?: boolean;
  /** La lista ya pertenece a una categoría: no se muestra el filtro de categoría */
  fixedCategory?: boolean;
}) {
  const { categories, accounts, openModal } = usePreview();
  const [kind, setKind] = useState<TxKind>("todos");
  const [catId, setCatId] = useState<number | "todas">("todas");
  const presentCats = useMemo(() => categories.filter((c) => c.id !== 0 && txs.some((t) => t.categoryId === c.id)), [categories, txs]);
  const filtered = txs.filter((t) => (kind === "todos" || kindOf(t) === kind) && (catId === "todas" || t.categoryId === catId));
  const shown = limit ? filtered.slice(0, limit) : filtered;
  const rows = shown.map((tx) => {
    const cat = categories.find((c) => c.id === tx.categoryId);
    const subc = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
    const acc = accounts.find((a) => a.id === tx.accountId);
    return {
      id: tx.id,
      icon: catIcon(cat),
      colorIdx: tx.amount >= 0 ? 3 : cat?.colorIdx ?? 5,
      title: tx.concept,
      sub: `${formatDate(tx.date)} · ${cat ? `${cat.name} › ${subc?.name ?? ""}` : "Traspaso"}`,
      meta: showAccount ? acc?.name : undefined,
      value: formatSigned(tx.amount),
      valueTone: (tx.amount >= 0 ? "pos" : "text") as "pos" | "text",
      sub2: tx.tags?.[0] ? `#${tx.tags[0]}` : undefined,
      sub2Tone: "muted" as const,
      extra: (
        <button
          type="button"
          aria-label="Editar movimiento"
          title="Editar movimiento"
          onClick={(e) => {
            e.stopPropagation();
            openModal({ kind: "editTx", txId: tx.id });
          }}
          className="grid h-7 w-7 shrink-0 place-items-center transition-colors hover:!border-[var(--accent)]"
          style={{ color: "var(--faint)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ),
      onClick: () => openModal({ kind: "txDetail", txId: tx.id }),
    };
  });
  return (
    <>
      {filterable && (
        <div className="flex flex-wrap items-center gap-2" style={{ padding: "0 var(--pad) 10px" }}>
          <Segmented options={KIND_OPTIONS} value={kind} onChange={setKind} />
          {!fixedCategory && (
            <div className="w-[200px] max-w-full">
              <Select value={catId} onChange={(e) => setCatId(e.target.value === "todas" ? "todas" : Number(e.target.value))} aria-label="Filtrar por categoría">
                <option value="todas">Todas las categorías</option>
                {presentCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          )}
          <span className="pv-faint ml-auto text-[11px]">{filtered.length} de {txs.length}</span>
        </div>
      )}
      <RowList items={rows} empty={txs.length ? "Ningún movimiento coincide con los filtros" : "Sin movimientos en este periodo"} />
    </>
  );
}

/* ==================================================================
   PANEL
================================================================== */

export function PanelView() {
  const { arch, isMobile } = useArch();
  const { accounts, transactions, period, setPeriod, go, openModal } = usePreview();
  const sp = useSpending();
  const t = useTotals();
  const openAccount = useOpenAccount();
  const cs = arch.chartStyle;
  const bento = arch.kpi === "tile";
  const editorial = arch.surface === "none";

  const pat = windowSeries(t.pat, period);
  const inv = windowSeries(t.invAll, period);
  const liq = windowSeries(t.liq, period);
  const gainPct = t.investedCost > 0 ? (t.gain / t.investedCost) * 100 : 0;
  const flows = useMemo(() => flowsFor(period, transactions), [period, transactions]);
  const txInPeriod = useMemo(() => transactions.filter((x) => inPeriod(x.date, period)), [transactions, period]);
  const openCat = (id: number | string | undefined) => typeof id === "number" && openModal({ kind: "categoryTx", categoryId: id });

  const kpis = [
    { label: "Patrimonio neto", value: formatEUR(t.net), delta: formatPct(changePct(pat)), trend: trend(changePct(pat)), icon: <PiggyBank className="h-4 w-4" />, colorIdx: 0, footnote: `${formatSigned(pat[pat.length - 1] - pat[0])} · ${periodShort(period)}`, pct: 100 },
    { label: "Inversiones", value: formatEUR(t.invested + t.investCash), delta: `${formatPct(gainPct)} · ${formatSigned(t.gain)}`, trend: trend(t.gain), icon: <TrendingUp className="h-4 w-4" />, colorIdx: 1, footnote: `${formatPct(changePct(inv))} en ${periodShort(period)}`, note: `Ganancia: ${formatSigned(t.gain)} sobre ${formatEUR0(t.investedCost)} invertidos`, pct: ((t.invested + t.investCash) / t.net) * 100 },
    { label: "Liquidez", value: formatEUR(t.liquid), delta: formatPct(changePct(liq)), trend: trend(changePct(liq)), icon: <Wallet className="h-4 w-4" />, colorIdx: 4, footnote: `${formatNum(t.liquid / Math.max(sp.avgMonthly, 1))} meses de colchón`, pct: (t.liquid / t.net) * 100 },
    { label: `Gasto · ${periodShort(period)}`, value: formatEUR(sp.totalSpent), delta: sp.prevPct !== null ? formatPct(sp.prevPct) : undefined, trend: trend(-(sp.prevPct ?? 0)), icon: <ShoppingCart className="h-4 w-4" />, colorIdx: 5, note: `Media mensual: ${formatEUR0(sp.avgMonthly)}`, pct: Math.min(100, (sp.totalSpent / Math.max(sp.income, 1)) * 100) },
  ];

  const trendPanel = (
    <Panel span={bento ? "xl:col-span-2 xl:row-span-2" : "xl:col-span-2"}>
      <SectionTitle sub={`${formatPct(changePct(pat))} · ${periodLabel(period)}`} action={<Segmented options={PERIODS} value={period} onChange={setPeriod} />}>
        Evolución del patrimonio
      </SectionTitle>
      <TrendChart values={pat} style={cs} height={isMobile ? 150 : bento ? 260 : 200} />
      <TimeAxis period={period} />
    </Panel>
  );

  const catPanel = (
    <Panel>
      <SectionTitle sub={`${formatEUR(sp.totalSpent)} · ${periodLabel(period).toLowerCase()} · pulsa para ver los gastos`} action={<Btn variant="ghost" size="sm" onClick={() => go({ page: "categorias" })}>Ver todo</Btn>}>
        Gastos por categoría
      </SectionTitle>
      {editorial || cs === "step" ? (
        <HBars style={cs} items={sp.byCat.slice(0, 6).map((c) => ({ name: c.name, value: c.spent, colorIdx: c.colorIdx, onClick: () => openCat(c.id) }))} valueLabel={formatEUR0} />
      ) : (
        <div className={isMobile ? "flex flex-col items-center gap-4" : "flex items-center gap-4"}>
          <Donut slices={sp.byCat.map((c) => ({ id: c.id, name: c.name, value: Math.max(c.spent, 0.01), colorIdx: c.colorIdx }))} style={cs} size={isMobile ? 148 : 132} centerLabel="Gastado" centerValue={formatEUR0(sp.totalSpent)} onSliceClick={openCat} />
          <div className="min-w-0 flex-1">
            {sp.byCat.slice(0, 6).map((c) => (
              <button key={c.id} type="button" onClick={() => openCat(c.id)} className="pv-hit flex w-full items-center justify-between gap-3 px-1 py-1.5 text-left" style={{ borderRadius: 6 }}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0" style={{ background: chartColor(c.colorIdx), borderRadius: arch.surface === "brutal" ? 0 : 999 }} />
                  <span className="pv-muted truncate text-[12px]">{c.name}</span>
                </span>
                <span className="pv-num text-[12px] font-semibold" style={{ color: "var(--text)" }}>{formatEUR0(c.spent)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );

  const flowsPanel = (
    <Panel span={bento ? undefined : "xl:col-span-2"}>
      <SectionTitle sub={`Ingresos frente a gastos · ${isMobile ? "toca" : "pasa el ratón por"} una barra para ver el detalle`} action={<span className="pv-num text-[12px] font-bold" style={{ color: sp.income - sp.totalSpent >= 0 ? "var(--pos)" : "var(--neg)" }}>Ahorro {formatEUR0(sp.income - sp.totalSpent)}</span>}>
        Flujos
      </SectionTitle>
      <HoverLayer
        band
        count={flows.length}
        render={(i) => {
          const f = flows[i];
          const saldo = f.a - f.b;
          return (
            <TipBody head={f.label} foot={`Ahorro ${formatSigned(saldo)}`}>
              <TipRow color="var(--accent)" name="Ingresos" value={formatEUR(f.a)} />
              <TipRow color="var(--chart-6)" name="Gastos" value={formatEUR(f.b)} />
              <TipRow color={saldo >= 0 ? "var(--pos)" : "var(--neg)"} name="Tasa de ahorro" value={f.a > 0 ? `${((saldo / f.a) * 100).toFixed(0)} %` : "—"} />
            </TipBody>
          );
        }}
      >
        <CompareBars style={cs} height={isMobile ? 132 : 150} groups={flows.map((f) => ({ label: f.label, a: f.a, b: f.b }))} />
      </HoverLayer>
      <BucketAxis labels={flows.map((f) => f.label)} />
    </Panel>
  );

  const accountsPanel = (
    <Panel pad={false}>
      <div style={{ padding: "var(--pad)" }}>
        <SectionTitle sub="Saldo por cuenta" action={<Btn variant="ghost" size="sm" onClick={() => go({ page: "cuentas" })}>Todas</Btn>}>Cuentas</SectionTitle>
      </div>
      <RowList
        items={accounts.slice(0, bento ? 6 : 5).map((a) => ({
          id: a.id,
          icon: a.kind === "inversion" ? <Briefcase className="h-4 w-4" /> : <Building2 className="h-4 w-4" />,
          colorIdx: a.colorIdx,
          title: a.name,
          sub: KIND_LABEL[a.kind],
          value: formatEUR(a.balance),
          onClick: () => openAccount(a.id),
        }))}
      />
    </Panel>
  );

  const txPanel = (
    <Panel pad={false} span={bento ? "xl:col-span-2" : "xl:col-span-3"}>
      <div style={{ padding: "var(--pad)" }}>
        <SectionTitle sub={`${txInPeriod.length} movimientos · ${periodLabel(period).toLowerCase()}`} action={<Btn size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "tx" })}>Nuevo</Btn>}>
          Últimas transacciones
        </SectionTitle>
      </div>
      <TxList txs={txInPeriod} limit={isMobile ? 5 : 7} />
    </Panel>
  );

  return (
    <Stack>
      <PageHeader kicker={`Resumen · ${periodLabel(period)}`} title="Panel general" action={!bento && <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "tx" })}>Nuevo movimiento</Btn>} />
      <KpiGroup items={kpis} />
      {bento ? (
        <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
          {trendPanel}
          {catPanel}
          {flowsPanel}
          {accountsPanel}
          {txPanel}
        </PanelGrid>
      ) : (
        <>
          <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
            {trendPanel}
            {catPanel}
          </PanelGrid>
          <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
            {flowsPanel}
            {accountsPanel}
          </PanelGrid>
          <PanelGrid cols="grid-cols-1">{txPanel}</PanelGrid>
        </>
      )}
    </Stack>
  );
}

/* ==================================================================
   CUENTAS
================================================================== */

export function AccountsView() {
  const { route } = usePreview();
  return route.accountId ? <AccountDetail id={route.accountId} /> : <AccountsList />;
}

/** Fondo de la pestaña teñido con el color de la cuenta o del producto */
function Tinted({ color, children }: { color: ColorRef; children: ReactNode }) {
  const c = chartColor(color);
  /* Además del fondo, el acento de la pestaña pasa a ser el color de la cuenta o del producto:
     botones, chips, iconos y gráficos de esta vista lo heredan por variables CSS. */
  const vars = {
    "--accent": c,
    "--accent-2": `color-mix(in srgb, ${c} 55%, var(--text))`,
    "--accent-fg": onColor(c),
    "--accent-soft": `color-mix(in srgb, ${c} 16%, transparent)`,
    "--accent-glow": `0 10px 26px -10px color-mix(in srgb, ${c} 60%, transparent)`,
  } as CSSProperties;
  return (
    <div
      style={{
        ...vars,
        background: `radial-gradient(120% 55% at 50% -12%, color-mix(in srgb, ${c} 30%, transparent), transparent 72%), linear-gradient(180deg, color-mix(in srgb, ${c} 17%, var(--bg)) 0%, var(--bg) 62%)`,
        borderRadius: "var(--radius-lg)",
        padding: 2,
      }}
    >
      {children}
    </div>
  );
}

const CARD_H = 156;
const CARD_STRIP = 84;

export type CardKey = "hielo" | "cristal" | "mate" | "neon" | "aurora" | "solido";
export const CARD_STYLES: { id: CardKey; label: string; note: string }[] = [
  { id: "hielo", label: "Hielo", note: "Vidrio escarchado y muy translúcido" },
  { id: "cristal", label: "Cristal", note: "Tinte de color transparente con desenfoque" },
  { id: "mate", label: "Mate", note: "Tarjeta casi opaca con franja de color" },
  { id: "neon", label: "Neón", note: "Contorno luminoso sobre fondo oscuro" },
  { id: "aurora", label: "Aurora", note: "Luz difusa de color sobre cristal" },
  { id: "solido", label: "Sólido", note: "Degradado opaco clásico" },
];

/** Superficie de cada estilo de tarjeta (c = color de la cuenta) */
function cardSurface(v: CardKey, c: string): CSSProperties {
  switch (v) {
    case "hielo":
      return {
        background: `linear-gradient(135deg, color-mix(in srgb, ${c} 40%, rgba(255,255,255,.4)) 0%, color-mix(in srgb, ${c} 14%, rgba(255,255,255,.08)) 100%)`,
        backdropFilter: "blur(16px) saturate(150%)",
        WebkitBackdropFilter: "blur(16px) saturate(150%)",
        border: "1px solid rgba(255,255,255,.5)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.55), inset 0 -18px 30px -22px rgba(255,255,255,.35), 0 24px 40px -26px rgba(0,0,0,.55)",
      };
    case "cristal":
      return {
        background: `color-mix(in srgb, ${c} 34%, transparent)`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: `1px solid color-mix(in srgb, ${c} 75%, transparent)`,
        boxShadow: `0 20px 36px -24px ${c}`,
      };
    case "mate":
      return {
        background: `linear-gradient(160deg, color-mix(in srgb, ${c} 62%, #0b0d14) 0%, color-mix(in srgb, ${c} 26%, #0b0d14) 100%)`,
        border: "1px solid rgba(255,255,255,.08)",
        borderTop: `3px solid ${c}`,
        boxShadow: "0 22px 34px -24px rgba(0,0,0,.8)",
      };
    case "neon":
      return {
        background: `linear-gradient(160deg, color-mix(in srgb, ${c} 14%, rgba(8,10,18,.6)), rgba(8,10,18,.55))`,
        border: `1.5px solid ${c}`,
        boxShadow: `0 0 22px -6px ${c}, inset 0 0 22px -10px ${c}`,
      };
    case "aurora":
      return {
        background: `radial-gradient(90% 110% at 0% 0%, color-mix(in srgb, ${c} 88%, transparent), transparent 62%), radial-gradient(80% 90% at 100% 100%, color-mix(in srgb, ${c} 40%, #7c3aed), transparent 62%), rgba(12,14,24,.4)`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,.14)",
        boxShadow: `0 22px 40px -26px ${c}`,
      };
    default:
      return {
        background: `linear-gradient(120deg, ${c}, color-mix(in srgb, ${c} 58%, #05060b))`,
        border: "1px solid rgba(255,255,255,.22)",
        boxShadow: `0 24px 40px -22px ${c}`,
      };
  }
}

function WalletCard({ a, index, onOpen, variant }: { a: Account; index: number; onOpen: (id: number) => void; variant: CardKey }) {
  const { cfg } = useArch();
  const col = chartColor(a.colorIdx);
  /** En los estilos translúcidos el fondo real es el de la página: el texto sigue al tema */
  const sheer = variant === "hielo" || variant === "cristal" || variant === "aurora";
  const ink = sheer && cfg.mode === "light" ? "var(--text)" : "#fff";
  const soft = sheer && cfg.mode === "light" ? "color-mix(in srgb, var(--text) 12%, transparent)" : "rgba(255,255,255,.22)";
  const chipBg = sheer && cfg.mode === "light" ? "color-mix(in srgb, var(--text) 10%, transparent)" : "rgba(0,0,0,.22)";
  return (
    <button
      type="button"
      onClick={() => onOpen(a.id)}
      className="pv-wallet-card group relative overflow-hidden text-left"
      style={{
        height: CARD_H,
        marginTop: index === 0 ? 0 : -(CARD_H - CARD_STRIP),
        zIndex: index + 1,
        padding: 18,
        borderRadius: 24,
        color: ink,
        textShadow: variant === "neon" ? `0 0 10px ${col}` : sheer && cfg.mode === "light" ? "none" : "0 1px 2px rgba(0,0,0,.25)",
        ...cardSurface(variant, col),
      }}
    >
      {variant !== "neon" && (
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.9) 1px, transparent 1.2px)", backgroundSize: "12px 12px", maskImage: "linear-gradient(160deg, #000 10%, transparent 70%)" }} />
      )}
      {(variant === "hielo" || variant === "aurora") && (
        <span aria-hidden className="pointer-events-none absolute -left-10 -top-14 h-36 w-36 rounded-full" style={{ background: "rgba(255,255,255,.22)", filter: "blur(10px)" }} />
      )}
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center" style={{ borderRadius: 999, background: soft }}>
            {a.kind === "inversion" ? <TrendingUp className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
          </span>
          <p className="truncate text-[15px] font-semibold tracking-tight">{a.name}</p>
        </div>
        <p className="pv-num shrink-0 text-[19px] font-bold tracking-tight">{formatEUR(a.balance)}</p>
      </div>
      <div className="relative mt-2.5 flex items-center justify-between">
        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ background: chipBg }}>{KIND_LABEL[a.kind]}</span>
        <span className="pv-num text-[11px] font-semibold" style={{ opacity: 0.85 }}>{a.kind === "inversion" ? "Inversión" : "Disponible"}</span>
      </div>
    </button>
  );
}

/** Pila de tarjetas a la izquierda y donut con el reparto a la derecha */
function WalletLayout({ items, sum, onOpen, variant }: { items: Account[]; sum: number; onOpen: (id: number) => void; variant: CardKey }) {
  const { arch, isMobile } = useArch();
  const cs = arch.chartStyle;
  if (items.length === 0) return <p className="pv-faint px-4 pb-6 text-center text-[12px]">Sin cuentas en esta sección.</p>;
  const blobs = variant === "hielo" || variant === "cristal" || variant === "aurora";
  return (
    <div className={`grid items-center gap-8 ${isMobile ? "grid-cols-1" : "grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"}`} style={{ padding: "0 var(--pad) var(--pad)" }}>
      <div className="relative flex flex-col" style={{ padding: "8px 0" }}>
        {blobs && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: 28 }}>
            {items.slice(0, 4).map((a, i) => (
              <span key={a.id} className="absolute rounded-full" style={{ width: 200, height: 200, left: `${[4, 48, 12, 58][i]}%`, top: `${[2, 18, 52, 70][i]}%`, background: chartColor(a.colorIdx), filter: "blur(46px)", opacity: 0.6 }} />
            ))}
          </div>
        )}
        {items.map((a, i) => (
          <WalletCard key={a.id} a={a} index={i} onOpen={onOpen} variant={variant} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-4">
        <Donut slices={items.map((a) => ({ id: a.id, name: a.name, value: Math.max(a.balance, 0.01), colorIdx: a.colorIdx }))} style={cs} size={isMobile ? 150 : 176} centerLabel="Total" centerValue={formatEUR0(sum)} onSliceClick={(id) => typeof id === "number" && onOpen(id)} />
        <div className="w-full">
          {items.map((a) => (
            <button key={a.id} type="button" onClick={() => onOpen(a.id)} className="pv-hit flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left" style={{ borderRadius: 8 }}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0" style={{ background: chartColor(a.colorIdx), borderRadius: 999 }} />
                <span className="truncate text-[12px]" style={{ color: "var(--text)" }}>{a.name}</span>
              </span>
              <span className="pv-num shrink-0 text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{((a.balance / Math.max(sum, 1)) * 100).toFixed(0)} %</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Selector visual del estilo de tarjeta (muestra cada estilo sobre su color) */
function CardStylePicker({ value, onChange }: { value: CardKey; onChange: (v: CardKey) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" style={{ padding: "0 var(--pad) 6px" }}>
      <span className="pv-muted mr-1 text-[10.5px] font-bold uppercase tracking-[0.12em]">Estilo de tarjeta</span>
      {CARD_STYLES.map((s) => {
        const on = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            title={s.note}
            onClick={() => onChange(s.id)}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12px] font-semibold transition-all"
            style={{ background: on ? "var(--accent-soft)" : "var(--surface-2)", border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`, color: "var(--text)" }}
          >
            <span className="h-5 w-7 shrink-0" style={{ ...cardSurface(s.id, "#8b5cf6"), borderRadius: 7, height: 20, width: 30 }} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function AccountsList() {
  const { arch, isMobile } = useArch();
  const { accounts, openModal, period, setPeriod } = usePreview();
  const openAccount = useOpenAccount();
  const series = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, accountSeries(a)])) as Record<number, number[]>, [accounts]);
  const win = (a: Account) => windowSeries(series[a.id], period);
  const delta = (a: Account) => {
    const w = win(a);
    return w[w.length - 1] - w[0];
  };

  const current = accounts.filter((a) => a.kind === "corriente");
  const invest = accounts.filter((a) => a.kind === "inversion");
  const totalCurrent = current.reduce((s, a) => s + a.balance, 0);
  const totalInvest = invest.reduce((s, a) => s + a.balance, 0);
  const total = totalCurrent + totalInvest;
  const totalDelta = accounts.reduce((s, a) => s + delta(a), 0);
  const cs = arch.chartStyle;
  const cards = arch.list === "avatars";
  const [cardStyle, setCardStyle] = useState<CardKey>("hielo");

  const kpis = [
    { label: "Total cuentas", value: formatEUR(total), delta: formatPct((totalDelta / Math.max(total - totalDelta, 1)) * 100), trend: trend(totalDelta), icon: <Wallet className="h-4 w-4" />, colorIdx: 0, pct: 100 },
    { label: "Corrientes", value: formatEUR(totalCurrent), footnote: `${current.length} cuentas`, icon: <Building2 className="h-4 w-4" />, colorIdx: 1, pct: (totalCurrent / Math.max(total, 1)) * 100 },
    { label: "Inversión", value: formatEUR(totalInvest), footnote: `${invest.length} cuentas`, icon: <Briefcase className="h-4 w-4" />, colorIdx: 2, pct: (totalInvest / Math.max(total, 1)) * 100 },
    { label: `Variación · ${periodShort(period)}`, value: formatSigned(totalDelta), delta: formatPct((totalDelta / Math.max(total - totalDelta, 1)) * 100), trend: trend(totalDelta), icon: <TrendingUp className="h-4 w-4" />, colorIdx: 3, pct: 62 },
  ];

  const group = (title: string, items: Account[], sum: number) => (
    <Panel pad={false}>
      <div style={{ padding: "var(--pad)" }}>
        <SectionTitle sub={`${items.length} cuentas · ${formatEUR(sum)}`}>{title}</SectionTitle>
      </div>
      {cards && !isMobile ? (
        <WalletLayout items={items} sum={sum} onOpen={openAccount} variant={cardStyle} />
      ) : (
        <RowList
          items={items.map((a) => {
            const d = delta(a);
            return {
              id: a.id,
              icon: a.kind === "inversion" ? <Briefcase className="h-4 w-4" /> : a.name === "Efectivo" ? <Coins className="h-4 w-4" /> : <Landmark className="h-4 w-4" />,
              colorIdx: a.colorIdx,
              title: a.name,
              sub: KIND_LABEL[a.kind],
              value: formatEUR(a.balance),
              sub2: formatSigned(d),
              sub2Tone: (d >= 0 ? "pos" : "neg") as "pos" | "neg",
              extra: !isMobile && arch.list !== "dense" ? <Sparkline values={win(a)} positive={d >= 0} style={cs} width={70} height={24} /> : undefined,
              onClick: () => openAccount(a.id),
            };
          })}
        />
      )}
    </Panel>
  );

  return (
    <Stack>
      <PageHeader kicker={`${accounts.length} cuentas activas · variación ${periodShort(period)}`} title="Cuentas" action={
        <>
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />
          <Btn variant="ghost" icon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "transfer" })}>Traspaso</Btn>
          <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "account" })}>Añadir cuenta</Btn>
        </>
      } />
      <KpiGroup items={kpis} />
      {cards && !isMobile && <CardStylePicker value={cardStyle} onChange={setCardStyle} />}
      <PanelGrid cols={cards ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"}>
        {group("Cuentas corrientes", current, totalCurrent)}
        {group("Cuentas de inversión", invest, totalInvest)}
      </PanelGrid>
    </Stack>
  );
}

/** Ficha de cuenta sin cabecera de página, para mostrarla dentro de una ventana */
export function AccountDetailEmbedded({ id }: { id: number }) {
  const { accounts } = usePreview();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return null;
  return acc.kind === "inversion" ? <InvestmentAccountDetail acc={acc} embedded /> : <CurrentAccountDetail acc={acc} embedded />;
}

function AccountDetail({ id }: { id: number }) {
  const { accounts } = usePreview();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return null;
  return acc.kind === "inversion" ? <InvestmentAccountDetail acc={acc} /> : <CurrentAccountDetail acc={acc} />;
}

function CurrentAccountDetail({ acc, embedded = false }: { acc: Account; embedded?: boolean }) {
  const { arch, isMobile } = useArch();
  const { accounts, transactions, categories, back, openModal, period } = usePreview();
  const full = useMemo(() => accountSeries(acc), [acc]);
  const all = transactions.filter((t) => t.accountId === acc.id);
  const txs = all.filter((t) => inPeriod(t.date, period));
  const win = windowSeries(full, period);
  const realTx = txs.filter((t) => t.categoryId !== 0);
  const income = realTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = -realTx.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const cs = arch.chartStyle;
  const d = win[win.length - 1] - win[0];
  const expByCat = categories
    .filter((c) => c.kind === "gasto")
    .map((c) => ({ ...c, spent: -txs.filter((t) => t.categoryId === c.id && t.amount < 0).reduce((sum, t) => sum + t.amount, 0) }))
    .filter((c) => c.spent > 0)
    .sort((x, y) => y.spent - x.spent);
  const openCat = (id: number | string | undefined) => typeof id === "number" && openModal({ kind: "categoryTx", categoryId: id });

  const kpis = [
    { label: "Saldo actual", value: formatEUR(acc.balance), delta: formatSigned(d), trend: trend(d), icon: <Wallet className="h-4 w-4" />, colorIdx: acc.colorIdx, footnote: periodShort(period), pct: 100 },
    { label: "Ingresos", value: formatEUR(income), footnote: periodShort(period), icon: <TrendingUp className="h-4 w-4" />, colorIdx: 3, pct: 70 },
    { label: "Gastos", value: formatEUR(expense), footnote: periodShort(period), icon: <ShoppingCart className="h-4 w-4" />, colorIdx: 5, pct: 40 },
    { label: "Movimientos", value: String(txs.length), footnote: `${all.length} en total`, icon: <ArrowLeftRight className="h-4 w-4" />, colorIdx: 1, pct: 55 },
  ];

  const actions = (
    <>
      <Btn variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "editAccount", accountId: acc.id })}>Editar</Btn>
      <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "tx", accountId: acc.id })}>Nuevo movimiento</Btn>
    </>
  );

  return (
    <Tinted color={acc.colorIdx}>
    <Stack>
      {embedded ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : <PageHeader onBack={back} kicker="Cuenta corriente" title={acc.name} action={actions} />}
      <PeriodBar />
      <KpiGroup items={kpis} />
      <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
        <Panel span="xl:col-span-2">
          <SectionTitle sub={`${formatPct(changePct(win))} · ${periodLabel(period)}`}>Evolución del saldo</SectionTitle>
          <TrendChart values={win} style={cs} height={isMobile ? 140 : 190} color={chartColor(acc.colorIdx)} />
          <TimeAxis period={period} />
        </Panel>
        <Panel>
          <SectionTitle sub={periodLabel(period)}>Entradas y salidas</SectionTitle>
          <HBars style={cs} items={[{ name: "Ingresos", value: income, colorIdx: 3 }, { name: "Gastos", value: expense, colorIdx: 5 }]} valueLabel={formatEUR} />
          <div className="pv-divider my-3" />
          <div className="flex items-center justify-between">
            <span className="pv-muted text-[12px]">Resultado</span>
            <span className="pv-num text-[14px] font-bold" style={{ color: income - expense >= 0 ? "var(--pos)" : "var(--neg)" }}>{formatSigned(income - expense)}</span>
          </div>
        </Panel>
      </PanelGrid>
      <Panel>
        <SectionTitle sub={`${formatEUR(expense)} · ${periodLabel(period).toLowerCase()} · pulsa para ver los gastos`}>Gastos por categoría en esta cuenta</SectionTitle>
        {expByCat.length === 0 ? (
          <p className="pv-faint py-4 text-center text-[12px]">Sin gastos con categoría en esta cuenta durante el periodo.</p>
        ) : (
          <div className={`grid items-center gap-5 ${isMobile ? "grid-cols-1" : "grid-cols-[auto_minmax(0,1fr)]"}`}>
            <div className="flex justify-center">
              <Donut slices={expByCat.map((c) => ({ id: c.id, name: c.name, value: c.spent, colorIdx: c.colorIdx }))} style={cs} size={isMobile ? 150 : 170} centerLabel="Gastado" centerValue={formatEUR0(expense)} onSliceClick={openCat} />
            </div>
            <HBars style={cs} items={expByCat.map((c) => ({ name: c.name, value: c.spent, colorIdx: c.colorIdx, sub: `${Math.round((c.spent / Math.max(expense, 1)) * 100)} %`, onClick: () => openCat(c.id) }))} valueLabel={formatEUR} />
          </div>
        )}
      </Panel>
      <Panel pad={false}>
        <div style={{ padding: "var(--pad)" }}>
          <SectionTitle sub={`${txs.length} movimientos · ${periodLabel(period).toLowerCase()}`} action={<Btn variant="ghost" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => exportTxCsv(`movimientos-${acc.name.toLowerCase().replace(/\s+/g, "-")}.csv`, all, categories, accounts)}>Exportar CSV</Btn>}>Movimientos</SectionTitle>
        </div>
        <TxList txs={txs} limit={isMobile ? 8 : 14} showAccount={false} />
      </Panel>
    </Stack>
    </Tinted>
  );
}

function InvestmentAccountDetail({ acc, embedded = false }: { acc: Account; embedded?: boolean }) {
  const { arch, isMobile } = useArch();
  const { accounts, holdings, transactions, categories, back, openModal, go, period } = usePreview();
  const full = useMemo(() => accountSeries(acc), [acc]);
  const all = transactions.filter((t) => t.accountId === acc.id);
  const txs = all.filter((t) => inPeriod(t.date, period));
  const win = windowSeries(full, period);
  const prods = holdings.filter((h) => h.accountId === acc.id);
  const cs = arch.chartStyle;

  const productsValue = prods.reduce((s, h) => s + holdingValue(h), 0);
  const investedCost = prods.reduce((s, h) => s + h.invested, 0);
  const gain = productsValue - investedCost;
  const gainPct = investedCost > 0 ? (gain / investedCost) * 100 : 0;
  const cash = Math.max(acc.balance - productsValue, 0);
  const total = productsValue + cash;
  const investedPct = total > 0 ? (productsValue / total) * 100 : 0;
  const funding = txs.filter((t) => t.categoryId === 0);
  const fundingNet = funding.reduce((s, t) => s + t.amount, 0);

  const kpis = [
    { label: "Valor total", value: formatEUR(total), delta: formatPct(changePct(win)), trend: trend(changePct(win)), icon: <Briefcase className="h-4 w-4" />, colorIdx: acc.colorIdx, footnote: `productos + efectivo · ${periodShort(period)}`, pct: 100 },
    { label: "En productos", value: formatEUR(productsValue), footnote: `${prods.length} productos · ${investedPct.toFixed(0)} % invertido`, icon: <TrendingUp className="h-4 w-4" />, colorIdx: 1, pct: investedPct },
    { label: "Efectivo sin invertir", value: formatEUR(cash), footnote: "disponible para comprar", icon: <Wallet className="h-4 w-4" />, colorIdx: 4, pct: 100 - investedPct },
    { label: "Ganancia latente", value: formatSigned(gain), delta: formatPct(gainPct), trend: trend(gain), icon: <PiggyBank className="h-4 w-4" />, colorIdx: 3, footnote: `invertido ${formatEUR0(investedCost)}`, pct: Math.min(100, Math.abs(gainPct) * 4) },
  ];

  const steps = [
    { n: "1", t: "Traspasa desde una cuenta corriente", d: "El dinero entra como efectivo disponible en esta cuenta." },
    { n: "2", t: "Compra productos de inversión", d: "Añade ETFs, fondos, acciones o cripto con ese efectivo." },
    { n: "3", t: "Sigue la rentabilidad aquí", d: "Valor total, ganancia latente y evolución por producto." },
  ];

  const actions = (
    <>
      <Btn variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "editAccount", accountId: acc.id })}>Editar</Btn>
      <Btn variant="ghost" icon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "transfer" })}>Traspasar</Btn>
      <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "product", accountId: acc.id })}>Añadir producto</Btn>
    </>
  );

  return (
    <Tinted color={acc.colorIdx}>
    <Stack>
      {embedded ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : <PageHeader onBack={back} kicker={`Cuenta de inversión · ${prods.length} productos`} title={acc.name} action={actions} />}
      <PeriodBar />
      <KpiGroup items={kpis} />
      <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
        <Panel span="xl:col-span-2">
          <SectionTitle sub={`${formatPct(changePct(win))} · ${periodLabel(period)}`}>Evolución del valor</SectionTitle>
          <TrendChart values={win} style={cs} height={isMobile ? 140 : 190} color={chartColor(acc.colorIdx)} />
          <TimeAxis period={period} />
        </Panel>
        <Panel>
          <SectionTitle sub="Pulsa un producto para ver su detalle" action={<Btn variant="ghost" size="sm" onClick={() => openModal({ kind: "product", accountId: acc.id })}>Añadir</Btn>}>Distribución por producto</SectionTitle>
          {prods.length > 0 ? (
            <HBars style={cs} items={prods.map((h) => ({ name: h.ticker, value: holdingValue(h), colorIdx: h.colorIdx, sub: `${((holdingValue(h) / Math.max(productsValue, 1)) * 100).toFixed(0)} %`, onClick: () => go({ page: "inversiones", productId: h.id }) }))} valueLabel={formatEUR0} />
          ) : (
            <p className="pv-faint py-4 text-center text-[12px]">Sin productos todavía. Traspasa efectivo y añade el primero.</p>
          )}
        </Panel>
      </PanelGrid>
      <Panel pad={false}>
        <div style={{ padding: "var(--pad)" }}>
          <SectionTitle sub={`${prods.length} productos · ${formatEUR(productsValue)} · coste ${formatEUR0(investedCost)}`} action={<Btn variant="ghost" size="sm" onClick={() => openModal({ kind: "product", accountId: acc.id })}>Añadir producto</Btn>}>Productos en esta cuenta</SectionTitle>
        </div>
        {prods.length > 0 ? (
          <HoldingsList items={prods} onOpen={(h) => go({ page: "inversiones", productId: h.id })} />
        ) : (
          <p className="pv-faint px-5 pb-5 text-[12px]">Esta cuenta aún no tiene productos. Usa «Añadir producto» para registrar tu primera compra.</p>
        )}
      </Panel>
      <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
        <Panel>
          <SectionTitle sub="Estas cuentas no tienen gastos: solo reciben traspasos y compran productos">Cómo se fondea esta cuenta</SectionTitle>
          <div className="flex flex-col gap-3">
            {steps.map((s) => (
              <div key={s.n} className="flex items-start gap-3">
                <span className="pv-num grid h-6 w-6 shrink-0 place-items-center text-[11px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "var(--radius-pill)" }}>{s.n}</span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>{s.t}</p>
                  <p className="pv-faint text-[11.5px]">{s.d}</p>
                </div>
              </div>
            ))}
            <Btn icon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "transfer" })}>Traspasar desde una corriente</Btn>
          </div>
        </Panel>
        <Panel pad={false} span="xl:col-span-2">
          <div style={{ padding: "var(--pad)" }}>
            <SectionTitle sub={funding.length > 0 ? `${funding.length} traspasos · neto ${formatSigned(fundingNet)} · ${periodLabel(period).toLowerCase()}` : "El dinero entra aquí solo mediante traspasos"}>Aportaciones y retiradas</SectionTitle>
          </div>
          {funding.length > 0 ? (
            <TxList txs={funding} limit={isMobile ? 6 : 10} filterable={false} />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 pb-6 text-center">
              <p className="pv-faint text-[12px]">Aún no hay traspasos en este periodo. El primer paso para invertir es mover dinero desde una cuenta corriente.</p>
              <Btn size="sm" icon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "transfer" })}>Crear el primer traspaso</Btn>
            </div>
          )}
        </Panel>
      </PanelGrid>
      <Panel pad={false}>
        <div style={{ padding: "var(--pad)" }}>
          <SectionTitle sub={`${txs.length} movimientos · ${periodLabel(period).toLowerCase()}`} action={<Btn variant="ghost" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => exportTxCsv(`movimientos-${acc.name.toLowerCase().replace(/\s+/g, "-")}.csv`, all, categories, accounts)}>Exportar CSV</Btn>}>Movimientos</SectionTitle>
        </div>
        <TxList txs={txs} limit={isMobile ? 8 : 14} showAccount={false} />
      </Panel>
    </Stack>
    </Tinted>
  );
}

/* ==================================================================
   INVERSIONES
================================================================== */

export function productSeries(h: Holding): number[] {
  return expandSeries(h.prices, { spanDays: 729, seed: h.id + 20, noise: 0.025 });
}

export function HoldingsList({ items, onOpen }: { items: Holding[]; onOpen: (h: Holding) => void }) {
  const { arch, isMobile } = useArch();
  const { period } = usePreview();
  const cs = arch.chartStyle;
  const wins = useMemo(() => Object.fromEntries(items.map((h) => [h.id, windowSeries(productSeries(h), period)])) as Record<number, number[]>, [items, period]);
  return (
    <RowList
      items={items.map((h) => {
        const v = holdingValue(h);
        const g = ((v - h.invested) / h.invested) * 100;
        const w = wins[h.id];
        const pc = changePct(w);
        return {
          id: h.id,
          icon: <span className="pv-num text-[10px] font-bold">{h.ticker.slice(0, 3)}</span>,
          colorIdx: h.colorIdx,
          title: h.nickname,
          sub: `${h.ticker} · ${h.name}`,
          meta: `${h.type} · ${formatNum(h.units)} part. · ${formatPct(pc)} (${periodShort(period)})`,
          value: formatEUR(v),
          sub2: formatPct(g),
          sub2Tone: (g >= 0 ? "pos" : "neg") as "pos" | "neg",
          extra: !isMobile ? <Sparkline values={w} positive={pc >= 0} style={cs} width={arch.list === "dense" ? 60 : 84} height={24} /> : undefined,
          onClick: () => onOpen(h),
        };
      })}
    />
  );
}

export function PortfolioView() {
  const { route } = usePreview();
  return route.productId ? <ProductDetail id={route.productId} /> : <PortfolioList />;
}

function ContribChart({ contrib, style, height, selected, onSelect }: { contrib: ContribResult; style: ChartStyleKey; height: number; selected: number; onSelect: (i: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = contrib.groups.length;
  const hg = hover !== null ? contrib.groups[hover] : null;
  const rows = hg ? hg.parts.map((v, k) => ({ v, k })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v) : [];
  const total = hg ? hg.parts.reduce((a, b) => a + b, 0) : 0;
  const pos = hover !== null ? Math.min(Math.max(((hover + 0.5) / n) * 100, 18), 82) : 50;
  return (
    <div className="relative" style={{ height }}>
      <StackedBars groups={contrib.groups} keys={contrib.keys} style={style} height={height} selected={selected} />
      <div className="absolute inset-0 flex">
        {contrib.groups.map((g, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ver en qué invertiste en ${g.label}`}
            className="h-full flex-1"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => onSelect(i)}
            style={{ background: i === selected ? "color-mix(in srgb, var(--accent) 9%, transparent)" : undefined }}
          />
        ))}
      </div>
      {hg && (
        <div className="pointer-events-none absolute z-10 min-w-[180px]" style={{ left: `${pos}%`, top: 4, transform: "translateX(-50%)", padding: "8px 10px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", boxShadow: "0 14px 30px -12px rgba(0,0,0,.6)" }}>
          <p className="pv-num text-[11.5px] font-bold">{hg.label} · {formatEUR0(total)}</p>
          {rows.length === 0 ? (
            <p className="pv-faint mt-1 text-[11px]">Sin aportaciones</p>
          ) : (
            rows.map((r) => (
              <div key={r.k} className="mt-1 flex items-center justify-between gap-3 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2" style={{ background: chartColor(contrib.keys[r.k].colorIdx), borderRadius: 2 }} />{contrib.keys[r.k].name}</span>
                <span className="pv-num font-semibold">{formatEUR(r.v)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}


/* ==================================================================
   INVERSIONES: vistas de evolución, sectores, países y detalle
================================================================== */

/** Valor (€) y coste acumulado de cada producto día a día */
function dailyOf(h: Holding): { value: number[]; cost: number[] } {
  const path = holdingPath(h);
  const price = productSeries(h);
  return { value: path.units.map((u, d) => u * (price[d] ?? h.price)), cost: path.cost };
}

const sumDays = (arrs: number[][]) => Array.from({ length: FULL_DAYS }, (_, d) => arrs.reduce((s, a) => s + (a[d] ?? 0), 0));
const lastOf = (a: number[]) => a[a.length - 1] ?? 0;

export const EVO_VIEWS = [
  { id: "stack-eur", label: "Apilada · € por producto" },
  { id: "stack-pct", label: "Apilada · % por producto" },
  { id: "prices", label: "Precio · cada producto" },
  { id: "invested", label: "Dinero invertido · cada producto" },
  { id: "perf", label: "Evolución · % de cada producto" },
  { id: "total", label: "Valor total de la cartera" },
  { id: "patrimonio", label: "Patrimonio neto" },
  { id: "cost", label: "Coste frente a valor" },
  { id: "gain", label: "Ganancia acumulada" },
  { id: "cat", label: "Apilada · € por categoría" },
  { id: "acc", label: "Apilada · € por cuenta" },
] as const;
type EvoView = (typeof EVO_VIEWS)[number]["id"];
type Layer = { name: string; colorIdx: ColorRef; values: number[] };

function stackLegend(list: Layer[]) {
  const sum = list.reduce((s, x) => s + lastOf(x.values), 0) || 1;
  return list
    .map((x) => ({ name: x.name, colorIdx: x.colorIdx, last: lastOf(x.values), pct: (lastOf(x.values) / sum) * 100 }))
    .sort((a, b) => b.last - a.last);
}

/** Selector visual de productos: cada producto es una tarjeta con su color, su apodo y su rentabilidad */
function ProductPicker({
  items,
  selected,
  onToggle,
  onAll,
  onNone,
}: {
  items: Holding[];
  selected: number[];
  onToggle: (id: number) => void;
  onAll: () => void;
  onNone: () => void;
}) {
  const { arch } = useArch();
  const pill = arch.button === "pill" || arch.button === "soft" || arch.button === "tonal" || arch.button === "neu";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="pv-muted text-[10.5px] font-bold uppercase tracking-[0.12em]">
          Productos en el gráfico · {selected.length} de {items.length}
        </p>
        <div className="flex items-center gap-1.5">
          <Btn variant="ghost" size="sm" onClick={onAll}>Todos</Btn>
          <Btn variant="ghost" size="sm" onClick={onNone}>Ninguno</Btn>
        </div>
      </div>
      <div className="lab-scroll flex flex-wrap gap-2">
        {items.map((h) => {
          const on = selected.includes(h.id);
          const col = chartColor(h.colorIdx);
          const pct = h.invested > 0 ? ((holdingValue(h) - h.invested) / h.invested) * 100 : 0;
          return (
            <button
              key={h.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(h.id)}
              title={`${h.ticker} · ${h.name}`}
              className="flex items-center gap-2 text-left transition-all"
              style={{
                padding: pill ? "7px 12px" : "6px 10px",
                borderRadius: pill ? 999 : "var(--radius-sm)",
                border: `1.5px solid ${on ? col : "var(--border)"}`,
                background: on ? `color-mix(in srgb, ${col} 20%, var(--surface-2))` : "var(--surface-2)",
                opacity: on ? 1 : 0.55,
                boxShadow: on ? `inset 0 0 0 1px color-mix(in srgb, ${col} 35%, transparent)` : undefined,
              }}
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center text-[9px] font-black"
                style={{
                  background: on ? col : "transparent",
                  color: on ? "var(--bg)" : col,
                  borderRadius: 999,
                  border: `1.5px solid ${col}`,
                  letterSpacing: "-0.02em",
                }}
              >
                {on ? "✓" : h.nickname.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold leading-tight" style={{ color: on ? "var(--text)" : "var(--muted)" }}>
                  {h.nickname}
                </span>
                <span className="pv-faint block truncate text-[10px] leading-tight">{h.ticker} · {h.category}</span>
              </span>
              <span className="pv-num shrink-0 text-[11px] font-bold" style={{ color: pct >= 0 ? "var(--pos)" : "var(--neg)" }}>
                {formatPct(pct)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Donut + leyenda con el peso de cada sector */
function SectorPanel({ rows, total, style, size, title, sub }: { rows: { name: string; value: number; pct: number; colorIdx: number }[]; total: number; style: ChartStyleKey; size: number; title: string; sub: string }) {
  return (
    <Panel>
      <SectionTitle sub={sub}>{title}</SectionTitle>
      <div className="flex flex-col items-center gap-4">
        <Donut slices={rows.map((r) => ({ name: r.name, value: r.value, colorIdx: r.colorIdx }))} style={style} size={size} centerLabel={`${rows.length} sectores`} centerValue={formatEUR0(total)} />
        <div className="w-full">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-3 py-1">
              <span className="flex min-w-0 items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
                <span className="h-2.5 w-2.5 shrink-0" style={{ background: chartColor(r.colorIdx), borderRadius: 999 }} />
                <span className="truncate">{r.name}</span>
              </span>
              <span className="pv-num shrink-0 text-[12px] font-semibold" style={{ color: "var(--text)" }}>{r.pct.toFixed(1).replace(".", ",")} %</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** Construye el elemento de barra de un país (color según su posición en el top 5) */
function countryRow(entries: MapEntry[]) {
  return (r: { name: string; value: number; pct: number }) => ({
    name: r.name,
    value: r.value,
    colorIdx: countryColor(r.name, entries),
    sub: `${r.pct.toFixed(1).replace(".", ",")} %`,
  });
}

function countryColor(name: string, entries: MapEntry[]): ColorRef {
  const e = entries.find((x) => x.name === name);
  return e ? e.rank : "var(--border-strong)";
}

function PortfolioList() {
  const { arch, isMobile } = useArch();
  const { holdings, accounts, go, openModal, period, setPeriod, refreshPrices } = usePreview();
  const openAccount = useOpenAccount();
  const t = useTotals();
  const cs = arch.chartStyle;
  const invAccounts = accounts.filter((a) => a.kind === "inversion");
  const [picked, setPicked] = useState<number[]>([]);
  const [view, setView] = useState<EvoView>("stack-eur");
  const [selLabel, setSelLabel] = useState<string | null>(null);
  /** Productos marcados en el selector del gráfico; null = todos */
  const [selProducts, setSelProducts] = useState<number[] | null>(null);
  const toggleAccount = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const [refreshing, setRefreshing] = useState(false);
  const [priceNote, setPriceNote] = useState("hace 4 min");
  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => {
      refreshPrices();
      setRefreshing(false);
      setPriceNote("ahora mismo");
    }, 900);
  };

  const scope = picked.length ? holdings.filter((h) => picked.includes(h.accountId)) : holdings;
  const scopeAccounts = picked.length ? invAccounts.filter((a) => picked.includes(a.id)) : invAccounts;

  const total = scope.reduce((sum, h) => sum + holdingValue(h), 0);
  const cost = scope.reduce((sum, h) => sum + h.invested, 0);
  const gain = total - cost;
  const gainPct = cost > 0 ? (gain / cost) * 100 : 0;

  /** Productos que se dibujan en la evolución (según el selector) */
  const chartProducts = selProducts ? scope.filter((h) => selProducts.includes(h.id)) : scope;
  const chartAccounts = picked.length ? scopeAccounts.filter((a) => chartProducts.some((h) => h.accountId === a.id)) : invAccounts.filter((a) => chartProducts.some((h) => h.accountId === a.id));

  const daily = chartProducts.map((h) => ({ h, ...dailyOf(h) }));
  const wTotal = windowSeries(sumDays(daily.map((d) => d.value)), period);
  const wCost = windowSeries(sumDays(daily.map((d) => d.cost)), period);
  const wGain = wTotal.map((v, i) => v - wCost[i]);
  const wPat = windowSeries(t.pat, period);
  const N = wTotal.length;
  const pc = changePct(wTotal);
  const wProducts: Layer[] = daily.map((d) => ({ name: d.h.nickname, colorIdx: d.h.colorIdx, values: windowSeries(d.value, period) }));
  const wPrices: Layer[] = daily.map((d) => ({ name: d.h.nickname, colorIdx: d.h.colorIdx, values: windowSeries(productSeries(d.h), period) }));
  const baseOf = (vals: number[]) => vals[0] || 1;
  const wInvested: Layer[] = daily.map((d) => ({ name: d.h.nickname, colorIdx: d.h.colorIdx, values: windowSeries(d.cost, period) }));
  const wPerf: Layer[] = wPrices.map((l) => ({ ...l, values: l.values.map((v, i) => (baseOf(l.values) > 0 ? (v / baseOf(l.values)) * 100 : 100)) }));
  const wCat: Layer[] = HOLDING_CATEGORIES.map((c, i) => ({ name: c, colorIdx: i, values: windowSeries(sumDays(daily.filter((d) => d.h.category === c).map((d) => d.value)), period) })).filter((x) => x.values.some((v) => v > 0));
  const wAcc: Layer[] = chartAccounts.map((a) => ({ name: a.name, colorIdx: a.colorIdx, values: windowSeries(sumDays(daily.filter((d) => d.h.accountId === a.id).map((d) => d.value)), period) })).filter((x) => x.values.some((v) => v > 0));
  const layersFor: Layer[] | null = view === "stack-eur" || view === "stack-pct" ? wProducts : view === "cat" ? wCat : view === "acc" ? wAcc : null;
  const lineLayers: Layer[] | null = view === "prices" ? wPrices : view === "perf" ? wPerf : view === "invested" ? wInvested : null;

  const dateAt = (idx: number) => addDays(periodRange(period).to, -(N - 1 - idx));
  const ds = (a: number[]) => downsample(a, "solid", 140);
  const H = isMobile ? 170 : 240;

  let chart: ReactNode;
  if (layersFor) chart = <StackedArea series={layersFor.map((l) => ({ ...l, values: ds(l.values) }))} percent={view === "stack-pct"} style={cs} height={H} />;
  else if (lineLayers) chart = <MultiLines series={lineLayers.map((l) => ({ ...l, values: ds(l.values) }))} style={cs} height={H} zero={view === "perf" ? 100 : undefined} />;
  else if (view === "total") chart = <TrendChart values={ds(wTotal)} style={cs} color="var(--chart-2)" height={H} />;
  else if (view === "patrimonio") chart = <TrendChart values={ds(wPat)} style={cs} color="var(--chart-1)" height={H} />;
  else if (view === "cost") chart = <MultiLines series={[{ name: "Valor", colorIdx: "var(--chart-2)", values: ds(wTotal) }, { name: "Coste", colorIdx: "var(--muted)", values: ds(wCost) }]} style={cs} height={H} />;
  else chart = <TrendChart values={ds(wGain)} style={cs} color={lastOf(wGain) >= 0 ? "var(--pos)" : "var(--neg)"} height={H} />;

  const renderTip = (idx: number): ReactNode => {
    const head = formatFullDate(dateAt(idx));
    if (layersFor) {
      const sum = layersFor.reduce((s, l) => s + Math.max(0, l.values[idx] ?? 0), 0);
      const rows = layersFor
        .map((l) => ({ name: l.name, colorIdx: l.colorIdx, v: Math.max(0, l.values[idx] ?? 0) }))
        .filter((r) => r.v > 0)
        .sort((a, b) => b.v - a.v);
      return (
        <TipBody head={head} foot={`Total ${formatEUR(sum)}`}>
          {rows.map((r) => (
            <TipRow key={r.name} color={chartColor(r.colorIdx)} name={r.name} value={formatEUR(r.v)} sub={`${((r.v / Math.max(sum, 1)) * 100).toFixed(1).replace(".", ",")} %`} />
          ))}
        </TipBody>
      );
    }
    if (lineLayers) {
      const rows = lineLayers.map((l) => ({ name: l.name, colorIdx: l.colorIdx, v: l.values[idx] ?? 0, base: baseOf(l.values) }));
      if (view === "invested") {
        const shown = rows.filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
        const sum = shown.reduce((x, r) => x + r.v, 0);
        return (
          <TipBody head={head} foot={`Total invertido ${formatEUR(sum)}`}>
            {shown.map((r) => (
              <TipRow key={r.name} color={chartColor(r.colorIdx)} name={r.name} value={formatEUR(r.v)} sub={`${((r.v / Math.max(sum, 1)) * 100).toFixed(1).replace(".", ",")} %`} />
            ))}
          </TipBody>
        );
      }
      const chg = (r: { v: number; base: number }) => (r.base > 0 ? (r.v / r.base - 1) * 100 : 0);
      return (
        <TipBody head={head} foot={view === "perf" ? "Base 100 al inicio del periodo" : "Precio de mercado por participación"}>
          {rows.sort((a, b) => b.v - a.v).map((r) => (
            <TipRow key={r.name} color={chartColor(r.colorIdx)} name={r.name} value={view === "perf" ? r.v.toFixed(1).replace(".", ",") : formatNum(r.v)} sub={formatPct(chg(r))} />
          ))}
        </TipBody>
      );
    }
    if (view === "total") {
      return (
        <TipBody head={head}>
          <TipRow color="var(--chart-2)" name="Valor total" value={formatEUR(wTotal[idx])} />
          <TipRow color="var(--muted)" name="Coste" value={formatEUR(wCost[idx])} />
          <TipRow color={wGain[idx] >= 0 ? "var(--pos)" : "var(--neg)"} name="Ganancia" value={formatSigned(wGain[idx])} />
        </TipBody>
      );
    }
    if (view === "patrimonio") return <TipBody head={head}><TipRow color="var(--chart-1)" name="Patrimonio neto" value={formatEUR(wPat[idx])} /></TipBody>;
    if (view === "cost") {
      return (
        <TipBody head={head}>
          <TipRow color="var(--chart-2)" name="Valor" value={formatEUR(wTotal[idx])} />
          <TipRow color="var(--muted)" name="Coste" value={formatEUR(wCost[idx])} />
        </TipBody>
      );
    }
    const pctAt = wCost[idx] > 0 ? (wGain[idx] / wCost[idx]) * 100 : 0;
    return <TipBody head={head}><TipRow color={wGain[idx] >= 0 ? "var(--pos)" : "var(--neg)"} name="Ganancia acumulada" value={formatSigned(wGain[idx])} sub={formatPct(pctAt)} /></TipBody>;
  };

  const contrib = monthlyContributions(scope, period);
  const contrib12 = monthlyContributions(scope, "1A");
  const monthTotal = (i: number) => contrib.groups[i].parts.reduce((x, y) => x + y, 0);
  let selIdx = contrib.groups.findIndex((g) => g.label === selLabel);
  if (selIdx < 0) {
    selIdx = contrib.groups.length - 1;
    for (let k = contrib.groups.length - 1; k >= 0; k--) {
      if (monthTotal(k) > 0) {
        selIdx = k;
        break;
      }
    }
  }
  const selGroup = contrib.groups[selIdx];
  const selTotal = monthTotal(selIdx);
  const selRows = selGroup.parts.map((v, k) => ({ v, key: contrib.keys[k] })).filter((x) => x.v > 0 && x.key).sort((x, y) => y.v - x.v);
  const selDiff = selTotal - contrib.avg;
  const colTotals = contrib.keys.map((_, k) => contrib.groups.reduce((sum, g) => sum + g.parts[k], 0));
  const geo = countryDistribution(scope);
  const entries = countryTop5(geo.rows);
  const sectors = sectorDistribution(scope);
  const scopeName = scopeAccounts.length === 1 ? scopeAccounts[0].name : picked.length ? `${scopeAccounts.length} cuentas` : "Todas las cuentas";

  const kpis = [
    { label: "Valor de cartera", value: formatEUR(total), delta: formatPct(pc), trend: trend(pc), icon: <Briefcase className="h-4 w-4" />, colorIdx: 0, footnote: `${periodShort(period)} · invertido ${formatEUR0(cost)}`, pct: 100 },
    { label: "Ganancia latente", value: formatSigned(gain), delta: formatPct(gainPct), trend: trend(gain), icon: <TrendingUp className="h-4 w-4" />, colorIdx: 3, footnote: "desde la compra", pct: Math.min(100, Math.abs(gainPct) * 4) },
    { label: "TIR (XIRR)", value: formatPct(9.34), delta: "+1,8 pp", trend: "up" as const, icon: <Coins className="h-4 w-4" />, colorIdx: 4, footnote: "12 meses", pct: 58 },
    { label: "Aportación mensual", value: formatEUR(contrib12.avg), footnote: `media últimos 12 meses · ${formatEUR0(contrib12.total)} aportados`, icon: <Plus className="h-4 w-4" />, colorIdx: 1, pct: Math.min(100, (contrib12.avg / 1000) * 100) },
  ];

  return (
    <Stack>
      <PageHeader kicker={`Cartera · precios de ${priceNote}`} title="Inversiones" action={
        <>
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />
          <Btn variant="ghost" icon={<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />} onClick={handleRefresh} disabled={refreshing}>{refreshing ? "Actualizando…" : "Actualizar precios"}</Btn>
          <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "product" })}>Añadir producto</Btn>
        </>
      } />

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pv-muted mr-1 text-[10.5px] font-bold uppercase tracking-[0.12em]">Ver cuentas</span>
          <button type="button" aria-pressed={picked.length === 0} onClick={() => setPicked([])} className="rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ background: picked.length === 0 ? "var(--accent)" : "var(--surface-2)", color: picked.length === 0 ? "var(--accent-fg)" : "var(--text)", border: `1.5px solid ${picked.length === 0 ? "var(--accent)" : "var(--border)"}` }}>
            Todas
          </button>
          {invAccounts.map((a) => {
            const on = picked.includes(a.id);
            const col = chartColor(a.colorIdx);
            return (
              <button key={a.id} type="button" aria-pressed={on} onClick={() => toggleAccount(a.id)} className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ background: on ? `color-mix(in srgb, ${col} 18%, var(--surface-2))` : "var(--surface-2)", border: `1.5px solid ${on ? col : "var(--border)"}`, color: "var(--text)" }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: col }} />
                {a.name}
              </button>
            );
          })}
        </div>
      </Panel>

      <KpiGroup items={kpis} />

      <PanelGrid cols={scopeAccounts.length > 1 && !isMobile ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}>
        {scopeAccounts.map((acc) => {
          const items = scope.filter((h) => h.accountId === acc.id);
          const v = items.reduce((sum, h) => sum + holdingValue(h), 0);
          const c = items.reduce((sum, h) => sum + h.invested, 0);
          /** Rentabilidad media de los productos de esta cartera */
          const avgPct = items.length ? items.reduce((sum, h) => sum + (h.invested > 0 ? ((holdingValue(h) - h.invested) / h.invested) * 100 : 0), 0) / items.length : 0;
          const best = items.length ? items.reduce((b, h) => (h.invested > 0 && (holdingValue(h) - h.invested) / h.invested > (holdingValue(b) - b.invested) / Math.max(b.invested, 1e-9) ? h : b), items[0]) : null;
          return (
            <Panel key={acc.id} pad={false}>
              <div className="flex flex-wrap items-start justify-between gap-3" style={{ padding: "var(--pad)", paddingBottom: 10 }}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-3 w-3 shrink-0" style={{ background: chartColor(acc.colorIdx), borderRadius: 999 }} />
                  <div className="min-w-0">
                    <p className="pv-display truncate text-[15px] font-semibold" style={{ color: "var(--text)" }}>{acc.name}</p>
                    <p className="pv-faint text-[11px]">
                      {items.length} {items.length === 1 ? "producto" : "productos"} · {formatEUR(v)}
                      {total > 0 ? ` · ${((v / total) * 100).toFixed(0)} % de la cartera` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="pv-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold" title="Media del porcentaje de ganancia de los productos de esta cartera">
                    Rentabilidad media
                    <span className={`pv-num font-bold ${avgPct >= 0 ? "pv-pos" : "pv-neg"}`}>{formatPct(avgPct)}</span>
                  </span>
                  <Chip trend={avgPct >= 0 ? "up" : "down"}>{formatSigned(v - c)}</Chip>
                  <Btn variant="ghost" size="sm" onClick={() => openAccount(acc.id)}>Ver cuenta</Btn>
                </div>
              </div>
              {items.length ? (
                <>
                  <HoldingsList items={items} onOpen={(h) => go({ page: "inversiones", productId: h.id })} />
                  {best && (
                    <p className="pv-muted px-4 pb-3 text-[11px]" style={{ paddingLeft: "var(--pad)", paddingRight: "var(--pad)" }}>
                      Mejor producto: <b style={{ color: "var(--text)" }}>{best.nickname}</b> con{" "}
                      <span className={`pv-num font-bold ${avgPct >= 0 ? "pv-pos" : "pv-neg"}`}>
                        {formatPct(best.invested > 0 ? ((holdingValue(best) - best.invested) / best.invested) * 100 : 0)}
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <p className="pv-faint px-5 pb-5 text-[12px]">Esta cuenta aún no tiene productos.</p>
              )}
            </Panel>
          );
        })}
      </PanelGrid>

      <Panel>
        <ProductPicker
          items={scope}
          selected={selProducts ?? scope.map((h) => h.id)}
          onToggle={(id) =>
            setSelProducts((prev) => {
              const cur = prev ?? scope.map((h) => h.id);
              return cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : [...cur, id];
            })
          }
          onAll={() => setSelProducts(null)}
          onNone={() => setSelProducts(scope.length ? [scope[0].id] : [])}
        />
      </Panel>

      <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
        <Panel span="xl:col-span-2">
          <SectionTitle sub={`${scopeName} · ${periodLabel(period).toLowerCase()} · pasa el ratón por el gráfico para ver el detalle`} action={<Chip trend={trend(pc)}>{formatPct(pc)}</Chip>}>Evolución de la cartera</SectionTitle>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {EVO_VIEWS.map((v) => {
              const on = v.id === view;
              return (
                <button key={v.id} type="button" aria-pressed={on} onClick={() => setView(v.id)} className="rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors" style={{ background: on ? "var(--accent)" : "var(--surface-2)", color: on ? "var(--accent-fg)" : "var(--muted)", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}` }}>
                  {v.label}
                </button>
              );
            })}
          </div>
          {chartProducts.length === 0 ? (
            <p className="pv-faint py-10 text-center text-[12px]">No hay productos seleccionados para dibujar el gráfico.</p>
          ) : (
            <>
              <HoverLayer count={N} render={renderTip}>{chart}</HoverLayer>
              <TimeAxis period={period} />
            </>
          )}
          {layersFor ? (
            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {stackLegend(layersFor).map((x) => (
                <div key={x.name} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0" style={{ background: chartColor(x.colorIdx), borderRadius: 3 }} />
                    <span className="truncate" style={{ color: "var(--text)" }}>{x.name}</span>
                  </span>
                  <span className="pv-num shrink-0 text-right" style={{ color: "var(--muted)" }}>{formatEUR0(x.last)} · {x.pct.toFixed(0)} %</span>
                </div>
              ))}
            </div>
          ) : lineLayers ? (
            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {lineLayers
                .map((l) => {
                  const last = l.values[l.values.length - 1] ?? 0;
                  const base = baseOf(l.values);
                  return { l, last, pct: base > 0 ? (last / base - 1) * 100 : 0 };
                })
                .sort((x, y) => (view === "invested" ? y.last - x.last : y.pct - x.pct))
                .map(({ l, last, pct }) => (
                  <div key={l.name} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2.5 w-2.5 shrink-0" style={{ background: chartColor(l.colorIdx), borderRadius: 3 }} />
                      <span className="truncate" style={{ color: "var(--text)" }}>{l.name}</span>
                    </span>
                    {view === "invested" ? (
                      <span className="pv-num shrink-0 font-semibold" style={{ color: "var(--text)" }}>{formatEUR0(last)}</span>
                    ) : (
                      <span className={`pv-num shrink-0 font-bold ${pct >= 0 ? "pv-pos" : "pv-neg"}`}>{formatPct(pct)}</span>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[12px]" style={{ color: "var(--muted)" }}>
              {view === "patrimonio" && <span>Patrimonio neto actual <b className="pv-num" style={{ color: "var(--text)" }}>{formatEUR0(lastOf(wPat))}</b></span>}
              {view !== "patrimonio" && <span>Valor <b className="pv-num" style={{ color: "var(--text)" }}>{formatEUR0(lastOf(wTotal))}</b></span>}
              {view !== "patrimonio" && <span>Coste <b className="pv-num" style={{ color: "var(--text)" }}>{formatEUR0(lastOf(wCost))}</b></span>}
              {view !== "patrimonio" && <span>Ganancia <b className="pv-num" style={{ color: lastOf(wGain) >= 0 ? "var(--pos)" : "var(--neg)" }}>{formatSigned(lastOf(wGain))}</b></span>}
            </div>
          )}
        </Panel>
        <Panel>
          <SectionTitle sub="Peso de cada categoría en la cartera">Asignación</SectionTitle>
          {arch.surface === "none" || cs === "step" ? (
            <HBars style={cs} items={HOLDING_CATEGORIES.map((c, i) => ({ name: c, value: scope.filter((h) => h.category === c).reduce((s, h) => s + holdingValue(h), 0), colorIdx: i })).filter((b) => b.value > 0).map((b) => ({ ...b, sub: `${((b.value / Math.max(total, 1)) * 100).toFixed(0)} %` }))} valueLabel={formatEUR0} />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Donut slices={HOLDING_CATEGORIES.map((c, i) => ({ name: c, value: scope.filter((h) => h.category === c).reduce((s, h) => s + holdingValue(h), 0), colorIdx: i })).filter((b) => b.value > 0)} style={cs} size={isMobile ? 150 : 170} centerLabel="Cartera" centerValue={formatEUR0(total)} />
              <div className="w-full">
                {HOLDING_CATEGORIES.map((c, i) => ({ name: c, value: scope.filter((h) => h.category === c).reduce((s, h) => s + holdingValue(h), 0), colorIdx: i })).filter((b) => b.value > 0).map((b) => (
                  <div key={b.name} className="flex items-center justify-between gap-2 py-1">
                    <span className="pv-muted flex min-w-0 items-center gap-2 text-[12px]"><span className="h-2.5 w-2.5 shrink-0" style={{ background: chartColor(b.colorIdx), borderRadius: 999 }} /><span className="truncate">{b.name}</span></span>
                    <span className="pv-num shrink-0 text-[12px] font-semibold" style={{ color: "var(--text)" }}>{((b.value / Math.max(total, 1)) * 100).toFixed(0)} %</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </PanelGrid>

      <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
        <Panel span="xl:col-span-2">
          <SectionTitle sub={`${contrib.months} meses · media ${formatEUR0(contrib.avg)}/mes · total ${formatEUR0(contrib.total)} · pulsa un mes para ver en qué invertiste`} action={<Chip trend="neutral">{`Mejor mes: ${contrib.best.label} · ${formatEUR0(contrib.best.value)}`}</Chip>}>
            Aportaciones mensuales
          </SectionTitle>
          <ContribChart contrib={contrib} style={cs} height={isMobile ? 160 : 210} selected={selIdx} onSelect={(i) => setSelLabel(contrib.groups[i].label)} />
          <BucketAxis labels={contrib.groups.map((g) => g.label)} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {contrib.keys.map((k) => (
              <button key={k.id} type="button" onClick={() => go({ page: "inversiones", productId: k.id })} className="pv-hit flex items-center gap-1.5 px-1 text-[11px]" style={{ borderRadius: 6 }}>
                <span className="h-2.5 w-2.5" style={{ background: chartColor(k.colorIdx), borderRadius: arch.surface === "brutal" ? 0 : 3 }} />
                <span className="pv-num font-semibold" style={{ color: "var(--text)" }}>{k.name}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel>
          <SectionTitle
            sub={selTotal > 0 ? `${selRows.length} ${selRows.length === 1 ? "producto" : "productos"} · ${selDiff >= 0 ? "+" : "−"}${formatEUR0(Math.abs(selDiff))} sobre la media` : "Sin aportaciones este mes"}
            action={
              <div className="flex items-center gap-1">
                <Btn variant="ghost" size="sm" aria="Mes anterior" disabled={selIdx <= 0} onClick={() => setSelLabel(contrib.groups[selIdx - 1].label)}>‹</Btn>
                <Btn variant="ghost" size="sm" aria="Mes siguiente" disabled={selIdx >= contrib.groups.length - 1} onClick={() => setSelLabel(contrib.groups[selIdx + 1].label)}>›</Btn>
              </div>
            }
          >
            En qué invertiste en {selGroup.label}
          </SectionTitle>
          <p className="pv-num pv-display text-[26px] font-bold leading-none" style={{ color: "var(--text)" }}>{formatEUR(selTotal)}</p>
          <div className="-mx-1 mt-3">
            {selRows.length === 0 ? (
              <p className="pv-faint px-1 py-4 text-center text-[12px]">No hiciste aportaciones en este mes.</p>
            ) : (
              <RowList
                items={selRows.map((r) => ({
                  id: r.key.id,
                  icon: <span className="pv-num text-[10px] font-bold">{r.key.name.slice(0, 3)}</span>,
                  colorIdx: r.key.colorIdx,
                  title: r.key.name,
                  sub: holdings.find((x) => x.id === r.key.id)?.name ?? "",
                  value: formatEUR(r.v),
                  sub2: `${((r.v / selTotal) * 100).toFixed(0)} % del mes`,
                  sub2Tone: "muted" as const,
                  onClick: () => go({ page: "inversiones", productId: r.key.id }),
                }))}
              />
            )}
          </div>
        </Panel>
      </PanelGrid>

      <Panel pad={false}>
        <div style={{ padding: "var(--pad)", paddingBottom: 8 }}>
          <SectionTitle sub="Cuánto aportaste a cada producto, mes a mes · pulsa una fila para ver su detalle">Tabla de aportaciones</SectionTitle>
        </div>
        <div className="lab-scroll overflow-auto" style={{ maxHeight: 360 }}>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="pv-muted sticky left-0 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ background: "var(--surface-2)" }}>Mes</th>
                {contrib.keys.map((k) => (
                  <th key={k.id} className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--text)" }}>
                    <span className="mr-1 inline-block h-2 w-2" style={{ background: chartColor(k.colorIdx), borderRadius: 2 }} />{k.name}
                  </th>
                ))}
                <th className="pv-muted px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.1em]">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...contrib.groups].reverse().map((g) => {
                const tot = g.parts.reduce((x, y) => x + y, 0);
                const active = g.label === selGroup.label;
                return (
                  <tr key={g.label} onClick={() => setSelLabel(g.label)} className="pv-table-row cursor-pointer" style={{ borderTop: "1px solid var(--border)", background: active ? "var(--accent-soft)" : undefined }}>
                    <td className="sticky left-0 px-3 py-1.5 text-[12px] font-semibold" style={{ color: "var(--text)", background: active ? "color-mix(in srgb, var(--accent) 14%, var(--bg))" : "var(--bg)" }}>{g.label}</td>
                    {g.parts.map((v, k) => (
                      <td key={k} className="pv-num px-2 py-1.5 text-right text-[11.5px]" style={{ color: v > 0 ? "var(--text)" : "var(--faint)" }}>{v > 0 ? formatEUR0(v) : "—"}</td>
                    ))}
                    <td className="pv-num px-3 py-1.5 text-right text-[12px] font-bold" style={{ color: "var(--text)" }}>{tot > 0 ? formatEUR0(tot) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border-strong)", background: "var(--surface-2)" }}>
                <td className="pv-muted sticky left-0 px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ background: "var(--surface-2)" }}>Total</td>
                {colTotals.map((v, k) => (
                  <td key={k} className="pv-num px-2 py-2 text-right text-[11.5px] font-bold" style={{ color: "var(--text)" }}>{formatEUR0(v)}</td>
                ))}
                <td className="pv-num px-3 py-2 text-right text-[12px] font-bold" style={{ color: "var(--accent)" }}>{formatEUR0(contrib.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
        <Panel span="xl:col-span-3">
          <SectionTitle sub={`Exposición real según el contenido de cada producto · ${formatEUR0(geo.total)}`}>Distribución por países</SectionTitle>
          {!isMobile ? (
            <>
              <WorldMap entries={entries} />
              <div className="mt-5">
                <HBars style={cs} columns={isMobile ? 1 : 3} items={geo.rows.map(countryRow(entries))} valueLabel={formatEUR0} />
              </div>
            </>
          ) : (
            <>
              <HBars style={cs} items={geo.rows.map(countryRow(entries))} valueLabel={formatEUR0} />
              <div className="mt-4"><WorldMap entries={entries} /></div>
            </>
          )}
        </Panel>
        <SectorPanel rows={sectors.rows} total={sectors.total} style={cs} size={isMobile ? 150 : 170} title="Sectores" sub="Peso de cada sector en la cartera seleccionada" />
      </PanelGrid>

    </Stack>
  );
}

function ProductDetail({ id }: { id: number }) {
  const { arch, isMobile } = useArch();
  const { holdings, accounts, back, openModal, period, setPeriod, go } = usePreview();
  const h = holdings.find((x) => x.id === id);
  const full = useMemo(() => (h ? productSeries(h) : []), [h]);
  if (!h) return null;
  const acc = accounts.find((a) => a.id === h.accountId);
  const v = holdingValue(h);
  const g = v - h.invested;
  const gp = h.invested > 0 ? (g / h.invested) * 100 : 0;
  const avg = h.invested / Math.max(h.units, 1e-9);
  const win = windowSeries(full, period);
  const pc = changePct(win);
  const cs = arch.chartStyle;
  const totalPortfolio = holdings.reduce((sum, x) => sum + holdingValue(x), 0);
  const geo = countryDistribution([h]);
  const entries = countryTop5(geo.rows);
  const sectors = sectorDistribution([h]);
  const topRows = h.top.slice(0, 10);
  const topSum = topRows.reduce((sum, [, p]) => sum + p, 0);
  const maxTop = Math.max(...topRows.map(([, p]) => p), 1);
  const countryBars = geo.rows.map((r) => ({ name: r.name, value: r.value, colorIdx: countryColor(r.name, entries), sub: `${r.pct.toFixed(1).replace(".", ",")} %` }));

  const kpis = [
    { label: "Valor actual", value: formatEUR(v), delta: formatPct(gp), trend: trend(g), icon: <Briefcase className="h-4 w-4" />, colorIdx: h.colorIdx, footnote: "desde la compra", pct: 100 },
    { label: "Precio", value: `${formatNum(h.price)} ${h.currency === "USD" ? "$" : "€"}`, delta: formatPct(h.change1d), trend: trend(h.change1d), footnote: "hoy", icon: <TrendingUp className="h-4 w-4" />, colorIdx: 1, pct: 64 },
    { label: `Variación · ${periodShort(period)}`, value: formatPct(pc), delta: formatSigned((win[win.length - 1] - win[0]) * h.units), trend: trend(pc), footnote: "sobre tu posición", icon: <Coins className="h-4 w-4" />, colorIdx: 2, pct: Math.min(100, Math.abs(pc) * 3) },
    { label: "Precio medio", value: `${formatNum(avg)} €`, footnote: `${formatNum(h.units)} participaciones · ${((v / Math.max(totalPortfolio, 1)) * 100).toFixed(1).replace(".", ",")} % de la cartera`, icon: <Wallet className="h-4 w-4" />, colorIdx: 3, pct: Math.min(100, (avg / Math.max(h.price, 1)) * 100) },
  ];

  const opLabel: Record<string, string> = { compra: "Compra", venta: "Venta", dividendo: "Dividendo", aportacion: "Aportación" };
  const ops = [...h.operations].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : y.id - x.id));

  return (
    <Tinted color={h.colorIdx}>
    <Stack>
      <PageHeader onBack={back} kicker={`${h.category} · ${h.ticker} · ${h.name} · ${acc?.name ?? ""}`} title={h.nickname} action={
        <>
          <Btn variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "editProduct", productId: h.id })}>Editar</Btn>
          <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "operation", productId: h.id })}>Nueva operación</Btn>
        </>
      } />
      <KpiGroup items={kpis} />

      <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
        <Panel span="xl:col-span-2">
          <SectionTitle sub={`Precio de mercado · ${periodLabel(period).toLowerCase()}`} action={<Segmented options={PERIODS} value={period} onChange={setPeriod} />}>Evolución del precio</SectionTitle>
          <TrendChart values={win} style={cs} height={isMobile ? 150 : 210} color={chartColor(h.colorIdx)} />
          <TimeAxis period={period} />
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] pv-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-4" style={{ background: chartColor(h.colorIdx) }} /> Precio</span>
            <span className="pv-num">Mín. {formatNum(Math.min(...win))} · Máx. {formatNum(Math.max(...win))}</span>
          </div>
        </Panel>
        <Panel>
          <SectionTitle sub="Coste, valor y ficha del producto">Composición</SectionTitle>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="pv-muted text-[10.5px] font-bold uppercase tracking-[0.1em]">Invertido</p>
              <p className="pv-num text-[17px] font-bold" style={{ color: "var(--text)" }}>{formatEUR0(h.invested)}</p>
            </div>
            <div className="text-right">
              <p className="pv-muted text-[10.5px] font-bold uppercase tracking-[0.1em]">Valor actual</p>
              <p className="pv-num text-[17px] font-bold" style={{ color: "var(--text)" }}>{formatEUR0(v)}</p>
            </div>
          </div>
          <div className="mt-2.5 flex h-2.5 overflow-hidden" style={{ borderRadius: 999, background: "var(--surface-2)" }}>
            <span style={{ width: `${(Math.min(h.invested, v) / Math.max(h.invested, v, 1)) * 100}%`, background: chartColor(1) }} />
            <span className="flex-1" style={{ background: g >= 0 ? "var(--pos)" : "var(--neg)", opacity: 0.85 }} />
          </div>
          <p className="mt-2 text-[12px]">
            <span className="pv-muted">{g >= 0 ? "Ganancia" : "Pérdida"}: </span>
            <b className="pv-num" style={{ color: g >= 0 ? "var(--pos)" : "var(--neg)" }}>{formatSigned(g)} · {formatPct(gp)}</b>
          </p>
          <div className="pv-divider my-3" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            {[["Categoría", h.category], ["Divisa", h.currency], ["Cuenta", acc?.name ?? "—"], ["Operaciones", String(h.operations.length)]].map(([k, val]) => (
              <div key={k} className="flex min-w-0 flex-col">
                <dt className="pv-faint text-[10.5px]">{k}</dt>
                <dd className="truncate font-semibold" style={{ color: "var(--text)" }}>{val}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </PanelGrid>

      <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
        <Panel pad={false} span="xl:col-span-2">
          <div style={{ padding: "var(--pad)", paddingBottom: 8 }}>
            <SectionTitle sub={`${topRows.length} de ${h.top.length} posiciones · pesos sobre el valor del producto`}>Top 10 empresas</SectionTitle>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="pv-muted px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ paddingLeft: "var(--pad)" }}>#</th>
                <th className="pv-muted px-2 py-2 text-[10px] font-bold uppercase tracking-[0.1em]">Empresa</th>
                <th className="pv-muted px-2 py-2 text-[10px] font-bold uppercase tracking-[0.1em]">Peso</th>
                <th className="pv-muted px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.1em]" style={{ paddingRight: "var(--pad)" }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map(([name, pct], i) => (
                <tr key={name} className="pv-table-row" style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="pv-num px-3 py-1.5 text-[11px]" style={{ paddingLeft: "var(--pad)", color: "var(--faint)" }}>{i + 1}</td>
                  <td className="px-2 py-1.5 text-[12px] font-medium" style={{ color: "var(--text)" }}>{name}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden" style={{ background: "var(--surface-2)", borderRadius: 999 }}>
                        <div className="h-full" style={{ width: `${(pct / maxTop) * 100}%`, background: chartColor(h.colorIdx), borderRadius: 999 }} />
                      </div>
                      <span className="pv-num text-[11.5px] font-semibold" style={{ color: "var(--text)" }}>{pct.toFixed(1).replace(".", ",")} %</span>
                    </div>
                  </td>
                  <td className="pv-num px-3 py-1.5 text-right text-[11.5px]" style={{ paddingRight: "var(--pad)", color: "var(--muted)" }}>{formatEUR(v * pct / 100)}</td>
                </tr>
              ))}
            </tbody>
            {topSum < 99.5 && (
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border-strong)" }}>
                  <td className="px-3 py-1.5 text-[11px]" style={{ paddingLeft: "var(--pad)" }} />
                  <td className="px-2 py-1.5 text-[11.5px] italic" style={{ color: "var(--muted)" }}>Resto de posiciones</td>
                  <td className="pv-num px-2 py-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>{(100 - topSum).toFixed(1).replace(".", ",")} %</td>
                  <td className="pv-num px-3 py-1.5 text-right text-[11.5px]" style={{ paddingRight: "var(--pad)", color: "var(--muted)" }}>{formatEUR(v * (100 - topSum) / 100)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </Panel>
        <SectorPanel rows={sectors.rows} total={sectors.total} style={cs} size={isMobile ? 150 : 160} title="Sectores" sub="Peso de cada sector dentro del producto" />
      </PanelGrid>

      <PanelGrid cols="grid-cols-1">
        <Panel>
          <SectionTitle sub="Países y regiones en los que invierte este producto">Distribución geográfica</SectionTitle>
          {!isMobile ? (
            <>
              <WorldMap entries={entries} />
              <div className="mt-5">
                <HBars style={cs} columns={isMobile ? 1 : 3} items={countryBars} valueLabel={formatEUR0} />
              </div>
            </>
          ) : (
            <>
              <HBars style={cs} items={countryBars} valueLabel={formatEUR0} />
              <div className="mt-4"><WorldMap entries={entries} /></div>
            </>
          )}
        </Panel>
      </PanelGrid>

      <Panel pad={false}>
        <div style={{ padding: "var(--pad)", paddingBottom: 8 }}>
          <SectionTitle sub={`${h.operations.length} operaciones · lotes FIFO: las ventas consumen primero las compras más antiguas`} action={<Btn variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "operation", productId: h.id })}>Nueva</Btn>}>Operaciones</SectionTitle>
        </div>
        <RowList
          items={ops.map((op) => ({
            id: op.id,
            icon: op.type === "venta" ? <TrendingUp className="h-4 w-4 rotate-90" /> : op.type === "dividendo" ? <Coins className="h-4 w-4" /> : <Plus className="h-4 w-4" />,
            colorIdx: op.type === "venta" ? 5 : op.type === "dividendo" ? 4 : 3,
            title: `${opLabel[op.type]}${op.units ? ` · ${formatNum(op.units)} part.` : ""}`,
            sub: formatFullDate(op.date),
            meta: op.fees ? `comisión ${formatEUR(op.fees)}` : undefined,
            value: op.type === "dividendo" ? formatSigned(op.price) : formatEUR(op.units * op.price),
            valueTone: (op.type === "dividendo" ? "pos" : "text") as "pos" | "text",
            sub2: op.type === "dividendo" ? undefined : `${formatNum(op.price)} €/part.`,
            sub2Tone: "muted" as const,
            extra: (
              <Btn variant="ghost" size="sm" aria="Editar operación" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "editOperation", productId: h.id, opId: op.id })}>Editar</Btn>
            ),
          }))}
          empty="Sin operaciones todavía"
        />
      </Panel>
    </Stack>
    </Tinted>
  );
}

export { TODAY, bucketLabels, sampleAtBuckets, downloadFile };
