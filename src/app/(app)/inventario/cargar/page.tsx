import { InventoryManagement } from "@/components/dashboard/inventory-management";
import { loadInventorySnapshots } from "@/lib/dashboard/loaders";

export default async function InventoryUploadPage() {
  const snapshots = await loadInventorySnapshots();

  return (
    <InventoryManagement
      activeView="cargar"
      stock={[]}
      movements={[]}
      snapshots={snapshots}
    />
  );
}
