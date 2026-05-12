// ─── Provider / Therapist Types ───────────────────────────────

export interface TherapistService {
  service_id: string;
  name: string;
  name_ar: string | null;
  is_active: boolean | null;
}

export interface Therapist {
  id: string;
  created_at: string;
  full_name: string | null;
  is_licensed: boolean | null;
  gender: string | null;
  is_active: boolean | null;
  notes: string | null;
  whatsapp_number: string | null;
  email: string | null;
  rating: number | null;
  home_address: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  max_slots_per_day: number | null;
  home_district: string | null;
  services: TherapistService[];
}

export interface TherapistForm {
  full_name: string;
  gender: string;
  whatsapp_number: string;
  email: string;
  is_licensed: boolean;
  is_active: boolean;
  max_slots_per_day: string;
  home_district: string;
  home_address: string;
  notes: string;
  service_ids: string[];
}
