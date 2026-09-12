export type AppRole = "admin" | "supervisor" | "promotor";

export interface Profile {
  id: string;
  full_name: string | null;
  email?: string | null;
  document: string | null;
  phone: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  user_id: string | null;
  store_id: string | null;
  first_name: string;
  last_name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  role: AppRole;
  is_active: boolean;
  hired_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
