export type TargetType = 'product' | 'category';
export type DiscountType = 'percent' | 'fixed';
export type Status = 'scheduled' | 'active' | 'finished';

export interface PromotionRow {
  id: number;
  name: string;
  target_type: TargetType;
  target_id: number;
  discount_type: DiscountType;
  discount_value: string; // NUMERIC llega como string desde pg
  starts_at: string;
  ends_at: string;
  status: Status;
  created_at: string;
}

export interface Promotion extends PromotionRow {
  target_name: string | null;
}

export interface Summary {
  scheduled: number;
  active: number;
  finished: number;
  valid_today: number;
}