/* Genera src/lib/worldmap-data.ts a partir de world-atlas (Natural Earth 50 m) con d3-geo (proyección Natural Earth 1).
   Uso: node scripts/build-worldmap.mjs */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const topo = JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"));
const topojson = require("topojson-client");
const d3 = require("d3-geo");

const fc = topojson.feature(topo, topo.objects.countries);

const width = 1000;
const height = 500;

// Excluir Antártida (010) del encuadre para que el mapa habitable tenga el tamaño óptimo y centrado
const land = {
  type: "FeatureCollection",
  features: fc.features.filter((f) => String(f.id ?? "") !== "010"),
};

const projection = d3.geoNaturalEarth1().fitExtent(
  [
    [10, 10],
    [width - 10, height - 10],
  ],
  land,
);

function dp(segment, tol) {
  if (segment.length < 3) return segment;
  const s = segment[0];
  const e = segment[segment.length - 1];
  const dx = e[0] - s[0];
  const dy = e[1] - s[1];
  const len = Math.hypot(dx, dy) || 1e-9;
  let max = 0;
  let idx = -1;
  for (let i = 1; i < segment.length - 1; i++) {
    const p = segment[i];
    const d = Math.abs(dy * p[0] - dx * p[1] + e[0] * s[1] - e[1] * s[0]) / len;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max > tol && idx > 0) {
    return [...dp(segment.slice(0, idx + 1), tol).slice(0, -1), ...dp(segment.slice(idx), tol)];
  }
  return [s, e];
}

function simplifyRing(pts, tol) {
  if (pts.length <= 4) return pts;
  let maxD = 0;
  let maxI = 0;
  const p0 = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i][0] - p0[0], pts[i][1] - p0[1]);
    if (d > maxD) {
      maxD = d;
      maxI = i;
    }
  }
  if (maxI === 0) return pts;
  const part1 = dp(pts.slice(0, maxI + 1), tol);
  const part2 = dp(pts.slice(maxI), tol);
  return [...part1.slice(0, -1), ...part2];
}

const r = (v) => Math.round(v * 10) / 10;

/** Desenrolla longitudes para que el anillo sea continuo (sin saltos ±360) */
function unwrap(ring) {
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const prev = out[out.length - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
}

/** Recorte de Sutherland-Hodgman contra la banda lon ∈ [lo, hi] (plano: lon recto, lat recta) */
function clipLon(ring, lo, hi) {
  const inside = (p) => p[0] >= lo && p[0] <= hi;
  const cut = (p, q, edge) => {
    const t = (edge - p[0]) / (q[0] - p[0]);
    return [edge, p[1] + (q[1] - p[1]) * t];
  };
  let out = ring;
  for (const [edge, sign] of [[lo, 1], [hi, -1]]) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const p = input[i];
      const q = input[(i + 1) % input.length];
      const pi = sign > 0 ? p[0] >= edge : p[0] <= edge;
      const qi = sign > 0 ? q[0] >= edge : q[0] <= edge;
      if (pi) out.push(p);
      if (pi !== qi && p[0] !== q[0]) out.push(cut(p, q, edge));
    }
    if (out.length === 0) return [];
  }
  if (out.length >= 3 && out[out.length - 1][0] === out[0][0] && out[out.length - 1][1] === out[0][1]) out.pop();
  return out;
}

/**
 * Dibuja un anillo intentando las tres posiciones (0, ±360) recortando a [-180, 180]:
 * así los territorios que cruzan el meridiano (Rusia, Fiyi, Alaska) se pintan a los
 * dos bordes en vez de dibujarse como una racha a lo ancho del mapa.
 */
function projectPolygon(coords, tol = 0.25) {
  let out = "";
  for (const raw of coords) {
    if (!raw || raw.length < 4) continue;
    const base = unwrap(raw);
    let lo = Infinity;
    let hi = -Infinity;
    for (const [lon] of base) {
      if (lon < lo) lo = lon;
      if (lon > hi) hi = lon;
    }
    const spans = hi - lo > 170;
    const shifts = spans ? [-360, 0, 360] : [0];
    for (const shift of shifts) {
      const clipped = clipLon(base.map(([lon, lat]) => [lon + shift, lat]), -180, 180);
      if (clipped.length < 3) continue;
      const projected = clipped.map((pt) => projection(pt)).filter(Boolean);
      if (projected.length < 3) continue;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [x, y] of projected) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      if (x1 - x0 < 0.5 && y1 - y0 < 0.5) continue;
      const simple = simplifyRing(projected, tol);
      if (simple.length < 3) continue;
      // Corte defensivo: si aún queda un salto enorme, se abre subtrazo en vez de pintar la línea
      let d = "";
      let prev = null;
      for (const [x, y] of simple) {
        const jump = prev && (Math.abs(x - prev[0]) > 200 || Math.abs(y - prev[1]) > 200);
        d += (prev === null || jump ? "M" : "L") + `${r(x)} ${r(y)}`;
        prev = [x, y];
      }
      out += d + "Z";
    }
  }
  return out;
}

const paths = {};
for (const f of fc.features) {
  const iso = String(f.id ?? "").padStart(3, "0");
  if (!/^\d{3}$/.test(iso) || iso === "010") continue;
  const g = f.geometry;
  if (!g) continue;
  let d = "";
  if (g.type === "Polygon") {
    d = projectPolygon(g.coordinates);
  } else if (g.type === "MultiPolygon") {
    d = g.coordinates.map((p) => projectPolygon(p)).join("");
  }
  if (d && d.length > 10) {
    paths[iso] = d;
  }
}

const graticule = d3.geoGraticule10();
const pathGen = d3.geoPath(projection);
const grid = pathGen(graticule).replace(/([0-9]+\.[0-9]+)/g, (m) => Number(m).toFixed(1));

const data = { viewBox: `0 0 ${width} ${height}`, paths, grid };
const body =
  "/* Generado por scripts/build-worldmap.mjs (Natural Earth 50 m · D3 Natural Earth 1). No editar a mano. */\n" +
  "export interface WorldMapData {\n  viewBox: string;\n  paths: Record<string, string>;\n  grid: string;\n}\n\n" +
  `export const WORLD_MAP: WorldMapData = ${JSON.stringify(data)};\n`;

fs.writeFileSync(path.resolve("src/lib/worldmap-data.ts"), body);
console.log(`países: ${Object.keys(paths).length} · viewBox ${data.viewBox} · ${(body.length / 1024).toFixed(0)} KB`);
