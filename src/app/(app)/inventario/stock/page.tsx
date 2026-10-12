import { InventoryStockTable } from "@/features/inventario/components/stock-table";
import { loadInventoryStock } from "@/features/inventario/server/loaders";

export default async function InventoryStockPage() {
  const stock = await loadInventoryStock();
  return <InventoryStockTable rows={stock} />;
}
