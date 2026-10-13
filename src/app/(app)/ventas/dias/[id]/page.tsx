import { notFound } from "next/navigation";
import { SalesDayHistoryDetail } from "@/features/ventas/components/sales-day-history-detail";
import { loadSalesDayById } from "@/features/ventas/server/loaders";

export const dynamic = "force-dynamic";

export default async function SalesDayHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const data = await loadSalesDayById(id);
  if (!data) notFound();

  return <SalesDayHistoryDetail data={data} />;
}
