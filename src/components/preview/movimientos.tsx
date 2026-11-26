"use client";

/* ==================================================================
   MOVIMIENTOS · varias cuentas a la vez

   La ficha de una cuenta corriente enseña su saldo, su gráfica, sus gastos
   por categoría y su lista de movimientos. Esta pantalla hace lo mismo pero
   con las cuentas que tú elijas: se marcan y desmarcan arriba y todo
   (KPIs, gráficas, categorías y lista) se recalcula con esa selección.
================================================================== */

import { useMemo, useState } from "react";
import { ArrowLeftRight, Download, Plus, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { type Account, type Holding, type Tx, periodOptions } from "@/lib/mock";
import { addDays, changePct, expandSeries, inPeriod, periodDays, periodLabel, periodShort, periodStart, windowSeries } from "@/lib/series";
import { formatEUR, formatEUR0, formatPct, formatSigned } from "@/lib/format";
import { chartColor } from "@/lib/colors";
import { cashOf, valueOf } from "@/lib/cash";
import { Donut, HBars, TrendChart } from "./charts";
import { Btn, KpiGroup, Panel, PanelGrid, PageHeader, SectionTitle, Segmented, Stack, TimeAxis } from "./primitives";
import { useArch, usePreview } from "./state";
import { TxList } from "./views-main";

type KindKey = "corriente" | "inversion";

/** Cuántos movimientos se ven de golpe (o todos). */
const PAGE_CHOICES = [20, 50, 100] as const;
type PageSize = (typeof PAGE_CHOICES)[number] | "all";

/**
 * Serie del saldo conjunto.
 *
 * Se construye una serie «sintética» con la suma de los históricos de las
 * cuentas elegidas y su valor actual al final, en vez de sumar las series ya
 * expandidas: así el ruido de cada cuenta no se acumula y la curva se lee.
 */
function combinedSeries(accounts: Account[], holdings: Holding[], transactions: Tx[]): number[] {
  if (!accounts.length) return [];
  const len = Math.min(...accounts.map((a) => a.history.length));
  const history = Array.from({ length: len }, (_, i) => accounts.reduce((sum, a) => sum + (a.history[i] ?? 0), 0));
  const end = accounts.reduce((sum, a) => sum + (a.kind === "inversion" ? valueOf(a, holdings, transactions) : a.balance), 0);
  return expandSeries([...history.slice(0, -1), end], { spanDays: 335, seed: 3 });
}

export function MovementsView() {
  const { arch, isMobile } = useArch();
  const { accounts, holdings, transactions, categories, period, setPeriod, openModal, go } = usePreview();
  const cs = arch.chartStyle;

  const [kind, setKind] = useState<KindKey>("corriente");
  /** Cuentas marcadas. `null` = todas las de ese tipo (así las nuevas entran solas). */
  const [picked, setPicked] = useState<number[] | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20);

  const kindAccounts = useMemo(() => accounts.filter((a) => a.kind === kind && !a.archived), [accounts, kind]);
  const chosen = picked === null ? kindAccounts : kindAccounts.filter((a) => picked.includes(a.id));
  const ids = useMemo(() => new Set(chosen.map((a) => a.id)), [chosen]);

  const toggle = (id: number) => {
    const base = picked === null ? kindAccounts.map((a) => a.id) : picked;
    setPicked(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
  };
  const switchKind = (k: KindKey) => {
    setKind(k);
    setPicked(null);
  };
  const allOn = kindAccounts.length > 0 && chosen.length === kindAccounts.length;

  /* Movimientos de las cuentas elegidas dentro del periodo. */
  const inSel = useMemo(
    () => transactions.filter((t) => ids.has(t.accountId) && inPeriod(t.date, period)),
    [transactions, ids, period],
  );

  /* En las corrientes, el saldo. En las de inversión, el efectivo sin invertir:
     es la caja que de verdad mueven los movimientos. */
  const balanceOf = (a: Account) => (a.kind === "inversion" ? cashOf(a, holdings, transactions) : a.balance);
  const balance = chosen.reduce((sum, a) => sum + balanceOf(a), 0);
  const realTx = inSel.filter((t) => t.categoryId !== 0);
  const income = realTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = Math.abs(realTx.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const transfers = inSel.length - realTx.length;

  const full = useMemo(() => combinedSeries(chosen, holdings, transactions), [chosen, holdings, transactions]);
  const win = useMemo(() => windowSeries(full, period), [full, period]);
  const d = win.length ? win[win.length - 1] - win[0] : 0;

  /* Gastos por categoría de todas las cuentas marcadas. */
  const expByCat = categories
    .filter((c) => c.kind === "gasto")
    .map((c) => ({ ...c, spent: -inSel.filter((t) => t.categoryId === c.id && t.amount < 0).reduce((s, t) => s + t.amount, 0) }))
    .filter((c) => c.spent > 0)
    .sort((x, y) => y.spent - x.spent);

  /* Cuánto pesa cada cuenta dentro de la selección. */
  const split = chosen
    .map((a) => ({
      name: a.name,
      value: Math.max(0, balanceOf(a)),
      colorIdx: a.colorIdx,
      sub: `${Math.round((Math.max(0, balanceOf(a)) / Math.max(balance, 1)) * 100)} %`,
      onClick: () => go({ page: "cuentas", accountId: a.id }),
    }))
    .sort((x, y) => y.value - x.value);

  /* Comparación con el periodo anterior para el chip de gastos. */
  const start = periodStart(period);
  const prevStart = addDays(start, -periodDays(period));
  const prevSpent = Math.abs(
    transactions
      .filter((t) => ids.has(t.accountId) && t.categoryId !== 0 && t.amount < 0 && t.date >= prevStart && t.date < start)
      .reduce((s, t) => s + t.amount, 0),
  );
  const prevPct = prevSpent > 0 ? ((expense - prevSpent) / prevSpent) * 100 : null;

  const kpis = [
    {
      label: kind === "inversion" ? "Efectivo sin invertir" : "Saldo conjunto",
      value: formatEUR(balance),
      delta: formatSigned(d),
      trend: (d >= 0 ? "up" : "down") as "up" | "down",
      icon: <Wallet className="h-4 w-4" />,
      colorIdx: 0,
      footnote: `${chosen.length} de ${kindAccounts.length} cuentas · ${periodShort(period)}`,
      pct: 100,
    },
    { label: "Ingresos", value: formatEUR(income), footnote: periodShort(period), icon: <TrendingUp className="h-4 w-4" />, colorIdx: 3, pct: income + expense > 0 ? (income / (income + expense)) * 100 : 50 },
    {
      label: "Gastos",
      value: formatEUR(expense),
      delta: prevPct === null ? undefined : formatPct(prevPct),
      trend: prevPct === null ? undefined : ((expense >= prevSpent ? "up" : "down") as "up" | "down"),
      icon: <ShoppingCart className="h-4 w-4" />,
      colorIdx: 5,
      footnote: prevPct === null ? periodShort(period) : `frente al periodo anterior`,
      pct: income + expense > 0 ? (expense / (income + expense)) * 100 : 50,
    },
    {
      label: "Movimientos",
      value: String(inSel.length),
      footnote: `${realTx.length} gastos e ingresos · ${transfers} traspasos`,
      icon: <ArrowLeftRight className="h-4 w-4" />,
      colorIdx: 1,
      pct: 55,
    },
  ];

  return (
    <Stack>
      <PageHeader
        kicker={`${chosen.length} de ${kindAccounts.length} cuentas · ${periodLabel(period)}`}
        title="Movimientos"
        action={
          <>
            <Segmented options={periodOptions(period)} value={period} onChange={setPeriod} />
            <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "tx" })}>Nuevo movimiento</Btn>
          </>
        }
      />

      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              options={[{ id: "corriente", label: "Corrientes" }, { id: "inversion", label: "Inversión" }]}
              value={kind}
              onChange={(v) => switchKind(v as KindKey)}
            />
            <span className="pv-muted text-[10.5px] font-bold uppercase tracking-[0.12em]">Cuentas a la vista</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Btn variant="ghost" size="sm" onClick={() => setPicked(null)} disabled={allOn}>Todas</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setPicked([])} disabled={chosen.length === 0}>Ninguna</Btn>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {kindAccounts.map((a) => {
            const on = ids.has(a.id);
            const col = chartColor(a.colorIdx);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(a.id)}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
                style={{
                  background: on ? `color-mix(in srgb, ${col} 18%, var(--surface-2))` : "var(--surface-2)",
                  border: `1.5px solid ${on ? col : "var(--border)"}`,
                  color: on ? "var(--text)" : "var(--muted)",
                }}
              >
                <span
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full"
                  style={{ border: `1.5px solid ${on ? col : "var(--border-strong)"}`, background: on ? col : "transparent" }}
                >
                  {on && <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--surface)" }} />}
                </span>
                {a.name}
                <span className="pv-num pv-faint text-[11px]">{formatEUR0(balanceOf(a))}</span>
              </button>
            );
          })}
        </div>
        {kindAccounts.length === 0 && (
          <p className="pv-faint text-[12px]">No hay cuentas {kind === "corriente" ? "corrientes" : "de inversión"} activas.</p>
        )}
        {chosen.length === 0 && kindAccounts.length > 0 && (
          <p className="pv-faint mt-2 text-[11.5px]">Ninguna cuenta marcada: elige al menos una para ver sus datos.</p>
        )}
      </Panel>

      <KpiGroup items={kpis} />

      <PanelGrid cols={isMobile ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-3"}>
        <Panel span="xl:col-span-2">
          <SectionTitle sub={`${formatPct(changePct(win))} · ${periodLabel(period)}`}>
            {kind === "inversion" ? "Evolución del efectivo conjunto" : "Evolución del saldo conjunto"}
          </SectionTitle>
          <TrendChart values={win} style={cs} height={isMobile ? 140 : 190} color={chartColor(0)} />
          <TimeAxis period={period} />
        </Panel>
        <Panel>
          <SectionTitle sub={periodLabel(period)}>Entradas y salidas</SectionTitle>
          <HBars
            style={cs}
            items={[{ name: "Ingresos", value: income, colorIdx: 3 }, { name: "Gastos", value: expense, colorIdx: 5 }]}
            valueLabel={formatEUR}
          />
          <div className="pv-divider my-3" />
          <div className="flex items-center justify-between">
            <span className="pv-muted text-[12px]">Resultado</span>
            <span className="pv-num text-[14px] font-bold" style={{ color: income - expense >= 0 ? "var(--pos)" : "var(--neg)" }}>
              {formatSigned(income - expense)}
            </span>
          </div>
          {split.length > 1 && (
            <>
              <div className="pv-divider my-3" />
              <p className="pv-muted mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em]">Reparto entre cuentas</p>
              <HBars style={cs} items={split} valueLabel={formatEUR0} />
            </>
          )}
        </Panel>
      </PanelGrid>

      <Panel>
        <SectionTitle sub={`${formatEUR(expense)} · ${periodLabel(period).toLowerCase()} · pulsa para ver los gastos`}>
          Gastos por categoría
        </SectionTitle>
        {expByCat.length === 0 ? (
          <p className="pv-faint py-4 text-center text-[12px]">Sin gastos con categoría en las cuentas elegidas durante el periodo.</p>
        ) : (
          <div className={`grid items-center gap-5 ${isMobile ? "grid-cols-1" : "grid-cols-[auto_minmax(0,1fr)]"}`}>
            <div className="flex justify-center">
              <Donut
                slices={expByCat.map((c) => ({ id: c.id, name: c.name, value: c.spent, colorIdx: c.colorIdx }))}
                style={cs}
                size={isMobile ? 150 : 170}
                centerLabel="Gastado"
                centerValue={formatEUR0(expense)}
                onSliceClick={(id) => typeof id === "number" && openModal({ kind: "categoryTx", categoryId: id })}
              />
            </div>
            <HBars
              style={cs}
              items={expByCat.map((c) => ({
                name: c.name,
                value: c.spent,
                colorIdx: c.colorIdx,
                sub: `${Math.round((c.spent / Math.max(expense, 1)) * 100)} %`,
                onClick: () => openModal({ kind: "categoryTx", categoryId: c.id }),
              }))}
              valueLabel={formatEUR}
            />
          </div>
        )}
      </Panel>

      <Panel pad={false}>
        <div style={{ padding: "var(--pad)" }}>
          <SectionTitle
            sub={`${inSel.length} movimientos · ${periodLabel(period).toLowerCase()}`}
            action={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <span className="pv-muted text-[10.5px] font-bold uppercase tracking-[0.1em]">Por página</span>
                <Segmented
                  options={[...PAGE_CHOICES.map((n) => ({ id: String(n), label: String(n) })), { id: "all", label: `Todos (${inSel.length})` }]}
                  value={String(pageSize)}
                  onChange={(v) => setPageSize(v === "all" ? "all" : (Number(v) as PageSize))}
                />
                <Btn
                  variant="ghost"
                  size="sm"
                  icon={<Download className="h-3.5 w-3.5" />}
                  onClick={() => openModal({ kind: "exportCsv" })}
                >
                  Exportar CSV
                </Btn>
              </div>
            }
          >
            Movimientos de las cuentas elegidas
          </SectionTitle>
        </div>
        <TxList txs={inSel} pageSize={pageSize} />
      </Panel>
    </Stack>
  );
}
