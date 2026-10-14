import { redirect } from "next/navigation";

// Compatibilidad con enlaces anteriores: el conteo ahora usa PDF con
// selector de almacén y orientación dentro de Inventario > Cargar.
export default function ManualInventoryPage() {
  redirect("/inventario/cargar?conteo=manual");
}
