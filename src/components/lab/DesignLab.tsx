"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Code2, Columns2, Eye, Monitor, Moon, Smartphone, Sun, Trophy } from "lucide-react";
import type { ArchetypeDef, DesignConfig, ModeKey } from "@/lib/themes";
import { ARCHETYPES, SHELLS, configFromArchetype, getArchetype } from "@/lib/themes";
import { NAV } from "@/lib/mock";
import { AppPreview } from "@/components/preview/AppPreview";
import { PreviewDataProvider, usePreview } from "@/components/preview/state";
import { PaletteLibraryProvider, usePaletteLibrary, type CustomPaletteRecord } from "@/components/preview/palettes";
import { ArchGlyph, ArchetypePostcard, ArchetypeRail, CodeExport, LabPanel, MixerPanel, RatingPanel, StructureSheet } from "./parts";

export interface FeedbackState {
  rating: number;
  favourite: boolean;
  comment: string | null;
}

export function DesignLab({ initialConfig, initialFeedback, initialPalettes }: { initialConfig: DesignConfig; initialFeedback: Record<string, FeedbackState>; initialPalettes: CustomPaletteRecord[] }) {
  return (
    <PaletteLibraryProvider initial={initialPalettes}>
      <PreviewDataProvider>
        <Lab initialConfig={initialConfig} initialFeedback={initialFeedback} />
      </PreviewDataProvider>
    </PaletteLibraryProvider>
  );
}

function Lab({ initialConfig, initialFeedback }: { initialConfig: DesignConfig; initialFeedback: Record<string, FeedbackState> }) {
  const [cfg, setCfg] = useState<DesignConfig>(initialConfig);
  const [tab, setTab] = useState<"preview" | "compare" | "code">("preview");
  const [feedback, setFeedback] = useState<Record<string, FeedbackState>>(initialFeedback);
  const [keepMix, setKeepMix] = useState(false);
  const [samePalette, setSamePalette] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [ratingSaving, setRatingSaving] = useState(false);
  const firstRun = useRef(true);
  const { route, go, openModal } = usePreview();

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setSaveState("saving");
    const id = setTimeout(async () => {
      try {
        const res = await fetch("/api/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
        setSaveState(res.ok ? "saved" : "error");
      } catch { setSaveState("error"); }
    }, 650);
    return () => clearTimeout(id);
  }, [cfg]);

  const patch = useCallback((p: Partial<DesignConfig>) => setCfg((c) => ({ ...c, ...p })), []);

  const pickArchetype = useCallback((a: ArchetypeDef) => {
    setCfg((c) => {
      const base = { ...configFromArchetype(a.key, c.device), donutKey: c.donutKey };
      return keepMix ? { ...base, mode: c.mode, paletteKey: c.paletteKey, accentOverride: c.accentOverride, fontKey: c.fontKey, chartStyleKey: c.chartStyleKey, radiusKey: c.radiusKey, densityKey: c.densityKey } : base;
    });
    setTab("preview");
  }, [keepMix]);

  const resetMix = useCallback(() => setCfg((c) => ({ ...configFromArchetype(c.archetypeKey, c.device), mode: c.mode })), []);

  const saveRating = useCallback(async (key: string, rating: number, favourite: boolean, comment: string) => {
    setRatingSaving(true);
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ themeKey: key, rating, favourite, comment }) });
      if (res.ok) setFeedback((f) => ({ ...f, [key]: { rating, favourite, comment: comment.trim() || null } }));
    } finally { setRatingSaving(false); }
  }, []);

  const arch = getArchetype(cfg.archetypeKey);
  const lib = usePaletteLibrary();
  const palette = lib.resolve(cfg.paletteKey);
  const ranking = useMemo(() => ARCHETYPES.map((a) => ({ a, score: feedback[a.key]?.rating ?? 0, fav: feedback[a.key]?.favourite ?? false })).sort((x, y) => Number(y.fav) - Number(x.fav) || y.score - x.score), [feedback]);
  const votedCount = Object.values(feedback).filter((f) => f.rating > 0).length;

  return (
    <div className="min-h-screen bg-[#07080c] text-slate-200">
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(1200px 700px at 78% -12%, rgba(99,102,241,0.14), transparent 60%), radial-gradient(900px 600px at 4% 100%, rgba(45,212,191,0.09), transparent 60%)" }} />

      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#07080c]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-900"><Columns2 className="h-4 w-4" /></span>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold leading-tight text-white">Laboratorio de diseño · Mi Patrimonio</h1>
              <p className="truncate text-[11.5px] text-slate-500">6 estructuras de interfaz distintas (paneles, navegación, KPIs, botones, listas, gráficos) · el color se elige aparte</p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Segmented value={cfg.mode} onChange={(mode) => patch({ mode: mode as ModeKey })} options={[{ id: "dark", label: "Oscuro", icon: <Moon className="h-3.5 w-3.5" /> }, { id: "light", label: "Claro", icon: <Sun className="h-3.5 w-3.5" /> }]} />
            <Segmented value={cfg.device} onChange={(device) => patch({ device: device as DesignConfig["device"] })} options={[{ id: "desktop", label: "Escritorio", icon: <Monitor className="h-3.5 w-3.5" /> }, { id: "mobile", label: "Móvil", icon: <Smartphone className="h-3.5 w-3.5" /> }]} />
            <span className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold sm:flex ${saveState === "error" ? "border-rose-400/30 bg-rose-500/10 text-rose-300" : "border-white/8 bg-white/[0.03] text-slate-400"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${saveState === "saving" ? "animate-pulse bg-amber-400" : saveState === "error" ? "bg-rose-400" : "bg-emerald-400"}`} />
              {saveState === "saving" ? "Guardando…" : saveState === "error" ? "Sin guardar" : saveState === "saved" ? "Mezcla guardada" : "Listo"}
            </span>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1760px] items-center gap-1 px-4 pb-2.5 lg:px-6">
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={<Eye className="h-3.5 w-3.5" />}>Vista previa en vivo</TabButton>
          <TabButton active={tab === "compare"} onClick={() => setTab("compare")} icon={<Columns2 className="h-3.5 w-3.5" />}>Comparar las {ARCHETYPES.length}</TabButton>
          <TabButton active={tab === "code"} onClick={() => setTab("code")} icon={<Code2 className="h-3.5 w-3.5" />}>Código para tu repo</TabButton>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1760px] px-4 pb-16 pt-5 lg:px-6">
        {tab === "preview" && (
          <div className="grid gap-5 xl:grid-cols-[272px_minmax(0,1fr)_316px]">
            <div className="flex flex-col gap-4">
              <LabPanel title="Estructuras" hint="Cada una cambia navegación, paneles, KPIs, botones, listas, gráficos y formularios." right={<label className="flex cursor-pointer items-center gap-1.5 text-[10.5px] font-medium text-slate-500"><input type="checkbox" checked={keepMix} onChange={(e) => setKeepMix(e.target.checked)} className="h-3 w-3 accent-white" />conservar color</label>}>
                <ArchetypeRail current={cfg.archetypeKey} scores={feedback} onPick={pickArchetype} />
              </LabPanel>
              <LabPanel title="Clasificación" hint="Por tus valoraciones guardadas.">
                <ol className="flex flex-col gap-1.5">
                  {ranking.map((r, i) => (
                    <li key={r.a.key}>
                      <button type="button" onClick={() => pickArchetype(r.a)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${r.a.key === cfg.archetypeKey ? "border-white/25 bg-white/[0.07]" : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"}`}>
                        <span className="w-4 shrink-0 text-[11px] font-bold text-slate-600">{i + 1}</span>
                        <Trophy className={`h-3.5 w-3.5 shrink-0 ${i === 0 && r.score > 0 ? "text-amber-300" : "text-slate-700"}`} />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-300">{r.a.name}</span>
                        <span className="shrink-0 text-[11px] font-bold text-slate-500">{r.score > 0 ? `${r.score}/5` : "—"}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </LabPanel>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {NAV.map((n) => (
                  <button key={n.id} type="button" onClick={() => go({ page: n.id })} className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${route.page === n.id ? "border-white/25 bg-white/10 text-white" : "border-white/8 bg-white/[0.02] text-slate-500 hover:text-slate-300"}`}>{n.label}</button>
                ))}
                <span className="mx-1 h-4 w-px bg-white/10" />
                {[
                  { l: "Detalle cuenta", f: () => go({ page: "cuentas", accountId: 1 }) },
                  { l: "Detalle producto", f: () => go({ page: "inversiones", productId: 4 }) },
                  { l: "Detalle categoría", f: () => go({ page: "categorias", categoryId: 2 }) },
                  { l: "+ Movimiento", f: () => openModal({ kind: "tx" }) },
                  { l: "+ Cuenta", f: () => openModal({ kind: "account" }) },
                  { l: "+ Producto", f: () => openModal({ kind: "product" }) },
                ].map((x) => (
                  <button key={x.l} type="button" onClick={x.f} className="rounded-lg border border-dashed border-white/12 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:border-white/25 hover:text-slate-200">{x.l}</button>
                ))}
                <span className="ml-auto text-[11px] text-slate-600">Todo es clicable dentro de la app: cuentas, productos, categorías y botones «+».</span>
              </div>

              <div className="lab-scroll overflow-x-auto pb-2">
                <div style={{ minWidth: cfg.device === "mobile" ? 0 : 960 }}>
                  <AppPreview cfg={cfg} onConfigChange={patch} />
                </div>
              </div>

              <LabPanel title={`Estructura «${arch.name}»`} hint={arch.tagline}>
                <div className="grid gap-4 md:grid-cols-[1fr_300px]">
                  <div className="flex gap-3">
                    <ArchGlyph a={arch} size={56} />
                    <p className="text-[12px] leading-relaxed text-slate-400">{arch.description}</p>
                  </div>
                  <StructureSheet a={arch} />
                </div>
              </LabPanel>
            </div>

            <div className="flex flex-col gap-4">
              <LabPanel title="Mezclador" hint={`Paleta activa: ${palette.name}. Cambia color, gráficas, tipografía o densidad sin tocar la estructura.`}>
                <MixerPanel cfg={cfg} onChange={patch} onReset={resetMix} />
              </LabPanel>
              <LabPanel title="Tu valoración" hint="Se guarda en PostgreSQL.">
                <RatingPanel a={arch} score={feedback[arch.key]} saving={ratingSaving} onSave={(r, f, c) => saveRating(arch.key, r, f, c)} />
              </LabPanel>
            </div>
          </div>
        )}

        {tab === "compare" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold text-white">Comparador de estructuras</h2>
                <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-500">Cada tarjeta renderiza la app real (misma pantalla que tengas abierta en la vista previa) a escala con su estructura. Activa «misma paleta» para neutralizar el color y comparar sólo paneles, navegación, botones y gráficos.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-slate-400"><input type="checkbox" checked={samePalette} onChange={(e) => setSamePalette(e.target.checked)} className="h-3 w-3 accent-white" />misma paleta ({palette.name}) y modo</label>
                <span className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11.5px] text-slate-400">{votedCount} de {ARCHETYPES.length} valoradas</span>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {ranking.map(({ a }) => (
                <ArchetypePostcard key={a.key} a={a} score={feedback[a.key]} onUse={pickArchetype} paletteKey={samePalette ? cfg.paletteKey : undefined} mode={samePalette ? cfg.mode : undefined} onRate={(x, r) => saveRating(x.key, r, feedback[x.key]?.favourite ?? false, feedback[x.key]?.comment ?? "")} />
              ))}
            </div>
          </div>
        )}

        {tab === "code" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <LabPanel title="Exportación e integración" hint={`Referencia de «${arch.name}» + ${palette.name}. Requiere adaptación a tu React/Vite, Express y SQLite.`}>
              <CodeExport cfg={cfg} palette={palette} />
            </LabPanel>
            <div className="flex flex-col gap-4">
              <LabPanel title="Plan de migración" hint="Cómo llevarlo a Money_v2 sin romper nada.">
                <ol className="flex flex-col gap-3">
                  {[
                    { t: "1 · Backup y rama", d: "Crea una copia de SQLite fuera de producción y una rama de Git. No sobrescribas el repo completo ni subas .env o bases de datos." },
                    { t: "2 · Exporta la referencia", d: "Descarga el ZIP con las pantallas actuales, los tokens elegidos y la guía LEEME.md. No es un parche automático." },
                    { t: "3 · Sistema visual", d: `Integra Card, botones y estilos en una carpeta nueva; adapta Tailwind 4 a tu Tailwind 3 y organiza la navegación: ${SHELLS[arch.shell].toLowerCase()}.` },
                    { t: "4 · API y cálculos reales", d: "Reutiliza src/lib/api.ts, tus tipos y los cálculos del servidor. Alias, colores, widgets y desgloses ya existen en tu repo: no crees duplicados." },
                    { t: "5 · Pantalla a pantalla", d: "Panel → Cuentas → Formularios → Categorías → Inversiones → Gráficas/Ajustes. No copies mock.ts ni la actualización aleatoria de precios a producción." },
                    { t: "6 · Revisa y despliega", d: "Ejecuta typecheck, lint, build y tests de Money_v2, verifica saldos en staging, abre una PR y despliega manteniendo el volumen y el backup." },
                  ].map((s) => (
                    <li key={s.t} className="flex flex-col gap-0.5"><span className="text-[12px] font-semibold text-slate-200">{s.t}</span><span className="text-[11.5px] leading-relaxed text-slate-500">{s.d}</span></li>
                  ))}
                </ol>
              </LabPanel>
              <LabPanel title="Mezcla actual"><StructureSheet a={arch} /><p className="mt-3 text-[11px] text-slate-500">Paleta {palette.name}{palette.custom ? " (personalizada)" : ""} · {lib.all.length} disponibles</p></LabPanel>
            </div>
          </div>
        )}
      </main>

      <footer className="relative border-t border-white/8 px-4 py-6 text-center text-[11px] text-slate-600 lg:px-6">
        Réplica interactiva con datos de ejemplo (6 cuentas corrientes, 4 de inversión, 10 productos, 8 categorías × 5 subcategorías) · tu app real sigue en <span className="text-slate-500">raulreg98/Money_v2</span>.
      </footer>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: React.ReactNode }[] }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-white/8 bg-white/[0.03] p-0.5">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${o.id === value ? "bg-white text-slate-900" : "text-slate-400 hover:text-slate-200"}`}>{o.icon}{o.label}</button>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${active ? "bg-white/10 text-white" : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"}`}>{icon}{children}</button>
  );
}
