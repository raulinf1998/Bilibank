"use client";

import { useMemo } from "react";
import { chartColor } from "@/lib/colors";
import { isosFor } from "@/lib/geo";
import { paintMap, type MapEntry } from "@/lib/investing";
import { WORLD_MAP } from "@/lib/worldmap-data";

/** Tono de tierra con ligera variación sutil, derivado siempre del texto del tema: visible en cualquier paleta */
const landFill = (iso: string) => `color-mix(in srgb, var(--faint) ${78 + ((Number(iso) * 37) % 14)}%, var(--surface))`;

/**
 * Mapa del mundo Natural Earth 50m.
 * Renderizado 100% síncrono y estático (sin peticiones de red), garantizando
 * visualización inmediata en cualquier pantalla, opción o dispositivo.
 */
export function WorldMap({ entries }: { entries: MapEntry[] }) {
  const paint = useMemo(() => paintMap(entries), [entries]);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 16%, var(--surface-2)), color-mix(in srgb, var(--accent) 5%, var(--surface)))",
          minHeight: 170,
        }}
      >
        {Object.keys(WORLD_MAP.paths).length === 0 && (
          <div className="grid h-40 place-items-center text-[12px]" style={{ color: "var(--muted)" }}>Mapa no disponible</div>
        )}
        <svg viewBox={WORLD_MAP.viewBox} className="block h-auto w-full" role="img" aria-label="Mapa del mundo con los cinco primeros países o regiones">
          <path d={WORLD_MAP.grid} fill="none" stroke="var(--faint)" strokeOpacity={0.16} strokeWidth={0.5} />
          {Object.entries(WORLD_MAP.paths).map(([iso, d]) => {
            const rank = paint.get(iso);
            const hit = rank !== undefined;
            return (
              <path
                key={iso}
                d={d}
                fillRule="evenodd"
                fill={hit ? chartColor(rank) : landFill(iso)}
                stroke="var(--surface)"
                strokeOpacity={hit ? 0.95 : 0.55}
                strokeWidth={hit ? 0.8 : 0.5}
                strokeLinejoin="round"
                className="transition-colors duration-200"
              >
                {hit && <title>{`${entries[rank]?.name} (${entries[rank]?.pct.toFixed(1).replace(".", ",")} %)`}</title>}
              </path>
            );
          })}
        </svg>
      </div>

      {entries.length === 0 ? (
        <p className="pv-faint text-[11.5px] leading-snug">Ninguno de los países de la lista puede situarse en el mapa (por ejemplo, «Global» o «Global (cripto)»).</p>
      ) : (
        <ol className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {entries.map((e) => {
            const n = isosFor(e.name).length;
            return (
              <li key={e.name} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="pv-num w-4 text-[10px] font-bold" style={{ color: "var(--faint)" }}>{e.rank + 1}</span>
                  <span className="h-2.5 w-2.5 shrink-0" style={{ background: chartColor(e.rank), borderRadius: 3 }} />
                  <span className="truncate" style={{ color: "var(--text)" }}>{e.name}</span>
                  {n > 1 && <span className="pv-faint shrink-0 text-[10.5px]">· {n} países</span>}
                </span>
                <span className="pv-num shrink-0 font-semibold" style={{ color: "var(--text)" }}>{e.pct.toFixed(1).replace(".", ",")} %</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
