"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { BarChart3, Bell, Briefcase, Check, ChevronDown, ChevronRight, ChevronUp, FolderTree, LayoutDashboard, PiggyBank, Plus, Search, Settings, Wallet } from "lucide-react";
import type { DesignConfig } from "@/lib/themes";
import { toCssVars } from "@/lib/themes";
import { NAV, type NavId } from "@/lib/mock";
import { chartColor } from "@/lib/colors";
import { iconNode } from "@/lib/icons";
import { formatEUR, formatEUR0, formatPct } from "@/lib/format";
import { ArchProvider, useArch, usePreview } from "./state";
import { Btn, Toast } from "./primitives";
import { ModalHost } from "./forms";
import { usePaletteLibrary } from "./palettes";
import { AccountsView, PanelView, PortfolioView, useTotals } from "./views-main";
import { useIsNarrow } from "./use-viewport";
import { CategoriesView, ChartsView, SettingsView } from "./views-extra";

const ICON: Record<string, ReactNode> = {
  grid: <LayoutDashboard className="h-[17px] w-[17px]" />,
  briefcase: <Briefcase className="h-[17px] w-[17px]" />,
  wallet: <Wallet className="h-[17px] w-[17px]" />,
  folder: <FolderTree className="h-[17px] w-[17px]" />,
  chart: <BarChart3 className="h-[17px] w-[17px]" />,
  settings: <Settings className="h-[17px] w-[17px]" />,
};

export function AppPreview({ cfg, onConfigChange, autoResponsive = false }: {
  cfg: DesignConfig;
  onConfigChange?: (p: Partial<DesignConfig>) => void;
  /** Adapta la estructura al ancho real de la ventana (sin marco de teléfono). */
  autoResponsive?: boolean;
}) {
  const narrow = useIsNarrow();
  /* Con `autoResponsive` manda el ancho real de la ventana; en el laboratorio, el dispositivo elegido. */
  const isMobile = autoResponsive ? narrow : cfg.device === "mobile";
  return (
    <ArchProvider cfg={cfg} patchConfig={onConfigChange} isMobile={isMobile}>
      <Frame fullBleed={isMobile && autoResponsive} />
    </ArchProvider>
  );
}

function CurrentView() {
  const { route } = usePreview();
  switch (route.page) {
    case "cuentas": return <AccountsView />;
    case "inversiones": return <PortfolioView />;
    case "categorias": return <CategoriesView />;
    case "graficas": return <ChartsView />;
    case "ajustes": return <SettingsView />;
    default: return <PanelView />;
  }
}

function useNav() {
  const { route, go, openModal } = usePreview();
  return { current: route.page, nav: (id: NavId) => go({ page: id }), newTx: () => openModal({ kind: "tx" }) };
}

/**
 * Cualquier cambio de pantalla (pestaña, cuenta, producto o categoría) vuelve a
 * dejar la vista arriba: se resetea el scroll de la ventana y el de los
 * contenedores con scroll propio (`.lab-scroll`), sin tocar los modales.
 */
function ScrollToTop() {
  const { route } = usePreview();
  const { page, accountId, productId, categoryId } = route;
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    for (const el of document.querySelectorAll<HTMLElement>(".lab-scroll")) el.scrollTop = 0;
  }, [page, accountId, productId, categoryId]);
  return null;
}

function Frame({ fullBleed = false }: { fullBleed?: boolean }) {
  const { cfg, arch, isMobile } = useArch();
  const { toast } = usePreview();
  const { resolve } = usePaletteLibrary();
  const vars = toCssVars(cfg, resolve(cfg.paletteKey)) as CSSProperties;

  if (isMobile) {
    /* Pantalla estrecha: la app ocupa toda la ventana, sin bisel ni marco. */
    if (fullBleed) {
      return (
        <div className="pv-root pv-mesh relative w-full overflow-hidden" style={{ ...vars, backgroundAttachment: "scroll", height: "100dvh" }}>
          <ScrollToTop />
          <div className="lab-scroll flex h-full flex-col overflow-y-auto">
            <MobileHeader />
            <main className="flex-1 px-3.5 pb-28 pt-3.5"><CurrentView /></main>
          </div>
          <MobileNav />
          <ModalHost />
          <Toast message={toast} />
        </div>
      );
    }
    /* Vista previa de teléfono dentro de una pantalla ancha (laboratorio). */
    return (
      <div className="flex justify-center">
        <div className="pv-root pv-mesh relative w-full max-w-[400px] overflow-hidden" style={{ ...vars, backgroundAttachment: "scroll", borderRadius: 34, border: "1px solid var(--border-strong)", boxShadow: "0 40px 90px -40px rgba(0,0,0,.85)", height: 800 }}>
          <ScrollToTop />
          <div className="lab-scroll flex h-full flex-col overflow-y-auto">
            <MobileHeader />
            <main className="flex-1 px-3.5 pb-28 pt-3.5"><CurrentView /></main>
          </div>
          <MobileNav />
          <ModalHost />
          <Toast message={toast} />
        </div>
      </div>
    );
  }

  const shell = arch.shell;
  return (
    <div className="pv-root pv-mesh relative w-full overflow-clip" style={{ ...vars, minHeight: "100dvh" }}>
      <ScrollToTop />
      {shell === "sidebar" && <SidebarShell><CurrentView /></SidebarShell>}
      {shell === "floating" && <FloatingShell><CurrentView /></FloatingShell>}
      {shell === "dock" && <DockShell><CurrentView /></DockShell>}
      {shell === "appbar" && <AppBarShell><CurrentView /></AppBarShell>}
      {shell === "explorer" && <ExplorerShell><CurrentView /></ExplorerShell>}
      {shell === "feed" && <FeedShell><CurrentView /></FeedShell>}
      <ModalHost />
      <Toast message={toast} />
    </div>
  );
}

/* ============================ 1 · SIDEBAR (tarjetas clásicas) ============================ */

function SidebarShell({ children }: { children: ReactNode }) {
  const { current, nav, newTx } = useNav();
  const { accounts, go, openModal } = usePreview();
  const { net } = useTotals();
  return (
    <div className="flex">
      <aside className="flex w-[232px] shrink-0 flex-col border-r" style={{ background: "var(--sidebar)", borderColor: "var(--border)", backdropFilter: "var(--blur)" }}>
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="pv-btn grid h-8 w-8 place-items-center"><PiggyBank className="h-4 w-4" strokeWidth={2.2} /></span>
          <div><p className="pv-display text-[14px] font-bold leading-tight" style={{ color: "var(--text)" }}>Mi Patrimonio</p><p className="pv-faint text-[10px]">v2 · tarjetas clásicas</p></div>
        </div>
        <div className="pv-inset mx-3 mb-4 p-3">
          <p className="pv-muted text-[10px] font-semibold uppercase tracking-[0.12em]">Patrimonio neto</p>
          <p className="pv-num mt-1 text-[19px] font-bold leading-none" style={{ color: "var(--text)" }}>{formatEUR0(net)}</p>
          <p className="mt-1.5 text-[10px]"><span className="pv-chip-pos pv-num px-1.5 py-0.5 font-bold">+3,42 %</span> <span className="pv-faint">este mes</span></p>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map((n) => (
            <button key={n.id} type="button" onClick={() => nav(n.id)} className={`${n.id === current ? "pv-nav-item-active" : "pv-nav-item"} flex items-center gap-2.5 px-3 py-2 text-[13px] font-semibold`}>{ICON[n.icon]}{n.label}</button>
          ))}
        </nav>
        {(["corriente", "inversion"] as const).map((k) => (
          <div key={k}>
            <p className="pv-faint mt-4 px-4 text-[10px] font-bold uppercase tracking-[0.14em]">{k === "corriente" ? "Corrientes" : "Inversión"}</p>
            <ul className="mt-1 px-3">
              {accounts.filter((a) => a.kind === k && !a.archived).map((a) => (
                <li key={a.id}><button type="button" onClick={() => go({ page: "cuentas", accountId: a.id })} className="pv-nav-item flex w-full items-center justify-between gap-2 px-2.5 py-1.5"><span className="truncate text-[11.5px]">{a.name}</span><span className="pv-num shrink-0 text-[11px] font-semibold" style={{ color: "var(--text)" }}>{formatEUR0(a.balance)}</span></button></li>
              ))}
            </ul>
          </div>
        ))}
        <div className="mt-auto p-3"><Btn full icon={<Plus className="h-3.5 w-3.5" />} onClick={newTx}>Nueva transacción</Btn></div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-6 py-3" style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}>
          <button type="button" onClick={() => openModal({ kind: "search" })} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)" }}><Search className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} /><span className="pv-faint text-[12px]">Buscar movimientos, productos o cuentas…</span></button>
          <button type="button" onClick={() => openModal({ kind: "notifications" })} className="pv-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--pos)" }} /> Precios al día</button>
          <button type="button" aria-label="Avisos" onClick={() => openModal({ kind: "notifications" })} className="pv-btn-ghost grid h-8 w-8 place-items-center"><Bell className="h-4 w-4" /></button>
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

/* ============================ 2 · DOCK (suave neumórfico) ============================ */

function DockShell({ children }: { children: ReactNode }) {
  const { current, nav, newTx } = useNav();
  const { openModal } = usePreview();
  const { net } = useTotals();
  return (
    <div className="mx-auto flex min-h-[760px] w-full flex-col px-4 pt-6 sm:px-6 lg:px-10 2xl:px-16">
      <header className="mb-6 flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center" style={{ background: "var(--bg)", boxShadow: "var(--neu-shadow-sm)", borderRadius: 999, color: "var(--accent)" }}><PiggyBank className="h-5 w-5" /></span>
        <div>
          <p className="pv-faint text-[11px] font-semibold uppercase tracking-[0.14em]">Mi Patrimonio</p>
          <p className="pv-display pv-num text-[22px] font-bold leading-tight" style={{ color: "var(--text)" }}>{formatEUR(net)} <span className="text-[12px]" style={{ color: "var(--pos)" }}>{formatPct(3.42)}</span></p>
        </div>
        <button type="button" onClick={() => openModal({ kind: "search" })} className="ml-auto flex w-full max-w-sm items-center gap-2 px-4 py-2.5 text-left" style={{ background: "var(--surface-2)", boxShadow: "var(--neu-inset)", borderRadius: 999 }}>
          <Search className="h-4 w-4" style={{ color: "var(--faint)" }} /><span className="pv-faint text-[12.5px]">Buscar…</span>
        </button>
        <button type="button" aria-label="Avisos" onClick={() => openModal({ kind: "notifications" })} className="grid h-11 w-11 place-items-center" style={{ background: "var(--bg)", boxShadow: "var(--neu-shadow-sm)", borderRadius: 999, color: "var(--muted)" }}><Bell className="h-4 w-4" /></button>
        <button type="button" aria-label="Ajustes" onClick={() => nav("ajustes")} className="pv-num grid h-11 w-11 place-items-center text-[12px] font-bold" style={{ background: "var(--bg)", boxShadow: "var(--neu-shadow-sm)", borderRadius: 999, color: "var(--accent)" }}>RR</button>
      </header>
      <main className="flex-1 pb-6">{children}</main>
      <div className="sticky bottom-4 z-30 mx-auto mb-4 w-fit">
        <nav className="flex items-center gap-1 px-2.5 py-2" style={{ background: "var(--bg)", boxShadow: "var(--neu-shadow)", borderRadius: 30 }}>
          {NAV.map((n) => {
            const active = n.id === current;
            return (
              <button key={n.id} type="button" onClick={() => nav(n.id)} className="flex flex-col items-center gap-1 px-4 py-2 text-[10px] font-bold" style={{ borderRadius: 22, color: active ? "var(--accent)" : "var(--muted)", background: active ? "var(--surface-2)" : "transparent", boxShadow: active ? "var(--neu-inset)" : undefined }}>
                {ICON[n.icon]}{n.label}
              </button>
            );
          })}
          <button type="button" onClick={newTx} aria-label="Nuevo movimiento" className="ml-1 grid h-12 w-12 place-items-center" style={{ background: "var(--bg)", boxShadow: "var(--neu-shadow-sm)", borderRadius: 999, color: "var(--accent)" }}><Plus className="h-5 w-5" strokeWidth={2.8} /></button>
        </nav>
      </div>
    </div>
  );
}

/* ============================ 3 · APP BAR (material tonal) ============================ */

function AppBarShell({ children }: { children: ReactNode }) {
  const { current, nav, newTx } = useNav();
  const { openModal } = usePreview();
  return (
    <div className="flex min-h-[760px] flex-col">
      <header className="px-6 pb-3 pt-4" style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--bg))" }}>
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 place-items-center" style={{ background: "var(--accent)", color: "var(--accent-fg)", borderRadius: 16 }}><PiggyBank className="h-5 w-5" /></span>
          <p className="pv-display text-[20px] font-semibold" style={{ color: "var(--text)" }}>Mi Patrimonio</p>
          <button type="button" onClick={() => openModal({ kind: "search" })} className="ml-auto flex w-full max-w-md items-center gap-2 px-4 py-2.5 text-left" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--surface))", borderRadius: 999 }}>
            <Search className="h-4 w-4" style={{ color: "var(--muted)" }} /><span className="pv-muted text-[13px]">Buscar en Mi Patrimonio</span>
          </button>
          <button type="button" aria-label="Avisos" onClick={() => openModal({ kind: "notifications" })} className="grid h-10 w-10 place-items-center" style={{ borderRadius: 999, color: "var(--muted)" }}><Bell className="h-5 w-5" /></button>
          <button type="button" aria-label="Ajustes" onClick={() => nav("ajustes")} className="pv-num grid h-10 w-10 place-items-center text-[12px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 999 }}>RR</button>
        </div>
        <nav className="lab-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
          {NAV.map((n) => {
            const active = n.id === current;
            return (
              <button key={n.id} type="button" onClick={() => nav(n.id)} className="flex shrink-0 items-center gap-2 px-4 py-2 text-[13px] font-semibold" style={{ borderRadius: 12, background: active ? "var(--accent-soft)" : "transparent", color: active ? "var(--accent)" : "var(--muted)", border: `1px solid ${active ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--border-strong)"}` }}>
                {ICON[n.icon]}{n.label}
              </button>
            );
          })}
        </nav>
      </header>
      <main className="w-full flex-1 p-4 sm:p-6 lg:px-10 2xl:px-16">{children}</main>
      <div className="sticky bottom-6 z-30 flex justify-end pb-6 pr-6">
        <button type="button" onClick={newTx} className="flex items-center gap-2 px-5 py-4 text-[14px] font-bold" style={{ background: "var(--accent)", color: "var(--accent-fg)", borderRadius: 20, boxShadow: "var(--accent-glow)" }}>
          <Plus className="h-5 w-5" strokeWidth={2.8} /> Nuevo movimiento
        </button>
      </div>
    </div>
  );
}

/* ============================ 4 · EXPLORADOR (árbol + pestañas) ============================ */

function ExplorerShell({ children }: { children: ReactNode }) {
  const { current, nav, newTx } = useNav();
  const { accounts, categories, holdings, route, go, openModal } = usePreview();
  const { net } = useTotals();
  const [open, setOpen] = useState<Record<string, boolean>>({ cur: true, inv: true, cat: true });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const mono = { fontFamily: "var(--font-num)" } as const;
  const pageLabel = NAV.find((n) => n.id === current)?.label ?? "Panel";
  const crumb = route.accountId ? accounts.find((a) => a.id === route.accountId)?.name : route.categoryId ? categories.find((c) => c.id === route.categoryId)?.name : route.productId ? holdings.find((h) => h.id === route.productId)?.ticker : undefined;

  const group = (key: string, title: string, rows: { id: number; name: string; right: string; color: ReactNode; onClick: () => void; active?: boolean }[]) => (
    <div>
      <button type="button" onClick={() => toggle(key)} className="flex w-full items-center gap-1 px-2 py-1 text-left text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--muted)", ...mono }}>
        {open[key] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}<span className="pv-faint ml-auto font-normal">{rows.length}</span>
      </button>
      {open[key] && (
        <ul className="ml-3 border-l" style={{ borderColor: "var(--border-strong)" }}>
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={r.onClick} className="pv-hit flex w-full items-center gap-2 py-1 pl-3 pr-2 text-left text-[11.5px]" style={{ color: r.active ? "var(--accent)" : "var(--text)", background: r.active ? "var(--accent-soft)" : undefined, ...mono }}>
                {r.color}
                <span className="truncate">{r.name}</span>
                <span className="pv-num pv-faint ml-auto shrink-0 text-[10.5px]">{r.right}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="flex min-h-[760px] flex-col">
      <div className="flex flex-1">
        <nav className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r py-2" style={{ background: "var(--sidebar)", borderColor: "var(--border-strong)" }}>
          {NAV.map((n) => (
            <button key={n.id} type="button" title={n.label} aria-label={n.label} onClick={() => nav(n.id)} className="relative grid h-10 w-10 place-items-center" style={{ color: n.id === current ? "var(--text)" : "var(--faint)" }}>
              {n.id === current && <span className="absolute inset-y-1.5 left-0 w-[2px]" style={{ background: "var(--accent)" }} />}
              {ICON[n.icon]}
            </button>
          ))}
          <button type="button" aria-label="Buscar" onClick={() => openModal({ kind: "search" })} className="mt-auto grid h-10 w-10 place-items-center" style={{ color: "var(--faint)" }}><Search className="h-[17px] w-[17px]" /></button>
          <button type="button" aria-label="Nuevo movimiento" onClick={newTx} className="grid h-9 w-9 place-items-center" style={{ background: "var(--accent)", color: "var(--accent-fg)", borderRadius: 4 }}><Plus className="h-4 w-4" strokeWidth={2.8} /></button>
        </nav>
        <aside className="w-[252px] shrink-0 border-r py-2" style={{ background: "var(--sidebar)", borderColor: "var(--border-strong)" }}>
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--faint)", ...mono }}>Explorador · Mi Patrimonio</p>
          <div className="flex flex-col gap-1.5">
            {group("cur", "cuentas_corrientes", accounts.filter((a) => a.kind === "corriente" && !a.archived).map((a) => ({ id: a.id, name: a.name, right: formatEUR0(a.balance), color: <span className="h-2 w-2 shrink-0" style={{ background: chartColor(a.colorIdx), borderRadius: 2 }} />, active: route.accountId === a.id, onClick: () => go({ page: "cuentas", accountId: a.id }) })))}
            {group("inv", "cuentas_inversion", accounts.filter((a) => a.kind === "inversion" && !a.archived).map((a) => ({ id: a.id, name: a.name, right: formatEUR0(a.balance), color: <span className="h-2 w-2 shrink-0" style={{ background: chartColor(a.colorIdx), borderRadius: 2 }} />, active: route.accountId === a.id, onClick: () => go({ page: "cuentas", accountId: a.id }) })))}
            {group("cat", "categorias", categories.map((c) => ({ id: c.id, name: c.name, right: `${c.subcategories.length}`, color: <span className="shrink-0" style={{ color: chartColor(c.colorIdx) }}>{iconNode(c.icon)}</span>, active: route.categoryId === c.id, onClick: () => openModal({ kind: "categoryTx", categoryId: c.id }) })))}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-end border-b" style={{ background: "var(--sidebar)", borderColor: "var(--border-strong)" }}>
            <div className="flex items-center gap-2 border-r px-4 py-2 text-[12px]" style={{ borderColor: "var(--border-strong)", background: "var(--bg)", boxShadow: "inset 0 2px 0 var(--accent)", color: "var(--text)", ...mono }}>
              {ICON[NAV.find((n) => n.id === current)?.icon ?? "grid"]}
              {pageLabel.toLowerCase()}.view
              <span className="pv-faint ml-2">×</span>
            </div>
            <p className="ml-auto truncate px-4 py-2 text-[11px]" style={{ color: "var(--faint)", ...mono }}>Mi Patrimonio › {pageLabel}{crumb ? ` › ${crumb}` : ""}</p>
          </div>
          <main className="min-w-0 flex-1 p-4">{children}</main>
        </div>
      </div>
      <footer className="flex items-center gap-4 px-3 py-1 text-[10.5px]" style={{ background: "var(--accent)", color: "var(--accent-fg)", ...mono }}>
        <span>● patrimonio {formatEUR0(net)}</span>
        <span>{accounts.filter((a) => !a.archived).length} cuentas</span>
        <span>{holdings.length} productos</span>
        <span className="ml-auto">es-ES · EUR · UTF-8</span>
      </footer>
    </div>
  );
}

/* ============================ 5 · FLOATING (app bancaria) ============================ */

function FloatingShell({ children }: { children: ReactNode }) {
  const { current, nav, newTx } = useNav();
  const { openModal } = usePreview();
  return (
    <div className="relative mx-auto min-h-[760px] w-full px-4 pb-10 pt-5 sm:px-6 lg:px-10 2xl:px-16">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center" style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 999 }}><PiggyBank className="h-4 w-4" /></span>
          <div><p className="pv-faint text-[11px]">Hola, Raúl 👋</p><p className="text-[14px] font-bold" style={{ color: "var(--text)" }}>Mi Patrimonio</p></div>
        </div>
        <nav className="flex items-center gap-1 p-1" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999, backdropFilter: "var(--blur)" }}>
          {NAV.map((n) => (
            <button key={n.id} type="button" onClick={() => nav(n.id)} className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold" style={{ borderRadius: 999, background: n.id === current ? "var(--accent)" : "transparent", color: n.id === current ? "var(--accent-fg)" : "var(--muted)" }}>{ICON[n.icon]}{n.id === current && n.label}</button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Buscar" onClick={() => openModal({ kind: "search" })} className="grid h-9 w-9 place-items-center" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999 }}><Search className="h-4 w-4" style={{ color: "var(--muted)" }} /></button>
          <button type="button" aria-label="Avisos" onClick={() => openModal({ kind: "notifications" })} className="grid h-9 w-9 place-items-center" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999 }}><Bell className="h-4 w-4" style={{ color: "var(--muted)" }} /></button>
          <button type="button" aria-label="Ajustes" onClick={() => nav("ajustes")} className="pv-num grid h-9 w-9 place-items-center text-[11px] font-bold" style={{ background: "var(--accent)", color: "var(--accent-fg)", borderRadius: 999 }}>RR</button>
        </div>
      </header>
      <main>{children}</main>
      <div className="sticky bottom-6 z-30 mt-4 flex justify-end">
        <button type="button" onClick={newTx} className="flex items-center gap-2 px-5 py-3 text-[13px] font-bold" style={{ background: "var(--accent)", color: "var(--accent-fg)", borderRadius: 999, boxShadow: "var(--accent-glow)" }}><Plus className="h-4 w-4" strokeWidth={2.6} /> Añadir</button>
      </div>
    </div>
  );
}

/* ============================ 6 · FEED (historias y línea de tiempo) ============================ */

function FeedShell({ children }: { children: ReactNode }) {
  const { current, nav, newTx } = useNav();
  const { openModal } = usePreview();
  const { net } = useTotals();
  return (
    <div className="mx-auto flex min-h-[760px] w-full max-w-[1600px] flex-col px-4 pt-4 sm:px-6 lg:px-10">
      <header className="mb-4 flex items-center gap-3">
        <button type="button" aria-label="Ajustes" onClick={() => nav("ajustes")} className="pv-num grid h-11 w-11 place-items-center text-[13px] font-bold" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "var(--accent-fg)", borderRadius: 999, boxShadow: "var(--accent-glow)" }}>RR</button>
        <div>
          <p className="pv-faint text-[11px]">Hola, Raúl 👋</p>
          <p className="pv-display pv-num text-[18px] font-bold leading-tight" style={{ color: "var(--text)" }}>{formatEUR(net)}</p>
        </div>
        <button type="button" aria-label="Buscar" onClick={() => openModal({ kind: "search" })} className="ml-auto grid h-10 w-10 place-items-center" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999, color: "var(--muted)" }}><Search className="h-4 w-4" /></button>
        <button type="button" aria-label="Avisos" onClick={() => openModal({ kind: "notifications" })} className="grid h-10 w-10 place-items-center" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999, color: "var(--muted)" }}><Bell className="h-4 w-4" /></button>
      </header>
      <main className="flex-1 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[900px] xl:[&>*]:max-w-[1100px] 2xl:[&>*]:max-w-[1400px]">{children}</main>
      <div className="sticky bottom-4 z-30 mt-4">
        <nav className="flex items-center justify-around px-2 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 26, boxShadow: "0 18px 40px -18px rgba(0,0,0,.55)", backdropFilter: "blur(14px)" }}>
          {NAV.slice(0, 3).map((n) => <FeedTab key={n.id} id={n.id} label={n.label} icon={ICON[n.icon]} active={n.id === current} onClick={() => nav(n.id)} />)}
          <button type="button" onClick={newTx} aria-label="Nuevo movimiento" className="-my-4 grid h-12 w-12 place-items-center" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "var(--accent-fg)", borderRadius: 999, boxShadow: "var(--accent-glow)" }}><Plus className="h-5 w-5" strokeWidth={2.8} /></button>
          {NAV.slice(3).map((n) => <FeedTab key={n.id} id={n.id} label={n.label} icon={ICON[n.icon]} active={n.id === current} onClick={() => nav(n.id)} />)}
        </nav>
      </div>
    </div>
  );
}

function FeedTab({ label, icon, active, onClick }: { id: string; label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-0.5 px-2 py-1 text-[9.5px] font-semibold" style={{ color: active ? "var(--accent)" : "var(--faint)" }}>
      {icon}{label}
    </button>
  );
}

/* ============================ MÓVIL (marco de teléfono común) ============================ */

function MobileHeader() {
  const { net } = useTotals();
  const { openModal } = usePreview();
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--sidebar)", backdropFilter: "var(--blur)" }}>
      <div>
        <p className="pv-faint text-[10px] font-semibold uppercase tracking-[0.14em]">Patrimonio neto</p>
        <p className="pv-num text-[17px] font-bold leading-tight" style={{ color: "var(--text)" }}>{formatEUR(net)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Buscar" onClick={() => openModal({ kind: "search" })} className="grid h-8 w-8 place-items-center" style={{ background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 999 }}><Search className="h-4 w-4" /></button>
        <button type="button" aria-label="Avisos" onClick={() => openModal({ kind: "notifications" })} className="grid h-8 w-8 place-items-center" style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 999 }}><Bell className="h-4 w-4" /></button>
      </div>
    </header>
  );
}

function MobileNav() {
  const { arch } = useArch();
  const { current, nav, newTx } = useNav();
  const [menuOpen, setMenuOpen] = useState(false);

  const primary: { id: NavId; label: string }[] = [
    { id: "panel", label: "Panel" },
    { id: "cuentas", label: "Cuentas" },
    { id: "inversiones", label: "Cartera" },
  ];
  /* El último acceso es un desplegable: Categorías, Gráficas y Ajustes. */
  const extra: { id: NavId; label: string; icon: ReactNode }[] = [
    { id: "categorias", label: "Categorías", icon: ICON.folder },
    { id: "graficas", label: "Gráficas", icon: ICON.chart },
    { id: "ajustes", label: "Ajustes", icon: ICON.settings },
  ];
  const activeExtra = extra.find((e) => e.id === current);
  const icon = (id: NavId) => ICON[NAV.find((n) => n.id === id)!.icon];
  const floating = arch.shell === "floating" || arch.shell === "dock" || arch.shell === "feed" || arch.shell === "appbar";
  const goTo = (id: NavId) => {
    setMenuOpen(false);
    nav(id);
  };

  return (
    <>
      {menuOpen && (
        <div className="absolute inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(2px)" }} />
          <div
            className="absolute p-1.5"
            style={{
              left: floating ? 14 : 10,
              right: floating ? 14 : 10,
              bottom: floating ? 84 : 76,
              background: "var(--bg)",
              border: "1px solid var(--border-strong)",
              borderRadius: 18,
              boxShadow: "0 -20px 50px -20px rgba(0,0,0,.75)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {extra.map((item) => {
              const active = item.id === current;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold"
                  style={{ borderRadius: 12, color: active ? "var(--accent)" : "var(--text)", background: active ? "var(--accent-soft)" : "transparent" }}
                >
                  <span style={{ color: active ? "var(--accent)" : "var(--muted)" }}>{item.icon}</span>
                  {item.label}
                  {active && <Check className="ml-auto h-4 w-4" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="absolute z-30 flex items-end justify-around" style={{ left: floating ? 14 : 0, right: floating ? 14 : 0, bottom: floating ? 14 : 0, padding: "8px 8px 10px", background: "var(--sidebar)", backdropFilter: "var(--blur)", borderTop: floating ? undefined : "1px solid var(--border)", border: floating ? "1px solid var(--border)" : undefined, borderRadius: floating ? 999 : 0, boxShadow: floating ? "0 20px 40px -20px rgba(0,0,0,.6)" : undefined }}>
        {primary.slice(0, 2).map((it) => (
          <button key={it.id} type="button" onClick={() => goTo(it.id)} className="flex flex-1 flex-col items-center gap-1 py-1" style={{ color: current === it.id ? "var(--accent)" : "var(--faint)" }}>{icon(it.id)}<span className="text-[10px] font-semibold">{it.label}</span></button>
        ))}
        <button type="button" onClick={newTx} className="-mt-6 grid h-12 w-12 place-items-center" style={{ background: "var(--accent)", color: "var(--accent-fg)", borderRadius: 999, boxShadow: "var(--accent-glow)" }} aria-label="Añadir registro"><Plus className="h-5 w-5" strokeWidth={2.8} /></button>
        <button type="button" onClick={() => goTo(primary[2].id)} className="flex flex-1 flex-col items-center gap-1 py-1" style={{ color: current === primary[2].id ? "var(--accent)" : "var(--faint)" }}>{icon(primary[2].id)}<span className="text-[10px] font-semibold">{primary[2].label}</span></button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Más secciones: categorías, gráficas y ajustes"
          className="flex flex-1 flex-col items-center gap-1 py-1"
          style={{ color: activeExtra || menuOpen ? "var(--accent)" : "var(--faint)" }}
        >
          <span className="flex items-center gap-0.5">
            {activeExtra ? activeExtra.icon : ICON.folder}
            <ChevronUp className="h-3 w-3" strokeWidth={3} style={{ transform: menuOpen ? "rotate(180deg)" : undefined }} />
          </span>
          <span className="text-[10px] font-semibold">{activeExtra?.label ?? "Más"}</span>
        </button>
      </nav>
    </>
  );
}

