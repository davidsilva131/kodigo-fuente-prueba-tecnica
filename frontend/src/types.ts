export type TargetType = 'product' | 'category';
export type DiscountType = 'percent' | 'fixed';
export type Status = 'scheduled' | 'active' | 'finished';

export interface Promotion {
  id: number;
  name: string;
  target_type: TargetType;
  target_id: number;
  discount_type: DiscountType;
  discount_value: string;
  starts_at: string;
  ends_at: string;
  status: Status;
  created_at: string;
  target_name: string | null;
}

export interface PromotionInput {
  name: string;
  target_type: TargetType;
  target_id: number;
  discount_type: DiscountType;
  discount_value: number;
  starts_at: string;
  ends_at: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
}

export interface References {
  categories: Category[];
  products: Product[];
}

export interface Summary {
  scheduled: number;
  active: number;
  finished: number;
  valid_today: number;
}

export const STATUS_LABEL: Record<Status, string> = {
  scheduled: 'Programada',
  active: 'Activa',
  finished: 'Finalizada',
};