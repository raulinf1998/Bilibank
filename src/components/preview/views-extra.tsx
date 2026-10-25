"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Database, Download, Globe, KeyRound, Palette, Pencil, Plus, RefreshCw, RotateCcw, ShieldCheck, Tag, Trash2, TriangleAlert, Upload, Check, X } from "lucide-react";
import { PERIODS, holdingValue, subColor } from "@/lib/mock";
import { DATA_COLORS, DATA_COLOR_NAMES, chartColor } from "@/lib/colors";
import { iconNode } from "@/lib/icons";
import { TODAY, addDays, bucketLabels, bucketize, changePct, flowsFor, inPeriod, periodLabel, periodMonths, periodRange, periodShort, sampleAtBuckets, windowSeries } from "@/lib/series";
import { formatEUR, formatEUR0, formatFullDate, formatNum, formatPct, formatSigned, formatDate } from "@/lib/format";
import { ARCHETYPES, PALETTES, configFromArchetype, type ModeKey, type PaletteDef } from "@/lib/themes";
import { usePaletteLibrary } from "./palettes";
import { PaletteThumb } from "./palette-editor";
import { CompareBars, Donut, HBars, Sparkline, TrendChart } from "./charts";
import { HoverLayer, TipBody, TipRow } from "./hover";
import { BucketAxis, Btn, Chip, ColorPicker, IconBadge, KpiGroup, Panel, PanelGrid, PageHeader, RowList, SectionTitle, Segmented, Stack, TimeAxis } from "./primitives";
import { useArch, usePreview } from "./state";
import { PeriodBar } from "./periodbar";
import { TxList, accountSeries, catIcon, downloadFile, productSeries, useSpending, useTotals } from "./views-main";

const trend = (v: number): "up" | "down" => (v >= 0 ? "up" : "down");

/* ==================================================================
   CATEGORÍAS
================================================================== */

export function CategoriesView() {
  const { route } = usePreview();
  return route.categoryId ? <CategoryDetail id={route.categoryId} /> : <CategoriesList />;
}

function CategoriesList() {
  const { arch, isMobile } = useArch();
  const { categories, go, openModal, period, setPeriod } = usePreview();
  const sp = useSpending();
  const cs = arch.chartStyle;
  const subCount = categories.reduce((s, c) => s + c.subcategories.length, 0);
  const openCat = (id: number | string | undefined, subId?: number) => typeof id === "number" && openModal({ kind: "categoryTx", categoryId: id, subcategoryId: subId });
  const top = [...sp.byCat].sort((a, b) => b.spent - a.spent)[0];

  const kpis = [
    { label: `Gasto · ${periodShort(period)}`, value: formatEUR(sp.totalSpent), delta: sp.prevPct !== null ? formatPct(sp.prevPct) : undefined, trend: trend(-(sp.prevPct ?? 0)), colorIdx: 5, footnote: `media ${formatEUR0(sp.avgMonthly)}/mes`, pct: Math.min(100, (sp.totalSpent / Math.max(sp.income, 1)) * 100) },
    { label: `Ingresos · ${periodShort(period)}`, value: formatEUR(sp.income), colorIdx: 3, footnote: `ahorro ${formatEUR0(sp.income - sp.totalSpent)}`, pct: Math.min(100, (sp.totalSpent / Math.max(sp.income, 1)) * 100) },
    { label: "Categorías", value: String(categories.length), footnote: `${subCount} subcategorías`, colorIdx: 0, pct: 100 },
    { label: "Mayor gasto", value: top ? top.name : "—", footnote: top ? formatEUR(top.spent) : undefined, colorIdx: top?.colorIdx ?? 2, pct: top ? (top.spent / Math.max(sp.totalSpent, 1)) * 100 : 0 },
  ];

  return (
    <Stack>
      <PageHeader kicker={`${categories.length} categorías · ${subCount} subcategorías`} title="Categorías" action={
        <>
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />
          <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "category" })}>Nueva categoría</Btn>
        </>
      } />
      <KpiGroup items={kpis} />
      <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
        <Panel span="xl:col-span-2">
          <SectionTitle sub={`${periodLabel(period)} · pulsa una barra para ver sus gastos`}>Gasto por categoría</SectionTitle>
          <HBars style={cs} items={sp.byCat.map((c) => ({ name: c.name, value: c.spent, colorIdx: c.colorIdx, sub: `${Math.round((c.spent / Math.max(sp.totalSpent, 1)) * 100)} %`, onClick: () => openCat(c.id) }))} valueLabel={formatEUR} />
        </Panel>
        <Panel>
          <SectionTitle sub="Pulsa un sector para ver sus gastos">Distribución</SectionTitle>
          <div className="flex justify-center">
            <Donut slices={sp.byCat.map((c) => ({ id: c.id, name: c.name, value: Math.max(c.spent, 0.01), colorIdx: c.colorIdx }))} style={cs} size={160} centerLabel="Total" centerValue={formatEUR0(sp.totalSpent)} onSliceClick={(id) => openCat(id)} />
          </div>
        </Panel>
      </PanelGrid>

      <PanelGrid cols="grid-cols-1 xl:grid-cols-2">
        {categories.map((c) => {
          const spent = sp.byCat.find((x) => x.id === c.id)?.spent ?? 0;
          const txCount = sp.rows.filter((t) => t.categoryId === c.id).length;
          return (
            <Panel key={c.id} pad={false}>
              <div className="flex items-center gap-3" style={{ padding: "var(--pad)", paddingBottom: 8 }}>
                <IconBadge icon={catIcon(c)} colorIdx={c.colorIdx} size={36} />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => go({ page: "categorias", categoryId: c.id })} className="flex items-center gap-1 text-left">
                    <span className={`pv-display truncate text-[15px] font-semibold ${arch.surface === "brutal" ? "uppercase font-black" : ""}`} style={{ color: "var(--text)" }}>{c.name}</span>
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} />
                  </button>
                  <p className="pv-faint text-[11px]">{c.subcategories.length} subcategorías · {txCount} movimientos</p>
                </div>
                <button type="button" onClick={() => openCat(c.id)} className="pv-hit px-2 py-1 text-right" style={{ borderRadius: 8 }} title="Ver los movimientos de esta categoría">
                  <p className="pv-num text-[14px] font-bold" style={{ color: "var(--text)" }}>{formatEUR(c.kind === "ingreso" ? sp.income : spent)}</p>
                  {c.kind === "gasto" && sp.totalSpent > 0 && <span className="pv-faint pv-num text-[11px]">{Math.round((spent / sp.totalSpent) * 100)} % del gasto</span>}
                </button>
                <Btn variant="ghost" size="sm" aria="Editar categoría" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "editCategory", categoryId: c.id })} />
              </div>
              <div className={`flex flex-wrap gap-1.5 ${isMobile ? "" : ""}`} style={{ padding: "0 var(--pad) var(--pad)" }}>
                {c.subcategories.map((s) => {
                  const sSpent = Math.abs(sp.rows.filter((t) => t.subcategoryId === s.id).reduce((a, t) => a + t.amount, 0));
                  return (
                    <span key={s.id} className="inline-flex items-center">
                      <button type="button" onClick={() => openCat(c.id, s.id)} className="pv-pill inline-flex items-center gap-1.5 px-2 py-1 text-[11px]" style={{ borderRadius: arch.surface === "brutal" || arch.surface === "grid" ? 2 : undefined, border: arch.surface === "brutal" ? "2px solid var(--text)" : undefined, color: "var(--text)" }}>
                        <span style={{ color: chartColor(subColor(c, s)) }}>{iconNode(s.icon)}</span>
                        {s.name}
                        {sSpent > 0 && <span className="pv-num pv-muted">{formatEUR0(sSpent)}</span>}
                      </button>
                      <button type="button" aria-label={`Editar subcategoría ${s.name}`} title="Editar subcategoría" onClick={() => openModal({ kind: "editSubcategory", categoryId: c.id, subcategoryId: s.id })} className="grid h-6 w-6 place-items-center" style={{ color: "var(--faint)" }}>
                        <Pencil className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                <button type="button" onClick={() => openModal({ kind: "category", parentId: c.id })} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                  <Plus className="h-3 w-3" /> subcategoría
                </button>
              </div>
            </Panel>
          );
        })}
      </PanelGrid>
    </Stack>
  );
}

function CategoryDetail({ id }: { id: number }) {
  const { arch, isMobile } = useArch();
  const { categories, transactions, back, openModal, period, setPeriod } = usePreview();
  const c = categories.find((x) => x.id === id);
  if (!c) return null;
  const months = periodMonths(period);
  const rows = transactions.filter((t) => t.categoryId === id && inPeriod(t.date, period));
  const spent = Math.abs(rows.reduce((s, t) => s + t.amount, 0));
  const buckets = bucketize(period, rows, (t) => ({ a: Math.abs(t.amount) }));
  const subs = c.subcategories.map((s) => ({ ...s, spent: Math.abs(rows.filter((t) => t.subcategoryId === s.id).reduce((a, t) => a + t.amount, 0)), count: rows.filter((t) => t.subcategoryId === s.id).length }));
  const cs = arch.chartStyle;
  const income = c.kind === "ingreso";
  const topSub = [...subs].sort((a, b) => b.spent - a.spent)[0];

  const kpis = [
    { label: income ? `Ingresado · ${periodShort(period)}` : `Gastado · ${periodShort(period)}`, value: formatEUR(spent), footnote: `${rows.length} movimientos`, colorIdx: c.colorIdx, pct: 100 },
    { label: "Media mensual", value: formatEUR(spent / months), footnote: periodLabel(period).toLowerCase(), colorIdx: 1, pct: 60 },
    { label: topSub ? `Top: ${topSub.name}` : "Subcategorías", value: topSub ? formatEUR(topSub.spent) : String(c.subcategories.length), footnote: topSub ? `${topSub.count} movimientos` : undefined, colorIdx: topSub ? subColor(c, topSub) : 2, pct: topSub ? (topSub.spent / Math.max(spent, 1)) * 100 : 0 },
    { label: "Movimientos", value: String(rows.length), footnote: `${c.subcategories.length} subcategorías`, colorIdx: 3, pct: 40 },
  ];

  return (
    <Stack>
      <PageHeader onBack={back} kicker={`Categoría · ${c.subcategories.length} subcategorías`} title={c.name} action={
        <>
          <Btn variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "editCategory", categoryId: c.id })}>Editar</Btn>
          <Btn variant="ghost" icon={<Tag className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "category", parentId: c.id })}>Nueva subcategoría</Btn>
          <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "tx", categoryId: c.id })}>Nuevo movimiento</Btn>
        </>
      } />
      <KpiGroup items={kpis} />
      <PanelGrid cols="grid-cols-1 xl:grid-cols-3">
        <Panel span="xl:col-span-2">
          <SectionTitle sub={`${periodLabel(period)} · pulsa una subcategoría para ver sus movimientos`} action={<Segmented options={PERIODS} value={period} onChange={setPeriod} />}>Subcategorías</SectionTitle>
          <HBars style={cs} items={subs.map((s) => ({ name: s.name, value: s.spent, colorIdx: subColor(c, s), sub: `${s.count} mov.`, onClick: () => openModal({ kind: "categoryTx", categoryId: c.id, subcategoryId: s.id }) }))} valueLabel={formatEUR} />
        </Panel>
        <Panel>
          <SectionTitle sub={periodLabel(period)}>Tendencia</SectionTitle>
          <TrendChart values={buckets.map((b) => b.a)} style={cs} height={isMobile ? 120 : 150} color={chartColor(c.colorIdx)} />
          <BucketAxis labels={buckets.map((b) => b.label)} />
        </Panel>
      </PanelGrid>
      <Panel pad={false}>
        <div style={{ padding: "var(--pad)" }}>
          <SectionTitle sub="Edita el nombre, el icono y el color de cada subcategoría" action={<Btn variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "category", parentId: c.id })}>Añadir</Btn>}>Gestionar subcategorías</SectionTitle>
        </div>
        <RowList
          items={subs.map((s) => ({
            id: s.id,
            icon: iconNode(s.icon),
            colorIdx: subColor(c, s),
            title: s.name,
            sub: `${s.count} movimientos en el periodo`,
            value: formatEUR(s.spent),
            extra: (
              <span onClick={(e) => e.stopPropagation()}>
                <Btn variant="ghost" size="sm" aria="Editar subcategoría" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "editSubcategory", categoryId: c.id, subcategoryId: s.id })}>Editar</Btn>
              </span>
            ),
            onClick: () => openModal({ kind: "categoryTx", categoryId: c.id, subcategoryId: s.id }),
          }))}
        />
      </Panel>
      <Panel pad={false}>
        <div style={{ padding: "var(--pad)" }}>
          <SectionTitle sub={`${rows.length} movimientos · ${periodLabel(period).toLowerCase()}`}>Movimientos</SectionTitle>
        </div>
        <TxList txs={rows} limit={isMobile ? 8 : 14} fixedCategory />
      </Panel>
    </Stack>
  );
}

/* ==================================================================
   GRÁFICAS
================================================================== */

const CHART_CARDS = [
  { id: "patrimonio", label: "Evolución del patrimonio" },
  { id: "composicion", label: "Composición del patrimonio" },
  { id: "flujos", label: "Ingresos y gastos" },
  { id: "categorias", label: "Gastos por categoría" },
  { id: "ahorro", label: "Ahorro neto" },
  { id: "tasa", label: "Tasa de ahorro" },
  { id: "acumulado", label: "Gasto acumulado" },
  { id: "subcategorias", label: "Top subcategorías" },
  { id: "semana", label: "Gasto por día de la semana" },
  { id: "reparto", label: "Reparto del patrimonio" },
  { id: "ranking", label: "Ranking de cartera" },
  { id: "calor", label: "Mapa de calor" },
  { id: "cuentas", label: "Comparador de cuentas" },
] as const;
type ChartCard = (typeof CHART_CARDS)[number]["id"];
const DEFAULT_CARDS: ChartCard[] = ["patrimonio", "composicion", "flujos", "categorias", "ahorro", "ranking", "calor", "cuentas"];

export function ChartsView() {
  const { arch, isMobile } = useArch();
  const { holdings, accounts, categories, transactions, period, setPeriod, openModal } = usePreview();
  const sp = useSpending();
  const t = useTotals();
  const cs = arch.chartStyle;
  const [shown, setShown] = useState<ChartCard[]>(DEFAULT_CARDS);
  const on = (id: ChartCard) => shown.includes(id);
  const toggle = (id: ChartCard) => setShown((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const pat = windowSeries(t.pat, period);
  const flows = useMemo(() => flowsFor(period, transactions), [period, transactions]);
  const labels = bucketLabels(period);
  const invB = sampleAtBuckets(t.inv, period);
  const liqB = sampleAtBuckets(t.liq, period);
  const net = flows.map((f) => f.a - f.b);
  const openCat = (id: number | string | undefined) => typeof id === "number" && openModal({ kind: "categoryTx", categoryId: id });

  const ranking = useMemo(
    () => holdings.map((h) => ({ h, w: windowSeries(productSeries(h), period) })).map((x) => ({ ...x, pc: changePct(x.w) })).sort((a, b) => b.pc - a.pc),
    [holdings, period],
  );
  const accWin = useMemo(() => accounts.map((a) => ({ a, w: windowSeries(accountSeries(a), period) })), [accounts, period]);

  /** Gasto acumulado dentro del periodo, tramo a tramo */
  const cumulative = flows.reduce<number[]>((acc, f) => [...acc, (acc[acc.length - 1] ?? 0) + f.b], []);
  /** Tasa de ahorro por tramo (% de los ingresos que no se gastan) */
  const savingRate = flows.map((f) => (f.a > 0 ? ((f.a - f.b) / f.a) * 100 : 0));

  /** Top subcategorías del periodo */
  const topSubs = useMemo(() => {
    const acc = new Map<number, { name: string; cat: string; colorIdx: ReturnType<typeof subColor>; value: number; catId: number }>();
    for (const tx of sp.rows) {
      if (tx.amount >= 0) continue;
      const c = categories.find((x) => x.id === tx.categoryId);
      const sub = c?.subcategories.find((x) => x.id === tx.subcategoryId);
      if (!c || !sub) continue;
      const cur = acc.get(sub.id) ?? { name: sub.name, cat: c.name, colorIdx: subColor(c, sub), value: 0, catId: c.id };
      cur.value += -tx.amount;
      acc.set(sub.id, cur);
    }
    return [...acc.values()].sort((a, b) => b.value - a.value).slice(0, 8);
  }, [sp.rows, categories]);

  /** Gasto medio por día de la semana */
  const byWeekday = useMemo(() => {
    const names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const sum = new Array(7).fill(0);
    const seen = new Array(7).fill(0).map(() => new Set<string>());
    for (const tx of sp.rows) {
      if (tx.amount >= 0) continue;
      const d = (new Date(tx.date + "T12:00:00Z").getUTCDay() + 6) % 7;
      sum[d] += -tx.amount;
      seen[d].add(tx.date);
    }
    return names.map((name, i) => ({ name, value: seen[i].size ? sum[i] / seen[i].size : 0, colorIdx: i, sub: `${seen[i].size} días` }));
  }, [sp.rows]);

  /** Reparto del patrimonio por cuenta */
  const wealthSplit = useMemo(
    () => accounts.map((a) => ({ id: a.id, name: a.name, value: Math.max(a.balance, 0.01), colorIdx: a.colorIdx })).sort((a, b) => b.value - a.value),
    [accounts],
  );

  const heat = useMemo(() => {
    const spend: Record<string, number> = {};
    for (const tx of transactions) if (tx.categoryId !== 0 && tx.amount < 0) spend[tx.date] = (spend[tx.date] ?? 0) - tx.amount;
    const days = Array.from({ length: 35 }, (_, i) => addDays(TODAY, -(34 - i)));
    const max = Math.max(1, ...days.map((d) => spend[d] ?? 0));
    return Array.from({ length: 5 }, (_, w) => days.slice(w * 7, w * 7 + 7).map((d) => ({ d, amt: spend[d] ?? 0, v: ((spend[d] ?? 0) / max) * 100 })));
  }, [transactions]);
  const letters = ["D", "L", "M", "X", "J", "V", "S"];
  const hint = isMobile ? "toca" : "pasa el ratón por";

  /* ---- Creador de gráficas personalizadas ---- */
  type BuilderDataset = "patrimonio" | "ahorro" | "acumulado" | "flujos" | "composicion" | "categorias" | "subcategorias" | "reparto" | "semana";
  type BuilderType = "linea" | "barras" | "dona" | "horizontal";
  const BUILDER_DATASETS: { id: BuilderDataset; label: string; kind: "serie" | "dual" | "cat" }[] = [
    { id: "patrimonio", label: "Patrimonio en el tiempo", kind: "serie" },
    { id: "ahorro", label: "Ahorro neto", kind: "serie" },
    { id: "acumulado", label: "Gasto acumulado", kind: "serie" },
    { id: "flujos", label: "Ingresos y gastos", kind: "dual" },
    { id: "composicion", label: "Inversión frente a efectivo", kind: "dual" },
    { id: "categorias", label: "Gasto por categoría", kind: "cat" },
    { id: "subcategorias", label: "Top subcategorías", kind: "cat" },
    { id: "reparto", label: "Reparto del patrimonio", kind: "cat" },
    { id: "semana", label: "Gasto por día de la semana", kind: "cat" },
  ];
  const BUILDER_TYPES: { id: BuilderType; label: string; kinds: ("serie" | "dual" | "cat")[] }[] = [
    { id: "linea", label: "Línea / área", kinds: ["serie"] },
    { id: "barras", label: "Barras", kinds: ["serie", "dual"] },
    { id: "dona", label: "Dona", kinds: ["cat"] },
    { id: "horizontal", label: "Barras horizontales", kinds: ["cat"] },
  ];
  const [bDataset, setBDataset] = useState<BuilderDataset>("patrimonio");
  const [bType, setBType] = useState<BuilderType>("linea");
  const [customs, setCustoms] = useState<{ key: number; dataset: BuilderDataset; type: BuilderType }[]>([]);
  const bKind = BUILDER_DATASETS.find((d) => d.id === bDataset)!.kind;
  const bTypes = BUILDER_TYPES.filter((t) => t.kinds.includes(bKind));
  const pickDataset = (id: BuilderDataset) => {
    setBDataset(id);
    const kind = BUILDER_DATASETS.find((d) => d.id === id)!.kind;
    if (!BUILDER_TYPES.find((t) => t.id === bType)!.kinds.includes(kind)) {
      setBType(BUILDER_TYPES.find((t) => t.kinds.includes(kind))!.id);
    }
  };
  const sampleTo = (vals: number[], n: number) =>
    vals.length <= n || n <= 1 ? vals : Array.from({ length: n }, (_, i) => vals[Math.round((i / (n - 1)) * (vals.length - 1))]);
  const renderCustom = (dataset: BuilderDataset, type: BuilderType, h: number) => {
    const dual = dataset === "flujos" ? flows : labels.map((_, i) => ({ label: labels[i], a: invB[i], b: liqB[i] }));
    if (dataset === "patrimonio" || dataset === "ahorro" || dataset === "acumulado") {
      const vals = dataset === "patrimonio" ? pat : dataset === "ahorro" ? net : cumulative;
      if (type === "barras") {
        const pts = sampleTo(vals, labels.length);
        return (<>
          <CompareBars style={cs} height={h} groups={pts.map((v, i) => ({ label: labels[i], a: Math.max(v, 0), b: Math.max(-v, 0) }))} />
          <BucketAxis labels={labels} />
        </>);
      }
      return (<>
        <TrendChart values={vals} style={cs} height={h} />
        <TimeAxis period={period} />
      </>);
    }
    if (dataset === "flujos" || dataset === "composicion") {
      return (<>
        <CompareBars style={cs} height={h} groups={dual} />
        <BucketAxis labels={labels} />
      </>);
    }
    const cat =
      dataset === "categorias"
        ? { slices: sp.byCat.map((c) => ({ name: c.name, value: Math.max(c.spent, 0.01), colorIdx: c.colorIdx })), items: sp.byCat.map((c) => ({ name: c.name, value: c.spent, colorIdx: c.colorIdx })), center: formatEUR0(sp.totalSpent) }
        : dataset === "subcategorias"
          ? { slices: topSubs.map((x) => ({ name: x.name, value: x.value, colorIdx: x.colorIdx })), items: topSubs.map((x) => ({ name: x.name, value: x.value, colorIdx: x.colorIdx, sub: x.cat })), center: formatEUR0(topSubs.reduce((a, x) => a + x.value, 0)) }
          : dataset === "reparto"
            ? { slices: wealthSplit.map((x) => ({ name: x.name, value: x.value, colorIdx: x.colorIdx })), items: wealthSplit.map((x) => ({ name: x.name, value: x.value, colorIdx: x.colorIdx })), center: formatEUR0(wealthSplit.reduce((a, x) => a + x.value, 0)) }
            : { slices: byWeekday.map((x) => ({ name: x.name, value: x.value, colorIdx: x.colorIdx })), items: byWeekday.map((x) => ({ name: x.name, value: x.value, colorIdx: x.colorIdx, sub: x.sub })), center: formatEUR0(byWeekday.reduce((a, x) => a + x.value, 0)) };
    if (!cat.slices.length || cat.slices.every((x) => x.value <= 0)) return <p className="pv-faint py-6 text-center text-[12px]">Sin datos en el periodo seleccionado.</p>;
    return type === "dona" ? (
      <div className="flex justify-center"><Donut slices={cat.slices} style={cs} size={150} centerLabel="Total" centerValue={cat.center} /></div>
    ) : (
      <HBars style={cs} items={cat.items} valueLabel={formatEUR0} />
    );
  };
  const datasetLabel = (id: BuilderDataset) => BUILDER_DATASETS.find((d) => d.id === id)!.label;
  const typeLabel = (id: BuilderType) => BUILDER_TYPES.find((t) => t.id === id)!.label;

  return (
    <Stack>
      <PageHeader kicker={`Analítica · ${periodLabel(period)}`} title="Gráficas" />
      <PeriodBar />

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pv-muted mr-1 text-[10.5px] font-bold uppercase tracking-[0.12em]">Gráficos ({shown.length}/{CHART_CARDS.length})</span>
          {CHART_CARDS.map((c) => {
            const active = on(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(c.id)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all"
                style={{
                  background: active ? "var(--accent-soft)" : "var(--surface-2)",
                  border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  color: active ? "var(--text)" : "var(--muted)",
                  opacity: active ? 1 : 0.7,
                }}
              >
                {active && <Check className="h-3 w-3" strokeWidth={3} style={{ color: "var(--accent)" }} />}
                {c.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5">
            <Btn variant="ghost" size="sm" onClick={() => setShown(CHART_CARDS.map((c) => c.id))}>Todos</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setShown(DEFAULT_CARDS)}>Por defecto</Btn>
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionTitle sub="Elige qué mostrar y con qué tipo de gráfico. Se añade como tarjeta a tu panel." action={customs.length > 0 ? <Btn variant="ghost" size="sm" onClick={() => setCustoms([])}>Limpiar ({customs.length})</Btn> : undefined}>
          Creador de gráficas{customs.length > 0 ? ` (${customs.length})` : ""}
        </SectionTitle>
        <p className="pv-muted mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em]">Qué mostrar</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {BUILDER_DATASETS.map((d) => {
            const active = d.id === bDataset;
            return (
              <button key={d.id} type="button" aria-pressed={active} onClick={() => pickDataset(d.id)} className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all" style={{ background: active ? "var(--accent-soft)" : "var(--surface-2)", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, color: active ? "var(--text)" : "var(--muted)", opacity: active ? 1 : 0.75 }}>
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="pv-muted mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em]">Tipo de gráfico</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {bTypes.map((t) => {
            const active = t.id === bType;
            return (
              <button key={t.id} type="button" aria-pressed={active} onClick={() => setBType(t.id)} className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all" style={{ background: active ? "var(--accent)" : "var(--surface-2)", color: active ? "var(--accent-fg)" : "var(--muted)", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}` }}>
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)", border: "1px dashed var(--border-strong)" }}>
          <p className="pv-muted mb-2 text-[11px] font-semibold">Vista previa · {datasetLabel(bDataset)} · {typeLabel(bType)}</p>
          {renderCustom(bDataset, bType, isMobile ? 120 : 150)}
        </div>
        <div className="mt-3 flex justify-end">
          <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCustoms((v) => [...v, { key: Date.now() + v.length, dataset: bDataset, type: bType }])}>Añadir gráfico</Btn>
        </div>
      </Panel>

      <PanelGrid cols="grid-cols-1 xl:grid-cols-2">
        {on("patrimonio") && (
          <Panel>
            <SectionTitle sub="Suma de efectivo e inversiones" action={<Chip trend={trend(changePct(pat))}>{formatPct(changePct(pat))}</Chip>}>Evolución del patrimonio</SectionTitle>
            <HoverLayer count={pat.length} render={(i) => <TipBody head={formatFullDate(addDays(periodRange(period).to, -(pat.length - 1 - i)))}><TipRow color="var(--accent)" name="Patrimonio" value={formatEUR(pat[i])} /></TipBody>}>
              <TrendChart values={pat} style={cs} height={isMobile ? 140 : 180} />
            </HoverLayer>
            <TimeAxis period={period} />
          </Panel>
        )}

        {on("composicion") && (
          <Panel>
            <SectionTitle sub={`Inversión frente a efectivo · ${hint} una barra`}>Composición del patrimonio</SectionTitle>
            <HoverLayer
              band
              count={labels.length}
              render={(i) => (
                <TipBody head={labels[i]} foot={`Total ${formatEUR(invB[i] + liqB[i])}`}>
                  <TipRow color="var(--accent)" name="Inversión" value={formatEUR(invB[i])} sub={`${Math.round((invB[i] / Math.max(invB[i] + liqB[i], 1)) * 100)} %`} />
                  <TipRow color="var(--chart-6)" name="Efectivo" value={formatEUR(liqB[i])} />
                </TipBody>
              )}
            >
              <CompareBars style={cs} height={isMobile ? 140 : 180} groups={labels.map((l, i) => ({ label: l, a: invB[i], b: liqB[i] }))} />
            </HoverLayer>
            <BucketAxis labels={labels} />
          </Panel>
        )}

        {on("flujos") && (
          <Panel>
            <SectionTitle sub={`${hint} una barra para ver el detalle`} action={<Chip trend={trend(sp.income - sp.totalSpent)}>{formatSigned(sp.income - sp.totalSpent)}</Chip>}>Ingresos y gastos</SectionTitle>
            <HoverLayer
              band
              count={flows.length}
              render={(i) => (
                <TipBody head={flows[i].label} foot={`Ahorro ${formatSigned(flows[i].a - flows[i].b)}`}>
                  <TipRow color="var(--accent)" name="Ingresos" value={formatEUR(flows[i].a)} />
                  <TipRow color="var(--chart-6)" name="Gastos" value={formatEUR(flows[i].b)} />
                </TipBody>
              )}
            >
              <CompareBars style={cs} height={isMobile ? 140 : 180} groups={flows} />
            </HoverLayer>
            <BucketAxis labels={labels} />
          </Panel>
        )}

        {on("categorias") && (
          <Panel>
            <SectionTitle sub={`${formatEUR(sp.totalSpent)} · pulsa para ver los gastos`}>Gastos por categoría</SectionTitle>
            <div className="flex items-center gap-4">
              <Donut slices={sp.byCat.map((c) => ({ id: c.id, name: c.name, value: Math.max(c.spent, 0.01), colorIdx: c.colorIdx }))} style={cs} size={isMobile ? 132 : 150} centerLabel={periodShort(period)} centerValue={formatEUR0(sp.totalSpent)} onSliceClick={openCat} />
              <div className="min-w-0 flex-1">
                <HBars style={cs} items={sp.byCat.slice(0, 6).map((c) => ({ name: c.name, value: c.spent, colorIdx: c.colorIdx, onClick: () => openCat(c.id) }))} valueLabel={formatEUR0} />
              </div>
            </div>
          </Panel>
        )}

        {on("ahorro") && (
          <Panel>
            <SectionTitle sub="Ingresos menos gastos por tramo">Ahorro neto</SectionTitle>
            <HoverLayer
              count={net.length}
              render={(i) => (
                <TipBody head={labels[i]}>
                  <TipRow color={net[i] >= 0 ? "var(--pos)" : "var(--neg)"} name="Ahorro" value={formatSigned(net[i])} />
                  <TipRow color="var(--muted)" name="Sobre ingresos" value={flows[i].a > 0 ? `${((net[i] / flows[i].a) * 100).toFixed(0)} %` : "—"} />
                </TipBody>
              )}
            >
              <TrendChart values={net} style={cs} color="var(--chart-4)" height={isMobile ? 140 : 180} />
            </HoverLayer>
            <BucketAxis labels={labels} />
            <div className="pv-divider mt-3" />
            <div className="mt-3 flex items-center justify-between">
              <span className="pv-muted text-[11.5px]">Ahorro medio por tramo</span>
              <span className="pv-num text-[13px] font-bold" style={{ color: "var(--pos)" }}>{formatEUR(net.reduce((a, b) => a + b, 0) / Math.max(net.length, 1))}</span>
            </div>
          </Panel>
        )}

        {on("tasa") && (
          <Panel>
            <SectionTitle sub="Porcentaje de los ingresos que no se gasta">Tasa de ahorro</SectionTitle>
            <HoverLayer
              band
              count={savingRate.length}
              render={(i) => (
                <TipBody head={labels[i]}>
                  <TipRow color={savingRate[i] >= 0 ? "var(--pos)" : "var(--neg)"} name="Tasa de ahorro" value={`${savingRate[i].toFixed(0)} %`} />
                  <TipRow color="var(--muted)" name="Ingresos" value={formatEUR(flows[i].a)} />
                </TipBody>
              )}
            >
              <CompareBars style={cs} height={isMobile ? 130 : 170} groups={savingRate.map((v, i) => ({ label: labels[i], a: Math.max(v, 0), b: Math.max(-v, 0) }))} />
            </HoverLayer>
            <BucketAxis labels={labels} />
            <p className="pv-muted mt-3 text-[11.5px]">
              Media del periodo: <b className="pv-num" style={{ color: "var(--text)" }}>{(savingRate.reduce((a, b) => a + b, 0) / Math.max(savingRate.length, 1)).toFixed(0)} %</b>
            </p>
          </Panel>
        )}

        {on("acumulado") && (
          <Panel>
            <SectionTitle sub="Cuánto llevas gastado dentro del periodo">Gasto acumulado</SectionTitle>
            <HoverLayer
              count={cumulative.length}
              render={(i) => (
                <TipBody head={labels[i]} foot={`Acumulado ${formatEUR(cumulative[i])}`}>
                  <TipRow color="var(--chart-6)" name="Gasto del tramo" value={formatEUR(flows[i].b)} />
                </TipBody>
              )}
            >
              <TrendChart values={cumulative} style={cs} color="var(--chart-6)" height={isMobile ? 140 : 180} />
            </HoverLayer>
            <BucketAxis labels={labels} />
          </Panel>
        )}

        {on("subcategorias") && (
          <Panel>
            <SectionTitle sub={`Las que más gastan · ${periodLabel(period).toLowerCase()}`}>Top subcategorías</SectionTitle>
            {topSubs.length ? (
              <HBars style={cs} items={topSubs.map((x) => ({ name: x.name, value: x.value, colorIdx: x.colorIdx, sub: x.cat, onClick: () => openCat(x.catId) }))} valueLabel={formatEUR0} />
            ) : (
              <p className="pv-faint py-6 text-center text-[12px]">Sin gastos en el periodo seleccionado.</p>
            )}
          </Panel>
        )}

        {on("semana") && (
          <Panel>
            <SectionTitle sub="Gasto medio de cada día con movimientos">Gasto por día de la semana</SectionTitle>
            <HBars style={cs} items={byWeekday} valueLabel={formatEUR0} />
          </Panel>
        )}

        {on("reparto") && (
          <Panel>
            <SectionTitle sub="Peso de cada cuenta en tu patrimonio">Reparto del patrimonio</SectionTitle>
            <div className="flex items-center gap-4">
              <Donut slices={wealthSplit} style={cs} size={isMobile ? 132 : 150} centerLabel="Total" centerValue={formatEUR0(wealthSplit.reduce((s, x) => s + x.value, 0))} />
              <div className="min-w-0 flex-1">
                <HBars style={cs} items={wealthSplit.slice(0, 6).map((x) => ({ name: x.name, value: x.value, colorIdx: x.colorIdx }))} valueLabel={formatEUR0} />
              </div>
            </div>
          </Panel>
        )}

        {on("ranking") && (
          <Panel>
            <SectionTitle sub={`Rentabilidad de cada producto · ${periodLabel(period).toLowerCase()}`}>Ranking de cartera</SectionTitle>
            <div className="flex flex-col gap-2.5">
              {ranking.map(({ h, w, pc }) => (
                <div key={h.id} className="flex items-center gap-3">
                  <span className="pv-num w-16 shrink-0 truncate text-[11.5px] font-bold" style={{ color: "var(--text)" }}>{h.nickname}</span>
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden" style={{ background: "var(--surface-2)", borderRadius: arch.surface === "brutal" ? 0 : "var(--radius-pill)", border: arch.surface === "brutal" ? "2px solid var(--text)" : undefined }}>
                    <div className="h-full" style={{ width: `${Math.min(100, Math.abs(pc) * 3)}%`, background: pc >= 0 ? "var(--pos)" : "var(--neg)" }} />
                  </div>
                  <span className={`pv-num w-16 shrink-0 text-right text-[11.5px] font-bold ${pc >= 0 ? "pv-pos" : "pv-neg"}`}>{formatPct(pc)}</span>
                  {!isMobile && <Sparkline values={w} positive={pc >= 0} style={cs} width={54} height={22} />}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {on("calor") && (
          <Panel>
            <SectionTitle sub="Gasto diario de las últimas 5 semanas (independiente del periodo)">Mapa de calor</SectionTitle>
            <div className="flex flex-col gap-1.5">
              {heat.map((week, wi) => (
                <div key={wi} className="flex items-center gap-1.5">
                  <span className="pv-faint w-12 shrink-0 text-[10px]">{formatDate(week[0].d)}</span>
                  {week.map((cell) => (
                    <span key={cell.d} title={`${formatDate(cell.d)}: ${formatEUR(cell.amt)}`} className="flex h-6 flex-1 items-center justify-center text-[9.5px] font-bold" style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(cell.v * 0.9)}%, var(--surface-2))`, color: cell.v > 55 ? "var(--accent-fg)" : "var(--muted)", borderRadius: arch.surface === "brutal" || arch.surface === "grid" ? 0 : "var(--radius-sm)", border: arch.surface === "brutal" ? "1.5px solid var(--text)" : undefined }}>
                      {letters[new Date(cell.d + "T12:00:00Z").getUTCDay()]}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {on("cuentas") && (
          <Panel span="xl:col-span-2">
            <SectionTitle sub={`Variación de cada cuenta · ${periodLabel(period).toLowerCase()}`}>Comparador de cuentas</SectionTitle>
            <div className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-5"} gap-3`}>
              {accWin.map(({ a, w }) => {
                const pc = changePct(w);
                return (
                  <div key={a.id} className="min-w-0">
                    <p className="truncate text-[11px] font-semibold" style={{ color: "var(--text)" }}>{a.name}</p>
                    <Sparkline values={w} positive={pc >= 0} style={cs} width={isMobile ? 120 : 150} height={34} />
                    <p className={`pv-num text-[11px] font-bold ${pc >= 0 ? "pv-pos" : "pv-neg"}`}>{formatPct(pc)}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
        {customs.map((c) => (
          <Panel key={c.key}>
            <SectionTitle sub={`${datasetLabel(c.dataset)} · ${typeLabel(c.type)} · ${periodLabel(period).toLowerCase()}`} action={<button type="button" aria-label="Quitar gráfica personalizada" title="Quitar" onClick={() => setCustoms((v) => v.filter((x) => x.key !== c.key))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-[var(--hover)]" style={{ color: "var(--muted)", border: "1px solid var(--border)" }}><X className="h-3.5 w-3.5" /></button>}>
              Gráfica personalizada
            </SectionTitle>
            {renderCustom(c.dataset, c.type, isMobile ? 140 : 180)}
          </Panel>
        ))}
      </PanelGrid>

      {shown.length === 0 && customs.length === 0 && (
        <Panel>
          <p className="pv-faint py-8 text-center text-[12.5px]">No hay ningún gráfico seleccionado. Elige los que quieras ver en la lista de arriba.</p>
        </Panel>
      )}
    </Stack>
  );
}

/* ==================================================================
   AJUSTES
================================================================== */

function SettingRow({ icon, colorIdx, title, hint, right }: { icon: ReactNode; colorIdx: number; title: string; hint: string; right: ReactNode }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <IconBadge icon={icon} colorIdx={colorIdx} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>{title}</p>
        <p className="pv-faint truncate text-[11px]">{hint}</p>
      </div>
      {right}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange?: () => void; label: string }) {
  const { arch } = useArch();
  const brutal = arch.surface === "brutal";
  const square = arch.button === "square";
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className="relative h-5 w-9 shrink-0" style={{ borderRadius: brutal || square ? 2 : 999, background: on ? "var(--accent)" : "var(--surface-2)", border: brutal ? "2px solid var(--text)" : `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}` }}>
      <span className="absolute top-[1px] h-[14px] w-[14px]" style={{ left: on ? 18 : 2, borderRadius: brutal || square ? 1 : 999, background: on ? "var(--accent-fg)" : "var(--muted)", transition: "left .18s" }} />
    </button>
  );
}

const ACCENT_PRESETS = ["#4F8CFF", "#22D3EE", "#34D399", "#A3E635", "#FBBF24", "#FB923C", "#F43F5E", "#D946EF", "#8B5CF6", "#94A3B8"];
const SOURCE_HINT: Record<string, string> = { "Yahoo Finance": "Acciones y ETFs · última actualización hace 4 min", CoinGecko: "BTC y ETH cada 15 min", "Alpha Vantage": "Requiere clave API", Morningstar: "Fondos indexados y planes de pensiones" };

function PaletteCard({ p, active, mode, onApply, onEdit }: { p: PaletteDef; active: boolean; mode: ModeKey; onApply: () => void; onEdit?: () => void }) {
  return (
    <div className="relative">
      <button type="button" onClick={onApply} className="block w-full text-left" style={{ borderRadius: "var(--radius)", border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`, padding: 7, background: "var(--surface-2)" }}>
        <PaletteThumb palette={p} mode={mode} />
        <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--text)" }}>{active && <Check className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} strokeWidth={3} />}<span className="truncate">{p.name}</span></p>
        <p className="pv-faint truncate text-[10.5px]">{p.note}</p>
      </button>
      {onEdit && (
        <button type="button" aria-label={`Editar paleta ${p.name}`} title="Editar paleta" onClick={onEdit} className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center" style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border-strong)", borderRadius: 999 }}>
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function SettingsView() {
  const { arch, cfg, patchConfig, isMobile } = useArch();
  const { accounts, holdings, categories, transactions, sources, toggleSource, exportData, importData, resetData, openModal } = usePreview();
  const lib = usePaletteLibrary();
  const active = lib.resolve(cfg.paletteKey);
  const fileRef = useRef<HTMLInputElement>(null);

  const brutal = arch.surface === "brutal";

  const applyArchetype = (key: string) => {
    const base = configFromArchetype(key, cfg.device);
    patchConfig?.({
      ...base,
      mode: cfg.mode,
      paletteKey: cfg.paletteKey,
      accentOverride: cfg.accentOverride,
      fontKey: cfg.fontKey,
      chartStyleKey: cfg.chartStyleKey,
      radiusKey: cfg.radiusKey,
      densityKey: cfg.densityKey,
      donutKey: cfg.donutKey,
    });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    importData(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Stack>
      <PageHeader kicker="Configuración" title="Ajustes" />
      <Panel span="xl:col-span-2">
        <SectionTitle sub="Esta instalación guarda tus cambios en la base de datos del servidor y se abre desde cualquier dispositivo de tu red">
          Aplicación y servidor
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <a href="/app" className="flex flex-col gap-1 p-3 text-left" style={{ borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>Abrir aplicación</span>
            <span className="pv-faint text-[11px] leading-snug">Pantalla completa, sin el laboratorio de diseño.</span>
          </a>
          <a href="/instalacion" className="flex flex-col gap-1 p-3 text-left" style={{ borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>Guía del servidor</span>
            <span className="pv-faint text-[11px] leading-snug">Docker, Proxmox, copias de seguridad y acceso por IP.</span>
          </a>
          <a href="/laboratorio" className="flex flex-col gap-1 p-3 text-left" style={{ borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>Laboratorio de diseño</span>
            <span className="pv-faint text-[11px] leading-snug">Comparar las 6 estructuras y exportar estilos.</span>
          </a>
        </div>
      </Panel>
      <PanelGrid cols="grid-cols-1 xl:grid-cols-2">
        <Panel span="xl:col-span-2">
          <SectionTitle
            sub={`${lib.all.length} paletas (${lib.custom.length} personalizadas) · todas funcionan en modo claro y oscuro · activa: ${active?.name ?? "—"}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Segmented options={[{ id: "dark" as ModeKey, label: "Oscuro" }, { id: "light" as ModeKey, label: "Claro" }]} value={cfg.mode} onChange={(m) => patchConfig?.({ mode: m })} />
                <Btn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openModal({ kind: "paletteEditor" })}>Crear paleta</Btn>
              </div>
            }
          >
            Paleta de color
          </SectionTitle>

          {lib.custom.length > 0 && (
            <div className="mb-5">
              <p className="pv-muted mb-2 text-[11px] font-bold uppercase tracking-[0.1em]">Mis paletas</p>
              <div className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-5"} gap-3`}>
                {lib.custom.map((p) => <PaletteCard key={p.key} p={p} active={p.key === cfg.paletteKey} mode={cfg.mode} onApply={() => patchConfig?.({ paletteKey: p.key })} onEdit={() => openModal({ kind: "paletteEditor", key: p.key })} />)}
              </div>
            </div>
          )}

          <p className="pv-muted mb-2 text-[11px] font-bold uppercase tracking-[0.1em]">Paletas integradas ({PALETTES.length})</p>
          <div className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-5"} gap-3`}>
            {PALETTES.map((p) => <PaletteCard key={p.key} p={p} active={p.key === cfg.paletteKey} mode={cfg.mode} onApply={() => patchConfig?.({ paletteKey: p.key })} />)}
          </div>

          <div className="pv-divider my-5" />
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>Color de acento personalizado</p>
              <p className="pv-faint mb-3 text-[11px]">Sustituye el acento de la paleta (botones, pestañas activas, enlaces) por cualquier color.</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {ACCENT_PRESETS.map((c) => (
                  <button key={c} type="button" aria-label={`Acento ${c}`} onClick={() => patchConfig?.({ accentOverride: c })} className="h-7 w-7" style={{ background: c, borderRadius: "var(--radius-sm)", outline: cfg.accentOverride === c ? "2px solid var(--text)" : "none", outlineOffset: 2 }} />
                ))}
              </div>
              <ColorPicker hidePalette value={cfg.accentOverride ?? 0} onChange={(c) => typeof c === "string" && patchConfig?.({ accentOverride: c })} />
              <div className="mt-3">
                <Btn variant="ghost" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} disabled={!cfg.accentOverride} onClick={() => patchConfig?.({ accentOverride: null })}>Usar el acento de la paleta</Btn>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>Colores de cuentas y categorías</p>
              <p className="pv-faint mb-3 text-[11px]">
                Son fijos: <b>cambiar de paleta no altera el color de tus cuentas, categorías ni productos</b>, solo la interfaz. Cada uno admite además un color libre desde su botón «Editar».
              </p>
              <div className="grid grid-cols-6 gap-2">
                {DATA_COLORS.map((c, i) => (
                  <span key={c} title={DATA_COLOR_NAMES[i]} className="h-7" style={{ background: c, borderRadius: "var(--radius-sm)" }} />
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel span="xl:col-span-2">
          <SectionTitle sub={`${ARCHETYPES.length} estructuras · se conservan tu paleta, tu modo y tus datos`}>Estructura de la interfaz</SectionTitle>
          <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3"} gap-3`}>
            {ARCHETYPES.map((a) => {
              const active = a.key === cfg.archetypeKey;
              return (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => applyArchetype(a.key)}
                  className="p-3 text-left transition-all"
                  style={{ borderRadius: "var(--radius)", border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-soft)" : "var(--surface-2)" }}
                >
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>
                    {active && <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: "var(--accent)" }} />}
                    <span className="truncate">{a.name}</span>
                  </p>
                  <p className="pv-muted mt-0.5 text-[11px] leading-snug">{a.tagline}</p>
                  <p className="pv-faint mt-1 text-[10.5px]">{a.short}</p>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <SectionTitle sub="Preferencias de visualización">Apariencia</SectionTitle>
          <SettingRow icon={<Palette className="h-4 w-4" />} colorIdx={0} title="Tema oscuro" hint={cfg.mode === "dark" ? "Activado" : "Desactivado · usando el modo claro"} right={<Toggle on={cfg.mode === "dark"} label="Tema oscuro" onChange={() => patchConfig?.({ mode: cfg.mode === "dark" ? "light" : "dark" })} />} />
          <SettingRow icon={<Globe className="h-4 w-4" />} colorIdx={1} title="Idioma y formato" hint="Español (España) · es-ES" right={<span className="pv-num text-[12px] font-bold" style={{ color: "var(--accent)" }}>{formatEUR(1234.56)}</span>} />
          <SettingRow icon={<RefreshCw className="h-4 w-4" />} colorIdx={2} title="Divisa base" hint="Conversión diaria del BCE" right={<span className="pv-pill px-2 py-0.5 text-[11px] font-semibold">EUR €</span>} />
        </Panel>

        <Panel>
          <SectionTitle sub="Fuentes de valor liquidativo">Precios automáticos</SectionTitle>
          {Object.entries(sources).map(([name, on]) => (
            <SettingRow key={name} icon={name === "Alpha Vantage" ? <KeyRound className="h-4 w-4" /> : <Download className="h-4 w-4" />} colorIdx={on ? 3 : 1} title={name} hint={on ? SOURCE_HINT[name] ?? "Activa" : "Desactivada"} right={<Toggle on={on} label={name} onChange={() => toggleSource(name)} />} />
          ))}
        </Panel>

        <Panel>
          <SectionTitle sub="Copias de seguridad y restauración">Datos</SectionTitle>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <SettingRow icon={<ShieldCheck className="h-4 w-4" />} colorIdx={3} title="Descargar copia de seguridad" hint="Cuentas, categorías, productos y movimientos en JSON" right={<Btn variant="ghost" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadFile("mi-patrimonio-copia.json", exportData(), "application/json")}>Descargar</Btn>} />
          <SettingRow icon={<Database className="h-4 w-4" />} colorIdx={1} title="Importar / restaurar datos" hint="Carga una copia descargada desde aquí" right={<Btn variant="ghost" size="sm" icon={<Upload className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>Importar</Btn>} />
          <SettingRow icon={<RotateCcw className="h-4 w-4" />} colorIdx={4} title="Restablecer datos de ejemplo" hint="Vuelve a las 10 cuentas, 8 categorías y 10 productos iniciales" right={<Btn variant="ghost" size="sm" onClick={resetData}>Restablecer</Btn>} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] pv-muted">
            <span>{accounts.length} cuentas</span><span>{holdings.length} productos</span>
            <span>{categories.length} categorías</span><span>{formatNum(transactions.length)} movimientos</span>
          </div>
        </Panel>

        <Panel tone={brutal ? 10 : undefined}>
          <SectionTitle sub="Acciones irreversibles">Zona sensible</SectionTitle>
          <div className="flex items-center gap-3" style={{ padding: 12, background: brutal ? "transparent" : "var(--neg-soft)", border: `${brutal ? 2 : 1}px solid ${brutal ? "var(--text)" : "var(--neg)"}`, borderRadius: brutal || arch.surface === "grid" ? 0 : "var(--radius)" }}>
            <IconBadge icon={<TriangleAlert className="h-4 w-4" />} colorIdx={10} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>Borrar todos los movimientos</p>
              <p className="text-[11px]" style={{ color: "var(--neg)" }}>Se conservan cuentas y productos · {formatNum(transactions.length)} registros</p>
            </div>
            <Btn variant="danger" size="sm" icon={<Trash2 className="h-3 w-3" />} onClick={() => openModal({ kind: "confirmClear" })} disabled={transactions.length === 0}>Borrar</Btn>
          </div>
        </Panel>
      </PanelGrid>
    </Stack>
  );
}

export { holdingValue };
