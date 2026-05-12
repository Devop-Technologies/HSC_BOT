// ─── Settings Types ───────────────────────────────────────────

export interface BusinessHours {
  id: string;
  created_at: string;
  service_type: string | null;
  is_ramadan: boolean | null;
  open_time: string | null;
  close_time: string | null;
}

export interface BusinessHoursForm {
  service_type: string;
  is_ramadan: boolean;
  open_time: string;
  close_time: string;
}
