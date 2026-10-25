"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { PALETTES, buildCustomPalette, getPalette, type CustomSeeds, type PaletteDef } from "@/lib/themes";

export interface CustomPaletteRecord {
  key: string;
  name: string;
  seeds: CustomSeeds;
}

interface PaletteLibrary {
  /** Paletas integradas + personalizadas (las personalizadas al final) */
  all: PaletteDef[];
  custom: PaletteDef[];
  resolve: (key: string) => PaletteDef;
  save: (input: { key?: string; name: string; seeds: CustomSeeds }) => Promise<{ ok: true; palette: PaletteDef } | { ok: false; error: string }>;
  remove: (key: string) => Promise<boolean>;
}

const Ctx = createContext<PaletteLibrary | null>(null);

export function PaletteLibraryProvider({ initial, children }: { initial: CustomPaletteRecord[]; children: ReactNode }) {
  const [records, setRecords] = useState<CustomPaletteRecord[]>(initial);

  const custom = useMemo(() => records.map((r) => buildCustomPalette(r)), [records]);
  const all = useMemo(() => [...PALETTES, ...custom], [custom]);

  const resolve = useCallback(
    (key: string) => custom.find((p) => p.key === key) ?? getPalette(key),
    [custom],
  );

  const save = useCallback<PaletteLibrary["save"]>(async (input) => {
    try {
      const res = await fetch("/api/palettes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = (await res.json()) as { ok: boolean; error?: string; palette?: CustomPaletteRecord };
      if (!res.ok || !data.ok || !data.palette) return { ok: false, error: data.error ?? "No se pudo guardar la paleta" };
      const rec = data.palette;
      setRecords((list) => (list.some((r) => r.key === rec.key) ? list.map((r) => (r.key === rec.key ? rec : r)) : [...list, rec]));
      return { ok: true, palette: buildCustomPalette(rec) };
    } catch {
      return { ok: false, error: "Sin conexión con el servidor" };
    }
  }, []);

  const remove = useCallback(async (key: string) => {
    try {
      const res = await fetch(`/api/palettes?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!res.ok) return false;
      setRecords((list) => list.filter((r) => r.key !== key));
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo<PaletteLibrary>(() => ({ all, custom, resolve, save, remove }), [all, custom, resolve, save, remove]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePaletteLibrary(): PaletteLibrary {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePaletteLibrary fuera de PaletteLibraryProvider");
  return v;
}
