-- 002: endurecer el rango del descuento porcentual en la BD (1-100)
-- Amplía la constraint de 001 (que solo acotaba ≤ 100) como defensa en profundidad:
-- ninguna vía de escritura (API, SQL manual) puede crear un Porcentaje fuera de 1-100.

ALTER TABLE promotions DROP CONSTRAINT IF EXISTS chk_percent_range;
ALTER TABLE promotions ADD CONSTRAINT chk_percent_range
  CHECK (discount_type <> 'percent' OR (discount_value >= 1 AND discount_value <= 100));