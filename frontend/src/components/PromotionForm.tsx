import { useState, type FormEvent } from 'react';
import type { Promotion, PromotionInput, References, TargetType } from '../types';

function toLocalInput(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface Errors {
  name?: string;
  target?: string;
  discount?: string;
  dates?: string;
}

interface Props {
  references: References;
  initial?: Promotion;
  onSubmit: (input: PromotionInput) => Promise<void>;
  onCancel: () => void;
}

export function PromotionForm({ references, initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [targetType, setTargetType] = useState<TargetType>(initial?.target_type ?? 'product');
  const [targetId, setTargetId] = useState<string>(initial ? String(initial.target_id) : '');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(initial?.discount_type ?? 'percent');
  const [discountValue, setDiscountValue] = useState(initial?.discount_value ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.ends_at));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const options = targetType === 'product' ? references.products : references.categories;

  const validate = (): Errors => {
    const out: Errors = {};
    if (!name.trim()) out.name = 'El nombre es obligatorio';
    if (!targetId) out.target = 'Selecciona un producto o categoría';
    const value = Number(discountValue);
    if (!discountValue || Number.isNaN(value) || value <= 0) {
      out.discount = 'El valor del descuento es obligatorio y debe ser mayor a 0';
    } else if (discountType === 'percent' && (value < 1 || value > 100)) {
      out.discount = 'Si el tipo es Porcentaje, el valor debe estar entre 1 y 100';
    }
    const start = toIso(startsAt);
    const end = toIso(endsAt);
    if (!start || !end) {
      out.dates = 'Las fechas de inicio y fin son obligatorias';
    } else if (end <= start) {
      out.dates = 'La fecha de fin debe ser posterior a la de inicio';
    }
    return out;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        target_type: targetType,
        target_id: Number(targetId),
        discount_type: discountType,
        discount_value: Number(discountValue),
        starts_at: toIso(startsAt)!,
        ends_at: toIso(endsAt)!,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="promo-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label className="field">
          <span>Nombre</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Café 2x1"
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label className="field">
          <span>Aplica a</span>
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as TargetType);
              setTargetId('');
            }}
          >
            <option value="product">Producto</option>
            <option value="category">Categoría</option>
          </select>
        </label>

        <label className="field">
          <span>{targetType === 'product' ? 'Producto' : 'Categoría'}</span>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Selecciona…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {errors.target && <span className="field-error">{errors.target}</span>}
        </label>

        <label className="field">
          <span>Tipo de descuento</span>
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}>
            <option value="percent">Porcentaje</option>
            <option value="fixed">Monto fijo</option>
          </select>
        </label>

        <label className="field">
          <span>Valor del descuento</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === 'percent' ? '1 – 100' : '0.00'}
          />
          {errors.discount && <span className="field-error">{errors.discount}</span>}
        </label>

        <label className="field">
          <span>Fecha de inicio</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>

        <label className="field">
          <span>Fecha de fin</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          {errors.dates && <span className="field-error">{errors.dates}</span>}
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear promoción'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}