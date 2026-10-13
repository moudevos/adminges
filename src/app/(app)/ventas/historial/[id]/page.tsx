import { notFound } from "next/navigation";
import { SaleHistoryDetail } from "@/features/ventas/components/sale-history-detail";
import { loadSaleHistoryDetail } from "@/features/ventas/server/loaders";

export const dynamic = "force-dynamic";

export default async function SaleHistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const data = await loadSaleHistoryDetail(id);

  if (data.schemaReady && !data.sale) {
    notFound();
  }

  return <SaleHistoryDetail data={data} />;
}
