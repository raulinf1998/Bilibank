import { useId } from "react";
import { chartColor, type ColorRef } from "@/lib/colors";
import type { ChartStyleKey } from "@/lib/themes";

/* ------------------------------------------------------------------
   Helpers geométricos
------------------------------------------------------------------ */

export interface Pt {
  x: number;
  y: number;
}

function scale(values: number[], w: number, h: number, padY = 0.12): Pt[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const top = h * padY;
  const bottom = h - h * padY;
  return values.map((v, i) => ({
    x: values.length === 1 ? w / 2 : (i / (values.length - 1)) * w,
    y: bottom - ((v - min) / span) * (bottom - top),
  }));
}

function linePath(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/** Curva suave tipo Catmull-Rom -> Bézier (equivalente a monotoneX de Recharts) */
function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export function downsample(v: number[], style: string, capOverride?: number): number[] {
  const cap = capOverride ?? (style === "solid" || style === "brutal" ? 36 : style === "tech" ? 48 : 150);
  if (v.length <= cap) return v;
  const out: number[] = [];
  for (let i = 0; i < cap; i++) out.push(v[Math.round((i / (cap - 1)) * (v.length - 1))]);
  return out;
}

function stepPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const mid = (pts[i - 1].x + pts[i].x) / 2;
    d += ` H${mid.toFixed(2)} V${pts[i].y.toFixed(2)}`;
  }
  d += ` H${pts[pts.length - 1].x.toFixed(2)}`;
  return d;
}

function areaPath(path: string, w: number, h: number): string {
  return `${path} L${w},${h} L0,${h} Z`;
}

/* ------------------------------------------------------------------
   Gráfica de tendencia (patrimonio / evolución de producto)
------------------------------------------------------------------ */

export function TrendChart({
  values: rawValues,
  style,
  height = 190,
  color = "var(--accent)",
  showGrid = true,
  className = "",
}: {
  values: number[];
  style: ChartStyleKey;
  height?: number;
  color?: string;
  showGrid?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const W = 600;
  const H = 200;
  const values = downsample(rawValues, style);
  const pts = scale(values, W, H);
  const smooth = style === "gradient" || style === "neon" || style === "glass";
  const path = style === "step" ? stepPath(pts) : smooth ? smoothPath(pts) : linePath(pts);
  const last = pts[pts.length - 1];

  const gridLines = showGrid && style !== "minimal" ? (style === "step" ? [0.2, 0.4, 0.6, 0.8] : [0.25, 0.5, 0.75]) : [];
  const dash = style === "tech" || style === "step" ? "3 5" : undefined;

  if (style === "brutal") {
    const bw = (W / values.length) * 0.6;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} style={{ height, width: "100%", display: "block", overflow: "visible" }}>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--text)" strokeOpacity={0.18} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {pts.map((p, i) => (
          <rect key={i} className="pv-bar-grow" x={p.x - bw / 2} y={p.y} width={bw} height={Math.max(2, H - p.y)} fill={i === pts.length - 1 ? color : "var(--accent-soft)"} stroke="var(--text)" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ animationDelay: `${i * 32}ms` }} />
        ))}
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--text)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  if (style === "solid") {
    const bw = (W / values.length) * 0.52;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} style={{ height, width: "100%", display: "block", overflow: "visible" }}>
        {gridLines.map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {pts.map((p, i) => (
          <rect
            key={i}
            className="pv-bar-grow"
            x={p.x - bw / 2}
            y={p.y}
            width={bw}
            height={Math.max(2, H - p.y)}
            rx={bw * 0.28}
            fill={color}
            opacity={0.35 + (i / Math.max(1, pts.length - 1)) * 0.65}
            style={{ animationDelay: `${i * 32}ms` }}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    );
  }

  const strokeW = style === "minimal" ? 1.6 : style === "tech" || style === "step" ? 1.5 : 2.2;
  const fillOpacity = style === "glass" ? 0.34 : style === "neon" ? 0.55 : 0.42;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} style={{ height, width: "100%", display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="55%" stopColor={color} stopOpacity={fillOpacity * 0.32} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <filter id={`glow-${uid}`} x="-30%" y="-60%" width="160%" height="240%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {gridLines.map((g) => (
        <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray={dash} vectorEffect="non-scaling-stroke" opacity={0.6} />
      ))}

      {style !== "minimal" && style !== "step" && <path d={areaPath(path, W, H)} fill={`url(#g-${uid})`} />}
      {style === "step" && <path d={areaPath(path, W, H)} fill={color} opacity={0.08} />}
      {style === "minimal" && (
        <path d={areaPath(path, W, H)} fill={color} opacity={0.05} />
      )}

      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="pv-line-draw"
        style={{ ["--dash" as string]: "2000", filter: style === "neon" ? `url(#glow-${uid})` : undefined }}
      />

      {style === "step" && (
        <>
          <line x1={0} x2={W} y1={last.y} y2={last.y} stroke={color} strokeWidth={1} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" opacity={0.7} />
          <rect x={W - 2} y={last.y - 7} width={4} height={14} fill={color} />
        </>
      )}
      {style === "tech" &&
        pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="var(--bg)" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        ))}

      {(style === "minimal" || style === "glass") && (
        <circle cx={last.x} cy={last.y} r={3.6} fill={color} stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      )}
      {style === "neon" && (
        <circle cx={last.x} cy={last.y} r={4} fill={color} filter={`url(#glow-${uid})`} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------
   Barras agrupadas (ingresos vs gastos)
------------------------------------------------------------------ */

export function CompareBars({
  groups,
  style,
  height = 170,
}: {
  groups: { label: string; a: number; b: number }[];
  style: ChartStyleKey;
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const W = 600;
  const H = 200;
  const max = Math.max(1, ...groups.flatMap((g) => [g.a, g.b])) * 1.12;
  const slot = W / groups.length;
  const bw = Math.min(slot * (style === "minimal" ? 0.18 : style === "brutal" ? 0.3 : 0.26), 26);
  const round = style === "tech" || style === "step" || style === "brutal" ? 0 : style === "minimal" ? 1 : bw * 0.34;
  const flat = style === "solid" || style === "minimal" || style === "tech" || style === "step" || style === "brutal";
  const outline = style === "brutal" ? { stroke: "var(--text)", strokeWidth: 2 } : {};

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height, width: "100%", display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`ba-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={style === "neon" || style === "gradient" ? 1 : 0.9} />
          <stop offset="100%" stopColor="var(--accent-2)" stopOpacity={style === "glass" ? 0.5 : 0.72} />
        </linearGradient>
        <linearGradient id={`bb-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-6)" stopOpacity={0.75} />
          <stop offset="100%" stopColor="var(--chart-6)" stopOpacity={0.32} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--border)" strokeWidth={1} strokeDasharray={style === "tech" || style === "step" ? "3 5" : undefined} vectorEffect="non-scaling-stroke" />
      ))}
      {groups.map((grp, i) => {
        const cx = slot * i + slot / 2;
        const ha = (grp.a / max) * (H - 16);
        const hb = (grp.b / max) * (H - 16);
        const fillA = flat ? "var(--accent)" : `url(#ba-${uid})`;
        const fillB = flat ? "var(--chart-6)" : `url(#bb-${uid})`;
        return (
          <g key={grp.label}>
            <rect className="pv-bar-grow" x={cx - bw - 3} y={H - ha} width={bw} height={ha} rx={round} fill={fillA} {...outline} vectorEffect="non-scaling-stroke" style={{ animationDelay: `${i * 40}ms` }} />
            <rect className="pv-bar-grow" x={cx + 3} y={H - hb} width={bw} height={hb} rx={round} fill={fillB} {...outline} vectorEffect="non-scaling-stroke" opacity={style === "minimal" ? 0.55 : 0.9} style={{ animationDelay: `${i * 40 + 20}ms` }} />
          </g>
        );
      })}
      <line x1={0} x2={W} y1={H} y2={H} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------------
   Donut (gastos por categoría / distribución de cartera)
------------------------------------------------------------------ */

const D_OUT = 63;
const D_IN = 49;
const D_CORNER = 2.0;
const D_GAP = 0.016; // separación mínima (~0,9°) entre categorías

function roundedSector(a0: number, a1: number, rOut: number, rIn: number, corner: number): string {
  const span = a1 - a0;
  if (span <= 0.005) return "";
  const rc = Math.max(0.2, Math.min(corner, (rOut - rIn) / 2 - 0.4, span * rIn * 0.25));
  const dO = Math.asin(Math.min(0.9, rc / (rOut - rc)));
  const dI = Math.asin(Math.min(0.9, rc / (rIn + rc)));

  if (span - 2 * dO <= 0.005 || span - 2 * dI <= 0.005) {
    const P0 = [70 + rOut * Math.sin(a0), 70 - rOut * Math.cos(a0)];
    const P1 = [70 + rOut * Math.sin(a1), 70 - rOut * Math.cos(a1)];
    const P2 = [70 + rIn * Math.sin(a1), 70 - rIn * Math.cos(a1)];
    const P3 = [70 + rIn * Math.sin(a0), 70 - rIn * Math.cos(a0)];
    return `M${P0[0].toFixed(2)} ${P0[1].toFixed(2)} A${rOut} ${rOut} 0 0 1 ${P1[0].toFixed(2)} ${P1[1].toFixed(2)} L${P2[0].toFixed(2)} ${P2[1].toFixed(2)} A${rIn} ${rIn} 0 0 0 ${P3[0].toFixed(2)} ${P3[1].toFixed(2)} Z`;
  }

  const footO = Math.sqrt(Math.max(0, (rOut - rc) ** 2 - rc ** 2));
  const footI = Math.sqrt(Math.max(0, (rIn + rc) ** 2 - rc ** 2));
  const P = (a: number, r: number): [number, number] => [70 + r * Math.sin(a), 70 - r * Math.cos(a)];
  const f = (n: number) => n.toFixed(2);
  const [ax, ay] = P(a0 + dO, rOut);
  const [bx, by] = P(a1 - dO, rOut);
  const [cx, cy] = P(a1, footO);
  const [dx, dy] = P(a1, footI);
  const [ex, ey] = P(a1 - dI, rIn);
  const [gx, gy] = P(a0 + dI, rIn);
  const [hx, hy] = P(a0, footI);
  const [ix, iy] = P(a0, footO);
  const large = span - 2 * dO > Math.PI ? 1 : 0;
  return [
    `M${f(ax)} ${f(ay)}`,
    `A${rOut} ${rOut} 0 ${large} 1 ${f(bx)} ${f(by)}`,
    `A${rc.toFixed(2)} ${rc.toFixed(2)} 0 0 1 ${f(cx)} ${f(cy)}`,
    `L${f(dx)} ${f(dy)}`,
    `A${rc.toFixed(2)} ${rc.toFixed(2)} 0 0 1 ${f(ex)} ${f(ey)}`,
    `A${rIn} ${rIn} 0 ${large} 0 ${f(gx)} ${f(gy)}`,
    `A${rc.toFixed(2)} ${rc.toFixed(2)} 0 0 1 ${f(hx)} ${f(hy)}`,
    `L${f(ix)} ${f(iy)}`,
    `A${rc.toFixed(2)} ${rc.toFixed(2)} 0 0 1 ${f(ax)} ${f(ay)}`,
    "Z",
  ].join(" ");
}

export function Donut({
  slices,
  style,
  size = 168,
  centerLabel,
  centerValue,
  onSliceClick,
}: {
  slices: { name: string; value: number; colorIdx: ColorRef; id?: number | string }[];
  style: ChartStyleKey;
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  onSliceClick?: (id: number | string | undefined, name: string) => void;
}) {
  const total = slices.reduce((sum, x) => sum + Math.max(0, x.value), 0) || 1;
  const glow = style === "minimal" ? 0 : style === "glass" ? 0.28 : style === "neon" ? 0.22 : 0.16;
  const blur = style === "neon" ? 1.4 : 1.0;
  const bounds = slices.reduce<number[]>((list, x) => [...list, (list[list.length - 1] ?? 0) + Math.max(0, x.value)], [0]);
  const segs = slices.map((x, i) => {
    const a0 = (bounds[i] / total) * 2 * Math.PI + D_GAP / 2;
    const a1 = (bounds[i + 1] / total) * 2 * Math.PI - D_GAP / 2;
    return { x, d: roundedSector(a0, a1, D_OUT, D_IN, D_CORNER) };
  });
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 140 140" style={{ width: size, height: size, overflow: "visible" }}>
        <circle cx={70} cy={70} r={(D_OUT + D_IN) / 2} fill="none" stroke="var(--border)" strokeWidth={D_OUT - D_IN} opacity={0.25} />
        {glow > 0 && (
          <g opacity={glow} style={{ filter: `blur(${blur}px)` }}>
            {segs.map(({ x, d }, i) => (d ? <path key={`g${i}`} d={d} fill={chartColor(x.colorIdx)} /> : null))}
          </g>
        )}
        {segs.map(({ x, d }, i) =>
          d ? (
            <path
              key={`${x.name}-${i}`}
              d={d}
              fill={chartColor(x.colorIdx)}
              className="pv-slice"
              onClick={onSliceClick ? () => onSliceClick(x.id, x.name) : undefined}
              style={onSliceClick ? { cursor: "pointer" } : undefined}
            >
              <title>{`${x.name}: ${Math.round((x.value / total) * 100)} %`}</title>
            </path>
          ) : null,
        )}
      </svg>
      {(centerValue || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerValue && <span className="pv-num text-[15px] font-bold" style={{ color: "var(--text)" }}>{centerValue}</span>}
          {centerLabel && <span className="pv-muted text-[10px] uppercase tracking-[0.14em]">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Sparkline para tablas
------------------------------------------------------------------ */

export function Sparkline({
  values,
  positive,
  style,
  width = 88,
  height = 28,
  color: colorOverride,
}: {
  values: number[];
  positive: boolean;
  style: ChartStyleKey;
  width?: number;
  height?: number;
  color?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const pts = scale(downsample(values, "gradient", 40), width, height, 0.18);
  const smooth = style !== "tech" && style !== "minimal" && style !== "step" && style !== "brutal";
  const d = style === "step" ? stepPath(pts) : smooth ? smoothPath(pts) : linePath(pts);
  const color = colorOverride ?? (positive ? "var(--pos)" : "var(--neg)");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`sp-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.32} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {style !== "minimal" && style !== "tech" && style !== "step" && <path d={areaPath(d, width, height)} fill={`url(#sp-${uid})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={style === "tech" ? 1.1 : style === "brutal" ? 2.2 : 1.6} strokeLinecap={style === "brutal" ? "square" : "round"} strokeLinejoin={style === "brutal" ? "miter" : "round"} />
      {style === "tech" && pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={1.2} fill={color} />)}
    </svg>
  );
}

/* ------------------------------------------------------------------
   Barra de progreso genérica
------------------------------------------------------------------ */

export function Meter({ value, max, colorIdx }: { value: number; max: number; colorIdx: ColorRef }) {
  const p = Math.min(100, (value / (max || 1)) * 100);
  const over = value > max;
  return (
    <div className="h-1.5 w-full overflow-hidden" style={{ background: "var(--surface-2)", borderRadius: "var(--radius-pill)" }}>
      <div
        className="h-full transition-[width] duration-700"
        style={{
          width: `${p}%`,
          borderRadius: "var(--radius-pill)",
          background: over ? "var(--neg)" : chartColor(colorIdx),
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------
   Barras horizontales (categorías / ranking)
------------------------------------------------------------------ */

export function HBars({
  items,
  style,
  valueLabel,
  columns,
}: {
  items: { name: string; value: number; max?: number; colorIdx: ColorRef; sub?: string; onClick?: () => void }[];
  style: ChartStyleKey;
  valueLabel: (v: number) => string;
  /** Reparte la lista en varias columnas manteniendo el orden (1 → 2 → 3 …) */
  columns?: number;
}) {
  const max = Math.max(...items.map((i) => i.max ?? i.value), 1);
  const outline = style === "brutal";
  const thin = style === "minimal" || style === "tech" || style === "step";
  const multi = (columns ?? 1) > 1;
  return (
    <div
      className={multi ? undefined : "flex flex-col"}
      style={multi ? { columnCount: columns, columnGap: 32 } : { gap: thin ? 10 : 12 }}
    >
      {items.map((it) => {
        const p = Math.min(100, (it.value / max) * 100);
        const over = it.max !== undefined && it.value > it.max;
        return (
          <div
            key={it.name}
            role={it.onClick ? "button" : undefined}
            tabIndex={it.onClick ? 0 : undefined}
            onClick={it.onClick}
            onKeyDown={it.onClick ? (e) => (e.key === "Enter" || e.key === " ") && it.onClick?.() : undefined}
            className={it.onClick ? "pv-hit cursor-pointer" : ""}
            style={{
              ...(it.onClick ? { margin: "-4px -7px", padding: "4px 7px", borderRadius: 8 } : null),
              ...(multi ? { breakInside: "avoid" as const, marginBottom: thin ? 10 : 12 } : null),
            }}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[12px] font-medium" style={{ color: "var(--text)" }}>
                {it.name}
                {it.sub && <span className="pv-faint ml-1.5 text-[10.5px] font-normal">{it.sub}</span>}
              </span>
              <span className="pv-num shrink-0 text-[12px] font-semibold" style={{ color: over ? "var(--neg)" : "var(--text)" }}>
                {valueLabel(it.value)}
              </span>
            </div>
            <div
              className="relative w-full overflow-hidden"
              style={{
                height: thin ? 4 : outline ? 14 : 8,
                background: outline ? "transparent" : "var(--surface-2)",
                border: outline ? "2px solid var(--text)" : undefined,
                borderRadius: outline || style === "step" ? 0 : "var(--radius-pill)",
              }}
            >
              <div
                className="h-full"
                style={{
                  width: `${p}%`,
                  background: over ? "var(--neg)" : chartColor(it.colorIdx),
                  borderRadius: outline || style === "step" ? 0 : "var(--radius-pill)",
                  borderRight: outline ? "2px solid var(--text)" : undefined,
                }}
              />
              {it.max !== undefined && !outline && (
                <span className="absolute inset-y-0 w-px" style={{ left: `${Math.min(100, (it.max / max) * 100)}%`, background: "var(--border-strong)" }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   Barras apiladas (aportaciones mensuales por producto)
------------------------------------------------------------------ */

export function StackedBars({
  groups,
  keys,
  style,
  height = 190,
  selected,
}: {
  groups: { label: string; parts: number[] }[];
  keys: { name: string; colorIdx: ColorRef }[];
  style: ChartStyleKey;
  height?: number;
  selected?: number;
}) {
  const W = 600;
  const H = 200;
  const totals = groups.map((g) => g.parts.reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...totals) * 1.1;
  const slot = W / Math.max(groups.length, 1);
  const bw = Math.min(slot * 0.62, 46);
  const outline = style === "brutal";
  const round = style === "tech" || style === "step" || outline ? 0 : Math.min(5, bw * 0.2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height, width: "100%", display: "block", overflow: "visible" }}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--border)" strokeWidth={1} strokeDasharray={style === "tech" || style === "step" ? "3 5" : undefined} vectorEffect="non-scaling-stroke" />
      ))}
      {groups.map((g, gi) => {
        const cx = slot * gi + slot / 2;
        const offsets = g.parts.map((_, k) => g.parts.slice(0, k).reduce((a, b) => a + b, 0));
        const last = g.parts.reduce((acc, v, k) => (v > 0 ? k : acc), -1);
        return (
          <g key={gi}>
            {g.parts.map((v, k) => {
              if (v <= 0) return null;
              const h = (v / max) * (H - 14);
              const y = H - ((offsets[k] + v) / max) * (H - 14);
              return (
                <rect
                  key={k}
                  className="pv-bar-grow"
                  x={cx - bw / 2}
                  y={y}
                  width={bw}
                  height={Math.max(h - 1, 1)}
                  rx={k === last ? round : 0}
                  fill={chartColor(keys[k].colorIdx)}
                  opacity={selected === undefined || selected === gi ? 1 : 0.38}
                  stroke={outline ? "var(--text)" : undefined}
                  strokeWidth={outline ? 2 : undefined}
                  vectorEffect="non-scaling-stroke"
                  style={{ animationDelay: `${gi * 30}ms` }}
                >
                  <title>{`${g.label} · ${keys[k].name}: ${Math.round(v).toLocaleString("es-ES")} €`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
      <line x1={0} x2={W} y1={H} y2={H} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------------
   Área apilada (€ o %) de varias series
------------------------------------------------------------------ */

export function StackedArea({
  series,
  percent = false,
  height = 210,
  style,
}: {
  series: { name: string; colorIdx: ColorRef; values: number[] }[];
  percent?: boolean;
  height?: number;
  style: ChartStyleKey;
}) {
  const W = 600;
  const H = 200;
  const n = series.reduce((m, x) => Math.max(m, x.values.length), 0);
  const smooth = style === "gradient" || style === "neon" || style === "glass" || style === "minimal";
  const f = (pts: Pt[]) => (pts.length < 2 ? "" : smooth ? smoothPath(pts) : linePath(pts));
  const totals = Array.from({ length: n }, (_, i) => series.reduce((s, x) => s + Math.max(0, x.values[i] ?? 0), 0));
  const maxTotal = Math.max(1e-9, ...totals);
  const scale = percent ? 1 : maxTotal;
  const xOf = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const yOf = (c: number) => H - 3 - (c / scale) * (H - 6);
  const cum = new Array<number>(n).fill(0);
  const layers = series.map((sr) => {
    const prev = cum.slice();
    for (let i = 0; i < n; i++) {
      const v = Math.max(0, sr.values[i] ?? 0);
      cum[i] += percent ? (totals[i] > 0 ? v / totals[i] : 0) : v;
    }
    const top = cum.map((c, i) => ({ x: xOf(i), y: yOf(c) }));
    const bot = prev.map((c, i) => ({ x: xOf(i), y: yOf(c) }));
    const d = f(top) + " " + f(bot.slice().reverse()).replace(/^M/, "L") + " Z";
    return { name: sr.name, colorIdx: sr.colorIdx, d };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height, width: "100%", display: "block", overflow: "visible" }}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {layers.map((l, i) => (
        <path
          key={`${l.name}-${i}`}
          d={l.d}
          fill={chartColor(l.colorIdx)}
          fillOpacity={0.9}
          stroke={chartColor(l.colorIdx)}
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        >
          <title>{l.name}</title>
        </path>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------
   Varias líneas sobre la misma escala
------------------------------------------------------------------ */

export function MultiLines({
  series,
  height = 200,
  style,
  zero,
}: {
  series: { name: string; colorIdx: ColorRef; values: number[] }[];
  height?: number;
  style: ChartStyleKey;
  /** Valor de referencia que se dibuja como línea discontinua (p. ej. base 100) */
  zero?: number;
}) {
  const W = 600;
  const H = 200;
  const all = series.flatMap((x) => x.values);
  const lo = all.length ? Math.min(...all) : 0;
  const hi = all.length ? Math.max(...all) : 1;
  const span = hi - lo || 1;
  const n = series.reduce((m, x) => Math.max(m, x.values.length), 0);
  const f = style === "tech" || style === "step" || style === "minimal" ? linePath : smoothPath;
  const xOf = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const yOf = (v: number) => H - 6 - ((v - lo) / span) * (H - 12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height, width: "100%", display: "block", overflow: "visible" }}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--border)" strokeWidth={1} strokeDasharray={style === "tech" ? "3 5" : undefined} vectorEffect="non-scaling-stroke" />
      ))}
      {zero !== undefined && zero >= lo && zero <= hi && (
        <line x1={0} x2={W} y1={yOf(zero)} y2={yOf(zero)} stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" opacity={0.8} />
      )}
      {series.map((sr, k) => (
        <path
          key={`${sr.name}-${k}`}
          d={f(sr.values.map((v, i) => ({ x: xOf(i), y: yOf(v) })))}
          fill="none"
          stroke={chartColor(sr.colorIdx)}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        >
          <title>{sr.name}</title>
        </path>
      ))}
    </svg>
  );
}
