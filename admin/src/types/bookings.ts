// ─── Booking Types ────────────────────────────────────────────

export interface BookingCustomer {
  id: string;
  full_name: string | null;
  phone: string;
}

export interface BookingTherapist {
  id: string;
  full_name: string | null;
}

export interface BookingService {
  id: string;
  name: string;
  name_ar: string | null;
}

export interface BookingPackage {
  id: string;
  name: string;
}

export interface Booking {
  id: string;
  created_at: string;
  customer_id: string | null;
  therapist_id: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location_type: string | null;
  address: string | null;
  status: string | null;
  payment_status: string | null;
  customer: BookingCustomer | null;
  therapist: BookingTherapist | null;
  service: BookingService | null;
  package: BookingPackage | null;
  rating_token: string | null;
  rating_submitted: boolean;
  rating_value: number | null;
}

export interface RescheduleBooking {
  id: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  therapist_id: string | null;
  customer?: { full_name: string | null } | null;
}

export interface RescheduleForm {
  booking_date: string;
  start_time: string;
  end_time: string;
  therapist_id: string;
}
