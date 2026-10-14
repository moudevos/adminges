import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { loadDashboardSummary } from "@/features/dashboard/server/loaders";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await loadDashboardSummary();
  return <DashboardOverview data={data} />;
}
