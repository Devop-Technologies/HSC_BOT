// ─── Dashboard Types ──────────────────────────────────────────

export interface DashboardData {
  stats: {
    today_bookings:   number;
    today_change:     number;
    active_providers: number;
    total_providers:  number;
    pending_count:    number;
    total_clients:    number;
    new_ratings:      number;
  };
  breakdown: Record<string, number>;
  recent: {
    id: string;
    customer_name: string;
    service_name: string;
    booking_date: string | null;
    start_time: string | null;
    status: string | null;
  }[];
  attention: {
    pending_count:    number;
    no_show_count:    number;
    unpaid_completed: number;
  };
}
