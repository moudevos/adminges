import { DailyQuotaView } from "@/features/cuotas/components/daily-quota-view";
import { loadDailyQuotaPage } from "@/features/cuotas/server/loaders";

function peruDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export const dynamic = "force-dynamic";

export default async function DailyQuotaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string | string[] }>;
}) {
  const params = await searchParams;
  const date = validDate(first(params.fecha)) ?? peruDateString();
  const data = await loadDailyQuotaPage(date);

  return <DailyQuotaView key={date + ":" + (data.quota?.updatedAt ?? "new")} data={data} />;
}
