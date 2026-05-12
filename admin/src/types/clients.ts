// ─── Client Types ─────────────────────────────────────────────

export interface CustomerLocation {
  id: string;
  [key: string]: unknown;
}

export interface Customer {
  id: string;
  created_at: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  last_active_at: string | null;
  customer_locations: CustomerLocation[];
}

export interface BookingHistory {
  id: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  payment_status: string | null;
  location_type: string | null;
  address: string | null;
  created_at: string;
  service_name: string | null;
  therapist_name: string | null;
  rating: number | null;
  rating_comment: string | null;
  rating_submitted: boolean;
  location_id: string | null;
}

export interface ClientHistory {
  history: BookingHistory[];
  stats: {
    total: number;
    completed: number;
    cancelled: number;
    avg_rating: number | null;
    rated_count: number;
  };
}

export interface ChatMessage {
  id: string;
  created_at: string;
  message: string | null;
  direction: string | null; // 'inbound' | 'outbound'
}
