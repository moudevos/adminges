import { MonthlyQuotaView } from "@/features/cuotas/components/monthly-quota-view";
import { loadMonthlyQuotaPage } from "@/features/cuotas/server/monthly-loaders";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function MonthlyQuotaPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string | string[] }>;
}) {
  const params = await searchParams;
  const cycleId = first(params.ciclo);
  const data = await loadMonthlyQuotaPage(
    cycleId && /^[0-9a-f-]{36}$/i.test(cycleId) ? cycleId : undefined,
  );

  return (
    <MonthlyQuotaView
      key={data.selectedCycle?.id ?? "new-cycle"}
      data={data}
    />
  );
}
