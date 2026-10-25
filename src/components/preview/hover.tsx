"use client";

import { useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";

/**
 * Capa que sigue al ratón sobre un gráfico temporal y muestra, en una ventana flotante,
 * los datos del punto más cercano. `count` es el número de días (o puntos) de la serie original.
 */
export function HoverLayer({
  count,
  render,
  children,
  band = false,
}: {
  count: number;
  render: (idx: number) => ReactNode;
  children: ReactNode;
  /** true: el gráfico son bandas (barras); false: puntos de una serie */
  band?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ idx: number; frac: number } | null>(null);

  const update = (clientX: number) => {
    const el = ref.current;
    if (!el || count < 1) return;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(r.width, 1)));
    const idx = band
      ? Math.min(count - 1, Math.floor(frac * count))
      : Math.round(frac * Math.max(1, count - 1));
    setPos({ idx, frac: band ? (idx + 0.5) / count : frac });
  };

  const left = pos ? pos.frac * 100 : 0;
  const flip = pos ? pos.frac > 0.6 : false;

  return (
    <div
      ref={ref}
      className="relative touch-pan-y"
      onMouseMove={(e: MouseEvent<HTMLDivElement>) => update(e.clientX)}
      onMouseLeave={() => setPos(null)}
      onTouchStart={(e: TouchEvent<HTMLDivElement>) => update(e.touches[0].clientX)}
      onTouchMove={(e: TouchEvent<HTMLDivElement>) => update(e.touches[0].clientX)}
      onTouchEnd={() => setPos(null)}
    >
      {children}
      {pos && (
        <>
          {band ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0"
              style={{ left: `${(pos.idx / count) * 100}%`, width: `${100 / count}%`, background: "var(--hover)", borderRadius: 6 }}
            />
          ) : (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px" style={{ left: `${left}%`, background: "var(--text)", opacity: 0.3 }} />
          )}
          <div
            className="pointer-events-none absolute top-1 z-20"
            style={{
              left: `${left}%`,
              transform: flip ? "translateX(calc(-100% - 14px))" : "translateX(14px)",
              minWidth: 200,
              maxWidth: 260,
              padding: "10px 12px",
              background: "color-mix(in srgb, var(--bg) 92%, transparent)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              color: "var(--text)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius)",
              boxShadow: "0 18px 40px -16px rgba(0,0,0,.6)",
            }}
          >
            {render(pos.idx)}
          </div>
        </>
      )}
    </div>
  );
}

export function TipBody({ head, foot, children }: { head: string; foot?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="pv-muted text-[10.5px] font-bold uppercase tracking-[0.1em]">{head}</p>
      <div className="flex flex-col gap-1">{children}</div>
      {foot && <p className="pv-num mt-1 border-t pt-1.5 text-[11.5px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{foot}</p>}
    </div>
  );
}

export function TipRow({ color, name, value, sub }: { color: string; name: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[12px]">
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0" style={{ background: color, borderRadius: 3 }} />
        <span className="truncate" style={{ color: "var(--text)" }}>{name}</span>
      </span>
      <span className="pv-num shrink-0 font-semibold" style={{ color: "var(--text)" }}>
        {value}
        {sub && <span className="pv-faint ml-1.5 font-normal">{sub}</span>}
      </span>
    </div>
  );
}
