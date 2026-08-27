import type { Promotion, PromotionInput, References, Status, Summary } from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      message = body?.error?.message ?? message;
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new Error(message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  list: () => request<Promotion[]>('/api/promotions'),
  summary: () => request<Summary>('/api/promotions/summary'),
  references: () => request<References>('/api/references'),
  create: (input: PromotionInput) =>
    request<Promotion>('/api/promotions', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: number, input: Partial<PromotionInput>) =>
    request<Promotion>(`/api/promotions/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  transition: (id: number, status: Status) =>
    request<Promotion>(`/api/promotions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  remove: (id: number) => request<void>(`/api/promotions/${id}`, { method: 'DELETE' }),
};