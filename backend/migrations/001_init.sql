-- 001: esquema inicial + datos de referencia

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('product', 'category')),
  target_id INTEGER NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_promotion_dates CHECK (ends_at > starts_at),
  CONSTRAINT chk_percent_range CHECK (discount_type <> 'percent' OR discount_value <= 100)
);

-- Datos de referencia (seed) — opinados, solo para demostración
INSERT INTO categories (name) VALUES
  ('Bebidas'), ('Snacks'), ('Lácteos'), ('Limpieza')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (name, category_id)
SELECT p.name, c.id
FROM (VALUES
  ('Café molido 500g', 'Bebidas'),
  ('Jugo de naranja 1L', 'Bebidas'),
  ('Agua mineral 2L', 'Bebidas'),
  ('Papas fritas 120g', 'Snacks'),
  ('Galletas de chocolate', 'Snacks'),
  ('Leche entera 1L', 'Lácteos'),
  ('Queso blanco 250g', 'Lácteos'),
  ('Yogur natural 1kg', 'Lácteos'),
  ('Detergente 1kg', 'Limpieza'),
  ('Jabón de baño 3u', 'Limpieza')
) AS p(name, cat)
JOIN categories c ON c.name = p.cat
ON CONFLICT DO NOTHING;