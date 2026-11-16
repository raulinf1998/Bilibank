"use client";

/*
   Gráfica de precio de un producto con las COMPRAS marcadas.

   Cada compra se dibuja como un punto sobre la curva; al pasar el ratón (o al
   tocarla en el móvil) se abre una ficha con lo que costó esa compra y lo que
   lleva ganado SOLO con ella:

     invertido = participaciones × precio de compra + comisiones
     valor hoy = participaciones × precio actual del producto
     ganancia  = valor hoy − invertido

   El punto se coloca sobre la curva usando la misma escala que `TrendChart`
   (mismo downsample, mismo margen vertical), así que queda pegado a la línea.
*/

import { useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { chartColor } from "@/lib/colors";
import { formatEUR, formatFullDate, formatNum, formatSigned } from "@/lib/format";
import type { Holding, Operation } from "@/lib/mock";
import { daysBetween, periodRange } from "@/lib/series";
import { TrendChart, downsample } from "./charts";
import { useArch } from "./state";

/** Métricas de una compra concreta con el precio actual del producto. */
export interface PurchasePoint {
  op: Operation;
  date: string;
  /** Índice dentro de la serie visible (null si la compra cae fuera del periodo) */
  index: number | null;
  invested: number;
  currentValue: number;
  gain: number;
  gainPct: number;
}

export function purchasePoints(h: Holding, period: string, series: number[]): PurchasePoint[] {
  const { from, to } = periodRange(period);
  const len = series.length;
  const points = h.operations
    .filter((op) => op.type === "compra")
    .map((op) => {
      const invested = op.units * op.price + op.fees;
      const currentValue = op.units * h.price;
      const gain = currentValue - invested;
      const index = op.date >= from && op.date <= to ? len - 1 - daysBetween(op.date, to) : null;
      return {
        op,
        date: op.date,
        index: index !== null && index >= 0 && index < len ? index : null,
        invested,
        currentValue,
        gain,
        gainPct: invested > 0 ? (gain / invested) * 100 : 0,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.op.id - b.op.id));
  return points;
}

const PAD_Y = 0.12; // mismo margen vertical que `scale()` en charts.tsx

export function PriceChartWithPurchases({
  holding,
  series,
  period,
  height,
}: {
  holding: Holding;
  series: number[];
  period: string;
  height: number;
}) {
  const { arch } = useArch();
  const style = arch.chartStyle;
  const color = chartColor(holding.colorIdx);
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);

  const points = useMemo(() => purchasePoints(holding, period, series), [holding, period, series]);
  const visible = points.filter((p) => p.index !== null);

  /* Misma escala que usa el gráfico para dibujar la curva (mismo downsample). */
  const bounds = useMemo(() => {
    const shown = downsample(series, style);
    const min = Math.min(...shown);
    const max = Math.max(...shown);
    return { min, max, span: max - min || 1 };
  }, [series, style]);

  const yFrac = (value: number) => {
    const clamped = Math.min(bounds.max, Math.max(bounds.min, value));
    return PAD_Y + (1 - (clamped - bounds.min) / bounds.span) * (1 - PAD_Y * 2);
  };

  const shownIndex = pinned ?? active;
  const shownPoint = shownIndex !== null ? visible.find((p) => p.op.id === shownIndex) ?? null : null;
  const shownX = shownPoint && shownPoint.index !== null ? (shownPoint.index / Math.max(1, series.length - 1)) * 100 : 0;
  const shownY = shownPoint && shownPoint.index !== null ? yFrac(series[shownPoint.index]) * 100 : 0;

  /* La ficha se abre hacia el lado con más sitio y hacia arriba salvo que el punto esté alto. */
  const flipX = shownX > 62;
  const below = shownY < 42;

  return (
    <div className="relative">
      <TrendChart values={series} style={style} height={height} color={color} />

      {series.length > 1 &&
        visible.map((p) => {
          if (p.index === null) return null;
          const x = (p.index / (series.length - 1)) * 100;
          const y = yFrac(series[p.index]) * 100;
          const isOn = shownIndex === p.op.id;
          const isPinned = pinned === p.op.id;
          return (
            <button
              key={p.op.id}
              type="button"
              aria-label={`Compra del ${formatFullDate(p.date)}: invertido ${formatEUR(p.invested)}, ganancia ${formatSigned(p.gain)}`}
              aria-pressed={isPinned}
              title={`Compra del ${formatFullDate(p.date)}`}
              onMouseEnter={() => setActive(p.op.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(p.op.id)}
              onBlur={() => setActive(null)}
              onClick={(e) => {
                e.stopPropagation();
                setPinned(pinned === p.op.id ? null : p.op.id);
              }}
              className="absolute grid place-items-center"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%, -50%)",
                width: 26,
                height: 26,
                cursor: "pointer",
                zIndex: isOn ? 30 : 10,
              }}
            >
              <span
                aria-hidden
                className="grid place-items-center transition-transform"
                style={{
                  width: isOn ? 15 : 11,
                  height: isOn ? 15 : 11,
                  borderRadius: 999,
                  background: isOn ? "var(--pos)" : "var(--bg)",
                  border: `2px solid ${isOn ? "var(--pos)" : "var(--pos)"}`,
                  boxShadow: isOn ? "0 0 0 4px color-mix(in srgb, var(--pos) 26%, transparent)" : "0 1px 3px rgba(0,0,0,.45)",
                }}
              />
            </button>
          );
        })}

      {shownPoint && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-40"
          style={{
            left: `${shownX}%`,
            top: `${shownY}%`,
            transform: `translate(${flipX ? "calc(-100% - 12px)" : "12px"}, ${below ? "12px" : "calc(-100% - 12px)"})`,
            minWidth: 214,
            padding: "10px 12px",
            background: "color-mix(in srgb, var(--bg) 94%, transparent)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius)",
            boxShadow: "0 18px 40px -16px rgba(0,0,0,.6)",
          }}
        >
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--pos)" }}>
            <ShoppingCart className="h-3 w-3" /> Compra · {formatFullDate(shownPoint.date)}
          </p>
          <p className="pv-faint mt-1 text-[11px]">
            {formatNum(shownPoint.op.units)} participaciones a {formatNum(shownPoint.op.price)} €
            {shownPoint.op.fees > 0 ? ` · ${formatNum(shownPoint.op.fees)} € comisión` : ""}
          </p>
          <div className="mt-2 flex flex-col gap-1 text-[11.5px]">
            <span className="flex items-baseline justify-between gap-3">
              <span className="pv-muted">Invertido</span>
              <b className="pv-num" style={{ color: "var(--text)" }}>{formatEUR(shownPoint.invested)}</b>
            </span>
            <span className="flex items-baseline justify-between gap-3">
              <span className="pv-muted">Valor hoy</span>
              <b className="pv-num" style={{ color: "var(--text)" }}>{formatEUR(shownPoint.currentValue)}</b>
            </span>
            <span className="flex items-baseline justify-between gap-3">
              <span className="pv-muted">{shownPoint.gain >= 0 ? "Ganado" : "Perdido"} con esta compra</span>
              <b className="pv-num" style={{ color: shownPoint.gain >= 0 ? "var(--pos)" : "var(--neg)" }}>
                {formatSigned(shownPoint.gain)} ({shownPoint.gain >= 0 ? "+" : ""}{formatNum(shownPoint.gainPct)} %)
              </b>
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] pv-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4" style={{ background: color }} /> Precio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ border: "2px solid var(--pos)" }} /> Compras ({visible.length})
        </span>
        <span className="pv-num">
          Mín. {formatNum(Math.min(...series))} · Máx. {formatNum(Math.max(...series))}
        </span>
        {visible.length === 0 && points.length > 0 && (
          <span className="pv-faint">Ninguna compra en este periodo</span>
        )}
      </div>
      {visible.length > 0 && (
        <p className="pv-faint mt-1 text-[10.5px]">
          Pasa el ratón por un punto (o tócalo) para ver lo invertido y lo ganado con esa compra.
          {pinned !== null ? " Toca otra vez para cerrar la ficha." : ""}
        </p>
      )}
      <p className="sr-only">
        {visible.map((p) => `${formatFullDate(p.date)}: ${formatEUR(p.invested)} invertidos, ${formatSigned(p.gain)} de ganancia.`).join(" ")}
      </p>
    </div>
  );
}
