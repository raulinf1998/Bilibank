/* Colores de cuentas, categorías y productos.

   Importante: los colores de DATOS son fijos y no dependen de la paleta del tema.
   Cambiar de paleta solo afecta a la interfaz (fondos, textos, acento); una cuenta
   o una categoría conservan siempre su color. Un ColorRef puede ser:
   · un índice 0–11 de la paleta fija de datos, o
   · cualquier color CSS elegido a mano (hex o var(--…)). */

export type ColorRef = number | string;

export const CHART_SLOTS = 12;

/** Paleta fija de datos: 12 tonos diferenciados y legibles en modo claro y oscuro */
/** Paleta fija de datos: 12 tonos elegidos para distinguirse entre sí (ΔE mínimo 35)
    y mantener contraste suficiente tanto en modo claro como oscuro. */
export const DATA_COLORS: string[] = [
  "#3B82F6", // azul
  "#2DD4BF", // turquesa
  "#F97316", // naranja
  "#E879F9", // orquídea
  "#84CC16", // lima
  "#7C3AED", // violeta
  "#EAB308", // oro
  "#BE123C", // carmesí
  "#047857", // verde bosque
  "#EC4899", // rosa
  "#0EA5E9", // azul cielo
  "#78716C", // piedra
];

export const DATA_COLOR_NAMES = [
  "Azul", "Turquesa", "Naranja", "Orquídea", "Lima", "Violeta",
  "Oro", "Carmesí", "Verde bosque", "Rosa", "Azul cielo", "Piedra",
];

export function chartColor(c: ColorRef | null | undefined): string {
  if (typeof c === "string") return c;
  const n = Math.round(c ?? 0);
  const i = ((n % CHART_SLOTS) + CHART_SLOTS) % CHART_SLOTS;
  return DATA_COLORS[i];
}

export const isHexColor = (s: string) => /^#[0-9a-f]{6}$/i.test(s);

export function hexA(hex: string, a: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Color de texto legible sobre un fondo dado (negro o blanco), con contraste WCAG */
interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(c: string): Rgba | null {
  const t = c.trim();
  if (t.startsWith("#")) {
    const m = t.slice(1);
    const full = m.length === 3 ? m.split("").map((x) => x + x).join("") : m.slice(0, 6);
    const n = parseInt(full, 16);
    if (Number.isNaN(n) || full.length !== 6) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const m = t.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.every((x) => Number.isFinite(x))) return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  }
  return null;
}

export function onColor(c: string): string {
  const rgb = parseColor(c);
  if (!rgb) return "#ffffff";
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b);
  // Contraste frente a blanco y frente a negro: gana el mayor
  return (1.05) / (lum + 0.05) >= (lum + 0.05) / 0.05 ? "#ffffff" : "#111111";
}

const to2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
export const rgbToHex = (r: number, g: number, b: number) => `#${to2(r)}${to2(g)}${to2(b)}`;

/** Mezcla a (t=0) con b (t=1) */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return a;
  return rgbToHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
}

/** Convierte un color (hex o rgba con alfa) a hex opaco componiéndolo sobre un fondo */
export function toHexOver(color: string, bg: string): string {
  const c = parseColor(color);
  const b = parseColor(bg) ?? { r: 0, g: 0, b: 0, a: 1 };
  if (!c) return bg;
  return rgbToHex(c.r * c.a + b.r * (1 - c.a), c.g * c.a + b.g * (1 - c.a), c.b * c.a + b.b * (1 - c.a));
}

export function hueOf(hex: string): number {
  const c = parseColor(hex);
  if (!c) return 0;
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = s / 100, ll = l / 100;
  const k = (n: number) => (n + hh / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
