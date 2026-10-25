"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Ancho a partir del cual la app deja de mostrarse como teléfono. */
export const PHONE_MAX_WIDTH = 880;

/**
 * `true` mientras la ventana es más estrecha que `maxWidth`.
 *
 * Usa `useSyncExternalStore` para leer la media query: en el servidor devuelve
 * `false` (escritorio) y en el cliente se corrige antes de pintar, sin avisos
 * de hidratación ni parpadeo de la estructura de escritorio en el móvil.
 */
export function useIsNarrow(maxWidth: number = PHONE_MAX_WIDTH): boolean {
  const query = `(max-width: ${maxWidth - 1}px)`;

  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
