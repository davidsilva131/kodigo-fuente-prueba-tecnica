import type { Promotion } from '../types';
import { STATUS_LABEL } from '../types';

const numberEs = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateEs = new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });

function formatRange(p: Promotion): string {
  const from = new Date(p.starts_at);
  const to = new Date(p.ends_at);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '—';
  return `${dateEs.format(from)} → ${dateEs.format(to)}`;
}

function formatDiscount(p: Promotion): string {
  const value = Number(p.discount_value);
  if (Number.isNaN(value)) return '—';
  return p.discount_type === 'percent' ? `${value} %` : `Monto fijo: ${numberEs.format(value)}`;
}

interface Props {
  promotions: Promotion[];
  onEdit: (p: Promotion) => void;
  onActivate: (p: Promotion) => void;
  onFinish: (p: Promotion) => void;
  onDelete: (p: Promotion) => void;
}

export function PromotionList({ promotions, onEdit, onActivate, onFinish, onDelete }: Props) {
  if (promotions.length === 0) {
    return <p className="muted">Aún no hay promociones. Crea la primera con “+ Nueva promoción”.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="promo-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Aplica a</th>
            <th>Descuento</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {promotions.map((p) => (
            <tr key={p.id}>
              <td className="promo-name">{p.name}</td>
              <td>{p.target_name ?? `#${p.target_id}`}</td>
              <td>{formatDiscount(p)}</td>
              <td>{formatRange(p)}</td>
              <td>
                <span className={`badge badge-${p.status}`}>{STATUS_LABEL[p.status]}</span>
              </td>
              <td className="promo-actions">
                {p.status === 'scheduled' && (
                  <>
                    <button className="btn btn-small" onClick={() => onActivate(p)}>Activar</button>
                    <button className="btn btn-small" onClick={() => onEdit(p)}>Editar</button>
                    <button className="btn btn-small btn-danger" onClick={() => onDelete(p)}>Eliminar</button>
                  </>
                )}
                {p.status === 'active' && (
                  <button className="btn btn-small" onClick={() => onFinish(p)}>Finalizar</button>
                )}
                {p.status === 'finished' && <span className="muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}