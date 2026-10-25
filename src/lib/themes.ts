import { hexA, hslToHex, hueOf, isHexColor, mixHex, onColor, toHexOver } from "./colors";

/* ------------------------------------------------------------------
   Sistema de diseño del laboratorio.
   - ARQUETIPOS: definen la ESTRUCTURA (shell de navegación, tipo de
     panel, KPIs, botones, listas, gráficos, formularios).
   - PALETAS: definen sólo el COLOR y se eligen por separado.
------------------------------------------------------------------ */

export type ModeKey = "dark" | "light";
export type ChartStyleKey = "gradient" | "solid" | "tech" | "minimal" | "neon" | "glass" | "step" | "brutal";
export type FontKey = "inter" | "manrope" | "sora" | "space" | "plex" | "jakarta" | "editorial" | "instrument";
export type RadiusKey = "sharp" | "soft" | "round" | "pill";
export type DensityKey = "compact" | "normal" | "airy";
export type DeviceKey = "desktop" | "mobile";

export type ShellKey = "sidebar" | "topbar" | "editorial" | "rail" | "floating" | "brutal" | "dock" | "appbar" | "explorer" | "feed";
export type SurfaceKey = "bordered" | "grid" | "none" | "filled" | "glass" | "brutal" | "neu" | "tonal" | "wire" | "post";
export type KpiKey = "card" | "ticker" | "statement" | "tile" | "hero" | "block" | "spark" | "summary" | "inline" | "stories";
export type ButtonKey = "filled" | "square" | "link" | "pill" | "soft" | "brutal" | "neu" | "tonal" | "code" | "gradient";
export type ListKey = "rows" | "dense" | "ledger" | "tiles" | "avatars" | "blocks" | "cards" | "leader" | "timeline";
export type ModalKey = "dialog" | "drawer" | "sheet";

export interface ModeTokens {
  bg: string; bgImage: string; surface: string; surface2: string; border: string; borderStrong: string;
  hover: string; text: string; muted: string; faint: string; accent: string; accent2: string; accentFg: string;
  accentSoft: string; accentGlow: string; pos: string; posSoft: string; neg: string; negSoft: string;
  blur: string; sidebar: string; chart: string[];
}

/** Colores base de un modo; el resto de tokens se deriva a partir de ellos. */
export interface BaseSeed {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accent2: string;
  pos: string;
  neg: string;
}
export interface FullSeed extends BaseSeed {
  /** 12 colores para gráficas, cuentas y categorías */
  chart: string[];
}
export interface CustomSeeds {
  dark: FullSeed;
  light: FullSeed;
}

export interface PaletteDef {
  key: string;
  name: string;
  note: string;
  defaultMode: ModeKey;
  tokens: Record<ModeKey, ModeTokens>;
  /** Paleta creada por el usuario (editable y eliminable) */
  custom?: boolean;
  seeds?: CustomSeeds;
}

export interface ArchetypeDef {
  key: string;
  name: string;
  short: string;
  tagline: string;
  description: string;
  bestFor: string[];
  tradeoffs: string[];
  vibe: string[];
  shell: ShellKey;
  surface: SurfaceKey;
  kpi: KpiKey;
  button: ButtonKey;
  list: ListKey;
  modal: ModalKey;
  chartStyle: ChartStyleKey;
  fontKey: FontKey;
  radiusKey: RadiusKey;
  densityKey: DensityKey;
  paletteKey: string;
  defaultMode: ModeKey;
}

const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const FONTS: Record<FontKey, { name: string; display: string; sans: string; mono: string; tracking: string; note: string }> = {
  inter: { name: "Inter + JetBrains Mono", display: "'Inter', ui-sans-serif, system-ui, sans-serif", sans: "'Inter', ui-sans-serif, system-ui, sans-serif", mono, tracking: "-0.021em", note: "Neutra y legible en tamaños pequeños; números en mono tabular." },
  manrope: { name: "Manrope + JetBrains Mono", display: "'Manrope', ui-sans-serif, system-ui, sans-serif", sans: "'Manrope', ui-sans-serif, system-ui, sans-serif", mono, tracking: "-0.028em", note: "Geométrica con carácter, x-height alta. Muy legible en móvil." },
  sora: { name: "Sora + Plus Jakarta Sans", display: "'Sora', ui-sans-serif, system-ui, sans-serif", sans: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif", mono, tracking: "-0.03em", note: "Titulares técnicos y anchos; cuerpo amable. Aire SaaS." },
  space: { name: "Space Grotesk + IBM Plex Sans", display: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif", sans: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif", mono, tracking: "-0.025em", note: "Display grotesco con personalidad; cuerpo humanista." },
  plex: { name: "IBM Plex Sans + IBM Plex Mono", display: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif", sans: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif", mono: "'IBM Plex Mono', ui-monospace, monospace", tracking: "-0.015em", note: "Una sola familia: coherencia total y aire de terminal de datos." },
  jakarta: { name: "Plus Jakarta Sans + DM Sans", display: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif", sans: "'DM Sans', ui-sans-serif, system-ui, sans-serif", mono, tracking: "-0.024em", note: "Redondeada y cercana. Hace la app más amable." },
  editorial: { name: "Fraunces + Inter", display: "'Fraunces', Georgia, serif", sans: "'Inter', ui-sans-serif, system-ui, sans-serif", mono, tracking: "-0.02em", note: "Serif contemporánea en titulares: banca privada e informe anual." },
  instrument: { name: "Instrument Serif + Manrope", display: "'Instrument Serif', Georgia, serif", sans: "'Manrope', ui-sans-serif, system-ui, sans-serif", mono, tracking: "-0.01em", note: "Serif elegante y ligera; máximo contraste editorial." },
};

export const CHART_STYLES: Record<ChartStyleKey, { name: string; note: string }> = {
  gradient: { name: "Área con degradado", note: "Curva suave con relleno que se desvanece. Lo que usas ahora con Recharts." },
  solid: { name: "Barras sólidas", note: "Bloques planos, sin degradados. Máxima claridad comparativa." },
  tech: { name: "Técnica con puntos", note: "Rejilla punteada, vértices marcados, trazo fino." },
  minimal: { name: "Línea mínima", note: "Sin rejilla ni relleno; sólo el trazo y el último valor." },
  neon: { name: "Neón con brillo", note: "Trazo saturado con glow. Impacto alto en oscuro." },
  glass: { name: "Cristal translúcido", note: "Rellenos con alpha y blur sobre mallas de color." },
  step: { name: "Escalonada (terminal)", note: "Línea en escalones, como un libro de órdenes. Muy 'datos'." },
  brutal: { name: "Bloques con contorno", note: "Barras y líneas gruesas con borde negro. Gráfico de póster." },
};

export const RADII: Record<RadiusKey, { name: string; sm: string; md: string; lg: string; pill: string; note: string }> = {
  sharp: { name: "Recto", sm: "2px", md: "3px", lg: "4px", pill: "4px", note: "0–4 px. Serio, denso, tipo herramienta." },
  soft: { name: "Suave", sm: "6px", md: "10px", lg: "14px", pill: "999px", note: "10–14 px. Parecido a tu rounded-2xl actual." },
  round: { name: "Redondeado", sm: "10px", md: "16px", lg: "22px", pill: "999px", note: "16–22 px. Amable y actual." },
  pill: { name: "Cápsula", sm: "12px", md: "18px", lg: "28px", pill: "999px", note: "24–28 px. Máxima suavidad." },
};

export const DENSITIES: Record<DensityKey, { name: string; pad: string; gap: string; row: string; note: string }> = {
  compact: { name: "Compacta", pad: "12px", gap: "10px", row: "38px", note: "Más datos por pantalla." },
  normal: { name: "Normal", pad: "18px", gap: "16px", row: "50px", note: "Tu densidad actual." },
  airy: { name: "Aireada", pad: "26px", gap: "24px", row: "62px", note: "Respira mucho; mejor en pantallas grandes." },
};

export const SHELLS: Record<ShellKey, string> = {
  sidebar: "Barra lateral fija con saldos (tu estructura actual)",
  topbar: "Cinta superior de pestañas + franja de cotizaciones",
  editorial: "Cabecera tipo periódico con navegación en texto, contenido centrado",
  rail: "Riel de iconos a la izquierda, mucho ancho para los mosaicos",
  floating: "Cabecera con saldo gigante y navegación flotante en píldora",
  brutal: "Barra gruesa con pestañas en cajas y contornos marcados",
  dock: "Cabecera con saldo y buscador + dock flotante de navegación abajo",
  appbar: "Barra superior grande con chips de navegación y botón flotante extendido",
  explorer: "Barra de actividad, árbol de cuentas/categorías, pestañas y barra de estado",
  feed: "Columna estrecha tipo red social con cabecera de saludo y barra de pestañas inferior",
};
export const SURFACES: Record<SurfaceKey, string> = {
  bordered: "Tarjetas con borde fino y fondo elevado",
  grid: "Paneles pegados separados por líneas de 1 px, sin huecos ni radios",
  none: "Sin tarjetas: secciones separadas por reglas horizontales",
  filled: "Mosaicos rellenos sin borde, radios grandes",
  glass: "Cristal translúcido con desenfoque sobre fondo degradado",
  brutal: "Borde de 2 px y sombra dura desplazada",
  neu: "Neumórfico: sin borde, relieve con luz y sombra doble",
  tonal: "Superficies tonales teñidas con el acento y radios muy grandes",
  wire: "Esquema: sólo contorno de 1 px, sin relleno",
  post: "Publicaciones: tarjeta elevada con sombra suave y esquinas redondas",
};
export const KPIS: Record<KpiKey, string> = {
  card: "Tarjeta con etiqueta, cifra e icono",
  ticker: "Franja continua estilo cotización: etiqueta · valor · variación",
  statement: "Cifras enormes en serif, en fila, como un estado de cuentas",
  tile: "Mosaico con anillo de progreso",
  hero: "Saldo protagonista en la cabecera + chips secundarios",
  block: "Bloques de color sólido con cifra gruesa",
  spark: "Tarjeta con cifra y mini-gráfica de tendencia en el fondo",
  summary: "Resumen en una sola tarjeta dividida en columnas",
  inline: "Línea de variables estilo clave = valor",
  stories: "Fila deslizable de tarjetas tipo historias con degradado",
};
export const BUTTONS: Record<ButtonKey, string> = {
  filled: "Relleno de acento, esquinas suaves",
  square: "Contorno fino, cuadrado, mayúsculas pequeñas",
  link: "Texto subrayado, sin caja",
  pill: "Píldora rellena",
  soft: "Píldora con fondo tenue de acento",
  brutal: "Caja con borde negro y sombra dura",
  neu: "Píldora en relieve que se hunde al activarse",
  tonal: "Píldora tonal; la acción principal va rellena",
  code: "Caja fina con tipografía monoespaciada",
  gradient: "Degradado de acento con esquinas de 14 px",
};
export const LISTS: Record<ListKey, string> = {
  rows: "Filas con icono, concepto y cifra",
  dense: "Tabla densa con cebra y columnas alineadas",
  ledger: "Libro mayor: líneas regladas, sin iconos, números a la derecha",
  tiles: "Rejilla de mosaicos, uno por elemento",
  avatars: "Filas con avatar redondo y chips",
  blocks: "Filas gruesas separadas por líneas negras",
  cards: "Cada elemento es una tarjeta tonal independiente",
  leader: "Concepto ········ importe con puntos guía, como un recibo",
  timeline: "Línea de tiempo vertical con un punto de color por elemento",
};

/* ------------------------------------------------------------------
   ARQUETIPOS ESTRUCTURALES
------------------------------------------------------------------ */

export const ARCHETYPES: ArchetypeDef[] = [
  {
    key: "clasico",
    name: "Tarjetas clásicas",
    short: "Tu estructura, pulida",
    tagline: "Sidebar + tarjetas con borde + área con degradado",
    description:
      "Es tu arquitectura actual depurada: barra lateral con saldos, rejilla de StatCards, gráficas de área con degradado y tablas en tarjetas. Se diferencia del resto por ser la más 'estándar' de dashboard: todo vive en una tarjeta y todo tiene icono.",
    bestFor: ["Migración incremental sin reescribir páginas", "Consistencia con lo que ya conoces", "Uso diario sin sorpresas"],
    tradeoffs: ["La menos distinta: muchas apps se ven así", "Muchas tarjetas = mucho borde"],
    vibe: ["Dashboard", "Familiar", "Equilibrado"],
    shell: "sidebar", surface: "bordered", kpi: "card", button: "filled", list: "rows", modal: "dialog",
    chartStyle: "gradient", fontKey: "inter", radiusKey: "soft", densityKey: "normal",
    paletteKey: "slate-refined", defaultMode: "dark",
  },
  {
    key: "suave",
    name: "Suave neumórfico",
    short: "Relieve y dock inferior",
    tagline: "Superficies extruidas, dock de navegación abajo y KPIs con mini-gráfica",
    description:
      "Todo parece moldeado con el mismo material: los paneles no tienen borde ni color propio, sólo relieve (luz arriba a la izquierda, sombra abajo a la derecha). La navegación vive en un dock flotante inferior con iconos, cada KPI lleva una mini-gráfica de tendencia de fondo y los botones son píldoras en relieve que se hunden al activarse.",
    bestFor: ["Sensación táctil y muy limpia", "Pantallas grandes con mucho aire", "Navegación siempre al alcance del pulgar"],
    tradeoffs: ["El relieve exige fondos claros o medios", "Menos contraste entre bloques que otras opciones"],
    vibe: ["Táctil", "Suave", "Minimal"],
    shell: "dock", surface: "neu", kpi: "spark", button: "neu", list: "rows", modal: "dialog",
    chartStyle: "gradient", fontKey: "jakarta", radiusKey: "round", densityKey: "airy",
    paletteKey: "nordico-claro", defaultMode: "light",
  },
  {
    key: "material",
    name: "Material tonal",
    short: "App bar grande y chips",
    tagline: "Cabecera grande con chips, superficies tonales y resumen en una sola tarjeta",
    description:
      "Inspirada en Material You: una barra superior amplia con buscador y chips de navegación, superficies teñidas con el color de acento y esquinas enormes. Los KPIs se agrupan en una única tarjeta dividida en columnas, las listas son tarjetas tonales separadas y la acción principal es un botón flotante extendido.",
    bestFor: ["Navegar con chips sin menús laterales", "Aspecto amable y colorido", "Pantallas táctiles"],
    tradeoffs: ["Ocupa más altura en la cabecera", "Muy dependiente del color de acento"],
    vibe: ["Tonal", "Redondeado", "Amable"],
    shell: "appbar", surface: "tonal", kpi: "summary", button: "tonal", list: "cards", modal: "dialog",
    chartStyle: "solid", fontKey: "manrope", radiusKey: "pill", densityKey: "normal",
    paletteKey: "lavanda-neon", defaultMode: "light",
  },
  {
    key: "explorador",
    name: "Explorador de proyecto",
    short: "Árbol lateral y pestañas",
    tagline: "Barra de actividad, árbol de cuentas y categorías, pestañas y barra de estado",
    description:
      "Se parece a un editor de código: una barra de actividad con iconos, un árbol desplegable con tus cuentas y categorías (un clic abre su detalle), pestañas con la ruta actual y una barra de estado inferior. Los paneles son sólo contorno, los KPIs una línea «variable = valor», las listas llevan puntos guía como un recibo y los botones son cajas monoespaciadas.",
    bestFor: ["Saltar entre cuentas y categorías sin cambiar de página", "Ver el patrimonio como un árbol navegable", "Estética técnica y sobria"],
    tradeoffs: ["Curva de aprendizaje si no vienes de programar", "El árbol quita ancho al contenido"],
    vibe: ["Técnico", "Navegable", "Sobrio"],
    shell: "explorer", surface: "wire", kpi: "inline", button: "code", list: "leader", modal: "dialog",
    chartStyle: "tech", fontKey: "plex", radiusKey: "sharp", densityKey: "normal",
    paletteKey: "bosque-profundo", defaultMode: "dark",
  },
  {
    key: "banca",
    name: "App bancaria",
    short: "Saldo protagonista",
    tagline: "Cabecera con el saldo enorme, tarjetas tipo 'tarjeta de crédito', navegación flotante",
    description:
      "Estructura de app de banco moderna: una cabecera degradada con el patrimonio gigante y chips, todas las cuentas visibles a la vez como tarjetas (un clic abre su ficha en una ventana), navegación flotante en píldora, listas con avatares redondos y formularios en diálogo centrado. Contenido centrado a ~1100 px incluso en escritorio.",
    bestFor: ["Uso principal desde el móvil", "Que la primera impresión sea el saldo", "Formularios rápidos (hoja inferior)"],
    tradeoffs: ["Desaprovecha pantallas muy anchas", "Menos densidad de información"],
    vibe: ["Fintech", "Táctil", "Cercano"],
    shell: "floating", surface: "glass", kpi: "hero", button: "soft", list: "avatars", modal: "sheet",
    chartStyle: "glass", fontKey: "jakarta", radiusKey: "round", densityKey: "normal",
    paletteKey: "violeta-cristal", defaultMode: "dark",
  },
  {
    key: "feed",
    name: "Feed de historias",
    short: "Columna estrecha y línea de tiempo",
    tagline: "Columna tipo red social, KPIs como historias y movimientos en línea de tiempo",
    description:
      "Todo en una columna estrecha de lectura vertical, como una app social: cabecera con saludo, KPIs como tarjetas deslizables con degradado (estilo historias), cada panel es una «publicación» elevada, los movimientos forman una línea de tiempo con un punto de color por elemento y los botones llevan degradado. Barra de pestañas flotante abajo.",
    bestFor: ["Revisar tus finanzas en 30 segundos", "Mismo diseño en móvil y escritorio", "Lectura cómoda de arriba abajo"],
    tradeoffs: ["Desaprovecha pantallas anchas", "Los gráficos son más pequeños"],
    vibe: ["Social", "Vertical", "Dinámico"],
    shell: "feed", surface: "post", kpi: "stories", button: "gradient", list: "timeline", modal: "dialog",
    chartStyle: "neon", fontKey: "sora", radiusKey: "round", densityKey: "normal",
    paletteKey: "coral-atardecer", defaultMode: "dark",
  },
];

export const ARCHETYPE_BY_KEY: Record<string, ArchetypeDef> = Object.fromEntries(ARCHETYPES.map((a) => [a.key, a]));
export function getArchetype(key: string): ArchetypeDef {
  return ARCHETYPE_BY_KEY[key] ?? ARCHETYPES[0];
}

/* ------------------------------------------------------------------
   PALETAS (sólo color)
------------------------------------------------------------------ */

export const PALETTES: PaletteDef[] = [
  {
    key: "slate-refined",
    name: "Azul Pizarra",
    note: "Evolución directa de lo que ya tienes",
    defaultMode: "dark",
    tokens: {
      dark: {
        bg: "#070A12",
        bgImage:
          "radial-gradient(1100px 620px at 78% -12%, rgba(59,130,246,0.16), transparent 62%), radial-gradient(760px 520px at 4% 4%, rgba(34,211,238,0.08), transparent 60%)",
        surface: "rgba(17,24,39,0.86)",
        surface2: "rgba(30,41,59,0.55)",
        border: "rgba(148,163,184,0.14)",
        borderStrong: "rgba(148,163,184,0.28)",
        hover: "rgba(148,163,184,0.08)",
        text: "#F1F5F9",
        muted: "#94A3B8",
        faint: "#64748B",
        accent: "#4F8CFF",
        accent2: "#22D3EE",
        accentFg: "#05080F",
        accentSoft: "rgba(79,140,255,0.14)",
        accentGlow: "0 8px 24px -8px rgba(79,140,255,0.65)",
        pos: "#34D399",
        posSoft: "rgba(52,211,153,0.13)",
        neg: "#FB7185",
        negSoft: "rgba(251,113,133,0.13)",
        blur: "blur(10px)",
        sidebar: "rgba(10,15,26,0.9)",
        chart: ["#4F8CFF", "#22D3EE", "#A78BFA", "#34D399", "#FBBF24", "#FB7185"],
      },
      light: {
        bg: "#F3F6FC",
        bgImage:
          "radial-gradient(900px 520px at 85% -10%, rgba(37,99,235,0.12), transparent 60%), radial-gradient(700px 460px at 0% 0%, rgba(6,182,212,0.09), transparent 60%)",
        surface: "rgba(255,255,255,0.94)",
        surface2: "rgba(226,232,240,0.55)",
        border: "rgba(15,23,42,0.09)",
        borderStrong: "rgba(15,23,42,0.18)",
        hover: "rgba(15,23,42,0.04)",
        text: "#0F172A",
        muted: "#5B6B84",
        faint: "#8A99B0",
        accent: "#2563EB",
        accent2: "#0891B2",
        accentFg: "#FFFFFF",
        accentSoft: "rgba(37,99,235,0.1)",
        accentGlow: "0 8px 20px -10px rgba(37,99,235,0.55)",
        pos: "#0F9D63",
        posSoft: "rgba(15,157,99,0.11)",
        neg: "#DC3A55",
        negSoft: "rgba(220,58,85,0.1)",
        blur: "blur(8px)",
        sidebar: "rgba(255,255,255,0.86)",
        chart: ["#2563EB", "#0891B2", "#7C3AED", "#0F9D63", "#D97706", "#DC3A55"],
      },
    },
  },
  {
    key: "verde-banca",
    name: "Verde Banca",
    note: "Papel cálido, verde bosque y terracota",
    defaultMode: "light",
    tokens: {
      light: {
        bg: "#F6F4EE",
        bgImage:
          "radial-gradient(900px 520px at 88% -12%, rgba(31,111,74,0.1), transparent 62%), radial-gradient(720px 460px at 2% 2%, rgba(194,112,61,0.08), transparent 60%)",
        surface: "rgba(255,255,255,0.96)",
        surface2: "rgba(232,228,217,0.6)",
        border: "rgba(38,52,44,0.12)",
        borderStrong: "rgba(38,52,44,0.22)",
        hover: "rgba(38,52,44,0.045)",
        text: "#16211B",
        muted: "#5F6F65",
        faint: "#8B988F",
        accent: "#1F6F4A",
        accent2: "#B4632F",
        accentFg: "#FBFAF6",
        accentSoft: "rgba(31,111,74,0.1)",
        accentGlow: "0 10px 22px -12px rgba(31,111,74,0.5)",
        pos: "#1F7A4D",
        posSoft: "rgba(31,122,77,0.12)",
        neg: "#B4462F",
        negSoft: "rgba(180,70,47,0.12)",
        blur: "none",
        sidebar: "rgba(250,248,243,0.94)",
        chart: ["#1F7A4D", "#B4632F", "#3F6E8C", "#A8842C", "#6E5B8C", "#8C4A4A"],
      },
      dark: {
        bg: "#0B100D",
        bgImage:
          "radial-gradient(1000px 560px at 80% -14%, rgba(79,191,139,0.14), transparent 62%), radial-gradient(700px 480px at 4% 6%, rgba(224,138,87,0.1), transparent 60%)",
        surface: "rgba(19,27,22,0.9)",
        surface2: "rgba(32,44,37,0.6)",
        border: "rgba(226,240,230,0.11)",
        borderStrong: "rgba(226,240,230,0.22)",
        hover: "rgba(226,240,230,0.06)",
        text: "#EAF2EC",
        muted: "#9DB0A4",
        faint: "#6F8478",
        accent: "#4FBF8B",
        accent2: "#E08A57",
        accentFg: "#08120C",
        accentSoft: "rgba(79,191,139,0.14)",
        accentGlow: "0 10px 26px -10px rgba(79,191,139,0.45)",
        pos: "#5FCB98",
        posSoft: "rgba(95,203,152,0.14)",
        neg: "#E5836B",
        negSoft: "rgba(229,131,107,0.14)",
        blur: "blur(10px)",
        sidebar: "rgba(13,19,15,0.92)",
        chart: ["#4FBF8B", "#E08A57", "#6FA8C9", "#D9B44A", "#A98BC9", "#D4776B"],
      },
    },
  },
  {
    key: "neon-fintech",
    name: "Neón Fintech",
    note: "Negro absoluto, lima y cian con brillo",
    defaultMode: "dark",
    tokens: {
      dark: {
        bg: "#05060A",
        bgImage:
          "radial-gradient(900px 540px at 84% -10%, rgba(180,255,57,0.13), transparent 60%), radial-gradient(760px 520px at 6% 10%, rgba(0,229,255,0.12), transparent 62%)",
        surface: "rgba(14,17,26,0.88)",
        surface2: "rgba(24,29,44,0.7)",
        border: "rgba(154,255,197,0.12)",
        borderStrong: "rgba(154,255,197,0.26)",
        hover: "rgba(180,255,57,0.07)",
        text: "#F2F6FF",
        muted: "#8C96B2",
        faint: "#5D6784",
        accent: "#B4FF39",
        accent2: "#00E5FF",
        accentFg: "#06090E",
        accentSoft: "rgba(180,255,57,0.13)",
        accentGlow: "0 0 0 1px rgba(180,255,57,0.25), 0 10px 30px -8px rgba(180,255,57,0.5)",
        pos: "#26F5A0",
        posSoft: "rgba(38,245,160,0.14)",
        neg: "#FF4D6D",
        negSoft: "rgba(255,77,109,0.14)",
        blur: "blur(12px)",
        sidebar: "rgba(8,10,16,0.92)",
        chart: ["#B4FF39", "#00E5FF", "#26F5A0", "#A78BFA", "#FFB020", "#FF4D6D"],
      },
      light: {
        bg: "#F2F5F2",
        bgImage:
          "radial-gradient(880px 520px at 86% -12%, rgba(75,139,0,0.12), transparent 60%), radial-gradient(700px 460px at 2% 6%, rgba(0,145,181,0.1), transparent 60%)",
        surface: "rgba(255,255,255,0.95)",
        surface2: "rgba(228,235,229,0.7)",
        border: "rgba(10,20,12,0.1)",
        borderStrong: "rgba(10,20,12,0.2)",
        hover: "rgba(75,139,0,0.06)",
        text: "#0A0F0C",
        muted: "#54605A",
        faint: "#828D86",
        accent: "#4B8B00",
        accent2: "#00799B",
        accentFg: "#FFFFFF",
        accentSoft: "rgba(75,139,0,0.11)",
        accentGlow: "0 10px 22px -12px rgba(75,139,0,0.6)",
        pos: "#0B8F52",
        posSoft: "rgba(11,143,82,0.12)",
        neg: "#D62246",
        negSoft: "rgba(214,34,70,0.1)",
        blur: "none",
        sidebar: "rgba(255,255,255,0.9)",
        chart: ["#4B8B00", "#00799B", "#0B8F52", "#6D4BD8", "#C77800", "#D62246"],
      },
    },
  },
  {
    key: "nordico-claro",
    name: "Nórdico Claro",
    note: "Luz, espacio y un solo azul",
    defaultMode: "light",
    tokens: {
      light: {
        bg: "#F7F9FC",
        bgImage: "radial-gradient(1000px 600px at 90% -18%, rgba(62,99,221,0.09), transparent 62%)",
        surface: "rgba(255,255,255,0.98)",
        surface2: "rgba(240,244,250,0.9)",
        border: "rgba(22,32,46,0.08)",
        borderStrong: "rgba(22,32,46,0.16)",
        hover: "rgba(62,99,221,0.05)",
        text: "#141C28",
        muted: "#61708A",
        faint: "#93A0B5",
        accent: "#3E63DD",
        accent2: "#0E9BB8",
        accentFg: "#FFFFFF",
        accentSoft: "rgba(62,99,221,0.09)",
        accentGlow: "0 12px 24px -16px rgba(20,28,40,0.45)",
        pos: "#12895A",
        posSoft: "rgba(18,137,90,0.1)",
        neg: "#D6455D",
        negSoft: "rgba(214,69,93,0.09)",
        blur: "none",
        sidebar: "rgba(255,255,255,0.95)",
        chart: ["#3E63DD", "#0E9BB8", "#7A5AF8", "#12895A", "#E0A33E", "#D6455D"],
      },
      dark: {
        bg: "#0D1119",
        bgImage: "radial-gradient(1000px 600px at 88% -16%, rgba(110,147,255,0.12), transparent 62%)",
        surface: "rgba(21,27,38,0.92)",
        surface2: "rgba(32,41,56,0.7)",
        border: "rgba(190,205,230,0.1)",
        borderStrong: "rgba(190,205,230,0.2)",
        hover: "rgba(190,205,230,0.06)",
        text: "#E9EEF7",
        muted: "#98A5BC",
        faint: "#6B7891",
        accent: "#7D9BFF",
        accent2: "#4FC3DC",
        accentFg: "#0A0E16",
        accentSoft: "rgba(125,155,255,0.14)",
        accentGlow: "0 12px 26px -14px rgba(125,155,255,0.6)",
        pos: "#3FCF8E",
        posSoft: "rgba(63,207,142,0.13)",
        neg: "#F2708A",
        negSoft: "rgba(242,112,138,0.13)",
        blur: "blur(8px)",
        sidebar: "rgba(13,17,25,0.94)",
        chart: ["#7D9BFF", "#4FC3DC", "#A98BFF", "#3FCF8E", "#F0BE6A", "#F2708A"],
      },
    },
  },
  {
    key: "cobre-tinta",
    name: "Cobre & Tinta",
    note: "Carbón cálido, cobre y datos en mono",
    defaultMode: "dark",
    tokens: {
      dark: {
        bg: "#100E0B",
        bgImage:
          "radial-gradient(980px 560px at 82% -14%, rgba(224,145,63,0.14), transparent 62%), radial-gradient(700px 480px at 2% 8%, rgba(201,162,39,0.07), transparent 60%)",
        surface: "rgba(26,23,19,0.92)",
        surface2: "rgba(41,36,29,0.7)",
        border: "rgba(232,209,170,0.12)",
        borderStrong: "rgba(232,209,170,0.24)",
        hover: "rgba(232,209,170,0.06)",
        text: "#F4EEE4",
        muted: "#A99D8A",
        faint: "#7C7263",
        accent: "#E0913F",
        accent2: "#C9A227",
        accentFg: "#17120A",
        accentSoft: "rgba(224,145,63,0.14)",
        accentGlow: "0 10px 26px -12px rgba(224,145,63,0.55)",
        pos: "#8FBF6A",
        posSoft: "rgba(143,191,106,0.14)",
        neg: "#E0705F",
        negSoft: "rgba(224,112,95,0.14)",
        blur: "blur(8px)",
        sidebar: "rgba(18,15,12,0.94)",
        chart: ["#E0913F", "#8FBF6A", "#C9A227", "#7FA6C9", "#C97F6B", "#A78BC9"],
      },
      light: {
        bg: "#F8F5F0",
        bgImage: "radial-gradient(900px 520px at 88% -12%, rgba(185,106,30,0.1), transparent 62%)",
        surface: "rgba(255,253,250,0.97)",
        surface2: "rgba(240,234,225,0.8)",
        border: "rgba(58,46,32,0.12)",
        borderStrong: "rgba(58,46,32,0.22)",
        hover: "rgba(58,46,32,0.04)",
        text: "#221C14",
        muted: "#6E6252",
        faint: "#9A8D7B",
        accent: "#B0631B",
        accent2: "#8A7212",
        accentFg: "#FFFCF7",
        accentSoft: "rgba(176,99,27,0.1)",
        accentGlow: "0 10px 20px -14px rgba(58,46,32,0.6)",
        pos: "#4E7C31",
        posSoft: "rgba(78,124,49,0.12)",
        neg: "#B4483A",
        negSoft: "rgba(180,72,58,0.1)",
        blur: "none",
        sidebar: "rgba(252,249,244,0.96)",
        chart: ["#B0631B", "#4E7C31", "#8A7212", "#3E6480", "#96513F", "#6B5488"],
      },
    },
  },
  {
    key: "violeta-cristal",
    name: "Violeta Cristal",
    note: "Malla de color, tarjetas de cristal",
    defaultMode: "dark",
    tokens: {
      dark: {
        bg: "#0A0713",
        bgImage:
          "radial-gradient(900px 620px at 12% -8%, rgba(139,92,246,0.28), transparent 58%), radial-gradient(820px 560px at 92% 8%, rgba(236,72,153,0.2), transparent 60%), radial-gradient(760px 700px at 60% 108%, rgba(56,189,248,0.16), transparent 62%)",
        surface: "rgba(255,255,255,0.055)",
        surface2: "rgba(255,255,255,0.09)",
        border: "rgba(255,255,255,0.12)",
        borderStrong: "rgba(255,255,255,0.24)",
        hover: "rgba(255,255,255,0.07)",
        text: "#F3EEFF",
        muted: "#B0A5D6",
        faint: "#8178A8",
        accent: "#A78BFA",
        accent2: "#F472B6",
        accentFg: "#150C29",
        accentSoft: "rgba(167,139,250,0.18)",
        accentGlow: "0 14px 34px -12px rgba(167,139,250,0.7)",
        pos: "#34D399",
        posSoft: "rgba(52,211,153,0.15)",
        neg: "#FB7185",
        negSoft: "rgba(251,113,133,0.15)",
        blur: "blur(18px) saturate(140%)",
        sidebar: "rgba(255,255,255,0.04)",
        chart: ["#A78BFA", "#F472B6", "#38BDF8", "#34D399", "#FBBF24", "#FB7185"],
      },
      light: {
        bg: "#F5F3FF",
        bgImage:
          "radial-gradient(900px 600px at 10% -10%, rgba(124,58,237,0.16), transparent 58%), radial-gradient(780px 520px at 92% 4%, rgba(219,39,119,0.12), transparent 60%), radial-gradient(700px 620px at 55% 110%, rgba(14,165,233,0.12), transparent 60%)",
        surface: "rgba(255,255,255,0.72)",
        surface2: "rgba(255,255,255,0.55)",
        border: "rgba(76,54,140,0.14)",
        borderStrong: "rgba(76,54,140,0.26)",
        hover: "rgba(124,58,237,0.06)",
        text: "#1D1740",
        muted: "#5F5885",
        faint: "#8B84AC",
        accent: "#7C3AED",
        accent2: "#DB2777",
        accentFg: "#FFFFFF",
        accentSoft: "rgba(124,58,237,0.11)",
        accentGlow: "0 14px 30px -16px rgba(124,58,237,0.65)",
        pos: "#0E9F6E",
        posSoft: "rgba(14,159,110,0.12)",
        neg: "#E0245E",
        negSoft: "rgba(224,36,94,0.1)",
        blur: "blur(14px) saturate(130%)",
        sidebar: "rgba(255,255,255,0.5)",
        chart: ["#7C3AED", "#DB2777", "#0EA5E9", "#0E9F6E", "#D97706", "#E0245E"],
      },
    },
  },
];


/* ------------------------------------------------------------------
   Paletas 7–10 (definidas con un generador compacto)
------------------------------------------------------------------ */

interface PaletteSeed {
  dark: boolean;
  bg: string; surface: string; surface2: string; line: string;
  text: string; muted: string; faint: string;
  accent: string; accent2: string; accentFg: string;
  pos: string; neg: string;
  chart: string[];
}

function buildTokens(s: PaletteSeed): ModeTokens {
  return {
    bg: s.bg,
    bgImage: `radial-gradient(1000px 560px at 82% -12%, ${hexA(s.accent, s.dark ? 0.16 : 0.12)}, transparent 62%), radial-gradient(720px 480px at 4% 6%, ${hexA(s.accent2, s.dark ? 0.1 : 0.09)}, transparent 60%)`,
    surface: hexA(s.surface, s.dark ? 0.9 : 0.96),
    surface2: hexA(s.surface2, s.dark ? 0.6 : 0.75),
    border: hexA(s.line, s.dark ? 0.12 : 0.11),
    borderStrong: hexA(s.line, s.dark ? 0.24 : 0.22),
    hover: hexA(s.line, s.dark ? 0.06 : 0.05),
    text: s.text, muted: s.muted, faint: s.faint,
    accent: s.accent, accent2: s.accent2, accentFg: s.accentFg,
    accentSoft: hexA(s.accent, 0.14),
    accentGlow: `0 10px 26px -10px ${hexA(s.accent, 0.55)}`,
    pos: s.pos, posSoft: hexA(s.pos, 0.13),
    neg: s.neg, negSoft: hexA(s.neg, 0.13),
    blur: s.dark ? "blur(10px)" : "none",
    sidebar: hexA(s.bg, 0.92),
    chart: s.chart,
  };
}

PALETTES.push(
  {
    key: "coral-atardecer", name: "Coral Atardecer", note: "Cálida: coral, mandarina y rosa", defaultMode: "dark",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#120B0C", surface: "#1E1415", surface2: "#2D1E1F", line: "#FFD9CC", text: "#FFF1EC", muted: "#C4A59D", faint: "#8F7570", accent: "#FF6B5E", accent2: "#FFB347", accentFg: "#1A0907", pos: "#5EDC9A", neg: "#FF5C7A", chart: ["#FF6B5E", "#FFB347", "#F25C9A", "#FFD166", "#9B5DE5", "#4CC9F0", "#06D6A0", "#F78C6B", "#C77DFF", "#80ED99", "#EF476F", "#90A4AE"] }),
      light: buildTokens({ dark: false, bg: "#FFF6F2", surface: "#FFFFFF", surface2: "#FBE6DE", line: "#5A2A20", text: "#2B1411", muted: "#7A5149", faint: "#A98479", accent: "#E8493B", accent2: "#F08A24", accentFg: "#FFFFFF", pos: "#168F5A", neg: "#D1244A", chart: ["#E8493B", "#F08A24", "#D6336C", "#C99700", "#7E3FD6", "#0E8FBF", "#0A9E77", "#D9653F", "#9D4EDD", "#2F9E55", "#C2255C", "#607D8B"] }),
    },
  },
  {
    key: "oceano-turquesa", name: "Océano Turquesa", note: "Fresca: turquesa, azul y menta", defaultMode: "dark",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#06121A", surface: "#0C1D28", surface2: "#14303F", line: "#BDEBFF", text: "#E8F8FF", muted: "#8FB8C8", faint: "#5F8799", accent: "#19D3C5", accent2: "#3B9EFF", accentFg: "#03181A", pos: "#4ADE80", neg: "#FF6B81", chart: ["#19D3C5", "#3B9EFF", "#7C83FD", "#4ADE80", "#FFC857", "#FF6B81", "#00B4D8", "#90E0EF", "#B388FF", "#2DD4BF", "#F59E0B", "#94A3B8"] }),
      light: buildTokens({ dark: false, bg: "#EEF8FA", surface: "#FFFFFF", surface2: "#D9EEF2", line: "#0B3A47", text: "#0A2530", muted: "#4C6F7C", faint: "#7C9AA5", accent: "#0B9A93", accent2: "#1F6FEB", accentFg: "#FFFFFF", pos: "#12894F", neg: "#D43A55", chart: ["#0B9A93", "#1F6FEB", "#5B5FE0", "#12894F", "#C98A00", "#D43A55", "#0090B0", "#3AA8C8", "#7E57C2", "#0E8F83", "#D97706", "#64748B"] }),
    },
  },
  {
    key: "grafito-mono", name: "Grafito Monocromo", note: "Sobria: grises con acento blanco/negro", defaultMode: "dark",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#0B0B0C", surface: "#151516", surface2: "#202022", line: "#FFFFFF", text: "#F4F4F5", muted: "#A1A1AA", faint: "#71717A", accent: "#F4F4F5", accent2: "#A1A1AA", accentFg: "#0B0B0C", pos: "#86EFAC", neg: "#FCA5A5", chart: ["#E4E4E7", "#7DA3C7", "#A1A1AA", "#C7B38A", "#71717A", "#9BB5A0", "#D4D4D8", "#B58E8E", "#52525B", "#8EA0C9", "#BFBFC6", "#A39E93"] }),
      light: buildTokens({ dark: false, bg: "#F6F6F5", surface: "#FFFFFF", surface2: "#ECECEA", line: "#111111", text: "#111111", muted: "#5E5E63", faint: "#8E8E94", accent: "#111111", accent2: "#52525B", accentFg: "#FFFFFF", pos: "#1C7C4B", neg: "#B3261E", chart: ["#18181B", "#3B6A97", "#71717A", "#8B6B2E", "#A1A1AA", "#4D7C5B", "#3F3F46", "#8E4A4A", "#52525B", "#5667A0", "#27272A", "#7A756B"] }),
    },
  },
  {
    key: "carmin-ejecutivo", name: "Carmín Ejecutivo", note: "Elegante: carmesí, oro y burdeos", defaultMode: "dark",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#0F0A0C", surface: "#1A1114", surface2: "#2A1A20", line: "#FFD6E0", text: "#FBEFF2", muted: "#BFA0A8", faint: "#8A6E76", accent: "#E0314F", accent2: "#D4AF37", accentFg: "#FFFFFF", pos: "#4CC38A", neg: "#FF7A8A", chart: ["#E0314F", "#D4AF37", "#8E6BBF", "#4CC38A", "#E8825B", "#5B9BD5", "#C2185B", "#F2C94C", "#B39DDB", "#26A69A", "#FF8A65", "#90A4AE"] }),
      light: buildTokens({ dark: false, bg: "#FBF5F6", surface: "#FFFFFF", surface2: "#F3E3E7", line: "#3A1019", text: "#2A0F16", muted: "#765059", faint: "#A3808A", accent: "#B3122F", accent2: "#A07A12", accentFg: "#FFFFFF", pos: "#1B7F4E", neg: "#C0213F", chart: ["#B3122F", "#A07A12", "#6A4C9C", "#1B7F4E", "#C25B2E", "#2F6DB3", "#9C1550", "#C79A1A", "#7E57C2", "#00897B", "#E0603A", "#607D8B"] }),
    },
  },
);

/* ------------------------------------------------------------------
   Paletas 11–20 (mismo generador compacto)
------------------------------------------------------------------ */

PALETTES.push(
  {
    key: "lavanda-neon", name: "Lavanda Neón", note: "Violeta eléctrico con fucsia", defaultMode: "dark",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#0E0B1A", surface: "#181226", surface2: "#251B3D", line: "#D9CFFF", text: "#F2EDFF", muted: "#A89BCF", faint: "#766B9C", accent: "#A78BFA", accent2: "#F0ABFC", accentFg: "#14092B", pos: "#5EEAD4", neg: "#FB7185", chart: ["#A78BFA", "#F0ABFC", "#818CF8", "#5EEAD4", "#F9A8D4", "#C4B5FD", "#7C6FF0", "#E879F9", "#93C5FD", "#6EE7B7", "#FDA4AF", "#94A3B8"] }),
      light: buildTokens({ dark: false, bg: "#F6F3FF", surface: "#FFFFFF", surface2: "#E9E2FA", line: "#2E1A5E", text: "#1D1440", muted: "#5F5885", faint: "#8B84AC", accent: "#7C3AED", accent2: "#C026D3", accentFg: "#FFFFFF", pos: "#0E9F6E", neg: "#E0245E", chart: ["#7C3AED", "#C026D3", "#4F46E5", "#0E9F6E", "#DB2777", "#8B5CF6", "#6D28D9", "#A21CAF", "#2563EB", "#059669", "#E11D48", "#64748B"] }),
    },
  },
  {
    key: "miel-mostaza", name: "Miel Mostaza", note: "Ámbar cálido con naranja quemado", defaultMode: "light",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#141009", surface: "#211A0E", surface2: "#332916", line: "#FFE9B8", text: "#FFF6E3", muted: "#C9B285", faint: "#8F7D58", accent: "#F5B81E", accent2: "#FF8A3D", accentFg: "#1D1404", pos: "#7ED492", neg: "#FF7A6B", chart: ["#F5B81E", "#FF8A3D", "#FFD166", "#7ED492", "#E07A3F", "#F4E285", "#C98A00", "#8AC926", "#F4845F", "#06D6A0", "#EF476F", "#A3A380"] }),
      light: buildTokens({ dark: false, bg: "#FDF6E7", surface: "#FFFFFF", surface2: "#F5E8C8", line: "#4A3410", text: "#2B2008", muted: "#75633F", faint: "#A08D68", accent: "#B97A0B", accent2: "#D95F1E", accentFg: "#FFFFFF", pos: "#1B7F4E", neg: "#C0392B", chart: ["#B97A0B", "#D95F1E", "#C99700", "#1B7F4E", "#B5541F", "#96700A", "#8A5A00", "#5B8C2A", "#C25B2E", "#0A9E77", "#B3261E", "#7A756B"] }),
    },
  },
  {
    key: "bosque-profundo", name: "Bosque Profundo", note: "Verdes oscuros con lima", defaultMode: "dark",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#07120C", surface: "#0C1F14", surface2: "#143322", line: "#C4F0D2", text: "#EAF7EF", muted: "#93B8A1", faint: "#63856F", accent: "#4ADE80", accent2: "#A3E635", accentFg: "#04140A", pos: "#4ADE80", neg: "#FF7A7A", chart: ["#4ADE80", "#A3E635", "#2DD4BF", "#FACC15", "#86EFAC", "#34D399", "#BEF264", "#5EEAD4", "#FBBF24", "#6EE7B7", "#F87171", "#94A3B8"] }),
      light: buildTokens({ dark: false, bg: "#EFF7F0", surface: "#FFFFFF", surface2: "#D8EBDC", line: "#0E3A21", text: "#0B2413", muted: "#4A6B57", faint: "#7A9785", accent: "#15803D", accent2: "#4D7C0F", accentFg: "#FFFFFF", pos: "#15803D", neg: "#C0392B", chart: ["#15803D", "#4D7C0F", "#0F766E", "#A16207", "#2F9E55", "#0E9F6E", "#65A30D", "#0B9A93", "#C98A00", "#1B7F4E", "#B3261E", "#64748B"] }),
    },
  },
  {
    key: "cielo-nordico", name: "Cielo Nórdico", note: "Azules pálidos y aireados", defaultMode: "light",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#0A1420", surface: "#12202F", surface2: "#1C3247", line: "#C9E6FA", text: "#ECF6FE", muted: "#93B4C9", faint: "#637E92", accent: "#7DD3FC", accent2: "#A5B4FC", accentFg: "#081521", pos: "#6EE7B7", neg: "#FDA4AF", chart: ["#7DD3FC", "#A5B4FC", "#38BDF8", "#6EE7B7", "#F0ABFC", "#93C5FD", "#67E8F9", "#C4B5FD", "#5B9BD5", "#4ADE80", "#F9A8D4", "#94A3B8"] }),
      light: buildTokens({ dark: false, bg: "#F2F8FD", surface: "#FFFFFF", surface2: "#DFEDF7", line: "#14324A", text: "#0E2233", muted: "#4E6B82", faint: "#7F9AB0", accent: "#0284C7", accent2: "#4F46E5", accentFg: "#FFFFFF", pos: "#12894F", neg: "#D43A55", chart: ["#0284C7", "#4F46E5", "#0369A1", "#12894F", "#C026D3", "#1D4ED8", "#0E7490", "#7C3AED", "#2F6DB3", "#0E9F6E", "#BE123C", "#64748B"] }),
    },
  },
  {
    key: "fresa-nata", name: "Fresa y Nata", note: "Rosas dulces y alegres", defaultMode: "light",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#180B12", surface: "#25141D", surface2: "#3A1F2B", line: "#FFD3DE", text: "#FFF0F4", muted: "#D3A3B1", faint: "#96707C", accent: "#FB7185", accent2: "#F9A8D4", accentFg: "#2B0812", pos: "#6EE7B7", neg: "#FF4D6D", chart: ["#FB7185", "#F9A8D4", "#F43F5E", "#6EE7B7", "#FDA4AF", "#E879F9", "#FCA5A5", "#F0ABFC", "#F472B6", "#5EEAD4", "#EF4444", "#C4A5B0"] }),
      light: buildTokens({ dark: false, bg: "#FFF3F5", surface: "#FFFFFF", surface2: "#FADFE5", line: "#4A1220", text: "#33101A", muted: "#7D4A56", faint: "#AD7F88", accent: "#E11D48", accent2: "#DB2777", accentFg: "#FFFFFF", pos: "#1B7F4E", neg: "#B91C1C", chart: ["#E11D48", "#DB2777", "#BE123C", "#1B7F4E", "#F43F5E", "#A21CAF", "#E85D75", "#C026D3", "#EC4899", "#0E9F6E", "#B91C1C", "#8E8E93"] }),
    },
  },
  {
    key: "petroleo-nocturno", name: "Petróleo Nocturno", note: "Cian petróleo sobrio y técnico", defaultMode: "dark",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#081013", surface: "#0F1D22", surface2: "#1A3038", line: "#C2E3EC", text: "#EAF6F9", muted: "#8FAFB9", faint: "#617F89", accent: "#22D3EE", accent2: "#94A3B8", accentFg: "#04181D", pos: "#5EEAD4", neg: "#FF8A80", chart: ["#22D3EE", "#94A3B8", "#2DD4BF", "#FFD166", "#5EEAD4", "#67E8F9", "#A5B4FC", "#F9A8D4", "#7DD3FC", "#4ADE80", "#FCA5A5", "#64748B"] }),
      light: buildTokens({ dark: false, bg: "#EFF5F6", surface: "#FFFFFF", surface2: "#D9E6E9", line: "#12333B", text: "#0D2329", muted: "#4B666E", faint: "#7E969E", accent: "#0E7490", accent2: "#475569", accentFg: "#FFFFFF", pos: "#12894F", neg: "#C0392B", chart: ["#0E7490", "#475569", "#0F766E", "#A16207", "#0A9E77", "#0284C7", "#4F46E5", "#DB2777", "#0369A1", "#15803D", "#B3261E", "#64748B"] }),
    },
  },
  {
    key: "oliva-mediterraneo", name: "Oliva Mediterráneo", note: "Verde oliva con terracota", defaultMode: "light",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#101208", surface: "#1A1E0F", surface2: "#2B3018", line: "#E4E9C2", text: "#F5F7E8", muted: "#B3BA8F", faint: "#7F8560", accent: "#A3B86A", accent2: "#E07A3F", accentFg: "#141702", pos: "#8FD18A", neg: "#E8736B", chart: ["#A3B86A", "#E07A3F", "#D9C66C", "#8FD18A", "#C97B4A", "#BECE7A", "#7A9E43", "#E8A87C", "#6B8E5A", "#F2D06B", "#D95F4B", "#9AA08A"] }),
      light: buildTokens({ dark: false, bg: "#F7F8EE", surface: "#FFFFFF", surface2: "#E8EAD2", line: "#333A14", text: "#22260E", muted: "#60663F", faint: "#8E9370", accent: "#5F701A", accent2: "#B5541F", accentFg: "#FFFFFF", pos: "#2E7D32", neg: "#B3261E", chart: ["#5F701A", "#B5541F", "#8A7A1A", "#2E7D32", "#8C4E22", "#7A8A2E", "#4A5D12", "#C97B4A", "#3E6B34", "#A68A1A", "#96281B", "#6E7260"] }),
    },
  },
  {
    key: "indigo-medianoche", name: "Índigo Medianoche", note: "Azul noche profundo y eléctrico", defaultMode: "dark",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#080B1C", surface: "#10142B", surface2: "#1A2145", line: "#C7D2FE", text: "#EEF1FF", muted: "#9AA5D1", faint: "#6A739E", accent: "#818CF8", accent2: "#22D3EE", accentFg: "#0A0E26", pos: "#5EEAD4", neg: "#FB7185", chart: ["#818CF8", "#22D3EE", "#A5B4FC", "#5EEAD4", "#F0ABFC", "#93C5FD", "#6366F1", "#67E8F9", "#C4B5FD", "#4ADE80", "#FDA4AF", "#8B93B8"] }),
      light: buildTokens({ dark: false, bg: "#EFF1FB", surface: "#FFFFFF", surface2: "#DEE3F5", line: "#1A2150", text: "#12173A", muted: "#4E5680", faint: "#7E86AB", accent: "#4338CA", accent2: "#0E7490", accentFg: "#FFFFFF", pos: "#12894F", neg: "#D43A55", chart: ["#4338CA", "#0E7490", "#3730A3", "#12894F", "#A21CAF", "#1E40AF", "#4F46E5", "#0284C7", "#6D28D9", "#15803D", "#BE123C", "#64748B"] }),
    },
  },
  {
    key: "melocoton-suave", name: "Melocotón Suave", note: "Melocotón cálido y amable", defaultMode: "light",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#170E0A", surface: "#241610", surface2: "#38231A", line: "#FFDCC4", text: "#FFF4EA", muted: "#D0A98F", faint: "#96705A", accent: "#FB923C", accent2: "#F472B6", accentFg: "#2A1004", pos: "#7ED492", neg: "#FF6B81", chart: ["#FB923C", "#F472B6", "#FDBA74", "#7ED492", "#FCA5A5", "#F9A8D4", "#F97316", "#E879F9", "#FED7AA", "#6EE7B7", "#EF4444", "#B8A89A"] }),
      light: buildTokens({ dark: false, bg: "#FFF6EF", surface: "#FFFFFF", surface2: "#F9E4D2", line: "#4A2410", text: "#331B0C", muted: "#7D5A44", faint: "#AD8F76", accent: "#EA580C", accent2: "#DB2777", accentFg: "#FFFFFF", pos: "#1B7F4E", neg: "#C0392B", chart: ["#EA580C", "#DB2777", "#C2410C", "#1B7F4E", "#E85D75", "#A21CAF", "#9A3412", "#C026D3", "#F97316", "#15803D", "#B91C1C", "#8E8E93"] }),
    },
  },
  {
    key: "esmeralda-oro", name: "Esmeralda y Oro", note: "Verde joya con dorado elegante", defaultMode: "dark",
    tokens: {
      dark: buildTokens({ dark: true, bg: "#071310", surface: "#0D2019", surface2: "#153229", line: "#C9F0DC", text: "#EBFAF2", muted: "#8FB9A5", faint: "#5F8475", accent: "#10B981", accent2: "#E3B341", accentFg: "#03231A", pos: "#34D399", neg: "#FF7A8A", chart: ["#10B981", "#E3B341", "#34D399", "#F2C94C", "#6EE7B7", "#2DD4BF", "#0EA47A", "#D4AF37", "#5EEAD4", "#A7F3D0", "#F87171", "#8AA39A"] }),
      light: buildTokens({ dark: false, bg: "#EFF8F3", surface: "#FFFFFF", surface2: "#D9ECE1", line: "#0C3828", text: "#0A231B", muted: "#486B5D", faint: "#7C9A8C", accent: "#047857", accent2: "#A07A12", accentFg: "#FFFFFF", pos: "#047857", neg: "#C0213F", chart: ["#047857", "#A07A12", "#059669", "#C79A1A", "#0E9F6E", "#0F766E", "#065F46", "#8A6D00", "#0B9A93", "#2F9E55", "#B91C1C", "#64748B"] }),
    },
  },
);

/* ------------------------------------------------------------------
   Paletas definidas por colores base (las integradas nuevas y las personalizadas)
------------------------------------------------------------------ */

/** 12 colores de gráfica repartidos por el círculo cromático a partir del acento */
export function genChart(accent: string, accent2: string, dark: boolean): string[] {
  const h = hueOf(accent);
  const sat = dark ? 70 : 62;
  const lum = dark ? 64 : 46;
  const offsets = [150, 210, 60, 280, 330, 100, 20, 240, 180, 310];
  return [accent, accent2, ...offsets.map((o, i) => hslToHex(h + o, sat - (i % 3) * 4, lum + ((i % 2) * 4 - 2)))];
}

export function deriveSeed(b: BaseSeed & { chart?: string[] }, dark: boolean): PaletteSeed {
  return {
    dark,
    bg: b.bg,
    surface: b.surface,
    surface2: mixHex(b.surface, b.text, dark ? 0.1 : 0.07),
    line: b.text,
    text: b.text,
    muted: mixHex(b.text, b.bg, 0.42),
    faint: mixHex(b.text, b.bg, 0.62),
    accent: b.accent,
    accent2: b.accent2,
    accentFg: onColor(b.accent),
    pos: b.pos,
    neg: b.neg,
    chart: b.chart && b.chart.length >= 12 ? b.chart.slice(0, 12) : genChart(b.accent, b.accent2, dark),
  };
}

export function tokensFromBase(b: BaseSeed & { chart?: string[] }, dark: boolean): ModeTokens {
  return buildTokens(deriveSeed(b, dark));
}

function makePalette(key: string, name: string, note: string, defaultMode: ModeKey, dark: BaseSeed, light: BaseSeed): PaletteDef {
  return { key, name, note, defaultMode, tokens: { dark: tokensFromBase(dark, true), light: tokensFromBase(light, false) } };
}

const B = (bg: string, surface: string, text: string, accent: string, accent2: string, pos: string, neg: string): BaseSeed => ({ bg, surface, text, accent, accent2, pos, neg });

PALETTES.push(
  makePalette("uva-ciruela", "Uva y Ciruela", "Ciruela profunda con fucsia", "dark", B("#120816", "#1D0F24", "#F7EAFB", "#D946EF", "#FB7185", "#6EE7B7", "#FB7185"), B("#FBF3FD", "#FFFFFF", "#2A0F33", "#A21CAF", "#DB2777", "#15803D", "#BE123C")),
  makePalette("cobalto-industrial", "Cobalto Industrial", "Acero oscuro, cobalto y naranja", "dark", B("#0B1018", "#131B27", "#E9EEF7", "#3B82F6", "#F59E0B", "#34D399", "#F87171"), B("#EEF2F8", "#FFFFFF", "#0F1A2B", "#1D4ED8", "#D97706", "#15803D", "#DC2626")),
  makePalette("sakura", "Sakura", "Rosa cerezo y verde hoja", "light", B("#160D12", "#22141B", "#FCEFF4", "#F9A8D4", "#86EFAC", "#86EFAC", "#FDA4AF"), B("#FFF5F8", "#FFFFFF", "#3A1426", "#DB2777", "#16A34A", "#15803D", "#BE123C")),
  makePalette("naranja-mecanica", "Naranja Mecánica", "Naranja vivo sobre carbón", "dark", B("#0F0D0B", "#1B1713", "#FFF4E8", "#FF7A00", "#FFD60A", "#7EE787", "#FF5C5C"), B("#FFF7EE", "#FFFFFF", "#2B1A08", "#E86100", "#B88700", "#1B7F4E", "#C62828")),
  makePalette("limon-electrico", "Limón Eléctrico", "Lima fluorescente y negro", "dark", B("#0C0E08", "#161A0E", "#F6F8E8", "#D4F000", "#7CFC9A", "#7CFC9A", "#FF6B6B"), B("#F8FAEA", "#FFFFFF", "#1C2208", "#6B7F00", "#0F9D58", "#0F9D58", "#C62828")),
  makePalette("piedra-calida", "Piedra Cálida", "Arena, taupe y terracota", "light", B("#13110F", "#1E1B18", "#F3EEE8", "#D08A5E", "#A3B18A", "#A3B18A", "#E07A6B"), B("#F5F1EB", "#FFFFFF", "#2B2620", "#B4673A", "#6B7F4E", "#4E7C31", "#B3382C")),
  makePalette("acero-frio", "Acero Frío", "Gris azulado sobrio", "dark", B("#0D1114", "#161C21", "#E8EDF1", "#8FB3D9", "#C0CAD4", "#6FD3A5", "#F08A8A"), B("#EEF1F4", "#FFFFFF", "#121A21", "#3E6A94", "#5B6B7B", "#1E8A5B", "#C0392B")),
  makePalette("rojo-racing", "Rojo Racing", "Rojo competición, negro y blanco", "dark", B("#0B0A0A", "#171414", "#F6F2F2", "#E10600", "#F5F5F5", "#4ADE80", "#FF8A80"), B("#F6F4F4", "#FFFFFF", "#141010", "#C20500", "#222222", "#15803D", "#B71C1C")),
  makePalette("mar-egeo", "Mar Egeo", "Azul griego con dorado", "light", B("#07121F", "#0E1D31", "#EAF2FB", "#4DA3FF", "#F6C945", "#5FD6A0", "#FF7B7B"), B("#F2F8FD", "#FFFFFF", "#0C2340", "#0B5FB0", "#C99A06", "#13804E", "#C62828")),
  makePalette("synthwave", "Synthwave", "Neones rosa y cian de los 80", "dark", B("#0D0221", "#170938", "#F5E9FF", "#FF2E97", "#00E5FF", "#3DFFB1", "#FF5C7A"), B("#F6F0FF", "#FFFFFF", "#240B4D", "#D4147A", "#0089A6", "#0E9F6E", "#D61F4F")),
  makePalette("te-matcha", "Té Matcha", "Verde matcha y crema", "light", B("#0E120C", "#171D13", "#EEF3E6", "#9BC53D", "#E8D8A0", "#9BC53D", "#E58572"), B("#F3F5EA", "#FFFFFF", "#222B16", "#5A7D1E", "#A68A2E", "#3F7D1E", "#B5402D")),
  makePalette("chocolate-menta", "Chocolate y Menta", "Cacao oscuro con menta", "dark", B("#120C09", "#1F1510", "#F7EDE6", "#5EEAD4", "#E8A87C", "#5EEAD4", "#F28B82"), B("#F8F1EC", "#FFFFFF", "#2E1B12", "#0F8F7D", "#A0522D", "#0F8F7D", "#B3382C")),
  makePalette("tinta-papel", "Tinta y Papel", "Blanco y negro con rojo editorial", "light", B("#0E0E0E", "#181818", "#F5F5F0", "#F5F5F0", "#FF4D3D", "#7DD87D", "#FF6B5B"), B("#F7F5EF", "#FFFFFF", "#111111", "#111111", "#D93025", "#1B7F3B", "#D93025")),
  makePalette("amanecer-dorado", "Amanecer Dorado", "Crema, oro y rosa", "light", B("#150F10", "#211618", "#FFF1E6", "#FFB86B", "#F78FB3", "#8BD8A0", "#FF7F8E"), B("#FFF6EC", "#FFFFFF", "#34190E", "#E07B00", "#D6336C", "#2E8B57", "#C0392B")),
);

/** Construye una paleta completa (claro + oscuro) a partir de los colores base guardados por el usuario */
export function buildCustomPalette(def: { key: string; name: string; seeds: CustomSeeds }): PaletteDef {
  return {
    key: def.key,
    name: def.name,
    note: "Paleta personalizada",
    defaultMode: "dark",
    custom: true,
    seeds: def.seeds,
    tokens: { dark: tokensFromBase(def.seeds.dark, true), light: tokensFromBase(def.seeds.light, false) },
  };
}

/** Extrae los colores base de cualquier paleta para usarla como punto de partida */
export function seedsFromPalette(p: PaletteDef): CustomSeeds {
  if (p.seeds) return JSON.parse(JSON.stringify(p.seeds)) as CustomSeeds;
  const one = (mode: ModeKey): FullSeed => {
    const t = p.tokens[mode];
    const bg = toHexOver(t.bg, "#000000");
    const chart = [...t.chart];
    while (chart.length < 12) chart.push(chart[chart.length % Math.max(chart.length, 1)] ?? t.accent);
    return { bg, surface: toHexOver(t.surface, bg), text: toHexOver(t.text, bg), accent: toHexOver(t.accent, bg), accent2: toHexOver(t.accent2, bg), pos: toHexOver(t.pos, bg), neg: toHexOver(t.neg, bg), chart: chart.slice(0, 12).map((c) => toHexOver(c, bg)) };
  };
  return { dark: one("dark"), light: one("light") };
}

/** Valida datos externos (BD / API) y devuelve los colores base o null si no son válidos */
export function parseSeeds(raw: unknown): CustomSeeds | null {
  if (!raw || typeof raw !== "object") return null;
  const hex6 = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
  const one = (r: unknown): FullSeed | null => {
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    const keys = ["bg", "surface", "text", "accent", "accent2", "pos", "neg"] as const;
    if (!keys.every((k) => hex6(o[k]))) return null;
    if (!Array.isArray(o.chart) || o.chart.length !== 12 || !o.chart.every(hex6)) return null;
    return { bg: o.bg as string, surface: o.surface as string, text: o.text as string, accent: o.accent as string, accent2: o.accent2 as string, pos: o.pos as string, neg: o.neg as string, chart: o.chart as string[] };
  };
  const d = one((raw as Record<string, unknown>).dark);
  const l = one((raw as Record<string, unknown>).light);
  return d && l ? { dark: d, light: l } : null;
}

/* Amplía cada paleta de 6 a 12 colores para dar más variedad a cuentas y
   categorías sin tocar la identidad cromática de cada propuesta: se añaden
   6 tonos complementarios ajustados al brillo de cada modo. */
const EXTRA_CHART_DARK = ["#38BDF8", "#FB923C", "#C084FC", "#4ADE80", "#F472B6", "#94A3B8"];
const EXTRA_CHART_LIGHT = ["#0284C7", "#EA580C", "#9333EA", "#16A34A", "#DB2777", "#64748B"];

for (const p of PALETTES) {
  for (const mode of ["dark", "light"] as ModeKey[]) {
    const t = p.tokens[mode];
    if (!t || t.chart.length >= 12) continue;
    const extra = mode === "dark" ? EXTRA_CHART_DARK : EXTRA_CHART_LIGHT;
    const extended = [...t.chart];
    for (const c of extra) {
      if (extended.length >= 12) break;
      if (!extended.includes(c)) extended.push(c);
    }
    while (extended.length < 12) extended.push(extra[extended.length % extra.length]);
    t.chart = extended.slice(0, 12);
  }
}

export const PALETTE_BY_KEY: Record<string, PaletteDef> = Object.fromEntries(PALETTES.map((p) => [p.key, p]));
export function getPalette(key: string): PaletteDef {
  return PALETTE_BY_KEY[key] ?? PALETTES[0];
}

/* ------------------------------------------------------------------
   Configuración
------------------------------------------------------------------ */

export type DonutKey = "ring" | "thick" | "segmented" | "rounded" | "pie" | "semi";

export const DONUTS: Record<DonutKey, { name: string; note: string }> = {
  ring: { name: "Anillo clásico", note: "Anillo de grosor medio con separación fina." },
  thick: { name: "Anillo grueso", note: "Anillo ancho, muy visible para pocas categorías." },
  segmented: { name: "Segmentado", note: "Anillo fino con separaciones amplias entre tramos." },
  rounded: { name: "Redondeado", note: "Tramos con esquinas suaves y separación holgada." },
  pie: { name: "Tarta", note: "Disco completo sin hueco central." },
  semi: { name: "Semicírculo", note: "Medidor en arco con el total debajo." },
};

export interface DesignConfig {
  archetypeKey: string;
  paletteKey: string;
  mode: ModeKey;
  fontKey: FontKey;
  chartStyleKey: ChartStyleKey;
  radiusKey: RadiusKey;
  densityKey: DensityKey;
  device: DeviceKey;
  /** Color de acento personalizado (hex) que sustituye al de la paleta */
  accentOverride: string | null;
  /** Estilo de los gráficos de donut */
  donutKey: DonutKey;
}

export function configFromArchetype(key: string, device: DeviceKey = "desktop"): DesignConfig {
  const a = getArchetype(key);
  return {
    archetypeKey: a.key,
    paletteKey: a.paletteKey,
    mode: a.defaultMode,
    fontKey: a.fontKey,
    chartStyleKey: a.chartStyle,
    radiusKey: a.radiusKey,
    densityKey: a.densityKey,
    device,
    accentOverride: null,
    donutKey: "ring",
  };
}

export function defaultConfig(): DesignConfig {
  return configFromArchetype(ARCHETYPES[0].key);
}

const MODES: ModeKey[] = ["dark", "light"];
const FONT_KEYS = Object.keys(FONTS) as FontKey[];
const CHART_KEYS = Object.keys(CHART_STYLES) as ChartStyleKey[];
const RADIUS_KEYS = Object.keys(RADII) as RadiusKey[];
const DENSITY_KEYS = Object.keys(DENSITIES) as DensityKey[];
const DEVICE_KEYS: DeviceKey[] = ["desktop", "mobile"];

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Normaliza datos desconocidos (BD, API) a una configuración válida. */
export function coerceConfig(payload: Record<string, unknown>): DesignConfig {
  const rawArch = typeof payload.archetypeKey === "string" ? payload.archetypeKey : typeof payload.themeKey === "string" ? payload.themeKey : "";
  const a = getArchetype(rawArch);
  const rawPalette = typeof payload.paletteKey === "string" ? payload.paletteKey : a.paletteKey;
  const paletteKey = PALETTE_BY_KEY[rawPalette] || /^custom-[a-z0-9-]{3,60}$/.test(rawPalette) ? rawPalette : a.paletteKey;
  return {
    archetypeKey: a.key,
    paletteKey,
    mode: pick(payload.mode, MODES, a.defaultMode),
    fontKey: pick(payload.fontKey, FONT_KEYS, a.fontKey),
    chartStyleKey: pick(payload.chartStyleKey, CHART_KEYS, a.chartStyle),
    radiusKey: pick(payload.radiusKey, RADIUS_KEYS, a.radiusKey),
    densityKey: pick(payload.densityKey, DENSITY_KEYS, a.densityKey),
    device: pick(payload.device, DEVICE_KEYS, "desktop"),
    accentOverride: typeof payload.accentOverride === "string" && isHexColor(payload.accentOverride) ? payload.accentOverride : null,
    donutKey: pick(payload.donutKey, Object.keys(DONUTS) as DonutKey[], "ring"),
  };
}

export function toCssVars(cfg: DesignConfig, palette?: PaletteDef): Record<string, string> {
  const a = getArchetype(cfg.archetypeKey);
  const t = (palette ?? getPalette(cfg.paletteKey)).tokens[cfg.mode];
  const f = FONTS[cfg.fontKey];
  const r = RADII[cfg.radiusKey];
  const d = DENSITIES[cfg.densityKey];
  const dark = cfg.mode === "dark";
  const ov = cfg.accentOverride;
  const accent = ov ?? t.accent;
  const accentFg = ov ? onColor(ov) : t.accentFg;
  const accentSoft = ov ? hexA(ov, 0.14) : t.accentSoft;
  const accentGlow = ov ? `0 10px 26px -10px ${hexA(ov, 0.55)}` : t.accentGlow;

  const panelShadow =
    a.surface === "brutal"
      ? `4px 4px 0 0 var(--text)`
      : a.surface === "filled" || a.surface === "grid" || a.surface === "none"
        ? "none"
        : dark
          ? "0 1px 0 rgba(255,255,255,0.03) inset, 0 18px 40px -24px rgba(0,0,0,0.9)"
          : "0 1px 2px rgba(16,24,40,0.05), 0 18px 36px -26px rgba(16,24,40,0.45)";

  const panelBorder =
    a.surface === "brutal" ? "2px solid var(--text)" : a.surface === "filled" || a.surface === "none" ? "1px solid transparent" : "1px solid var(--border)";

  return {
    "--bg": t.bg,
    "--bg-image": a.surface === "brutal" || a.surface === "none" || a.surface === "neu" ? "none" : t.bgImage,
    "--surface": a.surface === "neu" ? t.bg : a.surface === "filled" ? t.surface2 : a.surface === "brutal" ? (dark ? t.surface : "#FFFFFF") : t.surface,
    "--surface-2": a.surface === "neu" ? (dark ? "rgba(0,0,0,0.28)" : "rgba(110,130,165,0.10)") : a.surface === "filled" ? (dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.75)") : t.surface2,
    "--border": a.surface === "neu" ? "transparent" : a.surface === "brutal" ? t.text : t.border,
    "--border-strong": t.borderStrong,
    "--hover": t.hover,
    "--text": t.text,
    "--muted": t.muted,
    "--faint": t.faint,
    "--accent": accent,
    "--accent-2": t.accent2,
    "--accent-fg": accentFg,
    "--accent-soft": accentSoft,
    "--accent-glow": a.surface === "brutal" ? "none" : accentGlow,
    "--pos": t.pos,
    "--pos-soft": t.posSoft,
    "--neg": t.neg,
    "--neg-soft": t.negSoft,
    "--blur": a.surface === "glass" ? t.blur : "none",
    "--sidebar": t.sidebar,
    "--chart-1": t.chart[0], "--chart-2": t.chart[1], "--chart-3": t.chart[2],
    "--chart-4": t.chart[3], "--chart-5": t.chart[4], "--chart-6": t.chart[5],
    "--chart-7": t.chart[6], "--chart-8": t.chart[7], "--chart-9": t.chart[8],
    "--chart-10": t.chart[9], "--chart-11": t.chart[10], "--chart-12": t.chart[11],
    "--radius-sm": r.sm, "--radius": r.md, "--radius-lg": r.lg, "--radius-pill": r.pill,
    "--panel-shadow": panelShadow,
    "--neu-shadow": dark ? "7px 7px 16px rgba(0,0,0,.6), -5px -5px 14px rgba(255,255,255,.035)" : "8px 8px 18px rgba(143,160,190,.45), -8px -8px 18px rgba(255,255,255,.95)",
    "--neu-shadow-sm": dark ? "4px 4px 9px rgba(0,0,0,.55), -3px -3px 8px rgba(255,255,255,.04)" : "4px 4px 10px rgba(143,160,190,.45), -4px -4px 10px rgba(255,255,255,.95)",
    "--neu-inset": dark ? "inset 3px 3px 7px rgba(0,0,0,.6), inset -3px -3px 7px rgba(255,255,255,.03)" : "inset 3px 3px 7px rgba(143,160,190,.45), inset -3px -3px 7px rgba(255,255,255,.9)",
    "--font-num": cfg.fontKey === "plex" ? f.mono : f.display,
    "--panel-border": panelBorder,
    "--font-display": f.display, "--font-sans": f.sans, "--font-mono": f.mono,
    "--tracking-display": f.tracking,
    "--pad": d.pad, "--gap": a.surface === "grid" ? "1px" : d.gap, "--row": d.row,
  };
}

/* ------------------------------------------------------------------
   Exportación de código para el repo real
------------------------------------------------------------------ */

function toRgbTriplet(color: string): string {
  if (color.startsWith("#")) {
    const m = color.slice(1);
    const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
    const n = parseInt(full, 16);
    if (!Number.isNaN(n)) return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  }
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3) return `${parts[0]} ${parts[1]} ${parts[2]}`;
  }
  return "148 163 184";
}
const fam = (stack: string) => JSON.stringify(stack.replace(/['"]/g, "").split(",").map((s) => s.trim()).filter(Boolean));

export function exportTailwindConfig(cfg: DesignConfig, palette?: PaletteDef): string {
  const a = getArchetype(cfg.archetypeKey);
  const p = palette ?? getPalette(cfg.paletteKey);
  const f = FONTS[cfg.fontKey];
  const r = RADII[cfg.radiusKey];
  return `/** @type {import('tailwindcss').Config} */
/* Ejemplo parcial para fusionar con tu configuración existente.
   Arquetipo: ${a.name} · Paleta: ${p.name} · Tipografía: ${f.name} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        accent: { DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)', fg: 'rgb(var(--color-on-accent) / <alpha-value>)' },
        pos: 'rgb(var(--color-pos) / <alpha-value>)',
        neg: 'rgb(var(--color-neg) / <alpha-value>)',
        chart: { ${Array.from({ length: 12 }, (_, i) => `${i + 1}: 'rgb(var(--color-chart-${i + 1}) / <alpha-value>)'`).join(", ")} },
      },
      borderRadius: { sm: '${r.sm}', DEFAULT: '${r.md}', lg: '${r.lg}', xl: '${r.lg}', '2xl': '${r.lg}', full: '${r.pill}' },
      borderWidth: { panel: '${a.surface === "brutal" ? "2px" : "1px"}' },
      boxShadow: { panel: '${a.surface === "brutal" ? "4px 4px 0 0 rgb(var(--color-ink))" : "0 18px 40px -28px rgb(0 0 0 / 0.6)"}' },
      fontFamily: { sans: ${fam(f.sans)}, display: ${fam(f.display)}, mono: ${fam(f.mono)} },
      letterSpacing: { display: '${f.tracking}' },
      opacity: { 12: '0.12', 15: '0.15' },
    },
  },
  plugins: [],
};
`;
}

export function exportIndexCss(cfg: DesignConfig, palette?: PaletteDef): string {
  const a = getArchetype(cfg.archetypeKey);
  const p = palette ?? getPalette(cfg.paletteKey);
  const d = DENSITIES[cfg.densityKey];
  const modeVariables = (["light", "dark"] as ModeKey[]).map((mode) => {
    const t = p.tokens[mode];
    const vars = toCssVars({ ...cfg, mode }, p);
    const rgb: Record<string, string> = {
      bg: t.bg, surface: t.surface, elevated: t.surface2, line: t.border,
      ink: t.text, muted: t.muted, accent: cfg.accentOverride ?? t.accent,
      "on-accent": cfg.accentOverride ? onColor(cfg.accentOverride) : t.accentFg,
      pos: t.pos, neg: t.neg,
    };
    const lines = [
      `  color-scheme: ${mode};`,
      ...Object.entries(rgb).map(([k, value]) => `  --color-${k}: ${toRgbTriplet(value)};`),
      ...t.chart.map((value, i) => `  --color-chart-${i + 1}: ${toRgbTriplet(value)};`),
      ...Object.entries(vars).map(([k, value]) => `  ${k}: ${value};`),
    ];
    return `${mode === "light" ? ":root" : ".dark"} {\n${lines.join("\n")}\n}`;
  }).join("\n\n");
  const panel =
    a.surface === "neu" ? "@apply bg-bg rounded-2xl; box-shadow: 8px 8px 18px rgb(0 0 0 / 0.25), -8px -8px 18px rgb(255 255 255 / 0.05);"
    : a.surface === "tonal" ? "@apply bg-accent/10 rounded-3xl border-0;"
    : a.surface === "wire" ? "@apply bg-transparent border border-line rounded;"
    : a.surface === "post" ? "@apply bg-surface rounded-3xl shadow-panel border-0;"
    : a.surface === "brutal" ? "@apply bg-surface border-panel border-ink shadow-panel rounded;"
    : a.surface === "grid" ? "@apply bg-surface border border-line rounded-none;"
    : a.surface === "none" ? "@apply bg-transparent border-0 border-t border-line rounded-none pt-5;"
    : a.surface === "filled" ? "@apply bg-elevated border-0 rounded-2xl;"
    : a.surface === "glass" ? "@apply bg-surface/60 border border-line rounded-2xl backdrop-blur-xl;"
    : "@apply bg-surface border border-line rounded-2xl shadow-panel;";
  const btn =
    a.button === "neu" ? "@apply bg-bg text-accent rounded-full px-4 py-2 font-bold; box-shadow: 4px 4px 10px rgb(0 0 0 / 0.25), -3px -3px 8px rgb(255 255 255 / 0.05);"
    : a.button === "tonal" ? "@apply bg-accent/15 text-accent rounded-full px-4 py-2 font-semibold hover:bg-accent/25;"
    : a.button === "code" ? "@apply bg-accent/10 text-accent border border-accent rounded-sm px-3 py-1.5 font-mono text-xs font-semibold;"
    : a.button === "gradient" ? "@apply bg-gradient-to-br from-accent to-accent/70 text-accent-fg rounded-[14px] px-4 py-2 font-bold;"
    : a.button === "square" ? "@apply border border-line bg-transparent text-ink uppercase tracking-wider text-[11px] font-semibold px-3 py-1.5 rounded-sm hover:bg-elevated;"
    : a.button === "link" ? "@apply bg-transparent text-accent underline underline-offset-4 decoration-1 px-0 py-1 font-medium;"
    : a.button === "pill" ? "@apply bg-accent text-accent-fg rounded-full px-4 py-2 font-semibold;"
    : a.button === "soft" ? "@apply bg-accent/12 text-accent rounded-full px-4 py-2 font-semibold hover:bg-accent/20;"
    : a.button === "brutal" ? "@apply bg-accent text-accent-fg border-2 border-ink shadow-[3px_3px_0_0_rgb(var(--color-ink))] px-3 py-1.5 font-bold uppercase text-xs active:translate-x-[2px] active:translate-y-[2px] active:shadow-none;"
    : "@apply bg-accent text-accent-fg rounded-lg px-3.5 py-2 font-semibold hover:brightness-110;";
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Ejemplo parcial de estilos para fusionar; consultar LEEME.md. */
${modeVariables}

/* Arquetipo «${a.name}»: ${a.tagline} */
:root { --space-card: ${d.pad}; --space-grid: ${a.surface === "grid" ? "1px" : d.gap}; }

@layer base {
  body { @apply bg-bg text-ink font-sans; }
  h1, h2, h3 { @apply font-display tracking-display; }
}

@layer components {
  .panel { ${panel} padding: var(--space-card); }
  .panel-grid { display: grid; gap: var(--space-grid); ${a.surface === "grid" ? "background: rgb(var(--color-line));" : ""} }
  .btn { ${btn} }
  .stat-value { @apply font-display text-ink; font-variant-numeric: tabular-nums; }
  .chip-pos { @apply text-pos bg-pos/12 rounded px-1.5 py-0.5 text-xs font-semibold; }
  .chip-neg { @apply text-neg bg-neg/12 rounded px-1.5 py-0.5 text-xs font-semibold; }
  ${a.list === "dense" ? ".row { @apply h-9 text-[12px] odd:bg-elevated/40; }" : a.list === "ledger" ? ".row { @apply border-b border-line py-3 grid grid-cols-[1fr_auto]; }" : a.list === "blocks" ? ".row { @apply border-b-2 border-ink py-3 font-semibold; }" : ".row { @apply flex items-center gap-3 py-2.5 border-b border-line; }"}
}
`;
}

export function exportCardTsx(cfg: DesignConfig): string {
  const a = getArchetype(cfg.archetypeKey);
  const kpi =
    a.kpi === "ticker"
      ? `  return (
    <div className="flex items-baseline gap-3 px-4 py-2 border-r border-line whitespace-nowrap">
      <span className="text-muted text-[10px] uppercase tracking-wider">{label}</span>
      <span className="font-mono text-ink text-sm font-semibold">{value}</span>
      {subValue && <span className={\`font-mono text-[11px] \${trend === 'up' ? 'text-pos' : trend === 'down' ? 'text-neg' : 'text-muted'}\`}>{subValue}</span>}
    </div>
  );`
      : a.kpi === "statement"
        ? `  return (
    <div className="py-4">
      <p className="text-muted text-[11px] uppercase tracking-[0.18em]">{label}</p>
      <p className="font-display text-ink text-5xl font-semibold leading-none mt-3" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {subValue && <p className={\`mt-2 text-sm \${trend === 'up' ? 'text-pos' : trend === 'down' ? 'text-neg' : 'text-muted'}\`}>{subValue}</p>}
    </div>
  );`
        : a.kpi === "block"
          ? `  return (
    <div className="panel" style={{ background: \`rgb(var(--color-chart-\${(colorIdx % 6) + 1}) / 0.22)\` }}>
      <p className="text-ink text-[11px] font-black uppercase tracking-wider">{label}</p>
      <p className="font-display text-ink text-3xl font-black mt-2">{value}</p>
      {subValue && <p className="mt-1 text-xs font-bold text-ink/70">{subValue}</p>}
    </div>
  );`
          : `  const trendClass = trend === 'up' ? 'chip-pos' : trend === 'down' ? 'chip-neg' : 'text-muted text-xs font-semibold';
  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <span className="text-muted text-sm font-medium">{label}</span>
        {icon && <div className="text-accent/70">{icon}</div>}
      </div>
      <p className="stat-value text-2xl font-bold">{value}</p>
      {subValue && <p className={\`mt-1.5 inline-block \${trendClass}\`}>{subValue}</p>}
    </Card>
  );`;
  return `import { type ReactNode } from 'react';

/* src/components/Card.tsx — Arquetipo «${a.name}»
   Requiere las clases .panel/.btn/.chip-* de index.css y los colores semánticos del tailwind.config.js. */

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={\`panel \${className}\`} style={style}>{children}</div>;
}

export function Button({ children, variant = 'primary', className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  return (
    <button className={\`btn \${variant === 'ghost' ? 'opacity-80 hover:opacity-100' : ''} \${className}\`} {...rest}>
      {children}
    </button>
  );
}

interface StatCardProps { label: string; value: string; subValue?: string; trend?: 'up' | 'down' | 'neutral'; icon?: ReactNode; colorIdx?: number }

export function StatCard({ label, value, subValue, trend = 'neutral', icon, colorIdx = 0 }: StatCardProps) {
${kpi}
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4${a.surface === "none" ? " border-b border-line pb-2" : ""}">
      <h2 className="font-display text-ink ${a.kpi === "statement" ? "text-2xl" : "text-lg"} font-semibold tracking-display">{children}</h2>
      {action}
    </div>
  );
}
`;
}

export function exportPaletteSummary(cfg: DesignConfig, palette?: PaletteDef): string {
  const a = getArchetype(cfg.archetypeKey);
  const p = palette ?? getPalette(cfg.paletteKey);
  const t = p.tokens[cfg.mode];
  return `MEZCLA ELEGIDA
Arquetipo:   ${a.name} (${a.short})
  Navegación ${SHELLS[a.shell]}
  Paneles    ${SURFACES[a.surface]}
  KPIs       ${KPIS[a.kpi]}
  Botones    ${BUTTONS[a.button]}
  Listas     ${LISTS[a.list]}
  Formularios diálogo centrado
Gráficas:    ${CHART_STYLES[cfg.chartStyleKey].name}
Tipografía:  ${FONTS[cfg.fontKey].name}
Esquinas:    ${RADII[cfg.radiusKey].name} (${RADII[cfg.radiusKey].md})
Densidad:    ${DENSITIES[cfg.densityKey].name}
Paleta:      ${p.name} · modo ${cfg.mode === "dark" ? "oscuro" : "claro"}
  Fondo ${t.bg} · Superficie ${t.surface} · Texto ${t.text}
  Acento ${t.accent} · Positivo ${t.pos} · Negativo ${t.neg}
  Gráficas ${t.chart.join("  ")}
`;
}
