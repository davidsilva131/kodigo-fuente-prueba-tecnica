import { z } from 'zod';

export const targetTypeSchema = z.enum(['product', 'category']);
export const discountTypeSchema = z.enum(['percent', 'fixed']);
export const statusSchema = z.enum(['scheduled', 'active', 'finished']);

const isoDate = z.string().datetime({ offset: true });

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
  .refine((d) => d.ends_at > d.starts_at, {
    message: 'La fecha de fin debe ser posterior a la fecha de inicio',
    path: ['ends_at'],
  })
  .refine(
    (d) => d.discount_type !== 'percent' || (d.discount_value >= 1 && d.discount_value <= 100),
    {
      message: 'Si el tipo de descuento es Porcentaje, el valor debe estar entre 1 y 100',
      path: ['discount_value'],
    },
  );

export const updatePromotionSchema = baseFields
  .partial()
  .refine(
    (d) =>
      d.discount_type !== 'percent' ||
      d.discount_value === undefined ||
      (d.discount_value >= 1 && d.discount_value <= 100),
    {
      message: 'Si el tipo de descuento es Porcentaje, el valor debe estar entre 1 y 100',
      path: ['discount_value'],
    },
  )
  .refine((d) => d.starts_at === undefined || d.ends_at === undefined || d.ends_at > d.starts_at, {
    message: 'La fecha de fin debe ser posterior a la fecha de inicio',
    path: ['ends_at'],
  });

export const statusUpdateSchema = z.object({
  status: statusSchema,
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;