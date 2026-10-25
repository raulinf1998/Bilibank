"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus, X } from "lucide-react";
import { useArch } from "./state";
import { chartColor, isHexColor, type ColorRef } from "@/lib/colors";
import { CATEGORY_ICONS } from "@/lib/icons";
import { axisTicks } from "@/lib/series";
import { Donut, TrendChart } from "./charts";

/* ==================================================================
   PANEL — cambia radicalmente según el arquetipo
================================================================== */

export function Panel({
  children,
  className = "",
  pad = true,
  style,
  span,
  tone,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
  style?: CSSProperties;
  span?: string;
  tone?: "accent" | ColorRef;
  onClick?: () => void;
}) {
  const { arch } = useArch();
  const s = arch.surface;
  const padding = pad ? "var(--pad)" : undefined;

  if (s === "neu" || s === "tonal" || s === "wire" || s === "post") {
    const narrow = arch.shell === "feed";
    const tint = tone === undefined ? null : tone === "accent" ? "var(--accent)" : chartColor(tone as ColorRef);
    let st2: CSSProperties = { padding, ...style };
    if (s === "neu") {
      st2 = { ...st2, background: tint ? `color-mix(in srgb, ${tint} 14%, var(--bg))` : "var(--bg)", borderRadius: "var(--radius-lg)", boxShadow: "var(--neu-shadow)" };
    } else if (s === "tonal") {
      st2 = { ...st2, background: tint ? `color-mix(in srgb, ${tint} 20%, var(--surface))` : "color-mix(in srgb, var(--accent) 7%, var(--surface))", borderRadius: "var(--radius-lg)" };
    } else if (s === "wire") {
      st2 = { ...st2, background: tint ? `color-mix(in srgb, ${tint} 10%, transparent)` : "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)" };
    } else {
      st2 = { ...st2, background: tint ? `color-mix(in srgb, ${tint} 14%, var(--surface))` : "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0 1px 2px rgba(0,0,0,.18), 0 14px 30px -18px rgba(0,0,0,.5)" };
    }
    const cls2 = `pv-anim relative ${pad ? "" : "overflow-hidden"} ${onClick ? "cursor-pointer" : ""} ${span && !narrow ? span : ""} ${className}`;
    return (
      <section className={cls2} style={st2} onClick={onClick}>
        {children}
      </section>
    );
  }

  const base: CSSProperties = { padding, ...style };
  let cls = "pv-anim relative ";
  let st: CSSProperties = base;

  if (s === "bordered") {
    cls += "pv-card";
  } else if (s === "grid") {
    st = { ...base, background: "var(--surface)", borderRadius: 0 };
  } else if (s === "none") {
    st = { ...base, padding: pad ? "calc(var(--pad) * 0.6) 0 var(--pad)" : undefined, borderTop: "1px solid var(--border-strong)", background: "transparent" };
  } else if (s === "filled") {
    st = {
      ...base,
      background: tone === "accent" ? "var(--accent)" : tone !== undefined && tone !== "accent" ? `color-mix(in srgb, ${chartColor(tone)} 22%, var(--surface))` : "var(--surface)",
      color: tone === "accent" ? "var(--accent-fg)" : undefined,
      borderRadius: "var(--radius-lg)",
    };
  } else if (s === "glass") {
    st = { ...base, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", backdropFilter: "var(--blur)", WebkitBackdropFilter: "var(--blur)", boxShadow: "var(--panel-shadow)" };
  } else if (s === "brutal") {
    st = {
      ...base,
      background: tone !== undefined && tone !== "accent" ? `color-mix(in srgb, ${chartColor(tone)} 28%, var(--surface))` : tone === "accent" ? "var(--accent)" : "var(--surface)",
      border: "2px solid var(--text)",
      boxShadow: "4px 4px 0 0 var(--text)",
      borderRadius: "var(--radius-sm)",
    };
  }
  if (!pad) cls += " overflow-hidden";
  if (onClick) cls += " cursor-pointer";
  if (span) cls += ` ${span}`;

  return (
    <section className={`${cls} ${className}`} style={st} onClick={onClick}>
      {children}
    </section>
  );
}

/** Rejilla de paneles: en 'grid' colapsa huecos a 1px; en columnas estrechas (móvil/feed) se queda en una columna */
export function PanelGrid({ cols, children, className = "" }: { cols: string; children: ReactNode; className?: string }) {
  const { arch, isMobile } = useArch();
  const g = arch.surface === "grid";
  const feed = arch.shell === "feed";
  const cls = isMobile ? "grid-cols-1" : feed ? cols.split(" ").filter((c) => !c.includes(":")).join(" ") : cols;
  return (
    <div
      className={`grid ${cls} ${className}`}
      style={{ gap: g ? 1 : "var(--gap)", background: g ? "var(--border-strong)" : undefined, border: g ? "1px solid var(--border-strong)" : undefined }}
    >
      {children}
    </div>
  );
}

export function Stack({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { arch } = useArch();
  return (
    <div className={`flex flex-col ${className}`} style={{ gap: arch.surface === "grid" ? 1 : arch.surface === "none" ? "calc(var(--gap) * 1.4)" : "var(--gap)" }}>
      {children}
    </div>
  );
}

/* ==================================================================
   CABECERAS
================================================================== */

export function PageHeader({ kicker, title, action, onBack }: { kicker?: string; title: string; action?: ReactNode; onBack?: () => void }) {
  const { arch } = useArch();
  const editorial = arch.kpi === "statement";
  const brutal = arch.surface === "brutal";
  const explorer = arch.shell === "explorer";
  const terminal = arch.shell === "topbar" || explorer;
  const big = arch.shell === "appbar";
  const feed = arch.shell === "feed";
  const titleCls = editorial ? "text-[38px] font-semibold" : brutal ? "text-[30px] font-black uppercase" : big ? "text-[34px] font-semibold" : terminal ? "text-[18px] font-semibold" : feed ? "text-[22px] font-bold" : "text-[26px] font-bold";
  return (
    <header className={`flex flex-wrap items-end justify-between gap-3 ${editorial ? "border-b pb-4" : ""}`} style={{ borderColor: "var(--text)", padding: terminal ? "6px 2px" : undefined }}>
      <div className="flex items-center gap-3">
        {onBack && (
          <Btn variant="ghost" onClick={onBack} aria="Volver">
            ←
          </Btn>
        )}
        <div>
          {kicker && (
            <p className={`pv-muted text-[11px] font-semibold uppercase ${brutal ? "font-black" : ""}`} style={{ letterSpacing: terminal ? "0.08em" : "0.16em" }}>
              {kicker}
            </p>
          )}
          <h1 className={`pv-display leading-tight ${titleCls}`} style={{ color: "var(--text)", marginTop: kicker ? 2 : 0, fontFamily: explorer ? "var(--font-num)" : undefined }}>
            {explorer && <span className="pv-faint">{"// "}</span>}
            {title}
          </h1>
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export function SectionTitle({ children, sub, action }: { children: ReactNode; sub?: string; action?: ReactNode }) {
  const { arch } = useArch();
  const editorial = arch.surface === "none";
  const terminal = arch.surface === "grid" || arch.surface === "wire";
  const brutal = arch.surface === "brutal";
  const explorer = arch.shell === "explorer";
  return (
    <div className={`flex items-start justify-between gap-3 ${terminal ? "mb-2" : "mb-4"}`}>
      <div className="min-w-0">
        <h2
          className={`pv-display truncate ${editorial ? "text-[22px] font-semibold" : terminal ? "text-[11px] font-bold uppercase tracking-[0.1em]" : brutal ? "text-[15px] font-black uppercase" : "text-[15px] font-semibold"}`}
          style={{ color: terminal ? "var(--accent)" : "var(--text)", fontFamily: explorer ? "var(--font-num)" : undefined }}
        >
          {explorer && "▸ "}
          {children}
        </h2>
        {sub && <p className={`pv-muted mt-0.5 ${editorial ? "text-[13px]" : "text-[11px]"}`}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* ==================================================================
   BOTÓN
================================================================== */

export function Btn({
  children,
  variant = "primary",
  onClick,
  icon,
  size = "md",
  aria,
  type = "button",
  disabled,
  full,
  tone,
}: {
  children?: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  onClick?: () => void;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
  aria?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  full?: boolean;
  /** Color CSS explícito que sustituye al acento del tema (p.ej. para tipos de movimiento). */
  tone?: string;
}) {
  const { arch } = useArch();
  const b = arch.button;
  const padY = size === "sm" ? "4px" : size === "lg" ? "11px" : "7px";
  const padX = size === "sm" ? "9px" : size === "lg" ? "18px" : "13px";
  const fs = size === "sm" ? 11 : size === "lg" ? 14 : 12;

  let st: CSSProperties = { padding: `${padY} ${padX}`, fontSize: fs, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, lineHeight: 1.2, transition: "all .14s ease", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, width: full ? "100%" : undefined, justifyContent: "center" };
  const danger = variant === "danger";

  switch (b) {
    case "neu":
      st = { ...st, borderRadius: 999, padding: `${padY} calc(${padX} + 4px)`, background: "var(--bg)", color: variant === "primary" ? "var(--accent)" : danger ? "var(--neg)" : "var(--muted)", boxShadow: "var(--neu-shadow-sm)", fontWeight: 700 };
      break;
    case "tonal":
      st = { ...st, borderRadius: 999, padding: `${padY} calc(${padX} + 4px)`, background: variant === "primary" ? "var(--accent)" : danger ? "var(--neg-soft)" : "var(--accent-soft)", color: variant === "primary" ? "var(--accent-fg)" : danger ? "var(--neg)" : "var(--accent)" };
      break;
    case "code":
      st = { ...st, borderRadius: 3, fontFamily: "var(--font-num)", background: variant === "primary" ? "var(--accent-soft)" : "transparent", color: variant === "primary" ? "var(--accent)" : danger ? "var(--neg)" : "var(--muted)", border: `1px solid ${variant === "primary" ? "var(--accent)" : danger ? "var(--neg)" : "var(--border-strong)"}` };
      break;
    case "gradient":
      st = variant === "primary"
        ? { ...st, borderRadius: 14, background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "var(--accent-fg)", boxShadow: "var(--accent-glow)", fontWeight: 700 }
        : danger
          ? { ...st, borderRadius: 14, background: "var(--neg-soft)", color: "var(--neg)" }
          : { ...st, borderRadius: 14, background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)" };
      break;
    case "filled":
      st = variant === "primary"
        ? { ...st, background: "var(--accent)", color: "var(--accent-fg)", borderRadius: "var(--radius)", boxShadow: "var(--accent-glow)" }
        : danger
          ? { ...st, background: "var(--neg-soft)", color: "var(--neg)", borderRadius: "var(--radius)" }
          : { ...st, background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: "var(--radius)" };
      break;
    case "square":
      st = { ...st, borderRadius: 2, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: fs - 1, fontWeight: 600,
        background: variant === "primary" ? "var(--accent)" : "transparent",
        color: variant === "primary" ? "var(--accent-fg)" : danger ? "var(--neg)" : "var(--text)",
        border: `1px solid ${variant === "primary" ? "var(--accent)" : danger ? "var(--neg)" : "var(--border-strong)"}` };
      break;
    case "link":
      st = { ...st, padding: `${padY} 2px`, background: "transparent", color: danger ? "var(--neg)" : variant === "primary" ? "var(--accent)" : "var(--muted)",
        textDecoration: "underline", textUnderlineOffset: 5, textDecorationThickness: 1, fontWeight: 500, fontSize: fs + 1, borderRadius: 0 };
      break;
    case "pill":
      st = { ...st, borderRadius: 999, padding: `${padY} calc(${padX} + 4px)`,
        background: variant === "primary" ? "var(--accent)" : danger ? "var(--neg-soft)" : "var(--surface-2)",
        color: variant === "primary" ? "var(--accent-fg)" : danger ? "var(--neg)" : "var(--text)" };
      break;
    case "soft":
      st = { ...st, borderRadius: 999, padding: `${padY} calc(${padX} + 4px)`,
        background: variant === "primary" ? "var(--accent-soft)" : danger ? "var(--neg-soft)" : "var(--surface-2)",
        color: variant === "primary" ? "var(--accent)" : danger ? "var(--neg)" : "var(--muted)",
        border: `1px solid ${variant === "primary" ? "color-mix(in srgb, var(--accent) 35%, transparent)" : "var(--border)"}` };
      break;
    case "brutal":
      st = { ...st, borderRadius: 2, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.04em",
        background: variant === "primary" ? "var(--accent)" : danger ? "var(--neg)" : "var(--surface)",
        color: variant === "primary" ? "var(--accent-fg)" : danger ? "#fff" : "var(--text)",
        border: "2px solid var(--text)", boxShadow: "3px 3px 0 0 var(--text)" };
      break;
  }

  if (tone && variant === "primary") {
    if (b === "square") {
      st = { ...st, background: "transparent", color: tone, border: `1px solid ${tone}` };
    } else if (b === "link") {
      st = { ...st, color: tone };
    } else if (b === "soft") {
      st = { ...st, background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone, border: `1px solid color-mix(in srgb, ${tone} 40%, transparent)` };
    } else if (b === "brutal") {
      st = { ...st, background: tone, color: "#fff" };
    } else {
      st = { ...st, background: tone, color: "#fff", boxShadow: `0 10px 22px -10px ${tone}` };
    }
  }

  return (
    <button type={type} onClick={onClick} aria-label={aria} disabled={disabled} style={st} className={b === "brutal" ? "active:translate-x-[2px] active:translate-y-[2px] active:!shadow-none" : "hover:brightness-110"}>
      {icon}
      {children}
    </button>
  );
}

/* ==================================================================
   CHIPS / BADGES
================================================================== */

export function Chip({ trend, children }: { trend: "up" | "down" | "neutral"; children: ReactNode }) {
  const { arch } = useArch();
  const brutal = arch.surface === "brutal";
  const terminal = arch.kpi === "ticker" || arch.kpi === "inline";
  if (terminal) {
    const c = trend === "up" ? "var(--pos)" : trend === "down" ? "var(--neg)" : "var(--muted)";
    return <span className="pv-num text-[11px] font-semibold" style={{ color: c }}>{trend === "up" ? "▲" : trend === "down" ? "▼" : "•"} {children}</span>;
  }
  if (trend === "neutral")
    return <span className="pv-pill inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold"><Minus className="h-3 w-3" /> {children}</span>;
  const Icon = trend === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="pv-num inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap px-1.5 py-0.5 text-[11px] font-bold"
      style={{
        color: brutal ? "var(--text)" : trend === "up" ? "var(--pos)" : "var(--neg)",
        background: trend === "up" ? (brutal ? "var(--pos)" : "var(--pos-soft)") : brutal ? "var(--neg)" : "var(--neg-soft)",
        border: brutal ? "2px solid var(--text)" : undefined,
        borderRadius: brutal ? 0 : "var(--radius-sm)",
      }}
    >
      <Icon className="h-3 w-3" strokeWidth={2.6} /> {children}
    </span>
  );
}

export function IconBadge({ icon, colorIdx = 0, size = 32 }: { icon: ReactNode; colorIdx?: ColorRef; size?: number }) {
  const { arch } = useArch();
  const round = arch.list === "avatars" || arch.list === "tiles" || arch.list === "cards" || arch.list === "timeline" || arch.surface === "tonal";
  const brutal = arch.surface === "brutal";
  const neu = arch.surface === "neu";
  const col = chartColor(colorIdx);
  return (
    <span
      className="grid shrink-0 place-items-center"
      style={{
        width: size, height: size,
        borderRadius: round || neu ? 999 : brutal ? 0 : "var(--radius-sm)",
        background: brutal ? col : neu ? "var(--bg)" : `color-mix(in srgb, ${col} 16%, transparent)`,
        color: brutal ? "var(--text)" : col,
        border: brutal ? "2px solid var(--text)" : undefined,
        boxShadow: neu ? "var(--neu-shadow-sm)" : undefined,
      }}
    >
      {icon}
    </span>
  );
}

/* ==================================================================
   KPI — 6 presentaciones distintas
================================================================== */

export interface KpiItem {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon?: ReactNode;
  colorIdx?: ColorRef;
  footnote?: string;
  pct?: number; // 0..100 para anillos
  series?: number[];
  /** Línea extra bajo la cifra (p. ej. media mensual) */
  note?: string;
}

function fakeSeries(seed: string, up: boolean): number[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  let v = 50;
  return Array.from({ length: 18 }, () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    v += (up ? 1.6 : -1.2) + (h / 4294967296 - 0.5) * 7;
    return v;
  });
}

export function KpiGroup({ items }: { items: KpiItem[] }) {
  const { arch, isMobile } = useArch();
  const k = arch.kpi;

  if (k === "spark") {
    return (
      <PanelGrid cols="grid-cols-2 xl:grid-cols-4">
        {items.map((it, i) => (
          <Panel key={it.label} pad={false}>
            <div style={{ padding: "var(--pad) var(--pad) 0" }}>
              <div className="flex items-start justify-between gap-2">
                <span className="pv-muted min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.09em]" title={it.label}>{it.label}</span>
                {it.icon && <IconBadge icon={it.icon} colorIdx={it.colorIdx ?? i} size={28} />}
              </div>
              <p className="pv-display pv-num mt-2 truncate text-[22px] font-bold leading-none" style={{ color: "var(--text)" }} title={it.value}>{it.value}</p>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {it.delta && <Chip trend={it.trend ?? "neutral"}>{it.delta}</Chip>}
                {it.footnote && <span className="pv-faint min-w-0 truncate text-[11px]">{it.footnote}</span>}
              </div>
            {it.note && <p className="pv-muted mt-1.5 text-[11.5px] leading-snug">{it.note}</p>}
            </div>
            <div style={{ marginTop: 10 }}>
              <TrendChart values={it.series ?? fakeSeries(it.label, (it.trend ?? "up") !== "down")} style="gradient" showGrid={false} height={46} color={chartColor(it.colorIdx ?? i)} />
            </div>
          </Panel>
        ))}
      </PanelGrid>
    );
  }

  if (k === "summary") {
    const cols = isMobile ? 2 : 4;
    return (
      <Panel pad={false}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {items.map((it, i) => (
            <div key={it.label} style={{ padding: "var(--pad)", borderLeft: i % cols !== 0 ? "1px solid var(--border)" : undefined, borderTop: i >= cols ? "1px solid var(--border)" : undefined }}>
              <div className="flex items-center gap-2">
                {it.icon && <IconBadge icon={it.icon} colorIdx={it.colorIdx ?? i} size={26} />}
                <span className="pv-muted truncate text-[11px] font-semibold uppercase tracking-[0.08em]">{it.label}</span>
              </div>
              <p className="pv-display pv-num mt-2.5 truncate text-[22px] font-bold leading-none" style={{ color: "var(--text)" }} title={it.value}>{it.value}</p>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {it.delta && <Chip trend={it.trend ?? "neutral"}>{it.delta}</Chip>}
                {it.footnote && <span className="pv-faint truncate text-[11px]">{it.footnote}</span>}
              </div>
            {it.note && <p className="pv-muted mt-1.5 text-[11.5px] leading-snug">{it.note}</p>}
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (k === "inline") {
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 py-2" style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-num)" }}>
        {items.map((it) => (
          <span key={it.label} className="inline-flex items-baseline gap-1.5 text-[12px]">
            <span style={{ color: "var(--accent)" }}>{it.label.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, "_").replace(/^_|_$/g, "")}</span>
            <span className="pv-faint">=</span>
            <span className="font-semibold" style={{ color: "var(--text)" }}>{it.value}</span>
            {it.delta && <Chip trend={it.trend ?? "neutral"}>{it.delta}</Chip>}
          </span>
        ))}
      </div>
    );
  }

  if (k === "stories") {
    return (
      <div className="lab-scroll flex snap-x gap-3 overflow-x-auto pb-1">
        {items.map((it, i) => {
          const col = chartColor(it.colorIdx ?? i);
          return (
            <div key={it.label} className="relative shrink-0 snap-start overflow-hidden" style={{ width: isMobile ? 148 : 176, padding: 14, borderRadius: "var(--radius-lg)", background: `linear-gradient(160deg, ${col}, color-mix(in srgb, ${col} 35%, #000))`, color: "#fff" }}>
              <span aria-hidden className="absolute -right-6 -top-8 h-24 w-24 rounded-full" style={{ background: "rgba(255,255,255,.14)" }} />
              <span className="relative grid h-9 w-9 place-items-center" style={{ borderRadius: 999, border: "2px solid rgba(255,255,255,.85)", background: "rgba(255,255,255,.18)" }}>{it.icon}</span>
              <p className="relative mt-3 truncate text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ opacity: 0.85 }}>{it.label}</p>
              <p className="pv-num relative mt-0.5 text-[18px] font-bold leading-tight">{it.value}</p>
              {it.delta && <span className="pv-num relative mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "rgba(255,255,255,.22)" }}>{it.delta}</span>}
            </div>
          );
        })}
      </div>
    );
  }

  if (k === "ticker") {
    return (
      <div className="flex overflow-x-auto" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}>
        {items.map((it, i) => (
          <div key={it.label} className="flex min-w-0 shrink-0 items-baseline gap-2.5 px-3.5 py-2" style={{ borderRight: i < items.length - 1 ? "1px solid var(--border-strong)" : undefined }}>
            <span className="pv-muted text-[10px] font-semibold uppercase tracking-[0.08em]">{it.label}</span>
            <span className="pv-num text-[14px] font-semibold" style={{ color: "var(--text)" }}>{it.value}</span>
            {it.delta && <Chip trend={it.trend ?? "neutral"}>{it.delta}</Chip>}
            {it.footnote && !isMobile && <span className="pv-faint text-[10px]">{it.footnote}</span>}
          </div>
        ))}
      </div>
    );
  }

  if (k === "statement") {
    return (
      <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-4"} gap-x-10 gap-y-6 border-b pb-6`} style={{ borderColor: "var(--text)" }}>
        {items.map((it) => (
          <div key={it.label}>
            <p className="pv-muted text-[11px] uppercase tracking-[0.18em]">{it.label}</p>
            <p className="pv-display mt-3 text-[40px] font-semibold leading-none" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{it.value}</p>
            <p className="mt-2.5 flex items-baseline gap-2 text-[13px]">
              {it.delta && <span style={{ color: it.trend === "up" ? "var(--pos)" : it.trend === "down" ? "var(--neg)" : "var(--muted)" }}>{it.delta}</span>}
              {it.footnote && <span className="pv-faint">{it.footnote}</span>}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (k === "tile") {
    return (
      <PanelGrid cols="grid-cols-2 xl:grid-cols-4">
        {items.map((it, i) => (
          <Panel key={it.label} tone={i === 0 ? "accent" : undefined}>
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <Donut
                  size={56}
                  style={arch.chartStyle}
                  slices={[{ name: "a", value: it.pct ?? 60, colorIdx: i === 0 ? 3 : it.colorIdx ?? i }, { name: "b", value: 100 - (it.pct ?? 60), colorIdx: "var(--border-strong)" }]}
                />
                <span className="pv-num absolute inset-0 grid place-items-center text-[10px] font-bold">{Math.round(it.pct ?? 60)}%</span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ opacity: 0.75 }}>{it.label}</p>
                <p className="pv-display pv-num mt-1 text-[19px] font-bold leading-none">{it.value}</p>
                {it.delta && <p className="mt-1.5 text-[11px] font-semibold" style={{ opacity: 0.85 }}>{it.delta}{it.footnote ? ` · ${it.footnote}` : ""}</p>}
              </div>
            </div>
          </Panel>
        ))}
      </PanelGrid>
    );
  }

  if (k === "block") {
    return (
      <PanelGrid cols="grid-cols-2 xl:grid-cols-4">
        {items.map((it, i) => (
          <Panel key={it.label} tone={it.colorIdx ?? i}>
            <p className="text-[11px] font-black uppercase tracking-[0.08em]" style={{ color: "var(--text)" }}>{it.label}</p>
            <p className="pv-display mt-2 text-[26px] font-black leading-none" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{it.value}</p>
            <div className="mt-2.5 flex items-center gap-2">
              {it.delta && <Chip trend={it.trend ?? "neutral"}>{it.delta}</Chip>}
              {it.footnote && <span className="text-[11px] font-bold" style={{ color: "var(--text)", opacity: 0.7 }}>{it.footnote}</span>}
            </div>
          </Panel>
        ))}
      </PanelGrid>
    );
  }

  if (k === "hero") {
    const [first, ...rest] = items;
    return (
      <div className="flex flex-col" style={{ gap: "var(--gap)" }}>
        <div
          className="relative overflow-hidden"
          style={{
            padding: "calc(var(--pad) * 1.4)",
            borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
            color: "var(--accent-fg)",
            boxShadow: "var(--accent-glow)",
          }}
        >
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full" style={{ background: "rgba(255,255,255,0.14)" }} />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full" style={{ background: "rgba(0,0,0,0.1)" }} />
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ opacity: 0.85 }}>{first.label}</p>
          <p className="pv-display pv-num mt-2 text-[42px] font-bold leading-none">{first.value}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {first.delta && <span className="pv-num rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "rgba(255,255,255,0.2)" }}>{first.delta}</span>}
            {first.footnote && <span className="text-[12px]" style={{ opacity: 0.85 }}>{first.footnote}</span>}
          </div>
        </div>
        <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-3"}`} style={{ gap: "var(--gap)" }}>
          {rest.map((it) => (
            <Panel key={it.label} className="flex items-center gap-3">
              {it.icon && <IconBadge icon={it.icon} colorIdx={it.colorIdx ?? 0} size={38} />}
              <div className="min-w-0 flex-1">
                <p className="pv-muted truncate text-[11px] font-medium">{it.label}</p>
                <p className="pv-num truncate text-[17px] font-bold leading-tight" style={{ color: "var(--text)" }} title={it.value}>{it.value}</p>
              {it.note && <p className="pv-faint truncate text-[11px]">{it.note}</p>}
              </div>
              {it.delta && <Chip trend={it.trend ?? "neutral"}>{it.delta}</Chip>}
            </Panel>
          ))}
        </div>
      </div>
    );
  }

  // card (por defecto)
  return (
    <PanelGrid cols="grid-cols-2 xl:grid-cols-4">
      {items.map((it, i) => (
        <Panel key={it.label} className="overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${chartColor((it.colorIdx ?? i))}, transparent 78%)`, opacity: 0.75 }} />
          <div className="flex items-start justify-between gap-2">
            <span className="pv-muted min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.09em]" title={it.label}>{it.label}</span>
            {it.icon && <IconBadge icon={it.icon} colorIdx={it.colorIdx ?? i} size={28} />}
          </div>
          <p className="pv-display pv-num mt-2.5 truncate text-[22px] font-bold leading-none" style={{ color: "var(--text)" }} title={it.value}>{it.value}</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {it.delta && <Chip trend={it.trend ?? "neutral"}>{it.delta}</Chip>}
            {it.footnote && <span className="pv-faint min-w-0 truncate text-[11px]">{it.footnote}</span>}
          </div>
          {it.note && <p className="pv-muted mt-1.5 text-[11.5px] leading-snug">{it.note}</p>}
        </Panel>
      ))}
    </PanelGrid>
  );
}

/* ==================================================================
   LISTAS — fila genérica con 6 variantes
================================================================== */

export interface RowItem {
  id: number | string;
  icon?: ReactNode;
  colorIdx?: ColorRef;
  title: string;
  sub?: string;
  meta?: string;
  value: string;
  valueTone?: "pos" | "neg" | "text";
  sub2?: string;
  sub2Tone?: "pos" | "neg" | "muted";
  extra?: ReactNode;
  onClick?: () => void;
}

export function RowList({ items, empty = "Sin elementos" }: { items: RowItem[]; empty?: string }) {
  const { arch, isMobile } = useArch();
  const l = arch.list;
  const tone = (t?: "pos" | "neg" | "text" | "muted") => (t === "pos" ? "var(--pos)" : t === "neg" ? "var(--neg)" : t === "muted" ? "var(--muted)" : "var(--text)");

  if (items.length === 0) return <p className="pv-faint py-6 text-center text-[12px]">{empty}</p>;

  if (l === "cards") {
    return (
      <ul className="flex flex-col gap-2" style={{ padding: "0 var(--pad) var(--pad)" }}>
        {items.map((it) => (
          <li key={it.id} onClick={it.onClick} className={`flex items-center gap-3 ${it.onClick ? "cursor-pointer" : ""}`} style={{ padding: "11px 14px", background: "var(--surface-2)", borderRadius: "var(--radius)" }}>
            {it.icon && <IconBadge icon={it.icon} colorIdx={it.colorIdx} size={36} />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text)" }}>{it.title}</p>
              <p className="pv-faint truncate text-[11px]">{it.sub}{it.meta && !isMobile ? ` · ${it.meta}` : ""}</p>
            </div>
            {it.extra}
            <div className="shrink-0 text-right">
              <p className="pv-num text-[13px] font-bold" style={{ color: tone(it.valueTone) }}>{it.value}</p>
              {it.sub2 && <p className="pv-num text-[11px] font-semibold" style={{ color: tone(it.sub2Tone) }}>{it.sub2}</p>}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (l === "leader") {
    return (
      <ul style={{ padding: "0 var(--pad) 8px" }}>
        {items.map((it) => (
          <li key={it.id} onClick={it.onClick} className={it.onClick ? "pv-hit cursor-pointer" : ""} style={{ padding: "7px 4px", fontFamily: "var(--font-num)" }}>
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[12.5px] font-medium" style={{ color: "var(--text)" }}>{it.title}</span>
              <span className="min-w-4 flex-1 border-b border-dotted" style={{ borderColor: "var(--border-strong)", transform: "translateY(-3px)" }} />
              <span className="pv-num shrink-0 text-[12.5px] font-semibold" style={{ color: tone(it.valueTone) }}>{it.value}</span>
              {it.extra}
            </div>
            <p className="pv-faint truncate text-[10.5px]">{it.sub}{it.meta && !isMobile ? ` · ${it.meta}` : ""}{it.sub2 ? ` · ${it.sub2}` : ""}</p>
          </li>
        ))}
      </ul>
    );
  }

  if (l === "timeline") {
    return (
      <ul className="relative" style={{ margin: "0 var(--pad) var(--pad) calc(var(--pad) + 6px)", paddingLeft: 22, borderLeft: "2px solid var(--border-strong)" }}>
        {items.map((it) => (
          <li key={it.id} onClick={it.onClick} className={`relative flex items-center gap-3 py-2.5 ${it.onClick ? "cursor-pointer" : ""}`}>
            <span className="absolute h-3 w-3 rounded-full" style={{ left: -29, top: "50%", marginTop: -6, background: chartColor(it.colorIdx ?? 0), border: "2px solid var(--bg)" }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text)" }}>{it.title}</p>
              <p className="pv-faint truncate text-[11px]">{it.sub}{it.meta && !isMobile ? ` · ${it.meta}` : ""}</p>
            </div>
            {it.extra}
            <div className="shrink-0 text-right">
              <p className="pv-num text-[13px] font-bold" style={{ color: tone(it.valueTone) }}>{it.value}</p>
              {it.sub2 && <p className="pv-num text-[11px] font-semibold" style={{ color: tone(it.sub2Tone) }}>{it.sub2}</p>}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (l === "dense") {
    return (
      <table className="w-full border-collapse text-left">
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id} onClick={it.onClick} className={it.onClick ? "cursor-pointer pv-table-row" : ""} style={{ background: i % 2 ? "var(--surface-2)" : "transparent", height: "var(--row)" }}>
              <td className="px-3 py-1" style={{ width: 24 }}><span className="h-2 w-2 inline-block" style={{ background: chartColor((it.colorIdx ?? 0)) }} /></td>
              <td className="px-2 py-1 text-[12px] font-medium" style={{ color: "var(--text)" }}>{it.title}</td>
              {!isMobile && <td className="pv-muted px-2 py-1 text-[11px]">{it.sub}</td>}
              {!isMobile && <td className="pv-faint px-2 py-1 text-[11px]">{it.meta}</td>}
              <td className="pv-num px-3 py-1 text-right text-[12px] font-semibold" style={{ color: tone(it.valueTone) }}>{it.value}</td>
              {it.sub2 && <td className="pv-num px-3 py-1 text-right text-[11px]" style={{ color: tone(it.sub2Tone), width: 90 }}>{it.sub2}</td>}
              {it.extra && <td className="px-2 py-1 text-right">{it.extra}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (l === "ledger") {
    return (
      <ul>
        {items.map((it) => (
          <li key={it.id} onClick={it.onClick} className={`grid items-baseline gap-4 ${it.onClick ? "cursor-pointer" : ""}`} style={{ gridTemplateColumns: isMobile ? "1fr auto" : "minmax(0,1fr) 140px 140px", padding: "11px 0", borderBottom: "1px solid var(--border-strong)" }}>
            <div className="min-w-0">
              <p className="truncate text-[14px]" style={{ color: "var(--text)" }}>{it.title}</p>
              {it.sub && <p className="pv-muted truncate text-[12px] italic">{it.sub}{it.meta ? ` — ${it.meta}` : ""}</p>}
            </div>
            {!isMobile && <span className="pv-faint text-right text-[12px]">{it.sub2 ?? ""}</span>}
            <span className="pv-num text-right text-[14px]" style={{ color: tone(it.valueTone) }}>{it.value}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (l === "tiles") {
    return (
      <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3"}`} style={{ gap: "calc(var(--gap) * 0.7)" }}>
        {items.map((it) => (
          <button key={it.id} type="button" onClick={it.onClick} className="flex items-center gap-3 text-left" style={{ padding: 12, background: "var(--surface-2)", borderRadius: "var(--radius)", cursor: it.onClick ? "pointer" : "default" }}>
            {it.icon && <IconBadge icon={it.icon} colorIdx={it.colorIdx} size={36} />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>{it.title}</p>
              <p className="pv-faint truncate text-[11px]">{it.sub}</p>
              <p className="pv-num mt-1 text-[14px] font-bold" style={{ color: tone(it.valueTone) }}>{it.value}</p>
              {it.sub2 && <p className="pv-num text-[11px] font-semibold" style={{ color: tone(it.sub2Tone) }}>{it.sub2}</p>}
            </div>
            {it.extra}
          </button>
        ))}
      </div>
    );
  }

  if (l === "blocks") {
    return (
      <ul>
        {items.map((it) => (
          <li key={it.id} onClick={it.onClick} className={`flex items-center gap-3 ${it.onClick ? "cursor-pointer" : ""}`} style={{ padding: "11px var(--pad)", borderBottom: "2px solid var(--text)" }}>
            {it.icon && <IconBadge icon={it.icon} colorIdx={it.colorIdx} size={34} />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-extrabold uppercase" style={{ color: "var(--text)" }}>{it.title}</p>
              <p className="pv-muted truncate text-[11px] font-semibold">{it.sub}{it.meta ? ` · ${it.meta}` : ""}</p>
            </div>
            {it.extra}
            <div className="shrink-0 text-right">
              <p className="pv-num text-[14px] font-black" style={{ color: tone(it.valueTone) }}>{it.value}</p>
              {it.sub2 && <p className="pv-num text-[11px] font-bold" style={{ color: tone(it.sub2Tone) }}>{it.sub2}</p>}
            </div>
            {it.onClick && <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text)" }} />}
          </li>
        ))}
      </ul>
    );
  }

  // rows / avatars
  const avatars = l === "avatars";
  return (
    <ul>
      {items.map((it) => (
        <li key={it.id} onClick={it.onClick} className={`pv-table-row flex items-center gap-3 ${it.onClick ? "cursor-pointer" : ""}`} style={{ padding: `${avatars ? 11 : 9}px var(--pad)`, borderBottom: avatars ? undefined : "1px solid var(--border)" }}>
          {it.icon && <IconBadge icon={it.icon} colorIdx={it.colorIdx} size={avatars ? 40 : 32} />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text)" }}>{it.title}</p>
            <p className="pv-faint truncate text-[11px]">{it.sub}{it.meta && !isMobile ? ` · ${it.meta}` : ""}</p>
          </div>
          {it.extra}
          <div className="shrink-0 text-right">
            <p className="pv-num text-[13px] font-bold" style={{ color: tone(it.valueTone) }}>{it.value}</p>
            {it.sub2 && <p className="pv-num text-[11px] font-semibold" style={{ color: tone(it.sub2Tone) }}>{it.sub2}</p>}
          </div>
          {it.onClick && avatars && <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--faint)" }} />}
        </li>
      ))}
    </ul>
  );
}

/* ==================================================================
   SEGMENTED / TABS
================================================================== */

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { arch } = useArch();
  const b = arch.button;
  const brutal = b === "brutal";
  const square = b === "square" || b === "code";
  const link = b === "link";
  const neu = b === "neu";
  const tonal = b === "tonal";
  const grad = b === "gradient";
  return (
    <div
      className="inline-flex items-center"
      style={{
        gap: brutal ? 0 : 2,
        padding: link || brutal || square ? 0 : 3,
        background: neu ? "var(--surface-2)" : link || brutal || square ? "transparent" : "var(--surface-2)",
        border: neu ? "none" : link || brutal ? undefined : square ? "1px solid var(--border-strong)" : "1px solid var(--border)",
        borderRadius: square || brutal ? 2 : "var(--radius-pill)",
        boxShadow: neu ? "var(--neu-inset)" : undefined,
        fontFamily: b === "code" ? "var(--font-num)" : undefined,
      }}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className="px-2.5 py-1 text-[11px] font-semibold"
            style={{
              borderRadius: square || brutal ? 0 : "var(--radius-pill)",
              background: active ? (link ? "transparent" : neu ? "var(--bg)" : tonal ? "var(--accent-soft)" : grad ? "linear-gradient(135deg, var(--accent), var(--accent-2))" : "var(--accent)") : "transparent",
              color: active ? (link ? "var(--text)" : neu || tonal ? "var(--accent)" : "var(--accent-fg)") : "var(--muted)",
              boxShadow: active && neu ? "var(--neu-shadow-sm)" : undefined,
              border: brutal ? "2px solid var(--text)" : undefined,
              marginLeft: brutal ? -2 : undefined,
              textDecoration: link && active ? "underline" : undefined,
              textUnderlineOffset: 5,
              textTransform: square || brutal ? "uppercase" : undefined,
              transition: "all .14s ease",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ==================================================================
   MODAL — siempre diálogo centrado
================================================================== */

export function Modal({ title, sub, onClose, children, footer, width = 480 }: { title: string; sub?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  const { arch, isMobile } = useArch();
  const brutal = arch.surface === "brutal";

  const container: CSSProperties = {
    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
    width, maxWidth: "94%", maxHeight: "92%",
    borderRadius: brutal ? 2 : "var(--radius-lg)",
    border: brutal ? "2px solid var(--text)" : "1px solid var(--border-strong)",
    boxShadow: brutal ? "6px 6px 0 0 var(--text)" : "0 40px 80px -30px rgba(0,0,0,.7)",
  };

  return (
    <div className={`${isMobile ? "absolute" : "fixed"} inset-0 z-50`} style={{ background: brutal ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.5)", backdropFilter: brutal ? "none" : "blur(3px)" }} onClick={onClose}>
      <div className="flex flex-col overflow-hidden" style={{ ...container, background: "var(--bg)", color: "var(--text)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3" style={{ borderBottom: brutal ? "2px solid var(--text)" : "1px solid var(--border)" }}>
          <div>
            <h3 className={`pv-display ${brutal ? "text-[17px] font-black uppercase" : arch.kpi === "statement" ? "text-[24px] font-semibold" : "text-[16px] font-bold"}`}>{title}</h3>
            {sub && <p className="pv-muted mt-0.5 text-[12px]">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center" style={{ color: "var(--muted)", border: brutal ? "2px solid var(--text)" : "1px solid var(--border)", borderRadius: brutal ? 0 : "var(--radius-pill)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="lab-scroll flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: brutal ? "2px solid var(--text)" : "1px solid var(--border)", background: "var(--surface)" }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ==================================================================
   FORMULARIOS
================================================================== */

const fieldStyle = (brutal: boolean, square: boolean): CSSProperties => ({
  width: "100%",
  background: brutal ? "var(--surface)" : "var(--surface-2)",
  color: "var(--text)",
  border: brutal ? "2px solid var(--text)" : square ? "1px solid var(--border-strong)" : "1px solid var(--border)",
  borderRadius: brutal || square ? 2 : "var(--radius)",
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
});

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const { arch } = useArch();
  return (
    <label className="block">
      <span className={`mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] ${arch.surface === "brutal" ? "font-black" : ""}`} style={{ color: "var(--muted)" }}>{label}</span>
      {children}
      {hint && <span className="pv-faint mt-1 block text-[11px]">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { arch } = useArch();
  return <input {...props} style={{ ...fieldStyle(arch.surface === "brutal", arch.button === "square"), ...(props.style ?? {}) }} className={`pv-num ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { arch } = useArch();
  return <select {...props} style={{ ...fieldStyle(arch.surface === "brutal", arch.button === "square"), ...(props.style ?? {}) }} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { arch } = useArch();
  return <textarea {...props} style={{ ...fieldStyle(arch.surface === "brutal", arch.button === "square"), resize: "none", ...(props.style ?? {}) }} />;
}

export function Toast({ message }: { message: string | null }) {
  const { arch, isMobile } = useArch();
  if (!message) return null;
  const brutal = arch.surface === "brutal";
  return (
    <div className={`pv-anim ${isMobile ? "absolute" : "fixed"} bottom-6 left-1/2 z-[60] -translate-x-1/2 px-4 py-2 text-[12px] font-semibold`} style={{ background: brutal ? "var(--accent)" : "var(--text)", color: brutal ? "var(--text)" : "var(--bg)", border: brutal ? "2px solid var(--text)" : undefined, boxShadow: brutal ? "3px 3px 0 0 var(--text)" : "0 10px 30px -10px rgba(0,0,0,.6)", borderRadius: brutal ? 0 : "var(--radius-pill)" }}>
      {message.startsWith("!") ? `⚠ ${message.slice(1)}` : `✓ ${message}`}
    </div>
  );
}

/* ==================================================================
   SELECTOR DE COLOR — 12 de la paleta + cualquier color
================================================================== */

export function ColorPicker({ value, onChange, hidePalette }: { value: ColorRef; onChange: (c: ColorRef) => void; hidePalette?: boolean }) {
  const custom = typeof value === "string";
  const hex = custom && isHexColor(value as string) ? (value as string) : "#6366f1";
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (custom ? (value as string) : "");

  return (
    <div className="flex flex-col gap-2.5">
      {!hidePalette && (
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, i) => i).map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`Color ${i + 1}`}
              onClick={() => {
                setDraft(null);
                onChange(i);
              }}
              className="h-7 w-full"
              style={{ background: chartColor(i), borderRadius: "var(--radius-sm)", outline: value === i ? "2px solid var(--text)" : "none", outlineOffset: 2 }}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label
          className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden"
          title="Elegir cualquier color"
          style={{
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-strong)",
            background: custom ? hex : "conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e)",
            outline: custom ? "2px solid var(--text)" : "none",
            outlineOffset: 2,
          }}
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => {
              setDraft(null);
              onChange(e.target.value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Selector de color libre"
          />
        </label>
        <Input
          value={shown}
          placeholder="#RRGGBB · cualquier color"
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            const w = v.startsWith("#") ? v : `#${v}`;
            if (isHexColor(w)) onChange(w);
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
    </div>
  );
}

/* ==================================================================
   SELECTOR VISUAL DE ICONOS
================================================================== */

export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const { arch } = useArch();
  const brutal = arch.surface === "brutal";
  const [q, setQ] = useState("");
  const n = q.trim().toLowerCase();
  const list = n ? CATEGORY_ICONS.filter((d) => d.label.toLowerCase().includes(n) || d.id.includes(n)) : CATEGORY_ICONS;
  return (
    <div className="flex flex-col gap-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar entre ${CATEGORY_ICONS.length} iconos…`} />
      <div className="lab-scroll grid max-h-52 grid-cols-9 gap-1.5 overflow-y-auto p-0.5">
        {list.map((d) => {
          const active = d.id === value;
          return (
            <button
              key={d.id}
              type="button"
              title={d.label}
              aria-label={`Icono ${d.label}`}
              onClick={() => onChange(d.id)}
              className="grid h-9 place-items-center transition-colors"
              style={{
                borderRadius: brutal ? 0 : "var(--radius-sm)",
                border: brutal ? "2px solid var(--text)" : `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                background: active ? "var(--accent-soft)" : "var(--surface-2)",
                color: active ? "var(--accent)" : "var(--muted)",
              }}
            >
              {d.icon}
            </button>
          );
        })}
        {list.length === 0 && <p className="pv-faint col-span-9 py-3 text-center text-[12px]">Ningún icono coincide con «{q}»</p>}
      </div>
    </div>
  );
}

/* ==================================================================
   EJES TEMPORALES
================================================================== */

export function TimeAxis({ period, count = 6 }: { period: string; count?: number }) {
  return (
    <div className="mt-3 flex justify-between">
      {axisTicks(period, count).map((t, i) => (
        <span key={i} className="pv-faint text-[10px]">{t}</span>
      ))}
    </div>
  );
}

export function BucketAxis({ labels }: { labels: string[] }) {
  const step = Math.max(1, Math.ceil(labels.length / 8));
  return (
    <div className="mt-2 flex">
      {labels.map((l, i) => (
        <span key={i} className="pv-faint flex-1 text-center text-[10px]" style={{ visibility: (labels.length - 1 - i) % step === 0 ? "visible" : "hidden" }}>{l}</span>
      ))}
    </div>
  );
}
