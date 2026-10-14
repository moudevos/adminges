import { MonthlyTrackingView } from "@/features/cuotas/components/monthly-tracking-view";
import { loadMonthlyTracking } from "@/features/cuotas/server/monthly-loaders";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function MonthlyTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string | string[] }>;
}) {
  const params = await searchParams;
  const cycleId = first(params.ciclo);
  const data = await loadMonthlyTracking(
    cycleId && /^[0-9a-f-]{36}$/i.test(cycleId) ? cycleId : undefined,
  );

  return <MonthlyTrackingView data={data} />;
}
