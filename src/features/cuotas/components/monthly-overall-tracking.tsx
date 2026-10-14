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

function pct(value: number | null) {
  return value === null ? "—" : value.toFixed(2) + "%";
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
      {cycle.status === "activo" && cycle.suggestedDaily ? (
        <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-indigo-900">
                Ritmo sugerido para completar el ciclo
              </p>
              <p className="mt-1 text-xs text-indigo-600">
                Quedan {cycle.daysRemaining} {cycle.daysRemaining === 1 ? "día" : "días"}, contando hoy.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
              {cycle.daysRemaining} días restantes
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["AMT", cycle.suggestedDaily.amt],
              ["HHP FP", cycle.suggestedDaily.hhpFp],
              ["HHP MASS", cycle.suggestedDaily.hhpMass],
              ["TABS", cycle.suggestedDaily.tabs],
              ["ACC", cycle.suggestedDaily.acc],
              ["SC+", cycle.suggestedDaily.scPlus],
              ["Láminas", cycle.suggestedDaily.laminas],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-indigo-100 bg-white px-3 py-2.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {label} / día
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                  {money(Number(value))}
                </p>
              </div>
            ))}

            <div className="rounded-lg border border-indigo-100 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Metas de ratio
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                AR {cycle.targets.arPct.toFixed(2)}% · ECO {cycle.targets.ecoPct.toFixed(2)}%
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="AMT" target={cycle.targets.amt} actual={cycle.actuals.amt} moneyValue />
        <MetricCard label="SC+" target={cycle.targets.scPlus} actual={cycle.actuals.scPlus} moneyValue />
        <MetricCard label="Láminas" target={cycle.targets.laminas} actual={cycle.actuals.laminas} moneyValue />
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
            value={cycle.actuals.arPct}
            target={cycle.targets.arPct}
            numerator={cycle.actuals.hhpTabsUnits}
            denominator={cycle.actuals.accNonWeaUnits}
            denominatorLabel="ACC sin WEA"
          />
          <RatioCard
            label="ECO"
            value={cycle.actuals.ecoPct}
            target={cycle.targets.ecoPct}
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
  target,
  numerator,
  denominator,
  denominatorLabel,
}: {
  label: string;
  value: number | null;
  target: number;
  numerator: number;
  denominator: number;
  denominatorLabel: string;
}) {
  const compliance = value !== null && target > 0 ? (value / target) * 100 : 0;
  const width = Math.min(Math.max(compliance, 0), 100);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{pct(value)}</p>
          <p className="mt-1 text-xs text-slate-400">
            Meta {target.toFixed(2)}%
          </p>
        </div>
        <span className="text-sm font-bold tabular-nums text-indigo-600">
          {value !== null && target > 0 ? compliance.toFixed(1) + "%" : "—"}
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-600"
          style={{ width: width + "%" }}
        />
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        {numerator} und. HHP + TABS / {denominator} und. {denominatorLabel}
      </p>
    </article>
  );
}
