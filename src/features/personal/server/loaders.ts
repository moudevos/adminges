import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PuestoRow = {
  id: string;
  nombre: string;
};

export type PersonaRow = {
  id: string;
  puesto_id: string;
  nombres: string;
  apellidos: string;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  is_active: boolean;
};

export async function loadPersonalData() {
  const supabase = await createClient();

  const [puestoResult, personaResult] = await Promise.all([
    supabase
      .from("puestos")
      .select("id, nombre")
      .eq("is_active", true)
      .order("nombre"),
    supabase
      .from("personas")
      .select(
        "id, puesto_id, nombres, apellidos, documento, telefono, email, is_active",
      )
      .order("apellidos")
      .order("nombres"),
  ]);

  const puestos: PuestoRow[] = (puestoResult.data ?? []).map((row) => ({
    id: row.id,
    nombre: row.nombre,
  }));

  const personas: PersonaRow[] = (personaResult.data ?? []).map((row) => ({
    id: row.id,
    puesto_id: row.puesto_id,
    nombres: row.nombres,
    apellidos: row.apellidos,
    documento: row.documento,
    telefono: row.telefono,
    email: row.email,
    is_active: Boolean(row.is_active),
  }));

  return { puestos, personas };
}
