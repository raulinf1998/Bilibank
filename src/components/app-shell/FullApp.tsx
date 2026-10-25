"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CloudOff, LoaderCircle, Monitor, Smartphone } from "lucide-react";
import { AppPreview } from "@/components/preview/AppPreview";
import { PreviewDataProvider, usePreview, type WorkspaceSnapshot } from "@/components/preview/state";
import { PaletteLibraryProvider, type CustomPaletteRecord } from "@/components/preview/palettes";
import type { DesignConfig } from "@/lib/themes";

const SAVE_LABEL = { idle: "Cambios pendientes", saving: "Guardando…", saved: "Guardado en el servidor", error: "No se pudo guardar" } as const;

function SaveBadge() {
  const { saveState, lastSavedAt } = usePreview();
  const Icon = saveState === "saving" ? LoaderCircle : saveState === "error" ? CloudOff : Check;
  const color = saveState === "error" ? "var(--neg)" : saveState === "saving" ? "var(--muted)" : "var(--pos)";
  return (
    <span className="pointer-events-none fixed bottom-4 left-4 z-[80] inline-flex items-center gap-2 px-3 py-2 text-[11.5px] font-semibold shadow-lg" style={{ background: "color-mix(in srgb, var(--bg) 90%, transparent)", color: "var(--text)", border: "1px solid var(--border-strong)", borderRadius: 999, backdropFilter: "blur(10px)" }} role="status" aria-live="polite">
      <Icon className={`h-3.5 w-3.5 ${saveState === "saving" ? "animate-spin" : ""}`} style={{ color }} />
      {SAVE_LABEL[saveState]}
      {saveState === "saved" && lastSavedAt && <span className="hidden font-normal sm:inline" style={{ color: "var(--muted)" }}>· {new Date(lastSavedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>}
    </span>
  );
}

export function FullApp({ initialConfig, initialPalettes, initialData }: { initialConfig: DesignConfig; initialPalettes: CustomPaletteRecord[]; initialData: WorkspaceSnapshot | null }) {
  const [cfg, setCfg] = useState<DesignConfig>(initialConfig);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const first = useRef(true);

  const patchConfig = useCallback((patch: Partial<DesignConfig>) => {
    setCfg((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        const response = await fetch("/api/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
        setSaveState(response.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [cfg]);

  return (
    <div className="pv-root min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="mx-auto w-full max-w-[1680px] p-2 sm:p-4">
        <PreviewDataProvider initialData={initialData} persist>
          <PaletteLibraryProvider initial={initialPalettes}>
            <div className="flex items-center justify-between gap-3 pb-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Mi Patrimonio</p>
                <h1 className="pv-display text-[15px] font-semibold" style={{ color: "var(--text)" }}>Tus finanzas, en casa y en tu red</h1>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => patchConfig({ device: "desktop" })} className="grid h-8 w-8 place-items-center" style={{ borderRadius: 999, border: "1px solid var(--border)", background: cfg.device === "desktop" ? "var(--accent-soft)" : "var(--surface-2)", color: cfg.device === "desktop" ? "var(--accent)" : "var(--muted)" }} aria-label="Vista de escritorio" aria-pressed={cfg.device === "desktop"}><Monitor className="h-4 w-4" /></button>
                <button type="button" onClick={() => patchConfig({ device: "mobile" })} className="grid h-8 w-8 place-items-center" style={{ borderRadius: 999, border: "1px solid var(--border)", background: cfg.device === "mobile" ? "var(--accent-soft)" : "var(--surface-2)", color: cfg.device === "mobile" ? "var(--accent)" : "var(--muted)" }} aria-label="Vista de móvil" aria-pressed={cfg.device === "mobile"}><Smartphone className="h-4 w-4" /></button>
              </div>
            </div>
            <AppPreview cfg={cfg} onConfigChange={patchConfig} />
            <SaveBadge />
            <div className="fixed bottom-4 right-4 z-[80] flex items-center gap-2">
              <a href="/instalacion" className="rounded-full px-3 py-2 text-[11.5px] font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--text)" }}>Guía del servidor</a>
              <span className={`rounded-full px-2.5 py-2 text-[11px] font-semibold ${saveState === "error" ? "text-[var(--neg)]" : ""}`} style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", color: saveState === "error" ? "var(--neg)" : "var(--muted)" }} aria-live="polite">
                Diseño: {saveState === "saving" ? "guardando…" : saveState === "error" ? "sin guardar" : "guardado"}
              </span>
            </div>
          </PaletteLibraryProvider>
        </PreviewDataProvider>
      </div>
    </div>
  );
}
