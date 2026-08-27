import type { Summary as SummaryData } from '../types';

const CARDS = [
  { key: 'scheduled' as const, label: 'Programadas', css: 'card-scheduled' },
  { key: 'active' as const, label: 'Activas', css: 'card-active' },
  { key: 'finished' as const, label: 'Finalizadas', css: 'card-finished' },
];

export function Summary({ data }: { data: SummaryData }) {
  return (
    <section className="summary" aria-label="Resumen">
      {CARDS.map((c) => (
        <div key={c.key} className={`summary-card ${c.css}`}>
          <span className="summary-count">{data[c.key]}</span>
          <span className="summary-label">{c.label}</span>
        </div>
      ))}
      <div className="summary-card card-valid">
        <span className="summary-count">{data.valid_today}</span>
        <span className="summary-label">Vigentes hoy</span>
      </div>
    </section>
  );
}