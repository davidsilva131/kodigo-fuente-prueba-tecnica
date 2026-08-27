import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import { PromotionForm } from './components/PromotionForm';
import { PromotionList } from './components/PromotionList';
import { Summary } from './components/Summary';
import type { Promotion, PromotionInput, References, Summary as SummaryData } from './types';

type FormState = { mode: 'create' } | { mode: 'edit'; promotion: Promotion } | null;

export default function App() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [references, setReferences] = useState<References | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);

  const load = useCallback(async () => {
    try {
      const [p, s, r] = await Promise.all([api.list(), api.summary(), api.references()]);
      setPromotions(p);
      setSummary(s);
      setReferences(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (input: PromotionInput) => {
    try {
      if (form?.mode === 'edit') {
        await api.update(form.promotion.id, input);
      } else {
        await api.create(input);
      }
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la promoción');
    }
  };

  const handleTransition = async (p: Promotion, status: 'active' | 'finished') => {
    try {
      await api.transition(p.id, status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    }
  };

  const handleDelete = async (p: Promotion) => {
    if (!window.confirm(`¿Eliminar la promoción "${p.name}"?`)) return;
    try {
      await api.remove(p.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la promoción');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Gestión de Promociones</h1>
        <p className="app-subtitle">Kódigo Fuente · POS</p>
      </header>

      {error && (
        <div className="banner-error" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          {summary && <Summary data={summary} />}

          <section className="panel">
            <div className="panel-head">
              <h2>Promociones</h2>
              {!form && (
                <button className="btn btn-primary" onClick={() => setForm({ mode: 'create' })}>
                  + Nueva promoción
                </button>
              )}
            </div>

            {form && references && (
              <PromotionForm
                references={references}
                initial={form.mode === 'edit' ? form.promotion : undefined}
                onSubmit={handleSubmit}
                onCancel={() => setForm(null)}
              />
            )}

            {!form && (
              <PromotionList
                promotions={promotions}
                onEdit={(p) => setForm({ mode: 'edit', promotion: p })}
                onActivate={(p) => handleTransition(p, 'active')}
                onFinish={(p) => handleTransition(p, 'finished')}
                onDelete={handleDelete}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}