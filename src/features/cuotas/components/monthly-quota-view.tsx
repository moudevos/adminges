import { MonthlyCycleForm } from "@/features/cuotas/components/monthly-cycle-form";
import { MonthlyCyclesTable } from "@/features/cuotas/components/monthly-cycles-table";
import type { MonthlyQuotaPageData } from "@/features/cuotas/domain/monthly-types";

export function MonthlyQuotaView({ data }: { data: MonthlyQuotaPageData }) {
  if (!data.schemaReady) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {data.schemaMessage}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <MonthlyCycleForm
        key={data.selectedCycle?.id ?? "new-cycle"}
        today={data.today}
        people={data.eligiblePeople}
        selected={data.selectedCycle}
      />
      <MonthlyCyclesTable cycles={data.cycles} />
    </div>
  );
}
