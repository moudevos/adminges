import { SalesDaysHistory } from "@/features/ventas/components/sales-days-history";
import {
  daysAgoDateString,
  loadSalesDaysHistory,
  peruDateString,
} from "@/features/ventas/server/loaders";

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export const dynamic = "force-dynamic";

export default async function SalesDaysPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string | string[];
    hasta?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawFrom = Array.isArray(params.desde) ? params.desde[0] : params.desde;
  const rawTo = Array.isArray(params.hasta) ? params.hasta[0] : params.hasta;

  const from = validDate(rawFrom) ?? daysAgoDateString(30);
  const to = validDate(rawTo) ?? peruDateString();
  const data = await loadSalesDaysHistory(from, to);

  return <SalesDaysHistory data={data} />;
}
