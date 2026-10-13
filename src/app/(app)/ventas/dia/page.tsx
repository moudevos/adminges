import { SalesDayView } from "@/features/ventas/components/sales-day-view";
import {
  loadCurrentSalesDay,
  loadPaymentMethods,
} from "@/features/ventas/server/loaders";

export const dynamic = "force-dynamic";

export default async function SalesDayPage() {
  const [data, paymentMethods] = await Promise.all([
    loadCurrentSalesDay(),
    loadPaymentMethods(),
  ]);

  return <SalesDayView data={data} paymentMethods={paymentMethods} />;
}
