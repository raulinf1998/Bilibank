"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppPreview } from "@/components/preview/AppPreview";
import { PreviewDataProvider, type WorkspaceSnapshot } from "@/components/preview/state";
import { PaletteLibraryProvider, type CustomPaletteRecord } from "@/components/preview/palettes";
import type { DesignConfig } from "@/lib/themes";

/**
 * Aplicación a pantalla completa.
 *
 * Sin marco, sin cabecera y sin distintivos flotantes: la interfaz ocupa todo
 * el ancho de la ventana y cambia sola a la estructura de teléfono cuando la
 * pantalla es estrecha. Los cambios de diseño se guardan en silencio.
 */
export function FullApp({ initialConfig, initialPalettes, initialData }: { initialConfig: DesignConfig; initialPalettes: CustomPaletteRecord[]; initialData: WorkspaceSnapshot | null }) {
  const [cfg, setCfg] = useState<DesignConfig>(initialConfig);
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
      try {
        await fetch("/api/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      } catch {
        // Sin conexión con el servidor: el diseño se mantiene en esta sesión.
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [cfg]);

  return (
    <PreviewDataProvider initialData={initialData} persist>
      <PaletteLibraryProvider initial={initialPalettes}>
        <AppPreview cfg={cfg} onConfigChange={patchConfig} autoResponsive />
      </PaletteLibraryProvider>
    </PreviewDataProvider>
  );
}
