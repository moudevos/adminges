import { SalesDayView } from "@/features/ventas/components/sales-day-view";
import { loadCurrentSalesDay } from "@/features/ventas/server/loaders";

export const dynamic = "force-dynamic";

export default async function SalesDayPage() {
  const data = await loadCurrentSalesDay();
  return <SalesDayView data={data} />;
}
