"use client";

import { useState } from "react";
import { Check, Copy, Download, Heart, RotateCcw, Star } from "lucide-react";
import {
  ARCHETYPES, BUTTONS, CHART_STYLES, DENSITIES, FONTS, KPIS, LISTS, RADII, SHELLS, SURFACES,
  configFromArchetype, exportCardTsx, exportIndexCss, exportPaletteSummary, exportTailwindConfig,
  type ArchetypeDef, type ChartStyleKey, type PaletteDef, type DensityKey, type DesignConfig, type FontKey, type RadiusKey,
} from "@/lib/themes";
import { AppPreview } from "@/components/preview/AppPreview";
import { PreviewDataProvider } from "@/components/preview/state";
import { usePaletteLibrary } from "@/components/preview/palettes";
import { IntegrationDownload } from "./integration-download";

/* ------------------------------ chrome ------------------------------ */

export function LabPanel({ title, hint, children, right }: { title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/8 bg-white/[0.025]">
      <header className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-[12.5px] font-semibold text-slate-100">{title}</h3>
          {hint && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p>}
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function OptionGrid<T extends string>({ options, value, onChange, columns = 2 }: { options: { id: T; label: string; note?: string; font?: string }[]; value: T; onChange: (v: T) => void; columns?: 1 | 2 | 3 }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} title={o.note} style={{ fontFamily: o.font }} className={`rounded-lg border px-3 py-2 text-left transition-colors ${active ? "border-white/30 bg-white/10 text-white" : "border-white/8 bg-white/[0.02] text-slate-400 hover:border-white/16 hover:text-slate-200"}`}>
            <span className="block text-[12px] font-semibold leading-tight">{o.label}</span>
            {o.note && <span className="mt-1 block text-[10.5px] leading-snug text-slate-500">{o.note}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">{children}</p>;
}

/* ------------------------------ miniaturas estructurales ------------------------------ */

/** Dibujo esquemático de la estructura del arquetipo (no de su color) */
export function ArchGlyph({ a, size = 44 }: { a: ArchetypeDef; size?: number }) {
  const s = size;
  const stroke = "rgba(226,232,240,0.7)";
  const fill = "rgba(226,232,240,0.14)";
  const acc = "rgba(226,232,240,0.95)";
  return (
    <svg width={s} height={s} viewBox="0 0 44 44" className="shrink-0 rounded-lg border border-white/10 bg-black/30">
      {a.shell === "sidebar" && <><rect x="4" y="4" width="10" height="36" fill={fill} /><rect x="17" y="8" width="10" height="8" rx="1.5" fill="none" stroke={stroke} /><rect x="29" y="8" width="10" height="8" rx="1.5" fill="none" stroke={stroke} /><rect x="17" y="19" width="22" height="19" rx="1.5" fill="none" stroke={stroke} /><path d="M19 34 Q25 22 37 25" fill="none" stroke={acc} strokeWidth="1.5" /></>}
      {a.shell === "floating" && <><rect x="12" y="4" width="20" height="5" rx="2.5" fill={fill} /><rect x="6" y="12" width="32" height="13" rx="4" fill={acc} fillOpacity=".55" /><rect x="6" y="28" width="12" height="10" rx="3" fill={fill} /><rect x="20" y="28" width="12" height="10" rx="3" fill={fill} /><circle cx="36" cy="35" r="3.5" fill={acc} /></>}
      {a.shell === "dock" && <><rect x="6" y="5" width="32" height="5" rx="2.5" fill={fill} /><rect x="6" y="13" width="15" height="12" rx="4" fill={fill} /><rect x="23" y="13" width="15" height="12" rx="4" fill={fill} /><rect x="6" y="27" width="32" height="7" rx="3.5" fill={fill} /><rect x="9" y="36" width="26" height="5" rx="2.5" fill={acc} fillOpacity=".55" /></>}
      {a.shell === "appbar" && <><rect x="4" y="4" width="36" height="9" rx="2" fill={fill} /><rect x="6" y="16" width="9" height="4" rx="2" fill={acc} fillOpacity=".7" /><rect x="17" y="16" width="9" height="4" rx="2" fill="none" stroke={stroke} /><rect x="28" y="16" width="9" height="4" rx="2" fill="none" stroke={stroke} /><rect x="6" y="23" width="32" height="11" rx="5" fill={fill} /><rect x="28" y="33" width="11" height="8" rx="3" fill={acc} /></>}
      {a.shell === "explorer" && <><rect x="4" y="4" width="4" height="36" fill={fill} /><rect x="9" y="4" width="11" height="36" fill="none" stroke={stroke} /><line x1="11" y1="10" x2="18" y2="10" stroke={stroke} /><line x1="13" y1="15" x2="18" y2="15" stroke={stroke} /><line x1="13" y1="20" x2="18" y2="20" stroke={stroke} /><line x1="11" y1="26" x2="18" y2="26" stroke={stroke} /><rect x="22" y="4" width="8" height="4" fill={acc} fillOpacity=".7" /><line x1="22" y1="11" x2="40" y2="11" stroke={stroke} /><rect x="22" y="14" width="18" height="11" fill="none" stroke={stroke} /><rect x="22" y="28" width="18" height="10" fill="none" stroke={stroke} /></>}
      {a.shell === "feed" && <><circle cx="12" cy="9" r="3.5" fill={acc} fillOpacity=".85" /><circle cx="22" cy="9" r="3.5" fill={fill} /><circle cx="32" cy="9" r="3.5" fill={fill} /><rect x="10" y="16" width="24" height="9" rx="3" fill={fill} /><rect x="10" y="27" width="24" height="9" rx="3" fill={fill} /><rect x="14" y="38" width="16" height="4" rx="2" fill={acc} fillOpacity=".55" /></>}
    </svg>
  );
}

/* ------------------------------ rail de arquetipos ------------------------------ */

export function ArchetypeRail({ current, scores, onPick }: { current: string; scores: Record<string, { rating: number; favourite: boolean }>; onPick: (a: ArchetypeDef) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {ARCHETYPES.map((a, i) => {
        const active = a.key === current;
        const s = scores[a.key];
        return (
          <button key={a.key} type="button" onClick={() => onPick(a)} className={`rounded-xl border px-3 py-2.5 text-left transition-all ${active ? "border-white/25 bg-white/[0.07]" : "border-white/8 bg-white/[0.02] hover:border-white/16 hover:bg-white/[0.045]"}`}>
            <div className="flex items-center gap-2.5">
              <ArchGlyph a={a} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-slate-100"><span className="text-[10px] text-slate-600">{String(i + 1).padStart(2, "0")}</span>{a.name}{s?.favourite && <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />}</p>
                <p className="truncate text-[11px] text-slate-500">{a.short}</p>
              </div>
              {s && s.rating > 0 && <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-white/8 px-1.5 py-0.5 text-[10.5px] font-bold text-amber-300"><Star className="h-2.5 w-2.5 fill-amber-300" />{s.rating}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ ficha estructural ------------------------------ */

export function StructureSheet({ a }: { a: ArchetypeDef }) {
  const rows: [string, string][] = [
    ["Navegación", SHELLS[a.shell]],
    ["Paneles", SURFACES[a.surface]],
    ["KPIs", KPIS[a.kpi]],
    ["Botones", BUTTONS[a.button]],
    ["Listas", LISTS[a.list]],
    ["Formularios", "Diálogo centrado"],
    ["Gráficas", CHART_STYLES[a.chartStyle].name],
  ];
  return (
    <dl className="flex flex-col gap-1.5 text-[11.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[86px_1fr] gap-2 border-b border-white/5 pb-1.5 last:border-0">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-slate-300">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------ postal comparativa (app real a escala) ------------------------------ */

export function ArchetypePostcard({ a, score, onUse, onRate, paletteKey, mode }: { a: ArchetypeDef; score?: { rating: number; favourite: boolean; comment: string | null }; onUse: (a: ArchetypeDef) => void; onRate: (a: ArchetypeDef, rating: number) => void; paletteKey?: string; mode?: "dark" | "light" }) {
  const cfg: DesignConfig = { ...configFromArchetype(a.key), ...(paletteKey ? { paletteKey } : {}), ...(mode ? { mode } : {}) };
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <ArchGlyph a={a} size={40} />
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-slate-50">{a.name}</h3>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{a.tagline}</p>
          </div>
        </div>
      </div>

      <div className="mx-4 mt-3.5 overflow-hidden rounded-xl border border-white/10" style={{ height: 300 }}>
        <div style={{ width: 1180, transformOrigin: "top left", transform: "scale(0.4)", pointerEvents: "none" }}>
          <PreviewDataProvider>
            <AppPreview cfg={cfg} />
          </PreviewDataProvider>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="text-[11.5px] leading-relaxed text-slate-400">{a.description}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">{a.vibe.map((v) => <span key={v} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-400">{v}</span>)}</div>
      </div>

      <div className="px-4 pb-3"><StructureSheet a={a} /></div>

      <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 pb-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-400/80">A favor</p>
          <ul className="space-y-1">{a.bestFor.map((b) => <li key={b} className="flex gap-1.5 text-[11px] leading-snug text-slate-400"><span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-emerald-400/70" />{b}</li>)}</ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-400/80">A tener en cuenta</p>
          <ul className="space-y-1">{a.tradeoffs.map((b) => <li key={b} className="flex gap-1.5 text-[11px] leading-snug text-slate-400"><span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-amber-400/70" />{b}</li>)}</ul>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => onRate(a, n)} className="rounded p-0.5 transition-transform hover:scale-110" title={`Valorar ${n}/5`}>
              <Star className={`h-4 w-4 ${n <= (score?.rating ?? 0) ? "fill-amber-300 text-amber-300" : "text-slate-600"}`} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => onUse(a)} className="rounded-lg bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-900 transition-colors hover:bg-slate-200">Probar en vivo</button>
      </div>
    </article>
  );
}

/* ------------------------------ valoración ------------------------------ */

export function RatingPanel({ a, score, onSave, saving }: { a: ArchetypeDef; score?: { rating: number; favourite: boolean; comment: string | null }; onSave: (rating: number, favourite: boolean, comment: string) => void; saving: boolean }) {
  const [rating, setRating] = useState(score?.rating ?? 0);
  const [fav, setFav] = useState(score?.favourite ?? false);
  const [comment, setComment] = useState(score?.comment ?? "");
  const [key, setKey] = useState(a.key);
  if (key !== a.key) {
    setKey(a.key);
    setRating(score?.rating ?? 0);
    setFav(score?.favourite ?? false);
    setComment(score?.comment ?? "");
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} className="rounded p-0.5 transition-transform hover:scale-110"><Star className={`h-5 w-5 ${n <= rating ? "fill-amber-300 text-amber-300" : "text-slate-600"}`} /></button>)}</div>
        <button type="button" onClick={() => setFav((v) => !v)} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${fav ? "border-rose-400/40 bg-rose-500/15 text-rose-300" : "border-white/10 text-slate-400 hover:text-slate-200"}`}><Heart className={`h-3.5 w-3.5 ${fav ? "fill-rose-400" : ""}`} /> {fav ? "Favorita" : "Marcar favorita"}</button>
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder={`Notas sobre «${a.name}»: qué paneles, botones o gráficos te convencen y cuáles no…`} className="w-full resize-none rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[12px] leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-white/25 focus:outline-none" />
      <button type="button" disabled={saving} onClick={() => onSave(rating, fav, comment)} className="flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-[12px] font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-50">
        {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" /> : <Check className="h-3.5 w-3.5" />} Guardar valoración
      </button>
    </div>
  );
}

/* ------------------------------ mezclador ------------------------------ */

export function MixerPanel({ cfg, onChange, onReset }: { cfg: DesignConfig; onChange: (p: Partial<DesignConfig>) => void; onReset: () => void }) {
  const lib = usePaletteLibrary();
  const a = ARCHETYPES.find((x) => x.key === cfg.archetypeKey) ?? ARCHETYPES[0];
  const isDefault = cfg.paletteKey === a.paletteKey && cfg.fontKey === a.fontKey && cfg.chartStyleKey === a.chartStyle && cfg.radiusKey === a.radiusKey && cfg.densityKey === a.densityKey;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label>Paleta de color (independiente de la estructura)</Label>
        <div className="lab-scroll grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
          {lib.all.map((p) => {
            const t = p.tokens[cfg.mode];
            const active = p.key === cfg.paletteKey;
            return (
              <button key={p.key} type="button" onClick={() => onChange({ paletteKey: p.key })} title={p.note} className={`flex flex-col gap-1.5 rounded-lg border p-2 text-left ${active ? "border-white/30 bg-white/10" : "border-white/8 bg-white/[0.02] hover:border-white/16"}`}>
                <span className="flex h-5 w-full overflow-hidden rounded">{[t.bg, t.surface2, t.accent, t.chart[1], t.pos].map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</span>
                <span className="truncate text-[10.5px] font-semibold text-slate-300">{p.custom ? "★ " : ""}{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <Label>Estilo de gráficas</Label>
        <OptionGrid<ChartStyleKey> columns={2} value={cfg.chartStyleKey} onChange={(chartStyleKey) => onChange({ chartStyleKey })} options={(Object.keys(CHART_STYLES) as ChartStyleKey[]).map((k) => ({ id: k, label: CHART_STYLES[k].name, note: CHART_STYLES[k].note }))} />
      </div>
      <div>
        <Label>Tipografía</Label>
        <OptionGrid<FontKey> columns={1} value={cfg.fontKey} onChange={(fontKey) => onChange({ fontKey })} options={(Object.keys(FONTS) as FontKey[]).map((k) => ({ id: k, label: FONTS[k].name, note: FONTS[k].note, font: FONTS[k].sans }))} />
      </div>
      <div>
        <Label>Esquinas</Label>
        <OptionGrid<RadiusKey> columns={2} value={cfg.radiusKey} onChange={(radiusKey) => onChange({ radiusKey })} options={(Object.keys(RADII) as RadiusKey[]).map((k) => ({ id: k, label: RADII[k].name, note: RADII[k].note }))} />
      </div>
      <div>
        <Label>Densidad</Label>
        <OptionGrid<DensityKey> columns={3} value={cfg.densityKey} onChange={(densityKey) => onChange({ densityKey })} options={(Object.keys(DENSITIES) as DensityKey[]).map((k) => ({ id: k, label: DENSITIES[k].name }))} />
      </div>
      <button type="button" onClick={onReset} disabled={isDefault} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[11.5px] font-semibold text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /> Restablecer «{a.name}»</button>
    </div>
  );
}

/* ------------------------------ exportación ------------------------------ */

const FILES = [
  { id: "tailwind", label: "tailwind.config.js" },
  { id: "css", label: "src/index.css" },
  { id: "card", label: "src/components/Card.tsx" },
  { id: "resumen", label: "resumen.txt" },
] as const;
type FileId = (typeof FILES)[number]["id"];

export function CodeExport({ cfg, palette }: { cfg: DesignConfig; palette?: PaletteDef }) {
  const [file, setFile] = useState<FileId>("tailwind");
  const [copied, setCopied] = useState(false);
  const content = file === "tailwind" ? exportTailwindConfig(cfg, palette) : file === "css" ? exportIndexCss(cfg, palette) : file === "card" ? exportCardTsx(cfg) : exportPaletteSummary(cfg, palette);
  const copy = async () => { try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); } };
  const download = () => { const blob = new Blob([content], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const el = document.createElement("a"); el.href = url; el.download = file === "resumen" ? "mezcla-elegida.txt" : FILES.find((f) => f.id === file)?.label.split("/").pop() ?? "design.txt"; el.click(); URL.revokeObjectURL(url); };
  return (
    <div className="flex flex-col gap-4">
      <IntegrationDownload cfg={cfg} palette={palette} />
      <div>
        <h3 className="text-[12.5px] font-semibold text-slate-200">Ejemplos parciales de estilos (Tailwind 3)</h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">Estos archivos sirven como punto de partida: no incluyen la conexión a tu API ni trasladan todas las pantallas.</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {FILES.map((f) => <button key={f.id} type="button" onClick={() => setFile(f.id)} className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${file === f.id ? "border-white/25 bg-white/10 text-white" : "border-white/8 bg-white/[0.02] text-slate-400 hover:text-slate-200"}`}>{f.label}</button>)}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-300 hover:text-white">{copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copiado" : "Copiar"}</button>
          <button type="button" onClick={download} className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-900 hover:bg-slate-200"><Download className="h-3.5 w-3.5" /> Descargar</button>
        </div>
      </div>
      <pre className="lab-scroll max-h-[560px] overflow-auto rounded-xl border border-white/8 bg-black/45 p-4 font-mono text-[11.5px] leading-relaxed text-slate-300">{content}</pre>
      <p className="text-[11.5px] leading-relaxed text-slate-500">
        Fusiona los ejemplos con <span className="font-mono text-slate-400">tailwind.config.js</span>, <span className="font-mono text-slate-400">src/index.css</span> y <span className="font-mono text-slate-400">src/components/Card.tsx</span> en una rama de pruebas. Conserva tu configuración y la API existente. Para llevar el resto de pantallas y funciones, sigue <span className="font-mono text-slate-400">LEEME.md</span> del paquete: los modelos, cálculos financieros y la persistencia de la demo no sustituyen a los de Money_v2.
      </p>
    </div>
  );
}
