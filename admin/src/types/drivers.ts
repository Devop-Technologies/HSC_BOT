export interface Driver {
  id: string;
  name: string;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriverForm {
  name: string;
  phone_number: string;
}
