import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Configuración de diseño guardada por el usuario en el laboratorio.
 * Se mantiene una única fila (id = 1) con la mezcla activa.
 */
export const designPreferences = pgTable(
  "design_preferences",
  {
    id: serial("id").primaryKey(),
    /** Clave del arquetipo estructural (se mantiene el nombre de columna por compatibilidad). */
    themeKey: text("theme_key").notNull().default("clasico"),
    paletteKey: text("palette_key"),
    accentOverride: text("accent_override"),
    donutKey: text("donut_key"),
    mode: text("mode").notNull().default("dark"),
    fontKey: text("font_key"),
    chartStyleKey: text("chart_style_key"),
    radiusKey: text("radius_key"),
    densityKey: text("density_key"),
    device: text("device").notNull().default("desktop"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("design_preferences_single_row").on(table.id)],
);

/**
 * Valoración y notas por propuesta de diseño.
 * Una fila por propuesta (theme_key único) que se actualiza al votar.
 */
export const themeFeedback = pgTable(
  "theme_feedback",
  {
    id: serial("id").primaryKey(),
    themeKey: text("theme_key").notNull(),
    rating: integer("rating").notNull().default(0),
    favourite: boolean("favourite").notNull().default(false),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("theme_feedback_theme_key_idx").on(table.themeKey)],
);

export type DesignPreferences = typeof designPreferences.$inferSelect;
export type ThemeFeedback = typeof themeFeedback.$inferSelect;

/**
 * Paletas de color personalizadas creadas por el usuario.
 * `seeds` guarda los colores base (modo oscuro y claro); el resto se deriva en la aplicación.
 */
export const customPalettes = pgTable(
  "custom_palettes",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    seeds: jsonb("seeds").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("custom_palettes_key_idx").on(table.key)],
);

/**
 * Datos de trabajo de la aplicación desplegada (cuentas, categorías, productos y
 * movimientos). Una única fila (id = 1) con el estado completo, para que la app
 * funcione igual desde cualquier dispositivo de la red local.
 */
export const workspaceData = pgTable("workspace_data", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WorkspaceData = typeof workspaceData.$inferSelect;
