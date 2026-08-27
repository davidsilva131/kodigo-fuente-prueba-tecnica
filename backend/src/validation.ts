import { z } from 'zod';
import type { DiscountType } from './types.js';

export const targetTypeSchema = z.enum(['product', 'category']);
export const discountTypeSchema = z.enum(['percent', 'fixed']);
export const statusSchema = z.enum(['scheduled', 'active', 'finished']);

const isoDate = z.string().datetime({ offset: true });

// --- Reglas de negocio compartidas (creación y actualización usan las mismas) ---

function validPercentRange(d: { discount_type?: DiscountType; discount_value?: number }): boolean {
  if (d.discount_type !== 'percent' || d.discount_value === undefined) return true;
  return d.discount_value >= 1 && d.discount_value <= 100;
}

function validDateOrder(d: { starts_at?: string; ends_at?: string }): boolean {
  if (d.starts_at === undefined || d.ends_at === undefined) return true;
  return d.ends_at > d.starts_at;
}

function targetPairComplete(d: { target_type?: 'product' | 'category'; target_id?: number }): boolean {
  return (d.target_type !== undefined) === (d.target_id !== undefined);
}

const PERCENT_MESSAGE = 'Si el tipo de descuento es Porcentaje, el valor debe estar entre 1 y 100';
const DATE_ORDER_MESSAGE = 'La fecha de fin debe ser posterior a la fecha de inicio';

/** Campos base compartidos por creación y actualización. */
const baseFields = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  target_type: targetTypeSchema,
  target_id: z.number().int().positive(),
  discount_type: discountTypeSchema,
  discount_value: z
    .number()
    .positive('El valor del descuento es obligatorio y debe ser mayor a 0'),
  starts_at: isoDate,
  ends_at: isoDate,
});

/**
 * Reglas de negocio:
 * - nombre, target y valor de descuento obligatorios
 * - ends_at > starts_at
 * - si es 'percent', el valor debe estar entre 1 y 100
 */
export const createPromotionSchema = baseFields
  .refine(validDateOrder, { message: DATE_ORDER_MESSAGE, path: ['ends_at'] })
  .refine(validPercentRange, { message: PERCENT_MESSAGE, path: ['discount_value'] });

export const updatePromotionSchema = baseFields
  .partial()
  .refine(targetPairComplete, {
    message: 'target_type y target_id deben enviarse juntos',
    path: ['target_type'],
  })
  .refine(validPercentRange, { message: PERCENT_MESSAGE, path: ['discount_value'] })
  .refine(validDateOrder, { message: DATE_ORDER_MESSAGE, path: ['ends_at'] });

export const statusUpdateSchema = z.object({
  status: statusSchema,
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;