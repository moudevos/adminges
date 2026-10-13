import type { SalesMetricProgress } from "@/features/ventas/domain/types";

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

export function SalesProgressBar({
  label,
  progress,
  kind,
  compact = false,
}: {
  label: string;
  progress: SalesMetricProgress;
  kind: "money" | "units";
  compact?: boolean;
}) {
  const width = Math.max(0, Math.min(progress.percent, 100));
  const actual =
    kind === "money" ? money(progress.actual) : String(progress.actual);
  const target =
    kind === "money" ? money(progress.target) : String(progress.target);

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <div>
          <p
            className={
              "font-semibold uppercase tracking-[0.05em] text-slate-500 " +
              (compact ? "text-[9px]" : "text-[10px]")
            }
          >
            {label}
          </p>
          {!compact ? (
            <p className="mt-0.5 text-xs text-slate-500">
              {actual} / {target}
            </p>
          ) : null}
        </div>
        <span
          className={
            "font-bold tabular-nums text-slate-800 " +
            (compact ? "text-xs" : "text-sm")
          }
        >
          {progress.target > 0 ? progress.percent.toFixed(1) + "%" : "—"}
        </span>
      </div>

      <div className={compact ? "h-1.5" : "h-2.5"}>
        <div className="h-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
            style={{ width: width + "%" }}
          />
        </div>
      </div>
    </div>
  );
}
