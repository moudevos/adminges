import { InventoryManagement } from "@/components/dashboard/inventory-management";
import { loadInventoryStock } from "@/lib/dashboard/loaders";

export default async function InventoryStockPage() {
  const stock = await loadInventoryStock();

  return (
    <InventoryManagement
      activeView="stock"
      stock={stock}
      movements={[]}
      snapshots={[]}
    />
  );
}
