export type AppRole = "admin" | "supervisor";

export interface Profile {
  id: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
