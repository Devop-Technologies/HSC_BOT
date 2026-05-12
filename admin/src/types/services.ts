// ─── Service Types ────────────────────────────────────────────

export interface ServicePriceOption {
  id?: string;
  duration_minutes: number | null;
  price: number | null;
  delivery_fee: number | null;
  label: string | null;  // e.g. "60 min", "90 min", "Standard"
  sort_order: number;
}

export interface Service {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  icon: string | null;           // emoji or icon name for display
  parent_id: string | null;      // null = root-level category
  sort_order: number;
  oil_based: boolean | null;
  available_for_home: boolean | null;
  available_in_center: boolean | null;
  is_active: boolean | null;
  service_category: 'category' | 'service';
  price: number | null;          // default/fallback price
  duration_minutes: number | null; // default duration
  delivery_fee: number | null;
  created_at: string;
  // Expanded (joined via API)
  price_options?: ServicePriceOption[];
  children?: Service[];
  // Computed display
  _depth?: number;
}

export interface ServiceForm {
  name: string;
  name_ar: string;
  description: string;
  icon: string;
  parent_id: string;
  sort_order: string;
  oil_based: boolean;
  available_for_home: boolean;
  available_in_center: boolean;
  service_category: 'category' | 'service';
  price: string;
  duration_minutes: string;
  delivery_fee: string;
  price_options: Omit<ServicePriceOption, 'id'>[];
}
