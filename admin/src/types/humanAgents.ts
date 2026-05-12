export interface HumanAgent {
  id: string;
  name: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HumanAgentForm {
  name: string;
  phone_number: string;
}
