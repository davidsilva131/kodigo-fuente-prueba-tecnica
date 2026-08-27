import { describe, expect, it, vi, type Mock } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromotionForm } from './PromotionForm';
import type { PromotionInput, References } from '../types';

const references: References = {
  categories: [
    { id: 1, name: 'Bebidas' },
    { id: 2, name: 'Snacks' },
  ],
  products: [
    { id: 1, name: 'Café', category_id: 1, category_name: 'Bebidas' },
    { id: 2, name: 'Agua', category_id: 1, category_name: 'Bebidas' },
  ],
};

function renderForm(
  onSubmit: Mock<(input: PromotionInput) => Promise<void>> = vi.fn(async () => {}),
) {
  const utils = render(<PromotionForm references={references} onSubmit={onSubmit} onCancel={() => {}} />);
  return { onSubmit, ...utils };
}

describe('PromotionForm', () => {
  it('muestra errores de validación al enviar vacío', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /crear promoción/i }));

    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('Selecciona un producto o categoría')).toBeInTheDocument();
    expect(screen.getByText('El valor del descuento es obligatorio y debe ser mayor a 0')).toBeInTheDocument();
    expect(screen.getByText('Las fechas de inicio y fin son obligatorias')).toBeInTheDocument();
  });

  it('rechaza porcentaje fuera de 1–100', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText('Tipo de descuento'), 'percent');
    await user.type(screen.getByLabelText('Valor del descuento'), '150');

    await user.click(screen.getByRole('button', { name: /crear promoción/i }));
    expect(screen.getByText('Si el tipo es Porcentaje, el valor debe estar entre 1 y 100')).toBeInTheDocument();
  });

  it('rechaza fecha de fin anterior a la de inicio', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Nombre'), 'Promo válida');
    await user.selectOptions(screen.getByLabelText('Aplica a'), 'product');
    await user.selectOptions(screen.getByLabelText('Producto'), '1');
    await user.type(screen.getByLabelText('Valor del descuento'), '20');
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-10T10:00' } });
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-09-01T10:00' } });

    await user.click(screen.getByRole('button', { name: /crear promoción/i }));
    expect(screen.getByText('La fecha de fin debe ser posterior a la de inicio')).toBeInTheDocument();
  });

  it('envía los datos convertidos a ISO al ser válido', async () => {
    const user = userEvent.setup();
    const onSubmit: Mock<(input: PromotionInput) => Promise<void>> = vi.fn(async () => {});
    renderForm(onSubmit);

    await user.type(screen.getByLabelText('Nombre'), 'Café 2x1');
    await user.selectOptions(screen.getByLabelText('Aplica a'), 'product');
    await user.selectOptions(screen.getByLabelText('Producto'), '1');
    await user.selectOptions(screen.getByLabelText('Tipo de descuento'), 'percent');
    await user.type(screen.getByLabelText('Valor del descuento'), '50');
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-01T08:00' } });
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-09-30T18:00' } });

    await user.click(screen.getByRole('button', { name: /crear promoción/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0] as {
      name: string;
      target_id: number;
      discount_type: string;
      discount_value: number;
      starts_at: string;
      ends_at: string;
    };
    expect(input).toMatchObject({
      name: 'Café 2x1',
      target_type: 'product',
      target_id: 1,
      discount_type: 'percent',
      discount_value: 50,
    });
    expect(new Date(input.starts_at).toISOString()).toBe(input.starts_at);
    expect(new Date(input.ends_at).toISOString()).toBe(input.ends_at);
    expect(new Date(input.ends_at).getTime()).toBeGreaterThan(new Date(input.starts_at).getTime());
  });
});