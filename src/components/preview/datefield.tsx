"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { TODAY, addDays, addMonthsYM, monthTitle } from "@/lib/series";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MARGIN = 12;
const GAP = 8;

interface CalendarPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "above" | "below" | "viewport";
}

/** All coordinates are relative to the layout viewport, including visualViewport offsets. */
export function positionCalendar(
  anchor: { left: number; top: number; bottom: number },
  viewport: { left: number; top: number; width: number; height: number },
  naturalHeight: number,
): CalendarPosition {
  const leftEdge = viewport.left + MARGIN;
  const topEdge = viewport.top + MARGIN;
  const rightEdge = viewport.left + viewport.width - MARGIN;
  const bottomEdge = viewport.top + viewport.height - MARGIN;
  const width = Math.max(1, Math.min(320, rightEdge - leftEdge));
  const usableHeight = Math.max(1, bottomEdge - topEdge);
  const left = Math.max(leftEdge, Math.min(anchor.left, rightEdge - width));
  const above = Math.max(0, anchor.top - GAP - topEdge);
  const below = Math.max(0, bottomEdge - anchor.bottom - GAP);

  // With a keyboard open or a short landscape viewport, use all available height
  // rather than putting an unusably small calendar beside the trigger.
  if (Math.max(above, below) < Math.min(naturalHeight, 240)) {
    const height = Math.min(naturalHeight, usableHeight);
    return { left, top: topEdge + (usableHeight - height) / 2, width, maxHeight: usableHeight, placement: "viewport" };
  }

  const useBelow = below >= naturalHeight || below >= above;
  const maxHeight = Math.min(usableHeight, useBelow ? below : above);
  const height = Math.min(naturalHeight, maxHeight);
  const targetTop = useBelow ? anchor.bottom + GAP : anchor.top - GAP - height;
  return {
    left,
    top: Math.max(topEdge, Math.min(targetTop, bottomEdge - height)),
    width,
    maxHeight,
    placement: useBelow ? "below" : "above",
  };
}

function dateLabel(value: string) {
  const label = new Intl.DateTimeFormat("es-ES", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`)).replace(/\./g, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function relativeLabel(value: string) {
  const diff = Math.round((Date.parse(`${TODAY}T12:00:00Z`) - Date.parse(`${value}T12:00:00Z`)) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff > 1) return `Hace ${diff} días`;
  return diff === -1 ? "Mañana" : `En ${-diff} días`;
}

/** A body portal must explicitly carry the active preview's theme and typography. */
function readTheme(anchor: HTMLElement): CSSProperties {
  const computed = window.getComputedStyle(anchor);
  const variables: Record<string, string> = {};
  for (let i = 0; i < computed.length; i++) {
    const name = computed[i];
    if (name.startsWith("--") && !name.startsWith("--tw-")) variables[name] = computed.getPropertyValue(name);
  }
  return { ...variables, fontFamily: computed.fontFamily, fontFeatureSettings: computed.fontFeatureSettings } as CSSProperties;
}

/** Reusable date input. Its calendar escapes modal overflow using a body portal. */
export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [theme, setTheme] = useState<CSSProperties | null>(null);
  const close = useCallback((restoreFocus = true) => {
    setTheme(null);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const toggle = () => {
    if (theme) close();
    else if (triggerRef.current) setTheme(readTheme(triggerRef.current));
  };

  return (
    <div className="min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={theme !== null}
        aria-controls={theme ? id : undefined}
        aria-label={`Elegir fecha: ${dateLabel(value)}`}
        onClick={toggle}
        className="flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover)]"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center" style={{ borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)" }}>
          <CalendarDays className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="pv-num block truncate text-[13px] font-semibold" style={{ color: "var(--text)" }}>{dateLabel(value)}</span>
          <span className="block text-[11px]" style={{ color: "var(--accent)" }}>{relativeLabel(value)}</span>
        </span>
      </button>
      {theme && createPortal(
        <CalendarPopover
          id={id}
          anchorRef={triggerRef}
          theme={theme}
          value={value}
          onClose={close}
          onSelect={(date) => { onChange(date); close(); }}
        />,
        document.body,
      )}
    </div>
  );
}

function CalendarPopover({ id, anchorRef, theme, value, onSelect, onClose }: {
  id: string;
  anchorRef: RefObject<HTMLButtonElement | null>;
  theme: CSSProperties;
  value: string;
  onSelect: (date: string) => void;
  onClose: (restoreFocus?: boolean) => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const focusDateRef = useRef<string | null>(null);
  const [view, setView] = useState(value.slice(0, 7));
  const [year, month] = view.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  // Reposition against the viewport, not the clipped/transformed ancestors.
  // No backdrop is used: the calendar and the form can both be scrolled normally.
  useLayoutEffect(() => {
    const popup = popupRef.current;
    const content = contentRef.current;
    const anchor = anchorRef.current;
    if (!popup || !content || !anchor) return;
    let frame = 0;
    const visual = window.visualViewport;
    const updatePosition = () => {
      const viewport = {
        left: visual?.offsetLeft ?? 0,
        top: visual?.offsetTop ?? 0,
        width: visual?.width ?? document.documentElement.clientWidth,
        height: visual?.height ?? window.innerHeight,
      };
      const rect = anchor.getBoundingClientRect();
      const scroller = anchor.closest(".lab-scroll");
      const scrollRect = scroller?.getBoundingClientRect();
      const visibleTop = Math.max(viewport.top, scrollRect?.top ?? viewport.top);
      const visibleBottom = Math.min(viewport.top + viewport.height, scrollRect?.bottom ?? viewport.top + viewport.height);
      if (rect.bottom < visibleTop || rect.top > visibleBottom) {
        onClose(false);
        return;
      }
      // Set width before measuring, as it affects wrapping on very small screens.
      popup.style.width = `${Math.max(1, Math.min(320, viewport.width - MARGIN * 2))}px`;
      const position = positionCalendar(rect, viewport, content.scrollHeight + 2);
      Object.assign(popup.style, {
        left: `${position.left}px`, top: `${position.top}px`, width: `${position.width}px`,
        maxHeight: `${position.maxHeight}px`, visibility: "visible",
      });
      popup.dataset.placement = position.placement;
    };
    const schedule = (event?: Event) => {
      if (event?.type === "scroll" && event.target instanceof Node && popup.contains(event.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };
    const observer = new ResizeObserver(() => schedule());
    observer.observe(content);
    observer.observe(anchor);
    updatePosition();
    popup.querySelector<HTMLButtonElement>(`[data-date="${value}"]`)?.focus({ preventScroll: true });
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    visual?.addEventListener("resize", schedule);
    visual?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      visual?.removeEventListener("resize", schedule);
      visual?.removeEventListener("scroll", schedule);
    };
  }, [anchorRef, onClose, value]);

  useEffect(() => {
    const outside = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !popupRef.current?.contains(target) && !anchorRef.current?.contains(target)) onClose(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [anchorRef, onClose]);

  useLayoutEffect(() => {
    const target = focusDateRef.current;
    if (!target) return;
    popupRef.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus({ preventScroll: true });
    focusDateRef.current = null;
  }, [view]);

  const navigateDay = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in delta)) return;
    event.preventDefault();
    const next = addDays(date, delta[event.key]);
    if (next.slice(0, 7) === view) popupRef.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus({ preventScroll: true });
    else { focusDateRef.current = next; setView(next.slice(0, 7)); }
  };

  return (
    <div
      ref={popupRef}
      id={id}
      role="dialog"
      aria-label="Elegir fecha"
      className="pv-root lab-scroll"
      style={{
        ...theme, position: "fixed", zIndex: 1000, width: 320, left: 0, top: 0,
        visibility: "hidden", maxWidth: "calc(100vw - 24px)", boxSizing: "border-box",
        overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", touchAction: "pan-y",
        background: "var(--bg, #10131c)", color: "var(--text, #f1f5f9)",
        border: "1px solid var(--border-strong, #334155)", borderRadius: "var(--radius-lg, 16px)",
        boxShadow: "0 24px 64px -20px rgba(0,0,0,.65)",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div ref={contentRef} className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="pv-muted text-[10px] font-semibold uppercase tracking-[0.12em]">Selecciona una fecha</span>
          <button type="button" onClick={() => onClose()} aria-label="Cerrar calendario" className="grid h-7 w-7 place-items-center rounded-lg hover:bg-[var(--hover)]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mb-2 flex items-center justify-between gap-1">
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label="Año anterior" onClick={() => setView(addMonthsYM(view, -12))} className="grid h-8 w-7 place-items-center rounded-lg hover:bg-[var(--hover)]" style={{ color: "var(--muted)" }}><ChevronsLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Mes anterior" onClick={() => setView(addMonthsYM(view, -1))} className="grid h-8 w-7 place-items-center rounded-lg hover:bg-[var(--hover)]"><ChevronLeft className="h-4 w-4" /></button>
          </div>
          <p aria-live="polite" className="pv-display min-w-0 text-center text-[13px] font-bold capitalize tracking-tight">{monthTitle(view)}</p>
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label="Mes siguiente" onClick={() => setView(addMonthsYM(view, 1))} className="grid h-8 w-7 place-items-center rounded-lg hover:bg-[var(--hover)]"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" aria-label="Año siguiente" onClick={() => setView(addMonthsYM(view, 12))} className="grid h-8 w-7 place-items-center rounded-lg hover:bg-[var(--hover)]" style={{ color: "var(--muted)" }}><ChevronsRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((day) => <span key={day} className="pv-faint py-1 text-center text-[10px] font-bold">{day}</span>)}
          {cells.map((day, i) => {
            if (day === null) return <span key={`empty-${i}`} />;
            const date = `${view}-${String(day).padStart(2, "0")}`;
            const selected = date === value;
            return (
              <button
                key={date}
                type="button"
                data-date={date}
                aria-label={dateLabel(date)}
                aria-pressed={selected}
                aria-current={date === TODAY ? "date" : undefined}
                onClick={() => onSelect(date)}
                onKeyDown={(event) => navigateDay(event, date)}
                className="pv-num relative grid h-9 min-w-0 place-items-center text-[12.5px] font-medium transition-colors hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                style={{ borderRadius: 10, background: selected ? "var(--accent)" : undefined, color: selected ? "var(--accent-fg)" : "var(--text)", fontWeight: selected ? 700 : 500 }}
              >
                {day}
                {date === TODAY && !selected && <span aria-hidden className="absolute bottom-1 h-1 w-1 rounded-full" style={{ background: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t pt-2.5" style={{ borderColor: "var(--border)" }}>
          {[["Hoy", TODAY], ["Ayer", addDays(TODAY, -1)], ["Hace 7 días", addDays(TODAY, -7)]].map(([label, date]) => (
            <button key={label} type="button" onClick={() => onSelect(date)} className="min-w-0 flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-[11px] font-semibold" style={{ background: "var(--surface-2)", color: date === value ? "var(--accent)" : "var(--muted)", border: "1px solid var(--border)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
