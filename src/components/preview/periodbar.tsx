"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DATA_FROM,
  DATA_TO,
  addMonthsYM,
  isMonthPeriod,
  isRangePeriod,
  monthOf,
  monthPeriod,
  monthShortLabel,
  monthTitle,
  periodDays,
  periodLabel,
  periodRange,
  rangePeriod,
} from "@/lib/series";
import { usePreview } from "./state";

const MIN_YM = DATA_FROM.slice(0, 7);
const MAX_YM = DATA_TO.slice(0, 7);
const MIN_YEAR = Number(MIN_YM.slice(0, 4));
const MAX_YEAR = Number(MAX_YM.slice(0, 4));
const inData = (ym: string) => ym >= MIN_YM && ym <= MAX_YM;

const CHIPS: { id: string; label: string }[] = [
  { id: "3M", label: "3M" },
  { id: "6M", label: "6M" },
  { id: "1A", label: "1A" },
  { id: "MAX", label: "Todo" },
];

const popStyle = {
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "0 30px 60px -24px rgba(0,0,0,.7)",
  backdropFilter: "blur(14px)",
} as const;

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center transition-colors enabled:hover:bg-[var(--hover)] disabled:opacity-30"
      style={{ borderRadius: 10, color: "var(--text)" }}
    >
      {children}
    </button>
  );
}

/**
 * Selector de periodo de análisis: flechas para cambiar de mes, selector de mes con calendario,
 * rango personalizado y accesos rápidos. Afecta a toda la pestaña.
 */
export function PeriodBar() {
  const { period, setPeriod } = usePreview();
  const [open, setOpen] = useState<null | "month" | "range">(null);
  const [viewYear, setViewYear] = useState(MAX_YEAR);
  const { from, to } = periodRange(period);
  const curYM = isMonthPeriod(period) ? monthOf(period) : to.slice(0, 7);
  const [rFrom, setRFrom] = useState(from);
  const [rTo, setRTo] = useState(to);

  const step = (d: number) => {
    const next = addMonthsYM(curYM, d);
    if (inData(next)) setPeriod(monthPeriod(next));
  };

  const toggle = (which: "month" | "range") => {
    if (open === which) return setOpen(null);
    if (which === "month") setViewYear(Number(curYM.slice(0, 4)));
    if (which === "range") {
      setRFrom(from);
      setRTo(to);
    }
    setOpen(which);
  };

  const applyRange = () => {
    if (!rFrom || !rTo) return;
    setPeriod(rangePeriod(rFrom, rTo));
    setOpen(null);
  };

  return (
    <div className="relative z-30">
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--panel-shadow)", backdropFilter: "var(--blur)" }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center" style={{ borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)" }}>
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>Periodo de análisis</p>
            <p className="pv-faint truncate text-[11px]">{periodLabel(period)} · {periodDays(period)} días</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 14 }}>
            <IconBtn label="Mes anterior" disabled={!inData(addMonthsYM(curYM, -1))} onClick={() => step(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </IconBtn>
            <button
              type="button"
              aria-expanded={open === "month"}
              onClick={() => toggle("month")}
              className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={{ borderRadius: 10, background: open === "month" || isMonthPeriod(period) ? "var(--accent-soft)" : "transparent", color: "var(--text)", minWidth: 150, justifyContent: "center" }}
            >
              <CalendarDays className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
              <span className="capitalize">{isMonthPeriod(period) ? monthTitle(monthOf(period)) : "Elegir mes"}</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{ color: "var(--muted)", transform: open === "month" ? "rotate(180deg)" : undefined }} />
            </button>
            <IconBtn label="Mes siguiente" disabled={!inData(addMonthsYM(curYM, 1))} onClick={() => step(1)}>
              <ChevronRight className="h-4 w-4" />
            </IconBtn>
          </div>

          <div className="flex items-center gap-1 p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 14 }}>
            {CHIPS.map((c) => {
              const on = period === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPeriod(c.id)}
                  className="px-3 py-1.5 text-[12px] font-semibold transition-all"
                  style={{ borderRadius: 10, background: on ? "var(--accent)" : "transparent", color: on ? "var(--accent-fg)" : "var(--muted)", boxShadow: on ? "var(--accent-glow)" : undefined }}
                >
                  {c.label}
                </button>
              );
            })}
            <button
              type="button"
              aria-expanded={open === "range"}
              onClick={() => toggle("range")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-all"
              style={{ borderRadius: 10, background: isRangePeriod(period) || open === "range" ? "var(--accent)" : "transparent", color: isRangePeriod(period) || open === "range" ? "var(--accent-fg)" : "var(--muted)", boxShadow: isRangePeriod(period) ? "var(--accent-glow)" : undefined }}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Rango
            </button>
          </div>
        </div>
      </div>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} aria-hidden />}

      {open === "month" && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[320px] p-4" style={popStyle} onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <IconBtn label="Año anterior" disabled={viewYear <= MIN_YEAR} onClick={() => setViewYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </IconBtn>
            <p className="pv-display text-[15px] font-bold tracking-tight">{viewYear}</p>
            <IconBtn label="Año siguiente" disabled={viewYear >= MAX_YEAR} onClick={() => setViewYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </IconBtn>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => {
              const ym = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
              const enabled = inData(ym);
              const active = isMonthPeriod(period) && monthOf(period) === ym;
              const current = ym === MAX_YM;
              return (
                <button
                  key={ym}
                  type="button"
                  disabled={!enabled}
                  onClick={() => {
                    setPeriod(monthPeriod(ym));
                    setOpen(null);
                  }}
                  className="relative py-2.5 text-[12.5px] font-semibold transition-all enabled:hover:scale-[1.04] disabled:opacity-25"
                  style={{
                    borderRadius: 12,
                    background: active ? "var(--accent)" : "var(--surface-2)",
                    color: active ? "var(--accent-fg)" : "var(--text)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    boxShadow: active ? "var(--accent-glow)" : undefined,
                  }}
                >
                  {monthShortLabel(ym)}
                  {current && !active && <span aria-hidden className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: "var(--accent)" }} />}
                </button>
              );
            })}
          </div>
          <p className="pv-faint mt-3 text-center text-[10.5px]">Datos disponibles de {monthTitle(MIN_YM)} a {monthTitle(MAX_YM)}</p>
        </div>
      )}

      {open === "range" && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] p-4" style={popStyle} onClick={(e) => e.stopPropagation()}>
          <p className="pv-display mb-3 text-[15px] font-bold tracking-tight">Rango personalizado</p>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              ["Desde", rFrom, setRFrom],
              ["Hasta", rTo, setRTo],
            ] as const).map(([label, value, set]) => (
              <label key={label} className="block">
                <span className="pv-muted mb-1 block text-[10.5px] font-bold uppercase tracking-[0.1em]">{label}</span>
                <input
                  type="date"
                  value={value}
                  min={DATA_FROM}
                  max={DATA_TO}
                  onChange={(e) => e.target.value && set(e.target.value)}
                  className="w-full px-2.5 py-2 text-[12.5px] outline-none"
                  style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 12 }}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              ["Último trimestre", 90],
              ["Último semestre", 182],
              ["Último año", 365],
            ].map(([label, days]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const end = DATA_TO;
                  const start = new Date(Date.parse(end + "T12:00:00Z") - (Number(days) - 1) * 86400000).toISOString().slice(0, 10);
                  setRFrom(start);
                  setRTo(end);
                }}
                className="px-2.5 py-1 text-[11px] font-semibold"
                style={{ borderRadius: 999, background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)" }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="pv-faint text-[11px]">{rFrom && rTo ? `${Math.abs(Math.round((Date.parse(rTo) - Date.parse(rFrom)) / 86400000)) + 1} días` : "Elige las dos fechas"}</p>
            <button
              type="button"
              disabled={!rFrom || !rTo}
              onClick={applyRange}
              className="px-4 py-2 text-[12.5px] font-bold disabled:opacity-40"
              style={{ borderRadius: 12, background: "var(--accent)", color: "var(--accent-fg)", boxShadow: "var(--accent-glow)" }}
            >
              Aplicar rango
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
