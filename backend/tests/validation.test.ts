import { describe, expect, it } from 'vitest';
import {
  createPromotionSchema,
  statusUpdateSchema,
  updatePromotionSchema,
} from '../src/validation';

const valid = {
  name: 'Súper oferta',
  target_type: 'product',
  target_id: 1,
  discount_type: 'percent',
  discount_value: 20,
  starts_at: '2026-09-01T00:00:00-04:00',
  ends_at: '2026-09-30T23:59:59-04:00',
};

describe('createPromotionSchema', () => {
  it('acepta una promoción válida', () => {
    expect(createPromotionSchema.safeParse(valid).success).toBe(true);
  });

  it('acepta descuento de monto fijo', () => {
    const fixed = { ...valid, discount_type: 'fixed', discount_value: 150.5 };
    expect(createPromotionSchema.safeParse(fixed).success).toBe(true);
  });

  it('rechaza sin nombre', () => {
    expect(createPromotionSchema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
  });

  it('rechaza sin target ni valor de descuento', () => {
    expect(createPromotionSchema.safeParse({ ...valid, target_type: undefined }).success).toBe(false);
    expect(createPromotionSchema.safeParse({ ...valid, discount_value: undefined }).success).toBe(false);
  });

  it('rechaza fecha de fin <= fecha de inicio', () => {
    const bad = { ...valid, ends_at: valid.starts_at };
    const result = createPromotionSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('ends_at'))).toBe(true);
    }
  });

  it('rechaza porcentaje fuera de 1–100', () => {
    expect(createPromotionSchema.safeParse({ ...valid, discount_value: 0 }).success).toBe(false);
    expect(createPromotionSchema.safeParse({ ...valid, discount_value: 101 }).success).toBe(false);
    expect(createPromotionSchema.safeParse({ ...valid, discount_value: 100 }).success).toBe(true);
    expect(createPromotionSchema.safeParse({ ...valid, discount_value: 1 }).success).toBe(true);
  });

  it('rechaza fechas no ISO', () => {
    expect(
      createPromotionSchema.safeParse({ ...valid, starts_at: '01/09/2026' }).success,
    ).toBe(false);
  });
});

describe('updatePromotionSchema', () => {
  it('acepta actualización parcial', () => {
    expect(updatePromotionSchema.safeParse({ name: 'Nuevo nombre' }).success).toBe(true);
  });

  it('rechaza porcentaje fuera de rango si se envía con tipo percent', () => {
    const result = updatePromotionSchema.safeParse({
      discount_type: 'percent',
      discount_value: 250,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza fechas invertidas solo si se envían ambas', () => {
    expect(
      updatePromotionSchema.safeParse({ starts_at: '2026-10-01T00:00:00-04:00' }).success,
    ).toBe(true);
    expect(
      updatePromotionSchema.safeParse({
        starts_at: '2026-10-01T00:00:00-04:00',
        ends_at: '2026-09-01T00:00:00-04:00',
      }).success,
    ).toBe(false);
  });

  it('exige enviar target_type y target_id juntos (o ninguno)', () => {
    expect(updatePromotionSchema.safeParse({ target_id: 2 }).success).toBe(false);
    expect(updatePromotionSchema.safeParse({ target_type: 'category' }).success).toBe(false);
    expect(
      updatePromotionSchema.safeParse({ target_type: 'category', target_id: 2 }).success,
    ).toBe(true);
  });
});

describe('statusUpdateSchema', () => {
  it('acepta solo estados válidos', () => {
    expect(statusUpdateSchema.safeParse({ status: 'active' }).success).toBe(true);
    expect(statusUpdateSchema.safeParse({ status: 'borrado' }).success).toBe(false);
    expect(statusUpdateSchema.safeParse({}).success).toBe(false);
  });
});