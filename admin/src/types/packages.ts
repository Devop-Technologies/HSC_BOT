// ─── Package Types ────────────────────────────────────────────

export interface PackageServiceLink {
  id?: string;
  package_id?: string;
  service_id: string;
  sessions_allowed: number | null;
  service?: {
    id: string;
    name: string;
    name_ar: string | null;
    price: number | null;
    duration_minutes: number | null;
    delivery_fee: number | null;
    price_options?: {
      duration_minutes: number | null;
      price: number | null;
      delivery_fee: number | null;
      label: string | null;
      sort_order: number;
    }[];
  } | null;
}

export interface Package {
  id: string;
  name: string;
  description: string | null;
  total_sessions: number | null;
  total_price: number | null;
  validity_days: number | null;
  is_active: boolean | null;
  created_at: string;
  service_links?: PackageServiceLink[];
}

export interface PackageForm {
  name: string;
  description: string;
  total_sessions: string;
  total_price: string;
  validity_days: string;
  service_links: {
    service_id: string;
    sessions_allowed: string;
  }[];
}

export interface PackageWalletLedgerEvent {
  id: string;
  customer_package_id: string;
  booking_id: string | null;
  event_type: string;
  session_delta: number | null;
  balance_after: number | null;
  notes: string | null;
  created_at: string | null;
}

export interface CustomerPackageWallet {
  id: string;
  customer_id: string;
  package_id: string;
  purchased_at: string | null;
  expires_at: string | null;
  status: 'pending_payment' | 'active' | 'expired' | 'fully_used' | 'refunded' | 'void' | string;
  total_sessions: number | null;
  remaining_sessions: number | null;
  purchase_price: number | null;
  discount_percent: number | null;
  source: string | null;
  first_used_at: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
  customer?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  package?: {
    id: string;
    name: string;
    total_sessions: number | null;
    total_price: number | null;
    validity_days: number | null;
  } | null;
  ledger?: PackageWalletLedgerEvent[];
}
