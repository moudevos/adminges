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
