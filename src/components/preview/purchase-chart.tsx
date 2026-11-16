"use client";

/*
   Gráfica de precio de un producto con las COMPRAS marcadas.

   Cada compra se dibuja como un punto sobre la curva; al pasar el ratón (o al
   tocarla en el móvil) se abre una ficha con lo que costó esa compra y lo que
   lleva ganado SOLO con ella:

     invertido = participaciones × precio de compra + comisiones
     valor hoy = participaciones × precio actual del producto
     ganancia  = valor hoy − invertido

   Los puntos se colocan con MUY POCA tolerancia al error: se reutiliza el mismo
   `downsample` y la misma escala vertical que `TrendChart`, y la altura se
   interpola sobre la polilínea realmente dibujada, así que el punto queda
   siempre pegado a la línea (no «flotando» por los lados).

   Interacción:
   · ratón encima → ficha; sale → se cierra
   · clic (o toque) en un punto → ficha fijada; otro clic en el mismo punto o un
     clic en cualquier otro sitio → se cierra
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { chartColor } from "@/lib/colors";
import { formatEUR, formatFullDate, formatNum, formatSigned } from "@/lib/format";
import type { Holding, Operation } from "@/lib/mock";
import { daysBetween, periodRange } from "@/lib/series";
import type { ChartStyleKey } from "@/lib/themes";
import { TrendChart, downsample, trendCurveAt } from "./charts";
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

/**
 * Coordenadas (0–1) del marcador de una compra sobre la curva dibujada.
 * La X es la fecha exacta de la compra dentro del periodo y la Y se toma de la
 * propia curva que dibuja `TrendChart` (recta, escalón, curva suave o barra),
 * así que el punto queda siempre sobre la línea.
 */
export function markerPosition(series: number[], style: ChartStyleKey, rawIndex: number): { x: number; y: number } | null {
  const len = series.length;
  if (len < 2) return null;
  const i = Math.max(0, Math.min(len - 1, rawIndex));
  let x = i / (len - 1);

  /* Barras: cada barra ocupa su columna, así que el punto se centra en el
     vértice (la barra) más cercano y no en un hueco entre dos barras. */
  if (style === "solid" || style === "brutal") {
    const shown = downsample(series, style);
    if (shown.length >= 2) {
      const v = Math.round(x * (shown.length - 1));
      x = v / (shown.length - 1);
    }
  }

  const y = trendCurveAt(series, style, x);
  return y === null ? null : { x, y };
}

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
  const wrapRef = useRef<HTMLDivElement>(null);
  /* Tras cerrar una ficha con clic no debe reaparecer por seguir encima del punto. */
  const muted = useRef(false);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);

  const points = useMemo(() => purchasePoints(holding, period, series), [holding, period, series]);
  const visible = points.filter((p) => p.index !== null);

  const position = (rawIndex: number) => markerPosition(series, style, rawIndex) ?? { x: 0, y: 0.5 };

  /* Clic en cualquier otro sitio (dentro o fuera del gráfico) cierra la ficha. */
  useEffect(() => {
    if (pinned === null) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-purchase-dot]")) return;
      setPinned(null);
      muted.current = true;
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [pinned]);

  const shownId = pinned ?? hover;
  const shownPoint = shownId !== null ? visible.find((p) => p.op.id === shownId) ?? null : null;
  const shownPos = shownPoint && shownPoint.index !== null ? position(shownPoint.index) : null;
  const shownX = shownPos ? shownPos.x * 100 : 0;
  const shownY = shownPos ? shownPos.y * 100 : 0;

  /* La ficha se abre hacia el lado con más sitio y hacia arriba salvo que el punto esté alto. */
  const flipX = shownX > 62;
  const below = shownY < 42;

  const toggle = (id: number) => {
    if (pinned === id) {
      setPinned(null);
      setHover(null);
      muted.current = true;
    } else {
      setPinned(id);
      muted.current = false;
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <TrendChart values={series} style={style} height={height} color={color} />

      {series.length > 1 &&
        visible.map((p) => {
          if (p.index === null) return null;
          const { x, y } = position(p.index);
          const isOn = shownId === p.op.id;
          const isPinned = pinned === p.op.id;
          return (
            <button
              key={p.op.id}
              type="button"
              data-purchase-dot
              aria-label={`Compra del ${formatFullDate(p.date)}: invertido ${formatEUR(p.invested)}, ganancia ${formatSigned(p.gain)}`}
              aria-pressed={isPinned}
              title={`Compra del ${formatFullDate(p.date)}`}
              onPointerEnter={() => {
                if (!muted.current) setHover(p.op.id);
              }}
              onPointerLeave={() => {
                muted.current = false;
                setHover(null);
              }}
              onFocus={() => {
                if (!muted.current) setHover(p.op.id);
              }}
              onBlur={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                toggle(p.op.id);
              }}
              className="absolute grid place-items-center"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: "translate(-50%, -50%)",
                width: 24,
                height: 24,
                cursor: "pointer",
                zIndex: isOn ? 30 : 10,
              }}
            >
              <span
                aria-hidden
                className="grid place-items-center transition-all"
                style={{
                  width: isOn ? 14 : 10,
                  height: isOn ? 14 : 10,
                  borderRadius: 999,
                  background: isOn ? "var(--pos)" : "var(--bg)",
                  border: "2px solid var(--pos)",
                  boxShadow: isOn ? "0 0 0 4px color-mix(in srgb, var(--pos) 26%, transparent)" : "0 1px 3px rgba(0,0,0,.45)",
                }}
              />
            </button>
          );
        })}

      {shownPoint && shownPos && (
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
          {pinned !== null ? " Toca el mismo punto o fuera de él para cerrar la ficha." : ""}
        </p>
      )}
      <p className="sr-only">
        {visible.map((p) => `${formatFullDate(p.date)}: ${formatEUR(p.invested)} invertidos, ${formatSigned(p.gain)} de ganancia.`).join(" ")}
      </p>
    </div>
  );
}
