export interface DeliveryZone {
  id: string;
  label?: string;
  district: string;
  min_km: number;
  base_fee: number;
  fee_per_km: number;
  max_km: number | null;
  sort_order?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryZoneForm {
  label: string;
  min_km: string;
  base_fee: string;
  fee_per_km: string;
  max_km: string;
}
