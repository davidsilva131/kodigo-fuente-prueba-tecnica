import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Promotion, References, Summary } from './types';

const references: References = {
  categories: [{ id: 1, name: 'Bebidas' }],
  products: [{ id: 1, name: 'Café', category_id: 1, category_name: 'Bebidas' }],
};

const promotions: Promotion[] = [
  {
    id: 1,
    name: 'Café 2x1',
    target_type: 'product',
    target_id: 1,
    discount_type: 'percent',
    discount_value: '50.00',
    starts_at: '2026-08-20T00:00:00.000Z',
    ends_at: '2026-09-30T00:00:00.000Z',
    status: 'scheduled',
    created_at: '2026-08-27T00:00:00.000Z',
    target_name: 'Café',
  },
  {
    id: 2,
    name: 'Todo Bebidas',
    target_type: 'category',
    target_id: 1,
    discount_type: 'fixed',
    discount_value: '150.50',
    starts_at: '2026-08-01T00:00:00.000Z',
    ends_at: '2026-08-31T00:00:00.000Z',
    status: 'active',
    created_at: '2026-08-01T00:00:00.000Z',
    target_name: 'Bebidas',
  },
];

const summary: Summary = { scheduled: 1, active: 1, finished: 0, valid_today: 1 };

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as Response;
}

function setupFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/promotions/summary')) return jsonResponse(summary);
    if (url.endsWith('/api/references')) return jsonResponse(references);
    if (url.endsWith('/api/promotions')) {
      if (init?.method === 'POST') return jsonResponse({ ...promotions[0], id: 3, name: 'Nueva promo' }, true, 201);
      return jsonResponse(promotions);
    }
    if (url.includes('/status')) return jsonResponse(promotions[0]);
    return jsonResponse({ error: { message: 'no encontrado' } }, false, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('muestra el resumen y la lista de promociones', async () => {
    setupFetch();
    render(<App />);

    expect(await screen.findByText('Café 2x1')).toBeInTheDocument();
    expect(screen.getByText('Todo Bebidas')).toBeInTheDocument();
    expect(screen.getByText('Programadas')).toBeInTheDocument();
    expect(screen.getByText('Vigentes hoy')).toBeInTheDocument();
    expect(screen.getByText('50 %')).toBeInTheDocument();
    expect(screen.getByText('Monto fijo: 150,50')).toBeInTheDocument();
  });

  it('crea una promoción y refresca la lista', async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Café 2x1');
    await user.click(screen.getByRole('button', { name: /nueva promoción/i }));

    await user.type(screen.getByLabelText('Nombre'), 'Nueva promo');
    await user.selectOptions(screen.getByLabelText('Aplica a'), 'product');
    await user.selectOptions(screen.getByLabelText('Producto'), '1');
    await user.type(screen.getByLabelText('Valor del descuento'), '10');
    await user.clear(screen.getByLabelText('Fecha de inicio'));
    await user.type(screen.getByLabelText('Fecha de inicio'), '2026-10-01T08:00');
    await user.clear(screen.getByLabelText('Fecha de fin'));
    await user.type(screen.getByLabelText('Fecha de fin'), '2026-10-31T18:00');

    await user.click(screen.getByRole('button', { name: /crear promoción/i }));

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        ([url, init]) => String(url).endsWith('/api/promotions') && init?.method === 'POST',
      );
      expect(postCalls).toHaveLength(1);
    });
    // tras guardar, vuelve a la lista (form cerrado)
    await waitFor(() => {
      expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
    });
  });

  it('activa una promoción Programada vía PATCH /status', async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Café 2x1');
    await user.click(screen.getByRole('button', { name: 'Activar' }));

    await waitFor(() => {
      const statusCalls = fetchMock.mock.calls.filter(([url, init]) => {
        const u = String(url);
        return u.includes('/status') && init?.method === 'PATCH' && init.body === '{"status":"active"}';
      });
      expect(statusCalls.length).toBeGreaterThan(0);
    });
  });

  it('muestra error del backend en el banner', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: { message: 'No se pudo conectar' } }, false, 503),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar');
  });
});