import { loadDailyQuotaForDate } from "@/features/cuotas/server/loaders";
import { SalesDayView } from "@/features/ventas/components/sales-day-view";
import {
  loadCurrentSalesDay,
  loadPaymentMethods,
} from "@/features/ventas/server/loaders";

export const dynamic = "force-dynamic";

export default async function SalesDayPage() {
  const data = await loadCurrentSalesDay();
  const [paymentMethods, dailyQuota] = await Promise.all([
    loadPaymentMethods(),
    loadDailyQuotaForDate(data.date),
  ]);

  return (
    <SalesDayView
      data={data}
      paymentMethods={paymentMethods}
      dailyQuota={dailyQuota}
    />
  );
}
