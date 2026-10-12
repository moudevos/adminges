import { redirect } from "next/navigation";
import { getNavigationHref } from "@/components/shell/navigation";

export default async function LegacyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    module?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  redirect(getNavigationHref(params.module, params.view));
}
