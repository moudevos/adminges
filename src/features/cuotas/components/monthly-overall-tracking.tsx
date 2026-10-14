import type { MonthlyCycleDetail } from "@/features/cuotas/domain/monthly-types";

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function percent(actual: number, target: number) {
  return target > 0 ? (actual / target) * 100 : 0;
}

function ratio(value: number | null) {
  return value === null ? "—" : value.toFixed(2) + "x";
}

export function MonthlyOverallTracking({
  cycle,
}: {
  cycle: MonthlyCycleDetail;
}) {
  const components = [
    { label: "HHP FP", target: cycle.targets.hhpFp, actual: cycle.actuals.hhpFp },
    { label: "HHP MASS", target: cycle.targets.hhpMass, actual: cycle.actuals.hhpMass },
    { label: "TABS", target: cycle.targets.tabs, actual: cycle.actuals.tabs },
    { label: "ACC", target: cycle.targets.acc, actual: cycle.actuals.acc },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="AMT" target={cycle.targets.amt} actual={cycle.actuals.amt} moneyValue />
        <MetricCard label="SC+" target={cycle.targets.scPlus} actual={cycle.actuals.scPlus} moneyValue />
        <MetricCard label="Láminas" target={cycle.targets.laminas} actual={cycle.actuals.laminas} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Composición AMT</p>
            <p className="mt-1 text-xs text-slate-400">
              HHP FP = Serie S + Z · HHP MASS = Serie A
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {components.map((item) => (
              <ProgressRow key={item.label} {...item} />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <RatioCard
            label="AR"
            value={cycle.actuals.ar}
            numerator={cycle.actuals.hhpTabsUnits}
            denominator={cycle.actuals.accNonWeaUnits}
            denominatorLabel="ACC sin WEA"
          />
          <RatioCard
            label="ECO"
            value={cycle.actuals.eco}
            numerator={cycle.actuals.hhpTabsUnits}
            denominator={cycle.actuals.weaUnits}
            denominatorLabel="WEA"
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  target,
  actual,
  moneyValue = false,
}: {
  label: string;
  target: number;
  actual: number;
  moneyValue?: boolean;
}) {
  const progress = percent(actual, target);
  const width = Math.min(Math.max(progress, 0), 100);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">
            {moneyValue ? money(actual) : actual}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Cuota {moneyValue ? money(target) : target}
          </p>
        </div>
        <span className="text-sm font-bold tabular-nums text-indigo-600">
          {target > 0 ? progress.toFixed(1) + "%" : "—"}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: width + "%" }} />
      </div>
    </article>
  );
}

function ProgressRow({
  label,
  target,
  actual,
}: {
  label: string;
  target: number;
  actual: number;
}) {
  const progress = percent(actual, target);
  const width = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-700">{label}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {money(actual)} / {money(target)}
          </p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-700">
          {target > 0 ? progress.toFixed(1) + "%" : "—"}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: width + "%" }} />
      </div>
    </div>
  );
}

function RatioCard({
  label,
  value,
  numerator,
  denominator,
  denominatorLabel,
}: {
  label: string;
  value: number | null;
  numerator: number;
  denominator: number;
  denominatorLabel: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{ratio(value)}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        {numerator} und. HHP + TABS / {denominator} und. {denominatorLabel}
      </p>
    </article>
  );
}
