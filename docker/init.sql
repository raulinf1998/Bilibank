-- Esquema inicial idempotente para la aplicación (PostgreSQL).
-- Se ejecuta una sola vez, cuando el volumen de datos está vacío.
-- No elimina datos existentes: puede aplicarse de nuevo sin riesgo.

CREATE TABLE IF NOT EXISTS design_preferences (
  id serial PRIMARY KEY,
  theme_key text NOT NULL DEFAULT 'clasico',
  palette_key text,
  accent_override text,
  donut_key text,
  mode text NOT NULL DEFAULT 'dark',
  font_key text,
  chart_style_key text,
  radius_key text,
  density_key text,
  device text NOT NULL DEFAULT 'desktop',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS design_preferences_single_row ON design_preferences (id);

CREATE TABLE IF NOT EXISTS theme_feedback (
  id serial PRIMARY KEY,
  theme_key text NOT NULL,
  rating integer NOT NULL DEFAULT 0,
  favourite boolean NOT NULL DEFAULT false,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS theme_feedback_theme_key_idx ON theme_feedback (theme_key);

CREATE TABLE IF NOT EXISTS custom_palettes (
  id serial PRIMARY KEY,
  key text NOT NULL,
  name text NOT NULL,
  seeds jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS custom_palettes_key_idx ON custom_palettes (key);

CREATE TABLE IF NOT EXISTS workspace_data (
  id integer PRIMARY KEY DEFAULT 1,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
