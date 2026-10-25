"use client";

import { useState } from "react";
import { Download, ExternalLink, LoaderCircle, PackageOpen } from "lucide-react";
import { seedsFromPalette, type DesignConfig, type PaletteDef } from "@/lib/themes";

export function IntegrationDownload({ cfg, palette }: { cfg: DesignConfig; palette?: PaletteDef }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setError(false);
    try {
      const response = await fetch("/api/integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: cfg,
          ...(palette?.custom ? { palette: { name: palette.name, seeds: seedsFromPalette(palette) } } : {}),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo descargar el paquete");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `money-v2-integracion-${cfg.archetypeKey}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setMessage("Paquete descargado. Empieza por LEEME.md; no sobrescribas tu repositorio completo.");
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "No se pudo descargar el paquete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="min-w-0 rounded-xl border border-indigo-300/20 bg-indigo-300/[0.05] p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-300/10 text-indigo-200">
          <PackageOpen className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-slate-100">Llevar el rediseño a Money_v2</h3>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-400">
            Descarga la guía de integración, tu selección visual y las fuentes de las pantallas actuales. Conserva tu React/Vite, Express y SQLite; conecta la interfaz a tu API real.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          aria-busy={busy}
          className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[12px] font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {busy ? "Preparando paquete…" : "Descargar paquete de integración (.zip)"}
        </button>
        <a href="/api/integration" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px] font-medium text-slate-300 hover:text-white">
          <ExternalLink className="h-3.5 w-3.5" /> Leer guía
        </a>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-amber-200/80">
        Referencia para adaptar, no parche automático. Los datos, precios y ciertos cálculos del laboratorio son de demostración. El ZIP no incluye credenciales ni bases de datos.
      </p>
      {message && <p role="status" aria-live="polite" className={`mt-2 text-[12px] leading-relaxed ${error ? "text-rose-300" : "text-emerald-300"}`}>{message}</p>}
    </section>
  );
}
